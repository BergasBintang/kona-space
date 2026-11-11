// One terminal of a project (decision 80). The screen is an xterm.js terminal that lives here, not in the page, so leaving the page and coming
// back loses nothing: the page only moves the screen in and out. The shell prints a mark at each prompt (see term_init.ps1); from the marks
// and from the lines the owner sends from the input bar, the session knows which command is running and how each one ended, and it draws a small
// header (BlockChip) at the right end of each command's row.
import { Terminal as XTerm, type IDecoration, type IMarker } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { createRoot, type Root } from "react-dom/client";
import { absolute, findPaths, History, joinLines } from "../../lib/blocks";
import { parsePrompt } from "../../lib/blocks";
import { closeShell, resizeShell, shellFor, writeShell, type Shell } from "../../lib/terminal";
import { BlockChip, type ChipState } from "./BlockChip";

export type Phase = "starting" | "idle" | "running" | "ended";
export type Block = { id: number; cmd: string; t0: number; t1?: number; code?: number; stopped?: boolean; marker: IMarker; end?: IMarker; deco?: IDecoration; el?: HTMLElement; root?: Root };

const CHIP_CELLS = 36;
const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const CTRL_C_EXIT = [-1073741510, 3221225786]; // what Windows reports for a program ended with Ctrl+C

export class TermSession {
  readonly term: XTerm;
  readonly search = new SearchAddon();
  readonly history = new History();
  phase: Phase = "starting";
  cwd: string;
  branch = "";
  dirty = false;
  blocks: Block[] = [];
  onOpenFile?: (absolutePath: string) => void;
  private fit = new FitAddon();
  private host: HTMLDivElement;
  private holder: HTMLDivElement;
  private mounted = false;
  private current?: Block;
  /** The line that is running now, if one is. */
  get runningLine(): string | undefined { return this.current?.cmd; }
  private n = 0;
  private subs = new Set<() => void>();
  private disposed = false;

