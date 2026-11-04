import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { STANDARD, CAT_ROLES, checkMap, parseMap } from "./map.ts";
import { buildScene, meetingSeats } from "./engine/scene.ts";
import { KINDS, footprintOf } from "./engine/furniture.ts";
import { WALL_PAGES } from "./engine/decor.ts";
import { OUT, WALL_SHADES } from "./engine/palette.ts";
import { Iso } from "./engine/iso.ts";
import { ensurePages, missingPieces } from "./map.ts";
import { addAttach, artHung, faceAt, growMap, isPlaced, moveObject, newObject, objectAt, paintFloor, placeObject, removeAttach, setParam, setWall, trimMap, turnObject, deleteObject } from "./edit.ts";
import type { OfficeMap } from "./engine/types.ts";

const text = (m: OfficeMap) => JSON.stringify(m);

test("the standard office is a good map and says nothing is wrong with it", () => {
  const r = parseMap(text(STANDARD));
  assert.ok("map" in r, "error" in r ? r.error : "");
  assert.deepEqual((r as { map: OfficeMap }).map, JSON.parse(text(STANDARD)));
  assert.deepEqual(checkMap(STANDARD), []);
  assert.equal(CAT_ROLES.length, 11);
});

test("a map that is not right is refused with a reason, never half read", () => {
  const bad = (f: (m: OfficeMap) => void) => { const m = structuredClone(STANDARD); f(m); return parseMap(text(m)); };
  assert.ok("error" in parseMap("nope"));
  assert.ok("error" in parseMap('{"version":2}'));
  assert.ok("error" in bad((m) => { m.floor.pop(); }));
  assert.ok("error" in bad((m) => { m.floor[0][0] = "nowhere"; }));
  assert.ok("error" in bad((m) => { m.styles[0].floor = ["red", "blue"] as never; }));
  assert.ok("error" in bad((m) => { m.styles = []; }));
  assert.ok("error" in bad((m) => { m.attach.push({ i: 999, j: 0, face: "i+", kind: "window" }); }));
  assert.ok("error" in bad((m) => { (m.objects as unknown[]).push({ kind: 5 }); }));
  assert.ok("error" in bad((m) => { m.cols = 9999; }));
});

test("every side of the standard office is drawn, with all eleven cats, and every person and piece can be clicked", () => {
  for (let view = 0; view < 4; view++) {
    const s = buildScene(STANDARD, view);
    assert.equal(s.cats.length, 11, `view ${view}: cats`);
    assert.deepEqual(new Set(s.cats.map((c) => c.role)).size, 11);
    assert.equal(s.hits.filter((h) => h.kind === "person").length, 11, `view ${view}: every person can be clicked`);
    assert.ok(Object.values(KINDS).filter((k) => k.opens).every((k) => s.hits.some((h) => h.opens === k.opens)), `view ${view}: every piece that opens a screen can be clicked`);
    const [x0, y0, x1, y1] = s.content;
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= s.width && y1 <= s.height && x1 > x0 && y1 > y0, `view ${view}: the filled part lies inside the picture`);
    assert.ok(s.items.length > 300 && s.ground.trim() !== null);
    assert.ok(s.tall.size > 0 && [...s.tall].every((k) => { const [i, j] = k.split(",").map(Number); return STANDARD.walls[j][i]; }), `view ${view}: tall walls are walls`);
  }
});

test("what lies behind something is drawn before it, tall walls included, on every side of the building", () => {
  const behind = (x: number[], y: number[]) => x[1] <= y[0] + 1e-6 || x[3] <= y[2] + 1e-6;
  for (let view = 0; view < 4; view++) {
    const s = buildScene(STANDARD, view), solids = s.items.map((t, n) => ({ t, n })).filter(({ t }) => t.fp);
    assert.equal(solids.length, s.items.length, "everything has a footprint, so nothing keeps a fixed place that could be wrong at a joint");
    let wrong = 0;
    for (const x of solids) for (const y of solids) if (x.n > y.n && behind(x.t.fp!, y.t.fp!) && !behind(y.t.fp!, x.t.fp!)) wrong++;
    assert.ok(wrong <= 2, `view ${view}: ${wrong} pairs are drawn the wrong way round (only a loop may be)`);
    // a low wall that lies behind a tall one is drawn before it
    for (const x of solids) for (const y of solids) if (x.t.kind === "wall" && y.t.kind === "wall" && x.t.label.startsWith("wall") && y.t.label.startsWith("back wall") && behind(x.t.fp!, y.t.fp!) && !behind(y.t.fp!, x.t.fp!)) assert.ok(x.n < y.n, `view ${view}: ${x.t.label} must come before ${y.t.label}`);
  }
  // a cat is drawn after its chair, whichever way the building is turned
  for (let view = 0; view < 4; view++) {
    const sc = buildScene(STANDARD, view);
    for (const c of sc.cats) {
      const at = sc.items.findIndex((t) => t.role === c.role);
      const chair = sc.items.findIndex((t) => t.kind === "obj" && t.label === "chair" && t.ref === sc.items[at].ref);
      assert.ok(chair >= 0 && chair < at, `view ${view}: the chair of ${c.role} is drawn before the cat`);
    }
  }
});

