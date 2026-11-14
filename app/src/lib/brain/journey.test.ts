// The journey reader and its exact checks (ticket T-0035, decision 91). Each check has a test that would fail without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACTORS, STATUSES, STEP_KEYS, accessWords, checkJourney, journeyBlock, journeyNotes, leavesTo, olderThan, parseJourney } from "./journey.ts";

const starter = readFileSync(new URL("../../brain/starter/kona-journey.md", import.meta.url), "utf8");

/** a note with one journey block */
const note = (body: unknown) => `---\ntitle: J\nkind: journey\n---\n# J\n\nWords around it.\n\n\`\`\`journey\n${typeof body === "string" ? body : JSON.stringify(body, null, 2)}\n\`\`\`\n`;
const step = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ id, name: id, lane: "app", actor: "system", ...extra });
/** a small journey that has nothing wrong with it */
const clean = (): { users: unknown[]; steps: Record<string, unknown>[] } => ({
  users: [{ id: "guest", name: "Guest" }],
  steps: [
    step("a", { start: true, next: ["b"], access: ["guest"] }),
    step("b", { kind: "screen", mockup: "b.html", buttons: [{ label: "Go", to: "c" }], status: "built", tickets: ["T-0001"] }),
    step("c", { end: true }),
  ],
});
const texts = (r: ReturnType<typeof parseJourney>, level?: "error" | "warning") => r.problems.filter((p) => !level || p.level === level).map((p) => p.text);
const has = (r: ReturnType<typeof parseJourney>, words: string, level?: "error" | "warning") => texts(r, level).some((t) => t.includes(words));

test("the starter note's worked example reads with no problem at all", () => {
  const r = parseJourney(starter);
  assert.ok(r.journey, "the example must be readable");
  assert.deepEqual(r.problems, []);
  assert.equal(r.journey.steps.length, 6);
  assert.equal(r.journey.steps.find((s) => s.id === "suggest-title")?.ai?.model, "a small language model");
});

test("the starter note names every key, actor and status the reader knows, and the reader knows nothing the note does not name", () => {
  for (const k of STEP_KEYS) assert.ok(starter.includes("`" + k + "`") || k === "name" || starter.includes(`"${k}"`), `the starter note never mentions the key ${k}`);
  for (const w of [...ACTORS, ...STATUSES]) assert.ok(starter.includes("`" + w + "`"), `the starter note never mentions ${w}`);
  for (const k of ["lanes", "users", "title"]) assert.ok(starter.includes(`"${k}"`), `the example does not show ${k}`);
});

test("a clean journey has no problem", () => {
  const r = parseJourney(note(clean()));
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.journey?.lanes.map((l) => l.id), ["person", "app", "server"], "without lanes the three default lanes are used");
});

test("finding the block: other fences are ignored, CRLF is fine, none or two is a problem", () => {
  const other = "```json\n{\"steps\": []}\n```\n\n```journey\n{\"steps\": []}\n```\n";
  assert.ok(!("problem" in journeyBlock(other)));
  assert.ok(!("problem" in journeyBlock(note(clean()).replace(/\n/g, "\r\n"))));
  assert.match((journeyBlock("# nothing here") as { problem: string }).problem, /no journey block/);
  assert.match((journeyBlock(other + other) as { problem: string }).problem, /2 journey blocks/);
  assert.ok(!("problem" in journeyBlock("```json journey\n{}\n```")), "the words json journey also open it");
});

test("bad JSON is reported with the line of the note", () => {
  const r = parseJourney(note("{\n  \"steps\": [\n    { \"id\": \"a\" \"name\": \"b\" }\n  ]\n}"));
  assert.equal(r.journey, null);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0].text, /not valid JSON, near line (1[0-9]|9)\b/);
});

test("the shapes that are not a map are refused in plain words and never throw", () => {
  for (const [body, words] of [["[]", "one object"], ["5", "one object"], ["null", "one object"], ["{}", "no list called steps"], ["{\"steps\": 3}", "no list called steps"], ["", "not valid JSON"]] as const) {
    const r = parseJourney(note(body));
    assert.equal(r.journey, null, body);
    assert.ok(has(r, words, "error"), `${body}: ${texts(r)}`);
  }
  for (const junk of [{ steps: [null, 5, "x", [], { id: 7 }, { id: {} }] }, { steps: [{ id: "a", next: [null, [], { to: {} }], buttons: [5, null], errors: [[], {}], see: [null], ai: [] }] }, { steps: [], lanes: "x", users: 5 }]) {
    assert.doesNotThrow(() => parseJourney(note(junk)));
  }
});

