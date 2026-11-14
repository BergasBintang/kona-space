// Charts in notes: a code block opened with ```chart holds a few settings and then the data as a markdown table (so the numbers are written the way every table is, and
// the block is still a readable table when it is not drawn). This file reads the block and does every calculation a chart needs (scales, stacks, bins, quartiles, squares
// of a treemap, rings of a sunburst, a waterfall's running total); the drawing is components/brain/Chart.tsx. Plain TypeScript, no DOM, no model: every rule is tested.
//
//   ```chart
//   type: column
//   title: Cost per role
//   stack: true
//   | Role | Sonnet | Haiku |
//   |---|---|---|
//   | Kiki | 12 | 3 |
//   ```
//
// Kinds: column, bar, line, area, combo, pie, doughnut, scatter, bubble, radar, histogram, box, waterfall, funnel, pareto, treemap, sunburst, heatmap.
// Not drawn on purpose: 3D, surface, stock and map charts (heavy, and rarely worth it in a note), and a second value axis (two scales on one plot invent a link between them).
import { parseTable, type Table } from "./table.ts";

export const KINDS = ["column", "bar", "line", "area", "combo", "pie", "doughnut", "scatter", "bubble", "radar", "histogram", "box", "waterfall", "funnel", "pareto", "treemap", "sunburst", "heatmap"] as const;
export type Kind = (typeof KINDS)[number];
const ALIAS: Record<string, Kind> = {
  columns: "column", "column-chart": "column", bars: "bar", "bar-chart": "bar", lines: "line", "line-chart": "line", areas: "area", "area-chart": "area",
  donut: "doughnut", pies: "pie", "pie-chart": "pie", "scatter-plot": "scatter", xy: "scatter", boxplot: "box", "box-plot": "box", "box-and-whisker": "box",
  "heat-map": "heatmap", "tree-map": "treemap", "sun-burst": "sunburst",
};

// ---- the colours: eight hues in a fixed order, each step checked with the dataviz validator on the paper surface (light mode only: Kona has one look) ----
// Adjacent pairs pass the colour-blind and normal-vision gates; the first three also pass all-pairs, so scatter and bubble carry at most four series (marker shapes
// differ too). They are also the tokens --chart-1 to --chart-8 of index.css, and a test fails when the two lists differ.
export const CHART_HEX = ["#0a8672", "#e0861e", "#3a62c8", "#c23b2d", "#6a4fb0", "#d9638f", "#4f8a1e", "#1b9ac4"] as const;
export const MAX_SERIES = 8;
export const MAX_SCATTER = 4;

/** WCAG contrast ratio of two #rrggbb colours */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** the ink for a label set inside a fill: the paper colour or the dark ink, whichever reads better */
export function inkOn(fill: string, light = "#fbf6ea", dark = "#2d2218"): "light" | "dark" {
  return contrast(fill, light) >= contrast(fill, dark) ? "light" : "dark";
}

// ---- numbers ----

export type Unit = { prefix: string; suffix: string };
export const NO_UNIT: Unit = { prefix: "", suffix: "" };
const CURRENCY = /^[$€£¥]/;

/** A cell as a number: thousands commas, a currency sign, a trailing percent sign and k, m or b are understood; a blank, a dash or text is not a number. */
export function parseNum(cell: string): number | null {
  let s = cell.trim().replace(/−/g, "-");
  if (!s || /^(-|—|–|n\/a|na|null|none)$/i.test(s)) return null;
  s = s.replace(/^[$€£¥]\s*/, "").replace(/^(-)[$€£¥]\s*/, "$1").replace(/\s*%$/, "");
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  let mult = 1;
  const k = /^(-?\d+(?:\.\d+)?)\s*([kKmMbB])$/.exec(s);
  if (k) { s = k[1]; mult = { k: 1e3, m: 1e6, b: 1e9 }[k[2].toLowerCase() as "k" | "m" | "b"]; }
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const v = Number(s) * mult;
  return Number.isFinite(v) ? v : null;
}

/** The unit the numbers of some cells share ($ in front, % behind), when every number has it. */
export function inferUnit(cells: string[]): Unit {
  const used = cells.map((c) => c.trim()).filter((c) => parseNum(c) !== null);
  if (used.length === 0) return NO_UNIT;
  if (used.every((c) => c.endsWith("%"))) return { prefix: "", suffix: "%" };
  const sign = used[0].replace(/^-/, "")[0];
  if (CURRENCY.test(sign ?? "") && used.every((c) => c.replace(/^-/, "").startsWith(sign))) return { prefix: sign, suffix: "" };
  return NO_UNIT;
}

