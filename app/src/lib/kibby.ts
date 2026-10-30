// Kibby, the office boy: where he is on his route and what he does next. The art build (art/build-office.mjs) writes, for each side of the building, the route as places
// (nodes) and the straight stretches between them (edges). A stretch is a list of steps, one for every eighth of a tile: where his picture goes, the place in the list of
// pieces where he is drawn (so a wall in front of him hides him and a wall behind him does not), and the way he looks. This file only moves along it, one step per tick.
export type Walk = { nodes: Record<string, number[]>; edges: { a: string; b: string; s: number[][] }[] };
/** `edge` is -1 while he stands at `at`; `last` is the stretch he walked last (he does not turn straight back unless it is the only way); `face` is the way he looks when he stands. */
export type Walker = { at: string; edge: number; last: number; forward: boolean; i: number; wait: number; n: number; face: number };
export type KibbyFrame = "idle" | "blink" | "walkA" | "walkB" | "walkC" | "walkD" | "happy";
export type Pose = { x: number; y: number; k: number; dir: number; frame: KibbyFrame };

export const TICK_MS = 125; // a step an eighth of a tile: a tile a second, two hops a second
const HOPS: KibbyFrame[] = ["walkA", "walkB", "walkC", "walkD"];

export const startWalker = (at = "B"): Walker => ({ at, edge: -1, last: -1, forward: true, i: 0, wait: 12, n: 0, face: 1 });

/** The way he looks when he stands: towards the viewer (0 down-left, 1 down-right), whichever way he was going (the opposite look of 2 is 1 and of 3 is 0). */
export const towardsViewer = (dir: number) => (dir >= 2 ? 3 - dir : dir);

/** One tick: stand still for a while, then pick a stretch that starts here and walk it a step at a time. */
export function step(w: Walker, walk: Walk, rnd: () => number): Walker {
  const n = w.n + 1;
  if (w.edge < 0) {
    if (w.wait > 0) return { ...w, wait: w.wait - 1, n };
    const here = walk.edges.map((e, k) => ({ e, k })).filter(({ e }) => e.a === w.at || e.b === w.at);
    if (here.length === 0) return { ...w, wait: 40, n };
    const fresh = here.filter(({ k }) => k !== w.last), options = fresh.length ? fresh : here;
    const pick = options[Math.min(options.length - 1, Math.floor(rnd() * options.length))];
    return { ...w, edge: pick.k, last: pick.k, forward: pick.e.a === w.at, i: 0, n };
  }
  const e = walk.edges[w.edge], i = w.i + 1;
  if (i < e.s.length - 1) return { ...w, i, n };
  const s = e.s[w.forward ? e.s.length - 1 : 0]; // arrived: look towards the viewer and stand a while (two to six seconds)
  return { ...w, at: w.forward ? e.b : e.a, edge: -1, i: 0, wait: 16 + Math.floor(rnd() * 32), n, face: towardsViewer(w.forward ? s[3] : 3 - s[3]) };
}

/** Where his picture goes and which of his pictures to show. */
export function pose(w: Walker, walk: Walk): Pose {
  if (w.edge >= 0) {
    const e = walk.edges[w.edge], s = e.s[w.forward ? w.i : e.s.length - 1 - w.i];
    return { x: s[0], y: s[1], k: s[2], dir: w.forward ? s[3] : 3 - s[3], frame: HOPS[w.i % 4] };
  }
  const [x, y, k] = walk.nodes[w.at];
  return { x, y, k, dir: w.face, frame: w.n % 40 === 0 ? "blink" : "idle" };
}

/** While he talks he stands where he is, looking towards you, smiling. */
export const talking = (p: Pose): Pose => ({ ...p, dir: towardsViewer(p.dir), frame: "happy" });
