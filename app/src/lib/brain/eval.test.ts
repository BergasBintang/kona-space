// The search is measured on Kona's own starter notes with a fixed set of questions (ticket T-0028, see evalset.ts). The numbers below are the
// baseline of 2026-11-05: a change to the search may raise the good numbers and lower the bad ones, never the other way round. When a change
// makes the search better, change the numbers here in the same commit, so the next change starts from there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { Brain } from "./engine.ts";
import { evaluate, holds, type Question } from "./evalset.ts";
import type { RawNote } from "./parse.ts";

const dir = new URL("../../brain/starter/", import.meta.url);
const starter: RawNote[] = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => ({ id: f.replace(/\.md$/, ""), layer: "starter" as const, text: readFileSync(new URL(f, dir), "utf8"), readonly: true }));
const questions: Question[] = JSON.parse(readFileSync(new URL("./eval/starter.json", import.meta.url), "utf8"));

test("the labelled questions are well made: every question that has needles has a section that holds them", () => {
  const { summary } = evaluate(new Brain(starter), questions);
  assert.deepEqual(summary.unanswerable, [], "a question names words that no starter section holds");
  assert.ok(questions.filter((q) => !q.needles?.length).length >= 12, "enough questions that nothing answers");
  assert.ok(questions.filter((q) => q.needles?.length).length >= 36, "enough questions that something answers");
});

test("holds() ignores case, accents, spacing and markdown marks", () => {
  assert.equal(holds("A **worktree** is\nanother   folder", ["a worktree is another folder"]), true);
  assert.equal(holds("Dollars: an estimate", ["the price"]), false);
  assert.equal(holds("anything", []), false);
});

test("the search on the starter notes is no worse than the baseline", () => {
  const { summary: s, rows } = evaluate(new Brain(starter), questions);
  const wrong = rows.filter((r) => r.outcome === "FN" || r.outcome === "FP" || r.confidentWrong).map((r) => `${r.outcome} ${r.q}`).join("; ");
  // baseline 2026-11-06 (after the starter notes learned that a document is a note): TP 37, FN 3, FP 4, TN 11, one confident wrong answer, top-1 85.0%
  assert.ok(s.TP >= 37, `true positives fell to ${s.TP}: ${wrong}`);
  assert.ok(s.FN <= 3, `false negatives rose to ${s.FN}: ${wrong}`);
  assert.ok(s.FP <= 4, `false positives rose to ${s.FP}: ${wrong}`);
  assert.ok(s.TN >= 11, `true negatives fell to ${s.TN}: ${wrong}`);
  assert.ok(s.confidentWrong <= 1, `confident wrong answers rose to ${s.confidentWrong}: ${wrong}`);
  assert.ok(s.top1 >= 0.85, `the first shown section is right less often: ${(s.top1 * 100).toFixed(1)}%`);
});
