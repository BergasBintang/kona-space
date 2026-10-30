import { test } from "node:test";
import assert from "node:assert/strict";
import { pose, startWalker, step, talking, towardsViewer, type Walk } from "./kibby.ts";

// a made-up route: A - B - C in a line, and B - D; every stretch has a step per unit
const line = (n: number, dir: number, k: number) => Array.from({ length: n }, (_, i) => [i * 2, i, k, dir]);
const walk: Walk = {
  nodes: { A: [0, 0, 5], B: [10, 5, 5], C: [20, 10, 5], D: [10, 15, 7] },
  edges: [{ a: "A", b: "B", s: line(6, 1, 5) }, { a: "B", b: "C", s: line(6, 1, 5) }, { a: "B", b: "D", s: line(6, 0, 7) }],
};
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

test("he only ever stands on a place or walks a stretch, and every step is on the route", () => {
  const rnd = seeded(7);
  let w = startWalker("B");
  const seen = new Set<string>();
  for (let t = 0; t < 5000; t++) {
    w = step(w, walk, rnd);
    const p = pose(w, walk);
    if (w.edge < 0) { assert.ok(w.at in walk.nodes); assert.equal(p.dir < 2, true); seen.add(w.at); }
    else assert.ok(walk.edges[w.edge].s.some((s) => s[0] === p.x && s[1] === p.y && s[2] === p.k));
  }
  assert.deepEqual([...seen].sort(), ["A", "B", "C", "D"]);
});

test("a walk back along a stretch turns him round, and he never turns straight back where there is another way", () => {
  const w = { ...startWalker("C"), wait: 0 }, next = step(w, walk, () => 0), p0 = pose(next, walk);
  assert.equal(next.forward, false); // C is the end of the stretch B - C
  assert.equal(p0.dir, 2); // going back along a stretch that looks down-right means looking up-left
  const atB = { ...startWalker("B"), wait: 0, last: 0 };
  for (let r = 0; r < 20; r++) assert.notEqual(step(atB, walk, () => r / 20).edge, 0);
});

test("when he talks he looks towards you and smiles, wherever he was going", () => {
  assert.equal(towardsViewer(2), 1);
  assert.equal(towardsViewer(3), 0);
  assert.equal(towardsViewer(0), 0);
  const p = talking({ x: 1, y: 2, k: 3, dir: 3, frame: "walkA" });
  assert.deepEqual([p.dir, p.frame, p.x, p.y, p.k], [0, "happy", 1, 2, 3]);
});
