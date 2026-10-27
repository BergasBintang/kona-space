// Kona's small parts: the state glyphs, a badge, buttons and the plan bar. See docs/DESIGN.md.
// A state is always a glyph plus a word, never colour alone.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type GlyphState = "live" | "waiting" | "idle" | "done" | "stopped" | "left";

const STATE_COLOR: Record<GlyphState, string> = {
  live: "var(--color-state-live)", waiting: "var(--color-state-waiting)", idle: "var(--color-state-idle)",
  done: "var(--color-state-done)", stopped: "var(--color-state-stopped)", left: "var(--color-state-left)",
};
export const STATE_WORD: Record<GlyphState, string> = { live: "Live", waiting: "Waiting on you", idle: "Idle", done: "Done", stopped: "Stopped", left: "Left behind" };

/** A ring plus one inner mark, on a 16 px grid. */
export function Glyph({ state, size = 16, color }: { state: GlyphState; size?: number; color?: string }) {
  const c = color ?? STATE_COLOR[state];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="6.9" fill="none" stroke={c} strokeWidth="1.75" strokeDasharray={state === "idle" ? "2.4 2.2" : undefined} />
      {state === "live" && <circle cx="8" cy="8" r="3" fill={c} className="kona-live-core" />}
      {state === "waiting" && (<><rect x="5.2" y="5" width="1.9" height="6" rx="1" fill={c} /><rect x="8.9" y="5" width="1.9" height="6" rx="1" fill={c} /></>)}
      {state === "done" && <path d="M5 8.2 L7.2 10.4 L11 5.8" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
      {state === "stopped" && <rect x="5.5" y="5.5" width="5" height="5" rx="1" fill={c} />}
      {state === "left" && (<><rect x="7.05" y="3.8" width="1.9" height="5" rx="1" fill={c} /><circle cx="8" cy="11.2" r="1" fill={c} /></>)}
    </svg>
  );
}

export function Badge({ state, label }: { state: GlyphState; label?: string }) {
  const c = STATE_COLOR[state];
  return (
    <span className="inline-flex items-center gap-2 rounded-full py-[5px] pr-3 pl-[9px] text-[13px] leading-5 font-bold" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>
      <Glyph state={state} size={16} />
      {label ?? STATE_WORD[state]}
    </span>
  );
}

type Variant = "primary" | "quiet" | "ghost" | "danger";
export function Button({ variant = "primary", small = false, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  const size = small ? "h-9 px-3.5 text-[14px]" : "h-11 px-5 text-[15px]";
  const look: Record<Variant, string> = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
    quiet: "border border-line-strong text-text hover:bg-surface-3 active:bg-surface-1",
    ghost: "text-text-secondary hover:bg-surface-3 active:bg-surface-2",
    danger: "bg-state-left text-on-danger hover:brightness-110",
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-bold transition-colors disabled:cursor-not-allowed disabled:border-line-subtle disabled:bg-surface-3 disabled:text-text-disabled ${size} ${look[variant]} ${className}`}
    />
  );
}

/** A plan bar says what it measures in words, shows the percent in mono, and turns amber past 80 percent. */
export function PlanBar({ label, window: w }: { label: string; window?: { utilization: number; resetsAt: number } }) {
  const pct = w ? Math.round(w.utilization * 100) : null;
  const warn = pct !== null && pct >= 80;
  const color = warn ? "var(--color-state-waiting)" : "var(--color-accent)";
  const resets = w?.resetsAt ? new Date(w.resetsAt * 1000).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] leading-5 text-text-secondary">{label}</span>
        <span className="font-mono text-[13px] font-bold" style={{ color: warn ? color : undefined }}>{pct === null ? "not read yet" : `${pct}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-surface-3" role="progressbar" aria-label={label} aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded" style={{ width: `${Math.max(pct ?? 0, pct ? 4 : 0)}%`, background: color }} />
      </div>
      {resets && <span className="text-[13px] leading-5 text-text-tertiary">Resets {resets}</span>}
      {warn && (
        <span className="flex items-center gap-1.5 text-[13px] leading-5 font-bold" style={{ color }}>
          <Glyph state="waiting" size={14} /> Close to the limit
        </span>
      )}
    </div>
  );
}

export const MARKS = ["ring", "halfdisc", "roundsq", "square", "triangle", "plus", "diamond", "ringdot", "lines", "dot"] as const;

/** A role's mark: one shape on a neutral tile. Shape, not colour, tells roles apart. */
export function RoleMark({ mark, size = 28 }: { mark: string; size?: number }) {
  const c = "currentColor";
  const shape: Record<string, ReactNode> = {
    ring: <circle cx="8" cy="8" r="4.6" fill="none" stroke={c} strokeWidth="1.6" />,
    halfdisc: <path d="M3.4 8 A4.6 4.6 0 0 1 12.6 8 Z" fill={c} />,
    roundsq: <rect x="3.6" y="3.6" width="8.8" height="8.8" rx="2.2" fill="none" stroke={c} strokeWidth="1.6" />,
    square: <rect x="3.6" y="3.6" width="8.8" height="8.8" rx="1" fill={c} />,
    triangle: <path d="M8 3.4 L12.6 12 L3.4 12 Z" fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />,
    plus: <path d="M8 3.4 V12.6 M3.4 8 H12.6" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" />,
    diamond: <path d="M8 3 L13 8 L8 13 L3 8 Z" fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />,
    ringdot: <><circle cx="8" cy="8" r="4.8" fill="none" stroke={c} strokeWidth="1.5" /><circle cx="8" cy="8" r="1.5" fill={c} /></>,
    lines: <path d="M3.6 5 H12.4 M3.6 8 H12.4 M3.6 11 H12.4" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" />,
    dot: <circle cx="8" cy="8" r="3.2" fill={c} />,
  };
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-lg bg-surface-3 text-text" style={{ width: size, height: size }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 16 16" aria-hidden="true">{shape[mark] ?? shape.dot}</svg>
    </span>
  );
}

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-card border border-line-subtle bg-surface-1 ${className}`}>{children}</div>
);
