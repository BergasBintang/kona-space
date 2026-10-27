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
                    history: vec![format!("{at} raised by {who}")],
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
        if s != t.status { said.push(format!("moved from {} to {s} by {who}", t.status)); t.status = s; }
    }
    if let Some(r) = p.role {
        let r = if r.is_empty() { None } else { Some(r) };
        if r != t.role { said.push(format!("role set to {} by {who}", r.as_deref().unwrap_or("none"))); t.role = r; }
    }
    if let Some(n) = p.next { let n = one_line(&n); if n != t.next { t.next = n; said.push(format!("next step updated by {who}")); } }
    if let Some(w) = p.waiting { if w != t.waiting { t.waiting = w; said.push(if w { format!("marked waiting on the owner by {who}") } else { format!("no longer waiting, said {who}") }); } }
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
    fs::remove_file(path_of(dir, id)).map_err(|e| format!("Could not remove the ticket: {e}"))
}

/// The paragraph that tells a session which ticket it works on.
pub fn prompt_for(t: &Ticket) -> String {
    let mut p = format!("You are working on ticket {}: {}.", t.id, t.title);
    if !t.description.trim().is_empty() { p.push_str(&format!(" What it is: {}", one_line(&t.description))); }
    if !t.acceptance.trim().is_empty() { p.push_str(&format!(" It is done when: {}", one_line(&t.acceptance))); }
    p.push_str(" You can read and change tickets with the kona-board tools. Keep this ticket's next step up to date with update_ticket. When your part is ready for the owner to look at, move it to review. Never move a ticket to done: only the owner does that.");
    p
}
