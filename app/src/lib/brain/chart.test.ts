// Charts in notes: reading a ```chart block and every calculation behind a chart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHART_HEX, KINDS, arcPath, barPath, boxStats, buildChart, contrast, fmtNum, histogram, inferUnit, inkOn, niceTicks, pareto, parseNum, pieSlices, smoothPath, squarify, stackLayout, sunburst, tableText,
  waterfall, type Chart,
} from "./chart.ts";

const T = "| Name | A | B |\n|---|---|---|\n| x | 1 | 4 |\n| y | 2 | 5 |\n| z | 3 | 6 |";
const read = (head: string, table = T) => buildChart(head + "\n" + table);
const ok = (head: string, table = T): Chart => { const r = read(head, table); assert.ok(!("error" in r), "error" in r ? r.error : ""); return r as Chart; };
const bad = (head: string, table = T): string => { const r = read(head, table); assert.ok("error" in r, "should not be drawable"); return (r as { error: string }).error; };

test("parseNum: commas, currency, percent, k m b, a minus sign, and what is not a number", () => {
  assert.equal(parseNum("1,234"), 1234);
  assert.equal(parseNum("1,234.5"), 1234.5);
  assert.equal(parseNum("$12"), 12);
  assert.equal(parseNum("-$5"), -5);
  assert.equal(parseNum("12%"), 12);
  assert.equal(parseNum("12 %"), 12);
  assert.equal(parseNum("1.5k"), 1500);
  assert.equal(parseNum("2M"), 2_000_000);
  assert.equal(parseNum("−3"), -3);
  assert.equal(parseNum(".5"), 0.5);
  assert.equal(parseNum("1e3"), 1000);
  for (const t of ["", " ", "-", "—", "n/a", "abc", "12abc", "1,2,3", "NaN", "Infinity"]) assert.equal(parseNum(t), null, t);
});

test("inferUnit: a unit is taken only when every number carries it", () => {
  assert.deepEqual(inferUnit(["12%", "40%", ""]), { prefix: "", suffix: "%" });
  assert.deepEqual(inferUnit(["$1", "$2"]), { prefix: "$", suffix: "" });
  assert.deepEqual(inferUnit(["$1", "2"]), { prefix: "", suffix: "" });
  assert.deepEqual(inferUnit(["a", "b"]), { prefix: "", suffix: "" });
});

test("fmtNum: commas, decimals by size, compact when asked, a real minus", () => {
  assert.equal(fmtNum(1234567), "1,234,567");
  assert.equal(fmtNum(12.345), "12.35");
  assert.equal(fmtNum(0.5), "0.5");
  assert.equal(fmtNum(150.55), "150.6");
  assert.equal(fmtNum(12400, undefined, true), "12.4K");
  assert.equal(fmtNum(3_100_000, undefined, true), "3.1M");
  assert.equal(fmtNum(2_500_000_000, undefined, true), "2.5B");
  assert.equal(fmtNum(999, undefined, true), "999");
  assert.equal(fmtNum(-5), "−5");
  assert.equal(fmtNum(-5, { prefix: "$", suffix: "" }), "−$5");
  assert.equal(fmtNum(40, { prefix: "", suffix: "%" }), "40%");
});

test("niceTicks: round steps that cover the range", () => {
  assert.deepEqual(niceTicks(0, 97, 5).ticks, [0, 20, 40, 60, 80, 100]);
  const t = niceTicks(0, 8, 5);
  assert.ok(t.lo <= 0 && t.hi >= 8 && t.step > 0);
  assert.deepEqual(niceTicks(0, 1, 5).ticks.slice(-1), [1]);
  assert.ok(niceTicks(5, 5).ticks.length >= 2, "a single value still gets a scale");
  const neg = niceTicks(-30, 70, 5);
  assert.ok(neg.lo <= -30 && neg.hi >= 70 && neg.ticks.includes(0));
});

