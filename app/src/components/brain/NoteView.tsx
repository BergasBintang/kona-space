// One note: read it (links open), see what it links to and what links to it, and, for the owner's own notes, edit or delete it.
// Starter notes and Claude's memory are read-only: Kona never writes them. It reads like a file in the Files place: the same reader (Markdown.tsx), and the same
// find, outline of headings and plain view of the text (Reader.tsx), so a note and a document are one kind of page (decision 81).
import { useEffect, useRef, useState } from "react";
import { deleteNote, noteCheck, saveNote } from "../../lib/api";
import { linkedWith, noteCheckPrompt, readNoteCheck } from "../../lib/brain/notecheck.ts";
import type { Brain } from "../../lib/brain/engine.ts";
import { frontMatter, type Note } from "../../lib/brain/parse.ts";
import { Button, Glyph } from "../ui";
import { Confirm } from "../Confirm";
import { Markdown } from "./Markdown";
import { FindBar, Gutter, Outline, OutlineRail, useOutlineOpen, useReader } from "./Reader";
import { localDate } from "../../lib/brain/text.ts";

export const LAYER_WORD: Record<string, string> = { project: "Project", starter: "Starter", memory: "Claude's memory" };

export const Chip = ({ children, tone = "" }: { children: React.ReactNode; tone?: string }) => <span className={`bg-surface-3 px-2.5 py-0.5 text-[12px] leading-5 font-bold ${tone || "text-text-secondary"}`}>{children}</span>;

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const today = () => localDate();

/** A note that the owner changed gets a mark in its front matter, so it is never taken for something a session wrote. */
function ownerMark(text: string): string {
  const t = text.replace(/\r/g, "");
  const { meta, bodyStart } = frontMatter(t);
  if (bodyStart === 0 || meta.edited_by === "owner") return t;
  const lines = t.split("\n");
  lines.splice(bodyStart - 1, 0, "edited_by: owner");
  return lines.join("\n");
}

