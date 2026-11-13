// The Ask page of the Brain (decision 92): what is sent to the one cheap Haiku call for a question, and how its answer is read.
// The search (engine.ts) runs first and costs nothing. When it finds no section, nothing is sent at all and the page says "Not in the brain". When it finds some, the call is given those
// sections, the last few messages and the question as data, with everything that looks like a secret hidden, and it may only answer from them. Its answer has a fixed shape (the words,
// then a last line `USED: 1, 3`), so the page can show which notes an answer rests on, and a call that says NOT COVERED is shown as "the notes do not answer this", never as an answer.
// The words the call is told are in lib.rs (BRAIN_CHAT_SYSTEM). Nothing is saved from the answer unless the owner presses Save.
import type { Hit } from "./engine.ts";
import { redact } from "./text.ts";

export const MAX_SECTIONS = 4; // sections sent
export const MAX_SECTION = 1800; // letters of one section that are sent
export const MAX_TURNS = 4; // earlier questions and answers that are sent
export const MAX_PAST = 500; // letters of one earlier message that are sent

export type Past = { question: string; answer: string };
export type Reply = { readable: boolean; covered: boolean; text: string; /** the numbers (1 to the count sent) of the sections the answer says it rests on */ used: number[] };

/** At most `max` letters, cut at a space, with a mark when cut. */
function clip(s: string, max: number): string {
  const t = s.replace(/\r/g, "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).trimEnd() + " …";
}

/** The data for the call, and the hits that are in it (their position is the number the answer uses). Earlier answers that were not covered are left out, they say nothing. */
export function chatPrompt(question: string, past: Past[], hits: Hit[]): { prompt: string; sent: Hit[] } {
  const sent = hits.slice(0, MAX_SECTIONS);
  const out: string[] = [];
  sent.forEach((h, i) => out.push(`SECTION ${i + 1}: ${redact(h.note.title).text} > ${redact(h.section.heading).text}\n${redact(clip(h.section.text, MAX_SECTION)).text}`));
  const before = past.filter((p) => p.answer.trim()).slice(-MAX_TURNS);
  if (before.length) out.push("EARLIER MESSAGES\n" + before.map((p) => `Question: ${redact(clip(p.question, MAX_PAST)).text}\nAnswer: ${redact(clip(p.answer, MAX_PAST)).text}`).join("\n\n"));
  out.push(`QUESTION\n${redact(clip(question, 600)).text}`);
  return { prompt: out.join("\n\n"), sent };
}

/** Reads the answer. A reply without the last USED line is still shown (the words are the answer) but says it names no notes, so the screen does not pretend it knows which ones. */
export function readChatAnswer(answer: string, sentCount: number): Reply {
  const lines = answer.replace(/\r/g, "").trimEnd().split("\n");
  let at = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (/^\s*\**USED\**\s*:/i.test(lines[i])) { at = i; break; }
  const body = (at >= 0 ? lines.slice(0, at) : lines).join("\n").trim();
  if (!body) return { readable: false, covered: false, text: "", used: [] };
  const used: number[] = [];
  if (at >= 0) for (const m of lines[at].replace(/^[^:]*:/, "").matchAll(/\d+/g)) { const n = Number(m[0]); if (n >= 1 && n <= sentCount && !used.includes(n)) used.push(n); }
  // the first words decide: NOT COVERED alone, or with a short note after it, means the notes do not answer
  if (/^\**\s*NOT COVERED\b/i.test(body)) return { readable: true, covered: false, text: "", used: [] };
  return { readable: true, covered: true, text: body, used };
}
