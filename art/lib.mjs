// Tiny pixel canvas for Kona's art kit: no packages, only Node. Draws shapes, writes PNG files, scales with hard edges.
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const parsed = new Map();
export const rgba = (c) => {
  if (Array.isArray(c)) return c;
  let v = parsed.get(c);
  if (!v) { const h = c.replace("#", ""); v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255]; parsed.set(c, v); }
  return v;
};

export class Img {
  constructor(w, h, bg = null) {
    this.w = w; this.h = h; this.d = new Uint8Array(w * h * 4);
    if (bg) for (let i = 0; i < w * h; i++) this.d.set(rgba(bg), i * 4);
  }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0]; const o = (y * this.w + x) * 4; return [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]]; }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d.set(rgba(c), (y * this.w + x) * 4);
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  // Bresenham line on whole pixels
  line(x0, y0, x1, y1, c) {
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
  // filled polygon, even-odd, tested at pixel centres. keep(x, y) can skip pixels (a checker makes see-through glass)
  poly(pts, c, keep) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let k = 0; k < pts.length; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.ceil(xs[k + 1] - 0.5) - 1; x++) if (!keep || keep(x, y)) this.set(x, y, c);
    }
  }
  polyLine(pts, c, close = true) { for (let k = 0; k < pts.length - (close ? 0 : 1); k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; this.line(a[0], a[1], b[0], b[1], c); } }
  blit(src, x, y) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const o = (j * src.w + i) * 4;
      if (src.d[o + 3]) this.set(x + i, y + j, [src.d[o], src.d[o + 1], src.d[o + 2], 255]);
    }
  }
  // every empty pixel next to a drawn one becomes outline
  outline(c) {
    const hits = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)[3]) continue;
      if (this.get(x + 1, y)[3] || this.get(x - 1, y)[3] || this.get(x, y + 1)[3] || this.get(x, y - 1)[3]) hits.push([x, y]);
    }
    hits.forEach(([x, y]) => this.set(x, y, c));
  }
  scale(n) {
    const o = new Img(this.w * n, this.h * n);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const s = ((Math.floor(y / n) * this.w) + Math.floor(x / n)) * 4; o.d.set(this.d.subarray(s, s + 4), (y * o.w + x) * 4); }
    return o;
  }
  png() {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) { raw[y * (this.w * 4 + 1)] = 0; Buffer.from(this.d.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1); }
    const chunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      const body = Buffer.concat([Buffer.from(type), data]);
      const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
      return Buffer.concat([len, body, crc]);
    };
    const head = Buffer.alloc(13); head.writeUInt32BE(this.w, 0); head.writeUInt32BE(this.h, 4); head[8] = 8; head[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  }
  save(path) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, this.png()); }
}

// An image from rows of letters. '.' is empty. Every row must be as long as the first.
export function fromRows(rows, pal) {
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`row ${i} is ${r.length} wide, expected ${w}: "${r}"`); });
  const img = new Img(w, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ".") { if (!pal[ch]) throw new Error(`no colour for "${ch}"`); img.set(x, y, pal[ch]); } }));
  return img;
}
