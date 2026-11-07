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
import { LAYER_WORD, NoteView } from "./NoteView";
import { Select } from "../pick";
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
  const [dirty, setDirty] = useState(false); // the open note has text typed that is not saved
  const [leave, setLeave] = useState<(() => void) | null>(null); // what the owner asked for while a note had unsaved text: done only after they agree
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
    if (result.state === "none") wantedAdd(project.id, question).then(setWanted).catch(() => {});
    leaving(() => { setAsked({ question, result }); setOpen(null); });
  };
  /** do this, but first ask when the open note has text that is not saved */
  const leaving = (go: () => void) => { if (dirty) setLeave(() => go); else go(); };
  // opening a note, or starting one, always shows it on the Notes page: the list stays on the left and the note is on the right
  const openNote = (id: string) => leaving(() => { setOpen(id); setAsked(null); goTab("notes"); });
  const writeNote = (title: string) => leaving(() => { setDraftTitle(title); setOpen(""); setAsked(null); goTab("notes"); });
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
  let fill = false; // the map fills the page down to the bottom edge; the other pages are lists that scroll
  if (error) body = <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>;
  else if (data === null) body = <p className="m-0 text-text-tertiary">Reading the notes…</p>;
  else if (tab !== "notes" && asked) {
    body = (
      <Ask question={asked.question} result={asked.result} onOpen={(id) => openNote(id)} onClose={() => setAsked(null)} onWrite={() => writeNote(asked.question)} onWeb={() => setWeb(asked.question)}
        onAskClaude={async () => { setBusy(true); try { await onAsk(asked.question); } catch (e) { setError(String(e)); } finally { setBusy(false); } }} />
    );
  } else if (tab === "map") { body = <MapView brain={brain} onOpen={openNote} />; fill = true; }
  else if (tab === "notes") {
    // like the Files place: the list stays on the left, what is picked is read on the right, and nothing has to be closed to read the next one
    const right = open !== null && (open === "" || openNoteObj)
      ? <NoteView key={open} projectId={project.id} accountId={project.account ?? null} brain={brain} note={open === "" ? null : openNoteObj} draftTitle={draftTitle} onOpen={openNote} onClose={() => setOpen(null)} onChanged={changed} onDirty={setDirty} />
      : asked
        ? (
          <Ask question={asked.question} result={asked.result} onOpen={(id) => openNote(id)} onClose={() => setAsked(null)} onWrite={() => writeNote(asked.question)} onWeb={() => setWeb(asked.question)}
            onAskClaude={async () => { setBusy(true); try { await onAsk(asked.question); } catch (e) { setError(String(e)); } finally { setBusy(false); } }} />
        )
        : <p className="m-0 p-2 text-text-tertiary">Pick a note on the left to read it.</p>;
    const row = "flex flex-col gap-0.5 px-2.5 py-1.5 text-left";
    body = (
      <div className="flex min-h-0 flex-1 gap-6">
        <div className="flex min-h-0 w-[250px] shrink-0 flex-col gap-3">
          <Select ariaLabel="Layer" value={layer} onChange={(v) => setLayer(v as Layer | "all")} search={false}
            options={([["all", "All notes"], ["project", "Project"], ["starter", "Starter"], ["memory", "Claude's memory"]] as const).map(([id, word]) => ({ value: id, label: `${word} (${id === "all" ? brain.notes.size : counts[id]})` }))} />
          <div role="list" aria-label="Notes" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {open === "" && <span className={`${row} bg-surface-3`}><span className="text-[14px] leading-5 font-bold">New note</span><span className="text-[12px] leading-4 text-text-tertiary">Not saved yet</span></span>}
            {data?.memory_dir === null && layer === "memory" && <p className="m-0 p-2 text-[14px] leading-5 text-text-tertiary">Claude has no memory folder for this project yet.</p>}
            {noteList.map((n) => (
              <button key={n.id} type="button" role="listitem" title={n.title} aria-current={open === n.id ? "true" : undefined} onClick={() => openNote(n.id)}
                className={`${row} ${open === n.id ? "bg-surface-3" : "hover:bg-surface-2"}`}>
                <span className={`line-clamp-2 text-[13px] leading-[18px] ${open === n.id ? "font-bold text-text" : "text-text"}`}>{n.title}</span>
                <span className="truncate text-[12px] leading-4 text-text-tertiary">{LAYER_WORD[n.layer]}{n.tickets.length ? ` · ${n.tickets.join(", ")}` : ""}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{right}</div>
      </div>
    );
    fill = true;
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
      <div className={`flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pt-6 ${fill ? "pb-8" : "pb-10"}`}>{body}</div>

      {leave && (
        <Confirm title="Leave this note?" confirmLabel="Leave without saving" danger onConfirm={() => { const go = leave; setLeave(null); setDirty(false); go(); }} onCancel={() => setLeave(null)}>
          <p className="m-0">What you typed in this note is not saved yet. If you leave, it is lost.</p>
        </Confirm>
      )}
      {web && (
        <Confirm title="Search the web for this?" confirmLabel="Open my browser" onConfirm={() => { void openUrl(`https://duckduckgo.com/?q=${encodeURIComponent(web)}`); setWeb(null); }} onCancel={() => setWeb(null)}>
          <p className="m-0">Your browser opens a search with exactly these words. They are sent to the search site, so leave out anything private.</p>
          <p className="m-0 bg-inset px-3 py-2 text-[14px] leading-5 text-text">{web}</p>
        </Confirm>
      )}
    </main>
  );
}
