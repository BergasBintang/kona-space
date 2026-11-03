// The probe page of tests/mock-sandbox.mjs (ticket T-0015). It runs inside the sandboxed frame of the real window and reports to the window around it.
// Every probe answers [held, detail]: held is true when the protection held (a forbidden thing failed) or when a control worked (an allowed thing worked).
const violations = [];
document.addEventListener("securitypolicyviolation", (e) => violations.push(e.violatedDirective + " " + e.blockedURI));
const say = (name, held, detail) => parent.postMessage({ kind: "probe", name, held: !!held, detail: String(detail ?? "") }, "*");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// a thing that never answers within 4 seconds counts as failed ("no answer"), so one silent probe cannot hold the rest back
const attempt = async (fn, ms = 4000) => {
  let timer;
  const silent = new Promise((_, no) => { timer = setTimeout(() => no({ name: "NoAnswer", message: "nothing came back in " + ms / 1000 + " s" }), ms); });
  try { return { threw: false, value: await Promise.race([Promise.resolve().then(fn), silent]) }; } catch (e) { return { threw: true, value: (e && e.name ? e.name : "error") + ": " + (e && e.message ? e.message : e) }; } finally { clearTimeout(timer); }
};
const q = new URLSearchParams(location.search);
const parts = location.pathname.split("/"); // ["", project id, card, file]
const base = location.href.split("/").slice(0, 3).join("/");
const pid = parts[1];
const since = (n) => violations.slice(n);
const fetchText = async (url) => { const r = await fetch(url); return [r.status, await r.text()]; };

