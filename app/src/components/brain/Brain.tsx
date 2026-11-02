// The Brain place (feature F7): the project's notes as a graph, with a question box that says plainly whether the answer is in it.
// Layers: the project's own notes (editable), the starter notes that ship with Kona, and Claude's memory for the project (read only).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { loadBrain, wantedAdd, wantedList, wantedRemove, type BrainData, type Project, type Wanted } from "../../lib/api";
import { Brain as Engine, type SearchResult } from "../../lib/brain/engine.ts";
import { starterNotes } from "../../lib/brain/starter.ts";
import { autoNoteOn, setAutoNote } from "../../lib/brain/summary.ts";
import type { Layer, RawNote } from "../../lib/brain/parse.ts";
import { redact } from "../../lib/brain/text.ts";
import { Button, Glyph } from "../ui";
import { Confirm } from "../Confirm";
import { Ask } from "./Ask";
import { MapView } from "./MapView";
import { Chip, LAYER_WORD, NoteView } from "./NoteView";
import { Report } from "./Report";
import { Help } from "../Help";

export type BrainTab = "map" | "notes" | "report";
/** The pages of the Brain, shown as tabs in the sheet's title bar (App.tsx holds which one is open). */
export const BRAIN_TABS: { id: BrainTab; label: string }[] = [{ id: "map", label: "Map" }, { id: "notes", label: "Notes" }, { id: "report", label: "Report" }];

