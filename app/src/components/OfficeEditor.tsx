// Edit the office: the map maker (decision 57). A plan of the building from above, a palette of what can be put on it and a live picture of the real office beside it.
// Tools: select and move (a cat and its desk are one thing), paint floor, build walls, hang windows, doors and boards on walls, open doorways, place furniture, erase.
// Everything here changes a draft; nothing is kept until Save, which writes the project's own map (`.kona/office-map.json`). The standard office built into Kona is never changed.
// The logic is in office/edit.ts (tested); this file is the screen.
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Button, Glyph } from "./ui";
import { Confirm } from "./Confirm";
import type { Guard } from "./Sheet";
import { canvasOf, loadSheets, sceneOf, type Sheets } from "./Office";
import { fitScale } from "../lib/mapview";
import { CAT_ROLES, checkMap, parseMap, STANDARD } from "../office/map";
import { addAttach, deleteObject, faceAt, growMap, moveObject, newObject, objectAt, paintFloor, placeObject, removeAttach, setParam, setWall, trimMap, turnObject } from "../office/edit";
import { KINDS, footprintOf } from "../office/engine/furniture";
import { ARTS } from "../office/engine/decor";
import { MATERIALS } from "../office/engine/palette";
import { FACE_N, type OfficeMap } from "../office/engine/types";
import { FRAME_NAMES, CAT_W, CAT_H, catRow } from "./ui";

type Tool = "select" | "floor" | "wall" | "decor" | "doorway" | "furniture" | "erase";
const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Select and move", hint: "Click a thing to pick it up. Drag to move it. R turns it, Delete removes it." },
  { id: "floor", label: "Floor", hint: "Pick a room, then click or drag on the plan to paint its floor." },
  { id: "wall", label: "Walls", hint: "Click or drag to build walls. Start on a wall to take walls away." },
  { id: "decor", label: "On a wall", hint: "Pick what to hang, then click the wall tile, on the side it should face." },
  { id: "doorway", label: "Doorway", hint: "Click a floor tile in a wall to open a doorway (click again to close it)." },
  { id: "furniture", label: "Furniture", hint: "Pick a kind, then click the plan to put it down. A cat and its desk come as one." },
  { id: "erase", label: "Erase", hint: "Click a thing to remove it." },
];
const GROUPS: [string, string][] = [["desks", "Desks and cats"], ["seating", "Seats"], ["tables", "Tables"], ["storage", "Storage"], ["machines", "Machines"], ["boards", "Boards"], ["other", "Other"]];
const GROUP_COLOUR: Record<string, string> = { seating: "#c97b4f", tables: "#b9834a", storage: "#8a5d36", machines: "#7f8896", boards: "#d9c39a", desks: "#e0ad6c", other: "#a8a89a" };
const DECOR: { id: string; label: string; kind: "window" | "door" | "art"; art?: string; span: number }[] = [
  { id: "window", label: "Window", kind: "window", span: 1 }, { id: "door", label: "Door", kind: "door", span: 2 },
  ...Object.entries(ARTS).filter(([k]) => k !== "window" && k !== "door").map(([k, a]) => ({ id: k, label: a.label, kind: "art" as const, art: k, span: k === "cork" ? 5 : k === "staff" ? 4 : 3 })),
];
const ATTACH_COLOUR = { window: "#4a90c2", door: "#8a4e2b", art: "#d9892b", doorway: "#2d2218" } as const;
const SIZES = [12, 16, 20, 26, 32];

