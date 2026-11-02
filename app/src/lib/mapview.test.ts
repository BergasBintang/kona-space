import { test } from "node:test";
import assert from "node:assert/strict";
import { clampCenter, fitScale, origin, pinchBoost, stepScale, wheelPan, wheelZoom, zoomAround } from "./mapview.ts";

const content: [number, number, number, number] = [12, 8, 837, 422];

test("the fitting zoom is a whole number and does not depend on the percent view", () => {
  // the same window is 1800 CSS pixels wide at 100 percent and 2250 at 80 percent, with the screen pixels (dpr) 1 and 0.8
  assert.equal(fitScale(1800, 900, 1, content), 2);
  assert.equal(fitScale(2250, 1125, 0.8, content), 2);
  assert.equal(fitScale(100, 100, 1, content), 1);
});

test("a step goes up and down the list and stops at its ends", () => {
  assert.equal(stepScale(2, 1), 3);
  assert.equal(stepScale(2, -1), 1);
  assert.equal(stepScale(1, -1), 1);
  assert.equal(stepScale(10, 1), 10);
  assert.equal(stepScale(7, 1), 8); // a value between two steps counts as the one below it
});

test("the centre stays inside the drawing", () => {
  assert.deepEqual(clampCenter({ x: -500, y: 9000 }, content), { x: 12, y: 422 });
  assert.deepEqual(clampCenter({ x: 200, y: 200 }, content), { x: 200, y: 200 });
});

test("the wheel moves up and down, Shift moves left and right, two fingers on a touchpad move both ways, a pinch counts for more than a notch", () => {
  assert.deepEqual(wheelPan(0, 100, false, 2), { x: 0, y: 50 });
  assert.deepEqual(wheelPan(40, -20, false, 2), { x: 20, y: -10 }, "two fingers sliding sideways and up move the map sideways and up");
  assert.equal(pinchBoost(100), 100, "a notch of a mouse wheel stays one notch");
  assert.equal(pinchBoost(-5), -20, "a small pinch delta is made bigger");
  assert.deepEqual(wheelPan(0, 100, true, 2), { x: 50, y: 0 });
  assert.deepEqual(wheelPan(60, 0, true, 3), { x: 20, y: 0 });
});

test("the drawing sits on a whole screen pixel", () => {
  const o = origin(1001, 424, 2 / 1.25, 1.25);
  assert.ok(Math.abs(o * 1.25 - Math.round(o * 1.25)) < 1e-9);
});

test("the wheel with Ctrl zooms a step for each notch, up is in, and a touchpad's small turns add up", () => {
  assert.deepEqual(wheelZoom(0, -100), { steps: 1, carry: -40 });
  assert.deepEqual(wheelZoom(0, 100), { steps: -1, carry: 40 });
  let carry = 0, total = 0;
  for (let i = 0; i < 12; i++) { const r = wheelZoom(carry, -10); carry = r.carry; total += r.steps; }
  assert.equal(total, 2, "twelve turns of 10 are two steps");
  assert.deepEqual(wheelZoom(0, -20), { steps: 0, carry: -20 });
});

test("zooming round the pointer keeps the point under it where it was", () => {
  const c = { x: 400, y: 300 }, off = { x: 200, y: -100 }, k = 1, k2 = 2;
  const n = zoomAround(c, off, k, k2);
  assert.equal(c.x + off.x / k, n.x + off.x / k2);
  assert.equal(c.y + off.y / k, n.y + off.y / k2);
  assert.deepEqual(zoomAround(c, { x: 0, y: 0 }, 1, 3), c, "in the middle of the window nothing moves");
});
