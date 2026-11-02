// Diagrams in a markdown file. A fenced block written as ```mermaid holds a flowchart in Mermaid's own plain-text form: a person reads the text,
// an agent reads and writes the text, and the reader draws the picture. Only flowcharts are drawn (`flowchart TD` or `graph LR`), and only the
// parts that carry meaning: boxes, arrows, words on arrows. Colours, classes and subgraph frames are skipped, so the source stays the single truth.
// The layout is a small layered one: boxes go in rows from the start to the end, rows are ordered to keep arrows from crossing, and an arrow
// that skips rows bends around the boxes between.

export type Dir = "TB" | "BT" | "LR" | "RL";
export type Shape = "box" | "round" | "stadium" | "diamond" | "circle" | "start" | "end";
export type GNode = { id: string; label: string; shape: Shape };
export type GEdge = { from: string; to: string; label: string; line: "solid" | "dotted" | "thick"; arrow: "end" | "both" | "none" };
export type Graph = { dir: Dir; nodes: GNode[]; edges: GEdge[] };

export const MAX_NODES = 60;

const ID = /^[\p{L}\p{N}_]+/u;
const OPENERS: [string, string, Shape][] = [["((", "))", "circle"], ["([", "])", "stadium"], ["[(", ")]", "box"], ["{{", "}}", "diamond"], ["[[", "]]", "box"], ["[", "]", "box"], ["(", ")", "round"], ["{", "}", "diamond"]];
const SKIP = /^(subgraph\b|end\s*$|direction\b|classDef\b|class\b|style\b|linkStyle\b|click\b|accTitle\b|accDescr\b)/;

const tidy = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/^`+|`+$/g, "").trim();

type Read = { ids: string[]; p: number };

class Reader {
  line: string;
  nodes: Map<string, GNode>;
  edges: GEdge[];
  constructor(line: string, nodes: Map<string, GNode>, edges: GEdge[]) { this.line = line; this.nodes = nodes; this.edges = edges; }

  private ws(p: number) { while (p < this.line.length && /\s/.test(this.line[p])) p++; return p; }

  private define(id: string, label: string | null, shape: Shape | null) {
    const had = this.nodes.get(id);
    if (!had) this.nodes.set(id, { id, label: label ?? id, shape: shape ?? "box" });
    else if (label !== null) { had.label = label; had.shape = shape ?? had.shape; }
  }

  /** One box, or several joined by `&` ("A & B --> C"). */
  private node(p: number): Read | { error: string } | null {
    const s = this.line, ids: string[] = [];
    for (;;) {
      p = this.ws(p);
      const m = ID.exec(s.slice(p));
      if (!m) return ids.length ? { error: `a box name is missing after "&"` } : null;
      const id = m[0]; p += id.length;
      let label: string | null = null, shape: Shape | null = null;
      for (const [open, close, sh] of OPENERS) {
        if (!s.startsWith(open, p)) continue;
        let rest = s.slice(p + open.length), text: string, used: number;
        if (rest.trimStart().startsWith('"')) {
          const lead = rest.length - rest.trimStart().length;
          const q = rest.indexOf('"', lead + 1);
          if (q < 0) return { error: `a quote is not closed in "${s.trim()}"` };
          text = rest.slice(lead + 1, q);
          const after = rest.slice(q + 1);
          const trim = after.length - after.trimStart().length;
          if (!after.trimStart().startsWith(close)) return { error: `expected "${close}" after the label of ${id}` };
          used = q + 1 + trim + close.length;
        } else {
          const e = rest.indexOf(close);
          if (e < 0) return { error: `"${open}" is not closed with "${close}" in "${s.trim()}"` };
          text = rest.slice(0, e); used = e + close.length;
        }
        label = tidy(text) || id; shape = sh; p += open.length + used;
        break;
      }
      const cls = /^:::[\w-]+/.exec(s.slice(p));
      if (cls) p += cls[0].length;
      this.define(id, label, shape);
      ids.push(id);
      const q = this.ws(p);
      if (s[q] === "&") { p = q + 1; continue; }
      return { ids, p };
    }
  }

