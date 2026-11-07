// The sizes of the mockup viewer's devices are written in words for the agents (the starter note "kona-mockups" and two skills). The real sizes are in
// assets/devices/devices.json, which the viewer draws from. This test fails when the words and the file disagree, so a change of a device cannot leave an agent guessing wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
type Device = { id: string; label: string; screen: { w: number; h: number }; turns: boolean; frames: { turned?: { screen: { w: number; h: number } } } };
const devices = (JSON.parse(read("../assets/devices/devices.json")) as { devices: Device[] }).devices;
const names: Record<string, string> = { "phone-s": "Small phone", phone: "Phone", tablet: "Tablet", laptop: "Laptop", monitor: "Desktop" };

test("the starter note lists every device of the viewer with its size, and what turns", () => {
  const note = read("../brain/starter/kona-mockups.md");
  assert.equal(devices.length, 5);
  for (const d of devices) {
    const row = note.split("\n").find((l) => l.startsWith(`| ${names[d.id]} |`));
    assert.ok(row, `no row for ${d.id} (${names[d.id]})`);
    assert.ok(row.includes(`${d.screen.w} × ${d.screen.h}`), `${d.id}: ${row}`);
    if (d.turns) assert.ok(row.includes(`${d.frames.turned!.screen.w} × ${d.frames.turned!.screen.h}`), `${d.id} turned: ${row}`);
    else assert.ok(row.includes("does not turn"), `${d.id} does not turn: ${row}`);
  }
});

test("the two skills that draw a mockup name the sizes of every device", () => {
  for (const file of ["make-a-mockup", "reverse-a-mockup"]) {
    const text = read(`../../src-tauri/skills/${file}/SKILL.md`);
    for (const d of devices) assert.ok(text.includes(`${names[d.id]} ${d.screen.w} x ${d.screen.h}`), `${file}: ${names[d.id]} ${d.screen.w} x ${d.screen.h}`);
  }
});

test("the screen note says the Mockups screen exists, and the viewer's start device is written down true", () => {
  assert.ok(read("../brain/starter/kona-screens.md").includes("[[kona-mockups]]"));
  assert.ok(read("../components/Mockups.tsx").includes(`pref("device", "laptop")`), "the note says the viewer starts on the Laptop");
});
