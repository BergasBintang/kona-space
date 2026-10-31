// A tool to find where walls of different heights meet (a tall brick wall next to a low one) on each side of the building, and draw a crop of each place. node find-joints.mjs [view]
import { readFileSync } from "node:fs";
import { Img } from "./lib.mjs";
import { buildScene } from "../app/src/office/engine/scene.ts";

const map = JSON.parse(readFileSync(new URL("../app/src/office/standard.json", import.meta.url), "utf8")), view = Number(process.argv[2] ?? 0);
const scene = buildScene(map, view), { iso } = scene;
const wall = (i, j) => map.walls[j]?.[i] === true;
const joints = [];
for (let j = 0; j < map.rows; j++) for (let i = 0; i < map.cols; i++) {
  if (!wall(i, j)) continue;
  const t = scene.tall.has(`${i},${j}`);
  for (const [a, b] of [[i + 1, j], [i, j + 1]]) if (wall(a, b) && scene.tall.has(`${a},${b}`) !== t) joints.push([i, j, a, b, t]);
}
console.log(`view ${view}: ${joints.length} places where a tall wall tile touches a low one`);
for (const [i, j, a, b, t] of joints.slice(0, 40)) {
  const [u, v] = iso.cell(i, j), [x, y] = iso.PR(u + 0.5, v + 0.5);
  console.log(`  (${i},${j}) ${t ? "tall" : "low"} -- (${a},${b}) ${t ? "low" : "tall"}  at screen ${Math.round(x)},${Math.round(y)}`);
}
