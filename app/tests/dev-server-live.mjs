// A development server (Vite, with its hot-reload web socket) as a Live mockup, in the REAL window. It answers what the "not supported" line of decision 94 says: the page and its ES modules load
// through the go-between, the web socket is refused (so no hot reload), and a changed file shows after "Start the page again". For this PC only: it needs the card
// `.kona/mockups/vite-dev-live` in PRODUCTS_ROOT (default D:\temp\kona-products) and the LMS's Vite (a copy of Vite is used, nothing of the LMS is read or changed).
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { attach } from "./cdp.mjs";
import { attachFrames } from "./cdp-frames.mjs";

const ROOT = process.env.PRODUCTS_ROOT || "D:\\temp\\kona-products";
const CARD = path.join(ROOT, ".kona", "mockups", "vite-dev-live");
const conf = JSON.parse(fs.readFileSync(path.join(CARD, "mockup.json"), "utf8"));
const NAME = conf.name, PORT = conf.live.port;
const c = await attach(Number(process.env.PORT ?? 9223));
const F = await attachFrames(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const answers = (port) => new Promise((res) => { const s = net.connect(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });
const pressText = (text, scope = "section[data-sheet]") => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope + " button")})].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const press = (label) => c.ev(`(() => { const b = document.querySelector('button[aria-label=${JSON.stringify(label)}]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
const original = fs.readFileSync(path.join(CARD, "greet.js"), "utf8");
const projectsBefore = await invoke("list_projects");
let projectId = null;
try {
  const account = projectsBefore.find((p) => p.account)?.account;
  projectId = (await invoke("add_project", { folder: ROOT, name: "kona-dev-server-test", account })).project.id;
  await c.send("Page.bringToFront"); await c.send("Page.reload"); await wait(1800);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes('kona-dev-server-test') && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1) { b.click(); return true; } } } return false; })()`);
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  await c.ev(`document.querySelector('[aria-label="Open Mockups"]').click(); true`); await wait(1500);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label=${JSON.stringify("Open " + NAME)}]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.innerText.includes('Start the program')`, 5000, 100);
  await pressText("Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100); await pressText("Run it", "[role=dialog]");
  let st = null; for (let i = 0; i < 200; i++) { st = await invoke("live_status"); if (st.phase === "ready" || st.phase === "failed") break; await wait(500); }
  ok("the Vite development server started", st.phase === "ready", st.phase === "failed" ? st.message + " | " + (st.log ?? []).slice(-4).join(" / ") : "");
  await c.send("Page.bringToFront");
  await c.waitFor(`!!document.querySelector('iframe[title]')`, 30000, 300);
  const base = new URL(await c.ev(`document.querySelector('iframe[title]').getAttribute('src')`)).origin;
  await wait(2500);
  const f = await F.frame(base + "/");
  ok("the page is a frame of its own that the test can reach", !!f);
  await f.waitFor(`document.getElementById('msg')?.textContent.includes('Hello')`, 20000);
  if (!(await f.ev(`!!document.getElementById('msg')`))) console.log('DEBUG html:', (await f.ev(`document.documentElement.outerHTML.slice(0, 900)`)).replace(/\s+/g, ' '), '| errors:', JSON.stringify(f.events.errors), '| console:', JSON.stringify(f.events.console.slice(0, 4)));
  ok("the page and its ES modules loaded through the go-between (two module files, a script type that a drawn mockup cannot use)", await f.ev(`document.getElementById('msg').textContent === 'Hello from first version' && document.getElementById('mods').textContent === 'modules work'`));
  await wait(2500);
  const ws = f.events.console.map((x) => x.text).concat(f.events.errors).filter((t) => /websocket|ws:\/\//i.test(t));
  ok("the hot-reload web socket was refused, and the page went on working (the dev server's client says so in the console)", ws.length >= 1 || [...f.events.requests.values()].some((r) => /^ws:/.test(r.url) && r.status !== 101), ws.slice(0, 1).join(" ").slice(0, 120));
  fs.writeFileSync(path.join(CARD, "greet.js"), original.replace("Hello from", "Changed hello from"));
  await wait(1500);
  const afterEdit = await f.ev(`document.getElementById('msg').textContent`);
  console.log("INFO after the file changed the page says: " + afterEdit + " (without the hot-reload socket the dev server's own client falls back to asking whether the server is back, and may reload the page by itself)");
  await press("Start the page again"); await wait(3000);
  const f2 = await F.frame(base + "/");
  await f2.waitFor(`document.getElementById('msg')?.textContent.includes('hello')`, 20000);
  ok("after Start the page again the changed file is shown", (await f2.ev(`document.getElementById('msg').textContent`)) === "Changed hello from first version");
  await c.ev(`document.querySelector('section[data-sheet] button[aria-label^="Close"]').click(); true`);
  // a running program is something the page would lose: the sheet asks (minimize, close or cancel), and the test closes it
  await c.waitFor("!!document.querySelector('[role=dialog]')", 2500, 100); await c.ev("(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Close it'); if (b) b.click(); return !!b; })()");
  ok("closing the sheet stops the development server", await (async () => { for (let i = 0; i < 40; i++) { if (!(await answers(PORT))) return true; await wait(500); } return false; })());
} catch (e) { console.log("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 500)); failed++; try { await invoke("live_stop"); } catch {} }
finally {
  fs.writeFileSync(path.join(CARD, "greet.js"), original);
  try { if (projectId) await invoke("remove_project", { id: projectId }); } catch {}
  ok("the project list is as it was before the test", JSON.stringify((await invoke("list_projects")).map((p) => p.id)) === JSON.stringify(projectsBefore.map((p) => p.id)));
  c.close(); F.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
