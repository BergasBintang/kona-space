// Kona's core. The screen (React) asks, this program does: it starts and talks to `claude`, keeps the cost ledger,
// and makes sure nothing it started outlives it.
mod accounts;
mod files;
mod job;
mod mcp;
mod needs;
mod persona;
mod ledger;
mod projects;
mod roles;
mod session;
mod tickets;
mod worktrees;

use serde::Serialize;
use serde_json::Value;
use accounts::{Account, AccountStatus, Accounts};
use files::{Entry, FileView};
use projects::{AddResult, Project, Projects};
use persona::{Persona, Voice};
use roles::{Role, Roles};
use session::{ImageIn, Sessions};
use tickets::{NewTicket, Patch, Ticket};
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
async fn start_session(app: AppHandle, sessions: State<'_, Sessions>, roles: State<'_, Roles>, accounts: State<'_, Accounts>, voice: State<'_, Voice>, projects: State<'_, Projects>, folder: String, role_id: Option<String>, account_id: Option<String>, use_voice: bool, ticket_id: Option<String>, model: String, mode: String, resume: Option<String>) -> Result<String, String> {
    let role = match role_id {
        Some(id) => Some(roles.get(&id).ok_or("That role does not exist any more")?),
        None => None,
    };
    let account = match account_id {
        Some(id) => Some(accounts.get(&id).ok_or("That account does not exist any more")?),
        None => None,
    };
    let mut persona = voice.get();
    persona.enabled = use_voice;
    let project_name = projects.all().into_iter().find(|p| projects::norm(std::path::Path::new(&p.folder)) == projects::norm(std::path::Path::new(&folder))).map(|p| p.name)
        .unwrap_or_else(|| std::path::Path::new(&folder).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default());
    let who = format!("the owner{}", role.as_ref().map(|r| format!(", as {}", r.name)).unwrap_or_default());
    let tdir = tickets::dir(std::path::Path::new(&folder));
    let mut work_dir = folder.clone();
    let ticket = match &ticket_id {
        Some(id) => {
            let t = tickets::get(&tdir, id)?;
            // does this ticket work in its own copy of the repo? (its own choice, else the role's setting)
            let want = match t.own_copy.as_str() { "yes" => true, "no" => false, _ => role.as_ref().is_some_and(|r| r.own_copy) };
            if want {
                match worktrees::ensure(std::path::Path::new(&folder), &t.id, &t.title) {
                    Ok(c) => {
                        let p = c.path.to_string_lossy().to_string();
                        work_dir = p.clone();
                        Some(tickets::set_worktree(&tdir, id, &c.branch, &p, &who)?)
                    }
                    // the owner asked for an own copy: say why not. Left to the role's setting: work in the main folder and note it.
                    Err(e) if t.own_copy == "yes" => return Err(e),
                    Err(e) => {
                        let _ = tickets::update(&tdir, id, tickets::Patch { note: Some(format!("no own copy, working in the main folder: {e}")), ..Default::default() }, "Kona");
                        Some(t)
                    }
                }
            } else if !t.worktree.is_empty() && std::path::Path::new(&t.worktree).exists() {
                // an earlier session made a copy: keep working there
                work_dir = t.worktree.clone();
                Some(t)
            } else {
                Some(t)
            }
        }
        None => None,
    };
    let id = session::start(app, &sessions, folder.clone(), role, account, persona, project_name, ticket, work_dir, model, mode, resume).await?;
    if let Some(t) = ticket_id {
        let _ = tickets::link_session(&tickets::dir(std::path::Path::new(&folder)), &t, &id, &who);
    }
    Ok(id)
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

/// What the sessions cost, summed per session, model and day, from a day on (or everything).
#[tauri::command]
fn cost_rows(sessions: State<'_, Sessions>, since_day: Option<String>) -> Vec<ledger::CostRow> {
    sessions.ledger.cost_rows(since_day.as_deref())
}

/// The tools Kona knows how to look for.
#[tauri::command]
fn list_tools() -> Vec<needs::ToolInfo> {
    needs::catalog()
}

/// Is each of these tools installed on this PC? Looks only; installs nothing.
#[tauri::command]
async fn check_tools(ids: Vec<String>) -> Result<Vec<needs::ToolStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || needs::check(&ids)).await.map_err(|e| e.to_string())
}