export function OfficeEditor({ map, hasOwn, broken, guard, onSave, onReset, onClose }: {
  map: OfficeMap; hasOwn: boolean; broken: string | null; guard: MutableRefObject<Guard | null>; onSave: (m: OfficeMap) => Promise<void>; onReset: () => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<OfficeMap>(map);
  const [saved, setSaved] = useState<OfficeMap>(map);
  const undo = useRef<OfficeMap[]>([]);
  const redo = useRef<OfficeMap[]>([]);
  const [, bump] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [room, setRoom] = useState<string | null>(() => map.rooms.find((r) => r.kind === "hall")?.id ?? map.rooms[0]?.id ?? null); // a room of this map
  const [decor, setDecor] = useState(DECOR[0].id);
  const [span, setSpan] = useState(1);
  const [kind, setKind] = useState("block");
  const [sel, setSel] = useState(-1);
  const [cs, setCs] = useState(16);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [asks, setAsks] = useState<"close" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goAfter = useRef<(() => void) | null>(null);
  const plan = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<{ base: OfficeMap; mode: "add" | "remove" | "move"; k: number; from: [number, number]; at: [number, number]; changed: boolean } | null>(null);

  const dirty = useMemo(() => draft !== saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]); // not worked out again on every move of the pointer
  const warnings = useMemo(() => checkMap(draft), [draft]);

  // ---- changes, with undo
  const commit = (next: OfficeMap, base: OfficeMap = draft) => {
    if (next === base) return;
    undo.current.push(base); if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
    setDraft(next); setError(null); bump((n) => n + 1);
  };
  const doUndo = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(draft); setDraft(p); setSel(-1); bump((n) => n + 1); };
  const doRedo = () => { const n = redo.current.pop(); if (!n) return; undo.current.push(draft); setDraft(n); setSel(-1); bump((n2) => n2 + 1); };

  // ---- leaving: ask first when there is something unsaved (the top bar and the Esc key go through the guard too)
  const leave = (go: () => void) => { if (dirty) { goAfter.current = go; setAsks("close"); } else go(); };
  const latest = useRef({ leave, onClose });
  latest.current = { leave, onClose };
  useEffect(() => { guard.current = { leave: (go) => latest.current.leave(go) }; return () => { guard.current = null; }; }, [guard]);

  // ---- the live picture: it follows the draft a moment after the last change
  const [shown, setShown] = useState<OfficeMap>(map);
  useEffect(() => { const t = setTimeout(() => setShown(draft), 250); return () => clearTimeout(t); }, [draft]);

  // ---- the plan
  const selObj = sel >= 0 ? draft.objects[sel] : undefined;
  const ghost = useMemo(() => {
    if (tool !== "furniture" || !hover) return null;
    const o = newObject(kind, hover[0], hover[1]);
    const f = o && footprintOf(o);
    return f ?? null;
  }, [tool, hover, kind]);
  useEffect(() => {
    const c = plan.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const W = draft.cols * cs, H = draft.rows * cs;
    c.width = W; c.height = H;
    ctx.fillStyle = "#f8f1e1"; ctx.fillRect(0, 0, W, H);
    const roomOf = new Map(draft.rooms.map((r) => [r.id, r]));
    for (let j = 0; j < draft.rows; j++) for (let i = 0; i < draft.cols; i++) {
      const id = draft.floor[j][i], r = id == null ? undefined : roomOf.get(id);
      if (r) { ctx.fillStyle = r.floor[(i + j) & 1]; ctx.fillRect(i * cs, j * cs, cs, cs); }
      if (draft.walls[j][i]) { ctx.fillStyle = "#5a4a38"; ctx.fillRect(i * cs, j * cs, cs, cs); ctx.fillStyle = "#8a7558"; ctx.fillRect(i * cs + 2, j * cs + 2, cs - 4, cs - 4); }
      ctx.strokeStyle = "rgba(45,34,24,0.14)"; ctx.strokeRect(i * cs + 0.5, j * cs + 0.5, cs, cs);
    }
    draft.objects.forEach((o, k) => {
      const kd = KINDS[o.kind], f = kd ? footprintOf(o) : null;
      if (!kd || !f) return;
      const x = f[0] * cs, y = f[1] * cs, w = f[2] * cs, h = f[3] * cs;
      if (o.kind === "rug") { ctx.fillStyle = String(o.c ?? "#c6ece2") + "aa"; ctx.fillRect(x + 1, y + 1, w - 2, h - 2); ctx.strokeStyle = String(o.c2 ?? "#2f8f7c"); ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5); }
      else {
        ctx.fillStyle = GROUP_COLOUR[kd.group] ?? "#a8a89a"; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.strokeStyle = "#33241a"; ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
        if (o.kind === "workstation") { ctx.fillStyle = "#2d2218"; ctx.font = `bold ${Math.max(9, cs * 0.45)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(o.role ?? "?").slice(0, 3).toUpperCase(), x + w / 2, y + h / 2); }
        const n = FACE_N[["j+", "i-", "j-", "i+"][(o.facing ?? 0)] as keyof typeof FACE_N]; // a small mark on the side its front looks towards
        ctx.fillStyle = "#33241a"; ctx.fillRect(x + w / 2 - 3 + n[0] * (w / 2 - 4), y + h / 2 - 3 + n[1] * (h / 2 - 4), 6, 6);
      }
      if (k === sel) { ctx.strokeStyle = "#1a6558"; ctx.lineWidth = 3; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.lineWidth = 1; }
    });
    for (const a of draft.attach) {
      ctx.strokeStyle = ATTACH_COLOUR[a.kind]; ctx.fillStyle = ATTACH_COLOUR[a.kind]; ctx.lineWidth = 4;
      if (a.kind === "doorway") { ctx.fillRect(a.i * cs + 1, a.j * cs + 1, 4, 4); ctx.fillRect(a.i * cs + cs - 5, a.j * cs + cs - 5, 4, 4); ctx.lineWidth = 1; continue; }
      const sp = a.span ?? 1, along = FACE_N[a.face][1] !== 0; // a face that looks along j belongs to a wall that runs along i
      ctx.beginPath();
      if (along) { const y = (a.j + (FACE_N[a.face][1] > 0 ? 1 : 0)) * cs; ctx.moveTo(a.i * cs + 2, y); ctx.lineTo((a.i + sp) * cs - 2, y); }
      else { const x = (a.i + (FACE_N[a.face][0] > 0 ? 1 : 0)) * cs; ctx.moveTo(x, a.j * cs + 2); ctx.lineTo(x, (a.j + sp) * cs - 2); }
      ctx.stroke(); ctx.lineWidth = 1;
    }
    if (ghost) { ctx.fillStyle = "rgba(26,101,88,0.35)"; ctx.fillRect(ghost[0] * cs, ghost[1] * cs, ghost[2] * cs, ghost[3] * cs); }
    if (hover && tool !== "furniture") { ctx.strokeStyle = "#b57a14"; ctx.lineWidth = 2; ctx.strokeRect(hover[0] * cs + 1, hover[1] * cs + 1, cs - 2, cs - 2); ctx.lineWidth = 1; }
  }, [draft, cs, sel, hover, ghost, tool]);

  const cellOf = (e: React.PointerEvent): { i: number; j: number; fx: number; fy: number } | null => {
    const r = plan.current!.getBoundingClientRect(), x = (e.clientX - r.left) / cs, y = (e.clientY - r.top) / cs;
    const i = Math.floor(x), j = Math.floor(y);
    return i < 0 || j < 0 || i >= draft.cols || j >= draft.rows ? null : { i, j, fx: x - i, fy: y - j };
  };
  const decorPick = DECOR.find((d) => d.id === decor) ?? DECOR[0];
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cellOf(e);
    if (!c || e.button !== 0) return;
    plan.current!.setPointerCapture(e.pointerId);
    const { i, j } = c;
    if (tool === "select") {
      const k = objectAt(draft, i, j);
      setSel(k);
      if (k >= 0) stroke.current = { base: draft, mode: "move", k, from: [i, j], at: [draft.objects[k].i, draft.objects[k].j], changed: false };
    } else if (tool === "floor") { stroke.current = { base: draft, mode: "add", k: -1, from: [i, j], at: [i, j], changed: true }; setDraft(paintFloor(draft, i, j, room)); }
    else if (tool === "wall") { const mode = draft.walls[j][i] ? "remove" : "add"; stroke.current = { base: draft, mode, k: -1, from: [i, j], at: [i, j], changed: true }; setDraft(setWall(draft, i, j, mode === "add")); }
    else if (tool === "decor") {
      if (!draft.walls[j][i]) { setError("Hang things on a wall tile."); return; }
      commit(addAttach(draft, { i, j, face: faceAt(c.fx, c.fy), kind: decorPick.kind, art: decorPick.art, span }));
    } else if (tool === "doorway") {
      if (draft.walls[j][i] || draft.floor[j][i] == null) { setError("A doorway goes on a floor tile in a wall line. Take the wall away first."); return; }
      const has = draft.attach.some((a) => a.kind === "doorway" && a.i === i && a.j === j);
      commit(has ? removeAttach(draft, i, j) : addAttach(draft, { i, j, face: "j+", kind: "doorway" }));
    } else if (tool === "furniture") {
      const o = newObject(kind, i, j);
      if (o) { const next = placeObject(draft, o); commit(next); setSel(next.objects.length - 1); setTool("select"); }
    } else if (tool === "erase") {
      const k = objectAt(draft, i, j);
      if (k >= 0) { commit(deleteObject(draft, k)); setSel(-1); }
      else if (draft.attach.some((a) => a.i === i && a.j === j)) commit(removeAttach(draft, i, j, draft.walls[j][i] ? faceAt(c.fx, c.fy) : undefined));
      else if (draft.walls[j][i]) commit(setWall(draft, i, j, false));
    }
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cellOf(e);
    setHover(c ? [c.i, c.j] : null);
    const s = stroke.current;
    if (!s || !c) return;
    if (s.mode === "move") {
      const next = moveObject(s.base, s.k, s.at[0] + c.i - s.from[0], s.at[1] + c.j - s.from[1]);
      if (next !== s.base || s.changed) { s.changed = true; setDraft(next); }
    } else if (tool === "floor") setDraft((d) => paintFloor(d, c.i, c.j, room));
    else if (tool === "wall") setDraft((d) => setWall(d, c.i, c.j, s.mode === "add"));
  };
  const up = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s && s.changed && JSON.stringify(s.base) !== JSON.stringify(draftRef.current)) { undo.current.push(s.base); redo.current = []; bump((n) => n + 1); }
  };
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // ---- the keyboard
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); doUndo(); }
      else if ((e.ctrlKey || e.metaKey) && (k === "y" || (e.shiftKey && k === "z"))) { e.preventDefault(); doRedo(); }
      else if (e.ctrlKey || e.metaKey || e.altKey) return;
      else if (k === "escape") { if (!e.defaultPrevented) { if (sel >= 0) setSel(-1); else latest.current.leave(latest.current.onClose); } }
      else if ((k === "delete" || k === "backspace") && sel >= 0) { e.preventDefault(); commit(deleteObject(draft, sel)); setSel(-1); }
      else if (k === "r" && sel >= 0) commit(turnObject(draft, sel));
      else if (k.startsWith("arrow") && sel >= 0) {
        e.preventDefault(); const o = draft.objects[sel];
        commit(moveObject(draft, sel, o.i + (k === "arrowright" ? 1 : k === "arrowleft" ? -1 : 0), o.j + (k === "arrowdown" ? 1 : k === "arrowup" ? -1 : 0)));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // ---- save and start over
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const m = trimMap(draft), r = parseMap(JSON.stringify(m));
      if (!("map" in r)) throw new Error(r.error);
      await onSave(m);
      setDraft(m); setSaved(m); setSel(-1); undo.current = []; redo.current = [];
    } catch (e) { setError(`Could not save: ${String(e)}`); }
    setBusy(false);
  };
  const reset = async () => {
    setBusy(true); setError(null);
    try { await onReset(); setDraft(STANDARD); setSaved(STANDARD); setSel(-1); undo.current = []; redo.current = []; setAsks(null); }
    catch (e) { setError(`Could not reset: ${String(e)}`); setAsks(null); }
    setBusy(false);
  };

  const hint = TOOLS.find((t) => t.id === tool)!.hint;
  const kd = selObj ? KINDS[selObj.kind] : undefined;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-ground" aria-label="Edit the office">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-1 px-5 py-2">
        <h2 className="m-0 text-[20px] leading-7 font-bold">Edit the office</h2>
        <span className="text-[13px] leading-5 text-text-tertiary">{dirty ? "Not saved yet" : hasOwn ? "This project's own office" : "The standard office"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="quiet" small onClick={doUndo} disabled={undo.current.length === 0} aria-label="Undo (Ctrl+Z)">Undo</Button>
          <Button variant="quiet" small onClick={doRedo} disabled={redo.current.length === 0} aria-label="Redo (Ctrl+Y)">Redo</Button>
          {hasOwn && <Button variant="quiet" small onClick={() => setAsks("reset")} disabled={busy}>Use the standard office</Button>}
          <Button small onClick={() => void save()} disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</Button>
          <Button variant="quiet" small onClick={() => leave(onClose)} aria-label="Close (Esc)">Close</Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[250px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line-subtle bg-surface-1 p-3" aria-label="Tools">
          <div className="flex flex-col gap-1.5" role="group" aria-label="Tools">
            {TOOLS.map((t) => <Button key={t.id} variant={tool === t.id ? "primary" : "quiet"} small onClick={() => setTool(t.id)} aria-pressed={tool === t.id}>{t.label}</Button>)}
          </div>
          <p className="m-0 text-[13px] leading-5 text-text-secondary">{hint}</p>
          {tool === "floor" && (
            <div className="flex flex-col gap-1" role="group" aria-label="Floor of">
              {draft.rooms.map((r) => (
                <button key={r.id} type="button" aria-pressed={room === r.id} onClick={() => setRoom(r.id)} className={`flex items-center gap-2 border px-2 py-1 text-left text-[13px] ${room === r.id ? "border-accent bg-surface-3" : "border-line-subtle"}`}>
                  <i className="inline-block size-3.5 shrink-0 border border-line-strong" style={{ background: r.floor[0] }} />{r.name}
                </button>
              ))}
              <button type="button" aria-pressed={room === null} onClick={() => setRoom(null)} className={`border px-2 py-1 text-left text-[13px] ${room === null ? "border-accent bg-surface-3" : "border-line-subtle"}`}>No ground (the outside)</button>
            </div>
          )}
          {tool === "decor" && (
            <div className="flex flex-col gap-1.5">
              {DECOR.map((d) => <button key={d.id} type="button" aria-pressed={decor === d.id} onClick={() => { setDecor(d.id); setSpan(d.span); }} className={`border px-2 py-1 text-left text-[13px] ${decor === d.id ? "border-accent bg-surface-3" : "border-line-subtle"}`}>{d.label}</button>)}
              {decorPick.kind !== "window" && (
                <label className="flex items-center gap-2 text-[13px] text-text-secondary">Tiles wide
                  <input type="number" min={1} max={12} value={span} onChange={(e) => setSpan(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} aria-label="Tiles wide" className="bare h-8 w-16 border border-line-strong bg-inset px-2 text-text" /></label>
              )}
              <p className="m-0 text-[12px] leading-4 text-text-tertiary">A window or a board shows on the tall brick walls at the back of the side you look from.</p>
            </div>
          )}
          {tool === "furniture" && (
            <div className="flex flex-col gap-2">
              {GROUPS.map(([g, label]) => {
                const list = Object.entries(KINDS).filter(([, k]) => k.group === g);
                return list.length ? (
                  <div key={g} className="flex flex-col gap-1"><span className="text-[12px] font-bold text-text-tertiary">{label}</span>
                    {list.map(([id, k]) => <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={`border px-2 py-1 text-left text-[13px] ${kind === id ? "border-accent bg-surface-3" : "border-line-subtle"}`}>{k.label}</button>)}
                  </div>
                ) : null;
              })}
            </div>
          )}
          <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-3">
            <span className="text-[12px] font-bold text-text-tertiary">Plan zoom</span>
            <div className="flex gap-1.5"><Button variant="quiet" small onClick={() => setCs((c) => SIZES[Math.max(0, SIZES.indexOf(c) - 1)])} disabled={cs === SIZES[0]} aria-label="Zoom the plan out">−</Button>
              <Button variant="quiet" small onClick={() => setCs((c) => SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(c) + 1)])} disabled={cs === SIZES[SIZES.length - 1]} aria-label="Zoom the plan in">+</Button></div>
            <span className="text-[12px] font-bold text-text-tertiary">Make the map bigger</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(["left", "right", "top", "bottom"] as const).map((s) => <Button key={s} variant="quiet" small onClick={() => commit(growMap(draft, s))} aria-label={`Add a ${s === "left" || s === "right" ? "column" : "row"} on the ${s}`}>+ {s}</Button>)}
            </div>
          </div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col" aria-label="Plan">
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <canvas ref={plan} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => setHover(null)} aria-label="The plan of the office from above"
              style={{ cursor: tool === "select" ? "default" : "crosshair", touchAction: "none", imageRendering: "pixelated" }} />
          </div>
        </section>
        <aside className="flex w-[38%] min-w-[300px] max-w-[560px] shrink-0 flex-col border-l border-line-subtle" aria-label="Preview">
          <Preview map={shown} />
        </aside>
      </div>
      <footer className="flex shrink-0 border-t border-line-subtle bg-surface-1">
        <div className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center gap-3 px-4 py-2" role="group" aria-label="The picked thing">
          {selObj && kd ? (
            <>
              <strong className="text-[14px]">{kd.label}</strong>
              {selObj.kind !== "rug" && <Button variant="quiet" small onClick={() => commit(turnObject(draft, sel))} aria-label="Turn it (R)">Turn</Button>}
              {kd.params.map((p) => {
                const v = selObj[p.key];
                if (p.kind === "number") return <label key={p.key} className="flex items-center gap-1.5 text-[13px]">{p.label}<input type="number" min={p.min} max={p.max} value={Number(v ?? 1)} aria-label={p.label} onChange={(e) => commit(setParam(draft, sel, p.key, Math.max(p.min ?? 1, Math.min(p.max ?? 99, Number(e.target.value) || 1))))} className="bare h-8 w-16 border border-line-strong bg-inset px-2 text-text" /></label>;
                if (p.kind === "flag") return <label key={p.key} className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={v === true} onChange={(e) => commit(setParam(draft, sel, p.key, e.target.checked))} />{p.label}</label>;
                if (p.kind === "material") return <label key={p.key} className="flex items-center gap-1.5 text-[13px]">{p.label}<select value={String(v ?? "wood")} onChange={(e) => commit(setParam(draft, sel, p.key, e.target.value))} aria-label={p.label} className="h-8 border border-line-strong bg-inset px-1 text-text">{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></label>;
                if (p.kind === "role") return <label key={p.key} className="flex items-center gap-1.5 text-[13px]">{p.label}<select value={String(v ?? "")} onChange={(e) => commit(setParam(draft, sel, p.key, e.target.value))} aria-label={p.label} className="h-8 border border-line-strong bg-inset px-1 text-text">{CAT_ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>;
                return null;
              })}
              <Button variant="danger" small onClick={() => { commit(deleteObject(draft, sel)); setSel(-1); }} aria-label="Remove it (Delete)">Remove</Button>
            </>
          ) : <span className="text-[13px] text-text-tertiary">Nothing picked. With “Select and move”, click a piece of furniture to change it.</span>}
        </div>
        <div className="max-h-40 min-h-12 w-[38%] min-w-[300px] max-w-[560px] shrink-0 overflow-y-auto border-l border-line-subtle px-4 py-3" aria-label="Warnings">
          {broken && <div className="mb-2 flex items-start gap-2 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> The map saved in this project could not be read ({broken}), so the standard office is shown. Saving replaces that file.</div>}
          {error && <div className="mb-2 flex items-start gap-2 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
          {warnings.length === 0
            ? <div className="flex items-center gap-2 text-[13px] text-text-secondary"><Glyph state="done" size={16} /> Nothing looks wrong.</div>
            : <><div className="mb-1 text-[13px] font-bold text-text-secondary">{warnings.length} thing{warnings.length === 1 ? "" : "s"} to look at (you can still save)</div>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-5 text-text-secondary">{warnings.map((w, n) => <li key={n} className="flex items-start gap-2"><Glyph state="waiting" size={14} />{w}</li>)}</ul></>}
        </div>
      </footer>
      {asks === "close" && (
        <Confirm title="Close without saving?" confirmLabel="Close and lose it" danger onConfirm={() => { const g = goAfter.current; setAsks(null); goAfter.current = null; undo.current = []; g?.(); }} onCancel={() => { setAsks(null); goAfter.current = null; }}>
          <p className="m-0">You changed the office and did not save it. If you close now, the changes are lost.</p>
        </Confirm>
      )}
      {asks === "reset" && (
        <Confirm title="Use the standard office again?" confirmLabel="Use the standard office" danger busy={busy} onConfirm={() => void reset()} onCancel={() => setAsks(null)}>
          <p className="m-0">This project's own office is forgotten and the standard office is shown again. The file is removed from the project's <b>.kona</b> folder. This cannot be undone.</p>
        </Confirm>
      )}
    </div>
  );
}

/** The real office, drawn from the draft, with a turn button. It is a picture only: no clicking, no Kibby. */
function Preview({ map }: { map: OfficeMap }) {
  const [view, setView] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [art, setArt] = useState<Sheets | null>(null);
  const built = useMemo(() => { try { return { scene: sceneOf(map, view), failed: null as string | null }; } catch (e) { return { scene: null, failed: String(e) }; } }, [map, view]);
  const { scene, failed } = built;
  useEffect(() => { let live = true; loadSheets().then((a) => { if (live) setArt(a); }).catch(() => {}); return () => { live = false; }; }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const look = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    look();
    const ro = new ResizeObserver(look);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !scene || !art) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, scene.width, scene.height);
    ctx.drawImage(canvasOf(scene.ground), 0, 0);
    for (const it of scene.items) {
      if (it.kind === "cat") ctx.drawImage(art.sheet, FRAME_NAMES.indexOf("idle") * CAT_W, catRow(it.role!, it.dir ?? 0) * CAT_H, CAT_W, CAT_H, it.x, it.y, CAT_W, CAT_H);
      else if (it.img) ctx.drawImage(canvasOf(it.img), it.x, it.y);
    }
  }, [scene, art]);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const content = scene?.content ?? [0, 0, 1, 1];
  // whole screen pixels when the picture fits at least once; when the pane is smaller than the picture it is shrunk to fit (a preview does not need to be sharp)
  const cw = content[2] - content[0], ch = content[3] - content[1], raw = Math.min(((size.w - 16) * dpr) / cw, ((size.h - 16) * dpr) / ch);
  const sc = raw >= 1 ? fitScale(size.w - 16, size.h - 16, dpr, content as [number, number, number, number]) : Math.max(0.25, raw), k = sc / dpr;
  return (
    <div ref={box} className="relative min-h-0 flex-1 overflow-hidden bg-ground">
      {scene && size.w > 0 && (
        <canvas ref={canvas} width={scene.width} height={scene.height} className="pixel" role="img" aria-label="The office as it will look"
          style={{ position: "absolute", width: scene.width * k, height: scene.height * k, left: Math.round(((size.w / 2 - ((content[0] + content[2]) / 2) * k) * dpr)) / dpr, top: Math.round(((size.h / 2 - ((content[1] + content[3]) / 2) * k) * dpr)) / dpr }} />
      )}
      {failed && <p className="absolute inset-x-3 top-3 m-0 text-[13px] text-state-left">The picture could not be drawn: {failed}</p>}
      <div className="absolute top-3 right-3 flex gap-2" role="group" aria-label="Turn the building">
        <Button variant="quiet" small onClick={() => setView((v) => (v + 3) % 4)} aria-label="Turn the preview to the left">↶</Button>
        <Button variant="quiet" small onClick={() => setView((v) => (v + 1) % 4)} aria-label="Turn the preview to the right">↷</Button>
      </div>
    </div>
  );
}