const trimNum = (v: number, digits: number) => String(Number(v.toFixed(digits)));
/** A number for a label: thousands commas, up to two decimals under 100, compact (12.4K, 3.1M) when asked and big. */
export function fmtNum(v: number, unit: Unit = NO_UNIT, compact = false): string {
  const a = Math.abs(v);
  let s: string;
  if (compact && a >= 1e9) s = trimNum(a / 1e9, 1) + "B";
  else if (compact && a >= 1e6) s = trimNum(a / 1e6, 1) + "M";
  else if (compact && a >= 1e4) s = trimNum(a / 1e3, 1) + "K";
  else s = Number(a < 100 ? a.toFixed(2) : a < 1000 ? a.toFixed(1) : a.toFixed(0)).toLocaleString("en-US");
  return `${v < 0 ? "−" : ""}${unit.prefix}${s}${unit.suffix}`;
}

/** A readable scale: round steps (1, 2, 5 times a power of ten) from at or below `lo` to at or above `hi`, about `count` ticks. */
export function niceTicks(lo: number, hi: number, count = 5): { lo: number; hi: number; step: number; ticks: number[] } {
  if (!(hi > lo)) { const d = Math.abs(lo) / 2 || 0.5; lo -= d; hi += d; }
  const nice = (range: number, round: boolean) => {
    const exp = Math.floor(Math.log10(range)), f = range / 10 ** exp;
    const n = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
    return n * 10 ** exp;
  };
  const step = nice(nice(hi - lo, false) / Math.max(1, count - 1), true);
  const nlo = Math.floor(lo / step + 1e-9) * step, nhi = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = nlo; v <= nhi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo: nlo, hi: nhi, step, ticks };
}

// ---- the spec and the data ----

export type Series = { name: string; values: (number | null)[] };
export type TreeNode = { name: string; value: number; children: TreeNode[] };
export type Data =
  | { shape: "cat"; cats: string[]; series: Series[] }
  | { shape: "parts"; parts: { name: string; value: number }[]; folded: number }
  | { shape: "xy"; xName: string; series: { name: string; points: { x: number; y: number }[] }[] }
  | { shape: "bubble"; xName: string; yName: string; sizeName: string; points: { name: string; x: number; y: number; size: number }[] }
  | { shape: "values"; name: string; values: number[] }
  | { shape: "groups"; groups: { name: string; values: number[] }[] }
  | { shape: "steps"; steps: { name: string; value: number | null; total: boolean }[] }
  | { shape: "tree"; root: TreeNode; levels: string[] };

export type ChartSpec = {
  kind: Kind; title: string; stack: "none" | "stacked" | "percent"; labels: "auto" | "on" | "off"; legend: boolean;
  smooth: boolean; markers: boolean; fill: boolean; bins: number | null; lines: string[]; totals: string[];
  min: number | null; max: number | null; unit: Unit; xTitle: string; yTitle: string; height: number | null;
};
export type Chart = { spec: ChartSpec; table: Table; data: Data; notes: string[] };
export type ChartRead = Chart | { error: string; table: Table | null };

const BOOL = (v: string): boolean | null => (/^(true|yes|on|1)$/i.test(v) ? true : /^(false|no|off|0)$/i.test(v) ? false : null);

