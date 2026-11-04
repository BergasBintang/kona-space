// The Mockups sheet (ticket T-0016, decisions 75 and 76): the mockups that people drew for this project, as cards; a click opens one in a drawn device at the true size of the device,
// scaled to fit the sheet. The page runs its own scripts in a frame that cannot reach Kona or the web (mock.rs); it is loaded from the folder `.kona/mockups/<card>/`.
// The toolbar is icons only (names on hover). There is no page counter and no arrows: the owner moves between the pages of a mockup by clicking inside it.
// The sums (fit, zoom, the address, what a page may say) are in lib/mockview.ts, with tests.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import devicesJson from "../assets/devices/devices.json";
import { createTicket, mockBase, mockCards, mockFiles, type MockCard, type Project, type TicketView } from "../lib/api";
import { buildPrompt, fallbackDraft, parseDraft, type Draft, type DraftContext } from "../lib/mockdraft";
import { Confirm } from "./Confirm";
import { MARGIN, MAX_ZOOM, clampZoom, filesSignature, fitScale, frameMessage, layout, pageUrl, percent, stepZoom, wheelZoom, type Device } from "../lib/mockview";
import { NOTE_MAX, addPin, editPin, measureLine, pageFile, partLabel, pickMessage, pinsForPage, placeNote, removePin, toScreen, type Box, type Part, type Pin } from "../lib/mockpick";
import { Help } from "./Help";
import { IconButton, type IconName } from "./Icon";
import { Button, ago } from "./ui";

// pins stay while the app is open, so leaving a mockup by mistake does not lose them (they are not written to disk)
const kept = new Map<string, Pin[]>();
const NOTE_SIZE = { w: 280, h: 190 };
const field = "border border-line-strong bg-inset px-3 text-[14px] text-text placeholder:text-text-tertiary";

