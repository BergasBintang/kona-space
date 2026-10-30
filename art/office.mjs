// The Kona office: one building drawn as an isometric cut-away (two brick back walls, the rest open), planned like a real office:
// a long hall (the main corridor) with a branch to the lobby at the front, and rooms of different sizes off it. A room has solid walls and
// ONE door, onto the hall; rooms never open into each other. The footprint is irregular (rooms stop at different depths).
// A tile is 32 x 16 pixels. i runs down-right, j runs down-left. Every piece is a box, so it lines up without hand-placing pixels.
// The floor plan is DEFS below: rectangles of tiles. A tile that belongs to no rectangle is empty ground. Sizes are free: give a room the
// room it needs. The only soft limit is the picture size: the app shows it at a whole-number scale, so a bigger picture is shown smaller.
import { Img } from "./lib.mjs";
import { renderWalls } from "./walls.mjs";
import { cat, FRAME_W, FRAME_H } from "./cat.mjs";

// One unit of length is a tile (32 x 16 px on the screen); one unit of height is a STEP of 4 px. Everything stands on whole tiles and is whole steps high.
export const TILE_W = 32, TILE_H = 16, STEP = 4, WALL = 8 * STEP, LOW = 2 * STEP; // WALL: the tall brick back wall. LOW: the walls between rooms (a cut-away: low, so they hide little of the room behind them)
export const COLS = 32, ROWS = 19; // tiles along i and along j: the plan, seen from its first side

const OY = WALL + 10;
const q = (v) => Math.round(v * 8) / 8; // positions snap to 1/8 of a tile (2 px across, 1 px down): a slanted edge then has clean, even steps
// The building can be seen from four sides. VIEW is how many quarter turns the camera has made. u runs down-right and v down-left on the screen, as i and j do
// in the first view; rot() says where a point of the plan lies for the camera, unrot() which tile of the plan a cell of the camera's grid is.
let VIEW = 0, OX = 0;
export const SIZE = { w: 0, h: 0 }; // the size of the picture in the current view
export const sidesOf = (r = VIEW) => (r % 2 ? [ROWS, COLS] : [COLS, ROWS]);
export function setView(r) { VIEW = r; const [U, V] = sidesOf(); OX = V * 16 + 16; SIZE.w = (U + V) * 16 + 32; SIZE.h = OY + (U + V) * 8 + 16; }
setView(0);
const rot = (i, j) => (VIEW === 0 ? [i, j] : VIEW === 1 ? [ROWS - j, i] : VIEW === 2 ? [COLS - i, ROWS - j] : [j, COLS - i]);
const unrot = (u, v) => (VIEW === 0 ? [u, v] : VIEW === 1 ? [v, ROWS - 1 - u] : VIEW === 2 ? [COLS - 1 - u, ROWS - 1 - v] : [COLS - 1 - v, u]);
const PR = (u, v, z = 0) => [OX + (q(u) - q(v)) * 16, OY + (q(u) + q(v)) * 8 - Math.round(z)]; // the camera's own projection
const P = (i, j, z = 0) => PR(...rot(i, j), z);
const D = (i, j) => { const [u, v] = rot(i, j); return u + v; }; // how far from the back a point is: the order of drawing
const OUT = "#33241a";

const mix = (a, b, t) => { const x = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16)), y = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16)); return "#" + x.map((v, n) => Math.round(v + (y[n] - v) * t).toString(16).padStart(2, "0")).join(""); };
const shade = (hex) => [hex, mix(hex, "#000000", 0.18), mix(hex, "#000000", 0.34)];

// kind: "team" (cats work here: the plate gets the colour chip and the door posts take the colour), "place" (a screen of the app lives here),
// "hall" (open floor with no name). r = [i, j, width, depth] in tiles. open: no wall towards the hall (the front desk stands in the lobby).
// pattern: how the floor is laid (planks, checker, stripes, carpet, tiles), so rooms differ by more than a colour. wall: the colour of the wall seen from outside.
const HALL = { id: "hall", kind: "hall", floor: ["#e9e2d3", "#e1dac9"], pattern: "tiles", grout: "#cfc7b4" };
const DEFS = [
  // the hall: the main corridor, three niches off it, the branch to the front and the lobby
  { ...HALL, r: [0, 7, 32, 2] }, { ...HALL, r: [12, 5, 4, 2] }, { ...HALL, r: [26, 5, 3, 2] }, { ...HALL, r: [29, 4, 3, 3] }, { ...HALL, r: [10, 9, 2, 6] }, { ...HALL, r: [6, 15, 10, 4] },
  // the back row
  { id: "board", name: "Board", kind: "place", r: [0, 0, 5, 7], floor: ["#dcbf8f", "#d4b787"], pattern: "planks", wall: "#c9a46c", holds: "Board" },
  { id: "library", name: "Library", kind: "place", r: [5, 0, 7, 7], floor: ["#8e633f", "#855b38"], pattern: "planks", wall: "#a77d52", holds: "Brain" },
  { id: "archive", name: "Archive", kind: "place", r: [12, 0, 4, 5], doorAt: 15, floor: ["#b9bfc6", "#a9b0b8"], pattern: "checker", wall: "#8f9aa6", holds: "Files" },
  { id: "servers", name: "Server room", kind: "place", r: [16, 0, 5, 7], floor: ["#4a5565", "#424d5c"], pattern: "tiles", grout: "#303949", wall: "#5f6b80", holds: "Servers" },
  { id: "git", name: "DevOps and Git", kind: "team", color: "#5b69a6", r: [21, 0, 5, 7], floor: ["#9aa6cc", "#8f9bc3"], pattern: "stripeI", wall: "#7f8dc0", holds: "The DevOps desk, Worktrees, the GitHub address" },
  { id: "costs", name: "Accounting", kind: "place", r: [26, 0, 3, 5], floor: ["#9fb59a", "#97ae92"], pattern: "carpet", wall: "#7f9a7a", holds: "Costs" },
  { id: "closet", name: "Storage closet", kind: "place", r: [29, 0, 3, 4], floor: ["#aaa497", "#a29c8f"], pattern: "checker", wall: "#8a8478", holds: "Leftovers" },
  // the west wing, off the main corridor and the branch
  { id: "plan", name: "Product and design", kind: "team", color: "#8d6aa8", r: [0, 9, 4, 6], floor: ["#cdb4dc", "#c4abd4"], pattern: "carpet", wall: "#b79ccb", holds: "Product and Design desks, the staff board (Roles, read-only)" },
  { id: "build", name: "Engineering", kind: "team", color: "#4f7aa6", r: [4, 9, 6, 6], door: "I", floor: ["#a6bfd9", "#9eb7d1"], pattern: "tiles", grout: "#86a3c2", wall: "#7ea0c4", holds: "Frontend, Backend, QA and Security desks" },
  // the east wing, off the main corridor
  { id: "marketing", name: "Marketing", kind: "team", color: "#c4574a", r: [12, 9, 8, 6], floor: ["#eba596", "#e39d8e"], pattern: "carpet", wall: "#e0877a", holds: "The Marketing desk" },
  { id: "content", name: "Content and SEO", kind: "team", color: "#b8922a", r: [20, 9, 5, 5], doorAt: 23, floor: ["#efd68c", "#e7ce84"], pattern: "planks", wall: "#dcb95a", holds: "The Content and SEO desk" },
  { id: "support", name: "Support", kind: "team", color: "#2f8f7c", r: [25, 9, 7, 5], doorAt: 25, floor: ["#93d3c3", "#8bcbbb"], pattern: "carpet", wall: "#5fb39f", holds: "The Support desk" },
  // the front: the lobby and what opens off it
  { id: "secretary", name: "Front desk", kind: "team", open: true, color: "#c98a2e", r: [8, 15, 6, 3], floor: ["#efc88f", "#e6bd82"], pattern: "stripeI", wall: "#d9a85a", holds: "The secretary and general chat" },
  { id: "entrance", name: "Entrance", kind: "place", r: [16, 15, 4, 4], floor: ["#8c93a0", "#838a97"], pattern: "tiles", grout: "#6f7683", wall: "#6f7683", holds: "Accounts (the key desk)" },
  { id: "backoffice", name: "Back office", kind: "place", r: [0, 15, 6, 4], floor: ["#b3a8bd", "#aaa0b5"], pattern: "carpet", wall: "#8f8399", holds: "Voice and Settings" },
];
const own = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
for (const d of DEFS) for (let i = d.r[0]; i < d.r[0] + d.r[2]; i++) for (let j = d.r[1]; j < d.r[1] + d.r[3]; j++) {
  if (own[i][j] && d.kind !== "hall" && own[i][j].kind !== "hall") throw new Error(`${d.id} overlaps ${own[i][j].id} at ${i},${j}`);
  if (!(d.kind === "hall" && own[i][j])) own[i][j] = d; // a room may stand inside the hall rectangles (the front desk); the hall never covers a room
}
const at = (i, j) => (i >= 0 && j >= 0 && i < COLS && j < ROWS ? own[i][j] : null);
const atR = (u, v) => at(...unrot(u, v));
const group = (d) => (d.kind === "hall" || d.open ? "hall" : d.id);

