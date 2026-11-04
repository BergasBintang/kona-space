import { test } from "node:test";
import assert from "node:assert/strict";
import { addressee, buildChat, logOfSession, savedLinesOf } from "./meetingchat.ts";
import { addNote, attachSession, finishStep, keepLog, newRun, startStep, stepPrompt, type Run } from "./workflowrun.ts";
import type { Item, Session } from "./sessions.ts";
import type { Workflow } from "./api.ts";

const wf: Workflow = { id: "w", name: "Feature", about: "", steps: [
  { id: "a", title: "Write the brief", role: "product", after: [], note: "" },
  { id: "b", title: "Design it", role: "design", after: ["a"], note: "" },
  { id: "c", title: "Build it", role: "frontend", after: ["b"], note: "" },
] };
const names: Record<string, string> = { product: "Kiki", design: "Nokka", frontend: "Jiro" };
const run0 = (): Run => newRun(wf, (r) => names[r], 1000, () => 0.2);
const it = {
  user: (id: string, text: string): Item => ({ kind: "user", id, text, images: [] }),
  say: (id: string, text: string): Item => ({ kind: "assistant", id, text }),
  tool: (id: string, name: string): Item => ({ kind: "tool", id, toolUseId: id, name, summary: "x.html", status: "done" }),
};
const session = (items: Item[], over: Partial<Session> = {}): Session => ({ id: "s", folder: "", workDir: "", roleId: "product", accountId: "", voice: false, ticketId: null, brainQuestion: null, endedLine: "", model: "", mode: "", title: "", run: "working", items, draft: "", costTotal: 0, costLast: 0, turns: 0, ...over });

test("the briefing is not part of the chat, what was said is, and tool uses fold into one line", () => {
  const lines = savedLinesOf([it.user("u1", "BRIEFING"), it.tool("t1", "Read"), it.tool("t2", "Write"), it.say("a1", "I wrote the brief."), it.user("u2", "make it shorter"), it.say("a2", "Shorter now.")]);
  assert.deepEqual(lines.map((l) => l.k), ["tools", "say", "you", "say"]);
  assert.equal(lines[0].tools?.length, 2);
  assert.equal(lines[2].text, "make it shorter");
  assert.deepEqual(savedLinesOf([it.user("u", "BRIEFING")]), []);
  assert.equal(savedLinesOf([], "typing").at(-1)?.text, "typing", "a reply that is still arriving shows");
});

test("a run with one step working reads from the live session, with a divider and a working mark", () => {
  let r = startStep(run0(), 0); r = attachSession(r, 0, "s1");
  const chat = buildChat(r, { s1: session([it.user("u1", "BRIEFING"), it.say("a1", "On it."), it.tool("t1", "Read")]) });
  assert.deepEqual(chat.map((l) => l.kind), ["note", "divider", "say", "tools", "working"]);
  const say = chat[2];
  assert.ok(say.kind === "say" && say.who === "Kiki" && say.text === "On it.");
  assert.match((chat[1] as { text: string }).text, /^1\. Write the brief \(Kiki\)$/);
});

test("a finished step reads from its saved lines, then comes the handover, then the next person", () => {
  let r = startStep(run0(), 0); r = attachSession(r, 0, "s1");
  r = finishStep(r, 0, "The brief says X.", 0.1, 5, [{ k: "say", text: "The brief says X." }]);
  r = attachSession(startStep(r, 1), 1, "s2");
  const chat = buildChat(r, { s2: session([it.user("u", "BRIEFING"), it.say("a", "Designing.")], { roleId: "design" }) });
  assert.deepEqual(chat.map((l) => l.kind), ["note", "divider", "say", "handover", "divider", "say", "working"]);
  assert.match((chat[3] as { text: string }).text, /Kiki handed over to Nokka/);
  assert.equal(chat.filter((l) => l.kind === "say").map((l) => (l as { who: string }).who).join(), "Kiki,Nokka");
});

