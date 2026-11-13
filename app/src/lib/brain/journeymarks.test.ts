// Step markers against the steps of the journey (ticket T-0039).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJourney } from "./journey.ts";
import { layoutJourney } from "./journeylayout.ts";
import { DRAFT_LANE, compareMarkers, draftName, placeOf, withDrafts, type Marker, type Scan } from "./journeymarks.ts";

const journey = (steps: Record<string, unknown>[]) => parseJourney("```journey\n" + JSON.stringify({ steps: steps.map((s) => ({ name: s.id, lane: "app", actor: "system", ...s })) }) + "\n```").journey!;
const at = (id: string, file = "src/a.tsx", line = 1): Marker => ({ id, file, line });
const scan = (markers: Marker[], truncated = false): Scan => ({ markers, files: 10, ms: 5, truncated });

const j = () => journey([
  { id: "visit", kind: "step", status: "built" },
  { id: "sign-in", kind: "screen", status: "built" },
  { id: "home", kind: "screen", status: "built" },
  { id: "billing", kind: "screen", status: "not-built" },
  { id: "check-login", kind: "step", status: "built" },
]);

test("a marker the map does not know is missing from the map, once for each id with every place", () => {
  const m = compareMarkers(j(), scan([at("sign-in"), at("home"), at("zeta", "src/z.tsx", 4), at("beta", "src/b.tsx", 2), at("zeta", "src/z2.tsx", 9)]));
  assert.deepEqual(m.missing.map((x) => [x.id, x.at.map(placeOf)]), [["beta", ["src/b.tsx, line 2"]], ["zeta", ["src/z.tsx, line 4", "src/z2.tsx, line 9"]]]);
  assert.deepEqual([...m.found.keys()].sort(), ["home", "sign-in"]);
});

test("a built screen with no marker has no page found; other steps and unbuilt screens need none", () => {
  const m = compareMarkers(j(), scan([at("sign-in")]));
  assert.deepEqual(m.noPage, ["home"], "visit and check-login are not screens, billing is not built");
  assert.deepEqual(compareMarkers(j(), scan([at("sign-in"), at("home")])).noPage, []);
});

test("when the scan stopped early nothing is said to be absent, but what was found still counts", () => {
  const m = compareMarkers(j(), scan([at("sign-in"), at("new-one")], true));
  assert.deepEqual(m.noPage, []);
  assert.equal(m.complete, false);
  assert.deepEqual(m.missing.map((x) => x.id), ["new-one"]);
});

test("no markers at all in a project that has never used them: every built screen is a no page found", () => {
  const m = compareMarkers(j(), scan([]));
  assert.deepEqual(m.noPage, ["sign-in", "home"]);
  assert.deepEqual(m.missing, []);
});

test("a draft step is made for each missing marker, in its own lane, never built, and the map is not changed", () => {
  const base = j();
  const before = JSON.stringify(base);
  const missing = compareMarkers(base, scan([at("share-album", "src/share.tsx", 3)])).missing;
  const d = withDrafts(base, missing);
  assert.equal(JSON.stringify(base), before, "the journey that was read is untouched");
  const step = d.steps.find((s) => s.id === "share-album")!;
  assert.deepEqual([step.name, step.lane, step.status, step.kind, step.updated], ["Share album", DRAFT_LANE, "not-built", "screen", ""]);
  assert.deepEqual(d.lanes.at(-1), { id: DRAFT_LANE, name: "Not confirmed", actor: null });
  assert.equal(d.steps.length, base.steps.length + 1);
  assert.equal(withDrafts(base, []), base, "nothing missing: the same journey");
  // it lays out, in the last band, and a second call does not add a second lane
  const l = layoutJourney(withDrafts(d, missing.filter((x) => x.id !== "share-album")));
  assert.equal(l.lanes.filter((b) => b.id === DRAFT_LANE).length, 1);
  assert.equal(l.nodes.get("share-album")!.lane, l.lanes.length - 1);
});

test("draftName turns an id into words", () => {
  assert.equal(draftName("sign-in"), "Sign in");
  assert.equal(draftName("modal--share-2"), "Modal share 2");
  assert.equal(draftName("a"), "A");
});
