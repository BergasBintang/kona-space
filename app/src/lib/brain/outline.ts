// The headings of a markdown file: the "On this page" list, the anchors a heading can be linked by, and where a link inside the file goes.
// The reader (Markdown.tsx) takes its heading ids from `headingsOf`, so the list and the page can never disagree.
import { frontMatter } from "./parse.ts";

export type Heading = { level: number; text: string; id: string };

/** A heading's words without the marks around them: **bold**, `code`, [text](address), [[note|text]]. */
export function plain(s: string): string {
  return s.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, a: string, b?: string) => b ?? a).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*]/g, "").replace(/(^|\s)_|_(\s|$)/g, "$1$2").trim();
}

/** The id a heading gets: lower-case words joined by dashes, like GitHub's, so a link written as [x](#some-heading) works in both places. */
export function slugify(s: string): string {
  return plain(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section";
}

/** Every heading of these lines (front matter already removed), in order, with ids that are different from each other. A `#` inside a fenced block is not a heading. */
export function headingsOf(lines: string[]): Heading[] {
  const out: Heading[] = [];
  const used = new Map<string, number>();
  let fenced = false;
  for (const l of lines) {
    if (/^\s*```/.test(l)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(l);
    if (!m) continue;
    const text = plain(m[2]);
    const base = slugify(m[2]);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    out.push({ level: m[1].length, text, id: `md-${n === 1 ? base : `${base}-${n}`}` });
  }
  return out;
}

/** The headings of a whole file, front matter skipped. */
export function outline(text: string): Heading[] {
  const t = text.replace(/\r/g, "");
  return headingsOf(t.split("\n").slice(frontMatter(t).bodyStart));
}

const SEP = /[\\/]/;

/** Where a link written in the file at `from` points, as a path in the same style (backslashes on Windows), and the heading it names. null when it leaves the project folder `root`, or is not a file at all (a web address). */
export function resolveLink(from: string, href: string, root: string): { path: string; anchor: string } | null {
  const [beforeHash, ...hashRest] = href.trim().split("#");
  const anchor = hashRest.join("#");
  const file = beforeHash.split("?")[0];
  if (/^[a-z][a-z0-9+.-]*:/i.test(file) || file.startsWith("//")) return null;
  if (file === "") return { path: from, anchor };
  let decoded = file;
  try { decoded = decodeURIComponent(file); } catch { /* keep it as written */ }
  const sep = from.includes("\\") ? "\\" : "/";
  const rootParts = root.split(SEP).filter(Boolean);
  const parts = decoded.startsWith("/") ? [...rootParts] : from.split(SEP).filter(Boolean).slice(0, -1);
  for (const seg of decoded.split(/[\\/]/)) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { if (parts.length <= rootParts.length) return null; parts.pop(); } else parts.push(seg);
  }
  if (parts.length <= rootParts.length || !rootParts.every((p, i) => p.toLowerCase() === parts[i].toLowerCase())) return null;
  const lead = from.startsWith("/") ? "/" : "";
  return { path: lead + parts.join(sep), anchor };
}

export const dirOf = (p: string): string => { const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/")); return i < 0 ? "" : p.slice(0, i); };
