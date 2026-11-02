// The built-in tool server for the board (feature F10). Kona starts a session with `--mcp-config` pointing at Kona's own program
// in this mode (`app --mcp-board --folder ... --session ... --role ...`). Claude Code starts it, talks to it over
// standard input and output (one JSON message per line, the Model Context Protocol), and stops it with the session.
// Because the server is started for one known session, "who raised this ticket" is exact: it is the session id and role given here.
// The server only touches that project's ticket files, through tickets.rs, and an agent can never move a ticket to Done or remove one.
use crate::tickets::{self, NewTicket, Patch, Ticket};
use crate::{brain, brain_search};
use serde_json::{json, Value};
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};

struct Ctx {
    dir: PathBuf,
    project: PathBuf,
    who: String,
    session: String,
    role: String, // the role id, or empty
    roles: Vec<(String, String, String)>, // id, job, person
}

/// A note's id from words: lower-case letters and digits joined by single dashes, up to 60 characters.
fn slug(s: &str) -> String {
    let mut out = String::new();
    for c in s.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() { out.push(c); } else if !out.ends_with('-') { out.push('-'); }
    }
    out.trim_matches('-').chars().take(60).collect::<String>().trim_matches('-').to_string()
}

/// Write a note into the project's brain on behalf of a session. A note of the owner's, or one Kona wrote, is never changed here; a note this tool wrote before can be rewritten.
fn save_note(ctx: &Ctx, a: &Value) -> Result<String, String> {
    let title = text_of(a, "title").unwrap_or_default().split_whitespace().collect::<Vec<_>>().join(" ");
    let body = text_of(a, "body").unwrap_or_default();
    if title.is_empty() { return Err("Give the note a title".into()); }
    if body.trim().is_empty() { return Err("The note has no text".into()); }
    if body.trim_start().starts_with("---") { return Err("Do not write front matter (the lines between ---). Kona adds it. Send only the text of the note.".into()); }
    if body.len() > 60 * 1024 { return Err("That note is longer than 60 KB. Split it into notes that link to each other with [[their-id]].".into()); }
    if brain_search::contains_secret(&body) || brain_search::contains_secret(&title) {
        return Err("That text looks like it holds a secret (a key, a token or a password). Leave it out and say where it is kept instead.".into());
    }
    let kind = text_of(a, "kind").unwrap_or_else(|| "note".into());
    if !["decision", "topic", "open", "note"].contains(&kind.as_str()) { return Err("kind is one of: decision, topic, open, note".into()); }
    let id = text_of(a, "id").map(|s| slug(&s)).filter(|s| !s.is_empty()).unwrap_or_else(|| slug(&title));
    if !brain::valid_id(&id) { return Err("Give a title or an id with letters or digits in it".into()); }
    let old = std::fs::read_to_string(brain::dir(&ctx.project).join(format!("{id}.md"))).ok();
    let today: String = tickets::now().chars().take(10).collect();
    let mut date = today.clone();
    if let Some(old) = &old {
        let (meta, _) = brain_search::front_matter(old);
        if meta.get("source").map(String::as_str) != Some("agent") || meta.contains_key("edited_by") {
            return Err(format!("A note called {id} is already in the brain and is the owner's or Kona's, so it is not changed. Choose another id, or write your part as a new note that links to it with [[{id}]]."));
        }
        if let Some(d) = meta.get("date") { date = d.clone(); }
    }
    let mut text = format!("---\ntitle: {title}\nkind: {kind}\ndate: {date}\n");
    if date != today { text.push_str(&format!("updated: {today}\n")); }
    if kind == "open" { text.push_str("status: open\n"); }
    text.push_str("source: agent\n");
    text.push_str(&format!("session: {}\n", ctx.session));
    if !ctx.role.is_empty() { text.push_str(&format!("role: {}\n", ctx.role)); }
    text.push_str("---\n");
    if !body.trim_start().starts_with("# ") { text.push_str(&format!("# {title}\n\n")); }
    text.push_str(body.trim());
    text.push('\n');
    let n = brain::save(&ctx.project, &id, &text)?;
    Ok(format!("{} note {id} in the project's brain ({}). The owner sees it in the Brain place, and any session finds it with search_brain.", if old.is_some() { "Updated" } else { "Saved" }, n.path))
}

