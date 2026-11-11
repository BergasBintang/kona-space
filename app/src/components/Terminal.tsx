// The Terminal tab (decision 80): a real shell in the project's folder, drawn by xterm.js. This first version is the plain
// terminal. The type bar with suggestions comes next.
import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { Project } from "../lib/api";
import { closeShell, resizeShell, shellFor, writeShell, type Shell } from "../lib/terminal";
import { Button, Glyph } from "./ui";

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function Terminal({ project, visible }: { project: Project; visible: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [ended, setEnded] = useState(false);
  const [round, setRound] = useState(0); // a new number starts a new shell

  useEffect(() => {
    const el = box.current; if (!el) return;
    let dead = false;
    const term = new XTerm({
      fontFamily: css("--font-mono", "Consolas, monospace"), fontSize: 14, lineHeight: 1.25, cursorBlink: true, scrollback: 5000, allowProposedApi: false,
      theme: {
        background: css("--color-inset", "#fbf6ea"), foreground: css("--color-text", "#2d2218"), cursor: css("--color-text", "#2d2218"), selectionBackground: "#d6c8a8", scrollbarSliderBackground: "#d6c8a8", scrollbarSliderHoverBackground: "#b3a27f", scrollbarSliderActiveBackground: "#85755a",
        black: "#2d2218", red: "#a33727", green: "#2f6228", yellow: "#7a4f03", blue: "#2a4f8a", magenta: "#7a3a7a", cyan: "#1a6558", white: "#6b5b43",
        brightBlack: "#6b5b43", brightRed: "#c04a38", brightGreen: "#3d7a34", brightYellow: "#946312", brightBlue: "#3a63a8", brightMagenta: "#965096", brightCyan: "#24806f", brightWhite: "#54452f",
      },
    });
    const fit = new FitAddon(); fitRef.current = fit;
    term.loadAddon(fit); term.open(el); fit.fit();
    const endedLine = () => term.write("\r\n\x1b[90mThe shell has ended.\x1b[0m\r\n");
    // Copy and paste like Windows Terminal: Ctrl+C copies while text is selected (else it stays Ctrl+C), Ctrl+V and Ctrl+Shift+V paste,
    // right-click copies a selection or pastes.
    const copy = () => { const t = term.getSelection(); if (t) { void navigator.clipboard.writeText(t).catch(() => {}); term.clearSelection(); return true; } return false; };
    const paste = () => { void navigator.clipboard.readText().then((t) => { if (t) term.paste(t); }).catch(() => {}); };
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown" || !e.ctrlKey || e.altKey) return true;
      const k = e.key.toLowerCase();
      if (k === "c" && (e.shiftKey || term.hasSelection())) { copy(); return false; }
      if (k === "v") { e.preventDefault(); paste(); return false; } // preventDefault: the window must not paste it a second time
      return true;
    });
    // the window's own paste is switched off, so a paste is made in one place (above) and never twice
    const stopNative = (ev: Event) => { ev.preventDefault(); ev.stopImmediatePropagation(); };
    term.textarea?.addEventListener("paste", stopNative, true);
    const onContext = (e: MouseEvent) => { e.preventDefault(); if (!copy()) paste(); };
    el.addEventListener("contextmenu", onContext);
    let id = "";
    let shell: Shell | undefined;
    const sub = term.onData((d) => { if (id) void writeShell(id, d); });
    (async () => {
      const sh = await shellFor(project.id, project.folder, term.rows, term.cols);
      if (dead) return;
      id = sh.id; shell = sh;
      for (const c of sh.chunks) term.write(c);
      sh.chunks = []; sh.bytes = 0;
      sh.sink = (b) => term.write(b);
      sh.onExit = () => { setEnded(true); endedLine(); };
      if (sh.exited) { setEnded(true); endedLine(); }
      void resizeShell(id, term.rows, term.cols);
    })().catch((e) => term.write(`\r\nCould not start the terminal: ${String(e)}\r\n`));
    const ro = new ResizeObserver(() => { if (el.offsetWidth > 0) { try { fit.fit(); } catch { /* hidden */ } if (id) void resizeShell(id, term.rows, term.cols); } });
    ro.observe(el);
    return () => {
      dead = true; ro.disconnect(); sub.dispose(); el.removeEventListener("contextmenu", onContext); term.textarea?.removeEventListener("paste", stopNative, true);
      if (shell) { shell.sink = undefined; shell.onExit = undefined; } // the shell keeps running; only its screen goes
      term.dispose();
    };
  }, [project.id, project.folder, round]);

  useEffect(() => { if (visible) { setTimeout(() => { try { fitRef.current?.fit(); } catch { /* */ } }, 0); } }, [visible]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-8 pt-6 pb-8">
      <div className="flex min-h-0 flex-1 flex-col border border-line-subtle bg-inset">
        <div className="flex shrink-0 items-center gap-4 border-b border-line-subtle bg-surface-2 px-4 py-2">
          <span className="flex shrink-0 items-center gap-2 text-[14px] leading-5 font-bold"><Glyph state={ended ? "stopped" : "live"} size={16} />{ended ? "Ended" : "Running"}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] leading-5 text-text-tertiary" title={project.folder}>{project.folder}</span>
          <span className="shrink-0 font-mono text-[12px] leading-5 text-text-tertiary">PowerShell</span>
          <Button variant={ended ? "primary" : "quiet"} small onClick={() => { void closeShell(project.id).then(() => { setEnded(false); setRound((n) => n + 1); }); }}>{ended ? "Start again" : "Restart"}</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4"><div ref={box} className="h-full w-full" aria-label="Terminal" /></div>
      </div>
    </div>
  );
}
