// The Terminal view (decision 80). It does not start a shell by itself: opening it only shows a Start button, because a shell costs memory
// (about 70 MB). Once started, a project's terminal keeps running when the page is left (see term/session.tsx).
// Layout: a header with the state, the shell's folder and Git's branch; the screen, where each command has its own small header; the script
// buttons of the project (and the owner's own); and the input bar. While a command runs, the keyboard goes straight to the screen (so ssh, a
// password prompt or vim work); when it ends, the keyboard is the bar's again.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { readFile, type Project } from "../lib/api";
import { buildButtons, composerScripts, scriptsOf, shortPath, type ScriptButton } from "../lib/blocks";
import { loadButtons, saveButtons, type OwnButton } from "../lib/terminal";
import { sessionOf, startSession, type Phase, type TermSession } from "./term/session";
import { AddButtonDialog, ScriptButtons } from "./term/ScriptButtons";
import { Button, Glyph, type GlyphState } from "./ui";
import { Confirm } from "./Confirm";
import { Help } from "./Help";

const PHASE: Record<Phase | "none", { glyph: GlyphState; word: string }> = {
  none: { glyph: "idle", word: "Not started" },
  starting: { glyph: "idle", word: "Starting" },
  idle: { glyph: "live", word: "Ready" },
  running: { glyph: "live", word: "Running" },
  ended: { glyph: "stopped", word: "Ended" },
};
const FIND_COLORS = { matchBackground: "#e8d9a8", matchOverviewRuler: "#e8d9a8", activeMatchBackground: "#f0b429", activeMatchColorOverviewRuler: "#f0b429" };

