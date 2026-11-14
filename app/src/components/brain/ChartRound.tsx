// The charts that are not drawn on a category axis: pie, doughnut, radar, scatter, bubble, funnel, treemap, sunburst and heat map. Same look as the others: ink for text,
// colours by a fixed slot, a 2 px paper gap between touching marks, square markers with a 2 px paper ring, and a number inside a mark only when it fits.
import { useState, type ReactNode } from "react";
import { arcPath, fmtNum, niceTicks, pieSlices, squarify, sunburst, type Chart, type TreeNode, type Unit } from "../../lib/brain/chart.ts";
import { AXIS, GRID, INK, INK2, INK3, PAPER, PIXEL, SANS, SHAPES, col, fit, labelInk, mix, shapePath, textW, type PlotProps, type TipRow } from "./chartkit";
import { summary } from "./ChartCartesian";

const Svg = ({ c, w, h, children }: { c: Chart; w: number; h: number; children: ReactNode }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={summary(c)} className="block max-w-full">{children}</svg>
);
const pct = (v: number) => `${Number(v.toFixed(1))}%`; // a share has one decimal at most: 28.3%, not 28.33%
const compact = (u: Unit, v: number) => fmtNum(v, u, Math.abs(v) >= 10000);

// ---- pie and doughnut ----

