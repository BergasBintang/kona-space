// Kibby, the office boy: where he is and what he does next. He walks on the open floor of the hall: from the middle of a tile to the middle of the next one, a step of an eighth of a tile
// at a time, mostly straight on along a corridor, standing a while now and then, often at a turn and always at a dead end. The tiles he may use come from the map (`Scene.walkable`: hall floor, no wall, nothing standing on it), so a map that is changed
// changes his route. His place among the pieces of the picture (so a wall in front of him hides him and a wall behind him does not) is worked out for every step (office/engine/scene.ts).
import { kibbySlot, type Scene } from "../office/engine/scene.ts";

/** His place in eighths of a tile: the middle of a tile is 8 * i + 4. `h` is the way he is heading on the plan, `last` the tile he came from. */
export type Walker = { x: number; y: number; tx: number; ty: number; hx: number; hy: number; last: [number, number] | null; wait: number; n: number };
export type KibbyFrame = "idle" | "blink" | "walkA" | "walkB" | "walkC" | "walkD" | "happy";
export type Pose = { x: number; y: number; k: number; dir: number; frame: KibbyFrame };

export const TICK_MS = 125; // a step an eighth of a tile: a tile a second, two hops a second
const HOPS: KibbyFrame[] = ["walkA", "walkB", "walkC", "walkD"];
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const PAUSE = 0.2; // the chance that he stands a while at a tile when he could go straight on
const PAUSE_AT_TURN = 0.5; // the chance that he stands a while where the floor ahead ends but he can turn
const KEEP_GOING = 0.75; // the chance that he goes straight on when he could also turn

const tileOf = (e: number) => Math.floor(e / 8);
const ok = (walkable: boolean[][], i: number, j: number) => walkable[j]?.[i] === true;

/** He starts on the walkable tile nearest the middle of the map, or nowhere (null) when there is no hall to walk on. */
export function startWalker(walkable: boolean[][]): Walker | null {
  const rows = walkable.length, cols = walkable[0]?.length ?? 0;
  let best: [number, number] | null = null, bd = Infinity;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (walkable[j][i]) { const d = (i - cols / 2) ** 2 + (j - rows / 2) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
  if (!best) return null;
  const x = best[0] * 8 + 4, y = best[1] * 8 + 4;
  return { x, y, tx: x, ty: y, hx: 0, hy: 1, last: null, wait: 12, n: 0 };
}

/** Is he still on a tile he may stand on? (not after the map was changed under him) */
export const stillValid = (w: Walker, walkable: boolean[][]) => ok(walkable, tileOf(w.x), tileOf(w.y)) && ok(walkable, tileOf(w.tx), tileOf(w.ty));

/** One tick: stand still for a while, then pick a neighbouring tile and walk to it a step at a time. He mostly goes straight on, so he walks along a corridor for several tiles; he does not turn straight back unless it is the only way. */
export function step(w: Walker, walkable: boolean[][], rnd: () => number): Walker {
  const n = w.n + 1;
  if (w.x !== w.tx || w.y !== w.ty) {
    const x = w.x + Math.sign(w.tx - w.x), y = w.y + Math.sign(w.ty - w.y);
    if (x !== w.tx || y !== w.ty) return { ...w, x, y, n };
    // arrived. He mostly keeps going the way he was going, for as long as there is floor, and now and then stands a while (two to six seconds), always when he must turn or has reached a dead end
    const i = tileOf(x), j = tileOf(y), straight = ok(walkable, i + w.hx, j + w.hy);
    const onward = DIRS.some(([a, b]) => ok(walkable, i + a, j + b) && !(w.last && w.last[0] === i + a && w.last[1] === j + b)); // any way but back
    const chance = straight ? PAUSE : onward ? PAUSE_AT_TURN : 1; // always at a dead end
    return { ...w, x, y, n, wait: rnd() >= chance ? 0 : 16 + Math.floor(rnd() * 32) };
  }
  if (w.wait > 0) return { ...w, wait: w.wait - 1, n };
  const i = tileOf(w.x), j = tileOf(w.y);
  const opts = DIRS.filter(([a, b]) => ok(walkable, i + a, j + b)), fresh = opts.filter(([a, b]) => !w.last || w.last[0] !== i + a || w.last[1] !== j + b), from = fresh.length ? fresh : opts;
  if (from.length === 0) return { ...w, wait: 40, n };
  const ahead = from.find(([a, b]) => a === w.hx && b === w.hy); // straight on, if he can and he feels like it
  const [a, b] = ahead && rnd() < KEEP_GOING ? ahead : from[Math.min(from.length - 1, Math.floor(rnd() * from.length))];
  return { ...w, tx: (i + a) * 8 + 4, ty: (j + b) * 8 + 4, hx: a, hy: b, last: [i, j], n };
}

/** The way he looks on the screen: 0 down-left, 1 down-right, 2 up-left, 3 up-right. Going away from you he looks the other way. */
export function lookOf(scene: Scene, w: Walker): number {
  const from = scene.iso.rot(w.x / 8, w.y / 8), to = scene.iso.rot(w.x / 8 + w.hx, w.y / 8 + w.hy);
  return to[1] > from[1] ? 0 : to[0] > from[0] ? 1 : to[0] < from[0] ? 2 : 3;
}

/** The way he looks when he stands: towards the viewer (0 down-left, 1 down-right), whichever way he was going. */
export const towardsViewer = (dir: number) => (dir >= 2 ? 3 - dir : dir);

/** Where his picture goes and which of his pictures to show. */
export function pose(scene: Scene, w: Walker): Pose {
  const { x, y, k } = kibbySlot(scene, w.x / 8, w.y / 8), moving = w.x !== w.tx || w.y !== w.ty, look = lookOf(scene, w);
  return { x, y, k, dir: moving ? look : towardsViewer(look), frame: moving ? HOPS[w.n % 4] : w.n % 40 === 0 ? "blink" : "idle" };
}

/** While he talks he stands where he is, looking towards you, smiling. */
export const talking = (p: Pose): Pose => ({ ...p, dir: towardsViewer(p.dir), frame: "happy" });
