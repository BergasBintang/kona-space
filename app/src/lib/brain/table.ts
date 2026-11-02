// Markdown tables for the reader: split the pipe lines into a header, the alignment of each column and the rows, and sort and filter the rows.
// A block of pipe lines with no divider row (|---|---|) is not a table; the reader keeps showing it as plain text.

export type Align = "left" | "right" | "center";
export type Table = { head: string[]; align: (Align | null)[]; rows: string[][] };

/** The cells of one line: the outer pipes are dropped, `\|` stays a pipe inside a cell, and a pipe inside `code` does not split. */
export function splitRow(line: string): string[] {
  const s = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  const cells: string[] = [];
  let cur = "", tick = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") { cur += "|"; i++; }
    else if (ch === "`") { tick = !tick; cur += ch; }
    else if (ch === "|" && !tick) { cells.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

const DIVIDER = /^:?-+:?$/;

/** A table, or null when the lines are not one (no divider row under the first line). */
export function parseTable(lines: string[]): Table | null {
  if (lines.length < 2) return null;
  const head = splitRow(lines[0]);
  const div = splitRow(lines[1]);
  if (div.length === 0 || !div.every((c) => DIVIDER.test(c))) return null;
  const n = head.length;
  const align = head.map((_, i): Align | null => {
    const d = div[i];
    if (!d) return null;
    const l = d.startsWith(":"), r = d.endsWith(":");
    return l && r ? "center" : r ? "right" : l ? "left" : null;
  });
  const rows = lines.slice(2).map((l) => { const c = splitRow(l); while (c.length < n) c.push(""); return c.slice(0, n); });
  return { head, align, rows };
}

const NUM = /^[-+]?[$€£]?\s?\d[\d,]*(\.\d+)?\s?(%|[kKmMgG][bB]?|ms|s|x)?$/;

/** The number a cell holds ("1,200", "30%", "$4.50"), or null. */
export function cellNumber(s: string): number | null {
  const t = s.trim();
  if (!NUM.test(t)) return null;
  const n = Number(t.replace(/[^\d.+-]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** A column whose cells are all numbers (or empty) reads better flush right. */
export function numericColumn(rows: string[][], col: number): boolean {
  let seen = 0;
  for (const r of rows) { const c = (r[col] ?? "").trim(); if (c === "") continue; if (cellNumber(c) === null) return false; seen++; }
  return seen > 0;
}

/** The rows in order of one column: numbers as numbers, words in the reader's language with "2" before "10", empty cells always last. */
export function sortRows(rows: string[][], col: number, dir: "asc" | "desc"): string[][] {
  const sign = dir === "asc" ? 1 : -1;
  const numeric = numericColumn(rows, col);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => {
    const x = (a.r[col] ?? "").trim(), y = (b.r[col] ?? "").trim();
    if (x === "" || y === "") return x === y ? a.i - b.i : x === "" ? 1 : -1;
    const c = numeric ? (cellNumber(x)! - cellNumber(y)!) : x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
    return c * sign || a.i - b.i;
  }).map((e) => e.r);
}

/** The rows where any shown column holds the words typed (case does not matter). `shown` lists the columns in view. */
export function filterRows(rows: string[][], query: string, shown: number[]): string[][] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => shown.some((c) => (r[c] ?? "").toLowerCase().includes(q)));
}
