// The built-in tool server for the board (feature F10). Kona starts a session with `--mcp-config` pointing at Kona's own program
// in this mode (`app --mcp-board --folder ... --session ... --role ... --data ...`). Claude Code starts it, talks to it over
// standard input and output (one JSON message per line, the Model Context Protocol), and stops it with the session.
// Because the server is started for one known session, "who raised this ticket" is exact: it is the session id and role given here.
// The server only touches that project's ticket files, through tickets.rs, and an agent can never move a ticket to Done or remove one.
use crate::tickets::{self, NewTicket, Patch, Ticket};
use serde_json::{json, Value};
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};

struct Ctx {
    dir: PathBuf,
    who: String,
    roles: Vec<(String, String)>, // id, name
}

fn arg(args: &[String], name: &str) -> String {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned().unwrap_or_default()
}

fn read_roles(data: &Path) -> Vec<(String, String)> {
    let Ok(text) = std::fs::read_to_string(data.join("roles.json")) else { return vec![] };
    let Ok(v) = serde_json::from_str::<Value>(&text) else { return vec![] };
    v["roles"].as_array().map(|a| a.iter().filter_map(|r| Some((r["id"].as_str()?.to_string(), r["name"].as_str()?.to_string()))).collect()).unwrap_or_default()
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
            "role": {"type": "string", "description": "Which role should do it (for example Frontend). Optional."},
            "status": {"type": "string", "enum": ["backlog", "ready"]}}, "required": ["title"]}},
        {"name": "update_ticket", "description": "Change a ticket: its column (not done), its next step, a note for the history, or whether it waits on the owner. Only the fields you give are changed.",
         "inputSchema": {"type": "object", "properties": {
            "id": {"type": "string"}, "status": status_any, "next": {"type": "string", "description": "One line: what should happen next."},
            "note": {"type": "string", "description": "A short note added to the history."},
            "waiting": {"type": "boolean", "description": "true when you need the owner's answer or decision before going on."},
            "title": {"type": "string"}, "description": {"type": "string"}, "done_when": {"type": "string"}, "role": {"type": "string"}}, "required": ["id"]}}
    ])
}

fn role_id(ctx: &Ctx, given: &str) -> Result<Option<String>, String> {
    let g = given.trim();
    if g.is_empty() {
        return Ok(None);
    }
    ctx.roles.iter().find(|(id, name)| id.eq_ignore_ascii_case(g) || name.eq_ignore_ascii_case(g)).map(|(id, _)| Some(id.clone()))
        .ok_or_else(|| format!("There is no role called {g}. Roles: {}", ctx.roles.iter().map(|r| r.1.as_str()).collect::<Vec<_>>().join(", ")))
}

fn line(ctx: &Ctx, t: &Ticket) -> String {
    let role = t.role.as_ref().and_then(|r| ctx.roles.iter().find(|x| &x.0 == r)).map(|r| r.1.as_str()).unwrap_or("no role");
    format!("{} [{}] {} ({}){}", t.id, t.status, t.title, role, if t.waiting { " - waiting on the owner" } else { "" })
}

fn full(ctx: &Ctx, t: &Ticket) -> String {
    let mut s = format!("{}\nStatus: {}\nRole: {}\nRaised by: {}\nNext: {}\nWaiting on the owner: {}\n", line(ctx, t), t.status,
        t.role.as_ref().and_then(|r| ctx.roles.iter().find(|x| &x.0 == r)).map(|r| r.1.as_str()).unwrap_or("none"), t.raised_by, if t.next.is_empty() { "-" } else { &t.next }, if t.waiting { "yes" } else { "no" });
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
            let list: Vec<String> = tickets::list(&ctx.dir).iter().filter(|t| only.as_ref().map_or(true, |s| &t.status == s)).map(|t| line(ctx, t)).collect();
            Ok(if list.is_empty() { "No tickets.".into() } else { list.join("\n") })
        }
        "get_ticket" => Ok(full(ctx, &tickets::get(&ctx.dir, &text_of(a, "id").unwrap_or_default())?)),
        "create_ticket" => {
            let status = text_of(a, "status");
            if status.as_deref().map_or(false, |s| s != "backlog" && s != "ready") {
                return Err("A new ticket can only start in backlog or ready".into());
            }
            let role = role_id(ctx, &text_of(a, "role").unwrap_or_default())?;
            let t = tickets::create(&ctx.dir, NewTicket { title: text_of(a, "title").unwrap_or_default(), description: text_of(a, "description").unwrap_or_default(), acceptance: text_of(a, "done_when").unwrap_or_default(), role, status, next: String::new(), own_copy: None }, &ctx.who)?;
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
                next: text_of(a, "next"), waiting: a.get("waiting").and_then(Value::as_bool), note: text_of(a, "note"), own_copy: None,
            }, &ctx.who)?;
            Ok(format!("Updated. {}", line(ctx, &t)))
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
    let roles = read_roles(Path::new(&arg(args, "--data")));
    let role_name = roles.iter().find(|r| r.0 == role).map(|r| r.1.clone());
    let who = format!("session {}{}", &session[..session.len().min(8)], role_name.map(|n| format!(" (role: {n})")).unwrap_or_default());
    let ctx = Ctx { dir: tickets::dir(Path::new(&folder)), who, roles };
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
