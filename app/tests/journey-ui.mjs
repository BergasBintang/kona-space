// A test of the Journey view and the Mockups page of the journey in the REAL window (tickets T-0036 to T-0039), driven over the DevTools port. Run it against a BUILT program
// (`npm run tauri build -- --debug --no-bundle`), started with the test port and with the owner's own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then start src-tauri/target/debug/app.exe   then   node tests/journey-ui.mjs
// It adds ONE throwaway project (a folder in the temp folder) with the account of the first project that has one (it needs a signed-in account to open), reloads the test window,
// works through the Brain's Journey page and a Mockups card that reads the journey, and removes the project and the folder again whatever happens. It starts no session and
// calls no model. Never run it on a window the owner has open. Screenshots go to SHOT_DIR when that is set.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
try { const w0 = await c.send("Browser.getWindowForTarget"); await c.send("Browser.setWindowBounds", { windowId: w0.result.windowId, bounds: { windowState: "maximized" } }); await new Promise((r) => setTimeout(r, 800)); } catch { /* a window that cannot be maximized is tested as it is */ }
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { if (process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); await c.shot(path.join(process.env.SHOT_DIR, name + ".png")); } };

const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-journey-ui-${process.pid}`);
const NAME = "kona-journey-ui";
const proj = path.join(root, "project");
const put = (rel, text) => { const f = path.join(proj, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const note_ = (title, id, journey) => put(`.kona/brain/${id}.md`, `---\ntitle: ${title}\nkind: journey\n---\n# ${title}\n\nWords around the map.\n\n\`\`\`journey\n${JSON.stringify(journey, null, 1)}\n\`\`\`\n`);
const ticket = (id, status, body) => put(`.kona/tickets/${id}.md`, `---\nid: ${id}\ntitle: Ticket ${id}\nstatus: ${status}\nrole: \nraised_by: owner\nsessions: \nnext: x\nwaiting: false\nown_copy: auto\nbranch: \nworktree: \nblocked_by: \nworkflow: \ncreated: 2026-11-01 10:00\nupdated: 2026-11-12 10:00\n---\n${body}\n`);

