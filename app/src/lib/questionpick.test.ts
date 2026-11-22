import { test } from "node:test";
import assert from "node:assert/strict";
import { noPicks, pick, valueOf, write } from "./questionpick.ts";

const one = { question: "Which colour?", multiSelect: false };
const many = { question: "Which days?", multiSelect: true };

test("clicking an option answers a one-answer question, and clicking it again takes the answer back", () => {
  const a = pick(noPicks, one, "Red");
  assert.equal(valueOf(a, one), "Red");
  assert.equal(valueOf(pick(a, one, "Red"), one), "");
  assert.equal(valueOf(pick(a, one, "Blue"), one), "Blue", "a second option replaces the first");
});

test("typing in Other un-clicks the option of a one-answer question, and the text is the answer", () => {
  const a = write(pick(noPicks, one, "Red"), one, "Green");
  assert.deepEqual(a.picked[one.question], []);
  assert.equal(valueOf(a, one), "Green");
});

test("clicking an option after typing in Other empties the box (one answer only)", () => {
  const a = pick(write(noPicks, one, "Green"), one, "Blue");
  assert.equal(a.other[one.question], "");
  assert.equal(valueOf(a, one), "Blue");
});

test("an empty box, or spaces, does not un-click anything", () => {
  const a = pick(noPicks, one, "Red");
  assert.equal(valueOf(write(a, one, ""), one), "Red");
  assert.equal(valueOf(write(a, one, "   "), one), "Red");
});

test("a several-answer question keeps its clicked options while the owner types, and adds the text", () => {
  let a = pick(pick(noPicks, many, "Mon"), many, "Tue");
  a = write(a, many, "and Friday");
  assert.equal(valueOf(a, many), "Mon, Tue, and Friday");
  assert.equal(valueOf(pick(a, many, "Mon"), many), "Tue, and Friday", "clicking a picked option takes it back");
});

test("one question does not touch the answers of another", () => {
  const a = write(pick(noPicks, many, "Mon"), one, "Green");
  assert.equal(valueOf(a, many), "Mon");
  assert.equal(valueOf(a, one), "Green");
});
