// The office: a building made of parts (art kit, art/). Every piece (a piece of floor, a wall, a desk, a chair...) is its own small picture with a place
// and a front-to-back number, and the cats are in the same list, so a cat is drawn between the pieces behind it and the pieces in front of it. The building
// is drawn from four sides (a list of pieces for each); two buttons turn it a quarter. The pieces are drawn
// on one canvas at the picture's own size, which is then shown at a whole-number scale so every pixel stays square.
// Hover a room to light it and see its name; click it to open what it holds in the sheet that slides up from below (App.tsx, components/Sheet.tsx). There is no zoom.
// A cat's state is the real state of that role's session in this project: typing is "working", a raised paw is "waiting on you".
// Kibby, the office boy, walks the hall (a route the art build works out for each side, with his place among the pieces, so a wall in front of him hides him) with a small hop and
// a small lean; click him to talk (KibbyChat). He stands still while the sheet is open or he is talking, and with "reduce motion". While the sheet is open the building cannot be turned and its rooms cannot be clicked.
import { memo, useEffect, useRef, useState } from "react";
import v0 from "../office/views/v0.json";
import v1 from "../office/views/v1.json";
import v2 from "../office/views/v2.json";
import v3 from "../office/views/v3.json";
import { Button, Glyph, CAT_SHEET, CAT_W, CAT_H, FRAME_NAMES, catRow, KIB_SHEET, KIB_FRAMES, KIB_W, KIB_H } from "./ui";
import { KibbyChat, type Turn } from "./KibbyChat";
import { pose, startWalker, step, talking, TICK_MS, type Walk, type Walker } from "../lib/kibby";
import type { Place } from "../lib/places";
import { DESKS, PAGES } from "../lib/rooms";
import { NO_LOOKS, type Look } from "../lib/office";

type Room = { id: string; name: string; holds: string; polygon: number[][]; team: boolean; color: string | null; plate: number[] };
type Part = { f?: string; cat?: string; dir?: number; x: number; y: number; d: number; hides?: string[]; room?: string }; // f: the file of a piece; cat: a cat in its place in the list; dir: which way it looks
type CatSpot = { role: string; x: number; y: number; depth: number };
/** One side of the building: the picture size, the part of it that is filled (it is fitted and centred, not the empty margin around it), its rooms, its cats and its pieces. */
type View = { width: number; height: number; content: number[]; rooms: Room[]; cats: CatSpot[]; parts: Part[]; order: Room[]; walk: Walk };
const VIEWS: View[] = [v0, v1, v2, v3].map((v) => {
  const rooms = v.rooms as Room[];
  return { width: v.width, height: v.height, content: v.content, rooms, cats: v.cats as CatSpot[], parts: v.parts as Part[], walk: v.walk as Walk, order: [...rooms].sort((a, b) => a.polygon[2][1] - b.polygon[2][1]) }; // the front rooms are drawn last, so they win a click
});
const RAISE = 28; // a room also owns the strip of wall and furniture above its floor
const PART_URLS = import.meta.glob("../office/parts/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const VIEW_KEY = "kona.office.view";
const savedView = () => { try { const n = Number(localStorage.getItem(VIEW_KEY)); return Number.isInteger(n) && n >= 0 && n < VIEWS.length ? n : 0; } catch { return 0; } };

// the floor diamond is [top, right, bottom, left]; the hit area adds the strip above its two upper edges
const hit = (p: number[][]) => [[p[3][0], p[3][1] - RAISE], [p[0][0], p[0][1] - RAISE], [p[1][0], p[1][1] - RAISE], p[1], p[2], p[3]];
const pts = (p: number[][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const IDLE: Look = { mode: "idle", word: null, glyph: null, sessionId: null };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The pictures of the pieces of one side of the building and of the cats, loaded once and kept for the life of the window. */
type Art = { view: number; sprites: Map<string, HTMLImageElement>; sheet: HTMLImageElement; kibby: HTMLImageElement };
const arts = new Map<number, Promise<Art>>();
const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error(`could not load ${url}`)); im.src = url; });
const loadArt = (view: number) => {
  let a = arts.get(view);
  if (!a) {
    a = (async () => {
      const names = [...new Set(VIEWS[view].parts.flatMap((p) => (p.f ? [p.f] : [])))];
      const [sheet, kibby, ...list] = await Promise.all([loadImage(CAT_SHEET), loadImage(KIB_SHEET), ...names.map((n) => loadImage(PART_URLS[`../office/parts/${n}.png`]))]);
      return { view, sprites: new Map(names.map((n, i) => [n, list[i]])), sheet, kibby };
    })();
    arts.set(view, a);
  }
  return a;
};

