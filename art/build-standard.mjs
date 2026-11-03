// Builds the standard office, app/src/office/standard.json, from a short description of its rooms. Run: node build-standard.mjs
// The building (45 x 27 tiles, x across, y down) is three bands of rooms with a hall between the top two and a corridor to the front door:
//
//   top band     Library | Archive | Planning (Kiki, Nokka) | Engineering (Jiro, Kit, Sen, Bejo) | Marketing (Yuzu, Nobo)       windows and the two boards on the outer wall
//   the hall     a long hall that every top room and middle room opens on
//   middle band  Server room | Ops (Sora) | corridor to the front door | Storage | Lounge
//   bottom band  Admin | Lobby (Kupa, the front door) | Support (Kenn)
//
// Who sits near whom, and why: the Library and the Archive are side by side (notes and files), Planning has the cork board (the tickets) and the flow board (workflows) and sits
// beside Engineering, which has the branch board (worktrees); the Server room and Ops (the gear console, the settings) share a door; the Storage room holds the leftovers bin;
// Admin has the cash desk (costs) and the staff board; the Lobby has the key cabinet (accounts) by the front door and Kupa's desk facing it; Support is next to the Lobby.
// Everything that opens a screen is in the room it belongs to. Only outer walls are tall, so the boards and windows hang on those.
import { writeFileSync } from "node:fs";
import { newObject } from "../app/src/office/edit.ts";
import { STYLES, RUG_PAIRS } from "../app/src/office/engine/styles.ts";
import { checkMap, parseMap } from "../app/src/office/map.ts";

const W = 45, H = 27;
const floor = Array.from({ length: H }, () => Array(W).fill(null));
const walls = Array.from({ length: H }, () => Array(W).fill(false));
const attach = [], objects = [];
const HALL = "cream-tiles";

const rect = (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) floor[y][x] = f; };
const wallRow = (y) => { for (let x = 0; x < W; x++) walls[y][x] = true; };
const wallCol = (x, y0, y1) => { for (let y = y0; y <= y1; y++) walls[y][x] = true; };
/** a gap in a wall (every tile of it is a doorway, so each gap gets its two posts) */
const gap = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { walls[y][x] = false; floor[y][x] = HALL; attach.push({ i: x, j: y, face: "j+", kind: "doorway" }); } };

// ---- the floors
rect(0, 0, W - 1, H - 1, HALL); // under every wall
rect(1, 10, 43, 11, HALL); // the hall
rect(19, 12, 20, 19, HALL); // the corridor to the front door
const room = (x0, y0, x1, y1, style) => rect(x0, y0, x1, y1, style);
room(1, 1, 8, 8, "walnut-planks");      // Library
room(10, 1, 15, 8, "grey-checker");     // Archive
room(17, 1, 26, 8, "lavender-carpet");  // Planning
room(28, 1, 37, 8, "sky-tiles");        // Engineering
room(39, 1, 43, 8, "rose-carpet");      // Marketing
room(1, 13, 8, 18, "midnight-tiles");   // Server room
room(10, 13, 17, 18, "slate-tiles");    // Ops
room(22, 13, 27, 18, "stone-checker");  // Storage
room(29, 13, 43, 18, "butter-carpet");  // Lounge
room(1, 20, 8, 25, "sage-carpet");      // Admin
room(10, 20, 31, 25, "sand-planks");    // Lobby
room(33, 20, 43, 25, "mint-carpet");    // Support

