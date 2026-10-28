// The answer to a question. Always one of three, in words and a glyph (never colour alone): Found in the brain, Partly in the brain, or
// Not in the brain. On a miss Kona offers choices and never acts on its own: ask Claude in a session, search the web (asks first, because it
// sends the words out), open the nearest topic, or write the note. The miss is also kept on the wanted list.
import type { SearchResult } from "../../lib/brain/engine.ts";
import { Button, Glyph, type GlyphState } from "../ui";
import { Chip, LAYER_WORD } from "./NoteView";
import { Help } from "../Help";

const STATE: Record<SearchResult["state"], { glyph: GlyphState; word: string; says: string }> = {
  found: { glyph: "done", word: "Found in the brain", says: "A section holds nearly every word of your question." },
  partly: { glyph: "waiting", word: "Partly in the brain", says: "Only some of your words match. These are the closest: close, not exact." },
  none: { glyph: "idle", word: "Not in the brain", says: "No note covers this. Nothing below is an answer." },
};

export function Ask({ question, result, onOpen, onAskClaude, onWeb, onWrite, onClose }: {
  question: string; result: SearchResult; onOpen: (id: string, line?: number) => void; onAskClaude: () => void; onWeb: () => void; onWrite: () => void; onClose: () => void;
}) {
  const s = STATE[result.state];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Button variant="ghost" small className="self-start" onClick={onClose}>← Back</Button>
          <span className="truncate text-[14px] leading-5 text-text-tertiary">You asked: “{question}”</span>
          <h2 className="m-0 flex items-center gap-3 text-[24px] leading-8 font-bold"><Glyph state={s.glyph} size={24} />{s.word}</h2>
          <p className="m-0 text-[14px] leading-5 text-text-secondary">{s.says}</p>
        </div>
      </div>

      {result.hits.map((h) => (
        <section key={h.section.id} className="flex flex-col gap-2.5 rounded-card border border-line-subtle bg-surface-1 p-5" aria-label={`${h.note.title}, ${h.section.heading}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate text-[16px] leading-6 font-bold">{h.note.title} <span className="font-normal text-text-tertiary">› {h.section.heading}</span></span>
              <div className="flex flex-wrap items-center gap-2"><Chip>{LAYER_WORD[h.note.layer]}</Chip><span className="font-mono text-[12px] text-text-tertiary">lines {h.section.start}–{h.section.end}</span>{h.strength !== "match" && <Chip tone="text-state-waiting">{h.strength === "loose" ? "loose match" : "weak match"}</Chip>}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="flex items-center gap-2" title="How much of your question this section covers"><span className="h-2 w-20 overflow-hidden rounded bg-surface-3"><span className="block h-full rounded bg-accent" style={{ width: `${Math.round(h.coverage * 100)}%` }} /></span><span className="w-9 text-right font-mono text-[12px] text-text-secondary">{Math.round(h.coverage * 100)}%</span></span>
              <Button variant="quiet" small onClick={() => onOpen(h.note.id, h.section.start)}>Open</Button>
            </div>
          </div>
          {h.snippet && <p className="m-0 text-[14px] leading-5 text-text-secondary">{h.snippet}</p>}
        </section>
      ))}

      {result.state !== "found" && (
        <section className="flex flex-col gap-3 rounded-card border border-dashed border-line-strong p-5" aria-label="What to do next">
          <div className="flex items-center gap-2.5"><h3 className="m-0 text-[16px] leading-6 font-bold">{result.state === "partly" ? "None of these fit?" : "What would you like to do?"}</h3><Help title="What these buttons do"><p className="m-0">Asking Claude starts a session in plan-only mode and uses your plan.</p><p className="m-0">Searching the web opens your browser with these words, after you confirm.</p></Help></div>
          <p className="m-0 text-[13px] leading-5 text-text-tertiary">Kona does nothing on its own. {result.state === "none" ? "This question is on the wanted list in the Report, so the gap is not forgotten." : ""}</p>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="quiet" onClick={onAskClaude}>Ask Claude in a session</Button>
            <Button variant="quiet" onClick={onWeb}>Search the web…</Button>
            {result.nearest && <Button variant="quiet" onClick={() => onOpen(result.nearest!.id)}>Open “{result.nearest.title}”</Button>}
            <Button variant="quiet" onClick={onWrite}>Write a note about this</Button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-1 rounded-card bg-surface-1 px-5 py-4 text-[13px] leading-5 text-text-tertiary" aria-label="What Kona looked at">
        <span className="font-bold text-text-secondary">What Kona looked at</span>
        <span>{result.looked.notes} notes cut into {result.looked.sections} sections, from {result.looked.layers.map((l) => LAYER_WORD[l]).join(", ")}. Text that looks like a secret is hidden from the search.</span>
      </section>
    </div>
  );
}
