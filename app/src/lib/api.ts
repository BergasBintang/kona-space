// The commands the Rust core offers, with their shapes (see src-tauri/src/lib.rs).
import { invoke } from "@tauri-apps/api/core";

export type Project = { id: string; name: string; folder: string; github?: string | null };
export type AddResult = { project: Project; hidden_folder: boolean; git_ignored: boolean };
export type Role = { id: string; name: string; group: string; mark: string; model: string; mode: string; brief: string; account?: string | null };
export type Account = { id: string; label: string; config_dir?: string | null };
export type AccountStatus = { logged_in: boolean; method?: string | null; plan?: string | null; email?: string | null };
export type CostRow = {
  session_id: string; folder: string | null; role_id: string | null; account_id: string | null; model: string; day: string; first_at: string;
  turns: number; input: number; output: number; cache_read: number; cache_write: number; cost: number;
};
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
