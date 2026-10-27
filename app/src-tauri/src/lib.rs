// Kona's core. The screen (React) asks, this program does: it starts and talks to `claude`, keeps the cost ledger,
// and makes sure nothing it started outlives it.
mod job;
mod ledger;
mod session;

use serde::Serialize;
use serde_json::Value;
use session::{ImageIn, Sessions};
use tauri::{AppHandle, Manager, State};

#[derive(Serialize)]
struct ClaudeInfo {
    path: String,
    version: Option<String>,
}

/// Is Claude Code on this PC, and which version? (The first-run checks use this.)
#[tauri::command]
fn check_claude() -> Result<ClaudeInfo, String> {
    let exe = session::find_claude().ok_or("Claude Code was not found on this PC")?;
    let version = session::claude_version(&exe);
    Ok(ClaudeInfo { path: exe.to_string_lossy().into_owned(), version })
}

#[tauri::command]
async fn start_session(app: AppHandle, sessions: State<'_, Sessions>, folder: String, model: String, mode: String, resume: Option<String>) -> Result<String, String> {
    session::start(app, &sessions, folder, model, mode, resume).await
}

#[tauri::command]
fn send_message(sessions: State<'_, Sessions>, session_id: String, text: String, images: Vec<ImageIn>) -> Result<(), String> {
    sessions.send_message(&session_id, &text, &images)
}

#[tauri::command]
fn answer_permission(sessions: State<'_, Sessions>, session_id: String, request_id: String, allow: bool, input: Option<Value>, message: Option<String>) -> Result<(), String> {
    sessions.answer_permission(&session_id, &request_id, allow, input, message)
}

#[tauri::command]
fn stop_session(sessions: State<'_, Sessions>, session_id: String) {
    sessions.stop(&session_id);
}

#[tauri::command]
fn running_sessions(sessions: State<'_, Sessions>) -> Vec<String> {
    sessions.running()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // %APPDATA%\Kona\kona.db (the plan's place for the app's own data)
            let base = app.path().app_data_dir().ok().and_then(|p| p.parent().map(|d| d.join("Kona"))).ok_or("no app data folder")?;
            let ledger = ledger::Ledger::open(&base.join("kona.db")).map_err(|e| format!("could not open the cost ledger: {e}"))?;
            app.manage(Sessions::new(ledger));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![check_claude, start_session, send_message, answer_permission, stop_session, running_sessions])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
