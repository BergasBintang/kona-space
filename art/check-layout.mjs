// Checks the layout of a map the way a person would walk and click in it. node check-layout.mjs [map.json] [limit percent, default 5]
// Exit code 1 when any check fails, so a change to the default map (art/build-standard.mjs runs this) cannot bring an old problem back unseen.
//  1. Click areas: a click area is a box round a person or a piece that opens a screen (engine/scene.ts). Where two boxes overlap, the nearer one wins the click, so the other is narrower there.
//     Each area must keep at least 100 - limit percent on all four sides.
//  2. Doorways: the tile on each side of every doorway tile is free (nothing stands in the way of a door), and so is the tile in front of the front door.
//  3. Walking: every person, every piece that opens a screen and every chair has a free tile beside it that can be reached on foot from the front door.
import { readFileSync } from "node:fs";
import { buildScene } from "../app/src/office/engine/scene.ts";
import { KINDS, footprintOf } from "../app/src/office/engine/furniture.ts";
import { doorwayGaps } from "../app/src/office/engine/doorway.ts";

const [, , mapFile = "../app/src/office/standard.json", limitArg = "5"] = process.argv;
const limit = Number(limitArg), map = JSON.parse(readFileSync(new URL(mapFile, import.meta.url), "utf8"));
const problems = [];

// ---- 1. click areas
for (let view = 0; view < 4; view++) {
  const hits = buildScene(map, view).hits; // the nearest last
  const worst = [];
  hits.forEach((h, n) => {
    const [x0, y0, x1, y1] = h.rect, area = (x1 - x0) * (y1 - y0);
    const over = hits.slice(n + 1).filter((o) => o.rect[0] < x1 && o.rect[2] > x0 && o.rect[1] < y1 && o.rect[3] > y0);
    if (!over.length) return;
    let lost = 0;
    for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) if (over.some((o) => x >= o.rect[0] && x < o.rect[2] && y >= o.rect[1] && y < o.rect[3])) lost++;
    worst.push({ key: h.key, pct: (100 * lost) / area, by: over.map((o) => o.key) });
  });
  worst.sort((a, b) => b.pct - a.pct);
  console.log(`side ${view}: ${hits.length} click areas, ${worst.length} touched by a nearer one`);
  for (const w of worst) {
    if (w.pct >= 1) console.log(`  ${w.key}: ${w.pct.toFixed(1)}% under ${w.by.join(", ")}${w.pct > limit ? "  <-- TOO MUCH" : ""}`);
    if (w.pct > limit) problems.push(`side ${view}: ${w.key} loses ${w.pct.toFixed(1)}% of its click area to ${w.by.join(", ")}`);
  }
}

// ---- 2. doorways
const stand = new Map(); // tile -> what stands on it (rugs are flat and do not count)
for (const o of map.objects) { const f = KINDS[o.kind] && o.kind !== "rug" ? footprintOf(o) : null; if (f) for (let j = f[1]; j < f[1] + f[3]; j++) for (let i = f[0]; i < f[0] + f[2]; i++) stand.set(`${i},${j}`, `${KINDS[o.kind].label} at ${o.i},${o.j}`); }
for (const g of doorwayGaps(map)) {
  const along = g.axis === "i" ? [0, 1] : [1, 0]; // the way people walk through
  for (let j = g.first[1]; j <= g.last[1]; j++) for (let i = g.first[0]; i <= g.last[0]; i++) for (const s of [-1, 1]) {
    const k = `${i + along[0] * s},${j + along[1] * s}`, what = stand.get(k);
    if (what) problems.push(`the doorway at ${i},${j} is blocked by ${what} (tile ${k})`);
  }
}
for (const a of map.attach) if (a.kind === "door") for (let n = 0; n < (a.span ?? 1); n++) {
  const [i, j] = a.face === "j-" ? [a.i + n, a.j - 1] : a.face === "j+" ? [a.i + n, a.j + 1] : a.face === "i-" ? [a.i - 1, a.j + n] : [a.i + 1, a.j + n];
  const what = stand.get(`${i},${j}`);
  if (what) problems.push(`the door at ${a.i},${a.j} is blocked by ${what}`);
}

// ---- 3. walking
const walk = buildScene(map, 0).walkable, door = map.attach.find((a) => a.kind === "door");
if (!door) problems.push("there is no front door");
else {
  const start = door.face === "j-" ? [door.i, door.j - 1] : door.face === "j+" ? [door.i, door.j + 1] : door.face === "i-" ? [door.i - 1, door.j] : [door.i + 1, door.j];
  const seen = new Set([start.join(",")]), todo = [start];
  if (!walk[start[1]]?.[start[0]]) problems.push("the tile inside the front door cannot be walked on");
  while (todo.length) { const [x, y] = todo.pop(); for (const [p, q] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (walk[q]?.[p] && !seen.has(`${p},${q}`)) { seen.add(`${p},${q}`); todo.push([p, q]); } }
  for (const o of map.objects) {
    const k = KINDS[o.kind], f = k && o.kind !== "rug" ? footprintOf(o) : null;
    if (!f || !(o.kind === "workstation" || o.kind === "chair" || k.opens)) continue;
    let ok = false;
    for (let j = f[1] - 1; j <= f[1] + f[3] && !ok; j++) for (let i = f[0] - 1; i <= f[0] + f[2] && !ok; i++) { const inside = i >= f[0] && i < f[0] + f[2] && j >= f[1] && j < f[1] + f[3], corner = (i < f[0] || i >= f[0] + f[2]) && (j < f[1] || j >= f[1] + f[3]); if (!inside && !corner && seen.has(`${i},${j}`)) ok = true; }
    if (!ok) problems.push(`${k.label} at ${o.i},${o.j} has no free tile beside it that can be reached on foot from the front door`);
  }
}

console.log(problems.length ? `\n${problems.length} problems:\n- ${problems.join("\n- ")}` : "\nlayout checks: every click area keeps at least " + (100 - limit) + "% on all four sides, every doorway is clear, everything can be reached on foot");
process.exit(problems.length ? 1 : 0);
