// Puts what the app needs into app/src/office after the cats were drawn: the cat sheet and Kibby's sheet (the office itself is a map, app/src/office/standard.json, drawn by the app with
// the engine in app/src/office/engine; see docs/EDITOR.md). Run after node build-cats.mjs.
import { copyFileSync } from "node:fs";

for (const f of ["cats.png", "cats.json", "kibby.png", "kibby.json"]) copyFileSync(`out/${f}`, `../app/src/office/${f}`);
console.log("app/src/office: the cat sheet and Kibby's sheet");
