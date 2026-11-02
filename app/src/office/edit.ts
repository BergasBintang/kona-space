// What the map maker can do to a map. Every function returns a new map and leaves the one it was given as it was (so undo is only keeping the old ones). Nothing here draws.
import { KINDS, footprintOf } from "./engine/furniture.ts";
import { UNIQUE_ARTS } from "./engine/decor.ts";
import { doorwayAxis } from "./engine/doorway.ts";
import { styleById } from "./engine/styles.ts";
import { FACE_N, type Attach, type Face, type Facing, type Obj, type OfficeMap } from "./engine/types.ts";

export const MAX_SIDE = 120;
const copy = (m: OfficeMap): OfficeMap => structuredClone(m);
const inside = (m: OfficeMap, i: number, j: number) => i >= 0 && j >= 0 && i < m.cols && j < m.rows;

/** Put a floor style on a tile (null: no ground). A style of Kona's palette that the map does not have yet is added to the map; any other id must already be one of the map's own. */
export function paintFloor(m: OfficeMap, i: number, j: number, id: string | null): OfficeMap {
  if (!inside(m, i, j) || m.floor[j][i] === id) return m;
  const n = copy(m);
  if (id != null && !n.styles.some((s) => s.id === id)) { const st = styleById(id); if (!st) return m; n.styles.push(structuredClone(st)); }
  n.floor[j][i] = id; return n;
}

/** Give a rug one of Kona's colour pairs. */
export function setRugColours(m: OfficeMap, k: number, c: string, c2: string): OfficeMap {
  const o = m.objects[k];
  if (!o || o.kind !== "rug" || (o.c === c && o.c2 === c2)) return m;
  const n = copy(m); n.objects[k].c = c; n.objects[k].c2 = c2; return n;
}

/** Put a wall block on a tile or take it away. A wall keeps the floor under it, so taking it away leaves the floor of the room. */
export function setWall(m: OfficeMap, i: number, j: number, on: boolean): OfficeMap {
  if (!inside(m, i, j) || m.walls[j][i] === on) return m;
  const n = copy(m); n.walls[j][i] = on;
  if (on && n.floor[j][i] == null) { // a new wall takes the floor of a tile next to it, so it has ground to stand on and a colour
    const next = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].map(([a, b]) => (inside(m, a, b) ? m.floor[b][a] : null)).find((x) => x != null);
    n.floor[j][i] = next ?? n.styles[0]?.id ?? null;
  }
  if (!on) n.attach = n.attach.filter((a) => a.kind === "doorway" || a.i !== i || a.j !== j); // what hung on the wall goes with it
  return n;
}

/** Hang something on a wall tile, or make a doorway. It replaces what was already on that face (a doorway: on that tile). */
export function addAttach(m: OfficeMap, a: Attach): OfficeMap {
  if (!inside(m, a.i, a.j)) return m;
  if (a.kind === "art" && a.art && UNIQUE_ARTS.includes(a.art) && m.attach.some((x) => x.kind === "art" && x.art === a.art && !(x.i === a.i && x.j === a.j && x.face === a.face))) return m; // there is only one of it
  const n = copy(m);
  n.attach = n.attach.filter((x) => !(x.i === a.i && x.j === a.j && (a.kind === "doorway" || x.kind === "doorway" ? x.kind === a.kind : x.face === a.face)));
  n.attach.push({ ...a, span: a.span && a.span > 1 ? a.span : undefined });
  return n;
}

export { doorwayAxis }; // (engine/doorway.ts: the engine draws the posts of a doorway from the same rule)

/** Why a doorway cannot go on this tile, in plain words, or null when it can: a floor tile that is not a wall, in a line of wall with a wall tile at each end. */
export function doorwayProblem(m: OfficeMap, i: number, j: number): string | null {
  if (!inside(m, i, j)) return "That is outside the map.";
  if (m.walls[j][i]) return "A doorway is a gap in a wall: take the wall tile away first (Walls, then click it), then open the doorway.";
  if (m.floor[j][i] == null) return "A doorway goes on a floor tile, and there is no floor here.";
  if (!doorwayAxis(m, i, j)) return "A doorway is a gap in a line of wall: there must be a wall tile at each end of the gap (at most four tiles apart), on its left and right or above and below.";
  return null;
}

/** The wall tiles a thing on a wall covers, as [i, j]: it runs along the wall, `span` tiles from its first one. */
export const attachCells = (a: Attach): [number, number][] => {
  const alongI = FACE_N[a.face][1] !== 0; // a face that looks along j belongs to a wall that runs along i
  return Array.from({ length: Math.max(1, a.span ?? 1) }, (_, k): [number, number] => (alongI ? [a.i + k, a.j] : [a.i, a.j + k]));
};

