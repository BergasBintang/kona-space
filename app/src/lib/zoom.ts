// How big the whole window's contents are drawn: 100, 90 or 80 percent. It is the web view's own zoom (like a browser's), so layout, text
// and pictures all scale together. The choice is kept in the browser store; if that is unavailable it simply falls back to 100.
import { getCurrentWebview } from "@tauri-apps/api/webview";

export const ZOOMS = [100, 90, 80] as const;
export type Zoom = (typeof ZOOMS)[number];

let current: Zoom = 100;
const listeners = new Set<(z: Zoom) => void>();

export const getZoom = (): Zoom => current;
export const onZoom = (f: (z: Zoom) => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export function loadZoom() {
  let saved = 100;
  try { saved = Number(localStorage.getItem("kona.zoom")) || 100; } catch { /* use 100 */ }
  setZoom((ZOOMS as readonly number[]).includes(saved) ? (saved as Zoom) : 100);
}

export function setZoom(z: Zoom) {
  current = z;
  try { localStorage.setItem("kona.zoom", String(z)); } catch { /* the choice is just not kept */ }
  void getCurrentWebview().setZoom(z / 100).catch(() => {});
  listeners.forEach((f) => f(z));
}

/** One step smaller (-1) or bigger (+1), or back to 100 (0). Ctrl and minus, plus, zero. */
export function stepZoom(dir: -1 | 0 | 1) {
  if (dir === 0) return setZoom(100);
  const i = ZOOMS.indexOf(current) - dir; // the list runs from big to small
  setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i))]);
}
