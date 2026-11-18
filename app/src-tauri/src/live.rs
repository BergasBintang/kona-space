// The Live kind of mockup (decision 94 in kona-space-app.md).
//
// A Draw mockup is a folder of plain files. A Live mockup is the project's REAL program: its card holds only a recipe, the `live` part of `mockup.json`, which says how the program
// starts (a command, a port, where it runs, an optional setup command that makes a throwaway database). The sheet shows the running program in the same drawn device frames.
//
// What this file does, and nothing else:
//   - reads and checks the recipe (a command is only ever run as written, after the sheet showed it and the owner said yes: `Recipe::approval` is what was shown);
//   - runs the setup command and then the start command in the project's folder, one program at a time (the PC is small), keeps the last lines they printed, waits until the port
//     answers, and stops the whole process tree on Stop, on a new Start and when Kona closes;
//   - runs a small web server inside Kona, on 127.0.0.1 and a port of its own (`Live::proxy`), that passes each request of a Live page to `127.0.0.1:<port>` and the answer back, with the
//     sheet's helper put into pages, the program's own address written as the server's address, and the program's own content policy and frame ban left out. The page sees ONE
//     address, so absolute links, cookies, redirects and a login all work as they do in a browser. It passes requests only while the program has answered, and only to that one
//     port, which the recipe names and which was free before the start.
//
// The page of a Live card runs on the address of that server (`http://127.0.0.1:<port>`), which is not the origin of Kona's window (`tauri.localhost`), so the page cannot reach
// Kona or its commands; it may keep cookies and local storage and send forms, as a real program needs. A real address and not a made-up address scheme, because WebView2 does not give
// the cookies of a made-up scheme's answers to the cookie jar (seen on 2026-11-18: a login was never kept). The web is NOT blocked for the page (a real program loads its fonts and
// maps): it is the owner's own program, started by the owner on a yes. A Draw mockup keeps its stricter sandbox (mock.rs).
use crate::mock;
use serde::Serialize;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const LOG_LINES: usize = 300;
const LOG_LINE_LEN: usize = 500;
const SETUP_LIMIT: Duration = Duration::from_secs(180);
/// A page or an answer bigger than this is not passed on
const BODY_LIMIT: usize = 128 * 1024 * 1024;
/// A text answer smaller than this has the program's own address rewritten in it
const REWRITE_LIMIT: usize = 8 * 1024 * 1024;

// ---------------------------------------------------------------- the recipe

#[derive(Clone, Debug, PartialEq)]
pub struct Recipe {
    pub setup: Option<String>,
    pub start: String,
    pub port: u16,
    /// the folder the commands run in, relative to the project's folder ("" is the project's folder)
    pub cwd: String,
    /// the page that opens first, `/` by default
    pub entry: String,
    /// the page asked until the program answers, `/` by default
    pub ready: String,
    pub env: Vec<(String, String)>,
    /// seconds to wait for the program to answer
    pub wait: u64,
    /// what the page may do besides the ordinary: only words of `ALLOWED`, sorted. Shown with the commands, so a yes covers them.
    pub allow: Vec<String>,
    /// Kona runs a fake cloud bucket (S3 and R2 speak the same protocol) for the program and tells it where it is (decision 94b)
    pub bucket: bool,
    /// the data of the card (its demo database file, its bucket, its uploads) is kept when the program stops; `false` deletes it at Stop. Kept by default.
    pub keep: bool,
    /// a command that takes away what the card made outside its data folder (a demo database in a database server); run by "Delete data" before the folder is removed
    pub clean: Option<String>,
}

/// What a recipe may let its page do, each one word. Everything else the frame refuses: it is not a full window.
/// `downloads` save a file; `print` show the print window (the "Save as PDF" of a page); `clipboard` copy to the clipboard; `location` ask for the device's location (the browser still asks,
/// and the question is shown to the owner). Not offered, because it does not work in Kona's window: native `alert`, `confirm` and `prompt` (the window turns them off whatever the frame says)
/// and new windows (a link that wants one is opened in the owner's own browser instead, see `LINKS_SCRIPT`).
pub const ALLOWED: [&str; 4] = ["clipboard", "downloads", "location", "print"];

/// What the sheet is shown of a recipe: the exact commands, and the one string it sends back to say yes
#[derive(Serialize, Clone, Debug)]
pub struct LiveView {
    pub setup: Option<String>,
    pub start: String,
    pub cwd: String,
    pub port: u16,
    pub entry: String,
    pub env: Vec<String>,
    pub allow: Vec<String>,
    pub bucket: bool,
    pub keep: bool,
    pub clean: Option<String>,
    pub approval: String,
}

fn command_ok(v: &serde_json::Value, what: &str) -> Result<String, String> {
    let s = v.as_str().ok_or(format!("{what} must be text"))?.trim().to_string();
    if s.is_empty() || s.len() > 1000 || s.contains(['\n', '\r', '\0']) {
        return Err(format!("{what} must be one line of at most 1000 letters"));
    }
    Ok(s)
}

fn path_ok(v: Option<&serde_json::Value>, what: &str, default: &str) -> Result<String, String> {
    let s = match v {
        None => default.to_string(),
        Some(x) => x.as_str().ok_or(format!("{what} must be text"))?.trim().to_string(),
    };
    if !s.starts_with('/') || s.len() > 200 || s.contains(char::is_whitespace) || s.contains('\\') || s.contains("..") || s.starts_with("//") {
        return Err(format!("{what} must be a path on the program that starts with /"));
    }
    Ok(s)
}

impl Recipe {
    /// `None` when the card has no `live` part (it is a Draw mockup). `Some(Err)` when it has one that cannot be used, with the reason in plain words.
    pub fn from_info(info: &serde_json::Value) -> Option<Result<Recipe, String>> {
        let live = info.get("live")?;
        Some(Self::parse(live))
    }

    fn parse(live: &serde_json::Value) -> Result<Recipe, String> {
        let o = live.as_object().ok_or("live must be an object")?;
        let start = command_ok(o.get("start").ok_or("live needs a start command")?, "start")?;
        let setup = match o.get("setup") {
            None | Some(serde_json::Value::Null) => None,
            Some(v) => Some(command_ok(v, "setup")?),
        };
        let port = o.get("port").and_then(|p| p.as_u64()).ok_or("live needs a port")?;
        if !(1024..=65535).contains(&port) {
            return Err("port must be between 1024 and 65535".to_string());
        }
        let cwd = match o.get("cwd") {
            None => String::new(),
            Some(v) => {
                let s = v.as_str().ok_or("cwd must be text")?.trim().replace('\\', "/");
                if s.starts_with('/') || s.contains(':') || s.split('/').any(|p| p == "..") || s.len() > 200 {
                    return Err("cwd must be a folder inside the project".to_string());
                }
                s.trim_matches('/').to_string()
            }
        };
        let entry = path_ok(o.get("entry"), "entry", "/")?;
        let ready = path_ok(o.get("ready"), "ready", "/")?;
        let mut env = Vec::new();
        if let Some(e) = o.get("env") {
            let m = e.as_object().ok_or("env must be an object of names and values")?;
            if m.len() > 50 {
                return Err("env has too many values".to_string());
            }
            for (k, v) in m {
                let name_ok = !k.is_empty() && k.len() <= 60 && k.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') && !k.starts_with(|c: char| c.is_ascii_digit());
                let val = v.as_str().ok_or("every env value must be text")?;
                if !name_ok || val.len() > 500 || val.contains('\0') {
                    return Err(format!("env value {k} cannot be used"));
                }
                env.push((k.clone(), val.to_string()));
            }
            env.sort();
        }
        let wait = o.get("wait").and_then(|w| w.as_u64()).unwrap_or(60).clamp(5, 300);
        let mut allow: Vec<String> = Vec::new();
        if let Some(a) = o.get("allow") {
            for v in a.as_array().ok_or("allow must be a list of words")? {
                let w = v.as_str().ok_or("allow must be a list of words")?;
                if !ALLOWED.contains(&w) {
                    return Err(format!("allow: {w} is not one of {}", ALLOWED.join(", ")));
                }
                if !allow.iter().any(|x| x == w) {
                    allow.push(w.to_string());
                }
            }
            allow.sort();
        }
        let flag = |name: &str, default: bool| -> Result<bool, String> {
            match o.get(name) {
                None | Some(serde_json::Value::Null) => Ok(default),
                Some(v) => v.as_bool().ok_or(format!("{name} must be true or false")),
            }
        };
        let bucket = flag("bucket", false)?;
        let keep = flag("keep", true)?;
        let clean = match o.get("clean") {
            None | Some(serde_json::Value::Null) => None,
            Some(v) => Some(command_ok(v, "clean")?),
        };
        Ok(Recipe { setup, start, port: port as u16, cwd, entry, ready, env, wait, allow, bucket, keep, clean })
    }

    /// Everything that is run or set, as one string. The sheet shows it, the owner says yes to it, and a start is only accepted when the recipe still gives exactly this string.
    pub fn approval(&self) -> String {
        let env: Vec<String> = self.env.iter().map(|(k, v)| format!("{k}={v}")).collect();
        format!("cwd={}\nsetup={}\nstart={}\nport={}\nenv={}\nallow={}\nclean={}\nbucket={}\nkeep={}", self.cwd, self.setup.clone().unwrap_or_default(), self.start, self.port, env.join(";"), self.allow.join(","), self.clean.clone().unwrap_or_default(), self.bucket, self.keep)
    }

    pub fn view(&self) -> LiveView {
        LiveView { setup: self.setup.clone(), start: self.start.clone(), cwd: self.cwd.clone(), port: self.port, entry: self.entry.clone(), env: self.env.iter().map(|(k, _)| k.clone()).collect(), allow: self.allow.clone(), bucket: self.bucket, keep: self.keep, clean: self.clean.clone(), approval: self.approval() }
    }
}

// ---------------------------------------------------------------- the running program

#[derive(Clone, Copy, PartialEq, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Setup,
    Starting,
    Ready,
    Failed,
    Stopped,
}

struct Shared {
    phase: Phase,
    message: Option<String>,
    log: VecDeque<String>,
}

type ChildSlot = Arc<Mutex<Option<Child>>>;