/** Which picture of the cat to show: its state in the project decides, and a cat blinks now and then. */
function frameOf(phase: number, look: Look, tick: number) {
  const blink = (tick + phase) % 18 === 0;
  switch (look.mode) {
    case "typing": return tick % 2 ? "typeB" : "typeA";
    case "waiting": return Math.floor(tick / 2) % 2 ? "waitB" : "waitA";
    case "done": return blink ? "blink" : "happy";
    default: return blink ? "blink" : "idle";
  }
}

/** The building and its cats, drawn piece by piece from back to front. It keeps its own clock (four steps a second, paused when the window is hidden), so only this redraws. */
function Scene({ view, looks, walker, chatting, paused }: { view: number; looks: Record<string, Look>; walker: Walker | null; chatting: boolean; paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState<Art | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; loadArt(view).then((a) => { if (live) setReady(a); }).catch(() => {}); return () => { live = false; }; }, [view]); // until the new side is loaded, the old one stays on screen
  useEffect(() => {
    if (reducedMotion() || paused) return; // the cats hold still while the sheet covers the office
    const t = setInterval(() => { if (!document.hidden) setTick((n) => n + 1); }, 250);
    return () => clearInterval(t);
  }, [paused]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !ready) return;
    const v = VIEWS[ready.view];
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, v.width, v.height);
    let kib = walker ? pose(walker, v.walk) : null; // drawn between the pieces behind him and the pieces in front of him: his place in the list comes from the art build
    if (kib && chatting) kib = talking(kib);
    const drawKibby = () => { if (kib) ctx.drawImage(ready.kibby, KIB_FRAMES.indexOf(kib.frame) * KIB_W, kib.dir * KIB_H, KIB_W, KIB_H, kib.x, kib.y, KIB_W, KIB_H); };
    for (let idx = 0; idx < v.parts.length; idx++) {
      const p = v.parts[idx];
      if (kib && kib.k === idx) drawKibby();
      if (p.cat) {
        const phase = v.cats.findIndex((c) => c.role === p.cat) * 5;
        const f = FRAME_NAMES.indexOf(frameOf(phase, looks[p.cat] ?? IDLE, tick));
        ctx.drawImage(ready.sheet, f * CAT_W, catRow(p.cat, p.dir ?? 0) * CAT_H, CAT_W, CAT_H, p.x, p.y, CAT_W, CAT_H);
        continue;
      }
      const im = ready.sprites.get(p.f ?? "");
      if (im) ctx.drawImage(im, p.x, p.y);
    }
    if (kib && kib.k >= v.parts.length) drawKibby();
  }, [ready, looks, tick, walker, chatting]);
  const v = VIEWS[ready?.view ?? view];
  return <canvas ref={canvas} width={v.width} height={v.height} role="img" aria-label="The Kona office, a building with a room for each place" className="pixel" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none" }} />;
}