/// One line for each of the project's own notes, newest first, so a session can see what is already there.
fn list_notes(ctx: &Ctx, a: &Value) -> String {
    let only = text_of(a, "kind");
    let mut rows: Vec<(String, String, String, String)> = brain_search::load_notes(&ctx.project).into_iter().filter(|n| n.layer == "project").filter_map(|n| {
        let (meta, _) = brain_search::front_matter(&n.raw);
        let kind = meta.get("kind").cloned().unwrap_or_else(|| "note".into());
        if only.as_ref().is_some_and(|k| *k != kind) { return None; }
        Some((meta.get("date").cloned().unwrap_or_default(), n.id, kind, n.title))
    }).collect();
    rows.sort_by(|x, y| y.0.cmp(&x.0).then(x.1.cmp(&y.1)));
    if rows.is_empty() { return "The project's brain has no notes of its own yet.".into(); }
    let total = rows.len();
    let mut out: Vec<String> = rows.into_iter().take(80).map(|(d, id, k, t)| format!("{id} [{k}] {d} {t}")).collect();
    if total > 80 { out.push(format!("... and {} older notes. Use search_brain to look for one.", total - 80)); }
    out.join("\n")
}

fn arg(args: &[String], name: &str) -> String {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned().unwrap_or_default()
}

// the roles are a fixed list since 0.20.0 (decision 43), so the tool server no longer reads a file for them
fn read_roles() -> Vec<(String, String, String)> {
    crate::roles::starting_roles().into_iter().map(|r| (r.id, r.name, r.person)).collect()
}

/// How one person refers to another: "Kiki the Product".
fn the(r: &(String, String, String)) -> String {
    if r.2.is_empty() { r.1.clone() } else { format!("{} the {}", r.2, r.1) }
}

