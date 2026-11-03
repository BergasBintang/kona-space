// Edit the office: the map maker (decision 57). A plan of the building from above, a palette of what can be put on it and a live picture of the real office beside it.
// Tools: select and move (a cat and its desk are one thing) and erase are two icon buttons; everything that can be put down (a floor, a wall, a doorway, what hangs on a wall,
// furniture) is one list of things with a picture each, and picking a thing chooses the tool that puts it down.
// Everything here changes a draft; nothing is kept until Save, which writes the project's own map (`.kona/office-map.json`). The standard office built into Kona is never changed.
// The logic is in office/edit.ts (tested); this file is the screen.
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Button, Glyph } from "./ui";
import { Help } from "./Help";
import { Confirm } from "./Confirm";
import { Select } from "./pick";
import type { Guard } from "./Sheet";
import { canvasOf, loadSheets, sceneOf, type Sheets } from "./Office";
import { fitScale, pinchBoost } from "../lib/mapview";
import { CAT_ROLES, checkMap, missingPieces, parseMap, STANDARD } from "../office/map";
import { addAttach, artHung, attachCells, attachProblem, doorwayAxis, doorwayProblem, freeSideAt, deleteObject, faceAt, growMap, isPlaced, moveObject, newObject, objectAt, paintFloor, placeObject, removeAttach, setParam, setRugColours, setWall, trimMap, turnObject } from "../office/edit";
import { Pic, Thumb } from "./Thumb";
import { Icon, IconButton } from "./Icon";
import { thumbOfAttach, thumbOfDoorway, thumbOfWall } from "../office/engine/thumb";
import { KINDS, footprintOf } from "../office/engine/furniture";
import { ARTS, UNIQUE_ARTS, WALL_PAGES } from "../office/engine/decor";
import { MATERIALS, WALL_SHADES } from "../office/engine/palette";
import { RUG_PAIRS, STYLES } from "../office/engine/styles";
import { FACE_N, type Obj, type OfficeMap } from "../office/engine/types";
import { FRAME_NAMES, CAT_W, CAT_H, catRow } from "./ui";
import { PLACES } from "../lib/places";

type Tool = "select" | "floor" | "wall" | "decor" | "doorway" | "furniture" | "erase";
const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Select and move", hint: "Click a thing to pick it up. Drag to move it. R turns it, Delete removes it." },
  { id: "floor", label: "Floor", hint: "Pick a floor, then click or drag on the plan to paint it. Paint over a tile to change its floor." },
  { id: "wall", label: "Walls", hint: "Click or drag to build walls. Start on a wall to take walls away." },
  { id: "decor", label: "On a wall", hint: "Pick what to hang, then click the wall tile, on the side it should face." },
  { id: "doorway", label: "Doorway", hint: "A doorway is a gap in a wall. Take a wall tile away, then click that gap to open the doorway (click again to close it)." },
  { id: "furniture", label: "Furniture", hint: "Pick a kind, then click the plan to put it down. A cat and its desk come as one." },
  { id: "erase", label: "Erase", hint: "Click a thing to remove it." },
];
const GROUPS: [string, string][] = [["desks", "Desks and cats"], ["seating", "Seats"], ["tables", "Tables"], ["storage", "Storage"], ["machines", "Machines"], ["boards", "Boards"], ["pages", "Opens a screen"], ["other", "Other"]];
const GROUP_COLOUR: Record<string, string> = { seating: "#c97b4f", tables: "#b9834a", storage: "#8a5d36", machines: "#7f8896", boards: "#d9c39a", desks: "#e0ad6c", pages: "#d9892b", other: "#a8a89a" };
const DECOR: { id: string; label: string; kind: "window" | "door" | "art"; art?: string; span: number }[] = [
  { id: "window", label: "Window", kind: "window", span: 1 }, { id: "door", label: "Door", kind: "door", span: 2 },
  ...Object.entries(ARTS).filter(([k]) => k !== "window" && k !== "door").map(([k, a]) => ({ id: k, label: a.label, kind: "art" as const, art: k, span: k === "cork" ? 5 : k === "staff" ? 4 : 3 })),
];
/** What each screen without a person is for, in a few words (shown when the owner hovers over the part that opens it). */
const SCREEN_USE: Record<string, string> = {
  board: "the tickets, by what stage they are in", workflows: "the step-by-step jobs", worktrees: "the branches and the own copies of a folder", brain: "the notes of the project", files: "the files of the project",
  leftovers: "the work left behind by sessions that ended", servers: "the servers Kona may reach", costs: "what the sessions cost", accounts: "the Claude accounts", settings: "Kona's settings", mockups: "the mockups that people drew, to click through",
};
/** The words for a part that must be in the office: a short line on what it is for and what is lost without it. */
const screenNeed = (page: string) => `Opens the ${PLACES.find((p) => p.id === page)?.label ?? page} screen: ${SCREEN_USE[page] ?? "a page of Kona"}. Without it nothing in the office opens that screen, so the office cannot be saved.`;
const SIDE_WORD: Record<string, string> = { "j-": "top", "j+": "bottom", "i-": "left", "i+": "right" }; // the sides of a wall tile as seen on the plan
const ATTACH_COLOUR = { window: "#4a90c2", door: "#8a4e2b", art: "#d9892b", doorway: "#2d2218" } as const;
const SIZES = [12, 16, 20, 26, 32];