const PICTURES = import.meta.glob("../assets/devices/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const picture = (file: string) => PICTURES[`../assets/devices/${file}`] ?? "";
const DEVICES = (devicesJson as unknown as { devices: Device[] }).devices;
const DEVICE_ICON: Record<string, IconName> = { "phone-s": "deviceSmallPhone", phone: "devicePhone", tablet: "deviceTablet", laptop: "deviceLaptop", monitor: "deviceMonitor" };

// what the owner chose last is kept in the browser store; if that is unavailable the sheet simply starts with its usual choices
const pref = (k: string, fallback: string) => { try { return localStorage.getItem(`kona.mockups.${k}`) ?? fallback; } catch { return fallback; } };
const savePref = (k: string, v: string) => { try { localStorage.setItem(`kona.mockups.${k}`, v); } catch { /* not kept */ } };
const px = (n: number) => `${n}px`;
const visible = () => document.visibilityState === "visible";

/** What App gives the sheet for Send: the name of the person who changes mockups, the cheap model call (it checks the account), and the start of a session on a ticket. */
export type MockSend = { designer: string; draft: (prompt: string) => Promise<string>; start: (t: TicketView) => Promise<void> };

export function Mockups({ project, send }: { project: Project | null; send: MockSend }) {
  const [base, setBase] = useState<string | null>(null);
  const [card, setCard] = useState<MockCard | null>(null);
  useEffect(() => { void mockBase().then(setBase).catch(() => setBase("")); }, []);
  if (!project || base === null) return null;
  if (card) return <MockupView key={card.id} project={project} card={card} base={base} send={send} onBack={() => setCard(null)} />;
  return <Cards project={project} onOpen={setCard} />;
}

function Cards({ project, onOpen }: { project: Project; onOpen: (c: MockCard) => void }) {
  const [cards, setCards] = useState<MockCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => mockCards(project.id).then((c) => { setCards(c); setError(null); }).catch((e) => setError(String(e))), [project.id]);
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (visible()) void load(); }, 4000); // a new card shows up by itself
    return () => clearInterval(t);
  }, [load]);
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex w-full flex-col gap-6 px-8 pt-8 pb-10">
        <div className="flex items-center gap-3">
          <h1 className="m-0 text-[30px] leading-[38px] font-bold">Mockups</h1>
          <Help title="Mockups">
            <p className="m-0">A mockup is a page that a person drew in plain web files, so you can click through it before it is built. Each card is one mockup, and its pages link to each other like a real site.</p>
            <p className="m-0">Each one lives in its own folder inside .kona/mockups of the project. A mockup runs on this PC only: it cannot reach the web or anything of Kona.</p>
          </Help>
        </div>
        {error && <p role="alert" className="m-0 text-[15px] leading-6 text-text-secondary">Could not read the mockups: {error}</p>}
        {cards && cards.length === 0 && !error && <p className="m-0 text-[15px] leading-6 text-text-secondary">No mockups yet. A mockup is saved in its own folder inside .kona/mockups of this project.</p>}
        {cards && cards.length > 0 && (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
            {cards.map((c) => (
              <li key={c.id}>
                <button type="button" disabled={!c.entry} onClick={() => onOpen(c)} aria-label={c.entry ? `Open ${c.name}` : `${c.name}: no start page`}
                  className="px-card flex w-full flex-col items-start gap-1 p-2 text-left enabled:cursor-pointer enabled:hover:bg-surface-3 disabled:opacity-70">
                  <span className="max-w-full truncate text-[18px] leading-6 font-bold">{c.name}</span>
                  <span className="text-[13px] leading-5 text-text-secondary">
                    {c.entry ? `${c.files} ${c.files === 1 ? "file" : "files"}${c.modified ? ` · changed ${ago(c.modified * 1000)} ago` : ""}` : "No start page: it needs an index.html, or an entry in its mockup.json."}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

/** The Send dialog: writing the draft, or the draft to read and change (the model's, or a plain list when it could not be reached) */
type SendState = { phase: "writing" } | { phase: "draft"; draft: Draft; line: string | null };

function MockupView({ project, card, base, send, onBack }: { project: Project; card: MockCard; base: string; send: MockSend; onBack: () => void }) {
  const [deviceId, setDeviceId] = useState(() => { const v = pref("device", "laptop"); return DEVICES.some((d) => d.id === v) ? v : "laptop"; });
  const [turned, setTurned] = useState(() => pref("turned", "0") === "1");
  const [theme, setTheme] = useState<"light" | "dark">(() => (pref("theme", "light") === "dark" ? "dark" : "light"));
  const [zoom, setZoom] = useState<number | null>(null); // null: fitted to the sheet
  const [rev, setRev] = useState(0); // a new number loads the page again, from its start
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [fix, setFix] = useState({ x: 0, y: 0 }); // the small shift that puts the page's frame on the screen's physical pixels (see below)
  const box = useRef<HTMLDivElement>(null);
  const dev = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const anchor = useRef<{ fx: number; fy: number; px: number; py: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // pick mode (T-0024): the page's helper reports the part under the pointer; a click opens a note box beside it; notes pile up as numbered pins
  const keptKey = `${project.id}/${card.id}`;
  const [picking, setPicking] = useState(false);
  const [pins, setPins] = useState<Pin[]>(() => kept.get(keptKey) ?? []);
  const [hover, setHover] = useState<Part | null>(null);
  const [target, setTarget] = useState<{ part: Part; box: Box } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [, bump] = useState(0); // a new number draws the note box again (the sheet was moved under it)
  const nextId = useRef(pins.reduce((m, p) => Math.max(m, p.id), 0) + 1);

  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0];
  const isTurned = turned && device.turns;
  const lay = useMemo(() => layout(device, isTurned), [device, isTurned]);
  const fit = fitScale(lay, room);
  const scale = zoom === null ? fit : clampZoom(zoom, fit);
  const now = useRef({ scale, fit, theme, picking, pins, target });
  now.current = { scale, fit, theme, picking, pins, target };
  const back = useRef(onBack);
  back.current = onBack;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver(() => setRoom({ w: el.clientWidth, h: el.clientHeight }));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // the page starts in the theme that is chosen now; a later change goes to the running page by a message, so it does not start again
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const url = useMemo(() => (card.entry ? pageUrl(base, project.id, card.id, card.entry, now.current.theme) : null), [base, project.id, card.id, card.entry, rev]);
  // what the page's helper is told: the theme, whether pick mode is on, and the pins (it draws them inside the page, so they follow it when it scrolls)
  const tell = useCallback(() => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.postMessage({ kona: "theme", value: now.current.theme }, "*");
    w.postMessage({ kona: "pick", on: now.current.picking }, "*");
    w.postMessage({ kona: "pins", list: pinsForPage(now.current.pins) }, "*");
  }, []);
  useEffect(() => { tell(); }, [theme, picking, pins, tell]);
  useEffect(() => { kept.set(keptKey, pins); }, [keptKey, pins]);
  const closeNote = useCallback(() => { setTarget(null); setNoteText(""); frame.current?.contentWindow?.postMessage({ kona: "clear" }, "*"); }, []);
  /** Esc: first the open note, then pick mode, then the sheet goes back to the cards */
  const escape = useCallback(() => {
    if (document.querySelector("[role=dialog]")) return;
    if (now.current.target) closeNote();
    else if (now.current.picking) { setPicking(false); setHover(null); }
    else back.current();
  }, [closeNote]);
  const addNote = () => {
    if (!target) return;
    const next = addPin(pins, target.part, noteText, nextId.current);
    if (next !== pins) { nextId.current++; setPins(next); }
    closeNote();
  };

  // Send (T-0025): the pins become a ticket draft (one cheap model call, or a plain list when it fails); the owner reads and changes it; one button makes the ticket for the designer and starts her
  const [sending, setSending] = useState<SendState | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentLine, setSentLine] = useState<string | null>(null);
  const cancelled = useRef(false);
  const context = (): DraftContext => ({ cardId: card.id, cardName: card.name, device: device.label, width: lay.screen.w, theme });
  const startSend = async () => {
    if (pins.length === 0) return;
    const ctx = context(), mine = pins;
    cancelled.current = false;
    setSendError(null); setSentLine(null); setSending({ phase: "writing" });
    let draft: Draft | null = null, line: string | null = null;
    try {
      const { prompt, hidden } = buildPrompt(ctx, mine);
      draft = parseDraft(await send.draft(prompt), ctx);
      line = !draft ? "The answer could not be read as a ticket, so this is a plain list of your notes." : hidden.length ? `Hidden before sending: ${hidden.join(", ")}.` : null;
    } catch (e) { line = `${String(e).replace(/^Error: /, "")} This is a plain list of your notes instead.`; }
    if (cancelled.current) return;
    setSending({ phase: "draft", draft: draft ?? fallbackDraft(ctx, mine), line });
  };
  const cancelSend = () => { cancelled.current = true; setSending(null); setSendError(null); };
  const makeTicket = async (d: Draft) => {
    try {
      const t = await createTicket(project.id, { title: d.title.trim(), description: d.description, acceptance: d.acceptance, role: "design", status: "ready", next: "Read the numbered notes in the description and change the mockup", own_copy: "no" });
      setPins([]); setSending(null); setSendError(null); setPicking(false); setHover(null);
      try { await send.start({ ...t, cost: 0 }); }
      catch (e) { setSentLine(`Ticket ${t.id} is waiting in Ready on the Board. ${String(e).replace(/^Error: /, "")}`); return; }
      setSentLine(`Ticket ${t.id} was made and ${send.designer} has started on it.`);
    } catch (e) { setSendError(String(e).replace(/^Error: /, "")); }
  };

  /** Go to `next`, keeping the spot under (x, y) (the middle of the sheet when not given) where it is. */
  const zoomTo = useCallback((next: number, x?: number, y?: number) => {
    const b = box.current, d = dev.current;
    if (!b || !d) return;
    const r = d.getBoundingClientRect(), br = b.getBoundingClientRect();
    const cx = x ?? br.left + br.width / 2, cy = y ?? br.top + br.height / 2;
    const to01 = (v: number) => Math.min(1, Math.max(0, v));
    anchor.current = { fx: to01((cx - r.left) / r.width), fy: to01((cy - r.top) / r.height), px: cx - br.left, py: cy - br.top };
    setZoom(clampZoom(next, now.current.fit));
  }, []);
  useLayoutEffect(() => {
    const a = anchor.current, b = box.current, d = dev.current;
    anchor.current = null;
    if (!a || !b || !d) return;
    const r = d.getBoundingClientRect(), br = b.getBoundingClientRect();
    b.scrollLeft += r.left + a.fx * r.width - (br.left + a.px);
    b.scrollTop += r.top + a.fy * r.height - (br.top + a.py);
  }, [scale]);

  // Ctrl and the wheel over the sheet (by hand: a page listener may not stop the window's own zoom unless it is not passive); over the page the helper passes it up
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey) return; e.preventDefault(); zoomTo(wheelZoom(now.current.scale, e.deltaY, now.current.fit), e.clientX, e.clientY); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomTo]);

  // what the page's helper says. The page is not trusted: only its own frame is listened to, and only the three things it may say.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const f = frame.current;
      if (!f || e.source !== f.contentWindow) return;
      const m = frameMessage(e.data);
      if (!m) {
        const p = pickMessage(e.data);
        if (!p || !now.current.picking && p.kind !== "gone") return; // a report only counts while pick mode is on
        if (p.kind === "hover") { const { kind: _k, ...part } = p; setHover(part); }
        else if (p.kind === "hover-none") setHover(null);
        else if (p.kind === "pick") { const { kind: _k, box, vw: _w, vh: _h, ...part } = p; setTarget({ part, box }); setNoteText(""); }
        else if (p.kind === "rect") setTarget((t) => (t ? { ...t, box: p.box } : t));
        else setTarget(null);
        return;
      }
      if (m.kind === "ready") { setTarget(null); setHover(null); tell(); }
      else if (m.kind === "escape") escape(); // Esc inside the page, as Esc on the sheet
      else { const r = f.getBoundingClientRect(); zoomTo(wheelZoom(now.current.scale, m.dy, now.current.fit), r.left + m.x * (r.width / f.offsetWidth), r.top + m.y * (r.height / f.offsetHeight)); }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [tell, zoomTo, escape]);

  // Esc goes back to the cards; on the cards it closes the sheet (the sheet's own handler runs when this one does not take it). This listener is in the capture phase, so it comes
  // before the sheet's, which was added earlier; and it leaves Esc alone while a dialog is open (the help closes first).
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("[role=dialog]")) { e.preventDefault(); escape(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [escape]);

  // the page loads again by itself when one of its files changes (checked every 3 seconds, and not while the window is hidden)
  const seen = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!visible()) return;
      try {
        const sig = filesSignature(await mockFiles(project.id, card.id));
        if (!alive) return;
        if (seen.current !== null && seen.current !== sig) setRev((r) => r + 1);
        seen.current = sig;
      } catch { /* the folder may be moving; the next check tries again */ }
    };
    void check();
    const t = setInterval(check, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [project.id, card.id]);

  const pickDevice = (id: string) => { setDeviceId(id); setZoom(null); savePref("device", id); };
  const turn = () => { setTurned(!turned); setZoom(null); savePref("turned", turned ? "0" : "1"); };
  const flipTheme = () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); savePref("theme", next); };

  const [t, r, b, l] = lay.bezel;
  const sw = lay.screen.w, sh = lay.screen.h;
  // the screen box is a whole number of CSS pixels, and so is where it sits: a frame on half a pixel gives the page a viewport one pixel too big (seen: 569 instead of 568)
  const dw = Math.round(sw * scale), dh = Math.round(sh * scale);
  const total = { w: dw + lay.fixedW, h: dh + lay.fixedH };
  // On a screen with a fractional scale (120 percent here) the page's viewport is a whole number of SCREEN pixels, so it cannot be exactly the device's width in CSS pixels. A frame that does
  // not start and end on whole screen pixels is also off by one pixel either way (seen: 569 for 568, 767 for 768). So the frame is shifted onto the pixel grid and made the smallest whole number of
  // screen pixels that is not less than the device (a little over for the rounding): the page sees the device's width or at most one pixel more, never less, so `min-width` breakpoints (768 and
  // up, as most sites write them) apply. Where the device is a whole number of screen pixels (100 or 200 percent) it is exact.
  const dpr = Math.round((window.devicePixelRatio || 1) * 1000) / 1000; // 1.2000000477 is 1.2
  // The page's viewport is the frame's box taken out to whole screen pixels: the left edge down, the right edge up. So the box starts just after a pixel line (+0.02) and is a little short of
  // the whole number of pixels it should be (-0.1): the edges then land on exactly that number, whether Chrome rounds or takes the enclosing pixels, and a float's last digit cannot add one.
  const phys = (v: number) => (Math.ceil(v * dpr - 1e-6) - 0.1) / dpr;
  const fw = phys(sw), fh = phys(sh);
  const offX = room.w > 0 ? Math.max(0, Math.floor((room.w - total.w - 2 * MARGIN) / 2)) : 0, offY = room.h > 0 ? Math.max(0, Math.floor((room.h - total.h - 2 * MARGIN) / 2)) : 0;
  const canPan = room.w > 0 && (total.w + 2 * MARGIN > room.w + 1 || total.h + 2 * MARGIN > room.h + 1);
  const frameStyle: CSSProperties = {
    position: "relative", boxSizing: "content-box", width: dw, height: dh, borderStyle: "solid", borderColor: "transparent", borderWidth: lay.bezel.map(px).join(" "),
    borderImage: `url(${picture(lay.frame.image)}) ${lay.frame.slice.join(" ")} / ${lay.bezel.map(px).join(" ")} repeat`, imageRendering: "pixelated", backgroundColor: device.backdrop, backgroundClip: "padding-box",
  };
  const base_ = device.base;
  // where the note box goes: beside the part that was clicked (the page reports the part's box in its own pixels; the frame's place and scale put it on the screen)
  const noteAt = (() => {
    const f = frame.current, w = wrap.current;
    if (!target || !f || !w || f.offsetWidth === 0) return null;
    const fr = f.getBoundingClientRect(), wr = w.getBoundingClientRect();
    const part = toScreen(target.box, { left: fr.left - wr.left, top: fr.top - wr.top, scale: fr.width / f.offsetWidth });
    return placeNote(part, { w: wr.width, h: wr.height }, NOTE_SIZE);
  })();

  useLayoutEffect(() => {
    const f = frame.current;
    if (!f) return;
    const r = f.getBoundingClientRect();
    const x0 = r.left - fix.x, y0 = r.top - fix.y; // where it would be without the shift
    const nx = (Math.round(x0 * dpr) + 0.02) / dpr - x0, ny = (Math.round(y0 * dpr) + 0.02) / dpr - y0;
    if (Math.abs(nx - fix.x) > 1e-3 || Math.abs(ny - fix.y) > 1e-3) setFix({ x: nx, y: ny });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dw, dh, rev, deviceId, isTurned, room.w, room.h, dpr, theme]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-subtle bg-surface-1 px-6 py-2">
        <IconButton icon="back" label="Back to the mockups (Esc)" onClick={onBack} />
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="m-0 max-w-[260px] truncate text-[20px] leading-7 font-bold">{card.name}</h1>
          <Help title={card.name}>
            <p className="m-0">The page runs at the true size of the device you pick, and is shown smaller to fit the sheet. Zoom in with the buttons, or with Ctrl and the mouse wheel; drag the sheet around to move.</p>
            <p className="m-0">Start again puts the page back to its beginning. The page also loads again by itself when one of its files changes. Esc goes back to the mockups.</p>
            <p className="m-0">The arrow turns on picking: the page stops answering clicks, the part under the pointer is outlined with its sizes, and a click opens a box for a note. Each note becomes a numbered pin on the page. Esc closes the box, then picking.</p>
          </Help>
        </div>
        <div className="flex-1" />
        <div role="group" aria-label="Device" className="flex gap-1.5">
          {DEVICES.map((d) => (
            <IconButton key={d.id} icon={DEVICE_ICON[d.id] ?? "deviceLaptop"} label={`${d.label}, ${d.screen.w} px wide`} variant={d.id === device.id ? "primary" : "quiet"} aria-pressed={d.id === device.id} onClick={() => pickDevice(d.id)} />
          ))}
        </div>
        {device.turns && <IconButton icon="rotate" label={isTurned ? "Stand the device up again" : "Turn the device on its side"} variant={isTurned ? "primary" : "quiet"} aria-pressed={isTurned} onClick={turn} />}
        <IconButton icon="select" label={picking ? "Stop picking parts (Esc)" : "Pick a part and leave a note"} variant={picking ? "primary" : "quiet"} aria-pressed={picking}
          onClick={() => { if (picking) { setPicking(false); setHover(null); closeNote(); } else { setSentLine(null); setPicking(true); } }} />
        <IconButton icon={theme === "dark" ? "sun" : "moon"} label={theme === "dark" ? "Show the page light" : "Show the page dark"} onClick={flipTheme} />
        <div role="group" aria-label="Zoom" className="flex items-center gap-1.5">
          <IconButton icon="zoomOut" label="Zoom out (Ctrl and the mouse wheel)" disabled={scale <= fit + 1e-6} onClick={() => zoomTo(stepZoom(scale, -1, fit))} />
          <span className="font-pixel w-[52px] text-center text-[14px] leading-5 font-bold" aria-label={`Zoom ${percent(scale)} percent`}>{percent(scale)}%</span>
          <IconButton icon="zoomIn" label="Zoom in (Ctrl and the mouse wheel)" disabled={scale >= MAX_ZOOM - 1e-6} onClick={() => zoomTo(stepZoom(scale, 1, fit))} />
          <IconButton icon="centre" label="Fit the device to the sheet" disabled={zoom === null} onClick={() => setZoom(null)} />
        </div>
        <IconButton icon="turnRight" label="Start the page again" onClick={() => setRev((n) => n + 1)} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
      <div ref={wrap} className="relative flex min-h-0 min-w-0 flex-1">
      <div
        ref={box}
        onScroll={() => { if (now.current.target) bump((n) => n + 1); }}
        className={`relative flex min-h-0 min-w-0 flex-1 overflow-auto bg-inset ${canPan ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        onPointerDown={(e) => { if (e.button !== 0 || !canPan || !box.current) return; drag.current = { x: e.clientX, y: e.clientY, left: box.current.scrollLeft, top: box.current.scrollTop }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current, el = box.current; if (d && el) { el.scrollLeft = d.left - (e.clientX - d.x); el.scrollTop = d.top - (e.clientY - d.y); } }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
      >
        <div className="flex shrink-0 flex-col items-center" style={{ padding: MARGIN, margin: `${offY + fix.y}px 0 0 ${offX + fix.x}px` }}>
          <div ref={dev} style={frameStyle}>
            <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: device.screenRadius * lay.k, background: "#fff" }}>
              {url && (
                <iframe key={rev} ref={frame} title={card.name} src={url} sandbox="allow-scripts" onLoad={tell}
                  style={{ width: fw, height: fh, transform: `scale(${dw / fw}, ${dh / fh})`, transformOrigin: "0 0", border: 0, display: "block", background: "#fff", colorScheme: theme, pointerEvents: dragging ? "none" : "auto" }} />
              )}
            </div>
            {lay.frame.details.map((d, i) => {
              const w = d.size[0] * lay.k, h = d.size[1] * lay.k;
              const s: CSSProperties = { position: "absolute", width: w, height: h, imageRendering: "pixelated", pointerEvents: "none" };
              if (d.side === "top") { s.left = Math.round((dw - w) / 2); s.top = -(t + h) / 2; }
              else if (d.side === "left") { s.left = -(l + w) / 2; s.top = Math.round((dh - h) / 2); }
              else if (d.side === "bottom") { s.left = Math.round((dw - w) / 2); s.top = dh + (b - h) / 2; }
              else { s.left = dw + (r - w) / 2; s.top = Math.round((dh - h) / 2); }
              return <img key={i} src={picture(d.image)} alt="" draggable={false} style={s} />;
            })}
          </div>
          {base_ && (
            <div style={{
              position: "relative", boxSizing: "border-box", width: total.w, height: base_.size[1] * lay.k, borderStyle: "solid", borderColor: "transparent", borderWidth: `0 ${base_.capRight * lay.k}px 0 ${base_.capLeft * lay.k}px`,
              borderImage: `url(${picture(base_.image)}) 0 ${base_.capRight} 0 ${base_.capLeft} fill / 0 ${px(base_.capRight * lay.k)} 0 ${px(base_.capLeft * lay.k)} repeat`, imageRendering: "pixelated",
            }}>
              {base_.notch && <img src={picture(base_.notch.image)} alt="" draggable={false} style={{ position: "absolute", left: "50%", top: lay.k, width: base_.notch.size[0] * lay.k, height: base_.notch.size[1] * lay.k, transform: "translateX(-50%)", imageRendering: "pixelated" }} />}
            </div>
          )}
          {device.stand && <img src={picture(device.stand.image)} alt="" draggable={false} style={{ width: device.stand.size[0] * lay.k, height: device.stand.size[1] * lay.k, imageRendering: "pixelated" }} />}
        </div>
      </div>
      {sentLine && !picking && (
        <p role="status" className="absolute bottom-3 left-3 m-0 max-w-[calc(100%-24px)] border border-line-strong bg-surface-1 px-2.5 py-1 text-[13px] leading-5">{sentLine}</p>
      )}
      {picking && !target && hover && (
        <p aria-live="off" className="pointer-events-none absolute bottom-3 left-3 m-0 max-w-[calc(100%-24px)] truncate border border-line-strong bg-surface-1 px-2.5 py-1 text-[13px] leading-5">
          <b>{partLabel(hover)}</b><span className="text-text-secondary"> · {measureLine(hover)}</span>
        </p>
      )}
      {target && noteAt && (
        <div role="group" aria-label="Note for this part" className="px-card absolute z-10 flex flex-col gap-1.5 p-2" style={{ left: noteAt.left, top: noteAt.top, width: NOTE_SIZE.w }}>
          <span className="truncate text-[14px] leading-5 font-bold">{partLabel(target.part)}</span>
          <span className="truncate text-[12px] leading-4 text-text-secondary">{measureLine(target.part)}</span>
          <textarea autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value.slice(0, NOTE_MAX))} rows={3} aria-label="What should change here?" placeholder="What should change here?"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } }} className={`py-2 leading-5 ${field}`} />
          <div className="flex justify-end gap-2">
            <Button small variant="ghost" onClick={closeNote}>Cancel</Button>
            <Button small disabled={noteText.trim() === ""} onClick={addNote}>Add note</Button>
          </div>
        </div>
      )}
      </div>
      {pins.length > 0 && (
        <aside aria-label="Notes" className="flex w-[300px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-line-subtle bg-surface-1 p-3">
          <div className="flex items-center gap-2">
            <h2 className="m-0 min-w-0 flex-1 text-[15px] leading-6 font-bold">Notes ({pins.length})</h2>
            <IconButton icon="send" label={`Turn the notes into a ticket for ${send.designer}`} variant="primary" disabled={sending !== null} onClick={() => void startSend()} />
          </div>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {pins.map((p, i) => (
              <li key={p.id} className="flex flex-col gap-1 border border-line-subtle bg-inset p-2">
                <div className="flex items-center gap-2">
                  <span className="font-pixel flex h-6 w-6 shrink-0 items-center justify-center bg-text text-[13px] font-bold text-surface-1" aria-hidden="true">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-bold" title={`${partLabel(p)} · ${pageFile(p.page)}`}>{partLabel(p)}</span>
                  <IconButton icon="trash" label={`Remove note ${i + 1}`} variant="ghost" onClick={() => setPins((cur) => removePin(cur, p.id))} />
                </div>
                <span className="truncate text-[12px] leading-4 text-text-tertiary">{pageFile(p.page)}</span>
                <textarea value={p.note} rows={2} aria-label={`Note ${i + 1}`} onChange={(e) => setPins((cur) => editPin(cur, p.id, e.target.value))} className={`py-1.5 leading-5 ${field}`} />
              </li>
            ))}
          </ol>
        </aside>
      )}
      </div>
      {sending && (
        <Confirm title={`Ticket for ${send.designer}`} confirmLabel={`Create ticket for ${send.designer}`} disabled={sending.phase === "writing" || sending.draft.title.trim() === ""} error={sendError}
          onConfirm={() => { if (sending.phase === "draft") void makeTicket(sending.draft); }} onCancel={cancelSend}>
          {sending.phase === "writing" ? <p className="m-0" role="status">Writing the ticket from your notes…</p> : (
            <>
              {sending.line && <p className="m-0 text-[13px] leading-5" role="status">{sending.line}</p>}
              <input value={sending.draft.title} aria-label="Title" maxLength={100} onChange={(e) => setSending({ ...sending, draft: { ...sending.draft, title: e.target.value } })} className={`h-10 ${field}`} />
              <textarea value={sending.draft.description} rows={9} aria-label="What needs doing" onChange={(e) => setSending({ ...sending, draft: { ...sending.draft, description: e.target.value } })} className={`max-h-[40vh] py-2 leading-5 ${field}`} />
              <textarea value={sending.draft.acceptance} rows={3} aria-label="Done when" onChange={(e) => setSending({ ...sending, draft: { ...sending.draft, acceptance: e.target.value } })} className={`py-2 leading-5 ${field}`} />
            </>
          )}
        </Confirm>
      )}
    </div>
  );
}