test("a window, a door and a board are painted into the wall tile they hang on, so they go with it", () => {
  const m = structuredClone(STANDARD);
  const noDecor = structuredClone(m); noDecor.attach = noDecor.attach.filter((a) => a.kind === "doorway");
  for (let view = 0; view < 4; view++) {
    const withIt = buildScene(m, view), without = buildScene(noDecor, view);
    assert.equal(withIt.items.length, without.items.length, `view ${view}: nothing extra is drawn on its own`);
    assert.ok(withIt.items.filter((t) => t.kind === "deco").length === 0);
    const differs = withIt.items.filter((t, n) => t.img && without.items[n].img && Buffer.compare(Buffer.from(t.img.d), Buffer.from(without.items[n].img.d)) !== 0).length;
    assert.ok(differs > 0, `view ${view}: the walls carry their windows`);
  }
});

test("a map with something unknown or out of place still draws, and the checks name it", () => {
  let m = placeObject(STANDARD, { kind: "ghost", i: 1, j: 1 });
  assert.equal(m, STANDARD, "an unknown kind is not placed");
  m = structuredClone(STANDARD); m.objects.push({ kind: "ghost", i: 1, j: 1 }); // a saved map may still have one
  assert.doesNotThrow(() => buildScene(m, 0));
  assert.ok(checkMap(m).some((w) => w.includes("ghost")));
  const stool = newObject("block", 0, 0)!, bad = placeObject(STANDARD, stool); // tile 0,0 is the corner of a wall
  assert.ok(checkMap(bad).some((w) => w.includes("stands")));
  const desk = newObject("workstation", 3, 3)!;
  assert.equal(placeObject(STANDARD, desk), STANDARD, "a second desk for a person is not placed: there is only one");
  const twice = structuredClone(STANDARD); twice.objects.push(desk); // a hand-made map may still have two
  assert.ok(checkMap(twice).length > 0);
});

test("editing returns a new map and never changes the old one", () => {
  const before = text(STANDARD);
  const a = paintFloor(STANDARD, 12, 12, "mint-carpet"), b = setWall(a, 12, 12, true), c = addAttach(b, { i: 12, j: 12, face: "j+", kind: "window" });
  assert.notEqual(a, STANDARD); assert.equal(a.floor[12][12], "mint-carpet");
  assert.equal(b.walls[12][12], true); assert.equal(c.attach.length, STANDARD.attach.length + 1);
  assert.equal(text(STANDARD), before, "the standard office is untouched");
  assert.equal(paintFloor(STANDARD, 12, 12, STANDARD.floor[12][12]), STANDARD, "nothing to change: the same map comes back");
  // taking a wall away takes what hung on it, but not a doorway
  const d = setWall(c, 12, 12, false);
  assert.equal(d.attach.length, STANDARD.attach.length);
});

test("a doorway and a window on the same tile do not replace each other, two windows on one face do", () => {
  let m = addAttach(STANDARD, { i: 5, j: 5, face: "j+", kind: "window" });
  m = addAttach(m, { i: 5, j: 5, face: "j+", kind: "doorway" });
  assert.equal(m.attach.filter((a) => a.i === 5 && a.j === 5).length, 2);
  m = addAttach(m, { i: 5, j: 5, face: "j+", kind: "art", art: "cork", span: 3 });
  assert.equal(m.attach.filter((a) => a.i === 5 && a.j === 5 && a.kind !== "doorway").length, 1, "the art took the place of the window");
  m = removeAttach(m, 5, 5);
  assert.equal(m.attach.filter((a) => a.i === 5 && a.j === 5).length, 0);
});