/** Read the inside of a ```chart block. Never throws: a block that cannot be drawn gives the reason, in plain words, and its table when it has one. */
export function buildChart(source: string): ChartRead {
  const lines = source.replace(/\r/g, "").split("\n");
  const at = lines.findIndex((l) => l.trim().startsWith("|"));
  const head = (at < 0 ? lines : lines.slice(0, at)).filter((l) => l.trim() !== "");
  const table = at < 0 ? null : parseTable(lines.slice(at).filter((l) => l.trim().startsWith("|")));
  const notes: string[] = [];
  const opts = new Map<string, string>();
  for (const l of head) {
    const m = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/.exec(l);
    if (!m) { notes.push(`A line is not a setting and is ignored: "${l.trim().slice(0, 40)}".`); continue; }
    opts.set(m[1].toLowerCase(), m[2]);
  }
  const rawKind = (opts.get("type") ?? opts.get("kind") ?? "").toLowerCase().replace(/\s+/g, "-");
  const kind = (KINDS as readonly string[]).includes(rawKind) ? (rawKind as Kind) : ALIAS[rawKind];
  if (!kind) return { error: rawKind ? `The chart type "${rawKind}" is not one Kona draws. Use one of: ${KINDS.join(", ")}.` : `The chart has no type. Write a line such as "type: column". Types: ${KINDS.join(", ")}.`, table };
  if (!table) return { error: "The chart has no data. Under the settings write a markdown table: a header line, a divider line (|---|---|) and one row for each category.", table };
  if (table.rows.length === 0) return { error: "The chart's table has a header but no rows.", table };

  const known = new Set(["type", "kind", "title", "stack", "labels", "legend", "smooth", "markers", "fill", "bins", "line", "totals", "min", "max", "unit", "x-title", "y-title", "height"]);
  for (const k of opts.keys()) if (!known.has(k)) notes.push(`The setting "${k}" is not known and is ignored.`);
  const flag = (k: string, dflt: boolean) => { const v = opts.get(k); if (v === undefined) return dflt; const b = BOOL(v); if (b === null) { notes.push(`"${k}" should be true or false, not "${v}".`); return dflt; } return b; };
  const num = (k: string) => { const v = opts.get(k); if (v === undefined) return null; const n = parseNum(v); if (n === null) notes.push(`"${k}" should be a number, not "${v}".`); return n; };
  const list = (k: string) => (opts.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const stackRaw = (opts.get("stack") ?? "").toLowerCase();
  const stack: ChartSpec["stack"] = /^(percent|100|100%|percentage)$/.test(stackRaw) ? "percent" : BOOL(stackRaw) === true || stackRaw === "stacked" ? "stacked" : "none";
  const labelsRaw = (opts.get("labels") ?? "auto").toLowerCase();
  const heightRaw = num("height");
  const binsRaw = num("bins");

  // the unit: the setting, else what the numbers themselves carry
  const unitSetting = (opts.get("unit") ?? "").trim();
  const unitOf = (cols: number[]): Unit => {
    if (unitSetting) {
      if (/^[$€£¥]$/.test(unitSetting)) return { prefix: unitSetting, suffix: "" };
      if (unitSetting === "%") return { prefix: "", suffix: "%" };
      if (/^rp$/i.test(unitSetting)) return { prefix: "Rp ", suffix: "" };
      return { prefix: "", suffix: ` ${unitSetting}` };
    }
    return inferUnit(cols.flatMap((c) => table.rows.map((r) => r[c] ?? "")));
  };

  // which columns hold numbers (a column is numeric when most of its filled cells are)
  const numeric = table.head.map((_, c) => {
    const filled = table.rows.map((r) => (r[c] ?? "").trim()).filter((s) => s !== "" && !/^(-|—|–)$/.test(s));
    return filled.length > 0 && filled.filter((s) => parseNum(s) !== null).length >= filled.length * 0.6;
  });
  const numCols = numeric.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);
  const valueCols = numCols.filter((c) => c > 0 || (kind === "histogram" && numCols.length === 1));
  const col = (c: number) => table.rows.map((r) => parseNum(r[c] ?? ""));
  const names = table.rows.map((r) => (r[0] ?? "").trim() || "(blank)");
  const headName = (c: number) => table.head[c]?.trim() || `Series ${c}`;
  const fail = (error: string): ChartRead => ({ error, table });

  let data: Data;
  let unitCols = valueCols;
  switch (kind) {
    case "column": case "bar": case "line": case "area": case "combo": case "radar": case "heatmap": {
      if (valueCols.length === 0) return fail("The table needs at least one column of numbers after the first column (the names).");
      if (valueCols.length > MAX_SERIES && kind !== "heatmap") return fail(`The table has ${valueCols.length} series; a chart carries at most ${MAX_SERIES} colours. Fold the small ones into "Other" or make two charts.`);
      if (kind === "radar" && table.rows.length < 3) return fail("A radar chart needs at least three rows, one for each spoke.");
      data = { shape: "cat", cats: names, series: valueCols.map((c) => ({ name: headName(c), values: col(c) })) };
      break;
    }
    case "pie": case "doughnut": case "funnel": case "pareto": {
      if (valueCols.length === 0) return fail("The table needs a column of numbers after the first column (the names).");
      const c = valueCols[0];
      if (valueCols.length > 1) notes.push(`Only the first number column, "${headName(c)}", is drawn.`);
      unitCols = [c];
      let parts = table.rows.map((r, i) => ({ name: names[i], value: parseNum(r[c] ?? "") })).filter((p): p is { name: string; value: number } => p.value !== null);
      if ((kind === "pie" || kind === "doughnut") && parts.some((p) => p.value < 0)) return fail("A pie or doughnut cannot show a negative number. Use a bar chart.");
      if (kind === "pie" || kind === "doughnut") parts = parts.filter((p) => p.value > 0);
      if (kind === "pareto" && parts.some((p) => p.value < 0)) return fail("A pareto chart cannot show a negative number.");
      if (parts.length === 0) return fail("There is nothing to draw: no row has a number.");
      let folded = 0;
      if ((kind === "pie" || kind === "doughnut") && parts.length > 8) {
        const sorted = [...parts].sort((a, b) => b.value - a.value);
        const rest = sorted.slice(7);
        folded = rest.length;
        parts = [...sorted.slice(0, 7), { name: "Other", value: rest.reduce((s, p) => s + p.value, 0) }];
        notes.push(`${folded} small parts are folded into "Other": more than eight parts cannot be told apart.`);
      }
      data = { shape: "parts", parts, folded };
      break;
    }
    case "scatter": {
      if (!numeric[0]) return fail("A scatter chart needs numbers in the first column (the x values).");
      if (valueCols.length === 0) return fail("A scatter chart needs at least one more column of numbers (the y values).");
      if (valueCols.length > MAX_SCATTER) return fail(`A scatter chart carries at most ${MAX_SCATTER} series (any two dots can touch, so more cannot be told apart). The table has ${valueCols.length}.`);
      const xs = col(0);
      data = { shape: "xy", xName: headName(0), series: valueCols.map((c) => ({ name: headName(c), points: col(c).map((y, i) => ({ x: xs[i], y })).filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null) })) };
      unitCols = [valueCols[0]];
      break;
    }
    case "bubble": {
      if (numCols.filter((c) => c > 0).length < 3) return fail("A bubble chart needs a name column and then three columns of numbers: x, y and size.");
      const [cx, cy, cs] = numCols.filter((c) => c > 0);
      const [xs, ys, ss] = [col(cx), col(cy), col(cs)];
      const points = table.rows.map((_, i) => ({ name: names[i], x: xs[i], y: ys[i], size: ss[i] })).filter((p): p is { name: string; x: number; y: number; size: number } => p.x !== null && p.y !== null && p.size !== null && p.size > 0);
      if (points.length === 0) return fail("There is nothing to draw: no row has an x, a y and a size above zero.");
      data = { shape: "bubble", xName: headName(cx), yName: headName(cy), sizeName: headName(cs), points };
      unitCols = [cy];
      break;
    }
    case "histogram": {
      if (numCols.length === 0) return fail("A histogram needs a column of numbers.");
      const c = numCols.length > 1 && numCols[0] === 0 ? numCols[1] : numCols[0];
      const values = col(c).filter((v): v is number => v !== null);
      if (values.length < 2) return fail("A histogram needs at least two numbers.");
      data = { shape: "values", name: headName(c), values };
      unitCols = [c];
      break;
    }
    case "box": {
      let groups: { name: string; values: number[] }[];
      if (numCols.length >= 2 || (numCols.length === 1 && numCols[0] === 0)) {
        // wide: each number column is a group, its header the name
        groups = numCols.map((c) => ({ name: headName(c), values: col(c).filter((v): v is number => v !== null) }));
      } else {
        // long: a group name and a number in each row
        const c = numCols[0];
        if (c === undefined) return fail("A box chart needs a column of numbers.");
        const by = new Map<string, number[]>();
        table.rows.forEach((r, i) => { const v = parseNum(r[c] ?? ""); if (v !== null) (by.get(names[i]) ?? by.set(names[i], []).get(names[i])!).push(v); });
        groups = [...by.entries()].map(([name, values]) => ({ name, values }));
      }
      groups = groups.filter((g) => g.values.length > 0);
      if (groups.length === 0) return fail("There is nothing to draw: no group has a number.");
      if (groups.length > 24) return fail("A box chart shows at most 24 groups.");
      data = { shape: "groups", groups };
      unitCols = numCols.filter((c) => c > 0 || numCols.length > 1);
      break;
    }
    case "waterfall": {
      if (valueCols.length === 0) return fail("A waterfall needs a column of numbers after the first column (the step names).");
      const c = valueCols[0];
      const totals = list("totals").map((s) => s.toLowerCase());
      const steps = table.rows.map((r, i) => {
        const raw = (r[c] ?? "").trim();
        const v = parseNum(raw);
        const isTotal = totals.includes(names[i].toLowerCase()) || (totals.includes("last") && i === table.rows.length - 1) || (v === null && raw === "");
        return { name: names[i], value: v, total: isTotal };
      });
      if (steps.every((s) => s.total)) return fail("A waterfall needs at least one step that adds or takes away. Name the totals in a line such as \"totals: Start, End\".");
      data = { shape: "steps", steps };
      unitCols = [c];
      break;
    }
    case "treemap": case "sunburst": {
      const c = numCols.filter((n) => n > 0).slice(-1)[0] ?? numCols[numCols.length - 1];
      if (c === undefined) return fail("A treemap or sunburst needs a column of numbers (the sizes) at the end.");
      const levelCols = table.head.map((_, i) => i).filter((i) => i < c && !numeric[i]).slice(0, 3);
      if (levelCols.length === 0) return fail("A treemap or sunburst needs at least one column of names before the numbers.");
      const root: TreeNode = { name: "", value: 0, children: [] };
      let used = 0;
      for (const r of table.rows) {
        const v = parseNum(r[c] ?? "");
        if (v === null || v <= 0) continue;
        used++;
        let node = root;
        for (const lc of levelCols) {
          const n = (r[lc] ?? "").trim();
          if (!n) break;
          let child = node.children.find((k) => k.name === n);
          if (!child) { child = { name: n, value: 0, children: [] }; node.children.push(child); }
          node = child;
        }
        node.value += v; // a row stops at its last filled name
      }
      if (used === 0) return fail("There is nothing to draw: no row has a size above zero.");
      // a node's value is its own rows (a row that stops at it) plus everything under it
      const sum = (n: TreeNode): number => { n.value += n.children.reduce((s, k) => s + sum(k), 0); return n.value; };
      sum(root);
      data = { shape: "tree", root, levels: levelCols.map(headName) };
      unitCols = [c];
      break;
    }
  }

  const spec: ChartSpec = {
    kind, title: (opts.get("title") ?? "").trim(), stack, labels: labelsRaw === "on" || labelsRaw === "off" ? labelsRaw : "auto",
    legend: opts.get("legend") === undefined ? true : (BOOL(opts.get("legend")!) ?? true),
    smooth: flag("smooth", false), markers: flag("markers", true), fill: flag("fill", false),
    bins: binsRaw !== null && binsRaw >= 2 ? Math.min(40, Math.round(binsRaw)) : null, lines: list("line"), totals: list("totals"),
    min: num("min"), max: num("max"), unit: unitOf(unitCols), xTitle: (opts.get("x-title") ?? "").trim(), yTitle: (opts.get("y-title") ?? "").trim(),
    height: heightRaw !== null ? Math.max(160, Math.min(900, Math.round(heightRaw))) : null,
  };
  if (spec.stack !== "none" && !["column", "bar", "area"].includes(kind)) { notes.push(`"stack" works for column, bar and area charts; it is ignored for ${kind}.`); spec.stack = "none"; }
  if (kind === "combo" && spec.lines.length === 0 && data.shape === "cat") spec.lines = [data.series[data.series.length - 1].name];
  if (kind === "combo" && data.shape === "cat") {
    const have = data.series.map((s) => s.name.toLowerCase());
    for (const l of spec.lines) if (!have.includes(l.toLowerCase())) notes.push(`The combo line "${l}" is not a column of the table.`);
  }
  return { spec, table, data, notes };
}