test("errors: an id that is not an id, a repeated id, a missing name", () => {
  assert.ok(has(parseJourney(note({ steps: [step("Upload CV")] })), "lower case letters", "error"));
  assert.ok(has(parseJourney(note({ steps: [step("a"), step("a")] })), "Two steps have the id \"a\"", "error"));
  assert.ok(has(parseJourney(note({ steps: [{ id: "a", lane: "app" }] })), "has no name", "error"));
});

test("errors: an unknown lane, a missing lane, a repeated lane, a bad lane actor", () => {
  const c = clean();
  c.steps[0].lane = "moon";
  assert.ok(has(parseJourney(note(c)), "lane \"moon\"", "error"));
  c.steps[0].lane = "";
  assert.ok(has(parseJourney(note(c)), "has no lane", "error"));
  assert.ok(has(parseJourney(note({ ...clean(), lanes: [{ id: "app" }, { id: "app" }] })), "Two lanes have the id", "error"));
  assert.ok(has(parseJourney(note({ ...clean(), lanes: [{ id: "app", actor: "robot" }] })), "actor is \"robot\"", "error"));
  assert.ok(has(parseJourney(note({ ...clean(), lanes: [] })), "at least one lane", "error"));
});

test("errors: a step, button or error that leads to a step that is not in the map", () => {
  const c = clean();
  c.steps[0].next = ["nowhere"];
  assert.ok(has(parseJourney(note(c)), "leads to \"nowhere\"", "error"));
  const d = clean();
  (d.steps[1] as { buttons: unknown }).buttons = [{ label: "Go", to: "gone" }];
  assert.ok(has(parseJourney(note(d)), "The button \"Go\"", "error"));
  const e = clean();
  (e.steps[1] as { errors: unknown }).errors = [{ text: "Oops", to: "gone" }];
  assert.ok(has(parseJourney(note(e)), "An error of step \"b\" leads to \"gone\"", "error"));
});

test("errors: a user kind that is not listed, a bad status, kind, actor and date", () => {
  const c = clean();
  c.steps[0].access = ["ghost"];
  assert.ok(has(parseJourney(note(c)), "\"ghost\", which is not a user kind", "error"));
  assert.ok(has(parseJourney(note({ steps: [step("a", { status: "done" })] })), "status is \"done\"", "error"));
  assert.ok(has(parseJourney(note({ steps: [step("a", { kind: "page" })] })), "kind is \"page\"", "error"));
  assert.ok(has(parseJourney(note({ steps: [step("a", { actor: "robot" })] })), "actor is \"robot\"", "error"));
  for (const bad of ["13/11/2026", "2026-13-01", "2026-02-30", "yesterday"]) assert.ok(has(parseJourney(note({ steps: [step("a", { updated: bad })] })), "Write a day as", "error"), bad);
  assert.ok(!has(parseJourney(note({ steps: [step("a", { updated: "2024-02-29" })] })), "Write a day as"), "a real leap day is fine");
});

test("warnings: a step that leads nowhere, a step nothing leads to, no start", () => {
  const c = clean();
  delete (c.steps[2] as { end?: boolean }).end;
  assert.ok(has(parseJourney(note(c)), "Step \"c\" leads nowhere", "warning"));
  const d = clean();
  delete (d.steps[0] as { start?: boolean }).start;
  const r = parseJourney(note(d));
  assert.ok(has(r, "Nothing leads to step \"a\"", "warning"));
  assert.ok(has(r, "No step is marked as a start", "warning"));
  assert.ok(!has(parseJourney(note(clean())), "leads nowhere"), "an end is allowed to lead nowhere");
});

test("warnings: a screen with no mockup, a built step with nothing behind it, an AI step that does not say what it does, details on a step that is no screen", () => {
  const c = clean();
  delete (c.steps[1] as { mockup?: string }).mockup;
  assert.ok(has(parseJourney(note(c)), "The screen \"b\" has no mockup", "warning"));
  const d = clean();
  (d.steps[1] as { tickets: unknown }).tickets = [];
  assert.ok(has(parseJourney(note(d)), "names no ticket and no note", "warning"));
  (d.steps[1] as { notes: unknown }).notes = ["why-we-built-it"];
  assert.ok(!has(parseJourney(note(d)), "names no ticket and no note"), "a note is enough");
  const e = clean();
  (e.steps[2] as { actor: string }).actor = "ai";
  assert.ok(has(parseJourney(note(e)), "does not say what the AI does", "warning"));
  (e.steps[2] as { ai: unknown }).ai = { does: "Reads the file", model: "" };
  assert.ok(!has(parseJourney(note(e)), "does not say what the AI does"));
  const f = clean();
  (f.steps[0] as { fields: unknown }).fields = ["Email"];
  assert.ok(has(parseJourney(note(f)), "is not a screen", "warning"));
});

