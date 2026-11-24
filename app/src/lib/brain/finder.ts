// Finding a note by what was typed: the Notes page's search box. Plain letters, not the Ask page's meaning search, so a half-typed word already finds
// ("brand" finds "Brand files live in assets/brand only"). Every typed word has to be somewhere in the note: its title, its id, its topic, its tickets,
// or its text (the text with secrets hidden, as the screen shows it). The title counts most, then topic and tickets, then the text.
import type { Brain } from "./engine.ts";
import { fold } from "./text.ts";

export type Found = { id: string; where: "title" | "label" | "text"; snippet: string };

/** The words that were typed, folded and without the empty ones. */
export const queryWords = (q: string): string[] => fold(q).split(/[^a-z0-9]+/).filter(Boolean);

/** A short stretch of the text around the first typed word, for a note that matched only in its text. */
function around(text: string, ws: string[]): string {
  const flat = text.replace(/[#*`>|]/g, " ").replace(/\s+/g, " ");
  const low = fold(flat);
  const at = Math.min(...ws.map((w) => { const i = low.indexOf(w); return i < 0 ? Infinity : i; }));
  if (!Number.isFinite(at)) return "";
  const from = Math.max(0, at - 28);
  return (from > 0 ? "…" : "") + flat.slice(from, from + 90).trim() + (flat.length > from + 90 ? "…" : "");
}

/** The notes that hold every typed word, best first (ties A to Z by title). Nothing typed gives an empty list. */
export function findNotes(brain: Brain, query: string, limit = 60): Found[] {
  const ws = queryWords(query);
  if (ws.length === 0) return [];
  const phrase = ws.join(" ");
  const out: { f: Found; score: number; title: string }[] = [];
  for (const n of brain.notes.values()) {
    if (n.generated) continue; // the list Kona writes itself names every note, so it would match everything
    const title = fold(n.title);
    const label = fold([n.id, n.topic, ...n.tickets].join(" "));
    const text = n.sections.map((s) => `${s.heading} ${s.text}`).join(" ");
    const body = fold(text);
    if (!ws.every((w) => title.includes(w) || label.includes(w) || body.includes(w))) continue;
    const inTitle = ws.every((w) => title.includes(w));
    const inLabel = ws.every((w) => title.includes(w) || label.includes(w));
    const score = (inTitle ? 100 + (title.startsWith(ws[0]) ? 10 : 0) + (title.includes(phrase) ? 20 : 0) : inLabel ? 50 : 10) + (n.layer === "project" ? 1 : 0);
    out.push({ f: { id: n.id, where: inTitle ? "title" : inLabel ? "label" : "text", snippet: inLabel ? "" : around(text, ws) }, score, title: n.title });
  }
  out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }) || a.f.id.localeCompare(b.f.id));
  return out.slice(0, limit).map((o) => o.f);
}
