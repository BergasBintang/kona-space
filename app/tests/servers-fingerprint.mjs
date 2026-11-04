// A test of "Read the fingerprint" on the Servers screen, in the REAL window, driven over the DevTools port. Start the DEVELOPMENT window (or a debug build) with the test port and with the
// owner's own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then   npx tauri dev   then   KONA_TEST_SSH_HOST=<a server you may read> node tests/servers-fingerprint.mjs
// It adds ONE throwaway project (a folder in the temp folder) with two servers: the host you name (an optional KONA_TEST_SSH_PORT) and a closed port on this PC, reads the fingerprint of each
// through the real screen, checks the dialogs, and removes the servers, the project and the folder again whatever happens. It only reads public host keys: it never presses "Trust and save",
// sends no login and runs nothing on the server. It starts no session. Never run it on a window the owner has open. SHOTS=<folder> keeps a picture of each dialog.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const HOST = process.env.KONA_TEST_SSH_HOST;
if (!HOST) { console.log("SKIP set KONA_TEST_SSH_HOST to a server you may read the public host keys of"); process.exit(0); }
const PORT = Number(process.env.KONA_TEST_SSH_PORT ?? 22);
const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => c.ev(`document.body.innerText.replace(/\\s+/g, ' ')`);
const shot = async (name) => { if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await c.shot(path.join(process.env.SHOTS, name + ".png")); } };
const press = (label, scope = "document") => c.ev(`(() => { const b = [...${scope}.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const dialog = `document.querySelector('[role="dialog"]')`;
const dialogText = () => c.ev(`(${dialog}?.innerText ?? '').replace(/\\s+/g, ' ')`);
const dialogButtons = () => c.ev(`[...(${dialog}?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim() + (b.disabled ? ' (disabled)' : ''))`);

const NAME = "kona-ssh-ui";
const root = path.join(os.tmpdir(), `kona-ssh-ui-${process.pid}`);
const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
const hostsBefore = JSON.stringify(await Promise.all(before.map((p) => invoke("ssh_list", { projectId: p.id }))));
let id = null;
try {
  if (!account) { console.log("SKIP no project with an account to borrow, the throwaway project could not be opened"); process.exit(0); }
  fs.mkdirSync(path.join(root, "project"), { recursive: true });
  id = (await invoke("add_project", { folder: path.join(root, "project"), name: NAME, account })).project.id;
  const server = (label, host, port) => invoke("ssh_save", { host: { id: "", project_id: id, label, host, port, user: "deploy", key_path: "", fingerprints: [], roles: [], notes: "" } });
  await server("Real server", HOST, PORT);
  await server("Closed port", "127.0.0.1", 1);

  await c.send("Page.reload");
  await wait(1500);
  ok("the welcome page is back", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  const rect = await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)}) && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1) { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; } } } return null; })()`);
  ok("the throwaway project card is found", !!rect);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await c.send("Input.dispatchMouseEvent", { type, x: rect[0], y: rect[1], button: "left", clickCount: 1 });
  ok("it is the throwaway project that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200), (await text()).slice(0, 300));
  await shot("after-open");
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 10`, 20000, 200));
  ok("the Servers screen opens", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Servers"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`!!document.querySelector('section[aria-label="Real server"]')`, 8000, 100));

  // the real server: the three fingerprints, and a button that can be pressed
  const realCard = `document.querySelector('section[aria-label="Real server"]')`;
  ok("the card says the fingerprint is not checked yet", (await c.ev(`${realCard}.innerText`)).includes("Fingerprint not checked yet"));
  ok("Read the fingerprint opens the question first", await press("Read the fingerprint…", realCard) && await c.waitFor(`(${dialog}?.innerText ?? '').includes("Read this server's fingerprint?")`, 3000, 100));
  ok("the question says no login is sent", (await dialogText()).includes("sends no login"));
  const t0 = Date.now();
  ok("Connect and read it", await press("Connect and read it", dialog));
  ok("it reads the keys", await c.waitFor(`(${dialog}?.innerText ?? '').includes("Is this the right server?")`, 60000, 200), (await dialogText()).slice(0, 200));
  const read = await dialogText();
  console.log(`     read in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${read.slice(0, 400)}`);
  ok("all three key types are shown", ["ED25519", "ECDSA", "RSA"].every((k) => read.includes(k)));
  ok("each is a SHA256 fingerprint", (read.match(/SHA256:[A-Za-z0-9+/]{43}/g) ?? []).length === 3);
  const btns = await dialogButtons();
  ok("Trust and save can be pressed when keys were read", btns.includes("Trust and save"), btns.join(" | "));
  await shot("fingerprint-read");
  ok("Cancel closes it without saving", await press("Cancel", dialog) && await c.waitFor(`!${dialog}`, 3000, 100));
  ok("the card still says not checked yet (nothing was saved)", (await c.ev(`${realCard}.innerText`)).includes("Fingerprint not checked yet"));

  // the closed port: the real reason, and nothing to trust
  const closedCard = `document.querySelector('section[aria-label="Closed port"]')`;
  ok("the closed-port server asks first", await press("Read the fingerprint…", closedCard) && await c.waitFor(`(${dialog}?.innerText ?? '').includes("Read this server's fingerprint?")`, 3000, 100));
  ok("Connect and read it (closed port)", await press("Connect and read it", dialog));
  ok("the dialog says it could not read", await c.waitFor(`(${dialog}?.innerText ?? '').includes("Could not read the fingerprint")`, 30000, 200), (await dialogText()).slice(0, 200));
  const failure = await dialogText();
  console.log(`     ${failure}`);
  ok("it says why: the connection was refused", /refused the connection/.test(failure));
  ok("the sentence ends cleanly (no question mark followed by a full stop)", !/\?\./.test(failure));
  ok("it no longer says \"did not answer with a host key\"", !/did not answer with a host key/.test(failure));
  const btns2 = await dialogButtons();
  ok("there is no Trust and save, only Close", btns2.length === 1 && btns2[0] === "Close", btns2.join(" | "));
  await shot("fingerprint-failed");
  ok("Close closes it", await press("Close", dialog) && await c.waitFor(`!${dialog}`, 3000, 100));
} finally {
  try {
    if (id) { for (const h of await invoke("ssh_list", { projectId: id })) await invoke("ssh_remove", { id: h.id }); }
    for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === id) await invoke("remove_project", { id: p.id });
  } catch (e) { console.log("could not remove the throwaway project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
  try {
    const final = await invoke("list_projects");
    ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)), `${before.length} before, ${final.length} after`);
    ok("the servers of every project are as they were", JSON.stringify(await Promise.all(final.map((p) => invoke("ssh_list", { projectId: p.id })))) === hostsBefore);
  } catch {}
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