struct Run {
    project: String,
    card: String,
    port: u16,
    shared: Arc<Mutex<Shared>>,
    child: ChildSlot,
    /// the data folder of the card, and whether it is kept when the program stops
    data: PathBuf,
    keep: bool,
}

#[derive(Serialize, Debug)]
pub struct Status {
    pub project: Option<String>,
    pub card: Option<String>,
    /// `off` when nothing runs
    pub phase: String,
    pub message: Option<String>,
    pub log: Vec<String>,
    /// the address the page of THIS run is loaded from: every run has an address of its own, so what one program left in the browser (storage, a service worker, cookies) is never seen by the next
    pub base: Option<String>,
}

#[derive(Default)]
pub struct Inner {
    run: Mutex<Option<Run>>,
    /// the number of the run that is wanted; a program thread that finds another number there stops
    current: Arc<AtomicU64>,
    /// the port of the listener that Live pages are loaded from, once it was made
    proxy: Mutex<Option<(u16, Arc<std::sync::atomic::AtomicBool>)>>,
    /// set at every start: the first page the program sends after it makes the browser forget what the last run left in local storage
    fresh: std::sync::atomic::AtomicBool,
    /// what the running program's recipe lets its page do (the policy header of every answer says the same as the frame)
    allow: Mutex<Vec<String>>,
    /// the fake bucket of the run: its port and the flag that ends it, and its folder (the page's own address serves `/cloud/<key>` from it)
    bucket: Mutex<Option<(u16, Arc<std::sync::atomic::AtomicBool>)>>,
    bucket_root: Mutex<Option<PathBuf>>,
}

/// What Kona keeps: the state of the one Live program, and the listener that shows it. Cheap to clone; the listener's threads hold a copy.
#[derive(Default, Clone)]
pub struct Live(Arc<Inner>);

impl std::ops::Deref for Live {
    type Target = Inner;
    fn deref(&self) -> &Inner {
        &self.0
    }
}

fn push_log(shared: &Arc<Mutex<Shared>>, line: String) {
    let mut s = shared.lock().unwrap_or_else(|e| e.into_inner());
    let mut line = line.trim_end().to_string();
    if line.chars().count() > LOG_LINE_LEN {
        line = line.chars().take(LOG_LINE_LEN).collect();
    }
    if s.log.len() >= LOG_LINES {
        s.log.pop_front();
    }
    s.log.push_back(line);
}

fn set_phase(shared: &Arc<Mutex<Shared>>, phase: Phase, message: Option<String>) {
    let mut s = shared.lock().unwrap_or_else(|e| e.into_inner());
    s.phase = phase;
    s.message = message;
}

fn pump<R: Read + Send + 'static>(r: R, shared: Arc<Mutex<Shared>>) {
    std::thread::spawn(move || {
        let mut rd = BufReader::new(r);
        let mut buf = Vec::new();
        loop {
            buf.clear();
            match rd.read_until(b'\n', &mut buf) {
                Ok(0) | Err(_) => break,
                Ok(_) => push_log(&shared, String::from_utf8_lossy(&buf).into_owned()),
            }
        }
    });
}

/// One command line, run by the PC's own shell in `dir`, its output kept in the log
fn shell(command: &str, dir: &Path, env: &[(String, String)], port: u16, shared: &Arc<Mutex<Shared>>) -> std::io::Result<Child> {
    #[cfg(windows)]
    let mut c = {
        use std::os::windows::process::CommandExt;
        let mut c = Command::new("cmd");
        c.arg("/C").raw_arg(command);
        c.creation_flags(0x0800_0000); // no console window
        c
    };
    #[cfg(not(windows))]
    let mut c = {
        let mut c = Command::new("sh");
        c.arg("-c").arg(command);
        c
    };
    c.current_dir(dir).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    c.env("KONA_LIVE_PORT", port.to_string());
    c.env("KONA_LIVE_HOST", "127.0.0.1");
    for (k, v) in env {
        c.env(k, v);
    }
    let mut child = c.spawn()?;
    // when Kona closes or crashes, Windows stops the program with it (Stop and a new start use `kill_tree`)
    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        let _ = crate::job::adopt_live(child.as_raw_handle() as _);
    }
    if let Some(o) = child.stdout.take() {
        pump(o, shared.clone());
    }
    if let Some(e) = child.stderr.take() {
        pump(e, shared.clone());
    }
    Ok(child)
}

/// The program and everything it started
fn kill_tree(child: &mut Child) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill").args(["/PID", &child.id().to_string(), "/T", "/F"]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).creation_flags(0x0800_0000).status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn port_answers(port: u16) -> bool {
    TcpStream::connect_timeout(&SocketAddr::from(([127, 0, 0, 1], port)), Duration::from_millis(300)).is_ok()
}

fn exit_words(status: std::process::ExitStatus) -> String {
    status.code().map(|c| format!("code {c}")).unwrap_or_else(|| "no code".to_string())
}

/// The thread of one run: setup, start, wait until the port answers, then watch that the program stays alive. It ends when another run is wanted.
fn drive(current: Arc<AtomicU64>, id: u64, shared: Arc<Mutex<Shared>>, slot: ChildSlot, r: Recipe, dir: PathBuf) {
    let alive = || current.load(Ordering::SeqCst) == id;
    let fail = |msg: String| {
        if alive() {
            set_phase(&shared, Phase::Failed, Some(msg));
        }
    };
    if let Some(setup) = &r.setup {
        set_phase(&shared, Phase::Setup, None);
        push_log(&shared, format!("> {setup}"));
        match shell(setup, &dir, &r.env, r.port, &shared) {
            Err(e) => return fail(format!("The setup command could not be started: {e}")),
            Ok(c) => *slot.lock().unwrap_or_else(|e| e.into_inner()) = Some(c),
        }
        let t0 = Instant::now();
        loop {
            if !alive() {
                return;
            }
            let done = slot.lock().unwrap_or_else(|e| e.into_inner()).as_mut().and_then(|c| c.try_wait().ok().flatten());
            if let Some(st) = done {
                *slot.lock().unwrap_or_else(|e| e.into_inner()) = None;
                if !st.success() {
                    return fail(format!("The setup command stopped with {}. The last lines it printed are below.", exit_words(st)));
                }
                break;
            }
            if t0.elapsed() > SETUP_LIMIT {
                if let Some(c) = slot.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
                    kill_tree(c);
                }
                return fail("The setup command took more than 3 minutes and was stopped.".to_string());
            }
            std::thread::sleep(Duration::from_millis(200));
        }
    }
    if !alive() {
        return;
    }
    set_phase(&shared, Phase::Starting, None);
    push_log(&shared, format!("> {}", r.start));
    match shell(&r.start, &dir, &r.env, r.port, &shared) {
        Err(e) => return fail(format!("The program could not be started: {e}")),
        Ok(c) => {
            let mut g = slot.lock().unwrap_or_else(|e| e.into_inner());
            if !alive() {
                let mut c = c;
                kill_tree(&mut c);
                return;
            }
            *g = Some(c);
        }
    }
    let t0 = Instant::now();
    let mut ready = false;
    loop {
        if !alive() {
            return;
        }
        let done = slot.lock().unwrap_or_else(|e| e.into_inner()).as_mut().and_then(|c| c.try_wait().ok().flatten());
        if let Some(st) = done {
            return fail(format!("The program stopped with {}{}. The last lines it printed are below.", exit_words(st), if ready { "" } else { " before it answered" }));
        }
        if !ready {
            if upstream(r.port, "GET", &r.ready, &[], &[]).is_ok() {
                ready = true;
                set_phase(&shared, Phase::Ready, None);
            } else if t0.elapsed() > Duration::from_secs(r.wait) {
                if let Some(c) = slot.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
                    kill_tree(c);
                }
                return fail(format!("The program did not answer on port {} within {} seconds.", r.port, r.wait));
            }
        }
        std::thread::sleep(Duration::from_millis(if ready { 1000 } else { 300 }));
    }
}

impl Inner {
    pub fn status(&self) -> Status {
        let g = self.run.lock().unwrap_or_else(|e| e.into_inner());
        match g.as_ref() {
            None => Status { project: None, card: None, phase: "off".to_string(), message: None, log: Vec::new(), base: None },
            Some(r) => {
                let s = r.shared.lock().unwrap_or_else(|e| e.into_inner());
                let phase = serde_json::to_value(s.phase).ok().and_then(|v| v.as_str().map(str::to_string)).unwrap_or_default();
                Status { project: Some(r.project.clone()), card: Some(r.card.clone()), phase, message: s.message.clone(), log: s.log.iter().cloned().collect(), base: self.proxy.lock().unwrap_or_else(|e| e.into_inner()).as_ref().map(|(p, _)| format!("http://127.0.0.1:{p}")) }
            }
        }
    }

    /// The port to pass requests to, when a program is running and has answered
    fn target(&self) -> Option<u16> {
        let g = self.run.lock().unwrap_or_else(|e| e.into_inner());
        let r = g.as_ref()?;
        let ready = r.shared.lock().unwrap_or_else(|e| e.into_inner()).phase == Phase::Ready;
        ready.then_some(r.port)
    }

    pub fn stop(&self) {
        self.stop_with(false);
    }