export function OfficeEditor({ names, map, hasOwn, broken, guard, onSave, onReset, onClose }: {
  /** what each role is called, like "Kiki, Product" */ names: Record<string, string>; map: OfficeMap; hasOwn: boolean; broken: string | null; guard: MutableRefObject<Guard | null>; onSave: (m: OfficeMap) => Promise<void>; onReset: () => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<OfficeMap>(map);
  const [saved, setSaved] = useState<OfficeMap>(map);
  const undo = useRef<OfficeMap[]>([]);
  const redo = useRef<OfficeMap[]>([]);
  const [, bump] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [floorId, setFloorId] = useState<string | null>(() => STYLES[0].id); // the floor style the Floor tool paints with (null: no ground)
  const [decor, setDecor] = useState(DECOR[0].id);
  const [span, setSpan] = useState(1);
  const [kind, setKind] = useState("block");
  const [pickRole, setPickRole] = useState<string>(CAT_ROLES[0]?.id ?? ""); // which person's desk the Furniture tool puts down, when the kind is a workstation
  const [mode, setMode] = useState<"plan" | "3d">("plan"); // the plan to edit, or the office in 3D to look at (nothing can be changed there)
  const [sel, setSel] = useState(-1);
  const [cs, setCs] = useState(16);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [frac, setFrac] = useState<[number, number]>([0.5, 0.5]); // where in the tile the pointer is (0 to 1 across, 0 to 1 down): it decides which side of a wall a thing would hang on
  const [asks, setAsks] = useState<"close" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goAfter = useRef<(() => void) | null>(null);
  const plan = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pinch = useRef(0);
  const stroke = useRef<{ base: OfficeMap; mode: "add" | "remove" | "move"; k: number; from: [number, number]; at: [number, number]; changed: boolean } | null>(null);

  const dirty = useMemo(() => draft !== saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]); // not worked out again on every move of the pointer
  const blockers = useMemo(() => missingPieces(draft), [draft]); // what stops the office from being saved: a person or a screen that could not be opened
  const warnings = useMemo(() => checkMap(draft).filter((w) => !blockers.includes(w)), [draft, blockers]);

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

  // ---- the plan
  const selObj = sel >= 0 ? draft.objects[sel] : undefined;
  const ghost = useMemo(() => {
    if (tool !== "furniture" || !hover) return null;
    const o = newObject(kind, hover[0], hover[1]);
    const f = o && footprintOf(o);
    return f ?? null;
  }, [tool, hover, kind]);
  // what a thing on a wall would do if the owner clicked now: the tiles it covers, the side it hangs on, and whether that works
  const hang = useMemo(() => {
    if (tool !== "decor" || !hover || !draft.walls[hover[1]]?.[hover[0]]) return null;
    const [i, j] = hover, d = DECOR.find((x) => x.id === decor) ?? DECOR[0];
    const face = freeSideAt(draft, i, j, frac[0], frac[1]);
    if (!face) return { cells: [[i, j]] as [number, number][], face: null, why: "Every side of this wall tile faces another wall, so nothing hung here could be seen.", a: null };
    const a = { i, j, face, kind: d.kind, art: d.art, span: d.kind === "window" ? 1 : span };
    return { cells: attachCells(a), face, why: attachProblem(draft, a), a };
  }, [tool, hover, frac, draft, decor, span]);
  const doorway = useMemo(() => {
    if (tool !== "doorway" || !hover) return null;
    const [i, j] = hover, has = draft.attach.some((a) => a.kind === "doorway" && a.i === i && a.j === j);
    return { i, j, axis: doorwayAxis(draft, i, j), why: has ? null : doorwayProblem(draft, i, j), has };
  }, [tool, hover, draft]);
  useEffect(() => {
    const c = plan.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const W = draft.cols * cs, H = draft.rows * cs;
    c.width = W; c.height = H;
    ctx.fillStyle = "#f8f1e1"; ctx.fillRect(0, 0, W, H);
    const styleOf = new Map(draft.styles.map((r) => [r.id, r]));
    for (let j = 0; j < draft.rows; j++) for (let i = 0; i < draft.cols; i++) {
      const id = draft.floor[j][i], r = id == null ? undefined : styleOf.get(id);
      if (r) { ctx.fillStyle = r.floor[(i + j) & 1]; ctx.fillRect(i * cs, j * cs, cs, cs); }
      if (draft.walls[j][i]) { ctx.fillStyle = WALL_SHADES[2]; ctx.fillRect(i * cs, j * cs, cs, cs); ctx.fillStyle = WALL_SHADES[1]; ctx.fillRect(i * cs + 2, j * cs + 2, cs - 4, cs - 4); }
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
      if (a.kind === "doorway") { ctx.lineWidth = 1; drawDoorway(ctx, a.i, a.j, doorwayAxis(draft, a.i, a.j), cs, "#2d2218", "#8a4e2b"); continue; }
      const sp = a.span ?? 1, along = FACE_N[a.face][1] !== 0; // a face that looks along j belongs to a wall that runs along i
      ctx.beginPath();
      if (along) { const y = (a.j + (FACE_N[a.face][1] > 0 ? 1 : 0)) * cs; ctx.moveTo(a.i * cs + 2, y); ctx.lineTo((a.i + sp) * cs - 2, y); }
      else { const x = (a.i + (FACE_N[a.face][0] > 0 ? 1 : 0)) * cs; ctx.moveTo(x, a.j * cs + 2); ctx.lineTo(x, (a.j + sp) * cs - 2); }
      ctx.stroke(); ctx.lineWidth = 1;
    }
    if (doorway) { // a doorway under the pointer: how it would look, blue when it can go there and red when it cannot
      ctx.fillStyle = doorway.why ? "rgba(200,30,30,0.35)" : "rgba(31,111,209,0.3)"; ctx.fillRect(doorway.i * cs, doorway.j * cs, cs, cs);
      drawDoorway(ctx, doorway.i, doorway.j, doorway.axis ?? (doorway.why ? null : "i"), cs, doorway.why ? "#c81e1e" : "#1f6fd1", doorway.why ? "#c81e1e" : "#1f6fd1");
    }
    if (hang) { // the tiles it would cover, and a heavy line on the side it would hang on
      const ok = !hang.why, col = ok ? "31,111,209" : "200,30,30";
      ctx.fillStyle = `rgba(${col},0.45)`; for (const [ci, cj] of hang.cells) ctx.fillRect(ci * cs, cj * cs, cs, cs);
      if (hang.a && hang.face) {
        const sp = hang.a.span ?? 1, along = FACE_N[hang.face][1] !== 0;
        ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 6; ctx.beginPath();
        if (along) { const y = (hang.a.j + (FACE_N[hang.face][1] > 0 ? 1 : 0)) * cs; ctx.moveTo(hang.a.i * cs, y); ctx.lineTo((hang.a.i + sp) * cs, y); }
        else { const x = (hang.a.i + (FACE_N[hang.face][0] > 0 ? 1 : 0)) * cs; ctx.moveTo(x, hang.a.j * cs); ctx.lineTo(x, (hang.a.j + sp) * cs); }
        ctx.stroke(); ctx.lineWidth = 1;
      }
    }
    if (ghost) { ctx.fillStyle = "rgba(26,101,88,0.35)"; ctx.fillRect(ghost[0] * cs, ghost[1] * cs, ghost[2] * cs, ghost[3] * cs); }
    if (hover && tool !== "furniture") { ctx.strokeStyle = "#b57a14"; ctx.lineWidth = 2; ctx.strokeRect(hover[0] * cs + 1, hover[1] * cs + 1, cs - 2, cs - 2); ctx.lineWidth = 1; }
  }, [draft, cs, sel, hover, ghost, hang, doorway, tool, mode]); // `mode`: the canvas is made new each time the plan comes back from the 3D view, and must be drawn again

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
    } else if (tool === "floor") { stroke.current = { base: draft, mode: "add", k: -1, from: [i, j], at: [i, j], changed: true }; setDraft(paintFloor(draft, i, j, floorId)); }
    else if (tool === "wall") { const mode = draft.walls[j][i] ? "remove" : "add"; stroke.current = { base: draft, mode, k: -1, from: [i, j], at: [i, j], changed: true }; setDraft(setWall(draft, i, j, mode === "add")); }
    else if (tool === "decor") {
      if (!draft.walls[j][i]) { setError("Hang things on a wall tile."); return; }
      const face = freeSideAt(draft, i, j, c.fx, c.fy); // the side nearest to the click that is not against another wall
      if (!face) { setError("Every side of that wall tile faces another wall, so nothing hung there could be seen. Pick a wall tile that has open floor beside it."); return; }
      const thing = { i, j, face, kind: decorPick.kind, art: decorPick.art, span };
      const why = attachProblem(draft, thing);
      if (why) { setError(why); return; }
      const next = addAttach(draft, thing);
      if (next === draft && decorPick.art && artHung(draft, decorPick.art)) { setError("There is only one of that board in the office, and it is already hung."); return; }
      commit(next);
    } else if (tool === "doorway") {
      const has = draft.attach.some((a) => a.kind === "doorway" && a.i === i && a.j === j);
      const why = has ? null : doorwayProblem(draft, i, j);
      if (why) { setError(why); return; }
      commit(has ? removeAttach(draft, i, j) : addAttach(draft, { i, j, face: "j+", kind: "doorway" }));
    } else if (tool === "furniture") {
      const base = newObject(kind, i, j), o = base && kind === "workstation" ? { ...base, role: pickRole } : base;
      if (o) {
        const next = placeObject(draft, o);
        if (next === draft) { setError("There is only one of that in the office, and it is already there."); return; }
        commit(next); setSel(next.objects.length - 1); setTool("select");
      }
    } else if (tool === "erase") {
      const k = objectAt(draft, i, j);
      if (k >= 0) { commit(deleteObject(draft, k)); setSel(-1); }
      else if (draft.attach.some((a) => a.i === i && a.j === j)) { const one = removeAttach(draft, i, j, draft.walls[j][i] ? faceAt(c.fx, c.fy) : undefined); commit(one !== draft ? one : removeAttach(draft, i, j)); } // the side nearest to the click first; if nothing hangs there, whatever hangs on the tile
      else if (draft.walls[j][i]) commit(setWall(draft, i, j, false));
    }
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cellOf(e);
    setHover(c ? [c.i, c.j] : null);
    if (c) setFrac([c.fx, c.fy]);
    const s = stroke.current;
    if (!s || !c) return;
    if (s.mode === "move") {
      const next = moveObject(s.base, s.k, s.at[0] + c.i - s.from[0], s.at[1] + c.j - s.from[1]);
      if (next !== s.base || s.changed) { s.changed = true; setDraft(next); }
    } else if (tool === "floor") setDraft((d) => paintFloor(d, c.i, c.j, floorId));
    else if (tool === "wall") setDraft((d) => setWall(d, c.i, c.j, s.mode === "add"));
  };
  const up = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s && s.changed && JSON.stringify(s.base) !== JSON.stringify(draftRef.current)) { undo.current.push(s.base); redo.current = []; bump((n) => n + 1); }
  };
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // ---- a pinch on a touchpad (or Ctrl and the wheel) zooms the plan; two fingers sliding move it, because the plan is a scrolling area
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault(); // and the whole window must not zoom
      pinch.current += pinchBoost(e.deltaY * (e.deltaMode === 1 ? 16 : 1));
      const steps = Math.trunc(Math.abs(pinch.current) / 60);
      if (steps === 0) return;
      const dir = pinch.current < 0 ? 1 : -1;
      pinch.current -= Math.trunc(pinch.current / 60) * 60;
      setCs((c) => SIZES[Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(c) + dir * steps))]);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [mode]);

  // ---- the keyboard
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [role=dialog]")) return;
      if (mode === "3d") return; // in 3D nothing can be changed
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
      if (blockers.length > 0) throw new Error(`there is something that nothing could open: ${blockers[0]}`);
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
  const floors = useMemo(() => [...STYLES, ...draft.styles.filter((s) => !STYLES.some((p) => p.id === s.id))], [draft.styles]); // Kona's own floors, then any floor an older office has that Kona's list does not
  const kd = selObj ? KINDS[selObj.kind] : undefined;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-ground" aria-label="Edit the office">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-1 px-5 py-2">
        <h2 className="m-0 text-[20px] leading-7 font-bold">Edit the office</h2>
        <span className="text-[13px] leading-5 text-text-tertiary">{dirty ? "Not saved yet" : hasOwn ? "This project's own office" : "The default map"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="quiet" small onClick={() => { setMode((m) => (m === "plan" ? "3d" : "plan")); setSel(-1); setHover(null); }} aria-pressed={mode === "3d"}>{mode === "plan" ? "See in 3D" : "Back to the plan"}</Button>
          <IconButton icon="undo" label="Undo (Ctrl+Z)" onClick={doUndo} disabled={undo.current.length === 0 || mode === "3d"} />
          <IconButton icon="redo" label="Redo (Ctrl+Y)" onClick={doRedo} disabled={redo.current.length === 0 || mode === "3d"} />
          {hasOwn && <Button variant="quiet" small onClick={() => setAsks("reset")} disabled={busy}>Default map</Button>}
          <IconButton variant="primary" icon="save" label={busy ? "Saving…" : "Save"} onClick={() => void save()} disabled={busy || !dirty || blockers.length > 0} title={blockers.length > 0 ? "Fix what is listed under the plan first" : busy ? "Saving…" : "Save"} />
          <IconButton icon="close" label="Close (Esc)" onClick={() => leave(onClose)} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[330px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line-subtle bg-surface-1 p-3" aria-label="Tools">
          {mode === "3d" ? (
            <div className="flex items-center gap-2"><span className="text-[15px] leading-6 font-bold">Looking only</span><Help title="The 3D view"><p className="m-0">You are looking at the office in 3D. Nothing can be changed here. Turn the building with the arrows, and press “Back to the plan” to go on editing.</p></Help></div>
          ) : (<>
          <div className="flex gap-1.5" role="group" aria-label="Tools">
            {TOOLS.filter((x) => x.id === "select" || x.id === "erase").map((x) => <IconButton key={x.id} icon={x.id === "select" ? "select" : "trash"} label={x.label} variant={tool === x.id ? "primary" : "quiet"} onClick={() => setTool(x.id)} aria-pressed={tool === x.id} />)}
            <span className="flex-1" />
            <span className="flex items-center"><Help title={TOOLS.find((t) => t.id === tool)!.label}><p className="m-0">{hint}</p></Help></span>
          </div>
          <div className="flex flex-col gap-3 border-t border-line-subtle pt-3" role="group" aria-label="Things">
            <div className="flex items-center justify-between gap-2"><h3 className="m-0 text-[14px] leading-5 font-bold">Things</h3><span className="flex items-center gap-1 text-[12px] leading-4 text-text-tertiary"><span className="text-state-waiting"><Icon name="required" /></span>the office needs it</span></div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-text-tertiary">Floor</span>
              <div className="grid grid-cols-12 gap-1" role="group" aria-label="Floor">
                {floors.map((s) => (
                  <button key={s.id} type="button" aria-label={s.name} title={s.name + (STYLES.some((p) => p.id === s.id) ? "" : " (older office)")} aria-pressed={tool === "floor" && floorId === s.id} onClick={() => { setFloorId(s.id); setTool("floor"); }}
                    className={`aspect-square border-2 p-0 ${tool === "floor" && floorId === s.id ? "border-accent outline-2 outline-offset-1 outline-accent" : "border-line-strong"}`}
                    style={{ background: `conic-gradient(${s.floor[0]} 25%, ${s.floor[1]} 0 50%, ${s.floor[0]} 0 75%, ${s.floor[1]} 0)` }} />
                ))}
                <button type="button" aria-label="No ground" title="No ground (the outside)" aria-pressed={tool === "floor" && floorId === null} onClick={() => { setFloorId(null); setTool("floor"); }}
                  className={`flex aspect-square items-center justify-center border-2 border-dashed bg-surface-1 p-0 text-text-tertiary ${tool === "floor" && floorId === null ? "border-accent outline-2 outline-offset-1 outline-accent" : "border-line-strong"}`}><Icon name="close" /></button>
              </div>
              <span className="text-[13px] leading-5 text-text-secondary">{floorId === null ? "No ground (the outside)" : floors.find((s) => s.id === floorId)?.name}</span>
            </div>
            <div className="flex flex-col gap-1"><span className="text-[12px] font-bold text-text-tertiary">Walls</span>
              <Thing pic={<Pic t={thumbOfWall()} />} label="Wall" picked={tool === "wall"} onClick={() => setTool("wall")} />
              <Thing pic={<Pic t={thumbOfDoorway()} />} label="Doorway" picked={tool === "doorway"} onClick={() => setTool("doorway")} />
            </div>
            <div className="flex flex-col gap-1"><span className="text-[12px] font-bold text-text-tertiary">On a wall</span>
              {DECOR.map((d) => {
                const used = d.art !== undefined && UNIQUE_ARTS.includes(d.art) && artHung(draft, d.art); // there is only one of it, and it is already hung
                return <Thing key={d.id} pic={<Pic t={thumbOfAttach({ kind: d.kind, art: d.art, span: d.span })} dim={used} />} label={d.label} used={used} need={d.art && WALL_PAGES[d.art] ? screenNeed(WALL_PAGES[d.art]) : undefined} picked={tool === "decor" && decor === d.id} onClick={() => { setDecor(d.id); setSpan(d.span); setTool("decor"); }} />;
              })}
              {tool === "decor" && decorPick.kind !== "window" && (
                <label className="flex items-center gap-2 text-[13px] text-text-secondary">Tiles wide
                  <input type="number" min={1} max={12} value={span} onChange={(e) => setSpan(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} aria-label="Tiles wide" className="bare h-8 w-16 border border-line-strong bg-inset px-2 text-text" /></label>
              )}
            </div>
            {GROUPS.map(([g, label]) => {
              // a group of the catalog; the group of desks lists each person as an item of their own, so each one can be greyed out once it has its desk
              const items: { key: string; id: string; label: string; obj: Obj; used: boolean; picked: boolean; need?: string; pick: () => void }[] = g === "desks"
                ? [...CAT_ROLES.map((r) => { const o = { ...newObject("workstation", 0, 0)!, role: r.id }; const used = isPlaced(draft, `workstation:${r.id}`); return { key: `ws-${r.id}`, id: "workstation", label: `${names[r.id] ?? r.name}: cat and desk`, obj: o, used, picked: kind === "workstation" && pickRole === r.id, need: `A seat for ${(names[r.id] ?? r.name).split(",")[0]}. Without it ${(names[r.id] ?? r.name).split(",")[0]} is not in the office and cannot be talked to, so the office cannot be saved.`, pick: () => { setKind("workstation"); setPickRole(r.id); } }; }),
                    ...Object.entries(KINDS).filter(([id, k]) => k.group === g && id !== "workstation").map(([id, k]) => ({ key: id, id, label: k.label, obj: newObject(id, 0, 0)!, used: false, picked: kind === id, pick: () => setKind(id) }))]
                : Object.entries(KINDS).filter(([, k]) => k.group === g).map(([id, k]) => ({ key: id, id, label: k.label, obj: newObject(id, 0, 0)!, used: !!k.unique && isPlaced(draft, id), picked: kind === id, need: k.opens ? screenNeed(k.opens) : undefined, pick: () => setKind(id) }));
              return items.length ? (
                <div key={g} className="flex flex-col gap-1"><span className="text-[12px] font-bold text-text-tertiary">{label}</span>
                  {items.map((it) => <Thing key={it.key} pic={<Thumb obj={it.obj} dim={it.used} />} label={it.label} used={it.used} need={it.need} picked={tool === "furniture" && it.picked} onClick={() => { it.pick(); setTool("furniture"); }} />)}
                </div>
              ) : null;
            })}
          </div>
          </>)}
        </aside>
        {mode === "3d" ? (
          <section className="flex min-w-0 flex-1 flex-col" aria-label="The office in 3D"><Preview map={draft} /></section>
        ) : (
          <section className="relative flex min-w-0 flex-1 flex-col" aria-label="Plan">
            <div ref={scroller} className="min-h-0 flex-1 overflow-auto p-3">
              <div className="inline-grid" style={{ gridTemplateColumns: "28px auto 28px", gridTemplateRows: "28px auto 28px" }}>
                <i /><Grow side="top" onGrow={() => commit(growMap(draft, "top"))} /><i />
                <Grow side="left" onGrow={() => commit(growMap(draft, "left"))} />
                <canvas ref={plan} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => setHover(null)} aria-label="The plan of the office from above"
                  style={{ cursor: tool === "select" ? "default" : "crosshair", touchAction: "none", imageRendering: "pixelated" }} />
                <Grow side="right" onGrow={() => commit(growMap(draft, "right"))} />
                <i /><Grow side="bottom" onGrow={() => commit(growMap(draft, "bottom"))} /><i />
              </div>
            </div>
            <div className="absolute top-3 right-6 z-10 flex gap-1.5" role="group" aria-label="Zoom the plan">
              <IconButton icon="zoomIn" label="Zoom the plan in" onClick={() => setCs((c) => SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(c) + 1)])} disabled={cs === SIZES[SIZES.length - 1]} />
              <IconButton icon="zoomOut" label="Zoom the plan out" onClick={() => setCs((c) => SIZES[Math.max(0, SIZES.indexOf(c) - 1)])} disabled={cs === SIZES[0]} />
            </div>
          </section>
        )}
      </div>
      <footer className="flex shrink-0 border-t border-line-subtle bg-surface-1">
        <div className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center gap-3 px-4 py-2" role="group" aria-label="The picked thing">
          {selObj && kd ? (
            <>
              <strong className="text-[14px]">{selObj.kind === "workstation" ? `${names[String(selObj.role)] ?? "A person"}: cat and desk` : kd.label}</strong>
              {selObj.kind !== "rug" && <Button variant="quiet" small onClick={() => commit(turnObject(draft, sel))} aria-label="Turn it (R)">Turn</Button>}
              {selObj.kind === "rug" && (
                <span className="flex items-center gap-1.5 text-[13px]">Colour
                  <Select ariaLabel="Rug colour" className="w-44" value={RUG_PAIRS.find((p) => p.c === selObj.c && p.c2 === selObj.c2)?.name ?? ""} placeholder="An older colour" search={false}
                    onChange={(v) => { const p = RUG_PAIRS.find((x) => x.name === v); if (p) commit(setRugColours(draft, sel, p.c, p.c2)); }} options={RUG_PAIRS.map((p) => ({ value: p.name, label: p.name }))} /></span>
              )}
              {kd.params.map((p) => {
                const v = selObj[p.key];
                if (p.kind === "number") return <label key={p.key} className="flex items-center gap-1.5 text-[13px]">{p.label}<input type="number" min={p.min} max={p.max} value={Number(v ?? 1)} aria-label={p.label} onChange={(e) => commit(setParam(draft, sel, p.key, Math.max(p.min ?? 1, Math.min(p.max ?? 99, Number(e.target.value) || 1))))} className="bare h-8 w-16 border border-line-strong bg-inset px-2 text-text" /></label>;
                if (p.kind === "flag") return <label key={p.key} className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={v === true} onChange={(e) => commit(setParam(draft, sel, p.key, e.target.checked))} />{p.label}</label>;
                if (p.kind === "material") return <span key={p.key} className="flex items-center gap-1.5 text-[13px]">{p.label}<Select ariaLabel={p.label} className="w-36" search={false} value={String(v ?? "wood")} onChange={(x) => commit(setParam(draft, sel, p.key, x))} options={MATERIALS.map((m) => ({ value: m, label: m }))} /></span>;
                if (p.kind === "role") return null; // which person a desk belongs to is chosen in the list of things (each person is one item); to change it, remove the desk and put the other person's down
                return null;
              })}
              <Button variant="danger" small onClick={() => { commit(deleteObject(draft, sel)); setSel(-1); }} aria-label="Remove it (Delete)">Remove</Button>
            </>
          ) : doorway ? (
            <span className={`text-[13px] leading-5 ${doorway.why ? "font-bold text-state-left" : "text-text-secondary"}`}>
              {doorway.why ?? (doorway.has ? "A doorway is here. Click to close it again." : `The wall line opens here: a post stands on each side of the gap. People and Kibby can walk through. Click to open the doorway.`)}
            </span>
          ) : hang ? (
            <span className={`text-[13px] leading-5 ${hang.why ? "font-bold text-state-left" : "text-text-secondary"}`}>
              {hang.why ?? `This ${decorPick.label.toLowerCase()} will hang on the ${SIDE_WORD[hang.face!]} side of this wall${hang.cells.length > 1 ? `, over ${hang.cells.length} tiles` : ""}. Click to hang it.`}
            </span>
          ) : <span className="text-[13px] text-text-tertiary">Nothing picked. With the arrow tool, click a piece of furniture to change it.</span>}
        </div>
        <div className="max-h-40 min-h-12 w-[38%] min-w-[300px] max-w-[560px] shrink-0 overflow-y-auto border-l border-line-subtle px-4 py-3" aria-label="Warnings">
          {broken && <div className="mb-2 flex items-start gap-2 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> The map saved in this project could not be read ({broken}), so the standard office is shown. Saving replaces that file.</div>}
          {error && <div className="mb-2 flex items-start gap-2 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
          {blockers.length > 0 && (
            <><div className="mb-1 text-[13px] font-bold text-state-left">Cannot save yet: {blockers.length} thing{blockers.length === 1 ? "" : "s"} that nothing could open</div>
              <ul className="mb-2 flex list-none flex-col gap-1 p-0 text-[13px] leading-5 text-text-secondary">{blockers.map((w, n) => <li key={n} className="flex items-start gap-2"><Glyph state="left" size={14} />{w}</li>)}</ul></>
          )}
          {warnings.length === 0
            ? (blockers.length === 0 && <div className="flex items-center gap-2 text-[13px] text-text-secondary"><Glyph state="done" size={16} /> Nothing looks wrong.</div>)
            : <><div className="mb-1 text-[13px] font-bold text-text-secondary">{warnings.length} thing{warnings.length === 1 ? "" : "s"} to look at{blockers.length === 0 ? " (you can still save)" : ""}</div>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-5 text-text-secondary">{warnings.map((w, n) => <li key={n} className="flex items-start gap-2"><Glyph state="waiting" size={14} />{w}</li>)}</ul></>}
        </div>
      </footer>
      {asks === "close" && (
        <Confirm title="Close without saving?" confirmLabel="Close and lose it" danger onConfirm={() => { const g = goAfter.current; setAsks(null); goAfter.current = null; undo.current = []; g?.(); }} onCancel={() => { setAsks(null); goAfter.current = null; }}>
          <p className="m-0">You changed the office and did not save it. If you close now, the changes are lost.</p>
        </Confirm>
      )}
      {asks === "reset" && (
        <Confirm title="Go back to the default map?" confirmLabel="Use the default map" danger busy={busy} onConfirm={() => void reset()} onCancel={() => setAsks(null)}>
          <p className="m-0">This project's own office is forgotten and the default map is shown again. The file is removed from the project's <b>.kona</b> folder. This cannot be undone.</p>
        </Confirm>
      )}
    </div>
  );
}

/** How a doorway looks on the plan: the wall line goes on through the gap as a dashed line, and a double arrow across it says that people walk through. `axis` is the way the wall runs; with no wall
 *  at the ends of the gap, a dashed box says it does nothing. */
function drawDoorway(ctx: CanvasRenderingContext2D, i: number, j: number, axis: "i" | "j" | null, cs: number, line: string, arrow: string) {
  const x = i * cs, y = j * cs, m = cs / 2, h = Math.max(3, Math.round(cs * 0.22)); // h: the length of an arrow head
  ctx.save();
  if (!axis) { ctx.strokeStyle = line; ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4); ctx.restore(); return; }
  const tx = (px: number, py: number) => (axis === "i" ? [x + px, y + py] : [x + py, y + px]); // draw as if the wall ran left and right; turned for a wall that runs up and down
  const seg = (ax: number, ay: number, bx: number, by: number) => { const p = tx(ax, ay), q = tx(bx, by); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
  ctx.fillStyle = "rgba(138,78,43,0.22)"; ctx.fillRect(x, y, cs, cs); // the opening is tinted, so a gap stands out from the floor round it
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); seg(0, m, cs, m); // the wall line, open here
  ctx.setLineDash([]); ctx.strokeStyle = arrow; ctx.lineWidth = 2;
  seg(m, 3, m, cs - 3); seg(m, 3, m - h, 3 + h); seg(m, 3, m + h, 3 + h); seg(m, cs - 3, m - h, cs - 3 - h); seg(m, cs - 3, m + h, cs - 3 - h); // across the gap, an arrow at each end
  ctx.restore();
}

