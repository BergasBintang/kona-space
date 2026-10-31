import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESKS, MORE, PAGES, tabsFor } from "./rooms.ts";
import { PLACES } from "./places.ts";

const views = [0, 1, 2, 3].map((n) => JSON.parse(readFileSync(new URL(`../office/views/v${n}.json`, import.meta.url), "utf8")) as { rooms: { id: string }[] });

test("every room of every side of the building opens something", () => {
  for (const v of views) for (const r of v.rooms) assert.ok((DESKS[r.id] ?? []).length > 0 || (PAGES[r.id] ?? []).length > 0, `the room ${r.id} opens nothing`);
});

test("every page a room leads to is a place of the app", () => {
  const known = new Set(PLACES.map((p) => p.id));
  for (const list of [...Object.values(PAGES), ...Object.values(MORE).map((m) => m.map((x) => x.place))]) for (const p of list) assert.ok(known.has(p), `${p} is not a place`);
});

test("a room with two pages shows tabs, a room with one does not", () => {
  assert.deepEqual(tabsFor("workflows"), ["board", "workflows"]);
  assert.deepEqual(tabsFor("settings"), ["voice", "settings"]);
  assert.deepEqual(tabsFor("brain"), []);
  assert.deepEqual(tabsFor("sessions"), []);
});
