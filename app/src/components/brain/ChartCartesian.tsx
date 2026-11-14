// The charts that stand on a category axis and a value axis: column, bar, combo, line, area, histogram, pareto, waterfall and box. They share one frame (margins, scale,
// gridlines, labels, the hit band of each category) and differ in the marks. The look is Kona's: hairline solid gridlines, bars at most 24 px thick with a stepped
// (pixel) corner on the free end and a 2 px gap of paper between touching marks, 2 px lines, square markers with a 2 px paper ring, text in ink and never in the series colour.
import { useState, type ReactNode } from "react";
import { barPath, boxStats, fmtNum, histogram, niceTicks, pareto, smoothPath, stackLayout, waterfall, type Chart, type Unit } from "../../lib/brain/chart.ts";
import { AXIS, GRID, INK, INK2, INK3, PAPER, PIXEL, SANS, col, fit, labelInk, shapePath, textW, type PlotProps, type TipRow } from "./chartkit";

type Scale = { lo: number; hi: number; ticks: number[] };

/** A scale that starts at zero when `zero` (bars must), with the owner's min and max when given. */
function scaleFor(lo: number, hi: number, c: Chart, zero: boolean, count = 5): Scale {
  let a = lo, b = hi;
  if (zero) { a = Math.min(a, 0); b = Math.max(b, 0); }
  if (c.spec.min !== null) a = c.spec.min;
  if (c.spec.max !== null) b = c.spec.max;
  if (!(b > a)) b = a + 1;
  const t = niceTicks(a, b, count);
  const lo2 = c.spec.min !== null ? a : t.lo, hi2 = c.spec.max !== null ? b : t.hi;
  return { lo: lo2, hi: hi2, ticks: t.ticks.filter((v) => v >= lo2 - 1e-9 && v <= hi2 + 1e-9) };
}
const compactFmt = (unit: Unit, hi: number) => (v: number) => fmtNum(v, unit, Math.abs(hi) >= 10000);

type Frame = {
  w: number; h: number; x0: number; x1: number; y0: number; y1: number; pw: number; ph: number; horizontal: boolean; n: number; band: number;
  cpos: (i: number) => number; vpos: (v: number) => number;
};
function makeFrame(o: { w: number; h: number; horizontal: boolean; n: number; scale: Scale; tickLabels: string[]; catLabels: string[]; rightLabels?: string[]; xTitle: string; yTitle: string }): Frame {
  const { w, h, horizontal, n, scale } = o;
  const tickW = Math.max(0, ...o.tickLabels.map((s) => textW(s, 12)));
  const catW = Math.min(150, Math.max(0, ...o.catLabels.map((s) => textW(s, 12))));
  const right = o.rightLabels?.length ? Math.max(...o.rightLabels.map((s) => textW(s, 12))) + 10 : 0;
  const l = horizontal ? catW + 14 + (o.xTitle ? 18 : 0) : tickW + 14 + (o.yTitle ? 18 : 0);
  const r = (horizontal ? 34 : 14) + right;
  const t = horizontal ? 6 : 22; // room above the top gridline for the number on the tallest bar
  const b = 24 + (horizontal ? (o.yTitle ? 18 : 0) : o.xTitle ? 18 : 0);
  const x0 = l, x1 = Math.max(l + 40, w - r), y0 = t, y1 = Math.max(t + 40, h - b);
  const pw = x1 - x0, ph = y1 - y0;
  const span = scale.hi - scale.lo || 1;
  const band = (horizontal ? ph : pw) / Math.max(1, n);
  return {
    w, h, x0, x1, y0, y1, pw, ph, horizontal, n, band,
    cpos: (i) => (horizontal ? y0 + band * (i + 0.5) : x0 + band * (i + 0.5)),
    vpos: (v) => (horizontal ? x0 + ((v - scale.lo) / span) * pw : y1 - ((v - scale.lo) / span) * ph),
  };
}

const AxisTitle = ({ x, y, text, rotate = false }: { x: number; y: number; text: string; rotate?: boolean }) => (
  <text x={x} y={y} textAnchor="middle" fontSize="13" fill={INK2} fontFamily={PIXEL} letterSpacing="0.08em" transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}>{text}</text>
);

