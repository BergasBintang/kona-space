import { test } from "node:test";
import assert from "node:assert/strict";
import { describeSequence, layoutSequence, parseSequence } from "./sequence.ts";
import { describe, diagramKind, layoutGraph, parseState } from "./graph.ts";

const seq = (src: string) => { const r = parseSequence(src); assert.ok(r.ok, r.ok ? "" : r.error); return r.seq; };

test("a sequence reads its participants, aliases, messages, notes and frames in order", () => {
  const s = seq(`sequenceDiagram
    autonumber
    actor U as Owner
    participant K as Kona
    U->>K: Ask for a note
    K-->>U: Here it is<br/>saved
    Note over U,K: both agree
    loop every minute
      K-)K: poll
    end
    K-xU: gone`);
  assert.deepEqual(s.parts.map((p) => [p.id, p.label, p.actor]), [["U", "Owner", true], ["K", "Kona", false]]);
  assert.equal(s.numbered, true);
  assert.deepEqual(s.items.map((i) => i.kind), ["msg", "msg", "note", "band", "msg", "msg"]);
  const m = s.items[1] as { dotted: boolean; head: string; text: string };
  assert.deepEqual([m.dotted, m.head, m.text], [true, "filled", "Here it is\nsaved"]);
  assert.equal((s.items[5] as { head: string }).head, "cross");
});

test("a participant that is only mentioned is added, and a line that is nothing says which one", () => {
  assert.deepEqual(seq("sequenceDiagram\n A->B: hi").parts.map((p) => p.id), ["A", "B"]);
  const bad = parseSequence("sequenceDiagram\n A->B: ok\n what is this");
  assert.ok(!bad.ok && /Line 3/.test(bad.error));
  assert.ok(!parseSequence("sequenceDiagram").ok);
});

test("the layout keeps the columns in order, opens the gap for a long message and keeps everything inside the picture", () => {
  const s = seq("sequenceDiagram\n A->>B: short\n B->>C: a message with quite a lot of words in it so the gap must open\n C->>C: to itself\n Note left of A: a left note");
  const l = layoutSequence(s);
  assert.ok(l.parts[0].x < l.parts[1].x && l.parts[1].x < l.parts[2].x);
  assert.ok(l.parts[2].x - l.parts[1].x >= 200, "the long message fits between B and C");
  const ys = l.rows.map((r) => r.y);
  assert.deepEqual(ys, [...ys].sort((a, b) => a - b), "steps run downward");
  for (const p of l.parts) assert.ok(p.x - p.w / 2 >= 0 && p.x + p.w / 2 <= l.width);
  for (const r of l.rows) if (r.kind === "note") assert.ok(r.x - r.w / 2 >= 0 && r.x + r.w / 2 <= l.width);
  assert.match(describeSequence(s), /A to B: short/);
});

test("a state diagram becomes boxes and arrows, with a start and an end", () => {
  const r = parseState(`stateDiagram-v2
    direction LR
    [*] --> Backlog
    Backlog --> Ready: clear enough
    Ready --> Review
    Review --> [*]
    state "In progress" as Doing
    Ready --> Doing
    Doing : someone is on it
    state pick <<choice>>
    Review --> pick
    pick --> Doing: changes
    note right of Doing: skipped
    state Parent {
      Doing --> Review
    }`);
  assert.ok(r.ok, r.ok ? "" : r.error);
  const g = r.graph;
  assert.equal(g.dir, "LR");
  assert.deepEqual(g.nodes.filter((n) => n.shape === "start" || n.shape === "end").map((n) => n.shape), ["start", "end"]);
  assert.equal(g.nodes.find((n) => n.id === "Doing")!.label, "In progress\nsomeone is on it");
  assert.equal(g.nodes.find((n) => n.id === "pick")!.shape, "diamond");
  assert.equal(g.edges.find((e) => e.from === "Backlog")!.label, "clear enough");
  const l = layoutGraph(g);
  assert.equal(l.nodes.length, g.nodes.length);
  assert.match(describe(g), /the start to Backlog/);
  assert.ok(!parseState("stateDiagram-v2\n A --> B\n nonsense here").ok);
});

test("the kind of a block is read from its first line", () => {
  assert.equal(diagramKind("%% c\nflowchart TD\nA-->B"), "flow");
  assert.equal(diagramKind("graph LR"), "flow");
  assert.equal(diagramKind("sequenceDiagram\n"), "sequence");
  assert.equal(diagramKind("stateDiagram-v2"), "state");
  assert.equal(diagramKind("gantt\n"), "gantt");
  assert.equal(diagramKind("  \n"), "empty");
});