fn tools() -> Value {
    let status_any = json!({"type": "string", "enum": ["backlog", "ready", "in-progress", "review"], "description": "A column on the board. 'done' is not offered: only the owner moves a ticket to done."});
    json!([
        {"name": "list_tickets", "description": "List the tickets of this project, one line each. Optionally only one column.",
         "inputSchema": {"type": "object", "properties": {"status": {"type": "string", "enum": ["backlog", "ready", "in-progress", "review", "done"]}}}},
        {"name": "get_ticket", "description": "Read one ticket in full: description, done-when text, next step, sessions and history.",
         "inputSchema": {"type": "object", "properties": {"id": {"type": "string", "description": "For example T-0012"}}, "required": ["id"]}},
        {"name": "create_ticket", "description": "Raise a new ticket in this project. It starts in Backlog unless you say Ready. Write the title and the done-when text in plain words.",
         "inputSchema": {"type": "object", "properties": {
            "title": {"type": "string"}, "description": {"type": "string", "description": "What needs doing and why."},
            "done_when": {"type": "string", "description": "How the owner can tell it is finished."},
            "role": {"type": "string", "description": "Which person should do it, by name or job (for example Jiro, or Frontend). Optional."},
            "status": {"type": "string", "enum": ["backlog", "ready"]}}, "required": ["title"]}},
        {"name": "update_ticket", "description": "Change a ticket: its column (not done), its next step, a note for the history, or whether it waits on the owner. Only the fields you give are changed.",
         "inputSchema": {"type": "object", "properties": {
            "id": {"type": "string"}, "status": status_any, "next": {"type": "string", "description": "One line: what should happen next."},
            "note": {"type": "string", "description": "A short note added to the history."},
            "waiting": {"type": "boolean", "description": "true when you need the owner's answer or decision before going on."},
            "title": {"type": "string"}, "description": {"type": "string"}, "done_when": {"type": "string"}, "role": {"type": "string"}}, "required": ["id"]}},
        {"name": "search_brain", "description": "Look something up in this project's brain: the owner's notes about earlier sessions and decisions, Claude's memory for the project and Kona's starter notes. The answer says plainly whether it is Found, Partly in the brain or Not in the brain, and names the note and the lines. Use it before assuming how this project was done.",
         "inputSchema": {"type": "object", "properties": {"query": {"type": "string", "description": "The question or the words to look for."}}, "required": ["query"]}},
        {"name": "read_note", "description": "Read some lines of one note of the brain, by the note id and line numbers that search_brain gave.",
         "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}, "from_line": {"type": "integer"}, "to_line": {"type": "integer"}}, "required": ["id"]}},
        {"name": "list_notes", "description": "List the notes of this project's brain that belong to the project (not Claude's memory or Kona's starter notes), newest first, one line each: id, kind, date, title. Use it to see what is already written before you add a note.",
         "inputSchema": {"type": "object", "properties": {"kind": {"type": "string", "enum": ["decision", "topic", "open", "note", "session"], "description": "Only notes of this kind. Optional."}}}},
        {"name": "save_note", "description": "Save something worth keeping into this project's brain, so the owner and every later session can find it with search_brain. Use it for decisions with their reason, facts about the project that the code does not show (how it is deployed, what a name means, a limit, a rule of the owner's), the result of a piece of research, and work still open. Do not save secrets, passwords or keys, what the code or git history already shows, or the chat itself. Search first: if a note on the topic exists, write a new note that links to it with [[its-id]] rather than a copy. Write the body in markdown: a one or two sentence summary first, then short sections. A note you saved before can be saved again under the same id to update it; the owner's notes are never changed.",
         "inputSchema": {"type": "object", "properties": {
            "title": {"type": "string", "description": "What the note is about, in 3 to 10 words."},
            "body": {"type": "string", "description": "The text of the note in markdown, without front matter."},
            "kind": {"type": "string", "enum": ["decision", "topic", "open", "note"], "description": "decision: something decided, with the reason. topic: how something works or what was found. open: work still to do. note: anything else. Default note."},
            "id": {"type": "string", "description": "Lower-case letters, digits and dashes. Optional: made from the title when left out."}}, "required": ["title", "body"]}}
    ])
}

fn role_id(ctx: &Ctx, given: &str) -> Result<Option<String>, String> {
    let g = given.trim();
    if g.is_empty() {
        return Ok(None);
    }
    // a role is found by its id, its job (Product), its person (Kiki), or "Kiki the Product" / "Kiki, Product"
    let g = g.to_lowercase();
    ctx.roles.iter().find(|r| [r.0.to_lowercase(), r.1.to_lowercase(), r.2.to_lowercase(), the(r).to_lowercase(), format!("{}, {}", r.2, r.1).to_lowercase()].contains(&g)).map(|r| Some(r.0.clone()))
        .ok_or_else(|| format!("There is no role called {given}. Roles: {}", ctx.roles.iter().map(the).collect::<Vec<_>>().join(", ")))
}

fn line(ctx: &Ctx, t: &Ticket) -> String {
    let role = t.role.as_ref().and_then(|r| ctx.roles.iter().find(|x| &x.0 == r)).map(the).unwrap_or_else(|| "no role".to_string());
    let blocked = if t.blocked_by.is_empty() { String::new() } else { format!(" - waits for {}", t.blocked_by.join(", ")) }; // a step of a workflow that comes after other steps
    format!("{} [{}] {} ({}){}{}", t.id, t.status, t.title, role, if t.waiting { " - waiting on the owner" } else { "" }, blocked)
}

fn full(ctx: &Ctx, t: &Ticket) -> String {
    let mut s = format!("{}\nStatus: {}\nRole: {}\nRaised by: {}\nNext: {}\nWaiting on the owner: {}\n", line(ctx, t), t.status,
        t.role.as_ref().and_then(|r| ctx.roles.iter().find(|x| &x.0 == r)).map(the).unwrap_or_else(|| "none".to_string()), t.raised_by, if t.next.is_empty() { "-" } else { &t.next }, if t.waiting { "yes" } else { "no" });
    s.push_str(&format!("\nDescription:\n{}\n\nDone when:\n{}\n\nHistory:\n", if t.description.is_empty() { "-" } else { &t.description }, if t.acceptance.is_empty() { "-" } else { &t.acceptance }));
    for h in &t.history { s.push_str(&format!("- {h}\n")); }
    s
}

fn text_of(v: &Value, k: &str) -> Option<String> {
    v.get(k).and_then(Value::as_str).map(str::to_string)
}

fn call(ctx: &Ctx, name: &str, a: &Value) -> Result<String, String> {
    match name {
        "list_tickets" => {
            let only = text_of(a, "status");
            let list: Vec<String> = tickets::list(&ctx.dir).iter().filter(|t| only.as_ref().is_none_or(|s| &t.status == s)).map(|t| line(ctx, t)).collect();
            Ok(if list.is_empty() { "No tickets.".into() } else { list.join("\n") })
        }
        "get_ticket" => Ok(full(ctx, &tickets::get(&ctx.dir, &text_of(a, "id").unwrap_or_default())?)),
        "create_ticket" => {
            let status = text_of(a, "status");
            if status.as_deref().is_some_and(|s| s != "backlog" && s != "ready") {
                return Err("A new ticket can only start in backlog or ready".into());
            }
            let role = role_id(ctx, &text_of(a, "role").unwrap_or_default())?;
            let t = tickets::create(&ctx.dir, NewTicket { title: text_of(a, "title").unwrap_or_default(), description: text_of(a, "description").unwrap_or_default(), acceptance: text_of(a, "done_when").unwrap_or_default(), role, status, next: String::new(), own_copy: None, ..Default::default() }, &ctx.who)?;
            Ok(format!("Raised {}: {}", t.id, t.title))
        }
        "update_ticket" => {
            let id = text_of(a, "id").unwrap_or_default();
            let status = text_of(a, "status");
            if status.as_deref() == Some("done") {
                return Err("Only the owner can move a ticket to done. Move it to review instead.".into());
            }
            if tickets::get(&ctx.dir, &id)?.status == "done" {
                return Err("This ticket is done. Only the owner can change it now.".into());
            }
            let role = match text_of(a, "role") { Some(r) => Some(role_id(ctx, &r)?.unwrap_or_default()), None => None };
            let t = tickets::update(&ctx.dir, &id, Patch {
                title: text_of(a, "title"), description: text_of(a, "description"), acceptance: text_of(a, "done_when"), status, role,
                next: text_of(a, "next"), waiting: a.get("waiting").and_then(Value::as_bool), note: text_of(a, "note"), own_copy: None, blocked_by: None,
            }, &ctx.who)?;
            Ok(format!("Updated. {}", line(ctx, &t)))
        }
        "search_brain" => {
            let q = text_of(a, "query").unwrap_or_default();
            if q.trim().is_empty() {
                return Err("Give the words to look for".into());
            }
            let notes = brain_search::load_notes(&ctx.project);
            let ans = brain_search::search(&notes, &q);
            // a miss goes on the owner's wanted list (unless the words look like a secret), so the gap is not forgotten
            if ans.state == "none" && !brain_search::contains_secret(&q) {
                let _ = brain::wanted_add(&ctx.project, &format!("(asked by a session) {}", q.trim()));
            }
            Ok(brain_search::describe(&ans))
        }
        "list_notes" => Ok(list_notes(ctx, a)),
        "save_note" => save_note(ctx, a),
        "read_note" => {
            let notes = brain_search::load_notes(&ctx.project);
            let n = |k: &str| a.get(k).and_then(Value::as_u64).map(|v| v as usize);
            brain_search::read(&notes, &text_of(a, "id").unwrap_or_default(), n("from_line"), n("to_line"))
        }
        _ => Err(format!("There is no tool called {name}")),
    }
}

fn handle(ctx: &Ctx, msg: &Value) -> Option<Value> {
    let id = msg.get("id").cloned()?; // a message with no id is a notification: no reply
    let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
    let result = match method {
        "initialize" => json!({
            "protocolVersion": msg["params"]["protocolVersion"].as_str().unwrap_or("2025-06-18"),
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "kona-board", "version": env!("CARGO_PKG_VERSION")}
        }),
        "ping" => json!({}),
        "tools/list" => json!({"tools": tools()}),
        "tools/call" => {
            let name = msg["params"]["name"].as_str().unwrap_or("");
            match call(ctx, name, &msg["params"]["arguments"]) {
                Ok(t) => json!({"content": [{"type": "text", "text": t}]}),
                Err(e) => json!({"content": [{"type": "text", "text": e}], "isError": true}),
            }
        }
        _ => return Some(json!({"jsonrpc": "2.0", "id": id, "error": {"code": -32601, "message": format!("Method not found: {method}")}})),
    };
    Some(json!({"jsonrpc": "2.0", "id": id, "result": result}))
}

