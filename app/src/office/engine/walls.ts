// The walls of the office, drawn as ONE structure and then cut into pieces, so that every case looks right without being drawn by hand: a wall on its own, the end of a
// run, the middle of a run, a corner, a T, a cross, a door post. How: every wall is a box (a wall block is as big as its tile). All boxes are painted into one picture, and for
// each pixel we remember WHICH box painted it and WHICH SURFACE it belongs to (the top at a height, or the side face on a plane, in a colour). Then the outlines: a pixel gets a
// dark outline where its surface meets a different surface (or open air), and only on the nearer of the two. Two walls that run on into each other are the same surface there,
// so no line shows where they join; a corner is where two different faces meet, so it gets its line. Last, every box takes the pixels it painted: that is its picture.
// Everything works in the camera's own space (u runs down-right, v down-left), so the same code serves all four views.
import { Img, type Colour, type Rgba } from "./img.ts";
import { OUT } from "./palette.ts";
import type { Iso } from "./iso.ts";
import type { Item } from "./furniture.ts";
import type { DecorPlan } from "./decor.ts";

export type WallBox = {
  u0: number; u1: number; v0: number; v1: number; h: number;
  /** [top, the face towards +v, the face towards +u] */
  m: [string, string, string];
  /** the top 3 px of each face, as [+v face, +u face], or null */
  band: [string, string] | null;
  tall: boolean;
  label: string;
  /** the object of the map it belongs to, or -1 */
  ref: number;
  kind: "wall" | "post";
  /** the tile of the plan it stands on (a wall; not a post) */
  tile?: [number, number];
  /** things on its face: windows, a door, boards. They are painted into this tile's picture, so they always go with it. */
  decor?: DecorPlan[];
};

/** A picture that takes a pixel only where one box (one wall tile) has painted its own face, so a thing on a wall can never spill over a neighbour. */
class Clip extends Img {
  target: Img;
  owner: Int32Array;
  tag: Int32Array;
  id = -1;
  constructor(target: Img, owner: Int32Array, tag: Int32Array) { super(0, 0); this.target = target; this.owner = owner; this.tag = tag; this.w = target.w; this.h = target.h; this.ox = target.ox; this.oy = target.oy; }
  override get(x: number, y: number): Rgba { return this.target.get(x, y); }
  override set(x: number, y: number, c: Colour | null) {
    const px = Math.round(x), py = Math.round(y);
    if (!c || px < 0 || py < 0 || px >= this.w || py >= this.h) return;
    const o = py * this.w + px;
    if (this.owner[o] === this.id && this.tag[o] > 0) this.target.set(px, py, c);
  }
}

export function renderWalls(boxes: WallBox[], iso: Iso): Item[] {
  const W = iso.width, H = iso.height, { PR } = iso;
  const img = new Img(W, H), owner = new Int32Array(W * H).fill(-1), tag = new Int32Array(W * H);
  const tagIds = new Map<string, number>();
  const tagOf = (key: string) => { let t = tagIds.get(key); if (!t) { t = tagIds.size + 1; tagIds.set(key, t); } return t; };
  const info = boxes.map((b) => ({ ...b, cu: (b.u0 + b.u1) / 2, cv: (b.v0 + b.v1) / 2 })).map((b) => ({ ...b, depth: b.cu + b.cv })); // a tall wall is ordered like any other piece: a low wall beside it may lie behind it
  info.sort((a, b) => a.depth - b.depth || a.cv - b.cv || a.cu - b.cu);

  const paint = (id: number, pts: number[][], color: string, key: string) => {
    const t = tagOf(key);
    img.poly(pts, color, (x, y) => { if (x < 0 || x >= W || y < 0 || y >= H) return false; const o = y * W + x; owner[o] = id; tag[o] = t; return true; });
  };
  const clip = new Clip(img, owner, tag);
  info.forEach((b, id) => {
    const { u0, u1, v0, v1, h, m, band } = b;
    paint(id, [PR(u0, v0, h), PR(u1, v0, h), PR(u1, v1, h), PR(u0, v1, h)], m[0], `top|${h}|${m[0]}`);
    const faces: [string, number, string, string | undefined, (z: number) => number[][]][] = [
      ["v", v1, m[1], band?.[0], (z) => [PR(u0, v1, z), PR(u1, v1, z)]],
      ["u", u1, m[2], band?.[1], (z) => [PR(u1, v0, z), PR(u1, v1, z)]],
    ];
    for (const [side, plane, color, bandColor, edge] of faces) {
      const cut = bandColor ? h - 3 : h; // the top 3 px of a face are a band of its own
      const [a0, a1] = edge(cut), [b0, b1] = edge(0);
      paint(id, [a0, a1, b1, b0], color, `${side}|${plane}|${color}`);
      if (bandColor) { const [c0, c1] = edge(h); paint(id, [c0, c1, a1, a0], bandColor, `${side}|${plane}|band|${bandColor}`); }
    }
    if (b.decor?.length && b.tile) { // things on the wall, on this tile's own face
      clip.id = id;
      for (const d of b.decor) { const alongI = d.alongI; d.paint(clip, alongI ? b.tile[0] : b.tile[1], (alongI ? b.tile[0] : b.tile[1]) + 1, b.tall); }
    }
  });

  // outlines: where a surface meets another surface or open air, on the nearer one's pixel.
  // Two tiles of one straight run (the same height, the same width, side by side) are one wall, so neither is nearer: between the top and the face of the run the line is
  // always on the same side of the edge. If the later tile won there, the line would jump a pixel at every joint and the edge would show a ridge every tile.
  const sameRun = (p: (typeof info)[number], q: (typeof info)[number]) => p.kind === "wall" && q.kind === "wall" && p.h === q.h && (
    (p.v0 === q.v0 && p.v1 === q.v1 && (p.u1 === q.u0 || q.u1 === p.u0)) || (p.u0 === q.u0 && p.u1 === q.u1 && (p.v1 === q.v0 || q.v1 === p.v0)));
  const mark: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = y * W + x, t = tag[o];
    if (!t) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx, nt = nx < 0 || nx >= W || ny < 0 || ny >= H ? 0 : tag[n];
      if (nt === t) continue;
      if (nt === 0) { mark.push(o); break; }
      const a = info[owner[o]].depth, b = info[owner[n]].depth;
      if (sameRun(info[owner[o]], info[owner[n]]) ? t > nt : a > b || (a === b && t > nt)) { mark.push(o); break; }
    }
  }
  for (const o of mark) img.set(o % W, Math.floor(o / W), OUT);

  // every box takes the pixels it painted
  const x0 = info.map(() => W), y0 = info.map(() => H), x1 = info.map(() => -1), y1 = info.map(() => -1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = owner[y * W + x];
    if (id < 0 || !tag[y * W + x]) continue;
    if (x < x0[id]) x0[id] = x; if (x > x1[id]) x1[id] = x; if (y < y0[id]) y0[id] = y; if (y > y1[id]) y1[id] = y;
  }
  const out: Item[] = [];
  info.forEach((b, id) => {
    if (x1[id] < 0) return;
    const sprite = new Img(x1[id] - x0[id] + 1, y1[id] - y0[id] + 1, x0[id], y0[id]);
    for (let y = y0[id]; y <= y1[id]; y++) for (let x = x0[id]; x <= x1[id]; x++) if (owner[y * W + x] === id && tag[y * W + x]) sprite.set(x, y, img.get(x, y));
    out.push({ kind: b.kind, img: sprite, x: x0[id], y: y0[id], depth: b.depth, fp: [b.u0, b.u1, b.v0, b.v1], label: b.label, ref: b.ref });
  });
  return out;
}
