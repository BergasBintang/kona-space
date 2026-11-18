// The Live mockup (decision 94) tried on a SECOND real product of another kind: the Quantum Research marketing site (an Astro static site, built from source, plus a small Node and SQLite lead API
// behind /api/daftar), in the REAL window over the DevTools port. For this PC only, like tests/lms-live.mjs: it needs the card `.kona/mockups/marketing-live` in the project "Quantum Research" of
// Kona, Node on the PC, and a built debug Kona started with the test port and with the owner's own Kona closed. It starts no session and touches no server. SHOT_DIR keeps screenshots.
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execSync } from "node:child_process";
import { attach } from "./cdp.mjs";
import { attachFrames } from "./cdp-frames.mjs";

const LMS = process.env.LMS_ROOT || "C:\\quantum-research-lms";
const CARD = path.join(LMS, ".kona", "mockups", "marketing-live");
const conf = JSON.parse(fs.readFileSync(path.join(CARD, "mockup.json"), "utf8"));
const NAME = conf.name, PORT = conf.live.port;
const SHOTS = process.env.SHOT_DIR || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const c = await attach(Number(process.env.PORT ?? 9223));
const F = await attachFrames(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0; const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const info = (s) => note("INFO " + s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const shot = async (n) => { if (SHOTS) await c.shot(path.join(SHOTS, n + ".png")); };
const answers = (port) => new Promise((res) => { const s = net.connect(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });
const gone = async (port, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (!(await answers(port))) return true; await wait(300); } return false; };
const pressText = (text, scope = "section[data-sheet]") => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope + " button")})].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const press = (label) => c.ev(`(() => { const b = document.querySelector('button[aria-label=${JSON.stringify(label)}]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
const settle = async (f, quiet = 500, max = 15000) => { const t0 = Date.now(); let last = -1, ch = Date.now(); while (Date.now() - t0 < max) { const pend = [...f.events.requests.values()].filter((r) => r.status === undefined && !r.url.startsWith("data:")).length; const n = f.events.requests.size; if (n !== last) { last = n; ch = Date.now(); } if (pend === 0 && Date.now() - ch >= quiet) return true; await wait(120); } return false; };
const walkFiles = (d) => { const out = []; (function w(x) { for (const e of fs.readdirSync(x, { withFileTypes: true })) { const p = path.join(x, e.name); e.isDirectory() ? w(p) : out.push(p); } })(d); return out; };
const projectDist = path.join(LMS, "marketing", "dist");
const fp = () => `${walkFiles(projectDist).length} files ${sha(walkFiles(projectDist).sort().map((f) => f + fs.statSync(f).size + fs.statSync(f).mtimeMs).join("|"))}`;
const before = fp(), dataBefore = fs.existsSync(path.join(LMS, "marketing", "server", "data"));
try {
  ok("nothing answers on the card's ports before the start", !(await answers(PORT)) && !(await answers(PORT + 1000)));
  await c.send("Page.bringToFront"); await c.send("Page.reload"); await wait(1500);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  ok("the project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes('Quantum Research') && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1) { b.click(); return true; } } } return false; })()`));
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  await c.ev(`document.querySelector('[aria-label="Open Mockups"]').click(); true`); await wait(1500);
  const list = await c.ev(`document.querySelector('section[data-sheet]')?.innerText ?? ''`);
  ok("the card is listed beside the other cards, as a live one", list.includes(NAME) && list.includes(`Live · port ${PORT}`) && list.includes("LMS, live"));
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label=${JSON.stringify("Open " + NAME)}]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.innerText.includes('Start the program')`, 5000, 100);
  await pressText("Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100);
  const t0 = Date.now(); await pressText("Run it", "[role=dialog]");
  let phase = ""; for (let i = 0; i < 300; i++) { phase = (await invoke("live_status")).phase; if (phase === "ready" || phase === "failed") break; await wait(500); }
  await c.send("Page.bringToFront");
  ok("the marketing site started and opened in the frame", phase === "ready" && await c.waitFor(`!!document.querySelector('iframe[title]')`, 30000, 300), `${Math.round((Date.now() - t0) / 100) / 10} s from Run to the frame`);
  ok("both programs answer: the static site and the lead API behind it", await answers(PORT) && await answers(PORT + 1000));
  const src = await c.ev(`document.querySelector('iframe[title]').getAttribute('src')`);
  const base = new URL(src).origin;
  await wait(2000);
  const f = await F.frame(base + "/");
  ok("the page is a frame of its own that the test can reach", !!f);
  await f.send("Network.setBlockedURLs", { urls: ["https://wa.me/*"] });
  await f.waitFor(`document.body && document.body.innerText.length > 200`, 20000); await settle(f);
  const title = await f.ev(`document.title`);
  ok("the front page is the site's own", /Quantum|Bimbel/i.test(title), title);
  await shot("mk-1-front");

  // ---- every file of the build, byte for byte
  const files = walkFiles(path.join(CARD, "dist")); const rels = files.map((p) => "/" + path.relative(path.join(CARD, "dist"), p).replace(/\\/g, "/"));
  const got = await f.ev(`(async () => { const out = {}; for (const p of ${JSON.stringify(rels)}) { const r = await fetch(p, { cache: 'no-store' }); const b = await r.arrayBuffer(); const h = await crypto.subtle.digest('SHA-256', b); out[p] = [r.status, Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, '0')).join(''), /html/.test(r.headers.get('content-type') || '') ? new TextDecoder().decode(b) : null]; } return out; })()`);
  const strip = (h) => h.replace(/<script>\(function\(\)\{try\{var d=Object[\s\S]*?<\/script>/, "").replace(/<script>\(function\(\)\{var r=document\.documentElement;[\s\S]*?<\/script>/, "").replace(/<script>\(function\(\)\{var last=0;[\s\S]*?<\/script>/, "");
  const bad = rels.filter((r, i) => got[r][0] !== 200 || (got[r][2] !== null ? strip(got[r][2]) !== fs.readFileSync(files[i], "utf8") : got[r][1] !== sha(fs.readFileSync(files[i]))));
  ok(`all ${rels.length} files of the build reach the browser byte for byte (a page: with the two scripts of the sheet taken out)`, bad.length === 0, bad.slice(0, 3).join(" "));
  // ---- how the project's own web server answers
  const route = await f.ev(`(async () => ({
    dir: await fetch('/daftar', { redirect: 'manual' }).then((r) => [r.status, r.type]),
    dirFollowed: await fetch('/daftar').then((r) => [r.status, new URL(r.url).pathname]),
    unknown: await fetch('/no-such-page').then(async (r) => [r.status, (await r.text()).includes('<title')]),
    traversal: await fetch('/..%2f..%2fenv.mjs').then((r) => r.status),
    wrongMethod: await fetch('/api/daftar', { method: 'GET' }).then((r) => r.status),
    badJson: await fetch('/api/daftar', { method: 'POST', body: 'not json' }).then((r) => r.status),
    badField: await fetch('/api/daftar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namaOrangTua: 'A', namaSiswa: 'B', kelas: 'Kelas 99', cabang: 'Petukangan' }) }).then((r) => r.status),
  }))()`);
  info("the routes: " + JSON.stringify(route));
  ok("a folder without its slash is sent to the one with it, as nginx does", route.dirFollowed[0] === 200 && route.dirFollowed[1] === "/daftar/");
  ok("an unknown address gets the front page (the project's try_files rule), and a path out of the folder is refused", route.unknown[0] === 200 && route.unknown[1] && route.traversal !== 200);
  ok("the lead API refuses a wrong method, bad JSON and a wrong class with its own answers", route.wrongMethod === 404 && route.badJson === 400 && route.badField === 400, JSON.stringify([route.wrongMethod, route.badJson, route.badField]));

  // ---- every page, at the five devices
  const pages = ["/", "/daftar/", "/karir/", "/lokasi/", "/masuk/", "/materi-gratis/", "/program/", "/tentang-kami/"];
  const problems = [];
  for (const [label, w] of [["Small phone, 320 px wide", 320], ["Phone, 390 px wide", 390], ["Tablet, 768 px wide", 768], ["Laptop, 1024 px wide", 1024], ["Desktop, 1440 px wide", 1440]]) {
    await press(label); await wait(1200);
    const res = [];
    for (const p of pages) {
      f.reset();
      await f.ev(`location.href = ${JSON.stringify(p)}`); await wait(700);
      await f.waitFor(`document.readyState === 'complete' && document.body.innerText.length > 100`, 15000); await settle(f, 500, 12000); await wait(300);
      const m = await f.ev(`({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: innerWidth, len: document.body.innerText.length })`);
      const failedReq = f.events.failed.filter((x) => !x.canceled && !/wa\.me|google|gstatic|facebook|instagram|linkedin|threads/.test(x.url ?? "")).map((x) => (x.url ?? "").slice(-50) + " " + x.error);
      const errs = f.events.errors;
      const bad4 = [...f.events.requests.values()].filter((r) => r.status >= 400 && r.url.startsWith(base)).map((r) => r.status + " " + new URL(r.url).pathname);
      if (m.over > 1) problems.push(`${label.split(",")[0]} ${p}: sideways ${m.over}`);
      if (errs.length) problems.push(`${label.split(",")[0]} ${p}: script error ${errs[0].slice(0, 100)}`);
      if (failedReq.length) problems.push(`${label.split(",")[0]} ${p}: failed ${failedReq.join(", ")}`);
      if (bad4.length) problems.push(`${label.split(",")[0]} ${p}: ${bad4.join(", ")}`);
      if (m.len < 100) problems.push(`${label.split(",")[0]} ${p}: empty`);
      res.push(`${p}:${m.over <= 1 ? "ok" : "over " + m.over}`);
    }
    ok(`${label.split(",")[0]}: the ${pages.length} pages load whole and do not scroll sideways`, !problems.some((x) => x.startsWith(label.split(",")[0])), res.join(" "));
  }
  ok("no page threw a script error, failed to load one of the site's files or answered with an error", problems.length === 0, problems.slice(0, 4).join(" || "));
  for (const p of problems.slice(0, 15)) info("problem: " + p);

  // ---- the form: a real submit (the site's own handler), the lead in SQLite, and the WhatsApp hand-off that leaves the site
  await press("Laptop, 1024 px wide"); await wait(800);
  f.reset(); await f.ev(`location.href = '/daftar/'`); await wait(900); await f.waitFor(`!!document.querySelector('#nama_orang_tua')`, 15000); await settle(f); await wait(500);
  const typeIn = async (sel, text) => { await f.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.select && e.select(); })()`); await f.send("Input.insertText", { text }); };
  await typeIn("#nama_orang_tua", "Orang Tua Contoh"); await typeIn("#nama_siswa", "Siswa Contoh");
  await f.ev(`(() => { for (const [id, v] of [['kelas', 'Kelas 11'], ['cabang', 'Petukangan']]) { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
  await wait(400); await shot("mk-2-form");
  f.reset();
  const clicked = await f.ev(`(() => { const b = document.querySelector('form button[type=submit]'); if (!b) return 'no button'; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (Array.isArray(clicked)) { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await f.send("Input.dispatchMouseEvent", { type, x: clicked[0], y: clicked[1], button: "left", clickCount: 1 }); }
  await wait(3500);
  const posts = [...f.events.requests.values()].filter((r) => r.method === "POST");
  ok("the form's own submit handler ran (a real submit event, which a drawn mockup cannot have) and posted the lead to the API", Array.isArray(clicked) && posts.some((r) => /api\/daftar/.test(r.url)), JSON.stringify(posts.map((r) => r.status + " " + r.url.slice(-20))));
  const db = new DatabaseSync(path.join(CARD, "data", "daftar.sqlite"), { readOnly: true });
  const rows = db.prepare("select nama_orang_tua, nama_siswa, kelas, cabang from submissions").all(); db.close();
  ok("the lead is a row in the SQLite file of the card", rows.length === 1 && rows[0].nama_siswa === "Siswa Contoh" && rows[0].kelas === "Kelas 11" && rows[0].cabang === "Petukangan", JSON.stringify(rows));
  const wa = f.events.failed.filter((x) => /wa\.me/.test(x.url ?? ""));
  const m2 = await f.ev(`location.href`).catch(() => "gone");
  ok("then the site sends the visitor to WhatsApp, which leaves the program (the test blocked that one address, so nothing was sent out: the frame ends on the browser's own error page)", wa.length >= 1 || /^chrome-error/.test(m2), `${m2.slice(0, 40)}; ${wa.length} blocked request(s)`);
  info("the hand-off navigates the whole frame away from the site; Start the page again brings it back");

  // ---- Stop, and nothing real was touched
  await c.ev(`document.querySelector('section[data-sheet] button[aria-label^="Close"]').click(); true`);
  ok("closing the sheet stops both programs", await gone(PORT) && await gone(PORT + 1000));
} catch (e) { note("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 500)); failed++; try { await invoke("live_stop"); } catch {} }
finally {
  await wait(800);
  ok("the project's own build folder and its lead API folder are as they were (nothing real was touched)", fp() === before && fs.existsSync(path.join(LMS, "marketing", "server", "data")) === dataBefore, before.slice(0, 30));
  try { const g = execSync("git status --short", { cwd: LMS }).toString().trim(); ok("the project's git has no change from the run", g === "", g.slice(0, 200)); } catch {}
  ok("the programs are not left running", !(await answers(PORT)) && !(await answers(PORT + 1000)));
  c.close(); F.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
