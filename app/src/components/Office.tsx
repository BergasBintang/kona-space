// The office: the map of the project drawn as a building (office/engine/). The map says what is where; the scene (office/engine/scene.ts) turns it into a picture of the ground and a
// list of pieces, from back to front, which are drawn on one canvas at the picture's own size, then shown at a whole number of screen pixels for each pixel so every pixel stays square.
// The cats are in the same list, so a cat is drawn between the pieces behind it and the pieces in front of it. The building is drawn from four sides; two buttons turn it a quarter.
// Hover a room to light it and see its name; click it to open what it holds in the sheet that slides up from below (App.tsx, components/Sheet.tsx).
// The map has its own zoom and its own place in the window (lib/mapview.ts), not the window's percent view: the mouse wheel moves it up and down, Shift and the wheel left and right,
// Ctrl and the left button drags it, Ctrl and the wheel (or the + and - keys) zoom round the pointer, and Center brings the secretary's desk back to the middle.
// A cat's state is the real state of that role's session in this project: typing is "working", a raised paw is "waiting on you".
// Kibby, the office boy, walks the open floor of the hall with a small hop and a small lean; click him to talk (KibbyChat). He stands still while the sheet is open or he is talking,
// and with "reduce motion". While the sheet is open the building cannot be turned and its rooms cannot be clicked.
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Button, Glyph, CAT_SHEET, CAT_W, CAT_H, FRAME_NAMES, catRow, KIB_SHEET, KIB_FRAMES, KIB_W, KIB_H } from "./ui";
import { KibbyChat, type Turn } from "./KibbyChat";
import { pose, startWalker, step, stillValid, talking, TICK_MS, type Pose, type Walker } from "../lib/kibby";
import type { Place } from "../lib/places";
import { DESKS, PAGES } from "../lib/rooms";
import { NO_LOOKS, type Look } from "../lib/office";
import { clampCenter, fitScale, origin, stepScale, wheelPan, wheelZoom, zoomAround, type Pt } from "../lib/mapview";
import { buildScene, type Scene } from "../office/engine/scene";
import type { Img } from "../office/engine/img";
import type { OfficeMap } from "../office/engine/types";
import { STANDARD } from "../office/map";

const VIEW_KEY = "kona.office.view";
const SCALE_KEY = "kona.office.zoom";
const savedView = () => { try { const n = Number(localStorage.getItem(VIEW_KEY)); return Number.isInteger(n) && n >= 0 && n < 4 ? n : 0; } catch { return 0; } };
const savedScale = () => { try { const n = Number(localStorage.getItem(SCALE_KEY)); return Number.isInteger(n) && n >= 1 ? n : null; } catch { return null; } };
const IDLE: Look = { mode: "idle", word: null, glyph: null, sessionId: null };
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The scenes of a map, one for each side, built when first asked for and kept while the map is the same one. */
const scenes = new WeakMap<OfficeMap, Scene[]>();
export function sceneOf(map: OfficeMap, view: number): Scene {
  let list = scenes.get(map);
  if (!list) { list = []; scenes.set(map, list); }
  if (!list[view]) { try { list[view] = buildScene(map, view); } catch (e) { console.warn("The office map could not be drawn; the standard office is shown instead.", e); list[view] = map === STANDARD ? (() => { throw e; })() : sceneOf(STANDARD, view); } }
  return list[view];
}

/** A picture of the engine as a canvas the browser can draw, made once. */
const canvases = new WeakMap<Img, HTMLCanvasElement>();
export function canvasOf(img: Img): HTMLCanvasElement {
  let c = canvases.get(img);
  if (!c) {
    c = document.createElement("canvas"); c.width = img.w; c.height = img.h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.d), img.w, img.h), 0, 0);
    canvases.set(img, c);
  }
  return c;
}

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error(`could not load ${url}`)); im.src = url; });
export type Sheets = { sheet: HTMLImageElement; kibby: HTMLImageElement };
let sheets: Promise<Sheets> | null = null;
export const loadSheets = () => (sheets ??= Promise.all([loadImage(CAT_SHEET), loadImage(KIB_SHEET)]).then(([sheet, kibby]) => ({ sheet, kibby })));

