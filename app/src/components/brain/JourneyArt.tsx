// The drawing parts of the Journey view (ticket T-0037): a small pixel mark for each kind of actor, the box of a step and the line between two steps.
// Everything that tells two boxes apart is shape, mark and word together, never colour alone: a person is a rounded box with a person mark, the system a square box
// with a stack mark, an AI a dashed box with a spark, and one person talking to another a doubled rounded box with two heads.
import { Glyph, type GlyphState } from "../ui";
import { wrapWords, type Edge, type Placed } from "../../lib/brain/journeylayout.ts";
import type { Actor, Status, Step } from "../../lib/brain/journey.ts";

export const ACTOR_WORD: Record<Actor, string> = { person: "Person", system: "System", ai: "AI", people: "People" };
export const STATUS_WORD: Record<Status, string> = { built: "Built", "in-progress": "In progress", "not-built": "Not built" };
/** the state glyph that stands for a status (the same pixel glyphs as the rest of Kona) */
export const STATUS_GLYPH: Record<Status, GlyphState> = { built: "done", "in-progress": "live", "not-built": "idle" };
export const ACTOR_COLOR: Record<Actor, string> = { person: "var(--color-accent)", system: "var(--color-line-strong)", ai: "var(--color-brand)", people: "var(--color-state-idle)" };

// the marks, as pixels on a 16 x 16 grid (like the state glyphs in ui.tsx)
const pixels = (on: (x: number, y: number) => boolean) => {
  let d = "";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (on(x, y)) d += `M${x} ${y}h1v1h-1z`;
  return d;
};
const head = (cx: number, cy: number, r: number) => (x: number, y: number) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
const body = (cx: number, top: number, w: number, h: number) => (x: number, y: number) => y >= top && ((x + 0.5 - cx) / (w / 2)) ** 2 + ((y + 0.5 - (top + h)) / h) ** 2 <= 1;
const MARK: Record<Actor, string> = {
  person: pixels((x, y) => head(8, 5, 2.8)(x, y) || body(8, 9, 10, 6)(x, y)),
  system: pixels((x, y) => x >= 2 && x <= 13 && [2, 3, 4, 6, 7, 8, 10, 11, 12].includes(y) && !(x >= 10 && x <= 11 && (y === 3 || y === 7 || y === 11))),
  ai: pixels((x, y) => Math.abs(x + 0.5 - 8) ** (2 / 3) + Math.abs(y + 0.5 - 8) ** (2 / 3) <= 6 ** (2 / 3)),
  people: pixels((x, y) => head(5, 5, 2)(x, y) || body(5, 8, 7, 6)(x, y) || head(11, 5, 2)(x, y) || body(11, 8, 7, 6)(x, y)),
};

/** The mark of an actor at 16 px, so every pixel stays square. */
export function ActorMark({ actor, color }: { actor: Actor; color?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges" fill={color ?? ACTOR_COLOR[actor]} className="shrink-0">
      <path d={MARK[actor]} />
    </svg>
  );
}

