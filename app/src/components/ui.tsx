// Kona's small parts: the state glyphs, a badge, buttons, the plan bar and a role's cat. See docs/DESIGN.md and decisions 46 and 48.
// A state is always a glyph plus a word, never colour alone. Everything here is pixel art: the glyphs are drawn on a 16 x 16 grid with hard
// edges, buttons use the tiled frames in assets/frames (index.css), and a role is shown as its own cat.
import type { ButtonHTMLAttributes } from "react";
import catSheet from "../office/cats.png";
import cats from "../office/cats.json";

export type GlyphState = "live" | "waiting" | "idle" | "done" | "stopped" | "left";

const STATE_COLOR: Record<GlyphState, string> = {
  live: "var(--color-state-live)", waiting: "var(--color-state-waiting)", idle: "var(--color-state-idle)",
  done: "var(--color-state-done)", stopped: "var(--color-state-stopped)", left: "var(--color-state-left)",
};
export const STATE_WORD: Record<GlyphState, string> = { live: "Live", waiting: "Waiting on you", idle: "Idle", done: "Done", stopped: "Stopped", left: "Left behind" };

// the shapes, as pixels on a 16 x 16 grid
const pixels = (on: (x: number, y: number) => boolean) => {
  let d = "";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (on(x, y)) d += `M${x} ${y}h1v1h-1z`;
  return d;
};
const dist = (x: number, y: number) => Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
const onRing = (x: number, y: number) => { const d = dist(x, y); return d >= 5.4 && d <= 7.6; };
const SHAPES = {
  ring: pixels(onRing),
  dashed: pixels((x, y) => onRing(x, y) && Math.floor((Math.atan2(y + 0.5 - 8, x + 0.5 - 8) + Math.PI) / (Math.PI / 6)) % 2 === 0),
  dot: pixels((x, y) => dist(x, y) <= 3.3),
  bars: pixels((x, y) => y >= 5 && y <= 10 && ((x >= 5 && x <= 6) || (x >= 9 && x <= 10))),
  square: pixels((x, y) => x >= 5 && x <= 10 && y >= 5 && y <= 10),
  bang: pixels((x, y) => x >= 7 && x <= 8 && ((y >= 3 && y <= 8) || (y >= 10 && y <= 11))),
  check: pixels((x, y) => [[4, 8], [5, 9], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5]].some(([px, py]) => x === px && (y === py || y === py - 1))),
};

/** A pixel ring with one mark inside, on a 16 px grid. Shown at 16 px (up to 24) or 32 px, so every pixel stays square. */
export function Glyph({ state, size = 16, color, still = false }: { state: GlyphState; size?: number; color?: string; still?: boolean }) {
  const c = color ?? STATE_COLOR[state];
  const s = size <= 24 ? 16 : 32;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0" shapeRendering="crispEdges" fill={c}>
      <path d={state === "idle" ? SHAPES.dashed : SHAPES.ring} />
      {state === "live" && <path d={SHAPES.dot} className={still ? undefined : "kona-live-core"} />}
      {state === "waiting" && <path d={SHAPES.bars} />}
      {state === "done" && <path d={SHAPES.check} />}
      {state === "stopped" && <path d={SHAPES.square} />}
      {state === "left" && <path d={SHAPES.bang} />}
    </svg>
  );
}

export function Badge({ state, label }: { state: GlyphState; label?: string }) {
  const c = STATE_COLOR[state];
  return (
    <span className="font-pixel inline-flex items-center gap-2 border-2 py-[3px] pr-3 pl-[7px] text-[14px] leading-5 font-bold" style={{ color: c, borderColor: c, background: `color-mix(in srgb, ${c} 10%, transparent)` }}>
      <Glyph state={state} size={16} />
      {label ?? STATE_WORD[state]}
    </span>
  );
}

