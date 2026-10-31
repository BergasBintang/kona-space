// Writes the tile of every room floor into art/tiles/ so it can be opened and drawn over by hand (see tiles.mjs). It never overwrites a file that is there.
import { existsSync } from "node:fs";
import { DEFS } from "./office.mjs";
import { makeTile } from "./tiles.mjs";

let n = 0;
for (const d of DEFS) d.floor.forEach((c, k) => {
  const file = new URL(`./tiles/${d.id}-${k}.png`, import.meta.url);
  if (existsSync(file)) return;
  makeTile(c, d.pattern === "tiles" ? d.grout : null).save(file.pathname.replace(/^\/([A-Za-z]:)/, "$1")); n++;
});
console.log(`${n} tile pictures written to art/tiles/`);
