// The floor: one picture of one tile for each colour (33 x 17 px), copied onto every tile of its style, rugs on top of it, and the edge of the building (the slab it stands on).
// When a tile has grout every pixel on its rim is grout, so the tile next to it, copied over the first, puts grout in exactly the same pixels and a line is never cut.
import { Img } from "./img.ts";
import { mix } from "./palette.ts";
import { OUT } from "./palette.ts";
import type { Iso } from "./iso.ts";
import type { Rug } from "./furniture.ts";
import type { FloorStyle, OfficeMap } from "./types.ts";

const TILE_PIC_X = 16;
const tiles = new Map<string, Img>();

/** One tile: a diamond of `colour`, with `grout` on its rim when there is any. */
export function makeTile(colour: string, grout: string | null = null): Img {
  const key = `${colour}|${grout ?? ""}`;
  let t = tiles.get(key);
  if (t) return t;
  t = new Img(33, 17);
  t.poly([[16, 0], [32, 8], [16, 16], [0, 8]], colour);
  if (grout) {
    const rim: number[][] = [];
    for (let y = 0; y < 17; y++) for (let x = 0; x < 33; x++) if (t.has(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !t!.has(x + dx, y + dy))) rim.push([x, y]);
    for (const [x, y] of rim) t.set(x, y, grout);
  }
  tiles.set(key, t);
  return t;
}

/** which of a style's two colours the tile (i, j) of the plan takes (the same on every side of the building) */
export const tileColour = (r: FloorStyle, i: number, j: number): 0 | 1 =>
  (r.pattern === "checker" || r.pattern === "tiles" ? (i + j) & 1 : r.pattern === "stripeI" ? i & 1 : r.pattern === "carpet" ? 0 : j & 1) as 0 | 1;

const hash = (i: number, j: number, n: number) => ((i * 73856093) ^ (j * 19349663) ^ (n * 83492791)) >>> 0;

/** The ground of the building seen from one side: the slab it stands on, the floor of every tile and the rugs. Returns the picture and a function that says whether a tile of the
 * camera's grid has ground (a floor or a wall). */
export function drawGround(map: OfficeMap, iso: Iso, rugs: Rug[], styleOf: Map<string, FloorStyle>): Img {
  const img = new Img(iso.width, iso.height), { PR } = iso;
  const ground = (u: number, v: number) => {
    if (u < 0 || v < 0 || u >= iso.U || v >= iso.V) return false;
    const [i, j] = iso.unCell(u, v);
    return map.floor[j]?.[i] != null || map.walls[j]?.[i] === true;
  };
  // the front edge of the slab, wherever a tile has nothing in front of it (drawn first: the floor never overlaps it wrongly)
  const face = (pts: number[][], col: string) => { img.poly(pts, col); img.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], OUT); img.line(pts[2][0], pts[2][1], pts[3][0], pts[3][1], OUT); img.line(pts[0][0], pts[0][1], pts[3][0], pts[3][1], OUT); img.line(pts[1][0], pts[1][1], pts[2][0], pts[2][1], OUT); };
  const runs = (len: number, test: (k: number) => boolean) => { const out: [number, number][] = []; let s = -1; for (let k = 0; k <= len; k++) { const ok = k < len && test(k); if (ok && s < 0) s = k; if (!ok && s >= 0) { out.push([s, k]); s = -1; } } return out; };
  for (let c = 1; c <= iso.V; c++) for (const [a, b] of runs(iso.U, (u) => ground(u, c - 1) && !ground(u, c))) face([PR(a, c, 0), PR(b, c, 0), PR(b, c, -9), PR(a, c, -9)], "#caa971");
  for (let c = 1; c <= iso.U; c++) for (const [a, b] of runs(iso.V, (v) => ground(c - 1, v) && !ground(c, v))) face([PR(c, a, 0), PR(c, b, 0), PR(c, b, -9), PR(c, a, -9)], "#a98756");
  // the floor of every tile
  for (let j = 0; j < map.rows; j++) for (let i = 0; i < map.cols; i++) {
    const id = map.floor[j][i];
    if (id == null || map.walls[j][i]) continue; // a wall covers the floor under it
    const r = styleOf.get(id);
    if (!r) continue;
    const n = tileColour(r, i, j), [u, v] = iso.cell(i, j), [x, y] = PR(u, v);
    img.blit(makeTile(r.floor[n], r.pattern === "tiles" ? r.grout ?? mix(r.floor[n], "#000000", 0.12) : null), x - TILE_PIC_X, y);
    if (r.pattern === "carpet") for (let k = 0; k < 4; k++) { const h = hash(i, j, k), p = iso.P(i + 0.15 + (h % 70) / 100, j + 0.15 + ((h >>> 8) % 70) / 100); img.set(Math.round(p[0]), Math.round(p[1]), r.floor[1]); }
  }
  // rugs
  for (const g of rugs) {
    const P = iso.P;
    img.poly([P(g.i, g.j), P(g.i + g.w, g.j), P(g.i + g.w, g.j + g.d), P(g.i, g.j + g.d)], g.c);
    img.polyLine([P(g.i + 0.125, g.j + 0.125), P(g.i + g.w - 0.125, g.j + 0.125), P(g.i + g.w - 0.125, g.j + g.d - 0.125), P(g.i + 0.125, g.j + g.d - 0.125)], g.c2);
  }
  return img;
}
