// The office: the building as one picture (art kit, art/). Hover a room to light it, click to zoom in, then open what the room holds.
// The picture is shown at a whole-number scale so every pixel stays square. The cats are separate small pictures laid over it, each with the pieces of
// furniture that stand in front of it laid over the cat, so a cat can type, wave or blink without redrawing the room.
// A cat's state is the real state of that role's session in this project: typing is "working", a raised paw is "waiting on you".
import { memo, useEffect, useRef, useState } from "react";
import office from "../office/office.png";
import map from "../office/rooms.json";
import layout from "../office/cats-layout.json";
import { Button, Glyph, RoleMark, CAT_SHEET, CAT_FRAMES, CAT_ROWS, FRAME_NAMES, catRow } from "./ui";
import type { Place } from "../lib/places";
import type { Project, Role } from "../lib/api";
import { NO_LOOKS, type Look } from "../lib/office";

type Room = { id: string; name: string; holds: string; polygon: number[][] };
const ROOMS = map.rooms as Room[];
const W = map.width, H = map.height;
const [CX0, CY0, CX1, CY1] = map.content; // the filled part of the picture: it is fitted and centred, not the empty margin around it
const RAISE = 28; // a room also owns the strip of wall and furniture above its floor
const OCCLUDERS = import.meta.glob("../office/occluders/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const occluderOf = (role: string) => OCCLUDERS[`../office/occluders/${role}.png`];

// who sits in which room, and what else a room opens
const DESKS: Record<string, string[]> = {
  plan: ["product", "design"], build: ["frontend", "backend", "qa", "security"], grow: ["marketing", "content", "support"], git: ["devops"], secretary: ["secretary"],
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
  grow: [{ label: "See the roles", place: "roles" }],
};

// the floor diamond is [top, right, bottom, left]; the hit area adds the strip above its two upper edges
const hit = (p: number[][]) => [[p[3][0], p[3][1] - RAISE], [p[0][0], p[0][1] - RAISE], [p[1][0], p[1][1] - RAISE], p[1], p[2], p[3]];
const pts = (p: number[][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const centre = (r: Room) => ({ x: r.polygon.reduce((a, p) => a + p[0], 0) / 4, y: r.polygon.reduce((a, p) => a + p[1], 0) / 4 - 8 });
const ORDER = [...ROOMS].sort((a, b) => a.polygon[2][1] - b.polygon[2][1]); // the front rooms are drawn last, so they win a click
const CATS = layout.cats as { role: string; x: number; y: number; depth: number; occluder: boolean }[];

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The cats and their speech bubbles. It keeps its own clock (four steps a second, paused when the window is hidden), so only the cats redraw. */
function Cats({ looks }: { looks: Record<string, Look> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => { if (!document.hidden) setTick((n) => n + 1); }, 250);
    return () => clearInterval(t);
  }, []);
  const frameOf = (phase: number, look: Look) => {
    const blink = (tick + phase) % 18 === 0;
    switch (look.mode) {
      case "typing": return tick % 2 ? "typeB" : "typeA";
      case "waiting": return Math.floor(tick / 2) % 2 ? "waitB" : "waitA";
      case "done": return blink ? "blink" : "happy";
      default: return blink ? "blink" : "idle";
    }
  };
  return (
    <>
      {CATS.map((c, i) => {
        const look = looks[c.role] ?? { mode: "idle", word: null, glyph: null, sessionId: null };
        const f = FRAME_NAMES.indexOf(frameOf(i * 5, look));
        const box = { position: "absolute" as const, left: `${(c.x / W) * 100}%`, top: `${(c.y / H) * 100}%`, width: `${(layout.frameWidth / W) * 100}%`, height: `${(layout.frameHeight / H) * 100}%` };
        return (
          <div key={c.role}>
            <div className="pixel" style={{ ...box, backgroundImage: `url(${CAT_SHEET})`, backgroundRepeat: "no-repeat", backgroundSize: `${CAT_FRAMES * 100}% ${CAT_ROWS * 100}%`, backgroundPosition: `${(f / (CAT_FRAMES - 1)) * 100}% ${(catRow(c.role) / (CAT_ROWS - 1)) * 100}%` }} />
            {c.occluder && occluderOf(c.role) && <img src={occluderOf(c.role)} alt="" draggable={false} className="pixel" style={{ ...box, maxWidth: "none" }} />}
          </div>
        );
      })}
      {CATS.map((c) => {
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

export const Office = memo(function Office({ roles, looks = NO_LOOKS, onOpen, onStartRole, onOpenSession }: {
  project: Project; roles: Role[]; looks?: Record<string, Look>; onOpen: (p: Place) => void; onStartRole: (roleId: string) => void; onOpenSession: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);

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
  const label = ROOMS.find((r) => r.id === (zoomed ?? hover)) ?? null;
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  return (
    <div ref={box} className="relative h-full min-w-0 flex-1 overflow-hidden bg-ground">
      {size.w > 0 && (
        <>
          <div style={{ position: "absolute", left, top, width: W * k, height: H * k, transition: move }}>
            <img src={office} alt="The Kona office, a building with a room for each place" draggable={false} className="pixel" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none" }} />
            <Cats looks={looks} />
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
          </div>
          {label && !zoomed && (
            <span className="font-pixel pointer-events-none absolute -translate-x-1/2 -translate-y-full border-2 border-line-strong bg-surface-2 px-2.5 py-0.5 text-[14px] leading-5 font-bold px-shadow"
              style={{ left: left + centre(label).x * k, top: top + (Math.min(...label.polygon.map((p) => p[1])) - RAISE) * k }}>{label.name}</span>
          )}
        </>
      )}

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
