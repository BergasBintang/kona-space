// A markdown table as a real table: click a heading to sort, type to filter the rows, and a View panel for how it looks (spacing, stripes,
// long text, the first column) and which columns show. How it looks is one choice for all tables and is remembered on this PC; which columns
// show, the sort and the filter belong to one table and are forgotten when the page is.
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { filterRows, numericColumn, sortRows, type Table } from "../../lib/brain/table.ts";
import { CopyButton } from "./Copy";

type Look = { tight: boolean; stripes: boolean; wrap: boolean; freeze: boolean };
const KEY = "kona.tables";
const FIRST: Look = { tight: false, stripes: true, wrap: true, freeze: false };

function load(): Look {
  try { const s = localStorage.getItem(KEY); if (s) return { ...FIRST, ...JSON.parse(s) }; } catch { /* no storage here: the defaults will do */ }
  return FIRST;
}
let look = load();
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
function choose(patch: Partial<Look>) {
  look = { ...look, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(look)); } catch { /* the choice lasts until the window closes */ }
  listeners.forEach((f) => f());
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="text-[13px] leading-5 font-bold text-text-secondary">{label}</span>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}
          className={`h-8 border-2 px-2.5 text-[14px] ${v === value ? "border-accent bg-surface-3 text-text" : "border-line-subtle bg-surface-2 text-text-secondary hover:bg-surface-3"}`}>{text}</button>
      ))}
    </div>
  );
}

const Arrow = ({ dir }: { dir: "asc" | "desc" }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0"><path d={dir === "asc" ? "M6 2 L10 8 L2 8 Z" : "M6 10 L10 4 L2 4 Z"} fill="currentColor" /></svg>
);

const MANY = 8; // a table with this many rows gets a filter box

/** `source` is the table as written in the file: that is what Copy puts on the clipboard, so a table pasted into another file is still a table. */
export function MdTable({ table, cell, source }: { table: Table; cell: (text: string, key: string) => ReactNode; source: string }) {
  const view = useSyncExternalStore(subscribe, () => look);
  const [panel, setPanel] = useState(false);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => table.head.map((_, i) => i).filter((i) => !hidden.has(i)), [table, hidden]);
  const numeric = useMemo(() => table.head.map((_, i) => numericColumn(table.rows, i)), [table]);
  const rows = useMemo(() => {
    const sorted = sort ? sortRows(table.rows, sort.col, sort.dir) : table.rows;
    return filterRows(sorted, query, shown);
  }, [table, sort, query, shown]);

  const alignOf = (i: number) => table.align[i] ?? (numeric[i] ? "right" : "left");
  const flush = (a: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  const pad = view.tight ? "px-2.5 py-1" : "px-3.5 py-2.5";
  const ground = "var(--color-inset)";
  const band = "color-mix(in srgb, var(--color-surface-1) 55%, var(--color-inset))";
  const next = (col: number) => setSort((s) => (!s || s.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null));
  const toggle = (i: number) => setHidden((h) => { const n = new Set(h); if (n.has(i)) n.delete(i); else if (shown.length > 1) n.add(i); return n; });
  const changed = hidden.size > 0 || sort !== null || query !== "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-[13px] leading-5 text-text-tertiary">
        <span>{rows.length === table.rows.length ? `${rows.length} ${rows.length === 1 ? "row" : "rows"}` : `${rows.length} of ${table.rows.length} rows`}</span>
        <span className="flex-1" />
        {table.rows.length >= MANY && (
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter rows" aria-label="Filter rows"
            className="h-8 w-44 border border-line-strong bg-inset px-2.5 text-[14px] text-text placeholder:text-text-tertiary" />
        )}
        <CopyButton text={source} className="h-8 px-1" />
        <button type="button" onClick={() => setPanel((o) => !o)} aria-expanded={panel} className="h-8 px-1 font-bold text-text-secondary hover:text-text">
          {panel ? "Hide the view" : "View"}
        </button>
      </div>

      {panel && (
        <div className="flex flex-col gap-3 border border-line-subtle bg-surface-2 p-3.5">
          <div className="flex flex-wrap gap-x-6 gap-y-2.5">
            <Choice label="Row spacing" value={view.tight ? "tight" : "roomy"} options={[["roomy", "Roomy"], ["tight", "Tight"]]} onChange={(v) => choose({ tight: v === "tight" })} />
            <Choice label="Stripes" value={view.stripes ? "on" : "off"} options={[["on", "On"], ["off", "Off"]]} onChange={(v) => choose({ stripes: v === "on" })} />
            <Choice label="Long text" value={view.wrap ? "wrap" : "line"} options={[["wrap", "Wraps"], ["line", "One line"]]} onChange={(v) => choose({ wrap: v === "wrap" })} />
            <Choice label="First column" value={view.freeze ? "stays" : "moves"} options={[["moves", "Scrolls"], ["stays", "Stays in view"]]} onChange={(v) => choose({ freeze: v === "stays" })} />
          </div>
          <div role="group" aria-label="Columns to show" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[13px] leading-5 font-bold text-text-secondary">Columns</span>
            {table.head.map((h, i) => (
              <label key={i} className="flex cursor-pointer items-center gap-2 text-[14px] leading-5">
                <input type="checkbox" checked={!hidden.has(i)} onChange={() => toggle(i)} className="h-4 w-4 accent-[var(--color-accent)]" />
                <span>{h || `Column ${i + 1}`}</span>
              </label>
            ))}
            {changed && <button type="button" onClick={() => { setHidden(new Set()); setSort(null); setQuery(""); }} className="ml-auto font-bold text-text-secondary hover:text-text">Back to the file's order</button>}
          </div>
        </div>
      )}

      <div className="max-h-[560px] overflow-auto border border-line-subtle bg-inset">
        <table className="w-full border-collapse text-[14px] leading-5 text-text-secondary">
          <thead>
            <tr>
              {shown.map((i, k) => {
                const on = sort?.col === i;
                const align = alignOf(i);
                return (
                  <th key={i} scope="col" aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={`sticky top-0 border-b-2 border-line-strong bg-surface-1 p-0 font-bold text-text ${flush(align)} ${view.freeze && k === 0 ? "left-0 z-[2]" : "z-[1]"}`}>
                    <button type="button" onClick={() => next(i)} title="Sort by this column"
                      className={`flex w-full items-center gap-1.5 text-[14px] ${pad} hover:bg-surface-3 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
                      <span className={view.wrap ? "" : "whitespace-nowrap"}>{table.head[i] ? cell(table.head[i], `h${i}`) : ""}</span>
                      {on && <Arrow dir={sort!.dir} />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, n) => (
              <tr key={n} className="border-b border-line-subtle last:border-b-0">
                {shown.map((i, k) => (
                  <td key={i} className={`align-top ${pad} ${flush(alignOf(i))} ${view.wrap ? "" : "whitespace-nowrap"} ${view.freeze && k === 0 ? "sticky left-0 z-[1] font-bold text-text" : ""}`}
                    style={view.freeze && k === 0 ? { background: view.stripes && n % 2 === 1 ? band : ground } : view.stripes && n % 2 === 1 ? { background: band } : undefined}>
                    {r[i].split(/<br\s*\/?>/i).map((part, j) => <span key={j}>{j > 0 && <br />}{cell(part, `c${n}-${i}-${j}`)}</span>)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={shown.length} className={`${pad} text-text-tertiary`}>{query.trim() ? <>No row has “{query.trim()}”. <button type="button" onClick={() => setQuery("")} className="font-bold text-text-secondary hover:text-text">Clear the filter</button></> : "No rows."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
