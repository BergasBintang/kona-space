import { test } from "node:test";
import assert from "node:assert/strict";
import { finishedByProject, lookOf, officeLooks, looksSignature, waitingByProject } from "./office.ts";
import type { RunState, State } from "./sessions.ts";

const project = { id: "p", name: "Norbit", folder: "D:\norbit" };
const session = (id: string, roleId: string, run: RunState, turns: number, folder = project.folder) => ({ id, roleId, run, turns, folder }) as never;
const stateOf = (...s: { id: string }[]): State => ({ sessions: Object.fromEntries(s.map((x) => [x.id, x])), order: s.map((x) => x.id), selected: null, plans: {} });

test("the bubble over a cat says Working, Questioning, Finish or Open, and nothing when the person has no chat", () => {
  assert.deepEqual([lookOf("qa", project, stateOf(session("a", "qa", "working", 0))).word, lookOf("qa", project, stateOf(session("a", "qa", "starting", 0))).word], ["Working", "Working"]);
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "waiting", 1))).word, "Questioning");
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ready", 2))).word, "Finish");
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ready", 0))).word, null, "a session with no turn yet is idle");
  assert.equal(lookOf("qa", project, stateOf()).word, null, "no session is idle");
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ended", 3))).word, null, "an ended session shows nothing");
});

test("Finish stays until the owner has seen the turns, then it becomes Open while the chat is open", () => {
  const st = stateOf(session("a", "qa", "ready", 2));
  assert.equal(lookOf("qa", project, st, { a: 1 }).word, "Finish", "one turn seen of two: still new");
  assert.equal(lookOf("qa", project, st, { a: 2 }).word, "Open", "all turns seen: the chat is still open, so a quiet mark stays");
  assert.equal(lookOf("qa", project, st, { a: 2 }).mode, "open");
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ready", 3)), { a: 2 }).word, "Finish", "a new turn brings it back");
});

test("the busiest session of a person counts, in this project only", () => {
  const st = stateOf(session("a", "qa", "ready", 2), session("b", "qa", "waiting", 1), session("c", "qa", "working", 0, "D:\other"));
  assert.equal(lookOf("qa", project, st).word, "Questioning");
  assert.equal(lookOf("qa", project, stateOf(session("c", "qa", "working", 0, "D:\other"))).word, null, "another project's session is not this project's");
  assert.equal(officeLooks(project, st).qa.word, "Questioning");
  assert.notEqual(looksSignature(st, {}), looksSignature(st, { a: 2 }), "seeing a turn changes the looks, so the office draws again");
});

test("Open goes when the chat has ended, and a chat with no turn has no mark", () => {
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ended", 2)), { a: 2 }).word, null);
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ready", 0)), {}).word, null);
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ready", 2)), { a: 2 }).glyph, "idle");
});

test("the welcome page counts the sessions waiting for the owner in each project", () => {
  const other = { id: "q", name: "Other", folder: "D:\other" };
  const st = stateOf(session("a", "qa", "waiting", 1), session("b", "design", "waiting", 1), session("c", "qa", "working", 0), session("d", "qa", "waiting", 1, other.folder));
  assert.deepEqual(waitingByProject([project, other], st), { p: 2, q: 1 });
  assert.deepEqual(waitingByProject([project], stateOf(session("a", "qa", "ready", 3))), {});
});

test("the welcome page counts finished turns the owner has not seen, in each project", () => {
  const other = { id: "q", name: "Other", folder: "D:\other" };
  const st = stateOf(session("a", "qa", "ready", 2), session("b", "design", "ready", 1), session("c", "qa", "working", 3), session("d", "qa", "ready", 4, other.folder), session("e", "qa", "ready", 0, other.folder));
  assert.deepEqual(finishedByProject([project, other], st), { p: 2, q: 1 });
  assert.deepEqual(finishedByProject([project, other], st, { a: 2, b: 1 }), { q: 1 }, "seen turns are not counted");
  assert.deepEqual(finishedByProject([project], stateOf(session("a", "qa", "ended", 3))), {});
});