test("every kind named in KINDS is drawn from a table of the right shape", () => {
  const tables: Record<string, string> = {
    column: T, bar: T, line: T, area: T, combo: T, radar: T, heatmap: T, pie: "| N | V |\n|---|---|\n| a | 1 |\n| b | 2 |", doughnut: "| N | V |\n|---|---|\n| a | 1 |\n| b | 2 |",
    funnel: "| Stage | V |\n|---|---|\n| a | 10 |\n| b | 5 |", pareto: "| N | V |\n|---|---|\n| a | 1 |\n| b | 9 |",
    scatter: "| X | Y |\n|---|---|\n| 1 | 2 |\n| 2 | 3 |", bubble: "| N | X | Y | S |\n|---|---|---|---|\n| a | 1 | 2 | 5 |\n| b | 2 | 3 | 9 |",
    histogram: "| V |\n|---|\n| 1 |\n| 2 |\n| 2 |\n| 9 |", box: "| G | V |\n|---|---|\n| a | 1 |\n| a | 2 |\n| b | 3 |", waterfall: "| S | V |\n|---|---|\n| Start | 10 |\n| Up | 5 |\n| End | |",
    treemap: "| G | I | V |\n|---|---|---|\n| a | x | 3 |\n| a | y | 2 |\n| b | z | 4 |", sunburst: "| G | I | V |\n|---|---|---|\n| a | x | 3 |\n| b | z | 4 |",
  };
  for (const k of KINDS) {
    const r = buildChart(`type: ${k}\ntotals: Start, End\n${tables[k]}`);
    assert.ok(!("error" in r), `${k}: ${"error" in r ? r.error : ""}`);
  }
  assert.equal(Object.keys(tables).length, KINDS.length, "a table for every kind");
});

test("settings: type is needed and named, aliases work, unknown settings are said, a block with no table says so", () => {
  assert.match(bad(""), /no type/);
  assert.match(bad("type: radial"), /not one Kona draws/);
  assert.equal(ok("type: Donut", "| N | V |\n|---|---|\n| a | 1 |").spec.kind, "doughnut");
  assert.equal(ok("type: box-and-whisker", "| G | V |\n|---|---|\n| a | 1 |").spec.kind, "box");
  assert.ok(ok("type: column\ncolor: red").notes.some((n) => /"color" is not known/.test(n)));
  const none = buildChart("type: column\ntitle: x");
  assert.ok("error" in none && /no data/.test(none.error) && none.table === null);
  assert.match((buildChart("type: column\n| A | B |\n|---|---|") as { error: string }).error, /no rows/);
  const c = ok("type: column\ntitle: Cost\nstack: percent\nlabels: on\nlegend: off\nsmooth: yes\nmin: 0\nmax: 50\nunit: $\nx-title: Role\ny-title: Dollars\nheight: 9999");
  assert.equal(c.spec.title, "Cost");
  assert.equal(c.spec.stack, "percent");
  assert.equal(c.spec.labels, "on");
  assert.equal(c.spec.legend, false);
  assert.equal(c.spec.smooth, true);
  assert.deepEqual([c.spec.min, c.spec.max], [0, 50]);
  assert.deepEqual(c.spec.unit, { prefix: "$", suffix: "" });
  assert.deepEqual([c.spec.xTitle, c.spec.yTitle], ["Role", "Dollars"]);
  assert.equal(c.spec.height, 900, "a height is kept between 160 and 900");
  assert.ok(ok("type: column\nstack: true").spec.stack === "stacked");
});

test("the unit comes from the numbers, or from the setting", () => {
  assert.deepEqual(ok("type: bar", "| N | V |\n|---|---|\n| a | 10% |\n| b | 20% |").spec.unit, { prefix: "", suffix: "%" });
  assert.deepEqual(ok("type: bar\nunit: kg", "| N | V |\n|---|---|\n| a | 1 |").spec.unit, { prefix: "", suffix: " kg" });
  assert.deepEqual(ok("type: bar\nunit: Rp", "| N | V |\n|---|---|\n| a | 1 |").spec.unit, { prefix: "Rp ", suffix: "" });
});

