// Where each step of a journey stands on the swimlane picture (ticket T-0037, decision 91): the column of a step is how far it is from a start along the
// way a person goes, its row is its lane, and two steps that would stand on the same spot are stacked inside their lane. Plain numbers, no drawing, no model.
// A loop (a wrong password that leads back to the sign-in) is a "back" line and does not push its step to the right.
import type { Journey, Step } from "./journey.ts";

export const BOX = { w: 184, h: 64, gapX: 72, gapY: 20, padX: 28, padY: 16 };

export type EdgeKind = "next" | "button" | "error";
export type Edge = { from: string; to: string; label: string; kind: EdgeKind; /** goes back to a step that leads here: drawn under the boxes, not across */ back: boolean };
export type Placed = { id: string; col: number; lane: number; slot: number; x: number; y: number; w: number; h: number };
export type LaneBand = { id: string; name: string; y: number; h: number; slots: number };
export type Layout = { cols: number; lanes: LaneBand[]; nodes: Map<string, Placed>; edges: Edge[]; width: number; height: number };

/** The lines of a journey: every `next`, and every button and error that names another step. One line for each pair of steps (a branch label beats a button label beats an error text). */
export function edgesOf(j: Journey): Edge[] {
  const ids = new Set(j.steps.map((s) => s.id));
  const out = new Map<string, Edge>();
  const rank: Record<EdgeKind, number> = { next: 3, button: 2, error: 1 };
  const put = (from: string, to: string, label: string, kind: EdgeKind) => {
    if (!to || to === from || !ids.has(to)) return;
    const key = from + ">" + to;
    const old = out.get(key);
    if (!old) out.set(key, { from, to, label, kind, back: false });
    else {
      if (rank[kind] > rank[old.kind]) { old.kind = kind; }
      if (!old.label && label) old.label = label;
    }
  };
  for (const s of j.steps) {
    for (const b of s.next) put(s.id, b.to, b.label, "next");
    for (const b of s.buttons) put(s.id, b.to, b.label, "button");
    for (const e of s.errors) put(s.id, e.to, e.when || e.text, "error");
  }
  return [...out.values()];
}

/** The column of every step. Iterative on purpose: a journey of two thousand steps in a row must not overflow the stack. */
function columnsOf(steps: Step[], edges: Edge[]): Map<string, number> {
  const order = new Map(steps.map((s, i) => [s.id, i]));
  const out = new Map<string, string[]>();
  for (const e of edges) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
  for (const list of out.values()) list.sort((a, b) => order.get(a)! - order.get(b)!);

  // depth-first from the starts, then from whatever is left, to find the edges that go back to a step still being walked
  const state = new Map<string, 1 | 2>(); // 1 on the walk, 2 done
  const back = new Set<string>();
  const roots = [...steps.filter((s) => s.start), ...steps.filter((s) => !s.start)].map((s) => s.id);
  for (const root of roots) {
    if (state.has(root)) continue;
    const stack: { id: string; i: number }[] = [{ id: root, i: 0 }];
    state.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const next = out.get(top.id) ?? [];
      if (top.i >= next.length) { state.set(top.id, 2); stack.pop(); continue; }
      const to = next[top.i++];
      const st = state.get(to);
      if (st === 1) back.add(top.id + ">" + to);
      else if (!st) { state.set(to, 1); stack.push({ id: to, i: 0 }); }
    }
  }
  for (const e of edges) e.back = back.has(e.from + ">" + e.to);

  // the longest way from a step with no way in, along the edges that do not go back
  const indeg = new Map(steps.map((s) => [s.id, 0]));
  for (const e of edges) if (!e.back) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const col = new Map(steps.map((s) => [s.id, 0]));
  const ready = steps.filter((s) => indeg.get(s.id) === 0).map((s) => s.id);
  for (let k = 0; k < ready.length; k++) {
    const id = ready[k];
    for (const to of out.get(id) ?? []) {
      if (back.has(id + ">" + to)) continue;
      col.set(to, Math.max(col.get(to) ?? 0, (col.get(id) ?? 0) + 1));
      indeg.set(to, (indeg.get(to) ?? 1) - 1);
      if (indeg.get(to) === 0) ready.push(to);
    }
  }
  return col;
}

export function layoutJourney(j: Journey): Layout {
  const edges = edgesOf(j);
  const col = columnsOf(j.steps, edges);
  // a step in a lane that does not exist is still drawn, in a band of its own at the bottom
  const lanes = j.lanes.map((l) => ({ id: l.id, name: l.name }));
  if (j.steps.some((s) => !j.lanes.some((l) => l.id === s.lane))) lanes.push({ id: "", name: "No lane" });
  const laneIndex = (s: Step) => { const i = j.lanes.findIndex((l) => l.id === s.lane); return i >= 0 ? i : lanes.length - 1; };

  const taken = new Map<string, number>(); // lane and column: how many steps stand there
  const placed = new Map<string, { col: number; lane: number; slot: number }>();
  for (const s of j.steps) {
    const c = col.get(s.id) ?? 0, l = laneIndex(s);
    const key = l + ":" + c;
    const slot = taken.get(key) ?? 0;
    taken.set(key, slot + 1);
    placed.set(s.id, { col: c, lane: l, slot });
  }
  const slots = lanes.map(() => 1);
  for (const p of placed.values()) slots[p.lane] = Math.max(slots[p.lane], p.slot + 1);

  const bands: LaneBand[] = [];
  let y = 0;
  lanes.forEach((l, i) => {
    const h = BOX.padY * 2 + slots[i] * BOX.h + (slots[i] - 1) * BOX.gapY;
    bands.push({ id: l.id, name: l.name, y, h, slots: slots[i] });
    y += h;
  });
  const nodes = new Map<string, Placed>();
  let cols = 0;
  for (const s of j.steps) {
    const p = placed.get(s.id)!;
    cols = Math.max(cols, p.col + 1);
    nodes.set(s.id, { id: s.id, ...p, x: BOX.padX + p.col * (BOX.w + BOX.gapX), y: bands[p.lane].y + BOX.padY + p.slot * (BOX.h + BOX.gapY), w: BOX.w, h: BOX.h });
  }
  return { cols, lanes: bands, nodes, edges, width: BOX.padX * 2 + Math.max(cols, 1) * BOX.w + Math.max(cols - 1, 0) * BOX.gapX, height: y };
}

/** Can this kind of user reach the step? A step that names no user kind is for everyone: nothing was said to hide it. */
export function visibleTo(s: Step, kind: string): boolean {
  return !kind || s.access.length === 0 || s.access.includes(kind);
}

/** Words cut into at most `lines` lines of about `chars` letters, the last line ending in an ellipsis when the rest does not fit. A word longer than a line is cut. */
export function wrapWords(text: string, chars: number, lines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (let w of words) {
    while (w.length > chars) { // a very long word
      if (cur) { out.push(cur); cur = ""; }
      out.push(w.slice(0, chars));
      w = w.slice(chars);
    }
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= chars) cur += " " + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  const last = kept[lines - 1];
  kept[lines - 1] = (last.length >= chars ? last.slice(0, chars - 1) : last) + "…";
  return kept;
}
