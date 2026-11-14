// A chart in a note (the ```chart block, see lib/brain/chart.ts for the syntax): the frame around a drawing, the tooltip, the legend and the table twin. The drawings
// themselves are ChartCartesian.tsx (column, bar, combo, line, area, histogram, pareto, waterfall, box) and ChartRound.tsx (pie, doughnut, radar, scatter, bubble, funnel,
// treemap, sunburst, heat map). Plain SVG, no library; this file is loaded only when a note holds a chart (Markdown.tsx imports it lazily).
//
// Rules kept here: a legend for two series or more (a click hides a series, and the colour of the others stays), the same numbers always one click away as a table, a
// tooltip that never is the only way to read a value (every mark can take the keyboard focus, and the table is there), and no number written on every point.
import { useEffect, useMemo, useRef, useState } from "react";
import { buildChart, tableText, type Chart as ChartData } from "../../lib/brain/chart.ts";
import { Button, Glyph } from "../ui";
import { CopyButton } from "./Copy";
import { MdTable } from "./MdTable";
import { BoxPlot, ColumnPlot, HistogramPlot, LinePlot, ParetoPlot, WaterfallPlot } from "./ChartCartesian";
import { BubblePlot, FunnelPlot, HeatmapPlot, PiePlot, RadarPlot, ScatterPlot, SunburstPlot, TreemapPlot } from "./ChartRound";
import { SHAPES, Swatch, col, type PlotProps, type Tip, type TipRow, type Tt } from "./chartkit";

type LegendItem = { name: string; color: string; kind: "square" | "line" | "marker"; shape?: (typeof SHAPES)[number]; toggle: boolean };

function legendOf(c: ChartData): LegendItem[] {
  const { spec, data } = c;
  if (!spec.legend) return [];
  const k = spec.kind;
  if (data.shape === "cat") {
    if (k === "heatmap" || data.series.length < 2) return [];
    const lines = new Set(spec.lines.map((s) => s.toLowerCase()));
    return data.series.map((s, i) => ({ name: s.name, color: col(i), kind: k === "line" || k === "radar" ? "line" : k === "combo" && lines.has(s.name.toLowerCase()) ? "line" : "square", toggle: true }));
  }
  if (data.shape === "parts") {
    if (k === "pareto") return [{ name: "Value", color: col(0), kind: "square", toggle: false }, { name: "Running share", color: col(1), kind: "line", toggle: false }];
    if (k === "funnel") return [];
    return data.parts.map((p, i) => ({ name: p.name, color: col(i), kind: "square", toggle: false }));
  }
  if (data.shape === "xy") return data.series.length < 2 ? [] : data.series.map((s, i) => ({ name: s.name, color: col(i), kind: "marker", shape: SHAPES[i % SHAPES.length], toggle: true }));
  if (data.shape === "steps") return [{ name: "Increase", color: col(0), kind: "square", toggle: false }, { name: "Decrease", color: col(1), kind: "square", toggle: false }, { name: "Total", color: "var(--color-line-strong)", kind: "square", toggle: false }];
  if (data.shape === "tree") return data.root.children.every((n) => n.children.length === 0) ? [] : data.root.children.map((n, i) => ({ name: n.name, color: col(i), kind: "square", toggle: false }));
  return [];
}

function Plot({ p }: { p: PlotProps }) {
  switch (p.c.spec.kind) {
    case "column": case "bar": case "combo": return <ColumnPlot p={p} />;
    case "line": case "area": return <LinePlot p={p} />;
    case "histogram": return <HistogramPlot p={p} />;
    case "pareto": return <ParetoPlot p={p} />;
    case "waterfall": return <WaterfallPlot p={p} />;
    case "box": return <BoxPlot p={p} />;
    case "pie": case "doughnut": return <PiePlot p={p} />;
    case "radar": return <RadarPlot p={p} />;
    case "scatter": return <ScatterPlot p={p} />;
    case "bubble": return <BubblePlot p={p} />;
    case "funnel": return <FunnelPlot p={p} />;
    case "treemap": return <TreemapPlot p={p} />;
    case "sunburst": return <SunburstPlot p={p} />;
    case "heatmap": return <HeatmapPlot p={p} />;
  }
}

export default function Chart({ source }: { source: string }) {
  const read = useMemo(() => buildChart(source), [source]);
  if ("error" in read) {
    return (
      <div className="my-3 flex flex-col gap-3 border border-line-subtle bg-inset p-4">
        <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /><span>This chart cannot be drawn: {read.error}</span></div>
        {read.table && <MdTable table={read.table} source={tableText(read.table)} cell={(s, key) => <span key={key}>{s}</span>} />}
      </div>
    );
  }
  return <ChartFigure c={read} />;
}

