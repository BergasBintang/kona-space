// Kona's core. The screen (React) asks, this program does: it starts and talks to `claude`, keeps the cost ledger,
// and makes sure nothing it started outlives it.
mod accounts;
mod backup;
mod brain;
mod brain_search;
mod files;
mod job;
mod leftovers;
mod mcp;
mod needs;
mod persona;
mod ledger;
mod projects;
mod roles;
mod skills;
mod workflows;
mod session;
mod ssh;
mod summary;
mod tickets;
mod winproc;
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

/// What the screen may ask a session to start with. A mode that skips the permission checks, a model name that is really an option for the
/// program, a resume id that is not a session id, or a folder that is not a project are all refused here, whatever the screen sends.
fn check_launch(mode: &str, model: &str, resume: Option<&str>) -> Result<(), String> {
    if !["default", "acceptEdits", "plan"].contains(&mode) {
        return Err("That permission mode is not one Kona offers".into());
    }
    let model_ok = !model.is_empty() && model.len() <= 60 && model.chars().next().is_some_and(|c| c.is_ascii_alphanumeric()) && model.chars().all(|c| c.is_ascii_alphanumeric() || ".-_[]".contains(c));
    if !model_ok {
        return Err("That model name is not valid".into());
    }
    if let Some(r) = resume
        && (r.len() != 36 || !r.chars().all(|c| c.is_ascii_hexdigit() || c == '-')) {
            return Err("That is not a session id".into());
        }
    Ok(())
}

