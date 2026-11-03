import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, questionsOf, reducer, type State } from "./sessions.ts";

const started = (): State => reducer(initialState, { type: "event", sessionId: "s1", record: { type: "kona/started", folder: "D:\\norbit", roleId: "product", accountId: "main", model: "sonnet", mode: "plan" } });
// what Claude Code really sent in the test of 2026-11-02: one question with two options, as a permission request of the tool AskUserQuestion
const request = { type: "control_request", request_id: "r1", request: { subtype: "can_use_tool", tool_name: "AskUserQuestion", input: { questions: [{ question: "Which colour do you prefer?", header: "Colour", options: [{ label: "Red", description: "Pick Red." }, { label: "Blue", description: "Pick Blue." }], multiSelect: false }] } } };

test("Claude's question tool becomes a question card, not a blank allow-or-deny card, and the person waits for the owner", () => {
  const s = reducer(started(), { type: "event", sessionId: "s1", record: request }).sessions.s1;
  assert.equal(s.run, "waiting");
  const it = s.items.find((x) => x.kind === "question");
  assert.ok(it && it.kind === "question" && it.questions[0].options.map((o) => o.label).join() === "Red,Blue" && it.status === "asking");
  assert.ok(!s.items.some((x) => x.kind === "permission"));
});

test("answering marks the card, keeps what was said, and the person works again; skipping is kept too", () => {
  const asked = reducer(started(), { type: "event", sessionId: "s1", record: request });
  const a = reducer(asked, { type: "question-answered", sessionId: "s1", requestId: "r1", answers: { "Which colour do you prefer?": "Red" } }).sessions.s1;
  const it = a.items.find((x) => x.kind === "question");
  assert.ok(a.run === "working" && it && it.kind === "question" && it.status === "answered" && it.answers?.["Which colour do you prefer?"] === "Red");
  const k = reducer(asked, { type: "question-answered", sessionId: "s1", requestId: "r1", answers: null }).sessions.s1.items.find((x) => x.kind === "question");
  assert.ok(k && k.kind === "question" && k.status === "skipped");
});

test("a request that is not a well-formed question is still shown as an ordinary card, never lost", () => {
  assert.equal(questionsOf({ questions: [] }), null);
  assert.equal(questionsOf({ questions: [{ question: "No options?", options: [] }] }), null);
  assert.equal(questionsOf({}), null);
  const odd = { ...request, request: { ...request.request, input: { questions: "nonsense" } } };
  const s = reducer(started(), { type: "event", sessionId: "s1", record: odd }).sessions.s1;
  assert.ok(s.items.some((x) => x.kind === "permission") && s.run === "waiting");
  assert.deepEqual(questionsOf({ questions: [{ question: "Pick", options: [{ label: "A" }, { label: "" }, { label: "B", description: "b" }], multiSelect: true }] })?.[0].options.map((o) => o.label), ["A", "B"]);
});

// what Claude Code really sent in the test of 2026-11-03 (stream-json, a throwaway folder): a step's usage, then /compact with its boundary record, then the step after it
const step = (read: number, wrote: number, fresh = 3) => ({ type: "assistant", uuid: `u${read}`, message: { content: [{ type: "text", text: "ok" }], usage: { input_tokens: fresh, cache_read_input_tokens: read, cache_creation_input_tokens: wrote } } });
const boundary = { type: "system", subtype: "compact_boundary", compact_metadata: { trigger: "manual", pre_tokens: 245_000, post_tokens: 1_466 } };

test("the memory is what Claude read for its last step, and it is cleared when Claude Code says it made it smaller", () => {
  let st = reducer(started(), { type: "event", sessionId: "s1", record: step(120_000, 800) });
  assert.equal(st.sessions.s1.context, 120_803);
  st = reducer(st, { type: "event", sessionId: "s1", record: step(120_803, 900) });
  assert.equal(st.sessions.s1.context, 121_706, "the newest step wins");
  st = reducer(st, { type: "compacting", sessionId: "s1" });
  assert.equal(st.sessions.s1.run, "working");
  assert.ok(st.sessions.s1.items.some((x) => x.kind === "note" && /smaller/.test(x.text)));
  st = reducer(st, { type: "event", sessionId: "s1", record: boundary });
  assert.equal(st.sessions.s1.context, undefined, "unknown until the next reply tells the real size");
  assert.ok(st.sessions.s1.items.some((x) => x.kind === "note" && x.text.includes("245k")));
  st = reducer(st, { type: "event", sessionId: "s1", record: { type: "result", subtype: "success", result: "", is_error: false } });
  assert.equal(st.sessions.s1.run, "ready");
  assert.ok(!st.sessions.s1.items.some((x) => x.kind === "note" && x.tone === "problem"), "an empty result of /compact is not an error");
  st = reducer(st, { type: "event", sessionId: "s1", record: step(15_427, 4_098) });
  assert.equal(st.sessions.s1.context, 19_528);
});

test("a step of a helper (a side chain) does not change the memory of the conversation", () => {
  const st = reducer(started(), { type: "event", sessionId: "s1", record: { ...step(50_000, 0), isSidechain: true } });
  assert.equal(st.sessions.s1.context, undefined);
});
