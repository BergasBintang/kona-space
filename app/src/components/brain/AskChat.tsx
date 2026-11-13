// The Ask page of the Brain (decision 92): a chat that answers from the project's notes. The search runs first and is free; one cheap Haiku call reads the sections it found and may only
// answer from them. When nothing is found, nothing is sent and the page says so plainly, and the question goes on the wanted list. The chat lives in the Brain's state, so it stays when
// another tab is opened, and it is not written to disk.
import { useEffect, useRef, useState } from "react";
import { brainChat, saveNote, wantedAdd, wantedRemove, type Project, type Wanted } from "../../lib/api";
import type { Brain as Engine, Hit, SearchResult } from "../../lib/brain/engine.ts";
import { chatPrompt, readChatAnswer, type Reply } from "../../lib/brain/chat.ts";
import { localDate, redact } from "../../lib/brain/text.ts";
import { Button, Glyph, type GlyphState } from "../ui";
import { Help } from "../Help";

export type ChatTurn = { id: number; question: string; result: SearchResult; sent: Hit[]; status: "waiting" | "done" | "error"; reply?: Reply; error?: string; saved?: boolean };

const STATE: Record<SearchResult["state"], { glyph: GlyphState; word: string }> = {
  found: { glyph: "done", word: "Found in the brain" },
  partly: { glyph: "waiting", word: "Partly in the brain" },
  none: { glyph: "idle", word: "Not in the brain" },
};

let next = 1;

export function AskChat({ project, brain, ready, counts, turns, setTurns, onOpen, onGoDeeper, onWeb, onWrite, onWanted, onSaved }: {
  project: Project; brain: Engine; ready: boolean; counts: string; turns: ChatTurn[]; setTurns: React.Dispatch<React.SetStateAction<ChatTurn[]>>;
  onOpen: (id: string) => void; onGoDeeper: (question: string) => void; onWeb: (question: string) => void; onWrite: (question: string) => void;
  onWanted: (w: Wanted[]) => void; onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.status === "waiting");
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.length, turns[turns.length - 1]?.status]);

  const patch = (id: number, p: Partial<ChatTurn>) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const gap = (question: string) => { wantedAdd(project.id, question).then(onWanted).catch(() => {}); };

  const run = async (question: string, past: { question: string; answer: string }[], existing?: number) => {
    const result = brain.search(question);
    const id = existing ?? next++;
    const base: ChatTurn = { id, question, result, sent: [], status: "done" };
    const put = (t: ChatTurn) => setTurns((all) => (existing ? all.map((x) => (x.id === id ? t : x)) : [...all, t]));
    if (result.state === "none") { put(base); gap(question); return; }
    const { prompt, sent } = chatPrompt(question, past, result.hits);
    put({ ...base, sent, status: "waiting" });
    try {
      const answer = await brainChat(project.id, project.account ?? null, prompt);
      const reply = readChatAnswer(answer, sent.length);
      patch(id, { status: "done", reply });
      if (reply.readable && !reply.covered) gap(question);
    } catch (e) { patch(id, { status: "error", error: String(e) }); }
  };
  const pastOf = (before: ChatTurn[]) => before.filter((t) => t.reply?.covered).map((t) => ({ question: t.question, answer: t.reply!.text }));
  const send = () => {
    const question = redact(q.trim()).text;
    if (!question || busy || !ready) return;
    setQ("");
    void run(question, pastOf(turns));
  };
  const retry = (t: ChatTurn) => { const i = turns.findIndex((x) => x.id === t.id); void run(t.question, pastOf(turns.slice(0, i)), t.id); };

  const save = async (t: ChatTurn) => {
    if (!t.reply?.covered) return;
    try {
      const base = t.question.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "answer";
      const used = t.reply.used.map((n) => t.sent[n - 1]?.note).filter((n, i, a) => n && a.indexOf(n) === i && n.layer === "project");
      const title = redact(t.question).text.slice(0, 100);
      const text = `---\ntitle: ${title}\nkind: topic\ndate: ${localDate()}\nsource: brain-ask\n---\n# ${title}\n\n${redact(t.reply.text).text}\n${used.length ? `\nFrom: ${used.map((n) => `[[${n!.id}]]`).join(", ")}\n` : ""}`;
      await saveNote(project.id, `answer-${base}`, text);
      void wantedRemove(project.id, t.question).then(onWanted).catch(() => {});
      patch(t.id, { saved: true });
      onSaved();
    } catch (e) { patch(t.id, { error: `Could not save: ${String(e)}` }); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="m-0 text-[14px] leading-5 text-text-secondary">{counts}</p>
        <div className="flex items-center gap-2">
          <Help title="How the Ask page answers">
            <p className="m-0">Your question is searched in your notes first. That costs nothing, and nothing leaves this PC.</p>
            <p className="m-0">When notes match, one cheap Haiku call reads up to four of the matching sections and answers only from them. It uses a little of your plan. Anything that looks like a secret is hidden first.</p>
            <p className="m-0">When nothing matches, nothing is sent: the page says Not in the brain and keeps the question on the wanted list.</p>
            <p className="m-0">Haiku can be wrong. The notes an answer rests on are listed under it, so you can read them. The chat is not saved when you close Kona.</p>
          </Help>
          <Button variant="quiet" small disabled={turns.length === 0 || busy} onClick={() => setTurns([])}>New chat</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1" role="log" aria-label="Questions and answers">
        {turns.length === 0 && <p className="m-0 text-[15px] leading-6 text-text-tertiary">Ask a question about this project. Answers come only from your notes, and the notes they rest on are listed under each answer.</p>}
        {turns.map((t) => <Turn key={t.id} t={t} onOpen={onOpen} onRetry={() => retry(t)} onSave={() => void save(t)} onGoDeeper={() => onGoDeeper(t.question)} onWeb={() => onWeb(t.question)} onWrite={() => onWrite(t.question)} />)}
        <div ref={end} />
      </div>

      <form className="flex shrink-0 gap-3" onSubmit={(e) => { e.preventDefault(); send(); }} role="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the brain, for example: what is a worktree?" aria-label="Ask the brain" className="h-12 min-w-0 flex-1 border border-line-strong bg-inset px-4 text-[15px] text-text placeholder:text-text-tertiary" />
        <Button type="submit" disabled={!q.trim() || busy || !ready}>{busy ? "Reading…" : "Ask"}</Button>
      </form>
    </div>
  );
}

