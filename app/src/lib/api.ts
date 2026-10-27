// The commands the Rust core offers, with their shapes (see src-tauri/src/lib.rs).
import { invoke } from "@tauri-apps/api/core";

export type Project = { id: string; name: string; folder: string; github?: string | null };
export type AddResult = { project: Project; hidden_folder: boolean; git_ignored: boolean };
export type Role = { id: string; name: string; group: string; mark: string; model: string; mode: string; brief: string; account?: string | null; needs: string[]; own_copy?: boolean };
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
export type Entry = { name: string; path: string; is_dir: boolean; size: number; modified: number | null };
export type FileView =
  | { kind: "text"; text: string; size: number; truncated: boolean }
  | { kind: "image"; mime: string; data: string; size: number }
  | { kind: "pdf"; data: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number };

export const listProjects = () => invoke<Project[]>("list_projects");
export const addProject = (folder: string, name?: string) => invoke<AddResult>("add_project", { folder, name: name ?? null });
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
export const costRows = (sinceDay: string | null) => invoke<CostRow[]>("cost_rows", { sinceDay });
export const listRoles = () => invoke<Role[]>("list_roles");
export const saveRole = (role: Role) => invoke<Role>("save_role", { role });
export const removeRole = (id: string) => invoke<void>("remove_role", { id });
export const listAccounts = () => invoke<Account[]>("list_accounts");
export const addAccount = (label: string) => invoke<Account>("add_account", { label });
export const renameAccount = (id: string, label: string) => invoke<Account>("rename_account", { id, label });
export const removeAccount = (id: string) => invoke<void>("remove_account", { id });
export const accountStatus = (id: string) => invoke<AccountStatus>("account_status", { id });
export const signInAccount = (id: string) => invoke<void>("sign_in_account", { id });
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
