import { test } from "node:test";
import assert from "node:assert/strict";
import { changedSince, stamp } from "./seen.ts";

test("a file is changed only if it was opened before and is newer now", () => {
  const seen = stamp({}, "a.md", 100);
  assert.equal(changedSince(seen, "a.md", 100), false);
  assert.equal(changedSince(seen, "a.md", 101), true);
  assert.equal(changedSince(seen, "b.md", 500), false, "never opened, so nothing to compare");
  assert.equal(changedSince(seen, "a.md", null), false);
});

test("stamping again moves the file to the newest place, and the oldest are forgotten past the cap", () => {
  let seen = stamp({}, "a", 1, 3);
  seen = stamp(seen, "b", 2, 3); seen = stamp(seen, "c", 3, 3);
  seen = stamp(seen, "a", 4, 3);
  assert.deepEqual(Object.keys(seen), ["b", "c", "a"]);
  seen = stamp(seen, "d", 5, 3);
  assert.deepEqual(Object.keys(seen), ["c", "a", "d"]);
  assert.equal(seen.a, 4);
});