test("category charts: names in the first column, a series for each number column, too many series or none is said", () => {
  const c = ok("type: column");
  assert.equal(c.data.shape, "cat");
  if (c.data.shape === "cat") { assert.deepEqual(c.data.cats, ["x", "y", "z"]); assert.deepEqual(c.data.series.map((s) => s.name), ["A", "B"]); assert.deepEqual(c.data.series[1].values, [4, 5, 6]); }
  assert.match(bad("type: column", "| N | T |\n|---|---|\n| a | text |\n| b | words |"), /column of numbers/);
  const wide = "| N | " + Array.from({ length: 9 }, (_, i) => "S" + i).join(" | ") + " |\n|" + "---|".repeat(10) + "\n| a | " + Array.from({ length: 9 }, () => "1").join(" | ") + " |";
  assert.match(bad("type: line", wide), /at most 8 colours/);
  assert.match(bad("type: radar", "| N | V |\n|---|---|\n| a | 1 |\n| b | 2 |"), /three rows/);
  const gap = ok("type: line", "| N | V |\n|---|---|\n| a | 1 |\n| b | |\n| c | 3 |");
  if (gap.data.shape === "cat") assert.deepEqual(gap.data.series[0].values, [1, null, 3], "a blank is a gap, not a zero");
});

test("pie: only positive parts, the first number column, more than eight parts are folded into Other", () => {
  assert.match(bad("type: pie", "| N | V |\n|---|---|\n| a | -1 |\n| b | 2 |"), /negative/);
  const many = "| N | V |\n|---|---|\n" + Array.from({ length: 12 }, (_, i) => `| p${i} | ${12 - i} |`).join("\n");
  const c = ok("type: pie", many);
  assert.equal(c.data.shape, "parts");
  if (c.data.shape === "parts") {
    assert.equal(c.data.parts.length, 8);
    assert.equal(c.data.parts[7].name, "Other");
    assert.equal(c.data.parts.reduce((s, p) => s + p.value, 0), 78, "nothing is lost in the fold");
    assert.equal(c.data.folded, 5);
  }
  assert.ok(c.notes.some((n) => /folded into "Other"/.test(n)));
  assert.ok(ok("type: pie", "| N | A | B |\n|---|---|---|\n| a | 1 | 2 |").notes.some((n) => /first number column/.test(n)));
  assert.match(bad("type: doughnut", "| N | V |\n|---|---|\n| a | 0 |"), /nothing to draw/);
});

test("scatter and bubble need their columns; scatter carries at most four series", () => {
  assert.match(bad("type: scatter", "| N | V |\n|---|---|\n| a | 1 |"), /first column/);
  assert.match(bad("type: scatter", "| X | A | B | C | D | E |\n|---|---|---|---|---|---|\n| 1 | 1 | 1 | 1 | 1 | 1 |"), /at most 4 series/);
  const s = ok("type: scatter", "| X | A | B |\n|---|---|---|\n| 1 | 2 | 3 |\n| 2 | | 4 |");
  if (s.data.shape === "xy") { assert.equal(s.data.series.length, 2); assert.equal(s.data.series[0].points.length, 1, "a blank y is skipped"); assert.equal(s.data.series[1].points.length, 2); }
  assert.match(bad("type: bubble", "| N | X | Y |\n|---|---|---|\n| a | 1 | 2 |"), /x, y and size/);
  const b = ok("type: bubble", "| N | X | Y | S |\n|---|---|---|---|\n| a | 1 | 2 | 5 |\n| b | 1 | 2 | 0 |");
  if (b.data.shape === "bubble") assert.equal(b.data.points.length, 1, "a size of zero is not drawn");
});