/** One step as a box. `dim` is for a step the chosen kind of user cannot reach; `on` for the picked one. */
export function StepBox({ step, at, actor, on, dim, faint = false, veil = false, peek = false, who = "", doorway = "", flagged, draft = false, onPick }: { step: Step; at: Placed; actor: Actor | null; on: boolean; dim: boolean; /** who can reach the step, in a few words (the bottom line) */ who?: string; /** the step is in another layer: the name of that layer; the box is a doorway to it */ doorway?: string; /** only paler, because something else is being looked at */ faint?: boolean; /** a step is pinned and this one is not joined to it: almost gone */ veil?: boolean; /** the pointer is on a veiled box: show it a little so it can be found and clicked */ peek?: boolean; flagged: boolean; /** found in the code, not yet in the map */ draft?: boolean; onPick: () => void }) {
  const a: Actor = actor ?? "system";
  const color = ACTOR_COLOR[a];
  const rx = a === "person" || a === "people" ? 14 : 3;
  const lines = wrapWords(step.name, 24, 2);
  const status = doorway ? `In ${doorway}` : draft ? "Not confirmed" : STATUS_WORD[step.status];
  // a screen has its small window mark at the bottom right, so its line is shorter; the whole text is in the tooltip
  const room = step.kind === "screen" ? 24 : 30;
  const whoLine = doorway ? "Click to go there" : who.length > room ? who.slice(0, room - 1) + "…" : who;
  return (
    <g transform={`translate(${at.x} ${at.y})`} opacity={veil ? (peek ? 0.4 : 0.07) : dim || faint ? 0.35 : doorway ? 0.8 : 1} role="button" tabIndex={0} data-step={step.id} data-doorway={doorway || undefined}
      aria-label={`${step.name}. ${ACTOR_WORD[a]}. ${status}.${who && !doorway ? ` Who: ${who}.` : ""}${dim ? " This kind of user cannot reach it." : ""}${flagged ? " Something is wrong with it." : ""}`}
      onClick={onPick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }} style={{ cursor: "pointer", outline: "none" }} className="journey-box">
      {a === "people" && <rect x={5} y={5} width={at.w} height={at.h} rx={rx} fill="var(--color-surface-1)" stroke={color} strokeWidth={1.5} />}
      <rect width={at.w} height={at.h} rx={rx} fill={on ? "var(--color-surface-3)" : "var(--color-surface-2)"} stroke={color} strokeWidth={on ? 3 : 2} strokeDasharray={a === "ai" || draft || doorway ? "6 4" : undefined} className="journey-frame" />
      <g transform="translate(9 7)"><ActorMark actor={a} color={color} /></g>
      <text x={30} y={19} fontSize={11} fill="var(--color-text-secondary)" fontFamily="var(--font-sans)" fontWeight={700}>{ACTOR_WORD[a]}</text>
      {!doorway && <g transform={`translate(${at.w - 9 - 16 - 4 - Math.ceil(status.length * 5.6)} 7)`}><Glyph state={draft ? "idle" : STATUS_GLYPH[step.status]} size={16} still /></g>}
      <text x={at.w - 9 - Math.ceil(status.length * 5.6)} y={19} fontSize={11} fill="var(--color-text-secondary)" fontFamily="var(--font-sans)" fontWeight={700}>{status}</text>
      {lines.map((l, i) => <text key={i} x={10} y={39 + i * 15} fontSize={13} fill="var(--color-text)" fontFamily="var(--font-sans)" fontWeight={700}>{l}</text>)}
      {whoLine && <text x={10} y={at.h - 8} fontSize={11} fill="var(--color-text-secondary)" fontFamily="var(--font-sans)">{whoLine}</text>}
      {step.kind === "screen" && !doorway && (
        <g transform={`translate(${at.w - 24} ${at.h - 20})`} fill="none" stroke="var(--color-text-tertiary)" strokeWidth={1.5} aria-hidden="true">
          <rect x={0.75} y={0.75} width={14.5} height={11.5} /><path d="M0.75 4.25h14.5" />
        </g>
      )}
      {flagged && <g transform={`translate(${at.w - 12} -8)`}><Glyph state="left" size={16} /></g>}
      <title>{`${step.name}: ${ACTOR_WORD[a]}, ${status}${who && !doorway ? `. Who: ${who}` : ""}`}</title>
    </g>
  );
}

/** One line from a step to the next. A line that goes back (a loop) runs under the boxes; an error branch is dashed and ends in a bang. */
/** the curve of a line (a cubic curve through four points) and the middle spot for its words */
function curve(edge: Edge, from: Placed, to: Placed) {
  const sx = from.x + from.w, sy = from.y + from.h / 2, tx = to.x, ty = to.y + to.h / 2;
  if (edge.back || tx <= sx) {
    // out of the bottom of the box and into the bottom of the other, in a loop below both
    const x1 = from.x + from.w / 2, y1 = from.y + from.h, x2 = to.x + to.w / 2, y2 = to.y + to.h;
    const low = Math.max(y1, y2) + 26;
    return { d: `M${x1} ${y1} C${x1} ${low} ${x2} ${low} ${x2} ${y2 + 2}`, lx: (x1 + x2) / 2, ly: low - 6, p: [[x1, y1], [x1, low], [x2, low], [x2, y2 + 2]] as Pt[] };
  }
  const dx = Math.max(32, (tx - sx) / 2);
  return { d: `M${sx} ${sy} C${sx + dx} ${sy} ${tx - dx} ${ty} ${tx - 3} ${ty}`, lx: (sx + tx) / 2, ly: (sy + ty) / 2 - 5, p: [[sx, sy], [sx + dx, sy], [tx - dx, ty], [tx - 3, ty]] as Pt[] };
}
type Pt = [number, number];
/** the point of the curve a fraction t of the way along it */
const along = (p: Pt[], t: number): Pt => { const u = 1 - t; return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]; };

