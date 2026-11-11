// The row of script buttons above the terminal's input bar: the project's npm and composer scripts and the owner's own buttons. A button only
// puts its command into the bar; nothing runs until Enter. As many buttons as fit the row are shown; the rest are behind "More", a list with a
// search box. The owner's own buttons are marked by a thin accent line on their left and have a small x on hover to remove them.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { filterButtons, fitCount, looksSecret, type ScriptButton } from "../../lib/blocks";
import { Confirm } from "../Confirm";

const GAP = 4;       // between two buttons, in pixels
const MORE_W = 92;   // room kept for the More button
const ADD_W = 32;    // room kept for the + button
const tag = "inline-flex h-7 shrink-0 items-center bg-surface-3 px-2.5 font-mono text-[12px] leading-none text-text hover:bg-line-subtle active:bg-surface-2 disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-surface-3";

function Chip({ b, disabled, onPick, onRemove }: { b: ScriptButton; disabled: boolean; onPick: (b: ScriptButton) => void; onRemove: (b: ScriptButton) => void }) {
  const own = b.kind === "own";
  return (
    <span className="group relative inline-flex shrink-0">
      <button type="button" disabled={disabled} title={b.line} onClick={() => onPick(b)} className={`${tag} ${own ? "border-l-2 border-accent pr-6" : ""}`}>{b.name}</button>
      {own && <button type="button" aria-label={`Remove ${b.name}`} title="Remove this button" onClick={() => onRemove(b)}
        className="absolute top-0 right-0 hidden h-7 w-6 items-center justify-center text-[13px] leading-none text-text-tertiary hover:text-state-left group-focus-within:flex group-hover:flex">×</button>}
    </span>
  );
}

function MoreList({ hidden, disabled, onPick, onRemove, onClose }: { hidden: ScriptButton[]; disabled: boolean; onPick: (b: ScriptButton) => void; onRemove: (b: ScriptButton) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = filterButtons(hidden, query);
  useEffect(() => { setAt(0); }, [query]);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("mousedown", down);
    return () => window.removeEventListener("mousedown", down);
  }, [onClose]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(list.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && list[at]) { e.preventDefault(); onPick(list[at]); onClose(); }
  };
  return (
    <div ref={box} role="dialog" aria-label="More buttons" onKeyDown={key}
      className="absolute right-0 bottom-full z-30 mb-2 flex w-[440px] max-w-[80vw] flex-col border border-line-strong bg-surface-2 shadow-md">
      {hidden.length > 8 && (
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a button" aria-label="Find a button" data-autosaves
          className="m-2 h-9 border border-line-subtle bg-inset px-2 font-mono text-[13px] outline-none focus:border-accent" />
      )}
      <ul className="m-0 max-h-[260px] list-none overflow-y-auto p-0">
        {list.length === 0 && <li className="px-3 py-3 text-[13px] text-text-tertiary">No button matches.</li>}
        {list.map((b, i) => (
          <li key={b.id} className={`group flex items-center gap-2 ${i === at ? "bg-surface-3" : "hover:bg-surface-3"}`} onMouseEnter={() => setAt(i)}>
            <button type="button" disabled={disabled} onClick={() => { onPick(b); onClose(); }} className="flex min-w-0 flex-1 items-baseline gap-3 px-3 py-2 text-left disabled:text-text-disabled">
              <span className="shrink-0 font-mono text-[13px] font-bold">{b.name}</span>
              <span className="min-w-0 truncate font-mono text-[12px] text-text-tertiary">{b.line}</span>
            </button>
            {b.kind === "own" && <button type="button" onClick={() => onRemove(b)} className="mr-2 hidden h-7 shrink-0 px-2 text-[12px] font-bold text-text-secondary hover:text-state-left group-hover:block">Remove</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScriptButtons({ items, disabled, onPick, onAdd, onRemove }: { items: ScriptButton[]; disabled: boolean; onPick: (b: ScriptButton) => void; onAdd: () => void; onRemove: (b: ScriptButton) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(items.length);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const r = row.current, m = meter.current;
    if (!r || !m) return;
    const widths = [...m.children].map((c) => (c as HTMLElement).offsetWidth);
    setFit(fitCount(widths, r.clientWidth - ADD_W - GAP, MORE_W, GAP));
  }, []);
  useLayoutEffect(measure, [items, measure]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (row.current) ro.observe(row.current);
    return () => ro.disconnect();
  }, [measure]);
  const shown = items.slice(0, fit), hidden = items.slice(fit);
  useEffect(() => { if (hidden.length === 0) setMore(false); }, [hidden.length]);

  return (
    <div ref={row} className="relative flex min-h-7 items-center gap-1" aria-label="Script buttons">
      {/* the same buttons, unseen, only to measure how wide each is */}
      <div ref={meter} aria-hidden inert className="pointer-events-none invisible absolute top-0 left-0 -z-10 flex gap-1 whitespace-nowrap">
        {items.map((b) => <Chip key={b.id} b={b} disabled onPick={() => {}} onRemove={() => {}} />)}
      </div>
      {shown.map((b) => <Chip key={b.id} b={b} disabled={disabled} onPick={onPick} onRemove={onRemove} />)}
      {hidden.length > 0 && (
        <span className="relative inline-flex shrink-0">
          <button type="button" aria-expanded={more} onClick={() => setMore((v) => !v)}
            className="inline-flex h-7 items-center border border-line-strong px-2.5 text-[12px] leading-none font-bold text-text-secondary hover:bg-surface-3">More · {hidden.length}</button>
          {more && <MoreList hidden={hidden} disabled={disabled} onPick={onPick} onRemove={onRemove} onClose={() => setMore(false)} />}
        </span>
      )}
      <button type="button" aria-label="Add a button" title="Add a button of your own" onClick={onAdd}
        className="inline-flex h-7 shrink-0 items-center justify-center px-2 text-[13px] leading-none font-bold text-text-secondary hover:bg-surface-3">{items.length === 0 ? "+ Add a button" : "+"}</button>
    </div>
  );
}

/** The small form for a button of your own: a name and a one-line command. */
export function AddButtonDialog({ taken, onSave, onCancel }: { taken: string[]; onSave: (name: string, line: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [line, setLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => first.current?.focus({ preventScroll: true }), 0); return () => clearTimeout(t); }, []);
  const save = () => {
    const n = name.trim(), l = line.trim();
    if (!n) return setError("Give the button a name.");
    if (n.length > 40) return setError("The name is too long (40 letters at most).");
    if (!l) return setError("Write the command the button puts in the bar.");
    if (l.length > 500) return setError("The command is too long (500 letters at most).");
    if (taken.some((t) => t.toLowerCase() === n.toLowerCase())) return setError(`There is already a button named "${n}".`);
    if (looksSecret(l)) return setError("This command looks like it holds a key, a token or a password. Kona does not save those.");
    onSave(n, l);
  };
  const input = "h-10 w-full border border-line-subtle bg-inset px-3 font-mono text-[14px] font-normal text-text outline-none focus:border-accent";
  return (
    <Confirm title="Add a button" confirmLabel="Add it" error={error} onConfirm={save} onCancel={onCancel}>
      <label className="flex flex-col gap-1 text-[13px] font-bold">Name
        <input ref={first} value={name} maxLength={60} data-autosaves className={input} onChange={(e) => { setName(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-bold">Command
        <input value={line} data-autosaves spellCheck={false} className={input} onChange={(e) => { setLine(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
      </label>
    </Confirm>
  );
}
