// Does the built-in skill ui-details reach a person and change what they build? A real conversation (Sonnet, a few cents to a dollar) in a THROWAWAY project: Jiro (Frontend) is asked to make a flat
// page "answer the person". The test looks at what Jiro really did (the skill used, the reference files opened) and at the page that came out. Start Kona with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   and no other window of yours open, then   node tests/ui-details-skill.mjs
// It removes the project, the folder and the saved conversation at the end.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const NAME = "kona-ui-details-probe";
const root = path.join(os.tmpdir(), `kona-uidetails-${process.pid}`);
const proj = path.join(root, "project");
const slug = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
const before = await invoke("list_projects");
let account = null, sid = null;

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Tasks</title>
<style>
body { font-family: sans-serif; margin: 24px; background: #faf6ec; color: #2a2118; }
table { border-collapse: collapse; margin: 16px 0; }
td, th { border: 1px solid #c9bda3; padding: 6px 14px; text-align: left; }
button { padding: 8px 18px; background: #1f6f66; color: white; border: 0; }
</style></head><body>
<h1>Tasks</h1>
<p>Plan used: <span id="used">42%</span></p>
<table><tr><th>Task</th><th>Status</th></tr>
<tr><td>Build the app</td><td>waiting</td></tr>
<tr><td>Run the tests</td><td>waiting</td></tr>
<tr><td>Publish</td><td>waiting</td></tr></table>
<button id="run">Run all</button>
<script>
document.getElementById('run').onclick = () => { document.querySelectorAll('td:nth-child(2)').forEach((td) => { td.textContent = 'done'; }); document.getElementById('used').textContent = '55%'; };
</script></body></html>
`;

try {
  fs.mkdirSync(proj, { recursive: true });
  fs.writeFileSync(path.join(proj, "index.html"), PAGE);
  for (const a of await invoke("list_accounts")) { if ((await invoke("account_status", { id: a.id })).logged_in) { account = a; break; } }
  if (!account) throw new Error("no signed-in account");
  const id = (await invoke("add_project", { folder: proj, name: NAME, account: account.id })).project.id;
  // the skill came with the new project, and it is in the trees of the Design and Frontend people
  const skillFile = path.join(proj, ".kona", "skills", "ui-details", "SKILL.md");
  ok("the new project got the ui-details skill, with its references and template", fs.existsSync(skillFile) && ["motion-scale", "patterns-agent-screens", "patterns-everyday", "safety-rules", "what-to-skip", "snippets"].every((f) => fs.existsSync(path.join(proj, ".kona", "skills", "ui-details", "references", f + ".md"))) && fs.existsSync(path.join(proj, ".kona", "skills", "ui-details", "templates", "flat-test.md")));
  const kits = JSON.parse(fs.readFileSync(path.join(proj, ".kona", "role-kits.json"), "utf8"));
  const inTree = (role) => JSON.stringify(kits[role] ?? kits.roles?.[role] ?? kits).includes("ui-details");
  ok("it is in the starting trees of Nokka (Design) and Jiro (Frontend)", inTree("design") && inTree("frontend"));

  await c.send("Page.reload"); await wait(1500);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  const opened = await c.ev(`(() => { const isOpen = (x) => /^Open$/.test(x.textContent.trim()); const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(NAME)}); if (!title) return false; let n = title; while (n && ![...n.querySelectorAll('button')].some(isOpen)) n = n.parentElement; const b = n && [...n.querySelectorAll('button')].find(isOpen); if (!b || b.disabled) return false; b.click(); return true; })()`);
  ok("the throwaway project opens", opened && await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 15000, 200));
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  await c.ev(`document.querySelector('[aria-label="Open Jiro, Frontend"]').click(); true`);
  const sheet = `section[data-sheet]:not([hidden])`;
  await c.waitFor(`document.querySelector('${sheet}')?.getAttribute('aria-label') === 'Jiro, Frontend'`, 6000, 100);
  // the first message goes through the box, like a person (this also starts Jiro with his own kit)
  await c.ev(`document.querySelector('${sheet} textarea').focus(); true`);
  await c.send("Input.insertText", { text: "index.html works but feels flat: nothing answers the person. Make it answer them when they press Run all, while it runs, when it finishes, and when the percentage changes. Edit index.html only, no libraries. Do not run anything. When you are done, tell me in three short lines what you changed." });
  await wait(300);
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  // watch the work: allow what asks (edits are allowed already), until the turn ends
  const t0 = Date.now(); let done = false;
  while (Date.now() - t0 < 420000 && !done) {
    await wait(3000);
    await c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} button')].find((x) => x.textContent.trim() === 'Allow once' && !x.disabled); if (b) b.click(); return !!b; })()`);
    done = await c.ev(`(() => { const bs = [...document.querySelectorAll('${sheet} button')].map((b) => b.textContent.trim()); return bs.includes('Send') && !bs.includes('Stop'); })()`); // ready again: the button says Send and there is no Stop (words in the answer cannot fool it)
  }
  ok("Jiro finished the turn", done, `${Math.round((Date.now() - t0) / 1000)} s`);
  await wait(2000);

  // what Jiro really did, from his saved conversation
  const dir = path.join(account.config_dir ?? path.join(os.homedir(), ".claude"), "projects", slug(proj));
  const file = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dir, f))[0];
  const uses = [];
  for (const line of fs.readFileSync(file, "utf8").split(String.fromCharCode(10))) {
    try { const j = JSON.parse(line); if (j.type === "assistant") for (const b of j.message.content ?? []) if (b.type === "tool_use") uses.push({ name: b.name, input: JSON.stringify(b.input).slice(0, 200) }); } catch {}
  }
  console.log("   tool calls: " + uses.map((u) => u.name + (u.name === "Skill" || u.name === "Read" ? "(" + (u.input.match(/ui-details[^"\\]*|references[^"\\]*|templates[^"\\]*|[^"\\/]+\.html/) ?? [""])[0] + ")" : "")).join(" -> "));
  const skillUsed = uses.some((u) => /ui-details/.test(u.input) && (u.name === "Skill" || u.name === "Read"));
  ok("Jiro used the ui-details skill (the skill tool, or its files)", skillUsed);
  ok("Jiro opened at least one of its reference files or the template", uses.some((u) => u.name === "Read" && /ui-details[\\/]+(references|templates)/.test(u.input.replace(/\\\\/g, "/"))) || uses.some((u) => /references|flat-test/.test(u.input)));
  ok("Jiro opened the drop-in files (the ready CSS or the ready JavaScript) instead of retyping code", uses.some((u) => u.name === "Read" && /templates[\/]+(motion-tokens.css|ui-details.js)/.test(u.input.replace(/\\/g, "/"))));
  const html = fs.readFileSync(path.join(proj, "index.html"), "utf8");
  const has = (re) => re.test(html);
  ok("the page changed", html !== PAGE && html.length > PAGE.length + 400, `${html.length - PAGE.length} characters more`);
  ok("it uses named timings (a shared easing curve and durations)", has(/--ease|--dur|cubic-bezier\(0?\.23,\s*1,\s*0?\.32,\s*1\)/));
  ok("it gives press feedback (:active) and keyboard focus (:focus-visible)", has(/:active/) && has(/:focus-visible/));
  ok("it adapts to reduced motion", has(/prefers-reduced-motion/));
  ok("it says changes out loud (a status region or aria-live)", has(/aria-live|role=["']status["']/));
  ok("the changing number is steady (tabular digits) and animated", has(/tabular-nums/) && has(/requestAnimationFrame|transition/));
  ok("no library and no network (self-contained)", !has(/<script[^>]+src=|@import\s+url\(|https?:\/\/(?!www\.w3\.org)/));
  fs.writeFileSync(path.join(os.tmpdir(), "kona-uidetails-result.html"), html);
  console.log("   (the page Jiro made was saved as kona-uidetails-result.html in the temp folder, for you to open)");
} catch (e) { console.log("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 500)); failed++; }
finally {
  try { for (const p of await invoke("list_projects")) if (p.name === NAME) await invoke("remove_project", { id: p.id }); } catch (e) { console.log("could not remove the project: " + e); }
  try { const dir = path.join(account?.config_dir ?? path.join(os.homedir(), ".claude"), "projects"); for (const n of fs.readdirSync(dir)) if (n.toLowerCase().includes(slug(proj).toLowerCase())) fs.rmSync(path.join(dir, n), { recursive: true, force: true }); } catch {}
  // Jiro was started by the box, so stop what is running before the folder can be removed
  try { for (const x of (await invoke("leftovers")).sessions ?? []) await invoke("stop_session", { sessionId: x.id }); } catch {}
  await wait(2500);
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  try { const f = await invoke("list_projects"); ok("the project list is as it was, and the folder is gone", JSON.stringify(f.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)) && !fs.existsSync(root)); } catch {}
  c.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
