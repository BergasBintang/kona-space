// A session is one running `claude` program, talked to over its standard input and output in streaming JSON.
// Kona starts it inside the shared job object (see job.rs), forwards every message it prints to the screen,
// writes each finished turn to the cost ledger, and sends back what the screen says (a message, an answer to
// "may I run this?", a stop).
use crate::ledger::Ledger;
use crate::accounts::Account;
use crate::persona::Persona;
use crate::roles::Role;
use crate::tickets::{self, Ticket};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

struct Handle {
    tx: mpsc::UnboundedSender<String>,
    stop: Option<oneshot::Sender<()>>,
}

pub struct Sessions {
    map: Mutex<HashMap<String, Handle>>,
    pub ledger: Arc<Ledger>,
    /// what each session started and what is still alive after it ended
    pub tracker: Arc<crate::leftovers::Tracker>,
}

#[derive(Deserialize)]
pub struct ImageIn {
    pub media_type: String,
    pub data: String, // base64, without the "data:" prefix
}

impl Sessions {
    pub fn new(ledger: Ledger, tracker: Arc<crate::leftovers::Tracker>) -> Self {
        Self { map: Mutex::new(HashMap::new()), ledger: Arc::new(ledger), tracker }
    }

    fn send_line(&self, session_id: &str, value: Value) -> Result<(), String> {
        let map = self.map.lock().unwrap();
        let h = map.get(session_id).ok_or("That session is not running any more")?;
        h.tx.send(value.to_string()).map_err(|_| "That session has closed".to_string())
    }

    pub fn send_message(&self, session_id: &str, text: &str, images: &[ImageIn]) -> Result<(), String> {
        // a private key must never travel through a prompt, a transcript or the brain
        if text.contains("PRIVATE KEY-----") {
            return Err("Kona did not send this message: it contains the text of a private key. Keys stay in their files; give Claude the path, never the key.".into());
        }
        let mut content: Vec<Value> = images
            .iter()
            .map(|i| json!({"type": "image", "source": {"type": "base64", "media_type": i.media_type, "data": i.data}}))
            .collect();
        content.push(json!({"type": "text", "text": text}));
        self.send_line(session_id, json!({"type": "user", "message": {"role": "user", "content": content}}))
    }

    /// Answer a "may I run this?" card. `input` is what Claude asked to run, sent back unchanged when allowed.
    pub fn answer_permission(&self, session_id: &str, request_id: &str, allow: bool, input: Option<Value>, message: Option<String>, remember: Option<Value>) -> Result<(), String> {
        let body = if allow {
            let mut b = json!({"behavior": "allow", "updatedInput": input.unwrap_or(json!({}))});
            // "Always allow here": Claude Code offered rules to remember with this question; handing them back makes it keep them (in the project's local settings)
            if let Some(r) = remember { b["updatedPermissions"] = r; }
            b
        } else {
            json!({"behavior": "deny", "message": message.unwrap_or_else(|| "The owner said no.".into())})
        };
        self.send_line(
            session_id,
            json!({"type": "control_response", "response": {"subtype": "success", "request_id": request_id, "response": body}}),
        )
    }

    pub fn stop(&self, session_id: &str) {
        if let Some(mut h) = self.map.lock().unwrap().remove(session_id)
            && let Some(s) = h.stop.take() {
                let _ = s.send(());
            }
    }

    pub fn running(&self) -> Vec<String> {
        self.map.lock().unwrap().keys().cloned().collect()
    }
}

/// The real program behind the `claude` command. npm leaves a small `.cmd` shim in the PATH; the program is next to it.
pub fn find_claude() -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let exe = dir.join("claude.exe");
        if exe.is_file() {
            return Some(exe);
        }
        if dir.join("claude.cmd").is_file() {
            let native = dir.join("node_modules").join("@anthropic-ai").join("claude-code").join("bin").join("claude.exe");
            if native.is_file() {
                return Some(native);
            }
        }
    }
    None
}

