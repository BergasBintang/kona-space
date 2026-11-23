// The chat with one person (decision 62): the header (who it is, how they are doing, the ticket, the cost), the transcript with the cards that ask you something, and the message box.
// A person has one conversation at a time. Before the first message there is no session: the empty chat says who this is, and the first message starts it (App.tsx).
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Badge, Button, Glyph, RoleMark, type GlyphState } from "./ui";
import { Help } from "./Help";
import { IconButton } from "./Icon";
import { isRested, kilo, memoryOf } from "../lib/memory";
import { Markdown } from "./brain/Markdown";
import { Needs } from "./Needs";
import { roleLabel, type Project, type Role, type RoleKit } from "../lib/api";
import { dollars, permissionTitle, type Item, type Question, type Queued, type RunState, type Session } from "../lib/sessions";
import { interruptSession, sendToSession } from "../lib/send";
import { noPicks, pick, valueOf, write, type Picks } from "../lib/questionpick";

const RUN_BADGE: Record<RunState, { state: GlyphState; label: string }> = {
  starting: { state: "idle", label: "Starting" },
  ready: { state: "idle", label: "Ready for you" },
  working: { state: "live", label: "Working" },
  waiting: { state: "waiting", label: "Questioning" },
  ended: { state: "stopped", label: "Ended" },
};

export type Attached = { mediaType: string; data: string; url: string };

/** The top of the chat: who it is, how they are doing, what ticket they are on, what it cost, and the buttons. `s` is null before the first message. */
export function PersonHeader({ role, s, onNote, onEnd, onNew, onCompact }: {
  role: Role; s: Session | null; onNote?: () => void; onEnd?: () => void; onNew?: () => void; onCompact?: () => void;
}) {
  const b = s ? RUN_BADGE[s.run] : null;
  const live = !!s && s.run !== "ended";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []); // the rest of an hour is noticed without a click
  const memory = s && live ? memoryOf(s.context) : null;
  const rested = !!s && !!memory && isRested(s.lastAt, now);
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-[18px] pb-[14px]">
      <div className="flex min-w-0 items-center gap-3.5">
        <RoleMark roleId={role.id} size={40} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="m-0 truncate text-[22px] leading-[30px] font-bold">{roleLabel(role)}</h1>
          <div className="flex flex-wrap items-center gap-3 text-[13px] leading-5 text-text-secondary">
            {b ? <Badge state={b.state} label={b.label} /> : <Badge state="idle" label="Free" />}
            {s?.ticketId && <span className="font-bold text-text">{s.ticketId}</span>}
            {s && s.workDir !== s.folder && <span className="font-bold text-text-secondary" title={s.workDir}>Own copy</span>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {memory && s && (
          <div className="flex flex-col items-end" title={`${kilo(s.context ?? 0)} tokens: what ${role.person || role.name} reads again with every step`}>
            <span className="flex items-center gap-2 text-[13px] leading-5 font-bold text-text"><Glyph state={memory.state} size={14} />Memory: {memory.word}</span>
            {rested && <span className="text-[13px] leading-5 text-text-tertiary">Rested over an hour: the next message costs more</span>}
          </div>
        )}
        {memory && onCompact && <IconButton icon="compress" label="Make the memory smaller" disabled={s?.run !== "ready"} title={s?.run === "ready" ? "Make the memory smaller: it keeps what matters" : "Wait until they have finished"} onClick={onCompact} />}
        {s && (
          <div className="mr-1 flex flex-col items-end">
            <span className="font-mono text-[14px] font-bold">{dollars(s.costTotal)} <span className="font-sans font-normal text-text-tertiary">(estimated)</span></span>
          </div>
        )}
        {onNote && s && s.turns > 0 && s.run !== "working" && <Button variant="ghost" small onClick={onNote}>Write a note</Button>}
        {live && onEnd && <IconButton icon="stop" label="End session" variant="danger" onClick={onEnd} />}
        {s && onNew && <IconButton icon="newChat" label="New conversation" onClick={onNew} />}
      </div>
    </div>
  );
}

