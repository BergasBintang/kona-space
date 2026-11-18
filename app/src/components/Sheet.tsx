// The sheet: a page of Kona that slides up from below over the whole office, from the top bar down (the top bar's own line is its upper edge). Two ways to put it away (decision 95):
// the X closes it (it ends), the low bar MINIMIZES it (it stays alive behind the tray under the top bar, with its draft, its scroll and whatever it runs). Esc is the X.
// If the page would lose something when it is left (text the owner typed that nothing has taken yet, see lib/unsaved.ts, or something the page says is running, see lib/pagebusy.ts), leaving it
// first asks: minimize, close or cancel. A room with two pages shows them as tabs. A minimized sheet stays mounted but out of sight, and does not react to keys.
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Confirm } from "./Confirm";
import { LeaveAsk } from "./LeaveAsk";
import { Typed } from "../lib/unsaved";
import { PageActive } from "../lib/pageactive";
import { IconButton } from "./Icon";
import { Button } from "./ui";

export type How = "close" | "minimize";
/** What the rest of the app can ask a sheet: do the move, but ask first if the page would lose something. `go` is told what the owner chose (close, or minimize first). */
export type Guard = { leave: (go: (how: How) => void, canMinimize?: boolean) => void };

// a box that holds a draft: a text area or a one-line text box, but not a list's search box or a filter
const isText = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && (el.type === "text" || el.type === "" || el.type === "url" || el.type === "email" || el.type === "password")
    && el.getAttribute("role") !== "combobox" && !/search|filter/i.test(el.getAttribute("aria-label") ?? el.placeholder));

