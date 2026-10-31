// A test sheet for walls: a small made-up map with every kind of joint (a straight run, a corner, a T, a cross, an end, a lone block, a wall that steps), drawn from all four sides.
// node joint-sheet.mjs [scale]   writes out/joints.png
import { readFileSync } from "node:fs";
import { Img } from "./lib.mjs";
import { buildScene } from "../app/src/office/engine/scene.ts";

const std = JSON.parse(readFileSync(new URL("../app/src/office/standard.json", import.meta.url), "utf8"));
const C = 16, R = 12;
const room = (id) => std.rooms.find((r) => r.id === id);
const map = { version: 1, cols: C, rows: R, rooms: [room("hall"), room("board"), room("library"), room("servers")], floor: Array.from({ length: R }, () => Array(C).fill(null)), walls: Array.from({ length: R }, () => Array(C).fill(false)), attach: [], objects: [] };
for (let j = 1; j < R - 1; j++) for (let i = 1; i < C - 1; i++) map.floor[j][i] = i < 7 ? "board" : j < 6 ? "library" : "servers";
const wall = (i, j) => { map.walls[j][i] = true; if (!map.floor[j][i]) map.floor[j][i] = "board"; };
for (let i = 0; i < C; i++) { wall(i, 0); wall(i, R - 1); } // the ring
for (let j = 0; j < R; j++) { wall(0, j); wall(C - 1, j); }
for (let j = 1; j < 6; j++) wall(7, j); // a divider that ends at the back wall (a T) and at a cross
for (let i = 7; i < C - 1; i++) wall(i, 6); // a divider across (a corner at the end, a T with the first)
for (let i = 1; i < 6; i++) wall(i, 8); // a run with an end
wall(3, 4); wall(10, 3); // lone blocks
wall(3, 3); wall(4, 3); // a bend
map.attach.push({ i: 5, j: 0, face: "j+", kind: "window" }, { i: 0, j: 5, face: "i+", kind: "window" }, { i: 12, j: 11, face: "j-", kind: "door", span: 2 });
map.floor[6][7] = "hall"; map.walls[6][7] = false; map.attach.push({ i: 7, j: 6, face: "j+", kind: "doorway" }); // an opening in the cross
const scale = Number(process.argv[2] ?? 2), tiles = [0, 1, 2, 3].map((v) => buildScene(map, v));
tiles.forEach((s, v) => {
  const img = new Img(s.width, s.height, "#f2e9d4"), put = (src, px, py) => { for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const o = (j * src.w + i) * 4; if (src.d[o + 3]) img.set(px + i, py + j, [src.d[o], src.d[o + 1], src.d[o + 2], 255]); } };
  const lift = (e) => { const t = new Img(e.w, e.h); t.d.set(e.d); return t; };
  put(lift(s.ground), 0, 0); for (const it of s.items) if (it.img) put(lift(it.img), it.x, it.y);
  const out = new Img(s.content[2] - s.content[0] + 8, s.content[3] - s.content[1] + 8, "#f2e9d4");
  for (let yy = s.content[1]; yy < s.content[3]; yy++) for (let xx = s.content[0]; xx < s.content[2]; xx++) out.set(xx - s.content[0] + 4, yy - s.content[1] + 4, img.get(xx, yy));
  out.scale(scale).save(new URL(`out/joints-v${v}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
});
console.log("out/joints-v0..3.png");
