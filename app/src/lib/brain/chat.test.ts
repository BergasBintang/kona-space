// What is sent to the Ask page's call, and how its answer is read (decision 92).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Brain } from "./engine.ts";
import { MAX_PAST, MAX_SECTION, MAX_SECTIONS, MAX_TURNS, chatPrompt, readChatAnswer } from "./chat.ts";

const note = (id: string, title: string, body: string) => ({ id, title, text: `---\ntitle: ${title}\nkind: topic\n---\n${body}\n`, layer: "project" as const, readonly: false });
const brain = () => new Brain([
  note("worktrees", "Worktrees", "# Worktrees\n\nA worktree is a second copy of the project folder on its own branch, so two sessions can work at once without touching each other's files. Remove it when the branch is merged."),
  note("servers", "Servers", "# Servers\n\nThe key file of a server stays on this PC. Kona keeps only the path and the fingerprint."),
]);

test("the prompt holds the numbered sections, the earlier messages and the question, in that order", () => {
  const hits = brain().search("what is a worktree").hits;
  assert.ok(hits.length > 0);
  const { prompt, sent } = chatPrompt("what is a worktree", [{ question: "hello", answer: "Hi there." }], hits);
  assert.equal(sent.length, Math.min(hits.length, MAX_SECTIONS));
  assert.ok(prompt.startsWith("SECTION 1: Worktrees > "));
  assert.ok(prompt.indexOf("EARLIER MESSAGES") > prompt.indexOf("SECTION 1"));
  assert.ok(prompt.indexOf("QUESTION") > prompt.indexOf("EARLIER MESSAGES"));
  assert.ok(prompt.includes("Question: hello\nAnswer: Hi there."));
  assert.ok(prompt.endsWith("QUESTION\nwhat is a worktree"));
});

test("a secret is hidden in the sections, the earlier messages and the question", () => {
  const key = "sk-ant-api03-" + "a".repeat(40);
  const b = new Brain([note("k", "Keys", `# Keys\n\nThe worktree token is ${key} and stays secret.`)]);
  const { prompt } = chatPrompt(`is ${key} a worktree`, [{ question: `my ${key}`, answer: `it was ${key}` }], b.search("worktree token").hits);
  assert.ok(!prompt.includes(key), prompt);
});

test("sections, earlier messages and their length are limited", () => {
  const long = "word ".repeat(2000);
  const b = new Brain(Array.from({ length: 8 }, (_, i) => note(`n${i}`, `Worktree ${i}`, `# Worktree ${i}\n\nworktree ${long}`)));
  const hits = b.search("worktree word").hits;
  const past = Array.from({ length: 9 }, (_, i) => ({ question: `q${i}`, answer: "a ".repeat(900) }));
  const { prompt, sent } = chatPrompt("worktree", past, hits);
  assert.ok(sent.length <= MAX_SECTIONS);
  assert.equal((prompt.match(/^Question: /gm) ?? []).length, MAX_TURNS);
  assert.ok(prompt.includes("q8") && !prompt.includes("q4"), "the latest earlier messages are kept");
  assert.ok(prompt.length < MAX_SECTIONS * (MAX_SECTION + 200) + MAX_TURNS * (2 * MAX_PAST + 40) + 400, String(prompt.length));
});

test("an earlier message with no answer is left out", () => {
  const { prompt } = chatPrompt("worktree", [{ question: "old", answer: "" }], brain().search("worktree").hits);
  assert.ok(!prompt.includes("EARLIER MESSAGES"));
});

test("an answer with a USED line gives the words and the numbers, only those that were sent", () => {
  const r = readChatAnswer("A worktree is a second copy of the folder.\nUSED: 1, 3, 9, 1", 3);
  assert.deepEqual(r, { readable: true, covered: true, text: "A worktree is a second copy of the folder.", used: [1, 3] });
});

test("a bold USED line and a line with windows line ends are read", () => {
  const r = readChatAnswer("It stays on this PC.\r\n**USED:** 2\r\n", 2);
  assert.deepEqual(r.used, [2]);
  assert.equal(r.text, "It stays on this PC.");
});

test("an answer with no USED line is shown but names no notes", () => {
  const r = readChatAnswer("It stays on this PC.", 2);
  assert.deepEqual(r, { readable: true, covered: true, text: "It stays on this PC.", used: [] });
});

test("NOT COVERED is not an answer", () => {
  for (const a of ["NOT COVERED\nUSED: none", "not covered", "**NOT COVERED**\n\nUSED: none"]) {
    const r = readChatAnswer(a, 2);
    assert.equal(r.covered, false, a);
    assert.equal(r.readable, true);
    assert.equal(r.text, "");
  }
});

test("an empty answer, or only a USED line, is unreadable", () => {
  assert.equal(readChatAnswer("", 2).readable, false);
  assert.equal(readChatAnswer("USED: 1", 2).readable, false);
});
