// A quote that starts with a kind word is a callout: a note, a tip, a warning. Both ways of writing it are read:
//   > [!WARNING]            (GitHub's)         > **Warning:** do not ...      (the plain one)
//   > do not ...
export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";
export type Callout = { kind: CalloutKind; paragraphs: string[] };

const KINDS = "note|tip|important|warning|caution";
const GITHUB = new RegExp(`^\\[!(${KINDS})\\]\\s*(.*)$`, "i");
const PLAIN = new RegExp(`^\\*\\*(${KINDS})\\s*[:.]?\\*\\*\\s*[:.]?\\s*(.*)$`, "i");

/** `quote` holds the lines of the quote with the ">" taken off. null when it is an ordinary quote. */
export function parseCallout(quote: string[]): Callout | null {
  const first = quote.findIndex((l) => l.trim() !== "");
  if (first < 0) return null;
  const head = GITHUB.exec(quote[first].trim()) ?? PLAIN.exec(quote[first].trim());
  if (!head) return null;
  const lines = [head[2], ...quote.slice(first + 1)];
  const paragraphs: string[] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (l.trim() === "") { if (cur.length) paragraphs.push(cur.join(" ")); cur = []; } else cur.push(l.trim());
  }
  if (cur.length) paragraphs.push(cur.join(" "));
  return { kind: head[1].toLowerCase() as CalloutKind, paragraphs };
}
