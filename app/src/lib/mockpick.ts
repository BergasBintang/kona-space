// Pick mode of the Mockups sheet (ticket T-0024, decisions 75 and 76): the owner clicks a part of the live page and writes what should change, as numbered pins.
// The page's helper (src-tauri/src/mock_helper.js) reports the part; this file holds the sums with tests: what a report may say (the page is not trusted, so every
// field is text of unknown shape and is cut down here), the pins, and where the note box sits beside a part.

export type Measures = { padding: string; gap: string; radius: string; border: string; w: number; h: number };
export type Part = Measures & { part: string; tag: string; text: string; place: string; within: string[]; page: string };
export type Box = { x: number; y: number; w: number; h: number };
export type PickMessage =
  | ({ kind: "hover" } & Part)
  | { kind: "hover-none" }
  | ({ kind: "pick"; box: Box; vw: number; vh: number } & Part)
  | { kind: "rect"; box: Box; vw: number; vh: number }
  | { kind: "gone" };

/** A pin: a part of a page and what the owner wants changed there. `n` is its place in the list, from 1. */
export type Pin = Part & { id: number; note: string };

export const NOTE_MAX = 600;
export const PINS_MAX = 40;

const num = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : null);
/** text from the page: only a string, no control characters, cut to `max` */
export const cleanText = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

function partOf(d: Record<string, unknown>): Part | null {
  const place = cleanText(d.place, 400), page = cleanText(d.page, 300), tag = cleanText(d.tag, 30).toLowerCase();
  const w = num(d.w, 0, 100000), h = num(d.h, 0, 100000);
  if (!place || !page || !/^[a-z][a-z0-9-]*$/.test(tag) || w === null || h === null) return null;
  const within = Array.isArray(d.within) ? d.within.slice(0, 5).map((s) => cleanText(s, 40)).filter((s) => s !== "") : [];
  return {
    part: cleanText(d.part, 60), tag, text: cleanText(d.text, 160), place, within, page,
    padding: cleanText(d.padding, 80), gap: cleanText(d.gap, 40), radius: cleanText(d.radius, 60), border: cleanText(d.border, 80), w: Math.round(w), h: Math.round(h),
  };
}

/** What the helper of a page may say about picking. Anything else is ignored. */
export function pickMessage(data: unknown): PickMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.kona === "gone") return { kind: "gone" };
  if (d.kona === "hover") {
    if (d.none === true) return { kind: "hover-none" };
    const p = partOf(d);
    return p ? { kind: "hover", ...p } : null;
  }
  if (d.kona === "rect" || d.kona === "pick") {
    const [x, y, w, h, vw, vh] = [num(d.x, -1e6, 1e6), num(d.y, -1e6, 1e6), num(d.kona === "rect" ? d.w : d.rw, 0, 1e6), num(d.kona === "rect" ? d.h : d.rh, 0, 1e6), num(d.vw, 1, 1e6), num(d.vh, 1, 1e6)];
    if (x === null || y === null || w === null || h === null || vw === null || vh === null) return null;
    if (d.kona === "rect") return { kind: "rect", box: { x, y, w, h }, vw, vh };
    const p = partOf(d);
    return p ? { kind: "pick", box: { x, y, w, h }, vw, vh, ...p } : null;
  }
  return null;
}

/** The file of a page inside its card, from the address path `/<project>/<card>/<file>` */
export function pageFile(pathname: string): string {
  const parts = pathname.split("/").filter((s) => s !== "");
  let file = parts.slice(2).join("/");
  try { file = decodeURIComponent(file); } catch { /* keep it as it is */ }
  return file || "index.html";
}

/** The short line that names a part: its data-part name when it has one, else its tag and its first words */
export function partLabel(p: Pick<Part, "part" | "tag" | "text">): string {
  if (p.part) return p.part;
  const words = p.text ? ` "${p.text.length > 28 ? p.text.slice(0, 27) + "…" : p.text}"` : "";
  return `${p.tag}${words}`;
}

/** The numbers of a part in one line, for the readout while the pointer moves */
export function measureLine(m: Measures): string {
  return [`${m.w} × ${m.h}`, m.padding && m.padding !== "0px" ? `padding ${m.padding}` : "", m.gap ? `gap ${m.gap}` : "", m.radius && m.radius !== "0px" ? `radius ${m.radius}` : "", m.border && m.border !== "none" ? `border ${m.border}` : ""]
    .filter((s) => s !== "").join(" · ");
}

export function addPin(pins: Pin[], p: Part, note: string, id: number): Pin[] {
  const text = note.trim().slice(0, NOTE_MAX);
  if (!text || pins.length >= PINS_MAX) return pins;
  return [...pins, { ...p, id, note: text }];
}
export const removePin = (pins: Pin[], id: number): Pin[] => pins.filter((p) => p.id !== id);
export const editPin = (pins: Pin[], id: number, note: string): Pin[] => pins.map((p) => (p.id === id ? { ...p, note: note.slice(0, NOTE_MAX) } : p));

/** What the page's helper needs to draw the pins: the number of each (its place in the list), where it is and on which page */
export const pinsForPage = (pins: Pin[]) => pins.map((p, i) => ({ n: i + 1, place: p.place, page: p.page }));

/** Where the note box goes: beside the part (to its right when it fits, else to its left, else below it), kept inside the room. All numbers are in screen pixels of the room. */
export function placeNote(part: Box, room: { w: number; h: number }, size: { w: number; h: number }, gap = 10): { left: number; top: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let left: number, top: number;
  if (part.x + part.w + gap + size.w <= room.w) { left = part.x + part.w + gap; top = part.y; }
  else if (part.x - gap - size.w >= 0) { left = part.x - gap - size.w; top = part.y; }
  else { left = part.x; top = part.y + part.h + gap; if (top + size.h > room.h) top = part.y - gap - size.h; }
  return { left: clamp(left, 0, Math.max(0, room.w - size.w)), top: clamp(top, 0, Math.max(0, room.h - size.h)) };
}

/** A box inside the page, in CSS pixels of the page, onto the screen: the frame's corner plus the box times the frame's scale. */
export function toScreen(box: Box, frame: { left: number; top: number; scale: number }): Box {
  return { x: frame.left + box.x * frame.scale, y: frame.top + box.y * frame.scale, w: box.w * frame.scale, h: box.h * frame.scale };
}
