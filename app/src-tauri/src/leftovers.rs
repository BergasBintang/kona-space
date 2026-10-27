// The leftovers ledger (feature F11): what each session started and what is still alive after it ended.
// Every program a session starts is inside Kona's job object (job.rs), so Windows itself tells us the full list, including programs that
// were started and then lost their parent. Every few seconds, while sessions are open or something is alive, Kona reads that list, joins
// each program to the session that started it (by the chain of parents, or what it remembers from the last look), and notes the
// command line and any TCP port it listens on. A program that outlives its session is "left behind". Kona stops one only after the owner
// confirms, and only if it is still the same program (the process id and the start time both match, because ids are reused).
// Everything is also appended to `leftovers.jsonl` in Kona's data folder. When Kona itself closes, the job object stops all of them.
use crate::winproc;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;

#[derive(Clone, Serialize)]
pub struct Item {
    pub pid: u32,
    /// `pid:start time`, what the screen sends back to name this one program for good (ids are reused; the start time, a Windows file
    /// time, is too big for a JavaScript number, so the two travel together as text)
    pub key: String,
    pub name: String,
    pub cmd: String,
    pub ports: Vec<u16>,
    /// the session that started it; empty when it could not be told
    pub session_id: String,
    pub first_seen: String,
    pub age_secs: u64,
    pub left_behind: bool,
    pub ignored: bool,
}

struct Tracked {
    item: Item,
    ppid: u32,
    first: Instant,
}

struct SessionRec {
    id: String,
    claude_pid: u32,
    ended: bool,
}

#[derive(Default)]
struct State {
    sessions: Vec<SessionRec>,
    items: HashMap<(u32, u64), Tracked>,
    /// programs that are Kona's own helpers, or that Windows would not let us read: not shown, not looked at again
    skip: HashSet<(u32, u64)>,
    ignored: HashSet<(u32, u64)>,
}

pub struct Tracker {
    st: Mutex<State>,
    log: PathBuf,
}

#[derive(Serialize)]
pub struct SessionState {
    pub id: String,
    pub ended: bool,
    pub running: u32,
    pub left_behind: u32,
}

#[derive(Serialize)]
pub struct Overview {
    pub items: Vec<Item>,
    pub sessions: Vec<SessionState>,
}

fn parse_key(key: &str) -> Result<(u32, u64), String> {
    let (p, s) = key.split_once(':').ok_or("That is not a program on the list")?;
    Ok((p.parse().map_err(|_| "That is not a program on the list")?, s.parse().map_err(|_| "That is not a program on the list")?))
}

impl Tracker {
    pub fn new(base: &Path) -> Self {
        Self { st: Mutex::new(State::default()), log: base.join("leftovers.jsonl") }
    }

