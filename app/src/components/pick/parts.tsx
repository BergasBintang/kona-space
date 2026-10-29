// Shared bits of the three pickers (single select, multi select, smart search): the popover position, the marked label,
// one option row, the empty state and the little hooks they share. Behaviour follows the Miralis canon's SelectField and
// Combobox (src/js/20-select.js, 30-combobox.js); the look is Kona's.
import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import type { Hit, Option } from "../../lib/search";

export const CHEVRON = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none shrink-0 text-text-secondary">
    <path d="M4 6 L8 10 L12 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The label with the letters that matched, marked. Marked by weight and an underline as well as colour, never colour alone. */
export function Marked({ text, marks }: { text: string; marks: [number, number][] }) {
  if (!marks.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let end = 0;
  marks.forEach(([a, b], i) => {
    if (a > end) out.push(text.slice(end, a));
    out.push(<mark key={i} className="bg-transparent font-bold text-accent underline decoration-accent/50 underline-offset-2">{text.slice(a, b)}</mark>);
    end = b;
  });
  if (end < text.length) out.push(text.slice(end));
  return <>{out}</>;
}

const TICK = <path d="M3.4 8.4 L6.6 11.4 L12.6 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;

/** One option row. A multi select shows a box that fills when chosen; a single select shows a tick beside the chosen one. */
export function OptionRow({ id, hit, chosen, active, box, onPick, onHover }: {
  id: string; hit: Hit<Option>; chosen: boolean; active: boolean; box: boolean; onPick: () => void; onHover: () => void;
}) {
  const o = hit.opt;
  return (
    <div id={id} role="option" aria-selected={chosen} aria-disabled={o.disabled || undefined}
      onMouseDown={(e) => e.preventDefault() /* keep the focus where it is */} onClick={() => { if (!o.disabled) onPick(); }} onMouseMove={onHover}
      className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 ${active ? "bg-surface-3" : ""} ${o.disabled ? "cursor-not-allowed text-text-disabled" : ""}`}>
      {box ? (
        <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border ${chosen ? "border-accent bg-accent text-on-accent" : "border-line-strong"}`}>
          {chosen && <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">{TICK}</svg>}
        </span>
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-accent">{chosen && <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{TICK}</svg>}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate ${chosen ? "font-bold" : ""}`}><Marked text={o.label} marks={hit.marks} /></span>
        {o.hint && <span className="truncate text-[13px] leading-5 text-text-tertiary">{o.hint}</span>}
      </span>
    </div>
  );
}

/** Nothing matched: say what was searched and where, then the next step (the likely spelling, or clear the search). */
export function NoMatch({ query, where, suggestion, onSuggest, onClear }: { query: string; where: string; suggestion: string | null; onSuggest: (s: string) => void; onClear: () => void }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-3 text-[14px] leading-5 text-text-secondary">
      <span>Nothing matches “{query}” in {where}.</span>
      <span className="flex flex-wrap gap-x-4 gap-y-1">
        {suggestion && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onSuggest(suggestion)} className="rounded font-bold text-text hover:underline">Did you mean “{suggestion}”?</button>}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClear} className="rounded font-bold text-text-secondary hover:text-text hover:underline">Clear the search</button>
      </span>
    </div>
  );
}

export type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/** Where to put the list: under the trigger, or above it when there is not room. Fixed, so a scrolling page cannot clip it. */
export function usePlace(open: boolean, anchor: RefObject<HTMLElement | null>): Place | null {
  const [place, setPlace] = useState<Place | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current) { setPlace(null); return; }
    const r = anchor.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 260 && above > below;
    setPlace({ left: r.left, width: r.width, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }), maxHeight: Math.min(380, Math.max(160, up ? above : below)) });
  }, [open, anchor]);
  return place;
}

/** Close when the person clicks elsewhere, scrolls the page, or resizes the window. */
export function useDismiss(open: boolean, inside: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (inside.current && !inside.current.contains(e.target as Node)) close(); };
    const scroll = (e: Event) => { if (inside.current && !inside.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", down);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", down); window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", close); };
  }, [open, inside, close]);
}

/** The list keeps the highlighted row in view while the arrow keys move. */
export function useScrollIntoView(listRef: RefObject<HTMLElement | null>, activeId: string | undefined) {
  useEffect(() => {
    if (!activeId || !listRef.current) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId, listRef]);
}

/** The popover frame both pickers share. */
export function Popover({ place, children, listRef }: { place: Place; children: ReactNode; listRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={listRef} style={{ position: "fixed", left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
      className="z-50 flex flex-col overflow-hidden border-2 border-line-strong bg-surface-2 px-shadow">
      {children}
    </div>
  );
}

export const triggerBase = "px-field flex h-12 w-full items-center gap-2.5 px-2 text-left text-[15px] text-text disabled:cursor-not-allowed";

/** Pick the next row that is not disabled, moving by `step` from `from`; stays put at the ends. */
export function step(hits: Hit<Option>[], from: number, by: 1 | -1): number {
  let i = from + by;
  while (i >= 0 && i < hits.length && hits[i].opt.disabled) i += by;
  return i >= 0 && i < hits.length ? i : from;
}
export const firstEnabled = (hits: Hit<Option>[]) => hits.findIndex((h) => !h.opt.disabled);
