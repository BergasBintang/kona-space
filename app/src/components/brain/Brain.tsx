// The Brain place (feature F7): the project's notes as a graph, with a question box that says plainly whether the answer is in it.
// Layers: the project's own notes (editable), the starter notes that ship with Kona, and Claude's memory for the project (read only).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { loadBrain, wantedList, wantedRemove, type BrainData, type Project, type Wanted } from "../../lib/api";
import { Brain as Engine } from "../../lib/brain/engine.ts";
import { starterNotes } from "../../lib/brain/starter.ts";
import { autoNoteOn, setAutoNote } from "../../lib/brain/summary.ts";
import type { Layer, RawNote } from "../../lib/brain/parse.ts";
import { Button, Glyph } from "../ui";
import { Confirm } from "../Confirm";
import { AskChat, type ChatTurn } from "./AskChat";
import { MapView } from "./MapView";
import { LAYER_WORD, NoteView } from "./NoteView";
import { Chevron } from "../Files";
import { Report } from "./Report";
import { JourneyView } from "./JourneyView";
import { Help } from "../Help";

export type BrainTab = "map" | "notes" | "journey" | "ask" | "report";
/** The pages of the Brain, shown as tabs in the sheet's title bar (App.tsx holds which one is open). */
export const BRAIN_TABS: { id: BrainTab; label: string }[] = [{ id: "map", label: "Map" }, { id: "notes", label: "Notes" }, { id: "journey", label: "Journey" }, { id: "ask", label: "Ask" }, { id: "report", label: "Report" }];

