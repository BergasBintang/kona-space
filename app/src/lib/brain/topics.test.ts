// Tests of the topic line (decision 104): a note names its topic in its own front matter, and the Notes list, the Map, the Report, the Ask page and the sessions' tools all use that one line.
// Run by Node itself: `node --test src/lib/brain/topics.test.ts` from the app folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Brain, NO_TOPIC, groupCircle } from "./engine.ts";
import { cleanTopic, parseNote, setFrontLine, type RawNote } from "./parse.ts";

const note = (id: string, topic: string | null, links: string[] = [], extra = "", layer: RawNote["layer"] = "project"): RawNote => ({
  id, layer, readonly: layer !== "project",
  text: `---\ntitle: ${id.replace(/-/g, " ")}\nkind: note\n${topic ? `topic: ${topic}\n` : ""}${extra}---\n# ${id.replace(/-/g, " ")}\n\nSome words about ${id.replace(/-/g, " ")} and how it works in this project.\n\n${links.map((l) => `See [[${l}]].`).join("\n")}\n`,
});

test("a topic is kept on one line, with single spaces and at most 40 letters", () => {
  assert.equal(cleanTopic("  Landing   page \n and design "), "Landing page and design");
  assert.equal(cleanTopic(undefined), "");
  assert.equal(cleanTopic("x".repeat(60)).length, 40);
  assert.equal(parseNote(note("a-note", "CV format")).topic, "CV format");
  assert.equal(parseNote(note("a-note", null)).topic, "");
});

test("setFrontLine sets, replaces and takes out one line and leaves everything else as it was", () => {
  const t = "---\ntitle: A\nkind: note\n---\n# A\n\nBody: with a colon\n";
  const set = setFrontLine(t, "topic", "Landing");
  assert.equal(set, "---\ntitle: A\nkind: note\ntopic: Landing\n---\n# A\n\nBody: with a colon\n");
  assert.equal(setFrontLine(set, "topic", "CV"), "---\ntitle: A\nkind: note\ntopic: CV\n---\n# A\n\nBody: with a colon\n");
  assert.equal(setFrontLine(set, "topic", ""), t);
  assert.equal(setFrontLine("# No front matter\n", "topic", "CV"), "---\ntopic: CV\n---\n# No front matter\n");
  assert.equal(setFrontLine("# No front matter\n", "topic", ""), "# No front matter\n");
  // a key is matched whole and in any case, not as the start of another key
  assert.equal(setFrontLine("---\nTopic: Old\ntopics: keep\n---\nx\n", "topic", "New"), "---\ntopic: New\ntopics: keep\n---\nx\n");
  // the line endings of the file stay
  assert.equal(setFrontLine("---\r\ntitle: A\r\n---\r\nx\r\n", "topic", "CV"), "---\r\ntitle: A\r\ntopic: CV\r\n---\r\nx\r\n");
  // a body line that looks like a key is not touched
  assert.equal(setFrontLine("---\ntitle: A\n---\ntopic: not front matter\n", "topic", "CV"), "---\ntitle: A\ntopic: CV\n---\ntopic: not front matter\n");
});

// two topics whose notes link ACROSS the topics more than inside them, so the links alone would group them differently
const crossed = (): RawNote[] => [
  note("logo-one", "Brand", ["page-one", "page-two", "page-three"]),
  note("logo-two", "Brand", ["page-one", "page-two"]),
  note("page-one", "Landing page", ["logo-one", "logo-two"]),
  note("page-two", "Landing page", ["logo-one", "logo-two", "page-one"]),
  note("page-three", "landing page", ["logo-one"]),
  note("loose-note", null, []),
  note("memory-thing", null, [], "", "memory"),
];