test("objects: find, move, turn, change and delete", () => {
  let m = STANDARD;
  const k = m.objects.findIndex((o) => o.kind === "workstation" && o.role === "secretary");
  const f = footprintOf(m.objects[k])!;
  assert.deepEqual([f[2], f[3]], [2, 2], "a wide desk with its chair is a block of 2 by 2");
  assert.equal(objectAt(m, f[0], f[1]), k);
  m = turnObject(m, k);
  assert.equal(m.objects[k].facing, 1);
  assert.deepEqual(footprintOf(m.objects[k])!.slice(2), [2, 2]);
  m = turnObject(turnObject(turnObject(m, k), k), k);
  assert.equal(m.objects[k].facing, 0, "four turns come back");
  m = moveObject(m, k, 20, 20);
  assert.deepEqual([m.objects[k].i, m.objects[k].j], [20, 20]);
  assert.equal(moveObject(m, k, -1, 0), m, "it cannot leave the map");
  assert.equal(setParam(m, k, "role", "support"), m, "a role that already has a desk is not taken twice");
  const s = m.objects.findIndex((o) => o.kind === "workstation" && o.role === "support");
  m = deleteObject(m, s);
  const k2 = m.objects.findIndex((o) => o.kind === "workstation" && o.role === "secretary");
  m = setParam(m, k2, "role", "support");
  assert.equal(m.objects[k2].role, "support");
  m = setParam(m, k2, "role", "secretary"); // and back
  assert.equal(setParam(m, k2, "kind", "bin"), m, "the kind and the place are not parameters");
  const n = m.objects.length;
  assert.equal(deleteObject(m, k2).objects.length, n - 1);
  const rug = m.objects.findIndex((o) => o.kind === "rug");
  const r = m.objects[rug], rf = footprintOf(r)!;
  assert.equal(objectAt(m, rf[0], rf[1]) === rug || objectAt(m, rf[0], rf[1]) >= 0, true);
});

test("growing the map and trimming it again gives the same map; trimming never cuts what is used", () => {
  for (const side of ["left", "right", "top", "bottom"] as const) {
    const g = growMap(STANDARD, side);
    assert.equal(g.cols * g.rows > STANDARD.cols * STANDARD.rows, true);
    assert.equal(text(trimMap(g)), text(STANDARD), side);
  }
  const left = growMap(STANDARD, "left");
  assert.equal(left.objects[0].i, STANDARD.objects[0].i + 1, "everything moves one tile when a column is added on the left");
  assert.equal(trimMap(STANDARD), STANDARD, "nothing to trim");
  assert.ok(checkMap(growMap(growMap(STANDARD, "top"), "left")).length === 0, "the checks still pass after the shift");
});

test("a click is on the face of the wall tile it is nearest to", () => {
  assert.equal(faceAt(0.9, 0.5), "i+"); assert.equal(faceAt(0.1, 0.5), "i-"); assert.equal(faceAt(0.5, 0.9), "j+"); assert.equal(faceAt(0.5, 0.1), "j-");
});

test("the camera turns a tile of the plan into a tile of its grid and back, on every side", () => {
  const iso = (v: number) => new Iso(45, 27, v);
  for (let v = 0; v < 4; v++) for (const [i, j] of [[0, 0], [44, 26], [10, 3], [3, 20]]) {
    const [u, w] = iso(v).cell(i, j);
    assert.deepEqual(iso(v).unCell(u, w), [i, j], `side ${v}`);
    assert.ok(u >= 0 && w >= 0 && u < iso(v).U && w < iso(v).V);
  }
});

test("every kind of the catalog draws on its own and says how big it is", () => {
  const m = structuredClone(STANDARD);
  for (const [kind, k] of Object.entries(KINDS)) {
    const o = newObject(kind, 22, 12)!;
    assert.ok(o, kind);
    const [w, d] = k.size(o);
    assert.ok(w >= 1 && d >= 1, `${kind} has a size`);
    for (const facing of [0, 1, 2, 3] as const) { m.objects.push({ ...o, facing }); }
  }
  for (let view = 0; view < 4; view++) assert.doesNotThrow(() => buildScene(m, view));
});

