import { test } from "node:test";
import assert from "node:assert/strict";
import { lookOf, officeLooks, looksSignature } from "./office.ts";
import type { RunState, State } from "./sessions.ts";

const project = { id: "p", name: "Norbit", folder: "D:\norbit" };
const session = (id: string, roleId: string, run: RunState, turns: number, folder = project.folder) => ({ id, roleId, run, turns, folder }) as never;
const stateOf = (...s: { id: string }[]): State => ({ sessions: Object.fromEntries(s.map((x) => [x.id, x])), order: s.map((x) => x.id), selected: null, plans: {} });

test("the bubble over a cat says Working, Questioning or Finish, and nothing when the person is idle", () => {
  assert.deepEqual([lookOf("qa", project, stateOf(session("a", "qa", "working", 0))).word, lookOf("qa", project, stateOf(session("a", "qa", "starting", 0))).word], ["Working", "Working"]);
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "waiting", 1))).word, "Questioning");
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ready", 2))).word, "Finish");
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ready", 0))).word, null, "a session with no turn yet is idle");
  assert.equal(lookOf("qa", project, stateOf()).word, null, "no session is idle");
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ended", 3))).word, null, "an ended session shows nothing");
});

test("Finish stays until the owner has seen the turns, then the bubble goes", () => {
  const st = stateOf(session("a", "qa", "ready", 2));
  assert.equal(lookOf("qa", project, st, { a: 1 }).word, "Finish", "one turn seen of two: still new");
  assert.equal(lookOf("qa", project, st, { a: 2 }).word, null, "all turns seen");
  assert.equal(lookOf("qa", project, stateOf(session("a", "qa", "ready", 3)), { a: 2 }).word, "Finish", "a new turn brings it back");
});

test("the busiest session of a person counts, in this project only", () => {
  const st = stateOf(session("a", "qa", "ready", 2), session("b", "qa", "waiting", 1), session("c", "qa", "working", 0, "D:\other"));
  assert.equal(lookOf("qa", project, st).word, "Questioning");
  assert.equal(lookOf("qa", project, stateOf(session("c", "qa", "working", 0, "D:\other"))).word, null, "another project's session is not this project's");
  assert.equal(officeLooks(project, st).qa.word, "Questioning");
  assert.notEqual(looksSignature(st, {}), looksSignature(st, { a: 2 }), "seeing a turn changes the looks, so the office draws again");
});
