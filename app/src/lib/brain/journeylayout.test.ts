// The swimlane layout of a journey (ticket T-0037): columns, lanes, loops, and the helpers the drawing uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseJourney, type Journey } from "./journey.ts";
import { BOX, MAX_GAP, MAX_STACK, edgesOf, layerView, layoutJourney, stepsFor, visibleTo, wrapWords } from "./journeylayout.ts";
import { journeyTable } from "./journeytable.ts";

const starter = readFileSync(new URL("../../brain/starter/kona-journey.md", import.meta.url), "utf8");
const example = (): Journey => parseJourney(starter).journey!;
const note = (body: unknown) => "```journey\n" + JSON.stringify(body) + "\n```\n";
const make = (steps: Record<string, unknown>[], lanes?: unknown[]): Journey => parseJourney(note({ lanes, steps: steps.map((s) => ({ name: s.id, lane: "app", actor: "system", ...s })) })).journey!;

test("the worked example: columns follow the way a person goes, lanes are rows, a loop is a back line", () => {
  const l = layoutJourney(example());
  const col = (id: string) => l.nodes.get(id)!.col;
  assert.deepEqual(["visit", "sign-in", "check-login", "home", "suggest-title", "share"].map(col), [0, 1, 2, 3, 4, 5]);
  assert.equal(l.cols, 6);
  assert.deepEqual(l.lanes.map((b) => b.id), ["person", "app", "server"]);
  assert.equal(l.nodes.get("visit")!.lane, 0);
  assert.equal(l.nodes.get("sign-in")!.lane, 1);
  assert.equal(l.nodes.get("check-login")!.lane, 2);
  const back = l.edges.filter((e) => e.back).map((e) => e.from + ">" + e.to);
  assert.deepEqual(back, ["check-login>sign-in"], "the wrong-password branch goes back; the self error is not a line at all");
  assert.ok(!l.edges.some((e) => e.from === e.to), "a step that leads to itself has no line");
});