test("a finished run can be read when Kona was closed (no sessions at all), also an old record with only a result", () => {
  let r = finishStep(startStep(run0(), 0), 0, "brief", 0, 3, [{ k: "tools", tools: [{ name: "Read", status: "done", summary: "a" }] }, { k: "say", text: "brief" }]);
  r = finishStep(startStep(r, 1), 1, "design result", 0, 4);
  const chat = buildChat(r, {});
  assert.deepEqual(chat.map((l) => l.kind), ["note", "divider", "tools", "say", "handover", "divider", "say", "handover"]);
  assert.equal((chat[6] as { text: string }).text, "design result");
});

test("a permission waiting for the owner is a card in the chat; a stopped step says why; a finished run says so", () => {
  let r = attachSession(startStep(run0(), 0), 0, "s1");
  const perm: Item = { kind: "permission", id: "p1", requestId: "rq", toolName: "Bash", description: "", input: {}, status: "asking" };
  const waiting = buildChat(r, { s1: session([it.user("u", "B"), perm], { run: "waiting" }) });
  assert.ok(waiting.some((l) => l.kind === "card"));
  assert.ok(!waiting.some((l) => l.kind === "working"), "no working mark while it waits on the owner");
  const stopped: Run = { ...r, status: "stopped", steps: r.steps.map((s, i) => (i === 0 ? { ...s, status: "stopped" as const, error: "Stopped by you." } : s)) };
  assert.match((buildChat(stopped, {}).at(-1) as { text: string }).text, /Stopped by you/);
  let done = run0();
  for (let i = 0; i < 3; i++) done = finishStep(startStep(done, i), i, "r", 0, 9, [{ k: "say", text: "r" }]);
  assert.match((buildChat({ ...done, status: "done" }, {}).at(-1) as { text: string }).text, /meeting is over/);
});

test("a message of the owner goes to whoever is named, else to whoever works now, else to the next in line", () => {
  let r = run0();
  assert.deepEqual(addressee(r, "hello"), { step: 0, text: "hello" }, "nobody works yet: the next in line");
  r = startStep(r, 0);
  assert.deepEqual(addressee(r, "keep it short"), { step: 0, text: "keep it short" });
  assert.deepEqual(addressee(r, "Jiro, use PostgreSQL"), { step: 2, text: "use PostgreSQL" });
  assert.deepEqual(addressee(r, "@nokka use dark colours"), { step: 1, text: "use dark colours" });
  assert.deepEqual(addressee(r, "Kiki: shorter please"), { step: 0, text: "shorter please" });
  assert.deepEqual(addressee(r, "Hello there"), { step: 0, text: "Hello there" }, "a word that is not a name is just part of the message");
  const done = finishStep(r, 0, "x", 0);
  assert.deepEqual(addressee(done, "Kiki, one more thing"), { step: 1, text: "Kiki, one more thing" }, "a finished person cannot be reached: it goes to the next in line");
  let all = run0(); for (let i = 0; i < 3; i++) all = finishStep(startStep(all, i), i, "r", 0);
  assert.equal(addressee(all, "anyone?"), null, "nobody is left");
});

test("what the owner said to a person whose turn has not come is put in their briefing", () => {
  let r = addNote(run0(), 2, "  use PostgreSQL  ");
  r = addNote(r, 2, "and keep the old API");
  assert.deepEqual(r.steps[2].notes, ["use PostgreSQL", "and keep the old API"]);
  assert.match(stepPrompt(r, 2), /What the owner said in the meeting for you, before your turn:\n- use PostgreSQL\n- and keep the old API/);
  assert.ok(!stepPrompt(run0(), 2).includes("What the owner said"));
});

test("the log kept with a step is cut to a size that fits a file", () => {
  const lines = Array.from({ length: 200 }, (_, k) => ({ k: "say" as const, text: "x".repeat(5000) + k }));
  const kept = keepLog(lines);
  assert.ok(kept.length <= 80 && kept.reduce((n, l) => n + (l.text?.length ?? 0), 0) <= 40000 + 6000);
  const big = logOfSession(session([it.user("u", "B"), it.say("a", "y".repeat(20000))]));
  assert.ok((big[0].text?.length ?? 0) <= 6000);
});

test("a note for a person whose turn has not come shows in the chat", () => {
  const r = addNote(run0(), 2, "use PostgreSQL");
  const chat = buildChat(r, {});
  assert.ok(chat.some((l) => l.kind === "you" && /To Jiro, for their turn: use PostgreSQL/.test(l.text)));
});
