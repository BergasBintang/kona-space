// A REAL run of a workflow in the real window (decision 78): two people, one after the other, each in a real session of their own, the second handed what the first wrote, the cats
// sitting at the meeting table while it goes on, and the owner writing to the second person before their turn. It SPENDS PLAN (two short replies, no tools, on the role's own model:
// a few cents) and it is run only with the owner's word: set MOCK_TEST_RUN=1. Run it against a BUILT program started with the test port and with the owner's own Kona closed (see
// tests/mockups.mjs). It adds ONE throwaway project (and one workflow in it), and removes the project, its folder and the Claude transcripts of its sessions again whatever happens.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

if (process.env.MOCK_TEST_RUN !== "1") { console.log("SKIP this test makes real model calls and starts real sessions; set MOCK_TEST_RUN=1 with the owner's word"); process.exit(0); }
const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-meeting-run-${process.pid}`);
const NAME = "kona-meeting-run";
const shotDir = process.env.MOCK_TEST_SHOTS || null;
const shot = async (name) => { if (shotDir) { await c.shot(path.join(shotDir, name)); note("a picture was saved: " + path.join(shotDir, name)); } };
const clickText = (selector, text) => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.textContent.trim() === ${JSON.stringify(text)} && !x.disabled); if (!b) return false; b.click(); return true; })()`);
const sheetText = () => c.ev(`document.querySelector('section[data-sheet]')?.innerText ?? ''`);
const typeInto = (selector, text) => c.ev(`(() => { const t = document.querySelector(${JSON.stringify(selector)}); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ${JSON.stringify(text)}); t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);

const workflow = {
  id: "hello-pair", name: "Hello pair", about: "A test of the hand-over.", starter: false,
  steps: [
    { id: "first", title: "Choose a colour", role: "marketing", after: [], note: "Do not use any tools. Reply in one short sentence that names a colour, and end the sentence with the word BLUE-ROCKET." },
    { id: "second", title: "Repeat the colour", role: "support", after: ["first"], note: "Do not use any tools. Reply in one short sentence that repeats the colour the person before you named, and the last word you were handed." },
  ],
};

let id = null, sessionIds = [];
const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
try {
  if (!account) { note("SKIP no project with an account to borrow"); process.exit(0); }
  fs.mkdirSync(path.join(root, "project"), { recursive: true });
  id = (await invoke("add_project", { folder: path.join(root, "project"), name: NAME, account })).project.id;
  await invoke("workflow_save", { folder: path.join(root, "project"), workflow });
  await c.send("Page.reload"); await wait(1500);
  ok("the welcome page is back", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  ok("the throwaway project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if ([...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1 && !b.disabled) { b.click(); return true; } break; } } } return false; })()`));
  ok("it is the throwaway project that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200));
  await shot("run-office-before.png");
  await c.ev(`document.querySelector('[aria-label="Open Meeting"]').click(); true`);
  ok("the table opens the Meeting", await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Meeting'`, 5000, 100));
  ok("no meeting yet", /No meeting yet/.test(await sheetText()));
  await clickText("section[data-sheet] button", "Choose a workflow to run");
  await c.waitFor(`!!document.querySelector('nav[aria-label="Workflows"]')`, 4000, 100);
  await wait(500);
  const list = await c.ev(`[...document.querySelectorAll('nav[aria-label="Workflows"] button')].map((b) => b.textContent.trim())`);
  await clickText("nav[aria-label=Workflows] button", list.find((x) => x.startsWith("Hello pair")));
  await wait(500);
  await clickText("section[data-sheet] button", "Run");
  await wait(300);
  ok("Run asks first", await clickText("section[data-sheet] button", "Yes, run 2 steps"));
  ok("the Chat tab opens by itself with the meeting", await c.waitFor(`/Hello pair/.test(document.querySelector('section[data-sheet]')?.innerText ?? '') && !!document.querySelector('textarea[aria-label="Say something to the meeting"]')`, 15000, 200));

  // the first person works; the owner writes to the second person, whose turn has not come
  ok("the first person is working", await c.waitFor(`/1\\. Choose a colour \\(Yuzu\\)/.test(document.querySelector('section[data-sheet]')?.innerText ?? '')`, 60000, 300));
  await typeInto('textarea[aria-label="Say something to the meeting"]', "Kenn, please answer in capital letters");
  await c.ev(`document.querySelector('button[aria-label="Send to the meeting"]').click(); true`);
  ok("a message to a person whose turn has not come is kept for them", await c.waitFor(`/To Kenn, for their turn: please answer in capital letters/.test(document.querySelector('section[data-sheet]')?.innerText ?? '')`, 8000, 200));
  // leave the sheet to look at the office while the meeting goes on
  await c.ev(`document.querySelector('section button[aria-label^="Close"]')?.click(); true`);
  await wait(1200);
  await shot("run-office-during.png");
  await c.ev(`document.querySelector('[aria-label="Open Meeting"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Meeting'`, 5000, 100);

  ok("the second person starts when the first has finished", await c.waitFor(`/2\\. Repeat the colour \\(Kenn\\)/.test(document.querySelector('section[data-sheet]')?.innerText ?? '')`, 240000, 500));
  ok("the hand-over is said", /Yuzu handed over to Kenn/.test(await sheetText()));
  ok("the meeting ends by itself", await c.waitFor(`/The meeting is over/.test(document.querySelector('section[data-sheet]')?.innerText ?? '')`, 240000, 500));
  await wait(800);
  const t = await sheetText();
  note("the chat: " + t.replace(/\s+/g, " ").slice(0, 900));
  await shot("run-chat-done.png");
  ok("both people spoke in the one chat", /Yuzu/.test(t) && /Kenn/.test(t));
  ok("the second person was handed the first one's words (the last word reached them)", /BLUE-ROCKET/i.test(t.slice(t.indexOf("2. Repeat the colour"))), "");
  ok("the status says Done and no box is left to write in", /Done/.test(t) && !(await c.ev(`!!document.querySelector('textarea[aria-label="Say something to the meeting"]')`)));
  ok("no ticket was made", (await invoke("list_tickets", { projectId: id })).length === 0);
  const files = fs.readdirSync(path.join(root, "project", ".kona", "runs"));
  const saved = JSON.parse(fs.readFileSync(path.join(root, "project", ".kona", "runs", files[0]), "utf8"));
  ok("the run is kept in one file, done, with both results and both logs", files.length === 1 && saved.status === "done" && saved.steps.every((s) => s.status === "done" && s.result && s.log && s.log.length > 0), files.join());
  ok("each step holds the id of its session, and the cost was counted", saved.steps.every((s) => s.sessionId && s.cost > 0), saved.steps.map((s) => s.cost.toFixed(4)).join());
  sessionIds = saved.steps.map((s) => s.sessionId);
  await c.ev(`document.querySelector('section button[aria-label^="Close"]')?.click(); true`);
  await wait(1500);
  await shot("run-office-after.png");
} finally {
  for (const s of sessionIds) { try { await invoke("stop_session", { sessionId: s }); } catch { /* it has ended */ } }
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === id) await invoke("remove_project", { id: p.id }); } catch (e) { note("could not remove the project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
  try { const pr = path.join(os.homedir(), ".claude", "projects"); for (const d of fs.readdirSync(pr)) if (d.includes("kona-meeting-run")) { fs.rmSync(path.join(pr, d), { recursive: true, force: true }); note("removed the transcripts folder " + d); } } catch { /* none */ }
  try { const final = await invoke("list_projects"); ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id))); } catch {}
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