test("histogram, box and waterfall take their numbers from the table", () => {
  const h = ok("type: histogram", "| Score |\n|---|\n| 1 |\n| 2 |\n| 3 |");
  if (h.data.shape === "values") assert.deepEqual(h.data.values, [1, 2, 3]);
  assert.match(bad("type: histogram", "| S |\n|---|\n| 1 |"), /at least two/);
  const long = ok("type: box", "| G | V |\n|---|---|\n| a | 1 |\n| a | 3 |\n| b | 5 |");
  if (long.data.shape === "groups") assert.deepEqual(long.data.groups, [{ name: "a", values: [1, 3] }, { name: "b", values: [5] }]);
  const wide = ok("type: box", "| Row | A | B |\n|---|---|---|\n| r1 | 1 | 5 |\n| r2 | 3 | 7 |");
  if (wide.data.shape === "groups") assert.deepEqual(wide.data.groups.map((g) => g.name), ["A", "B"]);
  const w = ok("type: waterfall\ntotals: Start", "| S | V |\n|---|---|\n| Start | 10 |\n| Up | 5 |\n| End | |");
  if (w.data.shape === "steps") assert.deepEqual(w.data.steps.map((s) => s.total), [true, false, true], "named totals and a blank value are totals");
  assert.match(bad("type: waterfall", "| S | V |\n|---|---|\n| a | |\n| b | |"), /needs a column|at least one step/);
});

test("treemap and sunburst: names before the sizes build the tree, a row may stop early", () => {
  const t = ok("type: treemap", "| Group | Item | Size |\n|---|---|---|\n| a | x | 3 |\n| a | y | 2 |\n| b | | 4 |\n| b | z | 1 |");
  assert.equal(t.data.shape, "tree");
  if (t.data.shape === "tree") {
    assert.equal(t.data.root.value, 10);
    assert.deepEqual(t.data.root.children.map((c) => [c.name, c.value]), [["a", 5], ["b", 5]]);
    assert.deepEqual(t.data.root.children[1].children.map((c) => c.name), ["z"], "a row that stops at b counts as b's own part");
    assert.deepEqual(t.data.levels, ["Group", "Item"]);
  }
  const flat = ok("type: sunburst", "| Item | Size |\n|---|---|\n| a | 3 |\n| b | 4 |");
  if (flat.data.shape === "tree") assert.equal(flat.data.root.children.length, 2);
  assert.match(bad("type: treemap", "| A | B |\n|---|---|\n| 1 | 2 |"), /names before the numbers|column of numbers/);
});

test("stackLayout: positives pile up, negatives pile down, percent adds to 100", () => {
  const s = [{ name: "a", values: [2, -1] }, { name: "b", values: [3, -2] }];
  const l = stackLayout(s, 2, "stacked");
  assert.deepEqual(l[0][0], { y0: 0, y1: 2 });
  assert.deepEqual(l[1][0], { y0: 2, y1: 5 });
  assert.deepEqual(l[0][1], { y0: 0, y1: -1 });
  assert.deepEqual(l[1][1], { y0: -1, y1: -3 });
  const p = stackLayout([{ name: "a", values: [1] }, { name: "b", values: [3] }], 1, "percent");
  assert.deepEqual([p[0][0].y1, p[1][0].y1], [25, 100]);
  assert.deepEqual(stackLayout([{ name: "a", values: [0] }], 1, "percent")[0][0], { y0: 0, y1: 0 }, "an empty category does not divide by zero");
});

test("histogram: round edges, every value counted once, the top edge included", () => {
  const values = [1, 2, 2, 3, 3, 3, 8, 10];
  const h = histogram(values, null);
  assert.equal(h.counts.reduce((a, b) => a + b, 0), values.length);
  assert.equal(h.edges.length, h.counts.length + 1);
  assert.ok(h.edges[0] <= 1 && h.edges[h.edges.length - 1] >= 10);
  assert.equal(histogram([5, 5, 5], null).counts.reduce((a, b) => a + b, 0), 3, "equal values still make a histogram");
  const fixed = histogram(Array.from({ length: 100 }, (_, i) => i), 10);
  assert.ok(fixed.counts.length >= 8 && fixed.counts.length <= 12, "the bins wished for, moved to round numbers");
});

