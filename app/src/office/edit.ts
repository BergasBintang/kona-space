// What the map maker can do to a map. Every function returns a new map and leaves the one it was given as it was (so undo is only keeping the old ones). Nothing here draws.
import { KINDS, footprintOf } from "./engine/furniture.ts";
import type { Attach, Face, Facing, Obj, OfficeMap } from "./engine/types.ts";

export const MAX_SIDE = 120;
const copy = (m: OfficeMap): OfficeMap => structuredClone(m);
const inside = (m: OfficeMap, i: number, j: number) => i >= 0 && j >= 0 && i < m.cols && j < m.rows;

/** Put the floor of a room on a tile (null: no ground). */
export function paintFloor(m: OfficeMap, i: number, j: number, id: string | null): OfficeMap {
  if (!inside(m, i, j) || m.floor[j][i] === id) return m;
  const n = copy(m); n.floor[j][i] = id; return n;
}

/** Put a wall block on a tile or take it away. A wall keeps the floor under it, so taking it away leaves the floor of the room. */
export function setWall(m: OfficeMap, i: number, j: number, on: boolean): OfficeMap {
  if (!inside(m, i, j) || m.walls[j][i] === on) return m;
  const n = copy(m); n.walls[j][i] = on;
  if (on && n.floor[j][i] == null) { // a new wall takes the floor of a tile next to it, so it has ground to stand on and a colour
    const next = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].map(([a, b]) => (inside(m, a, b) ? m.floor[b][a] : null)).find((x) => x != null);
    n.floor[j][i] = next ?? n.rooms[0]?.id ?? null;
  }
  if (!on) n.attach = n.attach.filter((a) => a.kind === "doorway" || a.i !== i || a.j !== j); // what hung on the wall goes with it
  return n;
}

/** Hang something on a wall tile, or make a doorway. It replaces what was already on that face (a doorway: on that tile). */
export function addAttach(m: OfficeMap, a: Attach): OfficeMap {
  if (!inside(m, a.i, a.j)) return m;
  const n = copy(m);
  n.attach = n.attach.filter((x) => !(x.i === a.i && x.j === a.j && (a.kind === "doorway" || x.kind === "doorway" ? x.kind === a.kind : x.face === a.face)));
  n.attach.push({ ...a, span: a.span && a.span > 1 ? a.span : undefined });
  return n;
}

/** Take away what hangs on a tile: one face, or everything on it. */
export function removeAttach(m: OfficeMap, i: number, j: number, face?: Face): OfficeMap {
  const keep = m.attach.filter((a) => !(a.i === i && a.j === j && (a.kind === "doorway" || !face || a.face === face)));
  if (keep.length === m.attach.length) return m;
  const n = copy(m); n.attach = keep; return n;
}

/** The index of the object that covers a tile (the one placed last if several do, as it is drawn on top), or -1. A rug is only found when nothing else is there. */
export function objectAt(m: OfficeMap, i: number, j: number): number {
  let rug = -1;
  for (let k = m.objects.length - 1; k >= 0; k--) {
    const f = KINDS[m.objects[k].kind] ? footprintOf(m.objects[k]) : null;
    if (!f || i < f[0] || j < f[1] || i >= f[0] + f[2] || j >= f[1] + f[3]) continue;
    if (m.objects[k].kind === "rug") { if (rug < 0) rug = k; continue; }
    return k;
  }
  return rug;
}

/** A new object of a kind of the catalog at a tile. */
export function newObject(kind: string, i: number, j: number, facing: Facing = 0): Obj | null {
  const k = KINDS[kind];
  return k ? { ...structuredClone(k.defaults), kind, i, j, facing } : null;
}

export function placeObject(m: OfficeMap, o: Obj): OfficeMap {
  if (!KINDS[o.kind] || !inside(m, o.i, o.j)) return m;
  const n = copy(m); n.objects.push(structuredClone(o)); return n;
}

