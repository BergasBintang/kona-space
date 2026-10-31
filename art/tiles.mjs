// The floor tile: one picture of one tile, 33 x 17 px, copied onto the floor at every tile of a room (see "the floor" in office.mjs).
// A tile is a diamond. When it has grout (`grout` is a colour) every pixel on its rim is grout, so the tile next to it, copied over the first one,
// puts grout in exactly the same pixels and a line is never cut. To draw a tile by hand, save a 33 x 17 PNG as art/tiles/<room id>-<0 or 1>.png
// (0 and 1 are the two colours of the room's floor, `node build-tiles.mjs` writes the ones the script makes) and the build uses it instead.
import { existsSync } from "node:fs";
import { Img } from "./lib.mjs";

export const TILE_PIC_W = 33, TILE_PIC_H = 17, TILE_PIC_X = 16; // the tile's top corner is at (TILE_PIC_X, 0) in the picture

export function makeTile(color, grout = null) {
  const t = new Img(TILE_PIC_W, TILE_PIC_H), dia = [[16, 0], [32, 8], [16, 16], [0, 8]];
  t.poly(dia, color);
  if (grout) {
    const rim = [];
    for (let y = 0; y < TILE_PIC_H; y++) for (let x = 0; x < TILE_PIC_W; x++) if (t.get(x, y)[3] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !t.get(x + dx, y + dy)[3])) rim.push([x, y]);
    for (const [x, y] of rim) t.set(x, y, grout);
  }
  return t;
}

const cache = new Map();
// the tile of a room for one of its two colours (n = 0 or 1): the hand-drawn picture when there is one, else the one the script makes
export function roomTile(id, n, color, grout) {
  const key = `${id}-${n}`;
  if (!cache.has(key)) {
    const file = new URL(`./tiles/${key}.png`, import.meta.url);
    cache.set(key, existsSync(file) ? Img.fromPng(file) : makeTile(color, grout));
  }
  return cache.get(key);
}
