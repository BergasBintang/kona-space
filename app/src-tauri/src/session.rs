// A session is one running `claude` program, talked to over its standard input and output in streaming JSON.
// Kona starts it inside the shared job object (see job.rs), forwards every message it prints to the screen,
// writes each finished turn to the cost ledger, and sends back what the screen says (a message, an answer to
// "may I run this?", a stop).
use crate::ledger::Ledger;
use crate::roles::Role;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
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
}

#[derive(Deserialize)]
pub struct ImageIn {
    pub media_type: String,
    pub data: String, // base64, without the "data:" prefix
}

impl Sessions {
    pub fn new(ledger: Ledger) -> Self {
        Self { map: Mutex::new(HashMap::new()), ledger: Arc::new(ledger) }
    }

    fn send_line(&self, session_id: &str, value: Value) -> Result<(), String> {
        let map = self.map.lock().unwrap();
        let h = map.get(session_id).ok_or("That session is not running any more")?;
        h.tx.send(value.to_string()).map_err(|_| "That session has closed".to_string())
    }

    pub fn send_message(&self, session_id: &str, text: &str, images: &[ImageIn]) -> Result<(), String> {
        let mut content: Vec<Value> = images
            .iter()
            .map(|i| json!({"type": "image", "source": {"type": "base64", "media_type": i.media_type, "data": i.data}}))
            .collect();
        content.push(json!({"type": "text", "text": text}));
        self.send_line(session_id, json!({"type": "user", "message": {"role": "user", "content": content}}))
    }

    /// Answer a "may I run this?" card. `input` is what Claude asked to run, sent back unchanged when allowed.
    pub fn answer_permission(&self, session_id: &str, request_id: &str, allow: bool, input: Option<Value>, message: Option<String>) -> Result<(), String> {
        let body = if allow {
            json!({"behavior": "allow", "updatedInput": input.unwrap_or(json!({}))})
        } else {
            json!({"behavior": "deny", "message": message.unwrap_or_else(|| "The owner said no.".into())})
        };
        self.send_line(
            session_id,
            json!({"type": "control_response", "response": {"subtype": "success", "request_id": request_id, "response": body}}),
        )
    }

    pub fn stop(&self, session_id: &str) {
        if let Some(mut h) = self.map.lock().unwrap().remove(session_id) {
            if let Some(s) = h.stop.take() {
                let _ = s.send(());
            }
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

pub async fn start(app: AppHandle, sessions: &Sessions, folder: String, role: Option<Role>, model: String, mode: String, resume: Option<String>) -> Result<String, String> {
    let exe = find_claude().ok_or("Claude Code was not found on this PC")?;
    let id = resume.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut cmd = Command::new(exe);
    cmd.args([
        "-p", "--output-format", "stream-json", "--input-format", "stream-json", "--include-partial-messages", "--verbose",
        "--permission-prompt-tool", "stdio", "--permission-mode", &mode, "--model", &model,
    ]);
    // the role's brief is added to Claude's own instructions; the mode and model come from the role unless the owner changed them
    if let Some(r) = role.as_ref().filter(|r| !r.brief.trim().is_empty()) {
        cmd.args(["--append-system-prompt", &r.brief]);
    }
    if resume.is_some() {
        cmd.args(["--resume", &id]);
    } else {
        cmd.args(["--session-id", &id]);
    }
    cmd.current_dir(&folder)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .creation_flags(CREATE_NO_WINDOW);
    let mut child = cmd.spawn().map_err(|e| format!("Could not start Claude Code: {e}"))?;
    let covered = child.raw_handle().map(|h| crate::job::adopt(h as _)).unwrap_or(false);

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
        let role_id = role.as_ref().map(|r| r.id.clone());
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(mut rec) = serde_json::from_str::<Value>(&line) else { continue };
                if rec.get("type").and_then(Value::as_str) == Some("result") {
                    let added = ledger.record_result(&sid, &folder, role_id.as_deref(), &rec);
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
        let (app, sid) = (app.clone(), id.clone());
        tauri::async_runtime::spawn(async move {
            let mut child = child;
            let code = tokio::select! {
                status = child.wait() => status.ok().and_then(|s| s.code()),
                _ = stop_rx => { let _ = child.kill().await; None }
            };
            let _ = app.emit("session-event", json!({"sessionId": sid, "record": {"type": "kona/exited", "code": code}}));
        });
    }

    sessions.map.lock().unwrap().insert(id.clone(), Handle { tx, stop: Some(stop_tx) });
    let _ = app.emit("session-event", json!({"sessionId": id, "record": {"type": "kona/started", "folder": folder, "roleId": role.as_ref().map(|r| r.id.clone()), "model": model, "mode": mode, "coveredByJob": covered}}));
    Ok(id)
}
