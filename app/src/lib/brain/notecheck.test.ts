import { test } from "node:test";
import assert from "node:assert/strict";
import { Brain } from "./engine.ts";
import { linkedWith, noteCheckPrompt, readNoteCheck, MAX_EACH, MAX_NOTES } from "./notecheck.ts";
import type { RawNote } from "./parse.ts";

const mk = (id: string, text: string, layer: "project" | "starter" | "memory" = "project"): RawNote => ({ id, layer, readonly: layer !== "project", text: `---\ntitle: ${id}\nkind: topic\ndate: 2026-11-05\n---\n# ${id}\n\n${text}\n` });

test("a note is compared with the notes it links to first, then the notes that link to it, never with a starter note, at most five", () => {
  const raw = [mk("main", "See [[out-one]] and [[start-here]]."), mk("out-one", "Text."), mk("in-one", "Back to [[main]]."), mk("start-here", "Starter.", "starter"),
    ...Array.from({ length: 8 }, (_, i) => mk(`more-${i}`, "Text.")), mk("many", Array.from({ length: 8 }, (_, i) => `[[more-${i}]]`).join(" "))];
  const b = new Brain(raw);
  assert.deepEqual(linkedWith(b, b.notes.get("main")!).map((n) => n.id), ["out-one", "in-one"]);
  assert.ok(linkedWith(b, b.notes.get("many")!).length <= MAX_NOTES - 1);
  assert.equal(linkedWith(new Brain([mk("alone", "Nothing here.")]), new Brain([mk("alone", "x")]).notes.get("alone")!).length, 0);
});

test("the data for the call hides secrets, drops the front matter, labels the notes and is capped", () => {
  const b = new Brain([mk("main", `The key is sk-ant-abcdefghijklmnopqrstuvwxyz. ${"word ".repeat(6000)} See [[other]].`), mk("other", "Other text.")]);
  const { prompt, sent } = noteCheckPrompt(b.notes.get("main")!, [b.notes.get("other")!]);
  assert.ok(!prompt.includes("sk-ant-abcdef"), "a secret is never sent");
  assert.ok(prompt.includes("[hidden: Anthropic key]"));
  assert.ok(prompt.includes("NOTE A (id: main; written 2026-11-05)") && prompt.includes("NOTE B (id: other; written 2026-11-05)"));
  assert.ok(!prompt.includes("kind: topic"), "no front matter");
  assert.deepEqual(sent.map((n) => n.id), ["main", "other"]);
  assert.ok(prompt.length < 2 * MAX_EACH + 600, "each note is cut");
});

test("the answer is read: no disagreement, or the items as written", () => {
  assert.equal(readNoteCheck("No disagreement found.").none, true);
  assert.equal(readNoteCheck("  no disagreement found  ").none, true);
  const r = readNoteCheck("- credit refill day\n  A: every Monday (a)\n  B: every Tuesday (b)");
  assert.equal(r.none, false);
  assert.ok(r.text.startsWith("- credit refill day"));
});