/// What the files in a project folder suggest it needs.
#[tauri::command]
fn project_hints(projects: State<'_, Projects>, folder: String) -> Result<Vec<needs::Hint>, String> {
    let path = std::path::Path::new(&folder);
    if !projects.allows(path) {
        return Err("That folder is not inside a project".into());
    }
    Ok(needs::hints(path))
}

/// The voice (persona). `lines` are the words for Kona's own screens, ready to show.
#[tauri::command]
fn get_persona(voice: State<'_, Voice>) -> Persona {
    voice.get()
}

#[tauri::command]
fn save_persona(voice: State<'_, Voice>, persona: Persona) -> Result<Persona, String> {
    voice.set(persona)
}

/// What the voice would send to Claude, so the owner can read it before trusting it.
#[tauri::command]
fn persona_prompt(persona: Persona) -> String {
    Persona { enabled: true, ..persona }.prompt().unwrap_or_default()
}

#[tauri::command]
fn default_persona() -> Persona {
    persona::default_persona()
}

/// A ticket with what its sessions have cost so far.
#[derive(serde::Serialize)]
struct TicketView {
    #[serde(flatten)]
    ticket: Ticket,
    cost: f64,
}

fn project_dir(projects: &Projects, id: &str) -> Result<std::path::PathBuf, String> {
    let p = projects.all().into_iter().find(|p| p.id == id).ok_or("That project does not exist any more")?;
    Ok(tickets::dir(std::path::Path::new(&p.folder)))
}

#[tauri::command]
fn list_tickets(projects: State<'_, Projects>, sessions: State<'_, Sessions>, project_id: String) -> Result<Vec<TicketView>, String> {
    let dir = project_dir(&projects, &project_id)?;
    Ok(tickets::list(&dir).into_iter().map(|t| { let cost = sessions.ledger.cost_for_sessions(&t.sessions); TicketView { ticket: t, cost } }).collect())
}

#[tauri::command]
fn create_ticket(projects: State<'_, Projects>, project_id: String, new: NewTicket) -> Result<Ticket, String> {
    tickets::create(&project_dir(&projects, &project_id)?, new, "the owner")
}

#[tauri::command]
fn update_ticket(projects: State<'_, Projects>, project_id: String, id: String, patch: Patch) -> Result<Ticket, String> {
    tickets::update(&project_dir(&projects, &project_id)?, &id, patch, "the owner")
}

/// Remove a ticket's file. The sessions it ran and what they cost stay in the ledger.
#[tauri::command]
fn remove_ticket(projects: State<'_, Projects>, project_id: String, id: String) -> Result<(), String> {
    tickets::remove(&project_dir(&projects, &project_id)?, &id)
}

/// Where a ticket's own copy stands: its branch, commits ahead or behind the main folder's branch, files changed and not committed.
#[tauri::command]
fn worktree_status(projects: State<'_, Projects>, project_id: String, ticket_id: String) -> Result<worktrees::Status, String> {
    let project = projects.all().into_iter().find(|p| p.id == project_id).ok_or("That project does not exist any more")?;
    let t = tickets::get(&tickets::dir(std::path::Path::new(&project.folder)), &ticket_id)?;
    if t.worktree.is_empty() {
        return Ok(worktrees::Status::default());
    }
    Ok(worktrees::status(std::path::Path::new(&project.folder), std::path::Path::new(&t.worktree), &t.branch))
}