/** gridlines, the zero line, the labels of the value axis and of the categories, and the titles */
function Axes({ f, scale, fmt, cats, edgeLabels, rightLabels, xTitle, yTitle }: { f: Frame; scale: Scale; fmt: (v: number) => string; cats: string[]; edgeLabels?: string[]; rightLabels?: string[]; xTitle: string; yTitle: string }) {
  const zero = scale.lo < 0 && scale.hi > 0 ? 0 : scale.lo;
  const out: ReactNode[] = [];
  scale.ticks.forEach((v, i) => {
    const p = f.vpos(v);
    out.push(f.horizontal
      ? <line key={"g" + i} x1={p} x2={p} y1={f.y0} y2={f.y1} stroke={GRID} strokeWidth="1" />
      : <line key={"g" + i} x1={f.x0} x2={f.x1} y1={p} y2={p} stroke={GRID} strokeWidth="1" />);
    out.push(f.horizontal
      ? <text key={"t" + i} x={p} y={f.y1 + 16} textAnchor="middle" fontSize="12" fill={INK3} fontFamily={SANS}>{fmt(v)}</text>
      : <text key={"t" + i} x={f.x0 - 8} y={p + 4} textAnchor="end" fontSize="12" fill={INK3} fontFamily={SANS}>{fmt(v)}</text>);
    if (rightLabels?.[i] !== undefined) out.push(<text key={"r" + i} x={f.x1 + 8} y={p + 4} fontSize="12" fill={INK3} fontFamily={SANS}>{rightLabels[i]}</text>);
  });
  const zp = f.vpos(zero);
  out.push(f.horizontal ? <line key="zero" x1={zp} x2={zp} y1={f.y0} y2={f.y1} stroke={AXIS} strokeWidth="1" /> : <line key="zero" x1={f.x0} x2={f.x1} y1={zp} y2={zp} stroke={AXIS} strokeWidth="1" />);
  if (edgeLabels) {
    // labels at the edges between bars (a histogram), thinned so they never touch
    const w = Math.max(...edgeLabels.map((s) => textW(s, 12))) + 10, k = Math.max(1, Math.ceil(w / f.band));
    edgeLabels.forEach((s, i) => { if (i % k === 0) out.push(<text key={"e" + i} x={f.x0 + f.band * i} y={f.y1 + 16} textAnchor="middle" fontSize="12" fill={INK3} fontFamily={SANS}>{s}</text>); });
  } else if (f.horizontal) {
    cats.forEach((s, i) => out.push(<text key={"c" + i} x={f.x0 - 8} y={f.cpos(i) + 4} textAnchor="end" fontSize="12" fill={INK2} fontFamily={SANS}>{fit(s, f.x0 - 18 - (xTitle ? 18 : 0))}</text>));
  } else {
    const w = Math.min(120, Math.max(...cats.map((s) => textW(s, 12))) + 10), k = Math.max(1, Math.ceil(w / f.band));
    cats.forEach((s, i) => { if (i % k === 0) out.push(<text key={"c" + i} x={f.cpos(i)} y={f.y1 + 16} textAnchor="middle" fontSize="12" fill={INK2} fontFamily={SANS}>{fit(s, Math.max(24, f.band * k - 6))}</text>); });
  }
  if (yTitle) out.push(f.horizontal ? <AxisTitle key="yt" x={(f.x0 + f.x1) / 2} y={f.h - 4} text={yTitle} /> : <AxisTitle key="yt" x={12} y={(f.y0 + f.y1) / 2} text={yTitle} rotate />);
  if (xTitle) out.push(f.horizontal ? <AxisTitle key="xt" x={12} y={(f.y0 + f.y1) / 2} text={xTitle} rotate /> : <AxisTitle key="xt" x={(f.x0 + f.x1) / 2} y={f.h - 4} text={xTitle} />);
  return <g>{out}</g>;
}

type Item = {
  cat: number; slot: number; slots: number; v0: number; v1: number; color: string; ink?: string; label?: string; inside?: boolean; cut: boolean; insetStart?: boolean; insetEnd?: boolean;
};
type TipFor = (i: number) => { title: string; rows: TipRow[] };