    fn log(&self, event: &str, it: &Item) {
        // keep the log small: past 1 MB the old one is set aside and a new one starts
        if std::fs::metadata(&self.log).map(|m| m.len() > 1_000_000).unwrap_or(false) {
            let _ = std::fs::rename(&self.log, self.log.with_extension("jsonl.old"));
        }
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&self.log) {
            let line = serde_json::json!({"at": crate::tickets::now(), "event": event, "session": it.session_id, "pid": it.pid, "name": it.name, "cmd": it.cmd, "ports": it.ports});
            let _ = writeln!(f, "{line}");
        }
    }

    pub fn register(&self, session_id: &str, claude_pid: u32) {
        self.st.lock().unwrap().sessions.push(SessionRec { id: session_id.to_string(), claude_pid, ended: false });
    }

    /// The session ended: look once more right away, so what it left behind shows at once.
    pub fn ended(&self, session_id: &str) {
        if let Some(s) = self.st.lock().unwrap().sessions.iter_mut().find(|s| s.id == session_id) {
            s.ended = true;
        }
        self.scan();
    }

    /// Is there anything to watch? (If not, the timer does no work.)
    pub fn busy(&self) -> bool {
        let st = self.st.lock().unwrap();
        st.sessions.iter().any(|s| !s.ended) || !st.items.is_empty()
    }

    pub fn scan(&self) {
        let live = crate::job::member_pids();
        let snap = winproc::snapshot();
        let by_pid: HashMap<u32, (u32, String)> = snap.iter().map(|r| (r.pid, (r.ppid, r.name.clone()))).collect();
        let ports = if live.is_empty() { HashMap::new() } else { winproc::listening_ports() };
        let me = std::env::current_exe().ok().and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase()));
        let mut st = self.st.lock().unwrap();
        let claude_pids: HashSet<u32> = st.sessions.iter().map(|s| s.claude_pid).collect();
        let mut seen: HashSet<(u32, u64)> = HashSet::new();
        for pid in live {
            if claude_pids.contains(&pid) { continue; }
            let Some(started) = winproc::creation_time(pid) else { continue };
            let key = (pid, started);
            if st.skip.contains(&key) { continue; }
            if let Some(t) = st.items.get_mut(&key) {
                t.item.ports = ports.get(&pid).cloned().unwrap_or_default();
                seen.insert(key);
                continue;
            }
            let (ppid, name) = by_pid.get(&pid).cloned().unwrap_or((0, String::new()));
            let lower = name.to_lowercase();
            let cmd = winproc::command_line(pid).unwrap_or_default();
            // Kona's own helpers (the board's tool server) and the console host are not leftovers
            if lower == "conhost.exe" || lower == "openconsole.exe" || (Some(&lower) == me.as_ref() && cmd.contains("--mcp-board")) {
                st.skip.insert(key);
                continue;
            }
            // which session started it: follow the parents; else the one live session; else unknown
            let mut owner: Option<String> = None;
            let mut p = pid;
            for _ in 0..24 {
                if let Some(s) = st.sessions.iter().find(|s| s.claude_pid == p) { owner = Some(s.id.clone()); break; }
                if let Some((pp, _)) = by_pid.get(&p) { p = *pp; }
                else if let Some(t) = st.items.values().find(|t| t.item.pid == p) { p = t.ppid; }
                else { break; }
            }
            if owner.is_none() {
                let live_sessions: Vec<&SessionRec> = st.sessions.iter().filter(|s| !s.ended).collect();
                if live_sessions.len() == 1 { owner = Some(live_sessions[0].id.clone()); }
            }
            let item = Item { pid, key: format!("{pid}:{started}"), name, cmd, ports: ports.get(&pid).cloned().unwrap_or_default(), session_id: owner.unwrap_or_default(), first_seen: crate::tickets::now(), age_secs: 0, left_behind: false, ignored: false };
            self.log("seen", &item);
            st.items.insert(key, Tracked { item, ppid, first: Instant::now() });
            seen.insert(key);
        }
        // what is no longer in the job has ended
        let gone: Vec<(u32, u64)> = st.items.keys().filter(|k| !seen.contains(k)).cloned().collect();
        for k in gone {
            if let Some(t) = st.items.remove(&k) { self.log("ended", &t.item); }
        }
    }

    pub fn overview(&self) -> Overview {
        let st = self.st.lock().unwrap();
        let ended: HashSet<&str> = st.sessions.iter().filter(|s| s.ended).map(|s| s.id.as_str()).collect();
        // a shell that only holds a program it started (bash or cmd around a dev server) is not listed: the program is the leftover,
        // and the shell goes when the program does
        let parent_of: HashMap<u32, u32> = st.items.values().map(|t| (t.item.pid, t.ppid)).collect();
        let mut holders: HashSet<u32> = HashSet::new();
        for t in st.items.values() {
            let mut p = t.ppid;
            for _ in 0..12 {
                if parent_of.contains_key(&p) { holders.insert(p); }
                match parent_of.get(&p) { Some(pp) => p = *pp, None => break }
            }
        }
        let is_shell = |n: &str| matches!(n.to_lowercase().as_str(), "bash.exe" | "sh.exe" | "cmd.exe" | "powershell.exe" | "pwsh.exe" | "wsl.exe");
        let mut items: Vec<Item> = vec![];
        for (key, t) in st.items.iter() {
            if is_shell(&t.item.name) && holders.contains(&t.item.pid) { continue; }
            let mut it = t.item.clone();
            it.age_secs = t.first.elapsed().as_secs();
            it.ignored = st.ignored.contains(key);
            it.left_behind = ended.contains(it.session_id.as_str());
            // a short-lived helper (git, a shell for one command) is not worth showing unless it keeps a port or outlived its session
            if it.ports.is_empty() && it.age_secs < 10 && !it.left_behind { continue; }
            items.push(it);
        }
        items.sort_by(|a, b| b.left_behind.cmp(&a.left_behind).then(b.ports.len().cmp(&a.ports.len())).then(a.first_seen.cmp(&b.first_seen)));
        let sessions = st.sessions.iter().map(|s| SessionState {
            id: s.id.clone(), ended: s.ended,
            running: items.iter().filter(|i| i.session_id == s.id && !i.left_behind).count() as u32,
            left_behind: items.iter().filter(|i| i.session_id == s.id && i.left_behind && !i.ignored).count() as u32,
        }).collect();
        Overview { items, sessions }
    }

    pub fn ignore(&self, key: &str) -> Result<(), String> {
        let k = parse_key(key)?;
        self.st.lock().unwrap().ignored.insert(k);
        Ok(())
    }

    /// Stop one program the owner chose, and anything it started. It must still be the same program (same id and start time).
    pub fn stop(&self, key: &str) -> Result<String, String> {
        let (pid, started) = parse_key(key)?;
        let item = {
            let st = self.st.lock().unwrap();
            st.items.get(&(pid, started)).map(|t| t.item.clone()).ok_or("That program is not on the list any more")?
        };
        if winproc::creation_time(pid) != Some(started) {
            return Err("That program has already ended".into());
        }
        // its children first, then the program itself
        let snap = winproc::snapshot();
        let mut order = vec![pid];
        let mut i = 0;
        while i < order.len() {
            let parent = order[i];
            let kids: Vec<u32> = snap.iter().filter(|r| r.ppid == parent && !order.contains(&r.pid)).map(|r| r.pid).collect();
            order.extend(kids);
            i += 1;
        }
        let mut stopped = 0;
        for p in order.iter().rev() {
            if winproc::terminate(*p) { stopped += 1; }
        }
        self.log("stopped", &item);
        if stopped == 0 { return Err("Windows would not let Kona stop it".into()); }
        std::thread::sleep(std::time::Duration::from_millis(300));
        self.scan();
        Ok(format!("Stopped {}{}.", item.name, if stopped > 1 { format!(" and {} it started", stopped - 1) } else { String::new() }))
    }

    /// Is this session still running?
    pub fn is_live(&self, session_id: &str) -> bool {
        self.st.lock().unwrap().sessions.iter().any(|s| s.id == session_id && !s.ended)
    }

    /// How many programs of these sessions are alive (for the warning before a ticket's copy is removed).
    pub fn alive_for(&self, session_ids: &[String]) -> u32 {
        let o = self.overview();
        o.items.iter().filter(|i| !i.ignored && session_ids.contains(&i.session_id)).count() as u32
    }
}

