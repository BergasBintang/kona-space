// Tests of the Notes page's search box. Run by Node itself: `node --test src/lib/brain/finder.test.ts` from the app folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Brain } from "./engine.ts";
import { findNotes, queryWords } from "./finder.ts";
import type { RawNote } from "./parse.ts";

const note = (id: string, title: string, body: string, extra = "", layer: RawNote["layer"] = "project"): RawNote => ({
  id, layer, readonly: layer !== "project", text: `---\ntitle: ${title}\nkind: note\n${extra}---\n# ${title}\n\n${body}\n`,
});
const brain = () => new Brain([
  note("brand-files", "Brand files live in assets/brand only", "All files sit in one folder.", "topic: Landing page and design\ntickets: T-0036\n"),
  note("competitor-logos", "Competitor logos and brand compared", "Pros and cons per logo."),
  note("error-colour", "Error colour: plain red kept for V1", "The Brand colour is not used for errors.", "tickets: T-0037\n"),
  note("cv-format", "CV format", "Readers expect Café style headings."),
  note("kona-index", "Every note by topic", "brand logos cv", "generated: true\n"),
]);
const ids = (q: string) => findNotes(brain(), q).map((f) => f.id);

test("nothing typed finds nothing, and the words are folded", () => {
  assert.deepEqual(ids(""), []);
  assert.deepEqual(ids("   ..  "), []);
  assert.deepEqual(queryWords("  Café, Ticket-0036 "), ["cafe", "ticket", "0036"]);
});

test("a half-typed word finds, with the title matches before the ones that only mention it in the text", () => {
  const r = findNotes(brain(), "bra");
  assert.deepEqual(r.map((f) => f.id), ["brand-files", "competitor-logos", "error-colour"]);
  assert.deepEqual(r.map((f) => f.where), ["title", "title", "text"]);
  assert.match(r[2].snippet, /Brand colour/);
});

test("every typed word must be in the note, in any order", () => {
  assert.deepEqual(ids("logos brand"), ["competitor-logos"]);
  assert.deepEqual(ids("brand zzz"), []);
});

test("the ticket, the topic and the id find a note too, and the list Kona writes itself never shows up", () => {
  assert.deepEqual(ids("t-0036"), ["brand-files"]);
  assert.deepEqual(ids("landing design"), ["brand-files"]);
  assert.deepEqual(ids("cv-format"), ["cv-format"]);
  assert.ok(!ids("brand").includes("kona-index"));
});

test("accents are ignored in the note and in what is typed", () => {
  assert.deepEqual(ids("cafe"), ["cv-format"]);
  assert.deepEqual(ids("café"), ["cv-format"]);
});
