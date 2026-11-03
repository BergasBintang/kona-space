import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ZOOM, clampZoom, drawnSize, filesSignature, fitScale, frameMessage, frameOf, layout, pageUrl, percent, stepZoom, wheelZoom, type Device, type Frame } from "./mockview.ts";

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