// ---- Claude's own scratch folders: `%TEMP%\claude\<project>\<session id>\...`

#[derive(Serialize)]
pub struct TempInfo {
    pub session_id: String,
    pub path: String,
    pub bytes: u64,
    pub files: u64,
    /// the walk stopped early because the folder is huge
    pub partial: bool,
}

fn claude_temp_root() -> PathBuf {
    std::env::temp_dir().join("claude")
}

fn is_session_id(s: &str) -> bool {
    s.len() == 36 && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn find_session_dir(session_id: &str) -> Option<PathBuf> {
    if !is_session_id(session_id) { return None; }
    let root = claude_temp_root();
    for proj in std::fs::read_dir(&root).ok()?.filter_map(Result::ok) {
        let d = proj.path().join(session_id);
        if d.is_dir() { return Some(d); }
    }
    None
}

fn measure(dir: &Path) -> (u64, u64, bool) {
    let (mut bytes, mut files, mut budget) = (0u64, 0u64, 200_000u32);
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&d) else { continue };
        for e in rd.filter_map(Result::ok) {
            if budget == 0 { return (bytes, files, true); }
            budget -= 1;
            let Ok(m) = e.metadata() else { continue };
            if m.is_dir() { stack.push(e.path()); } else { bytes += m.len(); files += 1; }
        }
    }
    (bytes, files, false)
}

pub fn temp_for(session_ids: &[String]) -> Vec<TempInfo> {
    session_ids.iter().filter_map(|id| {
        let d = find_session_dir(id)?;
        let (bytes, files, partial) = measure(&d);
        Some(TempInfo { session_id: id.clone(), path: d.to_string_lossy().to_string(), bytes, files, partial })
    }).collect()
}

/// Delete one finished session's scratch folder. Refused while that session runs, and for anything outside `%TEMP%\claude`.
pub fn clean_temp(tracker: &Tracker, session_id: &str) -> Result<String, String> {
    if tracker.is_live(session_id) {
        return Err("That session is still running".into());
    }
    let d = find_session_dir(session_id).ok_or("There is no scratch folder for that session")?;
    let root = std::fs::canonicalize(claude_temp_root()).map_err(|e| e.to_string())?;
    let real = std::fs::canonicalize(&d).map_err(|e| e.to_string())?;
    if !real.starts_with(&root) || real == root {
        return Err("That folder is not inside Claude's scratch area".into());
    }
    let (bytes, files, _) = measure(&real);
    std::fs::remove_dir_all(&real).map_err(|e| format!("Could not delete it: {e}"))?;
    Ok(format!("Deleted {files} files ({} KB).", bytes / 1024))
}