  /** An arrow: `-->`, `---`, `-.->`, `==>`, with its words as `-->|words|` or `-- words -->`. */
  private op(p: number): { p: number; line: GEdge["line"]; arrow: GEdge["arrow"]; label: string } | null {
    p = this.ws(p);
    const s = this.line.slice(p);
    const pick = (len: number, body: string, label: string) => {
      const line: GEdge["line"] = body.includes(".") ? "dotted" : body.includes("=") ? "thick" : "solid";
      const arrow: GEdge["arrow"] = body.startsWith("<") ? "both" : body.endsWith(">") ? "end" : "none";
      return { p: p + len, line, arrow, label };
    };
    let m = /^(--|==|-\.)\s+(.+?)\s+(-->|---|==>|===|\.->|\.-)/.exec(s);
    if (m && !/^(-->|---|==>|===)/.test(s)) return pick(m[0].length, m[1] + m[3], tidy(m[2]));
    m = /^(<?(?:-{2,}>|-{3,}|={2,}>|={3,}|-\.+->|-\.+-))\s*(?:\|([^|]*)\|)?/.exec(s);
    if (!m) return null;
    return pick(m[0].length, m[1], tidy(m[2] ?? ""));
  }

  statement(): string | null {
    const s = this.line;
    let prev = this.node(0);
    if (!prev) return `"${s.trim()}" is not a box or an arrow`;
    if ("error" in prev) return prev.error;
    for (;;) {
      const op = this.op(prev.p);
      if (!op) break;
      const next = this.node(op.p);
      if (!next) return `an arrow in "${s.trim()}" points at nothing`;
      if ("error" in next) return next.error;
      for (const a of prev.ids) for (const b of next.ids) this.edges.push({ from: a, to: b, label: op.label, line: op.line, arrow: op.arrow });
      prev = next;
    }
    const rest = s.slice(this.ws(prev.p));
    return rest ? `"${rest}" is left over in "${s.trim()}"` : null;
  }
}