/** A side of a wall tile is free when what lies across it is not another wall tile (open floor, or the outside). A thing hung on a side that faces into another wall is inside the wall and cannot be seen. */
export function sideFree(m: OfficeMap, i: number, j: number, face: Face): boolean {
  const [dx, dy] = FACE_N[face];
  return m.walls[j + dy]?.[i + dx] !== true;
}

/** The side of a wall tile to hang something on, from where it was clicked: the nearest side that is free, or null when every side faces another wall. */
export function freeSideAt(m: OfficeMap, i: number, j: number, fx: number, fy: number): Face | null {
  const near: [Face, number][] = [["i+", 1 - fx], ["i-", fx], ["j+", 1 - fy], ["j-", fy]];
  return near.sort((p, q) => p[1] - q[1]).map((p) => p[0]).find((face) => sideFree(m, i, j, face)) ?? null;
}

/** Why a thing on a wall cannot be seen where it is, in plain words, or null when it is fine. Every tile it covers must be a wall, with the side it hangs on free. */
export function attachProblem(m: OfficeMap, a: Attach): string | null {
  if (a.kind === "doorway") return null;
  const what = `The ${a.kind === "art" ? (a.art ?? "board") : a.kind} at ${a.i},${a.j}`;
  for (const [i, j] of attachCells(a)) {
    if (!inside(m, i, j) || m.walls[j][i] !== true) return `${what} is not on a wall all along: it needs wall tiles for its whole width.`;
    if (!sideFree(m, i, j, a.face)) return `${what} is inside the wall (its side faces another wall tile), so it cannot be seen.`;
  }
  return null;
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

/** What makes an object the only one of its kind: a person's desk (one for each person), or a piece that opens a screen. Null for what may be put down any number of times. */
export const uniqueKey = (o: Obj): string | null => (o.kind === "workstation" ? `workstation:${String(o.role ?? "")}` : KINDS[o.kind]?.unique ? o.kind : null);
/** Is the one-and-only thing with this key already in the map? */
export const isPlaced = (m: OfficeMap, key: string): boolean => m.objects.some((o) => uniqueKey(o) === key);
/** Is this board already hung somewhere? */
export const artHung = (m: OfficeMap, art: string): boolean => m.attach.some((a) => a.kind === "art" && a.art === art);

export function placeObject(m: OfficeMap, o: Obj): OfficeMap {
  if (!KINDS[o.kind] || !inside(m, o.i, o.j)) return m;
  const key = uniqueKey(o);
  if (key && isPlaced(m, key)) return m; // there is only one of it
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
  if (o.kind === "workstation" && key === "role" && isPlaced(m, `workstation:${String(value)}`)) return m; // that person already has a desk
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

/** The styles some tile uses (a map always keeps at least one). */
const usedStyles = (m: OfficeMap) => { const used = m.styles.filter((s) => m.floor.some((r) => r.includes(s.id))); return used.length ? used : m.styles.slice(0, 1); };

/** Take away the empty rows and columns round the edge (the map keeps at least one tile). */
export function trimMap(m: OfficeMap): OfficeMap {
  const used = (i: number, j: number) => m.floor[j][i] != null || m.walls[j][i];
  let i0 = 0, i1 = m.cols - 1, j0 = 0, j1 = m.rows - 1;
  const colUsed = (i: number) => m.floor.some((_, j) => used(i, j)), rowUsed = (j: number) => m.floor[j].some((_, i) => used(i, j));
  while (i0 < i1 && !colUsed(i0)) i0++;
  while (i1 > i0 && !colUsed(i1)) i1--;
  while (j0 < j1 && !rowUsed(j0)) j0++;
  while (j1 > j0 && !rowUsed(j1)) j1--;
  const unusedStyle = m.styles.some((s) => !m.floor.some((r) => r.includes(s.id)));
  if (i0 === 0 && j0 === 0 && i1 === m.cols - 1 && j1 === m.rows - 1) {
    if (!unusedStyle) return m;
    const k = copy(m); k.styles = usedStyles(k); return k; // a style no tile uses any more is not kept in the file
  }
  const n = copy(m);
  n.floor = m.floor.slice(j0, j1 + 1).map((r) => r.slice(i0, i1 + 1));
  n.walls = m.walls.slice(j0, j1 + 1).map((r) => r.slice(i0, i1 + 1));
  n.cols = i1 - i0 + 1; n.rows = j1 - j0 + 1;
  shift(n, -i0, -j0);
  n.attach = n.attach.filter((a) => inside(n, a.i, a.j));
  n.objects = n.objects.filter((o) => inside(n, o.i, o.j));
  n.styles = usedStyles(n);
  return n;
}

/** Which face of a wall tile a click is on: the side of the tile the click is nearest to. `fx` and `fy` are where in the tile it is, from 0 to 1. */
export function faceAt(fx: number, fy: number): Face {
  const dx = fx - 0.5, dy = fy - 0.5;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "i+" : "i-") : dy > 0 ? "j+" : "j-";
}