// ---- calculations ----

/** Where each value of a stack starts and ends. `stacked` piles positives upward and negatives downward from zero; `percent` makes every category add up to 100. */
export function stackLayout(series: Series[], cats: number, mode: "stacked" | "percent"): { y0: number; y1: number }[][] {
  const out: { y0: number; y1: number }[][] = series.map(() => []);
  for (let i = 0; i < cats; i++) {
    const total = series.reduce((s, x) => s + Math.abs(x.values[i] ?? 0), 0);
    let pos = 0, neg = 0;
    series.forEach((x, k) => {
      let v = x.values[i] ?? 0;
      if (mode === "percent") v = total > 0 ? (v / total) * 100 : 0;
      if (v >= 0) { out[k][i] = { y0: pos, y1: pos + v }; pos += v; } else { out[k][i] = { y0: neg, y1: neg + v }; neg += v; }
    });
  }
  return out;
}

/** Counts of values in equal bins on round edges. `bins` is a wish: the edges are moved to round numbers. */
export function histogram(values: number[], bins: number | null): { edges: number[]; counts: number[] } {
  const lo = Math.min(...values), hi = Math.max(...values);
  const want = bins ?? Math.max(4, Math.min(14, Math.round(Math.sqrt(values.length))));
  const t = niceTicks(lo, hi === lo ? lo + 1 : hi, want + 1);
  const edges = t.ticks;
  const counts = new Array(Math.max(1, edges.length - 1)).fill(0);
  for (const v of values) {
    let k = counts.length - 1;
    for (let j = 0; j < counts.length; j++) if (v < edges[j + 1]) { k = j; break; }
    counts[k]++;
  }
  return { edges, counts };
}

