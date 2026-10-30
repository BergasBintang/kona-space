// The office: a building made of parts (art kit, art/). Every piece (a piece of floor, a wall, a desk, a chair...) is its own small picture with a place
// and a front-to-back number, and the cats are in the same list, so a cat is drawn between the pieces behind it and the pieces in front of it. The building
// is drawn from four sides (a list of pieces for each); two buttons turn it a quarter. The pieces are drawn
// on one canvas at the picture's own size, which is then shown at a whole-number scale so every pixel stays square. When the owner goes into a room, the
// walls that stand in front of it are left out, like a dollhouse with its front open.
// Every room wears its name plate; hover a room to light it, click to zoom in, then open what the room holds.
// A cat's state is the real state of that role's session in this project: typing is "working", a raised paw is "waiting on you".
import { memo, useEffect, useRef, useState } from "react";
import v0 from "../office/views/v0.json";
import v1 from "../office/views/v1.json";
import v2 from "../office/views/v2.json";
import v3 from "../office/views/v3.json";
import { Button, Glyph, RoleMark, CAT_SHEET, CAT_W, CAT_H, FRAME_NAMES, catRow } from "./ui";
import type { Place } from "../lib/places";
import type { Project, Role } from "../lib/api";
import { NO_LOOKS, type Look } from "../lib/office";

type Room = { id: string; name: string; holds: string; polygon: number[][]; team: boolean; color: string | null; plate: number[]; plateMode: "below" | "above" | "centre" };
type Part = { f?: string; cat?: string; dir?: number; x: number; y: number; d: number; hides?: string[]; room?: string }; // f: the file of a piece; cat: a cat in its place in the list; dir: which way it looks
type CatSpot = { role: string; x: number; y: number; depth: number };
/** One side of the building: the picture size, the part of it that is filled (it is fitted and centred, not the empty margin around it), its rooms, its cats and its pieces. */
type View = { width: number; height: number; content: number[]; rooms: Room[]; cats: CatSpot[]; parts: Part[]; order: Room[] };
const VIEWS: View[] = [v0, v1, v2, v3].map((v) => {
  const rooms = v.rooms as Room[];
  return { width: v.width, height: v.height, content: v.content, rooms, cats: v.cats as CatSpot[], parts: v.parts as Part[], order: [...rooms].sort((a, b) => a.polygon[2][1] - b.polygon[2][1]) }; // the front rooms are drawn last, so they win a click
});
const RAISE = 28; // a room also owns the strip of wall and furniture above its floor
const PART_URLS = import.meta.glob("../office/parts/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const VIEW_KEY = "kona.office.view";
const savedView = () => { try { const n = Number(localStorage.getItem(VIEW_KEY)); return Number.isInteger(n) && n >= 0 && n < VIEWS.length ? n : 0; } catch { return 0; } };

// who sits in which room, and what else a room opens
const DESKS: Record<string, string[]> = {
  plan: ["product", "design"], build: ["frontend", "backend", "qa", "security"], marketing: ["marketing"], content: ["content"], support: ["support"], git: ["devops"], secretary: ["secretary"],
};
const OPENS: Record<string, { label: string; place: Place }[]> = {
  board: [{ label: "Open the Board", place: "board" }],
  library: [{ label: "Open the Brain", place: "brain" }],
  archive: [{ label: "Open Files", place: "files" }],
  servers: [{ label: "Open Servers", place: "servers" }],
  git: [{ label: "Open Worktrees", place: "worktrees" }],
  costs: [{ label: "Open Costs", place: "costs" }],
  backoffice: [{ label: "Open Voice", place: "voice" }, { label: "Open Settings", place: "settings" }],
  closet: [{ label: "Open Leftovers", place: "leftovers" }],
  entrance: [{ label: "Open Accounts", place: "accounts" }],
  secretary: [{ label: "See all sessions", place: "sessions" }],
  plan: [{ label: "See the roles", place: "roles" }],
  build: [{ label: "See the roles", place: "roles" }],
  marketing: [{ label: "See the roles", place: "roles" }],
  content: [{ label: "See the roles", place: "roles" }],
  support: [{ label: "See the roles", place: "roles" }],
};

// the floor diamond is [top, right, bottom, left]; the hit area adds the strip above its two upper edges
const hit = (p: number[][]) => [[p[3][0], p[3][1] - RAISE], [p[0][0], p[0][1] - RAISE], [p[1][0], p[1][1] - RAISE], p[1], p[2], p[3]];
const pts = (p: number[][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const centre = (r: Room) => ({ x: r.polygon.reduce((a, p) => a + p[0], 0) / 4, y: r.polygon.reduce((a, p) => a + p[1], 0) / 4 - 8 });
const IDLE: Look = { mode: "idle", word: null, glyph: null, sessionId: null };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The pictures of the pieces of one side of the building and of the cats, loaded once and kept for the life of the window. */
type Art = { view: number; sprites: Map<string, HTMLImageElement>; sheet: HTMLImageElement };
const arts = new Map<number, Promise<Art>>();
const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error(`could not load ${url}`)); im.src = url; });
const loadArt = (view: number) => {
  let a = arts.get(view);
  if (!a) {
    a = (async () => {
      const names = [...new Set(VIEWS[view].parts.flatMap((p) => (p.f ? [p.f] : [])))];
      const [sheet, ...list] = await Promise.all([loadImage(CAT_SHEET), ...names.map((n) => loadImage(PART_URLS[`../office/parts/${n}.png`]))]);
      return { view, sprites: new Map(names.map((n, i) => [n, list[i]])), sheet };
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
function Scene({ view, looks, zoomed }: { view: number; looks: Record<string, Look>; zoomed: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState<Art | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; loadArt(view).then((a) => { if (live) setReady(a); }).catch(() => {}); return () => { live = false; }; }, [view]); // until the new side is loaded, the old one stays on screen
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => { if (!document.hidden) setTick((n) => n + 1); }, 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !ready) return;
    const v = VIEWS[ready.view];
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, v.width, v.height);
    for (const p of v.parts) {
      if (p.cat) {
        const phase = v.cats.findIndex((c) => c.role === p.cat) * 5;
        const f = FRAME_NAMES.indexOf(frameOf(phase, looks[p.cat] ?? IDLE, tick));
        ctx.drawImage(ready.sheet, f * CAT_W, catRow(p.cat, p.dir ?? 0) * CAT_H, CAT_W, CAT_H, p.x, p.y, CAT_W, CAT_H);
        continue;
      }
      if (zoomed && p.hides?.includes(zoomed)) continue; // a wall in front of the room we are in
      const im = ready.sprites.get(p.f ?? "");
      if (im) ctx.drawImage(im, p.x, p.y);
    }
  }, [ready, looks, zoomed, tick]);
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

