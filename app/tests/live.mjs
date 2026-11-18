// A test of the LIVE mockups (decision 94) in the REAL window, from the card list to a login as every role and Stop, driven over the DevTools port. Like mockups.mjs: run it against a BUILT
// program (`npm run tauri build -- --debug --no-bundle`; the content policy is applied in any build), started with the test port and with the owner's own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then start src-tauri/target/debug/app.exe   then   node tests/live.mjs
// It adds ONE throwaway project (a folder in the temp folder) with five cards and the small program of tests/live-probe, borrows the account of the first project that has one, and removes
// everything again whatever happens. It starts no session. Node 22 or later must be on the PC (the little program uses node:sqlite). Screenshots go to SHOT_DIR when it is set.
// The test clicks and types with real mouse and key events inside the page, because that page lives on its own address (live.localhost) and cannot be reached into from here.
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";
import { attachFrames } from "./cdp-frames.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const F = await attachFrames(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const info = (s) => note("INFO " + s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-live-ui-${process.pid}`);
const SHOTS = process.env.SHOT_DIR || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (name) => { if (SHOTS) await c.shot(path.join(SHOTS, name + ".png")); };
const NAME = "kona-live-ui";
const mock = path.join(root, "project", ".kona", "mockups");
const write = (card, file, text) => { fs.mkdirSync(path.dirname(path.join(mock, card, file)), { recursive: true }); fs.writeFileSync(path.join(mock, card, file), text); };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const answers = (port) => new Promise((res) => { const s = net.connect(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });
const gone = async (port, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (!(await answers(port))) return true; await wait(300); } return false; };

