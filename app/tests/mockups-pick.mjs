// A test of pick mode and Send of the Mockups sheet in the REAL window (tickets T-0024 and T-0025), driven over the DevTools port. Run it against a BUILT program
// (`npm run tauri build -- --debug --no-bundle`), started with the test port and with the owner's own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then start src-tauri/target/debug/app.exe   then   node tests/mockups-pick.mjs
// It adds ONE throwaway project (a folder in the temp folder) with the account of the first project that has one, works through the sheet, and removes the project and the folder
// again whatever happens. Without MOCK_TEST_SEND=1 it starts no session and makes no call to a model. With it, Send is pressed for real: one cheap model call and one real session of the designer
// in the throwaway project (the owner's word first); the session is stopped and its transcripts are removed at the end.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };

const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-mockups-pick-${process.pid}`);
const NAME = "kona-mock-pick";
const mock = path.join(root, "project", ".kona", "mockups");
const write = (card, file, text) => { fs.mkdirSync(path.dirname(path.join(mock, card, file)), { recursive: true }); fs.writeFileSync(path.join(mock, card, file), text); };

const PAGE_JS = `
const el = (id) => document.getElementById(id);
const rects = () => { const o = {}; for (const e of document.querySelectorAll('[id]')) { const r = e.getBoundingClientRect(); o[e.id] = [r.left, r.top, r.width, r.height]; } return o; };
const info = () => ({ test: 'info', state: el('state') ? el('state').textContent : null, page: location.pathname.split('/').pop(), rects: rects(), clicks: window.__clicks || 0 });
const say = () => parent.postMessage(info(), '*');
addEventListener('message', (e) => { if (e.source === parent && e.data && e.data.test === 'ask') say(); });
if (el('btn')) el('btn').addEventListener('click', () => { el('state').textContent = 'signed in'; el('welcome').hidden = false; });
if (el('swap')) el('swap').addEventListener('click', () => { document.open(); document.write('<!doctype html><html><head><meta charset="utf-8"><title>swapped</title></head><body style="margin:0"><h1 id="nt" data-part="new-title" style="margin:40px">Swapped</h1></body></html>'); document.close(); });
if (el('link')) el('link').addEventListener('click', () => { window.__clicks = (window.__clicks || 0) + 1; });
`;
const css = `body { margin: 0; font: 16px sans-serif; background: #fff; color: #111; } h1 { margin: 20px; } #btn, #swap { margin: 20px; padding: 8px 12px; border-radius: 6px; border: 1px solid #888; font: inherit; }
#email { margin: 20px; padding: 6px; } #welcome { margin: 20px; padding: 16px; background: #def; border-radius: 10px; } #state { margin: 20px; }`;
const page = `<!doctype html><html><head><meta charset="utf-8"><title>login</title><link rel="stylesheet" href="style.css"></head><body>
<h1 id="t" data-part="page-title">Login</h1>
<input id="email" data-part="email-field" placeholder="Email address">
<button id="btn" data-part="sign-in">Sign in</button>
<p id="state">signed out</p>
<div id="welcome" data-part="welcome-card" hidden>Welcome back, Dana</div>
<a id="link" href="about.html" data-part="about-link">About</a>
<button id="swap" data-part="swap">Swap</button>
<script src="app.js"></script></body></html>`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = (ms = 400) => wait(ms);
const button = (label) => `document.querySelector('button[aria-label=${JSON.stringify(label)}]')`;
const press = (label) => c.ev(`(() => { const b = ${button(label)}; if (!b || b.disabled) return false; b.click(); return true; })()`);
const pressed = (label) => c.ev(`${button(label)}?.getAttribute('aria-pressed')`);
const mouse = (type, x, y, extra = {}) => c.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
const moveTo = async (x, y) => { await mouse("mouseMoved", x, y, { button: "none", clickCount: 0 }); };
const clickAt = async (x, y) => { await mouse("mouseMoved", x, y, { button: "none", clickCount: 0 }); await mouse("mousePressed", x, y); await mouse("mouseReleased", x, y); };
const key = async (k, code, vk, text) => { await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }); };
const esc = () => key("Escape", "Escape", 27);
const type = (text) => c.send("Input.insertText", { text });
const frameBox = () => c.ev(`(() => { const f = document.querySelector('iframe[title]'); if (!f) return null; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cw: f.offsetWidth, ch: f.offsetHeight }; })()`);
const askPage = async () => { await c.ev(`(document.querySelector('iframe[title]')?.contentWindow.postMessage({ test: 'ask' }, '*'), 0)`); await wait(300); return c.ev("window.__last || null"); };
/** where an element of the page is on the screen: its middle */
const centre = async (id) => { const i = await askPage(); const b = await frameBox(); const r = i?.rects?.[id]; if (!r || !b) return null; const k = b.w / b.cw; return { x: b.x + (r[0] + r[2] / 2) * k, y: b.y + (r[1] + r[3] / 2) * k }; };
const readout = () => c.ev(`document.querySelector('section[data-sheet] p.pointer-events-none')?.innerText ?? null`);
const noteBox = () => c.ev(`!!document.querySelector('[role=group][aria-label="Note for this part"]')`);
const dockTitle = () => c.ev(`document.querySelector('aside[aria-label="Notes"] h2')?.innerText ?? null`);
const dockItems = () => c.ev(`[...document.querySelectorAll('aside[aria-label="Notes"] li')].map((li) => ({ label: li.querySelector('span.truncate')?.innerText, note: li.querySelector('textarea')?.value }))`);
const shotDir = process.env.MOCK_TEST_SHOTS || null;
const shot = async (name) => { if (shotDir) { await c.shot(path.join(shotDir, name)); note("a picture was saved: " + path.join(shotDir, name)); } };