export const Office = memo(function Office({ roles, looks = NO_LOOKS, onOpen, onStartRole, onOpenSession, onSetup }: {
  project: Project; roles: Role[]; looks?: Record<string, Look>; onOpen: (p: Place) => void; onStartRole: (roleId: string) => void; onOpenSession: (id: string) => void; onSetup: (roleId: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [view, setView] = useState(savedView);
  const { width: W, height: H, rooms: ROOMS, order: ORDER, cats: CATS } = VIEWS[view];
  const [CX0, CY0, CX1, CY1] = VIEWS[view].content;
  const turn = (by: number) => setView((v) => {
    const n = (v + by + VIEWS.length) % VIEWS.length;
    try { localStorage.setItem(VIEW_KEY, String(n)); } catch { /* the side is only a convenience */ }
    return n;
  });

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
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomed(null); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const fit = Math.min(size.w / (CX1 - CX0), (size.h - 4) / (CY1 - CY0));
  const base = fit >= 2 ? Math.floor(fit) : Math.max(1, Math.floor(fit * 2) / 2); // whole numbers keep every pixel square; a small window may use a half step
  const k = zoomed ? base * 2 : base; // the zoom is a whole number too
  const room = ROOMS.find((r) => r.id === zoomed) ?? null;
  const left = room ? size.w / 2 - centre(room).x * k : (size.w - (CX1 - CX0) * k) / 2 - CX0 * k;
  const top = room ? size.h / 2 - centre(room).y * k - 40 : (size.h - (CY1 - CY0) * k) / 2 - CY0 * k;
  const move = "left 260ms steps(8, end), top 260ms steps(8, end), width 260ms steps(8, end), height 260ms steps(8, end)";
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  return (
    <div ref={box} className="relative h-full min-w-0 flex-1 overflow-hidden bg-ground">
      {size.w > 0 && (
        <>
          <div style={{ position: "absolute", left, top, width: W * k, height: H * k, transition: move }}>
            <Scene view={view} looks={looks} zoomed={zoomed} />
            <Bubbles view={view} looks={looks} />
            <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none" }}>
              <defs>
                <mask id="kona-room-cut"><rect width={W} height={H} fill="white" />{room && <polygon points={pts(hit(room.polygon))} fill="black" />}</mask>
              </defs>
              {room && <rect width={W} height={H} style={{ fill: "var(--color-ground)" }} opacity="0.7" mask="url(#kona-room-cut)" />}
              {ORDER.map((r) => (
                <polygon key={r.id} points={pts(hit(r.polygon))} role="button" tabIndex={zoomed ? -1 : 0} aria-label={r.name}
                  fill={hover === r.id && !zoomed ? "rgba(181,122,20,0.2)" : "transparent"} stroke={hover === r.id || zoomed === r.id ? "#b57a14" : "none"} strokeWidth={2 / k} strokeLinejoin="miter"
                  style={{ cursor: zoomed === r.id ? "default" : "pointer", outline: "none", pointerEvents: zoomed && zoomed !== r.id ? "none" : "all" }}
                  onPointerEnter={() => setHover(r.id)} onPointerLeave={() => setHover((h) => (h === r.id ? null : h))}
                  onFocus={() => setHover(r.id)} onBlur={() => setHover((h) => (h === r.id ? null : h))}
                  onClick={() => setZoomed(r.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setZoomed(r.id); } }} />
              ))}
            </svg>
            {room && (DESKS[room.id] ?? []).map((id) => {
              const c = CATS.find((x) => x.role === id);
              if (!c) return null;
              return (
                <span key={id} className="font-pixel pointer-events-none absolute -translate-x-1/2 border-2 border-line-strong bg-surface-2 px-1 text-[12px] leading-4 font-bold whitespace-nowrap text-text px-shadow"
                  style={{ left: `${((c.x + 14) / W) * 100}%`, top: `${((c.y + 40) / H) * 100}%` }}>{roleName(id)}</span>
              );
            })}
          </div>
          {!zoomed && ROOMS.map((r) => (
            <span key={r.id} aria-hidden className={`font-pixel pointer-events-none absolute flex -translate-x-1/2 items-center gap-1.5 border-2 px-1.5 text-[12px] leading-[18px] font-bold whitespace-nowrap px-shadow ${r.plateMode === "above" ? "-translate-y-full" : r.plateMode === "centre" ? "-translate-y-1/2" : ""} ${hover === r.id ? "border-brand bg-surface-2 text-text" : r.team ? "border-line-strong bg-surface-2 text-text" : "border-line-subtle bg-surface-1 text-text-secondary"}`}
              style={{ left: left + r.plate[0] * k, top: top + r.plate[1] * k + (r.plateMode === "above" ? -3 : r.plateMode === "below" ? 3 : 0) }}>
              {r.team && r.color && <i className="inline-block size-2.5 border border-line-strong" style={{ background: r.color }} />}{r.name}
            </span>
          ))}
        </>
      )}

      <div className="absolute top-5 right-5 flex gap-2" role="group" aria-label="Turn the building">
        <Button variant="quiet" small onClick={() => turn(-1)} aria-label="Turn the building to the left">↶ Turn left</Button>
        <Button variant="quiet" small onClick={() => turn(1)} aria-label="Turn the building to the right">Turn right ↷</Button>
      </div>
      {room && (
        <>
          <div className="absolute top-5 left-5"><Button variant="quiet" small onClick={() => setZoomed(null)} aria-label="Back to the office (Esc)">← Back to the office</Button></div>
          <div className="absolute right-0 bottom-6 left-0 flex justify-center px-6">
            <div className="px-card flex w-full max-w-[680px] flex-col gap-3 p-2" role="group" aria-label={room.name}>
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-[20px] leading-6 font-bold">{room.name}</h2>
                <p className="m-0 text-[14px] leading-5 text-text-secondary">{room.holds}</p>
              </div>
              {(DESKS[room.id] ?? []).length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {DESKS[room.id].map((id) => {
                    const look = looks[id];
                    return (
                      <li key={id} className="flex items-center gap-3">
                        <RoleMark roleId={id} size={32} />
                        <span className="font-pixel min-w-[130px] text-[16px] leading-6 font-bold">{roleName(id)}</span>
                        <span className="flex flex-1 items-center gap-1.5 text-[14px] leading-5 text-text-secondary">{look?.glyph && <Glyph state={look.glyph} size={16} />}{look?.word ?? "At the desk"}</span>
                        <Button small variant="ghost" onClick={() => onSetup(id)} aria-label={`Set up ${roleName(id)}`}>Set up</Button>
                        {look?.sessionId
                          ? <Button small variant="primary" onClick={() => onOpenSession(look.sessionId!)}>Open</Button>
                          : <Button small variant="quiet" onClick={() => onStartRole(id)}>Start a session</Button>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {(OPENS[room.id] ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-2">{OPENS[room.id].map((o, i) => <Button key={o.label} variant={(DESKS[room.id] ?? []).length === 0 && i === 0 ? "primary" : "quiet"} small onClick={() => onOpen(o.place)}>{o.label}</Button>)}</div>
              ) : (
                <p className="m-0 text-[14px] leading-5 text-text-tertiary">Nothing here yet.</p>
              )}
            </div>
          </div>
        </>
      )}
      {!zoomed && <p className="pointer-events-none absolute bottom-3 left-0 right-0 m-0 text-center text-[13px] leading-5 text-text-tertiary">Click a room to go in.</p>}
    </div>
  );
});