/** The speech bubbles over the cats that are doing something. */
function Bubbles({ view, looks }: { view: number; looks: Record<string, Look> }) {
  const { cats, width: W, height: H } = VIEWS[view];
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

/** The building with its cats, and Kibby on his route. He keeps his own clock (eight steps a second) here, so only the drawing and his click box change as he walks. `children` (the
 * rooms' click areas) sit between the picture and Kibby's click box, and do not redraw on his steps. */
function Living({ view, looks, sheetOpen, chatting, onTalk, children }: { view: number; looks: Record<string, Look>; sheetOpen: boolean; chatting: boolean; onTalk: () => void; children: React.ReactNode }) {
  const [walker, setWalker] = useState<Walker>(() => startWalker("B"));
  const [near, setNear] = useState(false);
  const paused = sheetOpen || chatting;
  useEffect(() => {
    if (paused || reducedMotion()) return;
    const t = setInterval(() => { if (!document.hidden) setWalker((w) => step(w, VIEWS[view].walk, Math.random)); }, TICK_MS);
    return () => clearInterval(t);
  }, [paused, view]);
  const { width: W, height: H, walk } = VIEWS[view];
  const p = pose(walker, walk);
  return (
    <>
      <Scene view={view} looks={looks} walker={walker} chatting={chatting} paused={sheetOpen} />
      <Bubbles view={view} looks={looks} />
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

export const Office = memo(function Office({ looks = NO_LOOKS, sheetOpen, onOpen, onOpenRoom, onKibbySay }: {
  looks?: Record<string, Look>; sheetOpen: boolean; onOpen: (p: Place) => void; onOpenRoom: (room: string) => void; onKibbySay: (history: Turn[], message: string) => Promise<string>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [chatting, setChatting] = useState(false);
  const [view, setView] = useState(savedView);
  const { width: W, height: H, rooms: ROOMS, order: ORDER } = VIEWS[view];
  const [CX0, CY0, CX1, CY1] = VIEWS[view].content;
  const turn = (by: number) => {
    if (sheetOpen) return; // the building cannot be turned while the sheet is open: close it first
    setView((v) => {
      const n = (v + by + VIEWS.length) % VIEWS.length;
      try { localStorage.setItem(VIEW_KEY, String(n)); } catch { /* the side is only a convenience */ }
      return n;
    });
  };
  // a room with cats opens their list; every other room opens its first page (a room with two pages shows the second as a tab)
  const open = (id: string) => {
    if (sheetOpen) return;
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

  const fit = Math.min(size.w / (CX1 - CX0), (size.h - 4) / (CY1 - CY0));
  const k = fit >= 2 ? Math.floor(fit) : Math.max(1, Math.floor(fit * 2) / 2); // whole numbers keep every pixel square; a small window may use a half step
  const left = (size.w - (CX1 - CX0) * k) / 2 - CX0 * k;
  const top = (size.h - (CY1 - CY0) * k) / 2 - CY0 * k;
  const hovered = sheetOpen ? null : ROOMS.find((r) => r.id === hover) ?? null; // only the room under the pointer shows its name

  return (
    <div ref={box} className="relative h-full min-w-0 flex-1 overflow-hidden bg-ground">
      {size.w > 0 && (
        <>
          <div style={{ position: "absolute", left, top, width: W * k, height: H * k }}>
            <Living view={view} looks={looks} sheetOpen={sheetOpen} chatting={chatting} onTalk={() => setChatting(true)}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none" }}>
                {ORDER.map((r) => (
                  <polygon key={r.id} points={pts(hit(r.polygon))} role="button" tabIndex={sheetOpen ? -1 : 0} aria-label={r.name}
                    fill={hover === r.id && !sheetOpen ? "rgba(181,122,20,0.2)" : "transparent"} stroke={hover === r.id && !sheetOpen ? "#b57a14" : "none"} strokeWidth={2 / k} strokeLinejoin="miter"
                    style={{ cursor: "pointer", outline: "none", pointerEvents: sheetOpen ? "none" : "all" }}
                    onPointerEnter={() => setHover(r.id)} onPointerLeave={() => setHover((h) => (h === r.id ? null : h))}
                    onFocus={() => setHover(r.id)} onBlur={() => setHover((h) => (h === r.id ? null : h))}
                    onClick={() => open(r.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(r.id); } }} />
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

      <div className="absolute top-5 right-5 flex gap-2" role="group" aria-label="Turn the building" title={sheetOpen ? "Close the page to turn the building" : undefined}>
        <Button variant="quiet" small onClick={() => turn(-1)} disabled={sheetOpen} aria-label="Turn the building to the left">↶ Turn left</Button>
        <Button variant="quiet" small onClick={() => turn(1)} disabled={sheetOpen} aria-label="Turn the building to the right">Turn right ↷</Button>
      </div>
      {chatting && !sheetOpen && <KibbyChat onSay={onKibbySay} onClose={() => setChatting(false)} />}
      {!sheetOpen && !chatting && <p className="pointer-events-none absolute bottom-3 left-0 right-0 m-0 text-center text-[13px] leading-5 text-text-tertiary">Click a room to open it.</p>}
    </div>
  );
});
