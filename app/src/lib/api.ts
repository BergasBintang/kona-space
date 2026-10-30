// The commands the Rust core offers, with their shapes (see src-tauri/src/lib.rs).
import { invoke } from "@tauri-apps/api/core";

export type Project = { id: string; name: string; folder: string; github?: string | null; account?: string | null };
export type AddResult = { project: Project; hidden_folder: boolean; git_ignored: boolean };
export type Role = { id: string; name: string; group: string; model: string; mode: string; brief: string; persona?: string; needs: string[]; own_copy?: boolean };
export type RoleProfile = { persona: string; brief: string; model: string; mode: string };
export type RoleKit = { skills: string[]; mcp: string[] };
export type SkillInfo = { name: string; description: string; source: "project" | "computer"; tokens: number };
export type McpInfo = { name: string; source: string; kind: string };
export type ToolInfo = { id: string; name: string; install: string };
export type ToolStatus = { id: string; name: string; installed: boolean; version?: string | null; install: string };
export type Hint = { id: string; because: string };
export type Account = { id: string; label: string; config_dir?: string | null };
export type AccountStatus = { logged_in: boolean; method?: string | null; plan?: string | null; email?: string | null };
export type CostRow = {
  session_id: string; folder: string | null; role_id: string | null; account_id: string | null; model: string; day: string; first_at: string;
  turns: number; input: number; output: number; cache_read: number; cache_write: number; cost: number;
};
export type Lines = { greeting: string; started: string; ended: string; limit: string };
export type Persona = { enabled: boolean; name: string; language: string; verbosity: string; humor: string; emoji: boolean; address: string; plain: boolean; voice: string; lines: Lines };
export const PLAIN_LINES: Lines = { greeting: "Choose a role and start a session.", started: "Session started in {project}.", ended: "This session has ended.", limit: "Close to the limit." };
export type Ticket = {
  id: string; title: string; status: string; role: string | null; raised_by: string; sessions: string[]; next: string; waiting: boolean;
  created: string; updated: string; description: string; acceptance: string; history: string[];
  own_copy: string; branch: string; worktree: string; // where its sessions work: auto, yes (own copy of the repo) or no (main folder)
  blocked_by: string[]; workflow: string; // the tickets this one waits for, and the workflow it is a step of
};
export type WorktreeStatus = { exists: boolean; branch: string; ahead: number; behind: number; changed: number; base: string };
export type TicketView = Ticket & { cost: number };
export type TicketPatch = Partial<{ title: string; description: string; acceptance: string; status: string; role: string; next: string; waiting: boolean; note: string; own_copy: string }>;
export type WorktreeInfo = {
  path: string; branch: string; head: string; is_main: boolean; missing: boolean; ahead: number; behind: number; changed: number;
  conflicts: string[]; last_subject: string; last_when: string; ticket_id?: string | null; ticket_title?: string | null; running: number;
};
export type LeftoverItem = {
  pid: number; key: string; name: string; cmd: string; ports: number[]; session_id: string; first_seen: string; age_secs: number; left_behind: boolean; ignored: boolean;
};
export type LeftoverOverview = { items: LeftoverItem[]; sessions: { id: string; ended: boolean; running: number; left_behind: number }[] };
export type TempInfo = { session_id: string; path: string; bytes: number; files: number; partial: boolean };
export type BrainNote = { id: string; layer: string; text: string; path: string; mtime: number; readonly: boolean };
export type BrainData = { notes: BrainNote[]; memory_dir: string | null };
export type Wanted = { question: string; count: number; first: string; last: string };
export type Server = { id: string; project_id: string; label: string; host: string; port: number; user: string; key_path: string; fingerprints: string[]; roles: string[]; notes: string };
export type Fingerprint = { kind: string; fingerprint: string };
export type KeyState = { exists: boolean; is_file: boolean; inside_a_project: boolean; synced_folder: boolean };
export type Settings = { max_sessions: number; check_updates: boolean };
export type BackupInfo = { name: string; path: string; files: number; bytes: number };
export type Earlier = { id: string; title: string; modified: number; bytes: number; account_id: string };
export type Entry = { name: string; path: string; is_dir: boolean; size: number; modified: number | null };
export type FileView =
  | { kind: "text"; text: string; size: number; truncated: boolean }
  | { kind: "image"; mime: string; data: string; size: number }
  | { kind: "pdf"; data: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number };

