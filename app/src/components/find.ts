// Find in a page: every place where some words appear in the text on the screen, drawn with the browser's own highlight (no change to the page itself).
// The words are looked for inside one piece of text at a time, so a match that crosses a bold mark is not found; the line numbers of a text file are not searched.

const ALL = "kona-find", NOW = "kona-find-now";
type Highlights = { set(name: string, h: unknown): void; delete(name: string): void };
const store = (): Highlights | null => (typeof CSS !== "undefined" ? ((CSS as unknown as { highlights?: Highlights }).highlights ?? null) : null);
const HighlightCtor = (): (new (...r: Range[]) => unknown) | null => ((globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight ?? null);

export function findIn(root: HTMLElement, query: string, cap = 2000): Range[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const out: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("[aria-hidden='true'], script, style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n && out.length < cap; n = walker.nextNode()) {
    const t = (n.nodeValue ?? "").toLowerCase();
    for (let at = t.indexOf(q); at >= 0 && out.length < cap; at = t.indexOf(q, at + q.length)) {
      const r = document.createRange();
      r.setStart(n, at); r.setEnd(n, at + q.length);
      out.push(r);
    }
  }
  return out;
}

/** Colour every match, and the current one more strongly; scrolls the current one into view. */
export function paint(matches: Range[], current: number, scroll: boolean): void {
  const hl = store(), H = HighlightCtor();
  if (!hl || !H) return;
  hl.set(ALL, new H(...matches));
  const now = matches[current];
  if (now) {
    hl.set(NOW, new H(now));
    if (scroll) now.startContainer.parentElement?.scrollIntoView({ block: "center", inline: "nearest" });
  } else hl.delete(NOW);
}

export function clearPaint(): void {
  const hl = store();
  hl?.delete(ALL); hl?.delete(NOW);
}