/** Split a line at `;` that sit outside brackets and quotes ("A-->B; B-->C"). */
function statements(line: string): string[] {
  const out: string[] = [];
  let cur = "", depth = 0, quote = false;
  for (const ch of line) {
    if (ch === '"') quote = !quote;
    else if (!quote && "[({".includes(ch)) depth++;
    else if (!quote && "])}".includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === ";" && !quote && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

export function parseGraph(src: string): { ok: true; graph: Graph } | { ok: false; error: string } {
  // every statement with the number of the line it stands on ("graph TD; A-->B" holds three on one line)
  const items: { n: number; text: string }[] = [];
  src.replace(/\r/g, "").split("\n").forEach((l, i) => { const t = l.trim(); if (t && !t.startsWith("%%")) for (const text of statements(t)) items.push({ n: i + 1, text }); });
  if (items.length === 0) return { ok: false, error: "The diagram is empty." };
  const head = /^(flowchart|graph)(?:\s+(TB|TD|BT|RL|LR))?$/i.exec(items[0].text);
  if (!head) return { ok: false, error: `Kona draws flowcharts, written "flowchart TD" (top to bottom) or "flowchart LR" (left to right). This one starts with "${items[0].text.slice(0, 40)}".` };
  const dir = ((head[2] ?? "TB").toUpperCase().replace("TD", "TB")) as Dir;
  const nodes = new Map<string, GNode>(), edges: GEdge[] = [];
  for (const { n, text } of items.slice(1)) {
    if (SKIP.test(text)) continue;
    const bad = new Reader(text, nodes, edges).statement();
    if (bad) return { ok: false, error: `Line ${n}: ${bad}.` };
  }
  if (nodes.size === 0) return { ok: false, error: "The diagram has no boxes." };
  if (nodes.size > MAX_NODES) return { ok: false, error: `The diagram has ${nodes.size} boxes. Kona draws up to ${MAX_NODES}; split it into two diagrams.` };
  return { ok: true, graph: { dir, nodes: [...nodes.values()], edges } };
}

/** Which kind of diagram a block holds, by its first line: "flow", "sequence", "state", or the word it starts with when Kona cannot draw it. */
export function diagramKind(src: string): string {
  const first = src.replace(/\r/g, "").split("\n").map((l) => l.trim()).find((l) => l !== "" && !l.startsWith("%%")) ?? "";
  const word = /^[A-Za-z][\w-]*/.exec(first)?.[0] ?? "";
  if (/^(flowchart|graph)$/i.test(word)) return "flow";
  if (word === "sequenceDiagram") return "sequence";
  if (/^stateDiagram(-v2)?$/.test(word)) return "state";
  return word || "empty";
}

const STATE = String.raw`\[\*\]|[\p{L}\p{N}_]+`;
const TRANSITION = new RegExp(String.raw`^(${STATE})\s*-->\s*(${STATE})\s*(?::\s*(.*))?$`, "u");

/** A state diagram (`stateDiagram-v2`) as the same boxes and arrows as a flowchart: states are rounded boxes, `[*]` is the start dot going out and the end ring going in. */
export function parseState(src: string): { ok: true; graph: Graph } | { ok: false; error: string } {
  const lines = src.replace(/\r/g, "").split("\n").map((l, i) => ({ n: i + 1, t: l.trim() })).filter((l) => l.t !== "" && !l.t.startsWith("%%"));
  if (lines.length === 0 || diagramKind(src) !== "state") return { ok: false, error: `A state diagram starts with "stateDiagram-v2".` };
  let dir: Dir = "TB";
  const nodes = new Map<string, GNode>(), edges: GEdge[] = [];
  const need = (id: string, end: boolean): string => {
    if (id !== "[*]") { if (!nodes.has(id)) nodes.set(id, { id, label: id, shape: "round" }); return id; }
    const key = end ? "__end" : "__start";
    if (!nodes.has(key)) nodes.set(key, { id: key, label: "", shape: end ? "end" : "start" });
    return key;
  };
  let inNote = false;
  for (const { n, t } of lines.slice(1)) {
    if (inNote) { if (/^end note$/i.test(t)) inNote = false; continue; }
    if (/^note\b/i.test(t)) { if (!t.includes(":")) inNote = true; continue; }
    const d = /^direction\s+(TB|TD|BT|RL|LR)$/i.exec(t);
    if (d) { dir = d[1].toUpperCase().replace("TD", "TB") as Dir; continue; }
    if (t === "}" || t === "--" || /^state\s+[\p{L}\p{N}_]+\s*\{$/u.test(t)) { const c = /^state\s+([\p{L}\p{N}_]+)/u.exec(t); if (c) need(c[1], false); continue; }
    const named = /^state\s+"([^"]*)"\s+as\s+([\p{L}\p{N}_]+)$/u.exec(t);
    if (named) { need(named[2], false); nodes.get(named[2])!.label = named[1]; continue; }
    const kind = /^state\s+([\p{L}\p{N}_]+)\s+<<(choice|fork|join)>>$/u.exec(t);
    if (kind) { need(kind[1], false); const node = nodes.get(kind[1])!; if (kind[2] === "choice") { node.shape = "diamond"; node.label = ""; } else node.shape = "box"; continue; }
    const tr = TRANSITION.exec(t);
    if (tr) { const a = need(tr[1], false), b = need(tr[2], true); edges.push({ from: a, to: b, label: (tr[3] ?? "").trim(), line: "solid", arrow: "end" }); continue; }
    const desc = /^([\p{L}\p{N}_]+)\s*:\s*(.+)$/u.exec(t);
    if (desc) { need(desc[1], false); const node = nodes.get(desc[1])!; node.label = node.label === desc[1] ? `${desc[1]}\n${desc[2].trim()}` : `${node.label}\n${desc[2].trim()}`; continue; }
    return { ok: false, error: `Line ${n}: "${t.slice(0, 50)}" is not a state or a move between states.` };
  }
  if (nodes.size === 0) return { ok: false, error: "The diagram has no states." };
  if (nodes.size > MAX_NODES) return { ok: false, error: `The diagram has ${nodes.size} states. Kona draws up to ${MAX_NODES}; split it into two diagrams.` };
  return { ok: true, graph: { dir, nodes: [...nodes.values()], edges } };
}

/** The diagram in one plain line each, for a screen reader and for the picture's tooltip. */
export function describe(g: Graph): string {
  const name = (id: string) => {
    const n = g.nodes.find((x) => x.id === id);
    if (!n) return id;
    return n.label.trim() ? n.label.replace(/\n/g, " ") : n.shape === "start" ? "the start" : n.shape === "end" ? "the end" : "a choice";
  };
  const steps = g.edges.slice(0, 12).map((e) => `${name(e.from)} to ${name(e.to)}${e.label ? ` (${e.label.replace(/\n/g, " ")})` : ""}`);
  return `Diagram of ${g.nodes.length} boxes. ${steps.join(". ")}${g.edges.length > 12 ? `. And ${g.edges.length - 12} more arrows.` : ""}`;
}

// ---- layout ----

export type PNode = GNode & { x: number; y: number; w: number; h: number; lines: string[] };
export type PEdge = GEdge & { path: string; lx: number; ly: number; lw: number };
export type Layout = { width: number; height: number; nodes: PNode[]; edges: PEdge[] };

const LINE_H = 18, WRAP = 22, PAD = 20;

function wrap(label: string): string[] {
  const out: string[] = [];
  for (const para of label.split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (cur && (cur + " " + word).length > WRAP) { out.push(cur); cur = word; } else cur = cur ? cur + " " + word : word;
    }
    out.push(cur);
  }
  return out;
}

function sizeOf(n: GNode, charW: number): { lines: string[]; w: number; h: number } {
  const lines = wrap(n.label);
  const tw = Math.max(...lines.map((l) => l.length)) * charW, th = lines.length * LINE_H;
  switch (n.shape) {
    case "diamond": return { lines, w: Math.round(tw * 1.5 + 36), h: Math.round(th * 1.6 + 30) };
    case "start": return { lines: [""], w: 22, h: 22 };
    case "end": return { lines: [""], w: 28, h: 28 };
    case "circle": { const d = Math.round(Math.sqrt(tw * tw + th * th) + 18); return { lines, w: Math.max(d, 52), h: Math.max(d, 52) }; }
    case "stadium": return { lines, w: Math.max(Math.round(tw + 48), 64), h: Math.max(th + 20, 40) };
    default: return { lines, w: Math.max(Math.round(tw + 32), 64), h: Math.max(th + 20, 40) };
  }
}

/** Places the boxes and bends the arrows. `charW` is the width of one character of a label (the reader measures it; the tests use the default). */
export function layoutGraph(g: Graph, charW = 8): Layout {
  const horiz = g.dir === "LR" || g.dir === "RL";
  const idx = new Map(g.nodes.map((n, i) => [n.id, i]));
  const N = g.nodes.length;
  const sizes = g.nodes.map((n) => sizeOf(n, charW));

  // arrows between two different boxes; an arrow from a box to itself is drawn as a loop after the layout
  type E = { ref: GEdge; a: number; b: number; rev: boolean };
  const real: E[] = [];
  const loops: GEdge[] = [];
  for (const e of g.edges) {
    const a = idx.get(e.from), b = idx.get(e.to);
    if (a === undefined || b === undefined) continue;
    if (a === b) loops.push(e); else real.push({ ref: e, a, b, rev: false });
  }

  // 1. a cycle is broken by turning one arrow around for the layout (it is still drawn pointing the right way)
  const out: number[][] = Array.from({ length: N }, () => []);
  real.forEach((e, i) => out[e.a].push(i));
  const state = new Array<number>(N).fill(0);
  const visit = (u: number) => {
    state[u] = 1;
    for (const i of out[u]) { const v = real[i].b; if (state[v] === 1) real[i].rev = true; else if (state[v] === 0) visit(v); }
    state[u] = 2;
  };
  for (let u = 0; u < N; u++) if (state[u] === 0) visit(u);
  const eff = real.map((e) => (e.rev ? { ...e, a: e.b, b: e.a } : e));

  // 2. each box goes one row below the lowest box that points at it
  const indeg = new Array<number>(N).fill(0);
  const succ: number[][] = Array.from({ length: N }, () => []);
  for (const e of eff) { indeg[e.b]++; succ[e.a].push(e.b); }
  const row = new Array<number>(N).fill(0);
  const queue: number[] = [];
  for (let u = 0; u < N; u++) if (indeg[u] === 0) queue.push(u);
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const v of succ[u]) { row[v] = Math.max(row[v], row[u] + 1); if (--indeg[v] === 0) queue.push(v); }
  }

  // 3. an arrow that skips rows gets a stand-in point on every row it crosses, so rows can be ordered around it
  const rowOf: number[] = [...row];
  const across: number[] = sizes.map((s) => (horiz ? s.h : s.w)); // size across the flow
  const along: number[] = sizes.map((s) => (horiz ? s.w : s.h)); // size along the flow
  const chains: number[][] = [];
  for (const e of eff) {
    const chain = [e.a];
    for (let r = row[e.a] + 1; r < row[e.b]; r++) { rowOf.push(r); across.push(10); along.push(0); chain.push(rowOf.length - 1); }
    chain.push(e.b);
    chains.push(chain);
  }
  const V = rowOf.length;
  const rows: number[][] = [];
  for (let v = 0; v < V; v++) (rows[rowOf[v]] ??= []).push(v);
  const up: number[][] = Array.from({ length: V }, () => []), down: number[][] = Array.from({ length: V }, () => []);
  for (const ch of chains) for (let i = 0; i + 1 < ch.length; i++) { down[ch[i]].push(ch[i + 1]); up[ch[i + 1]].push(ch[i]); }

  // 4. order each row by where its neighbours stand, a few sweeps down and up
  const pos = new Array<number>(V).fill(0);
  const renumber = () => rows.forEach((r) => r.forEach((v, i) => { pos[v] = i; }));
  renumber();
  const sweep = (r: number[], nb: number[][]) => {
    const key = new Map<number, number>();
    r.forEach((v) => key.set(v, nb[v].length ? nb[v].reduce((s, w) => s + pos[w], 0) / nb[v].length : pos[v]));
    r.sort((x, y) => key.get(x)! - key.get(y)! || pos[x] - pos[y]);
    r.forEach((v, i) => { pos[v] = i; });
  };
  for (let it = 0; it < 6; it++) {
    for (let r = 1; r < rows.length; r++) sweep(rows[r], up);
    for (let r = rows.length - 2; r >= 0; r--) sweep(rows[r], down);
  }

  // 5. across the flow: pack each row, centre it, then pull every box toward the middle of its neighbours without letting boxes touch
  const GAP = 36;
  const c = new Array<number>(V).fill(0);
  for (const r of rows) {
    let x = 0;
    for (const v of r) { c[v] = x + across[v] / 2; x += across[v] + GAP; }
    const centre = (x - GAP) / 2;
    for (const v of r) c[v] -= centre;
  }
  const settle = (r: number[], nb: number[][]) => {
    const want = r.map((v) => (nb[v].length ? nb[v].reduce((s, w) => s + c[w], 0) / nb[v].length : c[v]));
    r.forEach((v, i) => { c[v] = want[i]; });
    for (let i = 1; i < r.length; i++) c[r[i]] = Math.max(c[r[i]], c[r[i - 1]] + (across[r[i - 1]] + across[r[i]]) / 2 + GAP);
    for (let i = r.length - 2; i >= 0; i--) c[r[i]] = Math.min(c[r[i]], c[r[i + 1]] - (across[r[i]] + across[r[i + 1]]) / 2 - GAP);
    // the right-to-left pass can pull boxes onto each other's left side again: one more left-to-right pass restores the gaps
    for (let i = 1; i < r.length; i++) c[r[i]] = Math.max(c[r[i]], c[r[i - 1]] + (across[r[i - 1]] + across[r[i]]) / 2 + GAP);
  };
  for (let it = 0; it < 4; it++) {
    for (let r = 1; r < rows.length; r++) settle(rows[r], up);
    for (let r = rows.length - 2; r >= 0; r--) settle(rows[r], down);
  }

  // 6. along the flow: each row is as thick as its thickest box; arrows with words get more room
  const wordy = g.edges.some((e) => e.label);
  const labelW = (t: string) => Math.max(...t.split("\n").map((l) => l.length)) * 7 + 12;
  // left to right, the words of an arrow sit between two boxes along the flow, so that gap is as wide as the longest of them (and a little more)
  const space = !wordy ? 58 : horiz ? Math.max(78, Math.max(...g.edges.map((e) => (e.label ? labelW(e.label) : 0))) + 56) : 78;
  const mid: number[] = [];
  let m = 0;
  rows.forEach((r, i) => { const t = Math.max(0, ...r.map((v) => along[v])); mid[i] = m + t / 2; m += t + space; });
  const total = m - space;

  // 7. to the page: top-to-bottom puts the flow on y, left-to-right on x; the other two directions mirror them
  const flip = g.dir === "BT" || g.dir === "RL";
  const at = (v: number): [number, number] => {
    const a = flip ? total - mid[rowOf[v]] : mid[rowOf[v]];
    return horiz ? [a, c[v]] : [c[v], a];
  };
  const nodes: PNode[] = g.nodes.map((n, i) => {
    const [x, y] = at(i);
    return { ...n, x, y, w: sizes[i].w, h: sizes[i].h, lines: sizes[i].lines };
  });

  // 8. arrows: leave the box on the side facing the flow, pass the stand-in points, arrive on the side facing back
  const edges: PEdge[] = [];
  eff.forEach((e, i) => {
    const ch = chains[i];
    const pts: [number, number][] = ch.map((v, k) => {
      const [x, y] = at(v);
      if (k !== 0 && k !== ch.length - 1) return [x, y];
      const half = along[v] / 2, dir = (k === 0 ? 1 : -1) * (flip ? -1 : 1);
      return horiz ? [x + dir * half, y] : [x, y + dir * half];
    });
    if (e.rev) pts.reverse();
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let k = 1; k < pts.length; k++) {
      const [px, py] = pts[k - 1], [qx, qy] = pts[k];
      d += horiz
        ? ` C ${((px + qx) / 2).toFixed(1)} ${py.toFixed(1)} ${((px + qx) / 2).toFixed(1)} ${qy.toFixed(1)} ${qx.toFixed(1)} ${qy.toFixed(1)}`
        : ` C ${px.toFixed(1)} ${((py + qy) / 2).toFixed(1)} ${qx.toFixed(1)} ${((py + qy) / 2).toFixed(1)} ${qx.toFixed(1)} ${qy.toFixed(1)}`;
    }
    const k = Math.floor((pts.length - 1) / 2);
    edges.push({ ...e.ref, path: d, lx: (pts[k][0] + pts[k + 1][0]) / 2, ly: (pts[k][1] + pts[k + 1][1]) / 2, lw: e.ref.label ? labelW(e.ref.label) : 0 });
  });
  for (const e of loops) {
    const n = nodes[idx.get(e.from)!];
    const x = n.x + n.w / 2, y = n.y;
    edges.push({ ...e, path: `M ${x} ${y - 8} C ${x + 38} ${y - 30} ${x + 38} ${y + 30} ${x} ${y + 8}`, lx: x + 44 + (e.label ? labelW(e.label) / 2 : 0), ly: y, lw: e.label ? labelW(e.label) : 0 });
  }

  // 9. move everything so nothing is cut off at the left or the top
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (l: number, t: number, r: number, b: number) => { x0 = Math.min(x0, l); y0 = Math.min(y0, t); x1 = Math.max(x1, r); y1 = Math.max(y1, b); };
  for (const n of nodes) grow(n.x - n.w / 2, n.y - n.h / 2, n.x + n.w / 2, n.y + n.h / 2);
  for (const e of edges) if (e.lw) grow(e.lx - e.lw / 2, e.ly - 10, e.lx + e.lw / 2, e.ly + 10);
  const dx = PAD - x0, dy = PAD - y0;
  for (const n of nodes) { n.x += dx; n.y += dy; }
  for (const e of edges) {
    e.lx += dx; e.ly += dy;
    e.path = e.path.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, a: string, b: string) => `${(Number(a) + dx).toFixed(1)} ${(Number(b) + dy).toFixed(1)}`);
  }
  return { width: Math.ceil(x1 - x0 + PAD * 2), height: Math.ceil(y1 - y0 + PAD * 2), nodes, edges };
}