/** The engine of every bar-like chart: items of bars on categories, a hit band for each category, labels that are placed only when they fit. */
function BarsFrame({ p, h, horizontal, cats, edgeLabels, items, scale, fmt, rightLabels, thickMax = 24, tip, extras, wash = true }: {
  p: PlotProps; h: number; horizontal: boolean; cats: string[]; edgeLabels?: string[]; items: Item[]; scale: Scale; fmt: (v: number) => string; rightLabels?: string[]; thickMax?: number;
  tip: TipFor; extras?: (f: Frame, hv: number | null) => ReactNode; wash?: boolean;
}) {
  const [hv, setHv] = useState<number | null>(null);
  const { c, w, tt } = p;
  const f = makeFrame({ w, h, horizontal, n: cats.length, scale, tickLabels: scale.ticks.map(fmt), catLabels: cats, rightLabels, xTitle: c.spec.xTitle, yTitle: c.spec.yTitle });
  const marks: ReactNode[] = [], labels: ReactNode[] = [];
  items.forEach((it, idx) => {
    const slots = it.slots, groupW = Math.min(f.band - 4, slots * thickMax + (slots - 1) * 2);
    const thick = Math.max(2, (groupW - (slots - 1) * 2) / slots);
    const centre = f.cpos(it.cat), start = centre - groupW / 2 + it.slot * (thick + 2);
    let a = f.vpos(it.v0), b = f.vpos(it.v1);
    // a 2 px gap of paper between stacked segments: the ends that touch a neighbour are pulled in by one pixel
    const dir = Math.sign(b - a) || 1;
    if (it.insetStart) a += dir;
    if (it.insetEnd) b -= dir;
    const lo = Math.min(a, b), len = Math.max(1, Math.abs(b - a));
    const grows = it.v1 >= it.v0;
    if (horizontal) {
      marks.push(<path key={idx} d={barPath(Math.min(a, b), start, len, thick, it.cut ? (grows ? "right" : "left") : null)} fill={it.color} />);
    } else {
      marks.push(<path key={idx} d={barPath(start, lo, thick, len, it.cut ? (grows ? "top" : "bottom") : null)} fill={it.color} />);
    }
    if (it.label && p.c.spec.labels !== "off") {
      const tw = textW(it.label, 11, 700);
      if (it.inside) {
        // a number goes inside a segment only when it fits with room on every side; otherwise the tooltip and the table carry it
        const along = horizontal ? len : thick, across = horizontal ? thick : len;
        if (p.c.spec.labels === "on" || (tw + 8 <= along && across >= 15)) {
          labels.push(<text key={idx} x={horizontal ? lo + len / 2 : start + thick / 2} y={horizontal ? start + thick / 2 + 4 : lo + len / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={it.ink ?? INK} fontFamily={SANS}>{it.label}</text>);
        }
      } else if (p.c.spec.labels === "on" || (items.length <= 28 && (horizontal || tw <= thick + (f.band - groupW) / Math.max(1, slots) + 2))) {
        labels.push(horizontal
          ? <text key={idx} x={grows ? lo + len + 5 : lo - 5} y={start + thick / 2 + 4} textAnchor={grows ? "start" : "end"} fontSize="11" fontWeight="700" fill={INK} fontFamily={SANS}>{it.label}</text>
          : <text key={idx} x={start + thick / 2} y={grows ? lo - 5 : lo + len + 13} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} fontFamily={SANS}>{it.label}</text>);
      }
    }
  });
  const many = cats.length > 60;
  const hits = cats.map((_, i) => {
    const t = tip(i);
    const pos = f.cpos(i) - f.band / 2;
    return (
      <rect key={i} x={horizontal ? f.x0 : pos} y={horizontal ? pos : f.y0} width={horizontal ? f.pw : f.band} height={horizontal ? f.band : f.ph} fill="transparent"
        {...tt.mark(t.title, t.rows, !many, { enter: () => setHv(i), leave: () => setHv(null) })} />
    );
  });
  const washRect = hv !== null && wash ? (
    <rect x={horizontal ? f.x0 : f.cpos(hv) - f.band / 2} y={horizontal ? f.cpos(hv) - f.band / 2 : f.y0} width={horizontal ? f.pw : f.band} height={horizontal ? f.band : f.ph} fill="var(--color-surface-3)" opacity="0.45" />
  ) : null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={summary(c)} className="block max-w-full">
      {washRect}
      <Axes f={f} scale={scale} fmt={fmt} cats={cats} edgeLabels={edgeLabels} rightLabels={rightLabels} xTitle={c.spec.xTitle} yTitle={c.spec.yTitle} />
      {marks}
      {extras?.(f, hv)}
      {labels}
      {hits}
    </svg>
  );
}

