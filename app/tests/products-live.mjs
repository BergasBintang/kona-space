// The Live mockup (decision 94) tried on OTHER real products of this PC, one after the other, in the REAL window over the DevTools port: the Quantum Research CBT (FastAPI and Next.js, SQLite),
// Qwork and the Miralis Admin console (Laravel, a Vue front end, PostgreSQL). For this PC only. The cards live in a scratch project folder (PRODUCTS_ROOT, default D:\temp\kona-products)
// that this test adds to Kona's project list and removes again; the products' own folders are only read. Run it like tests/lms-live.mjs (a built debug Kona with the test port, the owner's own
// Kona closed):   PRODUCT=cbt node tests/products-live.mjs   (or qwork, or admin).
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { attach } from "./cdp.mjs";
import { attachFrames } from "./cdp-frames.mjs";

const PRODUCT = process.env.PRODUCT || "cbt";
const ROOT = process.env.PRODUCTS_ROOT || "D:\\temp\\kona-products";
const PSQL = "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe";
const SHOTS = process.env.SHOT_DIR || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// what each product is: its card and how a person signs in. WHO signs in (the demo accounts of the card, with their logins and the pages to try) is read from `accounts.json` inside the card, outside this repo, which holds no logins
const PRODUCTS = {
  cbt: {
    repo: "C:\\quantum-research-cbt", real: "git",
    card: "cbt-live", login: { path: "/login", user: "#username", pass: "#password", submit: "button[type=submit]" }, landing: /\/(admin|guru|siswa)\/dashboard/,
  },
  qwork: {
    repo: "C:\\miralis-qwork", real: "pg", realDb: "qwork", env: "C:\\miralis-qwork\\backend\\.env", demoDb: "kona_live_qwork",
    card: "qwork-live", login: { path: "/login", user: "input[type=email]", pass: "input[type=password]", submit: "button[type=submit]" }, landing: /^(?!.*\/login)/,
  },
  admin: {
    repo: "C:\\miralis-admin", real: "pg", realDb: "miralis_admin", env: "C:\\miralis-admin\\backend\\.env", demoDb: "kona_live_admin",
    card: "admin-live", login: { path: "/masuk", user: "input[type=email]", pass: "input[type=password]", submit: "button[type=submit]" }, landing: /^(?!.*\/login)/,
    prelude: "link",
  },
};
const P = PRODUCTS[PRODUCT];
if (!P) throw new Error("PRODUCT must be one of " + Object.keys(PRODUCTS).join(", "));
const CARD_DIR = path.join(ROOT, ".kona", "mockups", P.card);
const conf = JSON.parse(fs.readFileSync(path.join(CARD_DIR, "mockup.json"), "utf8"));
const CARD_NAME = conf.name, PORT = conf.live.port;
const ACCOUNTS = JSON.parse(fs.readFileSync(path.join(CARD_DIR, "accounts.json"), "utf8"));

