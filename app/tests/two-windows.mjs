// Run: start TWO Kona programs with the same WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223 (one port then shows both pages), then node tests/two-windows.mjs. Adds and removes throwaway projects only.
// Two Kona windows at once (both started with the same test port, so one port shows both pages). Window 0 and window 1 are two separate programs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function attachNth(i, port = 9223) {
  const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((p) => p.type === "page" && /tauri\.localhost/.test(p.url));
  const ws = new WebSocket(list[i].webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((res) => { const k = ++id; pending.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };
  const invoke = (cmd, args = {}) => ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
  return { ev, invoke, close: () => ws.close() };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };

const A = await attachNth(0), B = await attachNth(1);
const names = async (w) => (await w.invoke("list_projects")).map((p) => p.name);
const waitNames = async (w, pred, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred(await names(w))) return Date.now() - t0; await wait(200); } return -1; };
const root = path.join(os.tmpdir(), `kona-sync-test-${process.pid}`);
const P1 = "kona-sync-probe-1", P2 = "kona-sync-probe-2", P1b = "kona-sync-probe-1-renamed";
const dataFile = path.join(process.env.APPDATA, "Kona", "projects.json");
const before = await names(A);
try {
  ok("two separate windows are open and show the same projects", (await names(B)).join("|") === before.join("|"), `${before.length} projects`);
  fs.mkdirSync(path.join(root, "one"), { recursive: true }); fs.mkdirSync(path.join(root, "two"), { recursive: true });

  // window A adds a project: window B must see it without being touched
  await A.invoke("add_project", { folder: path.join(root, "one"), name: P1, account: null, group: null });
  const t1 = await waitNames(B, (n) => n.includes(P1));
  ok("a project added in window 1 shows up in window 2 by itself", t1 >= 0, t1 >= 0 ? `after ${t1} ms` : "never");
  ok("window 2's welcome page DRAWS it (the screen was told)", await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 4000) { if (await B.ev(`document.body.innerText.includes(${JSON.stringify(P1)})`)) return true; await wait(200); } return false; })());

  // window B adds another one, and the first must not be lost from the file
  await wait(1500);
  await B.invoke("add_project", { folder: path.join(root, "two"), name: P2, account: null, group: null });
  const t2 = await waitNames(A, (n) => n.includes(P2));
  ok("a project added in window 2 shows up in window 1", t2 >= 0, t2 >= 0 ? `after ${t2} ms` : "never");
  const onDisk = JSON.parse(fs.readFileSync(dataFile, "utf8")).projects.map((p) => p.name);
  ok("the file holds both (nothing was overwritten)", onDisk.includes(P1) && onDisk.includes(P2));

  // a change by window A after B's save: A saves its own copy, which must already include B's project
  const id1 = (await A.invoke("list_projects")).find((p) => p.name === P1).id;
  await A.invoke("rename_project", { id: id1, name: P1b });
  const onDisk2 = JSON.parse(fs.readFileSync(dataFile, "utf8")).projects.map((p) => p.name);
  ok("a save by window 1 keeps what window 2 added", onDisk2.includes(P1b) && onDisk2.includes(P2));
  const t3 = await waitNames(B, (n) => n.includes(P1b) && !n.includes(P1));
  ok("the new name shows up in window 2", t3 >= 0, t3 >= 0 ? `after ${t3} ms` : "never");

  // a removal
  await B.invoke("remove_project", { id: id1 });
  const t4 = await waitNames(A, (n) => !n.includes(P1b));
  ok("a project removed in window 2 is gone in window 1", t4 >= 0, t4 >= 0 ? `after ${t4} ms` : "never");
} catch (e) { console.log("FAIL stopped: " + String(e.stack ?? e).slice(0, 400)); failed++; }
finally {
  for (const w of [A, B]) { try { for (const p of await w.invoke("list_projects")) if (p.name.startsWith("kona-sync-probe")) await w.invoke("remove_project", { id: p.id }); } catch {} }
  await wait(2500);
  const a = await names(A), b = await names(B);
  ok("both windows are back to the projects they had", a.join("|") === before.join("|") && b.join("|") === before.join("|"), `${a.length} and ${b.length}`);
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  A.close(); B.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