  constructor(readonly projectId: string, readonly folder: string, private shell: Shell) {
    this.cwd = folder;
    // the screen lives in a hidden holder until a page takes it
    this.holder = document.createElement("div");
    this.holder.style.cssText = "position:fixed;left:-20000px;top:0;width:900px;height:500px;visibility:hidden";
    this.host = document.createElement("div");
    this.host.style.cssText = "width:100%;height:100%";
    this.holder.appendChild(this.host);
    document.body.appendChild(this.holder);

    const term = new XTerm({
      fontFamily: css("--font-mono", "Consolas, monospace"), fontSize: 14, lineHeight: 1.5, cursorBlink: true, scrollback: 5000, allowProposedApi: true, disableStdin: false,
      theme: {
        background: css("--color-inset", "#fbf6ea"), foreground: css("--color-text", "#2d2218"), cursor: css("--color-text", "#2d2218"), selectionBackground: "#d6c8a8",
        scrollbarSliderBackground: "#d6c8a8", scrollbarSliderHoverBackground: "#b3a27f", scrollbarSliderActiveBackground: "#85755a",
        black: "#2d2218", red: "#a33727", green: "#2f6228", yellow: "#7a4f03", blue: "#2a4f8a", magenta: "#7a3a7a", cyan: "#1a6558", white: "#6b5b43",
        brightBlack: "#6b5b43", brightRed: "#c04a38", brightGreen: "#3d7a34", brightYellow: "#946312", brightBlue: "#3a63a8", brightMagenta: "#965096", brightCyan: "#24806f", brightWhite: "#54452f",
      },
    });
    this.term = term;
    term.loadAddon(this.fit);
    term.loadAddon(this.search);
    term.open(this.host);

    // everything the shell says goes to the screen; what the screen answers (and what is typed into it while a command runs) goes back
    shell.sink = (b) => term.write(b);
    for (const c of shell.chunks) term.write(c);
    shell.chunks = []; shell.bytes = 0;
    shell.onExit = () => this.ended();
    term.onData((d) => { void writeShell(this.shell.id, d); });
    term.parser.registerOscHandler(7777, (d) => { this.onPrompt(d); return true; });
    // when the width changes the lines are wrapped again and the screen's own markers can end up on the wrong row: the blocks are put back where their command stands
    let again: ReturnType<typeof setTimeout> | undefined;
    term.onResize(() => { clearTimeout(again); again = setTimeout(() => this.relocate(), 120); });

    // copy and paste like Windows Terminal: Ctrl+C copies while text is selected (else it stays Ctrl+C); Ctrl+V pastes while a command is running
    const copy = () => { const t = term.getSelection(); if (t) { void navigator.clipboard.writeText(t).catch(() => {}); term.clearSelection(); return true; } return false; };
    const paste = () => { if (this.phase === "idle" || this.phase === "ended") return; void navigator.clipboard.readText().then((t) => { if (t) term.paste(t); }).catch(() => {}); };
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown" || !e.ctrlKey || e.altKey) return true;
      const k = e.key.toLowerCase();
      if (k === "f") return false; // the page opens the find box
      if (k === "c" && (e.shiftKey || term.hasSelection())) { copy(); return false; }
      if (k === "v") { e.preventDefault(); paste(); return false; }
      return true;
    });
    // the window's own paste is switched off, so a paste is made in one place (above) and never twice
    term.textarea?.addEventListener("paste", (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); }, true);
    this.host.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!copy()) paste(); });

    // a file named in the output can be clicked
    term.registerLinkProvider({
      provideLinks: (y, done) => {
        const line = term.buffer.active.getLine(y - 1);
        if (!line) return done(undefined);
        const hits = findPaths(line.translateToString(true));
        if (hits.length === 0) return done(undefined);
        done(hits.map((h) => ({ range: { start: { x: h.start + 1, y }, end: { x: h.end, y } }, text: h.text, activate: () => this.onOpenFile?.(absolute(h.path, this.cwd || this.folder)) })));
      },
    });
  }

  subscribe(f: () => void) { this.subs.add(f); return () => { this.subs.delete(f); }; }
  private emit() { for (const f of this.subs) f(); }

  /** The page takes the screen. */
  mount(container: HTMLElement) {
    container.appendChild(this.host);
    this.mounted = true;
    this.fitNow();
    this.term.refresh(0, this.term.rows - 1);
  }
  /** The page lets go of the screen; it goes back to the hidden holder, still alive. */
  unmount() {
    this.mounted = false;
    if (this.disposed) return;
    this.holder.appendChild(this.host);
  }
  fitNow() {
    if (!this.mounted || this.host.offsetWidth === 0) return;
    try { this.fit.fit(); } catch { /* not shown */ }
    void resizeShell(this.shell.id, this.term.rows, this.term.cols);
  }
  /** The keyboard goes into the screen. `preventScroll`: a focus must never scroll the boxes around it (it shook the sliding sheet). */
  focus() { this.term.textarea?.focus({ preventScroll: true }); }

  /** The mark the shell prints before each prompt: the last command is over, and here is where the shell stands. */
  private onPrompt(data: string) {
    const info = parsePrompt(data);
    if (!info) return;
    this.cwd = info.cwd; this.branch = info.branch; this.dirty = info.dirty;
    const b = this.current;
    if (this.phase === "running" && b) {
      b.t1 = Date.now(); b.code = info.code; b.end = this.term.registerMarker(0);
      this.paint(b);
      this.current = undefined;
    }
    if (this.phase !== "ended") { this.phase = "idle"; this.term.options.disableStdin = true; }
    this.emit();
  }

  /** A line from the input bar: it becomes a block and goes to the shell. */
  send(line: string) {
    if (this.phase !== "idle") return;
    const text = line.replace(/\s+$/, "");
    if (!text) { void writeShell(this.shell.id, "\r"); return; }
    this.history.add(text);
    const marker = this.term.registerMarker(0);
    if (!marker) return;
    const b: Block = { id: ++this.n, cmd: text, t0: Date.now(), marker };
    this.blocks.push(b); this.current = b;
    this.decorate(b);
    this.phase = "running"; this.term.options.disableStdin = false;
    const body = text.includes("\n") ? "\x1b[200~" + text.replace(/\r?\n/g, "\r") + "\x1b[201~" : text;
    void writeShell(this.shell.id, body + "\r");
    this.emit();
  }

  /** Ctrl+C for the running command. */
  stop() {
    if (this.phase !== "running") return;
    if (this.current) this.current.stopped = true;
    void writeShell(this.shell.id, "\x03");
  }

  private decorate(b: Block) {
    const deco = this.term.registerDecoration({ marker: b.marker, anchor: "right", x: 0, width: CHIP_CELLS, height: 1 });
    if (!deco) return;
    b.deco = deco;
    deco.onRender((el) => {
      if (b.el === el) return;
      b.root?.unmount();
      el.dataset.konaChip = "1"; // index.css puts it at the right end of the row (the anchor option alone leaves it at the left)
      b.el = el; b.root = createRoot(el);
      this.paint(b);
    });
    deco.onDispose(() => { const r = b.root; b.root = undefined; b.el = undefined; if (r) setTimeout(() => r.unmount(), 0); });
  }
  private chipState(b: Block): ChipState {
    if (b.t1 === undefined) return "running";
    if (b.stopped || CTRL_C_EXIT.includes(b.code ?? 0)) return "stopped";
    return (b.code ?? 0) === 0 ? "done" : "failed";
  }
  private paint(b: Block) {
    if (!b.root) return;
    b.root.render(<BlockChip state={this.chipState(b)} code={b.code} t0={b.t0} t1={b.t1} canCopy={!b.marker.isDisposed} onStop={() => this.stop()} onCopy={() => this.copyBlock(b)} />);
  }

  /** After the screen was wrapped again: find each command's row by its text (the screen's markers can drift) and put the header and the end of the block there. */
  private relocate() {
    if (this.disposed) return;
    const buf = this.term.buffer.active;
    const cursorAbs = buf.baseY + buf.cursorY;
    const rowText = (i: number) => buf.getLine(i)?.translateToString(true) ?? "";
    const starts: { b: Block; row: number }[] = [];
    let from = 0;
    for (const b of this.blocks) {
      if (b.marker.isDisposed) continue; // it has scrolled out of the history
      const want = "> " + b.cmd.split("\n")[0].slice(0, 24);
      let row = -1;
      for (let i = from; i < buf.length; i++) if (rowText(i).startsWith(want)) { row = i; break; }
      if (row < 0) continue;
      from = row + 1;
      starts.push({ b, row });
      if (row !== b.marker.line) {
        const m = this.term.registerMarker(row - cursorAbs);
        if (m) { b.deco?.dispose(); b.marker.dispose(); b.marker = m; this.decorate(b); this.paint(b); }
      }
    }
    // a finished block ends on the row before the next command's row (or before the prompt that waits now)
    starts.forEach(({ b }, k) => {
      if (b.t1 === undefined) return;
      const next = k + 1 < starts.length ? starts[k + 1].row : this.phase === "idle" ? cursorAbs : -1;
      if (next < 0 || (b.end && !b.end.isDisposed && b.end.line === next - 1)) return;
      const m = this.term.registerMarker(next - 1 - cursorAbs);
      if (m) { b.end?.dispose(); b.end = m; }
    });
  }

  /** The output of one command, as plain text. */
  blockText(b: Block): string {
    if (b.marker.isDisposed) return "";
    const buf = this.term.buffer.active;
    const from = b.marker.line + 1;
    const to = b.end && !b.end.isDisposed ? b.end.line : buf.baseY + buf.cursorY + 1; // up to, not including
    const lines: { text: string; wrapped: boolean }[] = [];
    for (let i = from; i < to; i++) { const l = buf.getLine(i); if (l) lines.push({ text: l.translateToString(true), wrapped: l.isWrapped }); }
    return joinLines(lines);
  }
  async copyBlock(b: Block): Promise<boolean> {
    try { await navigator.clipboard.writeText(this.blockText(b)); return true; } catch { return false; }
  }
  /** Everything on the screen and above it. */
  allText(): string {
    const buf = this.term.buffer.active;
    const lines: { text: string; wrapped: boolean }[] = [];
    for (let i = 0; i < buf.length; i++) { const l = buf.getLine(i); if (l) lines.push({ text: l.translateToString(true), wrapped: l.isWrapped }); }
    return joinLines(lines);
  }
  async copyAll(): Promise<boolean> {
    try { await navigator.clipboard.writeText(this.allText()); return true; } catch { return false; }
  }
  /** A fresh screen; the shell keeps running. */
  clear() { this.term.clear(); this.blocks = this.blocks.filter((b) => !b.marker.isDisposed); this.emit(); }

  private ended() {
    if (this.disposed) return;
    this.phase = "ended"; this.term.options.disableStdin = true;
    const b = this.current;
    if (b) { b.t1 = Date.now(); this.paint(b); this.current = undefined; }
    this.term.write("\r\n\x1b[90mThe shell has ended.\x1b[0m\r\n");
    this.emit();
  }

  /** Close for good: the shell is stopped and the screen is thrown away. */
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.shell.sink = undefined; this.shell.onExit = undefined;
    sessions.delete(this.projectId);
    await closeShell(this.projectId);
    for (const b of this.blocks) b.root?.unmount();
    this.term.dispose();
    this.holder.remove();
    this.subs.clear();
  }
}

const sessions = new Map<string, TermSession>();
const starting = new Map<string, Promise<TermSession>>();

/** The project's running terminal, if it has one (it never starts one by itself). */
export const sessionOf = (projectId: string): TermSession | undefined => sessions.get(projectId);

/** Start the project's terminal. Two askers at once share one start. */
export function startSession(projectId: string, folder: string): Promise<TermSession> {
  const have = sessions.get(projectId);
  if (have) return Promise.resolve(have);
  const going = starting.get(projectId);
  if (going) return going;
  const p = (async () => {
    const shell = await shellFor(projectId, folder, 30, 120);
    const s = new TermSession(projectId, folder, shell);
    sessions.set(projectId, s);
    return s;
  })().finally(() => starting.delete(projectId));
  starting.set(projectId, p);
  return p;
}

// for the test drivers in the dev window only
if (import.meta.env.DEV) (window as unknown as { __konaSessions: typeof sessions }).__konaSessions = sessions;