test("the groups are the topics the notes name, whatever the links say", () => {
  const b = new Brain(crossed());
  assert.equal(b.usesTopics, true);
  const by = new Map(b.clusters.map((c) => [c.label, c]));
  assert.deepEqual([...by.keys()].sort(), ["Brand", "Claude's memory", "Landing page", NO_TOPIC].sort());
  assert.deepEqual(by.get("Landing page")!.members.sort(), ["page-one", "page-three", "page-two"], "a topic is the same in any case");
  assert.deepEqual(by.get("Brand")!.members.sort(), ["logo-one", "logo-two"]);
  assert.deepEqual(by.get(NO_TOPIC)!.members, ["loose-note"]);
  assert.equal(by.get(NO_TOPIC)!.by, "none");
  assert.equal(by.get("Claude's memory")!.by, "layer");
  for (const c of b.clusters) for (const m of c.members) assert.equal(b.clusterOf.get(m), c.id);
  // the links alone are kept, as the check
  assert.ok(b.linkGroups.length >= 1 && b.linkGroups.every((c) => c.by === "links"));
});

test("a project whose notes name no topic keeps the groups made by the links, as before", () => {
  const raw = crossed().map((r) => ({ ...r, text: r.text.replace(/^topic: .*\n/m, "") }));
  const b = new Brain(raw);
  assert.equal(b.usesTopics, false);
  assert.ok(b.clusters.every((c) => c.by === "links"));
  assert.deepEqual(b.clusters.map((c) => c.members), b.linkGroups.map((c) => c.members));
  assert.equal(b.report().topics, false);
});

test("the list of notes by topic is written by Kona: it is not searched, draws no links and is not a lost note", () => {
  const list: RawNote = { id: "brain-index", layer: "project", readonly: false, text: `---\ntitle: Every note by topic\ntopic: Index\ngenerated: topics\n---\n# Every note by topic\n\n## Brand\n\n- [[logo-one]]: the first logo of the refund policy\n- [[logo-two]]: the second\n` };
  const b = new Brain([...crossed(), list]);
  assert.equal(b.notes.get("brain-index")!.generated, true);
  assert.equal(b.edges.some((e) => e.s === "brain-index" || e.t === "brain-index"), false, "no line starts or ends at the list");
  assert.equal(b.clusters.find((c) => c.members.includes("brain-index"))!.label, "Index");
  assert.equal(b.search("the first logo of the refund policy").hits.some((h) => h.note.id === "brain-index"), false, "a question is not answered by the list");
  assert.equal(b.report().warnings.some((w) => w.code === "orphan" && w.noteId === "brain-index"), false);
  assert.equal(b.report().topicChecks.some((c) => c.noteId === "brain-index"), false);
});

test("a note with no topic is suggested the topic its links point to, and a note filed against its links is flagged", () => {
  const raw: RawNote[] = [
    ...["a1", "a2", "a3", "a4", "a5"].map((id) => note(`alpha-${id}`, "Alpha", ["alpha-a1", "alpha-a2", "alpha-a3"].filter((l) => l !== `alpha-${id}`))),
    ...["b1", "b2"].map((id) => note(`beta-${id}`, "Beta", [`beta-${id === "b1" ? "b2" : "b1"}`])),
    note("new-note-x", null, ["alpha-a1", "alpha-a2", "alpha-a3", "beta-b1"]),
    note("strayed-note", "Beta", ["alpha-a1", "alpha-a2", "alpha-a3", "alpha-a4", "alpha-a5"]),
    note("beta-stays", "Beta", ["beta-b1", "beta-b2", "alpha-a1"]),
  ];
  const b = new Brain(raw);
  const checks = new Map(b.report().topicChecks.map((c) => [c.noteId, c]));
  assert.equal(checks.get("new-note-x")?.suggest, "Alpha");
  assert.equal(checks.get("new-note-x")?.current, null);
  assert.equal(checks.get("strayed-note")?.suggest, "Alpha");
  assert.equal(checks.get("strayed-note")?.current, "Beta");
  assert.equal(checks.has("beta-stays"), false, "a note whose links mostly agree is left alone");
  assert.equal(checks.has("alpha-a1"), false);
  assert.ok(b.report().disagreements.some((d) => d.includes("strayed note") && d.includes("Beta") && d.includes("Alpha")));
  // the checks only suggest: nothing moved
  assert.equal(b.clusters.find((c) => c.members.includes("strayed-note"))!.label, "Beta");
  // a note whose links reach no note with a topic has no suggestion, and says so
  const lone = new Brain([note("only-one", null, []), note("with-topic", "Alpha", [])]);
  assert.equal(lone.report().topicChecks.find((c) => c.noteId === "only-one")?.suggest, null);
});

