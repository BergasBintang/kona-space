// Topics (decision 104) in the REAL window, in a THROWAWAY project of made-up notes. Start Kona with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   (and, when the owner's own Kona is open, WEBVIEW2_USER_DATA_FOLDER=<a folder of your own>), then   node tests/topics-ui.mjs
// It adds one project (a folder in the temp folder) whose notes name their topics, with a hand-written list of notes by topic that has gone out of date, and checks that:
//   - the list is rewritten from the topics when the Brain page reads the notes, keeps the hand-written summaries, and is not rewritten again when nothing changed;
//   - the Notes list, the Map and the note itself say the same topics;
//   - the Report asks for the topic of a note that has none, suggests the topic its links agree on, and "File under" writes the line and the list follows;
//   - editing a note offers its topic in Kona's own picker, and the list follows that too;
//   - a question that names a note by its id is searched as a request for that note.
// It removes the project and the folder at the end. The last check is the Ask page handing the notes to Haiku: with a signed-in account that is one cheap call, and the check passes at the moment the notes are handed over.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const NAME = "kona-topics-probe";
const root = path.join(os.tmpdir(), `kona-topics-${process.pid}`);
const proj = path.join(root, "project");
const dir = path.join(proj, ".kona", "brain");
const before = await invoke("list_projects");
const sheet = `section[data-sheet]:not([hidden])`;
const press = (label, within = sheet) => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(within)} + ' button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)} && !x.disabled); if (!b) return false; b.click(); return true; })()`);
const text = () => c.ev(`document.querySelector('${sheet}')?.innerText.replace(/\\s+/g, ' ') ?? ''`);
const read = (id) => fs.readFileSync(path.join(dir, id + ".md"), "utf8").replace(/\r/g, "");
const LIST = "every-note-by-topic";
const snap = async (name) => { if (!process.env.SHOTS) return; fs.mkdirSync(process.env.SHOTS, { recursive: true }); await wait(400); await c.shot(path.join(process.env.SHOTS, name + ".png")); };
const sectionOf = (md, heading) => { const m = md.match(new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(\\n## |$)`)); return m ? m[1] : null; };

const note = (id, topic, body, links = []) => {
  const words = "This note says what was decided and why, in plain words, so that a later reader can find it again without asking anybody. ";
  fs.writeFileSync(path.join(dir, id + ".md"), `---\ntitle: ${id.replace(/-/g, " ")}\nkind: note\ndate: 2026-11-20\nsource: agent\n${topic ? `topic: ${topic}\n` : ""}---\n# ${id.replace(/-/g, " ")}\n\n${body} ${words}${words}\n\n${links.map((l) => `See [[${l}]].`).join(" ")}\n`);
};

let account = null;
try {
  fs.mkdirSync(dir, { recursive: true });
  note("landing-brief", "Landing page", "The approved brief for the landing page: one goal, one visitor, one voice.", ["landing-copy-en", "brand-fonts"]);
  note("landing-copy-en", "Landing page", "The English words of every section of the page.", ["landing-brief", "landing-sections"]);
  note("landing-sections", "Landing page", "The order of the sections of the page.", ["landing-brief", "brand-logo"]);
  note("landing-ads", "Landing page", "Two ad slots that hide when empty.", ["landing-sections"]);
  note("brand-colours", "Brand", "The palette and the one rule about yellow.", ["brand-logo"]);
  note("brand-logo", "Brand", "The logo in two versions, light and dark.", ["brand-colours", "landing-sections"]);
  note("brand-fonts", "Brand", "One heavy face for the name and one plain face for text.", ["brand-colours"]);
  note("hosting-server", "Hosting", "Where the small server is and who can log in.", ["hosting-deploy"]);
  note("hosting-deploy", "Hosting", "How a new version is put on the server.", ["hosting-server", "hosting-backups"]);
  note("hosting-backups", "Hosting", "Backups run every night and are kept a week.", ["hosting-server"]);
  note("new-idea-note", null, "An idea written down by a session with no topic yet.", ["landing-brief", "landing-copy-en", "landing-sections", "brand-logo"]);
  // a hand-written list of notes by topic that has gone out of date: two notes, one old heading, two summaries written by hand
  fs.writeFileSync(path.join(dir, LIST + ".md"), `---\ntitle: Every note by topic\nkind: note\ndate: 2026-11-10\ntopic: Index\ngenerated: topics\n---\n# Every note by topic\n\n## Old heading\n\n- [[landing-brief]]: the approved brief\n- [[hosting-server]]: where the server is\n`);

  for (const a of await invoke("list_accounts")) { account ??= a; try { if ((await invoke("account_status", { id: a.id })).logged_in) { account = a; break; } } catch { /* try the next */ } }
  if (!account) throw new Error("no account in this Kona");
  const projectId = (await invoke("add_project", { folder: proj, name: NAME, account: account.id })).project.id;
  await c.send("Page.reload"); await wait(1500);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  const opened = await c.ev(`(() => { const isOpen = (x) => /^Open$/.test(x.textContent.trim()); const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(NAME)}); if (!title) return false; let n = title; while (n && ![...n.querySelectorAll('button')].some(isOpen)) n = n.parentElement; const b = n && [...n.querySelectorAll('button')].find(isOpen); if (!b || b.disabled) return false; b.click(); return true; })()`);
  ok("the throwaway project opens", opened && await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 15000, 200));
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  ok("the old list is still the hand-written one before the Brain is opened", read(LIST).includes("Old heading"));

  await c.ev(`document.querySelector('[aria-label="Open Brain"]').click(); true`);
  ok("the Brain opens", await c.waitFor(`!!document.querySelector('${sheet}')`, 8000, 200));
  await press("Notes");
  ok("the Notes list shows", await c.waitFor(`!!document.querySelector('${sheet} [role=list][aria-label=Notes] button[aria-expanded]')`, 8000, 200));

  // ---- 1. the list of notes by topic is written from the topics
  const list = read(LIST);
  ok("the list of notes by topic was rewritten from the topics", !list.includes("Old heading") && /## Brand\n/.test(list) && /## Hosting\n/.test(list) && /## Landing page\n/.test(list) && /## No topic yet\n/.test(list) && list.includes("generated: topics") && list.includes("topic: Index"));
  ok("the summaries written by hand were kept, and a note with none got its title", list.includes("- [[landing-brief]]: the approved brief") && list.includes("- [[hosting-server]]: where the server is") && list.includes("- [[brand-logo]]: brand logo"), list);
  ok("every note is in it once, and the list is not in itself", ["landing-brief", "landing-copy-en", "landing-sections", "landing-ads", "brand-colours", "brand-logo", "brand-fonts", "hosting-server", "hosting-deploy", "hosting-backups", "new-idea-note"].every((id) => list.split(`[[${id}]]`).length === 2) && !list.includes(`[[${LIST}]]`));
  const m1 = fs.statSync(path.join(dir, LIST + ".md")).mtimeMs;
  await invoke("brain_load", { projectId }); await invoke("brain_load", { projectId }); await wait(300);
  ok("reading the notes again writes nothing when nothing changed", fs.statSync(path.join(dir, LIST + ".md")).mtimeMs === m1);

  // ---- 2. the Notes list says the same
  const heads = () => c.ev(`[...document.querySelectorAll('${sheet} [role=list][aria-label=Notes] button[aria-expanded]')].map((b) => b.getAttribute('aria-label'))`);
  let h = await heads();
  ok("the Notes list groups are the topics, then No topic yet, then the starter notes", JSON.stringify(h.slice(0, 5)) === JSON.stringify(["Brand, 3 notes", "Hosting, 3 notes", "Index, 1 note", "Landing page, 4 notes", "No topic yet, 1 note"]) && /^Kona starter notes, \d+ notes$/.test(h[5] ?? ""), JSON.stringify(h));
  await snap("1-notes");
  ok("opening a note shows its topic", await c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} [role=listitem]')].find((x) => x.title === 'landing brief'); if (!b) return false; b.click(); return true; })()`) && await c.waitFor(`/Topic: Landing page/.test(document.querySelector('${sheet}')?.innerText ?? '')`, 6000, 200));
  ok("a note with no topic says so", await c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} [role=listitem]')].find((x) => x.title === 'new idea note'); if (!b) return false; b.click(); return true; })()`) && await c.waitFor(`[...document.querySelectorAll('${sheet} span')].some((s) => s.textContent.trim() === 'No topic yet' && !s.closest('[role=list]'))`, 6000, 200));

  // ---- 3. the Report suggests, and File under writes only the topic line
  const bodyBefore = read("new-idea-note").split("\n---\n").slice(1).join("\n---\n");
  await press("Report");
  ok("the Report asks for the topic of the note, and suggests the topic its links agree on", await c.waitFor(`/Check the topic/.test(document.querySelector('${sheet}')?.innerText ?? '') && [...document.querySelectorAll('${sheet} button')].some((b) => b.textContent.trim() === 'File under Landing page')`, 8000, 200));
  await snap("2-report");
  ok("File under writes the topic line", await press("File under Landing page") && await c.waitFor(`/Filed/.test(document.querySelector('${sheet} [role=status]')?.innerText ?? '')`, 8000, 200) && /\ntopic: Landing page\n/.test(read("new-idea-note")));
  ok("nothing else in the note changed", read("new-idea-note").split("\n---\n").slice(1).join("\n---\n") === bodyBefore);
  ok("the list follows: the note is under Landing page and there is no No topic yet", (await wait(600), true) && (sectionOf(read(LIST), "Landing page") ?? "").includes("[[new-idea-note]]") && !read(LIST).includes("## No topic yet"), read(LIST));
  ok("the Report says every note has a topic and its links agree", await c.waitFor(`/Every note has a topic and its links agree with it/.test(document.querySelector('${sheet}')?.innerText ?? '')`, 8000, 200));

  // ---- 4. editing a note offers the topics in Kona's own picker
  await press("Notes");
  await c.waitFor(`!!document.querySelector('${sheet} [role=list][aria-label=Notes] button[aria-expanded]')`, 6000, 200);
  await c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} [role=listitem]')].find((x) => x.title === 'hosting deploy'); b.click(); return true; })()`);
  await c.waitFor(`/Topic: Hosting/.test(document.querySelector('${sheet}')?.innerText ?? '')`, 6000, 200);
  ok("Edit opens the note with a Topic picker", await press("Edit") && await c.waitFor(`!!document.querySelector('${sheet} [role=combobox]')`, 6000, 200));
  ok("the picker shows the note's topic", await c.ev(`/Hosting/.test(document.querySelector('${sheet} [role=combobox]').innerText)`));
  await c.ev(`document.querySelector('${sheet} [role=combobox]').click(); true`);
  ok("it lists the topics of the project and a new topic", await c.waitFor(`[...document.querySelectorAll('[role=listbox][aria-label=Topic] [role=option]')].map((o) => o.innerText.split('\\n')[0].trim()).join('|') === 'No topic yet|Hosting|Landing page|Brand|A new topic…'`, 4000, 200) || await c.waitFor(`/Landing page/.test(document.querySelector('[role=listbox][aria-label=Topic]')?.innerText ?? '') && /A new topic/.test(document.querySelector('[role=listbox][aria-label=Topic]')?.innerText ?? '')`, 4000, 200));
  await snap("3-edit-picker");
  ok("choosing Brand sets the topic line of the note", await c.ev(`(() => { const o = [...document.querySelectorAll('[role=listbox][aria-label=Topic] [role=option]')].find((x) => x.innerText.trim().startsWith('Brand')); if (!o) return false; o.click(); return true; })()`) && await c.waitFor(`/\\ntopic: Brand\\n/.test(document.querySelector('${sheet} textarea')?.value ?? '')`, 4000, 200));
  ok("Save writes it and the list follows", await press("Save") && await c.waitFor(`/^Saved\./.test(document.querySelector('${sheet} [role=status]')?.innerText.trim() ?? '')`, 8000, 200) && /\ntopic: Brand\n/.test(read("hosting-deploy")) && (sectionOf(read(LIST), "Brand") ?? "").includes("[[hosting-deploy]]") && !(sectionOf(read(LIST), "Hosting") ?? "").includes("[[hosting-deploy]]"), read(LIST));

  // ---- 5. the Map says the same topics, with all their notes counted
  await press("Map");
  ok("the Map names the groups by topic", await c.waitFor(`(() => { const t = [...document.querySelectorAll('${sheet} svg text')].map((x) => x.textContent); return t.includes('Landing page (5)') && t.includes('Brand (4)'); })()`, 10000, 300), JSON.stringify(await c.ev(`[...document.querySelectorAll('${sheet} svg text')].map((x) => x.textContent).filter((x) => /\\(\\d+\\)$/.test(x))`)));

  // ---- 6. a question that names a note by its id is a request for that note
  await snap("4-map");
  await press("Ask");
  await c.waitFor(`!!document.querySelector('${sheet} input[aria-label="Ask the brain"]')`, 6000, 200);
  await c.ev(`document.querySelector('${sheet} input[aria-label="Ask the brain"]').focus(); true`);
  await c.send("Input.insertText", { text: "which topic is landing-brief in?" }); await wait(300);
  ok("the question is sent", await c.ev(`(() => { const b = document.querySelector('${sheet} form[role=search] button[type=submit]'); if (!b || b.disabled) return false; b.click(); return true; })()`));
  ok("the notes are found by the id and handed over (not 'Not in the brain')", await c.waitFor(`/Reading \\d+ sections? of your notes|Found in the brain|Partly in the brain/.test(document.querySelector('${sheet}')?.innerText ?? '')`, 20000, 200), (await text()).slice(-400));
  ok("and nothing says the brain has no answer at that moment", !/Not in the brain/.test(await text()) || /Found in the brain|Partly in the brain/.test(await text()));
} catch (e) { console.log("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 600)); failed++; }
finally {
  try { for (const p of await invoke("list_projects")) if (p.name === NAME) await invoke("remove_project", { id: p.id }); } catch (e) { console.log("could not remove the project: " + e); }
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* removed below */ }
  try { const f = await invoke("list_projects"); ok("the project list is as it was, and the folder is gone", JSON.stringify(f.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)) && !fs.existsSync(root)); } catch { /* the window is gone */ }
  c.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
