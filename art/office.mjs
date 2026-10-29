// The Kona office: one floor, 20 x 12 tiles, drawn as an isometric cut-away (two back walls, open front).
// A tile is 32 x 16 pixels. i runs down-right, j runs down-left. Every piece is a box, so it lines up without hand-placing pixels.
// Rooms are cells of 4 x 4 tiles: ci = 0..4 along i, cj = 0..2 along j.
import { Img } from "./lib.mjs";
import { cat, FRAME_W, FRAME_H } from "./cat.mjs";

export const TILE_W = 32, TILE_H = 16, WALL = 34;
export const COLS = 20, ROWS = 12; // tiles along i and along j
const OX = ROWS * 16 + 16, OY = WALL + 10;
export const SIZE = { w: (COLS + ROWS) * 16 + 32, h: OY + (COLS + ROWS) * 8 + 16 };
const P = (i, j, z = 0) => [OX + (i - j) * 16, OY + (i + j) * 8 - z];
const OUT = "#33241a";

// materials: [top, left face, right face]
const M = {
  wood: ["#e0ad6c", "#b9834a", "#936339"], darkwood: ["#b07d4f", "#8a5d36", "#6c4727"], white: ["#f4efe5", "#d6d0c2", "#b7b1a3"],
  metal: ["#c4ccd6", "#97a1ad", "#76808c"], server: ["#4a5362", "#363e4b", "#2a313c"], pot: ["#c97b4f", "#a35f3a", "#7f4a2d"],
  leaf: ["#8fd18a", "#5ea866", "#468651"], cork: ["#c89b63", "#a67a45", "#85602f"], crate: ["#d7a566", "#b08049", "#8b6137"],
  teal: ["#8ed8c9", "#5fb4a2", "#468e80"], gold: ["#f3c978", "#d09b45", "#a87a32"], red: ["#d9786a", "#b05a4d", "#8b463c"],
  blue: ["#7fb1e0", "#5b88b8", "#456a92"], paper: ["#fffaf0", "#e7dfcf", "#cfc6b4"], black: ["#3b3f46", "#2b2e34", "#20232a"],
};

