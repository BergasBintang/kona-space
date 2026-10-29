// The smart search box: a text field that suggests from a long list while you type. The list can be in the page (`options`)
// or fetched (`fetch`). Same matcher as the select's search row (lib/search.ts).
//   <SmartSearch label="Role" options={roles} value={picked} onChange={setPicked} where="roles" />
//   <SmartSearch label="Customer" fetch={(q, signal) => findCustomers(q, signal)} where="customers" value={...} onChange={...} />
// Rules from the Miralis canon (guide section 26): an empty box shows what there is; a fetch starts after 2 letters, waits 200 ms,
// aborts the one in flight, ignores a late reply and keeps the old rows (dimmed) until the new ones arrive; at most 20 rows;
// the matched letters are marked; "nothing found" says what was searched and where, and is shown only after the last reply;
// arrows move, Enter picks, Esc clears the text and, pressed again, closes; the box says how many results there are.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { prepare, rank, didYouMean, type Hit, type Option } from "../../lib/search";
import { NoMatch, OptionRow, Popover, firstEnabled, step, triggerBase, useDismiss, usePlace, useScrollIntoView } from "./parts";

const SEARCH_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-text-secondary">
    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

type Props = {
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  where: string; // what is searched, in plain words: "roles", "customers" (the empty state says it)
  options?: Option[]; // a list in the page
  fetch?: (q: string, signal: AbortSignal) => Promise<Option[]>; // or a list from elsewhere
  min?: number; // letters before a fetch starts (default 2)
  limit?: number; // rows shown (default 20)
  debounce?: number; // ms to wait after a key (default 200)
  value: Option | null;
  onChange: (o: Option | null) => void;
  free?: boolean; // the typed text is itself a valid value; `onChange` gets {value: text, label: text}
  disabled?: boolean;
  className?: string;
};