export function moveObject(m: OfficeMap, k: number, i: number, j: number): OfficeMap {
  const o = m.objects[k];
  if (!o || !inside(m, i, j) || (o.i === i && o.j === j)) return m;
  const n = copy(m); n.objects[k].i = i; n.objects[k].j = j; return n;
}

/** A quarter turn. */
export function turnObject(m: OfficeMap, k: number): OfficeMap {
  const o = m.objects[k];
  if (!o || o.kind === "rug") return m;
  const n = copy(m); n.objects[k].facing = (((o.facing ?? 0) + 1) % 4) as Facing; return n;
}

export function setParam(m: OfficeMap, k: number, key: string, value: unknown): OfficeMap {
  const o = m.objects[k];
  if (!o || key === "kind" || key === "i" || key === "j" || o[key] === value) return m;
  const n = copy(m); n.objects[k][key] = value; return n;
}

export function deleteObject(m: OfficeMap, k: number): OfficeMap {
  if (!m.objects[k]) return m;
  const n = copy(m); n.objects.splice(k, 1); return n;
}

const shift = (n: OfficeMap, di: number, dj: number) => { for (const a of n.attach) { a.i += di; a.j += dj; } for (const o of n.objects) { o.i += di; o.j += dj; } };

/** One more empty row or column on a side of the map, to build further out. */
export function growMap(m: OfficeMap, side: "left" | "right" | "top" | "bottom"): OfficeMap {
  if ((side === "left" || side === "right") ? m.cols >= MAX_SIDE : m.rows >= MAX_SIDE) return m;
  const n = copy(m);
  if (side === "left") { n.floor.forEach((r) => r.unshift(null)); n.walls.forEach((r) => r.unshift(false)); n.cols++; shift(n, 1, 0); }
  else if (side === "right") { n.floor.forEach((r) => r.push(null)); n.walls.forEach((r) => r.push(false)); n.cols++; }
  else if (side === "top") { n.floor.unshift(Array(n.cols).fill(null)); n.walls.unshift(Array(n.cols).fill(false)); n.rows++; shift(n, 0, 1); }
  else { n.floor.push(Array(n.cols).fill(null)); n.walls.push(Array(n.cols).fill(false)); n.rows++; }
  return n;
}

/** Take away the empty rows and columns round the edge (the map keeps at least one tile). */
export function trimMap(m: OfficeMap): OfficeMap {
  const used = (i: number, j: number) => m.floor[j][i] != null || m.walls[j][i];
  let i0 = 0, i1 = m.cols - 1, j0 = 0, j1 = m.rows - 1;
  const colUsed = (i: number) => m.floor.some((_, j) => used(i, j)), rowUsed = (j: number) => m.floor[j].some((_, i) => used(i, j));
  while (i0 < i1 && !colUsed(i0)) i0++;
  while (i1 > i0 && !colUsed(i1)) i1--;
  while (j0 < j1 && !rowUsed(j0)) j0++;
  while (j1 > j0 && !rowUsed(j1)) j1--;
  if (i0 === 0 && j0 === 0 && i1 === m.cols - 1 && j1 === m.rows - 1) return m;
  const n = copy(m);
  n.floor = m.floor.slice(j0, j1 + 1).map((r) => r.slice(i0, i1 + 1));
  n.walls = m.walls.slice(j0, j1 + 1).map((r) => r.slice(i0, i1 + 1));
  n.cols = i1 - i0 + 1; n.rows = j1 - j0 + 1;
  shift(n, -i0, -j0);
  n.attach = n.attach.filter((a) => inside(n, a.i, a.j));
  n.objects = n.objects.filter((o) => inside(n, o.i, o.j));
  return n;
}

/** Which face of a wall tile a click is on: the side of the tile the click is nearest to. `fx` and `fy` are where in the tile it is, from 0 to 1. */
export function faceAt(fx: number, fy: number): Face {
  const dx = fx - 0.5, dy = fy - 0.5;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "i+" : "i-") : dy > 0 ? "j+" : "j-";
}