export function summary(c: Chart): string {
  const d = c.data;
  const what = d.shape === "cat" ? `${d.cats.length} categories, ${d.series.length} series` : d.shape === "parts" ? `${d.parts.length} parts` : d.shape === "xy" ? `${d.series.length} series of points` : d.shape === "bubble" ? `${d.points.length} bubbles` : d.shape === "values" ? `${d.values.length} values` : d.shape === "groups" ? `${d.groups.length} groups` : d.shape === "steps" ? `${d.steps.length} steps` : `${d.root.children.length} groups`;
  return `${c.spec.title ? c.spec.title + ": " : ""}${c.spec.kind} chart, ${what}. The same numbers are in the table.`;
}

// ---- column, bar and combo ----

export function ColumnPlot({ p }: { p: PlotProps }) {
  const { c, hidden } = p;
  if (c.data.shape !== "cat") return null;
  const { cats } = c.data;
  const all = c.data.series.map((s, i) => ({ ...s, i }));
  const isCombo = c.spec.kind === "combo";
  const lineNames = new Set(c.spec.lines.map((s) => s.toLowerCase()));
  const barSeries = all.filter((s) => !hidden.has(s.name) && !(isCombo && lineNames.has(s.name.toLowerCase())));
  const lineSeries = isCombo ? all.filter((s) => !hidden.has(s.name) && lineNames.has(s.name.toLowerCase())) : [];
  const horizontal = c.spec.kind === "bar";
  const mode = c.spec.stack === "none" || barSeries.length < 2 ? "none" : c.spec.stack;
  const unit: Unit = mode === "percent" ? { prefix: "", suffix: "%" } : c.spec.unit;

  let lo = 0, hi = 0;
  const items: Item[] = [];
  const stack = mode === "none" ? null : stackLayout(barSeries, cats.length, mode);
  // in a stack the segment furthest from zero on each side is the free end of the bar: it gets the stepped corner, the others a gap of paper where they touch
  const outerUp: number[] = [], outerDown: number[] = [];
  if (stack) cats.forEach((_, i) => barSeries.forEach((__, k) => { const q = stack[k][i]; if (q.y1 > q.y0 && q.y1 > 0) outerUp[i] = k; if (q.y1 < q.y0 && q.y1 < 0) outerDown[i] = k; }));
  barSeries.forEach((s, k) => cats.forEach((_, i) => {
    const v = s.values[i];
    if (v === null || v === undefined) return;
    if (stack) {
      const seg = stack[k][i];
      if (seg.y0 === seg.y1) return;
      lo = Math.min(lo, seg.y0, seg.y1); hi = Math.max(hi, seg.y0, seg.y1);
      const outer = seg.y1 > seg.y0 ? outerUp[i] === k : outerDown[i] === k;
      items.push({ cat: i, slot: 0, slots: 1, v0: seg.y0, v1: seg.y1, color: col(s.i), ink: labelInk(s.i), cut: outer, insetStart: seg.y0 !== 0, insetEnd: !outer, label: fmtNum(mode === "percent" ? Math.abs(seg.y1 - seg.y0) : v, unit, true), inside: true });
    } else {
      lo = Math.min(lo, v); hi = Math.max(hi, v);
      items.push({ cat: i, slot: k, slots: barSeries.length, v0: 0, v1: v, color: col(s.i), cut: true, label: fmtNum(v, unit, true) });
    }
  }));
  for (const s of lineSeries) for (const v of s.values) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (mode === "percent") { lo = 0; hi = 100; }
  const scale = scaleFor(lo, hi, c, true);
  const fmt = compactFmt(unit, scale.hi);
  const h = c.spec.height ?? (horizontal ? Math.max(170, 24 + cats.length * (mode === "none" && barSeries.length > 1 ? barSeries.length * 15 + 12 : 32)) : 300);
  const visible = [...barSeries, ...lineSeries];
  const tip: TipFor = (i) => {
    const rows: TipRow[] = visible.map((s) => {
      const v = s.values[i];
      if (v === null || v === undefined) return { color: col(s.i), name: s.name, value: "no value" };
      const k = barSeries.findIndex((b) => b.i === s.i);
      const share = stack && k >= 0 ? ` (${fmtNum(Math.abs(stack[k][i].y1 - stack[k][i].y0), { prefix: "", suffix: "%" })})` : "";
      return { color: col(s.i), name: s.name, value: fmtNum(v, c.spec.unit) + (mode === "percent" ? share : "") };
    });
    if (mode === "stacked" && rows.length > 1) rows.push({ name: "Total", value: fmtNum(visible.reduce((t, s) => t + (s.values[i] ?? 0), 0), c.spec.unit) });
    return { title: cats[i], rows };
  };
  return (
    <BarsFrame p={p} h={h} horizontal={horizontal} cats={cats} items={items} scale={scale} fmt={fmt} tip={tip}
      extras={(f, hv) => lineSeries.length > 0 ? <Lines f={f} series={lineSeries} smooth={c.spec.smooth} markers={c.spec.markers} hv={hv} labels={c.spec.labels} unit={unit} /> : null} />
  );
}