export function SmartSearch({ label, ariaLabel, placeholder, where, options = [], fetch: fetchRows, min = 2, limit = 20, debounce = 200, value, onChange, free, disabled, className = "" }: Props) {
  const uid = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit<Option>[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [busy, setBusy] = useState(false); // a fetch is in flight
  const [asked, setAsked] = useState(""); // the query the rows on screen answer
  const [error, setError] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, Option[]>());
  const ctl = useRef<AbortController | null>(null);
  const seq = useRef(0);

  const entries = useMemo(() => prepare(options), [options]);
  const place = usePlace(open, wrap);
  const active = cursor >= 0 && cursor < hits.length ? `${uid}-o${cursor}` : undefined;
  useScrollIntoView(list, active);

  // the box shows the chosen label when the chosen thing changes; when the person clears it by typing, their text stays
  const ownClear = useRef(false);
  useEffect(() => {
    if (value) { if (!(free && value.label === text.trim())) setText(value.label); }
    else if (!ownClear.current) setText("");
    ownClear.current = false;
  }, [value?.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => { ctl.current?.abort(); setOpen(false); setBusy(false); setCursor(-1); }, []);
  const revert = useCallback(() => { close(); setText(free ? (t) => t : value?.label ?? ""); }, [close, free, value]);
  useDismiss(open, wrap, revert);

  const search = useCallback((q: string, immediately = false) => {
    ctl.current?.abort();
    const mine = ++seq.current;
    if (!fetchRows) { // a list in the page: answer at once
      const r = rank(q, entries, limit);
      setHits(r); setAsked(q); setCursor(firstEnabled(r)); return;
    }
    if (q.trim().length < min) { setHits([]); setAsked(q); setBusy(false); setCursor(-1); return; }
    const key = q.trim().toLowerCase();
    const cached = cache.current.get(key);
    const show = (rows: Option[]) => { const r = rank("", prepare(rows), limit); setHits(r.map((h) => ({ ...h, marks: rank(q, prepare([h.opt]))[0]?.marks ?? [] }))); setAsked(q); setCursor(firstEnabled(r)); setBusy(false); setError(null); };
    if (cached) { show(cached); return; }
    setBusy(true);
    const run = () => {
      const c = new AbortController(); ctl.current = c;
      fetchRows(q.trim(), c.signal).then((rows) => {
        if (mine !== seq.current || c.signal.aborted) return; // a late reply for an older query
        cache.current.set(key, rows); show(rows);
      }).catch((e) => { if (c.signal.aborted || mine !== seq.current) return; setBusy(false); setError(String(e?.message ?? e)); });
    };
    if (immediately) run(); else window.setTimeout(() => { if (mine === seq.current) run(); }, debounce);
  }, [entries, fetchRows, limit, min, debounce]);

  const openList = () => { if (disabled || open) return; setOpen(true); search(text === value?.label ? "" : text, true); };

  const pick = (o: Option) => {
    if (o.disabled) return;
    onChange(o); setText(o.label); close();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openList(); } return; }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setCursor((c) => (c < 0 ? firstEnabled(hits) : step(hits, c, 1))); break;
      case "ArrowUp": e.preventDefault(); setCursor((c) => (c < 0 ? firstEnabled(hits) : step(hits, c, -1))); break;
      case "Enter": e.preventDefault(); if (hits[cursor]) pick(hits[cursor].opt); else if (free && text.trim()) { onChange({ value: text.trim(), label: text.trim() }); close(); } break;
      case "Escape": e.preventDefault(); if (text) { setText(""); ownClear.current = true; onChange(null); search("", true); } else close(); break;
      case "Tab": revert(); break;
    }
  };

  const typed = (t: string) => {
    setText(t); setOpen(true);
    if (value && t !== value.label && !free) { ownClear.current = true; onChange(null); }
    if (free) onChange(t.trim() ? { value: t.trim(), label: t.trim() } : null);
    search(t);
  };

  const needMore = !!fetchRows && text.trim().length < min && !busy;
  const nothing = open && !busy && !error && !needMore && hits.length === 0 && asked === text.trim();
  const count = hits.length;

  return (
    <div ref={wrap} className={`relative flex flex-col gap-2 ${className}`}>
      {label && <label htmlFor={`${uid}-in`} className="text-[13px] leading-5 font-bold text-text-secondary">{label}</label>}
      <div className={`${triggerBase} ${disabled ? "" : "focus-within:border-accent"}`}>
        {SEARCH_ICON}
        <input ref={input} id={`${uid}-in`} value={text} disabled={disabled} onChange={(e) => typed(e.target.value)} onFocus={openList} onClick={openList} onKeyDown={onKey} onBlur={() => { if (open) revert(); }}
          role="combobox" aria-expanded={open} aria-controls={`${uid}-list`} aria-autocomplete="list" aria-activedescendant={active} aria-label={label ? undefined : ariaLabel ?? `Search ${where}`}
          placeholder={placeholder ?? `Search ${where}`} autoComplete="off" spellCheck={false}
          className="bare min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-tertiary" />
        {text && !disabled && (
          <button type="button" aria-label="Clear" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(""); ownClear.current = true; onChange(null); setOpen(true); search("", true); input.current?.focus(); }}
            className="flex h-6 w-6 shrink-0 items-center justify-center text-text-secondary hover:text-text">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>
      {open && place && (
        <Popover place={place} listRef={list}>
          <div id={`${uid}-list`} role="listbox" aria-label={label ?? ariaLabel ?? where} className={`min-h-0 flex-1 overflow-y-auto p-1.5 ${busy && hits.length > 0 ? "opacity-60" : ""}`}>
            {hits.map((h, i) => (
              <OptionRow key={h.opt.value} id={`${uid}-o${i}`} hit={h} chosen={value?.value === h.opt.value} active={i === cursor} box={false} onPick={() => pick(h.opt)} onHover={() => setCursor(i)} />
            ))}
            {needMore && <p className="m-0 px-3 py-3 text-[14px] leading-5 text-text-tertiary">Type {min} letters to search {where}.</p>}
            {busy && hits.length === 0 && <p className="m-0 px-3 py-3 text-[14px] leading-5 text-text-tertiary">Searching {where}…</p>}
            {error && <p className="m-0 px-3 py-3 text-[14px] leading-5 text-state-left">Could not search {where}: {error}</p>}
            {nothing && (free
              ? <p className="m-0 px-3 py-3 text-[14px] leading-5 text-text-secondary">Nothing in {where} matches “{text.trim()}”. Press Enter to use it as typed.</p>
              : <NoMatch query={text.trim()} where={where} suggestion={didYouMean(text, options)} onSuggest={(s) => typed(s)} onClear={() => typed("")} />)}
          </div>
          <div className="sr-only" aria-live="polite">{open && !busy && asked !== "" ? `${count} ${count === 1 ? "result" : "results"}` : ""}</div>
        </Popover>
      )}
    </div>
  );
}
