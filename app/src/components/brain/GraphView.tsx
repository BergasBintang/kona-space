// A diagram drawn from the text of a ```mermaid block: flowcharts (lib/brain/graph.ts), state diagrams (the same boxes and arrows) and sequence diagrams
// (lib/brain/sequence.ts). The text is the truth: "Show the source" shows exactly what an agent reads, and a diagram Kona cannot draw says why and shows
// the source, so nothing is ever lost.
import { useId, useMemo, useState } from "react";
import { describe, diagramKind, layoutGraph, parseGraph, parseState, type Graph, type Layout, type PNode } from "../../lib/brain/graph.ts";
import { describeSequence, layoutSequence, parseSequence, type Seq, type SeqLayout } from "../../lib/brain/sequence.ts";
import { Glyph } from "../ui";
import { CopyButton } from "./Copy";

let measured: number | null = null;
/** The width of one character of the reading font at the size of a box label, measured once; 8 is the guess where there is no canvas. */
function charWidth(): number {
  if (measured !== null) return measured;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `700 14px ${getComputedStyle(document.body).fontFamily}`;
      const sample = "The quick brown fox jumps over the lazy dog 0123456789";
      measured = Math.ceil((ctx.measureText(sample).width / sample.length) * 10) / 10 + 0.4;
      return measured;
    }
  } catch { /* fall through */ }
  return 8;
}

const INK = "var(--color-text)";
const LINE = "var(--color-line-strong)";
const ARROW = "var(--color-text-secondary)";

function Shape({ n }: { n: PNode }) {
  const common = { fill: "var(--color-surface-2)", stroke: LINE, strokeWidth: 2 };
  const l = n.x - n.w / 2, t = n.y - n.h / 2;
  switch (n.shape) {
    case "start": return <circle cx={n.x} cy={n.y} r={9} fill={INK} />;
    case "end": return <g><circle cx={n.x} cy={n.y} r={12} fill="none" stroke={INK} strokeWidth={2} /><circle cx={n.x} cy={n.y} r={6} fill={INK} /></g>;
    case "diamond": return <polygon points={`${n.x},${t} ${n.x + n.w / 2},${n.y} ${n.x},${t + n.h} ${l},${n.y}`} {...common} />;
    case "circle": return <ellipse cx={n.x} cy={n.y} rx={n.w / 2} ry={n.h / 2} {...common} />;
    case "stadium": return <rect x={l} y={t} width={n.w} height={n.h} rx={n.h / 2} {...common} />;
    case "round": return <rect x={l} y={t} width={n.w} height={n.h} rx={10} {...common} />;
    default: return <rect x={l} y={t} width={n.w} height={n.h} {...common} />;
  }
}