// ---- the borders between rooms. A wall stands on every border between two rooms (or a room and the hall); the hall and the front desk are one open space.
const BORDERS = []; // {o: "J" (a wall along i at j = c) or "I" (along j at i = c), c, from, to, A (behind or left), B (in front or right)}
for (const o of ["J", "I"]) {
  const n = o === "J" ? COLS : ROWS, lines = o === "J" ? ROWS : COLS;
  for (let c = 1; c <= lines; c++) {
    let cur = null;
    for (let k = 0; k <= n; k++) {
      const A = k < n ? (o === "J" ? at(k, c - 1) : at(c - 1, k)) : null, B = k < n ? (o === "J" ? at(k, c) : at(c, k)) : null;
      // a wall stands between two rooms (or a room and the hall), and also on the outer side of a room (B empty): a room is closed all round, except its door
      const key = A && B && group(A) !== group(B) ? A.id + "|" + B.id : A && !B && A.kind !== "hall" && !A.open ? A.id + "|outside" : null;
      if (cur && key !== cur.key) { cur.to = k; BORDERS.push(cur); cur = null; }
      if (key && !cur) cur = { key, o, c, from: k, A, B };
    }
  }
}
// The door of a room: the middle of its longest border with the hall. One door, onto the hall.
const DOORS = new Map();
for (const r of BORDERS) {
  if (!r.B) continue; // the outer side of a room has no door
  const hA = group(r.A) === "hall", hB = group(r.B) === "hall";
  if (hA === hB) continue;
  const room = hA ? r.B : r.A, best = DOORS.get(room.id), side = DEFS.find((d) => d.id === room.id).door;
  if (side && r.o !== side && best) continue; // the room asked for a door on the other kind of border
  if (!best || (side && best.o !== side && r.o === side) || (r.to - r.from > best.to - best.from && (!side || best.o === r.o))) DOORS.set(room.id, r);
}
for (const [id, r] of DOORS) {
  const len = r.to - r.from, w = len >= 5 ? 2 : 1, want = DEFS.find((d) => d.id === id).doorAt; // doorAt: where the door goes along the border, if not in the middle
  r.d0 = want === undefined ? r.from + Math.floor((len - w) / 2) : Math.max(r.from, Math.min(want, r.to - w)); r.d1 = r.d0 + w; r.doorOf = id; r.hallIsA = group(r.A) === "hall";
}
for (const d of DEFS) if (d.kind !== "hall" && !d.open && !DOORS.has(d.id)) throw new Error(`${d.id} has no border with the hall, so it has no door`);

// materials: [top, left face, right face]
const M = {
  wood: ["#e0ad6c", "#b9834a", "#936339"], darkwood: ["#b07d4f", "#8a5d36", "#6c4727"], white: ["#f4efe5", "#d6d0c2", "#b7b1a3"],
  metal: ["#c4ccd6", "#97a1ad", "#76808c"], server: ["#4a5362", "#363e4b", "#2a313c"], pot: ["#c97b4f", "#a35f3a", "#7f4a2d"],
  leaf: ["#8fd18a", "#5ea866", "#468651"], crate: ["#d7a566", "#b08049", "#8b6137"],
  teal: ["#8ed8c9", "#5fb4a2", "#468e80"], gold: ["#f3c978", "#d09b45", "#a87a32"], red: ["#d9786a", "#b05a4d", "#8b463c"],
  blue: ["#7fb1e0", "#5b88b8", "#456a92"], paper: ["#fffaf0", "#e7dfcf", "#cfc6b4"], black: ["#3b3f46", "#2b2e34", "#20232a"],
  rose: ["#e8a79c", "#c98378", "#a5675d"],
};
const CAP = "#f3e9d2";
const BRICK = ["#9a5a46", "#8a4e3d"], CAPC = ["#efdcb8", "#d9c39a", "#bfa97f"];

// ---- the walls of the plan for the current view: a wall on every border between rooms (except a door), on the outer side of every room, and on every side of the
// building that is behind the camera (tall, brick). The pieces are cut from one drawing of them all (walls.mjs).
const wallCache = new Map();
function wallPlan() {
  const edges = [], posts = [];
  const doorKeys = new Set();
  for (const r of DOORS.values()) for (let k = r.d0; k < r.d1; k++) doorKeys.add(`${r.o}|${r.c}|${k}`);
  const ends = (o, c, k) => (o === "J" ? [[k, c], [k + 1, c]] : [[c, k], [c, k + 1]]);
  const bFrontOf = (o, c, k) => { // is the B side of this edge towards the camera?
    const m = o === "J" ? [k + 0.5, c] : [c, k + 0.5], n = o === "J" ? [0, 1] : [1, 0], p0 = rot(...m), p1 = rot(m[0] + n[0] * 0.5, m[1] + n[1] * 0.5);
    return p1[0] > p0[0] || p1[1] > p0[1];
  };
  const sides = (o, c, k) => (o === "J" ? [at(k, c - 1), at(k, c)] : [at(c - 1, k), at(c, k)]); // [A, B]
  const lines = [];
  for (let c = 0; c <= ROWS; c++) for (let k = 0; k < COLS; k++) lines.push(["J", c, k]);
  for (let c = 0; c <= COLS; c++) for (let k = 0; k < ROWS; k++) lines.push(["I", c, k]);
  for (const [o, c, k] of lines) {
    const [A, B] = sides(o, c, k);
    if (!A && !B) continue;
    const bFront = bFrontOf(o, c, k), front = bFront ? B : A, behind = bFront ? A : B;
    let tall = false, room = null;
    if (A && B) {
      if (group(A) === group(B) || doorKeys.has(`${o}|${c}|${k}`)) continue;
      room = group(front) === "hall" ? behind : front; // the face you see belongs to the room in front; the hall has no colour of its own
    } else if (!behind) {
      tall = true; // open ground behind the tile: a back wall of the building
    } else if (behind.kind !== "hall" && !behind.open) {
      room = behind; // open ground in front of a room: the room's outer wall
    } else continue;
    const [a, b] = ends(o, c, k).map(([i, j]) => rot(i, j));
    const e = a[1] === b[1] ? { o: "J", c: a[1], k: Math.min(a[0], b[0]) } : { o: "I", c: a[0], k: Math.min(a[1], b[1]) };
    if (tall) edges.push({ ...e, h: WALL, m: [CAPC[0], BRICK[0], BRICK[1]], band: [CAPC[1], CAPC[2]], brick: true, tall: true, hides: [], label: `back wall ${e.o}${e.c},${e.k}` });
    else {
      const wc = room.wall ?? "#d8cdb6", dk = mix(wc, "#000000", 0.2);
      edges.push({ ...e, h: LOW, m: [CAP, wc, dk], band: [mix(wc, "#ffffff", 0.35), mix(dk, "#ffffff", 0.35)], brick: false, tall: false, hides: behind && group(behind) !== "hall" ? [behind.id] : [], label: `wall ${e.o}${e.c},${e.k}` });
    }
  }
  for (const r of DOORS.values()) { // a post on each side of a door, in the room's colour
    const room = DEFS.find((d) => d.id === r.doorOf), wc = room.wall ?? "#d8cdb6", accent = room.color ?? mix(wc, "#000000", 0.25);
    const behind = bFrontOf(r.o, r.c, r.d0) ? at(...(r.o === "J" ? [r.d0, r.c - 1] : [r.c - 1, r.d0])) : at(...(r.o === "J" ? [r.d0, r.c] : [r.c, r.d0]));
    const hides = behind && behind.id === room.id ? [room.id] : [];
    for (const k of [r.d0, r.d1]) { const [u, v] = rot(...(r.o === "J" ? [k, r.c] : [r.c, k])); posts.push({ u, v, h: LOW + STEP, m: shade(accent), hides, label: `door post of ${room.id}` }); }
  }
  return { edges, posts };
}