export function ToolLine({ it }: { it: Extract<Item, { kind: "tool" }> }) {
  const state: GlyphState = it.status === "running" ? "live" : it.status === "done" ? "done" : it.status === "denied" ? "stopped" : "left";
  const word = it.status === "running" ? "Running" : it.status === "done" ? "Done" : it.status === "denied" ? "You said no" : "Failed";
  return (
    <div className="flex max-w-[calc(980px*var(--k))] items-center gap-2.5 border border-line-subtle bg-surface-1 px-3.5 py-2.5">
      <Glyph state={state} size={16} />
      <span className="text-[13px] leading-5 text-text-secondary">{it.name}: {word}</span>
      {it.summary && <span className="truncate font-mono text-[13px] leading-5 text-text-tertiary">{it.summary}</span>}
    </div>
  );
}

export function PermissionCard({ it, who, onAnswer }: { it: Extract<Item, { kind: "permission" }>; who: string; onAnswer: (allow: boolean, remember?: unknown[]) => void }) {
  const open = it.status === "asking";
  return (
    <div className="flex max-w-[680px] flex-col gap-4 border border-line-subtle bg-surface-2 p-6" role="group" aria-label={permissionTitle(it.toolName, who)}>
      <div className="flex items-center gap-3">
        <Glyph state={open ? "waiting" : it.status === "allowed" ? "done" : "stopped"} size={22} />
        <h2 className="m-0 text-[17px] leading-6 font-bold">{permissionTitle(it.toolName, who)}</h2>
      </div>
      {it.servers && it.servers.length > 0 && (
        <div className="flex flex-col gap-1.5 border border-state-waiting bg-surface-1 p-3.5">
          <span className="flex items-center gap-2 text-[14px] leading-5 font-bold text-state-waiting"><Glyph state="waiting" size={16} />This command reaches a server</span>
          {it.servers.map((sv) => <span key={sv.host} className="text-[14px] leading-5"><span className="font-bold">{sv.label}</span> <span className="font-mono text-text-secondary">{sv.user}@{sv.host}</span> <span className="text-text-tertiary">· {sv.checked ? "fingerprint saved" : "fingerprint not checked"}</span></span>)}
        </div>
      )}
      {it.description && <p className="m-0 text-text-secondary">{it.description}</p>}
      {it.command && (
        <div className="flex flex-col gap-1 border border-line-subtle bg-inset p-3.5">
          <code className="font-mono text-[13px] leading-5 break-all whitespace-pre-wrap">{it.command}</code>
          {it.where && <span className="font-mono text-[13px] leading-5 text-text-tertiary">in {it.where}</span>}
        </div>
      )}
      {open ? (
        <div className="flex justify-end gap-3">
          <Button variant="quiet" onClick={() => onAnswer(false)}>Don’t allow</Button>
          {it.suggestions && !it.servers && <Button variant="quiet" onClick={() => onAnswer(true, it.suggestions)} title={`Allow this, and remember it for this project so ${who} does not ask again`}>Always allow here</Button>}
          <Button variant="primary" onClick={() => onAnswer(true)}>Allow once</Button>
        </div>
      ) : (
        <span className="flex items-center gap-2 text-[13px] leading-5 text-text-secondary">
          <Glyph state={it.status === "allowed" ? "done" : "stopped"} size={14} /> {it.status === "allowed" ? "You allowed this once" : "You said no"}
        </span>
      )}
    </div>
  );
}

/** The mark in front of an option. A question that takes ONE answer gets a round mark with a dot, a question that takes SEVERAL gets a square mark with a tick, so a glance at the first option says which kind
 * it is before anything is pressed (decision 105; the words "Pick one" / "Pick as many as you like" say it too, for a screen reader). The shape never changes, only whether it is filled. */