test("a saved map that is hand-edited into nonsense cannot crash or freeze the drawing", () => {
  const m = structuredClone(STANDARD);
  m.objects.push({ kind: "constructor", i: 3, j: 3 }, { kind: "toString", i: 4, j: 4 }, { kind: "block", i: 3, j: 8, w: 1e9, d: -5, h: 1e9, m: "constructor", label: "x" } as never,
    { kind: "rug", i: 2, j: 2, w: 1e12, d: 1e12 } as never, { kind: "chart", i: 5, j: 5, w: 1e9, bars: [null, 5, ["x"]] } as never, { kind: "workstation", i: 9, j: 9, role: "constructor" } as never);
  m.attach.push({ i: 1, j: 0, face: "j+", kind: "art", art: "__proto__" }, { i: 2, j: 0, face: "j+", kind: "art", art: "constructor", span: 12 });
  const r = parseMap(text(m));
  assert.ok("map" in r, "error" in r ? r.error : "");
  const t0 = Date.now();
  for (let v = 0; v < 4; v++) assert.doesNotThrow(() => buildScene((r as { map: OfficeMap }).map, v));
  assert.doesNotThrow(() => checkMap((r as { map: OfficeMap }).map));
  assert.ok(Date.now() - t0 < 10000, "it did not freeze");
});

test("the dots of a carpet stay on the carpet tile they belong to, on every side", () => {
  const map = STANDARD, carpets = map.styles.filter((r) => r.pattern === "carpet");
  const rgb = (s: string) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
  for (let view = 0; view < 4; view++) {
    const g = buildScene(map, view).ground, iso = new Iso(map.cols, map.rows, view);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const o = (y * g.w + x) * 4;
      if (!g.d[o + 3]) continue;
      for (const r of carpets) {
        const [a, b, c] = rgb(r.floor[1]);
        if (g.d[o] !== a || g.d[o + 1] !== b || g.d[o + 2] !== c) continue;
        const dy = (y - 42) / 8, dx = (x - iso.OX) / 16, [i, j] = iso.unCell(Math.floor((dy + dx) / 2), Math.floor((dy - dx) / 2));
        assert.equal(map.floor[j]?.[i], r.id, `a dot of ${r.id} lies on ${map.floor[j]?.[i]} at ${x},${y} (side ${view})`);
      }
    }
  }
});

// The screens that have no worker are opened by a piece of the office (a piece of furniture, or a board on a wall). The workers' screens are opened by their cats.
const SCREENS = ["accounts", "board", "brain", "costs", "files", "leftovers", "mockups", "servers", "settings", "workflows", "worktrees"];

test("every screen without a worker has exactly one piece that opens it, and the standard office holds each once", () => {
  const furniture = Object.entries(KINDS).filter(([, k]) => k.opens).map(([kind, k]) => [kind, k.opens!] as const), walls = Object.entries(WALL_PAGES);
  const opened = [...furniture.map(([, p]) => p), ...walls.map(([, p]) => p)];
  assert.deepEqual([...opened].sort(), SCREENS, "each screen is opened by one piece, and only these screens");
  assert.ok(furniture.every(([kind]) => KINDS[kind].group === "pages"), "a piece that opens a screen is in the group Opens a screen");
  for (const [kind] of furniture) assert.equal(STANDARD.objects.filter((o) => o.kind === kind).length, 1, `${kind} stands once in the standard office`);
  for (const [art] of walls) assert.equal(STANDARD.attach.filter((a) => a.kind === "art" && a.art === art).length, 1, `${art} hangs once in the standard office`);
});

test("nothing stands in front of a doorway: the tiles on both sides of every doorway are free", () => {
  const doorway = new Set(STANDARD.attach.filter((a) => a.kind === "doorway").map((a) => `${a.i},${a.j}`));
  const taken = new Map<string, string>();
  for (const o of STANDARD.objects) {
    if (o.kind === "rug") continue;
    const f = footprintOf(o);
    if (f) for (let i = f[0]; i < f[0] + f[2]; i++) for (let j = f[1]; j < f[1] + f[3]; j++) taken.set(`${i},${j}`, o.kind);
  }
  for (const key of doorway) {
    const [i, j] = key.split(",").map(Number);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = `${i + di},${j + dj}`;
      if (doorway.has(n) || STANDARD.walls[j + dj]?.[i + di] !== false) continue; // another tile of the doorway, a wall, or off the map
      assert.equal(taken.get(n), undefined, `${taken.get(n)} stands on ${n}, in front of the doorway at ${key}`);
    }
  }
});