// ---- the check run at every build: a piece may not overlap another, cross a wall, stand in a doorway, or hide a cat. It only warns; read the list.
function audit(feet, sorted, getImg, setImg, footprint = true) {
  const warn = (m) => console.warn("CHECK: " + m);
  const roomAt = (i, j) => { const d = at(Math.floor(i), Math.floor(j)); return d ? group(d) : null; };
  if (footprint) {
  for (const f of feet) { // inside one room, and not over a wall
    const ids = new Set([[f.i0 + 0.04, f.j0 + 0.04], [f.i0 + f.wi - 0.04, f.j0 + 0.04], [f.i0 + 0.04, f.j0 + f.dj - 0.04], [f.i0 + f.wi - 0.04, f.j0 + f.dj - 0.04]].map(([i, j]) => roomAt(i, j)));
    if (ids.size > 1 || ids.has(null)) warn(`${f.label} crosses a wall or leaves the floor`);
  }
  for (const f of feet) { // a low piece needs clear floor of its own room on all four sides: from some side of the building a wall stands in front of it and would hide it
    if (f.label.startsWith("cat ") || f.h >= 16) continue;
    const here = roomAt(f.i0 + f.wi / 2, f.j0 + f.dj / 2), side = [];
    for (let t = 0.25; t < f.wi; t += 0.5) side.push([f.i0 + t, f.j0 + f.dj + 0.65], [f.i0 + t, f.j0 - 0.65]);
    for (let t = 0.25; t < f.dj; t += 0.5) side.push([f.i0 + f.wi + 0.65, f.j0 + t], [f.i0 - 0.65, f.j0 + t]);
    if (side.some(([pi, pj]) => { const there = roomAt(pi, pj); return here && there !== here && !(there === null && here === "hall"); })) warn(`${f.label} stands too close to a wall`);
  }
  const hit = (a, b) => a.i0 < b.i0 + b.wi - 0.05 && b.i0 < a.i0 + a.wi - 0.05 && a.j0 < b.j0 + b.dj - 0.05 && b.j0 < a.j0 + a.dj - 0.05;
  for (let x = 0; x < feet.length; x++) for (let y = x + 1; y < feet.length; y++) {
    const a = feet[x], b = feet[y];
    if (hit(a, b) && !(a.owner && b.label.startsWith(`desk of ${a.owner}`)) && !(b.owner && a.label.startsWith(`desk of ${b.owner}`))) warn(`${a.label} overlaps ${b.label}`);
  }
  for (const [id, r] of DOORS) { // two tiles in front of every door stay clear
    const J = r.o === "J", roomIsB = r.hallIsA;
    const zone = J ? { i0: r.d0, wi: r.d1 - r.d0, j0: roomIsB ? r.c : r.c - 2, dj: 2 } : { j0: r.d0, dj: r.d1 - r.d0, i0: roomIsB ? r.c : r.c - 2, wi: 2 };
    for (const f of feet) if (hit(zone, f)) warn(`${f.label} blocks the door of ${id}`);
  }
  }
  // nothing in front of a cat may cover it (its own desk is meant to), and nothing tall may stand in front of a desk
  const keep = getImg(), scratch = new Img(SIZE.w, SIZE.h);
  for (const c of sorted.filter((t) => t.meta)) for (const t of sorted) {
    if (t.meta || t.depth <= c.depth || !t.label || t.label.startsWith(`desk of ${c.meta.role}`)) continue;
    scratch.d.fill(0); setImg(scratch); t.draw(); setImg(keep);
    let n = 0;
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) if (scratch.get(c.meta.x + x, c.meta.y + y)[3]) n++;
    if (n > 20) warn(`${t.label} covers the cat ${c.meta.role} (${n} pixels)`);
  }
}

