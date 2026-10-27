// The confirmation dialog: one question, a plain explanation of what will happen, and two buttons. The safe button (Cancel) has the
// focus when it opens, Esc cancels, and Tab stays inside the dialog. Used before anything that changes the owner's files, branches or processes.
import { useEffect, useRef, type ReactNode } from "react";
import { Button, Glyph } from "./ui";

export function Confirm({ title, children, confirmLabel, danger = false, busy = false, disabled = false, error, onConfirm, onCancel }: {
  title: string; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; disabled?: boolean; error?: string | null; onConfirm: () => void; onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancel.current?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onCancel(); return; }
    if (e.key !== "Tab" || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")];
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKey}
        className="flex w-full max-w-[520px] flex-col gap-4 rounded-card border border-line-strong bg-surface-2 p-6 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]">
        <h2 className="m-0 text-[20px] leading-7 font-bold">{title}</h2>
        <div className="flex flex-col gap-3 text-[15px] leading-6 text-text-secondary">{children}</div>
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex justify-end gap-3 pt-1">
          <button ref={cancel} type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center rounded-control border border-line-strong px-5 text-[15px] font-bold text-text hover:bg-surface-3">Cancel</button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={disabled || busy}>{busy ? "Working…" : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