// ---- the throwaway project's files ----
const small = {
  title: "Photo albums",
  users: [{ id: "guest", name: "Guest" }, { id: "member", name: "Member" }],
  steps: [
    { id: "visit", name: "Open the site", lane: "person", start: true, access: ["guest"], next: [{ to: "sign-in" }], status: "built", updated: "2026-11-10", tickets: ["T-0002"] },
    { id: "sign-in", name: "Sign in", lane: "app", kind: "screen", access: ["guest"], fields: ["Email", "Password"], buttons: [{ label: "Sign in", to: "check-login" }], errors: [{ text: "Wrong email or password", to: "sign-in" }],
      status: "built", updated: "2026-01-01", mockup: "photo-albums/sign-in.html", tickets: ["T-0001"] },
    { id: "check-login", name: "Check the login", lane: "server", next: [{ to: "home", label: "correct" }, { to: "sign-in", label: "wrong" }], status: "built", updated: "2026-11-10", tickets: ["T-0002"] },
    { id: "home", name: "Your albums", lane: "app", kind: "screen", access: ["member"], buttons: [{ label: "New album", to: "suggest-title" }], status: "built", updated: "2026-11-12", mockup: "photo-albums/home.html", tickets: ["T-0002"] },
    { id: "suggest-title", name: "Suggest a title", lane: "server", actor: "ai", ai: { does: "Suggests a title from the photos", model: "a small language model" }, next: [{ to: "share", label: "title accepted" }], status: "not-built" },
    { id: "share", name: "A friend opens the link", lane: "person", actor: "people", end: true, access: ["guest"], status: "not-built" },
  ],
};
// a real amount: 120 steps in four lanes, with branches and loops back
const lanes = ["person", "app", "server", "queue"];
const big = {
  title: "Big journey",
  lanes: lanes.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), actor: id === "person" ? "person" : "system" })),
  steps: Array.from({ length: 120 }, (_, i) => {
    const next = [];
    if (i < 119) next.push({ to: `s${i + 1}`, label: i % 10 === 0 ? "the long choice label that goes on" : "" });
    if (i % 10 === 3 && i + 7 < 120) next.push({ to: `s${i + 7}`, label: "skip ahead" });
    if (i % 25 === 24) next.push({ to: `s${i - 5}`, label: "again" });
    return { id: `s${i}`, name: `Step number ${i} with a fairly long plain-words name`, lane: lanes[i % 4], start: i === 0, end: i === 119, next, status: ["built", "in-progress", "not-built"][i % 3], updated: "2026-11-10",
      ...(i % 4 === 1 ? { kind: "screen", mockup: `site/p${i}.html`, fields: ["A field"], buttons: [{ label: "Go", to: `s${Math.min(i + 1, 119)}` }], errors: [{ text: "Something went wrong" }] } : {}),
      ...(i % 3 === 0 ? { tickets: ["T-0001"] } : { notes: ["a-note"] }) };
  }),
};
const template = fs.readFileSync(new URL("../src-tauri/skills/make-a-mockup/templates/journey.html", import.meta.url), "utf8");
const probe = `setTimeout(function () {
  var steps = document.querySelectorAll('.step'), screen = document.querySelector('.step[data-step="sign-in"]');
  var before = screen ? screen.getAttribute('aria-expanded') : null;
  if (screen) screen.click();
  var more = screen ? screen.querySelector('.more') : null;
  var opened = screen ? { expanded: screen.getAttribute('aria-expanded'), shown: !!more && getComputedStyle(more).display !== 'none', text: more ? more.innerText : '' } : null;
  parent.postMessage({ test: 'journey', steps: steps.length, lanes: document.querySelectorAll('.lane').length, title: document.getElementById('title').textContent, before: before, opened: opened, kinds: document.getElementById('kind').options.length }, '*');
}, 1200);
Promise.all([
  fetch('_kona/journey.json').then(function (r) { return r.status; }, function () { return 'blocked'; }),
  fetch('_kona/other.json').then(function (r) { return r.status; }, function () { return 'blocked'; }),
  fetch('%2e%2e/%2e%2e/brain/photo-albums.md').then(function (r) { return r.status; }, function () { return 'blocked'; }),
  fetch('../photo-albums/_kona/journey.json').then(function (r) { return r.status; }, function () { return 'blocked'; }),
  fetch('https://example.com/').then(function (r) { return r.status; }, function () { return 'blocked'; })
]).then(function (s) { parent.postMessage({ test: 'fetches', journey: s[0], other: s[1], escape: s[2], sameCard: s[3], web: s[4] }, '*'); });`;