test("warnings: no actor anywhere, and a key Kona does not know", () => {
  const c = { lanes: [{ id: "app" }], steps: [{ id: "a", name: "A", lane: "app", start: true, end: true, nxt: ["a"] }] };
  const r = parseJourney(note(c));
  assert.ok(has(r, "does not say who acts", "warning"));
  assert.ok(has(r, "a key Kona does not know: \"nxt\"", "warning"));
  const withLaneActor = { lanes: [{ id: "app", actor: "system" }], steps: c.steps };
  assert.ok(!has(parseJourney(note(withLaneActor)), "does not say who acts"), "the lane's usual actor is enough");
});

test("a step that points to itself still needs another way in, and a loop of two is fine", () => {
  const c = { steps: [step("a", { start: true, next: ["b"] }), step("b", { next: ["a", "b"] })] };
  const r = parseJourney(note(c));
  assert.deepEqual(texts(r), []);
  const d = { steps: [step("a", { start: true, end: true }), step("b", { next: ["b"] })] };
  assert.ok(has(parseJourney(note(d)), "Nothing leads to step \"b\""), "pointing at yourself is not a way in");
});

test("forgiving forms: next, buttons, errors, see, ai and lists may be written short", () => {
  const r = parseJourney(note({
    steps: [
      step("a", { start: true, next: "b", tickets: "T-0001", access: "guest" }),
      step("b", { kind: "screen", mockup: "b.html", next: [{ to: "c", label: "ok" }, "a"], buttons: ["Send"], errors: ["Wrong password"], see: ["database"], ai: "Suggests a title" }),
      step("c", { end: true }),
    ],
    users: ["guest"],
  }));
  const [a, b] = r.journey!.steps;
  assert.deepEqual(a.next, [{ to: "b", label: "" }]);
  assert.deepEqual(a.tickets, ["T-0001"]);
  assert.deepEqual(a.access, ["guest"]);
  assert.deepEqual(b.next, [{ to: "c", label: "ok" }, { to: "a", label: "" }]);
  assert.deepEqual(b.buttons, [{ label: "Send", to: "" }]);
  assert.deepEqual(b.errors, [{ text: "Wrong password", when: "", to: "" }]);
  assert.deepEqual(b.see, [{ diagram: "database", note: "" }]);
  assert.deepEqual(b.ai, { does: "Suggests a title", model: "" });
  assert.deepEqual(r.journey!.users, [{ id: "guest", name: "guest", system: "" }]);
  assert.deepEqual(r.problems.filter((p) => p.level === "error"), []);
});

test("leavesTo lists each step once, from next, buttons and errors", () => {
  const r = parseJourney(note({ steps: [step("a", { next: ["b", "b"], buttons: [{ label: "x", to: "c" }, { label: "y", to: "b" }], errors: [{ text: "e", to: "a" }] }), step("b"), step("c")] }));
  assert.deepEqual(leavesTo(r.journey!.steps[0]).sort(), ["a", "b", "c"]);
});

test("a big journey: 2000 steps read fast, 2001 are refused, a huge block is refused", () => {
  const many = (n: number) => ({ steps: Array.from({ length: n }, (_, i) => step(`s${i}`, { start: i === 0, end: i === n - 1, next: i === n - 1 ? [] : [`s${i + 1}`] })) });
  const t = Date.now();
  const r = parseJourney(note(many(2000)));
  assert.ok(Date.now() - t < 1500, `took ${Date.now() - t} ms`);
  assert.equal(r.journey?.steps.length, 2000);
  assert.deepEqual(r.problems, []);
  assert.match(parseJourney(note(many(2001))).problems[0].text, /more than 2000 steps/);
  assert.match(parseJourney(note({ steps: [], pad: "x".repeat(700_000) })).problems[0].text, /too big/);
});

test("checkJourney can be run again on an edited journey, and olderThan compares days only", () => {
  const j = parseJourney(note(clean())).journey!;
  assert.deepEqual(checkJourney(j), []);
  j.steps[0].next = [{ to: "ghost", label: "" }];
  assert.ok(checkJourney(j).some((p) => p.level === "error" && p.text.includes("ghost")));
  assert.equal(olderThan("2026-11-01", "2026-11-02"), true);
  assert.equal(olderThan("2026-11-02", "2026-11-02"), false);
  assert.equal(olderThan("", "2026-11-02"), false, "a step with no date is not called older: that is its own warning later");
  assert.equal(olderThan("2026-11-01", "soon"), false);
});

test("only a project note of kind journey is a journey note", () => {
  const notes = [
    { id: "a", kind: "journey", layer: "project" },
    { id: "b", kind: "journey", layer: "starter" },
    { id: "c", kind: "decision", layer: "project" },
    { id: "d", kind: "journey", layer: "memory" },
  ];
  assert.deepEqual(journeyNotes(notes).map((n) => n.id), ["a"]);
});

