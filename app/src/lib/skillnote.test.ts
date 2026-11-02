import { test } from "node:test";
import assert from "node:assert/strict";
import { draftNote } from "./skillnote.ts";

test("the first note of a skill is the first sentence of its description", () => {
  assert.equal(draftNote("Use when the idea is vague. It asks questions. It writes a plan."), "Use when the idea is vague.");
  assert.equal(draftNote("  Explore   ideas\nbefore building  "), "Explore ideas before building");
  assert.equal(draftNote(""), "");
});

test("a long first sentence is cut at 200 letters and the note stays within what the core accepts (300)", () => {
  const long = "Use this when " + "a very long thing ".repeat(40);
  const n = draftNote(long);
  assert.ok(n.length <= 200 && n.endsWith("..."));
});
