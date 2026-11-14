// The small shared parts of the chart drawings (Chart.tsx, ChartCartesian.tsx, ChartRound.tsx): the paper and ink tokens, the colour of a series, measuring text, the
// tooltip contract, and the swatches of a legend. Nothing here knows about a kind of chart.
import { CHART_HEX, inkOn, type Chart } from "../../lib/brain/chart.ts";

export const PAPER = "var(--color-inset)";
export const GRID = "var(--color-line-subtle)";
export const AXIS = "var(--color-line-strong)";
export const INK = "var(--color-text)";
export const INK2 = "var(--color-text-secondary)";
export const INK3 = "var(--color-text-tertiary)";
export const SANS = "var(--font-sans)";
export const PIXEL = "var(--font-pixel)";
/** the colour of series number i (0 based): a fixed slot, never recomputed when a series is hidden */
export const col = (i: number) => `var(--chart-${(i % 8) + 1})`;
/** the ink of a label set inside the fill of series number i: paper colour or dark ink, whichever reads better on that hue */
export const labelInk = (i: number) => (inkOn(CHART_HEX[i % 8]) === "dark" ? "var(--color-text)" : "var(--color-inset)");
/** a colour at some strength over the paper: a lighter step of the same hue (rings of a sunburst, steps of a funnel, cells of a heat map) */
export const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${Math.round(pct)}%, ${PAPER})`;

export type TipRow = { color?: string; name: string; value: string };
export type Tip = { x: number; y: number; title: string; rows: TipRow[] };
export type Tt = {
  show: (clientX: number, clientY: number, title: string, rows: TipRow[]) => void;
  hide: () => void;
  /** the props that make a drawn thing explain itself: pointer, keyboard focus and a spoken name. `focus` false leaves it out of the tab order (a crowd of dots).
   *  `hover` is told when the pointer or the focus comes and goes, so the plot can light the mark. */
  mark: (title: string, rows: TipRow[], focus?: boolean, hover?: { enter: () => void; leave: () => void }) => Record<string, unknown>;
};
export type PlotProps = { c: Chart; w: number; hidden: Set<string>; tt: Tt };

let ctx: CanvasRenderingContext2D | null | undefined;
/** The width of a text in the chart's own font, measured (a canvas), or guessed when there is no canvas. */
export function textW(s: string, size = 12, weight = 400): number {
  if (ctx === undefined) { try { ctx = document.createElement("canvas").getContext("2d"); } catch { ctx = null; } }
  if (!ctx) return s.length * size * 0.56;
  ctx.font = `${weight} ${size}px "Nunito Sans Variable", "Segoe UI", system-ui, sans-serif`;
  return ctx.measureText(s).width;
}
/** The text cut to fit a width, ending in an ellipsis. */
export function fit(s: string, max: number, size = 12, weight = 400): string {
  if (max <= 0) return "";
  if (textW(s, size, weight) <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (textW(s.slice(0, mid) + "…", size, weight) <= max) lo = mid; else hi = mid - 1; }
  return lo > 0 ? s.slice(0, lo) + "…" : "";
}

/** the shapes that tell scatter series apart besides their colour */
export const SHAPES = ["square", "circle", "diamond", "triangle"] as const;
export type Shape = (typeof SHAPES)[number];
/** the path of a marker of a shape, `s` pixels across, centred on 0 0 */
export function shapePath(shape: Shape, s: number): string {
  const r = s / 2;
  if (shape === "square") return `M${-r} ${-r}h${s}v${s}h${-s}z`;
  if (shape === "circle") return `M${-r} 0a${r} ${r} 0 1 0 ${s} 0a${r} ${r} 0 1 0 ${-s} 0z`;
  if (shape === "diamond") return `M0 ${-r * 1.2}L${r * 1.2} 0L0 ${r * 1.2}L${-r * 1.2} 0z`;
  return `M0 ${-r * 1.15}L${r * 1.15} ${r * 0.9}H${-r * 1.15}z`;
}

/** The little picture before a name in a legend. */
export function Swatch({ color, kind = "square", shape = "square" }: { color: string; kind?: "square" | "line" | "marker"; shape?: Shape }) {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" className="shrink-0">
      {kind === "line" && <path d="M0 7H18" stroke={color} strokeWidth="2" />}
      {kind === "square" && <rect x="3" y="2" width="12" height="10" fill={color} />}
      {kind !== "square" && <path d={shapePath(kind === "line" ? "square" : shape, 8)} transform="translate(9 7)" fill={color} stroke={PAPER} strokeWidth="4" paintOrder="stroke" />}
    </svg>
  );
}
