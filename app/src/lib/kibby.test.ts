import { test } from "node:test";
import assert from "node:assert/strict";
import { lookOf, pose, startWalker, step, stillValid, talking, towardsViewer, type Walker } from "./kibby.ts";
import { buildScene } from "../office/engine/scene.ts";
import { STANDARD } from "../office/map.ts";

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
// a small hall: a row of four tiles with a branch down from the second one
const grid = (rows: string[]) => rows.map((r) => [...r].map((c) => c === "."));
const small = grid(["....", ".#..", ".#.."].map((r) => r.replace("#", "x")));

test("he starts in the middle of a walkable tile, or nowhere when there is no floor", () => {
  const w = startWalker(small)!;
  assert.equal((w.x - 4) % 8, 0); assert.equal((w.y - 4) % 8, 0);
  assert.equal(startWalker(grid(["xx", "xx"])), null);
  assert.equal(startWalker([]), null);
});

test("he only ever stands on a tile he may use, moves one eighth at a time and reaches every tile joined to his own", () => {
  const rnd = seeded(7), seen = new Set<string>();
  let w = startWalker(small)!;
  for (let t = 0; t < 20000; t++) {
    const next = step(w, small, rnd);
    assert.ok(Math.abs(next.x - w.x) + Math.abs(next.y - w.y) <= 1, "at most one step of an eighth tile");
    assert.ok(stillValid(next, small));
    w = next; seen.add(`${Math.floor(w.x / 8)},${Math.floor(w.y / 8)}`);
  }
  assert.equal(seen.size, small.flat().filter(Boolean).length, "he has been everywhere he can");
});

test("he stands a while at every tile and does not turn straight back when there is another way", () => {
  let w: Walker = { ...startWalker(small)!, wait: 0 };
  const mid = { ...w, x: 12, y: 4, tx: 12, ty: 4, last: [0, 0] as [number, number], wait: 0 }; // on the second tile of the first row, having come from the first
  for (let r = 0; r < 30; r++) { const n = step(mid, small, () => r / 30); assert.notDeepEqual([n.tx, n.ty], [4, 4], "not back to where he came from"); }
  w = { ...w, x: 4, y: 4, tx: 12, ty: 4, hx: 1, hy: 0, wait: 0 };
  for (let i = 0; i < 8; i++) w = step(w, small, () => 0.1); // a low roll: he feels like a stop
  assert.deepEqual([w.x, w.y], [12, 4]);
  assert.ok(w.wait >= 16, "he stands a while when he feels like it");
  let v: Walker = { ...startWalker(small)!, x: 4, y: 4, tx: 12, ty: 4, hx: 1, hy: 0, wait: 0 };
  for (let i = 0; i < 8; i++) v = step(v, small, () => 0.9); // a high roll, and floor ahead: he goes on
  assert.equal(v.wait, 0, "he does not stop with floor ahead");
  const end = grid(["..."]); // a dead end: the last tile of a row
  let d: Walker = { ...startWalker(end)!, x: 12, y: 4, tx: 20, ty: 4, hx: 1, hy: 0, last: [1, 0], wait: 0 };
  for (let i = 0; i < 8; i++) d = step(d, end, () => 0.9);
  assert.ok(d.wait >= 16, "he always stops at a dead end");
});

test("along a corridor he walks several tiles in a row before he stops or turns", () => {
  const corridor = grid([".........."]), rnd = seeded(3);
  let w = startWalker(corridor)!, run = 0, runs: number[] = [], last = [w.x, w.y];
  for (let t = 0; t < 30000; t++) {
    w = step(w, corridor, rnd);
    if (w.x === w.tx && w.y === w.ty && (w.x !== last[0] || w.y !== last[1])) { run++; last = [w.x, w.y]; if (w.wait > 0) { runs.push(run); run = 0; } }
  }
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
  assert.ok(mean > 3, `he walks ${mean.toFixed(1)} tiles between stops on average, not one`);
});

test("when the map changes under him he is told his tile is gone", () => {
  const w = startWalker(small)!;
  const blocked = small.map((r) => r.map(() => false));
  assert.equal(stillValid(w, small), true);
  assert.equal(stillValid(w, blocked), false);
});

test("when he talks he looks towards you and smiles, wherever he was going", () => {
  assert.equal(towardsViewer(2), 1); assert.equal(towardsViewer(3), 0); assert.equal(towardsViewer(0), 0);
  const p = talking({ x: 1, y: 2, k: 3, dir: 3, frame: "walkA" });
  assert.deepEqual([p.dir, p.frame, p.x, p.y, p.k], [0, "happy", 1, 2, 3]);
});

test("in the standard office he walks the hall on every side of the building, with a place in the drawing order that always exists", () => {
  for (let view = 0; view < 4; view++) {
    const scene = buildScene(STANDARD, view), rnd = seeded(view + 1);
    let w = startWalker(scene.walkable)!;
    assert.ok(w, "there is a hall to walk on");
    for (let t = 0; t < 4000; t++) {
      w = step(w, scene.walkable, rnd);
      assert.ok(stillValid(w, scene.walkable), `view ${view}: on the hall at tick ${t}`);
      if (t % 5 === 0) { const p = pose(scene, w); assert.ok(p.k >= 0 && p.k <= scene.items.length && p.dir >= 0 && p.dir < 4, `view ${view}`); }
    }
  }
});

test("his look follows the way he goes, on the screen", () => {
  const scene = buildScene(STANDARD, 0);
  const base = startWalker(scene.walkable)!;
  assert.equal(lookOf(scene, { ...base, hx: 0, hy: 1 }), 0); // towards +j is down-left when the building is seen from its first side
  assert.equal(lookOf(scene, { ...base, hx: 1, hy: 0 }), 1);
  assert.equal(lookOf(scene, { ...base, hx: -1, hy: 0 }), 2);
  assert.equal(lookOf(scene, { ...base, hx: 0, hy: -1 }), 3);
  const turned = buildScene(STANDARD, 2);
  assert.equal(lookOf(turned, { ...base, hx: 0, hy: 1 }), 3, "seen from the opposite side, +j is up-right");
});
