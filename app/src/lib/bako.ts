// Bako, the second office boy, and his two jobs. Most of the time he sweeps: he walks the floor with a broom the way Kibby walks it (lib/kibby.ts, the same steps). Now and then he
// goes to a door on a wall of the map, stands there a while as if the delivery person had come, takes a bento and carries it to a worker at a desk, a different one each time.
// Everything here is plain functions on the map's own tiles (i along a row, j down the plan), the same on every side of the building, so it is tested without a screen (lib/bako.test.ts).
import { footprintOf } from "../office/engine/furniture.ts";
import { FACE_N, type OfficeMap } from "../office/engine/types.ts";
import { startWalker, step, towardsViewer, pose, type Pose, type Walker } from "./kibby.ts";
import type { Scene } from "../office/engine/scene.ts";

export type Tile = [number, number];
export type Job = "sweep" | "fetch" | "pickup" | "bring" | "give";
/** `w` is where he is and where he is heading, as for Kibby. `path` is the tiles still to walk on an errand, `wait` how long he stands at the door or at the desk (steps of an eighth of a second),
 * `next` how long until the next errand, `role` who the bento is for. */
export type Bako = { w: Walker; job: Job; path: Tile[]; wait: number; next: number; role: string | null };
export type Places = { doors: Tile[][]; workers: { role: string; spots: Tile[] }[] };
export type BakoFrame = "idle" | "blink" | "walkA" | "walkB" | "walkC" | "walkD" | "happy" | "carryIdle" | "carryA" | "carryB" | "carryC" | "carryD";
export type Drawn = { who: "kibby" | "bako"; x: number; y: number; k: number; dir: number; frame: string };

const FIRST: [number, number] = [160, 320]; // ticks (8 a second) until his first errand: 20 to 40 seconds
const GAP: [number, number] = [320, 640]; // and between two errands: 40 to 80 seconds
const AT_DOOR = 24; // he stands at the door for three seconds, and has the bento in his hand for the last half of it
const AT_DESK = 16; // and at the desk for two, the bento in his hand for the first half
const HAS_BENTO_AT = 12;
const GIVES_UNTIL = 8;

const tileOf = (e: number) => Math.floor(e / 8);
const id = (i: number, j: number) => j * 4096 + i;
const ok = (walkable: boolean[][], i: number, j: number) => walkable[j]?.[i] === true;
const between = (r: [number, number], rnd: () => number) => r[0] + Math.floor(rnd() * (r[1] - r[0]));
const centre = (t: Tile): [number, number] => [t[0] * 8 + 4, t[1] * 8 + 4];

/** The tiles in front of every door of the map, a list for each door: a door hangs on a wall tile and may cover several tiles along the wall; he stands on the floor in front of it. */
export function doorSpots(map: OfficeMap): Tile[][] {
  return map.attach.filter((a) => a.kind === "door").map((a) => {
    const n = FACE_N[a.face], along: Tile = n[1] !== 0 ? [1, 0] : [0, 1];
    return Array.from({ length: Math.max(1, a.span ?? 1) }, (_, t): Tile => [a.i + along[0] * t + n[0], a.j + along[1] * t + n[1]]);
  });
}

/** The floor around every worker's desk, the side behind the chair first, then the sides. A desk and its chair stand on the tiles of its footprint, where nobody can walk. */
export function workerSpots(map: OfficeMap): { role: string; spots: Tile[] }[] {
  const out: { role: string; spots: Tile[] }[] = [];
  for (const o of map.objects) {
    const f = o.kind === "workstation" ? footprintOf(o) : null;
    if (!f || typeof o.role !== "string") continue;
    const [i0, j0, w, d] = f, facing = (o.facing ?? 0) as number, face: Tile = [[0, -1, 0, 1][facing], [1, 0, -1, 0][facing]]; // the way the cat looks, towards its desk
    const around: Tile[] = [];
    for (let i = i0; i < i0 + w; i++) { around.push([i, j0 - 1], [i, j0 + d]); }
    for (let j = j0; j < j0 + d; j++) { around.push([i0 - 1, j], [i0 + w, j]); }
    const mid: Tile = [i0 + (w - 1) / 2, j0 + (d - 1) / 2];
    const behind = (t: Tile) => -((t[0] - mid[0]) * face[0] + (t[1] - mid[1]) * face[1]); // large for a tile behind the chair, small for one in front of the desk
    out.push({ role: o.role, spots: around.sort((p, q) => behind(q) - behind(p)) });
  }
  return out;
}

