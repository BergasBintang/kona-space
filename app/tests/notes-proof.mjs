// A REAL proof, in real conversations, that sessions follow the rules about notes (tickets T-0030 and T-0032, decision 81): a document is written as a note and not as a file in
// docs/, the ticket of the session is stamped on it by Kona, one section of a note can be changed, two notes that disagree are said and asked about, and a fact that is in the
// brain is found and used. It SPENDS PLAN (Haiku, a few short turns: some cents) and runs only with the owner's word: set MOCK_TEST_RUN=1.
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then   npx tauri dev   then
//   MOCK_TEST_RUN=1 node tests/notes-proof.mjs [--brain <a folder of notes to copy into the throwaway project>] [--facts <facts.json>]
// facts.json: [{ "question": "...", "expect": "a word the right answer contains" }]. Keep a file about a real project OUT of this repo.
// It adds ONE throwaway project (with a copy of the notes you name, plus two planted notes that disagree), and removes the project, its folder and the Claude transcripts of its
// sessions again whatever happens. Every permission card is answered "no" and written down, so a session that tries to write a file is seen. Never run it on a window the owner has open.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

if (process.env.MOCK_TEST_RUN !== "1") { console.log("SKIP this test makes real model calls and starts real sessions; set MOCK_TEST_RUN=1 with the owner's word"); process.exit(0); }
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const brainFrom = arg("--brain");
const facts = arg("--facts") ? JSON.parse(fs.readFileSync(arg("--facts"), "utf8")) : [];
const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0, spent = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + String(detail).slice(0, 300) + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NAME = "kona-notes-proof";
const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-notes-proof-${process.pid}`);
const project = path.join(root, "project");
const brainDir = path.join(project, ".kona", "brain");
const sessionIds = [];
let projectId = null;

const startListening = () => c.ev(`(async () => {
  window.__proof = [];
  const cb = window.__TAURI_INTERNALS__.transformCallback((e) => window.__proof.push(e.payload));
  await window.__TAURI_INTERNALS__.invoke("plugin:event|listen", { event: "session-event", target: { kind: "Any" }, handler: cb });
  return true;
})()`);

/** One turn, tried again (up to three times, a minute apart) when Claude Code could not refresh its sign-in because another Claude Code process was doing it. */
async function turn(sessionId, text, limitMs = 240000) {
  for (let attempt = 1; ; attempt++) {
    const r = await turnOnce(sessionId, text, limitMs);
    if (attempt < 3 && /Failed to refresh OAuth token/i.test(r.text)) { note("the sign-in could not be refreshed (another Claude Code process was doing it); trying again in a minute"); await wait(60000); continue; }
    return r;
  }
}

async function turnOnce(sessionId, text, limitMs) {
  const from = await c.ev(`window.__proof.length`);
  await invoke("send_message", { sessionId, text, images: [] });
  const started = Date.now();
  const seen = { tools: [], denied: [], text: "", cost: 0, results: 0, stderr: [] };
  let cursor = from;
  while (Date.now() - started < limitMs) {
    const batch = JSON.parse(await c.ev(`JSON.stringify(window.__proof.slice(${cursor}))`));
    cursor += batch.length;
    for (const ev of batch) {
      if (ev.sessionId !== sessionId) continue;
      const rec = ev.record;
      if (rec.type === "assistant") for (const b of rec.message?.content ?? []) if (b.type === "tool_use") seen.tools.push({ name: b.name, input: b.input });
      if (rec.type === "control_request" && rec.request?.subtype === "can_use_tool") {
        seen.denied.push({ name: rec.request.tool_name, input: rec.request.input });
        await invoke("answer_permission", { sessionId, requestId: rec.request_id, allow: false, input: null, message: "This test does not allow that tool. Use the brain tools instead.", remember: null });
      }
      if (rec.type === "kona/stderr") seen.stderr.push(rec.text);
      if (rec.type === "result") { seen.results++; seen.text = String(rec.result ?? ""); seen.cost = Number(rec.kona_turn_cost_usd ?? rec.total_cost_usd ?? 0); }
    }
    if (seen.results > 0) break;
    await wait(700);
  }
  spent += seen.cost;
  return seen;
}
const toolNames = (r) => r.tools.map((t) => t.name.replace(/^mcp__kona-board__/, ""));
const files = () => (fs.existsSync(brainDir) ? fs.readdirSync(brainDir).filter((f) => f.endsWith(".md")) : []);
const read = (f) => fs.readFileSync(path.join(brainDir, f), "utf8");

const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
try {
  if (!account) { note("SKIP no project with an account to borrow"); process.exit(0); }
  fs.mkdirSync(brainDir, { recursive: true });
  if (brainFrom) for (const f of fs.readdirSync(brainFrom)) if (f.endsWith(".md")) fs.copyFileSync(path.join(brainFrom, f), path.join(brainDir, f));
  // two notes that disagree, written the way a session writes them
  const planted = (id, title, day) => `---\ntitle: ${title}\nkind: decision\ndate: 2026-10-20\nsource: agent\nsession: planted-by-the-test\n---\n# ${title}\n\nThe weekly release goes out every ${day}. This was agreed with the whole team.\n`;
  fs.writeFileSync(path.join(brainDir, "release-day-tuesday.md"), planted("a", "Release day: Tuesday", "Tuesday"));
  fs.writeFileSync(path.join(brainDir, "release-day-thursday.md"), planted("b", "Release day: Thursday", "Thursday"));
  const startFiles = new Set(files());
  fs.mkdirSync(path.join(project, "docs"), { recursive: true });
  projectId = (await invoke("add_project", { folder: project, name: NAME, account })).project.id;
  const t = await invoke("create_ticket", { projectId, new: { title: "Compare two ways to store uploads", description: "Write the comparison down for later.", status: "ready", own_copy: "no" } });
  ok("the throwaway ticket exists", /^T-\d{4,}$/.test(t.id), t.id);
  await startListening();
  const digest = await c.ev(`(async () => { const m = await import("/src/lib/brain/summary.ts"); return await m.buildDigest(${JSON.stringify(projectId)}, { ticketId: ${JSON.stringify(t.id)} }); })()`);
  ok("the digest says the notes are the current truth and that a disagreement is said", /current truth/.test(digest) && /disagree/.test(digest) && !/history, not current fact/.test(digest), digest.slice(0, 120));

  // 1. a document is written as a note, under the ticket
  const s1 = await invoke("start_session", { folder: project, roleId: null, accountId: account, useVoice: false, ticketId: t.id, brainDigest: digest, model: "haiku", mode: "default", resume: null });
  sessionIds.push(s1);
  await wait(1500);
  const r1 = await turn(s1, "Write up a short report (about 120 words, with a heading Open for the questions still open) comparing two ways to store user uploads: the local disk and object storage. Keep it for later sessions.");
  note(`turn 1: tools ${toolNames(r1).join(", ") || "none"}; denied ${r1.denied.map((d) => d.name).join(", ") || "none"}; cost ${r1.cost.toFixed(4)}`);
  const fresh = files().filter((f) => !startFiles.has(f));
  ok("the session saved the report with the brain's save_note tool", toolNames(r1).includes("save_note"), toolNames(r1).join(","));
  ok("it did not try to write a file", r1.denied.filter((d) => /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(d.name)).length === 0, r1.denied.map((d) => d.name + " " + JSON.stringify(d.input).slice(0, 80)).join(" | "));
  ok("a new note is in the brain folder and docs/ is empty", fresh.length >= 1 && fs.readdirSync(path.join(project, "docs")).length === 0, fresh.join(", "));
  const mine = fresh[0];
  ok("Kona stamped the ticket on it", !!mine && new RegExp(`\\nticket: ${t.id}\\n`).test(read(mine)), mine);
  ok("the session did not write the ticket into the title or the front matter itself", !!mine && !new RegExp(`title:.*${t.id}`).test(read(mine)));

  // 2. one section of that note is changed, the rest stays
  const body1 = mine ? read(mine) : "";
  const r2 = await turn(s1, "Add one more bullet under the Open heading of that report: 'Check the price per GB'. Change only that part; do not rewrite the rest of the report.");
  note(`turn 2: tools ${toolNames(r2).join(", ") || "none"}; denied ${r2.denied.map((d) => d.name).join(", ") || "none"}; cost ${r2.cost.toFixed(4)}`);
  const body2 = mine ? read(mine) : "";
  const used = r2.tools.filter((x) => /save_note$/.test(x.name));
  ok("the new bullet is in the note", /price per GB/i.test(body2));
  ok("the rest of the note is still there", body1.split("\n").filter((l) => l.trim().length > 40).filter((l) => !/Open/i.test(l)).slice(0, 4).every((l) => body2.includes(l.trim())));
  ok("the session used the section of save_note (or the whole note was sent again: said which)", used.length > 0, used.map((u) => (u.input.section ? `section="${u.input.section}" append=${!!u.input.append}` : "whole note again")).join(" | "));
  ok("the ticket is still on the note, once", !!mine && (read(mine).match(/\nticket: /g) ?? []).length === 1);

  await invoke("stop_session", { sessionId: s1 }); // the number of open sessions is limited
  await wait(1500);

  // 3. two notes that disagree are said, not guessed
  const s3 = await invoke("start_session", { folder: project, roleId: null, accountId: account, useVoice: false, ticketId: null, brainDigest: digest, model: "haiku", mode: "default", resume: null });
  sessionIds.push(s3);
  await wait(1500);
  const r3 = await turn(s3, "Which weekday does our weekly release go out? Look in the brain first.");
  note(`turn 3: tools ${toolNames(r3).join(", ") || "none"}; cost ${r3.cost.toFixed(4)}; answer: ${r3.text.replace(/\s+/g, " ").slice(0, 260)}`);
  ok("it looked in the brain", toolNames(r3).some((n) => /search_brain|read_note|list_notes/.test(n)));
  ok("it names both days", /tuesday/i.test(r3.text) && /thursday/i.test(r3.text));
  ok("it says the notes disagree and asks which is right", /(disagree|conflict|contradict|inconsisten|differ|which (one )?(is|of)|clarify|confirm|not sure|unclear)/i.test(r3.text), r3.text.slice(0, 200));

  await invoke("stop_session", { sessionId: s3 });
  await wait(1500);

  // 4. a fact that is in the brain is found and used
  for (const f of facts) {
    const s4 = await invoke("start_session", { folder: project, roleId: null, accountId: account, useVoice: false, ticketId: null, brainDigest: digest, model: "haiku", mode: "default", resume: null });
    sessionIds.push(s4);
    await wait(1200);
    const r4 = await turn(s4, f.question + " Look in the brain first.");
    note(`fact: ${f.question} -> ${r4.text.replace(/\s+/g, " ").slice(0, 200)} (tools ${toolNames(r4).join(", ")})`);
    ok(`it found the fact: ${f.question}`, new RegExp(f.expect, "i").test(r4.text) && toolNames(r4).some((n) => /search_brain|read_note/.test(n)));
    await invoke("stop_session", { sessionId: s4 });
    await wait(1500);
  }
  note(`spent in the sessions: about $${spent.toFixed(3)} (Claude Code's estimate at list price)`);
} finally {
  for (const s of sessionIds) { try { await invoke("stop_session", { sessionId: s }); } catch { /* it has ended */ } }
  await wait(1500);
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === projectId) await invoke("remove_project", { id: p.id }); } catch (e) { note("could not remove the project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
  try { const pr = path.join(os.homedir(), ".claude", "projects"); for (const d of fs.readdirSync(pr)) if (d.includes("kona-notes-proof")) { fs.rmSync(path.join(pr, d), { recursive: true, force: true }); note("removed the transcripts folder " + d); } } catch { /* nothing to remove */ }
  try { const final = await invoke("list_projects"); ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id))); } catch { /* the window is gone */ }
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
