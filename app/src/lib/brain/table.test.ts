import { test } from "node:test";
import assert from "node:assert/strict";
import { cellNumber, filterRows, numericColumn, parseTable, sortRows, splitRow } from "./table.ts";

test("a row splits at its pipes, keeps an escaped pipe and a pipe inside code", () => {
  assert.deepEqual(splitRow("| a | b \\| c | `x|y` |"), ["a", "b | c", "`x|y`"]);
  assert.deepEqual(splitRow("a | b"), ["a", "b"]);
  assert.deepEqual(splitRow("| a |  |"), ["a", ""]);
});

test("a table needs a divider row; its colons set the alignment, and short rows are filled", () => {
  const t = parseTable(["| Field | Req | Note |", "|:--|:-:|--:|", "| name | R |", "| email | R | from the account | extra |"])!;
  assert.deepEqual(t.head, ["Field", "Req", "Note"]);
  assert.deepEqual(t.align, ["left", "center", "right"]);
  assert.deepEqual(t.rows, [["name", "R", ""], ["email", "R", "from the account"]]);
  assert.equal(parseTable(["| a | b |", "| c | d |"]), null, "no divider row, so it stays plain text");
  assert.equal(parseTable(["| only one line |"]), null);
});

test("numbers are read with their signs and units, words and dates are not numbers", () => {
  assert.equal(cellNumber("1,200"), 1200);
  assert.equal(cellNumber("30%"), 30);
  assert.equal(cellNumber("$4.50"), 4.5);
  assert.equal(cellNumber("7.1 KB"), 7.1);
  assert.equal(cellNumber("3 Nov"), null);
  assert.equal(cellNumber("2026-11-03"), null);
  assert.equal(cellNumber("1.2.3"), null);
  assert.equal(numericColumn([["1"], [""], ["22"]], 0), true);
  assert.equal(numericColumn([["1"], ["x"]], 0), false);
  assert.equal(numericColumn([[""], [""]], 0), false);
});

test("sorting puts 2 before 10, keeps equal rows in their order and leaves empty cells last both ways", () => {
  const rows = [["b", "10"], ["a", "2"], ["c", ""], ["d", "2"]];
  assert.deepEqual(sortRows(rows, 1, "asc").map((r) => r[0]), ["a", "d", "b", "c"]);
  assert.deepEqual(sortRows(rows, 1, "desc").map((r) => r[0]), ["b", "a", "d", "c"]);
  assert.deepEqual(sortRows(rows, 0, "desc").map((r) => r[0]), ["d", "c", "b", "a"]);
  assert.deepEqual(sortRows([["item 10"], ["item 9"]], 0, "asc"), [["item 9"], ["item 10"]]);
});

test("the filter looks only in the columns that are showing", () => {
  const rows = [["alpha", "red"], ["beta", "blue"]];
  assert.deepEqual(filterRows(rows, " BLU ", [0, 1]), [["beta", "blue"]]);
  assert.deepEqual(filterRows(rows, "blue", [0]), []);
  assert.equal(filterRows(rows, "", [0]), rows);
});