type Variant = "primary" | "quiet" | "ghost" | "danger";
export function Button({ variant = "primary", small = false, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  const size = small ? "h-10 px-2 text-[14px]" : "h-12 px-3 text-[16px]";
  const look: Record<Variant, string> = {
    primary: "px-btn px-btn-teal",
    quiet: "px-btn px-btn-paper",
    ghost: "px-2 text-text-secondary hover:bg-surface-3 active:bg-surface-2 disabled:text-text-disabled",
    danger: "px-btn px-btn-red",
  };
  return (
    <button
      {...rest}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-bold disabled:cursor-not-allowed ${size} ${look[variant]} ${className}`}
    />
  );
}

/** A plan bar says what it measures in words, shows the percent, and turns amber past 80 percent. `compact` is the one-line form for the top bar. */
export function PlanBar({ label, window: w0, readAt, warnLine = "Close to the limit.", compact = false }: { label: string; window?: { utilization: number; resetsAt: number }; readAt?: number; warnLine?: string; compact?: boolean }) {
  // a reading from before the window reset says nothing about the new one
  const w = w0 && w0.resetsAt * 1000 > Date.now() ? w0 : undefined;
  const pct = w ? Math.round(w.utilization * 100) : null;
  const warn = pct !== null && pct >= 80;
  const color = warn ? "var(--color-state-waiting)" : "var(--color-accent)";
  const resets = w?.resetsAt ? new Date(w.resetsAt * 1000).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : null;
  const resetLine = resets ? `Resets ${resets}${readAt && Date.now() - readAt > 10 * 60_000 ? ` · read ${ago(readAt)} ago` : ""}` : null;
  const bar = (
    <div className="h-3 overflow-hidden border-2 border-line-strong bg-inset" role="progressbar" aria-label={label} aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full" style={{ width: `${Math.max(pct ?? 0, pct ? 6 : 0)}%`, background: color }} />
    </div>
  );
  if (compact) {
    return (
      <div className="flex w-[150px] flex-col gap-1" title={[label, pct === null ? "not read yet" : `${pct}%`, resetLine, warn ? warnLine : null].filter(Boolean).join(" · ")}>
        <div className="flex items-baseline justify-between"><span className="font-pixel text-[13px] leading-4 text-text-secondary">{label}</span><span className="font-pixel text-[13px] leading-4 font-bold" style={{ color: warn ? color : undefined }}>{pct === null ? "—" : `${pct}%`}{warn ? " !" : ""}</span></div>
        {bar}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-pixel text-[14px] leading-5 text-text-secondary">{label}</span>
        <span className="font-pixel text-[14px] font-bold" style={{ color: warn ? color : undefined }}>{pct === null ? "not read yet" : `${pct}%`}</span>
      </div>
      {bar}
      {resetLine && <span className="text-[13px] leading-5 text-text-tertiary">{resetLine}</span>}
      {warn && (
        <span className="flex items-center gap-1.5 text-[13px] leading-5 font-bold" style={{ color }}>
          <Glyph state="waiting" size={14} /> {warnLine}
        </span>
      )}
    </div>
  );
}

/** "3 h", "2 days": how long ago, in plain words. */
export function ago(t: number): string {
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  return m < 60 ? `${m} min` : m < 60 * 24 ? `${Math.round(m / 60)} h` : `${Math.round(m / 60 / 24)} days`;
}

const ROW = new Map<string, number>(cats.rows.map((r, i) => [r.id, i]));
export const FRAME_NAMES = cats.frames as string[];
export const CAT_W = cats.frameWidth, CAT_H = cats.frameHeight, CAT_FRAMES = cats.frames.length, CAT_ROWS = cats.rows.length * cats.dirs; // the sheet holds the four sides of every cat, one block of rows per side
export const CAT_SHEET = catSheet;
/** The row of a role's cat on the sheet. dir: 0 faces down-left (the front), 1 down-right, 2 up-left, 3 up-right. Only called with the roles of the office. */
export const catRow = (roleId: string, dir = 0) => dir * cats.rows.length + (ROW.get(roleId) ?? 0);

/** A role is its own cat: the face of that cat from the sprite sheet, drawn at 1x or 2x so the pixels stay square. */
export function RoleMark({ roleId, size = 28 }: { roleId: string; size?: number }) {
  const s = size <= 20 ? 1 : 2;
  if (!ROW.has(roleId)) return <span aria-hidden="true" className="font-pixel inline-flex shrink-0 items-center justify-center border-2 border-line-strong bg-surface-3 text-text-secondary" style={{ width: 16 * s, height: 16 * s, fontSize: 8 * s }}>?</span>;
  return (
    <span aria-hidden="true" className="pixel inline-block shrink-0" style={{
      width: 16 * s, height: 16 * s, backgroundImage: `url(${CAT_SHEET})`, backgroundRepeat: "no-repeat",
      backgroundSize: `${CAT_W * CAT_FRAMES * s}px ${CAT_H * CAT_ROWS * s}px`, backgroundPosition: `${-6 * s}px ${-(2 + catRow(roleId) * CAT_H) * s}px`,
    }} />
  );
}