function Marker({ id }: { id: string }) {
  return (
    <defs>
      <marker id={`${id}a`} viewBox="0 0 10 8" refX="9" refY="4" markerWidth="10" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 4 L0 8 Z" fill={ARROW} /></marker>
      <marker id={`${id}o`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke={ARROW} strokeWidth="1.6" /></marker>
      <marker id={`${id}x`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 L9 9 M9 1 L1 9" fill="none" stroke={ARROW} strokeWidth="1.8" /></marker>
    </defs>
  );
}

function FlowSvg({ laid, g, id }: { laid: Layout; g: Graph; id: string }) {
  return (
    <svg role="img" aria-label={describe(g)} width={laid.width} height={laid.height} viewBox={`0 0 ${laid.width} ${laid.height}`} className="mx-auto block max-w-none" style={{ fontFamily: "var(--font-sans)" }}>
      <Marker id={id} />
      {laid.edges.map((e, i) => (
        <path key={i} d={e.path} fill="none" stroke={ARROW} strokeWidth={e.line === "thick" ? 3.5 : 1.75} strokeDasharray={e.line === "dotted" ? "2 5" : undefined} strokeLinecap={e.line === "dotted" ? "round" : undefined}
          markerEnd={e.arrow !== "none" ? `url(#${id}a)` : undefined} markerStart={e.arrow === "both" ? `url(#${id}a)` : undefined} />
      ))}
      {laid.nodes.map((n) => (
        <g key={n.id}>
          <Shape n={n} />
          {n.label !== "" && (
            <text textAnchor="middle" fill={INK} fontSize="14" fontWeight="700">
              {n.lines.map((ln, i) => <tspan key={i} x={n.x} y={n.y + (i - (n.lines.length - 1) / 2) * 18} dominantBaseline="central">{ln}</tspan>)}
            </text>
          )}
        </g>
      ))}
      {laid.edges.filter((e) => e.label).map((e, i) => {
        const parts = e.label.split("\n");
        return (
          <g key={i}>
            <rect x={e.lx - e.lw / 2} y={e.ly - 9 * parts.length} width={e.lw} height={18 * parts.length} fill="var(--color-inset)" />
            <text textAnchor="middle" fill="var(--color-text-secondary)" fontSize="12.5">
              {parts.map((ln, j) => <tspan key={j} x={e.lx} y={e.ly + (j - (parts.length - 1) / 2) * 18} dominantBaseline="central">{ln}</tspan>)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SeqSvg({ laid, s, id }: { laid: SeqLayout; s: Seq; id: string }) {
  const head = { filled: `url(#${id}a)`, open: `url(#${id}o)`, cross: `url(#${id}x)`, none: undefined } as const;
  return (
    <svg role="img" aria-label={describeSequence(s)} width={laid.width} height={laid.height} viewBox={`0 0 ${laid.width} ${laid.height}`} className="mx-auto block max-w-none" style={{ fontFamily: "var(--font-sans)" }}>
      <Marker id={id} />
      {laid.parts.map((p) => <line key={p.id} x1={p.x} x2={p.x} y1={laid.lifeTop} y2={laid.lifeBottom} stroke="var(--color-line-subtle)" strokeWidth={2} strokeDasharray="5 5" />)}
      {laid.rows.map((r, i) => {
        if (r.kind === "band") {
          const label = `${r.word}${r.text ? " " + r.text : ""}`;
          return (
            <g key={i}>
              <line x1={8} x2={laid.width - 8} y1={r.y} y2={r.y} stroke={LINE} strokeWidth={1.25} strokeDasharray="2 4" />
              <rect x={8} y={r.y - 10} width={label.length * 7 + 14} height={20} fill="var(--color-surface-3)" />
              <text x={15} y={r.y} dominantBaseline="central" fill="var(--color-text-secondary)" fontSize="12.5" fontWeight="700">{label}</text>
            </g>
          );
        }
        if (r.kind === "note") {
          return (
            <g key={i}>
              <rect x={r.x - r.w / 2} y={r.y} width={r.w} height={r.h} fill="var(--color-surface-1)" stroke="var(--color-line-subtle)" strokeWidth={1.5} />
              <text textAnchor="middle" fill="var(--color-text-secondary)" fontSize="13">
                {r.lines.map((ln, j) => <tspan key={j} x={r.x} y={r.y + 8 + 9 + j * 18} dominantBaseline="central">{ln}</tspan>)}
              </text>
            </g>
          );
        }
        const dir = r.x2 >= r.x1 ? 1 : -1;
        const path = r.self ? `M ${r.x1} ${r.y} h 34 v 20 h -34` : `M ${r.x1} ${r.y} H ${r.x2}`;
        const textX = r.self ? r.x1 + 44 : (r.x1 + r.x2) / 2;
        const label = r.n !== undefined && r.lines.length ? [`${r.n}. ${r.lines[0]}`, ...r.lines.slice(1)] : r.lines;
        return (
          <g key={i}>
            <path d={path} fill="none" stroke={ARROW} strokeWidth={1.75} strokeDasharray={r.dotted ? "6 4" : undefined} markerEnd={head[r.head]} data-dir={dir} />
            <text textAnchor={r.self ? "start" : "middle"} fill={INK} fontSize="13">
              {label.map((ln, j) => <tspan key={j} x={textX} y={r.self ? r.y + 10 + (j - (label.length - 1) / 2) * 18 : r.y - 8 - (label.length - 1 - j) * 18} dominantBaseline="auto">{ln}</tspan>)}
            </text>
          </g>
        );
      })}
      {laid.parts.map((p) => (
        <g key={p.id}>
          <rect x={p.x - p.w / 2} y={p.y} width={p.w} height={p.h} rx={p.actor ? p.h / 2 : 0} fill="var(--color-surface-2)" stroke={LINE} strokeWidth={2} />
          <text textAnchor="middle" fill={INK} fontSize="14" fontWeight="700">
            {p.lines.map((ln, i) => <tspan key={i} x={p.x} y={p.y + p.h / 2 + (i - (p.lines.length - 1) / 2) * 18} dominantBaseline="central">{ln}</tspan>)}
          </text>
        </g>
      ))}
    </svg>
  );
}

type Made = { type: "flow"; graph: Graph } | { type: "seq"; seq: Seq } | { error: string };

export function GraphView({ source }: { source: string }) {
  const id = useId().replace(/:/g, "");
  const [text, setText] = useState(false);
  const made = useMemo<Made>(() => {
    const kind = diagramKind(source);
    if (kind === "flow" || kind === "state") {
      const p = kind === "flow" ? parseGraph(source) : parseState(source);
      return p.ok ? { type: "flow", graph: p.graph } : { error: p.error };
    }
    if (kind === "sequence") { const p = parseSequence(source); return p.ok ? { type: "seq", seq: p.seq } : { error: p.error }; }
    return { error: `Kona draws flowcharts ("flowchart TD" or "flowchart LR"), sequence diagrams ("sequenceDiagram") and state diagrams ("stateDiagram-v2"). This one starts with "${kind}".` };
  }, [source]);
  const flow = useMemo(() => ("type" in made && made.type === "flow" ? layoutGraph(made.graph, charWidth()) : null), [made]);
  const seq = useMemo(() => ("type" in made && made.type === "seq" ? layoutSequence(made.seq, charWidth()) : null), [made]);

  const shown = source.replace(/\s+$/, "");
  if ("error" in made) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {made.error}</div>
        <div className="relative"><pre className="m-0 overflow-x-auto bg-inset p-3 font-mono text-[13px] leading-5 text-text-secondary">{shown}</pre><CopyButton text={shown} className="absolute top-1.5 right-2 bg-inset px-1 text-[13px] leading-5" /></div>
      </div>
    );
  }
  return (
    <figure className="m-0 flex flex-col gap-2">
      {text ? <pre className="m-0 overflow-x-auto bg-inset p-3 font-mono text-[13px] leading-5 text-text-secondary">{shown}</pre> : (
        <div className="overflow-auto border border-line-subtle bg-inset p-2">
          {flow && made.type === "flow" && <FlowSvg laid={flow} g={made.graph} id={id} />}
          {seq && made.type === "seq" && <SeqSvg laid={seq} s={made.seq} id={id} />}
        </div>
      )}
      <figcaption className="flex justify-end gap-4 text-[13px] leading-5">
        <CopyButton text={shown} label="Copy the source" />
        <button type="button" onClick={() => setText((t) => !t)} aria-pressed={text} className="font-bold text-text-secondary hover:text-text">{text ? "Show the picture" : "Show the source"}</button>
      </figcaption>
    </figure>
  );
}
