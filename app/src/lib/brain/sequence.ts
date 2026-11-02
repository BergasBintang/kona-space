// Sequence diagrams in a markdown file (```mermaid, first line `sequenceDiagram`): who talks to whom, in order, top to bottom.
// Drawn: participants and actors, messages (solid and dotted, with the arrow kinds), notes, `autonumber`, and the frames loop, alt, opt, par and the like as a labelled divider.
// Skipped without a word: activations (`activate`, `+` and `-` on an arrow), titles and boxes. The text stays the single truth, like the flowcharts (graph.ts).

export type Part = { id: string; label: string; actor: boolean };
export type Msg = { kind: "msg"; from: string; to: string; text: string; dotted: boolean; head: "filled" | "open" | "cross" | "none" };
export type Note = { kind: "note"; side: "left" | "right" | "over"; over: string[]; text: string };
export type Band = { kind: "band"; word: string; text: string };
export type Seq = { parts: Part[]; items: (Msg | Note | Band)[]; numbered: boolean };

export const MAX_PARTS = 12, MAX_ITEMS = 80;

const ID = String.raw`[\p{L}\p{N}_]+`;
const MESSAGE = new RegExp(String.raw`^(${ID})\s*(-->>|->>|--x|-x|--\)|-\)|-->|->)\s*[+-]?(${ID})\s*:\s*(.*)$`, "u");
const NOTE = new RegExp(String.raw`^note\s+(left of|right of|over)\s+(${ID})(?:\s*,\s*(${ID}))?\s*:\s*(.*)$`, "iu");
const DECLARE = new RegExp(String.raw`^(participant|actor)\s+(${ID})(?:\s+as\s+(.+))?$`, "u");
const FRAME = /^(loop|alt|opt|par|critical|break|rect)\b\s*(.*)$/;
const TIDY = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();

export function parseSequence(src: string): { ok: true; seq: Seq } | { ok: false; error: string } {
  const lines = src.replace(/\r/g, "").split("\n").map((l, i) => ({ n: i + 1, t: l.trim() })).filter((l) => l.t !== "" && !l.t.startsWith("%%"));
  if (lines.length === 0 || lines[0].t !== "sequenceDiagram") return { ok: false, error: `A sequence diagram starts with "sequenceDiagram".` };
  const parts: Part[] = [], items: Seq["items"] = [];
  let numbered = false;
  const part = (id: string) => { let p = parts.find((x) => x.id === id); if (!p) { p = { id, label: id, actor: false }; parts.push(p); } return p; };
  for (const { n, t } of lines.slice(1)) {
    const d = DECLARE.exec(t);
    if (d) { const p = part(d[2]); p.actor = d[1] === "actor"; if (d[3]) p.label = TIDY(d[3]); continue; }
    if (t === "autonumber") { numbered = true; continue; }
    if (/^(activate|deactivate|title|box)\b/.test(t) || t === "end") continue;
    const m = MESSAGE.exec(t);
    if (m) {
      const op = m[2];
      part(m[1]); part(m[3]);
      items.push({ kind: "msg", from: m[1], to: m[3], text: TIDY(m[4]), dotted: op.startsWith("--"), head: op.endsWith(">>") ? "filled" : op.endsWith(")") ? "open" : op.endsWith("x") ? "cross" : "none" });
      continue;
    }
    const nt = NOTE.exec(t);
    if (nt) {
      const side = nt[1].toLowerCase().replace(" of", "") as Note["side"];
      part(nt[2]); if (nt[3]) part(nt[3]);
      items.push({ kind: "note", side, over: [nt[2], ...(nt[3] ? [nt[3]] : [])], text: TIDY(nt[4]) });
      continue;
    }
    const f = FRAME.exec(t);
    if (f) { items.push({ kind: "band", word: f[1], text: TIDY(f[2]) }); continue; }
    const e = /^(else|and|option)\b\s*(.*)$/.exec(t);
    if (e) { items.push({ kind: "band", word: e[1], text: TIDY(e[2]) }); continue; }
    return { ok: false, error: `Line ${n}: "${t.slice(0, 50)}" is not a participant, a message or a note.` };
  }
  if (parts.length === 0) return { ok: false, error: "The diagram has nobody in it." };
  if (parts.length > MAX_PARTS) return { ok: false, error: `The diagram has ${parts.length} participants. Kona draws up to ${MAX_PARTS}; split it into two diagrams.` };
  if (items.length > MAX_ITEMS) return { ok: false, error: `The diagram has ${items.length} steps. Kona draws up to ${MAX_ITEMS}; split it into two diagrams.` };
  return { ok: true, seq: { parts, items, numbered } };
}

export type PPart = Part & { x: number; w: number; y: number; h: number; lines: string[] };
export type Row =
  | { kind: "msg"; y: number; x1: number; x2: number; lines: string[]; dotted: boolean; head: Msg["head"]; self: boolean; n?: number }
  | { kind: "note"; y: number; x: number; w: number; h: number; lines: string[] }
  | { kind: "band"; y: number; word: string; text: string };
export type SeqLayout = { width: number; height: number; parts: PPart[]; lifeTop: number; lifeBottom: number; rows: Row[] };

const LH = 18, PAD = 20;

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const w of para.split(/\s+/).filter(Boolean)) { if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
    out.push(cur);
  }
  return out;
}

