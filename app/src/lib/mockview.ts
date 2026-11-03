// The sums of the mockup previewer (ticket T-0016, decisions 75 and 76), kept apart from the screen so they can be tested.
// A mockup page runs at the TRUE size of a device, in CSS pixels (its width, its height, its `vh`, `vw` and media queries are the device's, never the window's), and the whole
// device is then scaled. Only the screen scales: the pixel-art frame keeps its size, shown at `k` x `k` CSS pixels per art pixel, so its pixels stay square.
// The sheet opens with the device fitted to its room (never bigger than true size). The owner can zoom in from there, up to twice the true size (MAX_ZOOM), never below the fit.

export type Side = "top" | "right" | "bottom" | "left";
export type Frame = {
  image: string; size: [number, number];
  /** the 9-slice, in art pixels: top, right, bottom, left */
  slice: [number, number, number, number];
  /** the same in CSS pixels */
  widthCss: [number, number, number, number];
  screen: { w: number; h: number };
  details: { image: string; side: Side; size: [number, number] }[];
};
export type Device = {
  id: string; label: string; screen: { w: number; h: number }; turns: boolean; k: number; material: string; backdrop: string; screenRadius: number;
  frames: { upright: Frame; turned?: Frame };
  base?: { image: string; size: [number, number]; capLeft: number; capRight: number; overhangArt: number; notch?: { image: string; size: [number, number] } };
  stand?: { image: string; size: [number, number] };
};

export const MAX_ZOOM = 2;
export const ZOOM_STEP = 1.25;
const MIN_FIT = 0.05;
/** the room kept free around the device */
export const MARGIN = 24;

/** the frame to draw: the turned one only for a device that turns */
export const frameOf = (dev: Device, turned: boolean): Frame => (turned && dev.turns && dev.frames.turned ? dev.frames.turned : dev.frames.upright);

export type Layout = {
  frame: Frame; k: number;
  /** the bezel in CSS pixels: top, right, bottom, left */
  bezel: [number, number, number, number];
  screen: { w: number; h: number };
  /** what does not scale: the bezel on both sides, and the overhang of a laptop's base */
  fixedW: number;
  /** the bezel at the top and bottom, a laptop's base and a monitor's stand */
  fixedH: number;
  baseH: number; standH: number; overhang: number;
};

export function layout(dev: Device, turned: boolean): Layout {
  const frame = frameOf(dev, turned), k = dev.k;
  const [t, r, b, l] = frame.widthCss;
  const baseH = dev.base ? dev.base.size[1] * k : 0, standH = dev.stand ? dev.stand.size[1] * k : 0, overhang = dev.base ? dev.base.overhangArt * k : 0;
  return { frame, k, bezel: [t, r, b, l], screen: frame.screen, fixedW: l + r + 2 * overhang, fixedH: t + b + baseH + standH, baseH, standH, overhang };
}

/** The scale of the screen that makes the whole device fit the room (less the margin), never bigger than true size. 1 while the room is not measured yet. */
export function fitScale(lay: Layout, room: { w: number; h: number }, margin = MARGIN): number {
  if (room.w <= 0 || room.h <= 0) return 1;
  const s = Math.min((room.w - 2 * margin - lay.fixedW) / lay.screen.w, (room.h - 2 * margin - lay.fixedH) / lay.screen.h, 1);
  return Math.max(MIN_FIT, s);
}

/** A zoom is never below the fit and never above twice the true size. */
export const clampZoom = (z: number, fit: number): number => Math.min(MAX_ZOOM, Math.max(fit, Number.isFinite(z) ? z : fit));
export const stepZoom = (z: number, dir: 1 | -1, fit: number): number => clampZoom(dir > 0 ? z * ZOOM_STEP : z / ZOOM_STEP, fit);
/** Ctrl and the mouse wheel (a pinch on a touchpad is the same): a small, smooth change */
export const wheelZoom = (z: number, deltaY: number, fit: number): number => clampZoom(z * Math.exp(-Math.max(-400, Math.min(400, deltaY)) * 0.0015), fit);
export const percent = (z: number): number => Math.round(z * 100);

/** The size of the device as it is drawn at scale `s` (the frame's pixels do not scale), with the base and the stand: the size of what the room has to hold. */
export function drawnSize(lay: Layout, s: number): { w: number; h: number } {
  return { w: lay.screen.w * s + lay.fixedW, h: lay.screen.h * s + lay.fixedH };
}

/** The address of a page of a card. `file` may hold folders; every part is made safe for an address. The theme goes in the address so the page starts in it, without a flash. */
export function pageUrl(base: string, projectId: string, card: string, file: string, theme: "light" | "dark"): string {
  const path = file.split("/").filter((p) => p !== "" && p !== "." && p !== "..").map(encodeURIComponent).join("/"); // never a step up
  return `${base}/${encodeURIComponent(projectId)}/${encodeURIComponent(card)}/${path}?kona-theme=${theme}`;
}

/** One string for the files of a card: when it changes, a file was added, removed or saved, and the page is loaded again. */
export const filesSignature = (files: { path: string; size: number; modified: number | null }[]): string =>
  [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => `${f.path}:${f.size}:${f.modified ?? ""}`).join("|");

export type FrameMessage = { kind: "ready" } | { kind: "escape" } | { kind: "wheel"; dy: number; x: number; y: number };

/** What the page's helper may say to the sheet. The page is not trusted: anything else is ignored, and the numbers are made safe. */
export function frameMessage(data: unknown): FrameMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.kona === "ready") return { kind: "ready" };
  if (d.kona === "escape") return { kind: "escape" };
  if (d.kona === "wheel") {
    const [dy, x, y] = [d.dy, d.x, d.y];
    if (typeof dy !== "number" || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(dy) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { kind: "wheel", dy: Math.max(-400, Math.min(400, dy)), x, y };
  }
  return null;
}
