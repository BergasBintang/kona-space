// Draws the building from each of its four sides (view 0 is the first side, then a quarter turn each). For every view it writes:
//   out/office-with-cats[-vN].png: the whole building with its cats, to look at;
//   out/parts/ (shared by all views): a small picture for every piece (a piece of floor, a wall, a desk, a chair...), pieces that look the same share a file;
//   out/views/vN.json: where each piece goes and in what order, back to front (the cats are in the list too, so the app draws a cat in its place),
//     the rooms with their outlines and name plates for that view, and where the cats sit.
// to-app.mjs then copies these to the app.
// And for every view the proof: the parts, put back in order, are exactly the picture, pixel for pixel.
import { drawOffice, setView, SIZE, roomList, TILE_W, TILE_H, COLS, ROWS, WALL, WALK, WALK_STEP } from "./office.mjs";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { Img } from "./lib.mjs";

rmSync("out/parts", { recursive: true, force: true });
mkdirSync("out/parts", { recursive: true });
mkdirSync("out/views", { recursive: true });
const written = new Set();

function readPng(buf) { // our own small PNGs: RGBA, 8 bit, one IDAT, no filter
  let pos = 8, w = 0, h = 0; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos), type = buf.toString("latin1", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len); if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); } if (type === "IDAT") idat.push(data); pos += 12 + len; }
  const raw = inflateSync(Buffer.concat(idat)), out = new Img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 4; x++) out.d[y * w * 4 + x] = raw[y * (w * 4 + 1) + 1 + x];
  return out;
}

for (const view of [0, 1, 2, 3]) {
  setView(view);
  const tag = view === 0 ? "" : `-v${view}`;
  const full = drawOffice({ cats: true }).img; // (this also runs the checks: any CHECK line printed above is a problem)
  full.save(`out/office-with-cats${tag}.png`);

  // the part of the picture that is not empty, so the app can centre and fit the building itself, not the empty margin around it
  let x0 = full.w, y0 = full.h, x1 = 0, y1 = 0;
  for (let y = 0; y < full.h; y++) for (let x = 0; x < full.w; x++) if (full.get(x, y)[3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }

  const { img, cats } = drawOffice({ cats: false });
  cats.sort((a, b) => a.depth - b.depth);
  const rooms = roomList();

  // ---- the parts. The list is in drawing order and holds the cats too.
  // Kibby's walk: for every eighth of a tile along every stretch, where his picture goes and where in the list he is drawn (the build checks each step)
  const stretches = WALK.edges.map(([a, b]) => {
    const A = WALK.nodes[a], B = WALK.nodes[b], n = Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / WALK_STEP);
    return Array.from({ length: n + 1 }, (_, s) => [A[0] + ((B[0] - A[0]) * s) / n, A[1] + ((B[1] - A[1]) * s) / n]);
  });
  const { parts, walk: placed } = drawOffice({ parts: true, probes: stretches.flat() });
  let at0 = 0;
  const walkDoc = { nodes: {}, edges: [] };
  WALK.edges.forEach(([a, b], e) => {
    const here = placed.slice(at0, at0 + stretches[e].length); at0 += stretches[e].length;
    const s = here.map((p, n) => {
      const q = here[Math.min(n + 1, here.length - 1)], r = here[Math.max(n - 1, 0)], dx = n < here.length - 1 ? q.x - p.x : p.x - r.x, dy = n < here.length - 1 ? q.y - p.y : p.y - r.y;
      return [p.x, p.y, p.k, dy > 0 ? (dx < 0 ? 0 : 1) : dx < 0 ? 2 : 3]; // the look: 0 down-left, 1 down-right, 2 up-left, 3 up-right
    });
    walkDoc.nodes[a] ??= [s[0][0], s[0][1], s[0][2]]; walkDoc.nodes[b] ??= [s[s.length - 1][0], s[s.length - 1][1], s[s.length - 1][2]];
    walkDoc.edges.push({ a, b, s });
    const bad = here.map((p, n) => ({ p, n })).filter(({ p }) => p.why.length);
    if (bad.length) console.warn(`CHECK: Kibby on ${a}-${b}, view ${view}: ${bad.length} of ${here.length} steps are wrong, the first at step ${bad[0].n}: ${bad[0].p.why.join("; ")}`);
  });
  const layout = [];
  for (const p of parts) {
    if (p.cat) { layout.push({ cat: p.cat, x: p.x, y: p.y, d: p.d, dir: p.dir ?? 0 }); continue; }
    const png = p.sprite.png(), id = createHash("sha1").update(png).digest("hex").slice(0, 10);
    if (!written.has(id)) { writeFileSync(`out/parts/${id}.png`, png); written.add(id); }
    layout.push({ f: id, x: p.x, y: p.y, d: p.d, ...(p.hides ? { hides: p.hides } : {}), ...(p.room ? { room: p.room } : {}) });
  }
  const roomsDoc = { view, width: SIZE.w, height: SIZE.h, tile: [TILE_W, TILE_H], tiles: [COLS, ROWS], wallHeight: WALL, content: [x0, y0, x1, y1], rooms };
  writeFileSync(`out/views/v${view}.json`, JSON.stringify({ ...roomsDoc, cats: cats, walk: walkDoc, parts: layout }));
  // ---- the proof: the parts, put back in order, are exactly the picture (every pixel)
  const again = new Img(SIZE.w, SIZE.h), shown = new Map();
  for (const p of layout) {
    if (p.cat) continue;
    if (!shown.has(p.f)) shown.set(p.f, readPng(readFileSync(`out/parts/${p.f}.png`)));
    again.blit(shown.get(p.f), p.x, p.y);
  }
  let different = 0;
  for (let i = 0; i < img.d.length; i += 4) if (img.d[i + 3] !== again.d[i + 3] || (img.d[i + 3] && (img.d[i] !== again.d[i] || img.d[i + 1] !== again.d[i + 1] || img.d[i + 2] !== again.d[i + 2]))) different++;
  if (different) throw new Error(`view ${view}: the parts do not make the picture: ${different} pixels differ`);
  console.log(`view ${view}: ${SIZE.w} x ${SIZE.h}, ${layout.filter((p) => !p.cat).length} pieces and ${cats.length} cats, the parts make the picture pixel for pixel`);
}
console.log("files in out/parts:", written.size);