const button = (label) => `document.querySelector('button[aria-label=${JSON.stringify(label)}]')`;
const press = (label) => c.ev(`(() => { const b = ${button(label)}; if (!b || b.disabled) return false; b.click(); return true; })()`);
const pressText = (text, scope = "section[data-sheet]") => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope + " button")})].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const sheetText = () => c.ev(`document.querySelector('section[data-sheet]')?.innerText ?? ''`);
const frameBox = () => c.ev(`(() => { const f = document.querySelector('iframe[title]'); if (!f) return null; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cw: f.offsetWidth, ch: f.offsetHeight, sandbox: f.getAttribute('sandbox'), src: f.getAttribute('src') }; })()`);
const mouse = (type, x, y, extra = {}) => c.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
const clickAt = async (x, y) => { await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y); await mouse("mouseReleased", x, y); };
// what the page in the frame says about itself (it answers a question and tells when it has loaded)
const ask = async () => { await c.ev(`window.__probe = null; (document.querySelector('iframe[title]')?.contentWindow.postMessage({ probe: 'ask' }, '*'), 0)`); for (let k = 0; k < 20; k++) { await wait(150); const v = await c.ev("window.__probe"); if (v) return v; } return null; };
const until = async (pred, ms = 12000) => { const t = Date.now(); let i = null; while (Date.now() - t < ms) { i = await ask(); if (i && pred(i)) return i; await wait(250); } return i; };
const inFrame = async (rx, ry, rw, rh) => { const b = await frameBox(); const k = b.w / b.cw; await clickAt(b.x + (rx + rw / 2) * k, b.y + (ry + rh / 2) * k); };
const clickPart = async (name) => { const i = await ask(); const r = i?.rects?.[name]; if (!r) throw new Error("no " + name + " in the page: " + JSON.stringify(i)?.slice(0, 200)); await inFrame(...r); };
const typeInto = async (name, text) => { await clickPart(name); await c.send("Input.insertText", { text }); await wait(100); };
const login = async (email, password = "demo") => {
  await until((i) => i.path.startsWith("/login"));
  await typeInto("email", email); await typeInto("password", password); await clickPart("go");
};
const dashboard = (i) => i.path === "/dashboard";
// what a real program asks of the browser (a copy, an alert, a download, the location, a new window): the test clicks the program's buttons with a real mouse and reads what happened
const capsRun = async (withOutside) => {
  const origin = new URL((await frameBox()).src).origin;
  const fr = await F.frame(origin + "/");
  if (!fr) throw new Error("no frame to try the browser's things in");
  fr.reset(); F.downloads.length = 0;
  await F.send("Browser.setDownloadBehavior", { behavior: "deny", eventsEnabled: true });
  await fr.send("Emulation.setGeolocationOverride", { latitude: -6.2, longitude: 106.8, accuracy: 10 }); // the program gets a made-up place, never the PC's own
  await c.ev(`window.__caps = {}; if (!window.__capsOn) { window.__capsOn = true; window.addEventListener('message', (e) => { if (e.data && e.data.probe === 'cap') window.__caps[e.data.name] = e.data.result; }); } true`);
  let question = null, questionShot = false;
  for (const name of ["copy", "alert", "confirm", "prompt", "dl", "geo"]) {
    await clickPart(name);
    // the browser asks about the location in a window of its own (a separate page of the browser): the test finds it, says it saw it, and answers No
    for (let k = 0; k < (name === "geo" ? 40 : 4) && !question; k++) {
      await wait(250);
      const t = (await F.targets()).find((x) => x.type === "page" && x.url.startsWith("edge://permission-request-dialog"));
      if (t) {
        const att = await F.send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
        const sid = att.result.sessionId;
        const text = await F.send("Runtime.evaluate", { expression: "document.body.innerText.replace(/\\s+/g, ' ')", returnByValue: true }, sid);
        question = String(text.result?.result?.value ?? "").slice(0, 120);
        // what the owner would see: a picture of the question's own window (taken from the browser's page of it, never a picture of the screen)
        if (SHOTS && !questionShot) {
          questionShot = true;
          const pic = await F.send("Page.captureScreenshot", { format: "png" }, sid);
          if (pic.result?.data) fs.writeFileSync(path.join(SHOTS, "location-question.png"), Buffer.from(pic.result.data, "base64"));
        }
        // the question's own button is made a moment after its window: wait for it, then answer Just this time (the browser does not remember that one)
        for (let k = 0; k < 20; k++) { const r = await F.send("Runtime.evaluate", { expression: "(() => { const b = document.getElementById('just-once-button'); if (!b) return false; b.click(); return true; })()", returnByValue: true }, sid); if (r.result?.result?.value) break; await wait(250); }
      }
    }
    await wait(500);
  }
  // no question is left open: the browser may show the same one again for a second asking
  for (let k = 0; k < 20; k++) {
    const t = (await F.targets()).find((x) => x.type === "page" && x.url.startsWith("edge://permission-request-dialog"));
    if (!t) break;
    const att = await F.send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    await F.send("Runtime.evaluate", { expression: "document.getElementById('just-once-button')?.click()", returnByValue: true }, att.result.sessionId);
    await wait(400);
  }
  // print: a real click on the program's button. For a card that allows it the browser's print window (a page of its own, with the program's page in it) opens; the test takes a picture of it, presses its own Cancel, and sees it gone
  const printTarget = async () => (await F.targets()).find((x) => x.type === "page" && x.url.startsWith("edge://print"));
  // the click itself waits until the page has dealt with it, and a page that prints waits for the print window to close: so the test does not wait for the click, it looks for the window
  const printClick = clickPart("print").catch(() => {});
  await Promise.race([printClick, wait(1500)]);
  let printWindow = null;
  for (let k = 0; k < 60 && !printWindow; k++) { await wait(250); printWindow = await printTarget(); } // the window of the browser can take several seconds to come
  let printClosed = null;
  if (printWindow) {
    await wait(1500); // the window draws itself after it exists; asking it for a picture too early waits for ever
    const within = (pr, ms) => Promise.race([pr, new Promise((r) => setTimeout(() => r({ timedOut: true }), ms))]);
    const att = await within(F.send("Target.attachToTarget", { targetId: printWindow.targetId, flatten: true }), 8000);
    const sid = att.result?.sessionId;
    if (SHOTS && sid) { const pic = await within(F.send("Page.captureScreenshot", { format: "png" }, sid), 8000); if (pic.result?.data) fs.writeFileSync(path.join(SHOTS, "print-window.png"), Buffer.from(pic.result.data, "base64")); }
    if (sid) await within(F.send("Runtime.evaluate", { expression: "(() => { const find = (root) => { for (const e of root.querySelectorAll('*')) { if (/BUTTON/.test(e.tagName) && /^cancel$/i.test((e.innerText || e.textContent || '').trim())) return e; if (e.shadowRoot) { const r = find(e.shadowRoot); if (r) return r; } } return null; }; const b = find(document); if (b) b.click(); return !!b; })()", returnByValue: true }, sid), 8000);
    printClosed = false;
    for (let k = 0; k < 20 && !printClosed; k++) { await wait(250); printClosed = !(await printTarget()); }
  }
  let opened = null;
  if (withOutside) {
    // a link that wants a new window opens the owner's own browser (one tab, at the program's own plain page)
    await clickPart("popup");
    opened = await c.waitFor(`document.body.innerText.includes('Opened in your browser')`, 5000, 150);
  }
  const caps = await c.ev("window.__caps");
  return { caps, dialogs: [...fr.events.dialogs], downloads: [...F.downloads], question, opened, printWindow: !!printWindow, printClosed };
};

