// Measures the journey name check (ticket T-0041) on a labelled set: made-up journeys with a planted problem and clean ones. It prints, for each case, what Haiku answered and how it
// was read, and counts what was found, what was missed and what was wrongly reported. THIS SPENDS A LITTLE OF A CLAUDE PLAN (one one-shot Haiku call for each case, a few cents in all),
// so it does nothing until it is told to:
//   node tests/journey-check-eval.mjs --yes [--account-dir <CLAUDE_CONFIG_DIR of the account to use>] [--runs 2]
//   node tests/journey-check-eval.mjs --dry      shows what would be sent for one case, and calls nothing
// The instruction the call is given is read from src-tauri/src/lib.rs (JOURNEY_CHECK_SYSTEM) and the data and the reading of the answer are src/lib/brain/journeyai.ts, so this measures
// what the program does. The rule of the ticket: if clean journeys get reports, the check is not shipped. Write the numbers into ticket T-0041.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseJourney } from "../src/lib/brain/journey.ts";
import { journeyCheckPrompt, readJourneyCheck } from "../src/lib/brain/journeyai.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
if (!args.includes("--yes") && !args.includes("--dry")) {
  console.log("This sends one small request to Haiku for each of the labelled cases and uses a little of the plan. Run it again with --yes to go on.");
  process.exit(0);
}
const accountDir = arg("--account-dir");
const runs = Number(arg("--runs") ?? 1);

const rs = fs.readFileSync(path.join(here, "../src-tauri/src/lib.rs"), "utf8");
const m = rs.match(/const JOURNEY_CHECK_SYSTEM: &str = "((?:[^"\\]|\\[\s\S])*)";/);
if (!m) throw new Error("JOURNEY_CHECK_SYSTEM not found in lib.rs");
const SYSTEM = m[1].replace(/\\\n\s*/g, "").replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

const journey = (steps) => parseJourney("```journey\n" + JSON.stringify({ title: "Photo albums", steps: steps.map((s) => ({ lane: "app", actor: "system", ...s })) }) + "\n```").journey;
const screen = (id, name, extra = {}) => ({ id, name, kind: "screen", mockup: `site/${id}.html`, ...extra });
const step = (id, name, extra = {}) => ({ id, name, kind: "step", ...extra });
// every case: the steps, the words of each mockup page, and what is planted: `different` (ids whose name does not fit) and `same` (pairs of ids that are one thing). Nothing planted is a clean journey.
const cases = [
  // planted
  { name: "name does not fit: Upload CV on a photo page", plant: { different: ["upload"], same: [] }, steps: [screen("upload", "Upload CV")], pages: { upload: "Upload photos Choose photos from your computer Upload" } },
  { name: "name does not fit: Pay for the order on a message form", plant: { different: ["pay"], same: [] }, steps: [screen("pay", "Pay for the order"), screen("home", "Your albums")], pages: { pay: "Contact us Your message Your email Send", home: "Your albums New album" } },
  { name: "same thing: Sign in and Log in", plant: { different: [], same: [["sign-in", "log-in"]] }, steps: [step("sign-in", "Sign in"), step("log-in", "Log in"), screen("home", "Your albums")], pages: { home: "Your albums" } },
  { name: "same thing: Choose a plan and Pick your plan", plant: { different: [], same: [["choose-plan", "pick-plan"]] }, steps: [step("choose-plan", "Choose a plan"), step("pick-plan", "Pick your plan"), step("pay", "Pay")], pages: {} },
  // clean
  { name: "clean: sign in and albums", plant: null, steps: [screen("sign-in", "Sign in", { buttons: [{ label: "Sign in", to: "home" }] }), screen("home", "Your albums")], pages: { "sign-in": "Sign in Email Password Sign in Forgot your password?", home: "Your albums New album Sign out" } },
  { name: "clean: upload photos", plant: null, steps: [screen("upload", "Upload photos"), screen("album", "Album")], pages: { upload: "Upload photos Choose photos Upload", album: "Album Add more Share" } },
  { name: "clean: share the album", plant: null, steps: [screen("share", "Share the album")], pages: { share: "Share the album Anyone with the link can look Copy link" } },
  { name: "clean: a server step with no page", plant: null, steps: [step("check-login", "Check the login"), screen("home", "Your albums")], pages: { home: "Your albums New album" } },
  { name: "clean: an AI step", plant: null, steps: [step("suggest", "Suggest a title", { actor: "ai", ai: { does: "Suggests a title from the photos", model: "a small language model" } })], pages: {} },
  { name: "clean: a contact form", plant: null, steps: [screen("contact", "Contact us", { buttons: [{ label: "Send", to: "contact" }] })], pages: { contact: "Contact us Your message Submit" } },
  { name: "clean: related names that are not the same (Sign in, Sign out)", plant: null, steps: [step("sign-in", "Sign in"), step("sign-out", "Sign out"), step("home", "Your albums")], pages: {} },
  { name: "clean: related names (Create an album, Share an album)", plant: null, steps: [step("create", "Create an album"), step("share", "Share an album")], pages: {} },
  { name: "clean: a name worded differently from its page (Check out, Your basket, Pay now)", plant: null, steps: [screen("checkout", "Check out")], pages: { checkout: "Your basket 2 items Pay now" } },
  { name: "clean: Account settings on a settings page", plant: null, steps: [screen("settings", "Account settings")], pages: { settings: "Settings Change your email Change your password Delete my account" } },
  { name: "clean: a short name on a long page", plant: null, steps: [screen("home", "Home")], pages: { home: "Welcome back Your albums Recent photos Friends who shared with you New album Help Sign out" } },
  { name: "clean: an error that the page does not show (not asked about)", plant: null, steps: [screen("sign-in", "Sign in", { errors: [{ text: "Wrong password" }] })], pages: { "sign-in": "Sign in Email Password Sign in We do not know this email" } },
];