test("the address a mockup reads its journey from is the same in the server, the starter note and the skill", () => {
  const rust = readFileSync(new URL("../../../src-tauri/src/mock.rs", import.meta.url), "utf8");
  const address = /pub const JOURNEY_PATH: &str = "([^"]+)";/.exec(rust)?.[1];
  assert.ok(address, "mock.rs names the address");
  const mockups = readFileSync(new URL("../../brain/starter/kona-mockups.md", import.meta.url), "utf8");
  const skill = readFileSync(new URL("../../../src-tauri/skills/make-a-mockup/SKILL.md", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../../src-tauri/skills/make-a-mockup/templates/journey.html", import.meta.url), "utf8");
  for (const [name, text] of [["the starter note kona-mockups", mockups], ["the make-a-mockup skill", skill], ["the page template", page]]) assert.ok(text.includes(address), `${name} does not name ${address}`);
  assert.ok(mockups.includes('"journey": "<note id>"') && skill.includes('"journey": "<the note id>"'), "the key of mockup.json is named");
});

const withLayers = (body: Record<string, unknown>) => parseJourney("```journey\n" + JSON.stringify(body) + "\n```\n");

test("layers, ways of giving access and limits are read, and a step in a layer that is not listed is an error", () => {
  const r = withLayers({
    layers: [{ id: "login", name: "Login" }, { id: "admin", name: "Admin" }],
    users: [{ id: "teacher", name: "Teacher", system: "Role" }, { id: "manager", name: "Branch manager", system: "Branch duty" }],
    steps: [{ id: "a", name: "A", lane: "app", actor: "system", layer: "login", access: ["teacher"], limits: "own branches only", start: true, end: true }],
  });
  const j = r.journey!;
  assert.deepEqual(j.layers, [{ id: "login", name: "Login" }, { id: "admin", name: "Admin" }]);
  assert.deepEqual(j.users.map((u) => u.system), ["Role", "Branch duty"]);
  assert.equal(j.steps[0].layer, "login");
  assert.equal(j.steps[0].limits, "own branches only");
  assert.ok(!r.problems.some((p) => p.level === "error"), JSON.stringify(r.problems));
  const bad = withLayers({ layers: [{ id: "login" }], steps: [{ id: "a", name: "A", lane: "app", layer: "nowhere", start: true, end: true }] });
  assert.ok(bad.problems.some((p) => p.level === "error" && /layer "nowhere"/.test(p.text)), "a layer that is not listed is an error");
  const dup = withLayers({ layers: [{ id: "x" }, { id: "x" }], steps: [] });
  assert.ok(dup.problems.some((p) => /Two layers/.test(p.text)));
  assert.ok(STEP_KEYS.has("layer") && STEP_KEYS.has("limits"));
});

test("a journey with no layers has none, and its steps are in no layer", () => {
  const j = withLayers({ steps: [{ id: "a", name: "A", lane: "app", start: true, end: true }] }).journey!;
  assert.deepEqual(j.layers, []);
  assert.equal(j.steps[0].layer, "");
  assert.equal(j.steps[0].limits, "");
});

test("accessWords: who can reach a step, in a few words", () => {
  const users = [
    { id: "guest", name: "Guest", system: "Role" }, { id: "student", name: "Student", system: "Role" }, { id: "teacher", name: "Teacher", system: "Role" }, { id: "admin", name: "Super Admin", system: "Role" },
    { id: "manager", name: "Branch manager", system: "Branch duty" }, { id: "ops", name: "Ops coordinator", system: "Branch duty" }, { id: "academic", name: "Academic coordinator", system: "Branch duty" },
  ];
  const all = users.map((u) => u.id);
  assert.equal(accessWords([], users), "Everyone", "a step that names no kind is for everyone");
  assert.equal(accessWords(all, users), "Everyone");
  assert.equal(accessWords(all.filter((k) => k !== "guest"), users), "All but Guest");
  assert.equal(accessWords(all.filter((k) => k !== "guest" && k !== "student"), users), "All but Guest, Student");
  assert.equal(accessWords(["student"], users), "Student");
  assert.equal(accessWords(["teacher", "ops"], users), "Teacher, Ops coordinator");
  assert.equal(accessWords(["admin", "manager", "ops", "academic"], users), "Super Admin or any branch duty", "a system all of whose kinds can reach it is written as any");
  assert.equal(accessWords(["x"], []), "", "no kinds listed: nothing to say");
  const two = [{ id: "guest", name: "Guest", system: "" }, { id: "member", name: "Member", system: "" }];
  assert.equal(accessWords(["guest"], two), "Guest", "with two kinds the one that can is named, not \"All but Member\"");
});
