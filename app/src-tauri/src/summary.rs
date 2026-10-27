// Notes written by Claude Haiku about a finished session (feature F7, step "summarize"). Two small jobs live here:
//   - read a session's transcript (Claude Code's own `.jsonl` file) and boil it down to who said what, one short line per tool call;
//   - run one cheap, tool-less, one-shot `claude -p --model haiku` on a prompt the screen has already cleaned of secrets, and
//     put its dollars in the cost ledger under the session it was about (kind "summary").
// The note itself (its front matter, its links, where it is saved) is made on the screen; this file only reads and runs.
use serde_json::Value;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

const KEEP_HEAD: usize = 5_000;
const KEEP_TAIL: usize = 8_000;

/// Claude Code's folder name for a working folder: every character that is not a letter or digit becomes a dash.
fn slug(p: &str) -> String {
    p.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

fn config_root(account_dir: Option<&str>) -> Option<PathBuf> {
    match account_dir {
        Some(d) => Some(PathBuf::from(d)),
        None => std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(|h| PathBuf::from(h).join(".claude")),
    }
}

/// The transcript file of a session: `<config>\projects\<working folder as dashes>\<session id>.jsonl` (the drive letter's case varies).
fn transcript_path(session_id: &str, work_dir: &str, account_dir: Option<&str>) -> Option<PathBuf> {
    if session_id.len() != 36 || !session_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return None;
    }
    let projects = config_root(account_dir)?.join("projects");
    let want = slug(work_dir).to_lowercase();
    for e in std::fs::read_dir(&projects).ok()?.filter_map(Result::ok) {
        if e.file_name().to_string_lossy().to_lowercase() == want {
            let f = e.path().join(format!("{session_id}.jsonl"));
            if f.is_file() { return Some(f); }
        }
    }
    None
}

fn clip(s: &str, n: usize) -> String {
    let one: String = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if one.chars().count() > n { format!("{}…", one.chars().take(n).collect::<String>()) } else { one }
}

fn tool_line(name: &str, input: &Value) -> String {
    let target = ["file_path", "command", "pattern", "url", "query", "description", "path"].iter().find_map(|k| input.get(*k).and_then(Value::as_str)).unwrap_or("");
    format!("[tool {name}: {}]", clip(target, 90))
}

/// The conversation boiled down: the owner's messages, Claude's replies, and one line per tool call. Tool results are left out (they
/// are long and often hold file contents). A long one keeps its start and its end.
pub fn condensed(session_id: &str, work_dir: &str, account_dir: Option<&str>) -> Result<String, String> {
    let path = transcript_path(session_id, work_dir, account_dir).ok_or("Kona could not find that session's transcript")?;
    let text = std::fs::read_to_string(&path).map_err(|e| format!("Could not read the transcript: {e}"))?;
    let mut out: Vec<String> = vec![];
    for line in text.lines() {
        let Ok(v) = serde_json::from_str::<Value>(line) else { continue };
        if v.get("isSidechain").and_then(Value::as_bool) == Some(true) { continue; }
        let kind = v.get("type").and_then(Value::as_str).unwrap_or("");
        let content = &v["message"]["content"];
        match kind {
            "user" => {
                let t = match content {
                    Value::String(s) => s.clone(),
                    Value::Array(a) => a.iter().filter(|b| b.get("type").and_then(Value::as_str) == Some("text")).filter_map(|b| b.get("text").and_then(Value::as_str)).collect::<Vec<_>>().join(" "),
                    _ => String::new(),
                };
                if !t.trim().is_empty() { out.push(format!("Owner: {}", clip(&t, 1200))); }
            }
            "assistant" => {
                if let Value::Array(a) = content {
                    for b in a {
                        match b.get("type").and_then(Value::as_str) {
                            Some("text") => { let t = b.get("text").and_then(Value::as_str).unwrap_or(""); if !t.trim().is_empty() { out.push(format!("Claude: {}", clip(t, 1500))); } }
                            Some("tool_use") => out.push(tool_line(b.get("name").and_then(Value::as_str).unwrap_or("?"), &b["input"])),
                            _ => {}
                        }
                    }
                }
            }
            _ => {}
        }
    }
    let all = out.join("\n");
    if all.chars().count() <= KEEP_HEAD + KEEP_TAIL {
        return Ok(all);
    }
    let chars: Vec<char> = all.chars().collect();
    let head: String = chars[..KEEP_HEAD].iter().collect();
    let tail: String = chars[chars.len() - KEEP_TAIL..].iter().collect();
    Ok(format!("{head}\n[... the middle of the conversation is left out ...]\n{tail}"))
}

/// Run one cheap one-shot Haiku call. No tools, no tool servers, a neutral working folder, a time limit. Returns the text and the result
/// record (for the ledger).
pub async fn run_haiku(system: &str, prompt: &str, account_dir: Option<&str>) -> Result<(String, Value), String> {
    let exe = crate::session::find_claude().ok_or("Claude Code was not found on this PC")?;
    let mut cmd = Command::new(exe);
    cmd.args(["-p", "--model", "haiku", "--output-format", "json", "--no-session-persistence", "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--system-prompt", system])
        .current_dir(std::env::temp_dir())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .creation_flags(0x0800_0000);
    if let Some(d) = account_dir {
        cmd.env("CLAUDE_CONFIG_DIR", d);
    }
    let mut child = cmd.spawn().map_err(|e| format!("Could not start Claude Code: {e}"))?;
    if let Some(h) = child.raw_handle() {
        crate::job::adopt(h as _);
    }
    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    stdin.write_all(prompt.as_bytes()).await.map_err(|e| e.to_string())?;
    drop(stdin);
    let out = match tokio::time::timeout(std::time::Duration::from_secs(150), child.wait_with_output()).await {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => return Err(e.to_string()),
        Err(_) => return Err("Claude took too long to write the note and was stopped".into()),
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let v: Value = serde_json::from_str(text.trim()).map_err(|_| {
        let err = String::from_utf8_lossy(&out.stderr);
        format!("Claude did not answer as expected. {}", clip(&err, 200))
    })?;
    if v.get("is_error").and_then(Value::as_bool) == Some(true) {
        return Err(clip(v.get("result").and_then(Value::as_str).unwrap_or("Claude stopped with an error"), 300));
    }
    let result = v.get("result").and_then(Value::as_str).unwrap_or("").to_string();
    if result.trim().is_empty() {
        return Err("Claude wrote nothing".into());
    }
    Ok((result, v))
}

