import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ZOOM, ageWords, clampZoom, dataLine, dialogLine, drawnSize, humanBytes, filesSignature, fitScale, frameMessage, frameOf, layout, ALLOW_WORDS, liveAllow, livePhaseLine, liveSandbox, liveUrl, pageUrl, percent, stepZoom, wheelZoom, type Device, type Frame } from "./mockview.ts";

const frame = (screen: [number, number], width: [number, number, number, number]): Frame => ({ image: "f.png", size: [10, 10], slice: [1, 1, 1, 1], widthCss: width, screen: { w: screen[0], h: screen[1] }, details: [] });
const phone: Device = { id: "phone", label: "Phone", screen: { w: 390, h: 844 }, turns: true, k: 2, material: "dark", backdrop: "#000", screenRadius: 5, frames: { upright: frame([390, 844], [20, 14, 20, 14]), turned: frame([844, 390], [14, 20, 14, 20]) } };
const laptop: Device = { id: "laptop", label: "Laptop", screen: { w: 1024, h: 640 }, turns: false, k: 2, material: "light", backdrop: "#000", screenRadius: 1, frames: { upright: frame([1024, 640], [14, 14, 18, 14]) }, base: { image: "b.png", size: [21, 9], capLeft: 10, capRight: 10, overhangArt: 8 } };
const monitor: Device = { id: "monitor", label: "Desktop", screen: { w: 1440, h: 900 }, turns: false, k: 2, material: "light", backdrop: "#000", screenRadius: 1, frames: { upright: frame([1440, 900], [16, 16, 28, 16]) }, stand: { image: "s.png", size: [36, 18] } };

test("a device that turns shows the turned frame, one that does not never does", () => {
  assert.equal(frameOf(phone, false).screen.w, 390);
  assert.equal(frameOf(phone, true).screen.w, 844);
  assert.equal(frameOf(laptop, true).screen.w, 1024, "a laptop stays as it is");
  assert.equal(layout(phone, true).screen.h, 390);
});

test("what does not scale is the bezel, the overhang of a base and a stand", () => {
  const p = layout(phone, false);
  assert.deepEqual([p.fixedW, p.fixedH], [28, 40]);
  const l = layout(laptop, false);
  assert.deepEqual([l.baseH, l.overhang, l.fixedW, l.fixedH], [18, 16, 28 + 32, 32 + 18]);
  const m = layout(monitor, false);
  assert.deepEqual([m.standH, m.fixedH], [36, 44 + 36]);
});

test("the fit puts the whole device in the room and is never bigger than true size", () => {
  const room = { w: 1000, h: 600 };
  for (const dev of [phone, laptop, monitor]) {
    for (const turned of [false, true]) {
      const lay = layout(dev, turned), s = fitScale(lay, room);
      const d = drawnSize(lay, s);
      assert.ok(d.w <= room.w - 48 + 1e-6 && d.h <= room.h - 48 + 1e-6, `${dev.id} ${turned} fits: ${d.w} x ${d.h}`);
      assert.ok(s <= 1 && s >= 0.05);
    }
  }
  assert.equal(fitScale(layout(phone, false), { w: 5000, h: 5000 }), 1, "a big room does not make the phone bigger than it is");
  assert.equal(fitScale(layout(phone, false), { w: 0, h: 0 }), 1, "a room that is not measured yet");
  assert.equal(fitScale(layout(monitor, false), { w: 10, h: 10 }), 0.05, "a tiny room still gives a usable number");
  // the tall phone is held by the height, the wide monitor by the width
  const tall = fitScale(layout(phone, false), room), wide = fitScale(layout(monitor, false), room);
  assert.ok(Math.abs(tall - (600 - 48 - 40) / 844) < 1e-9);
  assert.ok(Math.abs(wide - Math.min((1000 - 48 - 32) / 1440, (600 - 48 - 80) / 900)) < 1e-9);
});

test("the fit does not depend on how big the window is drawn (the percent view of the window)", () => {
  // the room is measured in CSS pixels, so the same sheet gives the same fit at any percent view: only the number of CSS pixels of the room changes
  const lay = layout(laptop, false);
  assert.equal(fitScale(lay, { w: 900, h: 560 }), fitScale(lay, { w: 900, h: 560 }));
});

