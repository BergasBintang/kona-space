// The chat of one session: header, transcript, the "may I run this?" card, and the message box.
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Badge, Button, Glyph, type GlyphState } from "./ui";
import { dollars, modeWord, permissionTitle, type Item, type Session } from "../lib/sessions";

const RUN_BADGE: Record<Session["run"], { state: GlyphState; label: string }> = {
  starting: { state: "idle", label: "Starting" },
  ready: { state: "idle", label: "Ready for you" },
  working: { state: "live", label: "Working" },
  waiting: { state: "waiting", label: "Waiting on you" },
  ended: { state: "stopped", label: "Ended" },
};

const folderName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;

export function Header({ s, onStop }: { s: Session; onStop: () => void }) {
  const b = RUN_BADGE[s.run];
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-[22px] pb-[18px]">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="m-0 truncate text-[22px] leading-[30px] font-bold">{folderName(s.folder)}</h1>
        <div className="flex flex-wrap items-center gap-3 text-[13px] leading-5 text-text-secondary">
          <Badge state={b.state} label={b.label} />
          <span>{s.model}</span>
          <span>{modeWord(s.mode)}</span>
          <span className="truncate font-mono text-text-tertiary" title={s.folder}>{s.folder}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-5">
        <div className="flex flex-col items-end">
          <span className="font-mono text-[14px] font-bold">{dollars(s.costTotal)} so far</span>
          <span className="text-[13px] leading-5 text-text-tertiary">An estimate, not your bill</span>
        </div>
        {s.run !== "ended" && <Button variant="quiet" small onClick={onStop}>Stop</Button>}
      </div>
    </div>
  );
}

function ToolLine({ it }: { it: Extract<Item, { kind: "tool" }> }) {
  const state: GlyphState = it.status === "running" ? "live" : it.status === "done" ? "done" : it.status === "denied" ? "stopped" : "left";
  const word = it.status === "running" ? "Running" : it.status === "done" ? "Done" : it.status === "denied" ? "You said no" : "Failed";
  return (
    <div className="flex max-w-[760px] items-center gap-2.5 rounded-control border border-line-subtle bg-surface-1 px-3.5 py-2.5">
      <Glyph state={state} size={16} />
      <span className="text-[13px] leading-5 text-text-secondary">{it.name}: {word}</span>
      {it.summary && <span className="truncate font-mono text-[13px] leading-5 text-text-tertiary">{it.summary}</span>}
    </div>
  );
}