const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
let id = null;
try {
  if (!account) { note("SKIP no project with an account to borrow, the throwaway project could not be opened"); process.exit(0); }
  write("login", "index.html", page); write("login", "style.css", css); write("login", "app.js", PAGE_JS);
  write("login", "about.html", page.replace("<title>login</title>", "<title>about</title>").replace('<h1 id="t" data-part="page-title">Login</h1>', '<h1 id="t" data-part="about-title">About us</h1>'));
  write("login", "mockup.json", JSON.stringify({ name: "Login pages", entry: "index.html" }));
  id = (await invoke("add_project", { folder: path.join(root, "project"), name: NAME, github: null, account })).project.id;
  note(`throwaway project ${id}, account ${account}`);
  await c.send("Page.reload");
  await wait(1500);
  ok("the welcome page is back after the reload", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  ok("the throwaway project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if ([...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1 && !b.disabled) { b.click(); return true; } break; } } } return false; })()`));
  ok("it is the throwaway project that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200));
  // messages from the page, kept for the test
  await c.ev(`window.__last = null; window.addEventListener('message', (e) => { const f = document.querySelector('iframe[title]'); if (f && e.source === f.contentWindow && e.data && e.data.test) window.__last = e.data; });
    true`);
  ok("the big screen opens the Mockups sheet", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Mockups"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Mockups'`, 5000, 100));
  await idle(1200);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open Login pages"]').click(); true`);
  ok("the card opens", await c.waitFor(`!!document.querySelector('iframe[title="Login pages"]')`, 5000, 100));
  await idle(1500);
  ok("the page runs", (await askPage())?.state === "signed out");

  // T-0024: pick mode
  const PICK = "Pick a part and leave a note";
  ok("the pick button is there and is off", (await pressed(PICK)) === "false");
  await press(PICK); await idle(400);
  ok("pick mode is on (the button says so and now names how to stop)", (await pressed("Stop picking parts (Esc)")) === "true");
  let at = await centre("btn");
  await moveTo(at.x, at.y); await idle(500);
  let r = await readout();
  ok("moving over a part names it and shows its sizes", !!r && r.includes("sign-in") && /padding 8px 12px/.test(r) && /radius 6px/.test(r) && /border [0-9.]+px solid/.test(r), String(r));
  await shot("pick-hover.png");
  // a click on a link is paused, and so is a click on the button
  const link = await centre("link");
  await clickAt(link.x, link.y); await idle(600);
  ok("a click on a link of the page is paused in pick mode (no new page, no click reached the page)", (await askPage())?.page === "index.html" && (await askPage())?.clicks === 0);
  ok("the click on the link opened the note box instead", await noteBox());
  await esc(); await idle(300);
  ok("Esc closes the note box and keeps pick mode", !(await noteBox()) && (await pressed("Stop picking parts (Esc)")) === "true");
  at = await centre("btn");
  await clickAt(at.x, at.y); await idle(600);
  ok("a click on the button does not reach the page (still signed out)", (await askPage())?.state === "signed out");
  ok("a note box opens beside the part", await noteBox());
  const place = await c.ev(`(() => { const n = document.querySelector('[role=group][aria-label="Note for this part"]').getBoundingClientRect(); const f = document.querySelector('iframe[title]').getBoundingClientRect(); const s = document.querySelector('section[data-sheet]').getBoundingClientRect(); return { n: [n.left, n.top, n.right, n.bottom], f: [f.left, f.top, f.right, f.bottom], s: [s.left, s.top, s.right, s.bottom] }; })()`);
  ok("the note box is inside the sheet", place.n[0] >= place.s[0] - 1 && place.n[2] <= place.s[2] + 1 && place.n[1] >= place.s[1] - 1 && place.n[3] <= place.s[3] + 1, JSON.stringify(place.n));
  await shot("pick-note-box.png");
  ok("the note box asks what should change", await c.ev(`!!document.querySelector('textarea[aria-label="What should change here?"]')`));
  ok("an empty note cannot be added", await c.ev(`document.querySelector('[role=group][aria-label="Note for this part"] button:last-child').disabled`));
  await type("Make the button wider and blue");
  await c.ev(`[...document.querySelectorAll('[role=group][aria-label="Note for this part"] button')].find((b) => b.textContent.trim() === 'Add note').click(); true`); await idle(500);
  ok("the first pin is added", (await dockTitle()) === "Notes (1)", String(await dockTitle()));
  ok("the pin names the part", (await dockItems())[0]?.label === "sign-in" && (await dockItems())[0]?.note === "Make the button wider and blue", JSON.stringify(await dockItems()));
  ok("the note box closed after adding", !(await noteBox()));

  // before and after sign-in: leave pick mode, sign in, pick again
  await press("Stop picking parts (Esc)"); await idle(300);
  at = await centre("btn");
  await clickAt(at.x, at.y); await idle(500);
  ok("with pick mode off the page answers again (signed in)", (await askPage())?.state === "signed in");
  await press(PICK); await idle(300);
  at = await centre("welcome");
  await clickAt(at.x, at.y); await idle(500);
  ok("a part that only exists after sign-in can be picked", await noteBox());
  await type("Softer corners");
  await key("Enter", "Enter", 13, "\r"); await idle(500);
  ok("Enter adds the note", (await dockTitle()) === "Notes (2)", String(await dockTitle()));
  at = await centre("t");
  await clickAt(at.x, at.y); await idle(500);
  await type("Bigger title");
  await key("Enter", "Enter", 13, "\r"); await idle(500);
  ok("the third pin is added", (await dockTitle()) === "Notes (3)", String(await dockTitle()));
  await shot("pick-three-pins.png");
  const items = await dockItems();
  ok("the pins are in the order they were made", items.map((x) => x.label).join() === "sign-in,welcome-card,page-title", items.map((x) => x.label).join());
  await c.ev(`document.querySelector('button[aria-label="Remove note 2"]').click(); true`); await idle(300);
  const after = await dockItems();
  ok("a pin can be removed and the others close up", (await dockTitle()) === "Notes (2)" && after.map((x) => x.label).join() === "sign-in,page-title", after.map((x) => x.label).join());
  ok("a note can be changed in the list", await c.ev(`(() => { const t = document.querySelector('textarea[aria-label="Note 2"]'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'Bigger title, bold'); t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`) && (await dockItems())[1].note === "Bigger title, bold");

  // the pins follow the page when it loads again
  await press("Start the page again"); await idle(1500);
  ok("Start the page again keeps the pins and the page is back at its start", (await dockTitle()) === "Notes (2)" && (await askPage())?.state === "signed out");
  ok("pick mode is still on after the page loaded again", (await pressed("Stop picking parts (Esc)")) === "true");
  at = await centre("btn");
  await moveTo(at.x, at.y); await idle(500);
  ok("the helper of the new page answers (hover readout)", /sign-in/.test((await readout()) ?? ""), String(await readout()));
  await shot("pick-after-restart.png");

  // a page that replaces its whole document
  await press("Stop picking parts (Esc)"); await idle(300);
  at = await centre("swap");
  await clickAt(at.x, at.y); await idle(800);
  await press(PICK); await idle(400);
  // the new document is the page's own and answers nothing, so the new title (40 px in from the corner, margin 40) is found by its place
  const nb = await c.ev(`(() => { const f = document.querySelector('iframe[title]'); const r = f.getBoundingClientRect(); return { x: r.left + 90 * (r.width / f.offsetWidth), y: r.top + 60 * (r.height / f.offsetHeight) }; })()`);
  await moveTo(nb.x, nb.y); await idle(600);
  const r2 = await readout();
  ok("after the page replaced its whole document the helper still works (to verify, T-0024)", !!r2 && r2.includes("new-title"), String(r2));
  ok("and pick mode, which was turned on again after the swap, is still on in the sheet", (await pressed("Stop picking parts (Esc)")) === "true");
  await shot("pick-after-document-swap.png");

  // Esc steps: pick mode off, then back to the cards
  await esc(); await idle(300);
  ok("Esc turns pick mode off (the page stays)", (await pressed(PICK)) === "false" && !!(await frameBox()));
  ok("Notes stay while pick mode is off", (await dockTitle()) === "Notes (2)");

  // T-0025: Send. It makes a REAL model call (one cheap call) and starts a REAL session of the designer in the throwaway project, so it only runs when MOCK_TEST_SEND=1 is set
  // (the owner's word is needed first). The session is stopped, and its transcripts removed, at the end.
  await press("Start the page again"); await idle(1200);
  ok("the Send button is there", await c.ev(`!!document.querySelector('button[aria-label^="Turn the notes into a ticket for"]')`));
  if (process.env.MOCK_TEST_SEND !== "1") note("SKIP Send was not pressed (it makes a real model call and starts a real session; set MOCK_TEST_SEND=1 with the owner's word)");
  else {
    const t0 = Date.now();
    await c.ev(`document.querySelector('button[aria-label^="Turn the notes into a ticket for"]').click(); true`);
    ok("a dialog opens and says it is writing", await c.waitFor(`!!document.querySelector('[role=dialog]')`, 5000, 100));
    ok("a draft arrives to read and change", await c.waitFor(`!!document.querySelector('[role=dialog] textarea[aria-label="What needs doing"]')`, 120000, 500), `${Math.round((Date.now() - t0) / 1000)} seconds`);
    const d = await c.ev(`({ title: document.querySelector('[role=dialog] input[aria-label="Title"]')?.value, desc: document.querySelector('[role=dialog] textarea[aria-label="What needs doing"]')?.value, done: document.querySelector('[role=dialog] textarea[aria-label="Done when"]')?.value, text: document.querySelector('[role=dialog]')?.innerText })`);
    note("DRAFT title: " + d.title); note("DRAFT description: " + String(d.desc).replace(/\n/g, " | ")); note("DRAFT done when: " + String(d.done).replace(/\n/g, " | "));
    note("DRAFT line: " + String(d.text).split("\n").filter((x) => /plain list|Hidden|could not/i.test(x)).join(" / "));
    ok("the draft is the model's, not the plain list", !/plain list/.test(d.text));
    ok("it names where the mockup is and how it was seen", String(d.desc).includes(".kona/mockups/login/") && /Laptop/.test(d.desc));
    ok("it speaks of both notes", /sign-in/i.test(d.desc) && /(title|page-title)/i.test(d.desc), String(d.desc).slice(0, 200));
    await shot("send-dialog.png");
    await c.ev(`[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.startsWith('Create ticket for')).click(); true`);
    ok("the dialog closes", await c.waitFor(`!document.querySelector('[role=dialog]')`, 60000, 300));
    await idle(1500);
    const tickets = await invoke("list_tickets", { projectId: id });
    const t = tickets[0];
    ok("one ticket exists for the design role, raised by the owner, in the main folder", tickets.length === 1 && t.role === "design" && t.own_copy === "no" && t.raised_by === "the owner", JSON.stringify(t && { role: t.role, status: t.status, own_copy: t.own_copy, raised_by: t.raised_by }));
    ok("the session started on it (the ticket moved to In progress and holds a session)", t?.status === "in-progress" && t.sessions.length === 1, JSON.stringify(t && { status: t.status, sessions: t.sessions.length }));
    ok("the notes were cleared once they became a ticket", (await dockTitle()) === null);
    for (const s of t?.sessions ?? []) await invoke("stop_session", { sessionId: s }).catch(() => {});
    await idle(1000);
  }


  // After a real Send the app has opened the designer's chat (the sheet is gone), so what follows only runs without it
  if (process.env.MOCK_TEST_SEND === "1") ok("the app opened the designer's sheet on the ticket she started", await c.waitFor(`!document.querySelector('section[data-sheet] iframe[title]')`, 5000, 100));
  else {
  // Esc goes back to the cards at last
  await esc(); await idle(500);
  ok("Esc, with pick mode off, goes back to the cards", await c.waitFor(`!document.querySelector('iframe[title]')`, 3000, 100));
  await c.ev(`document.querySelector('section button[aria-label^="Close"]').click(); true`);
  ok("the sheet closes", await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100));
  }
} finally {
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === id) await invoke("remove_project", { id: p.id }); } catch (e) { note("could not remove the project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
  // transcripts that Claude Code kept for the throwaway project (a real session was started only when MOCK_TEST_SEND=1)
  try { const pr = path.join(os.homedir(), ".claude", "projects"); for (const d of fs.readdirSync(pr)) if (d.includes("kona-mockups-pick")) { fs.rmSync(path.join(pr, d), { recursive: true, force: true }); note("removed the transcripts folder " + d); } } catch { /* none */ }
  try {
    const final = await invoke("list_projects");
    ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)), `${before.length} before, ${final.length} after`);
  } catch {}
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
if (process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE, lines.join("\n") + "\n");
process.exit(failed ? 1 : 0);