function Turn({ t, onOpen, onRetry, onSave, onGoDeeper, onWeb, onWrite }: { t: ChatTurn; onOpen: (id: string) => void; onRetry: () => void; onSave: () => void; onGoDeeper: () => void; onWeb: () => void; onWrite: () => void }) {
  const answered = t.status === "done" && t.reply?.readable && t.reply.covered;
  const empty = t.result.state === "none" || (t.status === "done" && t.reply?.readable && !t.reply.covered);
  const state = empty ? STATE.none : STATE[t.result.state];
  const sources = answered && t.reply!.used.length ? t.reply!.used.map((n) => t.sent[n - 1]).filter(Boolean) : [];
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 max-w-[80%] self-end bg-surface-3 px-4 py-2.5 text-[15px] leading-6 break-words">{t.question}</p>
      <section className="flex flex-col gap-3 border border-line-subtle bg-surface-1 p-5" aria-label={`Answer to: ${t.question}`}>
        {t.status === "waiting" && <p className="m-0 flex items-center gap-2.5 text-[14px] leading-5 text-text-secondary"><Glyph state="live" size={16} /> Reading {t.sent.length === 1 ? "1 section" : `${t.sent.length} sections`} of your notes…</p>}
        {t.status === "error" && (
          <>
            <p className="m-0 flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> {t.error}</p>
            <div><Button variant="quiet" small onClick={onRetry}>Try again</Button></div>
          </>
        )}
        {t.status === "done" && t.reply && !t.reply.readable && (
          <>
            <p className="m-0 flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> Haiku did not answer in the shape that can be read, so nothing is shown. Try again.</p>
            <div><Button variant="quiet" small onClick={onRetry}>Try again</Button></div>
          </>
        )}
        {t.status === "done" && (t.result.state === "none" || t.reply?.readable) && (
          <>
            <h3 className="m-0 flex items-center gap-2.5 text-[16px] leading-6 font-bold"><Glyph state={state.glyph} size={18} />{state.word}</h3>
            {answered && <p className="m-0 text-[15px] leading-6 break-words whitespace-pre-wrap">{t.reply!.text}</p>}
            {empty && (
              <p className="m-0 text-[14px] leading-5 text-text-secondary">
                {t.result.state === "none" ? "No note covers this, so nothing was sent to Haiku. " : "The notes that matched do not answer this. "}
                The question is on the wanted list in the Report.
              </p>
            )}
            {answered && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] leading-5 text-text-tertiary">{sources.length ? "The notes this rests on" : "Haiku did not say which notes it used. It read these"}</span>
                <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
                  {(sources.length ? sources : t.sent).map((h) => <li key={h.section.id}><Button variant="ghost" tiny onClick={() => onOpen(h.note.id)}>{h.note.title} › {h.section.heading}</Button></li>)}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2.5">
              {answered && <Button variant="quiet" small disabled={t.saved} onClick={onSave}>{t.saved ? "Saved as a note" : "Save as a note"}</Button>}
              <Button variant="quiet" small onClick={onGoDeeper}>Go deeper in a session</Button>
              {empty && <Button variant="quiet" small onClick={onWeb}>Search the web…</Button>}
              {empty && t.result.nearest && <Button variant="quiet" small onClick={() => onOpen(t.result.nearest!.id)}>Open “{t.result.nearest.title}”</Button>}
              {empty && <Button variant="quiet" small onClick={onWrite}>Write a note about this</Button>}
            </div>
            {t.error && <p className="m-0 text-[13px] leading-5 text-state-left">{t.error}</p>}
          </>
        )}
      </section>
    </div>
  );
}