/// One line of the worktree graph, with the ticket that owns the copy (if any).
#[derive(serde::Serialize)]
struct WorktreeView {
    #[serde(flatten)]
    info: worktrees::Info,
    ticket_id: Option<String>,
    ticket_title: Option<String>,
}

fn project_path(projects: &Projects, id: &str) -> Result<std::path::PathBuf, String> {
    projects.all().into_iter().find(|p| p.id == id).map(|p| std::path::PathBuf::from(p.folder)).ok_or_else(|| "That project does not exist any more".to_string())
}

#[tauri::command]
async fn worktree_overview(projects: State<'_, Projects>, project_id: String) -> Result<Vec<WorktreeView>, String> {
    let folder = project_path(&projects, &project_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        if !worktrees::is_repo(&folder) {
            return Err("This project is not a Git repository".to_string());
        }
        let tix = tickets::list(&tickets::dir(&folder));
        Ok(worktrees::overview(&folder)?.into_iter().map(|info| {
            let t = tix.iter().find(|t| !t.worktree.is_empty() && worktrees::norm(&t.worktree) == worktrees::norm(&info.path));
            WorktreeView { ticket_id: t.map(|t| t.id.clone()), ticket_title: t.map(|t| t.title.clone()), info }
        }).collect())
    }).await.map_err(|e| e.to_string())?
}

/// Merge a copy's branch into the main folder's branch. Changes the owner's main folder, so the screen asks first.
#[tauri::command]
async fn worktree_merge(projects: State<'_, Projects>, project_id: String, path: String) -> Result<String, String> {
    let folder = project_path(&projects, &project_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let tix = tickets::list(&tickets::dir(&folder));
        let t = tix.iter().find(|t| !t.worktree.is_empty() && worktrees::norm(&t.worktree) == worktrees::norm(&path)).cloned();
        let label = t.as_ref().map(|t| format!("{}: {}", t.id, t.title)).unwrap_or_default();
        let msg = worktrees::merge(&folder, &path, &label)?;
        if let Some(t) = t {
            let _ = tickets::update(&tickets::dir(&folder), &t.id, tickets::Patch { note: Some(msg.clone()), ..Default::default() }, "the owner");
        }
        Ok(msg)
    }).await.map_err(|e| e.to_string())?
}

/// Remove a copy's folder (and its branch when that is safe). `discard` throws away changes and unmerged commits.
#[tauri::command]
async fn worktree_remove(projects: State<'_, Projects>, project_id: String, path: String, discard: bool) -> Result<String, String> {
    let folder = project_path(&projects, &project_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let tix = tickets::list(&tickets::dir(&folder));
        let t = tix.iter().find(|t| !t.worktree.is_empty() && worktrees::norm(&t.worktree) == worktrees::norm(&path)).cloned();
        let msg = worktrees::remove(&folder, &path, discard)?;
        if let Some(t) = t {
            // the ticket no longer has a copy; a later session may make a new one
            let _ = tickets::clear_worktree(&tickets::dir(&folder), &t.id, &msg);
        }
        Ok(msg)
    }).await.map_err(|e| e.to_string())?
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

/// Run as the board's tool server (see mcp.rs) instead of opening the window.
pub fn mcp_board(args: &[String]) {
    mcp::run(args);
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
            app.manage(Sessions::new(ledger, base.clone()));
            app.manage(Projects::load(&base));
            app.manage(Roles::load(&base));
            app.manage(Accounts::load(&base));
            app.manage(Voice::load(&base));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![check_claude, start_session, send_message, answer_permission, stop_session, running_sessions, list_projects, add_project, remove_project, cost_rows, worktree_status, worktree_overview, worktree_merge, worktree_remove, list_tickets, create_ticket, update_ticket, remove_ticket, get_persona, save_persona, persona_prompt, default_persona, list_tools, check_tools, project_hints, list_roles, save_role, remove_role, list_accounts, add_account, rename_account, remove_account, account_status, sign_in_account, list_dir, read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
