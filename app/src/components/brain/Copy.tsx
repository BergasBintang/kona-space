// A quiet "Copy" for a block of text (a code block, a table, a diagram's source). It says "Copied" for a moment, or says it could not.
import { useEffect, useRef, useState } from "react";

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [said, setSaid] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setSaid("copied"); } catch { setSaid("failed"); }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaid(null), 1800);
  };
  return (
    <button type="button" onClick={copy} aria-live="polite" className={`font-bold text-text-secondary hover:text-text ${className}`}>
      {said === "copied" ? "Copied" : said === "failed" ? "Could not copy" : label}
    </button>
  );
}

/** Text in a fixed-width block, with Copy at its top right corner. */
export function CodeBlock({ text }: { text: string }) {
  return (
    <div className="relative">
      <pre className="m-0 overflow-x-auto bg-inset p-3 pr-16 font-mono text-[13px] leading-5 text-text-secondary">{text}</pre>
      <CopyButton text={text} className="absolute top-1.5 right-2 bg-inset px-1 text-[13px] leading-5" />
    </div>
  );
}
