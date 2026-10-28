// The health report: what to look at in the brain. Wanted notes first (questions it could not answer), then what needs a look, the most
// connected notes, and how the notes group on their own compared with how they are filed.
import type { Brain } from "../../lib/brain/engine.ts";
import type { Wanted } from "../../lib/api";
import { Button, Glyph } from "../ui";
import { Help } from "../Help";

export function Report({ brain, wanted, onOpen, onWrite, onDrop }: {
  brain: Brain; wanted: Wanted[]; onOpen: (id: string) => void; onWrite: (question: string) => void; onDrop: (question: string) => void;
}) {
  const rep = brain.report(Date.now(), wanted.length);
  const warns = rep.warnings.filter((w) => w.severity === "warn");
  const infos = rep.warnings.filter((w) => w.severity === "info" && w.code !== "wanted");
  const Card = ({ title, children, count, help }: { title: string; children: React.ReactNode; count?: number; help?: React.ReactNode }) => (
    <section className="flex flex-col gap-3 rounded-card border border-line-subtle bg-surface-1 p-5" aria-label={title}>
      <div className="flex items-center gap-2.5">
        <h2 className="m-0 flex items-baseline gap-3 text-[17px] leading-6 font-bold">{title}{count !== undefined && <span className="font-mono text-[13px] font-normal text-text-tertiary">{count}</span>}</h2>
        {help && <Help title={title}>{help}</Help>}
      </div>
      {children}
    </section>
  );
  return (
    <div className="flex flex-col gap-4">
      <Card title="Wanted notes" count={wanted.length} help={<p className="m-0">Questions the brain could not answer show up here, so a gap becomes a to-do. The text of a question stays on this PC.</p>}>
        {wanted.length === 0 && <p className="m-0 text-[14px] leading-5 text-text-tertiary">No questions are waiting for a note.</p>}
        {wanted.map((w) => (
          <div key={w.question} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col"><span className="truncate font-bold">{w.question}</span><span className="text-[13px] leading-5 text-text-tertiary">Asked {w.count} {w.count === 1 ? "time" : "times"} · last {w.last}</span></div>
            <div className="flex shrink-0 gap-2"><Button variant="ghost" small onClick={() => onDrop(w.question)}>Remove</Button><Button variant="quiet" small onClick={() => onWrite(w.question)}>Write this note</Button></div>
          </div>
        ))}
      </Card>

      <Card title="Needs a look" count={warns.length}>
        {warns.length === 0 && <div className="flex items-center gap-2.5 text-[14px] leading-5 text-text-secondary"><Glyph state="done" size={16} /> Nothing needs a look.</div>}
        {warns.map((w, i) => (
          <div key={i} className="flex items-start justify-between gap-4 text-[14px] leading-5">
            <span className="flex items-start gap-2.5"><Glyph state="waiting" size={16} /><span className="text-text-secondary">{w.text}{w.line ? ` (line ${w.line})` : ""}</span></span>
            {w.noteId && <button type="button" onClick={() => onOpen(w.noteId!)} className="shrink-0 rounded font-bold text-text-secondary hover:text-text">Open</button>}
          </div>
        ))}
        {infos.map((w, i) => (
          <div key={`i${i}`} className="flex items-start justify-between gap-4 text-[13px] leading-5 text-text-tertiary">
            <span>{w.text}</span>{w.noteId && <button type="button" onClick={() => onOpen(w.noteId!)} className="shrink-0 rounded font-bold hover:text-text">Open</button>}
          </div>
        ))}
      </Card>

      <Card title="Most connected" count={rep.hubs.length}>
        {rep.hubs.map((h) => <button key={h.id} type="button" onClick={() => onOpen(h.id)} className="flex items-center justify-between gap-4 rounded text-left text-[14px] leading-5 hover:text-accent"><span className="truncate font-bold">{h.title}</span><span className="font-mono text-[12px] text-text-tertiary">{h.strength}</span></button>)}
        {rep.hubs.length === 0 && <p className="m-0 text-[14px] leading-5 text-text-tertiary">No links yet.</p>}
      </Card>

      <Card title="How your notes group" count={rep.clusters.length} help={<><p className="m-0">Notes that link to each other end up in a group, with no model involved.</p><p className="m-0">“Filed as” is how you or the notes themselves call them (role, kind or layer).</p></>}>
        {rep.clusters.map((c) => (
          <div key={c.id} className="flex items-baseline justify-between gap-4 text-[14px] leading-5">
            <span className="truncate font-bold">{c.label}</span>
            <span className="shrink-0 text-[13px] text-text-tertiary">{c.members.length} {c.members.length === 1 ? "note" : "notes"} · mostly filed as {c.curated}</span>
          </div>
        ))}
        {rep.disagreements.map((d, i) => <p key={i} className="m-0 text-[13px] leading-5 text-state-waiting">{d}</p>)}
      </Card>
    </div>
  );
}
