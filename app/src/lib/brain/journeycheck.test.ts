// The checker inside the build-a-journey skill is made from the screen's own reader (tools/journey-check.mjs), so a worker and the Journey page never disagree (ticket T-0040).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build, TARGET } from "../../../tools/journey-check.mjs";
import { parseJourney } from "./journey.ts";

const skill = (f: string) => readFileSync(new URL(`../../../src-tauri/skills/build-a-journey/${f}`, import.meta.url), "utf8");
const starter = readFileSync(new URL("../../brain/starter/kona-journey.md", import.meta.url), "utf8");
const block = (o: unknown) => "```journey\n" + JSON.stringify(o) + "\n```";

test("the file in the skill is exactly what the tool makes from the screen's reader", () => {
  assert.equal(readFileSync(TARGET, "utf8").replace(/\r/g, ""), build(), "run: node tools/journey-check.mjs");
});

test("the template note of the skill reads with no problem, and so does the starter note's example", () => {
  assert.deepEqual(parseJourney(skill("templates/journey.md")).problems, []);
  assert.deepEqual(parseJourney(starter).problems, []);
});

test("the checker and the screen give the same problems on the same texts", async () => {
  const mod = await import(pathToFileURL(TARGET).href);
  const texts = [
    skill("templates/journey.md"), starter, "# nothing", block({ steps: 3 }), "```journey\n{ broken\n```",
    block({ steps: [{ id: "a", name: "A", lane: "moon", next: ["zz"], status: "done", updated: "13/11" }, { id: "a" }, { id: "B C" }] }),
    block({ users: [{ id: "g" }], steps: [{ id: "a", name: "A", lane: "app", access: ["x"], kind: "screen", actor: "ai", fields: ["f"] }] }),
  ];
  for (const t of texts) assert.deepEqual(mod.parseJourney(t), parseJourney(t), t.slice(0, 60));
});

test("run from a terminal it prints the mistakes in words and ends with an exit code", () => {
  const dir = mkdtempSync(join(tmpdir(), "kona-jc-"));
  try {
    const ok = join(dir, "ok.md"), bad = join(dir, "bad.md");
    writeFileSync(ok, skill("templates/journey.md"));
    writeFileSync(bad, block({ steps: [{ id: "a", name: "A", lane: "moon", next: ["zz"] }] }));
    const run = (f?: string) => spawnSync(process.execPath, [TARGET, ...(f ? [f] : [])], { encoding: "utf8" });
    const good = run(ok);
    assert.equal(good.status, 0);
    assert.match(good.stdout, /3 steps, 0 errors, 0 warnings\./);
    const broke = run(bad);
    assert.equal(broke.status, 1);
    assert.match(broke.stdout, /ERROR {3}Step "a" is in the lane "moon"/);
    assert.match(broke.stdout, /1 steps, 2 errors, 3 warnings\./);
    const none = run();
    assert.equal(none.status, 2);
    assert.match(none.stderr, /Usage: node check-journey\.mjs/);
    assert.equal(run(join(dir, "missing.md")).status !== 0, true, "a file that is not there is not a pass");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
