// Updates: Kona asks GitHub (one small web request, nothing about you is sent) whether a newer version has been released. If there is one it
// says so and waits for a yes; then it downloads the installer, checks its signature against the public key inside Kona, installs it and
// starts again. The signed files come from `docs/RELEASING.md`. A failed or offline automatic check says nothing.
import { useSyncExternalStore } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateState =
  | { phase: "idle" }
  | { phase: "checking"; manual: boolean }
  | { phase: "current"; at: number }
  | { phase: "available"; version: string; notes: string; later: boolean }
  | { phase: "downloading"; version: string; done: number; total: number }
  | { phase: "installing"; version: string }
  | { phase: "error"; message: string; during: "check" | "install" };

let state: UpdateState = { phase: "idle" };
let pending: Update | null = null;
const listeners = new Set<() => void>();
const set = (next: UpdateState) => { state = next; listeners.forEach((f) => f()); };

export const useUpdate = (): UpdateState => useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => state);

const plain = (e: unknown) => {
  const t = String(e);
  if (/valid release JSON|404|not found/i.test(t)) return "No release has been published yet, so there is nothing to update to.";
  if (/network|dns|connect|timed? ?out|error sending request|resolve/i.test(t)) return "Could not reach GitHub. Check the internet connection and try again.";
  if (/signature/i.test(t)) return "The downloaded update did not match Kona's signature, so it was not installed.";
  return "Could not check for updates: " + t.slice(0, 160);
};

/** Look for a newer version. `manual` is a press of the button: it reports problems; the automatic check at start-up stays quiet. */
export async function checkForUpdate(manual: boolean) {
  if (state.phase === "checking" || state.phase === "downloading" || state.phase === "installing") return;
  set({ phase: "checking", manual });
  try {
    const u = await check({ timeout: 15000 });
    if (u) {
      pending = u;
      set({ phase: "available", version: u.version, notes: (u.body ?? "").trim(), later: false });
    } else {
      pending = null;
      set({ phase: "current", at: Date.now() });
    }
  } catch (e) {
    pending = null;
    set(manual ? { phase: "error", message: plain(e), during: "check" } : { phase: "idle" });
  }
}

/** Not now: the card goes away until the next start (or the next manual check). */
export function postponeUpdate() {
  if (state.phase === "available") set({ ...state, later: true });
}

/** Download, check the signature, install, and start again. On Windows the installer closes Kona and starts the new one itself. */
export async function installUpdate() {
  if (state.phase !== "available" || !pending) return;
  const version = state.version;
  let total = 0, done = 0;
  set({ phase: "downloading", version, done: 0, total: 0 });
  try {
    await pending.downloadAndInstall((ev) => {
      if (ev.event === "Started") total = ev.data.contentLength ?? 0;
      else if (ev.event === "Progress") { done += ev.data.chunkLength; set({ phase: "downloading", version, done, total }); }
      else if (ev.event === "Finished") set({ phase: "installing", version });
    });
    set({ phase: "installing", version });
    await relaunch();
  } catch (e) {
    set({ phase: "error", message: plain(e), during: "install" });
  }
}

/** Close the message after a failed install. */
export function dismissUpdateError() {
  if (state.phase === "error") set({ phase: "idle" });
}
