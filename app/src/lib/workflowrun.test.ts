import { test } from "node:test";
import assert from "node:assert/strict";
import { seatedOf, RESULT_MAX, attachSession, completeRun, doneCount, failStep, finishStep, handedOver, lastReply, markStale, newRun, nextIndex, readRun, retryRun, startStep, stepPrompt, stopRun, totalCost, workingIndex, type Run } from "./workflowrun.ts";
import type { Workflow } from "./api.ts";

const wf: Workflow = {
  id: "new-feature", name: "New feature", about: "", steps: [
    { id: "brief", title: "Write the brief", role: "product", after: [], note: "Keep it to one page." },
    { id: "design", title: "Design the screens", role: "design", after: ["brief"], note: "" },
    { id: "api", title: "Build the back end", role: "backend", after: ["brief"], note: "" },
    { id: "test", title: "Test it", role: "qa", after: ["design", "api"], note: "" },
  ],
};
const names: Record<string, string> = { product: "Kiki", design: "Nokka", backend: "Jiro", qa: "Norbit" };
const make = (): Run => newRun(wf, (r) => names[r] ?? r, Date.UTC(2026, 10, 4, 8, 5, 9), () => 0.5);

test("a new run holds every step waiting, in the order they are listed, with the people's names", () => {
  const r = make();
  assert.equal(r.status, "running");
  assert.deepEqual(r.steps.map((s) => [s.stepId, s.status, s.who]), [["brief", "waiting", "Kiki"], ["design", "waiting", "Nokka"], ["api", "waiting", "Jiro"], ["test", "waiting", "Norbit"]]);
  assert.match(r.id, /^run-\d{8}-\d{6}-[a-z0-9]{4}$/);
  assert.ok(/^[a-z0-9][a-z0-9-]*$/.test(r.id) && r.id.length <= 60, "the id is a safe file name");
  assert.equal(nextIndex(r), 0);
  assert.equal(workingIndex(r), -1);
});

test("the first person is told nothing was handed over, and is asked for a written result", () => {
  const p = stepPrompt(make(), 0);
  assert.match(p, /Write the brief \(Kiki\)  <- you/);
  assert.match(p, /Nothing was handed over: your step comes first/);
  assert.match(p, /Keep it to one page\./);
  assert.match(p, /number 1 of 4/);
  assert.match(p, /end with a written result for the next person/);
  assert.match(p, /question tool/);
});

test("the next person is handed the results of the steps they come after, and only those", () => {
  let r = make();
  r = finishStep(startStep(r, 0), 0, "The brief says: build a login page.", 0.1);
  r = finishStep(startStep(r, 1), 1, "Design: three screens in .kona/mockups/login.", 0.2);
  r = finishStep(startStep(r, 2), 2, "API: POST /login done.", 0.3);
  const forTest = stepPrompt(r, 3);
  assert.match(forTest, /From step 2, Design the screens \(Nokka\) ---\nDesign: three screens/);
  assert.match(forTest, /From step 3, Build the back end \(Jiro\) ---\nAPI: POST \/login done/);
  assert.ok(!forTest.includes("The brief says"), "the brief is not given to a step that does not come after it");
  assert.match(forTest, /yours is the last step/);
  assert.deepEqual(handedOver(r, 2).map((h) => h.number), [1]);
  const forDesign = stepPrompt(r, 1);
  assert.match(forDesign, /From step 1, Write the brief \(Kiki\) ---\nThe brief says/);
});

test("a step that comes after steps with no written result says so", () => {
  let r = make();
  r = finishStep(startStep(r, 0), 0, "", 0);
  assert.match(stepPrompt(r, 1), /\(no written result\)/);
  const none = make();
  assert.match(stepPrompt(none, 1), /left no written result|Look at the project/);
});

test("the result of a turn is the last thing Claude said since the last message to it", () => {
  const items = [
    { kind: "user", text: "old" }, { kind: "assistant", text: "old answer" },
    { kind: "user", text: "the step" }, { kind: "tool" }, { kind: "assistant", text: "I will start." }, { kind: "tool" }, { kind: "assistant", text: "  Done: wrote login.html.  " }, { kind: "note", text: "x" },
  ];
  assert.equal(lastReply(items), "Done: wrote login.html.");
  assert.equal(lastReply([{ kind: "user", text: "a" }, { kind: "tool" }]), "", "nothing written");
  assert.equal(lastReply([{ kind: "assistant", text: "   " }]), "");
  const long = lastReply([{ kind: "assistant", text: "x".repeat(RESULT_MAX + 500) }]);
  assert.ok(long.length < RESULT_MAX + 150 && /The rest was cut/.test(long));
});

