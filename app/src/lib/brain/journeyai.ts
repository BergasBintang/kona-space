// The on-request check "do the names fit?" of a journey (ticket T-0041, decision 91): what is sent to the one cheap Haiku call, and how its answer is read.
// The plain script checks of journey.ts find what a script can. This call is only for two questions of meaning: does the plain-words name of a screen step fit the page its mockup shows,
// and do two steps carry two names for one thing.
// The first version asked for free text ("report problems of meaning") and a small model reported something on every journey, clean ones included (measured 2026-11-13, twice). So the
// call now answers in a fixed shape, one verdict line for each step, and only those lines are read: it cannot complain about anything else, and an answer that is not in the shape is
// shown as unreadable instead of as a finding. The words the call is told are in lib.rs (JOURNEY_CHECK_SYSTEM). The journey and the mockup words are sent as data after anything that
// looks like a secret is hidden; nothing is saved from the answer. It spends a little of the plan, so the screen says so before it runs.
import type { Journey, Step } from "./journey.ts";
import { redact } from "./text.ts";

export const MAX_PAGE = 1500; // letters of one mockup page that are sent
export const MAX_PAGES = 30;
export const MAX_TOTAL = 60_000;

/** The steps whose mockup words are sent, in order, at most MAX_PAGES. Only a screen has a page worth comparing a name with. */
export function pagesToRead(j: Journey): Step[] {
  return j.steps.filter((s) => s.kind === "screen" && s.mockup).slice(0, MAX_PAGES);
}

/** A name or a page on one line, in quotes, with no quote inside. */
const quote = (s: string) => `"${redact(s).text.replace(/\s+/g, " ").replace(/"/g, "'").trim()}"`;

/**
 * The data for the call, and which steps have a page in it. `pages` holds the visible words of each step's mockup page, by step id (a step with none is left out of part 1).
 * Part 2 lists the names of every step, so two names for one thing can be seen even when neither step has a page.
 */
export function journeyCheckPrompt(j: Journey, pages: ReadonlyMap<string, string>): { prompt: string; withText: string[] } {
  const withText: string[] = [];
  const one: string[] = [];
  let total = 0;
  for (const s of pagesToRead(j)) {
    const text = (pages.get(s.id) ?? "").trim();
    if (!text) continue;
    const line = `- ${s.id} | name: ${quote(s.name)} | page says: ${quote(text.slice(0, MAX_PAGE))}`;
    if (total + line.length > MAX_TOTAL) break;
    one.push(line); withText.push(s.id); total += line.length;
  }
  const two = j.steps.map((s) => `- ${s.id}: ${quote(s.name)}`).join("\n").slice(0, MAX_TOTAL);
  const prompt = `PART 1. STEPS WITH A PAGE (data)\n${one.length ? one.join("\n") : "(none)"}\n\nPART 2. ALL STEP NAMES (data)\n${two || "(none)"}`;
  return { prompt, withText };
}

export type Verdicts = {
  /** the answer was in the shape asked for: a verdict for every step that was sent (when any was), and a SAME line */
  readable: boolean;
  /** ids whose name does not fit their page */
  different: string[];
  /** pairs of ids whose names may mean the same thing */
  same: [string, string][];
  /** readable, and nothing was found */
  none: boolean;
};

/**
 * Read the answer. Only lines of the shape `id: FITS`, `id: DIFFERENT` and `SAME: a = b; c = d` (or `SAME: none`) count; every other line is ignored, so words around the answer
 * can never become a finding. A verdict for an id that was not sent, and a pair with an id that does not exist, are dropped.
 */
export function readJourneyCheck(answer: string, sent: readonly string[], allIds: readonly string[]): Verdicts {
  const seen = new Map<string, "FITS" | "DIFFERENT">();
  const same: [string, string][] = [];
  let sameLine = false;
  const sentSet = new Set(sent), ids = new Set(allIds);
  for (const raw of answer.replace(/\r/g, "").split("\n")) {
    const line = raw.trim().replace(/^[-*•]\s*/, "").replace(/\*\*/g, "");
    const v = /^([a-z0-9][a-z0-9-]*)\s*:\s*(FITS|DIFFERENT)\b\.?$/i.exec(line);
    if (v) { if (sentSet.has(v[1])) seen.set(v[1], v[2].toUpperCase() as "FITS" | "DIFFERENT"); continue; }
    const s = /^SAME\s*:\s*(.*)$/i.exec(line);
    if (s) {
      sameLine = true;
      for (const pair of s[1].split(/[;,]/)) {
        const m = /^\s*([a-z0-9][a-z0-9-]*)\s*=\s*([a-z0-9][a-z0-9-]*)\s*\.?$/i.exec(pair);
        if (m && m[1] !== m[2] && ids.has(m[1]) && ids.has(m[2]) && !same.some(([a, b]) => (a === m[1] && b === m[2]) || (a === m[2] && b === m[1]))) same.push([m[1], m[2]]);
      }
    }
  }
  const different = sent.filter((id) => seen.get(id) === "DIFFERENT");
  const readable = sameLine && sent.every((id) => seen.has(id));
  return { readable, different, same, none: readable && different.length === 0 && same.length === 0 };
}
