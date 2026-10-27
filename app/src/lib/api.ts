// The commands the Rust core offers, with their shapes (see src-tauri/src/lib.rs).
import { invoke } from "@tauri-apps/api/core";

export type Project = { id: string; name: string; folder: string; github?: string | null };
export type AddResult = { project: Project; hidden_folder: boolean; git_ignored: boolean };
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
