// Measures the answers of the Ask page (decision 92) on the labelled questions of the search measure (src/lib/brain/eval/starter.json) and Kona's starter notes.
// For every question the search runs as in the program; when it finds nothing, nothing is sent (that is the point). When it finds sections, the SAME prompt the program builds
// (src/lib/brain/chat.ts) goes to Haiku with the SAME instruction (BRAIN_CHAT_SYSTEM in src-tauri/src/lib.rs), started the way Kona starts it: the native claude.exe, no shell.
// THIS SPENDS A LITTLE OF A CLAUDE PLAN (one small Haiku call for each question the search answers, a few cents in all), so it does nothing until it is told to:
//   node tests/brain-chat-eval.mjs --yes [--account-dir <CLAUDE_CONFIG_DIR>] [--limit 30] [--out answers.txt]
//   node tests/brain-chat-eval.mjs --dry      shows what would be sent for the first question, and calls nothing
// What is counted, for the questions where the search showed sections:
//   answerable question:   GOOD (answered and names a section that holds the answer), WRONG SOURCE (answered, names no right section), REFUSED (said NOT COVERED although the answer is there), UNREADABLE
//   unanswerable question: GOOD refusal (said NOT COVERED), CONFIDENT WRONG (answered anyway: the worst case)
// The rule: a confident wrong answer on a question nothing answers is not accepted. Write the numbers in the decision.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Brain } from "../src/lib/brain/engine.ts";
import { holds } from "../src/lib/brain/evalset.ts";
import { chatPrompt, readChatAnswer } from "../src/lib/brain/chat.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
if (!args.includes("--yes") && !args.includes("--dry")) {
  console.log("This sends one small request to Haiku for each question the search answers and uses a little of the plan. Run it again with --yes to go on.");
  process.exit(0);
}
const accountDir = arg("--account-dir");
const limit = Number(arg("--limit") ?? 1000);
const out = arg("--out");

const rs = fs.readFileSync(path.join(here, "../src-tauri/src/lib.rs"), "utf8");
const m = rs.match(/const BRAIN_CHAT_SYSTEM: &str = "((?:[^"\\]|\\[\s\S])*)";/);
if (!m) throw new Error("BRAIN_CHAT_SYSTEM not found in lib.rs");
const SYSTEM = m[1].replace(/\\\n\s*/g, "").replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

const dir = path.join(here, "../src/brain/starter");
const raw = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => ({ id: f.replace(/\.md$/, ""), layer: "starter", text: fs.readFileSync(path.join(dir, f), "utf8"), readonly: true }));
const brain = new Brain(raw);
const questions = JSON.parse(fs.readFileSync(path.join(here, "../src/lib/brain/eval/starter.json"), "utf8"));
const sections = [...brain.notes.values()].flatMap((n) => n.sections.map((s) => `${s.heading}\n${s.text}`));

function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  for (const d of (process.env.PATH ?? "").split(path.delimiter)) {
    if (fs.existsSync(path.join(d, "claude.exe"))) return path.join(d, "claude.exe");
    if (fs.existsSync(path.join(d, "claude.cmd"))) { const native = path.join(d, "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"); if (fs.existsSync(native)) return native; }
  }
  throw new Error("claude.exe was not found; set CLAUDE_BIN");
}

if (args.includes("--dry")) {
  const r = brain.search(questions[0].q);
  const { prompt } = chatPrompt(questions[0].q, [], r.hits);
  console.log(SYSTEM + "\n-----\n" + prompt);
  process.exit(0);
}
const CLAUDE = findClaude();

const tally = { calls: 0, noCall: 0, noCallAnswerable: 0, good: 0, wrongSource: 0, refused: 0, unreadable: 0, goodRefusal: 0, confidentWrong: 0 };
const log = [];
let done = 0;
for (const item of questions) {
  const needles = item.needles ?? [];
  const answerable = needles.length > 0 && sections.some((t) => holds(t, needles));
  const r = brain.search(item.q);
  if (r.state === "none") {
    tally.noCall++;
    if (answerable) tally.noCallAnswerable++;
    console.log(`NO CALL      [${r.state}] ${item.q}${answerable ? "   (the answer exists: the search missed it)" : ""}`);
    continue;
  }
  if (done >= limit) continue;
  done++;
  const { prompt, sent } = chatPrompt(item.q, [], r.hits);
  const env = { ...process.env };
  if (accountDir) env.CLAUDE_CONFIG_DIR = accountDir;
  const p = spawnSync(CLAUDE, ["-p", "--model", "haiku", "--output-format", "json", "--no-session-persistence", "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--system-prompt", SYSTEM],
    { input: prompt, encoding: "utf8", cwd: process.env.TEMP || ".", env, timeout: 150000 });
  tally.calls++;
  let answer = "";
  try { answer = JSON.parse(p.stdout).result ?? ""; } catch { answer = `(no answer: ${(p.stderr || p.stdout || "").slice(0, 120)})`; }
  const reply = readChatAnswer(answer, sent.length);
  let outcome;
  if (!reply.readable) { outcome = "UNREADABLE"; tally.unreadable++; }
  else if (answerable) {
    if (!reply.covered) { outcome = "REFUSED"; tally.refused++; }
    else if (reply.used.some((n) => holds(`${sent[n - 1].section.heading}\n${sent[n - 1].section.text}`, needles))) { outcome = "GOOD"; tally.good++; }
    else { outcome = "WRONG SOURCE"; tally.wrongSource++; }
  } else if (reply.covered) { outcome = "CONFIDENT WRONG"; tally.confidentWrong++; }
  else { outcome = "GOOD refusal"; tally.goodRefusal++; }
  const line = `${outcome.padEnd(15)}[${r.state}] ${item.q}\n      said: ${answer.replace(/\s+/g, " ").slice(0, 300)}`;
  console.log(line);
  log.push(`${outcome} | ${item.q}\n${answer}\n`);
}
console.log(`\ncalls ${tally.calls}, no call (search found nothing) ${tally.noCall}, of them with an answer in the brain ${tally.noCallAnswerable}`);
console.log(`answerable:   good ${tally.good}, wrong source ${tally.wrongSource}, refused ${tally.refused}`);
console.log(`unanswerable: good refusal ${tally.goodRefusal}, CONFIDENT WRONG ${tally.confidentWrong}`);
console.log(`unreadable answers ${tally.unreadable}`);
if (out) fs.writeFileSync(out, log.join("\n---\n"));
console.log(tally.confidentWrong > 0 ? "A confident wrong answer was given on a question nothing answers: by the rule it is not accepted as it is." : "No confident wrong answer on a question nothing answers.");