const quantile = (sorted: number[], p: number) => { const h = (sorted.length - 1) * p, f = Math.floor(h); return sorted[f] + (sorted[Math.min(f + 1, sorted.length - 1)] - sorted[f]) * (h - f); };
export type Box = { q1: number; median: number; q3: number; mean: number; low: number; high: number; outliers: number[]; n: number };
/** The five numbers of a box and whisker: quartiles by linear interpolation (Excel's QUARTILE.INC), whiskers to the furthest value inside 1.5 times the box, the rest outliers. */
export function boxStats(values: number[]): Box {
  const s = [...values].sort((a, b) => a - b);
  const q1 = quantile(s, 0.25), median = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1;
  const inside = s.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
  return { q1, median, q3, mean: s.reduce((a, b) => a + b, 0) / s.length, low: inside[0], high: inside[inside.length - 1], outliers: s.filter((v) => v < inside[0] || v > inside[inside.length - 1]), n: s.length };
}

export type WaterfallBar = { name: string; start: number; end: number; value: number; kind: "up" | "down" | "total" };
/** The bars of a waterfall: each step starts where the last ended; a total stands on zero and shows the running sum (or the number it carries, which resets the sum). */
export function waterfall(steps: { name: string; value: number | null; total: boolean }[]): WaterfallBar[] {
  let run = 0;
  return steps.map((s) => {
    if (s.total) { if (s.value !== null) run = s.value; return { name: s.name, start: 0, end: run, value: run, kind: "total" as const }; }
    const v = s.value ?? 0, start = run;
    run += v;
    return { name: s.name, start, end: run, value: v, kind: v >= 0 ? ("up" as const) : ("down" as const) };
  });
}

