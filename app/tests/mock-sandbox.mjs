// The sandbox proof of the mock server (ticket T-0015, decisions 75 and 76). It loads a probe page from the mock scheme into a sandboxed frame of the REAL window and
// checks that everything a mockup page must not do fails, and that what it must do works (controls). Run it against a BUILT program (the content policy of the window is only
// enforced in a build, not in `tauri dev`), started with the test port and with the owner's own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then start src-tauri/target/<debug or release>/app.exe   then   node tests/mock-sandbox.mjs
// It adds one throwaway project (a folder in the temp folder) to the project list and removes it again, whatever happens, and says if the list is not as it was.
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
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail ? "  [" + detail + "]" : "")); if (!v) failed++; };

const stamp = process.pid;
// MOCK_TEST_ROOT puts the throwaway project somewhere else (another drive, for example); the default is the temp folder
const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-mock-sandbox-${stamp}`);
const project = path.join(root, "project");
const pwn = path.join(root, "pwn-folder");
const here = path.dirname(fileURLToPath(import.meta.url));
const cardDir = path.join(project, ".kona", "mockups", "probe");
const before = await invoke("list_projects");
let id = null;
try {
  fs.mkdirSync(path.join(cardDir, "css"), { recursive: true });
  fs.mkdirSync(path.join(project, ".kona", "mockups", "secret"), { recursive: true });
  fs.mkdirSync(path.join(project, ".kona", "tickets"), { recursive: true });
  fs.mkdirSync(pwn, { recursive: true });
  for (const f of ["index.html", "probe.js", "style.css", "data.json"]) fs.copyFileSync(path.join(here, "mock-probe", f), path.join(cardDir, f));
  fs.writeFileSync(path.join(cardDir, "empty.wasm"), Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
  fs.writeFileSync(path.join(project, ".kona", "mockups", "secret", "secret.txt"), "SECRET-OF-ANOTHER-CARD");
  fs.writeFileSync(path.join(project, "outside.txt"), "OUTSIDE-FILE-OF-THE-PROJECT");
  fs.writeFileSync(path.join(project, ".kona", "tickets", "T-0001.md"), "a ticket");

  const added = await invoke("add_project", { folder: project, name: "kona-mock-probe", github: null, account: null });
  id = added.project.id;
  const base = await invoke("mock_base");
  note(`address ${base}, project ${id}`);

  // the cards command sees the probe card, the secret card, and nothing of the project's other folders
  const cards = await invoke("mock_cards", { projectId: id });
  ok("the cards command lists the two cards", cards.map((x) => x.id).sort().join() === "probe,secret", cards.map((x) => x.id).join());
  ok("the files command lists the probe card's files", (await invoke("mock_files", { projectId: id, card: "probe" })).map((x) => x.path).sort().join() === "data.json,empty.wasm,index.html,probe.js,style.css", "");
  ok("the files command refuses a name that goes up", await c.ev(`window.__TAURI_INTERNALS__.invoke("mock_files", { projectId: ${JSON.stringify(id)}, card: "../project" }).then(() => false, () => true)`));

  // the frame: exactly as the sheet will make it (sandbox allow-scripts and nothing else)
  const targetsBefore = (await (await fetch("http://127.0.0.1:9223/json")).json()).filter((t) => t.type === "page").length;
  const hrefBefore = await c.ev("location.href");
  await c.ev(`(() => {
    window.__probe = []; window.__done = null; window.__parentViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__parentViolations.push(e.violatedDirective + ' ' + e.blockedURI));
    if (window.__probeListener) window.removeEventListener('message', window.__probeListener);
    window.__probeListener = (e) => { const f = document.getElementById('kona-probe-frame'); if (!f || e.source !== f.contentWindow) return; if (e.data && e.data.kind === 'probe') window.__probe.push(e.data); if (e.data && e.data.kind === 'done') window.__done = e.data; };
    window.addEventListener('message', window.__probeListener);
    const f = document.createElement('iframe'); f.id = 'kona-probe-frame'; f.setAttribute('sandbox', 'allow-scripts');
    f.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:99999;background:#fff';
    f.src = ${JSON.stringify(base + "/" + id + "/probe/index.html?pwn=" + encodeURIComponent(pwn))};
    document.body.append(f); return true; })()`);
  const done = await c.waitFor("window.__done !== null", 40000, 300);
  const results = await c.ev("window.__probe");
  note(`the frame reported ${results.length} results; it said done: ${done}`);
  for (const r of results) {
    if (r.name.startsWith("limit:")) note((r.held ? "NOTE " : "NOTE (not as expected) ") + r.name + "  [" + r.detail + "]"); // a known limit, written down, not a failure
    else ok(r.name, r.held, r.detail);
  }
  ok("the probe page reached its last probe and said it was done (the form did not take it away)", done);

  // what the window around the frame saw
  ok("the window around the frame did not move", (await c.ev("location.href")) === hrefBefore);
  ok("no new window opened", (await (await fetch("http://127.0.0.1:9223/json")).json()).filter((t) => t.type === "page").length === targetsBefore);
  ok("the content policy of the window did not block the frame itself", (await c.ev("window.__parentViolations.filter((v) => v.startsWith('frame-src')).length")) === 0, await c.ev("window.__parentViolations.join(', ')"));
  const after = await invoke("list_projects");
  const names = after.map((p) => p.name);
  ok("no project named pwned or pwned-raw was added by the page", !names.includes("pwned") && !names.includes("pwned-raw"), names.filter((n) => n.startsWith("pwned")).join());
} finally {
  // take the throwaway project out again and the frame away, whatever happened
  try { await c.ev("document.getElementById('kona-probe-frame')?.remove(); if (window.__probeListener) window.removeEventListener('message', window.__probeListener); true"); } catch {}
  for (const p of await invoke("list_projects")) if (p.name === "kona-mock-probe" || p.name === "pwned" || p.name === "pwned-raw" || p.id === id) await invoke("remove_project", { id: p.id });
  fs.rmSync(root, { recursive: true, force: true });
  const final = await invoke("list_projects");
  ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)), `${before.length} before, ${final.length} after`);
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
if (process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE, lines.join("\n") + "\n");
process.exit(failed ? 1 : 0);