test("a lane is as tall as its fullest column, and bands do not overlap", () => {
  const j = make([
    { id: "a", start: true, next: ["b", "c", "d"] },
    { id: "b", end: true }, { id: "c", end: true }, { id: "d", end: true },
  ]);
  const l = layoutJourney(j);
  const slots = ["b", "c", "d"].map((id) => l.nodes.get(id)!.slot).sort();
  assert.deepEqual(slots, [0, 1, 2], "three steps in one lane and column are stacked");
  assert.equal(l.lanes[1].slots, 3);
  assert.equal(l.lanes[1].h, BOX.padY * 2 + 3 * BOX.h + 2 * BOX.gapY);
  for (let i = 1; i < l.lanes.length; i++) assert.equal(l.lanes[i].y, l.lanes[i - 1].y + l.lanes[i - 1].h);
  const boxes = [...l.nodes.values()];
  for (const a of boxes) for (const b of boxes) if (a.id < b.id && a.col === b.col && a.lane === b.lane) assert.ok(a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} and ${b.id} overlap`);
  assert.equal(l.height, l.lanes.reduce((s, b) => s + b.h, 0));
});

test("the longest way decides the column, and a step with no way in stays in the first column", () => {
  const j = make([
    { id: "a", start: true, next: ["b", "d"] }, { id: "b", next: ["c"] }, { id: "c", next: ["d"] }, { id: "d", end: true },
    { id: "lost", end: true },
  ]);
  const l = layoutJourney(j);
  assert.equal(l.nodes.get("d")!.col, 3, "d is reached by a short way and a long one: the long one counts");
  assert.equal(l.nodes.get("lost")!.col, 0);
});

test("loops of any size never push a step to the right and never hang", () => {
  const j = make([
    { id: "a", start: true, next: ["b"] }, { id: "b", next: ["c"] }, { id: "c", next: ["a", "b", "d"] }, { id: "d", end: true },
  ]);
  const l = layoutJourney(j);
  assert.deepEqual(["a", "b", "c", "d"].map((id) => l.nodes.get(id)!.col), [0, 1, 2, 3]);
  assert.deepEqual(l.edges.filter((e) => e.back).map((e) => e.from + ">" + e.to).sort(), ["c>a", "c>b"]);
  // a ring with no start at all
  const ring = layoutJourney(make([{ id: "x", next: ["y"] }, { id: "y", next: ["z"] }, { id: "z", next: ["x"] }]));
  assert.equal(ring.nodes.size, 3);
  assert.equal(ring.edges.filter((e) => e.back).length, 1);
});

test("one line for each pair of steps: a branch label beats a button, a button beats an error", () => {
  const j = make([
    { id: "a", start: true, kind: "screen", mockup: "a.html", next: [{ to: "b", label: "chosen" }], buttons: [{ label: "Go", to: "b" }, { label: "Skip", to: "c" }], errors: [{ text: "Bad file", to: "c" }, { text: "Oops", to: "a" }] },
    { id: "b", end: true }, { id: "c", end: true },
  ]);
  const e = edgesOf(j);
  assert.equal(e.length, 2);
  assert.deepEqual(e.find((x) => x.to === "b"), { from: "a", to: "b", label: "chosen", kind: "next", back: false });
  assert.deepEqual(e.find((x) => x.to === "c"), { from: "a", to: "c", label: "Skip", kind: "button", back: false });
});

test("a step in a lane that does not exist is drawn in a band of its own", () => {
  const j = make([{ id: "a", start: true, end: true, lane: "moon" }]);
  const l = layoutJourney(j);
  assert.deepEqual(l.lanes.map((b) => b.name), ["Person", "App", "Server", "No lane"]);
  assert.equal(l.nodes.get("a")!.lane, 3);
});

test("an empty journey and one step lay out without a problem", () => {
  const empty = layoutJourney({ title: "", lanes: [], users: [], steps: [] });
  assert.equal(empty.nodes.size, 0);
  assert.ok(empty.width > 0 && empty.height === 0);
  const one = layoutJourney(make([{ id: "a", start: true, end: true }]));
  assert.equal(one.cols, 1);
  assert.equal(one.nodes.get("a")!.x, BOX.padX);
});

test("two thousand steps in a row, and a wide one with many branches, lay out fast", () => {
  const n = 2000;
  const chain = make(Array.from({ length: n }, (_, i) => ({ id: `s${i}`, start: i === 0, end: i === n - 1, next: i === n - 1 ? [] : [`s${i + 1}`] })));
  const t = Date.now();
  const l = layoutJourney(chain);
  assert.equal(l.cols, n);
  assert.equal(l.nodes.get("s1999")!.col, 1999);
  const wide = make(Array.from({ length: 120 }, (_, i) => ({ id: `w${i}`, start: i === 0, end: i > 60, next: i < 60 ? [`w${i + 1}`, `w${i + 61}`] : [] })));
  const w = layoutJourney(wide);
  assert.equal(w.nodes.size, 120);
  assert.ok(Date.now() - t < 1500, `took ${Date.now() - t} ms`);
});

test("the layout is the same every time", () => {
  const a = layoutJourney(example()), b = layoutJourney(example());
  assert.deepEqual([...a.nodes.values()], [...b.nodes.values()]);
  assert.deepEqual(a.edges, b.edges);
});

test("visibleTo: a step that names no user kind is for everyone", () => {
  const j = make([{ id: "a", access: ["guest"] }, { id: "b" }], undefined);
  const [a, b] = j.steps;
  assert.equal(visibleTo(a, ""), true, "no filter shows everything");
  assert.equal(visibleTo(a, "guest"), true);
  assert.equal(visibleTo(a, "member"), false);
  assert.equal(visibleTo(b, "member"), true);
});

test("wrapWords cuts at word ends, shortens the last line and cuts a very long word", () => {
  assert.deepEqual(wrapWords("Upload CV", 22, 2), ["Upload CV"]);
  assert.deepEqual(wrapWords("A friend opens the shared album link", 14, 2), ["A friend opens", "the shared…"]);
  const long = wrapWords("Choose the photographs you want in the album and press the button", 16, 2);
  assert.equal(long.length, 2);
  assert.ok(long[1].endsWith("…") && long.every((s) => s.length <= 16));
  assert.deepEqual(wrapWords("Supercalifragilisticexpialidocious", 10, 2), ["Supercalif", "ragilisti…"]);
  assert.deepEqual(wrapWords("   ", 10, 2), []);
});

test("a menu that links to many steps is a hub: its lines are not drawn, and the steps it opens stand just right of it", () => {
  const targets = Array.from({ length: 12 }, (_, i) => `t${i}`);
  const j = make([
    { id: "menu", start: true, next: targets },
    ...targets.map((id) => ({ id, buttons: [{ label: "Menu", to: "menu" }], end: true })),
  ]);
  const l = layoutJourney(j);
  assert.ok(l.edges.every((e) => e.hub), "every line of the menu is a hub line");
  assert.equal(l.hidden.get("menu"), 24);
  for (const id of targets) assert.equal(l.nodes.get(id)!.col, 1, "a step only the menu leads to is in the column right of it");
  assert.equal(l.nodes.get("menu")!.col, 0, "the lines back to the menu do not push it to the right");
});

test("a step that something else leads to keeps its place on the real way, whatever the menu says", () => {
  const targets = Array.from({ length: 10 }, (_, i) => `t${i}`);
  const j = make([
    { id: "menu", start: true, next: ["a", ...targets] },
    { id: "a", next: ["b"] }, { id: "b", next: ["c"] }, { id: "c", next: ["t0"] },
    ...targets.map((id) => ({ id, end: true })),
  ]);
  const l = layoutJourney(j);
  assert.equal(l.nodes.get("t0")!.col, 4, "t0 is reached through a, b, c: that counts, not the menu line");
  assert.equal(l.nodes.get("t1")!.col, 1);
});

test("a journey with few links per step has no hub", () => {
  const l = layoutJourney(example());
  assert.ok(l.edges.every((e) => !e.hub));
  assert.equal(l.hidden.size, 0);
});

test("a tall stack goes into columns beside each other, and no box covers another", () => {
  const targets = Array.from({ length: 20 }, (_, i) => `t${i}`);
  const j = make([{ id: "a", start: true, next: targets.slice(0, 4) }, ...targets.map((id, i) => ({ id, end: true, ...(i < 4 ? {} : { lane: "app" }) }))]);
  const l = layoutJourney(j);
  assert.ok(l.lanes[1].slots <= MAX_STACK, `the lane has ${l.lanes[1].slots} rows`);
  const boxes = [...l.nodes.values()];
  for (const a of boxes) for (const b of boxes) if (a.id < b.id) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} and ${b.id} overlap`);
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  assert.equal(l.width, right + BOX.padX, "the picture is as wide as its last box");
});

