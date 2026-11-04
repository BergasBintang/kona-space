// A test of the Meeting in the REAL window (decision 78): the long table of the office opens it, the chat of a finished run reads like a group chat, a run that was going when Kona was
// closed shows as stopped, the plans tab (the workflow editor) and the confirmation of Run. It starts NO session and makes NO model call: it writes two finished-looking run files into
// the throwaway project, and it stops at the confirmation of Run. (A real run is tried by hand, or with MOCK_TEST_RUN=1, which spends plan; see tests/meeting-run.mjs.) Run it against a
// BUILT program started with the test port and with the owner's own Kona closed (see tests/mockups.mjs). It adds ONE throwaway project and removes it and its folder again.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const lines = [];
const note = (s) => { console.log(s); lines.push(s); };
const ok = (name, v, detail = "") => { note((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const root = path.join(process.env.MOCK_TEST_ROOT || os.tmpdir(), `kona-meeting-live-${process.pid}`);
const NAME = "kona-meeting-live";
const shotDir = process.env.MOCK_TEST_SHOTS || null;
const shot = async (name) => { if (shotDir) { await c.shot(path.join(shotDir, name)); note("a picture was saved: " + path.join(shotDir, name)); } };
const clickText = (selector, text) => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.textContent.trim() === ${JSON.stringify(text)} && !x.disabled); if (!b) return false; b.click(); return true; })()`);
const sheetText = () => c.ev(`document.querySelector('section[data-sheet]')?.innerText ?? ''`);

const step = (id, title, role, who, status, extra = {}) => ({ stepId: id, title, role, note: "", after: [], who, status, cost: 0.01, ...extra });
const doneRun = {
  id: "run-20261104-100000-aaaa", workflowId: "new-feature", name: "New feature", status: "done", startedAt: Date.UTC(2026, 10, 4, 3, 0, 0), endedAt: Date.UTC(2026, 10, 4, 3, 5, 0),
  steps: [
    step("brief", "Write the brief", "product", "Kiki", "done", { result: "The brief: a login page.", log: [{ k: "tools", tools: [{ name: "Read", status: "done", summary: "README.md" }, { name: "Write", status: "done", summary: "brief.md" }] }, { k: "say", text: "I wrote **the brief**: a login page with three states." }] }),
    step("design", "Design the screens", "design", "Nokka", "done", { after: ["brief"], result: "Three screens drawn.", log: [{ k: "say", text: "Three screens drawn in the mockups." }, { k: "you", text: "Make the button blue" }, { k: "say", text: "Blue it is." }] }),
    step("build", "Build the screens", "frontend", "Jiro", "done", { after: ["design"], result: "Built.", log: [{ k: "say", text: "Built the login page." }] }),
  ],
};
const staleRun = {
  id: "run-20261103-090000-bbbb", workflowId: "bug-fix", name: "Bug fix", status: "running", startedAt: Date.UTC(2026, 10, 3, 2, 0, 0),
  steps: [
    step("a", "Reproduce it", "qa", "Norbit", "done", { result: "Reproduced.", log: [{ k: "say", text: "Reproduced the bug." }] }),
    step("b", "Fix it", "backend", "Jiro", "working", { after: ["a"], sessionId: "no-such-session", startedAt: Date.UTC(2026, 10, 3, 2, 1, 0) }),
    step("c", "Check it", "qa", "Norbit", "waiting", { after: ["b"] }),
  ],
};

let id = null;
const before = await invoke("list_projects");
const account = before.find((p) => p.account)?.account ?? null;
try {
  if (!account) { note("SKIP no project with an account to borrow"); process.exit(0); }
  const runs = path.join(root, "project", ".kona", "runs");
  fs.mkdirSync(runs, { recursive: true });
  fs.writeFileSync(path.join(runs, staleRun.id + ".json"), JSON.stringify(staleRun));
  await wait(1100);
  fs.writeFileSync(path.join(runs, doneRun.id + ".json"), JSON.stringify(doneRun));
  id = (await invoke("add_project", { folder: path.join(root, "project"), name: NAME, github: null, account })).project.id;
  await c.send("Page.reload"); await wait(1500);
  ok("the welcome page is back", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
  ok("the throwaway project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if ([...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1 && !b.disabled) { b.click(); return true; } break; } } } return false; })()`));
  ok("it is the throwaway project that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200));

  // the office: the long table opens the meeting, the flow board is gone
  const names = await c.ev(`[...document.querySelectorAll('[aria-label^="Open "]')].map((e) => e.getAttribute('aria-label'))`);
  ok("the long meeting table is a piece of the office that opens something", names.includes("Open Meeting"), names.filter((n) => /table|flow|workflow|meeting/i.test(n)).join());
  ok("the flow board is gone from the standard office", !names.some((n) => /flow board/i.test(n)));
  await shot("meeting-office.png");
  await c.ev(`document.querySelector('[aria-label="Open Meeting"]').click(); true`);
  ok("the table opens the Meeting sheet", await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Meeting'`, 5000, 100));
  await wait(1200);

  // the chat of the newest run (the finished one)
  let t = await sheetText();
  ok("two tabs: Chat and Workflows", await c.ev(`[...document.querySelectorAll('[role=tab]')].map((b) => b.textContent.trim()).join() === 'Chat,Workflows'`));
  ok("the newest meeting is shown: its name, its status and its cost", /New feature/.test(t) && /Done/.test(t) && /3 of 3 done/.test(t), t.replace(/\s+/g, " ").slice(0, 160));
  ok("each person has a divider with their name", ["1. Write the brief (Kiki)", "2. Design the screens (Nokka)", "3. Build the screens (Jiro)"].every((d) => t.includes(d)));
  ok("what each person said is in the chat, in order", t.indexOf("I wrote the brief") > 0 && t.indexOf("I wrote the brief") < t.indexOf("Three screens drawn") && t.indexOf("Three screens drawn") < t.indexOf("Built the login page"));
  ok("what the owner wrote is in the chat as their own bubble", /You\s*\n?\s*Make the button blue/.test(t) && t.indexOf("Make the button blue") < t.indexOf("Blue it is"));
  ok("a handover is said between two people", /Kiki handed over to Nokka/.test(t) && /Nokka handed over to Jiro/.test(t));
  ok("the tool uses are one folded line, not a list", /2 tool uses/.test(t) && !/README\.md/.test(t));
  await clickText("section[data-sheet] button[aria-expanded]", "2 tool uses");
  await wait(300);
  ok("the folded line opens to show what was done", /README\.md/.test(await sheetText()));
  ok("the meeting is over, so there is no box to write in", !(await c.ev(`!!document.querySelector('textarea[aria-label="Say something to the meeting"]')`)));
  ok("bold in a message is drawn as bold", await c.ev(`!!document.querySelector('section[data-sheet] [role=log] strong')`));
  await shot("meeting-chat.png");

  // the other meeting: it was going when Kona was closed, so it is stopped
  await c.ev(`document.querySelector('button[aria-label="Which meeting"], [aria-label="Which meeting"]')?.click(); true`);
  await wait(500);
  const options = await c.ev(`[...document.querySelectorAll('[role=listbox] [role=option]')].map((o) => o.innerText.replace(/\\s+/g, ' ').trim())`);
  note("the meetings: " + options.join(" | "));
  ok("both meetings are in the list", options.length === 2 && options.some((o) => /Bug fix/.test(o)) && options.some((o) => /New feature/.test(o)));
  await c.ev(`[...document.querySelectorAll('[role=listbox] [role=option]')].find((o) => /Bug fix/.test(o.innerText)).click(); true`);
  await wait(700);
  t = await sheetText();
  ok("the other meeting reads as stopped, with the reason", /Stopped/.test(t) && /Kona was closed while this step was being done/.test(t), t.replace(/\s+/g, " ").slice(0, 200));
  ok("Try again is offered, and was not pressed", await c.ev(`[...document.querySelectorAll('section[data-sheet] button')].some((b) => b.textContent.trim() === 'Try again')`));
  ok("the stopped step is saved as stopped in its file", JSON.parse(fs.readFileSync(path.join(root, "project", ".kona", "runs", staleRun.id + ".json"), "utf8")).steps[1].status === "stopped");
  await shot("meeting-stopped.png");

  // the plans: the editor, and Run asks first
  await clickText("[role=tab]", "Workflows");
  ok("the Workflows tab shows the plans", await c.waitFor(`!!document.querySelector('nav[aria-label="Workflows"]')`, 4000, 100));
  await wait(500);
  const starters = await c.ev(`[...document.querySelectorAll('nav[aria-label="Workflows"] button')].map((b) => b.textContent.trim())`);
  ok("the starters are offered", ["New feature", "Bug fix", "Launch"].every((s) => starters.some((x) => x.startsWith(s))), starters.join());
  await clickText("nav[aria-label=Workflows] button", starters.find((x) => x.startsWith("New feature")));
  await wait(500);
  ok("there is no Start for tickets any more, only Run", !(await c.ev(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Start')`)) && (await c.ev(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Run')`)));
  ok("the old Running now (tickets) section is gone", !(await c.ev(`!!document.querySelector('section[aria-label="Running now"]')`)));
  ok("the chart draws the steps", (await c.ev(`document.querySelectorAll('svg[role=img] g[role=button]').length`)) >= 4);
  await clickText("section[data-sheet] button", "Run");
  await wait(400);
  t = await sheetText();
  ok("Run asks first, and says who works in which order", /Yes, run \d+ steps/.test(t) && /then/.test(t) && /uses your plan/.test(t), t.replace(/\s+/g, " ").slice(-260));
  await shot("meeting-plans-run-confirm.png");
  ok("nothing was started or raised", (await invoke("list_tickets", { projectId: id })).length === 0);
  await clickText("section[data-sheet] button", "Not now");
  await wait(300);
  ok("Not now takes the question away", !/Yes, run/.test(await sheetText()));

  // delete a meeting
  await clickText("[role=tab]", "Chat");
  await wait(500);
  ok("Delete asks first", await clickText("section[data-sheet] button", "Delete") && await c.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Yes, delete it')`, 3000, 100));
  await clickText("section[data-sheet] button", "Yes, delete it");
  await wait(900);
  const left = fs.readdirSync(path.join(root, "project", ".kona", "runs"));
  ok("the file of that meeting is gone and the other one is kept", left.length === 1, left.join());
  await c.ev(`document.querySelector('section button[aria-label^="Close"]')?.click(); true`);
} finally {
  try { for (const p of await invoke("list_projects")) if (p.name === NAME || p.id === id) await invoke("remove_project", { id: p.id }); } catch (e) { note("could not remove the project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
  try { const final = await invoke("list_projects"); ok("the project list is as it was before the test", JSON.stringify(final.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id))); } catch {}
  ok("the throwaway folder is gone", !fs.existsSync(root));
  c.close();
}
note(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
