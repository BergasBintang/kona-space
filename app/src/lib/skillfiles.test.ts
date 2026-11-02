import { test } from "node:test";
import assert from "node:assert/strict";
import { addLine, composeSkill, descriptionLine, newPath, pathProblem, renameIn, unmentioned } from "./skillfiles.ts";

test("a new file gets a path of its kind that no other file has", () => {
  assert.equal(newPath("templates", []), "templates/template.md");
  assert.equal(newPath("templates", ["templates/template.md"]), "templates/template-2.md");
  assert.equal(newPath("references", ["references/CHECKLIST.md", "references/checklist-2.md"]), "references/checklist-3.md");
  assert.equal(newPath("scripts", []), "scripts/script.js");
});

test("a path stays inside the skill and is one the disk can hold", () => {
  for (const ok of ["templates/brief.md", "notes.md", "references/a_b-c.1.md", "a/b/c/d.md"]) assert.equal(pathProblem(ok, []), null, ok);
  for (const bad of ["", "  ", "../evil.md", "a/../../evil.md", "/abs.md", "C:/x.md", "a\\b.md", ".hidden", "a/.git/x", "name.", "con.md", "a b.md", "a/b/c/d/e.md", "SKILL.md", "skill.md"]) assert.notEqual(pathProblem(bad, []), null, bad);
  assert.match(pathProblem("templates/A.md", ["templates/a.md"])!, /Another/);
});

test("the main text points at the files, and follows a rename", () => {
  const main = "1. Fill in `templates/a.md`.";
  assert.deepEqual(unmentioned(main, ["templates/a.md", "references/b.md"]), ["references/b.md"]);
  assert.equal(renameIn(main, "templates/a.md", "templates/form.md"), "1. Fill in `templates/form.md`.");
  assert.equal(addLine("Steps.\n\n", "Next."), "Steps.\n\nNext.\n");
});

test("a description that would break the top of the file is quoted", () => {
  assert.equal(descriptionLine("Use when  shipping"), "Use when shipping");
  assert.equal(descriptionLine("Use when shipping: tests pass"), '"Use when shipping: tests pass"');
  assert.equal(descriptionLine('Say "hello": now'), `"Say 'hello': now"`);
  assert.equal(composeSkill("my-skill", "Use when x.", "  1. Do.  "), "---\nname: my-skill\ndescription: Use when x.\n---\n\n1. Do.\n");
});