// With cats: false the picture has no cats, and the result also lists where each cat sits and the pieces of furniture that stand in front of it
// (so the app can draw a cat between the room and those pieces, and animate it).
export function drawOffice({ cats = true } = {}) {
  let img = new Img(SIZE.w, SIZE.h); // transparent: the ground behind it is whatever colour the app uses
  const poly = (pts, c) => img.poly(pts, c);
  const faceJ = (j, ia, ib, za, zb, c) => poly([P(ia, j, zb), P(ib, j, zb), P(ib, j, za), P(ia, j, za)], c); // a face you see on the down-left side
  const faceI = (i, ja, jb, za, zb, c) => poly([P(i, ja, zb), P(i, jb, zb), P(i, jb, za), P(i, ja, za)], c); // a face you see on the down-right side
  const ln = (a, b, c) => img.line(a[0], a[1], b[0], b[1], c);

  function box(i0, j0, wi, dj, h, m, z0 = 0, outline = true) {
    const i1 = i0 + wi, j1 = j0 + dj, zt = z0 + h;
    poly([P(i0, j0, zt), P(i1, j0, zt), P(i1, j1, zt), P(i0, j1, zt)], m[0]);
    poly([P(i0, j1, zt), P(i1, j1, zt), P(i1, j1, z0), P(i0, j1, z0)], m[1]);
    poly([P(i1, j0, zt), P(i1, j1, zt), P(i1, j1, z0), P(i1, j0, z0)], m[2]);
    if (outline) {
      img.polyLine([P(i0, j0, zt), P(i1, j0, zt), P(i1, j1, zt), P(i0, j1, zt)], OUT);
      ln(P(i0, j1, zt), P(i0, j1, z0), OUT); ln(P(i1, j1, zt), P(i1, j1, z0), OUT); ln(P(i1, j0, zt), P(i1, j0, z0), OUT);
      ln(P(i0, j1, z0), P(i1, j1, z0), OUT); ln(P(i1, j1, z0), P(i1, j0, z0), OUT);
    }
  }

  // ---- floor: a colour pair per room, planks run along i
  const ROOMS = {
    "0,0": ["#c58a52", "#bd824a"], "1,0": ["#a8744a", "#a06c43"], "2,0": ["#b9a58a", "#b19d82"], "3,0": ["#59677a", "#52606f"], "4,0": ["#8fa3a0", "#879b98"],
    "0,1": ["#d9a468", "#d19c60"], "1,1": ["#cf9a5e", "#c79257"], "2,1": ["#d8b274", "#d0aa6c"], "3,1": ["#dcae6b", "#d4a663"], "4,1": ["#a9b08a", "#a1a882"],
    "0,2": ["#9c8f80", "#948778"], "1,2": ["#a88a66", "#a0825f"], "2,2": ["#b8856a", "#b07d62"], "3,2": ["#a9c08f", "#a1b887"], "4,2": ["#a9c08f", "#a1b887"],
  };
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
    const room = ROOMS[`${Math.floor(i / 4)},${Math.floor(j / 4)}`];
    const c = room[j % 2];
    poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], c);
  }
  // soft room borders on the floor
  for (let ci = 0; ci <= 5; ci++) ln(P(ci * 4, 0), P(ci * 4, ROWS), "#00000022".length ? "#8c6a46" : "#000");
  for (let cj = 0; cj <= 3; cj++) ln(P(0, cj * 4), P(COLS, cj * 4), "#8c6a46");

  // ---- front edge of the floor slab
  faceJ(ROWS, 0, COLS, -9, 0, "#caa971");
  faceI(COLS, 0, ROWS, -9, 0, "#a98756");
  ln(P(0, ROWS, 0), P(COLS, ROWS, 0), OUT); ln(P(COLS, ROWS, 0), P(COLS, 0, 0), OUT);
  ln(P(0, ROWS, -9), P(COLS, ROWS, -9), OUT); ln(P(COLS, ROWS, -9), P(COLS, 0, -9), OUT);
  ln(P(0, ROWS, 0), P(0, ROWS, -9), OUT); ln(P(COLS, ROWS, 0), P(COLS, ROWS, -9), OUT); ln(P(COLS, 0, 0), P(COLS, 0, -9), OUT);

  // ---- the two back walls, brick, with a cream cap
  const BRICK = ["#9a5a46", "#8a4e3d"], MORTAR = "#b98a74", CAP = ["#efdcb8", "#d9c39a", "#bfa97f"];
  // right wall: plane j = 0, runs along i (you see its face)
  box(-0.3, -0.3, COLS + 0.3, 0.3, WALL, [CAP[0], BRICK[0], BRICK[1]], 0, false);
  faceJ(0, -0.3, COLS, 0, WALL - 3, BRICK[0]);
  for (let z = 4; z < WALL - 3; z += 4) ln(P(-0.3, 0, z), P(COLS, 0, z), MORTAR);
  for (let r = 0; r * 4 < WALL - 3; r++) for (let i = (r % 2 ? 0.25 : 0); i < COLS; i += 0.5) ln(P(i, 0, r * 4), P(i, 0, Math.min(r * 4 + 4, WALL - 3)), MORTAR);
  faceJ(0, -0.3, COLS, WALL - 3, WALL, CAP[1]); ln(P(-0.3, 0, WALL - 3), P(COLS, 0, WALL - 3), "#a98f66");
  // left wall: plane i = 0, runs along j
  box(-0.3, 0, 0.3, ROWS, WALL, [CAP[0], BRICK[0], BRICK[1]], 0, false);
  faceI(0, 0, ROWS, 0, WALL - 3, BRICK[1]);
  for (let z = 4; z < WALL - 3; z += 4) ln(P(0, 0, z), P(0, ROWS, z), "#a67661");
  for (let r = 0; r * 4 < WALL - 3; r++) for (let j = (r % 2 ? 0.25 : 0); j < ROWS; j += 0.5) ln(P(0, j, r * 4), P(0, j, Math.min(r * 4 + 4, WALL - 3)), "#a67661");
  faceI(0, 0, ROWS, WALL - 3, WALL, CAP[2]); ln(P(0, 0, WALL - 3), P(0, ROWS, WALL - 3), "#a98f66");
  box(-0.3, -0.3, 0.3, 0.3, WALL, [CAP[0], CAP[1], CAP[2]], 0, false);
  ln(P(-0.3, -0.3, WALL), P(0, -0.3, WALL), OUT);

  // ---- windows
  const winJ = (ia, ib) => { // on the right wall
    faceJ(0, ia - 0.08, ib + 0.08, 9, 29, "#efe3c8"); faceJ(0, ia, ib, 11, 27, "#9fd0e8"); faceJ(0, ia, ib, 11, 19, "#b8dff0");
    ln(P((ia + ib) / 2, 0, 11), P((ia + ib) / 2, 0, 27), "#efe3c8"); ln(P(ia, 0, 19), P(ib, 0, 19), "#efe3c8");
    faceJ(0, ia - 0.14, ib + 0.14, 8, 10, "#d9c39a");
  };
  const winI = (ja, jb) => { // on the left wall
    faceI(0, ja - 0.08, jb + 0.08, 9, 29, "#efe3c8"); faceI(0, ja, jb, 11, 27, "#9fd0e8"); faceI(0, ja, jb, 11, 19, "#b8dff0");
    ln(P(0, (ja + jb) / 2, 11), P(0, (ja + jb) / 2, 27), "#efe3c8"); ln(P(0, ja, 19), P(0, jb, 19), "#efe3c8");
    faceI(0, ja - 0.14, jb + 0.14, 8, 10, "#d9c39a");
  };
  [[1.2, 2.4], [5.6, 6.8], [9.6, 10.8], [13.6, 14.8], [17.2, 18.4]].forEach(([a, b]) => winJ(a, b));
  [[0.9, 2.1], [4.9, 6.1], [8.9, 10.1]].forEach(([a, b]) => winI(a, b));

  // ---- things hung on the walls
  // Board (cell 0,0): a cork board with five columns of notes
  faceJ(0, 0.5, 3.6, 8, 29, "#7a5530"); faceJ(0, 0.62, 3.48, 9.5, 27.5, "#c89b63");
  const noteC = ["#f3c978", "#8ed8c9", "#d9786a", "#7fb1e0", "#f7e1b0"];
  for (let c = 0; c < 5; c++) {
    const ia = 0.7 + c * 0.56, ib = ia + 0.44;
    ln(P(ia - 0.05, 0, 10), P(ia - 0.05, 0, 27), "#85602f");
    for (let k = 0; k < 3 - (c % 2) + (c === 4 ? -1 : 0); k++) faceJ(0, ia, ib, 21 - k * 5, 25 - k * 5, noteC[(c + k) % 5]);
  }
  // Git (cell 4,0): a board with a branch graph
  faceJ(0, 16.4, 19.6, 8, 29, "#2d3643"); faceJ(0, 16.52, 19.48, 9.5, 27.5, "#3b4658");
  const g = (i, z) => P(i, 0, z);
  const nodes = [[16.9, 12, "#8ed8c9"], [17.5, 12, "#8ed8c9"], [18.1, 12, "#8ed8c9"], [18.7, 12, "#8ed8c9"], [17.5, 17.5, "#f3c978"], [18.1, 17.5, "#f3c978"], [18.1, 23, "#d9786a"], [18.7, 23, "#d9786a"]];
  ln(g(16.9, 12), g(18.7, 12), "#8ed8c9"); ln(g(17.5, 12), g(17.5, 17.5), "#f3c978"); ln(g(17.5, 17.5), g(18.1, 17.5), "#f3c978"); ln(g(18.1, 17.5), g(18.1, 23), "#d9786a"); ln(g(18.1, 23), g(18.7, 23), "#d9786a"); ln(g(18.1, 17.5), g(18.7, 12), "#8ed8c9");
  nodes.forEach(([i, z, c]) => { const p = g(i, z); img.rect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 3, 3, c); });
  // Costs (cell 4,1): a chart on a free-standing board (drawn with the furniture below)
  // Left wall, back office (cell 0,2): a shelf with a gear panel
  faceI(0, 8.6, 11.4, 9, 27, "#2d3643"); faceI(0, 8.72, 11.28, 10.5, 25.5, "#3b4658");
  [[9.2, "#8ed8c9", 20], [10, "#f3c978", 15], [10.8, "#d9786a", 22]].forEach(([j, c, z]) => { ln(P(0, j, 12), P(0, j, 24), "#566176"); img.rect(Math.round(P(0, j, z)[0]) - 2, Math.round(P(0, j, z)[1]) - 1, 4, 2, c); });
  // Roles staff board on the left wall at the Plan room
  faceI(0, 4.5, 7.5, 12, 27, "#7a5530"); faceI(0, 4.62, 7.38, 13.2, 25.8, "#e9dfc8");
  for (let k = 0; k < 5; k++) { const p = P(0, 4.9 + k * 0.5, 22); img.rect(Math.round(p[0]) - 1, Math.round(p[1]), 3, 2, "#e8b25a"); const q = P(0, 4.9 + k * 0.5, 17); img.rect(Math.round(q[0]) - 1, Math.round(q[1]), 3, 2, k % 2 ? "#8ed8c9" : "#d9786a"); }

  // ---- furniture, sorted from back to front
  const things = [];
  const add = (depth, draw, meta) => things.push({ depth, draw, meta });

  const plant = (i, j) => add(i + j + 0.8, () => { box(i, j, 0.45, 0.45, 5, M.pot); box(i - 0.08, j - 0.08, 0.6, 0.6, 8, M.leaf, 5); box(i + 0.05, j + 0.05, 0.34, 0.34, 5, M.leaf, 12); });
  const rug = (i0, j0, wi, dj, c, c2) => { poly([P(i0, j0), P(i0 + wi, j0), P(i0 + wi, j0 + dj), P(i0, j0 + dj)], c); img.polyLine([P(i0 + 0.15, j0 + 0.15), P(i0 + wi - 0.15, j0 + 0.15), P(i0 + wi - 0.15, j0 + dj - 0.15), P(i0 + 0.15, j0 + dj - 0.15)], c2); };

  // a cat at a desk: a is the seat tile centre. The desk sits in front of the cat.
  const worker = (a, b, role, frame = "idle", extra = () => {}) => {
    const [sx, sy] = P(a, b), cx = Math.round(sx) - 14, cy = Math.round(sy) - 18;
    add(a + b + 0.5, () => img.blit(cat(role, frame), cx, cy), { role, x: cx, y: cy });
    add(a + b + 1.3, () => {
      box(a + 0.25, b + 0.25, 1.25, 1.0, 6, M.wood);
      box(a + 0.3, b + 0.95, 0.5, 0.25, 1, M.white, 6); // keyboard
      box(a + 1.0, b + 0.5, 0.3, 0.5, 7, M.black, 6); // screen, seen from the back
      extra(a, b);
    });
  };

  // --- Board (0,0): a bench in front of the notes
  box(1.0, 1.0, 2.0, 0.8, 4, M.darkwood); box(1.0, 2.2, 2.0, 0.8, 4, M.darkwood); plant(0.4, 0.5); plant(3.1, 0.4);
  // --- Library (1,0): three bookshelves against the wall, a reading table, a rug
  rug(4.6, 1.2, 2.8, 2.2, "#7f5a8a", "#5c3f66");
  const bookC = ["#d9786a", "#8ed8c9", "#f3c978", "#7fb1e0", "#b793d0", "#e8b25a"];
  [4.3, 5.5, 6.7].forEach((i0, n) => add(i0 + 0.9, () => {
    box(i0, 0.02, 1.0, 0.55, 28, M.darkwood);
    for (let sh = 0; sh < 3; sh++) { const z = 3 + sh * 8; faceJ(0.57, i0 + 0.06, i0 + 0.94, z, z + 6, "#4d3320"); for (let b = 0; b < 8; b++) { const x = i0 + 0.08 + b * 0.105; faceJ(0.57, x, x + 0.085, z, z + 5 - (b * 3 + n) % 3, bookC[(b + n * 2 + sh) % 6]); } }
  }));
  add(7.0 + 3.6, () => { box(5.4, 2.4, 1.2, 0.9, 5, M.wood); box(5.5, 3.4, 0.4, 0.4, 3, M.red); });
  // --- Archive (2,0): filing cabinets with drawers
  [8.3, 9.4, 10.5].forEach((i0, n) => add(i0 + 0.9, () => {
    box(i0, 0.02, 0.9, 0.7, 20 + (n % 2) * 4, M.metal);
    for (let d = 0; d < 3; d++) { const z = 2 + d * 6; faceJ(0.72, i0 + 0.08, i0 + 0.82, z, z + 5, "#aeb7c2"); faceJ(0.72, i0 + 0.34, i0 + 0.56, z + 2, z + 3, "#33241a"); }
  }));
  add(11.0 + 2.6, () => { box(9.2, 2.2, 1.4, 0.9, 5, M.wood); box(9.4, 2.4, 0.5, 0.4, 2, M.paper, 5); box(10.0, 2.4, 0.5, 0.4, 3, M.paper, 5); });
  // --- Servers (3,0): three racks with lights
  [12.4, 13.5, 14.6].forEach((i0, n) => add(i0 + 0.9, () => {
    box(i0, 0.02, 0.9, 0.75, 31, M.server);
    for (let u = 0; u < 5; u++) { const z = 3 + u * 5.5; faceJ(0.77, i0 + 0.08, i0 + 0.82, z, z + 4, "#2a313c"); [0.16, 0.26, 0.36].forEach((o, k) => faceJ(0.77, i0 + o, i0 + o + 0.06, z + 1.5, z + 2.6, (u + k + n) % 4 === 0 ? "#f3c978" : "#8ed8c9")); }
  }));
  add(15.5 + 3.0, () => { box(13.0, 2.4, 1.8, 0.7, 5, M.server); faceJ(3.1, 13.1, 14.7, 1.5, 3.5, "#8ed8c9"); });
  // --- Git (4,0): the DevOps desk under the branch board
  worker(18.0, 1.6, "devops");
  plant(16.5, 2.6);
  // --- Plan (0,1): Product and Design
  rug(0.6, 4.6, 3.0, 3.2, "#e8c98e", "#c9a55f");
  worker(1.2, 5.0, "product"); worker(1.2, 6.6, "design", "typeA");
  plant(0.4, 7.4);
  // --- Build (1,1): Frontend, Backend, QA, Security
  worker(5.0, 5.0, "frontend", "typeA"); worker(5.0, 6.8, "backend", "typeB"); worker(6.8, 5.0, "qa"); worker(6.8, 6.8, "security", "waitA");
  // --- Secretary (2,1): the front desk with a bell and a visitor bench
  rug(8.4, 4.6, 3.2, 3.2, "#8a5a6e", "#633f4f");
  {
    const [sx, sy] = P(10.0, 5.2), cx = Math.round(sx) - 14, cy = Math.round(sy) - 18;
    add(10.0 + 6.0, () => img.blit(cat("secretary", "idle"), cx, cy), { role: "secretary", x: cx, y: cy });
  }
  add(10.0 + 5.2 + 1.8, () => { box(9.2, 5.5, 2.4, 1.0, 6, M.darkwood); box(9.5, 5.9, 0.35, 0.35, 3, M.gold, 6); box(10.4, 6.0, 0.5, 0.25, 1, M.white, 6); box(10.9, 5.75, 0.3, 0.5, 6, M.black, 6); });
  box(8.6, 7.0, 0.8, 0.7, 5, M.blue); plant(11.0, 4.3);
  // --- Grow (3,1): Marketing, Content and SEO, Support
  worker(13.0, 5.0, "marketing", "typeA"); worker(13.0, 6.8, "content", "typeB"); worker(14.8, 5.9, "support");
  plant(15.2, 4.2);
  // --- Costs (4,1): a desk with coins and a chart board
  add(17.2 + 5.0, () => { box(16.6, 4.4, 0.2, 2.4, 22, M.white); for (let k = 0; k < 4; k++) faceI(16.8, 4.6 + k * 0.55, 4.6 + k * 0.55 + 0.35, 3, 5 + [6, 11, 8, 14][k], ["#8ed8c9", "#f3c978", "#7fb1e0", "#d9786a"][k]); });
  add(18.6 + 6.0, () => { box(17.6, 5.0, 1.4, 1.1, 6, M.wood); [0, 1, 2].forEach((k) => box(17.8 + k * 0.28, 5.2, 0.24, 0.24, 2 + k * 1.5, M.gold, 6)); box(18.5, 5.5, 0.4, 0.3, 2, M.white, 6); });
  // --- Back office (0,2): a control panel and a mic
  add(1.0 + 10.6, () => { box(0.4, 9.2, 0.5, 1.6, 9, M.metal); [0, 1, 2, 3].forEach((k) => faceI(0.9, 9.35 + k * 0.38, 9.35 + k * 0.38 + 0.2, 4, 7 + k % 2 * 2, ["#8ed8c9", "#f3c978", "#d9786a", "#7fb1e0"][k])); });
  plant(0.5, 11.2); add(2.5 + 9.5, () => { box(2.4, 9.4, 0.18, 0.18, 8, M.black); box(2.3, 9.3, 0.38, 0.38, 2, M.black); box(2.35, 9.35, 0.28, 0.28, 3, M.metal, 8); });
  // --- Closet (1,2): crates and a bin
  add(5.5 + 9.5, () => { box(4.4, 8.4, 1.0, 1.0, 8, M.crate); box(4.5, 8.5, 0.8, 0.8, 7, M.crate, 8); box(5.6, 8.6, 1.0, 1.0, 8, M.crate); });
  add(7.4 + 10.8, () => { box(6.8, 10.2, 0.8, 0.8, 9, M.metal); box(6.75, 10.15, 0.9, 0.9, 2, M.black, 9); });
  add(4.8 + 11.0, () => { box(4.2, 10.2, 1.2, 0.8, 5, M.crate); box(4.4, 10.3, 0.8, 0.6, 5, M.crate, 5); });
  // --- Entrance and key desk (2,2)
  rug(8.6, 9.0, 3.0, 2.2, "#7f9a8e", "#5e7a6e");
  add(10.2 + 9.8, () => { box(9.4, 9.2, 1.8, 0.8, 6, M.wood); [0, 1, 2, 3].forEach((k) => box(9.6 + k * 0.38, 9.5, 0.16, 0.16, 1.5, M.gold, 6)); });
  add(9.4 + 10.2, () => { box(8.7, 10.3, 0.14, 1.1, 18, M.darkwood); [0, 1, 2, 3, 4].forEach((k) => faceI(8.84, 10.4 + k * 0.2, 10.4 + k * 0.2 + 0.08, 8, 14 - (k % 2) * 3, "#f3c978")); });
  // --- Lounge (3,2) and (4,2)
  rug(13.0, 8.6, 4.6, 2.6, "#7f6aa0", "#5b4a7a");
  add(15.0 + 10.2, () => { box(13.6, 9.4, 2.6, 0.8, 5, M.teal); box(13.6, 9.2, 2.6, 0.25, 11, M.teal); });
  add(14.6 + 8.7, () => { box(14.4, 8.5, 1.0, 0.6, 3, M.wood); });
  plant(12.4, 11.0); plant(18.4, 8.5); plant(18.4, 10.8); plant(16.8, 11.0);

  const sorted = things.sort((a, b) => a.depth - b.depth);
  sorted.forEach((t) => { if (t.meta && !cats) return; t.draw(); });
  if (cats) return { img, cats: [], occluders: {} };

  const found = sorted.filter((t) => t.meta).map((t) => ({ ...t.meta, depth: t.depth }));
  const occluders = {};
  for (const c of found) {
    const scene = img;
    img = new Img(SIZE.w, SIZE.h);
    sorted.forEach((t) => { if (!t.meta && t.depth > c.depth) t.draw(); });
    const crop = new Img(FRAME_W, FRAME_H);
    let any = false;
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) { const p = img.get(c.x + x, c.y + y); if (p[3]) { crop.set(x, y, p); any = true; } }
    if (any) occluders[c.role] = crop;
    img = scene;
  }
  return { img, cats: found.map(({ role, x, y, depth }) => ({ role, x, y, depth })), occluders };
}

