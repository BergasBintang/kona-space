// The chat box and Enter while an input method is building a word (Japanese, Chinese, Korean...), tried in the REAL window in a THROWAWAY project. Start Kona (a built program) with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   and no other window of yours open, then   node tests/chat-composing.mjs
// It adds one project (a folder in the temp folder), starts Jiro (Haiku) in it, sends one tiny message, and removes the project, the folder and the saved conversation at the end. It spends under a cent.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const NAME = "kona-composing-probe";
const root = path.join(os.tmpdir(), `kona-compose-${process.pid}`);
const proj = path.join(root, "project");
const slug = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
const before = await invoke("list_projects");
let account = null, sid = null;

const sheet = `section[data-sheet]:not([hidden])`;
const chatText = () => c.ev(`document.querySelector('${sheet}')?.innerText.replace(/\\s+/g, ' ') ?? ''`);
const box = () => c.ev(`document.querySelector('${sheet} textarea')?.value ?? null`);
const focusBox = () => c.ev(`document.querySelector('${sheet} textarea').focus(); true`);
// a keydown the way a browser makes it while an input method is composing: Enter with isComposing true
const composingEnter = () => c.ev(`(() => { const t = document.querySelector('${sheet} textarea'); const e = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true, cancelable: true }); t.dispatchEvent(e); return e.defaultPrevented; })()`);

try {
  fs.mkdirSync(proj, { recursive: true });
  for (const a of await invoke("list_accounts")) { if (process.env.ACCOUNT && a.label !== process.env.ACCOUNT) continue; if ((await invoke("account_status", { id: a.id })).logged_in) { account = a; break; } }
  if (!account) throw new Error("no signed-in account");
  await invoke("add_project", { folder: proj, name: NAME, account: account.id });
  await c.send("Page.reload"); await wait(1500);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  const opened = await c.ev(`(() => { const isOpen = (x) => /^Open$/.test(x.textContent.trim()); const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(NAME)}); if (!title) return false; let n = title; while (n && ![...n.querySelectorAll('button')].some(isOpen)) n = n.parentElement; const b = n && [...n.querySelectorAll('button')].find(isOpen); if (!b || b.disabled) return false; b.click(); return true; })()`);
  ok("the throwaway project opens", opened && await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 15000, 200));
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  await c.ev(`document.querySelector('[aria-label="Open Jiro, Frontend"]').click(); true`);
  await c.waitFor(`document.querySelector('${sheet}')?.getAttribute('aria-label') === 'Jiro, Frontend'`, 6000, 100);
  sid = await invoke("start_session", { folder: proj, roleId: "frontend", accountId: account.id, useVoice: false, ticketId: null, brainDigest: null, model: "haiku", mode: "plan", resume: null });
  await c.waitFor(`!!document.querySelector('${sheet} textarea') && /Started in/.test(document.querySelector('${sheet}').innerText)`, 15000, 200);

  // ---- 1. Enter that belongs to an input method does not send
  const text = "Reply with only the word PONG.";
  await focusBox();
  await c.send("Input.insertText", { text }); await wait(300);
  const prevented = await composingEnter(); await wait(500);
  ok("Enter while a word is being built does not send: the text stays in the box", (await box()) === text, JSON.stringify(await box()));
  ok("nothing was added to the conversation, and Enter was left to the input method (not cancelled)", !(await chatText()).includes("PONG") && prevented === false, "defaultPrevented=" + prevented);

  // ---- 2. a real Enter afterwards still sends
  await focusBox();
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  ok("a normal Enter sends it", await c.waitFor(`document.querySelector('${sheet} textarea')?.value === ''`, 5000, 100));
  const answered = await c.waitFor(`(document.querySelector('${sheet}')?.innerText.match(/PONG/g) ?? []).length >= 2`, 90000, 500);
  ok("and Jiro answers", answered, answered ? "" : (await chatText()).slice(-400));

  // ---- 3. Shift+Enter still only makes a new line
  await focusBox();
  await c.send("Input.insertText", { text: "one" });
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8, text: "\r" });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8 });
  await c.send("Input.insertText", { text: "two" }); await wait(300);
  ok("Shift+Enter still makes a new line and sends nothing", (await box()) === "one\ntwo", JSON.stringify(await box()));
  await invoke("stop_session", { sessionId: sid }); await wait(1500);
} catch (e) { console.log("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 500)); failed++; }
finally {
  try { if (sid) await invoke("stop_session", { sessionId: sid }); } catch {}
  try { for (const p of await invoke("list_projects")) if (p.name === NAME) await invoke("remove_project", { id: p.id }); } catch (e) { console.log("could not remove the project: " + e); }
  try { const dir = path.join(account?.config_dir ?? path.join(os.homedir(), ".claude"), "projects"); for (const n of fs.readdirSync(dir)) if (n.toLowerCase().includes(slug(proj).toLowerCase())) fs.rmSync(path.join(dir, n), { recursive: true, force: true }); } catch {}
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  try { const f = await invoke("list_projects"); ok("the project list is as it was, and the folder is gone", JSON.stringify(f.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)) && !fs.existsSync(root)); } catch {}
  c.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
