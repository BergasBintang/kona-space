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

/** How the search decides: the window of words in which a section's words must stand together, and the bars of coverage for "Found" and "Partly". Measured by `evalset.ts`. */
export const SEARCH = { window: 40, found: 0.8, partly: 0.4 };
export type SearchOptions = { window?: number; found?: number; partly?: number };

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
  private seq: Map<string, string[]> = new Map(); // section id -> its terms in reading order (the heading and the title are kept apart)
  private headTerms: Map<string, Set<string>> = new Map();
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
        for (const o of this.notes.values()) if (o.id !== n.id && o.tickets.includes(m[0])) add(n.id, o.id, "ref");
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
      const ordered = terms(s.text);
      for (const t of ordered) tf.set(t, (tf.get(t) ?? 0) + 1);
      this.seq.set(s.id, ordered);
      this.headTerms.set(s.id, new Set([...terms(s.heading), ...terms(note.title)]));
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
  /**
   * How much of the question a section answers, in its best window: the heading's and the title's words count for the whole section, the other words only when they stand within
   * `window` words of each other (a long document does not answer a question just because the words are somewhere in it). A section shorter than the window is read whole.
   */
  private windowCoverage(sid: string, q: string[], totalW: number, window: number): number {
    const head = this.headTerms.get(sid)!, seq = this.seq.get(sid)!;
    let fixed = 0;
    const rest = new Set<string>();
    for (const t of q) { if (head.has(t)) fixed += this.idf(t); else rest.add(t); }
    if (rest.size === 0 || totalW <= 0) return totalW > 0 ? fixed / totalW : 0;
    const counts = new Map<string, number>();
    let have = 0, best = 0;
    for (let i = 0; i < seq.length; i++) {
      const t = seq[i];
      if (rest.has(t)) { const c = (counts.get(t) ?? 0) + 1; counts.set(t, c); if (c === 1) have += this.idf(t); }
      if (i >= window) { const o = seq[i - window]; if (rest.has(o)) { const c = (counts.get(o) ?? 1) - 1; counts.set(o, c); if (c === 0) have -= this.idf(o); } }
      if (have > best) best = have;
    }
    return (fixed + best) / totalW;
  }

  search(question: string, limit = 5, opts: SearchOptions = {}): SearchResult {
    const { window = SEARCH.window, found = SEARCH.found, partly = SEARCH.partly } = opts;
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
      const coverage = this.windowCoverage(s.id, q, totalW, window);
      if (coverage === 0 && matched === 0) continue;
      scored.push({ section: s, note: this.notes.get(s.noteId)!, score, coverage, snippet: snippetOf(s, q), strength: coverage >= found ? "match" : coverage >= 0.6 ? "loose" : "weak" });
    }
    scored.sort((a, b) => b.coverage - a.coverage || b.score - a.score || (a.section.id < b.section.id ? -1 : 1));
    const top = scored[0];
    if (!top || top.coverage < partly) return { state: "none", hits: [], looked, nearest: this.nearest(q) };
    if (top.coverage >= found) {
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
      // a note that links out to many notes and that nothing links to is the way in (an index, a "where to start" page), not a lost note: nothing needs to point at the door
      else if (mine(n) && n.layer === "project" && this.incoming(n.id).length === 0 && this.outgoing(n.id).length < ENTRY_LINKS) warn("orphan", `Nothing links to “${n.title}”`, n.id);
      // a title that names a ticket other than the ones the note was written under (Kona stamped those itself) may be about the wrong ticket
      if (n.layer === "project" && n.tickets.length > 0) {
        const named = (n.title.match(/\bT-\d{4,}\b/g) ?? []).filter((t) => !n.tickets.includes(t));
        if (named.length > 0) warn("ticket-mismatch", `“${n.title}” names ${named.join(", ")} in its title but was written under ${n.tickets.join(", ")}`, n.id, undefined, "info");
      }
      if (n.kind === "decision" && !n.meta.session && n.tickets.length === 0) warn("decision-no-source", `The decision “${n.title}” names no session or ticket it came from`, n.id);
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
    // A note that links to a note which changed after it was written may be out of date. The day of a note's last change is `updated`, else `date`. Only the project's own notes of
    // a kind that states something (decision, topic, open); the first eight are shown. A hint to look, not a verdict: the linked note may have changed about something else.
    {
      const changed = (n: Note) => Date.parse(n.meta.updated ?? n.meta.date ?? "");
      const states = new Set(["decision", "topic", "open"]);
      let shown = 0, more = 0;
      for (const e of this.edges) {
        if (e.k !== "wiki") continue;
        const a = this.notes.get(e.s), t = this.notes.get(e.t);
        if (!a || !t || a.layer !== "project" || t.layer !== "project" || !states.has(a.kind) || !states.has(t.kind)) continue;
        if (!(changed(t) > changed(a))) continue;
        if (shown >= 8) { more++; continue; }
        shown++;
        warn("link-newer", `“${a.title}” (${a.meta.updated ?? a.meta.date}) links to “${t.title}”, which changed on ${t.meta.updated ?? t.meta.date}, after it was written. Check that it still says the same.`, a.id, undefined, "info");
      }
      if (more > 0) warn("link-newer", `${more} more notes link to a note that changed after they were written`, undefined, undefined, "info");
    }
    // two decisions written under one ticket on different days: the later one may replace the earlier
    {
      const byTicket = new Map<string, Note[]>();
      for (const n of this.notes.values()) if (n.layer === "project" && n.kind === "decision") for (const t of n.tickets) byTicket.set(t, [...(byTicket.get(t) ?? []), n]);
      for (const [t, ns] of [...byTicket].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
        if (ns.length < 2 || new Set(ns.map((n) => n.meta.date ?? "")).size < 2) continue;
        warn("two-decisions", `Two decisions were written under ${t} on different days: ${ns.map((n) => `“${n.title}” (${n.meta.date ?? "undated"})`).join(" and ")}. The later one may replace the earlier.`, ns[0].id, undefined, "info");
      }
    }
    const counts: Record<string, number> = {};
    for (const w of warnings) if (w.severity === "warn") counts[w.code] = (counts[w.code] ?? 0) + 1;
    return { warnings, hubs, clusters, disagreements, counts };
  }

  private inside(id: string): number {
    const c = this.clusterOf.get(id);
    return this.edges.filter((e) => (e.s === id && this.clusterOf.get(e.t) === c) || (e.t === id && this.clusterOf.get(e.s) === c)).length;
  }

  // ---- the map --------------------------------------------------------------------------------------------

  /** How big a dot is drawn: the more links a note has, the bigger the dot. The map and the layout both ask here, so they agree on how much room a dot takes. */
  radiusOf(id: string): number {
    if (!this.strength) {
      this.strength = new Map<string, number>();
      for (const e of this.edges) { this.strength.set(e.s, (this.strength.get(e.s) ?? 0) + e.w); this.strength.set(e.t, (this.strength.get(e.t) ?? 0) + e.w); }
    }
    return 6 + Math.min(10, Math.sqrt(this.strength.get(id) ?? 0) * 1.6);
  }
  private strength?: Map<string, number>;

  /** The note every session starts from. The map puts it in the middle, as a clue that everything is read from here (null when there is no such note, or it has no links). */
  centreNote(): string | null {
    return this.notes.has(CENTRE_NOTE) && this.edges.some((e) => e.s === CENTRE_NOTE || e.t === CENTRE_NOTE) ? CENTRE_NOTE : null;
  }

  /**
   * Positions for the map, laid out the way the Miralis canon lays out its skill graph (`views/skill-graph.html`):
   * 1. every group is a circle, as big as the notes it holds, and the circles are pushed apart until none touches another (groups that
   *    share more links end up closer);
   * 2. each note starts at its group's circle and is held inside it; notes push each other away, and no two dots may come closer than
   *    their two sizes plus some clear space; a link inside a group pulls its two ends close, a link between groups hardly pulls;
   * 3. at the end, dots that still touch are pushed apart, and then the groups' drawn circles are pushed apart again.
   * The "Start here" note, when there is one, is held in the exact middle with its group, and the other groups are packed round it.
   * Nothing is random, so the picture is the same every time. Notes with no links sit in a row along the bottom.
   */
  layout(width: number, height: number): Map<string, { x: number; y: number }> {
    const all = [...this.order].sort();
    const linked = new Set(this.edges.flatMap((e) => [e.s, e.t]));
    const ids = all.filter((id) => linked.has(id));
    const loose = all.filter((id) => !linked.has(id));
    const out = new Map<string, { x: number; y: number }>();
    // notes with no links at all sit in a tidy row along the bottom, so they do not drift to the corners of the map
    const rowY = height - 22;
    loose.forEach((id, i) => out.set(id, { x: 24 + ((i + 0.5) * (width - 48)) / loose.length, y: rowY }));
    height = loose.length ? height - 52 : height;
    if (ids.length === 0) return out;

    // ---- the groups, biggest first (a linked note that belongs to no group is a group of one)
    type G = { ids: string[]; R: number; x: number; y: number };
    const groups: G[] = [];
    const seen = new Set<string>();
    for (const c of this.clusters) {
      const members = c.members.filter((m) => linked.has(m)).sort();
      members.forEach((m) => seen.add(m));
      if (members.length) groups.push({ ids: members, R: 0, x: 0, y: 0 });
    }
    for (const id of ids) if (!seen.has(id)) groups.push({ ids: [id], R: 0, x: 0, y: 0 });
    groups.sort((a, b) => b.ids.length - a.ids.length || (a.ids[0] < b.ids[0] ? -1 : 1));
    const centre = this.centreNote();
    const centreGroup = centre ? groups.findIndex((g) => g.ids.includes(centre)) : -1;
    if (centreGroup > 0) groups.unshift(...groups.splice(centreGroup, 1)); // the group of the centre note goes first, and stays where it is
    const held = centreGroup >= 0;
    groups.forEach((g) => { g.R = 30 + 22 * Math.sqrt(g.ids.length); });
    const groupOf = new Map<string, number>();
    groups.forEach((g, gi) => g.ids.forEach((id) => groupOf.set(id, gi)));

    // ---- 1. pack the circles
    const link = groups.map(() => groups.map(() => 0));
    for (const e of this.edges) {
      const a = groupOf.get(e.s), b = groupOf.get(e.t);
      if (a !== undefined && b !== undefined && a !== b) { link[a][b] += e.w; link[b][a] += e.w; }
    }
    const top = Math.max(1, ...link.flat());
    const asp = Math.min(2.6, Math.max(1, width / height)); // packed to the shape of the picture: wide when the picture is wide
    groups.forEach((g, i) => { const a = i * 2.39996, d = i ? 120 + 95 * Math.sqrt(i) : 0; g.x = Math.cos(a) * d * Math.sqrt(asp); g.y = (Math.sin(a) * d) / Math.sqrt(asp); });
    const room = 70; // clear space between two circles, with the margin the drawn group circle adds
    for (let step = 0; step < 500; step++) {
      const cool = 1 - step / 500;
      for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const want = a.R + b.R + room;
        const move = d < want ? (want - d) / 2 : -Math.min((d - want) * 0.02 * (link[i][j] / top) * cool, 6);
        if (held && i === 0) { b.x += (dx / d) * move * 2; b.y += (dy / d) * move * 2; continue; } // the middle group does not move; the other one takes both halves
        a.x -= (dx / d) * move; a.y -= (dy / d) * move; b.x += (dx / d) * move; b.y += (dy / d) * move;
      }
      groups.forEach((g) => { g.x *= 0.998; g.y *= 1 - 0.0045 * asp; });
    }
    const total = ids.length;
    const mx = groups.reduce((s, g) => s + g.x * g.ids.length, 0) / total, my = groups.reduce((s, g) => s + g.y * g.ids.length, 0) / total;
    const ox = held ? groups[0].x : mx, oy = held ? groups[0].y : my;
    groups.forEach((g) => { g.x += width / 2 - ox; g.y += height / 2 - oy; });

    // ---- 2. the notes: pushed apart by their sizes, pulled by links, held inside their group's circle
    type N = { id: string; g: number; r: number; x: number; y: number; vx: number; vy: number };
    const nodes: N[] = [];
    groups.forEach((g, gi) => g.ids.forEach((id, k) => {
      const a = nodes.length * 2.39996, d = 10 + (k % 7) * 6;
      nodes.push({ id, g: gi, r: this.radiusOf(id), x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d, vx: 0, vy: 0 });
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const GAP = 14; // clear space kept between two dots
    let alpha = 1;
    for (let it = 0; it < 320; it++) {
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = Math.cos(i); dy = Math.sin(i); d2 = 1; }
        const d = Math.sqrt(d2), minD = a.r + b.r + GAP + (a.id === centre || b.id === centre ? 8 : 0); // the centre note wears a ring, so it keeps a little more room
        let f = 26000 / d2;
        if (d < minD) f += (minD - d) * 0.5; // too close: pushed apart hard
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx -= fx * alpha; a.vy -= fy * alpha; b.vx += fx * alpha; b.vy += fy * alpha;
      }
      for (const e of this.edges) {
        const a = byId.get(e.s), b = byId.get(e.t);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const together = a.g === b.g; // only a link inside a group draws its two ends close
        const L = (together ? 56 : 170) + a.r + b.r, f = (d - L) * (together ? 0.03 : 0.002);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx * alpha; a.vy += fy * alpha; b.vx -= fx * alpha; b.vy -= fy * alpha;
      }
      for (const n of nodes) {
        const g = groups[n.g];
        if (n.id === centre) { n.x = g.x; n.y = g.y; n.vx = 0; n.vy = 0; continue; } // the centre note stays in the middle of its circle
        n.vx += (g.x - n.x) * 0.1 * alpha; n.vy += (g.y - n.y) * 0.1 * alpha;
        const dx = n.x - g.x, dy = n.y - g.y, dist = Math.hypot(dx, dy) || 1, lim = g.R - n.r;
        if (dist > lim) { n.vx -= (dx / dist) * (dist - lim) * 0.3 * alpha; n.vy -= (dy / dist) * (dist - lim) * 0.3 * alpha; } // held inside its circle
        n.vx *= 0.8; n.vy *= 0.8; n.x += n.vx; n.y += n.vy;
      }
      alpha = Math.max(0.0005, alpha * 0.985);
    }

    // ---- 3a. dots that still touch are pushed apart, whatever the forces left
    for (let pass = 0; pass < 80; pass++) {
      let moved = false;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const want = a.r + b.r + 6 + (a.id === centre || b.id === centre ? 8 : 0);
        if (d >= want) continue;
        const push = want - d, ka = a.id === centre ? 0 : b.id === centre ? 1 : 0.5, kb = b.id === centre ? 0 : a.id === centre ? 1 : 0.5; // the centre note is never pushed
        a.x -= (dx / d) * push * ka; a.y -= (dy / d) * push * ka; b.x += (dx / d) * push * kb; b.y += (dy / d) * push * kb;
        moved = true;
      }
      if (!moved) break;
    }

    // ---- 3b. the circles drawn round the groups (and the dots of the bottom row) are pushed apart, each group moving as one piece
    type C = { members: N[]; cx: number; cy: number; r: number; fixed: boolean };
    const circles: C[] = groups.map((_, gi) => {
      const members = nodes.filter((n) => n.g === gi);
      const c = groupCircle(members);
      return { members, ...c, r: members.length >= 2 ? c.r : members[0].r + 10, fixed: held && gi === 0 };
    });
    for (const id of loose) { const p = out.get(id)!; circles.push({ members: [], cx: p.x, cy: p.y, r: this.radiusOf(id) + 10, fixed: true }); }
    for (let pass = 0; pass < 400; pass++) {
      let moved = false;
      for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
        const a = circles[i], b = circles[j];
        if (a.fixed && b.fixed) continue;
        let dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const want = a.r + b.r + 12;
        if (d >= want) continue;
        const push = want - d, ka = a.fixed ? 0 : b.fixed ? 1 : 0.5, kb = b.fixed ? 0 : a.fixed ? 1 : 0.5;
        for (const [c, k, s] of [[a, ka, -1], [b, kb, 1]] as const) {
          const mx = (dx / d) * push * k * s, my = (dy / d) * push * k * s;
          c.cx += mx; c.cy += my;
          for (const m of c.members) { m.x += mx; m.y += my; }
        }
        moved = true;
      }
      if (!moved) break;
    }
    for (const n of nodes) out.set(n.id, { x: n.x, y: n.y });
    return out;
  }
}

/** The note every session starts from; the map keeps it in the middle. */
export const CENTRE_NOTE = "start-here";
/** A project note with at least this many links out and none in is an entry point (an index), so the report does not say "nothing links to it". */
const ENTRY_LINKS = 5;

/** The margin the circle round a group keeps past its farthest dot. */
export const GROUP_PAD = 34;

/** The circle drawn round a group on the map: round the middle of its dots, reaching a little past the farthest one. The layout keeps these circles apart, so the map uses this same rule. */
export function groupCircle(pts: { x: number; y: number }[]): { cx: number; cy: number; r: number } {
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return { cx, cy, r: Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + GROUP_PAD };
}

/** A few words of the section around the first word that matched, with secrets already hidden. */
function snippetOf(s: Section, q: string[]): string {
  const lines = s.text.split("\n").map((l) => l.trim()).filter((l) => l && !/^#{1,6}\s/.test(l));
  const want = new Set(q);
  const hit = lines.find((l) => terms(l).some((t) => want.has(t))) ?? lines[0] ?? "";
  const clean = hit.replace(/[*`]/g, "").replace(/^[-\d.)\s]+/, "");
  return clean.length > 220 ? clean.slice(0, 219) + "…" : clean;
}