test("boxStats: quartiles by interpolation, whiskers inside 1.5 boxes, the rest outliers", () => {
  const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
  assert.equal(b.median, 5.5);
  assert.equal(b.q1, 3.25);
  assert.equal(b.q3, 7.75);
  assert.deepEqual(b.outliers, [100]);
  assert.equal(b.high, 9);
  assert.equal(b.low, 1);
  assert.equal(b.n, 10);
  const one = boxStats([4]);
  assert.deepEqual([one.q1, one.median, one.q3, one.low, one.high], [4, 4, 4, 4, 4]);
});

test("waterfall: each step starts where the last ended, a total stands on zero and may reset the sum", () => {
  const w = waterfall([{ name: "Start", value: 100, total: true }, { name: "Sales", value: 30, total: false }, { name: "Cost", value: -50, total: false }, { name: "End", value: null, total: true }]);
  assert.deepEqual(w.map((b) => [b.start, b.end, b.kind]), [[0, 100, "total"], [100, 130, "up"], [130, 80, "down"], [0, 80, "total"]]);
  const reset = waterfall([{ name: "a", value: 10, total: false }, { name: "T", value: 15, total: true }, { name: "b", value: 5, total: false }]);
  assert.equal(reset[2].end, 20, "a total that carries a number resets the running sum");
});

test("pareto sorts largest first and adds up to 100 percent", () => {
  const p = pareto([{ name: "a", value: 10 }, { name: "b", value: 70 }, { name: "c", value: 20 }]);
  assert.deepEqual(p.map((x) => x.name), ["b", "c", "a"]);
  assert.deepEqual(p.map((x) => x.share), [70, 90, 100]);
  assert.equal(p[2].cum, 100);
});

test("pieSlices go clockwise from 12 o'clock and fill the circle", () => {
  const s = pieSlices([1, 1, 2]);
  assert.equal(s[0].a0, -Math.PI / 2);
  assert.ok(Math.abs(s[2].a1 - (3 * Math.PI) / 2) < 1e-9);
  assert.ok(Math.abs(s[2].a1 - s[2].a0 - Math.PI) < 1e-9, "a half share is half the circle");
});

test("squarify: the boxes fill the rectangle, none overlap, none leave it", () => {
  const values = [6, 6, 4, 3, 2, 2, 1];
  const rect = { x: 10, y: 20, w: 300, h: 200 };
  const r = squarify(values, rect);
  const area = r.reduce((s, b) => s + b.w * b.h, 0);
  assert.ok(Math.abs(area - rect.w * rect.h) < 1e-6, "the areas add up to the whole");
  values.forEach((v, i) => assert.ok(Math.abs((r[i].w * r[i].h) / (rect.w * rect.h) - v / 24) < 1e-9, "each area follows its value"));
  for (const b of r) assert.ok(b.x >= rect.x - 1e-9 && b.y >= rect.y - 1e-9 && b.x + b.w <= rect.x + rect.w + 1e-6 && b.y + b.h <= rect.y + rect.h + 1e-6);
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j];
    assert.ok(a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6, `${i} and ${j} overlap`);
  }
  assert.deepEqual(squarify([1], rect)[0], { ...rect }, "one value fills it");
  assert.equal(squarify([0, 0], rect)[0].w, 0, "nothing to draw is not a division by zero");
});

test("sunburst: each ring splits its parent's arc by value, the top-level index is kept", () => {
  const c = ok("type: sunburst", "| G | I | V |\n|---|---|---|\n| a | x | 3 |\n| a | y | 1 |\n| b | z | 4 |");
  if (c.data.shape !== "tree") throw new Error("tree");
  const arcs = sunburst(c.data.root);
  const ring1 = arcs.filter((a) => a.depth === 1), ring2 = arcs.filter((a) => a.depth === 2);
  assert.equal(ring1.length, 2);
  assert.equal(ring2.length, 3);
  assert.ok(Math.abs(ring1[0].a1 - ring1[0].a0 - (Math.PI * 2 * 4) / 8) < 1e-9, "a has half the circle");
  const x = ring2.find((a) => a.node.name === "x")!;
  assert.equal(x.top, 0, "a child keeps the colour index of its top-level parent");
  assert.ok(Math.abs(x.a1 - x.a0 - (Math.PI * 2 * 3) / 8) < 1e-9);
  assert.deepEqual(ring2.find((a) => a.node.name === "z")!.path, ["b", "z"]);
});

