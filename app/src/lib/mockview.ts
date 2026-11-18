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

/** The address of a Live card's page: the program's own path, put after the live address (nothing is added to it: a real program keeps its own addresses) */
export function liveUrl(liveBase: string, entry: string): string {
  const path = entry.startsWith("/") && !entry.startsWith("//") ? entry : "/";
  return `${liveBase}${path}`;
}

/** The frame's sandbox words for a Live card: the ordinary three, and more for each thing its recipe allows (live.rs `sandbox_header` says the same in the policy header of every answer) */
export function liveSandbox(allow: readonly string[]): string {
  const words = ["allow-scripts", "allow-same-origin", "allow-forms"];
  if (allow.includes("print")) words.push("allow-modals");
  if (allow.includes("downloads")) words.push("allow-downloads");
  return words.join(" ");
}

/** The frame's `allow` attribute (what the page may ask the browser for) for a Live card */
export function liveAllow(allow: readonly string[]): string | undefined {
  const words: string[] = [];
  if (allow.includes("clipboard")) words.push("clipboard-write");
  if (allow.includes("location")) words.push("geolocation");
  return words.length ? words.join("; ") : undefined;
}

/** What each word of a recipe's `allow` list means, for the question the owner answers before the program starts */
export const ALLOW_WORDS: Record<string, string> = { clipboard: "copy to the clipboard", downloads: "save files", location: "ask for this device's location (the browser asks you)", print: "show the print window" };

/** The words for how far a Live program is, for the card and the start panel */
export function livePhaseLine(phase: string): string {
  return phase === "setup" ? "Making the demo data…" : phase === "starting" ? "Starting the program…" : phase === "ready" ? "Running" : phase === "failed" ? "It did not start" : "Not running";
}

/** One string for the files of a card: when it changes, a file was added, removed or saved, and the page is loaded again. */
export const filesSignature = (files: { path: string; size: number; modified: number | null }[]): string =>
  [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => `${f.path}:${f.size}:${f.modified ?? ""}`).join("|");

export type FrameMessage = { kind: "ready" } | { kind: "escape" } | { kind: "wheel"; dy: number; x: number; y: number } | { kind: "open"; url: string } | { kind: "dialog"; what: "alert" | "confirm" | "prompt"; text: string };

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
  if (d.kona === "open") {
    // a Live page asks for an address to be opened in the owner's own browser (the sheet only listens to this for a Live card): only web, mail and phone addresses, and not a long one
    if (typeof d.url !== "string" || d.url.length > 2000) return null;
    try { const u = new URL(d.url); if (!["http:", "https:", "mailto:", "tel:"].includes(u.protocol)) return null; return { kind: "open", url: u.href }; } catch { return null; }
  }
  if (d.kona === "dialog") {
    // a Live page called alert, confirm or prompt: Kona's window cannot show a native question box inside a frame, so the page was answered at once (nothing, No, nothing) and the sheet says what was asked
    if ((d.kind !== "alert" && d.kind !== "confirm" && d.kind !== "prompt") || typeof d.text !== "string") return null;
    return { kind: "dialog", what: d.kind, text: d.text.slice(0, 200) };
  }
  return null;
}

/** The line the sheet shows when a Live program called alert, confirm or prompt. */
export const dialogLine = (what: "alert" | "confirm" | "prompt", text: string): string => {
  const shown = text.length > 80 ? text.slice(0, 80) + "…" : text;
  if (what === "alert") return `The program said "${shown}". Kona cannot show an alert box here.`;
  if (what === "confirm") return `The program asked "${shown}". Kona cannot show a question box here, so it answered No.`;
  return `The program asked "${shown}" and wanted typing. Kona cannot show a question box here, so it answered nothing.`;
};

/** A size in words, for the data of a card */
export const humanBytes = (n: number): string => (n < 1024 ? `${n} bytes` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(1)} GB`);

/** How long ago, in words */
export const ageWords = (secs: number | null): string => {
  if (secs === null) return "at an unknown time";
  if (secs < 90) return "just now";
  if (secs < 5400) return `${Math.round(secs / 60)} minutes ago`;
  if (secs < 129600) return `${Math.round(secs / 3600)} hours ago`;
  return `${Math.round(secs / 86400)} days ago`;
};

/** The one line the sheet shows about what a Live card kept from its last runs */
export const dataLine = (d: { bytes: number; files: number; age_secs: number | null; place: string }): string =>
  `Data from the last run: ${humanBytes(d.bytes)} in ${d.files} ${d.files === 1 ? "file" : "files"}, changed ${ageWords(d.age_secs)}. It is kept in ${d.place}.`;
