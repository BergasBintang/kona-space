// Measures the Brain's search with labelled questions (ticket T-0028). Reads only; it writes nothing and starts no session.
//   node tests/search-eval.mjs                                     Kona's own starter notes and the questions in src/lib/brain/eval/starter.json
//   node tests/search-eval.mjs --project <folder> --questions <file.json>
//                                                                  also the notes of that project's .kona/brain folder, with a question file of your own
//                                                                  (keep a file about a real project OUT of Kona's repo)
//   node tests/search-eval.mjs --project <folder> --docs <folder>  also every .md file of another folder as a project note: what the search would face
//                                                                  after documents are moved into the brain
//   --no-starter   leave Kona's starter notes out     --json   print the numbers as JSON     --quiet   only the numbers
// For every question it prints the answer the search gave and counts four kinds of result: true positive, false negative, false positive (worst
// when the search says "Found"), true negative. See src/lib/brain/evalset.ts for what each one means.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Brain } from "../src/lib/brain/engine.ts";
import { evaluate, report } from "../src/lib/brain/evalset.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const readMd = (dir, layer, readonly) => {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => ({ id: f.replace(/\.md$/, ""), layer, text: fs.readFileSync(path.join(dir, f), "utf8"), readonly, path: path.join(dir, f) }));
};

const raw = [];
if (!flag("--no-starter")) raw.push(...readMd(path.join(here, "../src/brain/starter"), "starter", true));
const project = value("--project");
if (project) raw.push(...readMd(path.join(project, ".kona", "brain"), "project", false));
const docs = value("--docs");
if (docs) {
  const have = new Set(raw.map((r) => r.id));
  for (const d of readMd(docs, "project", false)) if (!have.has(d.id)) raw.push(d); // a note of the same name wins over a document
}
const questionsFile = value("--questions") ?? path.join(here, "../src/lib/brain/eval/starter.json");
const questions = JSON.parse(fs.readFileSync(questionsFile, "utf8"));

const brain = new Brain(raw);
const { rows, summary } = evaluate(brain, questions);
if (flag("--json")) {
  console.log(JSON.stringify({ notes: brain.notes.size, summary, rows }, null, 2));
} else {
  console.log(`${brain.notes.size} notes (${raw.filter((r) => r.layer === "starter").length} starter, ${raw.filter((r) => r.layer === "project").length} project), questions from ${path.basename(questionsFile)}`);
  if (!flag("--quiet")) {
    for (const r of rows) console.log(`${r.outcome}  ${r.state.padEnd(6)}  [${r.kind}]  ${r.q}${r.top ? "   <- " + r.top : ""}`);
    console.log("");
  }
  console.log(report(rows, summary));
}
