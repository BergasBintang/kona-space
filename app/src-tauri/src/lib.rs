// Kona's core. The screen (React) asks, this program does: it starts and talks to `claude`, keeps the cost ledger,
// and makes sure nothing it started outlives it.
mod accounts;
mod files;
mod job;
mod ledger;
mod projects;
mod roles;
mod session;

use serde::Serialize;
use serde_json::Value;
use accounts::{Account, AccountStatus, Accounts};
use files::{Entry, FileView};
use projects::{AddResult, Project, Projects};
use roles::{Role, Roles};
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
async fn start_session(app: AppHandle, sessions: State<'_, Sessions>, roles: State<'_, Roles>, accounts: State<'_, Accounts>, folder: String, role_id: Option<String>, account_id: Option<String>, model: String, mode: String, resume: Option<String>) -> Result<String, String> {
    let role = match role_id {
        Some(id) => Some(roles.get(&id).ok_or("That role does not exist any more")?),
        None => None,
    };
    let account = match account_id {
        Some(id) => Some(accounts.get(&id).ok_or("That account does not exist any more")?),
        None => None,
    };
    session::start(app, &sessions, folder, role, account, model, mode, resume).await
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
fn list_projects(projects: State<'_, Projects>) -> Vec<Project> {
    projects.all()
}

#[tauri::command]
fn add_project(projects: State<'_, Projects>, folder: String, name: Option<String>) -> Result<AddResult, String> {
    projects.add(&folder, name)
}

/// Forget a project. Its files are never touched.
#[tauri::command]
fn remove_project(projects: State<'_, Projects>, id: String) -> Result<(), String> {
    projects.remove(&id)
}

#[tauri::command]
fn list_roles(roles: State<'_, Roles>) -> Vec<Role> {
    roles.all()
}

/// Add a role (empty id) or change one.
#[tauri::command]
fn save_role(roles: State<'_, Roles>, role: Role) -> Result<Role, String> {
    roles.save_role(role)
}

#[tauri::command]
fn remove_role(roles: State<'_, Roles>, id: String) -> Result<(), String> {
    roles.remove(&id)
}

#[tauri::command]
fn list_accounts(accounts: State<'_, Accounts>) -> Vec<Account> {
    accounts.all()
}

#[tauri::command]
fn add_account(accounts: State<'_, Accounts>, label: String) -> Result<Account, String> {
    accounts.add(&label)
}

#[tauri::command]
fn rename_account(accounts: State<'_, Accounts>, id: String, label: String) -> Result<Account, String> {
    accounts.rename(&id, &label)
}

/// Forget an account. Its folder is left where it is.
#[tauri::command]
fn remove_account(accounts: State<'_, Accounts>, id: String) -> Result<(), String> {
    accounts.remove(&id)
}

/// Is this account signed in? Asks Claude Code; saves nothing.
#[tauri::command]
async fn account_status(accounts: State<'_, Accounts>, id: String) -> Result<AccountStatus, String> {
    let account = accounts.get(&id).ok_or("That account does not exist")?;
    tauri::async_runtime::spawn_blocking(move || accounts::status(&account)).await.map_err(|e| e.to_string())
}

/// Open the sign-in page for this account's folder and wait until it is done.
#[tauri::command]
async fn sign_in_account(accounts: State<'_, Accounts>, id: String) -> Result<(), String> {
    let account = accounts.get(&id).ok_or("That account does not exist")?;
    accounts::sign_in(account).await
}

#[tauri::command]
fn list_dir(projects: State<'_, Projects>, path: String) -> Result<Vec<Entry>, String> {
    files::list_dir(&projects, &path)
}

#[tauri::command]
fn read_file(projects: State<'_, Projects>, path: String) -> Result<FileView, String> {
    files::read_file(&projects, &path)
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
            app.manage(Projects::load(&base));
            app.manage(Roles::load(&base));
            app.manage(Accounts::load(&base));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![check_claude, start_session, send_message, answer_permission, stop_session, running_sessions, list_projects, add_project, remove_project, list_roles, save_role, remove_role, list_accounts, add_account, rename_account, remove_account, account_status, sign_in_account, list_dir, read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
