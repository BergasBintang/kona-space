// The staleness rule of the journey and its status table (ticket T-0038).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJourney } from "./journey.ts";
import { checkText, cardOf, saysNoChange, staleness, ticketFact, type CardFact, type TicketFact } from "./journeystale.ts";
import { journeyTable, tableSource } from "./journeytable.ts";
import { parseTable } from "./table.ts";

const journey = (steps: Record<string, unknown>[]) => parseJourney("```journey\n" + JSON.stringify({ steps: steps.map((s) => ({ name: s.id, lane: "app", actor: "system", ...s })) }) + "\n```").journey!;
const ticket = (id: string, status: string, text = ""): TicketFact => ({ id, status, updated: "2026-11-12", text });
const noon = (m: number, d: number) => new Date(2026, m - 1, d, 12).getTime() / 1000;
const card = (id: string, m: number, d: number): CardFact => ({ id, modified: noon(m, d) });
const none = { stamped: [] as string[], tickets: [] as TicketFact[], cards: [] as CardFact[] };

test("a finished ticket that the journey was not saved under is flagged", () => {
  const j = journey([{ id: "a", updated: "2026-11-12", tickets: ["T-0001", "T-0002", "T-0003"] }]);
  const out = staleness(j, { ...none, tickets: [ticket("T-0001", "review"), ticket("T-0002", "done"), ticket("T-0003", "in-progress")] });
  assert.deepEqual(out.map((x) => [x.step, x.level, x.text.match(/T-\d+/)![0]]), [["a", "flag", "T-0001"], ["a", "flag", "T-0002"]], "a ticket still in progress is not finished");
  assert.match(out[0].text, /Journey: no change/);
});

test("it is not flagged when the note was saved under the ticket, or the ticket says no change", () => {
  const j = journey([{ id: "a", updated: "2026-11-12", tickets: ["T-0001", "T-0002", "T-0003"] }]);
  const out = staleness(j, { stamped: ["T-0001"], cards: [], tickets: [ticket("T-0001", "done"), ticket("T-0002", "done", "Done when\n- [x] Journey: no change"), ticket("T-0003", "done", "Journey: updated")] });
  assert.deepEqual(out.map((x) => x.text.match(/T-\d+/)![0]), ["T-0003"], "\"updated\" in the ticket's words is not proof: the stamp is");
});

test("saysNoChange reads a line of the ticket, in the ways people write it, and not a sentence that only mentions it", () => {
  for (const yes of ["Journey: no change", "- Journey: no change", "* [ ] journey: No Change", "  - [x] JOURNEY:  no-change", "a\nJourney: no change\nb", "Journey: no change."]) assert.equal(saysNoChange(yes), true, yes);
  for (const no of ["", "Journey: updated", "We think journey: no change is fine", "journeys: no change", "Journey: nothing"]) assert.equal(saysNoChange(no), false, no);
});

test("a ticket that is not in the list, and a step with no ticket, give no flag", () => {
  const j = journey([{ id: "a", updated: "2026-11-12", tickets: ["T-9999"] }, { id: "b" }]);
  assert.deepEqual(staleness(j, { ...none, tickets: [ticket("T-0001", "done")] }), []);
});

test("a hint when the mockup changed after the step was checked, and not before", () => {
  const j = journey([{ id: "a", mockup: "site/sign-in.html", updated: "2026-11-10" }, { id: "b", mockup: "site", updated: "2026-11-12" }, { id: "c", mockup: "site", updated: "2026-11-13" }]);
  const out = staleness(j, { ...none, cards: [card("site", 11, 12)] });
  assert.deepEqual(out.map((x) => [x.step, x.level]), [["a", "hint"]], "checked on the day it changed, or later, is fine");
  assert.match(out[0].text, /Mockup changed 2026-11-12, after the step was checked on 2026-11-10/);
});

test("a mockup that is not a card is a hint only when the project has cards at all", () => {
  const j = journey([{ id: "a", mockup: "gone/x.html", updated: "2026-11-10" }]);
  assert.deepEqual(staleness(j, none), [], "no cards: the interim page has no card yet, so nothing to compare");
  const out = staleness(j, { ...none, cards: [card("site", 11, 1)] });
  assert.equal(out.length, 1);
  assert.match(out[0].text, /No card named gone/);
  assert.equal(cardOf("site/sign-in.html"), "site");
  assert.equal(cardOf("site"), "site");
});

test("a step with a mockup or a ticket and no date was never checked", () => {
  const j = journey([{ id: "a", mockup: "site" }, { id: "b", tickets: ["T-0001"] }, { id: "c" }]);
  assert.deepEqual(staleness(j, none).map((x) => [x.step, x.text]), [["a", "Never checked against the product"], ["b", "Never checked against the product"]]);
});

test("checkText puts the flags first, marks the hints, and joins a step's lines", () => {
  const text = checkText([
    { step: "a", level: "hint", text: "Mockup changed" },
    { step: "a", level: "flag", text: "Ticket T-0001 is finished" },
    { step: "b", level: "hint", text: "Never checked" },
  ]);
  assert.equal(text.get("a"), "Ticket T-0001 is finished · Hint: Mockup changed");
  assert.equal(text.get("b"), "Hint: Never checked");
  assert.equal(text.get("c"), undefined);
});

test("ticketFact gathers all the words of a ticket and keeps only the day", () => {
  const f = ticketFact({ id: "T-0001", status: "done", updated: "2026-11-12 09:30", title: "T", description: "D", acceptance: "- [x] Journey: no change", history: ["h1"] });
  assert.equal(f.updated, "2026-11-12");
  assert.equal(saysNoChange(f.text), true);
});

test("the status table has the six columns, a Check column only when a step has something to say, and copies as a real table", () => {
  const j = journey([
    { id: "a", name: "Upload CV", lane: "person", status: "built", tickets: ["T-0001", "T-0002"], mockup: "site/up.html", updated: "2026-11-12" },
    { id: "b", name: "Pipes | and\nlines", lane: "moon" },
  ]);
  const t = journeyTable(j);
  assert.deepEqual(t.head, ["Step", "Lane", "Status", "Ticket", "Mockup", "Last updated"]);
  assert.deepEqual(t.rows[0], ["Upload CV", "Person", "Built", "T-0001, T-0002", "site/up.html", "2026-11-12"]);
  assert.deepEqual(t.rows[1], ["Pipes | and\nlines", "moon", "Not built", "none", "none", "never"]);
  const withCheck = journeyTable(j, new Map([["a", "Hint: Mockup changed"]]));
  assert.equal(withCheck.head.at(-1), "Check");
  assert.deepEqual(withCheck.rows.map((r) => r.at(-1)), ["Hint: Mockup changed", ""]);
  assert.equal(journeyTable(j, new Map([["a", ""]])).head.length, 6, "empty flags add no column");
  // the markdown a Copy puts on the clipboard reads back as the same table, a pipe and a line break in a cell included
  const back = parseTable(tableSource(t).split("\n"))!;
  assert.deepEqual(back.head, t.head);
  assert.deepEqual(back.rows[0], t.rows[0]);
  assert.deepEqual(back.rows[1], ["Pipes | and lines", "moon", "Not built", "none", "none", "never"]);
});
