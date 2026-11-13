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
export function StepBox({ step, at, actor, on, dim, flagged, draft = false, onPick }: { step: Step; at: Placed; actor: Actor | null; on: boolean; dim: boolean; flagged: boolean; /** found in the code, not yet in the map */ draft?: boolean; onPick: () => void }) {
  const a: Actor = actor ?? "system";
  const color = ACTOR_COLOR[a];
  const rx = a === "person" || a === "people" ? 14 : 3;
  const lines = wrapWords(step.name, 24, 2);
  const status = draft ? "Not confirmed" : STATUS_WORD[step.status];
  return (
    <g transform={`translate(${at.x} ${at.y})`} opacity={dim ? 0.35 : 1} role="button" tabIndex={0} data-step={step.id}
      aria-label={`${step.name}. ${ACTOR_WORD[a]}. ${status}.${dim ? " This kind of user cannot reach it." : ""}${flagged ? " Something is wrong with it." : ""}`}
      onClick={onPick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }} style={{ cursor: "pointer", outline: "none" }} className="journey-box">
      {a === "people" && <rect x={5} y={5} width={at.w} height={at.h} rx={rx} fill="var(--color-surface-1)" stroke={color} strokeWidth={1.5} />}
      <rect width={at.w} height={at.h} rx={rx} fill={on ? "var(--color-surface-3)" : "var(--color-surface-2)"} stroke={color} strokeWidth={on ? 3 : 2} strokeDasharray={a === "ai" || draft ? "6 4" : undefined} className="journey-frame" />
      <g transform="translate(9 7)"><ActorMark actor={a} color={color} /></g>
      <text x={30} y={19} fontSize={11} fill="var(--color-text-secondary)" fontFamily="var(--font-sans)" fontWeight={700}>{ACTOR_WORD[a]}</text>
      <g transform={`translate(${at.w - 9 - 16 - 4 - Math.ceil(status.length * 5.6)} 7)`}><Glyph state={draft ? "idle" : STATUS_GLYPH[step.status]} size={16} still /></g>
      <text x={at.w - 9 - Math.ceil(status.length * 5.6)} y={19} fontSize={11} fill="var(--color-text-secondary)" fontFamily="var(--font-sans)" fontWeight={700}>{status}</text>
      {lines.map((l, i) => <text key={i} x={10} y={39 + i * 15} fontSize={13} fill="var(--color-text)" fontFamily="var(--font-sans)" fontWeight={700}>{l}</text>)}
      {step.kind === "screen" && (
        <g transform={`translate(${at.w - 24} ${at.h - 18})`} fill="none" stroke="var(--color-text-tertiary)" strokeWidth={1.5} aria-hidden="true">
          <rect x={0.75} y={0.75} width={14.5} height={11.5} /><path d="M0.75 4.25h14.5" />
        </g>
      )}
      {flagged && <g transform={`translate(${at.w - 12} -8)`}><Glyph state="left" size={16} /></g>}
      <title>{`${step.name}: ${ACTOR_WORD[a]}, ${status}`}</title>
    </g>
  );
}

/** One line from a step to the next. A line that goes back (a loop) runs under the boxes; an error branch is dashed and ends in a bang. */
export function EdgeLine({ edge, from, to, bright, dim }: { edge: Edge; from: Placed; to: Placed; bright: boolean; dim: boolean }) {
  const sx = from.x + from.w, sy = from.y + from.h / 2, tx = to.x, ty = to.y + to.h / 2;
  let d: string, lx: number, ly: number;
  if (edge.back || tx <= sx) {
    // out of the bottom of the box and into the bottom of the other, in a loop below both
    const x1 = from.x + from.w / 2, y1 = from.y + from.h, x2 = to.x + to.w / 2, y2 = to.y + to.h;
    const low = Math.max(y1, y2) + 26;
    d = `M${x1} ${y1} C${x1} ${low} ${x2} ${low} ${x2} ${y2 + 2}`;
    lx = (x1 + x2) / 2; ly = low - 6;
  } else {
    const dx = Math.max(32, (tx - sx) / 2);
    d = `M${sx} ${sy} C${sx + dx} ${sy} ${tx - dx} ${ty} ${tx - 3} ${ty}`;
    lx = (sx + tx) / 2; ly = (sy + ty) / 2 - 5;
  }
  const label = edge.label.length > 26 ? edge.label.slice(0, 25) + "…" : edge.label;
  const stroke = bright ? "var(--color-text)" : "var(--color-line-strong)";
  return (
    <g opacity={dim ? 0.25 : 1} aria-hidden="true" data-edge={`${edge.from}>${edge.to}`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={bright ? 2.25 : 1.5} strokeDasharray={edge.kind === "error" ? "5 4" : undefined} markerEnd={`url(#journey-arrow${bright ? "-bright" : ""})`} />
      {label && (
        <g>
          <rect x={lx - label.length * 3 - 4} y={ly - 11} width={label.length * 6 + 8} height={15} fill="var(--color-ground)" opacity={0.92} />
          <text x={lx} y={ly} textAnchor="middle" fontSize={11} fill="var(--color-text-secondary)" fontFamily="var(--font-sans)">{edge.kind === "error" ? `! ${label}` : label}</text>
        </g>
      )}
    </g>
  );
}

/** the arrow heads, one for a quiet line and one for a bright one */
export function Defs() {
  return (
    <defs>
      <marker id="journey-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--color-line-strong)" /></marker>
      <marker id="journey-arrow-bright" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--color-text)" /></marker>
    </defs>
  );
}