pub fn claude_version(exe: &PathBuf) -> Option<String> {
    use std::os::windows::process::CommandExt;
    let out = std::process::Command::new(exe).arg("--version").creation_flags(CREATE_NO_WINDOW).output().ok()?;
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

pub async fn start(app: AppHandle, sessions: &Sessions, folder: String, role: Option<Role>, account: Option<Account>, persona: Persona, project_name: String, ticket: Option<Ticket>, work_dir: String, digest: Option<String>, ssh_hosts: Vec<crate::ssh::Host>, model: String, mode: String, resume: Option<String>) -> Result<String, String> {
    let exe = find_claude().ok_or("Claude Code was not found on this PC")?;
    // each `claude` program takes about 400 MB; on this PC two at once is the limit (a setting)
    let cap = app.try_state::<crate::backup::SettingsStore>().map(|s| s.get().max_sessions).unwrap_or(2) as usize;
    if sessions.running().len() >= cap {
        return Err(format!("{cap} sessions are already open. Stop one first: each uses about 400 MB of this PC's memory. (You can change the limit in Settings.)"));
    }
    let id = resume.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut cmd = Command::new(exe);
    cmd.args([
        "-p", "--output-format", "stream-json", "--input-format", "stream-json", "--include-partial-messages", "--verbose",
        "--permission-prompt-tool", "stdio", "--permission-mode", &mode, "--model", &model,
    ]);
    // the role's brief is added to Claude's own instructions; the mode and model come from the role unless the owner changed them
    // and the voice, when it is on for this session (it changes wording only; see persona.rs for the scope clause)
    let extra: Vec<String> = role.as_ref().map(|r| r.brief.trim().to_string()).filter(|b| !b.is_empty()).into_iter().chain(ticket.as_ref().map(tickets::prompt_for)).chain(digest.filter(|d| !d.trim().is_empty())).chain(persona.prompt()).collect();
    if !extra.is_empty() {
        cmd.args(["--append-system-prompt", &extra.join("\n\n")]);
    }
    // the board's tool server: Kona's own program, started by Claude Code for this one session (see mcp.rs)
    if let Ok(me) = std::env::current_exe() {
        let config = json!({"mcpServers": {"kona-board": {"command": me.to_string_lossy(), "args": [
            "--mcp-board", "--folder", folder, "--session", id, "--role", role.as_ref().map(|r| r.id.as_str()).unwrap_or("")
        ]}}});
        cmd.args(["--mcp-config", &config.to_string(), "--allowedTools", "mcp__kona-board"]);
    }
    // a role that may use none of the project's servers cannot run ssh, scp or sftp at all (and a role that may is checked per command below)
    let denied = crate::ssh::deny_rules(&ssh_hosts, role.as_ref().map(|r| r.id.as_str()));
    if !denied.is_empty() {
        cmd.arg("--disallowedTools").args(&denied);
    } else if !ssh_hosts.is_empty() {
        // a role that may use a server: each command to a server must still ask, so Kona can check it and show the card
        cmd.args(["--settings", &json!({"permissions": {"ask": crate::ssh::ask_rules()}}).to_string()]);
    }
    if resume.is_some() {
        cmd.args(["--resume", &id]);
    } else {
        cmd.args(["--session-id", &id]);
    }
    // each account is its own login folder, chosen here; Main keeps Claude Code's usual one
    if let Some(dir) = account.as_ref().and_then(|a| a.config_dir.as_ref()) {
        cmd.env("CLAUDE_CONFIG_DIR", dir);
    }
    cmd.current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .creation_flags(CREATE_NO_WINDOW);
    let mut child = cmd.spawn().map_err(|e| format!("Could not start Claude Code: {e}"))?;
    let covered = child.raw_handle().map(|h| crate::job::adopt(h as _)).unwrap_or(false);

    sessions.tracker.register(&id, child.id().unwrap_or(0));
    if resume.is_some() { sessions.ledger.seed_resume(&id); }
    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let (stop_tx, stop_rx) = oneshot::channel::<()>();

    tauri::async_runtime::spawn(async move {
        while let Some(line) = rx.recv().await {
            if stdin.write_all(line.as_bytes()).await.is_err() || stdin.write_all(b"\n").await.is_err() || stdin.flush().await.is_err() {
                break;
            }
        }
    });

    {
        let (app, sid, folder, ledger) = (app.clone(), id.clone(), folder.clone(), sessions.ledger.clone());
        let reply_tx = tx.clone();
        let (ssh_hosts, ssh_role) = (ssh_hosts.clone(), role.as_ref().map(|r| r.id.clone()));
        let role_id = role.as_ref().map(|r| r.id.clone());
        let account_id = account.as_ref().map(|a| a.id.clone());
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(mut rec) = serde_json::from_str::<Value>(&line) else { continue };
                // The board's own tools are allowed without a card: they only touch this project's ticket files and can never mark a
                // ticket done (see mcp.rs). Plan mode would otherwise ask before every ticket the Product role raises.
                if rec.get("type").and_then(Value::as_str) == Some("control_request")
                    && rec["request"]["subtype"].as_str() == Some("can_use_tool")
                    && rec["request"]["tool_name"].as_str().is_some_and(|n| n.starts_with("mcp__kona-board__"))
                {
                    let reply = json!({"type": "control_response", "response": {"subtype": "success", "request_id": rec["request_id"],
                        "response": {"behavior": "allow", "updatedInput": rec["request"]["input"]}}});
                    let _ = reply_tx.send(reply.to_string());
                    continue;
                }
                // a command that reaches a server (ssh, scp, sftp): refused unless the project lists that server for this role; an allowed
                // one still reaches the owner as a card that names the server
                if rec.get("type").and_then(Value::as_str) == Some("control_request")
                    && rec["request"]["subtype"].as_str() == Some("can_use_tool")
                    && matches!(rec["request"]["tool_name"].as_str(), Some("Bash") | Some("PowerShell"))
                {
                    let command = rec["request"]["input"]["command"].as_str().unwrap_or("").to_string();
                    match crate::ssh::decide(&ssh_hosts, ssh_role.as_deref(), &command) {
                        crate::ssh::Decision::NotSsh => {}
                        crate::ssh::Decision::Deny(why) => {
                            let reply = json!({"type": "control_response", "response": {"subtype": "success", "request_id": rec["request_id"],
                                "response": {"behavior": "deny", "message": why}}});
                            let _ = reply_tx.send(reply.to_string());
                            let _ = app.emit("session-event", json!({"sessionId": sid, "record": {"type": "kona/refused", "command": command, "why": why}}));
                            continue;
                        }
                        crate::ssh::Decision::Ask(hosts) => {
                            rec["kona_ssh"] = json!(hosts.iter().map(|h| json!({"label": h.label, "host": h.host, "user": h.user, "checked": !h.fingerprints.is_empty()})).collect::<Vec<_>>());
                        }
                    }
                }
                if rec.get("type").and_then(Value::as_str) == Some("result") {
                    let added = ledger.record_result(&sid, &folder, role_id.as_deref(), account_id.as_deref(), &rec);
                    rec["kona_turn_cost_usd"] = json!(added);
                }
                let _ = app.emit("session-event", json!({"sessionId": sid, "record": rec}));
            }
        });
    }
    {
        let (app, sid) = (app.clone(), id.clone());
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit("session-event", json!({"sessionId": sid, "record": {"type": "kona/stderr", "text": line}}));
            }
        });
    }
    {
        let (app, sid, tracker) = (app.clone(), id.clone(), sessions.tracker.clone());
        tauri::async_runtime::spawn(async move {
            let mut child = child;
            let code = tokio::select! {
                status = child.wait() => status.ok().and_then(|s| s.code()),
                _ = stop_rx => { let _ = child.kill().await; None }
            };
            // a session that has ended no longer counts against the limit
            if let Some(s) = app.try_state::<Sessions>() { s.map.lock().unwrap().remove(&sid); }
            // look at once what the session leaves behind
            { let (t, s) = (tracker.clone(), sid.clone()); let _ = tauri::async_runtime::spawn_blocking(move || t.ended(&s)).await; }
            let _ = app.emit("session-event", json!({"sessionId": sid, "record": {"type": "kona/exited", "code": code}}));
        });
    }

    sessions.map.lock().unwrap().insert(id.clone(), Handle { tx, stop: Some(stop_tx) });
    let _ = app.emit("session-event", json!({"sessionId": id, "record": {"type": "kona/started", "folder": folder, "roleId": role.as_ref().map(|r| r.id.clone()), "accountId": account.as_ref().map(|a| a.id.clone()), "resumed": resume.is_some(), "voice": persona.enabled, "ticketId": ticket.as_ref().map(|t| t.id.clone()), "workDir": work_dir, "lines": persona.lines_for(&project_name), "model": model, "mode": mode, "coveredByJob": covered}}));
    Ok(id)
}
