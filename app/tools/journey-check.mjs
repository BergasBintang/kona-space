// Makes the checker that ships inside the build-a-journey skill (ticket T-0040). The checker is the journey reader of the screen
// (src/lib/brain/journey.ts) with its types taken off, plus a few lines to run it from a terminal, so a worker and the Journey page can never disagree about what
// is wrong: a test (src/lib/brain/journeycheck.test.ts) fails when the file in the skill is not what this makes.
//   node tools/journey-check.mjs            write the file
//   node tools/journey-check.mjs --check    only say whether the file is up to date (exit 1 when it is not)
import { readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export const SOURCE = here("../src/lib/brain/journey.ts");
export const TARGET = here("../src-tauri/skills/build-a-journey/templates/check-journey.mjs");

const HEADER = `// Checks a journey note: node check-journey.mjs <the file that holds the note's text>
// It prints each mistake in plain words with the step it is about, and ends with a count. Exit code: 1 when there is an error, 0 otherwise.
// This file is made from Kona's own journey reader (app/src/lib/brain/journey.ts), so it finds exactly what the Journey page finds. Do not edit it.
`;

const RUN = `
// ---- run from a terminal ----
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node check-journey.mjs <the file that holds the note's text>"); process.exit(2); }
  const { journey, problems } = parseJourney(readFileSync(file, "utf8"));
  for (const p of problems) console.log((p.level === "error" ? "ERROR   " : "warning ") + p.text);
  const errors = problems.filter((p) => p.level === "error").length;
  console.log(journey ? \`\${journey.steps.length} steps, \${errors} errors, \${problems.length - errors} warnings.\` : "The journey could not be read.");
  process.exit(errors > 0 ? 1 : 0);
}
`;

export function build() {
  const ts = readFileSync(SOURCE, "utf8").replace(/\r/g, "");
  const js = stripTypeScriptTypes(ts, { mode: "strip" });
  return HEADER + js.trimEnd() + "\n" + RUN;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = build();
  let old = "";
  try { old = readFileSync(TARGET, "utf8").replace(/\r/g, ""); } catch { /* not there yet */ }
  if (process.argv.includes("--check")) {
    console.log(old === text ? "check-journey.mjs is up to date." : "check-journey.mjs is out of date: run node tools/journey-check.mjs");
    process.exit(old === text ? 0 : 1);
  }
  writeFileSync(TARGET, text);
  console.log("wrote " + TARGET);
}