export function ChoiceMark({ many, on }: { many: boolean; on: boolean }) {
  return (
    <span aria-hidden="true" data-mark={many ? "square" : "round"} data-on={on || undefined}
      className={`mt-[4px] flex h-4 w-4 shrink-0 items-center justify-center border-2 ${many ? "" : "rounded-full"} ${on ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-inset"}`}>
      {on && (many
        ? <svg viewBox="0 0 10 10" width="10" height="10"><path d="M1.5 5.2 4 7.7l4.5-5.4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        : <span className="h-1.5 w-1.5 rounded-full bg-current" />)}
    </span>
  );
}

/** One of Claude's multiple-choice questions, as a card (decision 64). While it waits for the owner it shows ONE question at a time, with steps to move between them (answering a one-answer question moves on by itself);
 * afterwards it shows every question with what was answered. The options are buttons and "Other" is a text box: for a one-answer question the two exclude each other (lib/questionpick.ts). */
export function QuestionCard({ it, who, onAnswer }: { it: Extract<Item, { kind: "question" }>; who: string; onAnswer: (answers: Record<string, string> | null) => void }) {
  const open = it.status === "asking";
  const [picks, setPicks] = useState<Picks>(noPicks);
  const [page, setPage] = useState(0);
  const total = it.questions.length;
  const here = Math.min(page, total - 1);
  const done = (q: Question) => valueOf(picks, q) !== "";
  const ready = it.questions.every(done);
  const firstOpen = it.questions.findIndex((q) => !done(q));
  const submit = () => onAnswer(Object.fromEntries(it.questions.map((q) => [q.question, valueOf(picks, q)])));
  const choose = (q: Question, label: string) => {
    const next = pick(picks, q, label);
    setPicks(next);
    if (!q.multiSelect && valueOf(next, q) !== "" && here < total - 1) setPage(here + 1); // a one-answer question moves on once it is answered
  };
  const label = (q: Question, i: number) => q.header || `Question ${i + 1}`;
  const block = (q: Question, interactive: boolean) => (
    <fieldset key={q.question} data-choice={q.multiSelect ? "many" : "one"} className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0" disabled={!interactive}>
      <legend className="mb-1 p-0 text-[15px] leading-6 font-bold">{q.header && <span className="font-pixel mr-2 border border-line-strong px-1.5 text-[12px] leading-5 font-bold text-text-secondary">{q.header}</span>}{q.question}</legend>
      {interactive && <span data-pick-hint className="text-[13px] leading-5 font-bold text-text-secondary">{q.multiSelect ? "Pick as many as you like" : "Pick one"}</span>}
      <div className="flex flex-col gap-1.5">
        {q.options.map((o) => {
          const on = (picks.picked[q.question] ?? []).includes(o.label) || (!interactive && it.answers?.[q.question]?.split(", ").includes(o.label));
          return (
            <button key={o.label} type="button" aria-pressed={on} onClick={() => choose(q, o.label)}
              className={`px-btn px-btn-paper flex items-start gap-2.5 px-2 py-1 text-left ${on ? "px-on" : ""} disabled:cursor-default`} disabled={!interactive}>
              <ChoiceMark many={q.multiSelect === true} on={!!on} />
              <span className="flex min-w-0 flex-col items-start">
                <span className="text-[15px] leading-6 font-bold">{o.label}</span>
                {o.description && <span className="text-[13px] leading-5 text-text-secondary">{o.description}</span>}
              </span>
            </button>
          );
        })}
        {interactive
          ? <input value={picks.other[q.question] ?? ""} onChange={(e) => setPicks((p) => write(p, q, e.target.value))}
              onKeyDown={(e) => { if (e.key !== "Enter" || e.nativeEvent.isComposing) return; e.preventDefault(); if (!done(q)) return; if (here < total - 1) setPage(here + 1); else if (ready) submit(); }}
              placeholder={q.multiSelect ? "Other: add your own answer" : "Other: write your own answer"} aria-label={`Other answer to: ${q.question}`}
              className="bare h-10 border-2 border-line-subtle bg-inset px-3 text-[14px] text-text placeholder:text-text-tertiary" />
          : it.answers?.[q.question] && !q.options.some((o) => it.answers![q.question].split(", ").includes(o.label)) && <span className="text-[14px] leading-5 text-text-secondary">You wrote: {it.answers[q.question]}</span>}
      </div>
    </fieldset>
  );
  return (
    <div className="flex max-w-[680px] flex-col gap-5 border border-line-subtle bg-surface-2 p-6" role="group" aria-label={`${who} asks`}>
      <div className="flex items-center gap-3">
        <Glyph state={open ? "waiting" : it.status === "answered" ? "done" : "stopped"} size={22} />
        <h2 className="m-0 text-[17px] leading-6 font-bold">{who} asks</h2>
        {open && total > 1 && <span className="ml-auto text-[13px] leading-5 text-text-tertiary" data-step>Question {here + 1} of {total}</span>}
      </div>
      {open && total > 1 && (
        <div role="tablist" aria-label="The questions" className="flex flex-wrap gap-1.5">
          {it.questions.map((q, i) => (
            <Button key={q.question} variant="quiet" tiny on={i === here} role="tab" aria-selected={i === here} aria-label={`${label(q, i)}, ${done(q) ? "answered" : "not answered yet"}`} onClick={() => setPage(i)}>
              <Glyph state={done(q) ? "done" : "waiting"} size={14} />{label(q, i)}
            </Button>
          ))}
        </div>
      )}
      {open ? block(it.questions[here], true) : it.questions.map((q) => block(q, false))}
      {open ? (
        <div className="flex items-center justify-end gap-3">
          {!ready && here === total - 1 && total > 1 && <span className="mr-auto text-[13px] leading-5 text-text-tertiary">{label(it.questions[firstOpen], firstOpen)} is not answered yet</span>}
          <Button variant="quiet" onClick={() => onAnswer(null)} title={`Tell ${who} you would rather not answer`}>Skip</Button>
          {total > 1 && here > 0 && <Button variant="quiet" onClick={() => setPage(here - 1)}>Back</Button>}
          {total > 1 && here < total - 1 && <Button variant="quiet" onClick={() => setPage(here + 1)}>Next</Button>}
          {here === total - 1 && <Button onClick={submit} disabled={!ready}>Send answer</Button>}
        </div>
      ) : (
        <span className="flex items-center gap-2 text-[13px] leading-5 text-text-secondary"><Glyph state={it.status === "answered" ? "done" : "stopped"} size={14} /> {it.status === "answered" ? "You answered" : "You chose not to answer"}</span>
      )}
    </div>
  );
}

// Shown while a person works, so a quiet moment never looks like nothing happened: a live mark and a word that changes every few seconds.
const THINKING_WORDS = ["Mulling", "Pondering", "Shimmering", "Musing", "Brewing", "Tinkering", "Weaving", "Sifting", "Untangling", "Percolating", "Noodling", "Kneading", "Polishing", "Stirring", "Simmering", "Whittling"];
const pickWord = (not?: string) => { let w = not; while (w === not) w = THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)]; return w!; };

