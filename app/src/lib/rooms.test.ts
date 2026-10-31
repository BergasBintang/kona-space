import { test } from "node:test";
import assert from "node:assert/strict";
import { DESKS, MORE, PAGES, tabsFor } from "./rooms.ts";
import { PLACES } from "./places.ts";
import { STANDARD } from "../office/map.ts";

// every room of the standard office, and the pages and cats the app knows for it
test("every room of the standard office opens something", () => {
  for (const r of STANDARD.rooms) { if (r.kind === "hall") continue; assert.ok((DESKS[r.id] ?? []).length > 0 || (PAGES[r.id] ?? []).length > 0, `the room ${r.id} opens nothing`); }
});

test("every cat that sits in a room of the app has a desk in the standard office, and every desk belongs to a room", () => {
  const desks = new Set(STANDARD.objects.filter((o) => o.kind === "workstation").map((o) => String(o.role)));
  for (const roles of Object.values(DESKS)) for (const role of roles) assert.ok(desks.has(role), `${role} has no desk`);
  assert.equal(desks.size, Object.values(DESKS).flat().length);
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