export function Terminal({ project, visible, onOpenFile }: { project: Project; visible: boolean; onOpenFile: (absolutePath: string) => void }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [session, setSession] = useState<TermSession | undefined>(() => sessionOf(project.id));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ npm: string[]; composer: string[] }>({ npm: [], composer: [] });
  const [own, setOwn] = useState<OwnButton[]>([]);
  const [adding, setAdding] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLTextAreaElement>(null);
  const findBox = useRef<HTMLInputElement>(null);
  const openFile = useRef(onOpenFile);
  openFile.current = onOpenFile;

  useEffect(() => { setSession(sessionOf(project.id)); setText(""); }, [project.id]);
  useEffect(() => session?.subscribe(redraw), [session]);
  // the scripts the project's own files list, and the buttons the owner added
  useEffect(() => {
    let live = true;
    const read = (name: string) => readFile(`${project.folder}\\${name}`).then((f) => (f.kind === "text" ? f.text : "")).catch(() => "");
    void Promise.all([read("package.json"), read("composer.json")]).then(([p, c]) => { if (live) setFiles({ npm: scriptsOf(p), composer: composerScripts(c) }); });
    loadButtons(project.id).then((l) => { if (live) setOwn(l); }).catch(() => { if (live) setOwn([]); });
    return () => { live = false; };
  }, [project.id, project.folder]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);
  const buttons = useMemo(() => buildButtons(own, files.npm, files.composer), [own, files]);

  // the screen belongs to the session; the page only holds it while it is shown
  useEffect(() => {
    const el = box.current;
    if (!session || !el) return;
    session.mount(el);
    session.onOpenFile = (p) => openFile.current(p);
    const ro = new ResizeObserver(() => session.fitNow());
    ro.observe(el);
    return () => { ro.disconnect(); session.onOpenFile = undefined; session.unmount(); };
  }, [session]);

  const phase: Phase | "none" = session ? session.phase : "none";
  // the keyboard: the bar when a command can be typed, the screen while one runs
  useEffect(() => {
    if (!session || !visible) return;
    const t = setTimeout(() => { session.fitNow(); if (phase === "running") session.focus(); else if (phase === "idle") bar.current?.focus({ preventScroll: true }); }, 0);
    return () => clearTimeout(t);
  }, [session, visible, phase]);
  useEffect(() => { if (finding) findBox.current?.focus(); }, [finding]);

  const start = async () => {
    setStarting(true); setError(null);
    try { setSession(await startSession(project.id, project.folder)); } catch (e) { setError(String(e)); } finally { setStarting(false); }
  };
  const close = async () => { const s = session; setSession(undefined); setFinding(false); setText(""); setConfirmClose(false); if (s) await s.dispose(); };
  const askClose = () => { if (session?.phase === "running") setConfirmClose(true); else void close(); };

  const saveOwn = async (next: OwnButton[]) => {
    const before = own;
    setOwn(next);
    try { await saveButtons(project.id, next); } catch (e) { setOwn(before); setNotice(String(e)); }
  };
  const pick = (b: ScriptButton) => { setText(b.line); bar.current?.focus({ preventScroll: true }); };

  const send = () => { if (!session || session.phase !== "idle") return; const line = text; setText(""); session.send(line); };
  const onBarKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!session) return;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); return; }
    if (e.key === "Escape" && text) { e.preventDefault(); setText(""); return; }
    const el = e.currentTarget;
    if (e.key === "ArrowUp" && !e.shiftKey && el.selectionStart === el.selectionEnd && !text.slice(0, el.selectionStart).includes("\n")) {
      const prev = session.history.prev(text); if (prev !== null) { e.preventDefault(); setText(prev); }
    } else if (e.key === "ArrowDown" && !e.shiftKey && el.selectionStart === el.selectionEnd && !text.slice(el.selectionEnd).includes("\n")) {
      const next = session.history.next(); if (next !== null) { e.preventDefault(); setText(next); }
    }
  };
  const find = (back = false) => {
    if (!session || !query) return;
    const o = { decorations: FIND_COLORS };
    if (back) session.search.findPrevious(query, o); else session.search.findNext(query, o);
  };
  const copyAll = async () => { if (session && await session.copyAll()) setNotice("Copied"); };

  const rows = useMemo(() => Math.min(6, Math.max(1, text.split("\n").length)), [text]);
  const state = PHASE[phase];
  const where = session ? shortPath(session.cwd, project.folder) : "";
  const running = phase === "running", idle = phase === "idle";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-8 pt-6 pb-8"
      onKeyDown={(e) => { if (session && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); setFinding(true); } }}>
      <div className="relative flex min-h-0 flex-1 flex-col border border-line-subtle bg-inset">
        <div className="flex shrink-0 items-center gap-4 border-b border-line-subtle bg-surface-2 px-4 py-2">
          <span className="flex shrink-0 items-center gap-2 text-[14px] leading-5 font-bold"><Glyph state={state.glyph} size={16} />{state.word}</span>
          {session
            ? <span className="flex min-w-0 flex-1 items-center gap-3 font-mono text-[12px] leading-5 text-text-tertiary">
                <span className="truncate" title={session.cwd}>{where === "." ? project.name : where}</span>
                {session.branch && <span className="shrink-0 text-text-secondary">{session.branch}{session.dirty ? " · changed" : ""}</span>}
              </span>
            : <span className="flex min-w-0 flex-1 items-center gap-2"><span className="truncate font-mono text-[12px] leading-5 text-text-tertiary" title={project.folder}>{project.folder}</span>
                <Help title="Terminal"><p className="m-0">A terminal is a real PowerShell in this project's folder, for git, npm, ssh and the like.</p><p className="m-0">It starts only when you press Start, and uses about 70 MB until you close it. It keeps running while you look at other pages, and stops when Kona closes.</p></Help></span>}
          {notice && <span role="status" className="shrink-0 text-[13px] text-text-secondary">{notice}</span>}
          {session && (
            <span className="flex shrink-0 items-center gap-2">
              <Button variant="quiet" small onClick={() => void copyAll()}>Copy all</Button>
              <Button variant="quiet" small onClick={() => session.clear()}>Clear</Button>
              <span className="mx-1 h-6 w-px bg-line-strong" aria-hidden />
              {phase === "ended" && <Button variant="primary" small onClick={() => void close().then(start)}>Start again</Button>}
              <Button variant="quiet" small onClick={askClose}>Close</Button>
            </span>
          )}
        </div>

        {!session && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
            <Button variant="primary" disabled={starting} onClick={() => void start()}>{starting ? "Starting…" : "Start terminal"}</Button>
            {error && <p role="alert" className="m-0 max-w-[520px] text-center text-[14px] leading-5 text-state-left">{error}</p>}
          </div>
        )}

        {session && (
          <>
            <div className="relative min-h-0 flex-1 overflow-hidden p-4"
              onKeyDownCapture={(e) => { if (phase === "idle" && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) bar.current?.focus({ preventScroll: true }); }}>
              <div ref={box} className="h-full w-full" aria-label="Terminal" />
              {finding && (
                <div className="absolute top-3 right-6 z-20 flex items-center gap-2 border border-line-strong bg-surface-2 p-2 shadow-sm" role="search">
                  <input ref={findBox} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find in the terminal" placeholder="Find" data-autosaves
                    className="h-8 w-56 border border-line-subtle bg-inset px-2 font-mono text-[13px] outline-none focus:border-accent"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); find(e.shiftKey); } else if (e.key === "Escape") { e.preventDefault(); setFinding(false); session.search.clearDecorations(); if (idle) bar.current?.focus({ preventScroll: true }); else session.focus(); } }} />
                  <Button variant="ghost" tiny onClick={() => find(true)}>Previous</Button>
                  <Button variant="ghost" tiny onClick={() => find(false)}>Next</Button>
                  <Button variant="ghost" tiny onClick={() => { setFinding(false); session.search.clearDecorations(); }}>Close</Button>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-line-subtle bg-surface-2 px-3 py-2">
              <ScriptButtons items={buttons} disabled={!idle} onPick={pick} onAdd={() => setAdding(true)} onRemove={(b) => void saveOwn(own.filter((o) => o.name !== b.name))} />
              <textarea ref={bar} value={text} rows={rows} disabled={!idle} data-autosaves aria-label="Command" spellCheck={false} autoComplete="off"
                placeholder={running ? "A command is running. Type into the screen above." : phase === "starting" ? "Starting…" : phase === "ended" ? "" : "Type a command"}
                onChange={(e) => setText(e.target.value)} onKeyDown={onBarKey}
                className="w-full resize-none border border-line-subtle bg-inset px-3 py-2 font-mono text-[14px] leading-5 outline-none focus:border-accent disabled:bg-surface-3 disabled:text-text-disabled" />
            </div>
          </>
        )}
      </div>

      {confirmClose && session && (
        <Confirm title="Close the terminal?" confirmLabel="Close it" danger onConfirm={() => void close()} onCancel={() => setConfirmClose(false)}>
          <p className="m-0">A command is still running:</p>
          <p className="m-0 break-all bg-inset px-3 py-2 font-mono text-[13px] leading-5 text-text">{session.runningLine ?? "(a command)"}</p>
          <p className="m-0">Closing stops it and everything it started. Unsaved work in it is lost.</p>
        </Confirm>
      )}
      {adding && <AddButtonDialog taken={own.map((o) => o.name)} onCancel={() => setAdding(false)} onSave={(name, line) => { setAdding(false); void saveOwn([...own, { name, line }]); }} />}
    </div>
  );
}
