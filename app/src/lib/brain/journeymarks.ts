// The step markers of the code against the steps of the journey (ticket T-0039, decision 91). A marker (`kona-step: <id>` in a comment, found by the scan in
// src-tauri/src/journey_scan.rs) says that a page exists. It does not say where the person goes next, so a marker that the map does not know becomes a DRAFT step: drawn, but
// marked "Not confirmed" until a worker or the owner writes it into the map, and never counted as built. Plain functions, no model.
import type { Journey, Step } from "./journey.ts";

export type Marker = { id: string; file: string; line: number };
export type Scan = { markers: Marker[]; files: number; ms: number; truncated: boolean };
export type Missing = { id: string; at: Marker[] };
export type Marks = {
  /** markers whose id is no step of the map, each id once with every place it was found */
  missing: Missing[];
  /** built screens that have no marker anywhere. Empty when the scan stopped early: an absence cannot be claimed then. */
  noPage: string[];
  /** where each step's marker was found */
  found: Map<string, Marker[]>;
  /** the scan saw every file it was meant to */
  complete: boolean;
};

export const DRAFT_LANE = "draft";

export function compareMarkers(j: Journey, scan: Scan): Marks {
  const ids = new Set(j.steps.map((s) => s.id));
  const found = new Map<string, Marker[]>();
  const missing = new Map<string, Marker[]>();
  for (const m of scan.markers) {
    const into = ids.has(m.id) ? found : missing;
    (into.get(m.id) ?? into.set(m.id, []).get(m.id)!).push(m);
  }
  const complete = !scan.truncated;
  // only a built screen must have a page: "Open the site" and "Check the login" are steps with no page file to mark
  const noPage = complete ? j.steps.filter((s) => s.kind === "screen" && s.status === "built" && !found.has(s.id)).map((s) => s.id) : [];
  return { missing: [...missing].map(([id, at]) => ({ id, at })).sort((a, b) => a.id.localeCompare(b.id)), noPage, found, complete };
}

/** "sign-in" as words for a draft box: "Sign in". */
export function draftName(id: string): string {
  const s = id.replace(/-+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : id;
}

/** The journey with a draft step added for each marker the map does not know, in a lane of their own called Not confirmed. The map itself is not changed. */
export function withDrafts(j: Journey, missing: readonly Missing[]): Journey {
  if (missing.length === 0) return j;
  const draft = (m: Missing): Step => ({
    id: m.id, name: draftName(m.id), lane: DRAFT_LANE, kind: "screen", actor: null, access: [], next: [], start: false, end: false, status: "not-built", updated: "",
    mockup: "", tickets: [], notes: [], see: [], fields: [], buttons: [], errors: [], ai: null,
  });
  return { ...j, lanes: [...j.lanes.filter((l) => l.id !== DRAFT_LANE), { id: DRAFT_LANE, name: "Not confirmed", actor: null }], steps: [...j.steps, ...missing.map(draft)] };
}

/** One line for a place a marker was found: `src/pages/signin.tsx, line 12`. */
export const placeOf = (m: Marker) => `${m.file}, line ${m.line}`;