// ---- lines (also drawn on top of bars) ----

type LS = { name: string; values: (number | null)[]; i: number };
function Lines({ f, series, smooth, markers, hv, labels, unit }: { f: Frame; series: LS[]; smooth: boolean; markers: boolean; hv: number | null; labels: "auto" | "on" | "off"; unit: Unit }) {
  const out: ReactNode[] = [];
  const placed: number[] = [];
  const many = f.n > 30;
  series.forEach((s) => {
    const color = col(s.i);
    // a gap (no number) breaks the line
    const runs: [number, number][][] = [];
    s.values.forEach((v, i) => { if (v === null || v === undefined) { runs.push([]); return; } if (!runs.length) runs.push([]); runs[runs.length - 1].push([f.cpos(i), f.vpos(v)]); });
    runs.filter((r) => r.length).forEach((r, k) => {
      const d = r.length === 1 ? `M${r[0][0]} ${r[0][1]}h0` : smooth ? smoothPath(r) : "M" + r.map((q) => q.join(" ")).join("L");
      out.push(<path key={s.name + k} d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />);
    });
    s.values.forEach((v, i) => {
      if (v === null || v === undefined) return;
      const last = i === s.values.length - 1 || s.values.slice(i + 1).every((x) => x === null || x === undefined);
      const show = markers && (!many || last || hv === i);
      if (show || hv === i) out.push(<path key={s.name + "m" + i} d={shapePath("square", hv === i ? 10 : 8)} transform={`translate(${f.cpos(i)} ${f.vpos(v)})`} fill={color} stroke={PAPER} strokeWidth="4" paintOrder="stroke" />);
      if (last && labels !== "off" && series.length <= 4) {
        const y = f.vpos(v) - 10;
        if (placed.every((q) => Math.abs(q - y) > 13)) { placed.push(y); out.push(<text key={s.name + "l"} x={Math.min(f.cpos(i) + 4, f.x1 + 10)} y={y} textAnchor="end" fontSize="11" fontWeight="700" fill={INK} fontFamily={SANS}>{fmtNum(v, unit, true)}</text>); }
      }
    });
  });
  return <g>{hv !== null && <line x1={f.cpos(hv)} x2={f.cpos(hv)} y1={f.y0} y2={f.y1} stroke={AXIS} strokeWidth="1" />}{out}</g>;
}