// ---- the walls
wallRow(0); wallRow(H - 1); wallCol(0, 0, H - 1); wallCol(W - 1, 0, H - 1);
wallRow(9); wallRow(12); wallRow(19);
for (const x of [9, 16, 27, 38]) wallCol(x, 0, 9);   // between the top rooms
for (const x of [9, 18, 21, 28]) wallCol(x, 12, 19); // between the middle rooms and round the corridor
for (const x of [9, 32]) wallCol(x, 19, H - 1);      // between the bottom rooms
// the corridor is open to the hall at the top and to the lobby at the bottom
// ---- the doorways
gap(4, 9, 5, 9); gap(12, 9, 13, 9); gap(19, 9, 20, 9); gap(32, 9, 33, 9); gap(40, 9, 41, 9);          // top rooms to the hall
gap(9, 4, 9, 5);                                                                                       // Library to Archive
gap(7, 12, 8, 12); gap(16, 12, 17, 12); gap(19, 12, 20, 12); gap(23, 12, 24, 12); gap(36, 12, 37, 12); // middle rooms to the hall
gap(9, 15, 9, 16); gap(21, 15, 21, 16); gap(28, 15, 28, 16);                                            // Server to Ops, corridor to Storage, Storage to Lounge
gap(19, 19, 20, 19);                                                                                   // corridor to the lobby
gap(9, 22, 9, 23); gap(32, 22, 32, 23);                                                                 // Lobby to Admin and to Support

// ---- what hangs on the outer walls (only the outer walls are tall, so only they show windows and boards)
const hang = (kind, i, j, face, extra = {}) => attach.push({ i, j, face, kind, ...extra });
const win = (i, j, face) => hang("window", i, j, face);
for (const x of [3, 6, 13, 25, 29, 36, 41]) win(x, 0, "j+");                 // top wall
hang("art", 18, 0, "j+", { art: "cork", span: 5 });                            // the tickets, above Planning
hang("art", 31, 0, "j+", { art: "branches", span: 4 });                        // the branches, above Engineering
for (const y of [4]) win(0, y, "i+");                                          // west wall
hang("art", 0, 21, "i+", { art: "staff", span: 4 });                           // the staff board in Admin
for (const y of [3, 6, 14, 17, 21, 24]) win(44, y, "i-");                      // east wall
for (const x of [3, 6, 12, 15, 24, 28, 35, 40]) win(x, H - 1, "j-");          // bottom wall
hang("door", 19, H - 1, "j-", { span: 2 });                                    // the front door

// ---- the furniture
const styleOf = (id) => STYLES.find((s) => s.id === id);
const rugPair = (name) => RUG_PAIRS.find((p) => p.name === name);
const put = (kind, i, j, facing = 0, extra = {}) => { const o = newObject(kind, i, j); if (!o) throw new Error("unknown " + kind); objects.push({ ...o, ...(facing ? { facing } : {}), ...extra }); };
const rug = (name, i, j, w, d) => { const p = rugPair(name); put("rug", i, j, 0, { w, d, c: p.c, c2: p.c2 }); };
const person = (role, i, j, facing = 0, extra = {}) => put("workstation", i, j, facing, { role, ...extra });
const row = (kind, x0, x1, y, facing = 0) => { for (let x = x0; x <= x1; x++) put(kind, x, y, facing); };