function ChartFigure({ c }: { c: ChartData }) {
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tip, setTip] = useState<Tip | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(Math.floor(el.clientWidth));
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const w = Math.max(260, Math.min(1100, width || 640));

  const tt = useMemo<Tt>(() => {
    const place = (cx: number, cy: number, title: string, rows: TipRow[]) => {
      const r = box.current?.getBoundingClientRect();
      if (r) setTip({ x: cx - r.left, y: cy - r.top, title, rows });
    };
    return {
      show: place,
      hide: () => setTip(null),
      mark: (title, rows, focus = true, hover) => ({
        onPointerMove: (e: React.PointerEvent) => { hover?.enter(); place(e.clientX, e.clientY, title, rows); },
        onPointerLeave: () => { hover?.leave(); setTip(null); },
        ...(focus ? {
          tabIndex: 0,
          onFocus: (e: React.FocusEvent) => { hover?.enter(); const t = (e.currentTarget as Element).getBoundingClientRect(); place(t.left + t.width / 2, t.top, title, rows); },
          onBlur: () => { hover?.leave(); setTip(null); },
        } : {}),
        role: "img",
        "aria-label": `${title}: ${rows.map((r) => `${r.name} ${r.value}`).join(", ")}`,
      }),
    };
  }, []);

  const legend = legendOf(c);
  const toggle = (name: string) => setHidden((s) => {
    const n = new Set(s);
    if (n.has(name)) n.delete(name);
    else if (legend.filter((l) => l.toggle && !s.has(l.name)).length > 1) n.add(name); // the last drawn series stays
    return n;
  });

  return (
    <figure className="m-0 my-3 border border-line-subtle bg-inset px-4 pt-3 pb-3" aria-label={c.spec.title || `${c.spec.kind} chart`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <figcaption className="font-pixel min-w-0 text-[17px] leading-6 text-text">{c.spec.title}</figcaption>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="quiet" tiny aria-pressed={table} on={table} onClick={() => setTable((t) => !t)}>{table ? "Hide the table" : "Show the table"}</Button>
          <CopyButton text={tableText(c.table)} label="Copy data" />
        </div>
      </div>
      {legend.length > 0 && (
        <ul className="m-0 mb-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0" aria-label="Legend">
          {legend.map((l) => {
            const off = hidden.has(l.name);
            const inner = (<><Swatch color={l.color} kind={l.kind} shape={l.shape} /><span className={off ? "text-text-disabled line-through" : "text-text-secondary"}>{l.name}</span></>);
            return (
              <li key={l.name}>
                {l.toggle
                  ? <button type="button" aria-pressed={!off} title={off ? "Show this series" : "Hide this series"} onClick={() => toggle(l.name)} className="font-pixel inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[14px] leading-5">{inner}</button>
                  : <span className="font-pixel inline-flex items-center gap-1.5 text-[14px] leading-5">{inner}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <div ref={wrap} className="w-full">
        <div ref={box} className="relative" style={{ width: w }}>
          <Plot p={{ c, w, hidden, tt }} />
          {tip && (
            <div aria-hidden="true" className="pointer-events-none absolute z-20 max-w-[260px] border-2 border-line-strong bg-surface-2 px-2.5 py-1.5 px-shadow"
              style={{ left: tip.x, top: tip.y, transform: `translate(${tip.x > w / 2 ? "calc(-100% - 12px)" : "12px"}, ${tip.y > 90 ? "calc(-100% - 10px)" : "10px"})` }}>
              <div className="font-pixel text-[14px] leading-5 text-text">{tip.title}</div>
              {tip.rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] leading-5 text-text-secondary">
                  {r.color ? <span className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: r.color }} /> : <span className="inline-block h-2.5 w-2.5 shrink-0" />}
                  <span className="min-w-0 flex-1">{r.name}</span>
                  <span className="font-bold tabular-nums text-text">{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {c.notes.map((n, i) => <p key={i} className="m-0 mt-2 flex items-start gap-2 text-[13px] leading-5 text-text-secondary"><Glyph state="waiting" size={16} />{n}</p>)}
      {table && <div className="mt-3"><MdTable table={c.table} source={tableText(c.table)} cell={(s, key) => <span key={key}>{s}</span>} /></div>}
    </figure>
  );
}
