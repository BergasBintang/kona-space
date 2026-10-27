// The brain's engine (feature F7), in plain TypeScript with no model and no network: the same notes always give the same graph, the same
// groups and the same answers. It is a port of the method of the Miralis canon's note graph (tools/graph.mjs and graph-index.mjs):
//   - links between notes have weights: a written [[wiki link]] counts 3, a note named in another note's text counts 2 (the canon's weights);
//   - every link says how it is known: "written" (it is in the text) or "guessed" (a model suggested it, drawn dashed; none exist yet);
//   - notes are grouped by the links they make (label propagation, each link counting less the more connected its two ends are, so a few
//     hub notes cannot pull everything into one blob), and the groups are compared with the owner's own (role, kind, layer);
//   - every note is cut into sections with start and end lines, and a search reads sections, not whole files;
//   - a health report lists what needs a look.
import { fold, redact, terms } from "./text.ts";
import { parseNote, type Layer, type Note, type RawNote, type Section } from "./parse.ts";

export const WEIGHT = { wiki: 3, ref: 2 } as const;

export type Edge = { s: string; t: string; k: "wiki" | "ref"; w: number; trust: "written" | "guessed" };
export type Cluster = { id: string; members: string[]; label: string };

export type Hit = { section: Section; note: Note; score: number; coverage: number; snippet: string; strength: "match" | "loose" | "weak" };
export type SearchResult = {
  state: "found" | "partly" | "none";
  hits: Hit[];
  /** what the search looked at, so the screen can say it */
  looked: { notes: number; sections: number; layers: Layer[] };
  /** the starter or project note whose title or headings share the most terms with the question, to offer when nothing matched */
  nearest: Note | null;
};

export type Warning = { code: string; severity: "warn" | "info"; text: string; noteId?: string; line?: number };
export type Report = {
  warnings: Warning[];
  hubs: { id: string; title: string; strength: number }[];
  clusters: { id: string; label: string; members: string[]; curated: string }[];
  disagreements: string[];
  counts: Record<string, number>;
};

const DAY = 86_400_000;

/** How a `[[link]]` is compared with a note's name or title: no accents, no case, dashes for spaces. */
export const normLink = (s: string) => fold(s).trim().replace(/\.md$/, "").replace(/[\s_]+/g, "-");

export class Brain {
  notes: Map<string, Note>;
  order: string[];
  edges: Edge[] = [];
  clusters: Cluster[] = [];
  clusterOf = new Map<string, string>();
  private lookup = new Map<string, string>();
  private tf: Map<string, Map<string, number>> = new Map(); // section id -> term -> weighted count
  private len: Map<string, number> = new Map();
  private df = new Map<string, number>();
  private avgLen = 1;
  private sectionList: Section[] = [];

  constructor(raw: RawNote[]) {
    // a project note wins over a starter note of the same name
    const rank: Record<Layer, number> = { project: 0, memory: 1, starter: 2 };
    const sorted = [...raw].sort((a, b) => rank[a.layer] - rank[b.layer] || a.id.localeCompare(b.id));
    this.notes = new Map();
    for (const r of sorted) if (!this.notes.has(r.id)) this.notes.set(r.id, parseNote(r));
    this.order = [...this.notes.keys()];
    this.resolveLinks();
    this.group();
    this.indexSections();
  }

  // ---- links ----------------------------------------------------------------------------------------------

  /** The id of the note a link name points at, or null. */
  resolve(raw: string): string | null { return this.lookup.get(normLink(raw)) ?? null; }