export function BrainPlace({ project, tab, onTab, onAsk }: { project: Project; tab: BrainTab; onTab: (t: BrainTab) => void; onAsk: (question: string) => Promise<void> }) {
  const [data, setData] = useState<BrainData | null>(null);
  const [wanted, setWanted] = useState<Wanted[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [folded, setFolded] = useState<Set<string>>(new Set()); // the groups of the Notes list that are closed
  const [turns, setTurns] = useState<ChatTurn[]>([]); // the Ask page's chat: kept while another tab is open, gone when the project changes
  const [open, setOpen] = useState<string | null>(null); // a note id, "" is a new note
  const [draftTitle, setDraftTitle] = useState("");
  const [web, setWeb] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(autoNoteOn());
  const [dirty, setDirty] = useState(false); // the open note has text typed that is not saved
  const [leave, setLeave] = useState<(() => void) | null>(null); // what the owner asked for while a note had unsaved text: done only after they agree
  // a tab pressed in the title bar leaves an open note; a tab this page picks itself (after saving a note) keeps it
  const own = useRef(tab);
  const goTab = (t: BrainTab) => { own.current = t; onTab(t); };
  useEffect(() => { if (tab !== own.current) setOpen(null); own.current = tab; }, [tab]);

  const load = useCallback(() => {
    loadBrain(project.id).then((d) => { setData(d); setError(null); }).catch((e) => setError(String(e)));
    wantedList(project.id).then(setWanted).catch(() => setWanted([]));
  }, [project.id]);
  useEffect(() => { setData(null); setOpen(null); setTurns([]); load(); }, [load]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 9000); return () => clearTimeout(t); }, [notice]);

  const raw = useMemo<RawNote[]>(() => [...(data?.notes ?? []).map((n) => ({ ...n, layer: n.layer as Layer })), ...starterNotes], [data]);
  const brain = useMemo(() => new Engine(raw), [raw]);
  const counts = useMemo(() => { const c: Record<string, number> = { project: 0, starter: 0, memory: 0 }; for (const n of brain.notes.values()) c[n.layer]++; return c; }, [brain]);
    
  /** do this, but first ask when the open note has text that is not saved */
  const leaving = (go: () => void) => { if (dirty) setLeave(() => go); else go(); };
  // opening a note, or starting one, always shows it on the Notes page: the list stays on the left and the note is on the right
  const openNote = (id: string) => leaving(() => { setOpen(id); goTab("notes"); });
  const writeNote = (title: string) => leaving(() => { setDraftTitle(title); setOpen(""); goTab("notes"); });
  const changed = (id: string | null) => {
    // a note written for a wanted question answers it: the question comes off the list
    const answered = id && draftTitle ? wanted.find((w) => w.question === draftTitle) : undefined;
    if (answered) void wantedRemove(project.id, answered.question).then(setWanted);
    setDraftTitle("");
    load(); setOpen(id); goTab("notes"); setNotice(id ? "Saved." : "Deleted.");
  };

  const countsLine = `${project.name}: ${counts.project} of your notes, ${counts.starter} starter notes${data?.memory_dir ? `, ${counts.memory} from Claude's memory` : ""}.`;
  // the Notes list: the same groups as the Map (notes that link to each other, named after the words of their titles), the groups A to Z and the notes in each A to Z;
  // the notes that link to no other note are together in the last group
  const byTitle = (a: { title: string; id: string }, b: { title: string; id: string }) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }) || a.id.localeCompare(b.id);
  const sorted = [...brain.notes.values()].sort(byTitle);
  const named = brain.clusters.filter((c) => c.members.length >= 2).map((c) => ({ key: c.label, label: c.label.charAt(0).toUpperCase() + c.label.slice(1), ids: new Set(c.members) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  const inGroup = new Set(named.flatMap((g) => [...g.ids]));
  const groups = [...named.map((g) => ({ key: g.key, label: g.label, notes: sorted.filter((n) => g.ids.has(n.id)) })), { key: "\u0000other", label: "Other notes", notes: sorted.filter((n) => !inGroup.has(n.id)) }].filter((g) => g.notes.length > 0);
  const fold = (key: string) => setFolded((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const openNoteObj = open ? brain.notes.get(open) ?? null : null;

  let body: React.ReactNode;
  let fill = false; // the map fills the page down to the bottom edge; the other pages are lists that scroll
  if (error) body = <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>;
  else if (data === null) body = <p className="m-0 text-text-tertiary">Reading the notes…</p>;
  else if (tab === "map") { body = <MapView brain={brain} onOpen={openNote} />; fill = true; }
  else if (tab === "notes") {
    // like the Files place: the list stays on the left, what is picked is read on the right, and nothing has to be closed to read the next one
    const right = open !== null && (open === "" || openNoteObj)
      ? <NoteView key={open} projectId={project.id} accountId={project.account ?? null} brain={brain} note={open === "" ? null : openNoteObj} draftTitle={draftTitle} onOpen={openNote} onClose={() => setOpen(null)} onChanged={changed} onDirty={setDirty} />
      : <p className="m-0 p-2 text-text-tertiary">Pick a note on the left to read it.</p>;
    const row = "flex flex-col gap-0.5 px-2.5 py-1.5 text-left";
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="m-0 text-[14px] leading-5 text-text-secondary">{countsLine}</p>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); setAutoNote(e.target.checked); }} className="h-4 w-4 accent-[var(--color-accent)]" />
            <span className="font-bold">Write a note when a session ends</span>
          </label>
          <Help title="Write a note when a session ends"><p className="m-0">One cheap Haiku call per session, using your plan. The conversation is cleaned of secrets first.</p><p className="m-0">You can also press Write a note in any session.</p></Help>
          <Button variant="quiet" small onClick={() => writeNote("")}>New note</Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-6">
        <div className="flex min-h-0 w-[250px] shrink-0 flex-col gap-3">
          <div role="list" aria-label="Notes" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {open === "" && <span className={`${row} bg-surface-3`}><span className="text-[14px] leading-5 font-bold">New note</span><span className="text-[12px] leading-4 text-text-tertiary">Not saved yet</span></span>}
            {groups.map((g) => {
              const closed = folded.has(g.key);
              return (
                <div key={g.key} role="presentation" className="flex flex-col gap-0.5">
                  <button type="button" aria-expanded={!closed} aria-label={`${g.label}, ${g.notes.length} ${g.notes.length === 1 ? "note" : "notes"}`} onClick={() => fold(g.key)}
                    className="flex h-8 w-full cursor-pointer items-center gap-1.5 px-1.5 text-left text-[13px] font-bold text-text-secondary hover:bg-surface-2">
                    <Chevron open={!closed} /><span className="min-w-0 flex-1 truncate">{g.label}</span><span className="font-normal text-text-tertiary">{g.notes.length}</span>
                  </button>
                  {!closed && g.notes.map((n) => (
                    <button key={n.id} type="button" role="listitem" title={n.title} aria-current={open === n.id ? "true" : undefined} onClick={() => openNote(n.id)}
                      className={`${row} pl-7 ${open === n.id ? "bg-surface-3" : "hover:bg-surface-2"}`}>
                      <span className={`line-clamp-2 text-[13px] leading-[18px] ${open === n.id ? "font-bold text-text" : "text-text"}`}>{n.title}</span>
                      <span className="truncate text-[12px] leading-4 text-text-tertiary">{LAYER_WORD[n.layer]}{n.tickets.length ? ` · ${n.tickets.join(", ")}` : ""}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{right}</div>
      </div>
      </div>
    );
    fill = true;
  } else if (tab === "ask") {
    body = (
      <AskChat project={project} brain={brain} ready={data !== null} counts={countsLine} turns={turns} setTurns={setTurns} onOpen={openNote} onWeb={setWeb} onWrite={writeNote}
        onGoDeeper={async (question) => { setBusy(true); try { await onAsk(question); } catch (e) { setError(String(e)); } finally { setBusy(false); } }}
        onWanted={setWanted} onSaved={() => { load(); setNotice("Saved."); }} />
    );
    fill = true;
  } else if (tab === "journey") body = <JourneyView projectId={project.id} accountId={project.account ?? null} brain={brain} onOpen={openNote} />;
  else body = <Report brain={brain} wanted={wanted} onOpen={openNote} onWrite={writeNote} onDrop={(question) => { void wantedRemove(project.id, question).then(setWanted); }} />;

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      {(notice || busy) && <div className="flex shrink-0 flex-col gap-3 border-b border-line-subtle px-8 pt-4 pb-4">
        {notice && <div role="status" className="flex items-start gap-2.5 border border-line-subtle bg-surface-2 px-4 py-3 text-[14px] leading-5"><Glyph state="done" size={16} /> {notice}</div>}
        {busy && <p className="m-0 text-[13px] text-text-tertiary">Starting a session…</p>}
      </div>}
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
