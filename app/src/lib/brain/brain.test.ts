// Tests of the brain engine, run by Node itself (no packages): `node --test src/lib/brain/brain.test.ts` from the app folder.
// They read the real starter notes from disk and calibrate the bars of the three-answer search on real questions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { Brain } from "./engine.ts";
import { redact, terms } from "./text.ts";
import { frontMatter, sectionsOf } from "./parse.ts";
import type { RawNote } from "./parse.ts";

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