test("steps move through their states, and the run it came from is never changed", () => {
  const r0 = make();
  const r1 = startStep(r0, 0, 1000);
  assert.equal(r0.steps[0].status, "waiting", "the old run is unchanged");
  assert.equal(workingIndex(r1), 0);
  assert.equal(nextIndex(r1), -1, "nothing new starts while a person is working");
  const r2 = attachSession(r1, 0, "sess-1");
  assert.equal(r2.steps[0].sessionId, "sess-1");
  const r3 = finishStep(r2, 0, "ok", 0.25, 2000);
  assert.deepEqual([r3.steps[0].status, r3.steps[0].cost, r3.steps[0].endedAt], ["done", 0.25, 2000]);
  assert.equal(nextIndex(r3), 1);
  assert.equal(doneCount(r3), 1);
  let r = r3;
  for (let i = 1; i < 4; i++) r = finishStep(startStep(r, i), i, "r", 0.1);
  assert.equal(nextIndex(r), -1);
  assert.equal(completeRun(r, 9).status, "done");
  assert.ok(Math.abs(totalCost(r) - 0.55) < 1e-9);
});

test("a failed step stops the run; Try again puts the step back and keeps what is done", () => {
  let r = finishStep(startStep(make(), 0), 0, "brief", 0.1);
  r = attachSession(startStep(r, 1), 1, "s2");
  const failed = failStep(r, 1, "Nokka is busy.", 5000);
  assert.deepEqual([failed.status, failed.steps[1].status, failed.steps[1].error, failed.endedAt], ["stopped", "failed", "Nokka is busy.", 5000]);
  const again = retryRun(failed);
  assert.deepEqual([again.status, again.steps[1].status, again.steps[1].sessionId, again.steps[1].error, again.endedAt], ["running", "waiting", undefined, undefined, undefined]);
  assert.equal(again.steps[0].result, "brief", "a finished step keeps its result");
  assert.equal(nextIndex(again), 1);
});

test("Stop ends the step that is being worked on; a run that was running when Kona closed is stopped", () => {
  let r = startStep(make(), 0);
  const stopped = stopRun(r, 7);
  assert.deepEqual([stopped.status, stopped.steps[0].status, stopped.steps[0].error], ["stopped", "stopped", "Stopped by you."]);
  assert.equal(stopped.steps[1].status, "waiting", "the steps that did not start stay waiting");
  const stale = markStale(r, 8);
  assert.deepEqual([stale.status, stale.steps[0].status], ["stopped", "stopped"]);
  assert.match(stale.steps[0].error ?? "", /Kona was closed/);
  assert.equal(markStale(stopped), stopped, "a run that is not running is left as it is");
  assert.equal(retryRun(stale).steps[0].status, "waiting");
});

test("a record from a file is checked, cut and refused when it is not a run", () => {
  const good = JSON.parse(JSON.stringify(make()));
  const read = readRun(good);
  assert.ok(read && read.steps.length === 4 && read.id === good.id);
  good.steps[0].result = "y".repeat(RESULT_MAX + 5000);
  assert.ok((readRun(good)?.steps[0].result?.length ?? 0) <= RESULT_MAX + 200, "a huge result is cut");
  for (const bad of [null, 5, "x", [], {}, { ...good, id: "" }, { ...good, status: "maybe" }, { ...good, steps: [] }, { ...good, steps: "x" }, { ...good, startedAt: "now" }, { ...good, steps: [{ ...good.steps[0], status: "flying" }] }, { ...good, steps: [null] }, { ...good, steps: Array.from({ length: 21 }, () => good.steps[0]) }]) {
    assert.equal(readRun(bad), null, JSON.stringify(bad)?.slice(0, 60));
  }
  const odd = readRun({ ...good, steps: [{ stepId: "a", title: "t", role: "r", status: "done", cost: "free", after: [1, "x"] }] });
  assert.deepEqual([odd?.steps[0].cost, odd?.steps[0].after, odd?.steps[0].who], [0, ["x"], "r"]);
});

test("everybody whose step has begun sits at the table while the run goes on, and nobody after it ends", () => {
  const seat = { product: 0, design: 1, backend: 2, qa: 3 };
  let r = make();
  assert.deepEqual(seatedOf(r, seat), {}, "nobody has begun");
  r = startStep(r, 0);
  assert.deepEqual(seatedOf(r, seat), { product: 0 });
  r = finishStep(r, 0, "x", 0); r = startStep(r, 1);
  assert.deepEqual(seatedOf(r, seat), { product: 0, design: 1 }, "a person who is done keeps their chair");
  assert.deepEqual(seatedOf(r, { product: 0 }), { product: 0 }, "a person without a chair number stays at their desk");
  assert.deepEqual(seatedOf(completeRun(r), seat), {});
  assert.deepEqual(seatedOf(stopRun(r), seat), {});
  assert.deepEqual(seatedOf(undefined, seat), {});
});