test("smoothPath passes through every point and never overshoots them", () => {
  const pts: [number, number][] = [[0, 10], [10, 0], [20, 0], [30, 10]];
  const d = smoothPath(pts);
  assert.ok(d.startsWith("M0 10"));
  assert.ok(d.endsWith("30 10"));
  const ys = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]));
  assert.ok(ys.every((y) => y >= -1e-9 && y <= 10 + 1e-9), "the curve stays between the lowest and the highest point");
  assert.equal(smoothPath([[0, 0]]), "M0 0");
  assert.equal(smoothPath([]), "");
});

test("barPath cuts the corners of the free end by a few pixels and nothing else", () => {
  assert.equal(barPath(0, 0, 10, 20, null), "M0 0h10v20h-10z");
  const top = barPath(0, 0, 10, 20, "top");
  assert.ok(top.includes("V2") && top.includes("H8"), top);
  for (const end of ["top", "bottom", "left", "right"] as const) assert.ok(barPath(0, 0, 10, 20, end).endsWith("z"));
  assert.equal(barPath(0, 0, 2, 20, "top"), barPath(0, 0, 2, 20, "top", 2), "a bar too thin for a cut is cut less, not broken");
  assert.equal(barPath(0, 0, 1, 1, "top"), "M0 0h1v1h-1z", "a speck is a plain square");
});

test("arcPath makes a closed shape for a slice, a ring segment and a whole circle", () => {
  assert.ok(arcPath(50, 50, 0, 40, 0, 1).startsWith("M50 50L"));
  assert.ok(arcPath(50, 50, 20, 40, 0, 1).includes("A20 20"));
  assert.ok(!arcPath(50, 50, 0, 40, 0, Math.PI * 2).includes("NaN"));
  assert.ok(arcPath(50, 50, 0, 40, 0, Math.PI * 1.5).includes(" 0 1 1 "), "more than half the circle takes the long way round");
});

test("the table of a chart can be copied back as markdown", () => {
  const c = ok("type: column");
  assert.equal(tableText(c.table), "| Name | A | B |\n| --- | --- | --- |\n| x | 1 | 4 |\n| y | 2 | 5 |\n| z | 3 | 6 |");
  const pipe = tableText({ head: ["a"], align: [null], rows: [["x|y"]] });
  assert.ok(pipe.includes("x\\|y"));
});

test("the eight colours are the tokens of index.css, and every one can carry a readable label", () => {
  const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
  CHART_HEX.forEach((hex, i) => assert.ok(new RegExp(`--chart-${i + 1}:\\s*${hex}`, "i").test(css), `--chart-${i + 1} is ${hex} in index.css`));
  assert.equal(new Set(CHART_HEX).size, 8, "eight different colours");
  for (const hex of CHART_HEX) assert.ok(Math.max(contrast(hex, "#fbf6ea"), contrast(hex, "#2d2218")) >= 3.5, `a label on ${hex} reads`);
  assert.equal(inkOn("#0a8672"), "light");
  assert.equal(inkOn("#e0861e"), "dark");
  assert.ok(contrast("#000000", "#ffffff") > 20.9 && contrast("#000000", "#ffffff") < 21.1);
});

test("the example in the starter note for workers is a chart that can be drawn", () => {
  const note = readFileSync(new URL("../../brain/starter/kona-charts.md", import.meta.url), "utf8").replace(/\r/g, "");
  const block = /```chart\n([\s\S]*?)\n```/.exec(note);
  assert.ok(block, "the note has a chart block");
  const r = buildChart(block![1]);
  assert.ok(!("error" in r), "error" in r ? r.error : "");
  for (const k of KINDS) assert.ok(note.includes(k), `the note names the type ${k}`);
});