/** Places the participants along the top and the steps below them. A message is as wide as it needs: the gaps between the columns it crosses grow until its words fit. */
export function layoutSequence(s: Seq, charW = 8): SeqLayout {
  const idx = new Map(s.parts.map((p, i) => [p.id, i]));
  const pl = s.parts.map((p) => { const lines = wrap(p.label, 18); return { ...p, lines, w: Math.max(96, Math.max(...lines.map((l) => l.length)) * charW + 28), h: lines.length * LH + 20 }; });
  const gap = pl.slice(1).map((_, i) => Math.max(40, (pl[i].w + pl[i + 1].w) / 2 + 24)); // between the centres of column i and i + 1
  const widen = (a: number, b: number, need: number) => { const lo = Math.min(a, b), hi = Math.max(a, b); if (lo === hi) return; const have = gap.slice(lo, hi).reduce((x, y) => x + y, 0); if (have < need) for (let k = lo; k < hi; k++) gap[k] += (need - have) / (hi - lo); };
  let rightRoom = 0;
  for (const it of s.items) {
    if (it.kind === "msg") {
      const a = idx.get(it.from)!, b = idx.get(it.to)!;
      const tw = Math.max(...wrap(it.text, 34).map((l) => l.length)) * charW + 28;
      if (a === b) { if (a === pl.length - 1) rightRoom = Math.max(rightRoom, tw + 40); else widen(a, a + 1, tw + 40 + pl[a].w / 2); } else widen(a, b, tw);
    } else if (it.kind === "note") {
      const tw = Math.max(...wrap(it.text, 30).map((l) => l.length)) * charW + 24;
      const a = idx.get(it.over[0])!, b = idx.get(it.over[it.over.length - 1])!;
      if (it.side === "over" && a !== b) widen(a, b, tw); else if (it.side === "right") { if (a === pl.length - 1) rightRoom = Math.max(rightRoom, tw + 30); else widen(a, a + 1, tw + 40); } else if (it.side === "left" && a > 0) widen(a - 1, a, tw + 40);
    }
  }
  const leftRoom = Math.max(0, ...s.items.filter((i): i is Note => i.kind === "note" && i.side === "left" && idx.get(i.over[0]) === 0).map((i) => Math.max(...wrap(i.text, 30).map((l) => l.length)) * charW + 54 - pl[0].w / 2));
  let x = PAD + Math.max(pl[0].w / 2, leftRoom + pl[0].w / 2);
  const parts: PPart[] = pl.map((p, i) => { if (i > 0) x += gap[i - 1]; return { ...p, x, y: PAD, h: p.h }; });
  const top = Math.max(...parts.map((p) => p.h));
  parts.forEach((p) => { p.y = PAD; p.h = top; });
  const lifeTop = PAD + top;
  let y = lifeTop + 26, n = 0;
  const rows: Row[] = [];
  for (const it of s.items) {
    if (it.kind === "msg") {
      const a = parts[idx.get(it.from)!], b = parts[idx.get(it.to)!];
      const lines = it.text ? wrap(it.text, 34) : [];
      const self = a === b;
      const h = lines.length * LH + (self ? 34 : 14);
      rows.push({ kind: "msg", y: y + lines.length * LH + (self ? 4 : 8), x1: a.x, x2: b.x, lines, dotted: it.dotted, head: it.head, self, n: s.numbered ? ++n : undefined });
      y += h + 12;
    } else if (it.kind === "note") {
      const lines = wrap(it.text, 30);
      const w = Math.max(...lines.map((l) => l.length)) * charW + 24, h = lines.length * LH + 16;
      const a = parts[idx.get(it.over[0])!], b = parts[idx.get(it.over[it.over.length - 1])!];
      const cx = it.side === "over" ? (a.x + b.x) / 2 : it.side === "right" ? a.x + 20 + w / 2 : a.x - 20 - w / 2;
      const span = it.side === "over" ? Math.max(w, Math.abs(b.x - a.x) + 40) : w;
      rows.push({ kind: "note", y, x: cx, w: span, h, lines });
      y += h + 12;
    } else {
      rows.push({ kind: "band", y: y + 8, word: it.word, text: it.text });
      y += 30;
    }
  }
  const lifeBottom = y;
  // the picture is as wide as its parts and notes reach, moved so that nothing is cut off on the left
  const last = parts[parts.length - 1];
  let left = Infinity, right = last.x + rightRoom;
  for (const p of parts) { left = Math.min(left, p.x - p.w / 2); right = Math.max(right, p.x + p.w / 2); }
  for (const r of rows) if (r.kind === "note") { left = Math.min(left, r.x - r.w / 2); right = Math.max(right, r.x + r.w / 2); }
  const dx = PAD - left;
  parts.forEach((p) => { p.x += dx; });
  for (const r of rows) { if (r.kind === "msg") { r.x1 += dx; r.x2 += dx; } else if (r.kind === "note") r.x += dx; }
  return { width: Math.ceil(right + dx + PAD), height: Math.ceil(lifeBottom + PAD), parts, lifeTop, lifeBottom, rows };
}

/** The diagram in plain words, for a screen reader and the picture's tooltip. */
export function describeSequence(s: Seq): string {
  const name = (id: string) => s.parts.find((p) => p.id === id)?.label.replace(/\n/g, " ") ?? id;
  const steps = s.items.filter((i): i is Msg => i.kind === "msg").slice(0, 12).map((m) => `${name(m.from)} to ${name(m.to)}${m.text ? `: ${m.text.replace(/\n/g, " ")}` : ""}`);
  return `Sequence of ${s.parts.length} participants. ${steps.join(". ")}`;
}