function PermissionCard({ it, onAnswer }: { it: Extract<Item, { kind: "permission" }>; onAnswer: (allow: boolean) => void }) {
  const open = it.status === "asking";
  return (
    <div className="flex max-w-[680px] flex-col gap-4 rounded-dialog border border-line-subtle bg-surface-2 p-6" role="group" aria-label={permissionTitle(it.toolName)}>
      <div className="flex items-center gap-3">
        <Glyph state={open ? "waiting" : it.status === "allowed" ? "done" : "stopped"} size={22} />
        <h2 className="m-0 text-[17px] leading-6 font-bold">{permissionTitle(it.toolName)}</h2>
      </div>
      {it.description && <p className="m-0 text-text-secondary">{it.description}</p>}
      {it.command && (
        <div className="flex flex-col gap-1 rounded-control border border-line-subtle bg-inset p-3.5">
          <code className="font-mono text-[13px] leading-5 break-all whitespace-pre-wrap">{it.command}</code>
          {it.where && <span className="font-mono text-[13px] leading-5 text-text-tertiary">in {it.where}</span>}
        </div>
      )}
      {open ? (
        <div className="flex justify-end gap-3">
          <Button variant="quiet" onClick={() => onAnswer(false)}>Don’t allow</Button>
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

function Transcript({ s, onAnswer }: { s: Session; onAnswer: (it: Extract<Item, { kind: "permission" }>, allow: boolean) => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [s.items.length, s.draft]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pt-6 pb-3">
      {s.items.length === 0 && !s.draft && (
        <p className="m-0 max-w-[560px] text-text-tertiary">Ask Claude about this folder. Press Enter to send. Paste a picture to send it along.</p>
      )}
      {s.items.map((it) => {
        if (it.kind === "user")
          return (
            <div key={it.id} className="flex justify-end">
              <div className="flex max-w-[560px] flex-col gap-2 rounded-2xl bg-surface-3 px-[18px] py-3.5">
                {it.images.length > 0 && <div className="flex flex-wrap gap-2">{it.images.map((src, i) => <img key={i} src={src} alt="A picture you sent" className="h-20 rounded-control" />)}</div>}
                <span className="whitespace-pre-wrap">{it.text}</span>
              </div>
            </div>
          );
        if (it.kind === "assistant") return <p key={it.id} className="m-0 max-w-[760px] whitespace-pre-wrap">{it.text}</p>;
        if (it.kind === "tool") return <ToolLine key={it.id} it={it} />;
        if (it.kind === "permission") return <PermissionCard key={it.id} it={it} onAnswer={(a) => onAnswer(it, a)} />;
        return (
          <div key={it.id} className={`flex max-w-[760px] items-start gap-2.5 text-[13px] leading-5 ${it.tone === "problem" ? "text-state-left" : "text-text-tertiary"}`}>
            <Glyph state={it.tone === "problem" ? "left" : "stopped"} size={16} /> <span className="whitespace-pre-wrap">{it.text}</span>
          </div>
        );
      })}
      {s.draft && <p className="m-0 max-w-[760px] whitespace-pre-wrap">{s.draft}</p>}
      <div ref={end} />
    </div>
  );
}

type Attached = { mediaType: string; data: string; url: string };
const readImage = (f: File) =>
  new Promise<Attached>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const url = String(r.result); resolve({ mediaType: f.type, data: url.slice(url.indexOf(",") + 1), url }); };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

function Composer({ s, onSend }: { s: Session; onSend: (text: string, images: Attached[]) => void }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<Attached[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const blocked = s.run === "working" || s.run === "waiting" || s.run === "ended" || s.run === "starting";
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
  const send = () => { if (!canSend) return; onSend(text.trim() || "(see the picture)", images); setText(""); setImages([]); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const hint = s.run === "waiting" ? "Answer the question above first" : s.run === "working" ? "Claude is working" : s.run === "ended" ? "This session has ended" : "";

  return (
    <div className="px-8 pb-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-line-strong bg-surface-2 px-[18px] pt-3.5 pb-3" onDrop={(e) => { e.preventDefault(); void add([...e.dataTransfer.files]); }} onDragOver={(e) => e.preventDefault()}>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((im, i) => (
              <div key={i} className="relative">
                <img src={im.url} alt="A picture waiting to be sent" className="h-16 rounded-control" />
                <button className="absolute -top-2 -right-2 h-6 w-6 rounded-full border border-line-strong bg-surface-3 text-[13px] leading-none" aria-label="Remove this picture" onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onPaste={onPaste} rows={2} disabled={s.run === "ended"}
          placeholder="Message Claude. Press Enter to send, or paste a picture."
          className="w-full resize-none border-0 bg-transparent text-[15px] leading-6 text-text outline-none placeholder:text-text-tertiary"
          aria-label="Message to Claude"
        />
        <div className="flex items-center justify-between">
          <Button variant="ghost" small onClick={() => file.current?.click()}>Add image</Button>
          <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <div className="flex items-center gap-3">
            {hint && <span className="text-[13px] leading-5 text-text-tertiary">{hint}</span>}
            <Button small onClick={send} disabled={!canSend}>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Chat({ s, dispatch }: { s: Session; dispatch: (a: any) => void }) {
  const answer = async (it: Extract<Item, { kind: "permission" }>, allow: boolean) => {
    dispatch({ type: "permission-answered", sessionId: s.id, requestId: it.requestId, allowed: allow });
    await invoke("answer_permission", { sessionId: s.id, requestId: it.requestId, allow, input: allow ? it.input : null, message: allow ? null : "The owner said no." });
  };
  const send = async (text: string, images: Attached[]) => {
    dispatch({ type: "user-sent", sessionId: s.id, text, images: images.map((i) => i.url) });
    await invoke("send_message", { sessionId: s.id, text, images: images.map((i) => ({ media_type: i.mediaType, data: i.data })) });
  };
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <Header s={s} onStop={() => void invoke("stop_session", { sessionId: s.id })} />
      <div className="mx-8 h-px bg-line-subtle" />
      <Transcript s={s} onAnswer={answer} />
      <Composer s={s} onSend={send} />
    </div>
  );
}
