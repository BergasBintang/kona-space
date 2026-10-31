import { test } from "node:test";
import assert from "node:assert/strict";
import { Typed } from "./unsaved.ts";

test("text typed and not yet taken is unsaved", () => {
  const t = new Typed(), box = { value: "Fix the login" };
  t.typed(box);
  assert.equal(t.unsaved([box]), true);
});

test("a button or Enter after the typing takes the text", () => {
  const t = new Typed(), box = { value: "Fix the login" };
  t.typed(box);
  t.acted();
  assert.equal(t.unsaved([box]), false);
});

test("typing again after an action is unsaved again", () => {
  const t = new Typed(), box = { value: "one" };
  t.typed(box); t.acted();
  box.value = "one two"; t.typed(box);
  assert.equal(t.unsaved([box]), true);
});

test("an emptied field, a field nobody typed in and a blank field are not unsaved", () => {
  const t = new Typed(), sent = { value: "" }, saved = { value: "github.com/someone/repo" }, blank = { value: "   " };
  t.typed(sent); t.typed(blank);
  assert.equal(t.unsaved([sent, saved, blank]), false);
});

test("one unsaved field among saved ones is enough", () => {
  const t = new Typed(), a = { value: "saved" }, b = { value: "draft" };
  t.typed(a); t.acted(); t.typed(b);
  assert.equal(t.unsaved([a, b]), true);
});