const probes = [
  // controls: what must work, so that a failure below means something
  ["control: the style sheet of the card is applied", async () => { const v = getComputedStyle(document.body).getPropertyValue("--probe").trim(); return [v === "ok", v]; }],
  ["control: an inline script and a script file of the card run", async () => [window.__inline === true, "inline " + window.__inline]],
  ["control: the card's own json is readable", async () => { const r = await fetch("data.json"); const j = await r.json(); return [r.status === 200 && j.hello === "world", r.status]; }],
  ["control: the card's own wasm compiles and runs", async () => { const b = await (await fetch("empty.wasm")).arrayBuffer(); await WebAssembly.instantiate(b); return [true, b.byteLength + " bytes"]; }],
  ["control: a range request on a card file is answered in a range", async () => { const r = await fetch("data.json", { headers: { Range: "bytes=0-3" } }); const t = await r.text(); return [r.status === 206 && t.length === 4, r.status + " " + JSON.stringify(t)]; }],

  // the web
  ["web: a fetch to a web address is blocked by the policy", async () => { const n = violations.length; const r = await attempt(() => fetch("https://example.com/", { mode: "no-cors" })); await wait(250); return [r.threw && since(n).some((v) => v.startsWith("connect-src")), r.value + " | " + since(n).join(", ")]; }],
  ["web: a picture from the web is blocked by the policy", async () => { const n = violations.length; const i = new Image(); i.src = "https://example.com/x.png"; await wait(400); return [since(n).some((v) => v.startsWith("img-src")), since(n).join(", ")]; }],
  ["web: a script from the web is blocked by the policy", async () => { const n = violations.length; const s = document.createElement("script"); s.src = "https://example.com/x.js"; document.head.append(s); await wait(400); return [since(n).some((v) => v.startsWith("script-src")), since(n).join(", ")]; }],
  ["web: a style sheet from the web is blocked by the policy", async () => { const n = violations.length; const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://example.com/x.css"; document.head.append(l); await wait(400); return [since(n).some((v) => v.startsWith("style-src")), since(n).join(", ")]; }],
  ["web: a frame with a web page is blocked by the policy", async () => { const n = violations.length; const f = document.createElement("iframe"); f.src = "https://example.com/"; document.body.append(f); await wait(400); return [since(n).some((v) => v.startsWith("frame-src") || v.startsWith("default-src")), since(n).join(", ")]; }],
  ["web: a web socket is blocked by the policy", async () => { const n = violations.length; const r = await attempt(() => new WebSocket("wss://example.com/")); await wait(300); return [r.threw || since(n).some((v) => v.startsWith("connect-src")), (r.threw ? r.value : "") + " | " + since(n).join(", ")]; }],

  // Kona itself
  ["kona: the command channel of the window is blocked by the policy", async () => { const n = violations.length; const r = await attempt(() => fetch("http://ipc.localhost/list_projects", { method: "POST", body: "{}" })); await wait(250); return [r.threw && since(n).some((v) => v.startsWith("connect-src")), r.value + " | " + since(n).join(", ")]; }],
  ["kona: no Tauri object can be used to run a command", async () => {
    const found = ["__TAURI__", "__TAURI_INTERNALS__", "__TAURI_INVOKE_KEY__", "__TAURI_IPC__", "ipc"].filter((n) => typeof window[n] !== "undefined");
    let invoked = "not tried";
    // watch the real message channels, so the test knows whether the command's message left the frame at all
    const posted = [];
    const hook = (obj, name) => { try { if (obj && typeof obj[name] === "function") { const orig = obj[name]; obj[name] = function (m) { posted.push(name + ":" + String(typeof m === "string" ? m : JSON.stringify(m)).slice(0, 60)); return orig.apply(this, arguments); }; } } catch (e) {} };
    hook(window.ipc, "postMessage"); hook(window.chrome && window.chrome.webview, "postMessage");
    if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
      const r = await attempt(() => window.__TAURI_INTERNALS__.invoke("add_project", { folder: q.get("pwn"), name: "pwned", github: null, account: null }));
      invoked = r.threw ? "refused: " + r.value : "ANSWERED";
    }
    const wv = !!(window.chrome && window.chrome.webview && window.chrome.webview.postMessage);
    // the raw message channel of the window, with the shape Tauri's own script uses; the test then looks for a project named pwned-raw
    if (wv) { try { window.chrome.webview.postMessage(JSON.stringify({ cmd: "add_project", callback: 1234, error: 5678, options: { headers: {} }, payload: { folder: q.get("pwn"), name: "pwned-raw", github: null, account: null } })); } catch (e) {} }
    await wait(500);
    return [invoked === "not tried" || invoked.startsWith("refused"), "globals [" + found.join(",") + "] chrome.webview " + wv + " invoke " + invoked + " | messages that left the frame: " + (posted.length ? posted.join(" ; ") : "none")];
  }],
  ["kona: the window around it cannot be read", async () => {
    const out = [];
    for (const [n, f] of [["parent.document", () => parent.document.title], ["parent.__TAURI_INTERNALS__", () => parent.__TAURI_INTERNALS__], ["top.location.href", () => top.location.href], ["parent.localStorage", () => parent.localStorage.length]]) {
      const r = await attempt(f);
      out.push(n + ":" + (r.threw ? "blocked" : "READ"));
    }
    return [out.every((x) => x.endsWith("blocked")), out.join(" ")];
  }],
  ["storage: no local storage, cookies, indexed db or service worker", async () => {
    const out = [];
    for (const [n, f] of [["localStorage", () => localStorage.length], ["sessionStorage", () => sessionStorage.length], ["cookie", () => document.cookie], ["indexedDB", () => indexedDB.open("x")], ["serviceWorker", () => navigator.serviceWorker.register("probe.js")]]) {
      const r = await attempt(f);
      out.push(n + ":" + (r.threw ? "blocked" : "ALLOWED"));
    }
    return [out.every((x) => x.endsWith("blocked")), out.join(" ")];
  }],

  // leaving the frame
  ["frame: no pop-up window opens", async () => { const a = window.open("https://example.com/"); const b = window.open(location.href); return [a === null && b === null, "null " + (a === null) + "/" + (b === null)]; }],
  ["frame: the top window cannot be navigated", async () => { const r = await attempt(() => { top.location = "https://example.com/"; }); await wait(300); return [true, r.threw ? r.value : "no error (the test checks the window did not move)"]; }],

  // other cards, other projects, and up out of the card
  // known limit (WebView2 sends no Referer for a page's own requests, so cards cannot be told apart): another card of the project CAN be read; the page has no way to send it out (see the web probes)
  ["limit: a file of another card of the same project can be read by its exact address", async () => { const [s, t] = await fetchText(base + "/" + pid + "/secret/secret.txt"); return [s === 200 && t.includes("SECRET-OF-ANOTHER-CARD"), s]; }],
  ["card: a project that is not known gives nothing", async () => { const [s] = await fetchText(base + "/00000000-0000-0000-0000-000000000000/probe/index.html"); return [s === 404, s]; }],
  ["card: going up out of the card gives nothing", async () => {
    const out = []; let leaked = false;
    for (const p of ["../outside.txt", "../../outside.txt", "..%2foutside.txt", "%2e%2e/%2e%2e/outside.txt", "css/../../../outside.txt", "..%5coutside.txt", base + "/" + pid + "/probe/..%2f..%2foutside.txt", base + "/" + pid + "/probe/%2e%2e%2f%2e%2e%2foutside.txt"]) {
      const r = await attempt(() => fetchText(p));
      if (!r.threw) { out.push(r.value[0]); if (r.value[1].includes("OUTSIDE-FILE-OF-THE-PROJECT")) leaked = true; } else out.push("err");
    }
    return [!leaked, "statuses " + out.join(",")];
  }],
  ["card: the project's other files by address are refused", async () => { const [s, t] = await fetchText(base + "/" + pid + "/.kona/tickets/T-0001.md"); return [s === 400 || s === 403 || s === 404, s]; }],

  // last: a form posted to the web, in the frame itself (blocked, or this page is gone and never says it is done)
  ["form: a form cannot post to the web", async () => {
    const n = violations.length;
    const f = document.createElement("form"); f.method = "post"; f.action = "https://example.com/"; f.innerHTML = '<input name="a" value="b">'; document.body.append(f);
    f.submit();
    await wait(600);
    return [true, "this page is still here; " + (since(n).join(", ") || "no policy event (blocked by the sandbox)")];
  }],
];

(async () => {
  for (const [name, fn] of probes) {
    const r = await attempt(fn, 15000);
    if (r.threw) say(name, false, "the probe itself failed: " + r.value);
    else say(name, r.value[0], r.value[1]);
  }
  parent.postMessage({ kind: "done", violations }, "*");
})();
