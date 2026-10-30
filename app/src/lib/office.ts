// What each cat in the office is doing, worked out from the sessions of the open project. Kept apart from the office picture so the picture
// only redraws when a cat's look really changes, not on every word Claude streams.
import { samePlace, type Project } from "./api";
import type { GlyphState } from "../components/ui";
import type { RunState, State } from "./sessions";
import first from "../office/views/v0.json";

export type Look = { mode: "idle" | "typing" | "waiting" | "done"; word: string | null; glyph: GlyphState | null; sessionId: string | null };
export const OFFICE_ROLES: string[] = first.cats.map((c) => c.role);
export const NO_LOOKS: Record<string, Look> = {};

const RANK: Record<RunState, number> = { waiting: 4, working: 3, starting: 2, ready: 1, ended: 0 };

/** What a role is doing in this project: its busiest session counts. */
export function lookOf(roleId: string, project: Project, state: State): Look {
  const mine = state.order.map((id) => state.sessions[id]).filter((s) => s.roleId === roleId && s.run !== "ended" && samePlace(s.folder, project.folder));
  const s = mine.sort((a, b) => RANK[b.run] - RANK[a.run])[0];
  if (!s) return { mode: "idle", word: null, glyph: null, sessionId: null };
  if (s.run === "waiting") return { mode: "waiting", word: "Waiting for you", glyph: "waiting", sessionId: s.id };
  if (s.run === "working") return { mode: "typing", word: "Working…", glyph: "live", sessionId: s.id };
  if (s.run === "starting") return { mode: "typing", word: "Starting…", glyph: "live", sessionId: s.id };
  return s.turns > 0 ? { mode: "done", word: "Done", glyph: "done", sessionId: s.id } : { mode: "idle", word: "Ready", glyph: "idle", sessionId: s.id };
}

/** All the looks of the office. */
export function officeLooks(project: Project | null, state: State): Record<string, Look> {
  return project ? Object.fromEntries(OFFICE_ROLES.map((r) => [r, lookOf(r, project, state)])) : NO_LOOKS;
}

/** The few facts of the sessions that a look depends on. While this text stays the same, the looks stay the same (streamed words do not change it). */
export const looksSignature = (state: State): string => state.order.map((id) => { const s = state.sessions[id]; return `${id}|${s.roleId}|${s.run}|${s.turns}|${s.folder}`; }).join(";");
