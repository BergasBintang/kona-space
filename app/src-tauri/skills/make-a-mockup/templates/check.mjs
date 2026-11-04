// Checks the values of one mockup card. Run it with Node:  node check.mjs <the card folder>
// It reads mockup.json and every .css file of the card, and reports four kinds of mistake. Nothing is changed.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] || ".";
const problems = [];
const notes = [];

let info;
try { info = JSON.parse(readFileSync(join(dir, "mockup.json"), "utf8")); } catch (e) { console.log("Cannot read mockup.json: " + e.message); process.exit(1); }
const values = Array.isArray(info.values) ? info.values : [];

const files = readdirSync(dir, { recursive: true }).map(String).filter((f) => /\.(css|html|js)$/i.test(f));
const css = files.filter((f) => f.toLowerCase().endsWith(".css")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
if (!css) problems.push("The card has no style sheet. CSS is required.");

// the declarations of the style sheet:  --name: value;   (comments are taken out first)
const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
const declared = new Map();
for (const m of plain.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) if (!declared.has(m[1])) declared.set(m[1], m[2].trim());

// 1. a variable that is used must be declared
for (const m of plain.matchAll(/var\(\s*(--[\w-]+)/g)) {
  if (!declared.has(m[1])) problems.push(`${m[1]} is used but never declared.`);
}

const byCode = new Map(values.map((v) => [v.code, v]));
for (const v of values) {
  // 2. every entry of the table is in the style sheet
  if (!declared.has(v.variable)) { problems.push(`${v.code}: ${v.variable} is in mockup.json but not in the style sheet.`); continue; }
  // 3. a formula names only codes of the table, and the style sheet writes it with calc() or var() of those codes
  if (v.formula) {
    const used = v.formula.match(/[A-Za-z]+\d+/g) || [];
    for (const c of used) {
      const other = byCode.get(c);
      if (!other) problems.push(`${v.code}: the formula "${v.formula}" uses ${c}, which is not in the table.`);
      else if (!declared.get(v.variable).includes(`var(${other.variable})`)) problems.push(`${v.code}: the style sheet does not use var(${other.variable}) for ${c}, as the formula says.`);
    }
    if (/[+\-*/]/.test(v.formula) && !declared.get(v.variable).includes("calc(")) problems.push(`${v.code}: the formula has a sum, so the style sheet needs calc().`);
  }
  // 4. an unknown value is [TBD] and is listed; a TBD in the table is also left in the style sheet
  if (/\[TBD\]/i.test(v.value)) notes.push(`${v.code} (${v.variable}) is [TBD]. Tell the owner.`);
}
for (const [name, value] of declared) {
  if (/\[TBD\]/i.test(value) && !values.some((v) => v.variable === name)) problems.push(`${name} is [TBD] in the style sheet but is not listed in mockup.json.`);
}

// a hint, not an error: a bare size in a rule instead of a variable
const rules = plain.replace(/:root[^{]*\{[^}]*\}/g, "").replace(/@media[^{]*\{\s*:root[^{]*\{[^}]*\}\s*\}/g, "");
const bare = (rules.match(/(?:padding|margin|gap|border-radius|font-size|width|height)\s*:[^;}]*\b\d+(?:\.\d+)?px/g) || []);
if (bare.length) notes.push(`${bare.length} rule(s) use a bare size in px, for example "${bare[0].trim()}". Give each a code and a variable.`);

for (const n of notes) console.log("Note: " + n);
if (problems.length) { for (const p of problems) console.log("Problem: " + p); process.exit(1); }
console.log(`Fine. ${values.length} values checked, ${declared.size} variables declared.`);