/** The line only. Its words are drawn by EdgeLabel, in a layer above the boxes, so a box never cuts them. */
export function EdgeLine({ edge, from, to, bright, dim, veil = false, thin = false }: { edge: Edge; from: Placed; to: Placed; bright: boolean; dim: boolean; /** a step is pinned and this line is not joined to it: almost gone */ veil?: boolean; /** one of many lines of a menu: fine */ thin?: boolean }) {
  const { d } = curve(edge, from, to);
  const stroke = bright ? "var(--color-text)" : "var(--color-line-strong)";
  return (
    <g opacity={veil ? 0.06 : dim ? 0.25 : 1} aria-hidden="true" data-edge={`${edge.from}>${edge.to}`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={thin ? 1.25 : bright ? 2.25 : 1.5} strokeDasharray={edge.kind === "error" ? "5 4" : undefined} markerEnd={`url(#journey-arrow${bright ? "-bright" : ""})`} />
    </g>
  );
}

/** The words on a line, on a patch of the map's colour so they stay readable over a crossing line. */
export function EdgeLabel({ edge, spot, dim }: { edge: Edge; spot: Spot; dim: boolean }) {
  const { lx, ly } = spot;
  const label = edge.label.length > 26 ? edge.label.slice(0, 25) + "…" : edge.label;
  if (!label) return null;
  const text = edge.kind === "error" ? `! ${label}` : label;
  return (
    <g opacity={dim ? 0.25 : 1} aria-hidden="true" data-edge-label={`${edge.from}>${edge.to}`} pointerEvents="none">
      <rect x={lx - text.length * 3 - 4} y={ly - 11} width={text.length * 6 + 8} height={15} fill="var(--color-ground)" opacity={0.92} />
      <text x={lx} y={ly} textAnchor="middle" fontSize={11} fill="var(--color-text-secondary)" fontFamily="var(--font-sans)">{text}</text>
    </g>
  );
}

export type Spot = { lx: number; ly: number };
export type Rect = { x0: number; x1: number; y0: number; y1: number };
const wordsRect = (edge: Edge, lx: number, ly: number): Rect => {
  const text = Math.min(edge.label.length, 26) + (edge.kind === "error" ? 2 : 0);
  return { x0: lx - text * 3.3 - 4, x1: lx + text * 3.3 + 4, y0: ly - 11, y1: ly + 4 };
};
const GAP = 7; // the room kept between two words, and between words and a box, so they never touch
const hits = (a: Rect, b: Rect) => a.x0 < b.x1 + GAP && a.x1 + GAP > b.x0 && a.y0 < b.y1 + GAP && a.y1 + GAP > b.y0;
const WHERE = [0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75, 0.18, 0.82]; // how far along the line the words may stand, the middle first

/**
 * Where the words of a line stand. They try the middle of the line first, then other places along it, and take the first place where no box is under them and no
 * other line's words are already (`taken`, which this adds to). A choice (a branch or an error) is always written if a place is free; a button's words only when
 * the line is pointed at or pinned (`must`), and then, when every place is crowded, they stand in the middle anyway: the words of a line you asked about always show.
 */
export function labelSpot(edge: Edge, from: Placed, to: Placed, boxes: Placed[], taken: Rect[], must: boolean): Spot | null {
  if (edge.kind === "button" && !must) return null;
  const c = curve(edge, from, to);
  // places along the line, then (for words that must show) the middle moved up and down a little
  const tries: Spot[] = WHERE.map((t) => (t === 0.5 ? { lx: c.lx, ly: c.ly } : { lx: along(c.p, t)[0], ly: along(c.p, t)[1] - 5 }));
  if (must) for (const dy of [-18, 18, -36, 36]) tries.push({ lx: c.lx, ly: c.ly + dy });
  for (const { lx, ly } of tries) {
    const r = wordsRect(edge, lx, ly);
    if (boxes.some((b) => r.x0 < b.x + b.w + 3 && r.x1 + 3 > b.x && r.y0 < b.y + b.h + 3 && r.y1 + 3 > b.y) || taken.some((k) => hits(r, k))) continue;
    taken.push(r);
    return { lx, ly };
  }
  if (!must) return null;
  taken.push(wordsRect(edge, c.lx, c.ly));
  return { lx: c.lx, ly: c.ly };
}

/** the arrow heads, one for a quiet line and one for a bright one */
export function Defs() {
  return (
    <defs>
      <marker id="journey-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--color-line-strong)" /></marker>
      <marker id="journey-arrow-bright" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--color-text)" /></marker>
    </defs>
  );
}

