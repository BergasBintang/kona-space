import { test } from "node:test";
import assert from "node:assert/strict";
import { isRested, kilo, memoryOf, REST_MS } from "./memory.ts";

test("the memory says nothing while it is small, and gets two words after 100,000 and 250,000 tokens", () => {
  assert.equal(memoryOf(undefined), null);
  assert.equal(memoryOf(0), null);
  assert.equal(memoryOf(99_999), null);
  assert.deepEqual(memoryOf(100_000), { state: "waiting", word: "getting long" });
  assert.deepEqual(memoryOf(249_999), { state: "waiting", word: "getting long" });
  assert.deepEqual(memoryOf(250_000), { state: "left", word: "long" });
});

test("the cache is cold an hour after the last step, not before, and never for a conversation nothing has happened in yet", () => {
  const t = 1_000_000_000_000;
  assert.equal(isRested(t, t + REST_MS - 1), false);
  assert.equal(isRested(t, t + REST_MS), true);
  assert.equal(isRested(undefined, t), false);
  assert.equal(isRested(0, t), false);
});

test("tokens are written in thousands", () => {
  assert.equal(kilo(244_610), "245k");
  assert.equal(kilo(950), "950");
});