/** Bars largest first with the running share of the whole, as a pareto chart draws them. */
export function pareto(parts: { name: string; value: number }[]): { name: string; value: number; cum: number; share: number }[] {
  const sorted = [...parts].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, p) => s + p.value, 0) || 1;
  let run = 0;
  return sorted.map((p) => { run += p.value; return { ...p, cum: run, share: (run / total) * 100 }; });
}

/** The angles of a pie: radians from 12 o'clock, clockwise. */
export function pieSlices(values: number[]): { a0: number; a1: number }[] {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  let a = -Math.PI / 2;
  return values.map((v) => { const a0 = a; a += (v / total) * Math.PI * 2; return { a0, a1: a }; });
}

export type Rect = { x: number; y: number; w: number; h: number };
/** A squarified treemap: the items (largest first) packed into the rectangle in rows that keep every box as close to a square as they can. */
export function squarify(values: number[], rect: Rect): Rect[] {
  const total = values.reduce((s, v) => s + v, 0);
  const out: Rect[] = values.map(() => ({ x: rect.x, y: rect.y, w: 0, h: 0 }));
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return out;
  const area = values.map((v) => (v / total) * rect.w * rect.h);
  let { x, y, w, h } = rect;
  let i = 0;
  const worst = (row: number[], side: number) => { const s = row.reduce((a, b) => a + b, 0); const mx = Math.max(...row), mn = Math.min(...row); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
  while (i < area.length) {
    const side = Math.min(w, h);
    const row = [area[i]];
    let j = i + 1;
    while (j < area.length && worst([...row, area[j]], side) <= worst(row, side)) { row.push(area[j]); j++; }
    const s = row.reduce((a, b) => a + b, 0);
    if (w >= h) { // a column on the left
      const cw = s / h; let cy = y;
      row.forEach((a, k) => { const ch = a / cw; out[i + k] = { x, y: cy, w: cw, h: ch }; cy += ch; });
      x += cw; w -= cw;
    } else { // a row on the top
      const rh = s / w; let cx = x;
      row.forEach((a, k) => { const cw = a / rh; out[i + k] = { x: cx, y, w: cw, h: rh }; cx += cw; });
      y += rh; h -= rh;
    }
    i = j;
  }
  return out;
}

export type Arc = { node: TreeNode; depth: number; a0: number; a1: number; top: number; path: string[] };
/** The rings of a sunburst: each node an arc of its parent's, ring by ring from the centre, in the order of the table. */
export function sunburst(root: TreeNode, maxDepth = 3): Arc[] {
  const out: Arc[] = [];
  const walk = (n: TreeNode, depth: number, a0: number, a1: number, top: number, path: string[]) => {
    let a = a0;
    n.children.forEach((k, idx) => {
      const span = n.value > 0 ? ((a1 - a0) * k.value) / n.value : 0;
      const t = depth === 1 ? idx : top;
      const arc: Arc = { node: k, depth, a0: a, a1: a + span, top: t, path: [...path, k.name] };
      out.push(arc);
      if (depth < maxDepth) walk(k, depth + 1, arc.a0, arc.a1, t, arc.path);
      a += span;
    });
  };
  walk(root, 1, -Math.PI / 2, (3 * Math.PI) / 2, 0, []);
  return out;
}

/** A smooth curve through the points that never overshoots them (monotone cubic), as an SVG path. */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n < 3) return "M" + pts.map((p) => p.join(" ")).join("L");
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]), m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (dx[i] || 1));
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += `C${pts[i][0] + h} ${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h} ${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]} ${pts[i + 1][1]}`; }
  return d;
}

