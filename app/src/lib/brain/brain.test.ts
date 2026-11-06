// Tests of the brain engine, run by Node itself (no packages): `node --test src/lib/brain/brain.test.ts` from the app folder.
// They read the real starter notes from disk and calibrate the bars of the three-answer search on real questions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { Brain, groupCircle } from "./engine.ts";
import { redact, terms } from "./text.ts";
import { frontMatter, sectionsOf } from "./parse.ts";
import { cleanBody } from "./clean.ts";
import { ticketsOf, type RawNote } from "./parse.ts";

const dir = new URL("../../brain/starter/", import.meta.url);
const starter: RawNote[] = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => ({ id: f.replace(/\.md$/, ""), layer: "starter" as const, text: readFileSync(new URL(f, dir), "utf8"), readonly: true }));
const NOW = Date.parse("2026-10-28T12:00:00Z");

test("every wiki link in the starter notes goes somewhere, and no starter note is on its own", () => {
  const b = new Brain(starter);
  for (const n of b.notes.values()) for (const l of n.links) assert.ok(l.target, `${n.id}: [[${l.raw}]] goes nowhere`);
  for (const n of b.notes.values()) assert.ok(b.incoming(n.id).length + b.outgoing(n.id).length > 0, `${n.id} has no links`);
  assert.equal(b.report(NOW).counts["broken-link"] ?? 0, 0);
});

