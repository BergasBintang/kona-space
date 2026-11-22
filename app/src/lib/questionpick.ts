// The answers a person is giving to Claude's multiple-choice questions (the question card). Kept as plain functions so the rules can be tested:
// - a question that takes ONE answer: the options and the "Other" box exclude each other. Clicking an option empties the box; typing in the box un-clicks the option.
// - a question that takes SEVERAL answers: the clicked options stay while the owner types, and the text is added to them.
export type PickQuestion = { question: string; multiSelect?: boolean };
export type Picks = { picked: Record<string, string[]>; other: Record<string, string> };

export const noPicks: Picks = { picked: {}, other: {} };

/** The owner clicked an option. */
export function pick(a: Picks, q: PickQuestion, label: string): Picks {
  const cur = a.picked[q.question] ?? [];
  if (q.multiSelect) return { ...a, picked: { ...a.picked, [q.question]: cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label] } };
  const unpick = cur.includes(label);
  return { picked: { ...a.picked, [q.question]: unpick ? [] : [label] }, other: unpick ? a.other : { ...a.other, [q.question]: "" } };
}

/** The owner typed in the "Other" box. */
export function write(a: Picks, q: PickQuestion, text: string): Picks {
  const other = { ...a.other, [q.question]: text };
  if (q.multiSelect || text.trim() === "") return { ...a, other };
  return { picked: { ...a.picked, [q.question]: [] }, other };
}

/** The answer as Claude gets it: the clicked options and the typed text, joined by commas. Empty when nothing was answered. */
export function valueOf(a: Picks, q: PickQuestion): string {
  const t = a.other[q.question]?.trim();
  return [...(a.picked[q.question] ?? []), ...(t ? [t] : [])].join(", ");
}
