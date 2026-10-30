// Puts what the app needs into app/src/office after a build: the list of pieces for each of the four sides (out/views), the piece pictures those lists name
// (out/parts), and the cat sheet. Files in app/src/office/parts that no side names any more are removed, so the app never carries leftovers.
import { readFileSync, copyFileSync, readdirSync, rmSync, mkdirSync } from "node:fs";

const to = "../app/src/office";
mkdirSync(`${to}/parts`, { recursive: true });
mkdirSync(`${to}/views`, { recursive: true });
const need = new Set();
for (const v of [0, 1, 2, 3]) {
  copyFileSync(`out/views/v${v}.json`, `${to}/views/v${v}.json`);
  for (const p of JSON.parse(readFileSync(`out/views/v${v}.json`, "utf8")).parts) if (p.f) need.add(`${p.f}.png`);
}
for (const f of need) copyFileSync(`out/parts/${f}`, `${to}/parts/${f}`);
let removed = 0;
for (const f of readdirSync(`${to}/parts`)) if (!need.has(f)) { rmSync(`${to}/parts/${f}`); removed++; }
for (const f of ["cats.png", "cats.json"]) copyFileSync(`out/${f}`, `${to}/${f}`);
console.log(`app/src/office: ${need.size} piece pictures, 4 views, the cat sheet; ${removed} old pictures removed`);