/** Which picture of the cat to show: its state in the project decides, and a cat blinks now and then. */
export function frameOf(phase: number, look: Look, tick: number) {
  const blink = (tick + phase) % 18 === 0;
  switch (look.mode) {
    case "typing": return tick % 2 ? "typeB" : "typeA";
    case "waiting": return Math.floor(tick / 2) % 2 ? "waitB" : "waitA";
    case "done": return blink ? "blink" : "happy";
    default: return blink ? "blink" : "idle";
  }
}

/** The building and its cats, drawn piece by piece from back to front. It keeps its own clock (four steps a second, paused when the window is hidden), so only this redraws. */
function Scene2({ scene, looks, kibby, chatting, paused }: { scene: Scene; looks: Record<string, Look>; kibby: Pose | null; chatting: boolean; paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [art, setArt] = useState<Sheets | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; loadSheets().then((a) => { if (live) setArt(a); }).catch(() => {}); return () => { live = false; }; }, []);
  useEffect(() => {
    if (reducedMotion() || paused) return; // the cats hold still while the sheet covers the office
    const t = setInterval(() => { if (!document.hidden) setTick((n) => n + 1); }, 250);
    return () => clearInterval(t);
  }, [paused]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !art) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, scene.width, scene.height);
    ctx.drawImage(canvasOf(scene.ground), 0, 0);
    let kib = kibby; // drawn between the pieces behind him and the pieces in front of him
    if (kib && chatting) kib = talking(kib);
    const drawKibby = () => { if (kib) ctx.drawImage(art.kibby, KIB_FRAMES.indexOf(kib.frame) * KIB_W, kib.dir * KIB_H, KIB_W, KIB_H, kib.x, kib.y, KIB_W, KIB_H); };
    for (let idx = 0; idx < scene.items.length; idx++) {
      const it = scene.items[idx];
      if (kib && kib.k === idx) drawKibby();
      if (it.kind === "cat") {
        const role = it.role!, f = FRAME_NAMES.indexOf(frameOf(scene.cats.findIndex((c) => c.role === role) * 5, looks[role] ?? IDLE, tick));
        ctx.drawImage(art.sheet, f * CAT_W, catRow(role, it.dir ?? 0) * CAT_H, CAT_W, CAT_H, it.x, it.y, CAT_W, CAT_H);
      } else if (it.img) ctx.drawImage(canvasOf(it.img), it.x, it.y);
    }
    if (kib && kib.k >= scene.items.length) drawKibby();
  }, [scene, art, looks, tick, kibby, chatting]);
  return <canvas ref={canvas} width={scene.width} height={scene.height} role="img" aria-label="The Kona office, a building with a room for each place" className="pixel" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none" }} />;
}

/** The speech bubbles over the cats that are doing something. */
function Bubbles({ scene, looks }: { scene: Scene; looks: Record<string, Look> }) {
  const { cats, width: W, height: H } = scene;
  return (
    <>
      {cats.map((c) => {
        const look = looks[c.role];
        if (!look?.word || !look.glyph) return null;
        return (
          <span key={c.role} className="font-pixel pointer-events-none absolute flex -translate-x-1/2 -translate-y-full items-center gap-1 border-2 border-line-strong bg-surface-2 px-1.5 text-[12px] leading-5 font-bold whitespace-nowrap text-text px-shadow"
            style={{ left: `${((c.x + 14) / W) * 100}%`, top: `${((c.y + 2) / H) * 100}%` }}>
            <Glyph state={look.glyph} size={16} />{look.word}
          </span>
        );
      })}
    </>
  );
}

