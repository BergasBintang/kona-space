// Draws a map of the office to a picture, to look at (the app draws the same scene itself). node render-map.mjs [map.json] [view 0-3] [out.png] [scale]
import { readFileSync } from "node:fs";
import { Img } from "./lib.mjs";
import { buildScene } from "../app/src/office/engine/scene.ts";

const [, , mapFile = "../app/src/office/standard.json", viewArg = "0", out = "out/map-v0.png", scaleArg = "1"] = process.argv;
const map = JSON.parse(readFileSync(new URL(mapFile, import.meta.url), "utf8")), view = Number(viewArg);
const roles = JSON.parse(readFileSync(new URL("../app/src/office/cats.json", import.meta.url), "utf8")).rows.map((r) => r.id);
// SEATED=all (or a list of roles, comma between) puts those cats on the chairs of the meeting table
const t0 = Date.now(), scene = buildScene(map, view, seatedOf()), ms = Date.now() - t0;
const cats = Img.fromPng(new URL("../app/src/office/cats.png", import.meta.url));
function seatedOf() { const w = process.env.SEATED; if (!w) return {}; const want = w === "all" ? roles : w.split(","); return Object.fromEntries(roles.map((r, i) => [r, i]).filter(([r]) => want.includes(r))); }

const img = new Img(scene.width, scene.height, "#f2e9d4");
const put = (src, ox, oy, x, y) => { for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const o = (j * src.w + i) * 4; if (src.d[o + 3]) img.set(x + i, y + j, [src.d[o], src.d[o + 1], src.d[o + 2], 255]); } };
const asImg = (e) => { const s = new Img(e.w, e.h); s.d.set(e.d); return s; };
put(asImg(scene.ground), 0, 0, 0, 0);
for (const it of scene.items) {
  if (it.img) put(asImg(it.img), 0, 0, it.x, it.y);
  else { // a cat: frame 0 (idle), the row of its role and look
    const row = it.dir * 11 + roles.indexOf(it.role), s = new Img(28, 20);
    for (let j = 0; j < 20; j++) for (let i = 0; i < 28; i++) { const p = cats.get(i, row * 20 + j); if (p[3]) s.set(i, j, p); }
    put(s, 0, 0, it.x, it.y);
  }
}
// CROP=left,top,width,height (in pixels of the unscaled picture, from the corner of the filled part) draws only that part, to look closely at one place
let [x0, y0, x1, y1] = scene.content;
if (process.env.CROP) { const [l, t, w, h] = process.env.CROP.split(",").map(Number); x1 = x0 + l + w; y1 = y0 + t + h; x0 += l; y0 += t; }
const crop = new Img(x1 - x0, y1 - y0);
for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) crop.set(x - x0, y - y0, img.get(x, y));
crop.scale(Number(scaleArg)).save(new URL(out, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
console.log(`view ${view}: ${scene.width} x ${scene.height}, content ${x1 - x0} x ${y1 - y0}, ${scene.items.length} items, ${scene.cats.length} cats, ${scene.hits.length} click areas, built in ${ms} ms`);
