// Where each step of a journey stands on the swimlane picture (ticket T-0037, decision 91): the column of a step is how far it is from a start along the
// way a person goes, its row is its lane, and two steps that would stand on the same spot are stacked inside their lane. Plain numbers, no drawing, no model.
// A loop (a wrong password that leads back to the sign-in) is a "back" line and does not push its step to the right.
import type { Journey, Step } from "./journey.ts";

export const BOX = { w: 184, h: 78, gapX: 72, gapY: 20, padX: 28, padY: 16 }; // the bottom line of a box says who can reach the step
/** most steps stacked in one lane and column; the rest go in a column beside it, so a lane never grows as tall as the whole product */
export const MAX_STACK = 6;
export const MAX_GAP = 150; // the most room a column may take after it for the words on its lines
/** a step that links to this many others (or is linked from this many) is a hub, such as a menu: its lines are drawn only when it is pointed at */
export const hubMin = (steps: number) => Math.max(8, Math.ceil(steps * 0.1));

export type EdgeKind = "next" | "button" | "error";
export type Edge = { from: string; to: string; label: string; kind: EdgeKind; /** goes back to a step that leads here: drawn under the boxes, not across */ back: boolean; /** one of the many lines of a hub: not drawn until the hub is pointed at (set by layoutJourney) */ hub?: boolean };
export type Placed = { id: string; col: number; lane: number; slot: number; /** the column beside the first one of this column, when the stack was too tall */ sub: number; x: number; y: number; w: number; h: number };
export type LaneBand = { id: string; name: string; y: number; h: number; slots: number };
export type Layout = { cols: number; lanes: LaneBand[]; nodes: Map<string, Placed>; edges: Edge[]; /** how many lines of each hub are not drawn */ hidden: Map<string, number>; width: number; height: number };

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
  // hubs: a menu that links to twenty screens would put twenty lines across the map and push all twenty into one tall stack
  const outN = new Map<string, number>(), inN = new Map<string, number>();
  for (const e of edges) { outN.set(e.from, (outN.get(e.from) ?? 0) + 1); inN.set(e.to, (inN.get(e.to) ?? 0) + 1); }
  const limit = hubMin(j.steps.length);
  const hidden = new Map<string, number>();
  for (const e of edges) {
    const fromHub = (outN.get(e.from) ?? 0) >= limit, toHub = (inN.get(e.to) ?? 0) >= limit;
    e.hub = fromHub || toHub;
    // the note under a box counts only for the menu itself, not for every step it links to
    if (fromHub) hidden.set(e.from, (hidden.get(e.from) ?? 0) + 1);
    if (toHub) hidden.set(e.to, (hidden.get(e.to) ?? 0) + 1);
  }
  // the columns follow the real way on; a line out of a hub counts only for a step nothing else leads to (it stands just right of the hub)
  const reached = new Set(edges.filter((e) => !e.hub).map((e) => e.to));
  const way = edges.filter((e) => !e.hub || ((outN.get(e.from) ?? 0) >= limit && (inN.get(e.to) ?? 0) < limit && !reached.has(e.to)));
  const col = columnsOf(j.steps, way);
  // a step in a lane that does not exist is still drawn, in a band of its own at the bottom
  const lanes = j.lanes.map((l) => ({ id: l.id, name: l.name }));
  if (j.steps.some((s) => !j.lanes.some((l) => l.id === s.lane))) lanes.push({ id: "", name: "No lane" });
  const laneIndex = (s: Step) => { const i = j.lanes.findIndex((l) => l.id === s.lane); return i >= 0 ? i : lanes.length - 1; };

  const taken = new Map<string, number>(); // lane and column: how many steps stand there
  const placed = new Map<string, { col: number; lane: number; slot: number; sub: number }>();
  const subs = new Map<number, number>(); // column: how many columns it takes side by side
  for (const s of j.steps) {
    const c = col.get(s.id) ?? 0, l = laneIndex(s);
    const key = l + ":" + c;
    const n = taken.get(key) ?? 0;
    taken.set(key, n + 1);
    const sub = Math.floor(n / MAX_STACK);
    subs.set(c, Math.max(subs.get(c) ?? 1, sub + 1));
    placed.set(s.id, { col: c, lane: l, slot: n % MAX_STACK, sub });
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
  for (const s of j.steps) cols = Math.max(cols, placed.get(s.id)!.col + 1);
  // the room after each column: wide enough for the words written on the lines that cross it (about 6.6 px a letter, a little more for an error's bang), so the
  // words stand between the boxes and not on them. Lines of a menu, loops and lines that jump over a column do not count: their words find a free place along the line.
  const nCols = Math.max(cols, 1);
  const gapAfter: number[] = Array.from({ length: nCols }, () => BOX.gapX);
  for (const e of edges) {
    if (e.hub || e.back || !e.label) continue;
    const a = placed.get(e.from), b = placed.get(e.to);
    if (!a || !b || b.col !== a.col + 1) continue;
    const need = Math.ceil(Math.min(e.label.length, 26) * 6.6 + 8 + (e.kind === "error" ? 13 : 0) + 24);
    gapAfter[a.col] = Math.min(MAX_GAP, Math.max(gapAfter[a.col], need));
  }
  // where each column starts: a column that was split takes the room of every column beside it
  const startX: number[] = [];
  let x = BOX.padX;
  for (let c = 0; c < nCols; c++) { const k = subs.get(c) ?? 1; startX.push(x); x += k * BOX.w + (k - 1) * BOX.gapX + gapAfter[c]; }
  for (const s of j.steps) {
    const p = placed.get(s.id)!;
    nodes.set(s.id, { id: s.id, ...p, x: startX[p.col] + p.sub * (BOX.w + BOX.gapX), y: bands[p.lane].y + BOX.padY + p.slot * (BOX.h + BOX.gapY), w: BOX.w, h: BOX.h });
  }
  return { cols, lanes: bands, nodes, edges, hidden, width: x - gapAfter[nCols - 1] + BOX.padX, height: y };
}