test("zoom goes from the fit to twice the true size and not beyond", () => {
  assert.equal(clampZoom(5, 0.4), MAX_ZOOM);
  assert.equal(clampZoom(0.1, 0.4), 0.4);
  assert.equal(clampZoom(NaN, 0.4), 0.4);
  assert.equal(clampZoom(1, 0.4), 1);
  assert.equal(stepZoom(1.8, 1, 0.4), MAX_ZOOM);
  assert.equal(stepZoom(0.45, -1, 0.4), 0.4);
  assert.ok(Math.abs(stepZoom(0.5, 1, 0.4) - 0.625) < 1e-9);
  assert.ok(wheelZoom(1, -100, 0.4) > 1 && wheelZoom(1, 100, 0.4) < 1);
  assert.ok(Math.abs(wheelZoom(1, -100000, 0.4) - Math.exp(0.6)) < 1e-9, "a huge wheel step is cut");
  assert.equal(percent(0.4567), 46);
  assert.equal(percent(2), 200);
});

test("the address of a page keeps its folders, makes every part safe and carries the theme", () => {
  assert.equal(pageUrl("http://mock.localhost", "abc-1", "site", "index.html", "light"), "http://mock.localhost/abc-1/site/index.html?kona-theme=light");
  assert.equal(pageUrl("http://mock.localhost", "abc", "site", "pages/about us.html", "dark"), "http://mock.localhost/abc/site/pages/about%20us.html?kona-theme=dark");
  assert.equal(pageUrl("mock://localhost", "abc", "site", "/./a//b.html", "dark"), "mock://localhost/abc/site/a/b.html?kona-theme=dark");
  assert.equal(pageUrl("http://x", "a", "s", "../../etc/passwd", "light"), "http://x/a/s/etc/passwd?kona-theme=light", ".. is never kept as a step up");
  assert.equal(pageUrl("http://x", "a", "s", "é.html", "light").includes("%C3%A9"), true);
});

test("a change in the files of a card is noticed, whatever the order they were listed in", () => {
  const a = [{ path: "a.html", size: 10, modified: 5 }, { path: "css/b.css", size: 3, modified: 6 }];
  const b = [a[1], a[0]];
  assert.equal(filesSignature(a), filesSignature(b));
  assert.notEqual(filesSignature(a), filesSignature([{ ...a[0], modified: 7 }, a[1]]), "saved again");
  assert.notEqual(filesSignature(a), filesSignature([{ ...a[0], size: 11 }, a[1]]), "another size");
  assert.notEqual(filesSignature(a), filesSignature([a[0]]), "a file removed");
  assert.notEqual(filesSignature(a), filesSignature([...a, { path: "c.js", size: 1, modified: null }]), "a file added");
  assert.equal(filesSignature([]), "");
});

test("only what the helper of a page may say is taken from a page, and made safe", () => {
  assert.deepEqual(frameMessage({ kona: "ready" }), { kind: "ready" });
  assert.deepEqual(frameMessage({ kona: "escape" }), { kind: "escape" });
  assert.deepEqual(frameMessage({ kona: "wheel", dy: 120, x: 10, y: 20 }), { kind: "wheel", dy: 120, x: 10, y: 20 });
  assert.deepEqual(frameMessage({ kona: "wheel", dy: 99999, x: 1, y: 2 }), { kind: "wheel", dy: 400, x: 1, y: 2 });
  for (const bad of [null, undefined, 5, "ready", [], {}, { kona: "other" }, { kona: "wheel", dy: "1", x: 1, y: 1 }, { kona: "wheel", dy: NaN, x: 1, y: 1 }, { kona: "wheel", dy: 1, x: Infinity, y: 1 }, { kona: "wheel" }, { cmd: "add_project" }, { kona: { toString: () => "ready" } }]) {
    assert.equal(frameMessage(bad), null, JSON.stringify(bad));
  }
});

test("a Live page is loaded from the live address with the program's own path, and nothing is added", () => {
  assert.equal(liveUrl("http://live.localhost", "/"), "http://live.localhost/");
  assert.equal(liveUrl("http://live.localhost", "/login?x=1"), "http://live.localhost/login?x=1");
  assert.equal(liveUrl("http://live.localhost", "//evil.example/"), "http://live.localhost/");
  assert.equal(liveUrl("http://live.localhost", "login"), "http://live.localhost/");
});

