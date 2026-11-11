// The pure parts of the terminal's blocks (decision 80): reading the mark the shell prints at each prompt, the short forms shown in the
// header, the scripts of a project, the file paths that can be clicked, and the history of the input bar. No screen code is in here.

/** What the shell tells at each prompt: how the last command ended, where the shell is, and Git's view of that folder. */
export type PromptInfo = { code: number; cwd: string; branch: string; dirty: boolean };

/** The mark is base64 of a small JSON text (so no character in a path or a branch name can break the mark). */
export function parsePrompt(b64: string): PromptInfo | null {
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const j = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (typeof j.cwd !== "string") return null;
    const code = Number(j.code);
    return { code: Number.isFinite(code) ? code : 0, cwd: j.cwd, branch: typeof j.branch === "string" ? j.branch : "", dirty: j.dirty === true };
  } catch { return null; }
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${(Math.max(0, Math.round(ms / 100)) / 10).toFixed(1)} s`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s - m * 60)} s`;
}

const norm = (p: string) => p.replace(/\//g, "\\").replace(/\\+$/, "");
/** The shell's folder as shown in the header: inside the project it is written from the project's folder ("." for the folder itself). */
export function shortPath(cwd: string, root: string): string {
  const c = norm(cwd), r = norm(root);
  if (c.toLowerCase() === r.toLowerCase()) return ".";
  if (c.toLowerCase().startsWith(r.toLowerCase() + "\\")) return c.slice(r.length + 1);
  return c;
}

/** The scripts of a package.json, the usual ones first. Empty when the text is not a package file. */
export function scriptsOf(text: string): string[] {
  try {
    const j = JSON.parse(text) as { scripts?: Record<string, unknown> };
    const all = j.scripts ?? {};
    const names = Object.keys(all).filter((n) => typeof all[n] === "string");
    const first = ["dev", "start", "build", "test", "lint"];
    const rank = (n: string) => { const i = first.indexOf(n); return i < 0 ? first.length : i; };
    return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  } catch { return []; }
}
export const runLine = (script: string) => (script === "start" || script === "test" ? `npm ${script}` : `npm run ${script}`);

export type PathHit = { start: number; end: number; text: string; path: string; line?: number; col?: number };
const EXT = "tsx?|jsx?|mjs|cjs|rs|json|md|css|scss|html|vue|svelte|py|php|go|toml|ya?ml|sql|sh|ps1|txt|lock";
const PATH_RE = new RegExp(String.raw`(?<![\w./\\:@-])((?:[A-Za-z]:[\\/])?(?:[\w@.\-]+[\\/])*[\w@.\-]+\.(?:${EXT}))(?:[:(](\d+)(?:[:,](\d+))?\)?)?(?![\w])`, "g");
/** The parts of one line of output that look like a file: `src/App.tsx:42:7`, `D:\app\main.rs(10,3)`. Whether the file exists is checked when it is clicked. */
export function findPaths(line: string): PathHit[] {
  const out: PathHit[] = [];
  for (const m of line.matchAll(PATH_RE)) {
    const start = m.index ?? 0;
    out.push({ start, end: start + m[0].length, text: m[0], path: m[1], line: m[2] ? Number(m[2]) : undefined, col: m[3] ? Number(m[3]) : undefined });
  }
  return out;
}
/** A path as the shell would read it: relative ones start from the shell's folder. */
export function absolute(path: string, cwd: string): string {
  if (/^[A-Za-z]:[\\/]/.test(path)) return norm(path);
  const parts = (cwd.replace(/\//g, "\\").replace(/\\+$/, "") + "\\" + path.replace(/\//g, "\\")).split("\\");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "." || (p === "" && out.length > 0)) continue;
    if (p === "..") { if (out.length > 1) out.pop(); continue; }
    out.push(p);
  }
  return out.join("\\");
}

/** A line that looks like it carries a key, a token or a password is never kept in the history. */
export function looksSecret(line: string): boolean {
  return /\b(sk|pk|ghp|gho|ghs|github_pat|xox[abp]|AKIA|AIza)[-_A-Za-z0-9]{16,}/.test(line)
    || /\b(password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*\S{4,}/i.test(line)
    || /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/.test(line)
    || /[A-Za-z0-9+/_-]{40,}={0,2}/.test(line);
}

/** What was typed in the bar, newest last. Up and Down walk through it; it lives only while Kona is open. */
export class History {
  private items: string[] = [];
  private at = -1;
  private draft = "";
  add(line: string) {
    this.at = -1;
    const t = line.trim();
    if (!t || looksSecret(t) || this.items[this.items.length - 1] === t) return;
    this.items.push(t);
    if (this.items.length > 200) this.items.shift();
  }
  /** Up: the one before the one shown (the first press keeps what was being typed). */
  prev(current: string): string | null {
    if (this.items.length === 0) return null;
    if (this.at === -1) { this.draft = current; this.at = this.items.length - 1; } else if (this.at > 0) this.at--; else return null;
    return this.items[this.at];
  }
  next(): string | null {
    if (this.at === -1) return null;
    if (this.at < this.items.length - 1) { this.at++; return this.items[this.at]; }
    this.at = -1;
    return this.draft;
  }
  get size() { return this.items.length; }
}

/** The lines of a block's output as one text: lines the screen wrapped are joined, empty lines at the end are dropped. */
export function joinLines(lines: { text: string; wrapped: boolean }[]): string {
  const out: string[] = [];
  for (const l of lines) { if (l.wrapped && out.length) out[out.length - 1] += l.text; else out.push(l.text); }
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return out.join("\n");
}

/** The scripts of a composer.json (the hooks composer runs by itself, like post-install-cmd, are left out). */
export function composerScripts(text: string): string[] {
  try {
    const j = JSON.parse(text) as { scripts?: Record<string, unknown> };
    return Object.keys(j.scripts ?? {}).filter((n) => !/^(pre|post)-/.test(n) && !/-cmd$/.test(n)).sort((a, b) => a.localeCompare(b));
  } catch { return []; }
}

/** One button above the input bar. `own` ones are the owner's, the others come from the project's files. */
export type ScriptButton = { id: string; kind: "own" | "npm" | "composer"; name: string; line: string };

/** The buttons in the order they are shown: the owner's own first, then the project's npm scripts, then composer's. A composer script with the same name as an npm one says so. */
export function buildButtons(own: { name: string; line: string }[], npm: string[], composer: string[]): ScriptButton[] {
  const npmNames = new Set(npm.map((n) => n.toLowerCase()));
  return [
    ...own.map((b) => ({ id: `own:${b.name}`, kind: "own" as const, name: b.name, line: b.line })),
    ...npm.map((n) => ({ id: `npm:${n}`, kind: "npm" as const, name: n, line: runLine(n) })),
    ...composer.map((n) => ({ id: `composer:${n}`, kind: "composer" as const, name: npmNames.has(n.toLowerCase()) ? `composer ${n}` : n, line: `composer run ${n}` })),
  ];
}

/** How many buttons of a row fit: `widths` are the buttons' widths in order, `room` the width of the row, `reserve` what the "More" button needs when some are left out. */
export function fitCount(widths: number[], room: number, reserve: number, gap: number): number {
  const total = widths.reduce((a, w, i) => a + w + (i ? gap : 0), 0);
  if (total <= room) return widths.length;
  let used = 0, n = 0;
  for (const w of widths) {
    const next = used + (n ? gap : 0) + w;
    if (next + gap + reserve > room) break;
    used = next; n++;
  }
  return n;
}

/** Filter the buttons of the "More" list by what was typed (in the name or in the command). */
export function filterButtons(list: ScriptButton[], query: string): ScriptButton[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((b) => b.name.toLowerCase().includes(q) || b.line.toLowerCase().includes(q));
}
