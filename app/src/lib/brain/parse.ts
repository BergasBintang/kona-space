// Reading one note: its front matter, its sections (the pieces a search reads) and its links.
import { redact, words } from "./text.ts";

export type Layer = "project" | "starter" | "memory";

/** A note as it comes from disk (or from the app, for the starter notes). */
export type RawNote = { id: string; layer: Layer; text: string; path?: string; mtime?: number; readonly: boolean };

export type Section = {
  id: string; // note id, a #, and the section's number
  noteId: string;
  heading: string;
  level: number;
  start: number; // first line, counting from 1 in the whole file (front matter included)
  end: number;
  words: number;
  text: string; // the text with secrets hidden: this is what is indexed and shown in results
};

export type Link = { raw: string; target: string | null; kind: "wiki" | "ref"; trust: "written" | "guessed"; line: number; heading?: string };

export type Note = {
  id: string;
  layer: Layer;
  title: string;
  kind: string; // session, decision, open, topic, starter, memory, note
  meta: Record<string, string>;
  readonly: boolean;
  mtime?: number;
  path?: string;
  raw: string;
  words: number;
  sections: Section[];
  links: Link[];
  secrets: string[]; // kinds of secret found in the text
};

export function frontMatter(text: string): { meta: Record<string, string>; bodyStart: number } {
  const t = text.replace(/\r/g, "");
  if (!t.startsWith("---\n")) return { meta: {}, bodyStart: 0 };
  const lines = t.split("\n");
  const close = lines.indexOf("---", 1);
  if (close < 0) return { meta: {}, bodyStart: 0 };
  const meta: Record<string, string> = {};
  for (const l of lines.slice(1, close)) {
    const i = l.indexOf(":");
    if (i > 0) meta[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
  }
  return { meta, bodyStart: close + 1 };
}

const WIKI = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

/** Section boundaries: every heading of level 1 to 3 starts one (headings inside code fences do not). A section with fewer than 25 words joins the next. */
export function sectionsOf(noteId: string, text: string, bodyStart: number, fallbackTitle: string): Section[] {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  type Cut = { heading: string; level: number; start: number };
  const cuts: Cut[] = [{ heading: fallbackTitle, level: 1, start: bodyStart + 1 }];
  let fence = false;
  lines.forEach((l, i) => {
    if (i < bodyStart) return;
    if (/^\s*```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    const m = l.match(/^(#{1,3})\s+(.*?)\s*#*\s*$/);
    if (m) cuts.push({ heading: m[2].replace(/[*`]/g, ""), level: m[1].length, start: i + 1 });
  });
  // a first cut with nothing before the first heading is not a section of its own
  if (cuts.length > 1 && cuts[1].start === cuts[0].start) cuts.shift();
  const raw = cuts.map((c, k) => {
    const end = k + 1 < cuts.length ? cuts[k + 1].start - 1 : lines.length;
    let e = end;
    while (e > c.start && (lines[e - 1] ?? "").trim() === "") e--;
    return { ...c, end: e, body: lines.slice(c.start - 1, e).join("\n") };
  }).filter((s) => s.body.trim() !== "");
  const merged: typeof raw = [];
  for (let k = 0; k < raw.length; k++) {
    const s = raw[k];
    if (words(s.body) < 25 && k + 1 < raw.length) {
      const n = raw[k + 1];
      raw[k + 1] = { ...n, start: s.start, heading: n.heading, body: s.body + "\n" + n.body };
      continue;
    }
    merged.push(s);
  }
  return merged.map((s, i) => ({ id: `${noteId}#${i + 1}`, noteId, heading: s.heading, level: s.level, start: s.start, end: s.end, words: words(s.body), text: redact(s.body).text }));
}

/** The links a note writes: `[[name]]`, `[[name#Heading]]` and `[[name|shown words]]`. Code spans and fences are ignored (they show the syntax). */
export function linksOf(text: string, bodyStart: number): Link[] {
  const out: Link[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let fence = false;
  lines.forEach((l, i) => {
    if (i < bodyStart) return;
    if (/^\s*```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    const clean = l.replace(/`[^`]*`/g, "");
    for (const m of clean.matchAll(WIKI)) out.push({ raw: m[1].trim(), target: null, kind: "wiki", trust: "written", line: i + 1, heading: m[2]?.trim() });
  });
  return out;
}

export function parseNote(r: RawNote): Note {
  const { meta, bodyStart } = frontMatter(r.text);
  const firstHeading = r.text.replace(/\r/g, "").split("\n").slice(bodyStart).find((l) => /^#\s+/.test(l));
  // Claude's memory files name themselves with `name:` (and describe themselves with `description:`); its index file has no title
  const title = meta.title || meta.name || (firstHeading ? firstHeading.replace(/^#\s+/, "").trim() : r.id === "memory-index" ? "Memory index" : r.id);
  const kind = meta.kind || (r.layer === "starter" ? "starter" : r.layer === "memory" ? "memory" : "note");
  return {
    id: r.id, layer: r.layer, title, kind, meta, readonly: r.readonly, mtime: r.mtime, path: r.path, raw: r.text, words: words(r.text),
    sections: sectionsOf(r.id, r.text, bodyStart, title), links: linksOf(r.text, bodyStart), secrets: redact(r.text).found,
  };
}
