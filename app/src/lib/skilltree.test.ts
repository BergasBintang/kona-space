import { test } from "node:test";
import assert from "node:assert/strict";
import { addBranch, branchOf, changeBranch, moveSkill, nameProblem, removeBranch, treeOf, type Branch } from "./skilltree.ts";

const b = (name: string, skills: string[] = [], when = ""): Branch => ({ name, when, skills });

test("a skill under no branch is loose, in the order of the person's list, and a skill is listed under one branch only", () => {
  const t = treeOf(["a", "b", "c", "d"], [b("One", ["b", "ghost"]), b("Two", ["b", "d"])]);
  assert.deepEqual(t.branches.map((x) => x.skills), [["b"], ["d"]], "a skill the person lacks is left out, and the second place of a skill is ignored");
  assert.deepEqual(t.loose, ["a", "c"]);
});

test("moving a skill takes it out of the branch it was in, and null puts it under none", () => {
  const start = [b("One", ["a", "b"]), b("Two")];
  assert.deepEqual(moveSkill(start, "a", 1).map((x) => x.skills), [["b"], ["a"]]);
  assert.deepEqual(moveSkill(moveSkill(start, "a", 1), "a", null).map((x) => x.skills), [["b"], []]);
  assert.deepEqual(moveSkill(start, "a", 0).map((x) => x.skills), [["b", "a"], []], "moving into the same branch puts it last, never twice");
  assert.equal(branchOf(start, "b"), 0);
  assert.equal(branchOf(start, "zzz"), null);
});

test("a new branch gets a name no other has, and taking a branch away leaves its skills with the person", () => {
  let list = addBranch([]);
  list = addBranch(list); list = addBranch(list);
  assert.deepEqual(list.map((x) => x.name), ["New branch", "New branch 2", "New branch 3"]);
  list = removeBranch(changeBranch(list, 1, { name: "Shipping" }), 0);
  assert.equal(addBranch(list).at(-1)!.name, "New branch", "a freed name can be used again");
  const kept = removeBranch([b("One", ["a"])], 0);
  assert.deepEqual(treeOf(["a"], kept), { branches: [], loose: ["a"] });
});

test("a branch name must say something, fit, and be its own", () => {
  const list = [b("Shipping"), b("shipping"), b(" "), b("x".repeat(41)), b("Fine")];
  assert.match(nameProblem(list, 1)!, /Two branches/);
  assert.match(nameProblem(list, 2)!, /name/);
  assert.match(nameProblem(list, 3)!, /40/);
  assert.equal(nameProblem(list, 4), null);
});
