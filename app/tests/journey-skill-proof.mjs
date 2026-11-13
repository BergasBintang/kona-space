// A REAL proof, in a real conversation, that the skill build-a-journey works (ticket T-0040, decision 91, lesson 15 of docs/LESSONS.md): a Product person (Kiki) is given a small
// made-up site with no journey note, uses the skill, and must save a journey note that the checker accepts and that matches the pages. It SPENDS PLAN (Haiku, a few turns: some cents)
// and runs only with the owner's word: set MOCK_TEST_RUN=1.
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then start a BUILT program   then   MOCK_TEST_RUN=1 node tests/journey-skill-proof.mjs
// It adds ONE throwaway project (a folder in the temp folder) and removes the project, its folder and the Claude transcripts of its session again whatever happens. A tool is allowed only
// when it reads, uses the board's brain tools, runs the skill's checker, or writes a scratch file OUTSIDE the project; every other permission card is answered "no" and written down, so
// a session that tries to change the project is seen. Never run it on a window the owner has open.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { attach } from "./cdp.mjs";
import { parseJourney } from "../src/lib/brain/journey.ts";

if (process.env.MOCK_TEST_RUN !== "1") { console.log("SKIP this test makes real model calls and starts a real session; set MOCK_TEST_RUN=1 with the owner's word"); process.exit(0); }
const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0, spent = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + String(detail).slice(0, 400) + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NAME = "kona-journey-skill";
const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-journey-skill-${process.pid}`);
const project = path.join(root, "project");
const scratch = path.join(root, "scratch");
const brainDir = path.join(project, ".kona", "brain");
const sessionIds = [];
let projectId = null;
let account = null;

const put = (rel, text) => { const f = path.join(project, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
// a small made-up site: a pet adoption page with a list, a search, an application form with its own error messages, and a thank-you page
const SITE = {
  "index.html": `<!doctype html><html><head><title>Paws</title></head><body><h1>Paws: find a pet</h1><p>Every pet here needs a home.</p><a href="pets.html">See the pets</a> <a href="staff.html">Staff sign in</a></body></html>`,
  "pets.html": `<!doctype html><html><head><title>Pets</title></head><body><h1>Pets waiting for a home</h1><input id="q" placeholder="Search by name"><select id="kind"><option>All</option><option>Dogs</option><option>Cats</option></select><ul id="list"></ul><p id="none" hidden>No pet matches your search.</p><a href="apply.html">Apply to adopt</a><script src="js/pets.js"></script></body></html>`,
  "apply.html": `<!doctype html><html><head><title>Apply</title></head><body><h1>Apply to adopt</h1><form id="f"><input id="name" placeholder="Your name"><input id="email" placeholder="Email"><input id="phone" placeholder="Phone"><button id="send">Send application</button></form><p id="err" role="alert"></p><script src="js/apply.js"></script></body></html>`,
  "thanks.html": `<!doctype html><html><head><title>Thanks</title></head><body><h1>Thank you</h1><p>We will call you within two days.</p><a href="index.html">Back to the start</a></body></html>`,
  "staff.html": `<!doctype html><html><head><title>Staff</title></head><body><h1>Staff sign in</h1><input id="user" placeholder="Staff name"><input id="pass" type="password" placeholder="Password"><button id="login">Sign in</button><p id="err" role="alert"></p><script src="js/staff.js"></script></body></html>`,
  "js/pets.js": `const pets = [{ n: "Rex", k: "Dogs" }, { n: "Tom", k: "Cats" }];\nfunction show(q, kind) { const hits = pets.filter((p) => p.n.toLowerCase().includes(q.toLowerCase()) && (kind === "All" || p.k === kind)); document.getElementById("none").hidden = hits.length > 0; }\n`,
  "js/apply.js": `document.getElementById("send").onclick = () => {\n  const email = document.getElementById("email").value, phone = document.getElementById("phone").value;\n  if (!document.getElementById("name").value) return fail("Please write your name");\n  if (!email.includes("@")) return fail("Please enter an email address");\n  if (!/^[0-9 +]+$/.test(phone)) return fail("The phone number can only hold digits");\n  location.href = "thanks.html";\n};\nfunction fail(m) { document.getElementById("err").textContent = m; }\n`,
  "js/staff.js": `document.getElementById("login").onclick = () => { if (document.getElementById("pass").value !== "staff") document.getElementById("err").textContent = "Wrong name or password"; else location.href = "pets.html"; };\n`,
  "README.md": `# Paws\n\nA small site that helps a shelter find homes for pets. Visitors look at the pets and apply to adopt one. Staff sign in to see the pets.\n`,
};

const startListening = () => c.ev(`(async () => {
  window.__proof = [];
  const cb = window.__TAURI_INTERNALS__.transformCallback((e) => window.__proof.push(e.payload));
  await window.__TAURI_INTERNALS__.invoke("plugin:event|listen", { event: "session-event", target: { kind: "Any" }, handler: cb });
  return true;
})()`);