const c = await attach(Number(process.env.PORT ?? 9223));
const F = await attachFrames(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0; const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const info = (s) => note("INFO " + s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { if (SHOTS) await c.shot(path.join(SHOTS, `${PRODUCT}-${n}.png`)); };
const answers = (port) => new Promise((res) => { const s = net.connect(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });
const gone = async (port, ms = 25000) => { const t = Date.now(); while (Date.now() - t < ms) { if (!(await answers(port))) return true; await wait(300); } return false; };
const pressText = (text, scope = "section[data-sheet]") => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope + " button")})].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const press = (label) => c.ev(`(() => { const b = document.querySelector('button[aria-label=${JSON.stringify(label)}]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
const settle = async (f, quiet = 500, max = 15000) => { const t0 = Date.now(); let last = -1, ch = Date.now(); while (Date.now() - t0 < max) { const pend = [...f.events.requests.values()].filter((r) => r.status === undefined && !r.url.startsWith("data:")).length; const n = f.events.requests.size; if (n !== last) { last = n; ch = Date.now(); } if (pend === 0 && Date.now() - ch >= quiet) return true; await wait(120); } return false; };
const typeIn = async (f, sel, text) => { await f.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.select && e.select(); })()`); await f.send("Input.insertText", { text }); };
const clickReal = async (f, sel) => { const r = await f.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`); if (!r) return false; for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await f.send("Input.dispatchMouseEvent", { type, x: r[0], y: r[1], button: "left", clickCount: 1 }); return true; };

// ---- what must not change in the product itself
const pgEnv = P.real === "pg" ? Object.fromEntries(fs.readFileSync(P.env, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")])) : null;
const psql = (db, sql) => execFileSync(PSQL, ["-h", pgEnv.DB_HOST, "-p", pgEnv.DB_PORT, "-U", pgEnv.DB_USERNAME, "-d", db, "-At", "-c", sql], { env: { ...process.env, PGPASSWORD: pgEnv.DB_PASSWORD }, encoding: "utf8" }).trim();
const realMark = () => P.real === "pg"
  ? psql("postgres", `select tup_inserted + tup_updated + tup_deleted from pg_stat_database where datname = '${P.realDb}'`) + " writes; " + psql(P.realDb, "select count(*) from information_schema.tables where table_schema = 'public'") + " tables; the other databases of the server: " + psql("postgres", "select string_agg(datname, ',' order by datname) from pg_database where datname not like 'kona_live_%'")
  : execSync("git status --short", { cwd: P.repo }).toString().trim() + "|" + (fs.existsSync(path.join(P.repo, "backend", "uploads")) ? fs.readdirSync(path.join(P.repo, "backend", "uploads"), { recursive: true }).length : 0);
const before = realMark();
const projectName = "kona-products-test";
let projectId = null;
const projectsBefore = await invoke("list_projects");
try {
  ok("nothing answers on the card's ports before the start", !(await answers(PORT)) && !(await answers(PORT + 1000)));
  const account = projectsBefore.find((p) => p.account)?.account ?? null;
  if (!account) throw new Error("no project with an account to borrow");
  projectId = (await invoke("add_project", { folder: ROOT, name: projectName, account })).project.id;
  await c.send("Page.bringToFront"); await c.send("Page.reload"); await wait(1800);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(projectName)}) && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1) { b.click(); return true; } } } return false; })()`);
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  await c.ev(`document.querySelector('[aria-label="Open Mockups"]').click(); true`); await wait(1500);
  ok("the card is listed as a live one", (await c.ev(`document.querySelector('section[data-sheet]')?.innerText ?? ''`)).includes(`Live · port ${PORT}`));
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label=${JSON.stringify("Open " + CARD_NAME)}]').click(); true`);
  await c.waitFor(`document.querySelector('section[data-sheet]')?.innerText.includes('Start the program')`, 5000, 100);
  await pressText("Start the program"); await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100);
  info("the question: " + (await c.ev(`document.querySelector('[role=dialog]').innerText.replace(/\\s+/g, ' ')`)).slice(0, 420));
  const t0 = Date.now(); await pressText("Run it", "[role=dialog]");
  let st = null; for (let i = 0; i < 1200; i++) { st = await invoke("live_status"); if (st.phase === "ready" || st.phase === "failed") break; await wait(500); }
  await c.send("Page.bringToFront");
  ok(`${PRODUCT} started and opened in the frame`, st.phase === "ready" && await c.waitFor(`!!document.querySelector('iframe[title]')`, 30000, 300), `${Math.round((Date.now() - t0) / 1000)} s from Run to the frame; ${st.phase === "failed" ? st.message + " | " + (st.log ?? []).slice(-6).join(" / ") : "ready"}`);
  if (st.phase !== "ready") throw new Error("not ready");
  const base = new URL(await c.ev(`document.querySelector('iframe[title]').getAttribute('src')`)).origin;
  await wait(2500);
  const f = await F.frame(base + "/");
  ok("the page is a frame of its own that the test can reach", !!f);
  await f.waitFor(`document.body && document.body.innerText.length > 20`, 25000); await settle(f);
  info("the front page says: " + (await f.ev(`document.body.innerText.replace(/\\s+/g, ' ').slice(0, 120)`)));
  await shot("1-first");

  const problems = [];
  // a product whose first person has no password yet (the Admin console makes its super admin with a one-time link): the link is opened and the password set in the program's own form
  if (P.prelude === "link") {
    const link = new URL(fs.readFileSync(path.join(CARD_DIR, "link.txt"), "utf8").trim());
    f.reset();
    await f.ev(`location.href = ${JSON.stringify(base + link.pathname + link.search)}`);
    await wait(1200); await f.waitFor(`document.querySelectorAll('input[type=password]').length >= 1`, 20000); await settle(f);
    const n = await f.ev(`document.querySelectorAll('input[type=password]').length`);
    for (let i = 0; i < n; i++) { await f.ev(`(() => { const e = document.querySelectorAll('input[type=password]')[${i}]; e.focus(); e.select && e.select(); })()`); await f.send("Input.insertText", { text: P.accounts[0].pass }); }
    await shot("0-set-password");
    const sent = await clickReal(f, "button[type=submit]");
    await wait(2500); await settle(f, 700, 15000);
    const posted = [...f.events.requests.values()].filter((r) => r.method === "POST").map((r) => r.status + " " + new URL(r.url).pathname);
    ok("the super admin sets a password through the product's own one-time link and form", sent && posted.some((x) => /^2\d\d /.test(x)), JSON.stringify(posted) + " " + (await f.ev(`location.pathname`)));
  }
  const signOut = async (f, base) => {
    const got = await f.send("Network.getCookies", { urls: [base] });
    for (const k of got.result?.cookies ?? []) await f.send("Network.deleteCookies", { name: k.name, domain: k.domain, path: k.path, ...(k.partitionKey ? { partitionKey: k.partitionKey } : {}) });
    await f.ev(`localStorage.clear(); sessionStorage.clear(); true`);
  };
  for (const acct of ACCOUNTS) {
    await signOut(f, base);
    await f.ev(`location.href = ${JSON.stringify(P.login.path)}`);
    await wait(1200); await f.waitFor(`!!document.querySelector(${JSON.stringify(P.login.user)})`, 20000); await settle(f); f.reset();
    await typeIn(f, P.login.user, acct.user); await typeIn(f, P.login.pass, acct.pass);
    const clicked = await clickReal(f, P.login.submit);
    const there = await f.waitFor(`!/login|masuk/.test(location.pathname)`, 20000, 200); await settle(f, 700, 15000);
    const where = await f.ev(`location.pathname`);
    ok(`${acct.key}: signs in with a real click and typing and lands on ${where}`, clicked && there && P.landing.test(where), `${where}; errors ${f.events.errors.length}`);
    await shot("2-" + acct.key.replace(/ /g, "-"));
    const sheetBox = await c.ev(`(() => { const fr = document.querySelector('iframe[title]'); const p = fr.parentElement; const a = fr.getBoundingClientRect(), b = p.getBoundingClientRect(); return { top: p.scrollTop, gapB: Math.round((b.bottom - a.bottom) * 10) / 10, gapT: Math.round((a.top - b.top) * 10) / 10 }; })()`);
    ok(`${acct.key}: the sign-in did not push the device's screen up (no white band)`, sheetBox.top === 0 && Math.abs(sheetBox.gapB) < 1.5 && Math.abs(sheetBox.gapT) < 1.5, JSON.stringify(sheetBox));
    ok(`${acct.key}: after a reload the person is still signed in`, await (async () => { await f.ev(`location.reload()`); await wait(1200); await f.waitFor(`document.body && document.body.innerText.length > 20`, 20000); await settle(f); return !/login|masuk/.test(await f.ev(`location.pathname`)); })());
    let n = 0, empty = 0;
    let pages = acct.pages;
    if (pages.length === 1 && pages[0] === "/") {
      const found = await f.ev(`[...new Set([...document.querySelectorAll('a[href]')].map((a) => { try { const u = new URL(a.href, location.href); return u.origin === location.origin && !a.target ? u.pathname + u.search : null; } catch { return null; } }).filter((x) => x && !/logout|keluar|\\.(pdf|csv|zip|png|jpg)$/i.test(x)))]`);
      pages = [...new Set([where, ...found])].slice(0, 25);
      acct.pages = pages;
      info(`${acct.key}: the program's own links lead to ${pages.length} pages: ${pages.slice(0, 8).join(" ")}${pages.length > 8 ? " ..." : ""}`);
    }
    for (const p of pages) {
      f.reset();
      await f.ev(`location.href = ${JSON.stringify(p)}`); await wait(900);
      await f.waitFor(`document.readyState === 'complete' && document.body && document.body.innerText.length > 5`, 20000); await settle(f, 600, 15000); await wait(300);
      const m = await f.ev(`({ path: location.pathname, len: document.body.innerText.trim().length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth })`);
      const failedReq = f.events.failed.filter((x) => !x.canceled && !/google|gstatic|fonts/.test(x.url ?? "")).map((x) => (x.url ?? "").slice(-50) + " " + x.error);
      const five = [...f.events.requests.values()].filter((r) => r.status >= 500).map((r) => r.status + " " + new URL(r.url).pathname);
      n++;
      if (m.len < 20) { empty++; problems.push(`${acct.key} ${p}: empty`); }
      if (f.events.errors.length) problems.push(`${acct.key} ${p}: script error ${f.events.errors[0].slice(0, 110)}`);
      if (failedReq.length) problems.push(`${acct.key} ${p}: failed ${failedReq.join(", ")}`);
      if (five.length) problems.push(`${acct.key} ${p}: ${five.join(", ")}`);
    }
    ok(`${acct.key}: ${n} pages tried, none empty`, empty === 0);
  }
  const bad = problems.filter((x) => !/^.*: (failed|empty)/.test(x) || true);
  ok("no page threw a script error, failed to load a file, answered with a server error or came up empty", bad.length === 0, bad.slice(0, 4).join(" || "));
  for (const p of bad.slice(0, 20)) info("problem: " + p);

  // ---- five devices
  const first = ACCOUNTS[0];
  for (const [label, w] of [["Small phone, 320 px wide", 320], ["Phone, 390 px wide", 390], ["Tablet, 768 px wide", 768], ["Laptop, 1024 px wide", 1024], ["Desktop, 1440 px wide", 1440]]) {
    await press(label); await wait(1300);
    const res = [];
    for (const p of first.pages.slice(0, 4)) { await f.ev(`location.href = ${JSON.stringify(p)}`); await wait(800); await f.waitFor(`document.readyState === 'complete'`, 15000); await settle(f, 500, 10000); const m = await f.ev(`({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: innerWidth })`); res.push(`${p}:${m.over <= 1 ? "ok" : "over " + m.over}`); }
    ok(`${label.split(",")[0]}: the product's pages do not scroll sideways`, !res.some((x) => x.includes("over")), res.join(" "));
    await shot("3-" + w);
  }
  await press("Laptop, 1024 px wide");
  const hosts = [...F.hosts].filter((h) => h && !/^127\.0\.0\.1:/.test(h));
  info("every other address the pages asked for: " + JSON.stringify(hosts));
  ok("the pages asked nothing of any host but this PC, except fonts and the like", hosts.every((h) => /(^|\.)(googleapis|gstatic|openstreetmap|cloudflare|jsdelivr|unpkg)\.(com|org|net)$/.test(h)), hosts.join(", "));
  const held = {};
  for (const line of execSync("tasklist /FO CSV /NH", { encoding: "utf8" }).split("\n")) { const m = /^"([^"]+)","\d+","[^"]*","\d+","([\d.,\s]+) K"/.exec(line); if (m && ["php.exe", "node.exe", "python.exe", "postgres.exe", "msedgewebview2.exe", "app.exe"].includes(m[1].toLowerCase())) held[m[1]] = (held[m[1]] ?? 0) + Math.round(Number(m[2].replace(/[.,\s]/g, "")) / 1024); }
  info("MB held by the programs (every process of those names on the PC): " + JSON.stringify(held));
  await c.ev(`document.querySelector('section[data-sheet] button[aria-label^="Close"]').click(); true`);
  ok("closing the sheet stops every part of the program", await gone(PORT) && await gone(PORT + 1000));
} catch (e) { note("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 600)); failed++; try { await invoke("live_stop"); } catch {} }
finally {
  await wait(1500);
  if (P.real === "pg") { try { psql("postgres", `drop database if exists "${P.demoDb}" with (force)`); } catch {} }
  try { if (projectId) await invoke("remove_project", { id: projectId }); } catch (e) { note("could not remove the throwaway project: " + e); }
  const after = realMark();
  ok(P.real === "pg" ? "the product's own database and the others of the server saw no write (and the demo database was dropped)" : "the product's own folder has no change (its git, its uploads)", before === after && (P.real !== "pg" || psql("postgres", `select count(*) from pg_database where datname = '${P.demoDb}'`) === "0"), before === after ? "" : `${before} -> ${after}`);
  ok("the project list is as it was before the test", JSON.stringify((await invoke("list_projects")).map((p) => p.id)) === JSON.stringify(projectsBefore.map((p) => p.id)));
  ok("the programs are not left running", !(await answers(PORT)) && !(await answers(PORT + 1000)));
  c.close(); F.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
