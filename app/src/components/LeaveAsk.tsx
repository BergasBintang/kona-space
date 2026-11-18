// The question before a page that would lose something is left (decision 95): minimize it (it stays alive in the tray), close it (it ends), or cancel. The safe button, Cancel, has the focus,
// Esc cancels, and Tab stays inside the dialog, as in Confirm.
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./ui";

export function LeaveAsk({ title, children, closeLabel, canMinimize, onMinimize, onClose, onCancel }: {
  title: string; children: ReactNode; closeLabel: string; canMinimize: boolean; onMinimize: () => void; onClose: () => void; onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancel.current?.focus(); }, []);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onCancel(); return; }
    if (e.key !== "Tab" || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKey} className="flex w-full max-w-[520px] flex-col gap-4 px-card px-shadow p-3">
        <h2 className="m-0 text-[20px] leading-7 font-bold">{title}</h2>
        <div className="flex flex-col gap-3 text-[15px] leading-6 text-text-secondary">{children}</div>
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <Button ref={cancel} variant="quiet" onClick={onCancel}>Cancel</Button>
          {canMinimize && <Button variant="primary" onClick={onMinimize}>Minimize</Button>}
          <Button variant="danger" onClick={onClose}>{closeLabel}</Button>
        </div>
      </div>
    </div>
  );
}