function Thinking({ who }: { who: string }) {
  const [word, setWord] = useState(() => pickWord());
  useEffect(() => {
    const t = setInterval(() => setWord((w) => pickWord(w)), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2.5" role="status" aria-label={`${who} is working`}>
      <Glyph state="live" size={16} color="var(--color-brand)" />
      <span className="kona-shimmer text-[14px] leading-5">{word}…</span>
    </div>
  );
}

function Transcript({ s, who, onAnswer, onQuestion }: { s: Session; who: string; onAnswer: (it: Extract<Item, { kind: "permission" }>, allow: boolean, remember?: unknown[]) => void; onQuestion: (it: Extract<Item, { kind: "question" }>, answers: Record<string, string> | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  // scroll the transcript itself: scrollIntoView also scrolls every box around it, which moved the office behind the page while the sheet slid in
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [s.items.length, s.draft, s.run]);
  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-8 pt-6 pb-3">
      {s.items.length === 0 && !s.draft && (
        <p className="m-0 max-w-[560px] text-text-tertiary">Ask {who} about this folder. Press Enter to send. Paste a picture to send it along.</p>
      )}
      {s.items.map((it) => {
        if (it.kind === "user")
          return (
            <div key={it.id} className="flex justify-end">
              <div className="flex max-w-[560px] min-w-0 flex-col gap-2 bg-surface-3 px-[18px] py-3.5 [overflow-wrap:anywhere]">
                {it.images.length > 0 && <div className="flex flex-wrap gap-2">{it.images.map((src, i) => <img key={i} src={src} alt="A picture you sent" className="h-20" />)}</div>}
                <span className="whitespace-pre-wrap">{it.text}</span>
              </div>
            </div>
          );
        if (it.kind === "assistant") return <div key={it.id} className="flex max-w-[calc(980px*var(--k))] min-w-0 flex-col gap-1"><span className="font-pixel text-[13px] leading-4 font-bold text-text-tertiary">{who}</span><Markdown chat text={it.text} wiki={false} /></div>;
        if (it.kind === "tool") return <ToolLine key={it.id} it={it} />;
        if (it.kind === "permission") return <PermissionCard key={it.id} it={it} who={who} onAnswer={(a, r) => onAnswer(it, a, r)} />;
        if (it.kind === "question") return <QuestionCard key={it.id} it={it} who={who} onAnswer={(a) => onQuestion(it, a)} />;
        return (
          <div key={it.id} className={`flex max-w-[calc(980px*var(--k))] items-start gap-2.5 text-[13px] leading-5 ${it.tone === "problem" ? "text-state-left" : "text-text-tertiary"}`}>
            <Glyph state={it.tone === "problem" ? "left" : "stopped"} size={16} /> <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{it.text}</span>
          </div>
        );
      })}
      {s.draft && <div className="flex max-w-[calc(980px*var(--k))] min-w-0 flex-col gap-1"><span className="font-pixel text-[13px] leading-4 font-bold text-text-tertiary">{who}</span><Markdown chat text={s.draft} wiki={false} /></div>}
      {s.run === "working" && <Thinking who={who} />}
    </div>
  );
}

const readImage = (f: File) =>
  new Promise<Attached>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const url = String(r.result); resolve({ mediaType: f.type, data: url.slice(url.indexOf(",") + 1), url }); };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

/** The message box. `run` is null before the first message (nothing is blocked then). */
export function Composer({ run, who, onSend, busyHint, queue = [], onQueue, onSendNow, onUnqueue, onStop }: {
  /** messages waiting for the answer to finish (shown above the box, each with Remove) */ queue?: Queued[]; /** the person is working: a message written now waits */ onQueue?: (text: string, images: Attached[]) => void;
  /** stop the turn and send this first */ onSendNow?: (text: string, images: Attached[]) => void; onUnqueue?: (id: string) => void; /** stop the turn, keep the conversation */ onStop?: () => void; run: RunState | null; who: string; onSend: (text: string, images: Attached[]) => void; busyHint?: string | null }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<Attached[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  // the box starts two lines tall and grows with the text up to six lines (24px each), then scrolls
  const fitBox = () => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 144)}px`;
  };
  useLayoutEffect(fitBox, [text]);
  useEffect(() => { // a window of another width wraps the text differently, and a tab that was hidden measures again when it shows
    const el = area.current;
    if (!el) return;
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => { if (el.clientWidth !== width) { width = el.clientWidth; fitBox(); } });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const working = run === "working" && !!onQueue; // while the person works, a message waits for the answer (or goes at once with Send now)
  const blocked = (run === "working" && !onQueue) || run === "waiting" || run === "ended" || run === "starting" || !!busyHint;
  const canSend = !blocked && (text.trim().length > 0 || images.length > 0);

  const add = async (files: File[]) => {
    const pics = files.filter((f) => f.type.startsWith("image/"));
    const read = await Promise.all(pics.map(readImage));
    setImages((cur) => [...cur, ...read]);
  };
  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.items].filter((i) => i.kind === "file" && i.type.startsWith("image/")).map((i) => i.getAsFile()).filter((f): f is File => !!f);
    if (files.length) { e.preventDefault(); void add(files); }
  };
  const send = () => { if (!canSend) return; (working ? onQueue! : onSend)(text.trim() || "(see the picture)", images); setText(""); setImages([]); };
  const sendNow = () => { if (!canSend || !working || !onSendNow) return; onSendNow(text.trim() || "(see the picture)", images); setText(""); setImages([]); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } };
  const hint = busyHint ?? (run === "waiting" ? `Answer ${who}'s question above first` : run === "working" && !working ? `${who} is working` : run === "ended" ? "This session has ended" : "");

  return (
    <div className="px-8 pb-6">
      <div className="flex flex-col gap-3 border border-line-strong bg-surface-2 px-[18px] pt-3.5 pb-3" onDrop={(e) => { e.preventDefault(); void add([...e.dataTransfer.files]); }} onDragOver={(e) => e.preventDefault()}>
        {queue.length > 0 && (
          <div className="flex flex-col gap-1.5" aria-label="Messages waiting to be sent">
            <span className="text-[13px] leading-5 text-text-tertiary">{queue.length === 1 ? "This message is sent when the answer is done" : "These messages are sent, in this order, when the answer is done"}</span>
            {queue.map((q) => (
              <div key={q.id} className="flex items-center gap-3 border border-line-subtle bg-surface-1 px-3 py-1.5" data-queued={q.id}>
                <span className="min-w-0 flex-1 truncate text-[14px] leading-5">{q.text}{q.images.length > 0 ? ` (+${q.images.length} picture${q.images.length === 1 ? "" : "s"})` : ""}</span>
                {onUnqueue && <Button variant="quiet" tiny onClick={() => onUnqueue(q.id)} aria-label={`Do not send: ${q.text.slice(0, 40)}`}>Remove</Button>}
              </div>
            ))}
          </div>
        )}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((im, i) => (
              <div key={i} className="flex flex-col items-start gap-1.5">
                <img src={im.url} alt="A picture waiting to be sent" className="h-16" />
                <Button variant="quiet" tiny aria-label="Remove this picture" onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={area} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onPaste={onPaste} rows={2} disabled={run === "ended"}
          placeholder={working ? `Message ${who}. Enter sends it when the answer is done.` : `Message ${who}. Press Enter to send, or paste a picture.`}
          className="w-full resize-none overflow-y-auto border-0 bg-transparent text-[15px] leading-6 text-text outline-none placeholder:text-text-tertiary"
          aria-label={`Message to ${who}`}
        />
        <div className="flex items-center justify-between">
          <Button variant="ghost" small onClick={() => file.current?.click()}>Add image</Button>
          <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <div className="flex items-center gap-3">
            {hint && <span className="text-[13px] leading-5 text-text-tertiary">{hint}</span>}
            {onStop && (run === "working" || run === "waiting") && <Button variant="danger" small onClick={onStop} title={`Stop what ${who} is doing now. The conversation stays open.${queue.length ? " Messages that are waiting are not sent." : ""}`}>Stop</Button>}
            {working && <Button variant="quiet" small onClick={sendNow} disabled={!canSend} title="Stop the answer and send this message at once">Send now</Button>}
            <Button small onClick={send} disabled={!canSend}>{working ? "Send after the answer" : "Send"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A person with no conversation yet: who they are and what they do, then the message box. The first message starts the session. */
export function EmptyChat({ role, project, kit, onTools, onFirst, busyHint, error }: {
  role: Role; project: Project; kit?: RoleKit; onTools?: () => void; onFirst: (text: string, images: Attached[]) => void; busyHint?: string | null; error?: string | null;
}) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <PersonHeader role={role} s={null} />
      <div className="mx-8 h-px bg-line-subtle" />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pt-6 pb-3">
        <div className="flex max-w-[620px] flex-col gap-2">
          <div className="flex items-center gap-2"><h2 className="m-0 text-[18px] leading-6 font-bold">Say hello to {role.person || role.name}</h2><Help title={`Talking to ${role.person || role.name}`}><p className="m-0">Nothing starts until you send a message. {role.person || "They"} works in {project.name}, and does one thing at a time here.</p></Help></div>
          <p className="m-0 text-[15px] leading-6 text-text-secondary">{role.brief.replace(/^You are working as the .*? role\.\s*/i, "")}</p>
        </div>
        <Needs project={project} role={role} kit={kit} onEdit={onTools} />
        {error && <p role="alert" className="m-0 max-w-[620px] text-[14px] leading-5 font-bold text-state-left">{error}</p>}
      </div>
      <Composer run={null} who={role.person || role.name} onSend={onFirst} busyHint={busyHint} />
    </div>
  );
}

/** The conversation with a person who has a session. */
export function Chat({ s, role, dispatch, onNote, onSaveAnswer, onNew }: {
  s: Session; role: Role; dispatch: (a: any) => void; onNote?: () => void; onSaveAnswer?: (text: string) => void; onNew: () => void;
}) {
  const who = role.person || role.name;
  // a session started from the Brain to answer a question: when it has answered, offer to keep the answer as a note
  const lastAnswer = [...s.items].reverse().find((it) => it.kind === "assistant") as Extract<Item, { kind: "assistant" }> | undefined;
  const answer = async (it: Extract<Item, { kind: "permission" }>, allow: boolean, remember?: unknown[]) => {
    dispatch({ type: "permission-answered", sessionId: s.id, requestId: it.requestId, allowed: allow });
    await invoke("answer_permission", { sessionId: s.id, requestId: it.requestId, allow, input: allow ? it.input : null, message: allow ? null : "The owner said no.", remember: allow && remember ? remember : null });
  };
  // the pick goes back as the answer of Claude's question tool (the same reply the allow-or-deny card uses); skipping says no with a plain reason
  const question = async (it: Extract<Item, { kind: "question" }>, answers: Record<string, string> | null) => {
    dispatch({ type: "question-answered", sessionId: s.id, requestId: it.requestId, answers });
    await invoke("answer_permission", { sessionId: s.id, requestId: it.requestId, allow: answers !== null, input: answers ? { ...(it.input as object), answers } : null, message: answers ? null : "The owner chose not to answer this question.", remember: null });
  };
  const send = async (text: string, images: Attached[]) => {
    // a private key never goes through a prompt (the core refuses it too)
    if (/PRIVATE KEY-----/.test(text)) {
      dispatch({ type: "event", sessionId: s.id, record: { type: "kona/refused", why: "the message holds the text of a private key. Keys stay in their files; give " + who + " the path, never the key." } });
      return;
    }
    await sendToSession(dispatch as (a: unknown) => void, s.id, text, images);
  };
  // while the person works: a message waits for the answer, Send now stops the turn and goes first, Stop stops it and drops what waits
  const queueIt = (text: string, images: Attached[]) => dispatch({ type: "queue-add", sessionId: s.id, item: { id: crypto.randomUUID(), text, images } });
  const sendNow = (text: string, images: Attached[]) => { dispatch({ type: "queue-add", sessionId: s.id, item: { id: crypto.randomUUID(), text, images }, front: true }); dispatch({ type: "stop-asked", sessionId: s.id, keepQueue: true }); void interruptSession(s.id); };
  const stopIt = () => { dispatch({ type: "stop-asked", sessionId: s.id, keepQueue: false }); void interruptSession(s.id); };
  // Claude Code's own /compact keeps what matters and drops the rest (tested in the stream mode Kona uses: 18,899 tokens became 1,466 and it still remembered the talk)
  const compact = async () => {
    dispatch({ type: "compacting", sessionId: s.id });
    try { await invoke("send_message", { sessionId: s.id, text: "/compact", images: [] }); }
    catch (e) { dispatch({ type: "event", sessionId: s.id, record: { type: "kona/stderr", text: `Could not make the memory smaller: ${String(e)}` } }); }
  };
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <PersonHeader role={role} s={s} onNote={onNote} onEnd={() => void invoke("stop_session", { sessionId: s.id })} onNew={onNew} onCompact={compact} />
      <div className="mx-8 h-px bg-line-subtle" />
      <Transcript s={s} who={who} onAnswer={answer} onQuestion={question} />
      {s.brainQuestion && s.run === "ready" && lastAnswer && onSaveAnswer && (
        <div className="mx-8 mb-3 flex items-center justify-between gap-4 border border-line-subtle bg-surface-2 px-4 py-3">
          <span className="text-[14px] leading-5 text-text-secondary">Save this answer to the brain? It becomes a note you can edit. Anything that looks like a secret is hidden first.</span>
          <span className="flex shrink-0 gap-2"><Button variant="ghost" small onClick={() => dispatch({ type: "brain-question", sessionId: s.id, question: null })}>Not now</Button><Button small onClick={() => onSaveAnswer(lastAnswer.text)}>Save to the brain</Button></span>
        </div>
      )}
      <Composer run={s.run} who={who} onSend={send} queue={s.queue} onQueue={queueIt} onSendNow={sendNow} onUnqueue={(id) => dispatch({ type: "queue-remove", sessionId: s.id, id })} onStop={stopIt} />
    </div>
  );
}
