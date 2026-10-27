// One note: read it (links open), see what it links to and what links to it, and, for the owner's own notes, edit or delete it.
// Starter notes and Claude's memory are read-only: Kona never writes them.
import { useState } from "react";
import { deleteNote, saveNote } from "../../lib/api";
import type { Brain } from "../../lib/brain/engine.ts";
import { frontMatter, type Note } from "../../lib/brain/parse.ts";
import { Button, Glyph } from "../ui";
import { Confirm } from "../Confirm";
import { Markdown } from "./Markdown";
import { localDate } from "../../lib/brain/text.ts";

export const LAYER_WORD: Record<string, string> = { project: "Project", starter: "Starter", memory: "Claude's memory" };

export const Chip = ({ children, tone = "" }: { children: React.ReactNode; tone?: string }) => <span className={`rounded-full bg-surface-3 px-2.5 py-0.5 text-[12px] leading-5 font-bold ${tone || "text-text-secondary"}`}>{children}</span>;

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

export function NoteView({ projectId, brain, note, draftTitle, onOpen, onClose, onChanged }: {
  projectId: string; brain: Brain; note: Note | null; draftTitle?: string; onOpen: (id: string) => void; onClose: () => void; onChanged: (id: string | null) => void;
}) {
  const fresh = note === null;
  const [editing, setEditing] = useState(fresh);
  const [name, setName] = useState(fresh ? slug(draftTitle ?? "") : "");
  const [text, setText] = useState(fresh ? `---\ntitle: ${draftTitle ?? ""}\nkind: note\ndate: ${today()}\n---\n# ${draftTitle ?? ""}\n\n` : note!.raw);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

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

  const out = note ? brain.outgoing(note.id) : [];
  const into = note ? brain.incoming(note.id) : [];
  const title = (id: string) => brain.notes.get(id)?.title ?? id;
  const lineOf = (from: string, to: string) => brain.notes.get(from)?.links.find((l) => l.target === to)?.line;
  const when = note?.mtime ? new Date(note.mtime).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : note?.meta.date;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Button variant="ghost" small className="self-start" onClick={onClose}>← Back</Button>
          <h2 className="m-0 text-[26px] leading-[34px] font-bold">{fresh ? "New note" : note!.title}</h2>
          {note && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{LAYER_WORD[note.layer]}</Chip>
              {note.kind !== "starter" && note.kind !== "memory" && <Chip>{note.kind}</Chip>}
              {note.meta.edited_by === "owner" && <Chip>Edited by you</Chip>}
              {when && <span className="text-[13px] leading-5 text-text-tertiary">{note.layer === "memory" ? `Written ${when}. A memory records what was true then.` : when}</span>}
              {note.readonly && <span className="text-[13px] leading-5 text-text-tertiary">Read-only</span>}
            </div>
          )}
        </div>
        {note && !note.readonly && !editing && (
          <div className="flex shrink-0 gap-2"><Button variant="quiet" small onClick={() => setEditing(true)}>Edit</Button><Button variant="ghost" small onClick={() => setConfirm(true)}>Delete…</Button></div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          {fresh && (
            <label className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">Name (lower-case letters, digits and dashes)</span>
              <input value={name} onChange={(e) => setName(slug(e.target.value))} aria-label="Note name" className="h-11 rounded-control border border-line-strong bg-inset px-3.5 font-mono text-[14px] text-text" />
            </label>
          )}
          <label className="flex flex-col gap-2">
            <span className="text-[13px] leading-5 font-bold text-text-secondary">The note (markdown). Link to another note with [[its name]].</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={18} aria-label="The note" spellCheck={false} className="rounded-control border border-line-strong bg-inset p-3.5 font-mono text-[13px] leading-5 text-text" />
          </label>
          {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => { if (fresh) onClose(); else { setEditing(false); setText(note!.raw); setError(null); } }}>Cancel</Button>
            <Button onClick={save} disabled={busy || (fresh && !name) || text.trim() === ""}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : (
        <Markdown text={note!.raw} resolve={(r) => brain.resolve(r)} open={onOpen} />
      )}

      {note && !editing && (
        <div className="grid grid-cols-2 gap-4">
          {([["This note links to", out.map((e) => ({ id: e.t, trust: e.trust, kind: e.k, line: lineOf(note.id, e.t) }))], ["Linked from", into.map((e) => ({ id: e.s, trust: e.trust, kind: e.k, line: lineOf(e.s, note.id) }))]] as const).map(([label, rows]) => (
            <section key={label} className="flex flex-col gap-2 rounded-card border border-line-subtle bg-surface-1 p-4" aria-label={label}>
              <h3 className="m-0 text-[14px] leading-5 font-bold">{label}</h3>
              {rows.length === 0 && <span className="text-[13px] leading-5 text-text-tertiary">Nothing.</span>}
              {rows.map((r) => (
                <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="flex items-center justify-between gap-3 rounded text-left text-[14px] leading-5 hover:text-accent">
                  <span className="truncate font-bold">{title(r.id)}</span>
                  <span className="shrink-0 text-[12px] text-text-tertiary">{r.trust === "written" ? "written" : "guessed"}{r.kind === "ref" ? ", named" : ""}{r.line ? ` · line ${r.line}` : ""}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      {confirm && note && (
        <Confirm title="Delete this note?" confirmLabel="Delete it" danger busy={busy} error={error} onConfirm={remove} onCancel={() => setConfirm(false)}>
          <p className="m-0">“{note.title}” is deleted from the project's brain folder. Links to it from other notes will show as broken.</p>
          {note.path && <p className="m-0 break-all font-mono text-[13px] leading-5">{note.path}</p>}
        </Confirm>
      )}
    </div>
  );
}