test("a question that names a note by its id or its whole title is answered with that note", () => {
  const b = new Brain([
    note("board-start-flow-norbit-tickets", "Plan", [], ""),
    note("board-start-flow-norbit-tickets-live", "Plan", []),
    note("short", "Plan"),
    { id: "x-y-z-things", layer: "project", readonly: false, text: "---\ntitle: How the deploy script is run on Fridays\n---\n# How the deploy script is run on Fridays\n\nWe push, then run the script and check the page every Friday afternoon without fail.\n" },
  ]);
  const r = b.search("which index group is board-start-flow-norbit-tickets live?");
  assert.equal(r.state, "found");
  assert.equal(r.hits[0].note.id, "board-start-flow-norbit-tickets", "the id stands alone: the longer id is a different note");
  assert.ok(r.hits.every((h) => h.note.id === "board-start-flow-norbit-tickets"));
  assert.equal(b.search("tell me about board-start-flow-norbit-tickets-live").hits[0].note.id, "board-start-flow-norbit-tickets-live");
  assert.notEqual(b.search("what does short say").hits[0]?.score, 1000, "a short id is a word, not a name: it is found by its words");
  assert.equal(b.search("where is “How the deploy script is run on Fridays” kept").hits[0].note.id, "x-y-z-things");
  assert.equal(b.search("no such thing as zz-nothing-here").state, "none");
});

test("the topic ranks the notes of a topic first but never makes a note look like an answer", () => {
  const raw = [
    note("alpha-one", "Refund policy", [], "").text.replace("Some words about alpha one", "Some words about alpha one and the weather"),
    note("beta-one", null, []).text,
  ].map((text, i) => ({ id: i === 0 ? "alpha-one" : "beta-one", layer: "project" as const, readonly: false, text }));
  const b = new Brain(raw);
  assert.notEqual(b.search("refund policy").state, "found", "only the topic says refund policy, so the notes do not answer it");
});

test("the map keeps its rules when the groups are topics", () => {
  const raw: RawNote[] = [];
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let g = 0; g < 6; g++) for (let i = 0; i < 9; i++) {
    const links = [`n${g}-${(i + 1) % 9}`];
    if (rnd() < 0.3) links.push(`n${Math.floor(rnd() * 6)}-${Math.floor(rnd() * 9)}`);
    raw.push(note(`n${g}-${i}`, rnd() < 0.1 ? null : `Topic ${g}`, links.filter((l) => l !== `n${g}-${i}`)));
  }
  raw.push(note("alone-one", "Topic 0", []), note("alone-two", "Solo", []), note("alone-three", null, []));
  const b = new Brain(raw);
  assert.equal(b.usesTopics, true);
  for (const [w, h] of [[880, 560], [1400, 500], [600, 600]]) {
    const pos = b.layout(w, h), problems: string[] = [];
    const ids = [...pos.keys()];
    assert.equal(ids.length, b.notes.size);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = pos.get(ids[i])!, c = pos.get(ids[j])!;
      if (Math.hypot(a.x - c.x, a.y - c.y) < b.radiusOf(ids[i]) + b.radiusOf(ids[j])) problems.push(`dots ${ids[i]} and ${ids[j]} touch`);
    }
    const circles = b.clusters.filter((c) => c.members.filter((m) => b.isLinked(m)).length >= 2).map((c) => ({ id: c.id, ...groupCircle(c.members.filter((m) => b.isLinked(m)).map((m) => pos.get(m)!)) }));
    for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
      if (Math.hypot(circles[i].cx - circles[j].cx, circles[i].cy - circles[j].cy) < circles[i].r + circles[j].r) problems.push(`circles ${circles[i].id} and ${circles[j].id} overlap`);
    }
    assert.deepEqual(problems, [], `${w} x ${h}`);
  }
});
