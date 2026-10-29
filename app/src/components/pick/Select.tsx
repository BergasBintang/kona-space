// Single select and multi select. One list to choose from, drawn by Kona instead of the system dropdown (which is white
// on a dark window). The list gets a search row once it has more than 8 options (or when asked), and the search is the
// smart search of lib/search.ts: best match first, typos forgiven, initials, matched letters marked.
//   <Select label="Model" value={model} onChange={setModel} options={[{ value: "sonnet", label: "Sonnet", hint: "The usual choice" }]} />
//   <MultiSelect label="Skills" values={picked} onChange={setPicked} options={...} />
// Keys: Down / Up / Enter / Space open it; Up and Down move; Home and End jump; Enter or Space choose; Esc closes (and clears the
// search first); typing in the search row filters. The trigger keeps the focus, so a screen reader hears the highlighted row
// through aria-activedescendant.
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { prepare, rank, didYouMean, type Option } from "../../lib/search";
import { CHEVRON, NoMatch, OptionRow, Popover, firstEnabled, step, triggerBase, useDismiss, usePlace, useScrollIntoView } from "./parts";

type Common = {
  label?: string; // the visible label above the field; also names the list in "Nothing matches …"
  ariaLabel?: string;
  options: Option[];
  placeholder?: string;
  search?: boolean; // force the search row on or off; the default is on above 8 options
  disabled?: boolean;
  icon?: ReactNode; // a small picture inside the trigger, before the text
  bold?: boolean;
  className?: string;
};

function Picker({ multiple, values, onChange, label, ariaLabel, options, placeholder = "Choose", search, disabled, icon, bold, className = "" }: Common & {
  multiple: boolean; values: string[]; onChange: (v: string[]) => void;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => prepare(options), [options]);
  const hits = useMemo(() => rank(query, entries), [query, entries]);
  const showSearch = search ?? options.length > 8;
  const place = usePlace(open, trigger);
  const active = cursor >= 0 && cursor < hits.length ? `${uid}-o${cursor}` : undefined;
  useScrollIntoView(list, active);

  const close = useCallback(() => { setOpen(false); setQuery(""); setCursor(-1); }, []);
  useDismiss(open, wrap, close);

  const openList = () => {
    if (disabled) return;
    const at = options.findIndex((o) => values.includes(o.value));
    const first = rank("", entries);
    setOpen(true); setQuery("");
    setCursor(at >= 0 ? first.findIndex((h) => h.opt.value === options[at].value) : firstEnabled(first));
    if (showSearch) setTimeout(() => searchBox.current?.focus(), 0);
  };

  const choose = (o: Option) => {
    if (o.disabled) return;
    if (multiple) onChange(values.includes(o.value) ? values.filter((v) => v !== o.value) : [...values, o.value]);
    else { onChange([o.value]); close(); trigger.current?.focus(); }
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    const inSearch = e.target === searchBox.current;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setCursor((c) => (c < 0 ? firstEnabled(hits) : step(hits, c, 1))); break;
      case "ArrowUp": e.preventDefault(); setCursor((c) => (c < 0 ? firstEnabled(hits) : step(hits, c, -1))); break;
      case "Home": if (!inSearch) { e.preventDefault(); setCursor(firstEnabled(hits)); } break;
      case "End": if (!inSearch) { e.preventDefault(); setCursor(hits.length - 1 - [...hits].reverse().findIndex((h) => !h.opt.disabled)); } break;
      case "Enter": e.preventDefault(); if (hits[cursor]) choose(hits[cursor].opt); break;
      case " ": if (!inSearch) { e.preventDefault(); if (hits[cursor]) choose(hits[cursor].opt); } break;
      case "Escape": e.preventDefault(); if (query) { setQuery(""); setCursor(0); } else { close(); trigger.current?.focus(); } break;
      case "Tab": close(); break;
    }
  };

  const chosen = options.filter((o) => values.includes(o.value));
  const shown = chosen.length === 0 ? null : multiple && chosen.length > 2 ? `${chosen.length} chosen` : chosen.map((o) => o.label).join(", ");
  const where = label ? label.toLowerCase() : "this list";

  return (
    <div ref={wrap} className={`relative flex flex-col gap-2 ${className}`}>
      {label && <span id={`${uid}-label`} className="text-[13px] leading-5 font-bold text-text-secondary">{label}</span>}
      <button ref={trigger} type="button" disabled={disabled} onClick={() => (open ? close() : openList())} onKeyDown={onKey}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-list`} aria-activedescendant={!showSearch ? active : undefined}
        aria-labelledby={label ? `${uid}-label ${uid}-value` : undefined} aria-label={label ? undefined : ariaLabel}
        className={triggerBase}>
        {icon}
        <span id={`${uid}-value`} className={`min-w-0 flex-1 truncate ${shown === null ? "text-text-tertiary" : bold ? "font-bold" : ""}`}>{shown ?? placeholder}</span>
        {CHEVRON}
      </button>
      {open && place && (
        <Popover place={place} listRef={list}>
          {showSearch && (
            <div className="border-b border-line-subtle p-2">
              <input ref={searchBox} type="search" value={query} onChange={(e) => { setQuery(e.target.value); setCursor(0); }} onKeyDown={onKey}
                placeholder={label ? `Search ${where}` : "Search"} aria-label={label ? `Search ${where}` : "Search"} autoComplete="off" role="combobox" aria-expanded="true"
                aria-controls={`${uid}-list`} aria-activedescendant={active}
                className="h-10 w-full border border-line-strong bg-inset px-3 text-[14px] text-text placeholder:text-text-tertiary" />
            </div>
          )}
          <div id={`${uid}-list`} role="listbox" aria-multiselectable={multiple || undefined} aria-label={label ?? ariaLabel} className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {hits.map((h, i) => (
              <OptionRow key={h.opt.value} id={`${uid}-o${i}`} hit={h} chosen={values.includes(h.opt.value)} active={i === cursor} box={multiple}
                onPick={() => choose(h.opt)} onHover={() => setCursor(i)} />
            ))}
            {hits.length === 0 && <NoMatch query={query} where={where} suggestion={didYouMean(query, options)} onSuggest={(s) => { setQuery(s); setCursor(0); }} onClear={() => { setQuery(""); searchBox.current?.focus(); }} />}
          </div>
          <div className="sr-only" aria-live="polite">{query ? `${hits.length} ${hits.length === 1 ? "result" : "results"}` : ""}</div>
          {multiple && (
            <div className="flex items-center justify-between border-t border-line-subtle px-3.5 py-2 text-[13px] leading-5 text-text-secondary">
              <span>{chosen.length === 0 ? "Nothing chosen" : `${chosen.length} chosen`}</span>
              <button type="button" disabled={chosen.length === 0} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange([])} className="font-bold hover:text-text disabled:text-text-disabled">Clear</button>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}

export function Select({ value, onChange, ...rest }: Common & { value: string; onChange: (v: string) => void }) {
  return <Picker {...rest} multiple={false} values={[value]} onChange={(v) => onChange(v[0] ?? "")} />;
}

export function MultiSelect({ values, onChange, ...rest }: Common & { values: string[]; onChange: (v: string[]) => void }) {
  return <Picker {...rest} multiple values={values} onChange={onChange} />;
}