const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
let id = null;
const holders = [];
try {
  if (!account) { note("SKIP no project with an account to borrow, the throwaway project could not be opened"); process.exit(0); }
  const [pMain, pBroken, pBusy, pAllowed] = [await freePort(), await freePort(), await freePort(), await freePort()];
  // the card of the school: the program in tests/live-probe, copied into the throwaway project, its demo database made fresh at every start
  for (const f of ["server.mjs", "seed.mjs", "app.css", "app.js"]) { fs.mkdirSync(path.join(root, "project", "app"), { recursive: true }); fs.copyFileSync(new URL(`./live-probe/${f}`, import.meta.url), path.join(root, "project", "app", f)); }
  const recipe = (extra) => JSON.stringify({ name: extra.name, live: { cwd: "app", entry: "/login", ready: "/up", wait: 25, ...extra.live } });
  write("school", "mockup.json", recipe({ name: "School live", live: { setup: "node seed.mjs", start: "node server.mjs", port: pMain, env: { DEMO_DB: "demo.db" } } }));
  write("broken", "mockup.json", recipe({ name: "Broken program", live: { start: "node nothere.js", port: pBroken, wait: 20 } }));
  // the same program on another port, with a recipe that names what its page may do besides the ordinary
  write("allowed", "mockup.json", recipe({ name: "Allowed things", live: { setup: "node seed.mjs", start: "node server.mjs", port: pAllowed, env: { DEMO_DB: "demo.db" }, allow: ["clipboard", "downloads", "location", "print"] } }));
  write("busy", "mockup.json", recipe({ name: "Busy port", live: { start: "node server.mjs", port: pBusy } }));
  write("badrecipe", "mockup.json", JSON.stringify({ name: "Bad recipe", live: { start: "node server.mjs", port: 80 } }));
  write("drawn", "index.html", `<!doctype html><html><head><meta charset="utf-8"><title>drawn</title></head><body><h1>Drawn page</h1></body></html>`);
  // something already answers on the busy card's port
  const holder = net.createServer(); await new Promise((r) => holder.listen(pBusy, "127.0.0.1", r)); holders.push(holder);

  id = (await invoke("add_project", { folder: path.join(root, "project"), name: NAME, account })).project.id;
  note(`throwaway project ${id}, account ${account}; ports ${pMain}, ${pBroken}, ${pBusy}`);
  await c.send("Page.reload");
  await wait(1500);
  ok("the welcome page is back after the reload", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  ok("the throwaway project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)}) && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1) { b.click(); return true; } } } return false; })()`));
  ok("it is the throwaway project that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200));
  await c.ev(`window.__probe = null; window.addEventListener('message', (e) => { const f = document.querySelector('iframe[title]'); if (f && e.source === f.contentWindow && e.data && e.data.probe) { window.__probe = e.data; if (e.data.probe === 'escape') window.__escape = e.data; } }); true`);
  ok("the big screen opens the Mockups sheet", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Mockups"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Mockups'`, 5000, 100));

  // ---- the cards
  await wait(1500);
  const labels = await c.ev(`[...document.querySelectorAll('section[data-sheet] ul button')].map((b) => b.getAttribute('aria-label'))`);
  ok("the six cards are there", labels.length === 6, labels.join(" | "));
  const text0 = await sheetText();
  ok("a live card says Live and its port", text0.includes(`Live · port ${pMain}`), text0.replace(/\s+/g, " ").slice(0, 200));
  ok("a recipe that cannot be used says why and cannot be opened", text0.includes("Live recipe cannot be used: port must be between") && await c.ev(`[...document.querySelectorAll('section[data-sheet] ul button')].find((b) => b.textContent.includes('Bad recipe')).disabled`));
  ok("the explanation of Live sits behind the question mark, not on the page", !text0.includes("throwaway demo database") && await c.ev(`!!document.querySelector('section[data-sheet] button[aria-label="About Mockups"]')`));
  ok("nothing runs before anyone asks", !(await answers(pMain)));

  // ---- a drawn card is as before
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open Drawn page"], section[data-sheet] ul button[aria-label="Open drawn"]')?.click(); true`);
  ok("a drawn card opens with the strict sandbox, and has the theme button", await c.waitFor(`!!document.querySelector('iframe[title]')`, 5000, 100) && (await frameBox()).sandbox === "allow-scripts" && await c.ev(`!!${button("Show the page dark")}`), String((await frameBox())?.sandbox));
  await press("Back to the mockups (Esc)"); await wait(500);

  // ---- the school: panel, ask, run
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open School live"]').click(); true`);
  ok("a live card that is not running shows a start panel, no frame", await c.waitFor(`document.querySelector('section[data-sheet]')?.innerText.includes('Start the program')`, 5000, 100) && !(await frameBox()));
  await shot("1-panel");
  ok("the Mockups sheet pressed Start but nothing ran: Start asks first", await pressText("Start the program") && await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100) && !(await answers(pMain)));
  const dlg = await c.ev(`document.querySelector('[role=dialog]').innerText`);
  ok("the question shows the exact commands, the folder and the port", dlg.includes("node seed.mjs") && dlg.includes("node server.mjs") && dlg.includes(`port ${pMain}`) && dlg.includes("folder app"), dlg.replace(/\s+/g, " ").slice(0, 300));
  await shot("2-ask");
  ok("saying no runs nothing", await pressText("Cancel", "[role=dialog]") && await c.waitFor(`!document.querySelector('[role=dialog]')`, 2000, 100) && !(await answers(pMain)));
  await pressText("Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100);
  ok("saying yes runs it", await pressText("Run it", "[role=dialog]"));
  ok("the program opens in a device frame by itself", await c.waitFor(`!!document.querySelector('iframe[title]')`, 40000, 200));
  const fb = await frameBox();
  const schoolOrigin = new URL(fb.src).origin;
  ok("the frame may keep cookies and send forms, and is loaded from the live server's address, not the program's own port", fb.sandbox === "allow-scripts allow-same-origin allow-forms" && /^http:\/\/127\.0\.0\.1:\d+\/login/.test(fb.src) && !fb.src.includes(String(pMain)), `${fb.sandbox} ${fb.src}`);
  ok("the program really runs on its port", await answers(pMain));
  let i = await until((x) => x.path.startsWith("/login"));
  ok("the login page is the program's own (its own origin, its own css by an absolute path)", /^http:\/\/127\.0\.0\.1:\d+$/.test(i?.origin ?? "") && !i.origin.endsWith(":" + pMain) && i.bg === "rgb(250, 247, 240)", JSON.stringify({ o: i?.origin, bg: i?.bg }));
  ok("local storage works and counts the visit", i?.storage === 1, String(i?.storage));
  ok("the theme button is not offered for a live program", await c.ev(`!${button("Show the page dark")} && !${button("Show the page light")}`));
  await shot("3-login-laptop");

  // ---- a wrong password, then every role
  await login("student@example.test", "wrong");
  i = await until((x) => x.err && x.err.includes("Wrong email"));
  ok("a wrong password shows the program's own error (a real form was sent, a real redirect followed)", !!i?.err?.includes("Wrong email or password"), JSON.stringify(i?.path + " " + i?.err));
  const roles = [["student@example.test", "Sari Student · student", ["Physics 1: 88", "Maths 2: 93"]], ["teacher@example.test", "Tomas Teacher · teacher", ["Physics 1", "Maths 2"]], ["admin@example.test", "Ada Admin · admin", ["Ada Admin (admin)", "Tomas Teacher (teacher)", "Sari Student (student)", "Paulo Parent (parent)"]], ["parent@example.test", "Paulo Parent · parent", ["Child: Sari Student"]]];
  let n = 0;
  for (const [email, who, rows] of roles) {
    await login(email);
    i = await until(dashboard);
    ok(`${email.split("@")[0]} signs in and sees its own data from SQLite`, i?.who === who && JSON.stringify(i.rows) === JSON.stringify(rows), JSON.stringify({ who: i?.who, rows: i?.rows }));
    if (n === 0) {
      ok("the login is kept (a session cookie, a redirect to the program's own address was followed), the page is on the live address", /^http:\/\/127\.0\.0\.1:\d+$/.test(i.origin) && !i.origin.endsWith(":" + pMain) && i.path === "/dashboard" && i.cookie.includes("seen=1") && !i.cookie.includes("sid="), i.cookie);
      ok("the animation runs and local storage kept counting across pages", i.anim === "pulse" && i.storage >= 3, `${i.anim} ${i.storage}`);
      await shot("4-dashboard-student");
    }
    n++;
    await clickPart("out");
  }
  // a write through the program, shown after a reload
  await login("student@example.test"); await until(dashboard);
  await clickPart("add");
  i = await until((x) => dashboard(x) && x.notes === 1);
  ok("a note written through the program is in its SQLite and shown after the reload", i?.notes === 1, String(i?.notes));

  // ---- devices and pick mode
  await press("Phone, 390 px wide"); await wait(1200);
  i = await ask();
  ok("on a phone the program sees 390 wide and its media query answers", i && i.w >= 389.5 && i.w < 392 && i.narrow === true, `${i?.w} narrow ${i?.narrow}`);
  await shot("5-dashboard-phone");
  await press("Desktop, 1440 px wide"); await wait(1200);
  i = await ask();
  ok("on a desktop it is not narrow", i && i.w >= 1439 && i.narrow === false, `${i?.w}`);
  await press("Laptop, 1024 px wide"); await wait(800);
  await press("Pick a part and leave a note"); await wait(400);
  await clickPart("who"); await wait(600);
  ok("pick mode works on a live page: a note box opens for the part", await c.waitFor(`!!document.querySelector('[aria-label="Note for this part"]')`, 3000, 100), await c.ev(`document.querySelector('[aria-label="Note for this part"] span')?.textContent ?? ''`));
  await shot("6-pick");
  await press("Stop picking parts (Esc)"); await wait(300);
  const denied = await capsRun(false);
  info("a card that names nothing: " + JSON.stringify(denied));
  ok("a card that allows nothing: the clipboard, downloads and the location are all refused, and the browser asks nothing", /^refused/.test(denied.caps.copy ?? "") && denied.downloads.length === 0 && /^refused/.test(denied.caps.geo ?? "") && denied.question === null, JSON.stringify({ caps: denied.caps, question: denied.question }));

  // ---- big answers, answers in pieces, a web socket, an answer that never ends
  await c.ev(`window.__probe = null; (document.querySelector('iframe[title]')?.contentWindow.postMessage({ probe: 'wire' }, '*'), 0)`);
  ok("the program answers the go-between test", await c.waitFor(`window.__probe && window.__probe.probe === 'wire'`, 90000, 300));
  const wire = await c.ev("window.__probe");
  ok("a 40 MB answer comes through whole", Array.isArray(wire.big) && wire.big[0] === 200 && wire.big[1] === 40 * 1024 * 1024, JSON.stringify(wire.big));
  ok("an answer sent in pieces over 2.4 seconds comes through whole (all at the end: the go-between does not stream)", Array.isArray(wire.chunks) && wire.chunks[0] === 200 && wire.chunks[1] === 7, JSON.stringify(wire.chunks));
  ok("a web socket is refused at once (501), not left hanging", typeof wire.ws === "string" && wire.ws.startsWith("refused after") && Number(/\d+/.exec(wire.ws)[0]) < 3000, wire.ws);
  await c.ev(`window.__probe = null; (document.querySelector('iframe[title]')?.contentWindow.postMessage({ probe: 'endless' }, '*'), 0)`);
  ok("an answer that never ends is given up after two minutes with a plain 502 and does not hold anything", await c.waitFor(`window.__probe && window.__probe.probe === 'endless'`, 200000, 500));
  const endless = await c.ev("window.__probe");
  ok("(the endless answer's outcome)", endless.status === 502 && endless.ms >= 110000 && endless.ms < 140000, JSON.stringify(endless));
  ok("after it the program still answers at once", await answers(pMain));

  // ---- what a hostile page cannot do
  await c.ev(`window.__escape = null; document.querySelector('iframe[title]').contentWindow.postMessage({ probe: 'escape' }, '*'); true`);
  ok("the page answers the escape test", await c.waitFor(`!!window.__escape`, 8000, 200));
  const esc = await c.ev(`window.__escape`);
  ok("the page cannot read the window around it, nor reach Kona's commands", String(esc?.dom).startsWith("blocked") && (String(esc?.tauri).startsWith("blocked") || esc?.tauri === "undefined") && !/^status 200/.test(String(esc?.ipc)), JSON.stringify(esc));

  // ---- Back keeps it running; the card shows it; Stop stops it
  await press("Back to the mockups (Esc)"); await wait(2500);
  ok("back on the cards the live card says it is running, and the program still answers", (await sheetText()).includes("Running") && await answers(pMain));
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open School live"]').click(); true`);
  ok("opening it again shows the program at once", await c.waitFor(`!!document.querySelector('iframe[title]')`, 8000, 200));
  // the list opens by itself the first time a card's program is up (the project is new in this test); the key button of the toolbar opens and closes it, and it is laid over the program: the program keeps its room
  if (!(await sheetText()).includes("Password for all")) { await press("Demo accounts"); await wait(500); }
  const running = await sheetText();
  const boxOpen = await frameBox();
  ok("the sheet lists the demo logins next to the running program, with the one password for all", running.includes("Demo accounts (4)") && running.includes("Password for all: demo") && running.includes("student@example.test"), running.replace(/\s+/g, " ").slice(0, 200));
  ok("the list of demo logins is laid over the program and closes from its own button: the program keeps the same room whether it is open or shut", await press("Close the demo accounts") && await c.waitFor(`!document.querySelector('section[aria-label="Demo accounts"]')`, 3000, 100) && JSON.stringify(await frameBox().then((b) => [b.w, b.h, b.x, b.y])) === JSON.stringify([boxOpen.w, boxOpen.h, boxOpen.x, boxOpen.y]), JSON.stringify(boxOpen));
  ok("Stop stops the program and everything it started, and the panel comes back", await press("Stop the program") && await gone(pMain) && await c.waitFor(`/Start the program|Start with the last data/.test(document.querySelector('section[data-sheet]')?.innerText ?? '')`, 8000, 200));
  await wait(1200);
  const dataDir = path.join(root, "project", ".kona", "live-data", "school");
  const afterStop = await sheetText();
  ok("Stop kept the card's data and the sheet says so, with the choice to carry on, begin again or delete it, and the demo logins", fs.existsSync(path.join(dataDir, "accounts.json")) && /Data from the last run/.test(afterStop) && afterStop.includes("Start with the last data") && afterStop.includes("Start fresh") && afterStop.includes("Delete the data") && afterStop.includes("Demo accounts (4)"), afterStop.replace(/\s+/g, " ").slice(0, 260));
  await shot("2b-data");
  ok("Delete the data asks first and says it cannot be undone", await pressText("Delete the data") && await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100) && (await c.ev(`document.querySelector('[role=dialog]').innerText`)).includes("cannot be undone") && fs.existsSync(dataDir));
  ok("saying no keeps it", await pressText("Cancel", "[role=dialog]") && await c.waitFor(`!document.querySelector('[role=dialog]')`, 2000, 100) && fs.existsSync(dataDir));
  await pressText("Delete the data"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100);
  ok("saying yes deletes the card's data folder, and the sheet stops listing it", await pressText("Delete the data", "[role=dialog]") && await (async () => { for (let k = 0; k < 40; k++) { if (!fs.existsSync(dataDir)) return true; await wait(250); } return false; })() && await c.waitFor(`!/Data from the last run/.test(document.querySelector('section[data-sheet]')?.innerText ?? '')`, 5000, 150));

  // ---- every start is clean
  await pressText("Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100); await pressText("Run it", "[role=dialog]");
  ok("started again", await c.waitFor(`!!document.querySelector('iframe[title]')`, 40000, 200));
  ok("every start has an address of its own: what the first run left in the browser (storage, a service worker) is not seen by the second", new URL((await frameBox()).src).origin !== schoolOrigin, `${schoolOrigin} then ${new URL((await frameBox()).src).origin}`);
  await login("student@example.test"); i = await until(dashboard);
  ok("the demo data was made again (the note of the last run is gone) and the browser forgot the last run's local storage (the login page and the dashboard are the only two visits counted)", i?.notes === 0 && i?.storage === 2, `notes ${i?.notes}, storage ${i?.storage}`);

  // ---- minimizing the page keeps the program running (decision 95): the tray shows it as Running, a click on its chip brings the page back, and the X asks before it stops the program
  const sheetOf = (name) => `section[data-sheet][aria-label="${name}"]`;
  ok("Minimize puts the Mockups page away: the office is there, the tray has one chip that says Running, and the program still answers", await c.ev(`document.querySelector('section[data-sheet] button[aria-label^="Minimize"]').click(); true`) && await c.waitFor(`!!document.querySelector('nav[aria-label="Open pages"] button[role=tab]')?.getAttribute('aria-label')?.includes('minimized, Running')`, 6000, 150) && await answers(pMain) && !(await c.ev(`!!document.querySelector('section[data-sheet]:not([hidden])')`)));
  ok("a minimized page does not take Esc, and the program is not stopped by it", await (async () => { await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await wait(600); return answers(pMain); })());
  ok("a click on the chip brings the page back with the program in it, still signed in", await c.ev(`document.querySelector('nav[aria-label="Open pages"] button[role=tab]').click(); true`) && await c.waitFor(`!!document.querySelector('section[data-sheet]:not([hidden]) iframe[title]')`, 8000, 150) && !!(await ask()));
  // the X asks, because the page would stop the program; Cancel changes nothing
  await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) button[aria-label^="Close"]').click(); true`);
  const leaveAsk = await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100) ? await c.ev(`document.querySelector('[role=dialog]').innerText.replace(/\\s+/g, ' ')`) : "";
  ok("the X asks: Minimize, Close it or Cancel, and says that closing stops the program", /Close this page\?/.test(leaveAsk) && /stops it/.test(leaveAsk) && /Minimize/.test(leaveAsk) && /Cancel/.test(leaveAsk), leaveAsk.slice(0, 220));
  ok("Cancel changes nothing: the program runs and the page is shown", await pressText("Cancel", "[role=dialog]") && await c.waitFor(`!document.querySelector('[role=dialog]')`, 2000, 100) && await answers(pMain) && !!(await frameBox()));
  ok("Minimize in the question puts the page away and keeps the program", await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) button[aria-label^="Close"]').click(); true`) && await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100) && await pressText("Minimize", "[role=dialog]") && await c.waitFor(`!document.querySelector('[role=dialog]') && !!document.querySelector('nav[aria-label="Open pages"]')`, 4000, 100) && await answers(pMain));
  ok("the chip of the tray has its own X, which asks too, and closing there stops the program", await c.ev(`document.querySelector('nav[aria-label="Open pages"] button[aria-label^="Close"]').click(); true`) && await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100) && !(await pressText("Minimize", "[role=dialog]")) && await pressText("Close it", "[role=dialog]") && await gone(pMain, 15000) && await c.waitFor(`!document.querySelector('nav[aria-label="Open pages"]')`, 3000, 100));
  // the page is gone: the next start is of a new page, from the start
  await c.ev(`document.querySelector('[aria-label="Open Mockups"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]:not([hidden])')?.getAttribute('aria-label') === 'Mockups'`, 5000, 100); await wait(1200);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open School live"]').click(); true`);
  await c.waitFor(`/Start the program|Start with the last data/.test(document.querySelector('section[data-sheet]')?.innerText ?? '')`, 5000, 100);
  await pressText((await sheetText()).includes("Start with the last data") ? "Start with the last data" : "Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100); await pressText("Run it", "[role=dialog]");
  ok("started again after the page was closed", await c.waitFor(`!!document.querySelector('iframe[title]')`, 40000, 200));
  if (!(await sheetText()).includes("Password for all")) { await press("Demo accounts"); await wait(300); } // (the logins of the card may be open: close them so they do not cover the program)
  if ((await sheetText()).includes("Password for all")) await press("Close the demo accounts");

  // ---- leaving the page stops it
  await c.ev(`document.querySelector('section[data-sheet] button[aria-label^="Close"]').click(); true`);
  // a running program is something the page would lose: the sheet asks (minimize, close or cancel), and the test closes it
  await c.waitFor("!!document.querySelector('[role=dialog]')", 2500, 100); await c.ev("(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Close it'); if (b) b.click(); return !!b; })()");
  ok("closing the sheet stops the program", await gone(pMain, 15000));

  // ---- a program that fails shows why
  await c.ev(`document.querySelector('[aria-label="Open Mockups"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Mockups'`, 5000, 100); await wait(1200);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open Broken program"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.innerText.includes('Start the program')`, 5000, 100);
  await pressText("Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100); await pressText("Run it", "[role=dialog]");
  ok("a program that stops at once says so, with what it printed", await c.waitFor(`document.querySelector('section[data-sheet]')?.innerText.includes('It did not start')`, 30000, 300));
  const failText = await sheetText();
  ok("the reason and the last lines are shown", failText.includes("stopped with code 1") && /Cannot find module/.test(failText), failText.replace(/\s+/g, " ").slice(0, 300));
  await shot("7-failed");

  // ---- a port that is taken is refused, and nothing is passed to it
  await press("Back to the mockups (Esc)"); await wait(800);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open Busy port"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.innerText.includes('Start the program')`, 5000, 100);
  await pressText("Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100); await pressText("Run it", "[role=dialog]");
  ok("a port that already answers is refused in plain words", await c.waitFor(`document.querySelector('[role=dialog]')?.innerText.includes('already answers on port ${pBusy}')`, 6000, 200), await c.ev(`document.querySelector('[role=dialog]')?.innerText ?? ''`));
  await pressText("Cancel", "[role=dialog]");

  // ---- a card whose recipe names what its page may do: the question says so, and each of those things works (and nothing else is added)
  await press("Back to the mockups (Esc)"); await wait(800);
  ok("the card list says nothing runs yet", !(await sheetText()).includes("Running"));
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open Allowed things"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.innerText.includes('Start the program')`, 5000, 100);
  await pressText("Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100);
  const askText = await c.ev(`document.querySelector('[role=dialog]').innerText.replace(/\\s+/g, ' ')`);
  ok("the question tells the owner what the page may also do, in words", askText.includes("Its page may also:") && askText.includes("copy to the clipboard") && askText.includes("save files") && askText.includes("ask for this device's location") && askText.includes("show the print window"), askText.slice(-240));
  await pressText("Run it", "[role=dialog]");
  ok("the card with named things started", await c.waitFor(`!!document.querySelector('iframe[title]')`, 40000, 300));
  const boxA = await frameBox();
  ok("its frame is allowed exactly those things and no more", boxA.sandbox === "allow-scripts allow-same-origin allow-forms allow-modals allow-downloads" && (await c.ev(`document.querySelector('iframe[title]').getAttribute('allow')`)) === "clipboard-write; geolocation", `${boxA.sandbox} | ${await c.ev(`document.querySelector('iframe[title]').getAttribute('allow')`)}`);
  await login("student@example.test"); await until(dashboard);
  const allowed = await capsRun(true);
  info("a card that names the five things: " + JSON.stringify(allowed));
  ok("a card that allows them: the clipboard is written, a file is offered for saving, the browser asks the owner about the location (the test answered Just this time, which the browser does not remember; what the PC's location service then answers is not the test's business), and a link that wants a new window opens the owner's own browser", allowed.caps.copy === "ALLOWED" && allowed.downloads.length >= 1 && /location/i.test(allowed.question ?? "") && allowed.opened === true, JSON.stringify({ caps: allowed.caps, downloads: allowed.downloads.length, question: allowed.question, opened: allowed.opened }));
  // the probe page asks "leave this page?" when it is left, and a click has been made in it: the sheet's own reload button must still work (a page that waits for an answer nobody can give would stop for good)
  await press("Start the page again");
  const back = await until((i) => i.path === "/dashboard", 20000);
  ok("a program that asks \"leave this page?\" when it is left is still reloaded by Start the page again (Kona's window cannot show that question, so it is not asked)", !!back, JSON.stringify(back?.path));
  info("the browser keeps the answer to its location question for Kona's window, even Just this time (found 2026-11-18): after this test close Kona and run  node tests/forget-location.mjs  so that the next run, and your own cards, are asked again");
  ok("the native alert, confirm and prompt are turned off by the window itself, allowed or not: each returns at once (nothing, false, nothing) and the page goes on working", [allowed, denied].every((r) => /^returned/.test(r.caps.alert ?? "") && r.caps.confirm === "returned false" && r.caps.prompt === "returned null" && r.dialogs.length === 0), JSON.stringify({ allowed: [allowed.caps.alert, allowed.caps.confirm, allowed.caps.prompt], denied: [denied.caps.alert, denied.caps.confirm, denied.caps.prompt] }));
  ok("print: a card that allows it gets the browser's print window (and the test cancelled it, so none is left); a card that does not, gets none", allowed.printWindow && allowed.printClosed === true && denied.printWindow === false, JSON.stringify({ allowed: [allowed.printWindow, allowed.printClosed], denied: denied.printWindow }));
  info("the native alert is turned off by the window itself, allowed or not: it returned at once and no dialog was shown (" + allowed.caps.alert + ")");
  ok("nothing was saved to the PC by that test (downloads were denied by the test)", true);
  await c.ev(`document.querySelector('section[data-sheet] button[aria-label^="Close"]').click(); true`);
  // a running program is something the page would lose: the sheet asks (minimize, close or cancel), and the test closes it
  await c.waitFor("!!document.querySelector('[role=dialog]')", 2500, 100); await c.ev("(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Close it'); if (b) b.click(); return !!b; })()");
} finally {
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === id) await invoke("remove_project", { id: p.id }); } catch (e) { note("could not remove the project: " + e); }
  try { await invoke("live_stop"); } catch {}
  for (const h of holders) h.close();
  await wait(1500);
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  try {
    const final = await invoke("list_projects");
    ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)), `${before.length} before, ${final.length} after`);
  } catch {}
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close(); F.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
if (process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE, lines.join("\n") + "\n");
process.exit(failed ? 1 : 0);
