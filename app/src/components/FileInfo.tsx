// What the file reader knows about the open file, in a small dialog: where it is, how big, when it changed, what kind. It only reads; Copy path and Show in Explorer are the two things to do with it.
// Esc, Close or a click outside closes it, Tab stays inside it, and the focus goes back to the button that opened it (the same manners as Help).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { humanSize, type Entry } from "../lib/api";
import { Button } from "./ui";

const KINDS: Record<string, string> = {
  md: "Markdown note", markdown: "Markdown note", html: "Web page", htm: "Web page", json: "JSON data", txt: "Plain text", css: "Style sheet", pdf: "PDF document",
  png: "Picture", jpg: "Picture", jpeg: "Picture", gif: "Picture", webp: "Picture", bmp: "Picture", ico: "Picture", svg: "Picture",
};
export const kindOf = (name: string) => { const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : ""; return KINDS[ext] ?? (ext ? `${ext.toUpperCase()} file` : "File"); };

export function FileInfo({ entry, rel, onClose }: { entry: Entry; rel: string; onClose: () => void }) {
  const closer = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [said, setSaid] = useState<"copied" | "failed" | null>(null);
  useEffect(() => { closer.current?.focus(); return () => window.clearTimeout(timer.current); }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(entry.path); setSaid("copied"); } catch { setSaid("failed"); }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaid(null), 1800);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key === "Tab") { // three buttons are all there is to reach: keep the focus among them
      const all = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      const i = all.indexOf(document.activeElement as HTMLElement);
      const next = all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length];
      e.preventDefault(); next?.focus();
    }
  };
  const rows: [string, string][] = [
    ["Where", rel],
    ["On this PC", entry.path],
    ["Size", humanSize(entry.size)],
    ["Changed", entry.modified ? new Date(entry.modified * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not known"],
    ["Kind", kindOf(entry.name)],
  ];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`About ${entry.name}`} onKeyDown={onKey} className="flex max-h-full w-full max-w-[560px] flex-col gap-4 overflow-y-auto px-card px-shadow p-3">
        <h2 className="m-0 truncate text-[20px] leading-7 font-bold">{entry.name}</h2>
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-[15px] leading-6">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-tertiary">{k}</dt>
              <dd className={`m-0 break-all text-text ${k === "Where" || k === "On this PC" ? "font-mono text-[13px] leading-6" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <Button variant="quiet" onClick={() => void copy()} aria-live="polite">{said === "copied" ? "Copied" : said === "failed" ? "Could not copy" : "Copy path"}</Button>
          <Button variant="quiet" onClick={() => void revealItemInDir(entry.path)}>Show in Explorer</Button>
          <Button ref={closer} variant="quiet" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
