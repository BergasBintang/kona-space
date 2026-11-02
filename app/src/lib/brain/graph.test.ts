import { test } from "node:test";
import assert from "node:assert/strict";
import { describe, layoutGraph, parseGraph, type Graph } from "./graph.ts";

const ok = (src: string): Graph => { const r = parseGraph(src); assert.ok(r.ok, r.ok ? "" : r.error); return r.graph; };
const err = (src: string) => { const r = parseGraph(src); assert.ok(!r.ok, "should not parse"); return r.ok ? "" : r.error; };

test("a flowchart reads its boxes, shapes, words on arrows and the way it runs", () => {
  const g = ok(`flowchart LR
    A[Owner asks] --> B{Clear enough?}
    B -->|yes| C([Start the work])
    B -- no --> D(Ask again)
    D -.-> A
    C ==> E((Done))`);
  assert.equal(g.dir, "LR");
  assert.deepEqual(g.nodes.map((n) => [n.id, n.label, n.shape]), [["A", "Owner asks", "box"], ["B", "Clear enough?", "diamond"], ["C", "Start the work", "stadium"], ["D", "Ask again", "round"], ["E", "Done", "circle"]]);
  assert.deepEqual(g.edges.map((e) => [e.from, e.to, e.label, e.line, e.arrow]), [["A", "B", "", "solid", "end"], ["B", "C", "yes", "solid", "end"], ["B", "D", "no", "solid", "end"], ["D", "A", "", "dotted", "end"], ["C", "E", "", "thick", "end"]]);
});

test("chains, several boxes joined by &, quotes and semicolons all read as written", () => {
  const g = ok(`graph TD; A-->B-->C; X & Y --> Z; Q["Save (draft); then send"] --- R`);
  assert.equal(g.dir, "TB");
  assert.deepEqual(g.edges.map((e) => `${e.from}${e.to}`), ["AB", "BC", "XZ", "YZ", "QR"]);
  assert.equal(g.nodes.find((n) => n.id === "Q")!.label, "Save (draft); then send");
  assert.equal(g.edges.at(-1)!.arrow, "none");
});

test("styling lines and subgraph frames are skipped, the boxes inside still count", () => {
  const g = ok(`flowchart TD
    %% a comment
    subgraph one [First part]
      A --> B
    end
    classDef hot fill:#f96
    class A hot
    style B stroke:#333
    B:::hot --> C`);
  assert.deepEqual(g.nodes.map((n) => n.id), ["A", "B", "C"]);
  assert.equal(g.edges.length, 2);
});

test("a diagram that cannot be drawn says why, in words that name the line", () => {
  assert.match(err("sequenceDiagram\n A->>B: hi"), /flowchart TD/);
  assert.match(err("flowchart TD\n A[Open --> B"), /not closed/);
  assert.match(err("flowchart TD\n A -->"), /points at nothing/);
  assert.match(err("flowchart TD\n A --> B oops"), /left over/);
  assert.match(err("flowchart TD"), /no boxes/);
  assert.match(err(""), /empty/);
  assert.match(err(`flowchart TD\n${Array.from({ length: 70 }, (_, i) => `N${i} --> N${i + 1}`).join("\n")}`), /split it/);
});

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

test("the layout puts each box after the ones that point at it and never lets two boxes overlap", () => {
  const g = ok("flowchart TD\n A --> B\n A --> C\n B --> D\n C --> D\n A --> D\n D --> E");
  const l = layoutGraph(g);
  const at = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
  assert.ok(at.A.y < at.B.y && at.B.y < at.D.y && at.D.y < at.E.y);
  assert.equal(at.B.y, at.C.y);
  for (let i = 0; i < l.nodes.length; i++) for (let j = i + 1; j < l.nodes.length; j++) assert.ok(!overlap(l.nodes[i], l.nodes[j]), `${l.nodes[i].id} and ${l.nodes[j].id} overlap`);
  for (const n of l.nodes) assert.ok(n.x - n.w / 2 >= 0 && n.y - n.h / 2 >= 0 && n.x + n.w / 2 <= l.width && n.y + n.h / 2 <= l.height, `${n.id} is inside the picture`);
  assert.equal(l.edges.length, 6);
  assert.ok(l.edges.every((e) => /^M [\d.]+ [\d.]+( C [-\d. ]+)+$/.test(e.path)), "every arrow is a path");
});

test("left to right runs along x, and the opposite directions mirror it", () => {
  const src = "A --> B --> C";
  const lr = layoutGraph(ok(`flowchart LR\n${src}`)).nodes, rl = layoutGraph(ok(`flowchart RL\n${src}`)).nodes, bt = layoutGraph(ok(`flowchart BT\n${src}`)).nodes;
  assert.ok(lr[0].x < lr[1].x && lr[1].x < lr[2].x && lr[0].y === lr[2].y);
  assert.ok(rl[0].x > rl[1].x && rl[1].x > rl[2].x);
  assert.ok(bt[0].y > bt[1].y && bt[1].y > bt[2].y);
});

test("a cycle and a box pointing at itself still draw, and the arrow keeps pointing the way it was written", () => {
  const l = layoutGraph(ok("flowchart TD\n A --> B\n B --> C\n C --> A\n C --> C"));
  assert.equal(l.nodes.length, 3);
  assert.equal(l.edges.length, 4);
  const back = l.edges.find((e) => e.from === "C" && e.to === "A")!;
  const A = l.nodes.find((n) => n.id === "A")!, C = l.nodes.find((n) => n.id === "C")!;
  const nums = back.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  assert.ok(Math.abs(nums[1] - C.y) < C.h, "starts at C");
  assert.ok(Math.abs(nums.at(-1)! - A.y) < A.h, "ends at A");
});

test("an arrow that skips a row goes around the boxes in between", () => {
  const l = layoutGraph(ok("flowchart TD\n A --> B --> C\n A --> C"));
  const long = l.edges.find((e) => e.from === "A" && e.to === "C")!;
  assert.equal((long.path.match(/C/g) ?? []).length, 2, "two curves, through a stand-in point");
});

test("the plain-words summary names the boxes and the arrows", () => {
  const s = describe(ok("flowchart TD\n A[Ask] -->|ok| B[Build]"));
  assert.equal(s, "Diagram of 2 boxes. Ask to Build (ok)");
});
