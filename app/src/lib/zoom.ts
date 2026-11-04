// How big the whole window's contents are drawn: 100, 90 or 80 percent. It is the web view's own zoom (like a browser's), so layout, text
// and pictures all scale together. The choice is kept in the browser store; if that is unavailable it simply falls back to 100.
import { getCurrentWebview } from "@tauri-apps/api/webview";

export const ZOOMS = [100, 90, 80] as const;
export type Zoom = (typeof ZOOMS)[number];

/** What a fresh Kona uses, and what Ctrl and 0 goes back to. */
export const DEFAULT_ZOOM: Zoom = 80;

let current: Zoom = DEFAULT_ZOOM;
const listeners = new Set<(z: Zoom) => void>();

export const getZoom = (): Zoom => current;
export const onZoom = (f: (z: Zoom) => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export function loadZoom() {
  let saved: number = DEFAULT_ZOOM;
  try {
    // Before 0.33.0 every start stored 100 whether anyone chose it or not, so the old value is dropped once; later choices are kept.
    if (localStorage.getItem("kona.zoom.v2")) saved = Number(localStorage.getItem("kona.zoom")) || DEFAULT_ZOOM;
    localStorage.setItem("kona.zoom.v2", "1");
  } catch { /* use the default */ }
  setZoom((ZOOMS as readonly number[]).includes(saved) ? (saved as Zoom) : DEFAULT_ZOOM);
}

export function setZoom(z: Zoom) {
  current = z;
  try { localStorage.setItem("kona.zoom", String(z)); } catch { /* the choice is just not kept */ }
  document.documentElement.style.setProperty("--k", String(100 / z)); // pages keep their physical width when the view is smaller
  void getCurrentWebview().setZoom(z / 100).catch(() => {});
  listeners.forEach((f) => f(z));
}

/** One step smaller (-1) or bigger (+1), or back to the default (0). Ctrl and minus, plus, zero. */
export function stepZoom(dir: -1 | 0 | 1) {
  if (dir === 0) return setZoom(DEFAULT_ZOOM);
  const i = ZOOMS.indexOf(current) - dir; // the list runs from big to small
  setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i))]);
}