  private resolveLinks() {
    const norm = normLink;
    for (const n of this.notes.values()) {
      this.lookup.set(norm(n.id), n.id);
      this.lookup.set(norm(n.title), this.lookup.get(norm(n.title)) ?? n.id);
    }
    const map = new Map<string, Edge>();
    const add = (s: string, t: string, k: "wiki" | "ref") => {
      if (s === t) return;
      const key = `${s}\u0000${t}`;
      const old = map.get(key);
      if (!old || WEIGHT[k] > old.w) map.set(key, { s, t, k, w: WEIGHT[k], trust: "written" });
    };
    for (const n of this.notes.values()) {
      for (const l of n.links) {
        l.target = this.lookup.get(norm(l.raw)) ?? null;
        if (l.target) add(n.id, l.target, "wiki");
      }
      // a note named in the text without brackets (its name must be a hyphenated one, so everyday words do not count)
      const text = fold(n.sections.map((s) => s.text).join("\n")).replace(/\[\[[^\]]*\]\]/g, "");
      for (const id of this.order) {
        if (id === n.id || !id.includes("-") || id.length < 8) continue;
        if (new RegExp(`(?<![a-z0-9-])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9-])`).test(text)) add(n.id, id, "ref");
      }
      // a ticket named in the text (T-0012) reaches the note that records that ticket
      for (const m of n.raw.matchAll(/\bT-\d{4,}\b/g)) {
        for (const o of this.notes.values()) if (o.id !== n.id && o.meta.ticket === m[0]) add(n.id, o.id, "ref");
      }
    }
    this.edges = [...map.values()].sort((a, b) => (a.s + a.t < b.s + b.t ? -1 : 1));
  }

  // ---- groups ---------------------------------------------------------------------------------------------

  private group() {
    const ids = [...this.order].sort();
    const idx = new Map(ids.map((id, i) => [id, i]));
    const adj = ids.map(() => new Map<number, number>());
    for (const e of this.edges) {
      const a = idx.get(e.s), b = idx.get(e.t);
      if (a == null || b == null || a === b) continue;
      adj[a].set(b, (adj[a].get(b) ?? 0) + e.w);
      adj[b].set(a, (adj[b].get(a) ?? 0) + e.w);
    }
    const strength = adj.map((m) => [...m.values()].reduce((x, y) => x + y, 0));
    const labels = ids.map((_, i) => i);
    for (let round = 0; round < 100; round++) {
      let changed = false;
      for (let i = 0; i < ids.length; i++) {
        if (!adj[i].size) continue;
        const tally = new Map<number, number>();
        for (const [j, w] of adj[i]) tally.set(labels[j], (tally.get(labels[j]) ?? 0) + w / (strength[i] * strength[j]));
        let best = -1, bestLabel = labels[i];
        for (const [lab, s] of tally) if (s > best + 1e-12 || (Math.abs(s - best) <= 1e-12 && lab < bestLabel)) { best = s; bestLabel = lab; }
        if ((tally.get(labels[i]) ?? 0) >= best - 1e-12) continue; // a note keeps its label when it ties for the most
        labels[i] = bestLabel; changed = true;
      }
      if (!changed) break;
    }
    const groups = new Map<number, string[]>();
    ids.forEach((id, i) => { const g = groups.get(labels[i]) ?? []; g.push(id); groups.set(labels[i], g); });
    const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
    this.clusters = sortedGroups.map((members, k) => ({ id: `c${k + 1}`, members, label: "" }));
    this.clusters.forEach((c) => c.members.forEach((m) => this.clusterOf.set(m, c.id)));
    // a group is named after the most telling words of its notes' titles
    for (const c of this.clusters) {
      const count = new Map<string, number>();
      for (const m of c.members) for (const t of new Set(terms(this.notes.get(m)!.title))) count.set(t, (count.get(t) ?? 0) + 1);
      const top = [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 2).map((x) => x[0]);
      c.label = c.members.length === 1 ? this.notes.get(c.members[0])!.title : top.length ? top.join(" ") : c.id;
    }
  }

  /** The owner's own grouping of a note: its role, else its kind, else its layer. */
  curatedOf(n: Note): string {
    if (n.meta.role) return n.meta.role.toLowerCase();
    if (n.layer !== "project") return n.layer;
    return n.kind;
  }

  // ---- the section index and search ----------------------------------------------------------------------

  private indexSections() {
    this.sectionList = [...this.notes.values()].flatMap((n) => n.sections);
    let total = 0;
    for (const s of this.sectionList) {
      const note = this.notes.get(s.noteId)!;
      const tf = new Map<string, number>();
      // a word in the heading or the note's title counts three times
      for (const t of terms(s.heading)) tf.set(t, (tf.get(t) ?? 0) + 3);
      // the note's title says what every section of it is about, so its words count once in each (three times in the first)
      for (const t of terms(note.title)) tf.set(t, (tf.get(t) ?? 0) + (s.id.endsWith("#1") ? 3 : 1));
      for (const t of terms(s.text)) tf.set(t, (tf.get(t) ?? 0) + 1);
      this.tf.set(s.id, tf);
      const len = [...tf.values()].reduce((a, b) => a + b, 0);
      this.len.set(s.id, len);
      total += len;
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgLen = this.sectionList.length ? total / this.sectionList.length : 1;
  }

  private idf(t: string): number {
    const n = this.sectionList.length;
    const df = this.df.get(t);
    // a word no note contains weighs like one that only a single section has: it is rare, but it must not drown the words that do match
    const d = df === undefined ? 1 : df;
    return Math.log(1 + (n - d + 0.5) / (d + 0.5));
  }

  /**
   * Ask the brain. The answer is one of three, and the screen says which in words:
   *   found   a section holds nearly every meaningful word of the question (coverage 0.8 or more, weighted by how rare each word is);
   *   partly  only some of them (0.4 or more): the closest are shown as close, not exact;
   *   none    not enough: nothing is shown as an answer.
   * The bars are the first guess, to be moved by testing on real notes (see brain.test.ts).
   */
  search(question: string, limit = 5): SearchResult {
    const looked = { notes: this.notes.size, sections: this.sectionList.length, layers: [...new Set([...this.notes.values()].map((n) => n.layer))] as Layer[] };
    const q = [...new Set(terms(redact(question).text))];
    if (q.length === 0) return { state: "none", hits: [], looked, nearest: null };
    const totalW = q.reduce((s, t) => s + this.idf(t), 0);
    const k1 = 1.2, b = 0.75;
    const scored: Hit[] = [];
    for (const s of this.sectionList) {
      const tf = this.tf.get(s.id)!;
      let score = 0, matched = 0;
      for (const t of q) {
        const f = tf.get(t);
        if (!f) continue;
        const idf = this.idf(t);
        matched += idf;
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * ((this.len.get(s.id) ?? 1) / this.avgLen))));
      }
      if (matched === 0) continue;
      const coverage = totalW > 0 ? matched / totalW : 0;
      scored.push({ section: s, note: this.notes.get(s.noteId)!, score, coverage, snippet: snippetOf(s, q), strength: coverage >= 0.8 ? "match" : coverage >= 0.6 ? "loose" : "weak" });
    }
    scored.sort((a, b) => b.coverage - a.coverage || b.score - a.score || (a.section.id < b.section.id ? -1 : 1));
    const top = scored[0];
    if (!top || top.coverage < 0.4) return { state: "none", hits: [], looked, nearest: this.nearest(q) };
    if (top.coverage >= 0.8) {
      const keep = scored.filter((h) => h.coverage >= Math.max(0.5, top.coverage - 0.25)).slice(0, limit);
      return { state: "found", hits: keep, looked, nearest: null };
    }
    return { state: "partly", hits: scored.slice(0, 3), looked, nearest: this.nearest(q) };
  }

  /** The note whose title and headings share the most of the question's words (for "open the nearest topic"). */
  private nearest(q: string[]): Note | null {
    let best: Note | null = null, bestScore = 0;
    for (const n of this.notes.values()) {
      const have = new Set([...terms(n.title), ...n.sections.flatMap((s) => terms(s.heading))]);
      const s = q.reduce((a, t) => a + (have.has(t) ? this.idf(t) : 0), 0);
      if (s > bestScore) { bestScore = s; best = n; }
    }
    return best;
  }

  // ---- links in and out -----------------------------------------------------------------------------------

  outgoing(id: string) { return this.edges.filter((e) => e.s === id); }
  incoming(id: string) { return this.edges.filter((e) => e.t === id); }

  // ---- the health report ----------------------------------------------------------------------------------

  report(now = Date.now(), wantedCount = 0): Report {
    const warnings: Warning[] = [];
    const warn = (code: string, text: string, noteId?: string, line?: number, severity: "warn" | "info" = "warn") => warnings.push({ code, severity, text, noteId, line });
    const mine = (n: Note) => n.layer !== "starter"; // the starter notes ship with Kona and are checked by tests, not by the owner
    for (const n of this.notes.values()) {
      for (const l of n.links) if (!l.target && mine(n)) warn("broken-link", `“${n.title}” links to [[${l.raw}]], which does not exist`, n.id, l.line);
      if (mine(n) && n.layer === "project" && this.incoming(n.id).length === 0 && this.outgoing(n.id).length === 0) warn("orphan", `“${n.title}” has no links in or out`, n.id);
      else if (mine(n) && n.layer === "project" && this.incoming(n.id).length === 0) warn("orphan", `Nothing links to “${n.title}”`, n.id);
      if (n.kind === "decision" && !n.meta.session && !n.meta.ticket) warn("decision-no-source", `The decision “${n.title}” names no session or ticket it came from`, n.id);
      if (n.kind === "open" && n.meta.status !== "closed") {
        const d = Date.parse(n.meta.date ?? "");
        if (Number.isFinite(d) && now - d > 30 * DAY) warn("old-open", `The open item “${n.title}” is ${Math.floor((now - d) / DAY)} days old`, n.id);
      }
      for (const s of n.sections) if (s.words > 600 && mine(n)) warn("long-section", `“${s.heading}” in “${n.title}” is ${s.words} words, too long to read as one piece`, n.id, s.start);
      if (n.secrets.length && mine(n)) warn("secret", `“${n.title}” looks like it holds a secret (${n.secrets.join(", ")}). It is hidden from the search index; remove it from the note`, n.id);
      if (n.layer === "memory" && n.mtime && now - n.mtime > 90 * DAY) warn("old-memory", `Claude's memory note “${n.title}” was last written ${Math.floor((now - n.mtime) / DAY)} days ago; it records what was true then`, n.id, undefined, "info");
    }
    // the most connected notes
    const strength = new Map<string, number>();
    for (const e of this.edges) { strength.set(e.s, (strength.get(e.s) ?? 0) + e.w); strength.set(e.t, (strength.get(e.t) ?? 0) + e.w); }
    const hubs = [...strength].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 5).map(([id, s]) => ({ id, title: this.notes.get(id)!.title, strength: s }));
    // computed groups against the owner's groups
    const disagreements: string[] = [];
    const clusters = this.clusters.map((c) => {
      const tally = new Map<string, number>();
      for (const m of c.members) { const g = this.curatedOf(this.notes.get(m)!); tally.set(g, (tally.get(g) ?? 0) + 1); }
      const [dom, domN] = [...tally].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? ["", 0];
      if (c.members.length >= 4 && domN / c.members.length < 0.5) disagreements.push(`The notes that link together as “${c.label}” (${c.members.length}) are filed under ${tally.size} different headings. Check that they belong together.`);
      for (const m of c.members) {
        const n = this.notes.get(m)!;
        if (mine(n) && c.members.length >= 4 && domN / c.members.length >= 0.7 && this.curatedOf(n) !== dom) disagreements.push(`“${n.title}” is filed as ${this.curatedOf(n)} but links with ${dom} notes.`);
      }
      return { id: c.id, label: c.label, members: c.members, curated: dom };
    });
    // a link between two groups where both ends are well tied into their own group is a surprising one
    const surprising = this.edges.filter((e) => this.clusterOf.get(e.s) !== this.clusterOf.get(e.t) && this.inside(e.s) >= 2 && this.inside(e.t) >= 2).slice(0, 3);
    for (const e of surprising) warn("bridge", `A link joins two groups: “${this.notes.get(e.s)!.title}” to “${this.notes.get(e.t)!.title}”`, e.s, undefined, "info");
    if (wantedCount > 0) warn("wanted", `${wantedCount} ${wantedCount === 1 ? "question" : "questions"} the brain could not answer ${wantedCount === 1 ? "is" : "are"} on the wanted list`, undefined, undefined, "info");
    const counts: Record<string, number> = {};
    for (const w of warnings) if (w.severity === "warn") counts[w.code] = (counts[w.code] ?? 0) + 1;
    return { warnings, hubs, clusters, disagreements, counts };
  }

  private inside(id: string): number {
    const c = this.clusterOf.get(id);
    return this.edges.filter((e) => (e.s === id && this.clusterOf.get(e.t) === c) || (e.t === id && this.clusterOf.get(e.s) === c)).length;
  }

  // ---- the map --------------------------------------------------------------------------------------------

  /** Positions for the map: a force layout (links pull, notes push apart), started from a fixed circle so the picture is the same every time. */
  layout(width: number, height: number): Map<string, { x: number; y: number }> {
    const all = [...this.order].sort();
    const linked = new Set(this.edges.flatMap((e) => [e.s, e.t]));
    const ids = all.filter((id) => linked.has(id));
    const loose = all.filter((id) => !linked.has(id));
    const n = ids.length;
    const out = new Map<string, { x: number; y: number }>();
    // notes with no links at all sit in a tidy row along the bottom, so they do not drift to the corners of the map
    const rowY = height - 22;
    loose.forEach((id, i) => out.set(id, { x: 24 + ((i + 0.5) * (width - 48)) / loose.length, y: rowY }));
    height = loose.length ? height - 52 : height;
    const pos = new Map<string, { x: number; y: number; dx: number; dy: number }>();
    // start each group on its own arc so groups begin apart
    const byCluster = this.clusters;
    byCluster.forEach((c, ci) => {
      const ca = (2 * Math.PI * ci) / Math.max(1, byCluster.length);
      c.members.forEach((m, mi) => {
        const a = ca + (mi / Math.max(1, c.members.length)) * 0.9;
        const r = Math.min(width, height) * 0.32;
        pos.set(m, { x: width / 2 + Math.cos(a) * r, y: height / 2 + Math.sin(a) * r, dx: 0, dy: 0 });
      });
    });
    if (n === 0) return out;
    const area = width * height, k = Math.sqrt(area / n) * 0.9;
    let temp = Math.min(width, height) / 8;
    for (let it = 0; it < 220; it++) {
      for (const p of pos.values()) { p.dx = 0; p.dy = 0; }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = pos.get(ids[i])!, b = pos.get(ids[j])!;
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy || 0.01, d = Math.sqrt(d2);
        const f = (k * k) / d;
        dx /= d; dy /= d;
        a.dx += dx * f; a.dy += dy * f; b.dx -= dx * f; b.dy -= dy * f;
      }
      for (const e of this.edges) {
        const a = pos.get(e.s), b = pos.get(e.t);
        if (!a || !b) continue;
        let dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = ((d * d) / k) * (e.w / 3);
        dx /= d; dy /= d;
        a.dx -= dx * f; a.dy -= dy * f; b.dx += dx * f; b.dy += dy * f;
      }
      for (const p of pos.values()) {
        // a gentle pull to the middle keeps unlinked notes on the page
        p.dx += (width / 2 - p.x) * 0.02; p.dy += (height / 2 - p.y) * 0.02;
        const d = Math.sqrt(p.dx * p.dx + p.dy * p.dy) || 0.01;
        const m = Math.min(d, temp);
        p.x = Math.min(width - 24, Math.max(24, p.x + (p.dx / d) * m));
        p.y = Math.min(height - 24, Math.max(24, p.y + (p.dy / d) * m));
      }
      temp *= 0.985;
    }
    for (const [id, p] of pos) out.set(id, { x: p.x, y: p.y });
    return out;
  }
}

/** A few words of the section around the first word that matched, with secrets already hidden. */
function snippetOf(s: Section, q: string[]): string {
  const lines = s.text.split("\n").map((l) => l.trim()).filter((l) => l && !/^#{1,6}\s/.test(l));
  const want = new Set(q);
  const hit = lines.find((l) => terms(l).some((t) => want.has(t))) ?? lines[0] ?? "";
  const clean = hit.replace(/[*`]/g, "").replace(/^[-\d.)\s]+/, "");
  return clean.length > 220 ? clean.slice(0, 219) + "…" : clean;
}