export function PiePlot({ p }: { p: PlotProps }) {
  const { c, w, tt } = p;
  const [hv, setHv] = useState<number | null>(null);
  if (c.data.shape !== "parts") return null;
  const { parts } = c.data;
  const ring = c.spec.kind === "doughnut";
  const h = c.spec.height ?? Math.max(240, Math.min(340, Math.round(w * 0.5)));
  const r = Math.max(60, Math.min(h / 2 - 8, w / 2 - 8)), cx = w / 2, cy = h / 2, r0 = ring ? r * 0.56 : 0;
  const total = parts.reduce((s, q) => s + q.value, 0);
  const slices = pieSlices(parts.map((q) => q.value));
  const many = parts.length > 40;
  return (
    <Svg c={c} w={w} h={h}>
      {parts.map((q, i) => {
        const s = slices[i], share = (q.value / total) * 100;
        const mid = (s.a0 + s.a1) / 2, rl = ring ? (r + r0) / 2 : r * 0.64;
        const tw = textW(pct(share), 12, 700);
        const fits = share >= 6 && (s.a1 - s.a0) * rl > tw + 8;
        const lift = hv === i ? 4 : 0;
        const rows: TipRow[] = [{ color: col(i), name: q.name, value: fmtNum(q.value, c.spec.unit) }, { name: "Share", value: pct(share) }];
        return (
          <g key={i} transform={`translate(${Math.cos(mid) * lift} ${Math.sin(mid) * lift})`}>
            <path d={arcPath(cx, cy, r0, r, s.a0, s.a1)} fill={col(i)} stroke={PAPER} strokeWidth="2" {...tt.mark(q.name, rows, !many, { enter: () => setHv(i), leave: () => setHv(null) })} />
            {fits && <text x={cx + Math.cos(mid) * rl} y={cy + Math.sin(mid) * rl + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={labelInk(i)} fontFamily={SANS} pointerEvents="none">{pct(share)}</text>}
          </g>
        );
      })}
      {ring && (
        <g pointerEvents="none">
          <text x={cx} y={cy + 2} textAnchor="middle" fontSize="20" fill={INK} fontFamily={PIXEL}>{compact(c.spec.unit, total)}</text>
          <text x={cx} y={cy + 20} textAnchor="middle" fontSize="12" fill={INK3} fontFamily={SANS}>Total</text>
        </g>
      )}
    </Svg>
  );
}

// ---- radar ----

export function RadarPlot({ p }: { p: PlotProps }) {
  const { c, w, hidden, tt } = p;
  const [hv, setHv] = useState<number | null>(null);
  if (c.data.shape !== "cat") return null;
  const { cats } = c.data;
  const series = c.data.series.map((s, i) => ({ ...s, i })).filter((s) => !hidden.has(s.name));
  const n = cats.length;
  const h = c.spec.height ?? Math.max(300, Math.min(400, Math.round(w * 0.6)));
  const labelW = Math.min(120, Math.max(...cats.map((s) => textW(s, 12))) + 6);
  const r = Math.max(60, Math.min(h / 2 - 28, w / 2 - labelW - 12)), cx = w / 2, cy = h / 2 + 2;
  let lo = 0, hi = 0;
  for (const s of series) for (const v of s.values) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const t = niceTicks(c.spec.min ?? lo, c.spec.max ?? hi, 4);
  const span = t.hi - t.lo || 1;
  const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const at = (i: number, v: number): [number, number] => { const rr = ((v - t.lo) / span) * r; return [cx + Math.cos(ang(i)) * rr, cy + Math.sin(ang(i)) * rr]; };
  const ringPath = (v: number) => "M" + cats.map((_, i) => at(i, v).join(" ")).join("L") + "Z";
  const many = n > 40;
  return (
    <Svg c={c} w={w} h={h}>
      {t.ticks.map((v, i) => <path key={"r" + i} d={ringPath(v)} fill="none" stroke={GRID} strokeWidth="1" />)}
      {cats.map((_, i) => <line key={"s" + i} x1={cx} y1={cy} x2={at(i, t.hi)[0]} y2={at(i, t.hi)[1]} stroke={GRID} strokeWidth="1" />)}
      {t.ticks.slice(1).map((v, i) => <text key={"l" + i} x={cx + 4} y={at(0, v)[1] + 12} fontSize="11" fill={INK3} fontFamily={SANS}>{compact(c.spec.unit, v)}</text>)}
      {cats.map((name, i) => {
        const [x, y] = at(i, t.hi), cos = Math.cos(ang(i)), sin = Math.sin(ang(i));
        const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
        return <text key={"n" + i} x={x + cos * 10} y={y + sin * 12 + 4} textAnchor={anchor} fontSize="12" fill={INK2} fontFamily={SANS}>{fit(name, labelW)}</text>;
      })}
      {series.map((s) => {
        const pts = cats.map((_, i) => at(i, s.values[i] ?? t.lo));
        return (
          <g key={s.name}>
            <path d={"M" + pts.map((q) => q.join(" ")).join("L") + "Z"} fill={c.spec.fill ? col(s.i) : "none"} fillOpacity="0.14" stroke={col(s.i)} strokeWidth="2" strokeLinejoin="round" />
            {c.spec.markers && pts.map((q, i) => s.values[i] !== null && <path key={i} d={shapePath("square", hv === i ? 10 : 8)} transform={`translate(${q[0]} ${q[1]})`} fill={col(s.i)} stroke={PAPER} strokeWidth="4" paintOrder="stroke" />)}
          </g>
        );
      })}
      {cats.map((name, i) => {
        const [x, y] = at(i, t.hi);
        const rows: TipRow[] = series.map((s) => ({ color: col(s.i), name: s.name, value: s.values[i] === null || s.values[i] === undefined ? "no value" : fmtNum(s.values[i]!, c.spec.unit) }));
        return <line key={"h" + i} x1={cx} y1={cy} x2={x} y2={y} stroke="transparent" strokeWidth="28" strokeLinecap="round" {...tt.mark(name, rows, !many, { enter: () => setHv(i), leave: () => setHv(null) })} />;
      })}
    </Svg>
  );
}

// ---- scatter and bubble: two number axes ----

type NumFrame = { x0: number; x1: number; y0: number; y1: number; px: (v: number) => number; py: (v: number) => number; xs: ReturnType<typeof niceTicks>; ys: ReturnType<typeof niceTicks> };
function numFrame(c: Chart, w: number, h: number, xr: [number, number], yr: [number, number], xu: Unit, yu: Unit, padX = 0, padY = 0): NumFrame {
  const xs = niceTicks(xr[0], xr[1], 6), ys = niceTicks(c.spec.min ?? yr[0], c.spec.max ?? yr[1], 5);
  const tickW = Math.max(...ys.ticks.map((v) => textW(compact(yu, v), 12)));
  const x0 = tickW + 14 + (c.spec.yTitle ? 18 : 0) + padX, x1 = w - 16 - padX, y0 = 12 + padY, y1 = h - 26 - (c.spec.xTitle ? 18 : 0) - padY;
  void xu;
  return { x0, x1, y0, y1, xs, ys, px: (v) => x0 + ((v - xs.lo) / (xs.hi - xs.lo || 1)) * (x1 - x0), py: (v) => y1 - ((v - ys.lo) / (ys.hi - ys.lo || 1)) * (y1 - y0) };
}
function NumAxes({ c, f, xu, yu, w, h, xName, yName }: { c: Chart; f: NumFrame; xu: Unit; yu: Unit; w: number; h: number; xName: string; yName: string }) {
  void w;
  const xt = c.spec.xTitle || xName, yt = c.spec.yTitle || yName;
  return (
    <g>
      {f.ys.ticks.map((v, i) => <g key={"y" + i}><line x1={f.x0} x2={f.x1} y1={f.py(v)} y2={f.py(v)} stroke={GRID} strokeWidth="1" /><text x={f.x0 - 8} y={f.py(v) + 4} textAnchor="end" fontSize="12" fill={INK3} fontFamily={SANS}>{compact(yu, v)}</text></g>)}
      {f.xs.ticks.map((v, i) => <g key={"x" + i}><line x1={f.px(v)} x2={f.px(v)} y1={f.y0} y2={f.y1} stroke={GRID} strokeWidth="1" /><text x={f.px(v)} y={f.y1 + 16} textAnchor="middle" fontSize="12" fill={INK3} fontFamily={SANS}>{compact(xu, v)}</text></g>)}
      <line x1={f.x0} x2={f.x1} y1={f.y1} y2={f.y1} stroke={AXIS} strokeWidth="1" />
      <line x1={f.x0} x2={f.x0} y1={f.y0} y2={f.y1} stroke={AXIS} strokeWidth="1" />
      {xt && <text x={(f.x0 + f.x1) / 2} y={h - 4} textAnchor="middle" fontSize="13" fill={INK2} fontFamily={PIXEL} letterSpacing="0.08em">{xt}</text>}
      {yt && <text x={12} y={(f.y0 + f.y1) / 2} textAnchor="middle" fontSize="13" fill={INK2} fontFamily={PIXEL} letterSpacing="0.08em" transform={`rotate(-90 12 ${(f.y0 + f.y1) / 2})`}>{yt}</text>}
    </g>
  );
}

export function ScatterPlot({ p }: { p: PlotProps }) {
  const { c, w, hidden, tt } = p;
  const [hv, setHv] = useState<{ s: number; i: number } | null>(null);
  if (c.data.shape !== "xy") return null;
  const data = c.data;
  const series = data.series.map((s, i) => ({ ...s, i })).filter((s) => !hidden.has(s.name));
  const all = series.flatMap((s) => s.points);
  const xr: [number, number] = all.length ? [Math.min(...all.map((q) => q.x)), Math.max(...all.map((q) => q.x))] : [0, 1];
  const yr: [number, number] = all.length ? [Math.min(...all.map((q) => q.y)), Math.max(...all.map((q) => q.y))] : [0, 1];
  const xu = { prefix: "", suffix: "" }, yu = c.spec.unit;
  const h = c.spec.height ?? 320;
  const f = numFrame(c, w, h, xr, yr, xu, yu);
  const focusable = all.length <= 40;
  const near = (e: React.PointerEvent<SVGRectElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - b.left + f.x0, my = e.clientY - b.top + f.y0;
    let best: { s: number; i: number; d: number } | null = null;
    series.forEach((s) => s.points.forEach((q, i) => { const d = Math.hypot(f.px(q.x) - mx, f.py(q.y) - my); if (d < 28 && (!best || d < best.d)) best = { s: s.i, i, d }; }));
    const hit = best as { s: number; i: number; d: number } | null;
    if (!hit) { setHv(null); tt.hide(); return; }
    setHv({ s: hit.s, i: hit.i });
    const s = data.series[hit.s], q = s.points[hit.i];
    tt.show(e.clientX, e.clientY, s.name, [{ name: data.xName, value: fmtNum(q.x, xu) }, { color: col(hit.s), name: "Value", value: fmtNum(q.y, yu) }]);
  };
  return (
    <Svg c={c} w={w} h={h}>
      <NumAxes c={c} f={f} xu={xu} yu={yu} w={w} h={h} xName={data.xName} yName={series.length === 1 ? series[0].name : ""} />
      {series.map((s) => (
        <g key={s.name}>
          {s.points.map((q, i) => {
            const on = hv && hv.s === s.i && hv.i === i;
            const m = focusable ? tt.mark(s.name, [{ name: data.xName, value: fmtNum(q.x, xu) }, { color: col(s.i), name: "Value", value: fmtNum(q.y, yu) }], true) : {};
            return <path key={i} d={shapePath(SHAPES[s.i % SHAPES.length], on ? 12 : 9)} transform={`translate(${f.px(q.x)} ${f.py(q.y)})`} fill={col(s.i)} stroke={PAPER} strokeWidth="4" paintOrder="stroke" {...(focusable ? { tabIndex: 0, role: "img", "aria-label": m["aria-label"] as string, onFocus: m.onFocus as React.FocusEventHandler, onBlur: m.onBlur as React.FocusEventHandler } : {})} />;
          })}
        </g>
      ))}
      <rect x={f.x0} y={f.y0} width={f.x1 - f.x0} height={f.y1 - f.y0} fill="transparent" onPointerMove={near} onPointerLeave={() => { setHv(null); tt.hide(); }} />
    </Svg>
  );
}

export function BubblePlot({ p }: { p: PlotProps }) {
  const { c, w, tt } = p;
  const [hv, setHv] = useState<number | null>(null);
  if (c.data.shape !== "bubble") return null;
  const data = c.data;
  const pts = data.points;
  const sizeMax = Math.max(...pts.map((q) => q.size));
  const rad = (s: number) => 5 + 21 * Math.sqrt(s / sizeMax); // area follows the number
  const h = c.spec.height ?? 340;
  const xr: [number, number] = [Math.min(...pts.map((q) => q.x)), Math.max(...pts.map((q) => q.x))], yr: [number, number] = [Math.min(...pts.map((q) => q.y)), Math.max(...pts.map((q) => q.y))];
  const f = numFrame(c, w, h, xr, yr, { prefix: "", suffix: "" }, c.spec.unit, 14, 14);
  const order = pts.map((_, i) => i).sort((a, b) => pts[b].size - pts[a].size); // big first, so a small bubble is never hidden under a big one
  const near = (e: React.PointerEvent<SVGRectElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - b.left + f.x0, my = e.clientY - b.top + f.y0;
    let best: { i: number; d: number } | null = null;
    pts.forEach((q, i) => { const d = Math.hypot(f.px(q.x) - mx, f.py(q.y) - my) - rad(q.size); if (d < 14 && (!best || d < best.d)) best = { i, d }; });
    const hit = best as { i: number; d: number } | null;
    if (!hit) { setHv(null); tt.hide(); return; }
    setHv(hit.i);
    const q = pts[hit.i];
    tt.show(e.clientX, e.clientY, q.name, [{ name: data.xName, value: fmtNum(q.x) }, { name: data.yName, value: fmtNum(q.y, c.spec.unit) }, { color: col(0), name: data.sizeName, value: fmtNum(q.size) }]);
  };
  const labelled = new Set(order.slice(0, 6));
  return (
    <Svg c={c} w={w} h={h}>
      <NumAxes c={c} f={f} xu={{ prefix: "", suffix: "" }} yu={c.spec.unit} w={w} h={h} xName={data.xName} yName={data.yName} />
      {order.map((i) => <circle key={i} cx={f.px(pts[i].x)} cy={f.py(pts[i].y)} r={rad(pts[i].size) + (hv === i ? 2 : 0)} fill={col(0)} fillOpacity="0.5" stroke={col(0)} strokeWidth="2" />)}
      {[...labelled].map((i) => { const q = pts[i], r = rad(q.size); const t = fit(q.name, 110); return textW(t, 11, 700) < r * 2 + 40 && r > 8 ? <text key={"l" + i} x={f.px(q.x)} y={f.py(q.y) - r - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} fontFamily={SANS} pointerEvents="none">{t}</text> : null; })}
      <rect x={f.x0} y={f.y0} width={f.x1 - f.x0} height={f.y1 - f.y0} fill="transparent" onPointerMove={near} onPointerLeave={() => { setHv(null); tt.hide(); }} />
    </Svg>
  );
}

// ---- funnel ----

export function FunnelPlot({ p }: { p: PlotProps }) {
  const { c, w, tt } = p;
  if (c.data.shape !== "parts") return null;
  const { parts } = c.data;
  const unit = c.spec.unit;
  const rowH = 36, gap = 2, h = c.spec.height ?? parts.length * rowH + 12;
  const nameW = Math.min(190, Math.max(...parts.map((q) => textW(q.name, 12))) + 26);
  const x0 = nameW, x1 = w - 12, mid = (x0 + x1) / 2, full = x1 - x0;
  const top = Math.max(...parts.map((q) => q.value)) || 1;
  const many = parts.length > 40;
  return (
    <Svg c={c} w={w} h={h}>
      {parts.map((q, i) => {
        const y = 6 + i * rowH, bw = Math.max(2, (q.value / top) * full);
        // stages are ordered, so they take one hue in steps (the last stays 45% or more, where it still reads on paper)
        const share = parts.length > 1 ? 100 - (i * 52) / (parts.length - 1) : 100;
        const fill = mix(col(0), share);
        const first = (q.value / parts[0].value) * 100, prev = i > 0 && parts[i - 1].value ? (q.value / parts[i - 1].value) * 100 : null;
        const label = `${compact(unit, q.value)} · ${pct(first)}`;
        const inside = textW(label, 12, 700) + 12 <= bw;
        const rows: TipRow[] = [{ color: fill, name: "Value", value: fmtNum(q.value, unit) }, { name: "Of the first stage", value: pct(first) }, ...(prev !== null ? [{ name: "Of the stage before", value: pct(prev) }] : [])];
        return (
          <g key={i} {...tt.mark(q.name, rows, !many)}>
            <text x={nameW - 10} y={y + rowH / 2 - gap + 3} textAnchor="end" fontSize="12" fill={INK2} fontFamily={SANS}>{fit(q.name, nameW - 14)}</text>
            <rect x={mid - bw / 2} y={y} width={bw} height={rowH - gap * 2} fill={fill} />
            <text x={inside ? mid : mid + bw / 2 + 6} y={y + rowH / 2 - gap + 3} textAnchor={inside ? "middle" : "start"} fontSize="12" fontWeight="700" fill={inside && share > 62 ? "var(--color-inset)" : INK} fontFamily={SANS} pointerEvents="none">{label}</text>
          </g>
        );
      })}
    </Svg>
  );
}

// ---- treemap ----

type Cell = { node: TreeNode; rect: { x: number; y: number; w: number; h: number }; depth: number; top: number; leaf: boolean; header: number; path: string[] };
function layoutTree(node: TreeNode, rect: Cell["rect"], depth: number, top: number, flat: boolean, path: string[], out: Cell[]) {
  const kids = [...node.children].sort((a, b) => b.value - a.value);
  const rs = squarify(kids.map((k) => k.value), rect);
  kids.forEach((k, idx) => {
    const r = rs[idx];
    const rr = { x: r.x + 1, y: r.y + 1, w: Math.max(0, r.w - 2), h: Math.max(0, r.h - 2) };
    const t = depth === 0 ? (flat ? 0 : node.children.indexOf(k)) : top;
    const p = [...path, k.name];
    if (k.children.length === 0 || depth >= 2) { out.push({ node: k, rect: rr, depth: depth + 1, top: t, leaf: true, header: 0, path: p }); return; }
    const header = rr.h > 40 && rr.w > 56 ? 17 : 0;
    out.push({ node: k, rect: rr, depth: depth + 1, top: t, leaf: false, header, path: p });
    layoutTree(k, { x: rr.x + 2, y: rr.y + header + 2, w: Math.max(0, rr.w - 4), h: Math.max(0, rr.h - header - 4) }, depth + 1, t, flat, p, out);
  });
}

export function TreemapPlot({ p }: { p: PlotProps }) {
  const { c, w, tt } = p;
  if (c.data.shape !== "tree") return null;
  const { root } = c.data;
  const h = c.spec.height ?? Math.max(260, Math.min(420, Math.round(w * 0.5)));
  const flat = root.children.every((k) => k.children.length === 0);
  const cells: Cell[] = [];
  layoutTree(root, { x: 0, y: 0, w, h }, 0, 0, flat, [], cells);
  const unit = c.spec.unit;
  const many = cells.length > 60;
  return (
    <Svg c={c} w={w} h={h}>
      {cells.map((cell, i) => {
        const { rect: r, node, depth } = cell;
        if (r.w < 1 || r.h < 1) return null;
        const share = (node.value / root.value) * 100;
        const rows: TipRow[] = [{ color: col(cell.top), name: "Size", value: fmtNum(node.value, unit) }, { name: "Share of all", value: pct(share) }];
        if (!cell.leaf) {
          return (
            <g key={i}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={mix(col(cell.top), 20)} />
              {cell.header > 0 && <text x={r.x + 6} y={r.y + 13} fontSize="13" fill={INK} fontFamily={PIXEL} letterSpacing="0.06em" pointerEvents="none">{fit(node.name, r.w - 12, 13)}</text>}
            </g>
          );
        }
        const strength = flat ? 90 : 100 - (depth - 1) * 14;
        const dark = strength < 70 || labelInk(cell.top) === "var(--color-text)";
        const room = r.w - 10;
        return (
          <g key={i} {...tt.mark(cell.path.join(" › "), rows, !many)}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={mix(col(cell.top), strength)} />
            {r.h >= 18 && room > 24 && <text x={r.x + 6} y={r.y + 14} fontSize="12" fontWeight="700" fill={dark ? INK : "var(--color-inset)"} fontFamily={SANS} pointerEvents="none">{fit(node.name, room, 12, 700)}</text>}
            {r.h >= 34 && room > 24 && <text x={r.x + 6} y={r.y + 29} fontSize="11" fill={dark ? INK2 : "var(--color-inset)"} fontFamily={SANS} pointerEvents="none">{fit(compact(unit, node.value), room, 11)}</text>}
          </g>
        );
      })}
    </Svg>
  );
}

// ---- sunburst ----

export function SunburstPlot({ p }: { p: PlotProps }) {
  const { c, w, tt } = p;
  if (c.data.shape !== "tree") return null;
  const { root } = c.data;
  const arcs = sunburst(root, 3);
  const depth = Math.max(...arcs.map((a) => a.depth), 1);
  const h = c.spec.height ?? Math.max(300, Math.min(440, Math.round(w * 0.6)));
  const R = Math.max(80, Math.min(h / 2 - 8, w / 2 - 8)), r0 = Math.max(24, R * 0.2), rw = (R - r0) / depth;
  const cx = w / 2, cy = h / 2;
  const unit = c.spec.unit;
  const many = arcs.length > 60;
  return (
    <Svg c={c} w={w} h={h}>
      {arcs.map((a, i) => {
        if (a.a1 - a.a0 < 1e-4) return null;
        const ri = r0 + (a.depth - 1) * rw, ro = ri + rw;
        const strength = 100 - (a.depth - 1) * 20;
        const mid = (a.a0 + a.a1) / 2, rl = (ri + ro) / 2;
        // the room for a horizontal label: across the ring where the arc runs up and down, along the arc where it runs across
        const room = Math.abs(Math.cos(mid)) * rw + Math.abs(Math.sin(mid)) * (a.a1 - a.a0) * rl - 10;
        const label = fit(a.node.name, Math.min((a.a1 - a.a0) * rl - 8, room), 12, 700);
        const dark = strength < 75 || labelInk(a.top) === "var(--color-text)";
        const share = (a.node.value / root.value) * 100;
        const rows: TipRow[] = [{ color: col(a.top), name: "Size", value: fmtNum(a.node.value, unit) }, { name: "Share of all", value: pct(share) }];
        return (
          <g key={i} {...tt.mark(a.path.join(" › "), rows, !many)}>
            <path d={arcPath(cx, cy, ri, ro, a.a0, a.a1)} fill={mix(col(a.top), strength)} stroke={PAPER} strokeWidth="2" />
            {label && rw >= 18 && <text x={cx + Math.cos(mid) * rl} y={cy + Math.sin(mid) * rl + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={dark ? INK : "var(--color-inset)"} fontFamily={SANS} pointerEvents="none">{label}</text>}
          </g>
        );
      })}
      <g pointerEvents="none">
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="18" fill={INK} fontFamily={PIXEL}>{compact(unit, root.value)}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fill={INK3} fontFamily={SANS}>Total</text>
      </g>
    </Svg>
  );
}

// ---- heat map: a grid of cells, one hue light to dark ----

export const HEAT_STEPS = [8, 100]; // the share of the hue over paper at the lowest and the highest value
export function HeatmapPlot({ p }: { p: PlotProps }) {
  const { c, w, tt } = p;
  const [hv, setHv] = useState<{ r: number; k: number } | null>(null);
  if (c.data.shape !== "cat") return null;
  const { cats, series } = c.data;
  const vals = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const unit = c.spec.unit;
  const left = Math.max(36, Math.min(160, Math.max(...cats.map((s) => textW(s, 12))) + 24)), top = 26;
  const cw = Math.max(24, (w - left - 12) / series.length), ch = 30;
  const h = c.spec.height ?? top + cats.length * ch + 46;
  const many = cats.length * series.length > 120;
  const k = Math.max(1, Math.ceil((Math.min(90, Math.max(...series.map((s) => textW(s.name, 12)))) + 8) / cw));
  const shade = (v: number) => HEAT_STEPS[0] + ((v - lo) / span) * (HEAT_STEPS[1] - HEAT_STEPS[0]);
  return (
    <Svg c={c} w={w} h={h}>
      {series.map((s, j) => j % k === 0 && <text key={"h" + j} x={left + j * cw + cw / 2} y={top - 9} textAnchor="middle" fontSize="12" fill={INK2} fontFamily={SANS}>{fit(s.name, cw * k - 6)}</text>)}
      {cats.map((name, i) => <text key={"n" + i} x={left - 8} y={top + i * ch + ch / 2 + 4} textAnchor="end" fontSize="12" fill={INK2} fontFamily={SANS}>{fit(name, left - 12)}</text>)}
      {cats.map((name, i) => series.map((s, j) => {
        const v = s.values[i];
        const x = left + j * cw + 1, y = top + i * ch + 1;
        if (v === null || v === undefined) return <rect key={i + "-" + j} x={x} y={y} width={cw - 2} height={ch - 2} fill="var(--color-surface-3)" opacity="0.4" />;
        const sh = shade(v), text = fmtNum(v, unit, true);
        const rows: TipRow[] = [{ color: mix(col(0), sh), name: s.name, value: fmtNum(v, unit) }];
        return (
          <g key={i + "-" + j} {...tt.mark(`${name}, ${s.name}`, rows, !many, { enter: () => setHv({ r: i, k: j }), leave: () => setHv(null) })}>
            <rect x={x} y={y} width={cw - 2} height={ch - 2} fill={mix(col(0), sh)} stroke={hv && hv.r === i && hv.k === j ? INK : "none"} strokeWidth="2" />
            {textW(text, 11, 700) + 6 <= cw - 2 && <text x={x + (cw - 2) / 2} y={y + (ch - 2) / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={sh > 58 ? "var(--color-inset)" : INK} fontFamily={SANS} pointerEvents="none">{text}</text>}
          </g>
        );
      }))}
      {/* the scale: the same hue from the lowest to the highest number */}
      <g transform={`translate(${left} ${top + cats.length * ch + 14})`}>
        <defs><linearGradient id="kona-heat" x1="0" x2="1"><stop offset="0" stopColor={mix(col(0), HEAT_STEPS[0])} /><stop offset="1" stopColor={mix(col(0), HEAT_STEPS[1])} /></linearGradient></defs>
        <rect x={0} y={0} width={150} height={10} fill="url(#kona-heat)" />
        <text x={0} y={24} fontSize="11" fill={INK3} fontFamily={SANS}>{fmtNum(lo, unit, true)}</text>
        <text x={150} y={24} textAnchor="end" fontSize="11" fill={INK3} fontFamily={SANS}>{fmtNum(hi, unit, true)}</text>
      </g>
    </Svg>
  );
}
