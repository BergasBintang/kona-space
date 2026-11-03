import { test } from "node:test";
import assert from "node:assert/strict";
import { bakoPose, bakoSays, bakoStillValid, bakoTalking, carrying, doorSpots, pathTo, placesOf, reach, startBako, tickBako, workerSpots, type Bako, type Places, type Tile } from "./bako.ts";
import { buildScene } from "../office/engine/scene.ts";
import { footprintOf } from "../office/engine/furniture.ts";
import { STANDARD } from "../office/map.ts";

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const grid = (rows: string[]) => rows.map((r) => [...r].map((c) => c === "."));
const scene = buildScene(STANDARD, 0), walkable = scene.walkable, places = placesOf(STANDARD);
const key = (t: Tile) => `${t[0]},${t[1]}`;
const tile = (b: Bako): Tile => [Math.floor(b.w.x / 8), Math.floor(b.w.y / 8)];

test("the door of the standard office has its floor in front of it, one tile for each tile of the door", () => {
  assert.deepEqual(doorSpots(STANDARD), [[[19, 25], [20, 25]]]);
  assert.ok(places.doors[0].every(([i, j]) => walkable[j][i]), "he can stand there");
});

test("a door that looks along i has its floor in front of it along i, and one that spans one tile has one", () => {
  const m = structuredClone(STANDARD);
  m.attach = [{ i: 5, j: 3, face: "i+", kind: "door", span: 2 }, { i: 9, j: 9, face: "j+", kind: "door" }, { i: 1, j: 1, face: "j-", kind: "window" }];
  assert.deepEqual(doorSpots(m), [[[6, 3], [6, 4]], [[9, 10]]]);
  m.attach = [];
  assert.deepEqual(doorSpots(m), []);
});

test("every worker has floor around the desk, behind the chair first, and the desk's own tiles are not on it", () => {
  const all = workerSpots(STANDARD);
  assert.equal(all.length, 11);
  for (const w of all) {
    const o = STANDARD.objects.find((x) => x.kind === "workstation" && x.role === w.role)!, [i0, j0, fw, fd] = footprintOf(o)!;
    assert.ok(w.spots.length >= 4);
    assert.ok(w.spots.every(([i, j]) => !(i >= i0 && i < i0 + fw && j >= j0 && j < j0 + fd)), `${w.role}: a spot is inside the desk`);
    const d = [[0, 1], [-1, 0], [0, -1], [1, 0]][(o.facing ?? 0) as number], mid = [i0 + (fw - 1) / 2, j0 + (fd - 1) / 2];
    const dot = (t: Tile) => (t[0] - mid[0]) * d[0] + (t[1] - mid[1]) * d[1];
    assert.ok(dot(w.spots[0]) <= dot(w.spots[w.spots.length - 1]), `${w.role}: the first spot is behind the chair`);
  }
});

test("the walk to a tile is made of single steps on the floor and ends there; a tile that cannot be reached has no walk", () => {
  const small = grid(["....", ".x..", ".x..", "x..."]);
  const prev = reach(small, [0, 0]);
  const p = pathTo(prev, [2, 2]);
  assert.deepEqual(p[p.length - 1], [2, 2]);
  let at: Tile = [0, 0];
  for (const t of p) { assert.equal(Math.abs(t[0] - at[0]) + Math.abs(t[1] - at[1]), 1); assert.ok(small[t[1]][t[0]]); at = t; }
  assert.equal(p.length, 4, "the short way round the block");
  assert.deepEqual(pathTo(prev, [0, 3]), [], "(0, 3) is a wall");
  assert.deepEqual(pathTo(prev, [0, 0]), [], "he is already there");
  assert.equal(reach(small, [1, 1]).size, 0, "he cannot start on a wall");
});

test("from the door he can reach a spot at every worker's desk in the standard office, on every side of the building", () => {
  const prev = reach(walkable, places.doors[0][0] as Tile);
  for (const w of places.workers) assert.ok(w.spots.some((s) => prev.has(s[1] * 4096 + s[0])), `${w.role} cannot be reached`);
  for (let view = 1; view < 4; view++) assert.deepEqual(buildScene(STANDARD, view).walkable, walkable, "the floor is the same on every side");
});

test("he starts on the floor, away from a fixed place, or nowhere when there is none", () => {
  const spots = new Set<string>();
  for (let s = 1; s < 30; s++) { const b = startBako(walkable, seeded(s * 2654435761 % 2 ** 32))!; assert.ok(bakoStillValid(b, walkable)); spots.add(key(tile(b))); assert.equal(b.job, "sweep"); }
  assert.ok(spots.size > 10);
  assert.equal(startBako(grid(["xx"]), seeded(1)), null);
});