test("stepsFor: a kind of user meets its screens and the server work behind them, not another kind's", () => {
  const j = make([
    { id: "start", start: true, access: ["student"], next: ["page"] },
    { id: "page", access: ["student"], next: ["save"] }, { id: "save", next: ["done"] }, { id: "done", end: true, access: ["student"] },
    { id: "admin-page", access: ["admin"], next: ["admin-save"] }, { id: "admin-save", end: true },
    { id: "shared", start: true, end: true },
  ]);
  assert.deepEqual(stepsFor(j, "student").map((s) => s.id), ["start", "page", "save", "done", "shared"]);
  assert.deepEqual(stepsFor(j, "admin").map((s) => s.id), ["admin-page", "admin-save", "shared"]);
  assert.equal(stepsFor(j, "").length, j.steps.length, "no kind picked: every step");
});

test("the note under a hub counts its own lines only", () => {
  const targets = Array.from({ length: 12 }, (_, i) => `t${i}`);
  const l = layoutJourney(make([{ id: "menu", start: true, next: targets }, ...targets.map((id) => ({ id, end: true }))]));
  assert.equal(l.hidden.get("menu"), 12);
  assert.equal(l.hidden.get("t0"), undefined);
});

test("the room after a column grows with the words on the lines that cross it, up to a limit", () => {
  const room = (label: string) => {
    const l = layoutJourney(make([{ id: "a", start: true, next: [{ to: "b", label }] }, { id: "b", end: true }]));
    return l.nodes.get("b")!.x - (l.nodes.get("a")!.x + BOX.w);
  };
  assert.equal(room(""), BOX.gapX, "a line with no words keeps the usual room");
  assert.ok(room("Forgot password") > BOX.gapX, "words need more room than the usual gap");
  assert.ok(room("Forgot password") >= 15 * 6.6, "the room is at least as wide as the words");
  assert.equal(room("x".repeat(60)), MAX_GAP, "a very long text is cut at the limit");
});

