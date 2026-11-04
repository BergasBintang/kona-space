// A test of the GitHub repo card on the Servers screen, in the REAL window, driven over the DevTools port. Start the DEVELOPMENT window (or a debug build) with the test port and with the owner's
// own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then   npx tauri dev   then   KONA_TEST_SSH_HOST=<a server you may read> node tests/servers-repo.mjs
// It adds ONE throwaway project with one server, adds a repo card through the real form (the nickname is made up; the "real address" is the host you name, port 22, so the fingerprint can only be read
// if Kona reads the real address and not the nickname), checks the card, the copy buttons, the edit form and the fingerprint dialog, checks that the GitHub address boxes are gone from Settings and
// from Add a project, and removes everything again whatever happens. It never presses "Trust and save", sends no login and starts no session. Never run it on a window the owner has open.
// SHOTS=<folder> keeps a picture of the form and of the card.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const HOST = process.env.KONA_TEST_SSH_HOST;
if (!HOST) { console.log("SKIP set KONA_TEST_SSH_HOST to a server you may read the public host keys of (port 22)"); process.exit(0); }
const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + String(detail).slice(0, 260) + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await c.shot(path.join(process.env.SHOTS, name + ".png")); } };
const press = (label, scope = "document") => c.ev(`(() => { const b = [...${scope}.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const fill = (aria, value) => c.ev(`(() => { const el = [...document.querySelectorAll('[aria-label=${JSON.stringify(aria)}]')].find((e) => e.tagName === 'INPUT' || e.tagName === 'TEXTAREA'); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const valueOf = (aria) => c.ev(`document.querySelector('input[aria-label=${JSON.stringify(aria)}]')?.value ?? null`);
const sectionText = (name) => c.ev(`(document.querySelector('section[aria-label=${JSON.stringify(name)}]')?.innerText ?? '').replace(/\\s+/g, ' ')`);
const dialog = `document.querySelector('[role="dialog"]')`;
const dialogText = () => c.ev(`(${dialog}?.innerText ?? '').replace(/\\s+/g, ' ')`);
const clickAt = async (x, y) => { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await c.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); };
const centreOf = (js) => c.ev(`(() => { const b = ${js}; if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);

const NAME = "kona-repo-ui";
const root = path.join(os.tmpdir(), `kona-repo-ui-${process.pid}`);
const rwKey = path.join(root, "demo_rw");
const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
const hostsBefore = JSON.stringify(await Promise.all(before.map((p) => invoke("ssh_list", { projectId: p.id }))));
let id = null;
try {
  if (!account) { console.log("SKIP no project with an account to borrow, the throwaway project could not be opened"); process.exit(0); }
  fs.mkdirSync(path.join(root, "project"), { recursive: true });
  fs.writeFileSync(rwKey, "not a real key, only a file that exists\n");
  id = (await invoke("add_project", { folder: path.join(root, "project"), name: NAME, account })).project.id;
  await invoke("ssh_save", { host: { id: "", project_id: id, label: "Web", host: "web.example.test", port: 22, user: "deploy", key_path: "", fingerprints: [], roles: [], notes: "", kind: "", real_host: "", repo: "", ro_key_path: "", pulled_by: [] } });

  await c.send("Page.reload");
  await wait(1500);
  ok("the welcome page is back", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));

  // Add a project: no GitHub address box any more
  const addCard = await centreOf(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('Add another project'))`);
  ok("Add another project is there", !!addCard);
  await clickAt(...addCard);
  ok("the Add a project form opens", await c.waitFor(`document.body.innerText.includes('Pick the folder') || !!document.querySelector('input[placeholder="shop-api"]')`, 8000, 200));
  ok("it has no GitHub address box", await c.ev(`!document.querySelector('[aria-label="GitHub address"]') && !document.body.innerText.includes('GitHub address')`));
  await shot("add-project");
  await press("Cancel");
  await c.send("Page.reload");
  await wait(1500);
  ok("the welcome page is back after Cancel and a reload", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));

  await c.waitFor("(document.body.innerText.match(/signed in/g) || []).length >= 2", 15000, 200); // each card asks if its account is signed in; the Open button waits for that
  await wait(500);
  const rect = await centreOf(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)}) && [...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1) return b; } } return null; })()`);
  ok("the throwaway project card is found", !!rect);
  await clickAt(...rect);
  ok("it is the throwaway project that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 10`, 20000, 200));

  // Settings: no GitHub address box
  ok("Settings opens", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Settings"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Settings'`, 6000, 100));
  await wait(600);
  ok("the project is listed with its folder and Remove", await c.ev(`document.body.innerText.includes(${JSON.stringify(NAME)}) && [...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('Remove'))`));
  ok("there is no GitHub address box in Settings", await c.ev(`!document.querySelector('input[aria-label^="GitHub address"]') && !document.body.innerText.includes('GitHub address')`));
  await shot("settings");
  await c.ev(`(() => { const b = document.querySelector('section button[aria-label^="Close"]'); if (b) b.click(); return true; })()`);
  await wait(500);

  ok("the Servers screen opens", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Servers"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`!!document.querySelector('section[aria-label="Web"]')`, 8000, 100));
  ok("both Add buttons are there", await c.ev(`['Add a server', 'Add a GitHub repo'].every((l) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === l))`));

  // the repo form: a bad repo is refused with a plain message
  ok("Add a GitHub repo opens the repo form", await press("Add a GitHub repo") && await c.waitFor(`!!document.querySelector('section[aria-label="Add a GitHub repo"]')`, 3000, 100));
  ok("the form starts with github.com as the real address", (await valueOf("Real address")) === "github.com", await valueOf("Real address"));
  ok("Save waits for a name, a nickname and a repo", await c.ev(`[...document.querySelectorAll('section[aria-label="Add a GitHub repo"] button')].find((b) => b.textContent.trim() === 'Save').disabled`));
  await fill("Name", "Demo repo");
  await fill("Repo", "just-a-name");
  await fill("Nickname", "github-demo");
  await fill("Real address", HOST);
  await fill("Read and write key file path", rwKey);
  await fill("Read-only key file path", path.join(root, "demo_ro_missing"));
  ok("a bad repo is refused with a plain message", await press("Save", `document.querySelector('section[aria-label="Add a GitHub repo"]')`) && await c.waitFor(`document.body.innerText.includes('A GitHub repo looks like owner/name')`, 4000, 100));
  ok("the pulling servers section says what to do when there is a server", await c.ev(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Add a server that pulls it' && !b.disabled)`));
  ok("Add a server that pulls it adds a row", await press("Add a server that pulls it") && await c.waitFor(`!!document.querySelector('input[aria-label="Key path on the server 1"]')`, 3000, 100));
  await fill("Key path on the server 1", "~/.ssh/demo_ro");
  ok("the only server is already chosen, so nothing more can be added", await c.ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add a server that pulls it').disabled`));
  await fill("Repo", "https://github.com/Owner/demo.git");
  await shot("repo-form");
  ok("a full GitHub address is accepted and saved", await press("Save", `document.querySelector('section[aria-label="Add a GitHub repo"]')`) && await c.waitFor(`!!document.querySelector('section[aria-label="Demo repo"]')`, 5000, 100));

  // the card
  await wait(500);
  const card = await sectionText("Demo repo");
  console.log("     card: " + card);
  ok("the card shows the git address with the nickname", card.includes("git@github-demo:Owner/demo.git"));
  ok("the read and write key is found", /Read and write key, this PC\s*·\s*Key file found/.test(card));
  ok("the read-only key on this PC is reported missing", /Read-only key, this PC\s*·\s*Key file not found/.test(card));
  ok("it says which server pulls it and where the key is there", card.includes("Pulled by Web") && card.includes("~/.ssh/demo_ro"));
  ok("it has the copy buttons", await c.ev(`['Copy git address', 'Copy ssh config entry', 'Copy server entry', 'Read the fingerprint…'].every((l) => [...document.querySelector('section[aria-label="Demo repo"]').querySelectorAll('button')].some((b) => b.textContent.trim() === l))`));
  ok("Copy server entry answers Copied", await press("Copy server entry", `document.querySelector('section[aria-label="Demo repo"]')`) && await c.waitFor(`[...document.querySelector('section[aria-label="Demo repo"]').querySelectorAll('button')].some((b) => b.textContent.trim() === 'Copied')`, 3000, 100));
  await shot("repo-card");
  const saved = (await invoke("ssh_list", { projectId: id })).find((h) => h.label === "Demo repo");
  ok("it was saved as a repo with the clean name, user git and port 22", saved?.kind === "github" && saved.repo === "Owner/demo" && saved.user === "git" && saved.port === 22 && saved.real_host === HOST, JSON.stringify(saved && { kind: saved.kind, repo: saved.repo, user: saved.user, port: saved.port }));
  ok("the server card is unchanged and has no repo lines", !(await sectionText("Web")).includes("Pulled by"));

  // the fingerprint is read from the real address, never from the nickname
  const t0 = Date.now();
  ok("Read the fingerprint asks first and names the real address", await press("Read the fingerprint…", `document.querySelector('section[aria-label="Demo repo"]')`) && await c.waitFor(`(${dialog}?.innerText ?? '').includes("Read this server's fingerprint?")`, 3000, 100) && (await dialogText()).includes(HOST) && !(await dialogText()).includes("github-demo"), await dialogText());
  ok("Connect and read it", await press("Connect and read it", dialog));
  ok("it reads the three keys through the real address", await c.waitFor(`(${dialog}?.innerText ?? '').includes("Is this the right server?")`, 60000, 200) && (((await dialogText()).match(/SHA256:[A-Za-z0-9+/]{43}/g) ?? []).length === 3), (await dialogText()).slice(0, 160));
  console.log(`     read in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  ok("a repo is compared with the fingerprints GitHub publishes", (await dialogText()).includes("GitHub publishes"));
  ok("Cancel closes it without saving", await press("Cancel", dialog) && await c.waitFor(`!${dialog}`, 3000, 100) && (await sectionText("Demo repo")).includes("Fingerprint not checked yet"));

  // the edit form shows what was saved
  ok("Edit opens the form with the saved values", await press("Edit", `document.querySelector('section[aria-label="Demo repo"]')`) && await c.waitFor(`!!document.querySelector('section[aria-label="Edit repo"]')`, 3000, 100));
  ok("the repo, nickname, real address and key paths are filled in", (await valueOf("Repo")) === "Owner/demo" && (await valueOf("Nickname")) === "github-demo" && (await valueOf("Real address")) === HOST && (await valueOf("Read and write key file path")) === rwKey && (await valueOf("Key path on the server 1")) === "~/.ssh/demo_ro");
  ok("Cancel closes the form", await press("Cancel", `document.querySelector('section[aria-label="Edit repo"]')`) && await c.waitFor(`!document.querySelector('section[aria-label="Edit repo"]')`, 3000, 100));

  // removing the server takes it off the repo card
  await invoke("ssh_remove", { id: (await invoke("ssh_list", { projectId: id })).find((h) => h.label === "Web").id });
  const after = (await invoke("ssh_list", { projectId: id })).find((h) => h.label === "Demo repo");
  ok("removing a server takes it off the repos it pulled", after.pulled_by.length === 0);
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
