// Part 2 of 2: window 2 was killed while it held the project. Window 1 must be able to open it (a dead window's claim locks nobody out), and the throwaway project is removed: node tests/one-window-2.mjs
// Part 2: window 2 was killed while it held the project. Window 1 must be able to open it, and everything is cleaned up.
import fs from "node:fs";
import path from "node:path";
import { NAME, cardButton, waitCard, pressOpen, headerHas, goBack, wait } from "./one-window.mjs";

const list = (await (await fetch("http://127.0.0.1:9223/json")).json()).filter((p) => p.type === "page" && /tauri\.localhost/.test(p.url));
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const k = ++id; pending.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };
const A = { ev, invoke: (cmd, args = {}) => ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`) };
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const locksDir = path.join(process.env.APPDATA, "Kona", "locks");
try {
  ok("a killed window left its claim file behind (the situation to survive)", fs.readdirSync(locksDir).some((f) => f.endsWith(".lock")), fs.readdirSync(locksDir).join(","));
  const t = await waitCard(A, (c) => c.text === "Open" && !c.disabled, 8000);
  ok("window 1's card is free: a dead window's claim does not lock anyone out", t >= 0, t >= 0 ? `after ${t} ms` : "never");
  ok("window 1 opens it", (await pressOpen(A)) && await (async () => { for (let i = 0; i < 40; i++) { if (await headerHas(A, NAME)) return true; await wait(250); } return false; })());
  ok("window 1 goes back to the welcome page", await goBack(A) && await waitCard(A, () => true) >= 0);
  await wait(500);
  ok("after that no claim file is left", !fs.readdirSync(locksDir).some((f) => f.endsWith(".lock")), fs.readdirSync(locksDir).join(","));
} catch (e) { console.log("FAIL stopped: " + String(e.stack ?? e).slice(0, 400)); failed++; }
finally {
  try { for (const p of await A.invoke("list_projects")) if (p.name === NAME) await A.invoke("remove_project", { id: p.id }); } catch (e) { console.log("could not remove the project: " + e); }
  try { for (const d of fs.readdirSync(process.env.TEMP ?? "").filter((n) => n.startsWith("kona-lock-test-"))) fs.rmSync(path.join(process.env.TEMP, d), { recursive: true, force: true }); } catch {}
  ws.close();
}
console.log(failed ? `${failed} FAILED` : "PART 2 PASSED");
