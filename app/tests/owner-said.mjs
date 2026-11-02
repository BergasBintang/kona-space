// For docs/LESSONS.md ("How this file grows"): prints what the owner typed in the newest Claude session of this project, one message per line, to go through for lessons.
// Reads only. Prints to the screen and writes nothing. Usage, in app/: node tests/owner-said.mjs [path to a session's .jsonl file]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const folder = path.join(os.homedir(), ".claude", "projects", "d--kona-space");
const newest = () => fs.readdirSync(folder).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(folder, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const file = process.argv[2] ?? newest();
if (!file) { console.error(`No session found in ${folder}`); process.exit(1); }

const seen = new Set();
for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }
  if (entry.type !== "user" || entry.isMeta || !entry.message) continue;
  const c = entry.message.content;
  const raw = typeof c === "string" ? c : Array.isArray(c) ? c.filter((b) => b.type === "text").map((b) => b.text).join(" ") : "";
  if (/^\s*<(local-command|command-|task-notification|browser_instruction)/.test(raw) || raw.includes("[SYSTEM NOTIFICATION") || raw.includes("Errors and fixes")) continue; // what the program added, not the owner
  const text = raw.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").replace(/\[Image: source[^\]]*\]/g, "[picture]").replace(/\s+/g, " ").trim();
  if (!text || seen.has(text)) continue;
  seen.add(text);
  console.log(`${(entry.timestamp ?? "").slice(0, 10)}  ${text}`);
}
console.error(`\n${seen.size} messages from ${file}`);