/** One thing in the list: a picture and a name. A thing that exists once in the office and is already there is greyed out. */
function Thing({ pic, label, picked, used = false, need, onClick }: { pic: React.ReactNode; label: string; picked: boolean; used?: boolean; /** what it is for, when the office must have it */ need?: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={picked} disabled={used} title={used && !need ? "Already in the office" : undefined} onClick={onClick}
      className={`group relative flex items-center gap-2.5 border p-1.5 text-left text-[13px] ${used ? "cursor-not-allowed border-line-subtle bg-surface-2 text-text-disabled" : picked ? "border-accent bg-surface-3" : "border-line-subtle"}`}>
      {pic}<span className="flex min-w-0 flex-col"><span className="font-bold">{label}</span>{used && <span className="text-[12px] leading-4">Already in the office</span>}</span>
      {need && (
        <span className={`ml-auto shrink-0 self-start ${used ? "text-text-disabled" : "text-state-waiting"}`}>
          <Icon name="required" /><span className="sr-only">Required: </span>
          <span role="tooltip" className="pointer-events-none absolute top-full right-0 z-20 mt-1 hidden w-[230px] border-2 border-line-strong bg-surface-2 p-2 text-[12px] leading-4 font-normal text-text group-hover:block group-focus-visible:block">{need}</span>
        </span>
      )}
    </button>
  );
}

/** A strip along one edge of the plan: a hint that the map can grow there, and the way to do it (one row or column more). */
function Grow({ side, onGrow }: { side: "left" | "right" | "top" | "bottom"; onGrow: () => void }) {
  const word = side === "left" || side === "right" ? "column" : "row";
  return (
    <button type="button" onClick={onGrow} aria-label={`Add a ${word} on the ${side}`} title={`Add a ${word} on the ${side}`}
      className="flex items-center justify-center border border-dashed border-line-strong bg-transparent p-0 text-text-tertiary opacity-70 hover:bg-surface-3 hover:text-text hover:opacity-100"><Icon name="plus" /></button>
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
        <IconButton icon="turnLeft" label="Turn the building to the left" onClick={() => setView((v) => (v + 3) % 4)} />
        <IconButton icon="turnRight" label="Turn the building to the right" onClick={() => setView((v) => (v + 1) % 4)} />
      </div>
    </div>
  );
}