const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
let id = null;
try {
  if (!account) { note("SKIP no project with an account to borrow, the throwaway project could not be opened"); process.exit(0); }
  note_("A photo albums", "photo-albums", small);
  note_("Big journey", "big-journey", big);
  put(".kona/brain/c-broken.md", "---\ntitle: C broken\nkind: journey\n---\n```journey\n{ broken\n```\n");
  ticket("T-0001", "review", "**Why.** The sign-in screen changed.\n\n## Done when\n- [ ] The sign-in works");
  ticket("T-0002", "done", "**Why.** Other work.\n\n## Done when\n- [x] Journey: no change");
  put(".kona/mockups/photo-albums/mockup.json", JSON.stringify({ name: "Photo albums", entry: "index.html", journey: "photo-albums" }));
  put(".kona/mockups/photo-albums/index.html", template.replace("</body>", `<script src="probe.js"></script></body>`));
  put(".kona/mockups/photo-albums/probe.js", probe);
  put(".kona/mockups/photo-albums/sign-in.html", "<!doctype html><title>s</title><h1>Sign in</h1>");
  put(".kona/mockups/photo-albums/home.html", "<!doctype html><title>h</title><h1>Your albums</h1>");
  put("src/pages/signin.html", "<!-- kona-step: sign-in -->\n<form></form>\n");
  put("src/extra.js", "// kona-step: extra-page\nexport {};\n");
  put("src/other.js", "export {};\n");

  id = (await invoke("add_project", { folder: proj, name: NAME, account })).project.id;
  note(`throwaway project ${id}, account ${account}`);
  await c.send("Page.reload");
  await wait(1500);
  ok("the welcome page is back after the reload", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  ok("the throwaway project is on the welcome page and opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if (n.querySelectorAll('button').length && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1 && !b.disabled) { b.click(); return true; } break; } } } return false; })()`));
  ok("it is the throwaway project that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 10`, 20000, 200));
  await c.ev(`window.__errs = []; addEventListener("error", (e) => window.__errs.push(String(e.message) + " " + String(e.error?.stack ?? "").slice(0, 600))); addEventListener("unhandledrejection", (e) => window.__errs.push("rejection " + String(e.reason))); true`);
  const names = await c.ev(`[...document.querySelectorAll('[aria-label^="Open "]')].map((e) => e.getAttribute('aria-label'))`);
  note("pieces: " + names.join(", "));

  // ---- the Brain's Journey page ----
  ok("the Brain opens from its piece in the office", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Brain"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Brain'`, 6000, 100));
  const tabs = await c.ev(`[...document.querySelectorAll('section[data-sheet] [role="tab"]')].map((b) => b.textContent.trim())`);
  ok("the Brain has a Journey tab beside Map, Notes, Ask and Report", JSON.stringify(tabs) === JSON.stringify(["Map", "Notes", "Journey", "Ask", "Report"]), tabs.join());
  await c.ev(`[...document.querySelectorAll('section[data-sheet] [role="tab"]')].find((b) => b.textContent.trim() === 'Journey').click(); true`);
  ok("the Journey page draws a map", await c.waitFor(`document.querySelectorAll('svg g[data-step]').length > 0`, 8000, 100));
  const boxes = () => c.ev(`document.querySelectorAll('svg g[data-step]').length`);
  ok("the first journey (A photo albums) has its 6 steps as boxes", (await boxes()) === 6, String(await boxes()));
  const mapInfo = await c.ev(`(() => { const s = document.querySelector('svg[role="img"]'); const r = s.getBoundingClientRect(); const lanes = [...document.querySelectorAll('section[data-sheet] [role="group"][aria-label="Journey map"] .absolute')].map((e) => e.innerText.trim()); return { w: r.width, h: r.height, lanes, edges: document.querySelectorAll('svg [data-edge]').length, hs: document.querySelector('section[data-sheet] [role="group"][aria-label="Journey map"]').scrollWidth }; })()`);
  ok("the lanes are named in a column at the left", JSON.stringify(mapInfo.lanes) === JSON.stringify(["Person", "App", "Server"]), mapInfo.lanes.join());
  ok("the lines between the steps are drawn", mapInfo.edges >= 6, String(mapInfo.edges));
  await shot("journey-small");
  const box = (stepId) => c.ev(`(() => { const e = document.querySelector('svg g[data-step=' + ${JSON.stringify(JSON.stringify(stepId))} + ']'); if (!e) return null; e.scrollIntoView({ block: "center", inline: "center" }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, label: e.getAttribute('aria-label') }; })()`);
  const mouse = (type, x, y) => c.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  const clickAt = async (x, y) => { await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y); await mouse("mouseReleased", x, y); };

  // a real click on a box opens its details in a dialog
  let b = await box("sign-in");
  ok("a box says who acts and its status in its name", /Sign in\. System\. Built\./.test(b?.label ?? ""), b?.label);
  await clickAt(b.x, b.y);
  ok("a click on the sign-in screen opens a dialog with its fields, buttons and errors", await c.waitFor(`(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.getAttribute('aria-label') === 'Sign in' && d.innerText.includes('Email, Password') && d.innerText.includes('Wrong email or password') && d.innerText.includes('Sign in leads to') ; })()`, 3000, 100), (await c.ev(`document.querySelector('[role="dialog"]')?.innerText ?? ''`)).replace(/\s+/g, " ").slice(0, 300));
  note("page errors so far: " + JSON.stringify(await c.ev(`window.__errs`)).slice(0, 1500));
  const dlg = await c.ev(`document.querySelector('[role="dialog"]')?.innerText ?? ''`);
  ok("the dialog flags the finished ticket that the journey was not saved under", dlg.includes("Ticket T-0001 is finished"), dlg.replace(/\s+/g, " ").slice(-260));
  ok("the dialog gives the date hint for the mockup", dlg.includes("Hint: Mockup changed"), "");
  await shot("journey-dialog");
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  ok("Esc closes the dialog (and the Brain stays open)", await c.waitFor(`!document.querySelector('[role="dialog"]')`, 2000, 100) && await c.ev(`!!document.querySelector('section[data-sheet]')`));

  // the AI step and the people step look different (a word each) and a draft is not there yet
  const ai = await box("suggest-title"), pe = await box("share");
  ok("an AI step and a people step carry their own word", /AI\./.test(ai?.label ?? "") && /People\./.test(pe?.label ?? ""), `${ai?.label} | ${pe?.label}`);

  // the status table
  const table = await c.ev(`(() => { const t = document.querySelector('section[data-sheet] table'); if (!t) return null; return { head: [...t.querySelectorAll('th')].map((x) => x.innerText.trim()), rows: t.querySelectorAll('tbody tr').length, text: t.innerText }; })()`);
  ok("the status table has its columns and one row for each step", !!table && table.rows === 6 && ["Step", "Lane", "Status", "Ticket", "Mockup", "Last updated"].every((h) => table.head.some((x) => x.startsWith(h))), JSON.stringify(table?.head));
  ok("the table's Check column says why a step may be out of date", !!table && table.head.some((x) => x.startsWith("Check")) && table.text.includes("Ticket T-0001 is finished") && !table.text.includes("Ticket T-0002 is finished"), "");
  ok("the explanation is behind the round question mark, not on the page", await c.ev(`!!document.querySelector('section[data-sheet] button[aria-label="About Journey"]')`));

  // the markers
  ok("before a scan nothing is said about markers", !(await c.ev(`document.querySelector('section[data-sheet]').innerText.includes('Scanned')`)));
  ok("Scan code is pressed", await c.ev(`(() => { const x = [...document.querySelectorAll('section[data-sheet] button')].find((e) => e.textContent.trim() === 'Scan code'); if (!x) return false; x.click(); return true; })()`));
  ok("the scan reports what it read", await c.waitFor(`document.querySelector('section[data-sheet]').innerText.includes('Scanned')`, 15000, 200), (await c.ev(`(document.querySelector('section[data-sheet]').innerText.match(/Scanned[^\\n]*/) ?? [''])[0]`)));
  const scanned = await c.ev(`(document.querySelector('section[data-sheet]').innerText.match(/Scanned (\\d+) files[^\\n]*: (\\d+) step markers found/) ?? [])`);
  ok("it read the project's code files (2 or 3, no more) and found 2 markers", scanned.length === 3 && Number(scanned[1]) >= 3 && Number(scanned[1]) <= 6 && Number(scanned[2]) === 2, JSON.stringify(scanned));
  ok("a marker the journey does not know is drawn as a draft step, Not confirmed", await c.waitFor(`!!document.querySelector('svg g[data-step="extra-page"]') && document.querySelector('svg g[data-step="extra-page"]').getAttribute('aria-label').includes('Not confirmed')`, 3000, 100), (await box("extra-page"))?.label);
  const lanes2 = await c.ev(`[...document.querySelectorAll('section[data-sheet] [role="group"][aria-label="Journey map"] .absolute')].map((e) => e.innerText.trim())`);
  ok("the draft is in a lane of its own called Not confirmed", lanes2.includes("Not confirmed"), lanes2.join());
  ok("a button says how many markers to check", await c.ev(`[...document.querySelectorAll('section[data-sheet] button')].some((x) => /^2 markers to check/.test(x.textContent.trim()))`), "");
  ok("the built screen with no marker is marked, and the table says so", (await c.ev(`document.querySelector('section[data-sheet] table').innerText.includes('No page found: no file says kona-step: home')`)));
  ok("the markers button opens a list with the file and line", await c.ev(`(() => { const x = [...document.querySelectorAll('section[data-sheet] button')].find((e) => /markers to check/.test(e.textContent)); x.click(); return true; })()`) && await c.waitFor(`(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.innerText.includes('extra-page') && d.innerText.includes('src/extra.js, line 1') && d.innerText.includes('Your albums'); })()`, 3000, 100));
  await shot("journey-markers");
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await c.waitFor(`!document.querySelector('[role="dialog"]')`, 2000, 100);


  // the on-request check of the names: it asks first and says what it costs, Cancel sends nothing, and then two REAL Haiku calls (a few cents): a journey whose names fit, and one page changed so that it does not
  const press = (label) => c.ev(`(() => { const x = [...document.querySelectorAll('section[data-sheet] button')].find((e) => e.textContent.trim() === ${JSON.stringify(label)}); if (!x) return false; x.click(); return true; })()`);
  const dialogTitle = () => c.ev(`document.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? ''`);
  ok("Check the names asks first and says it uses a little of the plan", await press("Check names") && await c.waitFor(`(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.getAttribute('aria-label') === 'Check the names of the steps?' && d.innerText.includes('uses a little of your plan') && d.innerText.includes('2 mockup pages'); })()`, 3000, 100), (await c.ev(`document.querySelector('[role="dialog"]')?.innerText ?? ''`)).replace(/\s+/g, " ").slice(0, 220));
  ok("Cancel closes it and sends nothing", await c.ev(`(() => { const x = [...document.querySelectorAll('[role="dialog"] button')].find((e) => e.textContent.trim() === 'Cancel'); if (!x) return false; x.click(); return true; })()`) && await c.waitFor(`!document.querySelector('[role="dialog"]')`, 2000, 100));
  const runNames = async () => {
    await press("Check names"); await c.waitFor(`!!document.querySelector('[role="dialog"]')`, 3000, 100);
    await c.ev(`(() => { const x = [...document.querySelectorAll('[role="dialog"] button')].find((e) => e.textContent.trim() === 'Check'); if (x) x.click(); return true; })()`);
    await c.waitFor(`(() => { const d = document.querySelector('[role="dialog"]'); const l = d?.getAttribute('aria-label') ?? ''; return l === 'No problem found' || l === 'These names may not fit' || l === 'Haiku did not answer as asked' || /went wrong|could not|not found/i.test(d?.innerText ?? '') && l === 'Check the names of the steps?'; })()`, 150000, 500);
    return { title: await dialogTitle(), text: (await c.ev(`document.querySelector('[role="dialog"]')?.innerText ?? ''`)).replace(/\s+/g, " ") };
  };
  const closeDialog = async () => { await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await c.waitFor(`!document.querySelector('[role="dialog"]')`, 2000, 100); };
  const r1 = await runNames();
  note("names check on names that fit: " + r1.title + " | " + r1.text.slice(0, 260));
  ok("a real call on a journey whose names fit finds no problem", r1.title === "No problem found", r1.title);
  await closeDialog();
  put(".kona/mockups/photo-albums/home.html", "<!doctype html><title>h</title><h1>Contact us</h1><p>Your message</p><p>Your email</p><button>Send</button>");
  const r2 = await runNames();
  note("names check after the Your albums page was replaced by a contact form: " + r2.title + " | " + r2.text.slice(0, 300));
  ok("a real call finds the name that no longer fits its page, and names it", r2.title === "These names may not fit" && r2.text.includes("Your albums") && r2.text.includes("The page says:") && r2.text.includes("Contact us"), r2.title);
  await shot("journey-names");
  await closeDialog();

  // a kind of user dims what it cannot reach
  const pick = async (label, text) => {
    await c.ev(`document.querySelector('[role="combobox"][aria-label=${JSON.stringify(label)}]')?.click(); true`);
    await wait(250);
    const r = await c.ev(`(() => { const o = [...document.querySelectorAll('[role="listbox"] [role="option"]')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!o) return false; o.click(); return true; })()`);
    await wait(300);
    return r;
  };
  ok("a kind of user can be chosen", await pick("Who can see it", "Guest"));
  const dim = await c.ev(`({ home: document.querySelector('svg g[data-step="home"]').getAttribute('opacity'), signin: document.querySelector('svg g[data-step="sign-in"]').getAttribute('opacity') })`);
  ok("what a guest cannot reach is dimmed, and what it can reach is not", dim.home === "0.35" && dim.signin === "1", JSON.stringify(dim));
  await shot("journey-guest");
  await pick("Who can see it", "All kinds");

  // the big one: a real amount
  // the markers of the scan above belong to the project, so the other journey shows the two it does not know as drafts too: 120 steps and 2 drafts
  ok("the second journey is chosen from the picker (120 steps and the 2 drafts)", await pick("Journey", "Big journey") && await c.waitFor(`document.querySelectorAll('svg g[data-step]').length === 122`, 8000, 100), String(await boxes()));
  const big1 = await c.ev(`(() => { const s = document.querySelector('svg[role="img"]'); const r = s.getBoundingClientRect(); const g = document.querySelector('section[data-sheet] [role="group"][aria-label="Journey map"]'); return { w: Math.round(r.width), h: Math.round(r.height), edges: document.querySelectorAll('svg [data-edge]').length, groupH: Math.round(g.getBoundingClientRect().height) }; })()`);
  ok("120 steps are drawn with their lines and the map keeps to the window's height", big1.edges >= 119 && big1.groupH <= 800, JSON.stringify(big1));
  await shot("journey-big-fit");
  ok("Zoom in makes the map larger", await c.ev(`(() => { const w0 = document.querySelector('svg[role="img"]').getBoundingClientRect().width; [...document.querySelectorAll('section[data-sheet] button')].find((e) => e.getAttribute('aria-label') === 'Zoom in').click(); return true; })()`) && await (async () => { await wait(200); return c.ev(`document.querySelector('svg[role="img"]').getBoundingClientRect().width`); })() > big1.w);
  await c.ev(`[...document.querySelectorAll('section[data-sheet] button')].find((e) => e.getAttribute('aria-label') === 'Fit all of the map in the window').click(); true`);
  b = await box("s5");
  await clickAt(b.x, b.y);
  ok("a box of the big map opens too", await c.waitFor(`document.querySelector('[role="dialog"]')?.getAttribute('aria-label')?.startsWith('Step number 5')`, 3000, 100));
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await c.waitFor(`!document.querySelector('[role="dialog"]')`, 2000, 100);
  const bigTable = await c.ev(`document.querySelectorAll('section[data-sheet] table tbody tr').length`);
  ok("the table of the big journey has all 120 rows", bigTable === 120, String(bigTable));
  // a journey note with a mistake in it says so, and offers the note
  ok("a journey note with a mistake says it cannot be read", await pick("Journey", "C broken") && await c.waitFor(`document.querySelector('section[data-sheet]').innerText.includes('cannot be read')`, 3000, 100), (await c.ev(`(document.querySelector('section[data-sheet]').innerText.match(/cannot be read[^\\n]*/) ?? [''])[0]`)));
  ok("Open the note goes to the Notes page", await c.ev(`(() => { const x = [...document.querySelectorAll('section[data-sheet] button')].find((e) => e.textContent.trim() === 'Open the note'); if (!x) return false; x.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet] [role="tab"][aria-selected="true"]')?.textContent.trim() === 'Notes'`, 3000, 100));
  await c.ev(`[...document.querySelectorAll('section[data-sheet] [role="tab"]')].find((b) => b.textContent.trim() === 'Journey').click(); true`);
  await c.waitFor(`document.querySelectorAll('svg g[data-step]').length > 0`, 5000, 100);
  // a narrow window: the controls wrap and nothing runs off the page
  let narrowOk = null;
  try {
    const w = await c.send("Browser.getWindowForTarget");
    const was = (await c.send("Browser.getWindowBounds", { windowId: w.result.windowId })).result.bounds;
    await c.send("Browser.setWindowBounds", { windowId: w.result.windowId, bounds: { windowState: "normal" } });
    await c.send("Browser.setWindowBounds", { windowId: w.result.windowId, bounds: { width: 760, height: 640 } });
    await wait(600);
    narrowOk = await c.ev(`(() => { const m = document.querySelector('section[data-sheet] main') ?? document.querySelector('section[data-sheet]'); const s = document.querySelector('section[data-sheet]'); return s.scrollWidth <= s.clientWidth + 1; })()`);
    await shot("journey-narrow");
    ok("in a narrow window the page does not scroll sideways (the map scrolls inside its own box)", !!narrowOk, "");
    await c.send("Browser.setWindowBounds", { windowId: w.result.windowId, bounds: { windowState: "maximized" } });
  } catch (e) { note("SKIP the narrow window could not be set: " + String(e).slice(0, 120)); }
  await pick("Journey", "A photo albums");
  await c.ev(`document.querySelector('section button[aria-label^="Close"]').click(); true`);
  ok("the Brain closes with the X button", await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100));

  // ---- the Mockups card that reads the journey ----
  await c.ev(`window.__jr = null; window.__fetches = null; window.addEventListener('message', (e) => { const f = document.querySelector('iframe[title]'); if (!f || e.source !== f.contentWindow || !e.data) return; if (e.data.test === 'journey') window.__jr = e.data; if (e.data.test === 'fetches') window.__fetches = e.data; }); true`);
  ok("the Mockups sheet opens", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Mockups"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Mockups'`, 5000, 100));
  await wait(1200);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open Photo albums"]')?.click(); true`);
  ok("the card that names the journey opens a page in the sandboxed frame", await c.waitFor(`!!document.querySelector('iframe[title]')`, 5000, 100));
  ok("the page drew the journey from the note: 6 boxes in 3 lanes, a title from the note", await c.waitFor(`!!window.__jr`, 8000, 150) && await c.ev(`window.__jr.steps === 6 && window.__jr.lanes === 3 && window.__jr.title === 'Photo albums'`), JSON.stringify(await c.ev(`window.__jr`)));
  const jr = await c.ev(`window.__jr`);
  ok("a box starts closed and opens on a click, with the screen's fields, buttons and errors", jr?.before === "false" && jr?.opened?.expanded === "true" && jr?.opened?.shown === true && jr.opened.text.includes("Email") && jr.opened.text.includes("Wrong email or password"), JSON.stringify(jr?.opened)?.slice(0, 200));
  ok("the kinds of user are in the page's picker (all, guest, member)", jr?.kinds === 3, String(jr?.kinds));
  await shot("journey-mockup-page");
  // the fixed address answers, nothing beside it does, the way out of the card stays shut and the web stays shut
  ok("the page's fetches were reported", await c.waitFor(`!!window.__fetches`, 8000, 150));
  const f = await c.ev(`window.__fetches`);
  ok("the journey address answers 200 from inside the sandbox", f?.journey === 200 && f?.sameCard === 200, JSON.stringify(f));
  ok("a similar address does not (404), a way out of the card does not (400, 403 or 404), and the web is blocked", f?.other === 404 && [400, 403, 404].includes(f?.escape) && f?.web === "blocked", JSON.stringify(f));
  // the page reads the note again at Start again: change the note on disk and refresh
  const noteFile = path.join(proj, ".kona", "brain", "photo-albums.md");
  fs.writeFileSync(noteFile, fs.readFileSync(noteFile, "utf8").replace('"title": "Photo albums"', '"title": "Photo albums changed"'));
  await c.ev(`window.__jr = null; true`);
  ok("Start again puts the page back to its beginning", await c.ev(`(() => { const b = document.querySelector('section[data-sheet] button[aria-label="Start the page again"]'); if (!b) return false; b.click(); return true; })()`));
  ok("the page shows the changed note, with nothing copied", await c.waitFor(`!!window.__jr && window.__jr.title === 'Photo albums changed'`, 8000, 150), JSON.stringify(await c.ev(`window.__jr`))?.slice(0, 120));
} finally {
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === id) await invoke("remove_project", { id: p.id }); } catch (e) { note("could not remove the project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
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