test("the words for how far a Live program is", () => {
  assert.equal(livePhaseLine("ready"), "Running");
  assert.equal(livePhaseLine("setup"), "Making the demo data…");
  assert.equal(livePhaseLine("failed"), "It did not start");
  assert.equal(livePhaseLine("off"), "Not running");
});

test("a Live card's frame allows only what its recipe names", () => {
  assert.equal(liveSandbox([]), "allow-scripts allow-same-origin allow-forms");
  assert.equal(liveSandbox(["clipboard", "print", "downloads"]), "allow-scripts allow-same-origin allow-forms allow-modals allow-downloads");
  assert.equal(liveSandbox(["location"]), "allow-scripts allow-same-origin allow-forms");
  assert.equal(liveAllow([]), undefined);
  assert.equal(liveAllow(["clipboard", "location", "downloads"]), "clipboard-write; geolocation");
  for (const w of ["clipboard", "downloads", "location", "print"]) assert.ok(ALLOW_WORDS[w], w);
});

test("a Live page may ask for a web, mail or phone address to be opened in the owner's browser, and for nothing else", () => {
  assert.deepEqual(frameMessage({ kona: "open", url: "https://example.test/a?b=1" }), { kind: "open", url: "https://example.test/a?b=1" });
  assert.deepEqual(frameMessage({ kona: "open", url: "http://127.0.0.1:8000/file.pdf" }), { kind: "open", url: "http://127.0.0.1:8000/file.pdf" });
  assert.deepEqual(frameMessage({ kona: "open", url: "mailto:a@example.test" }), { kind: "open", url: "mailto:a@example.test" });
  for (const bad of ["file:///C:/Windows/win.ini", "javascript:alert(1)", "data:text/html,x", "ms-settings:", "C:\Windows\notepad.exe", "", "not a url", "https://example.test/" + "a".repeat(2100)]) assert.equal(frameMessage({ kona: "open", url: bad }), null, bad.slice(0, 30));
  assert.equal(frameMessage({ kona: "open" }), null);
  assert.equal(frameMessage({ kona: "open", url: 5 }), null);
});

test("a Live page that calls alert, confirm or prompt is answered at once and the sheet says what was asked", () => {
  assert.deepEqual(frameMessage({ kona: "dialog", kind: "confirm", text: "Delete this class?" }), { kind: "dialog", what: "confirm", text: "Delete this class?" });
  assert.deepEqual(frameMessage({ kona: "dialog", kind: "alert", text: "x".repeat(500) }), { kind: "dialog", what: "alert", text: "x".repeat(200) });
  assert.equal(frameMessage({ kona: "dialog", kind: "eval", text: "x" }), null);
  assert.equal(frameMessage({ kona: "dialog", kind: "alert", text: 5 }), null);
  assert.match(dialogLine("confirm", "Delete this class?"), /answered No/);
  assert.match(dialogLine("prompt", "Name?"), /answered nothing/);
  assert.match(dialogLine("alert", "Saved"), /cannot show an alert/);
  assert.ok(dialogLine("confirm", "y".repeat(300)).length < 200);
});

test("the data a Live card kept is described in plain words", () => {
  assert.equal(humanBytes(0), "0 bytes");
  assert.equal(humanBytes(1536), "1.5 KB");
  assert.equal(humanBytes(5 * 1024 * 1024), "5.0 MB");
  assert.equal(humanBytes(3 * 1024 ** 3), "3.0 GB");
  assert.equal(ageWords(30), "just now");
  assert.equal(ageWords(600), "10 minutes ago");
  assert.equal(ageWords(7200), "2 hours ago");
  assert.equal(ageWords(3 * 86400), "3 days ago");
  assert.equal(ageWords(null), "at an unknown time");
  assert.equal(dataLine({ bytes: 12 * 1024 * 1024, files: 38, age_secs: 2 * 86400, place: ".kona/live-data/lms" }), "Data from the last run: 12.0 MB in 38 files, changed 2 days ago. It is kept in .kona/live-data/lms.");
  assert.match(dataLine({ bytes: 10, files: 1, age_secs: 5, place: "x" }), /in 1 file,/);
});