// Library: shelves on the back wall with the brain stand among them, a reading table on a rug with an armchair at each end, a sofa in a corner
row("shelf", 2, 6, 1); put("brain stand", 7, 1); put("shelf", 8, 1);
rug("Plum", 2, 3, 5, 4); put("reading table", 3, 4); put("armchair", 2, 4, 3); put("armchair", 5, 4, 1);
put("sofa", 6, 7, 2);
// Archive: the archive drawers and cabinets on the back wall, a folder table with two chairs, shelves on the side wall
put("archive drawers", 10, 1); row("cabinet", 12, 15, 1);
put("folder table", 11, 4); put("chair", 11, 5, 2); put("chair", 12, 3, 0);
put("shelf", 15, 4, 1); put("shelf", 15, 5, 1);
// Planning: Kiki and Nokka side by side on a rug under the cork board, the flow board beside it, a meeting table, a sofa
rug("Lilac", 18, 3, 6, 3); person("product", 19, 3); person("design", 22, 3);
put("flow board", 24, 1);
put("meeting table", 22, 7); put("chair", 22, 6, 0); put("chair", 23, 6, 0); put("chair", 22, 8, 2); put("chair", 23, 8, 2);
put("sofa", 25, 8, 2);
// Engineering: four desks facing in pairs on one rug under the branch board, a whiteboard, cabinets
rug("Sky", 29, 3, 6, 4); person("frontend", 30, 3); person("backend", 33, 3); person("qa", 30, 5, 2); person("security", 33, 5, 2);
put("chart", 35, 1); put("cabinet", 37, 1); put("cabinet", 28, 1); put("bin", 37, 8);
// Marketing: Yuzu and Nobo on a rug, a whiteboard and the rocket, a sofa and an armchair
rug("Peach", 39, 3, 5, 3); person("marketing", 40, 3); person("content", 42, 3);
put("chart", 39, 1); put("rocket", 43, 1); put("sofa", 40, 7, 2); put("armchair", 43, 7, 1);
// Server room: two rows of racks facing each other, the cooling unit, the server terminal between them
row("rack", 2, 5, 13); put("cooling unit", 6, 13); row("rack", 2, 5, 18, 2); put("server terminal", 3, 16, 2);
// Ops: Sora with the deploy console, the gear console on the side wall
rug("Slate", 11, 14, 3, 3); person("devops", 12, 14); put("deploy console", 14, 13); put("gear console", 10, 17, 3); put("cabinet", 10, 13);
// Storage: crates and shelves, the leftovers bin by the side wall
put("crates", 22, 13); put("crates", 25, 13); put("shelf", 26, 13); put("shelf", 27, 13); put("leftovers bin", 27, 17, 1); put("crates", 22, 18, 2);
// Lounge: a meeting table with four chairs on a rug, the big screen (the mockups) on the wall behind the table (clear of the doorway to the hall at x 36 and 37), two sofa corners, a water cooler, a whiteboard
rug("Cream", 33, 14, 5, 4); put("meeting table", 34, 15); put("chair", 34, 14, 0); put("chair", 35, 14, 0); put("chair", 34, 16, 2); put("chair", 35, 16, 2);
put("chart", 30, 13); put("big screen", 33, 13); put("sofa", 39, 13, 0); put("armchair", 41, 13, 0); put("water cooler", 43, 13); put("sofa", 39, 17, 2); put("armchair", 42, 17, 2);
// Admin: the cash desk and the accounts desk on the back wall, a chair, cabinets
put("cash desk", 3, 20); put("accounts desk", 5, 20); put("chair", 5, 21, 2); put("chair", 3, 21, 2); put("cabinet", 7, 20); put("cabinet", 8, 20); rug("Sage", 2, 23, 3, 2);
// Lobby: the front door has the key cabinet and the coat hooks beside it; Kupa's desk faces the door; a waiting corner with a sofa and a low table; cabinets
put("key cabinet", 22, 25, 2); put("hooks board", 17, 25, 2);
rug("Terracotta", 23, 21, 4, 3); person("secretary", 24, 21, 0, { wide: true });
rug("Cream", 11, 21, 5, 4); put("sofa", 11, 24, 2); put("armchair", 14, 24, 2); put("block", 12, 22, 0, { w: 2, d: 1, h: 4, m: "darkwood", label: "table" });
put("sofa", 27, 24, 2); row("cabinet", 28, 30, 20);
// Support: Kenn's desk and the queue desk on a rug, a whiteboard, a waiting sofa
rug("Mint", 35, 21, 4, 3); person("support", 36, 21); put("queue desk", 38, 21); put("chart", 40, 20); put("sofa", 34, 24, 2); put("armchair", 37, 24, 2); put("water cooler", 43, 20);

// ---- write it
const used = new Set(floor.flat().filter(Boolean));
const map = { version: 1, cols: W, rows: H, styles: STYLES.filter((s) => used.has(s.id)), floor, walls, attach, objects };
const text = JSON.stringify(map);
const parsed = parseMap(text);
if (!("map" in parsed)) throw new Error("not a good map: " + parsed.error);
const warnings = checkMap(parsed.map);
console.log(warnings.length ? "WARNINGS:\n- " + warnings.join("\n- ") : "no warnings");
writeFileSync(new URL("../app/src/office/standard.json", import.meta.url), text);
console.log(`written: ${objects.length} objects, ${attach.length} things on walls, ${map.styles.length} floor styles`);