/// Run as the board's tool server until the session closes its end of the pipe.
pub fn run(args: &[String]) {
    let folder = arg(args, "--folder");
    let session = arg(args, "--session");
    let role = arg(args, "--role");
    let roles = read_roles();
    let role_name = roles.iter().find(|r| r.0 == role).map(the);
    let who = format!("session {}{}", &session[..session.len().min(8)], role_name.map(|n| format!(" (role: {n})")).unwrap_or_default());
    let ctx = Ctx { dir: tickets::dir(Path::new(&folder)), project: PathBuf::from(&folder), who, session: session.clone(), role: role.clone(), roles };
    let stdin = std::io::stdin();
    let mut out = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let Ok(msg) = serde_json::from_str::<Value>(&line) else { continue };
        if let Some(reply) = handle(&ctx, &msg) {
            let _ = writeln!(out, "{reply}");
            let _ = out.flush();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(name: &str) -> Ctx {
        let d = std::env::temp_dir().join(format!("kona-mcp-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        Ctx { dir: tickets::dir(&d), project: d, who: "session test".into(), session: "abc12345-0000".into(), role: "backend".into(), roles: vec![] }
    }
    fn note(c: &Ctx, id: &str) -> String {
        std::fs::read_to_string(brain::dir(&c.project).join(format!("{id}.md"))).unwrap_or_default()
    }

    #[test]
    fn a_session_saves_a_note_with_its_source_and_can_save_it_again() {
        let c = ctx("save");
        let said = save_note(&c, &json!({"title": "How deploys work", "kind": "topic", "body": "Deploys run from main.\n\n## Steps\n- push\n- run the script"})).unwrap();
        assert!(said.starts_with("Saved note how-deploys-work"));
        let text = note(&c, "how-deploys-work");
        assert!(text.starts_with("---\ntitle: How deploys work\nkind: topic\ndate: "));
        assert!(text.contains("\nsource: agent\nsession: abc12345-0000\nrole: backend\n---\n# How deploys work\n\nDeploys run from main."));
        let again = save_note(&c, &json!({"title": "How deploys work", "id": "how-deploys-work", "body": "# How deploys work\n\nChanged."})).unwrap();
        assert!(again.starts_with("Updated note how-deploys-work"));
        let text = note(&c, "how-deploys-work");
        assert!(text.contains("Changed.") && !text.contains("# How deploys work\n\n# How deploys work"), "the title heading is not written twice");
        assert!(list_notes(&c, &json!({})).contains("how-deploys-work [note]"));
        assert!(list_notes(&c, &json!({"kind": "decision"})).starts_with("The project's brain has no notes"));
    }

    #[test]
    fn an_open_item_is_marked_open() {
        let c = ctx("open");
        save_note(&c, &json!({"title": "Check the backup", "kind": "open", "body": "Nobody has restored one yet."})).unwrap();
        assert!(note(&c, "check-the-backup").contains("\nstatus: open\n"));
    }

    #[test]
    fn the_owners_notes_and_edited_notes_are_never_changed() {
        let c = ctx("owner");
        let d = brain::dir(&c.project);
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("mine.md"), "---\ntitle: Mine\n---\n# Mine\n").unwrap();
        std::fs::write(d.join("edited.md"), "---\ntitle: Edited\nsource: agent\nedited_by: owner\n---\n# Edited\n").unwrap();
        for id in ["mine", "edited"] {
            let e = save_note(&c, &json!({"title": "X", "id": id, "body": "text"})).unwrap_err();
            assert!(e.contains("already in the brain"), "{e}");
        }
        assert_eq!(note(&c, "mine"), "---\ntitle: Mine\n---\n# Mine\n");
    }

    #[test]
    fn what_cannot_be_saved_says_why() {
        let c = ctx("refuse");
        let no = |v: Value| save_note(&c, &v).unwrap_err();
        assert!(no(json!({"title": "", "body": "x"})).contains("title"));
        assert!(no(json!({"title": "A", "body": "  "})).contains("no text"));
        assert!(no(json!({"title": "A", "body": "---\ntitle: A\n---\nx"})).contains("front matter"));
        assert!(no(json!({"title": "A", "body": "the password: hunter22hunter"})).contains("secret"));
        assert!(no(json!({"title": "A", "body": "x", "kind": "gossip"})).contains("kind is one of"));
        assert!(no(json!({"title": "A", "body": "x", "id": "memory-x"})).contains("memory-"));
        assert!(no(json!({"title": "!!!", "body": "x"})).contains("letters or digits"));
        assert!(no(json!({"title": "A", "body": "x".repeat(61 * 1024)})).contains("60 KB"));
        assert_eq!(slug("  Why: the API's limit (v2)!  "), "why-the-api-s-limit-v2");
    }
}
