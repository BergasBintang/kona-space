// The Live mockup (decision 94) tried on a REAL product: the Quantum Research LMS (a Laravel API and a Vue front end), run from the project's own code on a throwaway SQLite file, in the Mockups
// sheet of the REAL window, driven over the DevTools port. This test is for this PC only: it needs the LMS at LMS_ROOT (default C:\quantum-research-lms) as a project of Kona called "Quantum Research",
// the card `.kona/mockups/lms-live` in it (its recipe, launcher and setup), PHP and Node on the PC, and a built debug Kona started with the test port and with the owner's own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then start src-tauri/target/debug/app.exe   then   node tests/lms-live.mjs
// It adds and removes nothing in Kona (the project already exists); it starts no Claude session and touches no server. It leaves the program stopped. SHOT_DIR keeps screenshots.
// Every login is a made-up demo account of the project's own LocalDemoSeeder (its password is read from that file here, not written into this one).
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { attach } from "./cdp.mjs";
import { attachFrames } from "./cdp-frames.mjs";

const LMS = process.env.LMS_ROOT || "C:\\quantum-research-lms";
const CARD_DIR = path.join(LMS, ".kona", "mockups", "lms-live");
const DATA = path.join(LMS, ".kona", "live-data", "lms-live"); // what the card keeps between runs (decision 94b): its demo database, its storage, the files of its fake bucket, its list of demo logins
const CARD_NAME = JSON.parse(fs.readFileSync(path.join(CARD_DIR, "mockup.json"), "utf8")).name;
const PORT = JSON.parse(fs.readFileSync(path.join(CARD_DIR, "mockup.json"), "utf8")).live.port;
const PASSWORD = /const PASSWORD = '([^']+)'/.exec(fs.readFileSync(path.join(LMS, "lms", "backend", "database", "seeders", "LocalDemoSeeder.php"), "utf8"))?.[1];
const SHOTS = process.env.SHOT_DIR || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const c = await attach(Number(process.env.PORT ?? 9223));
const F = await attachFrames(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const info = (s) => note("INFO " + s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// a small picture made here (a gradient), so the test needs no file from anywhere
function makePng(w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = (x * 255) / w; raw[o + 1] = (y * 255) / h; raw[o + 2] = 120; raw[o + 3] = 255; }
  const chunk = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]); const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(b) >>> 0); return Buffer.concat([len, b, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const shot = async (name) => { if (SHOTS) await c.shot(path.join(SHOTS, name + ".png")); };
const answers = (port) => new Promise((res) => { const s = net.connect(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });
const gone = async (port, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (!(await answers(port))) return true; await wait(300); } return false; };
const sheetText = () => c.ev(`document.querySelector('section[data-sheet]')?.innerText ?? ''`);
const press = (label) => c.ev(`(() => { const b = document.querySelector('button[aria-label=${JSON.stringify(label)}]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
const pressText = (text, scope = "section[data-sheet]") => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope + " button")})].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const frameBox = () => c.ev(`(() => { const f = document.querySelector('iframe[title]'); if (!f) return null; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cw: f.offsetWidth, ch: f.offsetHeight, sandbox: f.getAttribute('sandbox'), src: f.getAttribute('src') }; })()`);
const realDbs = ["database.sqlite", "reports.sqlite"].map((f) => path.join(LMS, "lms", "backend", "database", f));
const fingerprint = () => realDbs.map((f) => { const s = fs.statSync(f); return `${path.basename(f)} ${s.size} ${s.mtimeMs} ${sha(fs.readFileSync(f))}`; });
const demoDb = () => new DatabaseSync(path.join(DATA, "demo.sqlite"), { readOnly: true });
const sql = (q, ...a) => { const db = demoDb(); try { return db.prepare(q).all(...a); } finally { db.close(); } };

const ACCOUNTS = [
  { key: "admin", email: "admin@quantumresearch.test", what: "admin" },
  { key: "branch manager", email: "manajer.cabang@quantumresearch.test", what: "teacher with the Branch Manager duty" },
  { key: "academic coordinator", email: "koordinator.akademik@quantumresearch.test", what: "teacher with the Academic Coordinator duty" },
  { key: "ops coordinator", email: "koordinator@quantumresearch.test", what: "ops_coordinator (Ops Coordinator duty)" },
  { key: "teacher", email: "bagas.nugroho@quantumresearch.test", what: "teacher" },
  { key: "student", email: "siswa01@quantumresearch.test", what: "student" },
  { key: "parent", email: "orangtua@quantumresearch.test", what: "parent" },
];

// ---- what a page may do and what is only worth a look
const gate = (meta, u) => {
  if (!u) return false;
  if (meta.requiresAdminAccess && !(u.isAdmin || u.isBranchCoordinator)) return false;
  if (meta.requiresStaffAttendanceOversight && !u.canOverseeStaffAttendance) return false;
  if (meta.requiresLeaveEligibility && !u.canRequestLeave) return false;
  if (meta.requiresRecap && !(u.isStudent || u.isTeacher === undefined ? u.isStudent : u.isStudent || u.canRequestLeave)) return false;
  if (meta.requiresStaff && !(u.isTeacher || u.isAdmin || u.isBranchCoordinator)) return false;
  if (meta.requiresSuperAdmin && !u.isAdmin) return false;
  return true;
};

let frame = null;
const settle = async (f, quiet = 500, max = 20000) => {
  const t0 = Date.now(); let lastSize = -1, lastChange = Date.now();
  while (Date.now() - t0 < max) {
    const pend = [...f.events.requests.values()].filter((r) => r.status === undefined).length;
    const size = f.events.requests.size;
    if (size !== lastSize) { lastSize = size; lastChange = Date.now(); }
    if (pend === 0 && Date.now() - lastChange >= quiet) return true;
    await wait(120);
  }
  return false;
};
const clickIn = async (f, selector) => {
  const r = await f.ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  if (!r) return false;
  await f.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r[0], y: r[1] });
  await f.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r[0], y: r[1], button: "left", clickCount: 1 });
  await f.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r[0], y: r[1], button: "left", clickCount: 1 });
  return true;
};
const typeIn = async (f, selector, text) => { await f.ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.focus(); e.select && e.select(); })()`); await f.send("Input.insertText", { text }); };
const appState = (f) => f.ev(`(() => { try { const app = document.querySelector('#app').__vue_app__; const p = app.config.globalProperties.$pinia; const a = p.state.value.auth || {}; const u = a.user || null; return { token: !!a.token, user: u ? { id: u.id, name: u.name, role: u.role, isAdmin: !!u.isAdmin, isTeacher: !!u.isTeacher, isStudent: !!u.isStudent, isParent: !!u.isParent, isBranchCoordinator: !!u.isBranchCoordinator, isBranchManager: !!u.isBranchManager, isAcademicCoordinator: !!u.isAcademicCoordinator, isOpsCoordinator: !!u.isOpsCoordinator, canOverseeStaffAttendance: !!u.canOverseeStaffAttendance, canRequestLeave: !!u.canRequestLeave, locale: u.locale } : null, path: location.pathname }; } catch (e) { return { error: String(e).slice(0, 120), path: location.pathname }; } })()`);
const routes = (f) => f.ev(`(() => { const r = document.querySelector('#app').__vue_app__.config.globalProperties.$router; return r.getRoutes().filter((x) => x.path && !x.redirect).map((x) => ({ path: x.path, name: String(x.name ?? ''), meta: x.meta })); })()`);
// The product asks "Tinggalkan tanpa menyimpan?" when a page with unsaved changes (the quiz editor) is left; a person would press "Tinggalkan", so the test does too.
const push = (f, p) => f.ev(`(() => { const go = document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(${JSON.stringify(p)}).then(() => location.pathname + location.search); const t = setInterval(() => { const b = [...document.querySelectorAll('.mi-dialog button')].find((x) => /^(Tinggalkan|Leave)$/.test(x.textContent.trim())); if (b) b.click(); }, 150); return go.finally(() => clearInterval(t)); })()`);
const inspect = (f) => f.ev(`(() => { const t = (document.querySelector('#app') || document.body).innerText.replace(/\\s+/g, ' ').trim(); const h = document.querySelector('h1, h2'); return { path: location.pathname + location.search, h: h ? h.innerText.trim().slice(0, 60) : '', len: t.length, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: innerWidth, anims: document.getAnimations().length, lang: document.documentElement.lang, text: t.slice(0, 140) }; })()`);

