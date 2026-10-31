// A small pixel canvas that works in memory (no browser needed, so the engine can run in a test): rectangles, lines and polygons on whole pixels, copied from one
// picture onto another. An Img has an origin (ox, oy): the drawing code uses the coordinates of the whole scene, and the picture holds only the part of it that
// starts at the origin, so a piece of furniture is drawn into a small picture of its own. Colours are "#rrggbb" or [r, g, b, a].
export type Rgba = [number, number, number, number];
export type Colour = string | Rgba;

const parsed = new Map<string, Rgba>();
export const rgba = (c: Colour): Rgba => {
  if (typeof c !== "string") return c;
  let v = parsed.get(c);
  if (!v) {
    const h = c.replace("#", "");
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
    parsed.set(c, v);
  }
  return v;
};

export class Img {
  w: number;
  h: number;
  ox: number;
  oy: number;
  d: Uint8ClampedArray;
  constructor(w: number, h: number, ox = 0, oy = 0) {
    this.w = Math.max(0, Math.ceil(w)); this.h = Math.max(0, Math.ceil(h)); this.ox = ox; this.oy = oy;
    this.d = new Uint8ClampedArray(this.w * this.h * 4);
  }
  /** the pixel at scene coordinates (x, y); transparent outside the picture */
  get(x: number, y: number): Rgba {
    x = Math.round(x) - this.ox; y = Math.round(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const o = (y * this.w + x) * 4;
    return [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]];
  }
  set(x: number, y: number, c: Colour | null) {
    x = Math.round(x) - this.ox; y = Math.round(y) - this.oy;
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d.set(rgba(c), (y * this.w + x) * 4);
  }
  has(x: number, y: number): boolean { return this.get(x, y)[3] > 0; }
  rect(x: number, y: number, w: number, h: number, c: Colour) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  /** a line on whole pixels (Bresenham) */
  line(x0: number, y0: number, x1: number, y1: number, c: Colour) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** a filled polygon, tested at pixel centres; `keep(x, y)` can skip pixels */
  poly(pts: number[][], c: Colour, keep?: (x: number, y: number) => boolean) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.max(this.oy, Math.floor(Math.min(...ys))), y1 = Math.min(this.oy + this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let k = 0; k < pts.length; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.ceil(xs[k + 1] - 0.5) - 1; x++) if (!keep || keep(x, y)) this.set(x, y, c);
    }
  }
  polyLine(pts: number[][], c: Colour, close = true) {
    for (let k = 0; k < pts.length - (close ? 0 : 1); k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; this.line(a[0], a[1], b[0], b[1], c); }
  }
  /** copy every drawn pixel of `src` onto this picture, with the top left of `src` at scene coordinates (x, y) */
  blit(src: Img, x: number, y: number) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const o = (j * src.w + i) * 4;
      if (src.d[o + 3]) this.set(x + i, y + j, [src.d[o], src.d[o + 1], src.d[o + 2], 255]);
    }
  }
  /** the smallest picture that holds everything drawn, with its origin where it sits in the scene; null when nothing is drawn */
  trim(): Img | null {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[(y * this.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const out = new Img(x1 - x0 + 1, y1 - y0 + 1, this.ox + x0, this.oy + y0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.d.set(this.d.subarray((y * this.w + x) * 4, (y * this.w + x) * 4 + 4), ((y - y0) * out.w + (x - x0)) * 4);
    return out;
  }
}