export const listProjects = () => invoke<Project[]>("list_projects");
export const addProject = (folder: string, name?: string, github?: string, account?: string) => invoke<AddResult>("add_project", { folder, name: name ?? null, github: github ?? null, account: account ?? null });
export const setProjectAccount = (id: string, account: string) => invoke<Project>("set_project_account", { id, account });
export const removeProject = (id: string) => invoke<void>("remove_project", { id });
export const listTools = () => invoke<ToolInfo[]>("list_tools");
export const checkTools = (ids: string[]) => invoke<ToolStatus[]>("check_tools", { ids });
export const projectHints = (folder: string) => invoke<Hint[]>("project_hints", { folder });
export const listTickets = (projectId: string) => invoke<TicketView[]>("list_tickets", { projectId });
export const createTicket = (projectId: string, n: { title: string; description?: string; acceptance?: string; role?: string | null; status?: string; next?: string; own_copy?: string }) => invoke<Ticket>("create_ticket", { projectId, new: n });
export const updateTicket = (projectId: string, id: string, patch: TicketPatch) => invoke<Ticket>("update_ticket", { projectId, id, patch });
export const removeTicket = (projectId: string, id: string) => invoke<void>("remove_ticket", { projectId, id });
export const getPersona = () => invoke<Persona>("get_persona");
export const savePersona = (persona: Persona) => invoke<Persona>("save_persona", { persona });
export const personaPrompt = (persona: Persona) => invoke<string>("persona_prompt", { persona });
export const defaultPersona = () => invoke<Persona>("default_persona");
export const worktreeStatus = (projectId: string, ticketId: string) => invoke<WorktreeStatus>("worktree_status", { projectId, ticketId });
export const worktreeOverview = (projectId: string) => invoke<WorktreeInfo[]>("worktree_overview", { projectId });
export const mergeWorktree = (projectId: string, path: string) => invoke<string>("worktree_merge", { projectId, path });
export const removeWorktree = (projectId: string, path: string, discard: boolean) => invoke<string>("worktree_remove", { projectId, path, discard });
export const leftoverOverview = () => invoke<LeftoverOverview>("leftovers");
export const stopLeftover = (key: string) => invoke<string>("leftover_stop", { key });
export const ignoreLeftover = (key: string) => invoke<void>("leftover_ignore", { key });
export const sessionTemp = (sessionIds: string[]) => invoke<TempInfo[]>("session_temp", { sessionIds });
export const sessionTempClean = (sessionId: string) => invoke<string>("session_temp_clean", { sessionId });
export const loadBrain = (projectId: string) => invoke<BrainData>("brain_load", { projectId });
export const saveNote = (projectId: string, id: string, text: string) => invoke<BrainNote>("brain_save", { projectId, id, text });
export const deleteNote = (projectId: string, id: string) => invoke<void>("brain_delete", { projectId, id });
export const wantedList = (projectId: string) => invoke<Wanted[]>("brain_wanted", { projectId });
export const wantedAdd = (projectId: string, question: string) => invoke<Wanted[]>("brain_wanted_add", { projectId, question });
export const wantedRemove = (projectId: string, question: string) => invoke<Wanted[]>("brain_wanted_remove", { projectId, question });
export const sessionTranscript = (sessionId: string, workDir: string, accountId: string) => invoke<string>("session_transcript", { sessionId, workDir, accountId });
export const writeNoteWithHaiku = (a: { system: string; prompt: string; sessionId: string; folder: string; roleId: string | null; accountId: string }) =>
  invoke<string>("write_note_with_haiku", { system: a.system, prompt: a.prompt, sessionId: a.sessionId, folder: a.folder, roleId: a.roleId, accountId: a.accountId });
