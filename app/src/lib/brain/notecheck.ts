// The on-request check "does this note disagree with the notes it links to?" (ticket T-0034, decision 81): what is sent to the one cheap Haiku call, and how its answer is read.
// The notes are sent as quoted data after Kona has hidden anything that looks like a secret; nothing is saved from the answer. The words the call is told are in lib.rs
// (NOTE_CHECK_SYSTEM). It spends a little of the plan, so the screen says so before it runs.
import type { Brain } from "./engine.ts";
import type { Note } from "./parse.ts";
import { redact } from "./text.ts";

export const MAX_EACH = 14_000; // characters of one note that are sent
export const MAX_NOTES = 6; // the note itself and up to five it is linked with
export const MAX_TOTAL = 60_000;

/** The notes that are compared with this one: the notes it links to first, then the notes that link to it. Starter notes ship with Kona and are not checked. */
export function linkedWith(brain: Brain, note: Note): Note[] {
  const ids: string[] = [];
  for (const e of [...brain.outgoing(note.id), ...brain.incoming(note.id)]) {
    const id = e.s === note.id ? e.t : e.s;
    if (id !== note.id && !ids.includes(id)) ids.push(id);
  }
  return ids.map((id) => brain.notes.get(id)).filter((n): n is Note => !!n && n.layer !== "starter").slice(0, MAX_NOTES - 1);
}

const body = (n: Note) => {
  const t = n.raw.replace(/\r/g, "");
  const cut = t.startsWith("---\n") ? t.indexOf("\n---\n", 3) + 5 : 0;
  return redact(t.slice(cut > 4 ? cut : 0).trim()).text.slice(0, MAX_EACH);
};

/** The data for the call, and which notes it holds. Empty `others` means there is nothing to compare the note with. */
export function noteCheckPrompt(note: Note, others: Note[]): { prompt: string; sent: Note[] } {
  const parts = [`NOTE A (id: ${note.id}; written ${note.meta.updated ?? note.meta.date ?? "undated"})\n${body(note)}`];
  const sent: Note[] = [note];
  let total = parts[0].length;
  others.forEach((o, i) => {
    const part = `NOTE ${String.fromCharCode(66 + i)} (id: ${o.id}; written ${o.meta.updated ?? o.meta.date ?? "undated"})\n${body(o)}`;
    if (total + part.length > MAX_TOTAL) return;
    parts.push(part); sent.push(o); total += part.length;
  });
  return { prompt: `Compare note A with the other notes. Report only statements that cannot both be true.\n\n${parts.join("\n\n=====\n\n")}`, sent };
}

/** The answer, as the screen shows it: `none` when the call found no disagreement. */
export function readNoteCheck(answer: string): { none: boolean; text: string } {
  const text = answer.trim();
  return { none: /^no disagreement found\.?$/i.test(text), text };
}