/** The building with its cats, and Kibby on the hall. He keeps his own clock (eight steps a second) here, so only the drawing and his click box change as he walks. `children` (the
 * rooms' click areas) sit between the picture and Kibby's click box, and do not redraw on his steps. */
function Living({ scene, looks, sheetOpen, chatting, onTalk, children }: { scene: Scene; looks: Record<string, Look>; sheetOpen: boolean; chatting: boolean; onTalk: () => void; children: React.ReactNode }) {
  const [walker, setWalker] = useState<Walker | null>(() => startWalker(scene.walkable));
  const [near, setNear] = useState(false);
  const paused = sheetOpen || chatting;
  const walkable = scene.walkable;
  useEffect(() => { setWalker((w) => (w && stillValid(w, walkable) ? w : startWalker(walkable))); }, [walkable]); // after the map changed, he starts again if his tile is gone
  useEffect(() => {
    if (paused || reducedMotion()) return;
    const t = setInterval(() => { if (!document.hidden) setWalker((w) => (w ? step(w, walkable, Math.random) : w)); }, TICK_MS);
    return () => clearInterval(t);
  }, [paused, walkable]);
  const { width: W, height: H } = scene;
  const p = useMemo(() => (walker ? pose(scene, walker) : null), [scene, walker]);
  return (
    <>
      <Scene2 scene={scene} looks={looks} kibby={p} chatting={chatting} paused={sheetOpen} />
      <Bubbles scene={scene} looks={looks} />
      {children}
      {p && !sheetOpen && (
        <>
          <button type="button" aria-label="Talk to Kibby, the office boy" onClick={onTalk} onPointerEnter={() => setNear(true)} onPointerLeave={() => setNear(false)} onFocus={() => setNear(true)} onBlur={() => setNear(false)}
            className="absolute m-0 cursor-pointer border-0 bg-transparent p-0 outline-none"
            style={{ left: `${((p.x + 6) / W) * 100}%`, top: `${((p.y + 2) / H) * 100}%`, width: `${(16 / W) * 100}%`, height: `${(18 / H) * 100}%` }} />
          {near && !chatting && (
            <span className="font-pixel pointer-events-none absolute -translate-x-1/2 -translate-y-full border-2 border-line-strong bg-surface-2 px-1.5 text-[12px] leading-5 font-bold whitespace-nowrap text-text px-shadow"
              style={{ left: `${((p.x + 14) / W) * 100}%`, top: `${((p.y + 2) / H) * 100}%` }}>Kibby</span>
          )}
        </>
      )}
    </>
  );
}

