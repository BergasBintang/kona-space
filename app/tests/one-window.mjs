// One project is open in one Kona window at a time (lock.rs). Part 1 of 2: start TWO Kona programs with the same WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223, then node tests/one-window.mjs.
// It adds a throwaway project, opens it in window 1, checks that window 2 is refused and its card says so, swaps, and leaves window 2 holding it. Then KILL window 2 (the second one started) and run part 2.
// Part 1 of the "one project, one window" test: two windows, same test port.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function pages(port = 9223) {
  const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((p) => p.type === "page" && /tauri\.localhost/.test(p.url));
  const out = [];
  for (const p of list) {
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
    const send = (method, params = {}) => new Promise((res) => { const k = ++id; pending.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
    const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };
    const w = { ev, invoke: (cmd, args = {}) => ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`), close: () => ws.close(), born: await ev("performance.timeOrigin") };
    out.push(w);
  }
  return out.sort((a, b) => a.born - b.born); // [0] started first
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const NAME = "kona-lock-probe";
const FIND = (tail) => `(() => { const NAME = ${JSON.stringify(NAME)}; const isOpen = (x) => /^Open( in another window)?$/.test(x.textContent.trim()); const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === NAME); if (!title) return null; let n = title; while (n && ![...n.querySelectorAll('button')].some(isOpen)) n = n.parentElement; if (!n) return null; const b = [...n.querySelectorAll('button')].find(isOpen); ${tail} })()`;
export const cardButton = (w) => w.ev(FIND("return { text: b.textContent.trim(), disabled: b.disabled };"));
export const waitCard = async (w, pred, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const c = await cardButton(w); if (c && pred(c)) return Date.now() - t0; await wait(250); } return -1; };
export const pressOpen = (w) => w.ev(FIND("if (!b || b.disabled) return false; b.click(); return true;"));
export const headerHas = (w, t) => w.ev(`document.querySelector('header')?.innerText.includes(${JSON.stringify(t)}) ?? false`);
export const goBack = (w) => w.ev(`(() => { const b = document.querySelector('header button[aria-label^="Kona, back to the welcome page"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
export let failed = 0;
export const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };

if (import.meta.url === new URL(process.argv[1], "file:///").href || process.argv[1].endsWith("one-window.mjs")) {
  const [A, B] = await pages();
  const root = path.join(os.tmpdir(), `kona-lock-test-${process.pid}`);
  fs.mkdirSync(path.join(root, "p"), { recursive: true });
  try {
    ok("two windows, started apart", (await A.ev("1")) === 1 && B.born > A.born, `${Math.round((B.born - A.born) / 1000)} s apart`);
    for (const p of await A.invoke("list_projects")) if (p.name === NAME) await A.invoke("remove_project", { id: p.id });
    await wait(2500);
    let account = null;
    for (const a of await A.invoke("list_accounts")) { if ((await A.invoke("account_status", { id: a.id })).logged_in) { account = a; break; } }
    await A.invoke("add_project", { folder: path.join(root, "p"), name: NAME, account: account.id });
    A.ev("location.reload()").catch(() => {}); await wait(4000); // window 1 added it itself, so its screen is read again
    ok("window 2's card for it shows Open", (await waitCard(B, (c) => c.text === "Open" && !c.disabled)) >= 0);
    await waitCard(A, (c) => c.text === "Open" && !c.disabled, 20000);
    ok("window 1 opens it from the welcome page", (await pressOpen(A)) && await (async () => { for (let i = 0; i < 40; i++) { if (await headerHas(A, NAME)) return true; await wait(250); } return false; })());
    const t1 = await waitCard(B, (c) => c.text === "Open in another window" && c.disabled);
    ok("window 2's card says Open in another window, and its button is off", t1 >= 0, t1 >= 0 ? `after ${t1} ms` : "never");
    const refused = await B.ev(`window.__TAURI_INTERNALS__.invoke('project_claim', { projectId: ${JSON.stringify((await B.invoke("list_projects")).find((p) => p.name === NAME).id)} }).then(() => 'allowed', (e) => String(e))`);
    ok("window 2 is refused with a plain line when it asks for the project anyway", /open in another Kona window/.test(refused), refused);
    ok("window 1 goes back to the welcome page", await goBack(A) && await waitCard(A, () => true) >= 0);
    const t2 = await waitCard(B, (c) => c.text === "Open" && !c.disabled);
    ok("window 2's card is free again", t2 >= 0, t2 >= 0 ? `after ${t2} ms` : "never");
    await waitCard(B, (c) => c.text === "Open" && !c.disabled, 20000);
    ok("window 2 opens it", (await pressOpen(B)) && await (async () => { for (let i = 0; i < 40; i++) { if (await headerHas(B, NAME)) return true; await wait(250); } return false; })());
    const t3 = await waitCard(A, (c) => c.text === "Open in another window" && c.disabled);
    ok("now window 1's card is the one that says Open in another window", t3 >= 0, t3 >= 0 ? `after ${t3} ms` : "never");
    console.log(failed ? `${failed} FAILED so far` : "PART 1 PASSED: window 2 now holds the project");
  } catch (e) { console.log("FAIL stopped: " + String(e.stack ?? e).slice(0, 400)); }
  A.close(); B.close();
}