export const placesOf = (map: OfficeMap): Places => ({ doors: doorSpots(map), workers: workerSpots(map) });

/** Every tile he can walk to from `from` without leaving the floor, each with the tile he came from (the start has -1): a walk of one tile at a time, up, down, left or right. */
export function reach(walkable: boolean[][], from: Tile): Map<number, number> {
  const prev = new Map<number, number>();
  if (!ok(walkable, from[0], from[1])) return prev;
  prev.set(id(from[0], from[1]), -1);
  const queue: Tile[] = [from];
  for (let q = 0; q < queue.length; q++) {
    const [i, j] = queue[q];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ok(walkable, i + a, j + b) && !prev.has(id(i + a, j + b))) { prev.set(id(i + a, j + b), id(i, j)); queue.push([i + a, j + b]); }
    }
  }
  return prev;
}

/** The tiles to walk to get to `to`, not counting the one he starts on; empty when `to` cannot be reached (or is where he is). */
export function pathTo(prev: Map<number, number>, to: Tile): Tile[] {
  const out: Tile[] = [];
  let at = id(to[0], to[1]);
  if (!prev.has(at)) return out;
  while (prev.get(at)! !== -1) { out.push([at % 4096, Math.floor(at / 4096)]); at = prev.get(at)!; }
  return out.reverse();
}

/** He starts on any tile he may use, chosen by chance, so he is not at Kibby's place when the office opens; nowhere when there is no floor. */
export function startBako(walkable: boolean[][], rnd: () => number): Bako | null {
  const base = startWalker(walkable);
  if (!base) return null;
  const tiles: Tile[] = [];
  walkable.forEach((row, j) => row.forEach((on, i) => { if (on) tiles.push([i, j]); }));
  const [x, y] = centre(tiles[Math.floor(rnd() * tiles.length)]);
  return { w: { ...base, x, y, tx: x, ty: y }, job: "sweep", path: [], wait: 0, next: between(FIRST, rnd), role: null };
}

/** Is he still where the floor allows, after the map changed under him? An errand that crosses a tile that is gone is dropped by the caller (he starts sweeping again). */
export const bakoStillValid = (b: Bako, walkable: boolean[][]) => {
  const on = (x: number, y: number) => ok(walkable, tileOf(x), tileOf(y));
  return on(b.w.x, b.w.y) && on(b.w.tx, b.w.ty) && b.path.every(([i, j]) => ok(walkable, i, j));
};

/** Turn him towards the next tile of the path (nothing moves yet). */
function head(w: Walker, path: Tile[]): { w: Walker; path: Tile[] } {
  const [i, j] = path[0], [tx, ty] = centre([i, j]), hx = Math.sign(tx - w.x), hy = Math.sign(ty - w.y);
  return { w: { ...w, tx, ty, hx, hy, last: [tileOf(w.x), tileOf(w.y)], wait: 0 }, path: path.slice(1) };
}

/** One step along `path`: finish the step he is on, or turn towards the next tile. `done` is true when he has arrived at the end. As Kibby does when he is not stopping, he sets off for the next tile
 * on the very tick he reaches one, so there is never a standing picture (the idle one) in the middle of a walk. */
function walk(w: Walker, path: Tile[]): { w: Walker; path: Tile[]; done: boolean } {
  const n = w.n + 1;
  if (w.x !== w.tx || w.y !== w.ty) {
    const moved = { ...w, x: w.x + Math.sign(w.tx - w.x), y: w.y + Math.sign(w.ty - w.y), n };
    if ((moved.x !== moved.tx || moved.y !== moved.ty) || path.length === 0) return { w: moved, path, done: false };
    return { ...head(moved, path), done: false };
  }
  if (path.length === 0) return { w: { ...w, n }, path, done: true };
  return { ...head({ ...w, n }, path), done: false };
}

/** The tile he is on, or the one he is heading for: an errand starts from there. */
const nextTile = (w: Walker): Tile => [tileOf(w.tx), tileOf(w.ty)];