    /// Stop the program. Its data folder is kept unless the recipe says `keep: false` or `delete_data` is true (the owner pressed "Stop and delete its data").
    pub fn stop_with(&self, delete_data: bool) {
        self.close_proxy();
        self.close_bucket();
        self.current.fetch_add(1, Ordering::SeqCst);
        let old = self.run.lock().unwrap_or_else(|e| e.into_inner()).take();
        if let Some(r) = old {
            if let Some(c) = r.child.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
                kill_tree(c);
            }
            set_phase(&r.shared, Phase::Stopped, None);
            if delete_data || !r.keep {
                let _ = remove_data(&r.data);
            }
        }
    }

    fn close_bucket(&self) {
        let old = self.bucket.lock().unwrap_or_else(|e| e.into_inner()).take();
        if let Some((port, stop)) = old {
            crate::bucket::close(port, &stop);
        }
        *self.bucket_root.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }

    /// Check the recipe and the folders, stop the program that runs, and make the card's data folder ready. `want_fresh` is the owner's choice at Start: take the last data away and begin again.
    fn prepare(&self, project_folder: &Path, card: &str, approved: &str, want_fresh: bool) -> Result<Prepared, String> {
        let root = mock::card_root(project_folder, card).ok_or("There is no such mockup")?;
        let info = mock::card_info(&root).ok_or("The mockup has no mockup.json")?;
        let recipe = Recipe::from_info(&info).ok_or("This mockup is not a live one")??;
        if recipe.approval() != approved {
            return Err("The recipe changed after it was shown. Open the mockup again and read it once more.".to_string());
        }
        let project_real = std::fs::canonicalize(project_folder).map_err(|_| "The project folder cannot be read")?;
        let dir = if recipe.cwd.is_empty() { project_real.clone() } else { std::fs::canonicalize(project_real.join(&recipe.cwd)).map_err(|_| format!("The folder {} does not exist", recipe.cwd))? };
        if !dir.starts_with(&project_real) || !dir.is_dir() {
            return Err("The folder to run in must be inside the project".to_string());
        }
        let data = data_dir(&project_real, card)?;
        self.stop();
        if port_answers(recipe.port) {
            return Err(format!("Something already answers on port {}. Stop it first, or choose another port in the recipe.", recipe.port));
        }
        let had = data_info(&data).exists;
        if want_fresh && had {
            remove_data(&data)?;
        }
        std::fs::create_dir_all(&data).map_err(|e| format!("The data folder of the card could not be made: {e}"))?;
        Ok(Prepared { recipe, dir, data, fresh: want_fresh || !had })
    }

    /// Run the prepared card at the address `base`: the bucket first (its address goes into the program's environment), then setup and start in a thread of their own
    fn launch(&self, p: Prepared, project_id: &str, card: &str, base: &str) -> Result<(), String> {
        let Prepared { mut recipe, dir, data, fresh } = p;
        let shown = |p: &Path| p.to_string_lossy().trim_start_matches(r"\\?\").to_string();
        let mut extra: Vec<(String, String)> = vec![
            ("KONA_LIVE_DATA".to_string(), shown(&data)),
            ("KONA_LIVE_FRESH".to_string(), if fresh { "1" } else { "0" }.to_string()),
            ("KONA_LIVE_KEEP".to_string(), if recipe.keep { "1" } else { "0" }.to_string()),
        ];
        if recipe.bucket {
            let root = data.join("bucket");
            let (port, stop) = crate::bucket::open(root.clone())?;
            *self.bucket.lock().unwrap_or_else(|e| e.into_inner()) = Some((port, stop));
            *self.bucket_root.lock().unwrap_or_else(|e| e.into_inner()) = Some(root);
            extra.push(("KONA_LIVE_BUCKET_ENDPOINT".to_string(), format!("http://127.0.0.1:{port}")));
            extra.push(("KONA_LIVE_BUCKET_NAME".to_string(), crate::bucket::BUCKET_NAME.to_string()));
            extra.push(("KONA_LIVE_BUCKET_KEY".to_string(), "kona".to_string()));
            extra.push(("KONA_LIVE_BUCKET_SECRET".to_string(), "kona-demo-secret".to_string()));
            extra.push(("KONA_LIVE_BUCKET_REGION".to_string(), "us-east-1".to_string()));
            extra.push(("KONA_LIVE_BUCKET_URL".to_string(), format!("{base}/cloud")));
        }
        recipe.env.extend(extra);
        let id = self.current.fetch_add(1, Ordering::SeqCst) + 1;
        let shared = Arc::new(Mutex::new(Shared { phase: Phase::Setup, message: None, log: VecDeque::new() }));
        let slot: ChildSlot = Arc::new(Mutex::new(None));
        *self.run.lock().unwrap_or_else(|e| e.into_inner()) = Some(Run { project: project_id.to_string(), card: card.to_string(), port: recipe.port, shared: shared.clone(), child: slot.clone(), data, keep: recipe.keep });
        let current = self.current.clone();
        self.fresh.store(true, Ordering::SeqCst);
        *self.allow.lock().unwrap_or_else(|e| e.into_inner()) = recipe.allow.clone();
        std::thread::spawn(move || drive(current, id, shared, slot, recipe, dir));
        Ok(())
    }
}

/// A card whose recipe and folders were checked and whose data folder is ready
struct Prepared {
    recipe: Recipe,
    dir: PathBuf,
    data: PathBuf,
    fresh: bool,
}

// ---------------------------------------------------------------- the data of a card

/// What a card keeps between runs: `<project>/.kona/live-data/<card>/` (its demo database file, its bucket, its uploads: whatever it puts in `KONA_LIVE_DATA`)
pub fn data_dir(project_real: &Path, card: &str) -> Result<PathBuf, String> {
    if card.is_empty() || card.contains(['/', '\\', ':']) || card == "." || card == ".." {
        return Err("There is no such mockup".to_string());
    }
    Ok(project_real.join(".kona").join("live-data").join(card))
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct DataInfo {
    pub exists: bool,
    pub bytes: u64,
    pub files: u64,
    /// seconds since the newest file changed
    pub age_secs: Option<u64>,
    /// where it is, relative to the project
    pub place: String,
}

pub fn data_info(dir: &Path) -> DataInfo {
    let mut bytes = 0u64;
    let mut files = 0u64;
    let mut newest: Option<std::time::SystemTime> = None;
    let mut stack = vec![dir.to_path_buf()];
    let mut seen = 0usize;
    while let Some(d) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&d) else { continue };
        for e in rd.flatten() {
            seen += 1;
            if seen > 500_000 {
                break;
            }
            let Ok(md) = e.metadata() else { continue };
            if md.is_dir() {
                stack.push(e.path());
            } else {
                bytes += md.len();
                files += 1;
                if let Ok(t) = md.modified() {
                    newest = Some(newest.map_or(t, |n| n.max(t)));
                }
            }
        }
    }
    let age_secs = newest.and_then(|t| std::time::SystemTime::now().duration_since(t).ok()).map(|d| d.as_secs());
    let place = dir.components().rev().take(3).collect::<Vec<_>>().into_iter().rev().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect::<Vec<_>>();
    DataInfo { exists: files > 0, bytes, files, age_secs, place: format!(".kona/{}", place.get(1..).map(|p| p.join("/")).unwrap_or_default()) }
}

/// A demo login of a card, shown next to its program so that nobody is left at a sign-in page without one
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct DemoAccount {
    pub who: String,
    pub login: String,
    pub password: String,
    pub note: Option<String>,
}

/// The demo logins a card lists in `accounts.json` of its data folder (its setup writes the file, from the project's own seeder: `[{ "who": "Teacher", "login": "...", "password": "...", "note": "..." }]`).
/// A missing, too big or unreadable file gives an empty list; at most 50 entries, each text at most 200 letters. Only demo accounts belong there: they are shown on the screen.
pub fn accounts_of(data: &Path) -> Vec<DemoAccount> {
    let file = data.join("accounts.json");
    let Ok(md) = std::fs::metadata(&file) else { return Vec::new() };
    if !md.is_file() || md.len() > 64 * 1024 {
        return Vec::new();
    }
    let Some(list) = std::fs::read(&file).ok().and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok()) else { return Vec::new() };
    let text = |v: &serde_json::Value, k: &str| v.get(k).and_then(|x| x.as_str()).map(|s| s.chars().take(200).collect::<String>());
    list.as_array().map(|a| {
        a.iter()
            .take(50)
            .filter_map(|v| Some(DemoAccount { who: text(v, "who").unwrap_or_default(), login: text(v, "login").filter(|l| !l.is_empty())?, password: text(v, "password").unwrap_or_default(), note: text(v, "note").filter(|n| !n.is_empty()) }))
            .collect()
    }).unwrap_or_default()
}

