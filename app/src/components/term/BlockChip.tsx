// The small header of one command in the terminal: how it is going or how it ended, how long it took, and Stop (while it runs) or Copy
// (the text of its output). It sits at the right end of the row where the command was typed.
import { useEffect, useState } from "react";
import { fmtDuration } from "../../lib/blocks";
import { Glyph, type GlyphState } from "../ui";

export type ChipState = "running" | "done" | "failed" | "stopped";
export type ChipProps = { state: ChipState; code?: number; t0: number; t1?: number; canCopy: boolean; onStop: () => void; onCopy: () => Promise<boolean> };

const GLYPH: Record<ChipState, GlyphState> = { running: "live", done: "done", failed: "left", stopped: "stopped" };

export function BlockChip(p: ChipProps) {
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (p.state !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [p.state]);
  const word = p.state === "running" ? "Running" : p.state === "done" ? "Done" : p.state === "stopped" ? "Stopped" : `Failed, exit ${p.code}`;
  const act = "h-full px-2 text-[12px] font-bold text-text-secondary hover:bg-surface-3 active:bg-surface-2";
  return (
    <div className="flex h-full items-center justify-end gap-3 bg-inset pl-3 text-[12px] leading-none text-text-secondary" data-block-state={p.state}>
      <span className={`flex items-center gap-1.5 font-bold ${p.state === "failed" ? "text-state-left" : ""}`}><Glyph state={GLYPH[p.state]} size={16} />{word}</span>
      <span className="font-mono text-text-tertiary">{fmtDuration((p.t1 ?? now) - p.t0)}</span>
      {p.state === "running"
        ? <button type="button" className={act} onClick={p.onStop}>Stop</button>
        : p.canCopy && <button type="button" className={act} onClick={() => { void p.onCopy().then((ok) => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }); }}>{copied ? "Copied" : "Copy"}</button>}
    </div>
  );
}
