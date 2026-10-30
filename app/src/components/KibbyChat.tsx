// Talking to Kibby, the office boy: a dialog at the bottom of the office like the ones in an old role-playing game. His name sits on a tab, his face beside the box, and what
// he says types out letter by letter (a click, or the Windows "reduce motion" setting, shows it at once). He is a Haiku call with no tools (src-tauri/src/kibby.rs): he
// can chat about anything, and he cannot read or change anything. The talk lives here only; it is gone when the dialog closes. He starts with a plain "Hi!".
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { KibbyFace } from "./ui";

export type Turn = { who: "you" | "kibby"; text: string };
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const GREETING = "Hi!";
const TYPE_MS = 28;

export function KibbyChat({ onSay, onClose }: { onSay: (history: Turn[], message: string) => Promise<string>; onClose: () => void }) {
  const [history, setHistory] = useState<Turn[]>([{ who: "kibby", text: GREETING }]);
  const [line, setLine] = useState(GREETING); // what he is saying now
  const [shown, setShown] = useState(reduced() ? GREETING.length : 0); // how many letters of it are on the screen
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
      setHistory((h) => [...h, { who: "kibby", text: reply }]);
      say(reply);
    } catch (e) {
      if (live.current) say(`Hmm, I cannot think just now. ${String(e).replace(/^Error: /, "")}`);
    }
    if (live.current) setThinking(false);
  };

  return (
    <div className="absolute right-0 bottom-6 left-0 flex justify-center px-6" role="dialog" aria-label="Talking to Kibby">
      <div className="relative flex w-full max-w-[720px] items-end gap-0">
        <div className="relative z-10 -mr-3 -mb-1 shrink-0"><KibbyFace scale={6} /></div>
        <div className="px-card relative flex min-w-0 flex-1 flex-col gap-2 p-3 pt-5">
          <span className="font-pixel absolute -top-3 left-4 border-2 border-line-strong bg-surface-2 px-2 text-[14px] leading-5 font-bold text-text px-shadow">Kibby</span>
          {said && <p className="m-0 truncate text-[13px] leading-5 text-text-tertiary">You: {said}</p>}
          <div className="min-h-[60px] cursor-default text-[16px] leading-6 text-text" onClick={() => setShown(line.length)}>
            {thinking ? <span className="text-text-secondary">Kibby is thinking…</span> : <p className="m-0" aria-hidden="true">{line.slice(0, shown)}{typing && <span className="text-text-tertiary">▌</span>}</p>}
            <span className="sr-only" role="status">{!thinking && !typing ? line : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} disabled={thinking} placeholder="Say something to Kibby…" aria-label="Say something to Kibby"
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