/** One tick. Sweeping is Kibby's walk; when it is time and the map has a door he can reach, he goes there; then the bento goes to a worker he can reach from the door. */
export function tickBako(b: Bako, walkable: boolean[][], places: Places, rnd: () => number): Bako {
  switch (b.job) {
    case "sweep": {
      if (b.next <= 0) {
        const from = nextTile(b.w), prev = reach(walkable, from);
        const doors = places.doors.map((spots) => spots.filter((s) => prev.has(id(s[0], s[1])))).filter((spots) => spots.length > 0);
        if (doors.length > 0) {
          const spots = doors[Math.floor(rnd() * doors.length)], door = spots[Math.floor(rnd() * spots.length)];
          return { ...b, job: "fetch", path: pathTo(prev, door), wait: 0 }; // (he finishes the step he is on first)
        }
        return { ...b, next: between(GAP, rnd) }; // no door on the map, or none he can reach: sweep and try again later
      }
      return { ...b, w: step(b.w, walkable, rnd), next: b.next - 1 };
    }
    case "fetch": {
      const r = walk(b.w, b.path);
      return r.done ? { ...b, w: r.w, path: [], job: "pickup", wait: AT_DOOR } : { ...b, w: r.w, path: r.path };
    }
    case "pickup": {
      if (b.wait > 1) return { ...b, wait: b.wait - 1, w: { ...b.w, n: b.w.n + 1 } };
      const prev = reach(walkable, nextTile(b.w));
      const who = places.workers.map((p) => ({ role: p.role, spot: p.spots.find((s) => prev.has(id(s[0], s[1]))) })).filter((p): p is { role: string; spot: Tile } => !!p.spot);
      if (who.length === 0) return { ...b, job: "sweep", path: [], wait: 0, next: between(GAP, rnd), role: null }; // nobody he can reach: he keeps the bento in mind for later
      const pick = who[Math.floor(rnd() * who.length)];
      return { ...b, job: "bring", path: pathTo(prev, pick.spot), wait: 0, role: pick.role };
    }
    case "bring": {
      const r = walk(b.w, b.path);
      return r.done ? { ...b, w: r.w, path: [], job: "give", wait: AT_DESK } : { ...b, w: r.w, path: r.path };
    }
    default: { // give
      if (b.wait > 1) return { ...b, wait: b.wait - 1, w: { ...b.w, n: b.w.n + 1 } };
      return { ...b, job: "sweep", path: [], wait: 0, next: between(GAP, rnd), role: null, w: { ...b.w, last: null, wait: 0 } };
    }
  }
}

/** Is the bento in his hand? He takes it in the second half of his stand at the door, carries it, and holds it out at the desk before he lets go. */
export const carrying = (b: Bako) => b.job === "bring" || (b.job === "pickup" && b.wait <= HAS_BENTO_AT) || (b.job === "give" && b.wait > GIVES_UNTIL);

/** Where his picture goes and which of his pictures to show: the walk of Kibby's (lib/kibby.ts), with the bento in his hand on an errand, and a smile when he has handed it over. */
export function bakoPose(scene: Scene, b: Bako): Drawn {
  const p: Pose = pose(scene, b.w), bento = carrying(b);
  let frame: string = p.frame;
  if (b.job === "give" && !bento) frame = "happy";
  else if (bento) frame = p.frame.startsWith("walk") ? "carry" + p.frame.slice(4) : "carryIdle";
  return { who: "bako", x: p.x, y: p.y, k: p.k, dir: p.dir, frame };
}

/** What he says out loud, in a bubble over his head: when the bento is handed to him at the door, and when he hands it to the worker (`call` gives the name of the worker's role). Nothing the rest of the time. */
export function bakoSays(b: Bako, call: (role: string) => string): string | null {
  if (b.job === "pickup") return "Got it, thanks!";
  if (b.job === "give" && b.role) return `Bento for ${call(b.role)}!`;
  return null;
}

/** While he talks he stands where he is, looking towards you; with the bento in his hand if he has one. */
export const bakoTalking = (d: Drawn, b: Bako): Drawn => ({ ...d, dir: towardsViewer(d.dir), frame: carrying(b) ? "carryIdle" : "happy" });
