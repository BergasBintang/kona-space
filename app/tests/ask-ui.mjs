// A test of the Brain's Ask page (decision 92) in the REAL window, driven over the DevTools port. Run it against a BUILT program (`npm run tauri build -- --debug --no-bundle`), started with the
// test port and with the owner's own Kona closed:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then start src-tauri/target/debug/app.exe   then   node tests/ask-ui.mjs
// It adds ONE throwaway project (a folder in the temp folder, with one project note) with the account of the first project that has one, reloads the test window, and works through the
// Brain: the search box is gone from Map, Journey and Report, Notes has its buttons, and the Ask page answers. TWO REAL HAIKU CALLS are made (a few cents of the plan): one question the notes
// answer, and one the search finds sections for but the notes do not answer. A question nothing matches must send nothing. The project and its folder are removed again, whatever happens,
// unless KEEP=1 is set (then the project stays so the window can be looked at). Never run it on a window the owner has open. Screenshots go to SHOT_DIR when that is set.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
try { const w0 = await c.send("Browser.getWindowForTarget"); await c.send("Browser.setWindowBounds", { windowId: w0.result.windowId, bounds: { windowState: "maximized" } }); await new Promise((r) => setTimeout(r, 800)); } catch { /* tested as it is */ }
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const note = (s) => console.log(s);
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { if (process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); await c.shot(path.join(process.env.SHOT_DIR, name + ".png")); } };

