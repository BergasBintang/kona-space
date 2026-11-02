import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCallout } from "./callout.ts";

test("both ways of writing a callout are read, with the words that follow", () => {
  assert.deepEqual(parseCallout(["[!WARNING]", "Do not run this.", "", "Ask first."]), { kind: "warning", paragraphs: ["Do not run this.", "Ask first."] });
  assert.deepEqual(parseCallout(["**Note:** a short one", "continued"]), { kind: "note", paragraphs: ["a short one continued"] });
  assert.deepEqual(parseCallout(["**Tip**: try it"]), { kind: "tip", paragraphs: ["try it"] });
  assert.deepEqual(parseCallout(["[!caution] careful"]), { kind: "caution", paragraphs: ["careful"] });
  assert.deepEqual(parseCallout(["[!NOTE]"]), { kind: "note", paragraphs: [] });
});

test("an ordinary quote is not a callout", () => {
  assert.equal(parseCallout(["Notes are nice"]), null);
  assert.equal(parseCallout(["**Notebook** is bold"]), null);
  assert.equal(parseCallout(["", ""]), null);
});
