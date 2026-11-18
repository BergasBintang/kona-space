import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_KEPT, drawOrder, keepAdd, keepRemove, pageKey, parseKey } from "./pages.ts";

test("a page has a key, and the office has none", () => {
  assert.equal(pageKey("office", null), null);
  assert.equal(pageKey("mockups", null), "place:mockups");
  assert.equal(pageKey("office", "design"), "person:design");
  assert.equal(pageKey("brain", "design"), "place:brain", "a place wins: a person's sheet is only open with no place");
});

test("a key is read back, and a bad one is refused", () => {
  assert.deepEqual(parseKey("place:files"), { kind: "place", id: "files" });
  assert.deepEqual(parseKey("person:secretary"), { kind: "person", id: "secretary" });
  for (const bad of ["", "files", "place:", "other:x", ":x"]) assert.equal(parseKey(bad), null, bad);
});

test("minimizing keeps a page alive, up to a cap, and the same page twice is one", () => {
  let kept: string[] = [];
  for (let i = 1; i <= MAX_KEPT; i++) { const r = keepAdd(kept, `place:p${i}`); assert.ok(r.ok); kept = r.kept; }
  assert.equal(kept.length, MAX_KEPT);
  const full = keepAdd(kept, "place:one-more");
  assert.equal(full.ok, false, "refused when the tray is full");
  assert.deepEqual(full.kept, kept, "and nothing changed");
  assert.ok(keepAdd(kept, "place:p1").ok, "a page already there is not refused");
  assert.deepEqual(keepAdd(kept, "place:p1").kept, kept);
  assert.deepEqual(keepRemove(kept, "place:p2").length, MAX_KEPT - 1);
  assert.deepEqual(keepRemove(kept, "place:nothing"), kept);
});

test("the pages are drawn in a steady order, the shown one last, once", () => {
  assert.deepEqual(drawOrder([], null), []);
  assert.deepEqual(drawOrder(["place:a", "place:b"], null), ["place:a", "place:b"]);
  assert.deepEqual(drawOrder(["place:a", "place:b"], "place:c"), ["place:a", "place:b", "place:c"]);
  assert.deepEqual(drawOrder(["place:a", "place:b"], "place:b"), ["place:a", "place:b"], "a page that is in the list is not drawn twice");
});
