// Run against a Kona started with the test port 9223 and no other window of yours open: node tests/history-more.mjs
// "Show more" in History: 61 saved conversations in a throwaway project must show 30, then 60, then 61. The conversations are made-up transcript files (no Claude call): they have no cost row,
// so they are filed under the Secretary. Everything is removed at the end.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { attach } from "./cdp.mjs";

const c = await attach(9223);
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const NAME = "kona-history-61";
const root = path.join(os.tmpdir(), `kona-history61-${process.pid}`);
const proj = path.join(root, "project");
const slug = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
const before = await invoke("list_projects");
let id = null, tdir = null;
const items = () => c.ev(`[...document.querySelectorAll('section[data-sheet]:not([hidden]) [data-earlier]')].length`);
const moreLabel = () => c.ev(`[...document.querySelectorAll('section[data-sheet]:not([hidden]) button')].map((b) => b.textContent.trim()).find((t) => /^Show \\d+ more$/.test(t)) ?? null`);
const clickMore = () => c.ev(`(() => { const b = [...document.querySelectorAll('section[data-sheet]:not([hidden]) button')].find((x) => /^Show \\d+ more$/.test(x.textContent.trim())); if (!b) return false; b.click(); return true; })()`);
try {
  fs.mkdirSync(proj, { recursive: true });
  const accounts = await invoke("list_accounts");
  let account = null;
  for (const a of accounts) { if ((await invoke("account_status", { id: a.id })).logged_in) { account = a; break; } }
  if (!account) throw new Error("no signed-in account");
  id = (await invoke("add_project", { folder: proj, name: NAME, account: account.id })).project.id;
  tdir = path.join(account.config_dir ?? path.join(os.homedir(), ".claude"), "projects", slug(proj));
  fs.mkdirSync(tdir, { recursive: true });
  const now = Date.now();
  for (let i = 1; i <= 61; i++) {
    const line = JSON.stringify({ type: "user", message: { role: "user", content: `probe conversation ${i} ` + "x".repeat(40) } }) + "\n";
    const f = path.join(tdir, crypto.randomUUID() + ".jsonl");
    fs.writeFileSync(f, line.repeat(12));
    const t = new Date(now - (62 - i) * 60000); // 61 is the newest
    fs.utimesSync(f, t, t);
  }
  await c.send("Page.reload"); await wait(1500);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  const opened = await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if ([...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1 && !b.disabled) { b.click(); return true; } break; } } } return false; })()`);
  ok("the throwaway project is the one open", opened && await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  await c.ev(`document.querySelector('[aria-label="Open Kupa, Secretary"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]:not([hidden])')?.getAttribute('aria-label') === 'Kupa, Secretary'`, 6000, 100);
  await c.ev(`[...document.querySelectorAll('section[data-sheet]:not([hidden]) [role=tab]')].find((b) => b.textContent.trim() === 'History').click(); true`);
  await wait(1200);
  ok("History shows the 30 newest", (await items()) === 30, String(await items()));
  ok("the first one is the newest", await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) [data-earlier]').innerText.includes('probe conversation 61')`));
  ok("a button offers 30 more", (await moreLabel()) === "Show 30 more", String(await moreLabel()));
  await clickMore(); await wait(1200);
  ok("after Show more: 60 are listed", (await items()) === 60, String(await items()));
  ok("the button now offers the last one", (await moreLabel()) === "Show 1 more", String(await moreLabel()));
  await clickMore(); await wait(1200);
  ok("after the second Show more: all 61 are listed, oldest last", (await items()) === 61 && await c.ev(`[...document.querySelectorAll('section[data-sheet]:not([hidden]) [data-earlier]')].pop().innerText.includes('probe conversation 1 ')`), String(await items()));
  ok("and no more button", (await moreLabel()) === null);
  // another person has none of them
  await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) button[aria-label^="Close"]')?.click(); true`); await wait(500);
  await c.ev(`document.querySelector('[aria-label="Open Jiro, Frontend"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]:not([hidden])')?.getAttribute('aria-label') === 'Jiro, Frontend'`, 6000, 100);
  await c.ev(`[...document.querySelectorAll('section[data-sheet]:not([hidden]) [role=tab]')].find((b) => b.textContent.trim() === 'History').click(); true`);
  await wait(1000);
  ok("another person (Jiro) has no conversations of the Secretary's", (await items()) === 0 && (await moreLabel()) === null);
  await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) button[aria-label^="Close"]')?.click(); true`);
} catch (e) { console.log("FAIL stopped: " + String(e.stack ?? e).slice(0, 400)); failed++; }
finally {
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === id) await invoke("remove_project", { id: p.id }); } catch (e) { console.log("could not remove the project: " + e); }
  try { if (tdir) fs.rmSync(tdir, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  try { const f = await invoke("list_projects"); ok("the project list is as it was, and the folders are gone", JSON.stringify(f.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)) && !fs.existsSync(root) && !(tdir && fs.existsSync(tdir))); } catch {}
  c.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
