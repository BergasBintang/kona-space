// Does SQLite (sql.js, the optional database of a mockup, ticket T-0026) run inside the sandboxed frame of the REAL window? Run it against a BUILT program started with the test port
// and with the owner's own Kona closed (see tests/mockups.mjs). It adds one throwaway project, copies the template folder of the make-a-mockup skill into a card, lets the page run a
// query, a sort, a join and two broken rules, reads what the page says, and removes the project and the folder again whatever happens. It starts no session and calls no model.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const here = path.dirname(fileURLToPath(import.meta.url));
const templates = path.join(here, "..", "src-tauri", "skills", "make-a-mockup", "templates");
const PARTS = { "sqlite-sql-wasm.js": "sql-wasm.js", "sqlite-sql-wasm-data.js": "sql-wasm-data.js", "sqlite-db.js": "db.js", "sqlite-LICENSE.txt": "LICENSE.txt" };
const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-mock-sqlite-${process.pid}`);
const NAME = "kona-mock-sqlite";
const card = path.join(root, "project", ".kona", "mockups", "shop");

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>sqlite</title></head><body><h1>sqlite</h1><pre id="out">loading</pre>
<script src="sqlite/sql-wasm.js"></script><script src="sqlite/sql-wasm-data.js"></script><script src="sqlite/db.js"></script>
<script>
var SCHEMA = "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE); CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), total REAL NOT NULL);";
var SEED = "INSERT INTO users (name, email) VALUES ('Mira Example','mira@example.test'),('Noor Example','noor@example.test'),('Dev Example','dev@example.test'); INSERT INTO orders (user_id, total) VALUES (1, 10.5),(1, 4.5),(3, 99);";
var t0 = Date.now(), res = { test: 'sqlite' };
function done() { document.getElementById('out').textContent = JSON.stringify(res, null, 1); parent.postMessage(res, '*'); }
openDb(SCHEMA, SEED).then(function (db) {
  res.loadMs = Date.now() - t0;
  res.count = db.all("SELECT COUNT(*) AS n FROM users")[0].n;
  res.sortedDesc = db.all("SELECT name FROM users ORDER BY name DESC").map(function (r) { return r.name; });
  res.search = db.all("SELECT name FROM users WHERE name LIKE ? ORDER BY name", ["%noor%"]).map(function (r) { return r.name; });
  res.join = db.all("SELECT u.name AS name, SUM(o.total) AS spent FROM users u JOIN orders o ON o.user_id = u.id GROUP BY u.id ORDER BY spent DESC");
  try { db.run("INSERT INTO users (name, email) VALUES (?, ?)", ["Copy", "mira@example.test"]); res.unique = "no error"; } catch (e) { res.unique = String(e.message); }
  try { db.run("INSERT INTO orders (user_id, total) VALUES (?, ?)", [99, 1]); res.foreign = "no error"; } catch (e) { res.foreign = String(e.message); }
  try { db.run("INSERT INTO users (name, email) VALUES (NULL, 'x@example.test')"); res.notnull = "no error"; } catch (e) { res.notnull = String(e.message); }
  res.worker = typeof Worker; res.sab = typeof SharedArrayBuffer;
  done();
}).catch(function (e) { res.error = String(e && e.message || e); done(); });
</script></body></html>`;

const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
let id = null;
try {
  if (!account) { note("SKIP no project with an account to borrow"); process.exit(0); }
  fs.mkdirSync(path.join(card, "sqlite"), { recursive: true });
  for (const [from, to] of Object.entries(PARTS)) fs.copyFileSync(path.join(templates, from), path.join(card, "sqlite", to));
  fs.writeFileSync(path.join(card, "index.html"), PAGE);
  id = (await invoke("add_project", { folder: path.join(root, "project"), name: NAME, github: null, account })).project.id;
  await c.send("Page.reload"); await wait(1500);
  ok("the welcome page is back", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  ok("the throwaway project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if ([...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1 && !b.disabled) { b.click(); return true; } break; } } } return false; })()`));
  ok("it is the throwaway project that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200));
  await c.ev(`window.__sql = null; window.addEventListener('message', (e) => { const f = document.querySelector('iframe[title]'); if (f && e.source === f.contentWindow && e.data && e.data.test === 'sqlite') window.__sql = e.data; }); true`);
  await c.ev(`document.querySelector('[aria-label="Open Mockups"]').click(); true`);
  await wait(1500);
  await c.ev(`document.querySelector('section[data-sheet] ul button[aria-label="Open shop"]').click(); true`);
  ok("the page said what happened inside the sandboxed frame", await c.waitFor("window.__sql !== null", 30000, 300));
  const r = await c.ev("window.__sql");
  note("the page said: " + JSON.stringify(r));
  ok("SQLite loaded and started (no error)", !!r && !r.error, String(r?.error ?? `${r?.loadMs} ms`));
  ok("a query counts the seeded rows", r?.count === 3);
  ok("a sort works", r?.sortedDesc?.join() === "Noor Example,Mira Example,Dev Example", String(r?.sortedDesc));
  ok("a search with a parameter works", r?.search?.join() === "Noor Example");
  ok("a join with a sum works", r?.join?.length === 2 && r.join[0].name === "Dev Example" && r.join[0].spent === 99 && r.join[1].spent === 15, JSON.stringify(r?.join));
  ok("a repeated email is refused by the unique rule, with its name", /UNIQUE constraint failed: users\.email/.test(r?.unique ?? ""), String(r?.unique));
  ok("an order for a person who does not exist is refused (foreign key)", /FOREIGN KEY constraint failed/.test(r?.foreign ?? ""), String(r?.foreign));
  ok("a missing name is refused (not null)", /NOT NULL constraint failed: users\.name/.test(r?.notnull ?? ""), String(r?.notnull));
  note(`NOTE the frame has Worker: ${r?.worker}, SharedArrayBuffer: ${r?.sab} (sql.js needs neither)`);
  await c.ev(`document.querySelector('section button[aria-label^="Close"]')?.click(); true`);
} finally {
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === id) await invoke("remove_project", { id: p.id }); } catch (e) { note("could not remove the project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
  try { const final = await invoke("list_projects"); ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id))); } catch {}
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