export function NoteView({ projectId, accountId, brain, note, draftTitle, onOpen, onClose, onChanged, onDirty }: {
  projectId: string; accountId: string | null; brain: Brain; note: Note | null; draftTitle?: string; onOpen: (id: string) => void; onClose: () => void; onChanged: (id: string | null) => void;
  /** tells the page whether there is text typed here that is not saved, so it can ask before another note replaces this one */
  onDirty?: (dirty: boolean) => void;
}) {
  const fresh = note === null;
  const [editing, setEditing] = useState(fresh);
  const [name, setName] = useState(fresh ? slug(draftTitle ?? "") : "");
  const [text, setText] = useState(fresh ? `---\ntitle: ${draftTitle ?? ""}\nkind: note\ndate: ${today()}\n---\n# ${draftTitle ?? ""}\n\n` : note!.raw);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startText = useRef(text);
  const dirty = editing && (text !== startText.current || (fresh && name !== ""));
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);
  const [confirm, setConfirm] = useState(false);
  const [rendered, setRendered] = useState(true); // a page, or the text as written
  const [check, setCheck] = useState<null | { stage: "ask" | "running" | "done"; answer?: string; error?: string }>(null); // the on-request comparison with the linked notes
  const reader = useReader({ text: note ? note.raw : null, md: true, rendered, finds: !!note && !editing, anchor: null, resetKey: note?.id ?? null });
  const [outlineOpen, setOutlineOpen] = useOutlineOpen();
  const hasOutline = rendered && reader.heads.length >= 3;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const id = fresh ? name : note!.id;
      if (fresh && brain.notes.has(id)) throw new Error("There is already a note with that name");
      await saveNote(projectId, id, fresh ? text : ownerMark(text));
      onChanged(id);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await deleteNote(projectId, note!.id); setConfirm(false); onChanged(null); } catch (e) { setError(String(e)); setBusy(false); }
  };

  const others = note ? linkedWith(brain, note) : [];
  const runCheck = async () => {
    if (!note) return;
    setCheck({ stage: "running" });
    try { const { prompt } = noteCheckPrompt(note, others); setCheck({ stage: "done", answer: await noteCheck(projectId, accountId, prompt) }); }
    catch (e) { setCheck({ stage: "ask", error: String(e) }); }
  };
  const out = note ? brain.outgoing(note.id) : [];
  const into = note ? brain.incoming(note.id) : [];
  const title = (id: string) => brain.notes.get(id)?.title ?? id;
  const lineOf = (from: string, to: string) => brain.notes.get(from)?.links.find((l) => l.target === to)?.line;
  const when = note?.mtime ? new Date(note.mtime).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : note?.meta.date;

  const linksPanel = note && !editing ? (
        <div className="grid grid-cols-2 gap-4">
          {([["This note links to", out.map((e) => ({ id: e.t, trust: e.trust, kind: e.k, line: lineOf(note.id, e.t) }))], ["Linked from", into.map((e) => ({ id: e.s, trust: e.trust, kind: e.k, line: lineOf(e.s, note.id) }))]] as const).map(([label, rows]) => (
            <section key={label} className="flex flex-col gap-2 border border-line-subtle bg-surface-1 p-4" aria-label={label}>
              <h3 className="m-0 text-[14px] leading-5 font-bold">{label}</h3>
              {rows.length === 0 && <span className="text-[13px] leading-5 text-text-tertiary">Nothing.</span>}
              {rows.map((r) => (
                <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="flex items-center justify-between gap-3 text-left text-[14px] leading-5 hover:text-accent">
                  <span className="truncate font-bold">{title(r.id)}</span>
                  <span className="shrink-0 text-[12px] text-text-tertiary">{r.trust === "written" ? "written" : "guessed"}{r.kind === "ref" ? ", named" : ""}{r.line ? ` · line ${r.line}` : ""}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
  ) : null;

  return (
    <div className={`flex flex-col gap-5 ${note && !editing ? "min-h-0 flex-1" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="m-0 text-[26px] leading-[34px] font-bold">{fresh ? "New note" : note!.title}</h2>
          {note && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{LAYER_WORD[note.layer]}</Chip>
              {note.kind !== "starter" && note.kind !== "memory" && <Chip>{note.kind}</Chip>}
              {note.meta.source === "agent" && note.meta.edited_by !== "owner" && <Chip>Saved by a session</Chip>}
              {note.meta.edited_by === "owner" && <Chip>Edited by you</Chip>}
              {note.tickets.map((t) => <Chip key={t}>{t}</Chip>)}
              {when && <span className="text-[13px] leading-5 text-text-tertiary">{note.layer === "memory" ? `Written ${when}. A memory records what was true then.` : when}</span>}
              {note.readonly && <span className="text-[13px] leading-5 text-text-tertiary">Read-only</span>}
            </div>
          )}
        </div>
        {note && !editing && (
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" small onClick={reader.toggleFind} aria-pressed={reader.finding} title="Find on this page (Ctrl+F)">Find</Button>
            {others.length > 0 && <Button variant="ghost" small onClick={() => setCheck({ stage: "ask" })} title="Ask whether this note disagrees with the notes it is linked with">Check for conflicts</Button>}
            <Button variant="ghost" small onClick={() => setRendered((r) => !r)} aria-pressed={rendered}>{rendered ? "Show the text" : "Show it as a page"}</Button>
            {!note.readonly && <><Button variant="quiet" small onClick={() => setEditing(true)}>Edit</Button><Button variant="ghost" small onClick={() => setConfirm(true)}>Delete…</Button></>}
          </div>
        )}
      </div>
      {note && !editing && reader.finding && <FindBar reader={reader} />}

      {editing ? (
        <div className="flex flex-col gap-3">
          {fresh && (
            <label className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">Name (lower-case letters, digits and dashes)</span>
              <input value={name} onChange={(e) => setName(slug(e.target.value))} aria-label="Note name" className="h-11 border border-line-strong bg-inset px-3.5 font-mono text-[14px] text-text" />
            </label>
          )}
          <label className="flex flex-col gap-2">
            <span className="text-[13px] leading-5 font-bold text-text-secondary">The note (markdown). Link to another note with [[its name]].</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={18} aria-label="The note" spellCheck={false} className="border border-line-strong bg-inset p-3.5 font-mono text-[13px] leading-5 text-text" />
          </label>
          {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => { if (fresh) onClose(); else { setEditing(false); setText(note!.raw); setError(null); } }}>Cancel</Button>
            <Button onClick={save} disabled={busy || (fresh && !name) || text.trim() === ""}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : (
        <div ref={reader.body} className="flex min-h-0 flex-1 border-t border-line-subtle">
          {hasOutline && (outlineOpen ? <Outline heads={reader.heads} active={reader.active} onJump={reader.jump} onClose={() => setOutlineOpen(false)} /> : <OutlineRail onOpen={() => setOutlineOpen(true)} />)}
          <div ref={reader.scroller} className={`flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-auto py-5 pr-5 ${hasOutline ? "pl-5" : ""}`}>
            {rendered ? <Markdown text={note!.raw} resolve={(r) => brain.resolve(r)} open={onOpen} /> : <Gutter text={note!.raw} />}
            {linksPanel}
          </div>
        </div>
      )}

      {check && check.stage !== "done" && note && (
        <Confirm title="Compare this note with the notes it is linked with?" confirmLabel="Compare" busy={check.stage === "running"} error={check.error} onConfirm={() => void runCheck()} onCancel={() => setCheck(null)}>
          <p className="m-0">One cheap Haiku call reads this note and {others.length === 1 ? "one note" : `${others.length} notes`} linked with it, and says where they cannot both be true. It uses a little of your plan. Anything that looks like a secret is hidden first, and nothing is saved.</p>
          <ul className="m-0 list-disc pl-5 text-[14px] leading-5">{[note, ...others].map((n) => <li key={n.id}>{n.title}</li>)}</ul>
        </Confirm>
      )}
      {check?.stage === "done" && (() => {
        const r = readNoteCheck(check.answer ?? "");
        return (
          <Confirm title={r.none ? "No disagreement found" : "These may disagree"} confirmLabel="" noConfirm cancelLabel="Close" onConfirm={() => {}} onCancel={() => setCheck(null)}>
            {r.none ? <p className="m-0">Haiku found nothing in this note and its linked notes that cannot both be true. It can miss things, so this is a help, not a proof.</p> : <pre className="m-0 max-h-[50vh] overflow-auto font-sans text-[14px] leading-5 whitespace-pre-wrap">{r.text}</pre>}
          </Confirm>
        );
      })()}
      {confirm && note && (
        <Confirm title="Delete this note?" confirmLabel="Delete it" danger busy={busy} error={error} onConfirm={remove} onCancel={() => setConfirm(false)}>
          <p className="m-0">“{note.title}” is deleted from the project's brain folder. Links to it from other notes will show as broken.</p>
          {note.path && <p className="m-0 break-all font-mono text-[13px] leading-5">{note.path}</p>}
        </Confirm>
      )}
    </div>
  );
}