export function Sheet({ title, subtitle, tabs, active, onTab, onClose, onMinimize, pageKey, hidden = false, busy, registry, guard, keepDraftOnTab = false, children }: {
  title: string; subtitle?: string; tabs?: { id: string; label: string }[]; active?: string; onTab?: (id: string) => void; onClose: () => void; /** put the page away, alive */ onMinimize: () => void;
  /** which page this is, so the app can ask it (also while it is minimized) */ pageKey: string; /** minimized: mounted, out of sight, deaf to keys */ hidden?: boolean;
  /** why leaving this page would lose something besides typed text, or null */ busy?: () => string | null;
  registry: MutableRefObject<Record<string, Guard | null>>; guard: MutableRefObject<Guard | null>;
  /** the tabs are views of one thing (a person's chat, skills and setup), all kept alive, so changing tab never throws a draft away and never asks */
  keepDraftOnTab?: boolean; children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const typed = useRef(new Typed());
  const [ask, setAsk] = useState<(() => void) | null>(null); // changing tab with unsaved text
  const [askLeave, setAskLeave] = useState<{ go: (how: How) => void; text: boolean; why: string | null; canMinimize: boolean } | null>(null);

  const unsaved = () => typed.current.unsaved([...(root.current?.querySelectorAll("textarea, input") ?? [])].filter(isText).filter((e) => !e.hasAttribute("data-autosaves"))); // a field that saves itself when the owner leaves it is not counted
  const leave = (go: (how: How) => void, canMinimize = !hidden) => {
    const text = unsaved();
    const why = busy?.() ?? null;
    if (text || why) setAskLeave({ go, text, why, canMinimize }); else go("close");
  };
  const latest = useRef({ leave, onClose, onMinimize, hidden });
  latest.current = { leave, onClose, onMinimize, hidden };
  const goAway = () => leave((how) => (how === "minimize" ? latest.current.onMinimize() : latest.current.onClose()));

  useEffect(() => {
    const g: Guard = { leave: (go, can) => latest.current.leave(go, can) };
    registry.current[pageKey] = g;
    return () => { if (registry.current[pageKey] === g) registry.current[pageKey] = null; };
  }, [registry, pageKey]);
  useEffect(() => { // the open sheet is the one the rest of the app asks first
    if (hidden) return;
    const g: Guard = { leave: (go, can) => latest.current.leave(go, can) };
    guard.current = g;
    return () => { if (guard.current === g) guard.current = null; };
  }, [guard, hidden]);
  useEffect(() => { typed.current = new Typed(); }, [title]); // another page: what was typed on the last one no longer counts
  useEffect(() => { // Esc closes the sheet, unless something inside took it (a list that was open, a dialog)
    if (hidden) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) goAway(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [hidden]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // the keyboard starts inside the sheet, and goes back to the room it came from
    if (hidden) return;
    const was = document.activeElement as HTMLElement | SVGElement | null;
    root.current?.focus({ preventScroll: true }); // without this the browser scrolls the whole app up to show the sheet while it is still sliding in from below
    return () => { if (was && document.contains(was)) was.focus?.({ preventScroll: true }); };
  }, [hidden]);

  const tab = (id: string) => { if (id === active) return; if (keepDraftOnTab) onTab?.(id); else if (unsaved()) setAsk(() => () => onTab?.(id)); else onTab?.(id); };

  return (
    <PageActive.Provider value={!hidden}>
    <section ref={root} data-sheet data-page={pageKey} hidden={hidden} tabIndex={-1} aria-label={title}
      onInput={(e) => { if (isText(e.target as Element)) typed.current.typed(e.target); }}
      onClickCapture={(e) => { const b = (e.target as Element).closest("button"); if (b && !b.hasAttribute("data-leave")) typed.current.acted(); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && isText(e.target as Element)) typed.current.acted(); }}
      className={`kona-sheet absolute inset-0 z-10 flex-col bg-ground outline-none ${hidden ? "hidden" : "flex"}`}>
      <header className="flex min-h-14 shrink-0 items-center gap-4 border-b border-line-subtle bg-surface-1 px-8">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="m-0 text-[20px] leading-7 font-bold">{title}</h2>
          {subtitle && <span className="truncate text-[13px] leading-5 text-text-tertiary">{subtitle}</span>}
        </div>
        {tabs && tabs.length > 1 && (
          <div role="tablist" aria-label={`Pages of ${title}`} className="flex gap-2">
            {tabs.map((t) => (
              <Button key={t.id} variant="quiet" small role="tab" aria-selected={t.id === active} on={t.id === active} data-leave onClick={() => tab(t.id)}>{t.label}</Button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <IconButton icon="minimize" label="Minimize (keeps it alive in the tray)" data-leave onClick={onMinimize} />
        <IconButton icon="close" label="Close (Esc)" data-leave onClick={goAway} />
      </header>
      <div className="relative flex min-h-0 min-w-0 flex-1">{children}</div>
    </section>
    {ask && ( // outside the section, so a press on its buttons is not counted as an action on the page
      <Confirm title="Close without saving?" confirmLabel="Close and lose it" danger onCancel={() => setAsk(null)} onConfirm={() => { const go = ask; setAsk(null); go(); }}>
        <p className="m-0">You typed something here that was not sent or saved. If you change page now, it is lost.</p>
      </Confirm>
    )}
    {askLeave && (
      <LeaveAsk title={askLeave.text ? "Close without saving?" : "Close this page?"} closeLabel={askLeave.text ? "Close and lose it" : "Close it"} canMinimize={askLeave.canMinimize}
        onCancel={() => setAskLeave(null)} onMinimize={() => { const g = askLeave.go; setAskLeave(null); g("minimize"); }} onClose={() => { const g = askLeave.go; setAskLeave(null); g("close"); }}>
        {askLeave.text && <p className="m-0">You typed something here that was not sent or saved. If you close this page, it is lost.</p>}
        {askLeave.why && <p className="m-0">{askLeave.why}</p>}
        {askLeave.canMinimize && <p className="m-0">Minimize keeps the page just as it is, in the tray under the top bar.</p>}
      </LeaveAsk>
    )}
    </PageActive.Provider>
  );
}
