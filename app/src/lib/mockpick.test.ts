import { test } from "node:test";
import assert from "node:assert/strict";
import { PINS_MAX, addPin, cleanText, editPin, measureLine, pageFile, partLabel, pickMessage, pinsForPage, placeNote, removePin, toScreen, type Part } from "./mockpick.ts";

const part = (over: Record<string, unknown> = {}) => ({ kona: "pick", part: "hero-title", tag: "h1", text: "Welcome", place: "body:nth-of-type(1)>h1:nth-of-type(1)", within: ["hero"], page: "/p1/site/index.html", padding: "8px 12px", gap: "", radius: "4px", border: "none", w: 320, h: 48, x: 10, y: 20, rw: 320, rh: 48, vw: 1024, vh: 640, ...over });

test("a pick report is read, and the page's text is cut down to safe text", () => {
  const m = pickMessage(part({ text: "a\u0000b\nc   d" + "x".repeat(500), part: "<img onerror=x>" }));
  assert.ok(m && m.kind === "pick");
  if (m.kind !== "pick") return;
  assert.equal(m.text.length, 160);
  assert.ok(m.text.startsWith("a b c d"), "control characters and runs of spaces become one space");
  assert.equal(m.part, "<img onerror=x>", "text stays text: the screen draws it as text, never as markup");
  assert.deepEqual(m.box, { x: 10, y: 20, w: 320, h: 48 });
  assert.equal(m.vw, 1024);
});

test("anything that is not exactly a report is ignored", () => {
  for (const bad of [null, undefined, 5, "pick", [], {}, { kona: "pick" }, part({ place: "" }), part({ page: 3 }), part({ tag: "not a tag" }), part({ tag: 7 }), part({ w: "320" }), part({ w: NaN }), part({ x: Infinity }), part({ vw: "0" }), part({ kona: "other" })]) {
    assert.equal(pickMessage(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(pickMessage({ kona: "gone" }), { kind: "gone" });
  assert.deepEqual(pickMessage({ kona: "hover", none: true }), { kind: "hover-none" });
  assert.equal(pickMessage({ kona: "hover" }), null);
});

test("a rect report holds only numbers, and they are kept inside limits", () => {
  const r = pickMessage({ kona: "rect", x: 5, y: 6, w: 7, h: 8, vw: 100, vh: 200 });
  assert.deepEqual(r, { kind: "rect", box: { x: 5, y: 6, w: 7, h: 8 }, vw: 100, vh: 200 });
  const big = pickMessage({ kona: "rect", x: 1e12, y: -1e12, w: 1e12, h: 1, vw: 1, vh: 1 });
  assert.ok(big && big.kind === "rect" && big.box.x === 1e6 && big.box.y === -1e6 && big.box.w === 1e6);
  assert.equal(pickMessage({ kona: "rect", x: 1, y: 2, w: 3, h: "4", vw: 1, vh: 1 }), null);
});

test("the within list keeps five names at most and drops what is not text", () => {
  const m = pickMessage(part({ within: ["a", "b", 3, "", "c", "d", "e", "f", "g"] }));
  assert.ok(m && m.kind === "pick");
  if (m.kind === "pick") assert.deepEqual(m.within, ["a", "b", "c"], "five are looked at; the odd ones are dropped");
  const none = pickMessage(part({ within: "not a list" }));
  assert.ok(none && none.kind === "pick" && none.within.length === 0);
});

test("pins: add, edit, remove, a limit, and an empty note makes no pin", () => {
  const p = pickMessage(part()) as Part;
  let pins = addPin([], p, "  make it bigger  ", 1);
  assert.equal(pins.length, 1);
  assert.equal(pins[0].note, "make it bigger");
  assert.equal(addPin(pins, p, "   ", 2), pins, "an empty note is not a pin");
  pins = addPin(pins, p, "second", 2);
  pins = addPin(pins, p, "third", 3);
  assert.deepEqual(pinsForPage(pins).map((x) => x.n), [1, 2, 3]);
  pins = removePin(pins, 2);
  assert.deepEqual(pinsForPage(pins).map((x) => x.n), [1, 2], "the numbers close up");
  assert.equal(pins[1].note, "third");
  pins = editPin(pins, 3, "third, changed");
  assert.equal(pins[1].note, "third, changed");
  assert.equal(pins[0].note, "make it bigger");
  let many = pins;
  for (let i = 0; i < PINS_MAX + 5; i++) many = addPin(many, p, "x", 100 + i);
  assert.equal(many.length, PINS_MAX);
  assert.equal(editPin(pins, 1, "y".repeat(2000))[0].note.length, 600);
});

test("the note box sits to the right of the part, else to the left, else below, and stays in the room", () => {
  const room = { w: 800, h: 600 }, size = { w: 260, h: 140 };
  assert.deepEqual(placeNote({ x: 100, y: 100, w: 200, h: 50 }, room, size), { left: 310, top: 100 });
  assert.deepEqual(placeNote({ x: 500, y: 100, w: 250, h: 50 }, room, size), { left: 230, top: 100 }, "no room on the right: the left");
  const wide = placeNote({ x: 10, y: 100, w: 780, h: 50 }, room, size);
  assert.deepEqual(wide, { left: 10, top: 160 }, "the part fills the width: below it");
  assert.deepEqual(placeNote({ x: 10, y: 480, w: 780, h: 50 }, room, size), { left: 10, top: 330 }, "no room below: above it");
  const low = placeNote({ x: 100, y: 590, w: 100, h: 20 }, room, size);
  assert.ok(low.top + size.h <= room.h && low.top >= 0, "never past the bottom");
  assert.deepEqual(placeNote({ x: 0, y: 0, w: 5, h: 5 }, { w: 100, h: 100 }, size), { left: 0, top: 0 }, "a room smaller than the box");
});

test("a box in the page is put on the screen by the frame's corner and scale", () => {
  assert.deepEqual(toScreen({ x: 100, y: 50, w: 200, h: 40 }, { left: 30, top: 10, scale: 0.5 }), { x: 80, y: 35, w: 100, h: 20 });
});

test("the labels", () => {
  assert.equal(partLabel({ part: "login-button", tag: "button", text: "Sign in" }), "login-button");
  assert.equal(partLabel({ part: "", tag: "button", text: "Sign in" }), 'button "Sign in"');
  assert.equal(partLabel({ part: "", tag: "div", text: "" }), "div");
  assert.ok(partLabel({ part: "", tag: "p", text: "x".repeat(60) }).includes("…"));
  assert.equal(measureLine({ w: 320, h: 48, padding: "8px 12px", gap: "", radius: "4px", border: "none" }), "320 × 48 · padding 8px 12px · radius 4px");
  assert.equal(measureLine({ w: 10, h: 10, padding: "0px", gap: "8px", radius: "0px", border: "1px solid red" }), "10 × 10 · gap 8px · border 1px solid red");
  assert.equal(pageFile("/p1/site/about.html"), "about.html");
  assert.equal(pageFile("/p1/site/pages/a%20b.html"), "pages/a b.html");
  assert.equal(pageFile("/p1/site/"), "index.html");
  assert.equal(cleanText(5, 10), "");
});