test("the pieces that open a screen look different from every other piece and from each other, on every side", () => {
  
  const opens = (k: number) => KINDS[STANDARD.objects[k].kind].opens;
  for (let view = 0; view < 4; view++) {
    const s = buildScene(STANDARD, view), seen = new Map<string, string>();
    const hash = (k: number) => createHash("sha1").update(Buffer.concat(s.items.filter((t) => t.ref === k && t.img).map((t) => Buffer.concat([Buffer.from(`${t.img!.w}x${t.img!.h}`), Buffer.from(t.img!.d.buffer, t.img!.d.byteOffset, t.img!.d.byteLength)])))).digest("hex");
    const mean = (k: number) => { let n = 0; const sum = [0, 0, 0]; for (const t of s.items.filter((x) => x.ref === k && x.img)) for (let q = 0; q < t.img!.d.length; q += 4) if (t.img!.d[q + 3]) { n++; for (let c = 0; c < 3; c++) sum[c] += t.img!.d[q + c]; } return sum.map((v) => v / n); };
    const pages = STANDARD.objects.map((_, k) => k).filter((k) => opens(k));
    assert.equal(pages.length, 9, "nine pieces of furniture open a screen");
    STANDARD.objects.forEach((o, k) => { if (o.kind === "rug") return; const h = hash(k), other = seen.get(h); if (other && opens(k)) assert.fail(`view ${view}: ${o.kind} looks exactly like ${other}`); seen.set(h, o.kind); });
    for (const a of pages) for (const b of pages) if (a < b) assert.ok(Math.hypot(...mean(a).map((v, c) => v - mean(b)[c])) >= 12, `view ${view}: ${STANDARD.objects[a].kind} and ${STANDARD.objects[b].kind} are too much alike in colour`);
  }
});

test("every wall, tall or low, and every door post is the one wall colour in its three shades, from every side", () => {
  const m = structuredClone(STANDARD);
  m.attach = m.attach.filter((a) => a.kind === "doorway"); // windows, doors and boards have colours of their own
  const hex = (d: Uint8ClampedArray | Uint8Array, q: number) => "#" + [0, 1, 2].map((c) => d[q + c].toString(16).padStart(2, "0")).join("");
  const allowed = new Set([OUT, ...WALL_SHADES].map((c) => c.toLowerCase()));
  for (let view = 0; view < 4; view++) {
    const s = buildScene(m, view), walls = s.items.filter((t) => (t.kind === "wall" || t.kind === "post") && t.img);
    assert.ok(walls.length > 100 && walls.some((t) => t.kind === "post"), `view ${view}: walls and door posts are drawn`);
    for (const t of walls) for (let q = 0; q < t.img!.d.length; q += 4) if (t.img!.d[q + 3]) assert.ok(allowed.has(hex(t.img!.d, q)), `view ${view}: ${t.label} has the colour ${hex(t.img!.d, q)}`);
  }
});

test("there is only one of each person's desk, each piece that opens a screen and each unique board; removing one frees it", () => {
  const dup = (kind: string, extra: object = {}) => ({ ...newObject(kind, 3, 3)!, ...extra });
  assert.equal(placeObject(STANDARD, dup("workstation", { role: "qa" })), STANDARD, "QA already has a desk");
  assert.equal(placeObject(STANDARD, dup("brain stand")), STANDARD, "the brain stand is already there");
  assert.notEqual(placeObject(STANDARD, dup("chair")), STANDARD, "an ordinary chair may be put down any number of times");
  assert.ok(isPlaced(STANDARD, "workstation:qa") && isPlaced(STANDARD, "brain stand") && !isPlaced(STANDARD, "chair"));
  const i = STANDARD.objects.findIndex((o) => o.kind === "brain stand"), freed = deleteObject(STANDARD, i);
  assert.ok(!isPlaced(freed, "brain stand"));
  assert.notEqual(placeObject(freed, dup("brain stand")), freed, "after it is removed it can be put down again");
  const board = { i: 3, j: 0, face: "j+" as const, kind: "art" as const, art: "cork", span: 2 };
  assert.ok(artHung(STANDARD, "cork"));
  assert.equal(addAttach(STANDARD, board), STANDARD, "the cork board hangs once");
  assert.notEqual(addAttach(STANDARD, { ...board, art: "notes-not-unique" }), STANDARD);
  // every kind that opens a screen is unique, and every person has their own desk item
  assert.ok(Object.values(KINDS).filter((k) => k.opens).every((k) => k.unique));
});