export function LinePlot({ p }: { p: PlotProps }) {
  const { c, w, hidden, tt } = p;
  const [hv, setHv] = useState<number | null>(null);
  if (c.data.shape !== "cat") return null;
  const { cats } = c.data;
  const area = c.spec.kind === "area";
  const series: LS[] = c.data.series.map((s, i) => ({ ...s, i })).filter((s) => !hidden.has(s.name));
  const mode = !area || c.spec.stack === "none" || series.length < 2 ? "none" : c.spec.stack;
  const unit: Unit = mode === "percent" ? { prefix: "", suffix: "%" } : c.spec.unit;
  const stack = mode === "none" ? null : stackLayout(series, cats.length, mode);
  let lo = Infinity, hi = -Infinity;
  if (stack) stack.forEach((row) => row.forEach((q) => { lo = Math.min(lo, q.y0, q.y1); hi = Math.max(hi, q.y0, q.y1); }));
  else series.forEach((s) => s.values.forEach((v) => { if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
  if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
  if (mode === "percent") { lo = 0; hi = 100; }
  // a line chart may use the range of its numbers; an area is a quantity from zero, so it starts there
  const scale = scaleFor(lo, hi, c, area || (lo >= 0 && lo <= hi * 0.55));
  const fmt = compactFmt(unit, scale.hi);
  const h = c.spec.height ?? 300;
  const f = makeFrame({ w, h, horizontal: false, n: cats.length, scale, tickLabels: scale.ticks.map(fmt), catLabels: cats, xTitle: c.spec.xTitle, yTitle: c.spec.yTitle });
  const base = f.vpos(Math.max(scale.lo, Math.min(0, scale.hi)));
  const areas: ReactNode[] = [];
  if (area) series.forEach((s, k) => {
    const top: [number, number][] = [], bottom: [number, number][] = [];
    cats.forEach((_, i) => {
      if (stack) { top.push([f.cpos(i), f.vpos(stack[k][i].y1)]); bottom.push([f.cpos(i), f.vpos(stack[k][i].y0)]); }
      else if (s.values[i] !== null && s.values[i] !== undefined) { top.push([f.cpos(i), f.vpos(s.values[i]!)]); bottom.push([f.cpos(i), base]); }
    });
    if (top.length < 2) return;
    const d = stack ? "M" + top.map((q) => q.join(" ")).join("L") + "L" + [...bottom].reverse().map((q) => q.join(" ")).join("L") + "Z"
      : (c.spec.smooth ? smoothPath(top) : "M" + top.map((q) => q.join(" ")).join("L")) + `L${top[top.length - 1][0]} ${base}L${top[0][0]} ${base}Z`;
    areas.push(<path key={s.name} d={d} fill={col(s.i)} opacity={stack ? 0.32 : 0.16} stroke={stack ? PAPER : "none"} strokeWidth="2" />);
  });
  const many = cats.length > 60;
  const tipOf = (i: number) => {
    const rows: TipRow[] = series.map((s, k) => ({ color: col(s.i), name: s.name, value: s.values[i] === null || s.values[i] === undefined ? "no value" : mode === "percent" ? `${fmtNum(s.values[i]!, c.spec.unit)} (${fmtNum(stack![k][i].y1 - stack![k][i].y0, { prefix: "", suffix: "%" })})` : fmtNum(s.values[i]!, c.spec.unit) }));
    if (mode === "stacked" && rows.length > 1) rows.push({ name: "Total", value: fmtNum(series.reduce((t, s) => t + (s.values[i] ?? 0), 0), c.spec.unit) });
    return { title: cats[i], rows };
  };
  // an area's outline: the top of each layer as a 2 px line, so the shape reads even where two washes are close
  const outline: LS[] = area && stack ? [] : series;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={summary(c)} className="block max-w-full">
      <Axes f={f} scale={scale} fmt={fmt} cats={cats} xTitle={c.spec.xTitle} yTitle={c.spec.yTitle} />
      {areas}
      {area && stack && series.map((s, k) => <path key={"o" + s.name} d={"M" + cats.map((_, i) => `${f.cpos(i)} ${f.vpos(stack[k][i].y1)}`).join("L")} fill="none" stroke={col(s.i)} strokeWidth="2" strokeLinejoin="round" />)}
      <Lines f={f} series={outline} smooth={c.spec.smooth && !stack} markers={c.spec.markers && !area} hv={hv} labels={area ? "off" : c.spec.labels} unit={unit} />
      {cats.map((_, i) => { const t = tipOf(i); return <rect key={i} x={f.cpos(i) - f.band / 2} y={f.y0} width={f.band} height={f.ph} fill="transparent" {...tt.mark(t.title, t.rows, !many, { enter: () => setHv(i), leave: () => setHv(null) })} />; })}
    </svg>
  );
}

// ---- histogram ----

export function HistogramPlot({ p }: { p: PlotProps }) {
  const { c } = p;
  if (c.data.shape !== "values") return null;
  const { edges, counts } = histogram(c.data.values, c.spec.bins);
  const unit = c.spec.unit;
  const scale = scaleFor(0, Math.max(...counts), c, true);
  const step = Math.max(1, Math.round(scale.ticks[1] - scale.ticks[0]));
  const ticks: number[] = []; for (let v = 0; v <= scale.hi + 1e-9; v += step) ticks.push(v);
  const sc: Scale = { lo: 0, hi: Math.max(...ticks), ticks };
  const items: Item[] = counts.map((n, i) => ({ cat: i, slot: 0, slots: 1, v0: 0, v1: n, color: col(0), cut: true, label: n > 0 ? String(n) : undefined }));
  const range = (i: number) => `${fmtNum(edges[i], unit)} to ${fmtNum(edges[i + 1], unit)}`;
  return (
    <BarsFrame p={p} h={c.spec.height ?? 300} horizontal={false} cats={counts.map((_, i) => range(i))} edgeLabels={edges.map((e) => fmtNum(e, unit, true))} items={items} scale={sc} fmt={(v) => String(v)} thickMax={Infinity}
      tip={(i) => ({ title: range(i), rows: [{ color: col(0), name: c.data.shape === "values" ? c.data.name : "Count", value: `${counts[i]} ${counts[i] === 1 ? "value" : "values"}` }] })} />
  );
}

// ---- pareto: bars largest first and the running share on the same scale (the left axis goes to the total, so 100% is the top and nothing is stretched) ----

export function ParetoPlot({ p }: { p: PlotProps }) {
  const { c } = p;
  if (c.data.shape !== "parts") return null;
  const rows = pareto(c.data.parts);
  const total = rows[rows.length - 1].cum;
  const unit = c.spec.unit;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((q) => total * q);
  const sc: Scale = { lo: 0, hi: total, ticks };
  const items: Item[] = rows.map((r, i) => ({ cat: i, slot: 0, slots: 1, v0: 0, v1: r.value, color: col(0), cut: true, label: c.spec.labels === "on" ? fmtNum(r.value, unit, true) : undefined })); // the running-share line passes over the bars, so their numbers are left to the tooltip unless asked for
  return (
    <BarsFrame p={p} h={c.spec.height ?? 320} horizontal={false} cats={rows.map((r) => r.name)} items={items} scale={sc} fmt={compactFmt(unit, total)} rightLabels={["0%", "25%", "50%", "75%", "100%"]}
      tip={(i) => ({ title: rows[i].name, rows: [{ color: col(0), name: "Value", value: fmtNum(rows[i].value, unit) }, { color: col(1), name: "Running share", value: `${fmtNum(rows[i].share, { prefix: "", suffix: "%" })}` }] })}
      extras={(f, hv) => (
        <g>
          <path d={"M" + rows.map((r, i) => `${f.cpos(i)} ${f.vpos(r.cum)}`).join("L")} fill="none" stroke={col(1)} strokeWidth="2" strokeLinejoin="round" />
          {rows.map((r, i) => (rows.length <= 30 || hv === i || i === rows.length - 1) && <path key={i} d={shapePath("square", hv === i ? 10 : 8)} transform={`translate(${f.cpos(i)} ${f.vpos(r.cum)})`} fill={col(1)} stroke={PAPER} strokeWidth="4" paintOrder="stroke" />)}
        </g>
      )} />
  );
}

// ---- waterfall ----

export function WaterfallPlot({ p }: { p: PlotProps }) {
  const { c } = p;
  if (c.data.shape !== "steps") return null;
  const bars = waterfall(c.data.steps);
  const unit = c.spec.unit;
  let lo = 0, hi = 0;
  for (const b of bars) { lo = Math.min(lo, b.start, b.end); hi = Math.max(hi, b.start, b.end); }
  const scale = scaleFor(lo, hi, c, true);
  const colorOf = (k: string) => (k === "up" ? col(0) : k === "down" ? col(1) : "var(--color-line-strong)");
  const items: Item[] = bars.map((b, i) => ({ cat: i, slot: 0, slots: 1, v0: b.start, v1: b.end, color: colorOf(b.kind), cut: true, label: b.kind === "total" ? fmtNum(b.value, unit, true) : (b.value > 0 ? "+" : "") + fmtNum(b.value, unit, true) }));
  const word = (k: string) => (k === "up" ? "Increase" : k === "down" ? "Decrease" : "Total");
  return (
    <BarsFrame p={p} h={c.spec.height ?? 300} horizontal={false} cats={bars.map((b) => b.name)} items={items} scale={scale} fmt={compactFmt(unit, scale.hi)}
      tip={(i) => ({ title: bars[i].name, rows: [{ color: colorOf(bars[i].kind), name: word(bars[i].kind), value: (bars[i].kind === "up" ? "+" : "") + fmtNum(bars[i].value, unit) }, ...(bars[i].kind !== "total" ? [{ name: "Running total", value: fmtNum(bars[i].end, unit) }] : [])] })}
      extras={(f) => (
        <g>{bars.slice(0, -1).map((b, i) => <line key={i} x1={f.cpos(i) + 12} x2={f.cpos(i + 1) - 12} y1={f.vpos(b.end)} y2={f.vpos(b.end)} stroke={AXIS} strokeWidth="1" />)}</g>
      )} />
  );
}

// ---- box and whisker ----

export function BoxPlot({ p }: { p: PlotProps }) {
  const { c, w, tt } = p;
  const [hv, setHv] = useState<number | null>(null);
  if (c.data.shape !== "groups") return null;
  const { groups } = c.data;
  const stats = groups.map((g) => boxStats(g.values));
  let lo = Infinity, hi = -Infinity;
  for (const s of stats) { lo = Math.min(lo, s.low, ...s.outliers); hi = Math.max(hi, s.high, ...s.outliers); }
  const scale = scaleFor(lo, hi, c, false);
  const unit = c.spec.unit;
  const fmt = compactFmt(unit, scale.hi);
  const h = c.spec.height ?? 320;
  const f = makeFrame({ w, h, horizontal: false, n: groups.length, scale, tickLabels: scale.ticks.map(fmt), catLabels: groups.map((g) => g.name), xTitle: c.spec.xTitle, yTitle: c.spec.yTitle });
  const bw = Math.min(40, f.band * 0.6);
  const marks = stats.map((s, i) => {
    const x = f.cpos(i), y = f.vpos;
    return (
      <g key={i}>
        <line x1={x} x2={x} y1={y(s.high)} y2={y(s.q3)} stroke={col(0)} strokeWidth="2" />
        <line x1={x} x2={x} y1={y(s.q1)} y2={y(s.low)} stroke={col(0)} strokeWidth="2" />
        <line x1={x - bw / 4} x2={x + bw / 4} y1={y(s.high)} y2={y(s.high)} stroke={col(0)} strokeWidth="2" />
        <line x1={x - bw / 4} x2={x + bw / 4} y1={y(s.low)} y2={y(s.low)} stroke={col(0)} strokeWidth="2" />
        <rect x={x - bw / 2} y={y(s.q3)} width={bw} height={Math.max(2, y(s.q1) - y(s.q3))} fill={col(0)} fillOpacity="0.22" stroke={col(0)} strokeWidth="2" />
        <line x1={x - bw / 2} x2={x + bw / 2} y1={y(s.median)} y2={y(s.median)} stroke={INK} strokeWidth="2" />
        <path d="M-3.5 -3.5L3.5 3.5M-3.5 3.5L3.5 -3.5" transform={`translate(${x} ${y(s.mean)})`} stroke={INK} strokeWidth="1.5" fill="none" />
        {s.outliers.map((o, k) => <path key={k} d={shapePath("square", 7)} transform={`translate(${x} ${y(o)})`} fill={col(0)} stroke={PAPER} strokeWidth="4" paintOrder="stroke" />)}
      </g>
    );
  });
  const many = groups.length > 60;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={summary(c)} className="block max-w-full">
      {hv !== null && <rect x={f.cpos(hv) - f.band / 2} y={f.y0} width={f.band} height={f.ph} fill="var(--color-surface-3)" opacity="0.45" />}
      <Axes f={f} scale={scale} fmt={fmt} cats={groups.map((g) => g.name)} xTitle={c.spec.xTitle} yTitle={c.spec.yTitle} />
      {marks}
      {groups.map((g, i) => {
        const s = stats[i];
        const rows: TipRow[] = [["Highest", s.high], ["Upper quartile", s.q3], ["Median", s.median], ["Mean", s.mean], ["Lower quartile", s.q1], ["Lowest", s.low]].map(([name, v]) => ({ name: name as string, value: fmtNum(v as number, unit) }));
        rows.push({ name: "Values", value: String(s.n) });
        if (s.outliers.length) rows.splice(1, 0, { name: "Outliers", value: s.outliers.map((o) => fmtNum(o, unit)).join(", ") });
        return <rect key={i} x={f.cpos(i) - f.band / 2} y={f.y0} width={f.band} height={f.ph} fill="transparent" {...tt.mark(g.name, rows, !many, { enter: () => setHv(i), leave: () => setHv(null) })} />;
      })}
    </svg>
  );
}