test("over a long time he sweeps, goes to the door, waits, carries a bento to a desk, hands it over and sweeps again: always one step at a time on the floor", () => {
  const rnd = seeded(11), order: string[] = [], doorTiles = new Set(places.doors[0].map(key)), served = new Map<string, number>();
  let b = startBako(walkable, rnd)!, last = b.job, steps = 0, bentoOutsideErrand = 0;
  for (let t = 0; t < 120000; t++) {
    const n = tickBako(b, walkable, places, rnd);
    assert.ok(Math.abs(n.w.x - b.w.x) + Math.abs(n.w.y - b.w.y) <= 1, "at most one step of an eighth tile");
    assert.ok(bakoStillValid(n, walkable), "always on the floor");
    if (carrying(n) && n.job === "sweep") bentoOutsideErrand++;
    if (n.job !== last) {
      order.push(`${last}>${n.job}`);
      if (n.job === "pickup") assert.ok(doorTiles.has(key(tile(n))), "he waits for the delivery in front of the door");
      if (n.job === "give") {
        const o = STANDARD.objects.find((x) => x.kind === "workstation" && x.role === n.role)!, [i0, j0, fw, fd] = footprintOf(o)!, [i, j] = tile(n);
        const near = (i >= i0 - 1 && i <= i0 + fw && j >= j0 && j < j0 + fd) || (j >= j0 - 1 && j <= j0 + fd && i >= i0 && i < i0 + fw);
        assert.ok(near, `he hands it over right beside the desk of ${n.role}`);
        served.set(n.role!, (served.get(n.role!) ?? 0) + 1);
      }
      last = n.job;
    }
    steps++; b = n;
  }
  assert.equal(bentoOutsideErrand, 0, "he never has the bento while he sweeps");
  const legal = new Set(["sweep>fetch", "fetch>pickup", "pickup>bring", "bring>give", "give>sweep"]);
  assert.ok(order.every((o) => legal.has(o)), `the jobs follow one another in order: ${[...new Set(order)].join(", ")}`);
  assert.ok(order.filter((o) => o === "give>sweep").length >= 30, "many deliveries");
  assert.ok(served.size >= 8, `it was a different worker each time, not always the same one (${served.size} different)`);
});

test("with two doors he picks between them by chance", () => {
  const two: Places = { ...places, doors: [[[19, 25]], [[28, 25]]] };
  const seen = new Set<string>();
  for (let s = 1; s < 60; s++) {
    const rnd = seeded(s);
    let b: Bako = { ...startBako(walkable, rnd)!, next: 0 };
    for (let t = 0; t < 4000 && b.job !== "pickup"; t++) b = tickBako(b, walkable, two, rnd);
    assert.equal(b.job, "pickup");
    seen.add(key(tile(b)));
  }
  assert.deepEqual([...seen].sort(), ["19,25", "28,25"]);
});

test("with no door, or no door he can reach, he only sweeps; with no worker he can reach he goes back to sweeping", () => {
  const rnd = seeded(5);
  for (const none of [{ ...places, doors: [] }, { ...places, doors: [[[0, 0]]] }] as Places[]) {
    let b: Bako = { ...startBako(walkable, rnd)!, next: 0 };
    for (let t = 0; t < 5000; t++) { b = tickBako(b, walkable, none, rnd); assert.equal(b.job, "sweep"); }
  }
  const nobody: Places = { ...places, workers: [] };
  let b: Bako = { ...startBako(walkable, rnd)!, next: 0 };
  const jobs = new Set<string>();
  for (let t = 0; t < 3000; t++) { b = tickBako(b, walkable, nobody, rnd); jobs.add(b.job); }
  assert.ok(jobs.has("pickup") && !jobs.has("bring"), "he fetched the bento but had nobody to take it to");
});

test("the bento is in his hand while he carries it, and a smile and an empty hand after he hands it over", () => {
  const rnd = seeded(3);
  let b: Bako = { ...startBako(walkable, rnd)!, next: 0 };
  const seen: Record<string, Set<string>> = {};
  for (let t = 0; t < 6000; t++) {
    b = tickBako(b, walkable, places, rnd);
    const d = bakoPose(scene, b);
    (seen[b.job] ??= new Set()).add(d.frame);
    assert.equal(d.who, "bako");
    assert.equal(carrying(b), d.frame.startsWith("carry"), `${b.job}: ${d.frame}`);
  }
  assert.ok([...seen.sweep].every((f) => !f.startsWith("carry")), "the broom while he sweeps");
  assert.ok([...seen.bring].every((f) => f.startsWith("carry")), "the bento while he walks to the desk");
  assert.ok(seen.give.has("happy") && seen.give.has("carryIdle"));
  const talk = bakoTalking({ who: "bako", x: 0, y: 0, k: 0, dir: 2, frame: "walkA" }, { ...b, job: "sweep" });
  assert.deepEqual([talk.dir, talk.frame], [1, "happy"], "he turns to you and smiles");
});

test("on an errand he sets off for the next tile on the tick he reaches one: no standing picture in the middle of a walk", () => {
  const rnd = seeded(21);
  let b: Bako = { ...startBako(walkable, rnd)!, next: 0 }, still = 0, starts = 0, walking = 0;
  for (let t = 0; t < 40000; t++) {
    const n = tickBako(b, walkable, places, rnd);
    if (n.job !== b.job && (n.job === "fetch" || n.job === "bring")) starts++;
    if ((n.job === "fetch" || n.job === "bring") && n.path.length > 0) { walking++; if (n.w.x === n.w.tx && n.w.y === n.w.ty) still++; }
    b = n;
  }
  assert.ok(walking > 2000, "he walked a good deal");
  assert.ok(still <= starts, `he stood for ${still} ticks in the middle of a walk (he may stand once, on the tick he leaves a stand)`);
});

test("he says something at the door and at the desk, by name, and nothing else of the time", () => {
  const rnd = seeded(8);
  let b: Bako = { ...startBako(walkable, rnd)!, next: 0 };
  const said = new Map<string, Set<string | null>>();
  for (let t = 0; t < 6000; t++) {
    b = tickBako(b, walkable, places, rnd);
    const s = bakoSays(b, (r) => (r === "product" ? "Kiki" : r));
    (said.get(b.job) ?? said.set(b.job, new Set()).get(b.job)!).add(s);
  }
  assert.deepEqual([...said.get("sweep")!], [null]);
  assert.deepEqual([...said.get("fetch")!], [null]);
  assert.deepEqual([...said.get("bring")!], [null]);
  assert.deepEqual([...said.get("pickup")!], ["Got it, thanks!"]);
  const give = [...said.get("give")!];
  assert.ok(give.length > 1 && give.every((s) => /^Bento for .+!$/.test(s ?? "")), `he names who it is for: ${give.join(" | ")}`);
});