const inside = (p, dir) => { const rel = path.relative(dir, path.resolve(p)); return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel); };
/** may the test let this tool run? reads, the board's brain tools, the skill's checker, and a scratch file outside the project */
function allowed(name, input) {
  if (/^(Read|Glob|Grep|Skill|LS|TodoWrite)$/.test(name)) return true;
  if (/^mcp__kona-board__(list_tickets|list_notes|search_brain|read_note|save_note)$/.test(name)) return true;
  if (name === "Write" && input?.file_path && !inside(input.file_path, project) && inside(input.file_path, os.tmpdir())) return true;
  // the checker, run with node on one file, the paths plain or quoted (Bash and PowerShell both)
  if ((name === "Bash" || name === "PowerShell") && typeof input?.command === "string" && /^\s*node\s+["']?[^"'\r\n]*check-journey\.mjs["']?\s+["']?[^"'\r\n]+["']?\s*$/.test(input.command)) return true;
  return false;
}

async function turn(sessionId, text, limitMs = 420000) {
  const from = await c.ev(`window.__proof.length`);
  await invoke("send_message", { sessionId, text, images: [] });
  const started = Date.now();
  const seen = { tools: [], denied: [], allowed: [], text: "", cost: 0, results: 0, stderr: [] };
  let cursor = from;
  while (Date.now() - started < limitMs) {
    const batch = JSON.parse(await c.ev(`JSON.stringify(window.__proof.slice(${cursor}))`));
    cursor += batch.length;
    for (const ev of batch) {
      if (ev.sessionId !== sessionId) continue;
      const rec = ev.record;
      if (rec.type === "assistant") for (const b of rec.message?.content ?? []) if (b.type === "tool_use") seen.tools.push({ name: b.name, input: b.input });
      if (rec.type === "control_request" && rec.request?.subtype === "can_use_tool") {
        const { tool_name: name, input } = rec.request;
        if (allowed(name, input)) {
          seen.allowed.push({ name, input });
          await invoke("answer_permission", { sessionId, requestId: rec.request_id, allow: true, input, message: null, remember: null });
        } else {
          seen.denied.push({ name, input });
          await invoke("answer_permission", { sessionId, requestId: rec.request_id, allow: false, input: null, message: "This test does not allow that tool.", remember: null });
        }
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
const snapshot = () => { const out = {}; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.name === ".kona") continue; if (e.isDirectory()) walk(p); else out[path.relative(project, p)] = fs.readFileSync(p, "utf8"); } }; walk(project); return out; };

const before = await invoke("list_projects");
account = before.find((p) => p.account)?.account ?? null;
try {
  if (!account) { note("SKIP no project with an account to borrow"); process.exit(0); }
  for (const [f, text] of Object.entries(SITE)) put(f, text);
  fs.mkdirSync(scratch, { recursive: true });
  const siteBefore = snapshot();
  projectId = (await invoke("add_project", { folder: project, name: NAME, account })).project.id;
  note("the project's skills folder holds build-a-journey: " + fs.existsSync(path.join(project, ".kona", "skills", "build-a-journey", "SKILL.md")));
  ok("the skill and its checker came into the new project", fs.existsSync(path.join(project, ".kona", "skills", "build-a-journey", "templates", "check-journey.mjs")));
  await startListening();
  const digest = ""; // a built program has no source to import the digest from, and a new project has no notes to digest; the rules about notes come from the program itself
  const s1 = await invoke("start_session", { folder: project, roleId: "product", accountId: account, useVoice: false, ticketId: null, brainDigest: digest, model: process.env.JOURNEY_MODEL || "haiku", mode: "default", resume: null });
  sessionIds.push(s1);
  await wait(2000);
  const r1 = await turn(s1, `Use your build-a-journey skill to write the journey of this project. The kinds of user are visitor and staff. You cannot ask me anything: where you are unsure, assume the most likely thing and say so at the end. The scratch folder you may write to is ${scratch.replace(/\\/g, "/")}.`);
  note(`turn 1: tools ${toolNames(r1).join(", ") || "none"}`);
  note(`denied: ${r1.denied.map((d) => d.name + " " + JSON.stringify(d.input).slice(0, 100)).join(" | ") || "none"}`);
  note(`cost ${r1.cost.toFixed(4)}; its answer: ${r1.text.replace(/\s+/g, " ").slice(0, 700)}`);

  ok("it read the skill", r1.tools.some((t) => /Skill/.test(t.name) && /build-a-journey/.test(JSON.stringify(t.input))) || r1.tools.some((t) => t.name === "Read" && /build-a-journey/.test(JSON.stringify(t.input))), r1.tools.filter((t) => /build-a-journey/.test(JSON.stringify(t.input))).map((t) => t.name).join());
  ok("it read the starter note kona-journey for the format", r1.tools.some((t) => /read_note$/.test(t.name) && /kona-journey/.test(JSON.stringify(t.input))));
  ok("it read the project's own pages", ["index.html", "pets.html", "apply.html", "staff.html"].filter((f) => r1.tools.some((t) => JSON.stringify(t.input).includes(f.replace(".html", "")))).length >= 3);
  ok("it ran the skill's checker on its draft", r1.allowed.some((t) => (t.name === "Bash" || t.name === "PowerShell") && /check-journey\.mjs/.test(t.input.command)), r1.allowed.filter((t) => t.name === "Bash" || t.name === "PowerShell").map((t) => t.input.command).join(" ; "));
  ok("it saved the note with save_note, kind journey", r1.tools.some((t) => /save_note$/.test(t.name) && t.input.kind === "journey"), r1.tools.filter((t) => /save_note$/.test(t.name)).map((t) => JSON.stringify({ ...t.input, body: undefined })).join(" | "));
  ok("it changed nothing in the project (no file written, no file edited)", JSON.stringify(snapshot()) === JSON.stringify(siteBefore) && r1.denied.filter((d) => /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(d.name)).length === 0, r1.denied.map((d) => d.name).join());

  const notes = fs.existsSync(brainDir) ? fs.readdirSync(brainDir).filter((f) => f.endsWith(".md")) : [];
  const journeyFiles = notes.filter((f) => /\nkind: journey\n/.test("\n" + fs.readFileSync(path.join(brainDir, f), "utf8")));
  ok("exactly one note of kind journey is in the brain folder", journeyFiles.length === 1, notes.join());
  if (journeyFiles.length === 1) {
    const file = path.join(brainDir, journeyFiles[0]);
    const text = fs.readFileSync(file, "utf8");
    const read = parseJourney(text);
    const errors = read.problems.filter((p) => p.level === "error"), warns = read.problems.filter((p) => p.level === "warning");
    ok("the saved note reads, with no error", !!read.journey && errors.length === 0, errors.map((e) => e.text).join(" | "));
    note(`warnings left: ${warns.length}${warns.length ? " - " + warns.map((w) => w.text).join(" | ") : ""}`);
    const j = read.journey;
    if (j) {
      note(`steps: ${j.steps.map((s) => `${s.id}(${s.lane}${s.kind === "screen" ? ",screen" : ""},${s.status})`).join(" ")}`);
      ok("it has at least 6 steps and 3 screens", j.steps.length >= 6 && j.steps.filter((s) => s.kind === "screen").length >= 3, `${j.steps.length} steps`);
      ok("the kinds of user are visitor and staff", ["visitor", "staff"].every((k) => j.users.some((u) => u.id === k)), j.users.map((u) => u.id).join());
      const all = JSON.stringify(j).toLowerCase();
      ok("the error messages of the form are on the application screen, in the site's own words", /enter an email address/.test(all) && /digits/.test(all), "");
      ok("the staff sign-in error is there", /wrong name or password/.test(all), "");
      ok("every screen says where it leads", j.steps.filter((s) => s.kind === "screen").every((s) => s.next.length > 0 || s.buttons.some((b) => b.to) || s.end), "");
      ok("nothing is called built that the project does not hold: no step says built together with a ticket or mockup it made up", j.steps.every((s) => !s.mockup && s.tickets.length === 0), j.steps.filter((s) => s.mockup || s.tickets.length).map((s) => s.id + ":" + s.mockup + s.tickets.join()).join(","));
      const run = spawnSync(process.execPath, [path.join(project, ".kona", "skills", "build-a-journey", "templates", "check-journey.mjs"), file], { encoding: "utf8" });
      ok("the skill's own checker, run again on the saved note, exits 0 with no error", run.status === 0, (run.stdout || "").split("\n").slice(-3).join(" "));
    }
  }
  note(`spent in the session: about $${spent.toFixed(3)} (Claude Code's estimate at list price)`);
} finally {
  for (const s of sessionIds) { try { await invoke("stop_session", { sessionId: s }); } catch { /* it has ended */ } }
  await wait(1500);
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === projectId) await invoke("remove_project", { id: p.id }); } catch (e) { note("could not remove the project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
  const homes = [path.join(os.homedir(), ".claude", "projects")];
  if (account && process.env.APPDATA) homes.push(path.join(process.env.APPDATA, "Kona", "accounts", account, "projects"));
  for (const pr of homes) { try { for (const d of fs.readdirSync(pr)) if (d.includes("kona-journey-skill")) { fs.rmSync(path.join(pr, d), { recursive: true, force: true }); note("removed the transcripts folder " + d); } } catch { /* nothing to remove */ } }
  try { const final = await invoke("list_projects"); ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id))); } catch { /* the window is gone */ }
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
