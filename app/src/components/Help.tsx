// The "?" beside a heading. Kona keeps explanations off the page: pressing the "?" opens the explanation in a small dialog. Esc, the Close
// button or a click outside closes it, Tab stays inside it, and the focus goes back to the "?". Put it next to the heading, never inside a
// label or a button (a click inside the dialog must not reach them).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Help({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); opener.current?.focus(); };
  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(true)} aria-label={`About ${title}`} aria-haspopup="dialog" title="What is this?"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center border border-line-strong text-[13px] leading-none font-bold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text">?</button>
      {open && <HelpDialog title={title} onClose={close}>{children}</HelpDialog>}
    </>
  );
}

function HelpDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  useEffect(() => { closer.current?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key === "Tab") { e.preventDefault(); closer.current?.focus(); } // the Close button is the only thing to reach
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKey}
        className="flex max-h-full w-full max-w-[520px] flex-col gap-4 overflow-y-auto px-card px-shadow p-3">
        <h2 className="m-0 text-[20px] leading-7 font-bold">{title}</h2>
        <div className="flex flex-col gap-3 text-[15px] leading-6 text-text-secondary">{children}</div>
        <div className="flex justify-end pt-1"><button ref={closer} type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center border border-line-strong px-5 text-[15px] font-bold text-text hover:bg-surface-3">Close</button></div>
      </div>
    </div>,
    document.body,
  );
}