test("layerView: a layer holds its own steps and a doorway for each step of another layer a line joins to it", () => {
  const j = parseJourney("```journey\n" + JSON.stringify({
    layers: [{ id: "main", name: "Main" }, { id: "admin", name: "Admin" }],
    steps: [
      { id: "home", name: "Home", lane: "app", actor: "system", layer: "main", start: true, buttons: [{ label: "Admin", to: "panel" }, { label: "Report", to: "report" }], kind: "screen" },
      { id: "report", name: "Report", lane: "app", actor: "system", layer: "main", next: ["data"], kind: "screen" },
      { id: "panel", name: "Panel", lane: "app", actor: "system", layer: "admin", kind: "screen", buttons: [{ label: "Back", to: "home" }, { label: "People", to: "people" }] },
      { id: "people", name: "People", lane: "app", actor: "system", layer: "admin", next: ["data"] },
      { id: "data", name: "Data", lane: "server", actor: "system", end: true },
    ],
  }) + "\n```\n").journey!;
  const main = layerView(j, "main");
  assert.deepEqual(main.journey.steps.map((s) => s.id).sort(), ["data", "home", "panel", "report"], "own steps, the shared step a line reaches, and the doorway");
  assert.deepEqual([...main.doorways.entries()], [["panel", "Admin"]], "only a step of another layer is a doorway, named by its layer");
  const panel = main.journey.steps.find((s) => s.id === "panel")!;
  assert.deepEqual(panel.buttons.map((b) => b.to), ["home"], "a doorway keeps only its lines into this layer");
  assert.equal(panel.kind, "step");
  const admin = layerView(j, "admin");
  assert.deepEqual(admin.journey.steps.map((s) => s.id).sort(), ["data", "home", "panel", "people"]);
  assert.deepEqual([...admin.doorways.keys()], ["home"]);
  const everything = layerView(j, "");
  assert.equal(everything.journey, j, "no layer picked: the journey as it is");
  assert.equal(everything.doorways.size, 0);
  assert.equal(layerView(parseJourney("```journey\n{\"steps\":[]}\n```").journey!, "main").doorways.size, 0, "a journey with no layers is not cut");
});

test("the table has a Layer column when the journey has layers", () => {
  const j = parseJourney("```journey\n" + JSON.stringify({ layers: [{ id: "main", name: "Main" }], steps: [{ id: "a", name: "A", lane: "app", actor: "system", layer: "main", start: true, end: true }, { id: "b", name: "B", lane: "app", actor: "system", start: true, end: true }] }) + "\n```\n").journey!;
  const t = journeyTable(j);
  assert.deepEqual(t.head.slice(0, 3), ["Step", "Lane", "Layer"]);
  assert.deepEqual(t.rows.map((r) => r[2]), ["Main", "Shared"]);
  assert.ok(!journeyTable({ ...j, layers: [] }).head.includes("Layer"));
});