export const listServers = (projectId: string) => invoke<Server[]>("ssh_list", { projectId });
export const saveServer = (host: Server) => invoke<Server>("ssh_save", { host });
export const removeServer = (id: string) => invoke<void>("ssh_remove", { id });
export const readFingerprints = (host: string, port: number) => invoke<Fingerprint[]>("ssh_fingerprints", { host, port });
export const keyState = (path: string) => invoke<KeyState>("ssh_key_state", { path });
export const getSettings = () => invoke<Settings>("get_settings");
export const setSettings = (value: Settings) => invoke<Settings>("set_settings", { value });
export const backupNow = () => invoke<BackupInfo>("backup_now");
export const listBackups = () => invoke<BackupInfo[]>("list_backups");
export const deleteBackup = (name: string) => invoke<void>("delete_backup", { name });
export const setProjectGithub = (id: string, github: string) => invoke<Project>("set_project_github", { id, github });
export const earlierSessions = (projectId: string) => invoke<Earlier[]>("earlier_sessions", { projectId });
export const costRows = (sinceDay: string | null) => invoke<CostRow[]>("cost_rows", { sinceDay });
export const listRoles = () => invoke<Role[]>("list_roles");
export const saveRole = (id: string, profile: RoleProfile) => invoke<Role>("save_role", { id, profile });
export const resetRole = (id: string) => invoke<Role>("reset_role", { id });
export type Step = { id: string; title: string; role: string; after: string[]; note: string };
export type Workflow = { id: string; name: string; about: string; steps: Step[]; starter?: boolean };
export const listWorkflows = (folder: string) => invoke<Workflow[]>("workflow_list", { folder });
export const saveWorkflow = (folder: string, workflow: Workflow) => invoke<Workflow>("workflow_save", { folder, workflow });
export const deleteWorkflow = (folder: string, id: string) => invoke<void>("workflow_delete", { folder, id });
export const startWorkflow = (folder: string, workflow: Workflow) => invoke<Ticket[]>("workflow_start", { folder, workflow });
/** One reply from Kibby, the office boy (a cheap Haiku call with no tools). `history` is what was said before; the new `message` is not in it. */
export const kibbySay = (projectId: string, accountId: string, history: { who: string; text: string }[], message: string) => invoke<string>("kibby_say", { projectId, accountId, history, message });
export const skillCatalog = (folder: string) => invoke<SkillInfo[]>("skill_catalog", { folder });
export const computerSkills = (accountId: string | null, folder: string) => invoke<SkillInfo[]>("computer_skills", { accountId, folder });
export const importSkill = (accountId: string | null, folder: string, name: string) => invoke<SkillInfo>("import_skill", { accountId, folder, name });
export const skillFolder = (folder: string) => invoke<string>("skill_folder", { folder });
export const roleKits = (folder: string) => invoke<Record<string, RoleKit>>("role_kits", { folder });
export const saveRoleKit = (folder: string, roleId: string, kit: RoleKit) => invoke<RoleKit>("save_role_kit", { folder, roleId, kit });
export const mcpCatalog = (accountId: string | null, folder: string) => invoke<McpInfo[]>("mcp_catalog", { accountId, folder });
export const listAccounts = () => invoke<Account[]>("list_accounts");
export const addAccount = async (label: string) => { try { return await invoke<Account>("add_account", { label }); } finally { statusCache.clear(); } };
export const renameAccount = (id: string, label: string) => invoke<Account>("rename_account", { id, label });
export const removeAccount = async (id: string) => { try { return await invoke<void>("remove_account", { id }); } finally { statusCache.clear(); } };
export const accountStatus = (id: string) => invoke<AccountStatus>("account_status", { id });
// Asking Claude Code is a process on this small PC, so the welcome page and the add-project form share one recent answer (a minute) per account.
const statusCache = new Map<string, { at: number; value: AccountStatus }>();
export async function accountStatusCached(id: string, maxAgeMs = 60_000): Promise<AccountStatus> {
  const hit = statusCache.get(id);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.value;
  const value = await accountStatus(id);
  statusCache.set(id, { at: Date.now(), value });
  return value;
}
export const forgetAccountStatus = (id: string) => { statusCache.delete(id); };
export const signInAccount = async (id: string) => { try { return await invoke<void>("sign_in_account", { id }); } finally { statusCache.clear(); } };
export const listDir = (path: string) => invoke<Entry[]>("list_dir", { path });
export const readFile = (path: string) => invoke<FileView>("read_file", { path });

/** The same place, written the same way, whatever the case or slashes. */
export const samePlace = (a: string, b: string) => a.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() === b.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
export const baseName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;
export const humanSize = (n: number) => (n < 1024 ? `${n} bytes` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** The file dialog (for the key file's path). In development a test can answer it in advance; a release build has no such door. */
export async function pickFile(title: string): Promise<string | null> {
  if (import.meta.env.DEV) {
    const preset = (window as unknown as { __KONA_TEST_FILE__?: string }).__KONA_TEST_FILE__;
    if (preset) return preset;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const p = await open({ directory: false, multiple: false, title });
  return typeof p === "string" ? p : null;
}

/** The folder dialog. In development a test can answer it in advance (a native dialog cannot be clicked by a script); a release build has no such door. */
export async function pickFolder(title: string): Promise<string | null> {
  if (import.meta.env.DEV) {
    const preset = (window as unknown as { __KONA_TEST_FOLDER__?: string }).__KONA_TEST_FOLDER__;
    if (preset) return preset;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const p = await open({ directory: true, multiple: false, title });
  return typeof p === "string" ? p : null;
}
