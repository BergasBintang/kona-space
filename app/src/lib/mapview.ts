// How the office map is shown: its own zoom and its own place in the window. Not the window's zoom (Settings, 100/90/80 percent): that one scales the text and the
// buttons, and the map must not change with it. A map zoom is a whole number of screen pixels for each pixel of the drawing (1, 2, 3 ...), so every pixel stays square and
// sharp whatever the percent view or the Windows scaling is; `dpr` (screen pixels for each CSS pixel, which the web view's zoom and Windows scaling both change) turns it into CSS pixels.

export type Box = [number, number, number, number]; // x0, y0, x1, y1 of the filled part of the drawing
export type Pt = { x: number; y: number };

export const STEPS = [1, 2, 3, 4, 5, 6, 8, 10];

/** The biggest whole-number zoom that shows the whole drawing in a window of `w` x `h` CSS pixels (at least 1). */
export function fitScale(w: number, h: number, dpr: number, [x0, y0, x1, y1]: Box): number {
  const s = Math.floor(Math.min((w * dpr) / (x1 - x0), (h * dpr) / (y1 - y0)));
  return Math.min(STEPS[STEPS.length - 1], Math.max(1, Number.isFinite(s) ? s : 1));
}

/** The zoom one step bigger (+1) or smaller (-1) than `s`. */
export function stepScale(s: number, dir: 1 | -1): number {
  let i = 0;
  for (let n = 0; n < STEPS.length; n++) if (STEPS[n] <= s) i = n;
  return STEPS[Math.min(STEPS.length - 1, Math.max(0, i + dir))];
}

/** The centre of the view is kept inside the drawing, so the map can never be dragged out of sight. */
export function clampCenter(c: Pt, [x0, y0, x1, y1]: Box): Pt {
  return { x: Math.min(x1, Math.max(x0, c.x)), y: Math.min(y1, Math.max(y0, c.y)) };
}

/** What the wheel or a touchpad does to the place of the map. A touchpad sends both directions at once (two fingers slide up, down, left, right, or round), so both move the map; a mouse
 *  wheel sends only up and down, and with Shift its turn moves the map left and right. `delta` is in CSS pixels; the result is in drawing pixels. */
export function wheelPan(deltaX: number, deltaY: number, shift: boolean, k: number): Pt {
  if (shift) return { x: (deltaX || deltaY) / k, y: 0 }; // some mice report a Shift wheel as deltaX, some keep deltaY
  return { x: deltaX / k, y: deltaY / k };
}

/** A pinch on a touchpad reaches the page as a wheel turn with Ctrl held and small deltas (a mouse notch is 100): make them count for more, so a pinch of normal size is a few steps. */
export const pinchBoost = (deltaY: number): number => (Math.abs(deltaY) < 40 ? deltaY * 4 : deltaY);

/** The CSS pixels of the drawing's top left corner, put on a whole screen pixel so no pixel of the drawing is cut. */
export function origin(size: number, centre: number, k: number, dpr: number): number {
  return Math.round((size / 2 - centre * k) * dpr) / dpr;
}

/** After a zoom, the centre that keeps the point under the pointer where it was. `off` is how far the pointer is from the middle of the window, in CSS pixels; `k` and `k2` are CSS pixels
 * for each drawing pixel before and after. */
export function zoomAround(centre: Pt, off: Pt, k: number, k2: number): Pt {
  return { x: centre.x + off.x / k - off.x / k2, y: centre.y + off.y / k - off.y / k2 };
}

/** The wheel zooms a step for every 60 CSS pixels it has turned (a mouse notch is 100, a touchpad sends many small ones). Returns the steps to take now and what is left over. */
export function wheelZoom(carry: number, deltaY: number): { steps: number; carry: number } {
  const total = carry + deltaY, steps = Math.trunc(Math.abs(total) / 60) * (total < 0 ? 1 : -1); // wheel up (a negative delta) zooms in
  return { steps, carry: total - Math.trunc(total / 60) * 60 };
}
