// A test of the Mockups sheet in the REAL window (tickets T-0016 and T-0017), driven over the DevTools port. Run it against a BUILT program (`npm run tauri build -- --debug --no-bundle`
// is enough: the content policy is applied in any build), started with the test port and with the owner's own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then start src-tauri/target/debug/app.exe   then   node tests/mockups.mjs
// It adds ONE throwaway project (a folder in the temp folder) to the project list, with the account of the first project that has one (it needs a signed-in account to open), reloads
// the test window, works through the sheet, and removes the project and the folder again whatever happens. It starts no session. Never run it on a window the owner has open.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";
import { STANDARD } from "../src/office/map.ts";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };

const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-mockups-ui-${process.pid}`);
const NAME = "kona-mock-ui";
const mock = path.join(root, "project", ".kona", "mockups");
const write = (card, file, text) => { fs.mkdirSync(path.dirname(path.join(mock, card, file)), { recursive: true }); fs.writeFileSync(path.join(mock, card, file), text); };

const PAGE_JS = `
const el = (id) => document.getElementById(id), rect = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
const info = () => ({ test: 'info', w: innerWidth, h: innerHeight, vh: el('tall').getBoundingClientRect().height, vw: el('wide').getBoundingClientRect().width, narrow: matchMedia('(max-width: 480px)').matches, darkMq: matchMedia('(prefers-color-scheme: dark)').matches,
  theme: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor, field: el('name') ? el('name').value : null, version: document.title, page: location.pathname.split('/').pop(),
  dpr: devicePixelRatio, vv: [visualViewport.width, visualViewport.height], cw: document.documentElement.clientWidth, ch: document.documentElement.clientHeight, link: el('go') ? rect(el('go')) : null, input: el('name') ? rect(el('name')) : null });