export const Office = memo(function Office({ map, looks = NO_LOOKS, sheetOpen, onOpen, onOpenRoom, onKibbySay, onEdit }: {
  map: OfficeMap; looks?: Record<string, Look>; sheetOpen: boolean; onOpen: (p: Place) => void; onOpenRoom: (room: string) => void; onKibbySay: (history: Turn[], message: string) => Promise<string>; onEdit?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [chatting, setChatting] = useState(false);
  const [view, setView] = useState(savedView);
  const [scale, setScale] = useState<number | null>(savedScale); // screen pixels for each pixel of the drawing; null until the player zooms: the whole building fits
  const [ctr, setCtr] = useState<Pt | null>(null); // the drawing point in the middle of the window; null: the middle of the building
  const scene = useMemo(() => sceneOf(map, view), [map, view]);
  const { width: W, height: H, rooms: ROOMS } = scene;
  const [CX0, CY0, CX1, CY1] = scene.content;
  const turn = (by: number) => {
    if (sheetOpen) return; // the building cannot be turned while the sheet is open: close it first
    setCtr(null);
    setView((v) => {
      const n = (v + by + 4) % 4;
      try { localStorage.setItem(VIEW_KEY, String(n)); } catch { /* the side is only a convenience */ }
      return n;
    });
  };
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // a room with cats opens their list; every other room opens its first page (a room with two pages shows the second as a tab)
  const open = (id: string) => {
    if (sheetOpen || drag.current) return; // the end of a drag is not a click
    if ((DESKS[id] ?? []).length > 0) onOpenRoom(id);
    else if (PAGES[id]?.[0]) onOpen(PAGES[id][0]);
  };

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
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && chatting) setChatting(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [chatting]);
  useEffect(() => { if (sheetOpen) { setChatting(false); setHover(null); } }, [sheetOpen]);

  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1; // screen pixels for each CSS pixel: the percent view and Windows scaling both change it
  const content: [number, number, number, number] = [CX0, CY0, CX1, CY1];
  const sc = scale ?? fitScale(size.w, size.h - 4, dpr, content);
  const k = sc / dpr; // CSS pixels for each pixel of the drawing: a whole number of screen pixels, so every pixel stays square and sharp
  const centre = clampCenter(ctr ?? { x: (CX0 + CX1) / 2, y: (CY0 + CY1) / 2 }, content);
  const left = origin(size.w, centre.x, k, dpr);
  const top = origin(size.h, centre.y, k, dpr);
  const secretary = scene.cats.find((c) => c.role === "secretary");
  const live = useRef({ k, centre, sc, content, sheetOpen, chatting }); // what the mouse handlers below read, so they are set up once
  live.current = { k, centre, sc, content, sheetOpen, chatting };
  const zoomTo = (n: number) => { setScale(n); try { localStorage.setItem(SCALE_KEY, String(n)); } catch { /* the zoom is only a convenience */ } };
  const wheelCarry = useRef(0);
  /** zoom `times` steps; with a pointer place (x, y on the screen) the point under it stays where it is, else the middle of the window does */
  const zoom = (dir: 1 | -1, x?: number, y?: number, times = 1) => {
    const l = live.current;
    let n = l.sc;
    for (let t = 0; t < times; t++) n = stepScale(n, dir);
    if (n === l.sc) return;
    const el = box.current;
    if (el && x !== undefined && y !== undefined) {
      const r = el.getBoundingClientRect(), off = { x: x - (r.x + r.width / 2), y: y - (r.y + r.height / 2) };
      setCtr(clampCenter(zoomAround(l.centre, off, l.k, n / dpr), l.content));
    }
    zoomTo(n);
  };
  const home = () => setCtr(clampCenter(secretary ? { x: secretary.x + 14, y: secretary.y + 10 } : { x: (CX0 + CX1) / 2, y: (CY0 + CY1) / 2 }, content)); // the secretary's cat is 28 x 20
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const pan = (dx: number, dy: number) => setCtr((c) => { const l = live.current; const at = c ?? l.centre; return clampCenter({ x: at.x + dx, y: at.y + dy }, l.content); });
    const wheel = (e: WheelEvent) => {
      if (live.current.sheetOpen || live.current.chatting) return; // Kibby's chat scrolls with the wheel
      e.preventDefault(); // (and Ctrl and the wheel must not zoom the whole window)
      if (e.ctrlKey) { // zoom round the pointer
        const z = wheelZoom(wheelCarry.current, e.deltaY * (e.deltaMode === 1 ? 16 : 1));
        wheelCarry.current = z.carry;
        if (z.steps !== 0) zoomRef.current(z.steps > 0 ? 1 : -1, e.clientX, e.clientY, Math.abs(z.steps));
        return;
      }
      const unit = e.deltaMode === 1 ? 16 : 1; // a notch of a mouse wheel may be in lines
      const p = wheelPan(e.deltaX * unit, e.deltaY * unit, e.shiftKey, live.current.k);
      pan(p.x, p.y);
    };
    const down = (e: PointerEvent) => {
      if (live.current.sheetOpen || e.button !== 0 || !e.ctrlKey) return;
      e.preventDefault();
      drag.current = { x: e.clientX, y: e.clientY, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch { /* a pointer that is already gone: the drag still follows the events it gets */ }
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const k = live.current.k;
      pan(-(e.clientX - d.x) / k, -(e.clientY - d.y) / k);
      d.x = e.clientX; d.y = e.clientY; d.moved = true;
    };
    const up = (e: PointerEvent) => {
      if (!drag.current) return;
      try { el.releasePointerCapture(e.pointerId); } catch { /* it was already released */ }
      el.style.cursor = "";
      setTimeout(() => { drag.current = null; }, 0); // the click that ends a drag must not open a room
    };
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (live.current.sheetOpen || e.ctrlKey || e.metaKey || e.altKey || t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "+" || e.key === "=") zoomRef.current(1);
      else if (e.key === "-" || e.key === "_") zoomRef.current(-1);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("wheel", wheel); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); window.removeEventListener("keydown", key);
    };
  }, []);
  const hovered = sheetOpen ? null : ROOMS.find((r) => r.id === hover) ?? null; // only the room under the pointer shows its name

  return (
    <div ref={box} className="relative h-full min-w-0 flex-1 overflow-hidden bg-ground">
      {size.w > 0 && (
        <>
          <div style={{ position: "absolute", left, top, width: W * k, height: H * k }}>
            <Living scene={scene} looks={looks} sheetOpen={sheetOpen} chatting={chatting} onTalk={() => setChatting(true)}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none" }}>
                {ROOMS.map((r) => (
                  <path key={r.id} d={r.path} role="button" tabIndex={sheetOpen ? -1 : 0} aria-label={r.name}
                    fill={hover === r.id && !sheetOpen ? "rgba(181,122,20,0.25)" : "transparent"}
                    style={{ cursor: "pointer", outline: "none", pointerEvents: sheetOpen ? "none" : "all" }}
                    onPointerEnter={() => setHover(r.id)} onPointerLeave={() => setHover((h) => (h === r.id ? null : h))}
                    onFocus={() => setHover(r.id)} onBlur={() => setHover((h) => (h === r.id ? null : h))}
                    onClick={(e) => { if (!e.ctrlKey) open(r.id); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(r.id); } }} />
                ))}
              </svg>
            </Living>
          </div>
          {hovered && (
            <span aria-hidden className="font-pixel pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 border-2 border-brand bg-surface-2 px-1.5 text-[12px] leading-[18px] font-bold whitespace-nowrap text-text"
              style={{ left: left + hovered.plate[0] * k, top: top + hovered.plate[1] * k }}>
              {hovered.team && hovered.color && <i className="inline-block size-2.5 border border-line-strong" style={{ background: hovered.color }} />}{hovered.name}
            </span>
          )}
        </>
      )}

      <div className="absolute top-5 left-5 flex gap-2" role="group" aria-label="Move the map" title="Mouse wheel: up and down. Shift and wheel: left and right. Ctrl and wheel: zoom. Ctrl and drag: move the map.">
        <Button variant="quiet" small onClick={home} disabled={sheetOpen} aria-label="Center the map on the secretary">Center</Button>
        {onEdit && <Button variant="quiet" small onClick={onEdit} disabled={sheetOpen} aria-label="Edit the office">Edit the office</Button>}
      </div>
      <div className="absolute top-5 right-5 flex gap-2" role="group" aria-label="Turn the building" title={sheetOpen ? "Close the page to turn the building" : undefined}>
        <Button variant="quiet" small onClick={() => turn(-1)} disabled={sheetOpen} aria-label="Turn the building to the left">↶ Turn left</Button>
        <Button variant="quiet" small onClick={() => turn(1)} disabled={sheetOpen} aria-label="Turn the building to the right">Turn right ↷</Button>
      </div>
      {chatting && !sheetOpen && <KibbyChat onSay={onKibbySay} onClose={() => setChatting(false)} />}
      {!sheetOpen && !chatting && <p className="pointer-events-none absolute bottom-3 left-0 right-0 m-0 text-center text-[13px] leading-5 text-text-tertiary">Click a room to open it.</p>}
    </div>
  );
});
