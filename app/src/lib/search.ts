// Smart search: the matcher every list in Kona uses (select with a search row, multi select, combobox).
// A port of the Miralis canon's reference matcher (guide section 26, `window.MiSearch`), so a search behaves the same everywhere.
//
//  1. Lower-case, remove accents.
//  2. Split into words at spaces and at - _ . , / ( ) &
//  3. Every word of the query must match (any order).
//  4. A word scores by its best match: exact 100, the text starts with it 90, a word starts with it 80 (less 2 for each place
//     after the first, not below 70), initials 60, contained 45, one typo 27, two typos 19 (only in a word of 6+ letters),
//     letters in order 12. A hint (the second line) counts at 0.6.
//  5. Rank by the average word score, plus 10 when the whole query is a prefix of the text. Ties keep their order.
//  6. Say why it matched: return the letters to mark.
// A word of one or two letters is never forgiven for a typo.

export type Option = { value: string; label: string; hint?: string; disabled?: boolean };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const SPLIT = /[\s\-_.,/()&]+/;
const words = (s: string) => s.split(SPLIT).filter(Boolean);

type Field = { t: string; w: string[]; ini: string };
const field = (s: string): Field => { const t = norm(s); const w = words(t); return { t, w, ini: w.map((x) => x[0]).join("") }; };

/** Edit distance, with two swapped neighbouring letters counted as one typo. */
function dist(a: string, b: string): number {
  let p2: number[] | null = null;
  let p1 = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(p1[j] + 1, row[j - 1] + 1, p1[j - 1] + c);
      if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], p2[j - 2] + 1);
    }
    p2 = p1; p1 = row;
  }
  return p1[b.length];
}

function subsequence(q: string, t: string): boolean {
  let i = 0;
  for (let j = 0; j < t.length && i < q.length; j++) if (t[j] === q[i]) i++;
  return i === q.length;
}

function wordScore(q: string, f: Field): number {
  const t = f.t;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  for (let i = 0; i < f.w.length; i++) if (f.w[i].startsWith(q)) return 80 - Math.min(i, 5) * 2;
  if (q.length > 1 && f.ini.startsWith(q)) return 60;
  if (t.includes(q)) return 45;
  if (q.length < 3) return 0;
  const max = q.length > 5 ? 2 : 1;
  let best = 9;
  for (const w of f.w) best = Math.min(best, dist(q, w), dist(q, w.slice(0, q.length)));
  if (best <= max) return 35 - best * 8;
  return subsequence(q, t) ? 12 : 0;
}

type Entry<T extends Option> = { opt: T; f: Field; g: Field | null };
export const prepare = <T extends Option>(opts: T[]): Entry<T>[] => opts.map((opt) => ({ opt, f: field(opt.label), g: opt.hint ? field(opt.hint) : null }));

function score<T extends Option>(qs: string[], e: Entry<T>): number {
  let total = 0;
  for (const q of qs) {
    let s = wordScore(q, e.f);
    if (e.g) s = Math.max(s, wordScore(q, e.g) * 0.6);
    if (!s) return 0;
    total += s;
  }
  return total / qs.length + (e.f.t.startsWith(qs.join(" ")) ? 10 : 0);
}

export type Hit<T extends Option> = { opt: T; score: number; marks: [number, number][] };

/** The options that match the query, best first. An empty query returns everything in its own order. */
export function rank<T extends Option>(query: string, entries: Entry<T>[], limit = Infinity): Hit<T>[] {
  const qs = words(norm(query));
  if (!qs.length) return entries.slice(0, limit).map((e) => ({ opt: e.opt, score: 0, marks: [] }));
  const hits: (Hit<T> & { at: number })[] = [];
  entries.forEach((e, at) => { const s = score(qs, e); if (s) hits.push({ opt: e.opt, score: s, marks: marks(e.opt.label, qs), at }); });
  hits.sort((a, b) => b.score - a.score || a.at - b.at); // ties keep the order they came in
  return hits.slice(0, limit);
}

/** Where in the label the query words matched (a word at the start of a word where it can be), merged. */
export function marks(text: string, qs: string[]): [number, number][] {
  // the lower-case form can be longer than the original (rare); map every character back to where it came from
  let s = ""; const map: number[] = [];
  for (let i = 0; i < text.length; i++) for (const ch of norm(text[i])) { s += ch; map.push(i); }
  const spans: [number, number][] = [];
  for (const q of qs) {
    const first = s.indexOf(q);
    if (first === -1) continue;
    let at = first;
    for (let i = first; i !== -1; i = s.indexOf(q, i + 1)) { if (i === 0 || SPLIT.test(s[i - 1])) { at = i; break; } }
    spans.push([map[at], map[at + q.length - 1] + 1]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const sp of spans) {
    const last = out[out.length - 1];
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]); else out.push([sp[0], sp[1]]);
  }
  return out;
}

/** "did you mean": the option whose label is one typo away from a single-word query, when nothing matched. */
export function didYouMean<T extends Option>(query: string, opts: T[]): string | null {
  const q = norm(query).trim();
  if (q.length < 3 || words(q).length !== 1) return null;
  let best: { label: string; d: number } | null = null;
  for (const o of opts) for (const w of words(norm(o.label))) {
    const d = dist(q, w);
    if (d > 0 && d <= (q.length > 5 ? 2 : 1) && (!best || d < best.d)) best = { label: o.label, d };
  }
  return best?.label ?? null;
}
