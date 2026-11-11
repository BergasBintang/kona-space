// What each cat in the office is doing, worked out from the sessions of the open project. Kept apart from the office picture so the picture
// only redraws when a cat's look really changes, not on every word Claude streams.
import { samePlace, type Project } from "./api.ts";
import type { GlyphState } from "../components/ui";
import type { RunState, State } from "./sessions";
import { CAT_ROLES } from "../office/map.ts";

export type Look = { mode: "idle" | "typing" | "waiting" | "done" | "open"; word: string | null; glyph: GlyphState | null; sessionId: string | null };
export const OFFICE_ROLES: string[] = CAT_ROLES.map((r) => r.id);
export const NO_LOOKS: Record<string, Look> = {};

const RANK: Record<RunState, number> = { waiting: 4, working: 3, starting: 2, ready: 1, ended: 0 };

/** What a person is doing in this project: their busiest session counts. The bubble over the cat has four states, in words: Working, Questioning (Claude waits for the owner), Finish
 * (a turn is finished and the owner has not opened that person's chat since) and Open (the chat has been seen and is still open); nothing when the person has no chat. `seen` is how many turns of each session the owner has already seen. */
export function lookOf(roleId: string, project: Project, state: State, seen: Record<string, number> = {}): Look {
  const mine = state.order.map((id) => state.sessions[id]).filter((s) => s.roleId === roleId && s.run !== "ended" && samePlace(s.folder, project.folder));
  const s = mine.sort((a, b) => RANK[b.run] - RANK[a.run])[0];
  if (!s) return { mode: "idle", word: null, glyph: null, sessionId: null };
  if (s.run === "waiting") return { mode: "waiting", word: "Questioning", glyph: "waiting", sessionId: s.id };
  if (s.run === "working" || s.run === "starting") return { mode: "typing", word: "Working", glyph: "live", sessionId: s.id };
  if (s.turns > 0 && s.turns > (seen[s.id] ?? 0)) return { mode: "done", word: "Finish", glyph: "done", sessionId: s.id };
  // the chat has been seen, but it is still open: a quiet mark stays over the head, so an open chat is never lost from sight
  return s.turns > 0 ? { mode: "open", word: "Open", glyph: "idle", sessionId: s.id } : { mode: "idle", word: null, glyph: null, sessionId: s.id };
}

/** How many sessions of each project (by the project's id) are waiting for the owner, for the cards of the welcome page. */
export function waitingByProject(projects: Project[], state: State): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of projects) {
    const n = state.order.filter((id) => state.sessions[id].run === "waiting" && samePlace(state.sessions[id].folder, p.folder)).length;
    if (n > 0) out[p.id] = n;
  }
  return out;
}

/** All the looks of the office. */
export function officeLooks(project: Project | null, state: State, seen: Record<string, number> = {}): Record<string, Look> {
  return project ? Object.fromEntries(OFFICE_ROLES.map((r) => [r, lookOf(r, project, state, seen)])) : NO_LOOKS;
}

/** The few facts of the sessions that a look depends on. While this text stays the same, the looks stay the same (streamed words do not change it). */
export const looksSignature = (state: State, seen: Record<string, number> = {}): string => state.order.map((id) => { const s = state.sessions[id]; return `${id}|${s.roleId}|${s.run}|${s.turns}|${s.folder}|${seen[id] ?? 0}`; }).join(";");

/** How many sessions of each project (by the project's id) have finished a turn the owner has not looked at yet: the "Finish" of the office, for the welcome page. */
export function finishedByProject(projects: Project[], state: State, seen: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of projects) {
    const n = state.order.map((id) => state.sessions[id]).filter((s) => s.run === "ready" && s.turns > 0 && s.turns > (seen[s.id] ?? 0) && samePlace(s.folder, p.folder)).length;
    if (n > 0) out[p.id] = n;
  }
  return out;
}