#[tauri::command]
async fn start_session(app: AppHandle, sessions: State<'_, Sessions>, roles: State<'_, Roles>, accounts: State<'_, Accounts>, voice: State<'_, Voice>, projects: State<'_, Projects>, folder: String, role_id: Option<String>, account_id: Option<String>, use_voice: bool, ticket_id: Option<String>, brain_digest: Option<String>, servers: State<'_, ssh::Servers>, model: String, mode: String, resume: Option<String>) -> Result<String, String> {
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
    let ssh_hosts = projects.all().into_iter().find(|p| projects::norm(std::path::Path::new(&p.folder)) == projects::norm(std::path::Path::new(&folder))).map(|p| servers.for_project(&p.id)).unwrap_or_default();
    check_launch(&mode, &model, resume.as_deref())?;
    if !projects.allows(std::path::Path::new(&folder)) {
        return Err("That folder is not inside a project".into());
    }
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
    // what this role may load in this project: only the skills and connectors chosen for it here (decisions 50 and 51)
    let kit = match &role {
        Some(r) => skills::kit_for(r, account.as_ref().and_then(|a| a.config_dir.as_deref()), std::path::Path::new(&folder))?,
        None => skills::Kit::default(),
    };
    let id = session::start(app, &sessions, folder.clone(), role, account, persona, project_name, ticket, work_dir, brain_digest, ssh_hosts, kit, model, mode, resume).await?;
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
fn answer_permission(sessions: State<'_, Sessions>, session_id: String, request_id: String, allow: bool, input: Option<Value>, message: Option<String>, remember: Option<Value>) -> Result<(), String> {
    sessions.answer_permission(&session_id, &request_id, allow, input, message, remember)
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
fn add_project(projects: State<'_, Projects>, accounts: State<'_, Accounts>, folder: String, name: Option<String>, github: Option<String>, account: Option<String>) -> Result<AddResult, String> {
    if let Some(a) = account.as_deref().map(str::trim).filter(|a| !a.is_empty()) && accounts.get(a).is_none() { return Err("That account does not exist".into()); }
    let r = projects.add(&folder, name, account)?;
    match github.filter(|g| !g.trim().is_empty()) {
        Some(g) => match projects.set_github(&r.project.id, &g) {
            Ok(p) => Ok(AddResult { project: p, ..r }),
            Err(e) => { let _ = projects.remove(&r.project.id); Err(e) }
        },
        None => Ok(r),
    }
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
    /// programs started by this ticket's sessions that are still alive
    running: u32,
}

fn project_path(projects: &Projects, id: &str) -> Result<std::path::PathBuf, String> {
    projects.all().into_iter().find(|p| p.id == id).map(|p| std::path::PathBuf::from(p.folder)).ok_or_else(|| "That project does not exist any more".to_string())
}

#[tauri::command]
async fn worktree_overview(projects: State<'_, Projects>, tracker: State<'_, std::sync::Arc<leftovers::Tracker>>, project_id: String) -> Result<Vec<WorktreeView>, String> {
    let folder = project_path(&projects, &project_id)?;
    let tracker = tracker.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        if !worktrees::is_repo(&folder) {
            return Err("This project is not a Git repository".to_string());
        }
        let tix = tickets::list(&tickets::dir(&folder));
        Ok(worktrees::overview(&folder)?.into_iter().map(|info| {
            let t = tix.iter().find(|t| !t.worktree.is_empty() && worktrees::norm(&t.worktree) == worktrees::norm(&info.path));
            let running = t.map(|t| tracker.alive_for(&t.sessions)).unwrap_or(0);
            WorktreeView { ticket_id: t.map(|t| t.id.clone()), ticket_title: t.map(|t| t.title.clone()), running, info }
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

/// What sessions started, what is alive, and what was left behind by sessions that ended.
#[tauri::command]
fn leftovers(tracker: State<'_, std::sync::Arc<leftovers::Tracker>>) -> leftovers::Overview {
    tracker.overview()
}

/// Stop one program from the list (the screen has asked the owner first).
#[tauri::command]
async fn leftover_stop(tracker: State<'_, std::sync::Arc<leftovers::Tracker>>, key: String) -> Result<String, String> {
    let t = tracker.inner().clone();
    tauri::async_runtime::spawn_blocking(move || t.stop(&key)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn leftover_ignore(tracker: State<'_, std::sync::Arc<leftovers::Tracker>>, key: String) -> Result<(), String> {
    tracker.ignore(&key)
}

/// Size of Claude's scratch folder for each of these sessions.
#[tauri::command]
async fn session_temp(session_ids: Vec<String>) -> Result<Vec<leftovers::TempInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || leftovers::temp_for(&session_ids)).await.map_err(|e| e.to_string())
}

/// Delete a finished session's scratch folder (the screen has asked the owner first).
#[tauri::command]
async fn session_temp_clean(tracker: State<'_, std::sync::Arc<leftovers::Tracker>>, session_id: String) -> Result<String, String> {
    let t = tracker.inner().clone();
    tauri::async_runtime::spawn_blocking(move || leftovers::clean_temp(&t, &session_id)).await.map_err(|e| e.to_string())?
}

/// The notes of a project's brain: its own notes and Claude's memory for the project (read only).
#[tauri::command]
fn brain_load(projects: State<'_, Projects>, project_id: String) -> Result<brain::BrainData, String> {
    Ok(brain::load(&project_path(&projects, &project_id)?))
}

#[tauri::command]
fn brain_save(projects: State<'_, Projects>, project_id: String, id: String, text: String) -> Result<brain::RawNote, String> {
    brain::save(&project_path(&projects, &project_id)?, &id, &text)
}

#[tauri::command]
fn brain_delete(projects: State<'_, Projects>, project_id: String, id: String) -> Result<(), String> {
    brain::delete(&project_path(&projects, &project_id)?, &id)
}

#[tauri::command]
fn brain_wanted(projects: State<'_, Projects>, project_id: String) -> Result<Vec<brain::Wanted>, String> {
    Ok(brain::wanted_list(&project_path(&projects, &project_id)?))
}

/// A question the brain could not answer goes on the wanted list. The text stays on this PC.
#[tauri::command]
fn brain_wanted_add(projects: State<'_, Projects>, project_id: String, question: String) -> Result<Vec<brain::Wanted>, String> {
    brain::wanted_add(&project_path(&projects, &project_id)?, &question)
}

#[tauri::command]
fn brain_wanted_remove(projects: State<'_, Projects>, project_id: String, question: String) -> Result<Vec<brain::Wanted>, String> {
    brain::wanted_remove(&project_path(&projects, &project_id)?, &question)
}

/// A session's conversation boiled down for a summary (the owner's messages, Claude's replies, one line per tool call).
#[tauri::command]
fn session_transcript(accounts: State<'_, Accounts>, session_id: String, work_dir: String, account_id: Option<String>) -> Result<String, String> {
    let dir = account_id.and_then(|id| accounts.get(&id)).and_then(|a| a.config_dir);
    summary::condensed(&session_id, &work_dir, dir.as_deref())
}

/// One cheap Haiku call that writes a note about a session. The prompt was cleaned of secrets on the screen. Its dollars go in the ledger.
#[tauri::command]
async fn write_note_with_haiku(
    sessions: State<'_, Sessions>, accounts: State<'_, Accounts>, system: String, prompt: String,
    session_id: String, folder: String, role_id: Option<String>, account_id: Option<String>,
) -> Result<String, String> {
    let dir = account_id.as_ref().and_then(|id| accounts.get(id)).and_then(|a| a.config_dir);
    let (text, record) = summary::run_haiku(&system, &prompt, dir.as_deref()).await?;
    sessions.ledger.record_oneshot(&session_id, &folder, role_id.as_deref(), account_id.as_deref(), "summary", &record);
    Ok(text)
}

/// A project's servers (references: host, user, key file path, fingerprint, roles; never a key).
#[tauri::command]
fn ssh_list(servers: State<'_, ssh::Servers>, project_id: String) -> Vec<ssh::Host> {
    servers.for_project(&project_id)
}

#[tauri::command]
fn ssh_save(servers: State<'_, ssh::Servers>, host: ssh::Host) -> Result<ssh::Host, String> {
    servers.save_host(host)
}

#[tauri::command]
fn ssh_remove(servers: State<'_, ssh::Servers>, id: String) -> Result<(), String> {
    servers.remove(&id)
}

/// Read a server's public host keys and their fingerprints. It only connects to the port to read the keys; the screen has asked first.
#[tauri::command]
async fn ssh_fingerprints(host: String, port: u16) -> Result<Vec<ssh::Fingerprint>, String> {
    tauri::async_runtime::spawn_blocking(move || ssh::fingerprints(&host, port)).await.map_err(|e| e.to_string())?
}

/// Does the key file exist, and is it somewhere it should not be? The file is not opened.
#[tauri::command]
fn ssh_key_state(projects: State<'_, Projects>, path: String) -> ssh::KeyState {
    let folders: Vec<String> = projects.all().into_iter().map(|p| p.folder).collect();
    ssh::key_state(&path, &folders)
}

/// Choose the account of a project. Every session in it uses this account.
#[tauri::command]
fn set_project_account(projects: State<'_, Projects>, accounts: State<'_, Accounts>, id: String, account: String) -> Result<Project, String> {
    if !account.trim().is_empty() && accounts.get(account.trim()).is_none() { return Err("That account does not exist".into()); }
    projects.set_account(&id, &account)
}

/// Change a project's GitHub repository (owner/name; empty clears it).
#[tauri::command]
fn set_project_github(projects: State<'_, Projects>, id: String, github: String) -> Result<Project, String> {
    projects.set_github(&id, &github)
}

#[tauri::command]
fn get_settings(settings: State<'_, backup::SettingsStore>) -> backup::Settings {
    settings.get()
}

#[tauri::command]
fn set_settings(settings: State<'_, backup::SettingsStore>, value: backup::Settings) -> Result<backup::Settings, String> {
    settings.set(value)
}

fn kona_base(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir().ok().and_then(|p| p.parent().map(|d| d.join("Kona"))).ok_or_else(|| "no app data folder".to_string())
}

/// Copy Kona's files, the cost ledger and every project's tickets and brain notes into a new backup folder.
#[tauri::command]
async fn backup_now(app: AppHandle, projects: State<'_, Projects>, sessions: State<'_, Sessions>) -> Result<backup::BackupInfo, String> {
    let base = kona_base(&app)?;
    let list: Vec<(String, String)> = projects.all().into_iter().map(|p| (p.name, p.folder)).collect();
    let ledger = sessions.ledger.clone();
    tauri::async_runtime::spawn_blocking(move || backup::make(&base, &list, |p| ledger.backup_to(p))).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn list_backups(app: AppHandle) -> Result<Vec<backup::BackupInfo>, String> {
    Ok(backup::list(&kona_base(&app)?))
}

#[tauri::command]
fn delete_backup(app: AppHandle, name: String) -> Result<(), String> {
    backup::delete(&kona_base(&app)?, &name)
}

/// The sessions Claude Code saved earlier for a project, newest first, so one can be resumed.
#[tauri::command]
async fn earlier_sessions(projects: State<'_, Projects>, accounts: State<'_, Accounts>, project_id: String) -> Result<Vec<summary::Earlier>, String> {
    let folder = project_path(&projects, &project_id)?.to_string_lossy().to_string();
    let roots: Vec<(String, Option<String>)> = accounts.all().into_iter().map(|a| (a.id, a.config_dir)).collect();
    tauri::async_runtime::spawn_blocking(move || summary::earlier(&folder, &roots)).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn list_roles(roles: State<'_, Roles>) -> Vec<Role> {
    roles.all()
}

/// Keep the owner's setup of one role: personality, brief, model, permission mode, skills and connectors.
#[tauri::command]
fn save_role(roles: State<'_, Roles>, id: String, profile: roles::Profile) -> Result<Role, String> {
    roles.save(&id, profile)
}

#[tauri::command]
fn reset_role(roles: State<'_, Roles>, id: String) -> Result<Role, String> {
    roles.reset(&id)
}

/// A folder the screen names must be inside a project (the same rule as starting a session).
fn project_folder(projects: &Projects, folder: &str) -> Result<std::path::PathBuf, String> {
    if !projects.allows(std::path::Path::new(folder)) {
        return Err("That folder is not inside a project".into());
    }
    Ok(std::path::PathBuf::from(folder))
}

/// The skills of one project: the only ones a role of that project can be given, with what each costs at the start of a session.
#[tauri::command]
fn skill_catalog(projects: State<'_, Projects>, folder: String) -> Result<Vec<skills::SkillInfo>, String> {
    Ok(skills::catalog(&project_folder(&projects, &folder)?))
}

/// The skills on this PC that could be copied into the project (not used by any session until they are).
#[tauri::command]
fn computer_skills(app: AppHandle, accounts: State<'_, Accounts>, projects: State<'_, Projects>, folder: String, account_id: Option<String>) -> Result<Vec<skills::SkillInfo>, String> {
    let dir = account_id.and_then(|id| accounts.get(&id)).and_then(|a| a.config_dir);
    Ok(skills::computer_catalog(&kona_base(&app)?, dir.as_deref(), &project_folder(&projects, &folder)?))
}

/// Copy one skill from this PC into the project.
#[tauri::command]
fn import_skill(app: AppHandle, accounts: State<'_, Accounts>, projects: State<'_, Projects>, folder: String, account_id: Option<String>, name: String) -> Result<skills::SkillInfo, String> {
    let dir = account_id.and_then(|id| accounts.get(&id)).and_then(|a| a.config_dir);
    skills::import_skill(&kona_base(&app)?, dir.as_deref(), &project_folder(&projects, &folder)?, &name)
}

/// The folder where a project's own skills live (it may not exist yet).
#[tauri::command]
fn skill_folder(projects: State<'_, Projects>, folder: String) -> Result<String, String> {
    Ok(skills::project_skills_dir(&project_folder(&projects, &folder)?).to_string_lossy().into_owned())
}

/// What every role may use in this project.
#[tauri::command]
fn role_kits(projects: State<'_, Projects>, folder: String) -> Result<std::collections::HashMap<String, skills::RoleKit>, String> {
    Ok(skills::load_kits(&project_folder(&projects, &folder)?))
}

/// The workflows of a project (its own, then the starters it has not saved over).
#[tauri::command]
fn workflow_list(projects: State<'_, Projects>, folder: String) -> Result<Vec<workflows::Workflow>, String> {
    Ok(workflows::list(&project_folder(&projects, &folder)?))
}

#[tauri::command]
fn workflow_save(projects: State<'_, Projects>, folder: String, workflow: workflows::Workflow) -> Result<workflows::Workflow, String> {
    workflows::save(&project_folder(&projects, &folder)?, workflow)
}

#[tauri::command]
fn workflow_delete(projects: State<'_, Projects>, folder: String, id: String) -> Result<(), String> {
    workflows::delete(&project_folder(&projects, &folder)?, &id)
}

/// Raise the Board tickets of a workflow, one per step.
#[tauri::command]
fn workflow_start(projects: State<'_, Projects>, folder: String, workflow: workflows::Workflow) -> Result<Vec<Ticket>, String> {
    workflows::start(&project_folder(&projects, &folder)?, workflow, "the owner (from a workflow)")
}

#[tauri::command]
fn save_role_kit(roles: State<'_, Roles>, projects: State<'_, Projects>, folder: String, role_id: String, kit: skills::RoleKit) -> Result<skills::RoleKit, String> {
    if roles.get(&role_id).is_none() { return Err("That role does not exist".into()); }
    skills::save_kit(&project_folder(&projects, &folder)?, &role_id, kit)
}

/// The tool connectors (MCP servers) a role could be given for a project.
#[tauri::command]
fn mcp_catalog(accounts: State<'_, Accounts>, projects: State<'_, Projects>, account_id: Option<String>, folder: String) -> Result<Vec<skills::McpInfo>, String> {
    if !projects.allows(std::path::Path::new(&folder)) {
        return Err("That folder is not inside a project".into());
    }
    let dir = account_id.and_then(|id| accounts.get(&id)).and_then(|a| a.config_dir);
    Ok(skills::mcp_catalog(dir.as_deref(), std::path::Path::new(&folder)))
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
fn remove_account(accounts: State<'_, Accounts>, projects: State<'_, Projects>, id: String) -> Result<(), String> {
    accounts.remove(&id)?;
    projects.clear_account(&id)
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

/// Run as the board's tool server (see mcp.rs) instead of opening the window.
pub fn mcp_board(args: &[String]) {
    mcp::run(args);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // %APPDATA%\Kona\kona.db (the plan's place for the app's own data)
            let base = app.path().app_data_dir().ok().and_then(|p| p.parent().map(|d| d.join("Kona"))).ok_or("no app data folder")?;
            let ledger = ledger::Ledger::open(&base.join("kona.db")).map_err(|e| format!("could not open the cost ledger: {e}"))?;
            let tracker = std::sync::Arc::new(leftovers::Tracker::new(&base));
            app.manage(tracker.clone());
            app.manage(Sessions::new(ledger, tracker.clone()));
            // while sessions are open (or something is alive) look every 4 seconds; otherwise do nothing
            tauri::async_runtime::spawn(async move {
                loop {
                    let busy = tracker.busy();
                    tokio::time::sleep(std::time::Duration::from_secs(if busy { 4 } else { 10 })).await;
                    if busy {
                        let t = tracker.clone();
                        let _ = tauri::async_runtime::spawn_blocking(move || t.scan()).await;
                    }
                }
            });
            app.manage(Projects::load(&base));
            app.manage(Roles::load(&base));
            app.manage(Accounts::load(&base));
            app.manage(Voice::load(&base));
            app.manage(ssh::Servers::load(&base));
            app.manage(backup::SettingsStore::load(&base));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![check_claude, start_session, send_message, answer_permission, stop_session, list_projects, add_project, remove_project, cost_rows, set_project_github, set_project_account, get_settings, set_settings, backup_now, list_backups, delete_backup, earlier_sessions, ssh_list, ssh_save, ssh_remove, ssh_fingerprints, ssh_key_state, session_transcript, write_note_with_haiku, brain_load, brain_save, brain_delete, brain_wanted, brain_wanted_add, brain_wanted_remove, leftovers, leftover_stop, leftover_ignore, session_temp, session_temp_clean, worktree_status, worktree_overview, worktree_merge, worktree_remove, list_tickets, create_ticket, update_ticket, remove_ticket, get_persona, save_persona, persona_prompt, default_persona, list_tools, check_tools, project_hints, list_roles, save_role, reset_role, skill_catalog, computer_skills, import_skill, skill_folder, role_kits, save_role_kit, mcp_catalog, workflow_list, workflow_save, workflow_delete, workflow_start, list_accounts, add_account, rename_account, remove_account, account_status, sign_in_account, list_dir, read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::check_launch;

    #[test]
    fn a_session_cannot_start_with_options_the_screen_should_never_send() {
        assert!(check_launch("default", "sonnet", None).is_ok());
        assert!(check_launch("acceptEdits", "claude-opus-5-5", Some("3b1c2a4e-1111-4222-8333-444455556666")).is_ok());
        assert!(check_launch("plan", "claude-sonnet-5-5[1m]", None).is_ok());
        assert!(check_launch("bypassPermissions", "sonnet", None).is_err());
        assert!(check_launch("auto", "sonnet", None).is_err());
        assert!(check_launch("default", "--dangerously-skip-permissions", None).is_err());
        assert!(check_launch("default", "", None).is_err());
        assert!(check_launch("default", "sonnet", Some("../../x")).is_err());
        assert!(check_launch("default", "sonnet", Some("--help")).is_err());
    }
}