// With cats: true the picture has the cats in it (and the checks run). With cats: false it has none, and the result lists where each cat sits.
// With parts: true the result is the list of pieces, each as a small picture with its place and depth, the cats among them.
export function drawOffice({ cats = true, parts = false } = {}) {
  let img = new Img(SIZE.w, SIZE.h); // transparent: the ground behind it is whatever colour the app uses
  const poly = (pts, c) => img.poly(pts, c);
  const ln = (a, b, c) => img.line(a[0], a[1], b[0], b[1], c);

  const things = [], feet = []; // feet: where each piece stands on the floor, for the check at the end of the build
  const add = (depth, draw, meta, label, extra) => things.push({ depth, draw, meta, label, ...extra }); // extra: room (a floor), hides (walls and posts that stand in front of a room)

  function box(i0, j0, wi, dj, h, m, z0 = 0, outline = true) {
    const c = [[i0, j0], [i0 + wi, j0], [i0, j0 + dj], [i0 + wi, j0 + dj]].map(([i, j]) => rot(i, j));
    const u0 = Math.min(...c.map((p) => p[0])), u1 = Math.max(...c.map((p) => p[0])), v0 = Math.min(...c.map((p) => p[1])), v1 = Math.max(...c.map((p) => p[1])), zt = z0 + h;
    poly([PR(u0, v0, zt), PR(u1, v0, zt), PR(u1, v1, zt), PR(u0, v1, zt)], m[0]);
    poly([PR(u0, v1, zt), PR(u1, v1, zt), PR(u1, v1, z0), PR(u0, v1, z0)], m[1]);
    poly([PR(u1, v0, zt), PR(u1, v1, zt), PR(u1, v1, z0), PR(u1, v0, z0)], m[2]);
    if (outline) {
      img.polyLine([PR(u0, v0, zt), PR(u1, v0, zt), PR(u1, v1, zt), PR(u0, v1, zt)], OUT);
      ln(PR(u0, v1, zt), PR(u0, v1, z0), OUT); ln(PR(u1, v1, zt), PR(u1, v1, z0), OUT); ln(PR(u1, v0, zt), PR(u1, v0, z0), OUT);
      ln(PR(u0, v1, z0), PR(u1, v1, z0), OUT); ln(PR(u1, v1, z0), PR(u1, v0, z0), OUT);
    }
  }
  // ---- the front edge of the floor slab, wherever a tile has nothing in front of it (drawn first: the floor never overlaps it wrongly)
  const runs = (len, test) => { const out = []; let s = -1; for (let k = 0; k <= len; k++) { const ok = k < len && test(k); if (ok && s < 0) s = k; if (!ok && s >= 0) { out.push([s, k]); s = -1; } } return out; };
  add(-100, () => {
    const [U, V] = sidesOf();
    for (let c = 1; c <= V; c++) for (const [a, b] of runs(U, (u) => atR(u, c - 1) && !atR(u, c))) {
      poly([PR(a, c, 0), PR(b, c, 0), PR(b, c, -9), PR(a, c, -9)], "#caa971");
      ln(PR(a, c, 0), PR(b, c, 0), OUT); ln(PR(a, c, -9), PR(b, c, -9), OUT); ln(PR(a, c, 0), PR(a, c, -9), OUT); ln(PR(b, c, 0), PR(b, c, -9), OUT);
    }
    for (let c = 1; c <= U; c++) for (const [a, b] of runs(V, (v) => atR(c - 1, v) && !atR(c, v))) {
      poly([PR(c, a, 0), PR(c, b, 0), PR(c, b, -9), PR(c, a, -9)], "#a98756");
      ln(PR(c, a, 0), PR(c, b, 0), OUT); ln(PR(c, a, -9), PR(c, b, -9), OUT); ln(PR(c, a, 0), PR(c, a, -9), OUT); ln(PR(c, b, 0), PR(c, b, -9), OUT);
    }
  }, undefined, "floor edge");

  // ---- the floor: a pattern and a colour pair per room, one part for every piece of floor
  const hash = (i, j, n) => ((i * 73856093) ^ (j * 19349663) ^ (n * 83492791)) >>> 0;
  for (const d of DEFS) {
    add(-90, () => {
      for (let i = d.r[0]; i < d.r[0] + d.r[2]; i++) for (let j = d.r[1]; j < d.r[1] + d.r[3]; j++) {
        if (own[i][j] !== d) continue;
        const c = d.pattern === "checker" || d.pattern === "tiles" ? d.floor[(i + j) & 1] : d.pattern === "stripeI" ? d.floor[i & 1] : d.pattern === "carpet" ? d.floor[0] : d.floor[j & 1];
        const dia = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
        poly(dia, c);
        if (d.pattern === "tiles") img.polyLine(dia, d.grout);
        if (d.pattern === "carpet") for (let n = 0; n < 4; n++) { const h = hash(i, j, n), u = 0.15 + (h % 70) / 100, v = 0.15 + ((h >> 8) % 70) / 100; const p = P(i + u, j + v); img.set(Math.round(p[0]), Math.round(p[1]), d.floor[1]); }
      }
    }, undefined, `floor of ${d.id}`, { room: d.id });
  }


  // ---- furniture and walls, sorted from back to front

  // ---- the walls: drawn once for this view as one structure (walls.mjs) and cut into pieces. A wall in front of a room is left out when the app goes into that room.
  if (!wallCache.has(VIEW)) { const { edges, posts } = wallPlan(); wallCache.set(VIEW, renderWalls({ edges, posts, PR, size: SIZE, T: 0.125, OUT })); }
  for (const w of wallCache.get(VIEW)) add(w.depth, () => img.blit(w.sprite, w.x, w.y), undefined, w.label, { hides: w.hides, fp: w.tall ? undefined : w.fp });

  // ---- furniture. Every piece stands on whole tiles (a footprint of w x d tiles with its corner on a tile corner) and is built from boxes that are a whole number of
  // steps high; a detail smaller than a step (a keyboard, a row of books, a light) is painted on a face or on the top, as part of the piece's own picture.
  // A piece is drawn in its own frame: x along its width, y from its back (0) to its front (d). It faces one of four ways on the plan (0: its front looks towards +j,
  // 1: towards -i, 2: towards -j, 3: towards +i). The same drawing is turned with the plan, so a piece looks right from all four sides of the building.
  // where a piece stands on the ground in the camera's own space, [u0, u1, v0, v1], a little smaller than its tiles so that a wall on the tile edge is clearly beside it, not under it
  const footprint = (i0, j0, w, d, shrink = 0.15) => {
    const c = [[i0, j0], [i0 + w, j0], [i0, j0 + d], [i0 + w, j0 + d]].map(([i, j]) => rot(i, j));
    return [Math.min(...c.map((p) => p[0])) + shrink, Math.max(...c.map((p) => p[0])) - shrink, Math.min(...c.map((p) => p[1])) + shrink, Math.max(...c.map((p) => p[1])) - shrink];
  };
  const GRID = new Set(); // what broke the whole-tile / whole-step rule, printed once at the end of the build
  function frame(i0, j0, w, d, facing, label) {
    const toPlan = (x, y) => (facing === 0 ? [i0 + x, j0 + y] : facing === 1 ? [i0 + d - y, j0 + x] : facing === 2 ? [i0 + w - x, j0 + d - y] : [i0 + y, j0 + w - x]);
    const dir = (dx, dy) => { const a = toPlan(0, 0), b = toPlan(dx, dy); return [b[0] - a[0], b[1] - a[1]]; };
    const rect = (x, y, bw, bd) => { const p = toPlan(x, y), r = toPlan(x + bw, y + bd); return [Math.min(p[0], r[0]), Math.min(p[1], r[1]), Math.abs(r[0] - p[0]), Math.abs(r[1] - p[1])]; };
    const plane = (p0, p1, n, za, zb, c) => { // a flat face on a plane of the plan, painted only when it looks towards the camera
      const a = rot(...p0), b = rot(...p1), s = rot(p0[0] + n[0], p0[1] + n[1]);
      if (s[0] - a[0] <= 0 && s[1] - a[1] <= 0) return;
      poly([PR(a[0], a[1], zb), PR(b[0], b[1], zb), PR(b[0], b[1], za), PR(a[0], a[1], za)], c);
    };
    return {
      at: toPlan,
      b(x, y, bw, bd, h, m, z0 = 0) { // a box
        if (h % STEP || z0 % STEP) GRID.add(`${label}: a box ${h} high from ${z0} is not whole steps`);
        box(...rect(x, y, bw, bd), h, m, z0);
      },
      top(x, y, bw, bd, z, c) { const [a, b, w2, d2] = rect(x, y, bw, bd); poly([P(a, b, z), P(a + w2, b, z), P(a + w2, b + d2, z), P(a, b + d2, z)], c); }, // paint on a top
      fy: (y, xa, xb, za, zb, c, s = 1) => plane(toPlan(xa, y), toPlan(xb, y), dir(0, s), za, zb, c), // paint on the face at depth y, looking towards +y (s = 1) or -y
      fx: (x, ya, yb, za, zb, c, s = 1) => plane(toPlan(x, ya), toPlan(x, yb), dir(s, 0), za, zb, c), // the same on the face at width x
    };
  }
  // h: the height of the highest point. A low piece may not stand right behind a wall (the wall would hide it); a tall one may.
  const piece = (i0, j0, w, d, facing, label, h, build) => {
    if (![i0, j0, w, d].every(Number.isInteger)) GRID.add(`${label} at ${i0},${j0}: the footprint is not whole tiles`);
    const sw = facing % 2 ? d : w, sd = facing % 2 ? w : d; // its footprint on the plan
    feet.push({ label: `${label} at ${i0},${j0}`, i0, j0, wi: sw, dj: sd, h });
    const L = frame(i0, j0, w, d, facing, `${label} at ${i0},${j0}`);
    add(D(i0 + sw / 2, j0 + sd / 2), () => build(L), undefined, `${label} at ${i0},${j0}`, { fp: footprint(i0, j0, sw, sd) });
  };

  const plant = (i, j) => piece(i, j, 1, 1, 0, "plant", 16, (L) => { L.b(0.25, 0.25, 0.5, 0.5, 4, M.pot); L.b(0.125, 0.125, 0.75, 0.75, 4, M.leaf, 4); L.b(0.25, 0.25, 0.5, 0.5, 4, M.leaf, 8); L.b(0.375, 0.375, 0.25, 0.25, 4, M.leaf, 12); });
  const rug = (i0, j0, wi, dj, c, c2) => add(-60, () => { poly([P(i0, j0), P(i0 + wi, j0), P(i0 + wi, j0 + dj), P(i0, j0 + dj)], c); img.polyLine([P(i0 + 0.125, j0 + 0.125), P(i0 + wi - 0.125, j0 + 0.125), P(i0 + wi - 0.125, j0 + dj - 0.125), P(i0 + 0.125, j0 + dj - 0.125)], c2); }, undefined, "rug");
  // a plain block: a bench, a crate, a low table. It sits a little inside its footprint, so two neighbours do not melt into one block.
  const block = (i, j, w, d, h, m, label = "block", facing = 0) => piece(i, j, w, d, facing, label, h, (L) => L.b(0.125, 0.125, (facing % 2 ? d : w) - 0.25, (facing % 2 ? w : d) - 0.25, h, m));
  // a sofa, a bench and an armchair are just a seat, like a chair: a backrest and arms only made the picture busy
  const sofa = (i, j, w, facing, m, label = "sofa") => piece(i, j, w, 1, facing, label, 8, (L) => L.b(0.125, 0.125, w - 0.25, 0.75, 8, m));
  const armchair = (i, j, facing, m) => piece(i, j, 1, 1, facing, "armchair", 8, (L) => L.b(0.125, 0.125, 0.75, 0.75, 8, m));
  const chair = (i, j, facing = 0, m = M.red) => piece(i, j, 1, 1, facing, "chair", 4, (L) => L.b(0.125, 0.125, 0.75, 0.75, 4, m)); // just a seat: a backrest only made the picture busy
  // a standing chart: a framed panel on two short legs with its bars on the front. It stands at the back of a room or against a wall, never in front of a desk.
  const barsOn = (L, y, w, bars) => {
    const edge = 0.25, bw = Math.max(0.25, Math.floor(((w - 2 * edge) / bars.length) * 8) / 8);
    bars.forEach(([c, bh], k) => L.fy(y, edge + k * bw, edge + k * bw + bw - 0.125, 6, 6 + Math.min(9, Math.round(bh * 0.6)), c));
  };
  const standing = (i, j, w, facing, decor) => piece(i, j, w, 1, facing, "board", 20, (L) => {
    L.b(0.125, 0.25, 0.125, 0.125, 4, M.darkwood); L.b(w - 0.25, 0.25, 0.125, 0.125, 4, M.darkwood);
    L.b(0, 0.25, w, 0.125, 16, M.white, 4);
    decor(L, 0.375, w);
  });
  const chart = (i, j, w, facing, bars) => standing(i, j, w, facing, (L, y, ww) => { L.fy(y, 0.125, ww - 0.125, 17, 19, bars[0][0]); barsOn(L, y, ww, bars); });
  const shelf = (i, j, facing, n) => piece(i, j, 1, 1, facing, "shelf", 28, (L) => { // a bookshelf against a wall
    const bookC = ["#d9786a", "#8ed8c9", "#f3c978", "#7fb1e0", "#b793d0", "#e8b25a"];
    L.b(0, 0, 1, 0.5, 28, M.darkwood);
    for (let sh = 0; sh < 3; sh++) { const z = 3 + sh * 8; L.fy(0.5, 0.0, 1, z, z + 6, "#4d3320"); for (let b = 0; b < 6; b++) L.fy(0.5, 0.125 + b * 0.125, 0.25 + b * 0.125, z, z + 5 - (b * 3 + n) % 3, bookC[(b + n * 2 + sh) % 6]); }
  });
  const rack = (i, j, facing, n) => piece(i, j, 1, 1, facing, "rack", 32, (L) => {
    L.b(0.125, 0, 0.75, 0.75, 32, M.server);
    for (let u = 0; u < 5; u++) { const z = 3 + u * 5.5; L.fy(0.75, 0.25, 0.75, z, z + 4, "#2a313c"); [0.25, 0.375, 0.5].forEach((o, k) => L.fy(0.75, o, o + 0.125, z + 1.5, z + 2.6, (u + k + n) % 4 === 0 ? "#f3c978" : "#8ed8c9")); }
  });
  const cabinet = (i, j, facing, n) => piece(i, j, 1, 1, facing, "cabinet", 24, (L) => {
    L.b(0.125, 0, 0.75, 0.625, 20 + (n % 2) * 4, M.metal);
    for (let d = 0; d < 3; d++) { const z = 2 + d * 6; L.fy(0.625, 0.25, 0.75, z, z + 5, "#aeb7c2"); L.fy(0.625, 0.375, 0.625, z + 2, z + 3, "#33241a"); }
  });

  // what each role keeps on the desk, so you can tell the desks apart. (x, y) is a free spot of 1/4 tile on the desk top, at the height DESK.
  const DESK = 8;
  const PROPS = {
    marketing: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.red, DESK); L.b(x + 0.125, y, 0.125, 0.25, 4, M.white, DESK + 4); }, // a megaphone
    content: (L, x, y) => { L.top(x, y, 0.25, 0.25, DESK, M.paper[0]); L.b(x + 0.125, y + 0.125, 0.125, 0.125, 4, M.gold, DESK); }, // paper and a pencil cup
    support: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.blue, DESK); }, // a phone
    product: (L, x, y) => { L.top(x, y, 0.25, 0.25, DESK, M.gold[0]); L.top(x + 0.125, y + 0.125, 0.125, 0.125, DESK, M.red[0]); }, // sticky notes
    design: (L, x, y) => { ["#f3c978", "#d9786a", "#7fb1e0", "#8ed8c9"].forEach((c, k) => L.b(x + (k % 2) * 0.125, y + (k >> 1) * 0.125, 0.125, 0.125, 4, shade(c), DESK)); }, // paint pots
    frontend: (L, x, y) => { L.b(x, y, 0.25, 0.125, 8, M.black, DESK); L.fy(y, x, x + 0.25, DESK + 2, DESK + 7, "#4a7a9c", -1); }, // a second screen
    backend: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.server, DESK); L.fy(y + 0.25, x + 0.0, x + 0.125, DESK + 1, DESK + 2, "#8ed8c9"); }, // a small server
    qa: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.leaf, DESK); L.top(x + 0.125, y + 0.125, 0.125, 0.125, DESK + 4, M.red[0]); }, // a jar with a bug
    security: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.gold, DESK); L.b(x + 0.125, y + 0.125, 0.125, 0.125, 4, M.black, DESK + 4); }, // a padlock
    devops: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.teal, DESK); }, // a deploy light
    secretary: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.gold, DESK); }, // the bell
  };
  // A workstation: a desk and a chair with a cat on it. The chair is one tile and the desk one tile deep (one or two wide), the chair at the desk's end, facing the desk.
  // The cat is a front view for now, so it looks right when its desk is on the camera's side of it.
  const workstation = (i0, j0, role, catFrame = "idle", wide = false, facing = 0) => {
    const dw = wide ? 2 : 1, W = frame(i0, j0, dw, 2, facing, "workstation");
    const corner = (x0, y0, x1, y1) => { const p = W.at(x0, y0), r = W.at(x1, y1); return [Math.min(p[0], r[0]), Math.min(p[1], r[1])]; }; // the plan corner of a part of the workstation
    const [ci, cj] = corner(0, 0, 1, 1), [di, dj] = corner(0, 1, dw, 2);
    chair(ci, cj, facing);
    piece(di, dj, dw, 1, facing, `desk of ${role}`, 12, (L) => { // (the screen reaches 16, but it is thin)
      L.b(0, 0.125, dw, 0.75, DESK, M.wood);
      for (const [y, s] of [[0.875, 1], [0.125, -1]]) { L.fy(y, 0.125, dw - 0.125, 1, 5, shade(M.wood[1])[1], s); L.fy(y, 0.375, 0.625, 3, 4, "#33241a", s); } // a drawer on each long side
      L.top(0.25, 0.25, 0.5, 0.125, DESK, M.white[0]); // the keyboard
      L.b(0.25, 0.5, 0.5, 0.125, 8, M.black, DESK); L.fy(0.5, 0.25, 0.75, DESK + 2, DESK + 7, "#2e4a5c", -1); L.fy(0.5, 0.375, 0.625, DESK + 3, DESK + 5, "#8ed8c9", -1); // the screen, lit on the cat's side
      PROPS[role]?.(L, wide ? 1.25 : 0.75, 0.5);
    });
    const c = W.at(0.5, 0.5), [sx, sy] = P(c[0], c[1], 4), cx = Math.round(sx) - 14, cy = Math.round(sy) - FRAME_H + 1;
    const to = rot(c[0] + [0, -1, 0, 1][facing], c[1] + [1, 0, -1, 0][facing]), from = rot(c[0], c[1]), dir = to[1] > from[1] ? 0 : to[0] > from[0] ? 1 : to[0] < from[0] ? 2 : 3; // which way the cat looks on the screen: down-left, down-right, up-left, up-right
    add(D(c[0], c[1]) + 0.01, () => img.blit(cat(role, catFrame, dir), cx, cy), { role, x: cx, y: cy, dir }, `cat ${role}`, { fp: footprint(ci, cj, 1, 1) }); // the cat sits on the chair: after the chair, before a desk in front of it
  };

  // ===== the back row =====
  // --- Board (0,0): a bench in front of the notes
  block(1, 2, 3, 1, 4, M.darkwood, "bench"); block(1, 4, 3, 1, 4, M.darkwood, "bench"); plant(0, 0); plant(4, 0);
  // --- Library (5,0): six bookshelves against the wall, a rug, a reading table, two armchairs
  rug(6, 2, 5, 3, "#7f5a8a", "#5c3f66");
  [5, 6, 7, 8, 9, 10].forEach((i, n) => shelf(i, 0, 0, n));
  piece(7, 3, 2, 1, 0, "reading table", 12, (L) => { L.b(0.125, 0.125, 1.75, 0.75, 8, M.wood); L.b(0.5, 0.375, 0.375, 0.25, 4, M.red, 8); L.top(1.125, 0.375, 0.375, 0.25, 8, M.paper[0]); });
  armchair(6, 3, 3, M.rose); armchair(9, 3, 1, M.rose); plant(11, 0);
  // --- Archive (12,0): four filing cabinets, a long table of folders
  [12, 13, 14, 15].forEach((i, n) => cabinet(i, 0, 0, n));
  piece(13, 2, 2, 1, 0, "folder table", 12, (L) => { L.b(0.125, 0.125, 1.75, 0.75, 8, M.wood); L.b(0.25, 0.25, 0.5, 0.375, 4, M.paper, 8); L.b(1.0, 0.25, 0.5, 0.375, 4, M.paper, 8); });
  // --- Server room (16,0): four racks, a cooling unit, a console
  [16, 17, 18, 19].forEach((i, n) => rack(i, 0, 0, n));
  piece(20, 0, 1, 1, 0, "cooling unit", 20, (L) => { L.b(0.125, 0.125, 0.75, 0.75, 20, M.metal); L.fy(0.875, 0.25, 0.75, 14, 17, "#76808c"); L.fy(0.875, 0.25, 0.75, 8, 11, "#76808c"); });
  piece(17, 3, 2, 1, 0, "console", 4, (L) => { L.b(0.125, 0.125, 1.75, 0.75, 4, M.server); L.fy(0.875, 0.25, 1.75, 1, 3, "#8ed8c9"); });
  // --- DevOps and Git (21,0): the DevOps desk under the branch board, a deploy console, a rocket
  workstation(22, 2, "devops");
  plant(21, 4); plant(25, 4);
  piece(21, 0, 2, 1, 0, "deploy console", 16, (L) => { L.b(0.125, 0.125, 1.75, 0.75, 16, M.metal); [0, 1, 2].forEach((k) => L.fy(0.875, 0.25 + k * 0.5, 0.5 + k * 0.5, 9, 12, ["#8ed8c9", "#f3c978", "#d9786a"][k])); });
  piece(25, 0, 1, 1, 0, "rocket", 20, (L) => { L.b(0.125, 0.125, 0.75, 0.75, 4, M.black); L.b(0.25, 0.25, 0.5, 0.5, 12, M.white, 4); L.b(0.375, 0.375, 0.25, 0.25, 4, M.red, 16); });
  // --- Accounting (26,0): a chart board and a desk with coins
  chart(27, 0, 2, 0, [["#8ed8c9", 6], ["#f3c978", 11], ["#7fb1e0", 8], ["#d9786a", 14]]);
  piece(27, 2, 1, 1, 0, "accounts desk", 12, (L) => { L.b(0.125, 0.125, 0.75, 0.75, 8, M.wood); [4, 8].forEach((h, k) => L.b(0.25 + k * 0.25, 0.25, 0.25, 0.25, h, M.gold, 8)); L.b(0.25, 0.625, 0.375, 0.125, 4, M.white, 8); });
  plant(28, 2);
  // --- Storage closet (29,0): crates and a bin
  piece(29, 0, 1, 1, 0, "crates", 16, (L) => { L.b(0.125, 0.125, 0.75, 0.75, 8, M.crate); L.b(0.25, 0.25, 0.5, 0.5, 8, M.crate, 8); });
  block(30, 0, 1, 1, 16, M.crate, "crate"); block(31, 0, 1, 1, 16, M.crate, "crate");
  piece(29, 2, 1, 1, 0, "bin", 16, (L) => { L.b(0.25, 0.25, 0.5, 0.5, 12, M.metal); L.b(0.125, 0.125, 0.75, 0.75, 4, M.black, 12); });

  // ===== the hall =====
  block(13, 6, 2, 1, 4, M.wood, "bench"); plant(12, 5); plant(15, 5); // the bench niche
  piece(26, 5, 1, 1, 0, "water cooler", 20, (L) => { L.b(0.25, 0.25, 0.5, 0.5, 12, M.white); L.b(0.375, 0.375, 0.25, 0.25, 8, M.blue, 12); }); plant(28, 5); // the water cooler niche
  plant(29, 4); plant(31, 6); plant(0, 7); plant(10, 9); plant(11, 14);
  rug(3, 7, 6, 1, "#d5c9b2", "#bfb298"); rug(17, 7, 6, 1, "#d5c9b2", "#bfb298");

  // ===== the west wing =====
  // --- Product and design (0,9): two desks, the staff board on the wall
  rug(1, 10, 2, 4, "#e6d6ee", "#8d6aa8");
  workstation(2, 10, "product"); workstation(1, 12, "design", "typeA");
  plant(0, 13);
  // --- Engineering (4,9): four desks, a build server
  rug(5, 10, 4, 4, "#d3e1ef", "#4f7aa6");
  workstation(5, 10, "frontend", "typeA"); workstation(7, 10, "backend", "typeB"); workstation(5, 12, "qa", "idle", false, 2); workstation(7, 12, "security", "waitA", false, 2);
  plant(9, 14);
  plant(4, 14);
  // ===== the east wing =====
  // --- Marketing (12,9): the big room: the campaign desk, a meeting table, a reach chart, a wall of posts and a sofa
  rug(12, 10, 7, 5, "#f3c9bd", "#c4574a");
  workstation(13, 10, "marketing", "typeA", true);
  piece(15, 12, 2, 1, 0, "meeting table", 8, (L) => L.b(0.125, 0.125, 1.75, 0.75, 8, M.wood));
  [15, 16].forEach((i) => chair(i, 11, 0)); [15, 16].forEach((i) => chair(i, 13, 2));
  chart(17, 9, 2, 0, [["#d9786a", 7], ["#f3c978", 12], ["#d9786a", 16], ["#f7e1b0", 10]]);
  sofa(17, 11, 2, 0, M.rose); block(18, 13, 1, 1, 4, M.wood, "coffee table"); plant(19, 13);
  // --- Content and SEO (20,9): the writing desk, stacks of paper, two shelves
  rug(21, 10, 3, 3, "#f7e9b8", "#b8922a");
  workstation(21, 11, "content", "typeB");
  [20, 21].forEach((i, n) => shelf(i, 9, 0, n + 1));
  block(23, 12, 1, 1, 8, M.gold, "paper stack"); block(22, 12, 1, 1, 8, M.wood, "table"); plant(24, 12);
  // --- Support (25,9): the headset desk, a queue desk and a board of tickets
  rug(27, 10, 3, 2, "#c6ece2", "#2f8f7c");
  workstation(27, 10, "support");
  piece(29, 10, 1, 1, 0, "queue desk", 12, (L) => { L.b(0.125, 0.125, 0.75, 0.75, 8, M.wood); L.b(0.25, 0.25, 0.5, 0.25, 4, M.blue, 8); });
  chart(29, 9, 2, 0, [["#f3c978", 6], ["#8ed8c9", 10], ["#d9786a", 4], ["#7fb1e0", 8]]);

  // ===== the front =====
  // --- Front desk (8,15): the lobby: the desk with a bell, a visitor bench, a rug
  rug(9, 15, 4, 3, "#b56a4a", "#8f4f36");
  workstation(11, 16, "secretary", "idle", true);
  sofa(9, 17, 1, 0, M.blue, "bench"); plant(6, 15); plant(14, 15); plant(6, 18);
  // --- Entrance (16,15): the key desk, a board of hooks, a visitor bench
  rug(16, 15, 3, 2, "#7f9a8e", "#5e7a6e");
  piece(18, 16, 1, 1, 0, "key desk", 12, (L) => { L.b(0.125, 0.125, 0.75, 0.75, 8, M.wood); [0, 1, 2].forEach((k) => L.b(0.25 + k * 0.25, 0.375, 0.125, 0.125, 4, M.gold, 8)); });
  standing(18, 15, 1, 0, (L, y) => [0, 1, 2, 3].forEach((k) => L.fy(y, 0.125 + k * 0.25, 0.25 + k * 0.25, 8 + (k % 2) * 3, 12 + (k % 2) * 3, "#f3c978")));
  sofa(17, 17, 1, 0, M.blue, "bench");
  // --- Back office (0,15): a control panel, a voice booth, a desk
  piece(0, 15, 2, 1, 3, "control panel", 16, (L) => { L.b(0, 0, 2, 0.5, 16, M.metal); [0, 1, 2, 3].forEach((k) => L.fy(0.5, 0.25 + k * 0.375, 0.5 + k * 0.375, 6, 9 + (k % 2) * 2, ["#8ed8c9", "#f3c978", "#d9786a", "#7fb1e0"][k])); });
  piece(2, 15, 1, 1, 0, "voice booth", 28, (L) => { L.b(0.125, 0.125, 0.75, 0.75, 20, M.teal); L.b(0.125, 0.125, 0.75, 0.75, 4, M.white, 20); L.b(0.375, 0.375, 0.125, 0.125, 4, M.black, 24); });
  block(1, 17, 2, 1, 8, M.wood, "desk"); plant(4, 17);

  // ---- things on the walls. A decoration is painted on the inner face of a wall (a plane of the plan) and only when that face looks towards the camera, which is
  // when the wall is one of the tall brick back walls of the current view. So every outer wall of the building carries its windows, seen from whichever side
  // the camera is on. A window is left out where something tall stands in front of the wall. A few rooms hang their own art.
  const wall = (axis, k, n, depth, label, draw) => add(depth, () => {
    const a = rot(...(axis === "j" ? [0, k] : [k, 0])), s = rot(axis === "j" ? 0 : k + n, axis === "j" ? k + n : 0);
    if (s[0] - a[0] <= 0 && s[1] - a[1] <= 0) return; // this face looks away from the camera
    const pt = (t, z) => P(axis === "j" ? t : k, axis === "j" ? k : t, z);
    draw({
      pt,
      rect: (t0, t1, z0, z1, c) => poly([pt(t0, z1), pt(t1, z1), pt(t1, z0), pt(t0, z0)], c),
      line: (t0, z0, t1, z1, c) => ln(pt(t0, z0), pt(t1, z1), c),
      dot: (t, z, c) => { const p = pt(t, z); img.rect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 3, 3, c); },
    });
  }, undefined, label);
  const WINDOW = (t0, t1) => (w) => {
    w.rect(t0 - 0.125, t1 + 0.125, 9, 29, "#efe3c8"); w.rect(t0, t1, 11, 27, "#9fd0e8"); w.rect(t0, t1, 11, 19, "#b8dff0");
    w.line((t0 + t1) / 2, 11, (t0 + t1) / 2, 27, "#efe3c8"); w.line(t0, 19, t1, 19, "#efe3c8"); w.rect(t0 - 0.125, t1 + 0.125, 8, 10, "#d9c39a");
  };
  const ART = [ // rooms that hang their own art: [axis of the wall, its plane, from, to, what]
    ["j", 0, 0.5, 4.6, (w) => { // Board room: a cork board with six columns of notes
      w.rect(0.5, 4.625, 8, 29, "#7a5530"); w.rect(0.625, 4.5, 9.5, 27.5, "#c89b63");
      const noteC = ["#f3c978", "#8ed8c9", "#d9786a", "#7fb1e0", "#f7e1b0"];
      for (let c = 0; c < 6; c++) { const a = 0.75 + c * 0.625; w.line(a - 0.0625, 10, a - 0.0625, 27, "#85602f"); for (let k = 0; k < 3 - (c % 2); k++) w.rect(a, a + 0.5, 21 - k * 5, 25 - k * 5, noteC[(c + k) % 5]); }
    }],
    ["j", 0, 21.375, 24.625, (w) => { // DevOps and Git: a board with a branch graph
      w.rect(21.375, 24.625, 8, 29, "#2d3643"); w.rect(21.5, 24.5, 9.5, 27.5, "#3b4658");
      w.line(21.875, 12, 23.75, 12, "#8ed8c9"); w.line(22.5, 12, 22.5, 17.5, "#f3c978"); w.line(22.5, 17.5, 23.125, 17.5, "#f3c978"); w.line(23.125, 17.5, 23.125, 23, "#d9786a"); w.line(23.125, 23, 23.75, 23, "#d9786a"); w.line(23.125, 17.5, 23.75, 12, "#8ed8c9");
      [[21.875, 12, "#8ed8c9"], [22.5, 12, "#8ed8c9"], [23.125, 12, "#8ed8c9"], [23.75, 12, "#8ed8c9"], [22.5, 17.5, "#f3c978"], [23.125, 17.5, "#f3c978"], [23.125, 23, "#d9786a"], [23.75, 23, "#d9786a"]].forEach(([t, z, c]) => w.dot(t, z, c));
    }],
    ["i", 0, 9.375, 13, (w) => { // Product and design: the staff board (the Roles screen)
      w.rect(9.375, 13, 12, 27, "#7a5530"); w.rect(9.5, 12.875, 13.2, 25.8, "#e9dfc8");
      for (let k = 0; k < 5; k++) { const a = w.pt(9.875 + k * 0.5625, 22), b = w.pt(9.875 + k * 0.5625, 17); img.rect(Math.round(a[0]) - 1, Math.round(a[1]), 3, 2, "#e8b25a"); img.rect(Math.round(b[0]) - 1, Math.round(b[1]), 3, 2, k % 2 ? "#8ed8c9" : "#d9786a"); }
    }],
  ];
  for (const [axis, k, t0, t1, draw] of ART) wall(axis, k, 1, -70, `art on the wall ${axis}${k}`, draw);
  // the outer walls: runs of tiles of one room with open ground behind them
  const tall = feet.filter((f) => f.h >= 24);
  const blocked = (axis, k, n, t0, t1) => tall.some((f) => {
    const [a0, a1, b0, b1] = axis === "j" ? [f.i0, f.i0 + f.wi, f.j0, f.j0 + f.dj] : [f.j0, f.j0 + f.dj, f.i0, f.i0 + f.wi]; // along the wall, across the room
    const lo = n > 0 ? k : k - 1.25, hi = n > 0 ? k + 1.25 : k;
    return a0 < t1 && a1 > t0 && b0 < hi && b1 > lo;
  });
  for (const axis of ["j", "i"]) {
    const len = axis === "j" ? COLS : ROWS, lines = axis === "j" ? ROWS : COLS;
    for (let c = 0; c <= lines; c++) {
      let cur = null;
      const close = (t) => {
        if (!cur) return;
        const L = t - cur.from, m = L >= 6 ? 2 : 1;
        const hung = ART.some(([ax, kk, a, b]) => ax === axis && kk === c && a < t && b > cur.from);
        if (L >= 2 && !hung) for (let q2 = 0; q2 < m; q2++) {
          const mid = cur.from + (L * (q2 + 0.5)) / m, t0 = Math.round((mid - 0.625) * 8) / 8, t1 = t0 + 1.25;
          if (!blocked(axis, c, cur.n, t0, t1)) wall(axis, c, cur.n, -75, `window on the wall ${axis}${c}`, WINDOW(t0, t1));
        }
        cur = null;
      };
      for (let t = 0; t <= len; t++) {
        const A = t < len ? (axis === "j" ? at(t, c - 1) : at(c - 1, t)) : null, B = t < len ? (axis === "j" ? at(t, c) : at(c, t)) : null;
        const room = A && !B ? A : B && !A ? B : null, key = room ? group(room) + (B ? "+" : "-") : null;
        if (cur && key !== cur.key) close(t);
        if (key && !cur) cur = { key, from: t, n: B ? 1 : -1 };
      }
    }
  }

  const sorted = things.sort((a, b) => a.depth - b.depth);
  // Sorting by the centre of a piece is wrong for a long piece beside a wall (the wall is in front of one half of it and behind the other). So the furniture, the cats
  // and the low walls are ordered by what really lies in front of what: A goes before B when A lies wholly behind B along u or along v. Where that says nothing
  // (they do not overlap on the screen, or they are one wall), the order by depth stays. The back walls, floors, rugs and wall art keep their fixed places.
  {
    const slots = [], solids = [];
    sorted.forEach((t, n) => { if (t.fp) { slots.push(n); solids.push(t); } });
    const behind = (a, b) => a.fp[1] <= b.fp[0] + 1e-6 || a.fp[3] <= b.fp[2] + 1e-6;
    const before = solids.map(() => []), waiting = solids.map(() => 0);
    for (let x = 0; x < solids.length; x++) for (let y = 0; y < solids.length; y++) {
      if (x === y || !behind(solids[x], solids[y]) || behind(solids[y], solids[x])) continue; // behind both ways: side by side on the screen, no order needed
      before[x].push(y); waiting[y]++;
    }
    const ready = solids.map((_, n) => n).filter((n) => !waiting[n]), order = [];
    while (order.length < solids.length) {
      if (!ready.length) { const rest = solids.map((_, n) => n).filter((n) => !order.includes(n)); ready.push(rest.sort((a, b) => solids[a].depth - solids[b].depth)[0]); } // a loop: break it at the nearest
      ready.sort((a, b) => solids[a].depth - solids[b].depth);
      const n = ready.shift(); order.push(n);
      for (const m of before[n]) if (--waiting[m] === 0) ready.push(m);
    }
    order.forEach((n, k) => { sorted[slots[k]] = solids[n]; });
  }
  if (parts) { // every piece on its own: a small picture with its place, in order from back to front. The cats sit in the same list, so the app can draw them between the pieces.
    const out = [], scratch = new Img(SIZE.w, SIZE.h), keep = img;
    for (const t of sorted) {
      if (t.meta) { out.push({ cat: t.meta.role, d: t.depth, x: t.meta.x, y: t.meta.y, dir: t.meta.dir }); continue; }
      scratch.d.fill(0); img = scratch; t.draw(); img = keep;
      let x0 = SIZE.w, y0 = SIZE.h, x1 = -1, y1 = -1;
      for (let y = 0; y < SIZE.h; y++) for (let x = 0; x < SIZE.w; x++) if (scratch.d[(y * SIZE.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) continue;
      const crop = new Img(x1 - x0 + 1, y1 - y0 + 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const p = scratch.get(x, y); if (p[3]) crop.set(x - x0, y - y0, p); }
      out.push({ sprite: crop, x: x0, y: y0, d: t.depth, label: t.label, room: t.room, hides: t.hides && t.hides.length ? t.hides : undefined });
    }
    return { parts: out };
  }
  if (cats) audit(feet, sorted, () => img, (x) => { img = x; }, VIEW === 0);
  sorted.forEach((t) => { if (t.meta && !cats) return; t.draw(); });
  if (cats && VIEW === 0) for (const m of GRID) console.warn("CHECK: " + m);
  if (cats) return { img, cats: [] };
  const found = sorted.filter((t) => t.meta).map((t) => ({ ...t.meta, depth: t.depth }));
  return { img, cats: found.map(({ role, x, y, depth, dir }) => ({ role, x, y, depth, dir })) };
}

// The rooms as data, for the app, for the current view: what each is for, the floor outline on the 1x picture (for hover and click), and where the name plate goes.
// The plate is a door sign: it lies on the hall floor in front of the room's door (the front desk, which has no door, wears it in front of its desk).
// Signs would pile up where doors are close, so each one takes the nearest free spot of the hall, judged for a window that shows the picture at 1.5x.
export function roomList() {
  const hallTiles = [];
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) if (at(i, j)?.kind === "hall") hallTiles.push(P(i + 0.5, j + 0.5));
  const signBase = (d) => {
    if (d.open) return P(d.r[0] + d.r[2] / 2, d.r[1] + d.r[3] + 0.4);
    const r = DOORS.get(d.id), mid = (r.d0 + r.d1) / 2, hall = r.hallIsA ? r.c - 0.5 : r.c + 0.5; // the hall lies on the other side of the wall
    return r.o === "J" ? P(mid, hall) : P(hall, mid);
  };
  const SIGNS = new Map(), placed = [];
  for (const d of DEFS.filter((x) => x.kind !== "hall")) {
    const base = signBase(d), w = ((d.name.length * 7 + 28 + (d.kind === "team" ? 14 : 0)) / 1.5) + 4, h = 17;
    const free = (x, y) => placed.every((q) => Math.abs(x - q.x) >= (w + q.w) / 2 || Math.abs(y - q.y) >= (h + q.h) / 2);
    const near = hallTiles.map(([x, y]) => ({ x, y, d: Math.hypot(x - base[0], (y - base[1]) * 2) })).filter((c) => c.d < 200).sort((a, b) => a.d - b.d);
    const spot = near.find((c) => free(c.x, c.y)) ?? { x: base[0], y: base[1] };
    placed.push({ x: spot.x, y: spot.y, w, h });
    SIGNS.set(d.id, [Math.round(spot.x), Math.round(spot.y)]);
  }
  return DEFS.filter((d) => d.kind !== "hall").map((d) => {
    const [i0, j0, wi, dj] = d.r, pt = (i, j) => P(i, j).map(Math.round);
    const c = [pt(i0, j0), pt(i0 + wi, j0), pt(i0 + wi, j0 + dj), pt(i0, j0 + dj)]; // the four corners of the floor, in the camera's order: top, right, bottom, left
    const top = c.reduce((a, p, n) => (p[1] < c[a][1] ? n : a), 0), ring = [0, 1, 2, 3].map((n) => c[(top + n) % 4]);
    const clockwise = ring[1][0] > ring[3][0] ? ring : [ring[0], ring[3], ring[2], ring[1]];
    return {
      id: d.id, name: d.name, kind: d.kind, team: d.kind === "team", color: d.color ?? null, holds: d.holds, rect: d.r,
      polygon: clockwise, plate: SIGNS.get(d.id), plateMode: "centre",
    };
  });
}
