// The pages of Kona that can be open at once (decision 95). Every page that is opened stays alive (its draft, its scroll, its running mockup) as a chip in a small tray in the top bar, like a
// browser tab: one is shown over the office, a click on another chip shows that one instead, MINIMIZE only hides the shown one, and only an X (the page's or the chip's) CLOSES it and ends it.
// When a page that would lose something (typed text that was not sent, a program that runs) is closed, Kona asks once: minimize, close or cancel. The office is not a page and has no tab.
/** The most pages alive at once, the shown one included: each one that stays open uses memory */
export const MAX_KEPT = 6;

/** "place:mockups" for a page of a place, "person:<role>" for the sheet of a person; null for the office (no page) */
export const pageKey = (place: string, person: string | null): string | null => (place !== "office" ? `place:${place}` : person ? `person:${person}` : null);

export type PageRef = { kind: "place" | "person"; id: string };

export function parseKey(key: string): PageRef | null {
  const i = key.indexOf(":");
  if (i < 0) return null;
  const kind = key.slice(0, i);
  const id = key.slice(i + 1);
  return (kind === "place" || kind === "person") && id !== "" ? { kind, id } : null;
}

/** The list of minimized pages with one more: refused (ok false, list unchanged) when it is full and the page is not already in it */
export function keepAdd(kept: string[], key: string, max = MAX_KEPT): { kept: string[]; ok: boolean } {
  if (kept.includes(key)) return { kept, ok: true };
  if (kept.length >= max) return { kept, ok: false };
  return { kept: [...kept, key], ok: true };
}

export const keepRemove = (kept: string[], key: string): string[] => kept.filter((k) => k !== key);

/** The pages to draw, in a steady order: the minimized ones as they were minimized, then the shown one (so a page that is shown again keeps its place in the tree) */
export const drawOrder = (kept: string[], shown: string | null): string[] => (shown && !kept.includes(shown) ? [...kept, shown] : [...kept]);