test("the starter notes are cut into sections with line numbers that match the file", () => {
  const b = new Brain(starter);
  const n = b.notes.get("context-and-cost")!;
  const lines = n.raw.split("\n");
  for (const s of n.sections) {
    assert.ok(s.start >= 1 && s.end >= s.start && s.end <= lines.length, `${s.id} lines ${s.start}-${s.end}`);
    if (s.level > 1 && !s.id.endsWith("#1")) assert.ok(/^#{1,3}\s/.test(lines[s.start - 1]), `${s.id} should start at a heading, starts at "${lines[s.start - 1]}"`);
  }
  assert.ok(n.sections.length >= 3);
});

// questions with the answer the search should give; the bars (0.8 and 0.4) were set from this list
const QUESTIONS: [string, "found" | "partly" | "none", string[]?][] = [
  ["what is a worktree", "found", ["tickets-and-worktrees"]],
  ["how do I reduce token cost", "partly", ["context-and-cost"]], // "reduce" is in no note, so only part of the question matches
  ["how do I make claude cheaper", "found", ["context-and-cost"]],
  ["what permission modes are there", "found", ["roles-and-permission-modes"]],
  ["what is a hook", "found", ["skills-mcp-and-hooks"]],
  ["how do I stop a dev server a session left running", "found", ["kona-leftovers", "safe-habits"]],
  ["where does claude keep its memory", "found", ["claude-md-and-memory", "how-the-brain-works"]],
  ["why does a long session get worse", "found", ["agents-and-sessions"]],
  ["who can move a ticket to done", "found", ["kona-board", "tickets-and-worktrees"]],
  ["how should I write a good ticket", "found", ["good-tickets-and-prompts"]],
  ["what does the brain do with secrets", "found", ["how-the-brain-works"]],
  ["what is a subagent", "found", ["skills-mcp-and-hooks"]],
  ["how do I deploy a worktree", "partly"],
  ["explain the cache", "partly"],
  ["how do I deploy to a VPS with ssh keys", "none"],
  ["laravel migration rollback", "none"],
  ["recipe for banana bread", "none"],
  ["", "none"],
  ["how do I", "none"],
];

test("the search says found, partly or not in the brain, and says so for the right questions", () => {
  const b = new Brain(starter);
  const out: string[] = [];
  for (const [q, want, note] of QUESTIONS) {
    const r = b.search(q);
    out.push(`${r.state.padEnd(6)} ${(r.hits[0]?.coverage ?? 0).toFixed(2)}  ${q}  -> ${r.hits[0]?.note.id ?? "-"}`);
    assert.equal(r.state, want, `"${q}" gave ${r.state}`);
    if (note) assert.ok(r.hits.slice(0, 3).some((h) => note.includes(h.note.id)), `"${q}" should reach ${note.join(" or ")}, reached ${r.hits.map((h) => h.note.id).join(", ")}`);
  }
  console.log(out.join("\n"));
});

test("a miss offers the nearest note, and a hit offers none", () => {
  const b = new Brain(starter);
  assert.equal(b.search("what is a worktree").nearest, null);
  const r = b.search("how do I deploy a worktree");
  assert.equal(r.nearest?.id, "tickets-and-worktrees");
});

test("the search reports what it looked at", () => {
  const b = new Brain(starter);
  const r = b.search("hooks");
  assert.equal(r.looked.notes, starter.length);
  assert.ok(r.looked.sections > starter.length);
  assert.deepEqual(r.looked.layers, ["starter"]);
});

test("the groups and the map are the same every time", () => {
  const a = new Brain(starter), b = new Brain([...starter].reverse());
  assert.deepEqual(a.clusters.map((c) => c.members), b.clusters.map((c) => c.members));
  assert.deepEqual([...a.layout(800, 500)], [...b.layout(800, 500)]);
  assert.ok(a.clusters.length >= 1 && a.clusters.length <= 8, `${a.clusters.length} groups`);
});

test("a few hub notes do not pull every note into one group", () => {
  const raw: RawNote[] = [];
  const mk = (id: string, links: string[]) => raw.push({ id, layer: "project", readonly: false, text: `# ${id}\n\n${links.map((l) => `[[${l}]]`).join(" ")}\n` });
  mk("hub-one", []); mk("hub-two", []);
  for (let i = 0; i < 6; i++) mk(`left-${i}`, [`left-${(i + 1) % 6}`, "hub-one", "hub-two"]);
  for (let i = 0; i < 6; i++) mk(`right-${i}`, [`right-${(i + 1) % 6}`, "hub-one", "hub-two"]);
  const b = new Brain(raw);
  const left = b.clusterOf.get("left-0"), right = b.clusterOf.get("right-0");
  assert.notEqual(left, right, "the two rings should stay two groups");
});

test("secrets are hidden from the index and the snippets, and the report names the note, not the secret", () => {
  const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
  const raw: RawNote[] = [{ id: "deploy-notes", layer: "project", readonly: false, text: `# Deploy notes\n\nThe server login is password: hunter2hunter2 and the key is ${key}. The host is 203.0.113.7.\n` }];
  const b = new Brain(raw);
  const r = b.search("anthropic key");
  assert.ok(!r.hits.some((h) => (h.snippet + h.section.text).includes(key)), "the key must not appear in a result");
  assert.equal(b.search("hunter2hunter2").state, "none");
  const rep = b.report(NOW);
  assert.equal(rep.counts["secret"], 1);
  assert.ok(!JSON.stringify(rep).includes(key));
  assert.deepEqual(redact("see 127.0.0.1 and 10.1.2.3").found, ["IP address"]);
  assert.ok(redact("see 127.0.0.1").text.includes("127.0.0.1"));
  assert.equal(redact("an ordinary sentence about passwords in general.").found.length, 0);
});

test("the report finds what needs a look", () => {
  const raw: RawNote[] = [
    { id: "alpha", layer: "project", readonly: false, text: "---\ntitle: Alpha\nkind: decision\n---\n# Alpha\n\nSee [[beta]] and [[missing-note]].\n" },
    { id: "beta", layer: "project", readonly: false, text: "---\ntitle: Beta\nkind: open\ndate: 2026-08-01\n---\n# Beta\n\nAn open item that waited.\n" },
    { id: "lonely", layer: "project", readonly: false, text: "# Lonely\n\nNothing links here and it links nowhere.\n" },
    { id: "memory-old", layer: "memory", readonly: true, mtime: NOW - 200 * 86_400_000, text: "# Old memory\n\nsomething from long ago\n" },
  ];
  const rep = new Brain(raw).report(NOW, 2);
  const codes = rep.warnings.map((w) => w.code);
  for (const c of ["broken-link", "decision-no-source", "old-open", "orphan", "old-memory", "wanted"]) assert.ok(codes.includes(c), `missing ${c}: ${codes.join(",")}`);
  assert.ok(rep.warnings.find((w) => w.code === "old-open")!.text.includes("88 days"));
  assert.ok(rep.hubs.length >= 1);
});

test("front matter, sections and a heading inside a code fence", () => {
  const text = "---\ntitle: T\nkind: topic\n---\n# T\n\nintro words\n\n```\n# not a heading\n```\n\n## One\nsome text here that is long enough to stand on its own as a section of the note for sure yes.\n\n## Two\nmore text here that is long enough to stand on its own as a section of the note for sure yes.\n";
  const { meta, bodyStart } = frontMatter(text);
  assert.equal(meta.kind, "topic"); assert.equal(bodyStart, 4);
  const s = sectionsOf("t", text, bodyStart, "T");
  assert.deepEqual(s.map((x) => x.heading), ["One", "Two"]);
  assert.ok(s[0].start > 4);
});

test("terms fold accents, plurals and filler words", () => {
  assert.deepEqual(terms("The Servers, and a server's costs"), ["server", "server", "cost"]);
  assert.deepEqual(terms("Café"), ["cafe"]);
});

test("a note written by the model: invented links become plain words, real ones stay, and the title is taken out", () => {
  const known = new Set(["context-and-cost", "release-plan"]);
  const text = "TITLE: Fixed the login redirect\n---\nfoo: bar\n---\n# A repeated title\n\n## What happened\nSee [[context-and-cost]] and [[Made Up Note]] and [[release-plan|the plan]] and [[ghost|shown words]].\n";
  const { title, body } = cleanBody(text, known);
  assert.equal(title, "Fixed the login redirect");
  assert.ok(body.includes("[[context-and-cost]]"));
  assert.ok(body.includes("[[release-plan]]"));
  assert.ok(!body.includes("[[Made Up Note]]") && body.includes("Made Up Note"));
  assert.ok(!body.includes("[[ghost") && body.includes("shown words"));
  assert.ok(!body.includes("foo: bar") && !body.includes("A repeated title"));
});

// The map: no two dots touch and no two group circles overlap, as in the canon's skill graph (see the comment on Brain.layout).
function mapProblems(b: Brain, width = 880, height = 560): string[] {
  const pos = b.layout(width, height), problems: string[] = [];
  const ids = [...pos.keys()];
  assert.equal(ids.length, b.notes.size, "every note has a place");
  for (const p of pos.values()) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) problems.push("a position is not a number");
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = pos.get(ids[i])!, c = pos.get(ids[j])!, need = b.radiusOf(ids[i]) + b.radiusOf(ids[j]);
    if (Math.hypot(a.x - c.x, a.y - c.y) < need) problems.push(`dots ${ids[i]} and ${ids[j]} touch`);
  }
  const circles = b.clusters.filter((c) => c.members.length >= 2).map((c) => ({ id: c.id, ...groupCircle(c.members.map((m) => pos.get(m)!)) }));
  for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
    if (Math.hypot(circles[i].cx - circles[j].cx, circles[i].cy - circles[j].cy) < circles[i].r + circles[j].r) problems.push(`group circles ${circles[i].id} and ${circles[j].id} overlap`);
  }
  return problems;
}

