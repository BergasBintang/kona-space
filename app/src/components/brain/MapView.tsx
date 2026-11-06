// The map: notes as dots, links as lines, groups as soft regions with a name. A dot is filled for the owner's notes, grey for the starter
// notes and a dashed ring for Claude's memory (so the layers differ by shape and fill, not colour alone). A solid line is a link that is
// written in a note; a dashed line is one that was guessed. A dot has no name on the map until the pointer is on it. Pick a dot and its name shows,
// with the names of every dot it is linked to, and the rest turn dim; a click anywhere that is not a dot puts the map back. The map opens zoomed
// to show every group; drag it to move, scroll or the buttons to zoom, Fit all to come back. The box takes all the height the page gives it (down to the
// bottom padding), so the picture follows the real shape of the box, not a fixed one.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupCircle, type Brain } from "../../lib/brain/engine.ts";
import { placeNames, type Box, type Placed } from "../../lib/brain/labels.ts";
import { Button } from "../ui";
import { Chip, LAYER_WORD } from "./NoteView";

const W = 880, H = 560;
type View = { x: number; y: number; w: number }; // the part of the map shown; its height follows from the box's shape

export function MapView({ brain, onOpen }: { brain: Brain; onOpen: (id: string) => void }) {
  // the real size of the picture area; the view's shape follows it. Until it is measured, the shape the map was laid out in.
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: W, h: H });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setSize((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const asp = size.h / size.w; // height per width
  // the layout is made for the shape of the picture area (wide where the box is wide), in steps, so a small resize does not shuffle the map
  const shape = Math.min(2.6, Math.max(1, Math.round((size.w / size.h) * 4) / 4));
  const pos = useMemo(() => brain.layout(H * shape, H), [brain, shape]);
  const [sel, setSel] = useState<string | null>(null);
  const strength = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of brain.edges) { m.set(e.s, (m.get(e.s) ?? 0) + e.w); m.set(e.t, (m.get(e.t) ?? 0) + e.w); }
    return m;
  }, [brain]);
  const [hover, setHover] = useState<string | null>(null);
  const centre = brain.centreNote();
  const note = sel ? brain.notes.get(sel) ?? null : null;
  const linked = useMemo(() => new Set(sel ? brain.edges.filter((e) => e.s === sel || e.t === sel).flatMap((e) => [e.s, e.t]) : []), [brain, sel]);
  const summary = note ? (note.sections[0]?.text.split("\n").map((l) => l.trim()).find((l) => l && !/^#/.test(l)) ?? "").replace(/[*`]/g, "").slice(0, 200) : "";

  const regions = useMemo(() => brain.clusters.filter((c) => c.members.length >= 2).map((c) => {
    const pts = c.members.map((m) => pos.get(m)!).filter(Boolean);
    const { cx, cy, r } = groupCircle(pts); // the layout keeps these circles apart, so both use the same rule
    return { id: c.id, label: c.label, cx, cy, r, n: c.members.length };
  }), [brain, pos]);

  const radius = useCallback((id: string) => brain.radiusOf(id), [brain]); // the layout leaves room for exactly this size

  const groupNames = useMemo<Box[]>(() => regions.map((g) => { const w = (g.label.length + 5) * 6.6, y = g.cy - g.r + 16; return [g.cx - w / 2, y - 11, g.cx + w / 2, y + 3]; }), [regions]);
  // a name shows for the dot under the pointer, and for the picked dot with every dot linked to it (the most connected first, so they win a crowded spot)
  const named = useMemo(() => (sel ? [sel, ...[...linked].filter((id) => id !== sel).sort((a, b) => (strength.get(b) ?? 0) - (strength.get(a) ?? 0) || (a < b ? -1 : 1))] : []), [sel, linked, strength]);
  const labelAt = useMemo(() => (hover || sel ? placeNames({ pos, radius, order: named, chosen: hover ?? sel, letters: (id) => (brain.notes.get(id)?.title ?? "").slice(0, 28).length, taken: groupNames }).names : new Map<string, Placed>()), [pos, radius, named, hover, sel, brain, groupNames]);

  // the group circles can reach past the drawing area, so the first view is the box around all of it
  const fit = useMemo<View>(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number, rx: number, ry = rx) => { x0 = Math.min(x0, x - rx); x1 = Math.max(x1, x + rx); y0 = Math.min(y0, y - ry); y1 = Math.max(y1, y + ry); };
    for (const g of regions) add(g.cx, g.cy, g.r);
    for (const [, p] of pos) add(p.x, p.y, 24);
    if (!Number.isFinite(x0)) return { x: 0, y: 0, w: W };
    // the first view is centred on the Start here note, so the eye lands on it: the box grows to reach as far on the short side as on the long one
    const mid = centre ? pos.get(centre) : undefined;
    if (mid) { const hw = Math.max(mid.x - x0, x1 - mid.x), hh = Math.max(mid.y - y0, y1 - mid.y); x0 = mid.x - hw; x1 = mid.x + hw; y0 = mid.y - hh; y1 = mid.y + hh; }
    let w = x1 - x0 + 40, h = y1 - y0 + 40;
    if (h / w < asp) h = w * asp; else w = h / asp; // grow the box around everything until it has the shape of the picture area
    return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w };
  }, [regions, pos, asp, centre]);

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
      return { x: c.x + (c.w - w) * fx, y: c.y + (c.w - w) * fy * asp, w };
    });
  }, [fit, asp]);

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
  // a press and release that did not move, on anything that is not a dot (the empty map, a group circle, a line), puts the map back to normal
  const release = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId && !d.moved && !(e.target as Element).closest('g[role="button"]')) setSel(null);
    up();
  };

  return (
    <div className="grid min-h-[360px] flex-1 grid-cols-[minmax(0,1fr)_300px] gap-5">
      <div className="flex min-h-0 flex-col overflow-hidden border border-line-subtle bg-surface-1">
        <div ref={boxRef} className="relative min-h-0 flex-1">
        <svg ref={svgRef} viewBox={`${v.x} ${v.y} ${v.w} ${v.w * asp}`} onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={up} onPointerLeave={() => setHover(null)} role="img" aria-label={`A map of ${brain.notes.size} notes in ${brain.clusters.length} groups. The notes tab lists the same notes as text.`} className={`absolute inset-0 block h-full w-full touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}>
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
            const r = radius(id);
            const on = sel === id;
            const at = labelAt.get(id);
            const dim = sel && !on && !linked.has(id);
            const fill = n.layer === "project" ? "var(--color-accent)" : n.layer === "starter" ? "var(--color-text-secondary)" : "var(--color-surface-1)";
            return (
              <g key={id} opacity={dim ? 0.3 : 1} className="cursor-pointer" onClick={() => setSel(id)} onPointerEnter={() => setHover(id)} onPointerLeave={() => setHover((h) => (h === id ? null : h))}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(id); } }} tabIndex={0} role="button" aria-label={`${n.title}, ${LAYER_WORD[n.layer]}${id === centre ? ", the note every session reads first" : ""}`}>
                <circle cx={p.x} cy={p.y} r={r + 8} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={n.layer === "memory" ? "var(--color-text-secondary)" : "none"} strokeWidth="2" strokeDasharray={n.layer === "memory" ? "3 2" : undefined} />
                {id === centre && <circle cx={p.x} cy={p.y} r={r + 10} fill="color-mix(in srgb, var(--color-accent) 14%, transparent)" stroke="var(--color-accent)" strokeWidth="3" data-start-ring="" />}
                {on && <circle cx={p.x} cy={p.y} r={r + (id === centre ? 16 : 5)} fill="none" stroke="var(--color-text)" strokeWidth="2" />}
                {at && <text x={at.x} y={at.y} textAnchor={at.anchor} fontSize="12" fontWeight="700" fill="currentColor" stroke="var(--color-surface-1)" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{n.title.slice(0, 28)}</text>}
              </g>
            );
          })}
        </svg>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-line-subtle px-4 py-2.5 text-[12px] leading-5 text-text-tertiary">
          <span className="flex items-center gap-1.5"><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--color-accent)" /></svg>Your notes</span>
          <span className="flex items-center gap-1.5"><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--color-text-secondary)" /></svg>Starter notes</span>
          <span className="flex items-center gap-1.5"><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeDasharray="3 2" /></svg>Claude's memory</span>
          {centre && <span className="flex items-center gap-1.5"><svg width="16" height="16"><circle cx="8" cy="8" r="6.5" fill="color-mix(in srgb, var(--color-accent) 14%, transparent)" stroke="var(--color-accent)" strokeWidth="2" /><circle cx="8" cy="8" r="2.8" fill="var(--color-text-secondary)" /></svg>Read first by every session</span>}
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

      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border border-line-subtle bg-surface-1 p-4" aria-label="Selected note">
        {!note && <p className="m-0 text-[14px] leading-5 text-text-tertiary">Pick a dot to see its note: what it says, what it links to and what links to it.</p>}
        {note && (
          <>
            <h3 className="m-0 text-[17px] leading-6 font-bold">{note.title}</h3>
            <div className="flex flex-wrap gap-2"><Chip>{LAYER_WORD[note.layer]}</Chip><Chip>Group: {brain.clusters.find((c) => c.id === brain.clusterOf.get(note.id))?.label}</Chip>{note.tickets.map((t) => <Chip key={t}>{t}</Chip>)}</div>
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
