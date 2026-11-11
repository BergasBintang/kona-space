// The built-in terminal's side of the window (decision 80). One shell per project. The shell lives in the Rust core and keeps
// running when the page is left; the last part of its output is kept here, so coming back redraws the screen where it was.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const KEEP_BYTES = 400_000; // the scrollback kept for a page that is not open (the screen keeps its own while open)

export type Shell = { id: string; chunks: Uint8Array[]; bytes: number; sink?: (b: Uint8Array) => void; exited: boolean; onExit?: () => void };
const byProject = new Map<string, Shell>();
const byId = new Map<string, Shell>();
let listening: Promise<void> | null = null;

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const toB64 = (s: string) => { let bin = ""; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin); };

function listenOnce(): Promise<void> {
  listening ??= (async () => {
    await listen<{ id: string; data: string }>("term-data", (e) => {
      const sh = byId.get(e.payload.id); if (!sh) return;
      const b = fromB64(e.payload.data);
      if (sh.sink) { sh.sink(b); return; }
      sh.chunks.push(b); sh.bytes += b.length;
      while (sh.bytes > KEEP_BYTES && sh.chunks.length > 1) sh.bytes -= sh.chunks.shift()!.length;
    });
    await listen<{ id: string }>("term-exit", (e) => {
      const sh = byId.get(e.payload.id); if (!sh) return;
      sh.exited = true; sh.onExit?.();
    });
  })();
  return listening;
}

const starting = new Map<string, Promise<Shell>>();
/** The project's shell: the running one, or a new one in the project's folder. Two askers at once (the screen mounted twice, a quick switch of tabs) share one start, never two shells. */
export function shellFor(projectId: string, folder: string, rows: number, cols: number): Promise<Shell> {
  const have = byProject.get(projectId);
  if (have && !have.exited) return Promise.resolve(have);
  const going = starting.get(projectId);
  if (going) return going;
  const p = (async () => {
    await listenOnce();
    if (have) await closeShell(projectId); // the ended one is let go of, not left in the core
    const id = await invoke<string>("term_open", { folder, shell: null, rows, cols });
    const sh: Shell = { id, chunks: [], bytes: 0, exited: false };
    byProject.set(projectId, sh); byId.set(id, sh);
    return sh;
  })().finally(() => starting.delete(projectId));
  starting.set(projectId, p);
  return p;
}
export const writeShell = (id: string, text: string) => invoke("term_write", { id, data: toB64(text) }).catch(() => {});
export const resizeShell = (id: string, rows: number, cols: number) => invoke("term_resize", { id, rows, cols }).catch(() => {});
export async function closeShell(projectId: string) {
  const sh = byProject.get(projectId); if (!sh) return;
  byProject.delete(projectId); byId.delete(sh.id);
  await invoke("term_close", { id: sh.id }).catch(() => {});
}

// for the test drivers in the dev window only
if (import.meta.env.DEV) (window as unknown as { __konaShells: typeof byProject }).__konaShells = byProject;

// A page that has just loaded knows of no shell, so any still in the core are orphans (the window was reloaded): they are closed now, not left running unseen.
void invoke("term_close_all").catch(() => {});

/** The owner's own script buttons of a project; they are kept in Kona's own folder. */
export type OwnButton = { name: string; line: string };
export const loadButtons = (projectId: string) => invoke<OwnButton[]>("term_buttons_load", { projectId });
export const saveButtons = (projectId: string, buttons: OwnButton[]) => invoke<void>("term_buttons_save", { projectId, buttons });
