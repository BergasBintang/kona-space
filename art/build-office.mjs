// Draws the building twice: with the cats (a preview, and the check that nothing changed), and without them (the picture the app uses),
// plus where each cat sits and the pieces of furniture in front of each one.
import { drawOffice, SIZE, ROOM_LIST, TILE_W, TILE_H, COLS, ROWS, WALL } from "./office.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const full = drawOffice({ cats: true }).img;
full.save("out/office-with-cats.png");
full.scale(3).save("out/office-with-cats-x3.png");

// the part of the picture that is not empty, so the app can centre and fit the building itself, not the empty margin around it
let x0 = full.w, y0 = full.h, x1 = 0, y1 = 0;
for (let y = 0; y < full.h; y++) for (let x = 0; x < full.w; x++) if (full.get(x, y)[3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }

const { img, cats, occluders } = drawOffice({ cats: false });
img.save("out/office.png");
mkdirSync("out/occluders", { recursive: true });
for (const [role, crop] of Object.entries(occluders)) crop.save(`out/occluders/${role}.png`);
cats.sort((a, b) => a.depth - b.depth);
writeFileSync("out/cats-layout.json", JSON.stringify({ frameWidth: 28, frameHeight: 20, cats: cats.map((c) => ({ ...c, occluder: !!occluders[c.role] })) }, null, 2));
writeFileSync("out/rooms.json", JSON.stringify({ picture: "office.png", width: SIZE.w, height: SIZE.h, tile: [TILE_W, TILE_H], tiles: [COLS, ROWS], wallHeight: WALL, content: [x0, y0, x1, y1], rooms: ROOM_LIST }, null, 2));
console.log("office ok", SIZE.w, "x", SIZE.h, "cats", cats.length, "occluders", Object.keys(occluders).length);
