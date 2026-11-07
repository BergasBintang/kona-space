// The reading tools of a page of markdown, shared by the Files reader and the Brain's note page (ticket T-0029, decision 81: a note and a document are
// one thing, so they open as one kind of page): the outline of its headings ("On this page"), find with Ctrl+F, and a plain view of the text with line numbers.
// The markdown itself is drawn by `Markdown.tsx` in both places. What stays different is the frame: Files has a file's size and path and follows links between
// files; the Brain has the links in and out, the tickets and editing.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { outline, slugify, type Heading } from "../../lib/brain/outline.ts";
import { clearPaint, findIn, paint } from "../find";
import { Button } from "../ui";
import { IconButton } from "../Icon";

export type Anchor = { id: string; n: number };

/**
 * The state of a page that is read: which heading is being read, find (Ctrl+F opens the box, Enter and Shift+Enter step, Esc closes) and the jump to a heading.
 * `resetKey` names what is shown (a file's path, a note's id): when it changes, find is closed. `finds` says whether the text can be searched on the screen.
 */
export function useReader({ text, md, rendered, finds, anchor, resetKey }: { text: string | null; md: boolean; rendered: boolean; finds: boolean; anchor: Anchor | null; resetKey: string | null }) {
  const [active, setActive] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState({ count: 0, at: 0 });
  const matches = useRef<Range[]>([]);
  const body = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const finder = useRef<HTMLInputElement>(null);
  const done = useRef(0);

  const heads = useMemo(() => (text !== null && md && rendered ? outline(text).filter((h) => h.level <= 3) : []), [text, md, rendered]);

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ block: "start" }); setActive(id); }
    return !!el;
  }, []);

  // a link that named a heading of another file: go to it once that file is on the screen
  useEffect(() => {
    if (!anchor || anchor.n === done.current || text === null || !rendered) return;
    done.current = anchor.n;
    let a = anchor.id;
    try { a = decodeURIComponent(a); } catch { /* as written */ }
    requestAnimationFrame(() => { if (!jump(`md-${a.toLowerCase()}`)) jump(`md-${slugify(a)}`); });
  }, [anchor, text, rendered, jump]);

  // a new page starts at its first heading
  useEffect(() => { setActive(null); }, [resetKey]);

  // which heading is being read: the last one that has reached the top of the page
  useEffect(() => {
    const box = scroller.current;
    if (!box || heads.length === 0) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = box.getBoundingClientRect().top;
      let cur = heads[0].id;
      for (const h of heads) { const el = document.getElementById(h.id); if (!el) continue; if (el.getBoundingClientRect().top - top <= 48) cur = h.id; else break; }
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => { box.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [heads]);

  useEffect(() => {
    if (resetKey === null) return;
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && finds) { e.preventDefault(); setFinding(true); requestAnimationFrame(() => finder.current?.select()); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [resetKey, finds]);
  useEffect(() => {
    if (!finding || !query || !body.current || !finds) { matches.current = []; setHits({ count: 0, at: 0 }); clearPaint(); return; }
    const found = findIn(body.current, query);
    matches.current = found;
    setHits({ count: found.length, at: 0 });
    paint(found, 0, found.length > 0);
    return clearPaint;
  }, [finding, query, finds, rendered, resetKey]);
  useEffect(() => { setFinding(false); setQuery(""); }, [resetKey]);

  const step = (d: number) => {
    if (matches.current.length === 0) return;
    const at = (hits.at + d + matches.current.length) % matches.current.length;
    setHits({ count: matches.current.length, at });
    paint(matches.current, at, true);
  };
  const toggleFind = () => { setFinding((f) => !f); requestAnimationFrame(() => finder.current?.select()); };

  return { heads, active, jump, finding, setFinding, query, setQuery, hits, step, toggleFind, body, scroller, finder };
}

/** The find box under a page's title: type, Enter for the next match, Esc to close. */
export function FindBar({ reader }: { reader: ReturnType<typeof useReader> }) {
  const { finder, query, setQuery, hits, step, setFinding } = reader;
  return (
    <div role="search" className="mt-1 flex flex-wrap items-center gap-3">
      <input ref={finder} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find on this page" aria-label="Search on this page"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); } else if (e.key === "Escape") { e.preventDefault(); setFinding(false); } }}
        className="h-9 w-64 border border-line-strong bg-inset px-3 text-[14px] text-text placeholder:text-text-tertiary" />
      <span className="text-[13px] leading-5 text-text-tertiary" aria-live="polite">{!query ? "" : hits.count === 0 ? "Nothing found" : `${hits.at + 1} of ${hits.count}`}</span>
      <Button variant="ghost" tiny onClick={() => step(-1)} disabled={hits.count === 0}>Previous</Button>
      <Button variant="ghost" tiny onClick={() => step(1)} disabled={hits.count === 0}>Next</Button>
      <Button variant="ghost" tiny onClick={() => setFinding(false)}>Close the search</Button>
    </div>
  );
}

/** The text as it is written, with line numbers. */
export function Gutter({ text }: { text: string }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const numbers = useMemo(() => lines.map((_, i) => i + 1).join("\n"), [lines]);
  return (
    <div className="flex min-w-0 font-mono text-[13px] leading-5">
      <pre className="m-0 shrink-0 select-none border-r border-line-subtle pr-3 pl-4 text-right text-text-disabled" aria-hidden="true">{numbers}</pre>
      <pre className="m-0 min-w-0 flex-1 overflow-x-auto pr-6 pl-4 whitespace-pre text-text">{text}</pre>
    </div>
  );
}

/** Whether the outline is open. It is one choice for every page, and it is remembered (a closed outline stays closed on the next page and the next day). */
export function useOutlineOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem("kona-outline") !== "closed"; } catch { return true; } });
  const set = useCallback((v: boolean) => { setOpen(v); try { localStorage.setItem("kona-outline", v ? "open" : "closed"); } catch { /* not remembered this time */ } }, []);
  return [open, set];
}

/** What is left of a closed outline: a slim strip down the left of the page with the icon of three dots, each with a strip. The icon opens the outline again. */
export function OutlineRail({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="hidden w-14 shrink-0 flex-col items-center border-r border-line-subtle py-3 lg:flex">
      <IconButton icon="outline" variant="ghost" label="Show the outline" onClick={onOpen} />
    </div>
  );
}

/** "On this page": the headings of a long page, on the left of it; the one being read is marked, and a click jumps to one. The X closes it. */
export function Outline({ heads, active, onJump, onClose }: { heads: Heading[]; active: string | null; onJump: (id: string) => void; onClose: () => void }) {
  const low = Math.min(...heads.map((h) => h.level));
  return (
    <nav aria-label="On this page" className="hidden w-[250px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line-subtle py-3 pr-3 pl-3 lg:flex">
      <div className="flex items-center justify-between gap-2 pb-1.5 pl-2">
        <span className="text-[15px] leading-6 font-bold">On this page</span>
        <IconButton icon="close" variant="ghost" label="Close the outline" onClick={onClose} />
      </div>
      {heads.map((h) => (
        <button key={h.id} type="button" onClick={() => onJump(h.id)} aria-current={h.id === active ? "location" : undefined} title={h.text}
          className={`border-l-2 py-1 pr-2 text-left text-[14px] leading-5 ${h.id === active ? "border-accent font-bold text-text" : "border-transparent text-text-secondary hover:text-text"}`}
          style={{ paddingLeft: 10 + (h.level - low) * 14 }}>
          <span className="line-clamp-2">{h.text}</span>
        </button>
      ))}
    </nav>
  );
}