const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-ask-ui-${process.pid}`);
const NAME = "kona-ask-ui";
const proj = path.join(root, "project");
const put = (rel, text) => { const f = path.join(proj, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const tab = (name) => c.ev(`(() => { const b = [...document.querySelectorAll('section[data-sheet] [role="tab"]')].find((x) => x.textContent.trim() === ${JSON.stringify(name)}); if (!b) return false; b.click(); return true; })()`);
const press = (label) => c.ev(`(() => { const x = [...document.querySelectorAll('section[data-sheet] button')].find((e) => e.textContent.trim() === ${JSON.stringify(label)}); if (!x || x.disabled) return false; x.click(); return true; })()`);
const sheetText = () => c.ev(`(document.querySelector('section[data-sheet]')?.innerText ?? '').replace(/\\s+/g, ' ')`);
const ask = async (q) => {
  await c.ev(`(() => { const i = document.querySelector('input[aria-label="Ask the brain"]'); i.focus(); i.select(); return true; })()`);
  await c.send("Input.insertText", { text: q });
  await wait(150);
  return c.ev(`(() => { const b = document.querySelector('form[role="search"] button[type="submit"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
};
const answers = () => c.ev(`document.querySelectorAll('section[aria-label^="Answer to"]').length`);
const lastAnswer = () => c.ev(`(() => { const a = [...document.querySelectorAll('section[aria-label^="Answer to"]')].pop(); return a ? a.innerText.replace(/\\s+/g, ' ') : ''; })()`);
const settled = (n) => c.waitFor(`(() => { const a = [...document.querySelectorAll('section[aria-label^="Answer to"]')]; const l = a[a.length - 1]; return a.length === ${n} && !!l && !/Reading \\d+ sections?/.test(l.innerText); })()`, 150000, 400);

const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
let id = null;
try {
  if (!account) { note("SKIP no project with an account to borrow, the throwaway project could not be opened"); process.exit(0); }
  put(".kona/brain/ukulele-club.md", "---\ntitle: Ukulele club\nkind: topic\n---\n# Ukulele club\n\nThe club meets on Thursday evenings in the village hall. Membership costs ten euros a year and includes the songbook.\n");
  id = (await invoke("add_project", { folder: proj, name: NAME, account })).project.id;
  await c.send("Page.reload");
  await wait(1500);
  ok("the welcome page is back after the reload", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  ok("the throwaway project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if ([...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1 && !b.disabled) { b.click(); return true; } break; } } } return false; })()`) && await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 10`, 20000, 200));
  await c.ev(`window.__errs = []; addEventListener("error", (e) => window.__errs.push(String(e.message))); addEventListener("unhandledrejection", (e) => window.__errs.push("rejection " + String(e.reason))); true`);

  // ---- the tabs, and the search box that is gone from the other pages ----
  ok("the Brain opens", await c.ev(`(() => { const e = document.querySelector('[aria-label="Open Brain"]'); if (!e) return false; e.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Brain'`, 6000, 100));
  const tabs = await c.ev(`[...document.querySelectorAll('section[data-sheet] [role="tab"]')].map((b) => b.textContent.trim())`);
  ok("the tabs are Map, Notes, Journey, Ask, Report", JSON.stringify(tabs) === JSON.stringify(["Map", "Notes", "Journey", "Ask", "Report"]), tabs.join());
  for (const t of ["Map", "Journey", "Report"]) {
    await tab(t); await wait(500);
    ok(`the ${t} page has no search box above it`, await c.ev(`!document.querySelector('input[aria-label="Ask the brain"]')`));
  }
  await tab("Notes"); await wait(500);
  ok("Notes has New note and the session-end checkbox", (await sheetText()).includes("Write a note when a session ends") && await c.ev(`[...document.querySelectorAll('section[data-sheet] button')].some((b) => b.textContent.trim() === 'New note')`));
  ok("the project's note is in the Notes list", (await sheetText()).includes("Ukulele club"));

  // ---- the Ask page ----
  await tab("Ask"); await wait(500);
  ok("the Ask page has the input and says what it is", await c.ev(`!!document.querySelector('input[aria-label="Ask the brain"]')`) && (await sheetText()).includes("Answers come only from your notes"));
  await shot("ask-empty");

  // 1. nothing matches: nothing is sent
  const wantedBefore = (await invoke("brain_wanted", { projectId: id })).length;
  ok("a question is typed and sent", await ask("zebra quantum marmalade xylophone"));
  ok("a question nothing matches is answered at once: Not in the brain", await settled(1) && (await lastAnswer()).includes("Not in the brain"), await lastAnswer());
  ok("it says nothing was sent to Haiku and offers the next steps", /nothing was sent to Haiku/.test(await lastAnswer()) && (await lastAnswer()).includes("Write a note about this") && (await lastAnswer()).includes("Go deeper in a session"), await lastAnswer());
  ok("the question is on the wanted list", (await invoke("brain_wanted", { projectId: id })).length === wantedBefore + 1);
  await shot("ask-none");

  // 2. a question the notes answer: a real Haiku call
  ok("a question the notes answer is sent", await ask("what is a worktree"));
  ok("it shows that it is reading", await c.waitFor(`/Reading \\d+ sections?/.test(document.body.innerText)`, 4000, 50) || (await answers()) === 2);
  ok("the answer comes back: Found in the brain, with words about a worktree", await settled(2) && (await lastAnswer()).includes("Found in the brain") && /worktree/i.test(await lastAnswer()), await lastAnswer());
  const a2 = await lastAnswer();
  note("answer 2: " + a2.slice(0, 500));
  ok("it names the notes the answer rests on", a2.includes("The notes this rests on") && a2.includes("worktrees"), a2.slice(-200));
  await shot("ask-answer");

  // 3. a question that finds sections the notes do not answer: Haiku must not make something up
  ok("a question near the notes but not answered by them is sent", await ask("how many sessions can run at the same time"));
  ok("it settles", await settled(3), await lastAnswer());
  note("answer 3: " + (await lastAnswer()).slice(0, 400));
  ok("the notes do not answer it, and it says so rather than inventing", /Not in the brain/.test(await lastAnswer()) && /do not answer this|nothing was sent/.test(await lastAnswer()), await lastAnswer());
  await shot("ask-notcovered");

  // 4. a source opens its note, and the chat is still there when coming back
  ok("a source opens its note on the Notes page", await c.ev(`(() => { const b = [...document.querySelectorAll('section[aria-label^="Answer to: what is a worktree"] ul button')][0]; if (!b) return false; b.click(); return true; })()`) && await c.waitFor(`document.querySelector('section[data-sheet] [role="tab"][aria-selected="true"]')?.textContent.trim() === 'Notes'`, 4000, 100));
  await tab("Ask"); await wait(400);
  ok("the chat is still there after another page was open", (await answers()) === 3);

  // 5. save an answer as a note
  ok("Save as a note", await c.ev(`(() => { const s = document.querySelector('section[aria-label^="Answer to: what is a worktree"]'); const b = [...s.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save as a note'); if (!b) return false; b.click(); return true; })()`));
  ok("it says Saved as a note and the file is in the project", await c.waitFor(`document.body.innerText.includes('Saved as a note')`, 4000, 100) && fs.readdirSync(path.join(proj, ".kona/brain")).some((f) => f.startsWith("answer-what-is-a-worktree")), fs.readdirSync(path.join(proj, ".kona/brain")).join());
  const saved = fs.readdirSync(path.join(proj, ".kona/brain")).find((f) => f.startsWith("answer-"));
  const text = saved ? fs.readFileSync(path.join(proj, ".kona/brain", saved), "utf8") : "";
  ok("the saved note says where it came from", text.includes("source: brain-ask") && text.includes("kind: topic"), text.slice(0, 200));

  // 6. a new chat
  ok("New chat empties the page", await press("New chat") && await c.waitFor(`document.querySelectorAll('section[aria-label^="Answer to"]').length === 0`, 2000, 100));
  note("page errors: " + JSON.stringify(await c.ev(`window.__errs`)).slice(0, 800));
  ok("no page error was raised", (await c.ev(`window.__errs.length`)) === 0);
} catch (e) {
  failed++;
  note("FAIL the test stopped: " + (e?.stack ?? e));
} finally {
  if (process.env.KEEP !== "1") {
    try { if (id) await invoke("remove_project", { id }); } catch (e) { note("could not remove the throwaway project: " + e); }
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* a leftover temp folder is harmless */ }
  } else note("KEEP=1: the throwaway project stays: " + id + " at " + proj);
  c.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