const say = () => parent.postMessage(info(), '*');
addEventListener('load', say); addEventListener('resize', say);
new MutationObserver(say).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
addEventListener('message', (e) => { if (e.source === parent && e.data && e.data.test === 'ask') say(); });
`;
const css = `body { margin: 0; background: #fff; color: #111; font: 16px sans-serif; } h1 { margin: 12px; }
@media (prefers-color-scheme: dark) { body { background: #202020; color: #eee; } }
[data-theme="dark"] body { background: #202020; color: #eee; }
@media (max-width: 480px) { h1 { font-size: 40px; } }
#tall { position: absolute; left: -9999px; width: 1px; height: 100vh; } #wide { position: absolute; left: -9999px; height: 1px; width: 100vw; }`;
const html = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="style.css"></head><body><div id="tall"></div><div id="wide"></div>${body}<script src="app.js"></script></body></html>`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frameInfo = async (ask = true) => { if (ask) await c.ev(`(document.querySelector('iframe[title]')?.contentWindow.postMessage({ test: 'ask' }, '*'), 0)`); await wait(250); return c.ev("window.__last || null"); };
const button = (label) => `document.querySelector('button[aria-label=${JSON.stringify(label)}]')`;
const press = (label) => c.ev(`(() => { const b = ${button(label)}; if (!b || b.disabled) return false; b.click(); return true; })()`);
const pressed = (label) => c.ev(`${button(label)}?.getAttribute('aria-pressed')`);
const percentNow = () => c.ev(`Number((document.querySelector('[aria-label^="Zoom "][aria-label$=" percent"]')?.textContent ?? '').replace('%', ''))`);
const frameBox = () => c.ev(`(() => { const f = document.querySelector('iframe[title]'); if (!f) return null; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cw: f.offsetWidth, ch: f.offsetHeight, sandbox: f.getAttribute('sandbox') }; })()`);
const mouse = (type, x, y, extra = {}) => c.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
const clickAt = async (x, y) => { await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y); await mouse("mouseReleased", x, y); };
const idle = (ms = 400) => wait(ms);

const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
let id = null;
try {
  if (!account) { note("SKIP no project with an account to borrow, the throwaway project could not be opened"); process.exit(0); }
  // the throwaway project: cards of a mockup site, a card with no start page, a long name and a real amount of cards
  write("site", "index.html", html("v1", `<h1 id="h">Home</h1><a id="go" href="about.html">About</a> <input id="name" placeholder="type here"> <button id="btn">Go</button>`));
  write("site", "about.html", html("about", `<h1>About</h1><a id="go" href="index.html">Home</a>`));
  write("site", "style.css", css); write("site", "app.js", PAGE_JS);
  write("nostart", "readme.txt", "no index.html here");
  write("a-mockup-with-a-very-long-name-that-goes-on-and-on-and-on-and-on-and-on-and-on", "index.html", html("long", `<h1>Long</h1>`));
  write("a-mockup-with-a-very-long-name-that-goes-on-and-on-and-on-and-on-and-on-and-on", "style.css", css); write("a-mockup-with-a-very-long-name-that-goes-on-and-on-and-on-and-on-and-on-and-on", "app.js", PAGE_JS);
  for (let i = 1; i <= 30; i++) write(`many-${String(i).padStart(2, "0")}`, "index.html", html("many", `<h1>${i}</h1>`));
  // a card with a video (MOCK_TEST_VIDEO names a file; it is copied into the throwaway project and never changed)
  const VIDEO = process.env.MOCK_TEST_VIDEO && fs.existsSync(process.env.MOCK_TEST_VIDEO) ? process.env.MOCK_TEST_VIDEO : null;
  if (VIDEO) {
    write("video", "index.html", `<!doctype html><html><head><meta charset="utf-8"><title>video</title><style>body{margin:0;background:#000}video{width:100%;display:block}</style></head><body><video id="v" src="clip.mp4" muted playsinline loop></video><script src="app.js"></script></body></html>`);
    write("video", "app.js", `const v = document.getElementById('v'); const say = (what, extra = {}) => parent.postMessage({ test: 'vid', what, t: v.currentTime, duration: v.duration, w: v.videoWidth, h: v.videoHeight, ready: v.readyState, error: v.error ? v.error.code + ' ' + v.error.message : null, paused: v.paused, ...extra }, '*');
v.addEventListener('loadedmetadata', () => say('metadata')); v.addEventListener('playing', () => say('playing')); v.addEventListener('seeked', () => say('seeked')); v.addEventListener('error', () => say('error'));
addEventListener('message', (e) => { if (e.source !== parent || !e.data) return; if (e.data.test === 'seek') v.currentTime = e.data.t; if (e.data.test === 'ask') say('ask'); });
v.play().catch((e) => say('playfailed', { why: String(e) }));`);
    fs.copyFileSync(VIDEO, path.join(mock, "video", "clip.mp4"));
  }
  // an OLD saved office, from before the big screen: the standard office without it
  const old = structuredClone(STANDARD);
  old.objects = old.objects.filter((o) => o.kind !== "big screen");
  fs.mkdirSync(path.join(root, "project", ".kona"), { recursive: true });
  fs.writeFileSync(path.join(root, "project", ".kona", "office-map.json"), JSON.stringify(old));

  id = (await invoke("add_project", { folder: path.join(root, "project"), name: NAME, account })).project.id;
  note(`throwaway project ${id}, account ${account}`);
  await c.send("Page.reload");
  await wait(1500);
  ok("the welcome page is back after the reload", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  // the card of the throwaway project: the nearest ancestor of an Open button that names the project AND holds exactly one Open button (never the list around all the cards, never another project)
  ok("the throwaway project is on the welcome page and opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if (n.querySelectorAll('button').length && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1 && !b.disabled) { b.click(); return true; } break; } } } return false; })()`));
  ok("it is the throwaway project that is open (not another one)", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200), await c.ev(`document.querySelector('header')?.innerText ?? ''`));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200));

  // T-0017: the old office got the big screen back, and it opens the sheet
  const names = await c.ev(`[...document.querySelectorAll('[aria-label^="Open "]')].map((e) => e.getAttribute('aria-label'))`);
  ok("an old saved office got the big screen back (a piece that opens the Mockups)", names.includes("Open Mockups"), names.filter((n) => /mock|screen/i.test(n)).join());
  ok("a notice says it was put back", await c.waitFor(`document.body.innerText.includes('put back')`, 4000, 100), (await c.ev(`document.body.innerText`)).replace(/\s+/g, " ").slice(0, 200));
  const screenName = "Open Mockups";
  await c.ev(`window.__msgs = []; window.__last = null; window.__kona = []; window.addEventListener('message', (e) => { const f = document.querySelector('iframe[title]'); if (f && e.source === f.contentWindow && e.data && e.data.test) { window.__msgs.push(e.data); window.__last = e.data; } if (f && e.source === f.contentWindow && e.data && e.data.kona) window.__kona.push(e.data.kona); }); true`);
  ok("the big screen opens the Mockups sheet", await c.ev(`(() => { const e = document.querySelector('[aria-label=${JSON.stringify(screenName)}]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Mockups'`, 5000, 100));

  // the cards
  await idle(1500);
  note("sheet says: " + (await c.ev(`document.querySelector('section[data-sheet]')?.innerText ?? ''`)).replace(/\s+/g, " ").slice(0, 300));
  const cardLabels = await c.ev(`[...document.querySelectorAll('section[data-sheet] ul button')].map((b) => b.getAttribute('aria-label'))`);
  ok(`all the cards are there (${VIDEO ? 34 : 33})`, cardLabels.length === (VIDEO ? 34 : 33), String(cardLabels.length));
  ok("a card with no start page says so and cannot be opened", cardLabels.includes("nostart: no start page") && await c.ev(`[...document.querySelectorAll('section[data-sheet] ul button')].find((b) => b.getAttribute('aria-label') === 'nostart: no start page').disabled`));
  ok("a long name does not break the card (it is cut)", await c.ev(`(() => { const b = [...document.querySelectorAll('section[data-sheet] ul button')].find((x) => x.getAttribute('aria-label').startsWith('Open a-mockup-with')); const s = b.querySelector('span'); return s.scrollWidth > s.clientWidth && b.getBoundingClientRect().width < 400; })()`));
  ok("the explanation sits behind the round question mark, not on the page", await c.ev(`!!document.querySelector('section[data-sheet] button[aria-label="About Mockups"]') && !document.querySelector('section[data-sheet] main').innerText.includes('plain web files')`));
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open site"]').click(); true`);
  ok("the card opens a page in a frame", await c.waitFor(`!!document.querySelector('iframe[title="site"]')`, 5000, 100));
  let box = await frameBox();
  ok("the frame is sandboxed with allow-scripts only", box?.sandbox === "allow-scripts", String(box?.sandbox));
  await idle(1200);
  let info = await frameInfo(false);
  ok("the page is running (it told the sheet about itself)", !!info && info.version === "v1", JSON.stringify(info)?.slice(0, 120));

  // devices: the page sees the size of the DEVICE, never of the window
  // on a screen scaled to a fraction (120 percent on this PC) the page's viewport is a whole number of SCREEN pixels: it sees the device's size or at most one CSS pixel more, never less
  const sizeOf = async (label, w, h) => {
    await press(label); await idle(700); const i = await frameInfo(); const b = await frameBox();
    const exact = Math.abs((i?.dpr ?? 1) * w - Math.round((i?.dpr ?? 1) * w)) < 1e-6 && Math.abs((i?.dpr ?? 1) * h - Math.round((i?.dpr ?? 1) * h)) < 1e-6;
    const tol = 2 / (i?.dpr ?? 1); // two screen pixels
    const seen = i && i.vw >= w - 0.02 && i.vw < w + tol && i.vh >= h - 0.02 && i.vh < h + tol && i.w >= w - 1 && i.w <= w + tol && i.h >= h - 1 && i.h <= h + tol;
    ok(`${label.split(",")[0]}: the page sees ${w} x ${h} (never less, at most two screen pixels more), whatever the window is`, !!seen && (!exact || (Math.abs(i.vw - w) < 0.02 && Math.abs(i.vh - h) < 0.02)), `viewport ${i?.vw?.toFixed(2)} x ${i?.vh?.toFixed(2)}, innerWidth ${i?.w} x ${i?.h}, dpr ${i?.dpr}, frame ${b?.cw} x ${b?.ch}`);
    return i;
  };
  await sizeOf("Laptop, 1024 px wide", 1024, 640);
  let i2 = await sizeOf("Phone, 390 px wide", 390, 844);
  ok("a media query follows the device (narrow on a phone), and 100vh is the device's height", i2?.narrow === true && i2?.vh >= 844 - 0.02 && i2?.vh < 845, `narrow ${i2?.narrow}, 100vh ${i2?.vh}`);
  await sizeOf("Small phone, 320 px wide", 320, 568);
  await sizeOf("Tablet, 768 px wide", 768, 1024);
  i2 = await sizeOf("Desktop, 1440 px wide", 1440, 900);
  ok("a wide device is not narrow", i2?.narrow === false);
  await press("Phone, 390 px wide"); await idle(500);
  ok("rotate is offered for a phone", await c.ev(`!!${button("Turn the device on its side")}`));
  await press("Turn the device on its side"); await idle(700);
  i2 = await frameInfo();
  ok("turned on its side the page sees 844 x 390", i2?.vw >= 844 - 0.02 && i2?.vw < 845 && i2?.vh >= 390 - 0.02 && i2?.vh < 391 && (await pressed("Stand the device up again")) === "true", `${i2?.vw} x ${i2?.vh}`);
  await press("Laptop, 1024 px wide"); await idle(500);
  ok("rotate stays in place but is disabled for a laptop", await c.ev(`!${button("Turn the device on its side")} && !${button("Stand the device up again")} && ${button("A laptop does not turn on its side")}?.disabled === true`));
  await press("Phone, 390 px wide"); await idle(500);
  ok("the turn is remembered for the next phone", await c.ev(`!!${button("Stand the device up again")}`));
  await press("Stand the device up again"); await idle(400);

  // fit and zoom
  await press("Laptop, 1024 px wide"); await idle(700);
  box = await frameBox();
  const room = await c.ev(`(() => { const r = document.querySelector('section[data-sheet] .overflow-auto').getBoundingClientRect(); return { w: r.width, h: r.height }; })()`);
  const fitPct = await percentNow();
  ok("it opens fitted: the whole device is inside the room and not bigger than true size", box.w <= room.w && box.h <= room.h && fitPct <= 100, `frame ${Math.round(box.w)} x ${Math.round(box.h)} in ${Math.round(room.w)} x ${Math.round(room.h)}, ${fitPct}%`);
  ok("zoom out and fit are off while fitted", await c.ev(`${button("Zoom out (Ctrl and the mouse wheel)")}.disabled && ${button("Fit the device to the sheet")}.disabled`));
  await press("Zoom in (Ctrl and the mouse wheel)"); await idle(300);
  const p1 = await percentNow();
  ok("the zoom button zooms in", p1 > fitPct, `${fitPct}% to ${p1}%`);
  ok("the fit button is on after zooming", await c.ev(`!${button("Fit the device to the sheet")}.disabled`));
  for (let k = 0; k < 12; k++) await press("Zoom in (Ctrl and the mouse wheel)");
  await idle(300);
  ok("zoom stops at 200% of the true size", (await percentNow()) === 200 && await c.ev(`${button("Zoom in (Ctrl and the mouse wheel)")}.disabled`), String(await percentNow()));
  ok("the zoomed device can be moved by scrolling the sheet", await c.ev(`(() => { const e = document.querySelector('section[data-sheet] .overflow-auto'); return e.scrollWidth > e.clientWidth || e.scrollHeight > e.clientHeight; })()`));
  await press("Fit the device to the sheet"); await idle(300);
  ok("the fit button goes back to the fit", (await percentNow()) === fitPct);
  // Ctrl and the wheel over the sheet (outside the page) and over the page itself
  box = await frameBox();
  const rr = await c.ev(`(() => { const r = document.querySelector('section[data-sheet] .overflow-auto').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  await mouse("mouseWheel", rr.x + 12, rr.y + 12, { deltaX: 0, deltaY: -240, modifiers: 2 }); await idle(300);
  const p2 = await percentNow();
  ok("Ctrl and the wheel over the sheet zooms", p2 > fitPct, `${fitPct}% to ${p2}%`);
  await press("Fit the device to the sheet"); await idle(300);
  box = await frameBox();
  await mouse("mouseWheel", box.x + box.w / 2, box.y + box.h / 2, { deltaX: 0, deltaY: -240, modifiers: 2 }); await idle(400);
  const p3 = await percentNow();
  ok("Ctrl and the wheel over the page itself zooms (the helper passes it up)", p3 > fitPct, `${fitPct}% to ${p3}%`);
  await press("Fit the device to the sheet"); await idle(300);

  // light and dark
  i2 = await frameInfo();
  ok("the page starts light", i2?.theme === "light" && i2?.darkMq === false, `data-theme ${i2?.theme}, media query dark ${i2?.darkMq}, background ${i2?.bg}`);
  await press("Show the page dark"); await idle(700);
  i2 = await frameInfo();
  ok("the dark switch sets data-theme on the running page, without loading it again", i2?.theme === "dark" && i2?.bg === "rgb(32, 32, 32)", `data-theme ${i2?.theme}, background ${i2?.bg}`);
  note(`NOTE (to verify, not a failure): prefers-color-scheme in the frame follows the switch: ${i2?.darkMq}`);
  await press("Laptop, 1024 px wide");
  // the next page of the card follows the theme too: click the link inside the page
  box = await frameBox(); i2 = await frameInfo();
  const [lx, ly, lw, lh] = i2.link, sc = box.w / box.cw;
  await clickAt(box.x + (lx + lw / 2) * sc, box.y + (ly + lh / 2) * sc); await idle(900);
  i2 = await frameInfo();
  ok("a click in the page goes to its next page, which is dark too", i2?.page === "about.html" && i2?.theme === "dark", `page ${i2?.page}, data-theme ${i2?.theme}`);
  await press("Show the page light"); await idle(500);

  // start again resets a live form
  await press("Start the page again"); await idle(1200);
  i2 = await frameInfo();
  ok("start again goes back to the first page", i2?.page === "index.html", String(i2?.page));
  box = await frameBox(); const [ix, iy, iw, ih] = i2.input;
  await clickAt(box.x + (ix + iw / 2) * (box.w / box.cw), box.y + (iy + ih / 2) * (box.w / box.cw)); await idle(200);
  await c.send("Input.insertText", { text: "typed by the test" }); await idle(300);
  i2 = await frameInfo();
  ok("the page is live: text typed into its field stays", i2?.field === "typed by the test", String(i2?.field));
  await press("Start the page again"); await idle(1200);
  i2 = await frameInfo();
  ok("start again empties the live form", i2?.field === "", JSON.stringify(i2?.field));

  // the page loads again by itself when a file changes
  fs.writeFileSync(path.join(mock, "site", "index.html"), html("v2", `<h1 id="h">Home v2</h1><a id="go" href="about.html">About</a> <input id="name"> <button id="btn">Go</button>`));
  ok("a changed file loads the page again by itself", await c.waitFor(`window.__last && window.__last.version === 'v2'`, 12000, 300), String((await c.ev("window.__last"))?.version));

  // Esc: back one level, then the sheet closes; also when the page has the keyboard
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  ok("Esc in the mockup goes back to the cards", await c.waitFor(`!document.querySelector('iframe[title]') && !!document.querySelector('section[data-sheet] ul')`, 3000, 100));
  ok("Esc on the cards closes the sheet", await (async () => { await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); return c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100); })());
  await c.ev(`document.querySelector('[aria-label=${JSON.stringify(screenName)}]').click(); true`);
  await c.waitFor(`!!document.querySelector('section[data-sheet] ul button[aria-label="Open site"]')`, 5000, 100);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open site"]').click(); true`);
  await c.waitFor(`!!document.querySelector('iframe[title="site"]')`, 5000, 100); await idle(1200);
  box = await frameBox(); i2 = await frameInfo();
  await c.ev(`window.__keys = []; window.addEventListener('keydown', (e) => window.__keys.push(e.key + (e.isTrusted ? ' real' : ' synthetic')), true); true`);
  await clickAt(box.x + box.w / 2, box.y + box.h / 2); await idle(200); // the keyboard is now inside the page
  note("focus is in: " + (await c.ev(`document.activeElement?.tagName + ' ' + (document.activeElement?.title ?? '')`)) + "; a dialog open: " + (await c.ev(`document.querySelector('[role=dialog]')?.outerHTML.slice(0, 160) ?? 'none'`)));
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  ok("Esc pressed inside the page (the helper passes it up) also goes back to the cards", await c.waitFor(`!document.querySelector('iframe[title]') && !!document.querySelector('section[data-sheet] ul')`, 3000, 100), "keys at the sheet: " + (await c.ev("JSON.stringify(window.__keys)")) + "; messages from the page: " + (await c.ev("JSON.stringify(window.__kona)")) + "; the sheet now says: " + (await c.ev(`(document.querySelector('section[data-sheet]')?.innerText ?? 'no sheet').replace(/\s+/g, ' ').slice(0, 120)`)));
  await c.waitFor(`!!document.querySelector('section[data-sheet] ul button[aria-label="Open site"]')`, 5000, 100);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open site"]')?.click(); true`);
  await c.waitFor(`!!document.querySelector('iframe[title="site"]')`, 5000, 100);
  ok("the back button goes back to the cards", await press("Back to the mockups (Esc)") && await c.waitFor(`!document.querySelector('iframe[title]')`, 3000, 100));
  ok("the Kona mark is off while the sheet is open", await c.ev(`document.querySelector('header button[aria-label^="Kona, back"]').disabled`));

  // a video in a mockup: it loads through the mock scheme (a file whose index is at its end is read in ranges), plays muted, can be moved to a place far into the file, and is drawn in the frame
  if (VIDEO) {
    const vids = () => c.ev(`window.__msgs.filter((m) => m.test === 'vid')`);
    await c.waitFor(`!!document.querySelector('section[data-sheet] ul button[aria-label="Open video"]')`, 5000, 100);
    await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open video"]')?.click(); true`);
    ok("the video card opens", await c.waitFor(`!!document.querySelector('iframe[title="video"]')`, 5000, 100));
    await press("Phone, 390 px wide");
    ok("the video's details are read (metadata)", await c.waitFor(`window.__msgs.some((m) => m.test === 'vid' && m.what === 'metadata')`, 15000, 200));
    const meta = (await vids()).find((m) => m.what === "metadata");
    ok("it is the whole recording: about 19.5 s, 1920 x 1080", meta && meta.duration > 19 && meta.duration < 20 && meta.w === 1920 && meta.h === 1080, JSON.stringify(meta));
    ok("it plays (muted)", await c.waitFor(`window.__msgs.some((m) => m.test === 'vid' && m.what === 'playing')`, 10000, 200), JSON.stringify((await vids()).find((m) => m.what === "playfailed") ?? ""));
    await idle(2500);
    await c.ev(`document.querySelector('iframe[title]').contentWindow.postMessage({ test: 'ask' }, '*'); true`); await idle(400);
    const asked = (await vids()).filter((m) => m.what === "ask").pop();
    ok("time moves on while it plays", asked && asked.t > 1.5 && asked.paused === false && asked.error === null, JSON.stringify(asked));
    await c.ev(`document.querySelector('iframe[title]').contentWindow.postMessage({ test: 'seek', t: 14 }, '*'); true`);
    ok("it can be moved to second 14 (read from far into the file)", await c.waitFor(`window.__msgs.some((m) => m.test === 'vid' && m.what === 'seeked' && Math.abs(m.t - 14) < 1.5)`, 10000, 200), JSON.stringify((await vids()).filter((m) => m.what === "seeked")));
    ok("no error came from the video", !(await vids()).some((m) => m.error), JSON.stringify((await vids()).filter((m) => m.error)));
    // it is drawn: the picture in the frame is not one flat colour
    const fb = await frameBox();
    const shot = await c.send("Page.captureScreenshot", { format: "png", clip: { x: fb.x, y: fb.y, width: Math.min(fb.w, 400), height: Math.min(fb.h, 600), scale: 1 } });
    const shotFile = path.join(root, "video-in-frame.png");
    fs.writeFileSync(shotFile, Buffer.from(shot.result.data, "base64"));
    const { Img } = await import("../../art/lib.mjs");
    const im = Img.fromPng(shotFile);
    let n = 0, sum = 0, sum2 = 0;
    for (let y = 0; y < im.h; y += 3) for (let x = 0; x < im.w; x += 3) { const [r, g, b] = im.get(x, y); const l = 0.3 * r + 0.59 * g + 0.11 * b; n++; sum += l; sum2 += l * l; }
    const sd = Math.sqrt(sum2 / n - (sum / n) ** 2);
    ok("the video is drawn in the frame (the picture is not one flat colour)", sd > 8, `spread ${sd.toFixed(1)} over ${n} samples`);
    if (process.env.MOCK_TEST_SHOTS) { fs.copyFileSync(shotFile, path.join(process.env.MOCK_TEST_SHOTS, "video-in-frame.png")); note("a picture of the frame was saved to " + path.join(process.env.MOCK_TEST_SHOTS, "video-in-frame.png")); }
    await press("Desktop, 1440 px wide"); await idle(800);
    ok("it also plays on the desktop frame", await c.waitFor(`window.__msgs.filter((m) => m.test === 'vid').length > 0`, 2000, 100) && !(await vids()).some((m) => m.error));
    await press("Back to the mockups (Esc)"); await c.waitFor(`!document.querySelector('iframe[title]')`, 3000, 100);
  }

  // a narrow window: the toolbar wraps and nothing is cut off
  await c.waitFor(`!!document.querySelector('section[data-sheet] ul button[aria-label="Open site"]')`, 5000, 100);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open site"]')?.click(); true`);
  await c.waitFor(`!!document.querySelector('iframe[title="site"]')`, 5000, 100);
  let narrowOk = false;
  try {
    const w = await c.send("Browser.getWindowForTarget");
    const before = w.result.bounds;
    await c.send("Browser.setWindowBounds", { windowId: w.result.windowId, bounds: { windowState: "normal", width: 900, height: 700 } }); await idle(1200);
    const toolbar = await c.ev(`(() => { const t = document.querySelector('section[data-sheet] .flex-wrap'); const r = t.getBoundingClientRect(); return { w: r.width, sw: t.scrollWidth, cw: t.clientWidth }; })()`);
    const b2 = await frameBox(); const r2 = await c.ev(`(() => { const r = document.querySelector('section[data-sheet] .overflow-auto').getBoundingClientRect(); return { w: r.width, h: r.height }; })()`);
    narrowOk = toolbar.sw <= toolbar.cw + 1 && b2.w <= r2.w && b2.h <= r2.h;
    ok("in a narrow window the toolbar wraps and the device still fits", narrowOk, `toolbar ${toolbar.sw} in ${toolbar.cw}, frame ${Math.round(b2.w)} x ${Math.round(b2.h)} in ${Math.round(r2.w)} x ${Math.round(r2.h)}`);
    await c.send("Browser.setWindowBounds", { windowId: w.result.windowId, bounds: { windowState: before.windowState ?? "normal", width: before.width, height: before.height, left: before.left, top: before.top } });
  } catch (e) { note("SKIP the narrow window could not be set: " + String(e).slice(0, 120)); }
  await c.ev(`document.querySelector('section button[aria-label^="Close"]').click(); true`);
  ok("the sheet closes with the X button", await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100));
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
