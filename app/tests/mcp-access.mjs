// MCP tools on the Access page (decision 102), in the REAL window, with REAL conversations (Sonnet, a few cents) in THROWAWAY projects. Start the DEVELOPMENT window with the test port and with the
// owner's own Kona closed or not touched:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then   npx tauri dev   then   node tests/mcp-access.mjs
// Two throwaway projects: A has a .mcp.json with two tools ("probe", which works, and "vault", whose arguments and settings hold secrets); B has nothing. The test checks that what A has is listed in B, off, and that no card
// shows a secret; switches probe on in B and ticks Jiro (Frontend); has Jiro call the tool in a real conversation; checks the card says "connected"; switches it off and checks the ticks are kept, the open
// conversation keeps it, and a NEW conversation does not have it; removes the tool from Kona's list; and puts everything back (Kona's list file, both projects, their folders, the saved conversations).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const text = () => c.ev(`document.body.innerText.replace(/\\s+/g, ' ')`);
const slug = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
const NAME_A = "kona-mcp-a", NAME_B = "kona-mcp-b";
const root = path.join(os.tmpdir(), `kona-mcp-${process.pid}`);
const A = path.join(root, "a"), B = path.join(root, "b");
const probeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "mcp-probe", "fake-mcp.mjs");
const listFile = path.join(process.env.APPDATA ?? "", "Kona", "mcp-servers.json");
const listBefore = fs.existsSync(listFile) ? fs.readFileSync(listFile, "utf8") : null;
const before = await invoke("list_projects");
let account = null;
const sessionsToRemove = [];

const openProject = async (name) => {
  await c.send("Page.reload"); await wait(1500);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  // the Open button of a card stays off until the welcome page has asked whether another window has the project, so press it once it is on
  const click = `(() => { const isOpen = (x) => /^Open$/.test(x.textContent.trim()); const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(name)}); if (!title) return false; let n = title; while (n && ![...n.querySelectorAll('button')].some(isOpen)) n = n.parentElement; const b = n && [...n.querySelectorAll('button')].find(isOpen); if (!b || b.disabled) return false; b.click(); return true; })()`;
  const opened = await c.waitFor(click, 15000, 300);
  return opened && await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(name)})`, 15000, 200) && await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 10`, 20000, 200);
};
const openAccess = async () => {
  // a page that is open (a person's conversation) is put away first, kept alive in the tray, so the office with its Connections door is in reach
  await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) [aria-label^="Minimize"]')?.click(); true`); await wait(500);
  await c.ev(`document.querySelector('[aria-label="Open Connections"]')?.click(); true`);
  return c.waitFor(`(() => { const g = document.querySelector('[role="group"][aria-label="MCP tools"]'); return !!g && !g.innerText.includes("Looking…"); })()`, 8000, 100);
};
const card = (n) => `document.querySelector('section[aria-label="${n}"]')`;
const press = (label, scope) => c.ev(`(() => { const b = [...${scope}.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const talk = async (who, say) => {
  await c.ev(`document.querySelector('[aria-label="Open ${who}"]').click(); true`);
  const sheet = `section[data-sheet]:not([hidden])`;
  await c.waitFor(`document.querySelector('${sheet}')?.getAttribute('aria-label') === ${JSON.stringify(who)}`, 6000, 100);
  await c.ev(`document.querySelector('${sheet} textarea').focus(); true`);
  await c.send("Input.insertText", { text: say }); await wait(300);
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  const t0 = Date.now(); let done = false;
  while (Date.now() - t0 < 240000 && !done) {
    await wait(3000);
    await c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} button')].find((x) => x.textContent.trim() === 'Allow once' && !x.disabled); if (b) b.click(); return !!b; })()`);
    done = await c.ev(`(() => { const bs = [...document.querySelectorAll('${sheet} button')].map((b) => b.textContent.trim()); return bs.includes('Send') && !bs.includes('Stop'); })()`);
  }
  return done;
};
/** the tools a conversation used, from its saved transcript in the account's folder */
const transcript = (proj) => {
  const dir = path.join(account.config_dir ?? path.join(os.homedir(), ".claude"), "projects", slug(proj));
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl")).sort()) {
    const uses = [], results = []; let reply = "";
    for (const line of fs.readFileSync(path.join(dir, f), "utf8").split(String.fromCharCode(10))) {
      try { const j = JSON.parse(line);
        if (j.type === "assistant") for (const b of j.message.content ?? []) { if (b.type === "tool_use") uses.push(b.name + " " + JSON.stringify(b.input)); if (b.type === "text") reply = b.text; }
        if (j.type === "user" && Array.isArray(j.message?.content)) for (const b of j.message.content) if (b.type === "tool_result") results.push(JSON.stringify(b.content));
      } catch {}
    }
    out.push({ file: f, uses, results, reply });
  }
  return out;
};