test("a map saved before floor styles (with rooms, kinds and wall colours) is read as styles with the same colours, and draws the same ground", () => {
  const old = structuredClone(STANDARD) as unknown as Record<string, unknown>;
  old.rooms = STANDARD.styles.map((s) => ({ ...s, kind: s.id === "cream-tiles" ? "hall" : "place", wall: "#aa5544", holds: "something", color: "#112233" }));
  delete old.styles;
  const r = parseMap(JSON.stringify(old));
  assert.ok("map" in r, "error" in r ? r.error : "");
  assert.deepEqual((r as { map: OfficeMap }).map, STANDARD, "the old room fields are dropped, the colours and the floor stay");
  const a = buildScene(STANDARD, 0).ground, b = buildScene((r as { map: OfficeMap }).map, 0).ground;
  assert.ok(Buffer.compare(Buffer.from(a.d), Buffer.from(b.d)) === 0, "the ground is the same picture");
});

test("painting with a floor of Kona's palette adds its definition to the map; a style no tile uses is not kept on save", () => {
  const m = paintFloor(STANDARD, 12, 12, "charcoal-carpet");
  assert.ok(m.styles.some((s) => s.id === "charcoal-carpet") && m.floor[12][12] === "charcoal-carpet");
  assert.equal(paintFloor(STANDARD, 12, 12, "not-a-style"), STANDARD, "only Kona's own floors can be painted");
  const back = trimMap(paintFloor(m, 12, 12, STANDARD.floor[12][12]));
  assert.ok(!back.styles.some((s) => s.id === "charcoal-carpet"));
  assert.ok(parseMap(JSON.stringify(m)).hasOwnProperty("map"), "a map with a new style still reads");
});

test("an area with something in it and no way to the rest of the office is named; the standard office has none", () => {
  assert.deepEqual(checkMap(STANDARD), []);
  const shut = structuredClone(STANDARD);
  for (const a of shut.attach) if (a.kind === "doorway") shut.walls[a.j][a.i] = true; // a doorway is floor in a wall line: put the wall back
  shut.attach = shut.attach.filter((a) => a.kind !== "doorway");
  const w = checkMap(shut).filter((x) => x.includes("no way to the rest of the office"));
  assert.ok(w.length >= 5, `closing the doorways shuts in ${w.length} areas`);
});

test("a person without a desk, or a screen without a piece, stops a save, and a saved office gets what it lacks put back", () => {
  assert.deepEqual(missingPieces(STANDARD), []);
  const m = structuredClone(STANDARD);
  m.objects = m.objects.filter((o) => !(o.kind === "workstation" && o.role === "design") && o.kind !== "cash desk");
  m.attach = m.attach.filter((a) => a.art !== "cork");
  assert.equal(missingPieces(m).length, 3, "the desk of Design, the cash desk and the cork board are named");
  // the place where the cash desk stood is taken, so it goes to the nearest free floor
  const spot = STANDARD.objects.find((o) => o.kind === "cash desk")!;
  m.objects.push({ kind: "chair", i: spot.i, j: spot.j, facing: 0 });
  const e = ensurePages(m);
  assert.deepEqual(e.failed, []);
  assert.equal(e.added.length, 3);
  assert.deepEqual(missingPieces(e.map), []);
  const desk = e.map.objects.find((o) => o.kind === "cash desk")!;
  assert.ok(desk.i !== spot.i || desk.j !== spot.j, "it was not put on top of the chair");
  assert.deepEqual(checkMap(e.map), [], "nothing overlaps or stands in a wall");
  assert.equal(ensurePages(STANDARD).map, STANDARD, "an office that has everything is left as it is");
});

test("a saved office from before the meeting room gets the long table back with its chairs, and its flow board stays as a plain decoration", () => {
  const m = structuredClone(STANDARD);
  const table = m.objects.find((o) => o.kind === "workflow table")!;
  m.objects = m.objects.filter((o) => o.kind !== "workflow table" && !(o.kind === "chair" && o.j >= table.j - 1 && o.j <= table.j + 1 && o.i >= table.i && o.i < table.i + 6));
  m.objects.push({ kind: "flow board", i: 24, j: 1, facing: 0 }); // what an office saved before this version holds
  assert.equal(missingPieces(m).length, 1, "only the meeting table is named");
  assert.equal(KINDS["flow board"].opens, undefined, "the old board opens nothing");
  const e = ensurePages(m);
  assert.deepEqual(e.failed, []);
  const back = e.map.objects.find((o) => o.kind === "workflow table")!;
  assert.deepEqual([back.i, back.j], [table.i, table.j], "it goes back where the standard office has it, as that place is free");
  assert.equal(e.map.objects.filter((o) => o.kind === "chair" && o.j >= back.j - 1 && o.j <= back.j + 1 && o.i >= back.i && o.i < back.i + 6).length, 12, "with a chair for each of twelve places");
  assert.deepEqual(checkMap(e.map), [], "nothing overlaps");
  for (let view = 0; view < 4; view++) assert.doesNotThrow(() => buildScene(e.map, view));
  assert.equal(meetingSeats(e.map).length, 12);
});