export function BrainPlace({ project, tab, onTab, onAsk }: { project: Project; tab: BrainTab; onTab: (t: BrainTab) => void; onAsk: (question: string) => Promise<void> }) {
  const [data, setData] = useState<BrainData | null>(null);
  const [wanted, setWanted] = useState<Wanted[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer | "all">("all");
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<{ question: string; result: SearchResult } | null>(null);
  const [open, setOpen] = useState<string | null>(null); // a note id, "" is a new note
  const [draftTitle, setDraftTitle] = useState("");
  const [web, setWeb] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(autoNoteOn());
  // a tab pressed in the title bar leaves an open note or answer; a tab this page picks itself (after saving a note) keeps it
  const own = useRef(tab);
  const goTab = (t: BrainTab) => { own.current = t; onTab(t); };
  useEffect(() => { if (tab !== own.current) { setOpen(null); setAsked(null); } own.current = tab; }, [tab]);

  const load = useCallback(() => {
    loadBrain(project.id).then((d) => { setData(d); setError(null); }).catch((e) => setError(String(e)));
    wantedList(project.id).then(setWanted).catch(() => setWanted([]));
  }, [project.id]);
  useEffect(() => { setData(null); setOpen(null); setAsked(null); load(); }, [load]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 9000); return () => clearTimeout(t); }, [notice]);

  const raw = useMemo<RawNote[]>(() => [...(data?.notes ?? []).map((n) => ({ ...n, layer: n.layer as Layer })), ...starterNotes], [data]);
  const brain = useMemo(() => new Engine(raw), [raw]);
  const counts = useMemo(() => { const c: Record<string, number> = { project: 0, starter: 0, memory: 0 }; for (const n of brain.notes.values()) c[n.layer]++; return c; }, [brain]);
    
  const ask = async () => {
    // a question that holds a key or a password is never shown back or saved as typed
    const question = redact(q.trim()).text;
    if (!q.trim()) return;
    const result = brain.search(question);
    setAsked({ question, result }); setOpen(null);
    if (result.state === "none") wantedAdd(project.id, question).then(setWanted).catch(() => {});
  };
  const openNote = (id: string) => { setOpen(id); setAsked(null); };
  const writeNote = (title: string) => { setDraftTitle(title); setOpen(""); setAsked(null); };
  const changed = (id: string | null) => {
    // a note written for a wanted question answers it: the question comes off the list
    const answered = id && draftTitle ? wanted.find((w) => w.question === draftTitle) : undefined;
    if (answered) void wantedRemove(project.id, answered.question).then(setWanted);
    setDraftTitle("");
    load(); setOpen(id); goTab("notes"); setNotice(id ? "Saved." : "Deleted.");
  };

  const noteList = [...brain.notes.values()].filter((n) => layer === "all" || n.layer === layer).sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0) || a.title.localeCompare(b.title));
  const openNoteObj = open ? brain.notes.get(open) ?? null : null;

  let body: React.ReactNode;
  if (error) body = <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>;
  else if (data === null) body = <p className="m-0 text-text-tertiary">Reading the notes…</p>;
  else if (open !== null && (open === "" || openNoteObj)) {
    body = <NoteView key={open} projectId={project.id} brain={brain} note={open === "" ? null : openNoteObj} draftTitle={draftTitle} onOpen={openNote} onClose={() => setOpen(null)} onChanged={changed} />;
  } else if (asked) {
    body = (
      <Ask question={asked.question} result={asked.result} onOpen={(id) => openNote(id)} onClose={() => setAsked(null)} onWrite={() => writeNote(asked.question)} onWeb={() => setWeb(asked.question)}
        onAskClaude={async () => { setBusy(true); try { await onAsk(asked.question); } catch (e) { setError(String(e)); } finally { setBusy(false); } }} />
    );
  } else if (tab === "map") body = <MapView brain={brain} onOpen={openNote} />;
  else if (tab === "notes") {
    body = (
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Layer" className="flex self-start border border-line-strong p-0.5">
          {([["all", "All"], ["project", "Project"], ["starter", "Starter"], ["memory", "Claude's memory"]] as const).map(([id, word]) => (
            <button key={id} type="button" aria-pressed={layer === id} onClick={() => setLayer(id)} className={`h-9 px-3.5 text-[14px] ${layer === id ? "bg-surface-3 font-bold text-text" : "text-text-secondary hover:text-text"}`}>{word}{id !== "all" ? ` (${counts[id]})` : ""}</button>
          ))}
        </div>
        {data?.memory_dir === null && layer === "memory" && <p className="m-0 text-[14px] leading-5 text-text-tertiary">Claude has no memory folder for this project yet.</p>}
        {noteList.map((n) => (
          <button key={n.id} type="button" onClick={() => openNote(n.id)} className="flex items-start justify-between gap-4 border border-line-subtle bg-surface-1 p-4 text-left hover:bg-surface-2">
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate text-[15px] leading-6 font-bold">{n.title}</span>
              <span className="line-clamp-2 text-[13px] leading-5 text-text-secondary">{n.sections[0]?.text.split("\n").map((l) => l.trim()).find((l) => l && !/^#/.test(l))?.replace(/[*`]/g, "")}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1.5"><Chip>{LAYER_WORD[n.layer]}</Chip><span className="text-[12px] text-text-tertiary">{brain.outgoing(n.id).length} out · {brain.incoming(n.id).length} in</span></span>
          </button>
        ))}
      </div>
    );
  } else body = <Report brain={brain} wanted={wanted} onOpen={openNote} onWrite={writeNote} onDrop={(question) => { void wantedRemove(project.id, question).then(setWanted); }} />;

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-line-subtle px-8 pt-4 pb-4">
        <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); void ask(); }} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the brain, for example: what is a worktree?" aria-label="Ask the brain" className="h-12 min-w-0 flex-1 border border-line-strong bg-inset px-4 text-[15px] text-text placeholder:text-text-tertiary" />
          <Button type="submit" disabled={!q.trim() || data === null}>Ask</Button>
          <Button variant="quiet" onClick={() => writeNote("")}>New note</Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="m-0 text-[14px] leading-5 text-text-secondary">{project.name}: {counts.project} of your notes, {counts.starter} starter notes{data?.memory_dir ? `, ${counts.memory} from Claude's memory` : ""}.</p>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); setAutoNote(e.target.checked); }} className="h-4 w-4 accent-[var(--color-accent)]" />
              <span className="font-bold">Write a note when a session ends</span>
            </label>
            <Help title="Write a note when a session ends"><p className="m-0">One cheap Haiku call per session, using your plan. The conversation is cleaned of secrets first.</p><p className="m-0">You can also press Write a note in any session.</p></Help>
          </div>
        </div>
        {notice && <div role="status" className="flex items-start gap-2.5 border border-line-subtle bg-surface-2 px-4 py-3 text-[14px] leading-5"><Glyph state="done" size={16} /> {notice}</div>}
        {busy && <p className="m-0 text-[13px] text-text-tertiary">Starting a session…</p>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pt-6 pb-10">{body}</div>

      {web && (
        <Confirm title="Search the web for this?" confirmLabel="Open my browser" onConfirm={() => { void openUrl(`https://duckduckgo.com/?q=${encodeURIComponent(web)}`); setWeb(null); }} onCancel={() => setWeb(null)}>
          <p className="m-0">Your browser opens a search with exactly these words. They are sent to the search site, so leave out anything private.</p>
          <p className="m-0 bg-inset px-3 py-2 text-[14px] leading-5 text-text">{web}</p>
        </Confirm>
      )}
    </main>
  );
}