// The rooms as data, for the app: which cell, what it is for, and the outline on the 1x picture (for hover and click).
export const ROOM_LIST = [
  { id: "board", name: "Board", cell: [0, 0], holds: "Board" }, { id: "library", name: "Library", cell: [1, 0], holds: "Brain" },
  { id: "archive", name: "Archive", cell: [2, 0], holds: "Files" }, { id: "servers", name: "Server room", cell: [3, 0], holds: "Servers" },
  { id: "git", name: "Git room", cell: [4, 0], holds: "Worktrees, the GitHub address, DevOps desk" },
  { id: "plan", name: "Plan", cell: [0, 1], holds: "Product and Design desks, the staff board (Roles, read-only)" },
  { id: "build", name: "Build", cell: [1, 1], holds: "Frontend, Backend, QA and Security desks" },
  { id: "secretary", name: "Front desk", cell: [2, 1], holds: "The secretary and general chat" },
  { id: "grow", name: "Grow", cell: [3, 1], holds: "Marketing, Content and SEO, Support desks" },
  { id: "costs", name: "Accounting", cell: [4, 1], holds: "Costs" },
  { id: "backoffice", name: "Back office", cell: [0, 2], holds: "Voice and Settings" },
  { id: "closet", name: "Storage closet", cell: [1, 2], holds: "Leftovers" },
  { id: "entrance", name: "Entrance", cell: [2, 2], holds: "Accounts (the key desk)" },
  { id: "lounge", name: "Lounge", cell: [3, 2], holds: "Nothing yet (a rest area)" },
  { id: "garden", name: "Garden", cell: [4, 2], holds: "Nothing yet" },
].map((r) => {
  const [ci, cj] = r.cell, i0 = ci * 4, j0 = cj * 4;
  const pt = (i, j) => P(i, j).map(Math.round);
  return { ...r, polygon: [pt(i0, j0), pt(i0 + 4, j0), pt(i0 + 4, j0 + 4), pt(i0, j0 + 4)] };
});