test("the people at the meeting table sit on its chairs, each keeps their chair, the desk stays without the cat, and the cat can still be clicked", () => {
  const seats = meetingSeats(STANDARD);
  assert.equal(seats.length, 12, "twelve chairs, enough for all eleven people");
  const order = ["frontend", "backend", "qa", "security", "devops", "product", "design", "marketing", "content", "support", "secretary"];
  const seated = Object.fromEntries(order.map((r, n) => [r, n]));
  for (let view = 0; view < 4; view++) {
    const none = buildScene(STANDARD, view), all = buildScene(STANDARD, view, seated);
    assert.equal(none.cats.length, 11);
    assert.equal(all.cats.length, 11, "still eleven cats: each one moved, none was added or lost");
    const where = new Set(all.cats.map((c) => c.x + "," + c.y));
    assert.equal(where.size, 11, "no two cats on the same chair");
    const moved = all.cats.filter((c) => !none.cats.some((d) => d.role === c.role && d.x === c.x && d.y === c.y));
    assert.equal(moved.length, 11, "every cat is away from its desk");
    for (const role of order) assert.ok(all.hits.some((h) => h.role === role), `${role} can be clicked`);
    const one = buildScene(STANDARD, view, { qa: 3 });
    assert.equal(one.cats.filter((c) => none.cats.some((d) => d.role === c.role && d.x === c.x && d.y === c.y)).length, 10, "only the one who sits has left their desk");
  }
  // a person with a chair number that does not exist, and an office with no meeting table, change nothing
  assert.deepEqual(buildScene(STANDARD, 0, { qa: 99, product: -1 }).cats, buildScene(STANDARD, 0).cats);
  const bare = structuredClone(STANDARD); bare.objects = bare.objects.filter((o) => o.kind !== "workflow table");
  assert.deepEqual(buildScene(bare, 0, { qa: 3 }).cats, buildScene(bare, 0).cats);
});

test("Kibby may walk on any floor tile with no wall and nothing standing on it, in every room", () => {
  const s = buildScene(STANDARD, 0);
  let n = 0;
  for (let j = 0; j < STANDARD.rows; j++) for (let i = 0; i < STANDARD.cols; i++) {
    const free = STANDARD.floor[j][i] != null && !STANDARD.walls[j][i] && !STANDARD.objects.some((o) => { const f = KINDS[o.kind] && o.kind !== "rug" ? footprintOf(o) : null; return f && i >= f[0] && j >= f[1] && i < f[0] + f[2] && j < f[1] + f[3]; });
    assert.equal(s.walkable[j][i], free, `tile ${i},${j}`);
    if (free) n++;
  }
  assert.ok(n > 600, `${n} tiles to walk on (the hall alone was about 190)`);
});

test("a saved office that still holds a piece Kona retired is read without it and draws", () => {
  const old = structuredClone(STANDARD);
  old.objects.push({ kind: "voice booth", i: 3, j: 22, facing: 0 }, { kind: "logbook stand", i: 12, j: 23, facing: 0 });
  const r = parseMap(JSON.stringify(old));
  assert.ok("map" in r, "error" in r ? r.error : "");
  assert.deepEqual((r as { map: OfficeMap }).map.objects, STANDARD.objects, "the retired pieces are left out");
  assert.deepEqual(checkMap((r as { map: OfficeMap }).map), [], "and nothing is said about them");
});

test("the pictures for the editor's list: a wall, a doorway and each thing on a wall draw something, and no two look alike", async () => {
  const { thumbOfAttach, thumbOfDoorway, thumbOfWall } = await import("./engine/thumb.ts");
  const pics = [
    ["wall", thumbOfWall()], ["doorway", thumbOfDoorway()],
    ["window", thumbOfAttach({ kind: "window", span: 1 })], ["door", thumbOfAttach({ kind: "door", span: 2 })],
    ["cork", thumbOfAttach({ kind: "art", art: "cork", span: 5 })], ["branches", thumbOfAttach({ kind: "art", art: "branches", span: 3 })], ["staff", thumbOfAttach({ kind: "art", art: "staff", span: 4 })],
  ] as const;
  const seen = new Map<string, string>();
  for (const [name, p] of pics) {
    assert.ok(p?.img, `${name} has a picture`);
    const key = createHash("sha1").update(Buffer.from(p!.img!.d)).update(`${p!.img!.w}x${p!.img!.h}`).digest("hex");
    assert.ok(!seen.has(key), `${name} looks like ${seen.get(key)}`);
    seen.set(key, name);
  }
});