async function openSheet() {
  await c.send("Page.bringToFront");
  await c.send("Page.reload"); await wait(1500);
  ok("the welcome page is there", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  ok("the project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes('Quantum Research') && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1) { b.click(); return true; } } } return false; })()`));
  ok("it is the Quantum Research project", await c.waitFor(`document.querySelector('header')?.innerText.includes('Quantum Research')`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200));
  await c.ev(`window.__escape = null; true`);
  ok("the big screen opens the Mockups sheet", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Mockups"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Mockups'`, 5000, 100));
  await wait(1200);
}

// `fresh`: begin from nothing (the first start has no data, so the plain button is there; later ones have data, and "Start fresh" is chosen). Otherwise carry on with the data of the last run ("Start with the last data").
async function startProgram(fresh = true) {
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label=${JSON.stringify("Open " + CARD_NAME)}]')?.click(); true`);
  await c.waitFor(`/Start the program|Start with the last data/.test(document.querySelector('section[data-sheet]')?.innerText ?? '')`, 5000, 100);
  const panel = await sheetText();
  const label = panel.includes("Start with the last data") ? (fresh ? "Start fresh" : "Start with the last data") : "Start the program";
  await pressText(label); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100);
  const dlg = await c.ev(`document.querySelector('[role=dialog]').innerText`);
  const t0 = Date.now();
  await pressText("Run it", "[role=dialog]");
  // the program is asked by its own status first (the sheet itself only looks while the window is visible: a window hidden behind others looks at nothing, which is right for a person)
  let phase = "", tries = 0;
  while (tries++ < 600) { const st = await invoke("live_status"); phase = st.phase; if (phase === "ready" || phase === "failed") break; await wait(500); }
  await c.send("Page.bringToFront");
  const up = phase === "ready" && await c.waitFor(`!!document.querySelector('iframe[title]')`, 30000, 300);
  if (!up) info(`the frame did not appear: phase ${phase}, window ${await c.ev("document.visibilityState")}, sheet says "${(await sheetText()).replace(/\s+/g, " ").slice(0, 160)}"`);
  return { up, secs: Math.round((Date.now() - t0) / 100) / 10, dialog: dlg };
}

const before = fingerprint();
const memBefore = os.freemem();
const { execSync } = await import("node:child_process");
// what each kind of program holds, from the task list (the sizes the PC reports for the program's own memory)
const procMem = () => {
  const out = {};
  for (const line of execSync("tasklist /FO CSV /NH", { encoding: "utf8" }).split(/\r?\n/)) {
    const m = /^"([^"]+)","\d+","[^"]*","\d+","([\d.,\s]+) K"/.exec(line);
    if (!m) continue;
    const name = m[1].toLowerCase();
    if (!["php.exe", "node.exe", "app.exe", "msedgewebview2.exe"].includes(name)) continue;
    out[name] = (out[name] ?? 0) + Number(m[2].replace(/[.,\s]/g, "")) / 1024;
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v)]));
};
const downloads = path.join(os.homedir(), "Downloads");
const listDownloads = () => { try { return fs.readdirSync(downloads).sort(); } catch { return []; } };
try {
  if (!PASSWORD) throw new Error("the demo password could not be read from the project's LocalDemoSeeder");
  await F.send("Browser.setDownloadBehavior", { behavior: "deny", eventsEnabled: true });
  ok("nothing answers on the program's port before the start", !(await answers(PORT)) && !(await answers(PORT + 1000)));
  await openSheet();

  // ---- the card
  const list = await sheetText();
  ok("the card is listed as a live one, with its port", list.includes(CARD_NAME) && list.includes(`Live · port ${PORT}`), list.replace(/\s+/g, " ").slice(0, 200));
  ok("the project's other card is still a drawn one", list.includes("Landing page") && /\d+ files/.test(list));

  // ---- start
  const s = await startProgram();
  ok("the question named both commands and the port", s.dialog.includes("prepare.mjs") && s.dialog.includes("launcher.mjs") && s.dialog.includes(`port ${PORT}`), s.dialog.replace(/\s+/g, " ").slice(0, 250));
  ok("the LMS started and opened in the frame", s.up, `${s.secs} s from Run to the frame`);
  info(`from Run it to the first page: ${s.secs} s (setup: migrations of 160 and more files, 4 seeders, the demo accounts)`);
  ok("both programs answer: the launcher and PHP behind it", await answers(PORT) && await answers(PORT + 1000));
  const memReady = os.freemem();
  const procsUp = procMem();
  info(`MB held by the programs of the PC right after the start (the PC reports the size of each program's own memory; node is the launcher and also any other Node program of the PC): ${JSON.stringify(procsUp)}`);
  const box = await frameBox();
  ok("the frame is the live frame", box.sandbox === "allow-scripts allow-same-origin allow-forms allow-modals allow-downloads" && /^http:\/\/127\.0\.0\.1:\d+\/app\//.test(box.src), `${box.sandbox} ${box.src}`);
  const base = new URL(box.src).origin;
  await wait(2500);
  frame = await F.frame(base + "/");
  ok("the page of the LMS is a frame of its own that the test can reach", !!frame, (await F.targets()).map((t) => t.type + ":" + t.url.slice(0, 60)).join(" | "));
  if (!frame) throw new Error("no frame");
  {
    ok("the question said that Kona gives the program a fake bucket, and that its data is kept", /fake cloud bucket/.test(s.dialog) && /kept when it stops/.test(s.dialog), s.dialog.replace(/\s+/g, " ").slice(-260));
    const logins = JSON.parse(fs.readFileSync(path.join(DATA, "accounts.json"), "utf8"));
    // the list is laid over the program (the key button of the toolbar opens and closes it, and it opens by itself the first time a card is up)
    if (!(await sheetText()).includes("Password for all")) { await press("Demo accounts"); await wait(500); }
    const shown = await sheetText();
    ok("the sheet lists the demo logins next to the program, with the one password for all (nobody is left at the sign-in page)", logins.length === 8 && logins.every((a) => shown.includes(a.login)) && shown.includes("Demo accounts (8)") && shown.includes("Password for all: " + PASSWORD) && shown.includes("Copy"), `${logins.length} logins; ${shown.replace(/\s+/g, " ").slice(0, 160)}`);
    await press("Close the demo accounts"); await wait(300);
    ok("the data folder of the card exists in the project, with the demo database, the storage and the bucket's folder", ["demo.sqlite", "storage", "bucket"].every((f) => fs.existsSync(path.join(DATA, f))), fs.readdirSync(DATA).join(", "));
  }
  await frame.waitFor(`document.querySelector('#app') && document.querySelector('#app').children.length > 0`, 20000);
  await settle(frame);
  let st = await appState(frame);
  ok("a person who is not signed in is sent to the sign-in page by the front end's own router", st.path === "/app/login", st.path);
  ok("the front end has its own address under /app/ and the whole bundle loaded", (await frame.ev(`performance.getEntriesByType('resource').length`)) > 5);
  const early = await frame.ev(`(async () => { const regs = await navigator.serviceWorker.getRegistrations(); return { regs: regs.map((r) => r.scope), caches: (await caches.keys()).length }; })()`);
  info(`service workers: ${JSON.stringify(early.regs)}, cache stores: ${early.caches}`);
  await shot("lms-1-login");

  // ---- what the browser got is what is on disk
  const distFiles = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : distFiles.push(p); } })(path.join(CARD_DIR, "dist"));
  const rels = distFiles.map((f) => "/app/" + path.relative(path.join(CARD_DIR, "dist"), f).replace(/\\/g, "/")).filter((r) => r !== "/app/index.html");
  const got = await frame.ev(`(async () => { const out = {}; for (const p of ${JSON.stringify(rels)}) { const r = await fetch(p, { cache: 'no-store' }); const b = await r.arrayBuffer(); const h = await crypto.subtle.digest('SHA-256', b); out[p] = [r.status, Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, '0')).join(''), b.byteLength, r.headers.get('content-type')]; } return out; })()`);
  const bad = rels.filter((r, i) => got[r][0] !== 200 || got[r][1] !== sha(fs.readFileSync(distFiles[i])));
  ok(`all ${rels.length} files of the build reach the browser byte for byte`, bad.length === 0, bad.slice(0, 3).join(" "));
  const types = new Set(rels.map((r) => path.extname(r)).filter(Boolean));
  const wrongType = rels.filter((r) => { const t = got[r][3] ?? ""; const e = path.extname(r); return (e === ".js" && !t.includes("javascript")) || (e === ".css" && !t.includes("text/css")) || (e === ".svg" && !t.includes("svg")) || ((e === ".woff2") && !t.includes("woff2")); });
  ok("scripts, styles, fonts and pictures have the right content types", wrongType.length === 0, `${[...types].join(" ")} ${wrongType.slice(0, 2).join(" ")}`);
  const html = await frame.ev(`fetch('/app/', { cache: 'no-store' }).then((r) => r.text())`);
  const strip = (h) => h.replace(/<script>\(function\(\)\{try\{var d=Object[\s\S]*?<\/script>/, "").replace(/<script>\(function\(\)\{var r=document\.documentElement;[\s\S]*?<\/script>/, "").replace(/<script>\(function\(\)\{var last=0;[\s\S]*?<\/script>/, "").replace(/<style data-kona>[\s\S]*?<\/style>/, "");
  const stripped = strip(html);
  ok("the page the browser got is the build's index.html plus the two scripts of the sheet, nothing else", stripped === fs.readFileSync(path.join(CARD_DIR, "dist", "index.html"), "utf8"), `${html.length - stripped.length} letters added`);
  const pub = path.join(LMS, "lms", "backend", "public"); const pubFiles = [];
  (function walk(d, depth) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isSymbolicLink()) continue; if (e.isDirectory()) { if (depth < 4) walk(p, depth + 1); } else if (!/\.php$/.test(e.name) && fs.statSync(p).size < 6e6) pubFiles.push(p); } })(pub, 0);
  const pubRels = pubFiles.slice(0, 120).map((f) => "/" + path.relative(pub, f).replace(/\\/g, "/"));
  const gotPub = await frame.ev(`(async () => { const out = {}; for (const p of ${JSON.stringify(pubRels)}) { const r = await fetch(p, { cache: 'no-store' }); const b = await r.arrayBuffer(); const h = await crypto.subtle.digest('SHA-256', b); out[p] = [r.status, Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, '0')).join(''), /html/.test(r.headers.get('content-type') || '') ? new TextDecoder().decode(b) : null]; } return out; })()`);
  const same = (r, i) => gotPub[r][0] === 200 && (gotPub[r][2] !== null ? strip(gotPub[r][2]) === fs.readFileSync(pubFiles[i], "utf8") : gotPub[r][1] === sha(fs.readFileSync(pubFiles[i])));
  const badPub = pubRels.filter((r, i) => !same(r, i));
  ok(`${pubRels.length} files from the backend's public folder (pictures, the web app manifest, the service worker, MathJax) reach the browser byte for byte (a page: with the two scripts of the sheet taken out)`, badPub.length === 0, badPub.slice(0, 3).join(" "));
  ok("the PHP code of the backend is never handed out as a file", await frame.ev(`fetch('/index.php').then((r) => r.text()).then((t) => !t.includes('<?php'))`));
  ok("the program's own health address answers", await frame.ev(`fetch('/up').then((r) => r.status)`) === 200);

  // ---- the people
  const matrix = [];
  const problems = [];
  const params = { groupId: 1, subjectId: 1, placementId: 1, attemptId: 1, classroomId: 1, id: 1, meetingId: 1, quizId: 1, questionId: 1, contentId: 1, type: "announcement", roleSlug: "students" };
  const studentInClass1 = sql("select student_id as id from classroom_student where classroom_id = 1 limit 1")[0]?.id ?? 1;
  const teacherId = sql("select id from users where role = 'teacher' limit 1")[0]?.id ?? 2;
  const allRoutes = await routes(frame);
  const fill = (p) => p.replace(/:(\w+)(\([^)]*\))?/g, (_, n) => String(n === "studentId" ? studentInClass1 : n === "userId" ? teacherId : params[n] ?? 1));
  info(`the front end has ${allRoutes.length} routes of its own`);

  for (const acct of ACCOUNTS) {
    await frame.ev(`localStorage.clear(); sessionStorage.clear(); true`);
    await frame.ev(`location.href = '/app/login'`); await wait(900);
    await frame.waitFor(`!!document.querySelector('input[type=email]')`, 15000);
    await settle(frame);
    frame.reset();
    await typeIn(frame, "input[type=email]", acct.email);
    await typeIn(frame, "input[type=password]", PASSWORD);
    const clicked = await clickIn(frame, "button[type=submit]");
    const signed = await frame.waitFor(`location.pathname === '/app/dashboard'`, 20000, 200);
    await settle(frame);
    st = await appState(frame);
    ok(`${acct.key}: signs in with a real click and typing (${acct.what})`, clicked && signed && !!st.user, `${st.path} ${st.user?.name ?? "no user"}`);
    const screen = await c.ev(`(() => { const f = document.querySelector('iframe[title]'); const p = f.parentElement; const a = f.getBoundingClientRect(), b = p.getBoundingClientRect(); return { top: p.scrollTop, gapBottom: Math.round((b.bottom - a.bottom) * 10) / 10, gapTop: Math.round((a.top - b.top) * 10) / 10 }; })()`);
    ok(`${acct.key}: scrolling the sign-in page to its button did not push the device's screen up (no white band under the program)`, screen.top === 0 && Math.abs(screen.gapBottom) < 1.5 && Math.abs(screen.gapTop) < 1.5, JSON.stringify(screen));
    if (!signed || !st.user) { info(`${acct.key}: stopped, ${JSON.stringify(await inspect(frame))}`); continue; }
    const u = st.user;
    const flags = ["isAdmin", "isTeacher", "isStudent", "isParent", "isBranchCoordinator", "isBranchManager", "isAcademicCoordinator", "isOpsCoordinator", "canOverseeStaffAttendance", "canRequestLeave"].filter((k) => u[k]).join(" ");
    info(`${acct.key}: ${u.name}, role ${u.role}: ${flags}`);
    const duty = sql("select max(bt.is_branch_manager) bm, max(bt.is_academic_coordinator) ac, max(bt.is_ops_coordinator) ops from users u left join branch_teacher bt on bt.teacher_id = u.id where u.email = ?", acct.email)[0];
    const roleRow = sql("select role from users where email = ?", acct.email)[0]?.role;
    const expect = {
      admin: () => u.isAdmin && roleRow === "admin",
      "branch manager": () => u.isTeacher && u.isBranchCoordinator && duty.bm === 1,
      "academic coordinator": () => u.isTeacher && u.isBranchCoordinator && duty.ac === 1,
      "ops coordinator": () => !u.isTeacher && u.isBranchCoordinator && roleRow === "ops_coordinator" && duty.ops === 1,
      teacher: () => u.isTeacher && !u.isBranchCoordinator && roleRow === "teacher",
      student: () => u.isStudent && roleRow === "student",
      parent: () => !u.isAdmin && !u.isTeacher && !u.isStudent && !u.isBranchCoordinator && roleRow === "parent",
    }[acct.key];
    ok(`${acct.key}: the program tells the front end the right role or duty, and it is the SQLite file's`, expect(), `${flags || "no flag"}; role ${roleRow}; duty bm ${duty.bm} ac ${duty.ac} ops ${duty.ops}`);
    if (acct.key === "parent") ok("the parent's dashboard lists the classes of the child it is linked to (the child is in 12.1 PTK)", await frame.ev(`document.body.innerText.includes('12.1')`));
    ok(`${acct.key}: the sign-in is kept by the browser (a token in storage, after a reload the person is still in)`, await (async () => { await frame.ev(`location.reload()`); await wait(900); await frame.waitFor(`document.querySelector('#app')?.children.length > 0`, 15000); await settle(frame); return (await appState(frame)).user?.id === u.id; })());
    await shot("lms-2-dashboard-" + acct.key.replace(/ /g, "-"));
    const dash = await inspect(frame);
    ok(`${acct.key}: the dashboard has content and no sideways scroll`, dash.len > 80 && dash.overflowX <= 1, `${dash.len} letters, overflow ${dash.overflowX}, "${dash.h}"`);

    // every page of the front end this person can try, by the front end's own router
    let n = 0, redirected = 0, accessible = 0, mismatches = [], ownRedirects = [];
    for (const r of (process.env.SKIP_WALK ? [] : allRoutes)) { // SKIP_WALK=1 leaves out the long walk through every page, to try the other parts quickly
      if (r.path === "/login" || r.path === "/forgot-password" || r.path === "/reset-password" || r.path === "/") continue;
      if (/\/new$/.test(r.path) && /:contentId/.test(r.path)) { /* a content form is reached with its type */ }
      if (/try-out\/(utbk|tka|speed-test)\/:groupId/.test(r.path) || /print$/.test(r.path)) continue; // no group in the demo data, and the printing page calls the print dialog
      const target = fill(r.path);
      frame.reset();
      let landed;
      try { landed = await push(frame, target); } catch (e) { landed = "ERR " + String(e).slice(0, 60); }
      await settle(frame, 450, 15000);
      const page = await inspect(frame);
      const want = gate(r.meta, u);
      const stayed = page.path.split("?")[0].replace(/\/$/, "") === ("/app" + target).replace(/\/$/, "") || page.path.split("?")[0] === "/app" + target;
      const events = { errors: [...frame.events.errors], failed: frame.events.failed.filter((x) => !x.canceled), statuses: [...frame.events.requests.values()].filter((x) => x.status >= 400).map((x) => `${x.status} ${x.method} ${new URL(x.url).pathname}`), console: frame.events.console.filter((x) => x.type === "error").map((x) => x.text) };
      n++; if (!stayed) redirected++; else accessible++;
      const row = { who: acct.key, route: r.path, target, landed: page.path, want, stayed, len: page.len, over: page.overflowX, ...events };
      matrix.push(row);
      const pagePath = page.path.split("?")[0].replace(/^\/app/, "");
      const ownRedirect = pagePath !== "" && target.startsWith(pagePath + "/"); // the page's own rule: back to its parent page
      if (ownRedirect) ownRedirects.push(`${acct.key} ${r.path} -> ${pagePath}`);
      if (want && !stayed && r.path !== "/dashboard" && !ownRedirect && !/^\/staff-month\//.test(r.path)) mismatches.push(`${r.path} -> ${page.path}`);
      if (!want && stayed) mismatches.push(`${r.path} reached but gated`);
      if (events.errors.length) problems.push(`${acct.key} ${target}: script error ${events.errors[0].slice(0, 140)}`);
      if (events.failed.length) problems.push(`${acct.key} ${target}: failed request ${events.failed.map((x) => x.url?.slice(-60) + " " + x.error).join(", ")}`);
      const five = events.statuses.filter((x) => x.startsWith("5")); if (five.length) problems.push(`${acct.key} ${target}: ${five.join(", ")}`);
      if (stayed && page.len < 25) problems.push(`${acct.key} ${target}: the page is empty`);
    }
    ok(`${acct.key}: ${n} pages tried, ${accessible} opened, ${redirected} sent elsewhere, and each one agrees with the front end's own gates`, mismatches.length === 0, mismatches.slice(0, 4).join("; "));
    if (ownRedirects.length) info(`${acct.key}: pages that send the person to their parent page by their own rule: ${ownRedirects.join(", ")}`);
    if (acct.key === "teacher") {
      await push(frame, "/staff-attendance"); await settle(frame, 500, 12000); await wait(600);
      info(`teacher's clock-in page says: "${(await inspect(frame)).text.slice(0, 140)}"`);
      await shot("lms-3-clock-in");
    }
    await shot("lms-3-after-walk-" + acct.key.replace(/ /g, "-"));
  }

  info(`MB held by the programs after the walk through every page: ${JSON.stringify(procMem())}`);
  info(`free memory of the PC: ${Math.round(memBefore / 1e6)} MB before the start, ${Math.round(memReady / 1e6)} MB with the program up, ${Math.round(os.freemem() / 1e6)} MB after the walk through every page (of ${Math.round(os.totalmem() / 1e6)} MB)`);
  const fivexx = problems.filter((p) => / 5\d\d /.test(p) || /script error/.test(p) || /failed request/.test(p) || /is empty/.test(p));
  ok("no page of any person threw a script error, failed to load a file, answered with a server error or came up empty", fivexx.length === 0, fivexx.slice(0, 3).join(" || "));
  for (const p of fivexx.slice(0, 25)) info("problem: " + p);
  const client = matrix.filter((m) => m.statuses.length).map((m) => `${m.who} ${m.target}: ${[...new Set(m.statuses)].join(", ")}`);
  info(`${matrix.length} page visits; ${client.length} of them had a 4xx answer from the API (a person who may not, a missing demo record). First ones:`);
  for (const l of client.slice(0, 40)) info("  4xx " + l);
  const stillConsole = matrix.filter((m) => m.console.length).map((m) => `${m.who} ${m.target}: ${m.console[0]}`);
  info(`${stillConsole.length} visits wrote an error to the browser console. First ones:`);
  for (const l of stillConsole.slice(0, 25)) info("  console " + l);
  fs.writeFileSync(path.join(os.tmpdir(), "lms-live-matrix.json"), JSON.stringify(matrix));

  // ---- the two languages
  await frame.ev(`localStorage.clear(); true`); await frame.ev(`location.href = '/app/login'`); await wait(900); await frame.waitFor(`!!document.querySelector('input[type=email]')`, 15000); await settle(frame);
  await typeIn(frame, "input[type=email]", ACCOUNTS[5].email); await typeIn(frame, "input[type=password]", PASSWORD); await clickIn(frame, "button[type=submit]");
  await frame.waitFor(`location.pathname === '/app/dashboard'`, 20000); await settle(frame);
  const idText = (await inspect(frame)).text;
  await push(frame, "/profile"); await settle(frame);
  const hasSwitch = await frame.ev(`[...document.querySelectorAll('button, label, [role=radio], [role=option], a')].some((e) => /^(English|Inggris)$/i.test(e.textContent.trim()))`);
  ok("the profile page has a language switch", hasSwitch);
  if (hasSwitch) {
    await frame.ev(`[...document.querySelectorAll('button, label, [role=radio], [role=option], a')].find((e) => /^(English|Inggris)$/i.test(e.textContent.trim())).click(); true`);
    await wait(1200); await settle(frame);
    await push(frame, "/dashboard"); await settle(frame);
    const enText = (await inspect(frame)).text;
    ok("switching to English changes the words of the dashboard", enText !== idText && /Dashboard/.test(enText) && /Dasbor/.test(idText), `id: "${idText.slice(0, 50)}" en: "${enText.slice(0, 50)}"; document lang "${await frame.ev(`document.documentElement.lang`)}"`);
    const savedLocale = sql("select locale from users where email = ?", ACCOUNTS[5].email)[0]?.locale;
    ok("the choice was saved in the person's row in the SQLite file (a write through the API)", savedLocale === "en", String(savedLocale));
    await shot("lms-4-english");
  }

  // ---- a write that must still be there after a reload, from the real forms
  await frame.ev(`localStorage.clear(); true`); await frame.ev(`location.href = '/app/login'`); await wait(900); await frame.waitFor(`!!document.querySelector('input[type=email]')`, 15000); await settle(frame);
  await typeIn(frame, "input[type=email]", ACCOUNTS[0].email); await typeIn(frame, "input[type=password]", PASSWORD); await clickIn(frame, "button[type=submit]");
  await frame.waitFor(`location.pathname === '/app/dashboard'`, 20000); await settle(frame);
  await push(frame, "/cities"); await settle(frame);
  const citiesBefore = sql("select count(*) c from cities")[0].c;
  const opened = await frame.ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(add|new|tambah|buat)/i.test(x.textContent.trim()) || /city|kota/i.test(x.textContent.trim()) && /add|tambah|\\+/i.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
  await wait(600);
  const hasInput = opened && await frame.ev(`!!document.querySelector('dialog input, [role=dialog] input, form input[type=text], input[name=name]')`);
  if (hasInput) {
    await typeIn(frame, "[role=dialog] input, dialog input, form input[type=text], input[name=name]", "Kota Demo");
    await frame.ev(`(() => { const d = document.querySelector('[role=dialog], dialog, form'); const b = [...d.querySelectorAll('button')].find((x) => /save|simpan|add|tambah|create|buat/i.test(x.textContent) && !x.disabled); if (b) b.click(); })()`);
    await wait(1200); await settle(frame);
    const after = sql("select count(*) c, group_concat(name) n from cities")[0];
    ok("a city made in the real form is a row in the SQLite file", after.c === citiesBefore + 1 && String(after.n).includes("Kota Demo"), `${citiesBefore} -> ${after.c} ${after.n}`);
    await frame.ev(`location.reload()`); await wait(900); await settle(frame);
    ok("it is still on the page after a reload", await frame.waitFor(`document.body.innerText.includes('Kota Demo')`, 8000));
  } else info("the Cities page add form was not found by the test (a write through a form was not tried there)");

  // ---- what a real program tries that the frame's rules do not allow: each must fail cleanly, and is reported
  const downloadsBefore = listDownloads();
  const pagesBefore = (await F.targets()).filter((t) => t.type === "page").length;
  F.downloads.length = 0;
  const caps = await frame.ev(`(async () => {
    const out = {};
    try { out.popup = window.open('about:blank') === null ? 'blocked' : 'OPENED'; } catch (e) { out.popup = 'error ' + e.name; }
    // (a native dialog is not tried here: this card allows them, and one would wait for a person; tests/live.mjs answers one)

    out.print = typeof window.print;
    out.geolocation = await new Promise((res) => { try { navigator.geolocation.getCurrentPosition(() => res('ALLOWED'), (er) => res('refused, code ' + er.code), { timeout: 4000 }); } catch (e) { res('error ' + e.name); } });
    out.clipboard = await navigator.clipboard.writeText('x').then(() => 'ALLOWED', (e) => 'refused ' + e.name);
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['x'])); a.download = 't.txt'; document.body.appendChild(a); a.click(); a.remove(); out.download = 'clicked (a sandbox without allow-downloads drops it)'; } catch (e) { out.download = 'error ' + e.name; }
    out.notification = typeof Notification === 'undefined' ? 'none' : Notification.permission;
    out.localStorage = (() => { try { localStorage.setItem('k', '1'); return 'works'; } catch (e) { return 'error ' + e.name; } })();
    out.cookies = (() => { try { document.cookie = 'probe=1; path=/'; return document.cookie.includes('probe=1') ? 'works' : 'dropped'; } catch (e) { return 'error ' + e.name; } })();
    out.indexedDB = typeof indexedDB !== 'undefined' ? 'present' : 'none';
    out.serviceWorker = 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length + ' registered' : 'none';
    return out;
  })()`);
  info("what the frame allows a real program: " + JSON.stringify(caps));
  await wait(1500);
  ok("the card allows downloads and no pop-ups: a file was offered for saving (the test denied it, so nothing reached the PC) and the refused pop-up opened no window", F.downloads.length >= 1 && JSON.stringify(listDownloads()) === JSON.stringify(downloadsBefore) && (await F.targets()).filter((t) => t.type === "page").length === pagesBefore, `${F.downloads.length} download(s) offered, ${listDownloads().length} files in Downloads, ${pagesBefore} windows`);
  ok("a real program's local storage and cookies work in the frame", caps.localStorage === "works" && caps.cookies === "works", `${caps.localStorage}, ${caps.cookies}`);
  ok("what this card does not allow (a pop-up window, the location) is refused and does not open anything", caps.popup === "blocked" && /refused/.test(caps.geolocation), `${caps.popup}; ${caps.geolocation}`);
  ok("location is refused at once and does not hang (the page's own refusal path runs)", /refused|error/.test(caps.geolocation), caps.geolocation);

  // ---- the printing page (a Try Out paper laid out on A4 sheets for "Save as PDF")
  await push(frame, "/try-out/papers/1/print"); await settle(frame, 700, 20000); await wait(1500);
  const paper = await frame.ev(`(() => ({ path: location.pathname, text: document.body.innerText.replace(/\\s+/g, ' '), sheets: document.querySelectorAll('[class*=paper-page], [class*=sheet], [class*=page]').length, imgs: [...document.images].map((i) => i.complete && i.naturalWidth > 0), buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean) }))()`);
  ok("the printing page lays the paper out: the letterhead, the numbered questions and their choices, with every picture loaded", paper.text.includes("Practice") && /1\.\s*What color/.test(paper.text) && paper.imgs.length >= 2 && paper.imgs.every(Boolean) && paper.sheets >= 1, `${paper.imgs.length} pictures, ${paper.sheets} sheets, ${paper.text.length} letters`);
  await shot("lms-7-print-paper");
  const key = await frame.ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Kunci/.test(x.innerText)); if (!b) return false; b.click(); return true; })()`);
  await settle(frame, 700, 15000); await wait(800);
  ok("the answer-key copy is asked for again from the program and laid out", key && [...frame.events.requests.values()].some((r) => /try-out-papers\/1\/print\?.*solutions/.test(r.url) && r.status === 200), [...frame.events.requests.values()].filter((r) => /print/.test(r.url)).map((r) => r.status + " " + r.url.slice(-50)).join(" | "));
  await shot("lms-7-print-key");
  const printed = await frame.ev(`(() => { window.__printed = 0; window.print = function () { window.__printed++; return undefined; }; const b = [...document.querySelectorAll('button')].find((x) => /Unduh/.test(x.innerText)); if (!b) return 'no button'; b.click(); return 'clicked'; })()`);
  await wait(2500);
  ok("the PDF button runs the program's own print call, which the frame refuses without a dialog, and the page stays alive", printed === "clicked" && (await frame.ev(`window.__printed`)) >= 1 && (await frame.ev(`document.body.innerText.length`)) > 100, `${printed}, print() called ${await frame.ev(`window.__printed`)} time(s)`);

  // ---- a file uploaded through the program's own form (the bulk import of people), and the template download beside it
  await push(frame, "/people/students"); await settle(frame, 600, 15000); await wait(800);
  const tokenNow = await frame.ev(`localStorage.getItem('lms_api_token') || sessionStorage.getItem('lms_api_token')`);
  const tpl = await frame.ev(`fetch('/api/v1/people/students/import/template', { headers: { Authorization: 'Bearer ${tokenNow}' } }).then(async (r) => [r.status, r.headers.get('content-type'), await r.text()])`);
  const header = tpl[2].split("\n")[0];
  const cols = header.split(",");
  const row = (n) => cols.map((k) => ({ name: `Impor Siswa ${n}`, email: `impor${n}@quantumresearch.test`, password: PASSWORD, branch: "PTK", class: "12.1", joined_at: "2026-11-01" })[k] ?? "").join(",");
  const csv = [header, row(1), row(2), row(3)].join("\n") + "\n";
  const csvPath = path.join(os.tmpdir(), "lms-live-import.csv"); fs.writeFileSync(csvPath, csv);
  const usersBefore = sql("select count(*) c from users")[0].c;
  await frame.ev(`[...document.querySelectorAll('button')].find((b) => /Impor/.test(b.innerText)).click()`);
  await frame.waitFor(`!!document.querySelector('input[type=file]')`, 8000);
  await frame.send("DOM.enable");
  const fileEl = await frame.send("Runtime.evaluate", { expression: `document.querySelector('input[type=file]')` });
  const setRes = await frame.send("DOM.setFileInputFiles", { files: [csvPath], objectId: fileEl.result.result.objectId });
  await wait(700);
  frame.reset();
  const filedown = listDownloads();
  await frame.ev(`(() => { const t = [...document.querySelectorAll('button')].find((b) => /templat|template/i.test(b.innerText)); if (t) t.click(); })()`);
  await wait(2500);
  ok("the template download button: the program is asked for the template and answers, and the frame offers the file for saving (the test denied it: nothing reached the PC)", [...frame.events.requests.values()].some((r) => /import\/template/.test(r.url) && r.status === 200) && F.downloads.some((d) => /template|import|csv/i.test((d.name ?? "") + (d.url ?? ""))) && JSON.stringify(listDownloads()) === JSON.stringify(filedown), `${F.downloads.length} download(s), ${listDownloads().length} files in Downloads`);
  const go = await frame.ev(`(() => { const b = document.querySelector('button[type=submit][form=import-people-form]') || [...document.querySelectorAll('[role=dialog] button, dialog button')].reverse().find((x) => !x.disabled && /impor|unggah|upload|simpan/i.test(x.innerText)); if (!b || b.disabled) return 'no button'; b.click(); return 'clicked'; })()`);
  await settle(frame, 800, 20000); await wait(1000);
  const made = sql("select count(*) c from users where email like 'impor%@quantumresearch.test' and role = 'student'")[0].c;
  ok("a CSV chosen in the real file box and sent by the real form (multipart) made three students in the SQLite file", setRes.error === undefined && go === "clicked" && made === 3 && sql("select count(*) c from users")[0].c === usersBefore + 3, `file set ${JSON.stringify(setRes.error ?? "ok")}, ${go}, ${made} new students; ${cols.length} columns`);
  ok("they are in the class named in the file, and the program's own page lists them", sql("select count(*) c from classroom_student cs join users u on u.id = cs.student_id where u.email like 'impor%@quantumresearch.test'")[0].c >= 3);

  // ---- a picture chosen in the question editor's own "insert a picture" form: the program keeps it in its cloud storage, which here is the stand-in of the card (never the project's real bucket)
  await frame.ev(`localStorage.clear(); location.href = '/app/login'`); await wait(900); await frame.waitFor(`!!document.querySelector('input[type=email]')`, 15000); await settle(frame);
  await typeIn(frame, "input[type=email]", ACCOUNTS[4].email); await typeIn(frame, "input[type=password]", PASSWORD); await clickIn(frame, "button[type=submit]");
  await frame.waitFor(`location.pathname === '/app/dashboard'`, 20000); await settle(frame);
  await push(frame, "/quiz-maker/1/questions/new"); await settle(frame, 700, 15000); await wait(1200);
  const picPath = path.join(os.tmpdir(), "lms-live-picture.png"); fs.writeFileSync(picPath, makePng(400, 300));
  const imagesBefore = sql("select count(*) c from images")[0].c;
  await frame.ev(`[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').trim() === 'Sisipkan gambar').click()`);
  await frame.waitFor(`!!document.querySelector('input[type=file]')`, 8000);
  await frame.send("DOM.enable");
  const picEl = await frame.send("Runtime.evaluate", { expression: `document.querySelector('input[type=file]')` });
  const picSet = await frame.send("DOM.setFileInputFiles", { files: [picPath], objectId: picEl.result.result.objectId });
  await wait(600); frame.reset();
  const picGo = await frame.ev(`(() => { const b = [...document.querySelectorAll('[role=dialog] button, dialog button')].reverse().find((x) => /unggah|upload/i.test(x.innerText) && !x.disabled); if (!b) return 'no button'; b.click(); return 'clicked'; })()`);
  await settle(frame, 800, 20000); await wait(1500);
  const picRow = sql("select path from images order by id desc limit 1")[0];
  const picFile = picRow ? path.join(DATA, "bucket", "objects", picRow.path) : null;
  const picBytes = picFile && fs.existsSync(picFile) ? fs.readFileSync(picFile) : null;
  ok("a picture chosen in the editor's own file box was sent by the real form (multipart), and the program kept it in the card's cloud stand-in as a compressed JPEG", picSet.error === undefined && picGo === "clicked" && sql("select count(*) c from images")[0].c === imagesBefore + 1 && !!picBytes && picBytes[0] === 0xff && picBytes[1] === 0xd8, `${picGo}; ${picBytes ? picBytes.length + " bytes in cloud/" + picRow.path : "no file"}`);
  const picShown = await frame.ev(`[...document.querySelectorAll('img')].filter((i) => /content-images/.test(i.src)).map((i) => [new URL(i.src).host, i.complete, i.naturalWidth])`);
  ok("the editor shows the picture, loaded from the program's own address (400 wide), not from anywhere else", picShown.length >= 1 && picShown.every(([h, done, w]) => /^127\.0\.0\.1:/.test(h) && done && w === 400), JSON.stringify(picShown));
  ok("the cloud stand-in's own copy is what the browser gets, byte for byte", picBytes && sha(picBytes) === await frame.ev(`fetch(document.querySelector('img[src*="content-images"]').src).then((r) => r.arrayBuffer()).then((b) => crypto.subtle.digest('SHA-256', b)).then((h) => Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, '0')).join(''))`));

  // ---- the other three places where a person chooses a file, each tried the way a person does: an assignment handed in (a teacher makes it, a student hands in a picture), a leave request with an attachment
  // (the form's date picker, reason and file), and the photos of a class meeting (the scenery and two whiteboard pictures). Every file goes to the card's cloud stand-in, never to the project's bucket.
  const DIMAS = "dimas.jatmiko@quantumresearch.test";
  const signIn = async (email) => {
    await frame.ev(`localStorage.clear(); location.href = '/app/login'`); await wait(900); await frame.waitFor(`!!document.querySelector('input[type=email]')`, 15000); await settle(frame);
    await typeIn(frame, "input[type=email]", email); await typeIn(frame, "input[type=password]", PASSWORD); await clickIn(frame, "button[type=submit]");
    await frame.waitFor(`location.pathname === '/app/dashboard'`, 20000); await settle(frame); await wait(1500);
    await frame.ev(`[...document.querySelectorAll('button')].find((b) => /^(Nanti saja|Not now|Later)$/.test(b.innerText.trim()))?.click(); 1`);
  };
  const chooseFiles = async (selector, files) => {
    await frame.send("DOM.enable");
    const el = await frame.send("Runtime.evaluate", { expression: selector });
    const r = await frame.send("DOM.setFileInputFiles", { files, objectId: el.result.result.objectId });
    await wait(600); frame.reset(); return r.error === undefined;
  };
  const apiCalls = () => [...frame.events.requests.values()].filter((r) => /\/api\//.test(r.url) && !/notifications|pending/.test(r.url)).map((r) => `${r.status} ${r.method} ${r.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, "")}`);
  // right after a sign-in the first push can be undone by the page's own redirect to the dashboard, so the test asks again until it is where it asked to be
  const goTo = async (p) => {
    for (let k = 0; k < 5; k++) {
      await frame.ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(${JSON.stringify(p)}).then(() => 1)`); await settle(frame, 800, 12000); await wait(800);
      if ((await frame.ev(`location.pathname`)) === "/app" + p) return true;
      await wait(1200);
    }
    return false;
  };
  const buttonByText = (text) => frame.waitFor(`[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === ${JSON.stringify(text)})`, 15000);
  // press a button of the page: waits for it, and says where the page was when it is not there
  const clickBtn = async (selector, rx, label) => {
    const find = `[...document.querySelectorAll(${JSON.stringify(selector)})].find((b) => ${rx}.test(b.innerText.trim()))`;
    if (!(await frame.waitFor(`!!${find}`, 15000))) throw new Error(`no button "${label}" (${selector}); the page: ` + (await frame.ev(`location.pathname + ' | ' + document.body.innerText.replace(/\\s+/g, ' ').slice(0, 250)`)));
    await frame.ev(`${find}.click(); 1`);
  };
  const isJpegFile = (f) => { try { const b = fs.readFileSync(f); return b[0] === 0xff && b[1] === 0xd8; } catch { return false; } };
  const cloudFile = (rel) => { const f = path.join(DATA, "bucket", "objects", rel); return fs.existsSync(f) ? fs.readFileSync(f) : null; };
  const isJpeg = (b) => !!b && b[0] === 0xff && b[1] === 0xd8;
  const smallPng = path.join(os.tmpdir(), "lms-live-submit.png"); fs.writeFileSync(smallPng, makePng(200, 150));
  const notPicture = path.join(os.tmpdir(), "lms-live-notes.txt"); fs.writeFileSync(notPicture, "not a picture or a pdf\n");

  // the teacher makes an assignment in the program's own content form (a title, PDF and pictures allowed)
  await signIn(DIMAS);
  await goTo("/meetings/1");
  await clickBtn('button', '/^(Tambah Konten|Add Content)$/', 'Tambah Konten'); await wait(900);
  await clickBtn('[role=dialog] button', '/Tugas|Assignment/', 'Tugas'); await settle(frame, 800, 12000); await wait(1000);
  await typeIn(frame, "#schema-title", "Tugas uji unggah berkas");
  await frame.ev(`(() => { const cs = document.querySelectorAll('input[type=checkbox]'); cs[0].click(); cs[4].click(); return 1; })()`); await wait(300);
  frame.events.requests.clear();
  await clickBtn('button[type=submit]', '/^(Buat|Create)$/', 'Buat'); await settle(frame, 900, 15000); await wait(800);
  ok("a teacher made an assignment in the program's own form (it is in the SQLite file)", apiCalls().some((l) => /^201 POST .*\/assignment$/.test(l)) && sql("select count(*) c from assignments where title = 'Tugas uji unggah berkas'")[0].c === 1, apiCalls().join(" | "));

  // the student hands in a picture with the file box of the form, and a file of a kind the assignment does not take
  await signIn(ACCOUNTS[5].email);
  await goTo("/meetings/1");
  await clickBtn('button', '/^(Kumpulkan|Hand In)$/', 'Kumpulkan'); await wait(900);
  ok("the form chosen a file that the assignment does not take: it was sent and the program said no, in the page", await (async () => {
    const chose = await chooseFiles(`document.querySelector('main form input[type=file]')`, [notPicture]);
    frame.events.requests.clear();
    await frame.ev(`document.querySelector('main form button[type=submit]').click(); 1`); await settle(frame, 900, 15000); await wait(600);
    const refused = apiCalls().some((l) => /^(422|400) POST .*\/assignments\/\d+\/submit$/.test(l));
    return chose && refused && sql("select count(*) c from submissions")[0].c === 0;
  })(), apiCalls().join(" | "));
  const subsBefore = sql("select count(*) c from submissions")[0].c;
  const chosen = await chooseFiles(`document.querySelector('main form input[type=file]')`, [smallPng]);
  const shownName = await frame.ev(`document.querySelector('main form').innerText.includes('lms-live-submit.png')`);
  frame.events.requests.clear();
  await frame.ev(`document.querySelector('main form button[type=submit]').click(); 1`); await settle(frame, 900, 15000); await wait(800);
  const sub = sql("select file_path, student_id from submissions order by id desc limit 1")[0];
  ok("a picture chosen in the assignment's file box was handed in by the real form (multipart), and the program kept it as a JPEG in the cloud stand-in", chosen && shownName && sql("select count(*) c from submissions")[0].c === subsBefore + 1 && !!sub && isJpeg(cloudFile(sub.file_path)), `${sub ? sub.file_path : "no row"}; ${apiCalls().join(" | ")}`);
  ok("the page says it was handed in", await frame.ev(`/Anda sudah mengumpulkan ini|You have already handed this in/.test(document.body.innerText)`));

  // a teacher's leave request, with an attachment, through the date picker, the reason box and the file box
  await signIn(DIMAS);
  await clickBtn('button', '/^(Buat pengajuan|New request)$/', 'Buat pengajuan'); await wait(900);
  await clickBtn('[role=dialog] button', '/^(Izin|Leave)/', 'Izin'); await settle(frame, 700, 10000); await wait(900);
  await clickBtn('[role=dialog] button', '/Pilih rentang|Pick a date range/', 'Pilih rentang'); await wait(700);
  const dayButton = (d) => frame.ev(`(() => { const dlgs = [...document.querySelectorAll('[role=dialog]')]; const b = [...dlgs[dlgs.length - 1].querySelectorAll('button')].find((x) => x.innerText.trim() === '${d}'); if (!b) return false; b.click(); return true; })()`);
  const today = new Date().getDate(); const [d1, d2] = today < 28 ? [today, today + 1] : [today - 1, today];
  const picked = (await dayButton(d1)) && (await wait(200), await dayButton(d2));
  await wait(300);
  await clickBtn('[role=dialog] button', '/^(Terapkan|Apply)$/', 'Terapkan'); await wait(600);
  await typeIn(frame, "[role=dialog] textarea", "Demam, uji unggah lampiran");
  const leaveFile = await chooseFiles(`document.querySelector('[role=dialog] input[type=file]')`, [smallPng]);
  frame.events.requests.clear();
  await frame.ev(`document.querySelector('[role=dialog] button[type=submit]').click(); 1`); await settle(frame, 900, 15000); await wait(800);
  const leave = sql("select attachment_path, status, type from leave_requests order by id desc limit 1")[0];
  ok("a leave request with an attachment was sent by the real form (date picker, reason, file box), and the program kept the file as a JPEG in the cloud stand-in", picked && leaveFile && apiCalls().some((l) => /^201 POST .*\/leave-requests$/.test(l)) && !!leave && leave.status === "pending" && isJpeg(cloudFile(leave.attachment_path)), `${leave ? leave.type + " " + leave.attachment_path : "no row"}; ${apiCalls().join(" | ")}`);
  ok("the form closed after the request was made", await frame.ev(`!document.querySelector('[role=dialog]')`));

  // the photos of a meeting: the scenery of the class and two whiteboard pictures, with the attendance form
  await goTo("/meetings/1/attendance");
  const f1 = await chooseFiles(`document.querySelectorAll('main input[type=file]')[0]`, [smallPng]);
  const f2 = await chooseFiles(`document.querySelectorAll('main input[type=file]')[1]`, [smallPng, smallPng]);
  frame.events.requests.clear();
  await frame.ev(`[...document.querySelectorAll('main button[type=submit]')].find((b) => /Simpan Kehadiran|Save Attendance/.test(b.innerText)).click(); 1`); await settle(frame, 1000, 25000); await wait(1500);
  const scenery = sql("select scenery_photo_path p from meetings where id = 1")[0].p;
  const boards = sql("select photo_path p from meeting_whiteboard_photos where meeting_id = 1 order by id").map((r) => r.p);
  ok("a scenery picture and two whiteboard pictures chosen in the attendance form were kept as JPEGs in the cloud stand-in", f1 && f2 && apiCalls().some((l) => /^200 POST .*\/meeting-attendance\/1$/.test(l)) && isJpeg(cloudFile(scenery)) && boards.length === 2 && boards.every((p) => isJpeg(cloudFile(p))), `${scenery}; ${boards.length} board pictures; ${apiCalls().join(" | ")}`);
  const shown = await frame.ev(`[...document.querySelectorAll('img')].filter((i) => /meetings\\//.test(i.src)).map((i) => [new URL(i.src).host, i.complete, i.naturalWidth])`);
  ok("the meeting page shows the whiteboard pictures from the program's own address (the scenery picture sits in a folded part of the page and is only loaded when it is opened)", shown.length >= 3 && shown.every(([h]) => /^127\.0\.0\.1:/.test(h)) && shown.filter(([, done, w]) => done && w > 0).length >= 2, JSON.stringify(shown));

  // ---- the go-between under what a real program asks of it: other methods, big bodies, many requests at once, odd addresses
  const wire = await frame.ev(`(async () => {
    const out = {};
    const t = Date.now();
    out.head = await fetch('/app/', { method: 'HEAD' }).then((r) => [r.status, r.headers.get('content-length') !== null]);
    const big = JSON.stringify({ email: 'x@x.test', password: 'x'.repeat(5 * 1024 * 1024) });
    out.bigBody = await fetch('/api/v1/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: big }).then((r) => r.status);
    out.bigBodyMs = Date.now() - t;
    const par = await Promise.all(Array.from({ length: 40 }, () => fetch('/up', { cache: 'no-store' }).then((r) => r.status)));
    out.parallel = [par.length, par.filter((x) => x === 200).length];
    out.unicode = await fetch('/up?q=' + encodeURIComponent('kelas ✓ 12.1 & "x"')).then((r) => r.status);
    out.notFound = await fetch('/no-such-page-' + Date.now(), { headers: { Accept: 'application/json' } }).then((r) => r.status);
    out.range = await fetch([...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href).find((h) => h.startsWith(location.origin)) || '/app/', { headers: { Range: 'bytes=0-99' } }).then((r) => r.status);
    out.methods = await Promise.all(['PUT', 'PATCH', 'DELETE'].map((m) => fetch('/api/v1/login', { method: m, headers: { Accept: 'application/json' } }).then((r) => r.status)));
    out.redirectFollowed = await fetch('/', { redirect: 'follow' }).then((r) => [r.status, new URL(r.url).pathname]);
    return out;
  })()`);
  info("the go-between: " + JSON.stringify(wire));
  ok("HEAD is answered like the program answers it", wire.head[0] === 200);
  ok("a 5 MB request body goes through and the program's own answer comes back (not a failure of the go-between)", [401, 413, 422, 429].includes(wire.bigBody), `${wire.bigBody} in ${wire.bigBodyMs} ms`);
  ok("forty requests at once are all answered by a program that handles one at a time", wire.parallel[0] === 40 && wire.parallel[1] === 40, JSON.stringify(wire.parallel));
  ok("an address with letters outside ASCII, spaces and quotes is passed on whole", wire.unicode === 200);
  ok("a missing page is the program's own 404, not the go-between's", wire.notFound === 404);
  ok("other methods (PUT, PATCH, DELETE) reach the program and come back with its own answers", wire.methods.every((x) => [401, 404, 405, 422].includes(x)), wire.methods.join(","));
  ok("a redirect from the program's own address (/) leads to the front end under /app/ on the same address", wire.redirectFollowed[0] === 200 && wire.redirectFollowed[1].startsWith("/app"), wire.redirectFollowed.join(" "));

  // ---- the five devices: the page sees the device, and does not scroll sideways
  await push(frame, "/dashboard"); await settle(frame);
  for (const [label, w, h] of [["Small phone, 320 px wide", 320, 568], ["Phone, 390 px wide", 390, 844], ["Tablet, 768 px wide", 768, 1024], ["Laptop, 1024 px wide", 1024, 640], ["Desktop, 1440 px wide", 1440, 900]]) {
    await press(label); await wait(1500);
    const pages = [];
    for (const p of ["/dashboard", "/people/students", "/classrooms", "/schedules", "/recap", "/profile"]) {
      await push(frame, p); await settle(frame, 400, 12000);
      const i = await inspect(frame); pages.push(`${p.slice(1)}:${i.overflowX <= 1 ? "ok" : "overflow " + i.overflowX}`);
      if (i.overflowX > 1) problems.push(`${label.split(",")[0]} ${p}: scrolls sideways by ${i.overflowX}`);
    }
    await push(frame, "/dashboard"); await settle(frame, 400, 12000); await wait(500);
    const fill = await frame.ev(`(() => { const e = document.elementFromPoint(Math.round(innerWidth / 2), innerHeight - 3); return { tag: e ? e.tagName : null, inApp: !!(e && e.closest('#app')), vh: innerHeight, ch: document.documentElement.clientHeight, sh: document.documentElement.scrollHeight, app: document.querySelector('#app').getBoundingClientRect().height }; })()`);
    ok(`${label.split(",")[0]}: the program's layout reaches the bottom of the device screen (nothing blank under it)`, fill.inApp, JSON.stringify(fill));
    const i = await inspect(frame);
    ok(`${label.split(",")[0]}: the program sees ${w} wide, and its pages do not scroll sideways`, i.w >= w - 1 && i.w <= w + 2 && !pages.some((x) => x.includes("overflow")), `${i.w} wide; ${pages.join(" ")}`);
    await shot("lms-5-" + w);
  }
  await press("Laptop, 1024 px wide"); await wait(800);

  // ---- pick mode works on a real front end
  await push(frame, "/dashboard"); await settle(frame);
  await press("Pick a part and leave a note"); await wait(500);
  const rect = await frame.ev(`(() => { const e = document.querySelector('h1, h2, main'); const b = e.getBoundingClientRect(); return [b.left + 20, b.top + 10]; })()`);
  await frame.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect[0], y: rect[1] }); await wait(300);
  await frame.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect[0], y: rect[1], button: "left", clickCount: 1 });
  await frame.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect[0], y: rect[1], button: "left", clickCount: 1 });
  ok("pick mode: a click on the real page opens a note box for the part, and the click does not reach the page", await c.waitFor(`!!document.querySelector('[aria-label="Note for this part"]')`, 4000, 100));
  await shot("lms-6-pick");
  await press("Stop picking parts (Esc)"); await wait(400);

  // ---- Esc belongs to the program (it closes its own dialogs); it does not take the owner back to the cards
  await frame.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await frame.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await wait(700);
  ok("Esc pressed inside the real program leaves the owner in it", !!(await frameBox()));

  // ---- Back keeps it running, Stop stops both programs
  await press("Back to the mockups (Esc)"); await wait(2500);
  ok("on the cards the live card says it is running", (await sheetText()).includes("Running"));
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label=${JSON.stringify("Open " + CARD_NAME)}]').click(); true`);
  ok("opening it again shows the program at once, still signed in", await c.waitFor(`!!document.querySelector('iframe[title]')`, 8000, 200));
  ok("Stop stops the launcher and PHP behind it", await press("Stop the program") && await gone(PORT) && await gone(PORT + 1000));

  // ---- Stop keeps the data, and the sheet says so, with the choice
  await wait(1500);
  const afterStop = await sheetText();
  ok("after Stop the sheet shows what the card kept (size and age), the choice to carry on, begin again or delete it, and the demo logins", /Data from the last run/.test(afterStop) && afterStop.includes("Start with the last data") && afterStop.includes("Start fresh") && afterStop.includes("Delete the data") && afterStop.includes("Demo accounts (8)"), afterStop.replace(/\s+/g, " ").slice(0, 300));
  const keptCity = sql("select count(*) c from cities where name = 'Kota Demo'")[0].c;
  const keptPicture = picRow && isJpegFile(picFile);

  // ---- carrying on with the data of the last run: what the last run made is still there, the browser's storage is still forgotten
  const sKeep = await startProgram(false);
  ok("started again with the data of the last run", sKeep.up, `${sKeep.secs} s`);
  frame = await F.frame(new URL((await frameBox()).src).origin + "/"); await frame.waitFor(`document.querySelector('#app')?.children.length > 0`, 20000); await settle(frame);
  st = await appState(frame);
  ok("the data of the last run is still there: the city that was written, and the picture in the fake bucket, and nothing was made again", keptCity === 1 && sql("select count(*) c from cities where name = 'Kota Demo'")[0].c === 1 && keptPicture === true && isJpegFile(picFile), JSON.stringify({ keptCity, keptPicture }));
  ok("the browser still forgot the last run: nobody is signed in", !st.token && st.path === "/app/login", JSON.stringify({ t: st.token, p: st.path }));
  ok("Stop stops both programs", await press("Stop the program") && await gone(PORT) && await gone(PORT + 1000));

  // ---- Start fresh: the data of the last run is taken away first, and everything is made again
  const s2 = await startProgram(true);
  ok("started again, from nothing", s2.up, `${s2.secs} s`);
  frame = await F.frame(new URL((await frameBox()).src).origin + "/"); await frame.waitFor(`document.querySelector('#app')?.children.length > 0`, 20000); await settle(frame);
  st = await appState(frame);
  ok("the demo data is made again: the city of the last run is gone, the seeded one is back, and so are the demo logins", sql("select count(*) c from cities where name = 'Kota Demo'")[0].c === 0 && sql("select count(*) c from cities where name = 'Jakarta'")[0].c === 1 && fs.existsSync(path.join(DATA, "accounts.json")));
  ok("the picture of the last run is gone from the fake bucket (Start fresh took the data away)", !isJpegFile(picFile));
  ok("the browser forgot the last run: nobody is signed in, and the old token and language are gone", !st.token && st.path === "/app/login" && (await frame.ev(`localStorage.getItem('lms_locale')`)) !== "en", JSON.stringify({ t: st.token, p: st.path }));
  const regs = await frame.ev(`navigator.serviceWorker.getRegistrations().then((r) => r.length)`);
  info(`service worker registrations after the second start: ${regs}`);

  await c.ev(`document.querySelector('section[data-sheet] button[aria-label^="Close"]').click(); true`);
  const outside = [...F.hosts].filter((h) => !/^127\.0\.0\.1:/.test(h) && h !== "");
  info("every address the pages asked for besides this PC's own: " + JSON.stringify(outside));
  ok("nothing was asked of the project's cloud storage or any other host of the project: the pages asked only this PC, and at most the fonts and the like", outside.every((h) => /(^|\.)(googleapis|gstatic|openstreetmap)\.(com|org)$/.test(h)), outside.join(", "));
  ok("closing the sheet stops both programs", await gone(PORT, 20000) && await gone(PORT + 1000, 20000));

  // ---- Kona's own window is reloaded while the program runs (a reload does not give the page a chance to stop it)
  await c.ev(`document.querySelector('[aria-label="Open Mockups"]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Mockups'`, 5000, 100); await wait(1200);
  const s3 = await startProgram(false);
  ok("started once more, carrying on with the data", s3.up, `${s3.secs} s`);
  await openSheet();
  await wait(1500);
  ok("after the reload the program still runs, and the card says so", await answers(PORT) && (await sheetText()).includes("Running"));
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label=${JSON.stringify("Open " + CARD_NAME)}]').click(); true`);
  ok("the card shows the running program again at once", await c.waitFor(`!!document.querySelector('iframe[title]')`, 15000, 300));
  // the last act: "Stop the program and delete its data" (the trash button), which leaves the card with nothing kept
  ok("the data is there while the program runs", fs.existsSync(path.join(DATA, "demo.sqlite")));
  ok("the trash button asks before it deletes", await press("Stop the program and delete its data") && await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100) && (await c.ev(`document.querySelector('[role=dialog]').innerText`)).includes("cannot be undone"));
  await pressText("Stop and delete", "[role=dialog]");
  ok("Stop and delete stops both programs and takes the card's data away", await gone(PORT) && await gone(PORT + 1000) && await (async () => { for (let i = 0; i < 40; i++) { if (!fs.existsSync(DATA)) return true; await wait(250); } return false; })());
  await wait(1200);
  ok("the sheet no longer lists data for the card", !/Data from the last run/.test(await sheetText()));
} catch (e) {
  note("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 600)); failed++;
  try { await invoke("live_stop"); } catch {}
} finally {
  await wait(1500);
  const after = fingerprint();
  ok("the project's own databases are byte for byte what they were (nothing real was touched)", JSON.stringify(before) === JSON.stringify(after), before.map((x) => x.split(" ")[0]).join(","));
  try { const { execSync } = await import("node:child_process"); const g = execSync("git status --short", { cwd: LMS }).toString().trim(); ok("the project's git has no change from the run", g === "", g.slice(0, 200)); } catch (e) { info("git status could not be read: " + String(e).slice(0, 80)); }
  info(`free memory of the PC: ${Math.round(memBefore / 1e6)} MB before, ${Math.round(os.freemem() / 1e6)} MB after the program stopped`);
  ok("the programs are not left running", !(await answers(PORT)) && !(await answers(PORT + 1000)));
  c.close(); F.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
if (process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE, lines.join("\n") + "\n");
process.exit(failed ? 1 : 0);