/** A bar with a stepped (pixel) corner at its free end: the corners of that end are cut by `cut` pixels. `end` says which side is the free end. */
export function barPath(x: number, y: number, w: number, h: number, end: "top" | "bottom" | "left" | "right" | null, cut = 2): string {
  const c = Math.min(cut, w / 2, h / 2);
  if (!end || c < 1) return `M${x} ${y}h${w}v${h}h${-w}z`;
  if (end === "top") return `M${x} ${y + h}V${y + c}h${c}V${y}H${x + w - c}v${c}h${c}V${y + h}z`;
  if (end === "bottom") return `M${x} ${y}V${y + h - c}h${c}v${c}H${x + w - c}v${-c}h${c}V${y}z`;
  if (end === "right") return `M${x} ${y}H${x + w - c}v${c}h${c}V${y + h - c}h${-c}v${c}H${x}z`;
  return `M${x + w} ${y}H${x + c}v${c}h${-c}V${y + h - c}h${c}v${c}H${x + w}z`;
}

/** A ring segment as an SVG path (radians; r0 = 0 gives a pie slice). */
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const span = Math.min(a1 - a0, Math.PI * 2 - 1e-4);
  const e = a0 + span, big = span > Math.PI ? 1 : 0;
  const P = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  if (r0 <= 0.5) return `M${cx} ${cy}L${P(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${P(r1, e)}Z`;
  return `M${P(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${P(r1, e)}L${P(r0, e)}A${r0} ${r0} 0 ${big} 0 ${P(r0, a0)}Z`;
}

/** The table behind a chart as markdown, for Copy. */
export function tableText(t: Table): string {
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  return [t.head, t.head.map(() => "---"), ...t.rows].map((r) => "| " + r.map(cell).join(" | ") + " |").join("\n");
}