/**
 * One layer of a journey for drawing. It holds the steps of the layer, and the steps of other layers that a line joins to them: those are doorways, boxes that say
 * which layer they are in and carry only the lines that touch this layer (a click on one goes to that layer). A step that belongs to no layer (shared work) is drawn
 * in full wherever a line joins it to the layer, and not otherwise. `layer` empty means no layers: the journey as it is.
 */
export function layerView(j: Journey, layer: string): { journey: Journey; doorways: Map<string, string> } {
  const doorways = new Map<string, string>();
  if (!layer || j.layers.length === 0) return { journey: j, doorways };
  const own = new Set(j.steps.filter((s) => s.layer === layer).map((s) => s.id));
  const touching = new Set<string>(); // outside steps with a line to or from this layer
  for (const e of edgesOf(j)) {
    if (own.has(e.from) && !own.has(e.to)) touching.add(e.to);
    else if (own.has(e.to) && !own.has(e.from)) touching.add(e.from);
  }
  const names = new Map(j.layers.map((l) => [l.id, l.name]));
  const steps: Step[] = [];
  for (const s of j.steps) {
    if (own.has(s.id)) { steps.push(s); continue; }
    if (!touching.has(s.id)) continue;
    // the outside step keeps only the lines into this layer, so no line of another layer is drawn
    const cut: Step = { ...s, next: s.next.filter((b) => own.has(b.to)), buttons: s.buttons.filter((b) => own.has(b.to)), errors: s.errors.filter((e) => own.has(e.to)), start: false, end: s.next.length + s.buttons.length + s.errors.length > 0 ? s.end : true };
    if (s.layer) { doorways.set(s.id, names.get(s.layer) ?? s.layer); cut.kind = "step"; cut.fields = []; }
    steps.push(cut);
  }
  return { journey: { ...j, steps }, doorways };
}

/** Can this kind of user reach the step? A step that names no user kind is for everyone: nothing was said to hide it. */
export function visibleTo(s: Step, kind: string): boolean {
  return !kind || s.access.length === 0 || s.access.includes(kind);
}

/** The steps one kind of user meets: what the kind can reach, and the work behind it. A step that names no user kind (a server step) is dropped when every step that leads to it is dropped, so a student does not see the admin's server work. */
export function stepsFor(j: Journey, kind: string): Step[] {
  if (!kind) return j.steps;
  const keep = new Map(j.steps.map((s) => [s.id, visibleTo(s, kind)]));
  const from = new Map<string, string[]>();
  for (const e of edgesOf(j)) (from.get(e.to) ?? from.set(e.to, []).get(e.to)!).push(e.from);
  for (let changed = true; changed;) {
    changed = false;
    for (const s of j.steps) {
      const src = from.get(s.id);
      if (keep.get(s.id) && s.access.length === 0 && !s.start && src && src.every((id) => !keep.get(id))) { keep.set(s.id, false); changed = true; }
    }
  }
  return j.steps.filter((s) => keep.get(s.id));
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