test("on the starter notes, no two dots touch and no two group circles overlap", () => {
  assert.deepEqual(mapProblems(new Brain(starter)), []);
});

test("on a crowd of notes with hubs, loose notes and links between groups, the same holds, at any shape of picture", () => {
  const raw: RawNote[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const mk = (id: string, links: string[]) => raw.push({ id, layer: "project", readonly: false, text: `# ${id}\n\n${links.map((l) => `[[${l}]]`).join(" ")}\n` });
  for (let g = 0; g < 7; g++) for (let i = 0; i < 10; i++) {
    const links = [`g${g}-${(i + 1) % 10}`];
    if (i === 0) links.push("hub");
    if (rnd() < 0.15) links.push(`g${Math.floor(rnd() * 7)}-${Math.floor(rnd() * 10)}`);
    mk(`g${g}-${i}`, links.filter((l) => l !== `g${g}-${i}`));
  }
  mk("hub", ["g0-0", "g3-0"]);
  mk("alone-one", []); mk("alone-two", []); mk("alone-three", []);
  const b = new Brain(raw);
  for (const [w, h] of [[880, 560], [1400, 500], [600, 600]]) assert.deepEqual(mapProblems(b, w, h), [], `${w} x ${h}`);
});

test("the Start here note is in the exact middle of the map, and nothing else is pushed on top of it", () => {
  const b = new Brain(starter);
  assert.equal(b.centreNote(), "start-here");
  for (const [w, h] of [[880, 560], [1400, 560], [560, 560]]) {
    const pos = b.layout(w, h);
    assert.deepEqual(pos.get("start-here"), { x: w / 2, y: h / 2 }, `${w} x ${h}`);
    assert.deepEqual(mapProblems(b, w, h), []);
  }
  // a brain without that note has no centre note and still lays out
  const plain = new Brain(starter.filter((n) => n.id !== "start-here"));
  assert.equal(plain.centreNote(), null);
  assert.deepEqual(mapProblems(plain), []);
});

test("with the centre note and a project's own notes (some with no links), the middle holds and nothing touches", () => {
  const raw: RawNote[] = [...starter, { id: "own-a", layer: "project", readonly: false, text: "# Own A\n\nSee [[start-here]] and [[own-b]].\n" }, { id: "own-b", layer: "project", readonly: false, text: "# Own B\n\n[[own-a]]\n" }, { id: "own-loose", layer: "project", readonly: false, text: "# Own loose\n\nNothing links here.\n" }];
  const b = new Brain(raw);
  const pos = b.layout(880, 560);
  assert.deepEqual(pos.get("start-here"), { x: 440, y: (560 - 52) / 2 });
  assert.deepEqual(mapProblems(b), []);
});

test("a note's tickets come from the stamp Kona writes, and a title that names another ticket is reported", () => {
  const mk = (id: string, head: string, title: string): RawNote => ({ id, layer: "project", readonly: false, text: `---\ntitle: ${title}\nkind: decision\ndate: 2026-11-05\nsource: agent\nsession: s1\n${head}---\n# ${title}\n\nText.\n` });
  const a = mk("credit-table", "ticket: T-0005\ntickets: T-0005, T-0009\n", "Credit table approved");
  const b = mk("other-note", "ticket: T-0003\n", "Report for T-0007");
  const c = mk("no-ticket", "", "A note with no ticket");
  const brain = new Brain([a, b, c]);
  assert.deepEqual(brain.notes.get("credit-table")!.tickets, ["T-0005", "T-0009"]);
  assert.deepEqual(brain.notes.get("no-ticket")!.tickets, []);
  assert.deepEqual(ticketsOf({ ticket: "T-0005", tickets: "T-0005, T-0009, junk, T-12" }), ["T-0005", "T-0009"], "junk and short ids are dropped, no repeats");
  const warns = brain.report(NOW).warnings.filter((w) => w.code === "ticket-mismatch");
  assert.equal(warns.length, 1);
  assert.ok(warns[0].text.includes("T-0007") && warns[0].text.includes("T-0003") && warns[0].noteId === "other-note");
  // a decision with a ticket is not "without a source" even with no session
  const d: RawNote = { id: "d", layer: "project", readonly: false, text: "---\ntitle: D\nkind: decision\nticket: T-0001\n---\n# D\n\nText.\n" };
  assert.equal(new Brain([d]).report(NOW).warnings.filter((w) => w.code === "decision-no-source").length, 0);
});

test("a ticket named in a note's text reaches every note written under that ticket", () => {
  const first: RawNote = { id: "written-under-both", layer: "project", readonly: false, text: "---\ntitle: Written under both\nticket: T-0005\ntickets: T-0005, T-0009\n---\n# Written under both\n\nText.\n" };
  const reader: RawNote = { id: "reader", layer: "project", readonly: false, text: "# Reader\n\nSee ticket T-0009 for the reasons.\n" };
  const brain = new Brain([first, reader]);
  assert.ok(brain.edges.some((e) => e.s === "reader" && e.t === "written-under-both"), "the second ticket also links");
});

// A long document must not answer a question just because the words are somewhere in it (ticket T-0033). The same two notes and questions are in the Rust twin's tests
// (brain_search.rs), which must give the same answers.
const longDoc = (): RawNote[] => {
  const filler = (n: number, seed: string) => Array.from({ length: n }, (_, i) => `${seed}${i % 17} plain filler words about nothing in particular`).join(" ");
  const text = `# A long report\n\n${filler(30, "alpha")} The refund policy for the premium plan is thirty days. ${filler(30, "beta")}\n\n${filler(30, "gamma")} Servers in Frankfurt hold the backups. ${filler(30, "delta")}\n`;
  return [{ id: "long-report", layer: "project", readonly: false, text }];
};

test("words that stand far apart in a long section do not count as an answer, words that stand together do", () => {
  const b = new Brain(longDoc());
  const together = b.search("refund policy premium plan thirty days");
  assert.equal(together.state, "found", "the words stand in one sentence");
  const apart = b.search("refund policy Frankfurt backups");
  assert.equal(apart.state === "found", false, "one half of the question is in one paragraph and the other half far away");
  // a short section is read whole, as before
  const short = new Brain([{ id: "short-note", layer: "project", readonly: false, text: "# Short note\n\nRefunds take thirty days. Backups sit in Frankfurt.\n" }]);
  assert.equal(short.search("refunds thirty days backups Frankfurt").state, "found");
});

test("the report says when a note links to a note that changed after it, and when two decisions under one ticket are on different days", () => {
  const mk = (id: string, kind: string, date: string, extra = "", body = ""): RawNote => ({ id, layer: "project", readonly: false, text: `---\ntitle: ${id}\nkind: ${kind}\ndate: ${date}\n${extra}---\n# ${id}\n\n${body}\n` });
  const old = mk("old-note", "decision", "2026-11-01", "", "See [[changed-note]] for the numbers.");
  const changed = mk("changed-note", "topic", "2026-10-20", "updated: 2026-11-05\n", "The numbers.");
  const same = mk("same-day", "decision", "2026-11-05", "", "See [[changed-note]].");
  const session = mk("a-session", "session", "2026-11-01", "", "See [[changed-note]].");
  const w = new Brain([old, changed, same, session]).report(NOW).warnings.filter((x) => x.code === "link-newer");
  assert.equal(w.length, 1, "only the older note that states something is named");
  assert.ok(w[0].noteId === "old-note" && w[0].text.includes("2026-11-05") && w[0].severity === "info");
  const d1 = mk("decision-one", "decision", "2026-11-01", "ticket: T-0005\n"), d2 = mk("decision-two", "decision", "2026-11-04", "ticket: T-0005\n"), d3 = mk("decision-three", "decision", "2026-11-04", "ticket: T-0006\n"), d4 = mk("decision-four", "decision", "2026-11-04", "ticket: T-0006\n");
  const two = new Brain([d1, d2, d3, d4]).report(NOW).warnings.filter((x) => x.code === "two-decisions");
  assert.equal(two.length, 1, "T-0005 has two days, T-0006 has one");
  assert.ok(two[0].text.includes("T-0005"));
});
