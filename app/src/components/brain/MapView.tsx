// The map: notes as dots, links as lines, groups as soft regions with a name. A dot is filled for the owner's notes, grey for the starter
// notes and a dashed ring for Claude's memory (so the layers differ by shape and fill, not colour alone). A solid line is a link that is
// written in a note; a dashed line is one that was guessed. Pick a dot to see what it says and what it links to. The map opens zoomed to show
// every group; drag it to move, scroll or the buttons to zoom, Fit all to come back.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Brain } from "../../lib/brain/engine.ts";
import { Button } from "../ui";
import { Chip, LAYER_WORD } from "./NoteView";

const W = 880, H = 560;
type View = { x: number; y: number; w: number }; // the part of the map shown; its height follows from W:H

export function MapView({ brain, onOpen }: { brain: Brain; onOpen: (id: string) => void }) {
  const pos = useMemo(() => brain.layout(W, H), [brain]);
  const [sel, setSel] = useState<string | null>(null);
  const strength = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of brain.edges) { m.set(e.s, (m.get(e.s) ?? 0) + e.w); m.set(e.t, (m.get(e.t) ?? 0) + e.w); }
    return m;
  }, [brain]);
  // only the six most connected notes (and the chosen one) carry a name on the map; the rest show it on hover and in the side panel
  const labelled = useMemo(() => new Set([...strength].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id)), [strength]);
  const note = sel ? brain.notes.get(sel) ?? null : null;
  const linked = new Set(sel ? brain.edges.filter((e) => e.s === sel || e.t === sel).flatMap((e) => [e.s, e.t]) : []);
  const summary = note ? (note.sections[0]?.text.split("\n").map((l) => l.trim()).find((l) => l && !/^#/.test(l)) ?? "").replace(/[*`]/g, "").slice(0, 200) : "";

  const regions = useMemo(() => brain.clusters.filter((c) => c.members.length >= 2).map((c) => {
    const pts = c.members.map((m) => pos.get(m)!).filter(Boolean);
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 34;
    return { id: c.id, label: c.label, cx, cy, r, n: c.members.length };
  }), [brain, pos]);

  // the group circles and the names under the dots can reach past the drawing area, so the first view is the box around all of it
  const fit = useMemo<View>(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number, rx: number, ry = rx) => { x0 = Math.min(x0, x - rx); x1 = Math.max(x1, x + rx); y0 = Math.min(y0, y - ry); y1 = Math.max(y1, y + ry); };
    for (const g of regions) add(g.cx, g.cy, g.r);
    for (const [id, p] of pos) add(p.x, p.y, labelled.has(id) ? 90 : 24, 40);
    if (!Number.isFinite(x0)) return { x: 0, y: 0, w: W };
    let w = x1 - x0 + 40, h = y1 - y0 + 40;
    if (w / h < W / H) w = (h * W) / H; else h = (w * H) / W;
    return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w };
  }, [regions, pos, labelled]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; cx: number; cy: number; from: View; moved: boolean } | null>(null);
  useEffect(() => setView(null), [fit]);
  const v = view ?? fit;

  /** Zoom by a factor around a point of the picture (0..1 across and down; the middle by default). */
  const zoomBy = useCallback((f: number, fx = 0.5, fy = 0.5) => {
    setView((cur) => {
      const c = cur ?? fit;
      const w = Math.min(fit.w * 1.6, Math.max(fit.w * 0.15, c.w * f));
      return { x: c.x + (c.w - w) * fx, y: c.y + ((c.w - w) * fy * H) / W, w };
    });
  }, [fit]);

  // the wheel zooms the map. It is added by hand because a wheel handler made by React cannot stop the page from scrolling.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(Math.exp(e.deltaY * 0.0015), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomBy]);

  const down = (e: React.PointerEvent<SVGSVGElement>) => { if (e.button === 0) drag.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, from: v, moved: false }; };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.cx, dy = e.clientY - d.cy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return; // a click on a dot stays a click
      d.moved = true; setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const k = d.from.w / e.currentTarget.getBoundingClientRect().width;
    setView({ x: d.from.x - dx * k, y: d.from.y - dy * k, w: d.from.w });
  };
  const up = () => { drag.current = null; setDragging(false); };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5">
      <div className="overflow-hidden border border-line-subtle bg-surface-1">
        <svg ref={svgRef} viewBox={`${v.x} ${v.y} ${v.w} ${(v.w * H) / W}`} width="100%" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label={`A map of ${brain.notes.size} notes in ${brain.clusters.length} groups. The notes tab lists the same notes as text.`} className={`block touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}>
          {regions.map((g) => (
            <g key={g.id}>
              <circle cx={g.cx} cy={g.cy} r={g.r} fill="color-mix(in srgb, var(--color-accent) 6%, transparent)" stroke="color-mix(in srgb, var(--color-accent) 22%, transparent)" strokeDasharray="3 5" />
              <text x={g.cx} y={g.cy - g.r + 16} textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.6">{g.label} ({g.n})</text>
            </g>
          ))}
          {brain.edges.map((e) => {
            const a = pos.get(e.s), b = pos.get(e.t);
            if (!a || !b) return null;
            const on = sel && (e.s === sel || e.t === sel);
            return <line key={`${e.s}-${e.t}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? "var(--color-accent)" : "var(--color-line-strong)"} strokeWidth={on ? 2 : 1} strokeDasharray={e.trust === "guessed" ? "4 4" : undefined} opacity={sel && !on ? 0.25 : 0.9} />;
          })}
          {brain.order.map((id) => {
            const p = pos.get(id);
            const n = brain.notes.get(id)!;
            if (!p) return null;
            const r = 6 + Math.min(10, Math.sqrt(strength.get(id) ?? 0) * 1.6);
            const on = sel === id;
            const dim = sel && !on && !linked.has(id);
            const fill = n.layer === "project" ? "var(--color-accent)" : n.layer === "starter" ? "var(--color-text-secondary)" : "var(--color-surface-1)";
            return (
              <g key={id} opacity={dim ? 0.3 : 1} className="cursor-pointer" onClick={() => setSel(id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(id); } }} tabIndex={0} role="button" aria-label={`${n.title}, ${LAYER_WORD[n.layer]}`}>
                <circle cx={p.x} cy={p.y} r={r + 8} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={n.layer === "memory" ? "var(--color-text-secondary)" : "none"} strokeWidth="2" strokeDasharray={n.layer === "memory" ? "3 2" : undefined} />
                {on && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke="var(--color-text)" strokeWidth="2" />}
                {(on || labelled.has(id)) && <text x={p.x} y={p.y + r + 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">{n.title.slice(0, 28)}</text>}
                <title>{n.title}</title>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line-subtle px-4 py-2.5 text-[12px] leading-5 text-text-tertiary">
          <span className="flex items-center gap-1.5"><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--color-accent)" /></svg>Your notes</span>
          <span className="flex items-center gap-1.5"><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--color-text-secondary)" /></svg>Starter notes</span>
          <span className="flex items-center gap-1.5"><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeDasharray="3 2" /></svg>Claude's memory</span>
          <span className="flex items-center gap-1.5"><svg width="22" height="12"><line x1="0" y1="6" x2="22" y2="6" stroke="var(--color-text-secondary)" /></svg>written link</span>
          <span className="flex items-center gap-1.5"><svg width="22" height="12"><line x1="0" y1="6" x2="22" y2="6" stroke="var(--color-text-secondary)" strokeDasharray="4 4" /></svg>guessed link</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-text-tertiary">Drag to move, scroll to zoom</span>
            <Button variant="quiet" small onClick={() => zoomBy(1 / 1.4)}>Zoom in</Button>
            <Button variant="quiet" small onClick={() => zoomBy(1.4)}>Zoom out</Button>
            <Button variant="quiet" small onClick={() => setView(null)}>Fit all</Button>
          </span>
        </div>
      </div>

      <aside className="flex flex-col gap-3 border border-line-subtle bg-surface-1 p-4" aria-label="Selected note">
        {!note && <p className="m-0 text-[14px] leading-5 text-text-tertiary">Pick a dot to see its note: what it says, what it links to and what links to it.</p>}
        {note && (
          <>
            <h3 className="m-0 text-[17px] leading-6 font-bold">{note.title}</h3>
            <div className="flex flex-wrap gap-2"><Chip>{LAYER_WORD[note.layer]}</Chip><Chip>Group: {brain.clusters.find((c) => c.id === brain.clusterOf.get(note.id))?.label}</Chip></div>
            {summary && <p className="m-0 text-[14px] leading-5 text-text-secondary">{summary}</p>}
            <div className="flex flex-col gap-1 text-[13px] leading-5 text-text-secondary">
              <span className="font-bold text-text">Links to ({brain.outgoing(note.id).length})</span>
              {brain.outgoing(note.id).slice(0, 6).map((e) => <button key={e.t} type="button" onClick={() => setSel(e.t)} className="truncate text-left hover:text-accent">{brain.notes.get(e.t)?.title} <span className="text-text-tertiary">· {e.trust === "written" ? "written" : "guessed"}</span></button>)}
              <span className="mt-1 font-bold text-text">Linked from ({brain.incoming(note.id).length})</span>
              {brain.incoming(note.id).slice(0, 6).map((e) => <button key={e.s} type="button" onClick={() => setSel(e.s)} className="truncate text-left hover:text-accent">{brain.notes.get(e.s)?.title} <span className="text-text-tertiary">· {e.trust === "written" ? "written" : "guessed"}</span></button>)}
            </div>
            <Button variant="quiet" small onClick={() => onOpen(note.id)}>Open the note</Button>
          </>
        )}
      </aside>
    </div>
  );
}
