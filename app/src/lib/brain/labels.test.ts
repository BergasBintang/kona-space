// Tests of the names on the Brain map: run by Node itself, `node --test src/lib/brain/labels.test.ts` from the app folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { Brain } from "./engine.ts";
import { nameWidth, placeNames, type Box } from "./labels.ts";
import type { RawNote } from "./parse.ts";

const overlap = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

test("two dots side by side with long names do not write over each other (the picture the owner sent)", () => {
  const pos = new Map([["norbit-vision-and-name", { x: 130, y: 110 }], ["norbit-glossary-and-answers", { x: 215, y: 112 }]]);
  const letters = (id: string) => id.length;
  const { names, boxes } = placeNames({ pos, radius: () => 12, order: [...pos.keys()], chosen: null, letters });
  assert.equal(names.size, 2);
  assert.equal(overlap(boxes[0], boxes[1]), false);
});

test("on the real starter notes and on a crowd, no two names overlap and no name covers another dot", () => {
  const dir = new URL("../../brain/starter/", import.meta.url);
  const starter: RawNote[] = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => ({ id: f.replace(/\.md$/, ""), layer: "starter" as const, text: readFileSync(new URL(f, dir), "utf8"), readonly: true }));
  const brain = new Brain(starter);
  const pos = brain.layout(880, 560);
  // every note is named here, which is more than the map ever does, so this is the hard case
  const ids = [...pos.keys()];
  for (const chosen of [null, ids[0], ids[5]]) {
    const { names, boxes } = placeNames({ pos, radius: () => 10, order: ids, chosen, letters: (id) => brain.notes.get(id)!.title.length });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(overlap(boxes[i], boxes[j]), false, `names ${i} and ${j} overlap`);
    const placed = [...names.keys()];
    for (const id of placed) {
      const w = nameWidth(brain.notes.get(id)!.title.length), at = names.get(id)!;
      const x0 = at.anchor === "middle" ? at.x - w / 2 : at.anchor === "start" ? at.x : at.x - w;
      for (const [other, p] of pos) if (other !== id) assert.equal(overlap([x0, at.y - 11, x0 + w, at.y + 3], [p.x - 10, p.y - 10, p.x + 10, p.y + 10]), false, `the name of ${id} covers the dot of ${other}`);
    }
    if (chosen) assert.ok(names.has(chosen), "the chosen dot is always named");
  }
});

test("the chosen dot is named even in a spot with no room, and the others give way", () => {
  const pos = new Map([["a", { x: 100, y: 100 }], ["b", { x: 100, y: 100 }]]);
  const { names } = placeNames({ pos, radius: () => 10, order: ["a", "b"], chosen: "b", letters: () => 10 });
  assert.ok(names.has("b"));
});
