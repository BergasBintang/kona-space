// Tickets (feature F10): one plain file per ticket in the project, `.kona/tickets/T-0012.md`, so the owner can read, edit,
// back up and search them without Kona. A file starts with a few `key: value` lines between `---` marks, then the description,
// then `## Done when` and `## History`. Both Kona's window and the built-in tool server (mcp.rs) write through this file,
// so there is exactly one place that knows the format and the rules.
//   - Each write goes to a temporary file and is renamed over the ticket, so a reader never sees half a file.
//   - A new ticket reserves its number by creating the file with `create_new`, so two writers can never get the same number.
//   - Two writers changing the same ticket at the same instant could still lose one change; for one owner on one PC that is rare, and noted.
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub const STATUSES: [&str; 5] = ["backlog", "ready", "in-progress", "review", "done"];
pub const COPY_CHOICES: [&str; 3] = ["auto", "yes", "no"];

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Ticket {
    pub id: String,
    pub title: String,
    pub status: String,
    /// a role id, or None
    pub role: Option<String>,
    pub raised_by: String,
    pub sessions: Vec<String>,
    pub next: String,
    /// somebody (the owner, or an agent that needs an answer) says this card waits on the owner
    pub waiting: bool,
    pub created: String,
    pub updated: String,
    pub description: String,
    pub acceptance: String,
    pub history: Vec<String>,
    /// where its sessions work: "auto" (the role's setting), "yes" (its own copy of the repo) or "no" (the main folder)
    pub own_copy: String,
    /// the branch and the folder of its own copy, once one was made
    pub branch: String,
    pub worktree: String,
    /// the tickets that must be done before this one can start (a step of a workflow that comes after other steps)
    pub blocked_by: Vec<String>,
    /// the workflow this ticket is a step of, if any
    pub workflow: String,
}

#[derive(Deserialize, Default)]
pub struct NewTicket {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub acceptance: String,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub next: String,
    #[serde(default)]
    pub own_copy: Option<String>,
    #[serde(default)]
    pub blocked_by: Vec<String>,
    #[serde(default)]
    pub workflow: String,
}

/// What to change. Every field is optional; only the ones present are touched. `role: ""` clears the role.
#[derive(Deserialize, Default)]
pub struct Patch {
    pub title: Option<String>,
    pub description: Option<String>,
    pub acceptance: Option<String>,
    pub status: Option<String>,
    pub role: Option<String>,
    pub next: Option<String>,
    pub waiting: Option<bool>,
    /// a line added to the history
    pub note: Option<String>,
    pub own_copy: Option<String>,
    /// the whole list of tickets this one waits for
    pub blocked_by: Option<Vec<String>>,
}

/// Local date and time as `2026-10-27 21:40`, asked of the SQLite already bundled (no time library needed).
pub fn now() -> String {
    Connection::open_in_memory()
        .and_then(|c| c.query_row("SELECT strftime('%Y-%m-%d %H:%M', 'now', 'localtime')", [], |r| r.get::<_, String>(0)))
        .unwrap_or_default()
}

pub fn dir(project_folder: &Path) -> PathBuf {
    project_folder.join(".kona").join("tickets")
}

pub fn valid_id(id: &str) -> bool {
    id.len() >= 6 && id.starts_with("T-") && id[2..].chars().all(|c| c.is_ascii_digit())
}

