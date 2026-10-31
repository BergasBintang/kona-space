// The sheet: a page of Kona that slides up from below over the office, under the top bar and the turn buttons. It closes with the X or Esc. If the owner typed something
// in it that nothing has taken yet (see lib/unsaved.ts), closing, switching tab or leaving through the top bar first asks. A room with two pages shows them as tabs.
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Confirm } from "./Confirm";
import { Typed } from "../lib/unsaved";

/** What the rest of the app can ask the open sheet: do the move, but ask first if there is unsaved text. */
export type Guard = { leave: (go: () => void) => void };

// a box that holds a draft: a text area or a one-line text box, but not a list's search box or a filter
const isText = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && (el.type === "text" || el.type === "" || el.type === "url" || el.type === "email" || el.type === "password")
    && el.getAttribute("role") !== "combobox" && !/search|filter/i.test(el.getAttribute("aria-label") ?? el.placeholder));

export function Sheet({ title, subtitle, tabs, active, onTab, onClose, guard, children }: {
  title: string; subtitle?: string; tabs?: { id: string; label: string }[]; active?: string; onTab?: (id: string) => void; onClose: () => void; guard: MutableRefObject<Guard | null>; children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const typed = useRef(new Typed());
  const [ask, setAsk] = useState<(() => void) | null>(null);

  const unsaved = () => typed.current.unsaved([...(root.current?.querySelectorAll("textarea, input") ?? [])].filter(isText));
  const leave = (go: () => void) => { if (unsaved()) setAsk(() => go); else go(); };
  const latest = useRef({ leave, onClose });
  latest.current = { leave, onClose };

  useEffect(() => {
    guard.current = { leave: (go) => latest.current.leave(go) };
    return () => { guard.current = null; };
  }, [guard]);
  useEffect(() => { typed.current = new Typed(); }, [title]); // another page: what was typed on the last one no longer counts
  useEffect(() => { // Esc closes the sheet, unless something inside took it (a list that was open, a dialog)
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) latest.current.leave(latest.current.onClose); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => { // the keyboard starts inside the sheet, and goes back to the room it came from
    const was = document.activeElement as HTMLElement | SVGElement | null;
    root.current?.focus();
    return () => { if (was && document.contains(was)) was.focus?.(); };
  }, []);

  const tab = (id: string) => { if (id !== active) leave(() => onTab?.(id)); };

  return (
    <>
    <section ref={root} data-sheet tabIndex={-1} aria-label={title}
      onInput={(e) => { if (isText(e.target as Element)) typed.current.typed(e.target); }}
      onClickCapture={(e) => { const b = (e.target as Element).closest("button"); if (b && !b.hasAttribute("data-leave")) typed.current.acted(); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && isText(e.target as Element)) typed.current.acted(); }}
      className="kona-sheet absolute inset-x-0 top-[88px] bottom-0 z-10 flex flex-col border-t-2 border-line-strong bg-ground outline-none" style={{ boxShadow: "0 -4px 0 0 rgb(45 34 24 / 0.2)" }}>
      <header className="flex min-h-14 shrink-0 items-center gap-4 border-b border-line-subtle bg-surface-1 px-5">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="m-0 text-[20px] leading-7 font-bold">{title}</h2>
          {subtitle && <span className="truncate text-[13px] leading-5 text-text-tertiary">{subtitle}</span>}
        </div>
        {tabs && tabs.length > 1 && (
          <div role="tablist" aria-label={`Pages of ${title}`} className="flex gap-2">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={t.id === active} data-leave onClick={() => tab(t.id)}
                className={`h-9 border-2 px-3 text-[14px] font-bold ${t.id === active ? "border-accent bg-surface-3 text-text" : "border-line-subtle bg-surface-2 text-text-secondary hover:bg-surface-3"}`}>{t.label}</button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <button type="button" data-leave aria-label="Close (Esc)" title="Close (Esc)" onClick={() => leave(onClose)}
          className="inline-flex size-9 items-center justify-center border-2 border-line-strong bg-surface-2 text-text hover:bg-surface-3">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3 L13 13 M13 3 L3 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></svg>
        </button>
      </header>
      <div className="relative flex min-h-0 min-w-0 flex-1">{children}</div>
    </section>
    {ask && ( // outside the section, so a press on its buttons is not counted as an action on the page
      <Confirm title="Close without saving?" confirmLabel="Close and lose it" danger onCancel={() => setAsk(null)} onConfirm={() => { const go = ask; setAsk(null); go(); }}>
        <p className="m-0">You typed something here that was not sent or saved. If you close this page now, it is lost.</p>
      </Confirm>
    )}
    </>
  );
}