// the program is started the way Kona starts it: the native claude.exe, with no shell in between. A shell (cmd) mangles a system prompt that has line breaks and quotes in it, and then the
// instruction never reaches the model: the first measure of this check (2026-11-13) was made that way and was worth nothing.
function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (fs.existsSync(path.join(dir, "claude.exe"))) return path.join(dir, "claude.exe");
    if (fs.existsSync(path.join(dir, "claude.cmd"))) { const native = path.join(dir, "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"); if (fs.existsSync(native)) return native; }
  }
  throw new Error("claude.exe was not found; set CLAUDE_BIN");
}
const CLAUDE = args.includes("--dry") ? null : findClaude();

const ask = (c) => {
  const j = journey(c.steps);
  const { prompt, withText } = journeyCheckPrompt(j, new Map(Object.entries(c.pages)));
  return { prompt, withText, ids: j.steps.map((s) => s.id) };
};

if (args.includes("--dry")) {
  const { prompt } = ask(cases[0]);
  console.log(SYSTEM + "\n-----\n" + prompt);
  process.exit(0);
}

const total = { found: 0, missed: 0, wrong: 0, clean: 0, complained: 0, unreadable: 0 };
for (let run = 1; run <= runs; run++) {
  for (const c of cases) {
    const { prompt, withText, ids } = ask(c);
    const env = { ...process.env };
    if (accountDir) env.CLAUDE_CONFIG_DIR = accountDir;
    const r = spawnSync(CLAUDE, ["-p", "--model", "haiku", "--output-format", "json", "--no-session-persistence", "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--system-prompt", SYSTEM],
      { input: prompt, encoding: "utf8", cwd: process.env.TEMP || ".", env, timeout: 150000 });
    let answer = "";
    try { answer = JSON.parse(r.stdout).result ?? ""; } catch { answer = `(no answer: ${(r.stderr || r.stdout || "").slice(0, 120)})`; }
    const v = readJourneyCheck(answer, withText, ids);
    const flaggedPairs = v.same.map(([a, b]) => [a, b].sort().join("="));
    const planted = c.plant ? [...c.plant.different.map((d) => "d:" + d), ...c.plant.same.map((p) => "s:" + [...p].sort().join("="))] : [];
    const flagged = [...v.different.map((d) => "d:" + d), ...flaggedPairs.map((p) => "s:" + p)];
    const found = planted.filter((p) => flagged.includes(p)), missed = planted.filter((p) => !flagged.includes(p)), wrong = flagged.filter((p) => !planted.includes(p));
    let outcome;
    if (!v.readable) { outcome = "UNREADABLE"; total.unreadable++; }
    else if (c.plant) outcome = missed.length ? "MISSED" : wrong.length ? "FOUND+EXTRA" : "FOUND";
    else outcome = wrong.length ? "COMPLAINED" : "CLEAN";
    total.found += found.length; total.missed += missed.length; total.wrong += wrong.length;
    if (!c.plant) { total.clean++; if (wrong.length) total.complained++; }
    console.log(`${outcome.padEnd(11)} ${c.name}${runs > 1 ? ` (run ${run})` : ""}\n      said: ${answer.replace(/\s+/g, " ").slice(0, 200)}${wrong.length ? `\n      wrongly reported: ${wrong.join(", ")}` : ""}${missed.length ? `\n      missed: ${missed.join(", ")}` : ""}`);
  }
}
console.log(`\nplanted problems found ${total.found}, missed ${total.missed}; reported that were not planted ${total.wrong}; clean journeys ${total.clean}, of them complained about ${total.complained}; answers that could not be read ${total.unreadable}`);
console.log(total.complained > 0 || total.wrong > 0 ? "Clean journeys (or wrong items) were reported: by the rule of ticket T-0041 the check is not shipped as it is." : "No clean journey was reported and nothing wrong was reported.");
