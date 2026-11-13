// What is sent to the journey name check, and how its answer is read (ticket T-0041).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJourney } from "./journey.ts";
import { MAX_PAGE, MAX_PAGES, MAX_TOTAL, journeyCheckPrompt, pagesToRead, readJourneyCheck } from "./journeyai.ts";

const journey = (steps: Record<string, unknown>[]) => parseJourney("```journey\n" + JSON.stringify({ title: "T", steps: steps.map((s) => ({ name: s.id, lane: "app", actor: "system", ...s })) }) + "\n```").journey!;
const j = () => journey([
  { id: "sign-in", name: "Sign in", kind: "screen", mockup: "site/sign-in.html", buttons: [{ label: "Go", to: "home" }], errors: [{ text: "Wrong password" }], tickets: ["T-0001"], updated: "2026-11-12" },
  { id: "home", name: "Home", kind: "screen", mockup: "site/home.html" },
  { id: "check", name: "Check the login", kind: "step", mockup: "site/none.html", next: [{ to: "home", label: "ok" }] },
]);

test("part 1 holds the name and the page words of each step that has a page, part 2 every name, and nothing else", () => {
  const { prompt, withText } = journeyCheckPrompt(j(), new Map([["sign-in", "Sign in Email Password Go"], ["home", "  "]]));
  assert.deepEqual(withText, ["sign-in"], "a page with no words is left out of part 1");
  assert.match(prompt, /^PART 1\. STEPS WITH A PAGE \(data\)\n- sign-in \| name: "Sign in" \| page says: "Sign in Email Password Go"\n\nPART 2\. ALL STEP NAMES \(data\)\n- sign-in: "Sign in"\n- home: "Home"\n- check: "Check the login"$/);
  assert.ok(!prompt.includes("Wrong password") && !prompt.includes("T-0001") && !prompt.includes("2026-11-12"), "buttons, errors, tickets and dates are not asked about");
});

test("a journey with no page still has part 2, and one with nothing says none", () => {
  const { prompt, withText } = journeyCheckPrompt(j(), new Map());
  assert.deepEqual(withText, []);
  assert.match(prompt, /PART 1\. STEPS WITH A PAGE \(data\)\n\(none\)\n\nPART 2/);
  assert.match(journeyCheckPrompt(journey([]), new Map()).prompt, /PART 2\. ALL STEP NAMES \(data\)\n\(none\)$/);
});

test("only a screen that names a mockup is read, at most thirty of them", () => {
  assert.deepEqual(pagesToRead(j()).map((s) => s.id), ["sign-in", "home"]);
  const many = journey(Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, kind: "screen", mockup: `c/p${i}.html` })));
  assert.equal(pagesToRead(many).length, MAX_PAGES);
});

test("secrets are hidden, a quote cannot break out of its line, a page is cut and the whole is capped", () => {
  const key = "sk-ant-" + "a".repeat(30);
  const hidden = journeyCheckPrompt(j(), new Map([["sign-in", `The key is ${key} and "more"\nnext line`]]));
  assert.ok(!hidden.prompt.includes(key) && hidden.prompt.includes("[hidden: Anthropic key]"));
  assert.ok(hidden.prompt.includes(`"The key is [hidden: Anthropic key] and 'more' next line"`), "one line, no double quote inside");
  const long = journeyCheckPrompt(j(), new Map([["sign-in", "w ".repeat(5000)]]));
  assert.ok(long.prompt.split("\n")[1].length <= MAX_PAGE + 80);
  const many = journey(Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, kind: "screen", mockup: `c/p${i}.html` })));
  const big = journeyCheckPrompt(many, new Map(many.steps.map((s) => [s.id, "x".repeat(MAX_PAGE)])));
  assert.ok(big.prompt.length < MAX_TOTAL + 5000 && big.withText.length === 30, `${big.prompt.length}`);
});

const IDS = ["sign-in", "home", "log-in", "check"];
test("the answer is read from its verdict lines only", () => {
  const r = readJourneyCheck("sign-in: FITS\nhome: DIFFERENT\nSAME: sign-in = log-in", ["sign-in", "home"], IDS);
  assert.deepEqual(r, { readable: true, different: ["home"], same: [["sign-in", "log-in"]], none: false });
  assert.deepEqual(readJourneyCheck("sign-in: FITS\nhome: FITS\nSAME: none", ["sign-in", "home"], IDS), { readable: true, different: [], same: [], none: true });
});

test("words around the answer, list marks, bold and case do not matter, and cannot become a finding", () => {
  const answer = [
    "Here is my answer.", "", "- **sign-in**: fits", "* home: DIFFERENT.",
    "The journey has no error message for a wrong password and a dead end after Home.",
    "same: sign-in = log-in, home = check", "Thanks!",
  ].join("\n");
  const r = readJourneyCheck(answer, ["sign-in", "home"], IDS);
  assert.deepEqual(r.different, ["home"]);
  assert.deepEqual(r.same, [["sign-in", "log-in"], ["home", "check"]]);
  assert.equal(r.readable, true);
});

test("an answer that is not in the shape is unreadable, never a finding", () => {
  for (const bad of ["", "No problem found.", "The step Home does not match.", "sign-in: FITS", "sign-in: FITS\nhome: MAYBE\nSAME: none", "sign-in: FITS\nhome: FITS"]) {
    const r = readJourneyCheck(bad, ["sign-in", "home"], IDS);
    assert.equal(r.readable, false, bad);
    assert.equal(r.none, false, bad);
  }
  assert.deepEqual(readJourneyCheck("SAME: none", [], IDS), { readable: true, different: [], same: [], none: true }, "with no page sent, the SAME line is enough");
});

test("a verdict for a step that was not sent and a pair with an unknown or repeated id are dropped", () => {
  const r = readJourneyCheck("sign-in: DIFFERENT\nzzz: DIFFERENT\nSAME: sign-in = sign-in; sign-in = nowhere; home = log-in; log-in = home", ["sign-in"], IDS);
  assert.deepEqual(r.different, ["sign-in"]);
  assert.deepEqual(r.same, [["home", "log-in"]], "a pair once, whichever way round it was written");
});