fn one_line(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn render(t: &Ticket) -> String {
    let mut s = String::from("---\n");
    let mut kv = |k: &str, v: &str| s.push_str(&format!("{k}: {}\n", one_line(v)));
    kv("id", &t.id);
    kv("title", &t.title);
    kv("status", &t.status);
    kv("role", t.role.as_deref().unwrap_or(""));
    kv("raised_by", &t.raised_by);
    kv("sessions", &t.sessions.join(", "));
    kv("next", &t.next);
    kv("waiting", if t.waiting { "true" } else { "false" });
    kv("own_copy", &t.own_copy);
    kv("branch", &t.branch);
    kv("worktree", &t.worktree);
    kv("blocked_by", &t.blocked_by.join(", "));
    kv("workflow", &t.workflow);
    kv("created", &t.created);
    kv("updated", &t.updated);
    s.push_str("---\n");
    s.push_str(t.description.trim());
    s.push_str("\n\n## Done when\n");
    s.push_str(t.acceptance.trim());
    s.push_str("\n\n## History\n");
    for h in &t.history {
        s.push_str(&format!("- {}\n", one_line(h)));
    }
    s
}

fn parse(text: &str) -> Option<Ticket> {
    let text = text.replace("\r\n", "\n");
    let rest = text.strip_prefix("---\n")?;
    let (head, body) = rest.split_once("\n---\n").or_else(|| rest.split_once("---\n"))?;
    let mut t = Ticket::default();
    for line in head.lines() {
        let Some((k, v)) = line.split_once(':') else { continue };
        let v = v.trim().to_string();
        match k.trim() {
            "id" => t.id = v,
            "title" => t.title = v,
            "status" => t.status = v,
            "role" => t.role = if v.is_empty() { None } else { Some(v) },
            "raised_by" => t.raised_by = v,
            "sessions" => t.sessions = v.split(',').map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect(),
            "next" => t.next = v,
            "waiting" => t.waiting = v == "true",
            "own_copy" => t.own_copy = v,
            "branch" => t.branch = v,
            "worktree" => t.worktree = v,
            "blocked_by" => t.blocked_by = v.split(',').map(|x| x.trim().to_string()).filter(|x| valid_id(x)).collect(),
            "workflow" => t.workflow = v,
            "created" => t.created = v,
            "updated" => t.updated = v,
            _ => {}
        }
    }
    if !valid_id(&t.id) {
        return None;
    }
    if !STATUSES.contains(&t.status.as_str()) {
        t.status = "backlog".into();
    }
    if !COPY_CHOICES.contains(&t.own_copy.as_str()) {
        t.own_copy = "auto".into();
    }
    let (desc_and_done, history) = match body.split_once("\n## History\n") {
        Some((a, h)) => (a.to_string(), h.to_string()),
        None => (body.to_string(), String::new()),
    };
    let (desc, done) = match desc_and_done.split_once("\n## Done when\n") {
        Some((d, a)) => (d.to_string(), a.to_string()),
        None => (desc_and_done, String::new()),
    };
    t.description = desc.trim().to_string();
    t.acceptance = done.trim().to_string();
    t.history = history.lines().filter_map(|l| l.strip_prefix("- ")).map(str::to_string).collect();
    Some(t)
}

fn path_of(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.md"))
}

fn write(dir: &Path, t: &Ticket) -> Result<(), String> {
    let tmp = dir.join(format!("{}.md.tmp", t.id));
    fs::write(&tmp, render(t)).map_err(|e| format!("Could not save the ticket: {e}"))?;
    fs::rename(&tmp, path_of(dir, &t.id)).map_err(|e| format!("Could not save the ticket: {e}"))
}

pub fn list(dir: &Path) -> Vec<Ticket> {
    let Ok(rd) = fs::read_dir(dir) else { return vec![] };
    let mut out: Vec<Ticket> = rd
        .filter_map(Result::ok)
        .filter(|e| e.file_name().to_string_lossy().ends_with(".md"))
        .filter_map(|e| fs::read_to_string(e.path()).ok())
        .filter_map(|t| parse(&t))
        .collect();
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}

pub fn get(dir: &Path, id: &str) -> Result<Ticket, String> {
    if !valid_id(id) {
        return Err("That is not a ticket number".into());
    }
    let text = fs::read_to_string(path_of(dir, id)).map_err(|_| format!("There is no ticket {id}"))?;
    parse(&text).ok_or_else(|| format!("Ticket {id} could not be read"))
}

fn check_text(label: &str, s: &str, max: usize) -> Result<(), String> {
    if s.chars().count() > max {
        return Err(format!("The {label} is too long (more than {max} characters)"));
    }
    Ok(())
}

/// Make a ticket. `who` is the history's name for the writer: "the owner", or "session ab12cd34 (role: QA)".
pub fn create(dir: &Path, n: NewTicket, who: &str) -> Result<Ticket, String> {
    let title = one_line(&n.title);
    if title.is_empty() {
        return Err("A ticket needs a title".into());
    }
    check_text("title", &title, 140)?;
    check_text("description", &n.description, 20_000)?;
    check_text("done-when text", &n.acceptance, 10_000)?;
    let own_copy = n.own_copy.unwrap_or_else(|| "auto".into());
    if !COPY_CHOICES.contains(&own_copy.as_str()) {
        return Err("That is not a choice for where the ticket works".into());
    }
    if !n.blocked_by.iter().all(|b| valid_id(b)) {
        return Err("That is not a ticket number".into());
    }
    let status = n.status.unwrap_or_else(|| "backlog".into());
    if !STATUSES.contains(&status.as_str()) {
        return Err("That is not a column on the board".into());
    }
    fs::create_dir_all(dir).map_err(|e| format!("Could not make the tickets folder: {e}"))?;
    let top = list(dir).iter().filter_map(|t| t.id[2..].parse::<u32>().ok()).max().unwrap_or(0);
    for attempt in 1..=50 {
        let id = format!("T-{:04}", top + attempt);
        match fs::OpenOptions::new().write(true).create_new(true).open(path_of(dir, &id)) {
            Ok(mut f) => {
                let _ = f.write_all(b""); // the number is reserved now
                let at = now();
                let t = Ticket {
                    id, title, status: status.clone(), role: n.role.filter(|r| !r.is_empty()), raised_by: who.to_string(), sessions: vec![], next: one_line(&n.next),
                    waiting: false, created: at.clone(), updated: at.clone(), description: n.description, acceptance: n.acceptance,
                    history: vec![format!("{at} raised by {who}")], own_copy: own_copy.clone(), branch: String::new(), worktree: String::new(), blocked_by: n.blocked_by, workflow: n.workflow,
                };
                write(dir, &t)?;
                return Ok(t);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("Could not make the ticket: {e}")),
        }
    }
    Err("Could not find a free ticket number".into())
}

pub fn update(dir: &Path, id: &str, p: Patch, who: &str) -> Result<Ticket, String> {
    let mut t = get(dir, id)?;
    let at = now();
    let mut said: Vec<String> = vec![];
    let mut finished = false;
    if let Some(title) = p.title {
        let title = one_line(&title);
        if title.is_empty() {
            return Err("A ticket needs a title".into());
        }
        check_text("title", &title, 140)?;
        if title != t.title { said.push(format!("title changed by {who}")); t.title = title; }
    }
    if let Some(d) = p.description { check_text("description", &d, 20_000)?; if d.trim() != t.description { said.push(format!("description changed by {who}")); t.description = d; } }
    if let Some(a) = p.acceptance { check_text("done-when text", &a, 10_000)?; if a.trim() != t.acceptance { said.push(format!("done-when text changed by {who}")); t.acceptance = a; } }
    if let Some(s) = p.status {
        if !STATUSES.contains(&s.as_str()) {
            return Err("That is not a column on the board".into());
        }
        if s != t.status { finished = s == "done"; said.push(format!("moved from {} to {s} by {who}", t.status)); t.status = s; }
    }
    if let Some(r) = p.role {
        let r = if r.is_empty() { None } else { Some(r) };
        if r != t.role { said.push(format!("role set to {} by {who}", r.as_deref().unwrap_or("none"))); t.role = r; }
    }
    if let Some(n) = p.next { let n = one_line(&n); if n != t.next { t.next = n; said.push(format!("next step updated by {who}")); } }
    if let Some(w) = p.waiting && w != t.waiting { t.waiting = w; said.push(if w { format!("marked waiting on the owner by {who}") } else { format!("no longer waiting, said {who}") }); }
    if let Some(c) = p.own_copy {
        if !COPY_CHOICES.contains(&c.as_str()) {
            return Err("That is not a choice for where the ticket works".into());
        }
        if c != t.own_copy { said.push(format!("where it works set to {c} by {who}")); t.own_copy = c; }
    }
    if let Some(b) = p.blocked_by {
        if b.iter().any(|x| !valid_id(x) || x == &t.id) {
            return Err("A ticket can only wait for other tickets".into());
        }
        if b != t.blocked_by { said.push(if b.is_empty() { format!("no longer waits for other tickets, said {who}") } else { format!("now waits for {} by {who}", b.join(", ")) }); t.blocked_by = b; }
    }
    if let Some(n) = p.note {
        let n = one_line(&n);
        if !n.is_empty() { check_text("note", &n, 1_000)?; said.push(format!("note from {who}: {n}")); }
    }
    if said.is_empty() {
        return Ok(t);
    }
    t.updated = at.clone();
    for s in said { t.history.push(format!("{at} {s}")); }
    write(dir, &t)?;
    if finished {
        release_waiting(dir);
    }
    Ok(t)
}

/// The steps of a workflow wait in Backlog for the tickets before them. When a ticket is done (or removed), move the waiting ones that no longer wait for anything
/// open to Ready, and say so in their history. Only a ticket still in Backlog moves: one the owner already put elsewhere stays where it is.
pub fn release_waiting(dir: &Path) -> Vec<Ticket> {
    let all = list(dir);
    let mut freed = vec![];
    for t in all.iter().filter(|t| t.status == "backlog" && !t.blocked_by.is_empty()) {
        if t.blocked_by.iter().all(|b| all.iter().find(|x| &x.id == b).is_none_or(|x| x.status == "done")) {
            let at = now();
            let mut t = t.clone();
            t.status = "ready".into();
            t.updated = at.clone();
            t.history.push(format!("{at} moved from backlog to ready: everything it waited for is done"));
            if write(dir, &t).is_ok() {
                freed.push(t);
            }
        }
    }
    freed
}

/// Record the ticket's own copy of the repo (branch and folder).
pub fn set_worktree(dir: &Path, id: &str, branch: &str, path: &str, who: &str) -> Result<Ticket, String> {
    let mut t = get(dir, id)?;
    if t.branch == branch && t.worktree == path {
        return Ok(t);
    }
    let at = now();
    t.branch = branch.to_string();
    t.worktree = path.to_string();
    t.updated = at.clone();
    t.history.push(format!("{at} its own copy made on branch {branch} ({who})"));
    write(dir, &t)?;
    Ok(t)
}

/// The ticket's own copy was removed: forget the folder and branch, and say so in the history.
pub fn clear_worktree(dir: &Path, id: &str, why: &str) -> Result<Ticket, String> {
    let mut t = get(dir, id)?;
    let at = now();
    t.branch = String::new();
    t.worktree = String::new();
    t.updated = at.clone();
    t.history.push(format!("{at} {why}"));
    write(dir, &t)?;
    Ok(t)
}

/// Record that a session works on this ticket. A card still in Backlog or Ready moves to In progress.
pub fn link_session(dir: &Path, id: &str, session_id: &str, who: &str) -> Result<Ticket, String> {
    let mut t = get(dir, id)?;
    let at = now();
    if !t.sessions.iter().any(|s| s == session_id) { t.sessions.push(session_id.to_string()); }
    t.history.push(format!("{at} session {} started ({who})", &session_id[..session_id.len().min(8)]));
    if t.status == "backlog" || t.status == "ready" {
        t.history.push(format!("{at} moved from {} to in-progress", t.status));
        t.status = "in-progress".into();
    }
    t.updated = at;
    write(dir, &t)?;
    Ok(t)
}

pub fn remove(dir: &Path, id: &str) -> Result<(), String> {
    if !valid_id(id) {
        return Err("That is not a ticket number".into());
    }
    fs::remove_file(path_of(dir, id)).map_err(|e| format!("Could not remove the ticket: {e}"))?;
    release_waiting(dir);
    Ok(())
}

/// The paragraph that tells a session which ticket it works on.
pub fn prompt_for(t: &Ticket) -> String {
    let mut p = format!("You are working on ticket {}: {}.", t.id, t.title);
    if !t.description.trim().is_empty() { p.push_str(&format!(" What it is: {}", one_line(&t.description))); }
    if !t.acceptance.trim().is_empty() { p.push_str(&format!(" It is done when: {}", one_line(&t.acceptance))); }
    if !t.worktree.is_empty() {
        p.push_str(&format!(" You are working in this ticket's own copy of the repository, on the branch {}. Commit your work there when it is ready; do not switch branches.", t.branch));
    }
    p.push_str(" You can read and change tickets with the kona-board tools. Keep this ticket's next step up to date with update_ticket. When your part is ready for the owner to look at, move it to review. Never move a ticket to done: only the owner does that.");
    p
}
