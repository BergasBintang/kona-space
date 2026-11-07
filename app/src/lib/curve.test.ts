import { test } from "node:test";
import assert from "node:assert/strict";
import { smoothPath } from "./curve.ts";

/** every y the path reaches, read from its Bezier pieces (sampled) */
function reach(d: string): number[] {
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const ys: number[] = [];
  let [px, py] = [nums[0], nums[1]];
  for (let i = 2; i < nums.length; i += 6) {
    const [x1, y1, x2, y2, x, y] = nums.slice(i, i + 6); void x1; void x2; void px;
    for (let s = 0; s <= 20; s++) { const u = s / 20, v = 1 - u; ys.push(v * v * v * py + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y); }
    [px, py] = [x, y];
  }
  return ys;
}

test("no points, one point and two points", () => {
  assert.equal(smoothPath([]), "");
  assert.equal(smoothPath([[5, 7]]), "M5 7");
  assert.match(smoothPath([[0, 0], [10, 10]]), /^M0 0 C[\d. ]+ 10 10$/);
});

test("a path has a curve piece between each pair of points", () => {
  const d = smoothPath([[0, 90], [10, 90], [20, 20], [30, 60], [40, 90]]);
  assert.equal((d.match(/C/g) ?? []).length, 4);
  assert.ok(d.startsWith("M0 90"));
});

test("the line never goes below the floor or above the highest point (no overshoot)", () => {
  // screen y runs down: 90 is the floor (nothing spent), 20 is the spike
  const ys = reach(smoothPath([[0, 90], [10, 90], [20, 90], [30, 20], [40, 90], [50, 90], [60, 70], [70, 90]]));
  assert.ok(Math.max(...ys) <= 90.001, `dips below the floor: ${Math.max(...ys)}`);
  assert.ok(Math.min(...ys) >= 20 - 0.001, `rises above the spike: ${Math.min(...ys)}`);
});

test("a flat stretch stays flat", () => {
  const ys = reach(smoothPath([[0, 90], [10, 90], [20, 90], [30, 90]]));
  assert.ok(ys.every((y) => Math.abs(y - 90) < 0.001));
});
