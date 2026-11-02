// What each cat in the office is doing, worked out from the sessions of the open project. Kept apart from the office picture so the picture
// only redraws when a cat's look really changes, not on every word Claude streams.
import { samePlace, type Project } from "./api.ts";
import type { GlyphState } from "../components/ui";
import type { RunState, State } from "./sessions";
import { CAT_ROLES } from "../office/map.ts";

export type Look = { mode: "idle" | "typing" | "waiting" | "done"; word: string | null; glyph: GlyphState | null; sessionId: string | null };
export const OFFICE_ROLES: string[] = CAT_ROLES.map((r) => r.id);
export const NO_LOOKS: Record<string, Look> = {};

const RANK: Record<RunState, number> = { waiting: 4, working: 3, starting: 2, ready: 1, ended: 0 };

/** What a person is doing in this project: their busiest session counts. The bubble over the cat has three states, in words: Working, Questioning (Claude waits for the owner) and Finish
 * (a turn is finished and the owner has not opened that person's chat since); nothing when idle. `seen` is how many turns of each session the owner has already seen. */
export function lookOf(roleId: string, project: Project, state: State, seen: Record<string, number> = {}): Look {
  const mine = state.order.map((id) => state.sessions[id]).filter((s) => s.roleId === roleId && s.run !== "ended" && samePlace(s.folder, project.folder));
  const s = mine.sort((a, b) => RANK[b.run] - RANK[a.run])[0];
  if (!s) return { mode: "idle", word: null, glyph: null, sessionId: null };
  if (s.run === "waiting") return { mode: "waiting", word: "Questioning", glyph: "waiting", sessionId: s.id };
  if (s.run === "working" || s.run === "starting") return { mode: "typing", word: "Working", glyph: "live", sessionId: s.id };
  return s.turns > 0 && s.turns > (seen[s.id] ?? 0) ? { mode: "done", word: "Finish", glyph: "done", sessionId: s.id } : { mode: "idle", word: null, glyph: null, sessionId: s.id };
}

/** All the looks of the office. */
export function officeLooks(project: Project | null, state: State, seen: Record<string, number> = {}): Record<string, Look> {
  return project ? Object.fromEntries(OFFICE_ROLES.map((r) => [r, lookOf(r, project, state, seen)])) : NO_LOOKS;
}

/** The few facts of the sessions that a look depends on. While this text stays the same, the looks stay the same (streamed words do not change it). */
export const looksSignature = (state: State, seen: Record<string, number> = {}): string => state.order.map((id) => { const s = state.sessions[id]; return `${id}|${s.roleId}|${s.run}|${s.turns}|${s.folder}|${seen[id] ?? 0}`; }).join(";");
