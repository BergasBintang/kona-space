// Talking to Kibby or Bako, the two office boys: a dialog at the bottom of the office like the ones in an old role-playing game. The name sits on a tab, the face beside the box, and what
// they say types out letter by letter (a click, or the Windows "reduce motion" setting, shows it at once). Each is a Haiku call with no tools (src-tauri/src/kibby.rs): they
// can chat about anything, and they cannot read or change anything. The talk lives here only; it is gone when the dialog closes. Kibby starts with a plain "Hi!", Bako with a gossip's hello.
import { useEffect, useRef, useState } from "react";
import { Button, OfficeFace } from "./ui";

export type Who = "kibby" | "bako";
export type Turn = { who: "you" | Who; text: string };
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const NAME: Record<Who, string> = { kibby: "Kibby", bako: "Bako" };
const GREETING: Record<Who, string> = { kibby: "Hi!", bako: "Oh hey, you! Got a minute? I heard something." };
const TYPE_MS = 28;

export function KibbyChat({ who, onSay, onClose }: { who: Who; onSay: (history: Turn[], message: string) => Promise<string>; onClose: () => void }) {
  const name = NAME[who], greeting = GREETING[who];
  const [history, setHistory] = useState<Turn[]>([{ who, text: greeting }]);
  const [line, setLine] = useState(greeting); // what he is saying now
  const [shown, setShown] = useState(reduced() ? greeting.length : 0); // how many letters of it are on the screen
  const [thinking, setThinking] = useState(false);
  const [said, setSaid] = useState<string | null>(null); // what you said last, shown small above him
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  useEffect(() => { // the letters
    if (shown >= line.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), TYPE_MS);
    return () => clearTimeout(t);
  }, [shown, line]);
  const typing = shown < line.length;
  useEffect(() => { if (!thinking) input.current?.focus(); }, [thinking]);

  const say = (text: string) => { setLine(text); setShown(reduced() ? text.length : 0); };
  const send = async () => {
    const message = draft.trim();
    if (!message || thinking) return;
    const before = history;
    setHistory([...before, { who: "you", text: message }]);
    setSaid(message); setDraft(""); setThinking(true);
    try {
      const reply = await onSay(before, message);
      if (!live.current) return;
      setHistory((h) => [...h, { who, text: reply }]);
      say(reply);
    } catch (e) {
      if (live.current) say(`Hmm, I cannot think just now. ${String(e).replace(/^Error: /, "")}`);
    }
    if (live.current) setThinking(false);
  };

  return (
    <div className="absolute right-0 bottom-6 left-0 flex justify-center px-6" role="dialog" aria-label={`Talking to ${name}`}>
      <div className="relative flex w-full max-w-[720px] items-end gap-0">
        <div className="relative z-10 -mr-3 -mb-1 shrink-0"><OfficeFace who={who} scale={6} /></div>
        <div className="px-card relative flex min-w-0 flex-1 flex-col gap-2 p-3 pt-5">
          <span className="font-pixel absolute -top-3 left-4 border-2 border-line-strong bg-surface-2 px-2 text-[14px] leading-5 font-bold text-text px-shadow">{name}</span>
          {said && <p className="m-0 truncate text-[13px] leading-5 text-text-tertiary">You: {said}</p>}
          <div className="min-h-[60px] cursor-default text-[16px] leading-6 text-text" onClick={() => setShown(line.length)}>
            {thinking ? <span className="text-text-secondary">{name} is thinking…</span> : <p className="m-0" aria-hidden="true">{line.slice(0, shown)}{typing && <span className="text-text-tertiary">▌</span>}</p>}
            <span className="sr-only" role="status">{!thinking && !typing ? line : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} disabled={thinking} placeholder={`Say something to ${name}…`} aria-label={`Say something to ${name}`}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } else if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
              className="h-10 min-w-0 flex-1 border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-text-tertiary" />
            <Button small onClick={() => void send()} disabled={thinking || !draft.trim()}>Send</Button>
            <Button small variant="ghost" onClick={onClose}>Bye</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