/// Take a data folder away. A program that has just been stopped may still hold a file for a moment on Windows, so this tries again a few times.
pub fn remove_data(dir: &Path) -> Result<(), String> {
    // only ever a folder of this shape: <project>/.kona/live-data/<card>
    let parts: Vec<String> = dir.components().rev().take(3).map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
    if parts.len() < 3 || parts[1] != "live-data" || parts[2] != ".kona" {
        return Err("That is not the data folder of a card".to_string());
    }
    let mut last = String::new();
    for _ in 0..10 {
        match std::fs::remove_dir_all(dir) {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => last = e.to_string(),
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    Err(format!("The data of the card could not be deleted: {last}"))
}

/// "Delete data": the card's own `clean` command first (the demo database in a database server, which Kona cannot see), then the data folder. Refused while that card runs.
/// The command is only run when the string the sheet showed is still what the recipe gives. Returns what was freed, in words.
pub fn delete_data_now(live: &Inner, project_folder: &Path, card: &str, approved: &str) -> Result<String, String> {
    let root = mock::card_root(project_folder, card).ok_or("There is no such mockup")?;
    let info = mock::card_info(&root).ok_or("The mockup has no mockup.json")?;
    let recipe = Recipe::from_info(&info).ok_or("This mockup is not a live one")??;
    if recipe.approval() != approved {
        return Err("The recipe changed after it was shown. Open the mockup again and read it once more.".to_string());
    }
    let st = live.status();
    if st.card.as_deref() == Some(card) && st.phase != "off" && st.phase != "stopped" {
        return Err("Stop the program first.".to_string());
    }
    let project_real = std::fs::canonicalize(project_folder).map_err(|_| "The project folder cannot be read")?;
    let data = data_dir(&project_real, card)?;
    let before = data_info(&data);
    if let Some(clean) = &recipe.clean {
        let dir = if recipe.cwd.is_empty() { project_real.clone() } else { std::fs::canonicalize(project_real.join(&recipe.cwd)).map_err(|_| format!("The folder {} does not exist", recipe.cwd))? };
        if !dir.starts_with(&project_real) {
            return Err("The folder to run in must be inside the project".to_string());
        }
        let mut env = recipe.env.clone();
        env.push(("KONA_LIVE_DATA".to_string(), data.to_string_lossy().trim_start_matches(r"\\?\").to_string()));
        env.push(("KONA_LIVE_CLEAN".to_string(), "1".to_string()));
        let shared = Arc::new(Mutex::new(Shared { phase: Phase::Setup, message: None, log: VecDeque::new() }));
        let mut child = shell(clean, &dir, &env, recipe.port, &shared).map_err(|e| format!("The clean command could not be started: {e}"))?;
        let t0 = Instant::now();
        let status = loop {
            if let Some(st) = child.try_wait().map_err(|e| e.to_string())? {
                break st;
            }
            if t0.elapsed() > Duration::from_secs(120) {
                kill_tree(&mut child);
                return Err("The clean command took more than 2 minutes and was stopped. Nothing was deleted.".to_string());
            }
            std::thread::sleep(Duration::from_millis(200));
        };
        if !status.success() {
            let tail: Vec<String> = shared.lock().unwrap_or_else(|e| e.into_inner()).log.iter().rev().take(6).cloned().collect::<Vec<_>>().into_iter().rev().collect();
            return Err(format!("The clean command stopped with {}. Nothing was deleted. It printed: {}", exit_words(status), tail.join(" / ")));
        }
    }
    remove_data(&data)?;
    Ok(if before.exists { format!("Deleted {} files, {} bytes.", before.files, before.bytes) } else { "There was no data to delete.".to_string() })
}

// ---------------------------------------------------------------- the small web client

pub struct Up {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

enum Parsed {
    Done(Up),
    More,
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

/// The body of a chunked answer, when all of it is here
fn dechunk(b: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut i = 0;
    loop {
        let line_end = i + find(&b[i..], b"\r\n")?;
        let size_text = std::str::from_utf8(&b[i..line_end]).ok()?.split(';').next()?.trim();
        let size = usize::from_str_radix(size_text, 16).ok()?;
        i = line_end + 2;
        if size == 0 {
            return Some(out);
        }
        if b.len() < i + size + 2 {
            return None;
        }
        out.extend_from_slice(&b[i..i + size]);
        i += size + 2;
    }
}

fn parse(buf: &[u8], head_only: bool, eof: bool) -> Result<Parsed, String> {
    let mut start = 0;
    loop {
        let Some(h) = find(&buf[start..], b"\r\n\r\n") else {
            return if eof { Err("The program closed the connection without an answer".to_string()) } else { Ok(Parsed::More) };
        };
        let head = String::from_utf8_lossy(&buf[start..start + h]).into_owned();
        let rest = &buf[start + h + 4..];
        let mut lines = head.split("\r\n");
        let status: u16 = lines.next().unwrap_or("").split_whitespace().nth(1).and_then(|s| s.parse().ok()).ok_or("The program's answer could not be read")?;
        let headers: Vec<(String, String)> = lines.filter_map(|l| l.split_once(':').map(|(k, v)| (k.trim().to_string(), v.trim().to_string()))).collect();
        if (100..200).contains(&status) && status != 101 {
            start += h + 4; // an interim answer: the real one follows it
            continue;
        }
        let get = |n: &str| headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(n)).map(|(_, v)| v.as_str());
        let done = |body: Vec<u8>| Ok(Parsed::Done(Up { status, headers: headers.clone(), body }));
        if head_only || status == 204 || status == 304 || status == 101 {
            return done(Vec::new());
        }
        if get("transfer-encoding").is_some_and(|t| t.to_ascii_lowercase().contains("chunked")) {
            return match dechunk(rest) {
                Some(b) => done(b),
                None if eof => done(rest.to_vec()),
                None => Ok(Parsed::More),
            };
        }
        if let Some(n) = get("content-length").and_then(|n| n.parse::<usize>().ok()) {
            return if rest.len() >= n { done(rest[..n].to_vec()) } else if eof { done(rest.to_vec()) } else { Ok(Parsed::More) };
        }
        return if eof { done(rest.to_vec()) } else { Ok(Parsed::More) };
    }
}

/// One request to the program on `127.0.0.1:port`, one answer back (the connection is closed after it). Compression is not asked for.
pub fn upstream(port: u16, method: &str, target: &str, headers: &[(String, String)], body: &[u8]) -> Result<Up, String> {
    upstream_within(port, method, target, headers, body, ANSWER_LIMIT)
}

/// An answer that is still arriving after this long is given up: the whole answer is kept in memory before it is passed on, so an answer that never ends (a live stream) would fill it
const ANSWER_LIMIT: Duration = Duration::from_secs(120);

fn upstream_within(port: u16, method: &str, target: &str, headers: &[(String, String)], body: &[u8], within: Duration) -> Result<Up, String> {
    let deadline = Instant::now() + within;
    let mut s = TcpStream::connect_timeout(&SocketAddr::from(([127, 0, 0, 1], port)), Duration::from_secs(2)).map_err(|e| format!("The program does not answer: {e}"))?;
    let _ = s.set_read_timeout(Some(Duration::from_secs(60)));
    let _ = s.set_write_timeout(Some(Duration::from_secs(15)));
    let mut req = format!("{method} {target} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\nAccept-Encoding: identity\r\n");
    for (k, v) in headers {
        if !k.contains(['\r', '\n', ':']) && !v.contains(['\r', '\n']) {
            req.push_str(&format!("{k}: {v}\r\n"));
        }
    }
    if !body.is_empty() || method == "POST" || method == "PUT" || method == "PATCH" {
        req.push_str(&format!("Content-Length: {}\r\n", body.len()));
    }
    req.push_str("\r\n");
    s.write_all(req.as_bytes()).and_then(|_| s.write_all(body)).map_err(|e| format!("The program could not be written to: {e}"))?;
    let head_only = method == "HEAD";
    let mut buf: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 16 * 1024];
    loop {
        let n = match s.read(&mut chunk) {
            Ok(n) => n,
            Err(e) if matches!(e.kind(), std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock) => return Err("The program took more than a minute to answer".to_string()),
            Err(e) => return Err(format!("The program's answer was cut: {e}")),
        };
        let eof = n == 0;
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() > BODY_LIMIT {
            return Err("The program's answer is too big".to_string());
        }
        if !eof && Instant::now() > deadline {
            return Err("The program's answer did not end in time. An answer that never ends (a live stream) cannot be passed on: it is kept whole first.".to_string());
        }
        if let Parsed::Done(u) = parse(&buf, head_only, eof)? {
            return Ok(u);
        }
        if eof {
            return Err("The program closed the connection too early".to_string());
        }
    }
}

// ---------------------------------------------------------------- the address a page is loaded from

/// One request of a Live page, as the listener read it
pub struct ProxyReq {
    pub method: String,
    pub target: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

/// One answer for a Live page
pub struct ProxyRes {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl ProxyRes {
    #[cfg(test)]
    pub fn header(&self, name: &str) -> Vec<String> {
        self.headers.iter().filter(|(k, _)| k.eq_ignore_ascii_case(name)).map(|(_, v)| v.clone()).collect()
    }
}

fn plain_page(status: u16, words: &str) -> ProxyRes {
    let html = format!("<!doctype html><meta charset=\"utf-8\"><body style=\"font:16px sans-serif;margin:32px;color:#222\"><p>{words}</p></body>");
    ProxyRes { status, headers: vec![("Content-Type".to_string(), "text/html; charset=utf-8".to_string()), ("Cache-Control".to_string(), "no-store".to_string()), ("Content-Length".to_string(), html.len().to_string())], body: html.into_bytes() }
}

/// The program's own address, written as the address the page was loaded from (`base`)
fn outside(text: &str, port: u16, base: &str) -> String {
    let mut t = text.to_string();
    for host in ["127.0.0.1", "localhost"] {
        t = t.replace(&format!("http://{host}:{port}"), base);
        t = t.replace(&format!("http:\\/\\/{host}:{port}"), &base.replace('/', "\\/"));
    }
    t
}

fn inside(text: &str, port: u16, base: &str) -> String {
    text.replace(base, &format!("http://127.0.0.1:{port}"))
}

fn is_text(ctype: &str) -> bool {
    let c = ctype.to_ascii_lowercase();
    c.starts_with("text/") || c.contains("json") || c.contains("javascript") || c.contains("xml")
}

/// A cookie the program sets, made one that a page inside Kona's frame may keep. The frame is on another site than Kona's window, so the browser treats its cookies as third-party ones
/// and drops those that are not `SameSite=None; Secure` (seen on 2026-11-18: a login was never kept). `Partitioned` keeps the cookie in the frame's own partition, which stays allowed
/// when other third-party cookies are blocked. `Domain` is dropped (the cookie belongs to the address the page was loaded from). `Secure` is accepted on `http://127.0.0.1`.
fn framed_cookie(cookie: &str) -> String {
    let kept: Vec<&str> = cookie
        .split(';')
        .map(str::trim)
        .filter(|p| {
            let l = p.to_ascii_lowercase();
            !p.is_empty() && !l.starts_with("domain=") && !l.starts_with("samesite=") && l != "secure" && l != "partitioned"
        })
        .collect();
    format!("{}; SameSite=None; Secure; Partitioned", kept.join("; "))
}

/// The same for a cookie the page's own script writes (`document.cookie = ...`), which the server never sees: put into every page ahead of its own scripts
/// A link that wants a new window (`target="_blank"`) and `window.open` do nothing in a frame, so the page tells the sheet, which opens the address in the owner's own browser. Only when a person has just
/// clicked or pressed a key (a page cannot open the owner's browser by itself), and at most once a second.
const LINKS_SCRIPT: &str = "<script>(function(){var last=0;function go(u){try{var now=Date.now();if(now-last<1000)return;if(navigator.userActivation&&!navigator.userActivation.isActive)return;last=now;parent.postMessage({kona:'open',url:new URL(String(u),location.href).href},'*');}catch(e){}}document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[target]'):null;if(!a||!a.href||(a.target!=='_blank'&&a.target!=='_new'))return;e.preventDefault();go(a.href);},true);window.open=function(u){if(u)go(u);return null;};function q(k,t){try{parent.postMessage({kona:'dialog',kind:k,text:String(t==null?'':t).slice(0,200)},'*');}catch(e){}}window.alert=function(t){q('alert',t);};window.confirm=function(t){q('confirm',t);return false;};window.prompt=function(t){q('prompt',t);return null;};var ael=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,f,o){if(t==='beforeunload')return;return ael.call(this,t,f,o);};try{Object.defineProperty(window,'onbeforeunload',{configurable:true,get:function(){return null;},set:function(){}});}catch(e){}})();</script>";

const COOKIE_SCRIPT: &str = "<script>(function(){try{var d=Object.getOwnPropertyDescriptor(Document.prototype,'cookie');Object.defineProperty(Document.prototype,'cookie',{configurable:true,get:function(){return d.get.call(this);},set:function(v){d.set.call(this,String(v).replace(/;\\s*(samesite|secure|partitioned)[^;]*/gi,'')+'; SameSite=None; Secure; Partitioned');}});}catch(e){}})();</script>";

const SKIP_REQUEST: [&str; 12] = ["host", "connection", "keep-alive", "proxy-connection", "transfer-encoding", "te", "upgrade", "content-length", "accept-encoding", "origin", "referer", "expect"];
const SKIP_REPLY: [&str; 13] = ["content-security-policy", "content-security-policy-report-only", "x-frame-options", "content-length", "transfer-encoding", "connection", "keep-alive", "content-encoding", "strict-transport-security", "cache-control", "etag", "last-modified", "expires"];

/// The sandbox words of every answer: the ordinary three, and one or two more for each thing the recipe allows. The frame's own attribute (`liveSandbox` in lib/mockview.ts) says the same.
pub fn sandbox_header(allow: &[String]) -> String {
    let mut s = String::from("sandbox allow-scripts allow-same-origin allow-forms");
    let has = |w: &str| allow.iter().any(|x| x == w);
    if has("print") {
        s.push_str(" allow-modals");
    }
    if has("downloads") {
        s.push_str(" allow-downloads");
    }
    s
}

/// Answer one request of a Live page by passing it to the program. `base` is the address the page was loaded from (`http://127.0.0.1:<proxy port>`).
pub fn serve(live: &Inner, base: &str, request: &ProxyReq) -> ProxyRes {
    let Some(port) = live.target() else {
        return plain_page(503, "This mockup is not running. Start it from the Mockups sheet.");
    };
    if !request.target.starts_with('/') || request.target.contains(['\r', '\n', ' ']) {
        return plain_page(400, "Bad address");
    }
    // a card with a bucket: what the page loads a picture or a file from (`KONA_LIVE_BUCKET_URL`) is served from the bucket's folder, on the page's own address
    if (request.method == "GET" || request.method == "HEAD") && request.target.starts_with("/cloud/") {
        if let Some(root) = live.bucket_root.lock().unwrap_or_else(|e| e.into_inner()).clone() {
            let Some(key) = crate::bucket::public_key(&request.target) else { return plain_page(404, "No such file") };
            return match crate::bucket::read_public(&root, &key) {
                Some((data, ctype)) => ProxyRes {
                    status: 200,
                    headers: vec![("Content-Type".to_string(), ctype), ("Content-Length".to_string(), data.len().to_string()), ("Cache-Control".to_string(), "no-store".to_string()), ("X-Content-Type-Options".to_string(), "nosniff".to_string()), ("Content-Security-Policy".to_string(), "sandbox".to_string())],
                    body: data,
                },
                None => plain_page(404, "No such file"),
            };
        }
    }
    let mut headers: Vec<(String, String)> = Vec::new();
    for (name, value) in &request.headers {
        let lower = name.to_ascii_lowercase();
        if SKIP_REQUEST.contains(&lower.as_str()) {
            if lower == "origin" || lower == "referer" {
                headers.push((lower, inside(value, port, base)));
            }
            continue;
        }
        headers.push((lower, value.clone()));
    }
    let up = match upstream(port, &request.method, &request.target, &headers, &request.body) {
        Ok(u) => u,
        Err(msg) => return plain_page(502, &msg.replace('<', "&lt;")),
    };
    if up.status == 101 {
        return plain_page(501, "A live connection (a web socket) cannot be passed on. Use a built copy of the front end, not a development server.");
    }
    let ctype = up.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case("content-type")).map(|(_, v)| v.clone()).unwrap_or_default();
    let mut body = up.body;
    if up.status != 206 && is_text(&ctype) && body.len() <= REWRITE_LIMIT {
        if let Ok(text) = std::str::from_utf8(&body) {
            let changed = outside(text, port, base);
            body = if ctype.to_ascii_lowercase().contains("html") { mock::inject_helper(&mock::inject_script(&mock::inject_script(changed.as_bytes(), COOKIE_SCRIPT), LINKS_SCRIPT)) } else { changed.into_bytes() };
        }
    }
    let mut out: Vec<(String, String)> = Vec::new();
    for (k, v) in &up.headers {
        let lower = k.to_ascii_lowercase();
        if SKIP_REPLY.contains(&lower.as_str()) {
            continue;
        }
        let value = match lower.as_str() {
            "location" | "content-location" | "refresh" => outside(v, port, base),
            "set-cookie" => framed_cookie(v),
            _ => v.clone(),
        };
        out.push((k.clone(), value));
    }
    // the first page after a start: what the last run left in local storage (a token of a person that the new demo data does not have) is forgotten. Cookies are left alone: a stale
    // one is only a session the new program does not know, and the same answer sets its own.
    if ctype.to_ascii_lowercase().contains("html") && up.status < 400 && live.fresh.swap(false, Ordering::SeqCst) {
        out.push(("Clear-Site-Data".to_string(), "\"storage\"".to_string()));
    }
    out.push(("Content-Length".to_string(), body.len().to_string()));
    out.push(("Cache-Control".to_string(), "no-store".to_string()));
    out.push(("X-Content-Type-Options".to_string(), "nosniff".to_string()));
    out.push(("Content-Security-Policy".to_string(), sandbox_header(&live.allow.lock().unwrap_or_else(|e| e.into_inner()))));
    ProxyRes { status: up.status, headers: out, body }
}

// ---------------------------------------------------------------- the listener

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        201 => "Created",
        204 => "No Content",
        206 => "Partial Content",
        301 => "Moved Permanently",
        302 => "Found",
        303 => "See Other",
        304 => "Not Modified",
        307 => "Temporary Redirect",
        308 => "Permanent Redirect",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        409 => "Conflict",
        416 => "Range Not Satisfiable",
        419 => "Page Expired",
        422 => "Unprocessable Content",
        429 => "Too Many Requests",
        500 => "Internal Server Error",
        501 => "Not Implemented",
        502 => "Bad Gateway",
        503 => "Service Unavailable",
        _ => "Answer",
    }
}

/// The request a browser sent on one connection: the head, then the body (a length, or chunks)
pub(crate) fn read_request(s: &mut TcpStream) -> Result<ProxyReq, String> {
    let mut buf: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 16 * 1024];
    let head_end = loop {
        let n = s.read(&mut chunk).map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("closed".to_string());
        }
        buf.extend_from_slice(&chunk[..n]);
        if let Some(h) = find(&buf, b"\r\n\r\n") {
            break h;
        }
        if buf.len() > 64 * 1024 {
            return Err("the request head is too big".to_string());
        }
    };
    let head = String::from_utf8_lossy(&buf[..head_end]).into_owned();
    let mut lines = head.split("\r\n");
    let mut first = lines.next().unwrap_or("").split_whitespace();
    let (method, target) = (first.next().unwrap_or("").to_string(), first.next().unwrap_or("").to_string());
    if method.is_empty() || target.is_empty() {
        return Err("the request could not be read".to_string());
    }
    let headers: Vec<(String, String)> = lines.filter_map(|l| l.split_once(':').map(|(k, v)| (k.trim().to_string(), v.trim().to_string()))).collect();
    let get = |n: &str| headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(n)).map(|(_, v)| v.clone());
    let mut body = buf[head_end + 4..].to_vec();
    if get("expect").is_some_and(|e| e.eq_ignore_ascii_case("100-continue")) {
        let _ = s.write_all(b"HTTP/1.1 100 Continue\r\n\r\n"); // a library that sends a big body asks first, and waits for this
    }
    if get("transfer-encoding").is_some_and(|t| t.to_ascii_lowercase().contains("chunked")) {
        loop {
            if let Some(b) = dechunk(&body) {
                body = b;
                break;
            }
            let n = s.read(&mut chunk).map_err(|e| e.to_string())?;
            if n == 0 || body.len() > BODY_LIMIT {
                return Err("the request body was cut".to_string());
            }
            body.extend_from_slice(&chunk[..n]);
        }
    } else if let Some(want) = get("content-length").and_then(|n| n.parse::<usize>().ok()) {
        if want > BODY_LIMIT {
            return Err("the request body is too big".to_string());
        }
        while body.len() < want {
            let n = s.read(&mut chunk).map_err(|e| e.to_string())?;
            if n == 0 {
                return Err("the request body was cut".to_string());
            }
            body.extend_from_slice(&chunk[..n]);
        }
        body.truncate(want);
    } else {
        body.clear();
    }
    Ok(ProxyReq { method, target, headers, body })
}

pub(crate) fn write_response(s: &mut TcpStream, r: &ProxyRes, head_only: bool) {
    let mut out = format!("HTTP/1.1 {} {}\r\n", r.status, reason(r.status)).into_bytes();
    for (k, v) in &r.headers {
        if !k.contains(['\r', '\n', ':']) && !v.contains(['\r', '\n']) {
            out.extend_from_slice(format!("{k}: {v}\r\n").as_bytes());
        }
    }
    out.extend_from_slice(b"Connection: close\r\n\r\n");
    if !head_only {
        out.extend_from_slice(&r.body);
    }
    let _ = s.write_all(&out);
    let _ = s.flush();
    let _ = s.shutdown(std::net::Shutdown::Write);
}

fn handle(live: Arc<Inner>, base: String, mut s: TcpStream) {
    let _ = s.set_read_timeout(Some(Duration::from_secs(30)));
    let _ = s.set_write_timeout(Some(Duration::from_secs(30)));
    match read_request(&mut s) {
        Ok(req) => {
            let res = serve(&live, &base, &req);
            write_response(&mut s, &res, req.method == "HEAD");
        }
        Err(msg) if msg == "closed" => {}
        Err(msg) => write_response(&mut s, &plain_page(400, &msg.replace('<', "&lt;")), false),
    }
}

impl Inner {
    /// The address of the run is shut: its listener stops, so nothing of the program can be asked for any more
    fn close_proxy(&self) {
        let old = self.proxy.lock().unwrap_or_else(|e| e.into_inner()).take();
        if let Some((port, stop)) = old {
            stop.store(true, Ordering::SeqCst);
            let _ = TcpStream::connect_timeout(&SocketAddr::from(([127, 0, 0, 1], port)), Duration::from_millis(300)); // wakes the listener, which sees the flag and ends
        }
    }
}

impl Live {
    /// The address Live pages are loaded from, `http://127.0.0.1:<port>`: a small web server inside Kona that listens on this PC only and passes requests to the running program (`serve`).
    /// A real address, not a made-up scheme, because the browser then keeps cookies, redirects and local storage as it does for any site (a made-up scheme's answers are not given to the cookie
    /// jar). **Every run has an address of its own** (a new port at every start): the browser keeps a page's storage, cookies and service workers per address, and a program that registered a
    /// service worker would otherwise answer for the NEXT program on the same address (seen on 2026-11-18: a card showed the shell of the one before it).
    /// Made when asked for if there is none (the tests use it); `start` always makes a new one.
    pub fn proxy(&self) -> Result<String, String> {
        if let Some((p, _)) = *self.0.proxy.lock().unwrap_or_else(|e| e.into_inner()) {
            return Ok(format!("http://127.0.0.1:{p}"));
        }
        self.open_proxy()
    }

    fn open_proxy(&self) -> Result<String, String> {
        self.0.close_proxy();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| format!("The live address could not be opened: {e}"))?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let base = format!("http://127.0.0.1:{port}");
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let (inner, b, flag) = (self.0.clone(), base.clone(), stop.clone());
        std::thread::spawn(move || {
            for conn in listener.incoming() {
                if flag.load(Ordering::SeqCst) {
                    break;
                }
                if let Ok(s) = conn {
                    let (inner, b) = (inner.clone(), b.clone());
                    std::thread::spawn(move || handle(inner, b, s));
                }
            }
        });
        *self.0.proxy.lock().unwrap_or_else(|e| e.into_inner()) = Some((port, stop));
        Ok(base)
    }

    /// Start the card's program, at an address of its own (see `proxy`)
    /// `fresh` is the owner's choice: begin again (the card's last data is deleted first) or carry on with what the last run left. A card with no data begins again either way.
    pub fn start(&self, project_folder: &Path, project_id: &str, card: &str, approved: &str, fresh: bool) -> Result<(), String> {
        let prepared = self.0.prepare(project_folder, card, approved, fresh)?;
        let base = self.open_proxy()?;
        self.0.launch(prepared, project_id, card, &base)
    }
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::net::TcpListener;

    fn recipe(v: serde_json::Value) -> Result<Recipe, String> {
        Recipe::from_info(&json!({ "live": v })).unwrap()
    }

    #[test]
    fn what_a_page_may_do_besides_the_ordinary_is_named_checked_and_part_of_the_yes() {
        let none = recipe(json!({ "start": "a", "port": 8000 })).unwrap();
        assert!(none.allow.is_empty());
        assert_eq!(sandbox_header(&none.allow), "sandbox allow-scripts allow-same-origin allow-forms");
        let some = recipe(json!({ "start": "a", "port": 8000, "allow": ["print", "downloads", "downloads", "clipboard"] })).unwrap();
        assert_eq!(some.allow, vec!["clipboard", "downloads", "print"]);
        assert_eq!(sandbox_header(&some.allow), "sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-downloads");
        assert_eq!(sandbox_header(&["location".to_string(), "clipboard".to_string()]), "sandbox allow-scripts allow-same-origin allow-forms", "location and the clipboard are not sandbox words");
        assert_ne!(none.approval(), some.approval(), "a yes to a recipe that allows nothing is not a yes to one that allows more");
        for bad in [json!({ "start": "a", "port": 8000, "allow": ["camera"] }), json!({ "start": "a", "port": 8000, "allow": ["popups"] }), json!({ "start": "a", "port": 8000, "allow": ["dialogs"] }), json!({ "start": "a", "port": 8000, "allow": "downloads" }), json!({ "start": "a", "port": 8000, "allow": [1] })] {
            assert!(recipe(bad.clone()).is_err(), "{bad} should be refused");
        }
    }

    #[test]
    fn every_run_has_an_address_of_its_own_and_the_old_one_is_shut() {
        let live = Live::default();
        let a = live.open_proxy().unwrap();
        assert_eq!(live.proxy().unwrap(), a, "asking again gives the same one while it lives");
        assert_eq!(live.status().base, None, "a status names the address only for a run");
        let b = live.open_proxy().unwrap();
        assert_ne!(a, b, "a new start is a new address");
        let port = |u: &str| u.rsplit(':').next().unwrap().parse::<u16>().unwrap();
        let t0 = Instant::now();
        while port_answers(port(&a)) && t0.elapsed() < Duration::from_secs(3) {
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(!port_answers(port(&a)), "the old address no longer answers");
        assert!(port_answers(port(&b)));
        live.stop();
        let t0 = Instant::now();
        while port_answers(port(&b)) && t0.elapsed() < Duration::from_secs(3) {
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(!port_answers(port(&b)), "Stop shuts the address too");
    }

    #[test]
    fn a_card_without_live_is_not_live() {
        assert!(Recipe::from_info(&json!({ "name": "x" })).is_none());
    }

    #[test]
    fn a_recipe_is_read_and_checked() {
        let r = recipe(json!({ "start": "node server.js", "port": 8123 })).unwrap();
        assert_eq!((r.start.as_str(), r.port, r.entry.as_str(), r.ready.as_str(), r.wait, r.cwd.as_str()), ("node server.js", 8123, "/", "/", 60, ""));
        let r = recipe(json!({ "setup": "node seed.js", "start": "php artisan serve", "port": 8001, "cwd": "lms\\api", "entry": "/login", "ready": "/up", "wait": 9999, "env": { "DB_CONNECTION": "sqlite" } })).unwrap();
        assert_eq!((r.cwd.as_str(), r.entry.as_str(), r.wait, r.env.len()), ("lms/api", "/login", 300, 1));
        for bad in [
            json!({ "port": 8000 }),
            json!({ "start": "", "port": 8000 }),
            json!({ "start": "a\nb", "port": 8000 }),
            json!({ "start": "a", "port": 80 }),
            json!({ "start": "a", "port": 8000, "cwd": "../x" }),
            json!({ "start": "a", "port": 8000, "cwd": "C:/x" }),
            json!({ "start": "a", "port": 8000, "cwd": "/x" }),
            json!({ "start": "a", "port": 8000, "entry": "http://evil.example/" }),
            json!({ "start": "a", "port": 8000, "entry": "//evil.example/" }),
            json!({ "start": "a", "port": 8000, "env": { "1BAD": "x" } }),
            json!({ "start": "a", "port": 8000, "env": { "A": 1 } }),
            json!("node server.js"),
        ] {
            assert!(recipe(bad.clone()).is_err(), "{bad} should be refused");
        }
    }

    #[test]
    fn the_approval_changes_with_anything_that_runs() {
        let a = recipe(json!({ "start": "node a.js", "port": 8100 })).unwrap();
        let same = recipe(json!({ "start": "node a.js", "port": 8100 })).unwrap();
        assert_eq!(a.approval(), same.approval());
        for other in [json!({ "start": "node b.js", "port": 8100 }), json!({ "start": "node a.js", "port": 8101 }), json!({ "start": "node a.js", "port": 8100, "setup": "x" }), json!({ "start": "node a.js", "port": 8100, "cwd": "sub" }), json!({ "start": "node a.js", "port": 8100, "env": { "A": "1" } })] {
            assert_ne!(a.approval(), recipe(other).unwrap().approval());
        }
    }

    #[test]
    fn chunks_are_put_together_and_an_unfinished_one_waits() {
        assert_eq!(dechunk(b"5\r\nhello\r\n6;x=1\r\n world\r\n0\r\n\r\n").unwrap(), b"hello world");
        assert!(dechunk(b"5\r\nhel").is_none());
        assert!(dechunk(b"5\r\nhello\r\n").is_none());
    }

    #[test]
    fn answers_are_parsed_in_every_shape() {
        let done = |buf: &[u8], head: bool, eof: bool| match parse(buf, head, eof).unwrap() {
            Parsed::Done(u) => Some(u),
            Parsed::More => None,
        };
        let u = done(b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\nX-A: b\r\n\r\nabcEXTRA", false, false).unwrap();
        assert_eq!((u.status, u.body.as_slice(), u.headers.len()), (200, b"abc".as_slice(), 2));
        assert!(done(b"HTTP/1.1 200 OK\r\nContent-Length: 9\r\n\r\nabc", false, false).is_none());
        assert_eq!(done(b"HTTP/1.1 200 OK\r\n\r\nrest", false, true).unwrap().body, b"rest");
        assert_eq!(done(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n0\r\n\r\n", false, false).unwrap().body, b"abc");
        assert!(done(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nab", false, false).is_none());
        assert_eq!(done(b"HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 201 Created\r\nContent-Length: 1\r\n\r\nx", false, false).unwrap().status, 201);
        assert!(done(b"HTTP/1.1 200 OK\r\nContent-Length: 50\r\n\r\n", true, false).unwrap().body.is_empty());
        assert_eq!(done(b"HTTP/1.1 302 Found\r\nLocation: /x\r\n\r\n", false, true).map(|u| u.status), Some(302));
        assert!(parse(b"garbage", false, true).is_err());
    }

    #[test]
    fn the_programs_own_address_is_written_as_the_sheets() {
        let t = format!("<a href=\"http://127.0.0.1:8200/x\">a</a> <script>var u=\"http:\\/\\/localhost:8200\\/api\";</script> http://127.0.0.1:8201/other");
        let out = outside(&t, 8200, B);
        assert!(out.contains(&format!("{B}/x")) && out.contains("http://127.0.0.1:8201/other") && !out.contains(":8200"));
        assert!(out.contains(&B.replace('/', "\\/")));
        assert_eq!(inside(&format!("{B}/p?q=1"), 8200, B), "http://127.0.0.1:8200/p?q=1");
        assert_eq!(framed_cookie("sid=1; Path=/; Domain=example.test; HttpOnly; SameSite=Lax; Secure"), "sid=1; Path=/; HttpOnly; SameSite=None; Secure; Partitioned");
    }

    /// a fake program on `port` that gives each answer in turn, remembers the requests, and closes each connection
    fn fake_on(port: u16, answers: Vec<Vec<u8>>) -> (u16, std::thread::JoinHandle<Vec<String>>) {
        let l = TcpListener::bind(("127.0.0.1", port)).unwrap();
        let port = l.local_addr().unwrap().port();
        let h = std::thread::spawn(move || {
            let mut seen = Vec::new();
            for a in answers {
                let (mut s, _) = l.accept().unwrap();
                let mut buf = Vec::new();
                let mut chunk = [0u8; 4096];
                loop {
                    let n = s.read(&mut chunk).unwrap();
                    buf.extend_from_slice(&chunk[..n]);
                    if let Some(h) = find(&buf, b"\r\n\r\n") {
                        let head = String::from_utf8_lossy(&buf[..h]).to_lowercase();
                        let want = head.split("content-length: ").nth(1).and_then(|r| r.split("\r\n").next()).and_then(|n| n.trim().parse::<usize>().ok()).unwrap_or(0);
                        if buf.len() >= h + 4 + want {
                            break;
                        }
                    }
                    if n == 0 {
                        break;
                    }
                }
                seen.push(String::from_utf8_lossy(&buf).into_owned());
                s.write_all(&a).unwrap();
            }
            seen
        });
        (port, h)
    }

    fn fake(answers: Vec<Vec<u8>>) -> (u16, std::thread::JoinHandle<Vec<String>>) {
        fake_on(0, answers)
    }

    fn running(port: u16) -> Live {
        let live = Live::default();
        let shared = Arc::new(Mutex::new(Shared { phase: Phase::Ready, message: None, log: VecDeque::new() }));
        *live.run.lock().unwrap() = Some(Run { project: "p".into(), card: "c".into(), port, shared, child: Arc::new(Mutex::new(None)), data: PathBuf::new(), keep: true });
        live
    }

    const B: &str = "http://127.0.0.1:7";

    fn req(method: &str, target: &str, headers: &[(&str, &str)], body: &[u8]) -> ProxyReq {
        ProxyReq { method: method.to_string(), target: target.to_string(), headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(), body: body.to_vec() }
    }

    fn header(r: &ProxyRes, name: &str) -> Vec<String> {
        r.header(name)
    }

    #[test]
    fn nothing_is_passed_on_while_nothing_is_ready() {
        let live = Live::default();
        assert_eq!(serve(&live, B, &req("GET", "/", &[], b"")).status, 503);
        assert_eq!(live.status().phase, "off");
    }

    #[test]
    fn a_page_goes_through_with_the_helper_and_its_address_and_a_form_goes_back() {
        let html = format!("<!doctype html><html><head><title>t</title></head><body><a href=\"http://127.0.0.1:PORT/next\">n</a><form action=\"/login\" method=\"post\"></form></body></html>");
        let redirect = b"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:PORT/home\r\nSet-Cookie: sid=abc; Path=/; Domain=127.0.0.1; HttpOnly\r\nSet-Cookie: theme=1; Path=/\r\nContent-Length: 0\r\nContent-Security-Policy: default-src 'none'\r\nX-Frame-Options: DENY\r\n\r\n".to_vec();
        // the port is only known once the fake listens, so the answers are written with a placeholder and the real number is put in by a first bind
        let probe = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = probe.local_addr().unwrap().port();
        drop(probe);
        let page = html.replace("PORT", &port.to_string());
        let page_answer = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nTransfer-Encoding: chunked\r\nContent-Security-Policy: default-src 'none'\r\n\r\n{:x}\r\n{}\r\n0\r\n\r\n", page.len(), page).into_bytes();
        let redirect = String::from_utf8(redirect).unwrap().replace("PORT", &port.to_string()).into_bytes();
        let (fake_port, handle) = fake_on(port, vec![page_answer, redirect]);
        let live = running(fake_port);
        live.fresh.store(true, Ordering::SeqCst);
        let r = serve(&live, B, &req("GET", "/a/b?x=1", &[("cookie", "sid=zzz"), ("referer", &format!("{B}/prev")), ("accept-encoding", "gzip")], b""));
        assert_eq!(r.status, 200);
        assert_eq!(r.header("clear-site-data"), vec!["\"storage\"".to_string()], "the first page after a start clears local storage");
        let body = String::from_utf8(r.body.clone()).unwrap();
        assert!(body.contains(&format!("href=\"{B}/next\"")), "{body}");
        assert!(body.contains("parent.postMessage") && body.contains("Partitioned"), "the helper and the cookie script are in the page");
        assert!(header(&r, "content-security-policy")[0].contains("allow-same-origin") && header(&r, "x-frame-options").is_empty());
        assert_eq!(header(&r, "content-length")[0], body.len().to_string());
        let r2 = serve(&live, B, &req("POST", "/login", &[("content-type", "application/x-www-form-urlencoded"), ("origin", B)], b"user=mira&pw=x"));
        assert_eq!(r2.status, 302);
        assert!(r2.header("clear-site-data").is_empty(), "and only that one");
        assert_eq!(header(&r2, "location"), vec![format!("{B}/home")]);
        let cookies = header(&r2, "set-cookie");
        assert_eq!(cookies, vec!["sid=abc; Path=/; HttpOnly; SameSite=None; Secure; Partitioned".to_string(), "theme=1; Path=/; SameSite=None; Secure; Partitioned".to_string()]);
        let seen = handle.join().unwrap();
        assert!(seen[0].starts_with("GET /a/b?x=1 HTTP/1.1") && seen[0].contains("cookie: sid=zzz") && seen[0].contains(&format!("referer: http://127.0.0.1:{port}/prev")) && !seen[0].to_lowercase().contains("gzip"), "{}", seen[0]);
        assert!(seen[1].starts_with("POST /login HTTP/1.1") && seen[1].contains("Content-Length: 14") && seen[1].ends_with("user=mira&pw=x") && seen[1].contains(&format!("origin: http://127.0.0.1:{port}")), "{}", seen[1]);
    }

    #[test]
    fn a_program_that_is_down_gives_a_plain_page_and_a_big_text_is_left_alone() {
        let probe = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = probe.local_addr().unwrap().port();
        drop(probe);
        let live = running(port);
        assert_eq!(serve(&live, B, &req("GET", "/", &[], b"")).status, 502);
        let (p, h) = fake(vec![b"HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: 4\r\n\r\n\x89PNG".to_vec()]);
        let r = serve(&running(p), B, &req("GET", "/i.png", &[], b""));
        assert_eq!(r.body.as_slice(), b"\x89PNG");
        h.join().unwrap();
    }

    #[test]
    fn a_program_is_started_waited_for_and_stopped() {
        // the program is `node` running a one-line server; the test is skipped where node is not installed
        if Command::new("node").arg("-v").stdout(Stdio::null()).status().is_err() {
            return;
        }
        let dir = std::env::temp_dir().join(format!("kona-live-unit-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".kona").join("mockups").join("app")).unwrap();
        std::fs::write(dir.join("server.js"), "require('http').createServer((q,s)=>{s.setHeader('Content-Type','text/plain');s.end('up '+process.env.WHO)}).listen(+process.env.KONA_LIVE_PORT,'127.0.0.1')").unwrap();
        let probe = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = probe.local_addr().unwrap().port();
        drop(probe);
        std::fs::write(dir.join(".kona").join("mockups").join("app").join("mockup.json"), json!({ "name": "App", "live": { "start": "node server.js", "port": port, "env": { "WHO": "mira" }, "wait": 30 } }).to_string()).unwrap();
        let live = Live::default();
        // a changed or unshown recipe is refused
        assert!(live.start(&dir, "p", "app", "something else", false).is_err());
        let info = mock::card_info(&mock::card_root(&dir, "app").unwrap()).unwrap();
        let approval = Recipe::from_info(&info).unwrap().unwrap().approval();
        live.start(&dir, "p", "app", &approval, false).unwrap();
        let t0 = Instant::now();
        while live.target().is_none() && t0.elapsed() < Duration::from_secs(40) {
            std::thread::sleep(Duration::from_millis(200));
        }
        assert_eq!(live.status().phase, "ready", "{:?}", live.status());
        let r = serve(&live, B, &req("GET", "/", &[], b""));
        assert_eq!(r.body.as_slice(), b"up mira");
        // a second program on a port that already answers is refused, and Stop frees the port
        assert!(port_answers(port));
        live.stop();
        let t0 = Instant::now();
        while port_answers(port) && t0.elapsed() < Duration::from_secs(10) {
            std::thread::sleep(Duration::from_millis(100));
        }
        assert!(!port_answers(port), "the program is still there after Stop");
        assert_eq!(live.status().phase, "off");
        let _ = std::fs::remove_dir_all(&dir);
    }
    #[test]
    fn a_card_keeps_its_data_between_runs_and_gets_a_bucket() {
        // the program is `node`: it counts its starts in a file of its data folder and tells what Kona put into its environment; skipped where node is not installed
        if Command::new("node").arg("-v").stdout(Stdio::null()).status().is_err() {
            return;
        }
        let dir = std::env::temp_dir().join(format!("kona-live-data-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let card = dir.join(".kona").join("mockups").join("app");
        std::fs::create_dir_all(&card).unwrap();
        std::fs::write(dir.join("server.js"), "const fs=require('fs'),path=require('path');const d=process.env.KONA_LIVE_DATA;const f=path.join(d,'seen.txt');fs.writeFileSync(f,(fs.existsSync(f)?fs.readFileSync(f,'utf8'):'')+'x');require('http').createServer((q,s)=>{s.setHeader('Content-Type','application/json');s.end(JSON.stringify({fresh:process.env.KONA_LIVE_FRESH,keep:process.env.KONA_LIVE_KEEP,ep:process.env.KONA_LIVE_BUCKET_ENDPOINT||null,url:process.env.KONA_LIVE_BUCKET_URL||null,seen:fs.readFileSync(f,'utf8').length}))}).listen(+process.env.KONA_LIVE_PORT,'127.0.0.1')").unwrap();
        std::fs::write(dir.join("clean.js"), "require('fs').writeFileSync(require('path').join(process.env.KONA_LIVE_DATA,'..','cleaned.txt'),'yes')").unwrap();
        let probe = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = probe.local_addr().unwrap().port();
        drop(probe);
        let write_recipe = |keep: bool| std::fs::write(card.join("mockup.json"), json!({ "name": "App", "live": { "start": "node server.js", "clean": "node clean.js", "port": port, "bucket": true, "keep": keep, "wait": 30 } }).to_string()).unwrap();
        write_recipe(true);
        let approval = |dir: &Path| Recipe::from_info(&mock::card_info(&mock::card_root(dir, "app").unwrap()).unwrap()).unwrap().unwrap().approval();
        let live = Live::default();
        let ask = |live: &Live| -> serde_json::Value {
            let t0 = Instant::now();
            while live.target().is_none() && t0.elapsed() < Duration::from_secs(40) {
                std::thread::sleep(Duration::from_millis(200));
            }
            assert_eq!(live.status().phase, "ready", "{:?}", live.status());
            serde_json::from_slice(&serve(live, B, &req("GET", "/", &[], b"")).body).unwrap()
        };
        let stopped = |live: &Live| {
            live.stop();
            let t0 = Instant::now();
            while port_answers(port) && t0.elapsed() < Duration::from_secs(10) {
                std::thread::sleep(Duration::from_millis(100));
            }
        };
        let project = std::fs::canonicalize(&dir).unwrap();
        let data = data_dir(&project, "app").unwrap();
        assert!(!data_info(&data).exists);
        // the first start: no data, so it begins fresh; the bucket is there and the page's own address serves its files
        live.start(&dir, "p", "app", &approval(&dir), false).unwrap();
        let a = ask(&live);
        assert_eq!((a["fresh"].as_str(), a["keep"].as_str(), a["seen"].as_u64()), (Some("1"), Some("1"), Some(1)));
        let endpoint = a["ep"].as_str().unwrap().to_string();
        assert!(endpoint.starts_with("http://127.0.0.1:") && a["url"].as_str().unwrap().ends_with("/cloud"), "{a}");
        let bucket_port: u16 = endpoint.rsplit(':').next().unwrap().parse().unwrap();
        assert_eq!(upstream(bucket_port, "PUT", "/kona/pics/one.png", &[], b"png-bytes").unwrap().status, 200);
        let shown = serve(&live, B, &req("GET", "/cloud/pics/one.png", &[], b""));
        assert_eq!((shown.status, shown.body.as_slice(), shown.header("content-type")), (200, b"png-bytes".as_slice(), vec!["image/png".to_string()]));
        assert_eq!(serve(&live, B, &req("GET", "/cloud/pics/none.png", &[], b"")).status, 404);
        assert_eq!(serve(&live, B, &req("GET", "/cloud/..%2F..%2Fserver.js", &[], b"")).status, 404);
        // Stop keeps the data (the default), and the owner can see how much
        stopped(&live);
        let info = data_info(&data);
        assert!(info.exists && info.files >= 2 && info.bytes > 0 && info.place == ".kona/live-data/app", "{info:?}");
        assert!(!port_answers(bucket_port), "the bucket goes with the program");
        // the next start carries on with it: not fresh, the file has grown, the picture is still there at the new bucket's address
        live.start(&dir, "p", "app", &approval(&dir), false).unwrap();
        let b = ask(&live);
        assert_eq!((b["fresh"].as_str(), b["seen"].as_u64()), (Some("0"), Some(2)));
        assert_eq!(serve(&live, B, &req("GET", "/cloud/pics/one.png", &[], b"")).body, b"png-bytes");
        // Delete data is refused while the card runs
        assert!(delete_data_now(&live, &dir, "app", &approval(&dir)).unwrap_err().contains("Stop"));
        stopped(&live);
        // "Start fresh" takes the old data away first
        live.start(&dir, "p", "app", &approval(&dir), true).unwrap();
        let c = ask(&live);
        assert_eq!((c["fresh"].as_str(), c["seen"].as_u64()), (Some("1"), Some(1)));
        assert_eq!(serve(&live, B, &req("GET", "/cloud/pics/one.png", &[], b"")).status, 404, "the picture of the old data is gone");
        // "Stop and delete its data"
        live.stop_with(true);
        assert!(!data_info(&data).exists && !data.exists());
        // Delete data runs the card's clean command (as the sheet showed it) and then takes the folder away; a changed recipe is refused
        live.start(&dir, "p", "app", &approval(&dir), false).unwrap();
        ask(&live);
        stopped(&live);
        assert!(delete_data_now(&live, &dir, "app", "something else").is_err());
        let said = delete_data_now(&live, &dir, "app", &approval(&dir)).unwrap();
        assert!(said.starts_with("Deleted"), "{said}");
        assert!(!data.exists() && project.join(".kona").join("live-data").join("cleaned.txt").exists(), "the clean command ran, and the folder is gone");
        // a recipe that says keep: false deletes the data at Stop
        write_recipe(false);
        live.start(&dir, "p", "app", &approval(&dir), false).unwrap();
        let d = ask(&live);
        assert_eq!(d["keep"].as_str(), Some("0"));
        assert!(data.exists());
        stopped(&live);
        assert!(!data.exists(), "keep: false deletes the data at Stop");
        // only a folder of the right shape is ever deleted
        assert!(remove_data(&project).is_err() && remove_data(&project.join(".kona")).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_demo_logins_of_a_card_are_read_from_its_data_folder() {
        let d = std::env::temp_dir().join(format!("kona-live-accounts-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        assert!(accounts_of(&d).is_empty(), "no file, no logins");
        std::fs::write(d.join("accounts.json"), json!([{ "who": "Teacher", "login": "teacher@example.test", "password": "demo-pass", "note": "sees two classes" }, { "who": "Student", "login": "student@example.test", "password": "demo-pass" }, { "who": "No login" }, { "login": "x@example.test", "password": "p" }]).to_string()).unwrap();
        let a = accounts_of(&d);
        assert_eq!(a.len(), 3, "an entry without a login is left out");
        assert_eq!((a[0].who.as_str(), a[0].login.as_str(), a[0].note.as_deref()), ("Teacher", "teacher@example.test", Some("sees two classes")));
        assert_eq!((a[1].password.as_str(), a[1].note.clone()), ("demo-pass", None));
        std::fs::write(d.join("accounts.json"), "not json").unwrap();
        assert!(accounts_of(&d).is_empty());
        std::fs::write(d.join("accounts.json"), json!({ "who": "x" }).to_string()).unwrap();
        assert!(accounts_of(&d).is_empty(), "a list is expected");
        std::fs::write(d.join("accounts.json"), vec![b' '; 70 * 1024]).unwrap();
        assert!(accounts_of(&d).is_empty(), "a file that is too big is not read");
        let _ = std::fs::remove_dir_all(&d);
    }
    #[test]
    fn a_live_page_cannot_ask_a_question_that_nothing_can_answer() {
        // alert, confirm and prompt cannot be shown inside a frame of Kona's window (and Tauri's own stand-ins return a promise, which is "yes" to an `if`): they are answered at once (nothing, No, nothing)
        // and the sheet is told; a page that asks "leave this page?" when it is left would stop the frame for good, so that listener is dropped
        let page = String::from_utf8(mock::inject_script(b"<html><head></head><body></body></html>", LINKS_SCRIPT)).unwrap();
        for part in ["window.alert=function", "window.confirm=function(t){q('confirm',t);return false;}", "window.prompt=function(t){q('prompt',t);return null;}", "t==='beforeunload'", "onbeforeunload"] {
            assert!(page.contains(part), "missing: {part}");
        }
        assert!(page.find("<script>").unwrap() < page.find("</head>").unwrap(), "the script comes first in the head, before the page's own scripts");
    }
    #[test]
    fn an_answer_that_never_ends_is_given_up() {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        let h = std::thread::spawn(move || {
            let (mut s, _) = l.accept().unwrap();
            let mut buf = [0u8; 2048];
            let _ = s.read(&mut buf);
            let _ = s.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n");
            for _ in 0..40 {
                if s.write_all(b"6\r\ndata: \r\n").is_err() {
                    break;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
        });
        let t0 = Instant::now();
        let r = upstream_within(port, "GET", "/stream", &[], &[], Duration::from_millis(700));
        assert!(r.is_err() && r.err().unwrap().contains("did not end in time"), "a stream is refused with the reason");
        assert!(t0.elapsed() < Duration::from_secs(3), "and not after the whole stream");
        drop(h);
    }

    #[test]
    fn the_listener_speaks_real_http_to_a_browser() {
        let (p, h) = fake(vec![b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nSet-Cookie: sid=1; Path=/\r\nContent-Length: 20\r\n\r\n<p>hello</p><b>x</b>!".to_vec(), b"HTTP/1.1 204 No Content\r\n\r\n".to_vec()]);
        let live = running(p);
        let base = live.proxy().unwrap();
        assert_eq!(live.proxy().unwrap(), base, "the listener is made once");
        let port: u16 = base.rsplit(':').next().unwrap().parse().unwrap();
        let ask = |raw: &str| {
            let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
            s.write_all(raw.as_bytes()).unwrap();
            let mut out = Vec::new();
            s.read_to_end(&mut out).unwrap();
            String::from_utf8_lossy(&out).into_owned()
        };
        let a = ask("GET /x?y=1 HTTP/1.1\r\nHost: 127.0.0.1\r\nCookie: a=b\r\n\r\n");
        assert!(a.starts_with("HTTP/1.1 200 OK\r\n") && a.contains("Set-Cookie: sid=1; Path=/; SameSite=None; Secure; Partitioned\r\n") && a.contains("Connection: close") && a.contains("<p>hello</p>"), "{a}");
        assert!(a.contains("Content-Security-Policy: sandbox allow-scripts allow-same-origin allow-forms"), "{a}");
        let b = ask("POST /f HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n0\r\n\r\n");
        assert!(b.starts_with("HTTP/1.1 204 No Content\r\n"), "{b}");
        let seen = h.join().unwrap();
        assert!(seen[0].starts_with("GET /x?y=1 HTTP/1.1") && seen[0].contains("cookie: a=b"), "{}", seen[0]);
        assert!(seen[1].contains("Content-Length: 3") && seen[1].ends_with("abc"), "{}", seen[1]);
        // a request nobody can read gets a plain answer, not a hang
        assert!(ask("\r\n\r\n").starts_with("HTTP/1.1 400"));
    }
}