try {
  for (const a of await invoke("list_accounts")) { if ((await invoke("account_status", { id: a.id })).logged_in) { account = a; break; } }
  if (!account) throw new Error("no signed-in account");
  const roles = await invoke("list_roles");
  const jiro = roles.find((r) => r.id === "frontend");
  const who = `${jiro.person}, ${jiro.name}`;
  fs.mkdirSync(A, { recursive: true }); fs.mkdirSync(B, { recursive: true });
  fs.writeFileSync(path.join(A, ".mcp.json"), JSON.stringify({ mcpServers: {
    probe: { command: "node", args: [probeScript.replace(/\\/g, "/")] },
    vault: { command: "node", args: [probeScript.replace(/\\/g, "/"), "--token", "SECRET-TOKEN-123"], env: { KEY: "SECRET-ENV-456" } },
    shadcn: { command: "npx", args: ["shadcn@latest", "mcp"] },
  } }));
  const idA = (await invoke("add_project", { folder: A, name: NAME_A, account: account.id })).project.id;
  const idB = (await invoke("add_project", { folder: B, name: NAME_B, account: account.id })).project.id;

  // 1. what one project has, every project lists, off
  const rowsA = await invoke("mcp_catalog", { accountId: account.id, folder: A });
  ok("A lists its two tools, both its own, both off", rowsA.length >= 2 && ["probe", "vault"].every((n) => { const r = rowsA.find((x) => x.name === n); return r && r.here && !r.on; }));
  ok("no card carries a secret", !JSON.stringify(rowsA).includes("SECRET"));
  const rowsB = await invoke("mcp_catalog", { accountId: account.id, folder: B });
  const pb = rowsB.find((r) => r.name === "probe");
  ok("B lists probe too: not its own, off, and says where it was found", pb && !pb.here && !pb.on && pb.source === `Found in ${NAME_A}`, JSON.stringify(pb));
  ok("B has nothing ticked", pb && pb.roles.length === 0);

  // 2. the screen: the MCP section of the Access page of B
  ok("B opens", await openProject(NAME_B), (await text()).slice(0, 200));
  ok("the Access page shows the MCP tools section", await openAccess());
  let t = await c.ev(`document.querySelector('[role="group"][aria-label="MCP tools"]').innerText.replace(/\\s+/g, ' ')`);
  ok("probe and vault are there, with where they came from", t.includes("probe") && t.includes("vault") && t.includes(`Found in ${NAME_A}`), t.slice(0, 200));
  ok("the section shows no secret and no arguments", !/SECRET|--token|KEY/.test(t));
  ok("the card says it is a program and which one", (await c.ev(`${card("probe")}.innerText`)).includes("program · node"));
  ok("an off card has no people to tick", !(await c.ev(`${card("probe")}.innerText`)).includes("People who may use it"));
  const pressed = (n, label) => c.ev(`[...${card(n)}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})?.getAttribute('aria-pressed')`);
  ok("it is pressed in as Not used here", await pressed("probe", "Not used here") === "true" && await pressed("probe", "Used here") === "false");

  // 3. switch on, then choose a person
  ok("Used here is pressed", await press("Used here", card("probe")) && await c.waitFor(`${card("probe")}.innerText.includes('People who may use it')`, 5000, 100));
  ok("it says no one can use it yet", (await c.ev(`${card("probe")}.innerText`)).includes("No one can use it yet"));
  ok("the project's file says it is on", JSON.parse(fs.readFileSync(path.join(B, ".kona", "mcp-on.json"), "utf8")).on.includes("probe"));
  ok("vault is still off", !(await c.ev(`${card("vault")}.innerText`)).includes("People who may use it"));
  ok(`${jiro.person} is ticked`, await press(jiro.person, card("probe")) && await c.waitFor(`${card("probe")}.innerText.includes('No open conversation uses it yet')`, 5000, 100));
  ok("the person's choice is kept in the project", JSON.parse(fs.readFileSync(path.join(B, ".kona", "role-kits.json"), "utf8")).frontend.mcp.includes("probe"));
  ok("the button of the person is pressed in", await c.ev(`[...${card("probe")}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(jiro.person)})?.getAttribute('aria-pressed')`) === "true");
  ok("shadcn (the real tool, started by npx) is switched on and the same person is ticked", await press("Used here", card("shadcn")) && await c.waitFor(`${card("shadcn")}.innerText.includes('People who may use it')`, 5000, 100) && await press(jiro.person, card("shadcn")) && await c.waitFor(`${card("shadcn")}.innerText.includes('No open conversation uses it yet')`, 5000, 100));

  // 4. a real conversation: the person calls the tool
  ok("B opens again", await openProject(NAME_B));
  const finished = await talk(who, "Use the echo_probe tool of the probe server with the word pineapple. Then reply with exactly what the tool returned and nothing else.");
  ok(`${jiro.person} finished the turn`, finished);
  await wait(2000);
  const first = transcript(B);
  ok("a conversation was saved", first.length === 1);
  ok(`${jiro.person} called the tool of the probe server`, first[0]?.uses.some((u) => u.startsWith("mcp__probe__echo_probe") && u.includes("pineapple")), first[0]?.uses.join(" | ").slice(0, 300));
  ok("the tool answered through Claude Code", first[0]?.results.some((r) => r.includes("KONA-MCP-OK:pineapple")), first[0]?.results.join(" | ").slice(0, 200));
  ok("the tool that was not ticked was never used", !first[0]?.uses.some((u) => u.includes("vault")));
  const opened3 = await openAccess();
  const there = await c.waitFor(`!!${card("probe")}`, 8000, 200);
  if (!there) console.log("   page: " + (await text()).slice(0, 500));
  ok("Access says connected for that person", opened3 && there && await c.waitFor(`${card("probe")}.innerText.includes(${JSON.stringify(jiro.person + ": connected")})`, 8000, 200), there ? (await c.ev(`${card("probe")}.innerText`)).replace(/\s+/g, " ").slice(0, 300) : "no card");
  // the real tool is started by npx, which takes a few seconds: Claude Code may say "pending" with the first message (seen) and "connected" with the next (seen, 2026-11-23). Either is told in words.
  const shadcnLine = () => c.ev(`(${card("shadcn")}?.innerText ?? "").replace(/\\s+/g, " ").slice(-110)`);
  const first1 = await shadcnLine();
  ok("the real shadcn tool says how it started: connected, or still starting", first1.includes(`${jiro.person}: connected`) || first1.includes(`${jiro.person}: still starting when the conversation began`), first1);
  if (!first1.includes(": connected")) {
    ok(`${jiro.person} answers a second message in the same conversation`, await talk(who, "Say only the word ok."));
    await wait(1500);
    await openAccess();
    ok("the real shadcn tool says connected after the next message (the card follows each message)", await c.waitFor(`${card("shadcn")}.innerText.includes(${JSON.stringify(jiro.person + ": connected")})`, 8000, 200), await shadcnLine());
  }
  ok("the tool that is off says nothing about conversations", !/connected|could not|began before|keeps it/.test(await c.ev(`${card("vault")}.innerText`)));

  // 5. switch off: the ticks stay, the open conversation keeps it
  ok("Not used here is pressed", await press("Not used here", card("probe")) && await c.waitFor(`!${card("probe")}.innerText.includes('People who may use it')`, 5000, 100));
  ok("the ticks are kept while it is off", JSON.parse(fs.readFileSync(path.join(B, ".kona", "role-kits.json"), "utf8")).frontend.mcp.includes("probe"));
  ok("the open conversation is said to keep it", await c.waitFor(`${card("probe")}.innerText.includes('keeps it until a new one starts')`, 5000, 100));
  ok("the project's file says it is off", !JSON.parse(fs.readFileSync(path.join(B, ".kona", "mcp-on.json"), "utf8")).on.includes("probe"));

  // 6. a NEW conversation while it is off does not have it
  for (const x of (await invoke("leftovers")).sessions ?? []) await invoke("stop_session", { sessionId: x.id });
  await wait(2500);
  ok("B opens once more", await openProject(NAME_B));
  const finished2 = await talk(who, "Do you have a tool named echo_probe? Answer only yes or no.");
  ok(`${jiro.person} finished the second turn`, finished2);
  await wait(2000);
  const second = transcript(B);
  const newest = second.find((s) => !first.some((f) => f.file === s.file));
  ok("a second conversation was saved", !!newest);
  ok("it did not use the tool", newest && !newest.uses.some((u) => u.includes("echo_probe")), newest?.uses.join(" | ").slice(0, 200));
  ok("it answered no", newest && /\bno\b/i.test(newest.reply), newest?.reply.slice(0, 120));

  // 7. remove from Kona's list
  for (const x of (await invoke("leftovers")).sessions ?? []) await invoke("stop_session", { sessionId: x.id });
  await wait(2500);
  ok("B opens for the removal", await openProject(NAME_B) && await openAccess());
  ok("Remove… is on a tool B does not have itself", await press("Remove…", card("probe")) && await c.waitFor(`(document.querySelector('[role="dialog"]')?.innerText ?? '').includes('Remove this tool from the list?')`, 4000, 100));
  ok("Remove it", await press("Remove it", `document.querySelector('[role="dialog"]')`) && await c.waitFor(`!${card("probe")}`, 4000, 100));
  ok("the list no longer has it in B", !(await invoke("mcp_catalog", { accountId: account.id, folder: B })).some((r) => r.name === "probe"));
  let refused = ""; try { await invoke("mcp_remove", { accountId: account.id, folder: A, name: "vault" }); } catch (e) { refused = String(e); }
  ok("a tool A has itself cannot be removed from the list", refused.includes(".mcp.json"), refused.slice(0, 120));
  ok("A still lists both", (await invoke("mcp_catalog", { accountId: account.id, folder: A })).filter((r) => r.name === "probe" || r.name === "vault").length === 2);
  void idA; void idB;
} catch (e) { console.log("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 600)); failed++; }
finally {
  try { for (const x of (await invoke("leftovers")).sessions ?? []) await invoke("stop_session", { sessionId: x.id }); } catch {}
  await wait(2500);
  try { await invoke("mcp_remove", { accountId: account?.id ?? null, folder: B, name: "vault" }); await invoke("mcp_remove", { accountId: account?.id ?? null, folder: B, name: "probe" }); } catch {}
  try { for (const p of await invoke("list_projects")) if ([NAME_A, NAME_B].includes(p.name)) await invoke("remove_project", { id: p.id }); } catch (e) { console.log("could not remove a project: " + e); }
  try { const dir = path.join(account?.config_dir ?? path.join(os.homedir(), ".claude"), "projects"); for (const n of fs.readdirSync(dir)) if (n.toLowerCase().includes(slug(root).toLowerCase())) fs.rmSync(path.join(dir, n), { recursive: true, force: true }); } catch {}
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  try {
    const f = await invoke("list_projects");
    ok("the project list is as it was, and the folders are gone", JSON.stringify(f.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)) && !fs.existsSync(root));
    const now = fs.existsSync(listFile) ? fs.readFileSync(listFile, "utf8") : null;
    ok("Kona's list of tools is as it was", now === listBefore || (JSON.parse(now ?? "{}").servers && Object.keys(JSON.parse(now).servers).join() === Object.keys(JSON.parse(listBefore ?? "{}").servers ?? {}).join()));
  } catch {}
  c.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