test("a thing on a wall goes on a side that is free: never on a side that faces another wall tile", async () => {
  const { attachProblem, freeSideAt, sideFree } = await import("./edit.ts");
  const m = structuredClone(STANDARD);
  // a wall two tiles thick, four long, on open floor: the inner row of tiles faces the outer row on one side only
  m.cols = Math.max(m.cols, 12); m.rows = Math.max(m.rows, 12);
  for (const row of [m.floor, m.walls] as unknown[][][]) while (row.length < m.rows) row.push(Array(m.cols).fill(row === m.walls ? false : null));
  for (const row of m.floor) while (row.length < m.cols) row.push(null);
  for (const row of m.walls) while (row.length < m.cols) row.push(false);
  m.attach = []; m.objects = [];
  for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) { m.walls[j][i] = false; m.floor[j][i] = m.styles[0].id; }
  for (let i = 3; i < 7; i++) { m.walls[5][i] = true; m.walls[6][i] = true; }
  assert.equal(sideFree(m, 4, 5, "j+"), false, "the side of the upper row that looks into the lower row is not free");
  assert.equal(sideFree(m, 4, 5, "j-"), true);
  assert.equal(freeSideAt(m, 4, 5, 0.5, 0.95), "j-", "a click near the buried side goes to the free one");
  assert.equal(attachProblem(m, { i: 4, j: 5, face: "j+", kind: "window" })?.includes("inside the wall"), true);
  assert.equal(attachProblem(m, { i: 4, j: 5, face: "j-", kind: "window" }), null);
  assert.equal(attachProblem(m, { i: 5, j: 5, face: "j-", kind: "door", span: 4 })?.includes("not on a wall all along"), true, "a board wider than the wall");
  m.attach = [{ i: 4, j: 5, face: "j+", kind: "window" }];
  assert.ok(checkMap(m).some((w) => w.includes("inside the wall")), "a window already buried in a saved office is named");
});

test("a doorway is a gap in a line of wall: it says which way the wall runs, and why a tile cannot be one", async () => {
  const { doorwayAxis, doorwayProblem } = await import("./edit.ts");
  const m = structuredClone(STANDARD);
  const gap = m.attach.find((a) => a.kind === "doorway")!; // the standard office's own doorways are all good
  for (const a of m.attach.filter((x) => x.kind === "doorway")) assert.ok(doorwayAxis(m, a.i, a.j), `the doorway at ${a.i},${a.j} is in a wall line`);
  assert.equal(doorwayProblem(m, gap.i, gap.j), null);
  const wall = m.walls.flatMap((row, j) => row.map((w, i) => (w ? [i, j] : null))).find((p) => p)!;
  assert.ok(doorwayProblem(m, wall[0], wall[1])?.includes("take the wall tile away"), "a wall tile is not a gap yet");
  // a lone floor tile in the middle of a big open room has no wall at its ends
  const open = structuredClone(m); for (let j = 0; j < open.rows; j++) for (let i = 0; i < open.cols; i++) { open.walls[j][i] = false; open.floor[j][i] = open.styles[0].id; }
  assert.equal(doorwayAxis(open, 8, 8), null);
  assert.ok(doorwayProblem(open, 8, 8)?.includes("gap in a line of wall"));
  open.attach = [{ i: 8, j: 8, face: "j+", kind: "doorway" }];
  assert.ok(checkMap(open).some((w) => w.includes("does nothing")), "a doorway in no wall line is named");
});

test("a doorway is drawn as a gap with a post at each end, whatever its width", async () => {
  const { doorwayGaps } = await import("./engine/doorway.ts");
  const gaps = doorwayGaps(STANDARD);
  assert.ok(gaps.some((g) => g.last[0] - g.first[0] + g.last[1] - g.first[1] >= 1), "the standard office has gaps wider than one tile");
  for (let view = 0; view < 4; view++) {
    const posts = buildScene(STANDARD, view).items.filter((t) => String(t.label ?? "").startsWith("door post"));
    assert.ok(posts.length >= gaps.length, `side ${view}: every gap has its posts drawn (${posts.length} pieces for ${gaps.length} gaps)`);
  }
});
