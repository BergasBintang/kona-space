// The Voice place: how Kona and Claude talk to you. One voice for everything (the owner's choice). It changes wording only:
// the scope clause that keeps it out of code, files, commands, warnings and numbers is fixed and shown below.
import { useEffect, useState } from "react";
import { defaultPersona, personaPrompt, savePersona, type Persona } from "../lib/api";
import { Button, Glyph } from "./ui";
import { Select } from "./pick";
import { Help } from "./Help";

const LENGTHS = [{ value: "terse", label: "Short", hint: "A few sentences, the answer first" }, { value: "normal", label: "Normal", hint: "Enough to be clear" }, { value: "detailed", label: "Detailed", hint: "Full explanations when the topic needs them" }];
const HUMOR = [{ value: "none", label: "No jokes" }, { value: "light", label: "A light touch" }];

function Check({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1.5 h-4 w-4 accent-[var(--color-accent)]" />
      <span className="flex flex-col"><span className="font-bold">{label}</span>{hint && <span className="text-[13px] leading-5 text-text-secondary">{hint}</span>}</span>
    </label>
  );
}

const field = "h-11 border border-line-strong bg-inset px-3.5 text-[15px] text-text placeholder:text-text-tertiary";

export function Voice({ persona, onChanged }: { persona: Persona; onChanged: (p: Persona) => void }) {
  const [draft, setDraft] = useState<Persona>(persona);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const changed = JSON.stringify(draft) !== JSON.stringify(persona);
  const set = (patch: Partial<Persona>) => { setDraft((d) => ({ ...d, ...patch })); setSaved(false); };
  const setLine = (k: keyof Persona["lines"], v: string) => { setDraft((d) => ({ ...d, lines: { ...d.lines, [k]: v } })); setSaved(false); };

  // show exactly what Claude would be told
  useEffect(() => { let live = true; personaPrompt(draft).then((p) => { if (live) setPrompt(p); }).catch(() => {}); return () => { live = false; }; }, [draft]);

  const save = async () => {
    setError(null);
    try { const out = await savePersona(draft); onChanged(out); setDraft(out); setSaved(true); } catch (e) { setError(String(e)); }
  };
  const reset = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false); setDraft(await defaultPersona()); setSaved(false);
  };
  const words = draft.voice.trim() ? draft.voice.trim().split(/\s+/).length : 0;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[calc(880px*var(--k))] flex-col gap-6 px-8 pt-8 pb-10">
        <div className="flex items-center gap-3"><h1 className="m-0 text-[30px] leading-[38px] font-bold">Voice</h1><Help title="Voice"><p className="m-0">How Claude talks to you in chat, and a few lines in Kona's own screens.</p><p className="m-0">It changes the wording only. It never changes what Claude does, and it never touches code, files, commands, warnings or numbers.</p></Help></div>

        <Check label="Use this voice" hint="Turn it off to get plain Claude. You can also turn it off for one session when you start it." on={draft.enabled} onChange={(v) => set({ enabled: v })} />

        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Describe the voice</span>
          <textarea value={draft.voice} onChange={(e) => set({ voice: e.target.value })} rows={3}
            className="border border-line-strong bg-inset px-3.5 py-3 text-[15px] leading-6 text-text placeholder:text-text-tertiary" placeholder="A terse operator. Short sentences. Facts first." />
          <span className={`text-[13px] leading-5 ${words > 300 ? "text-state-left" : "text-text-tertiary"}`}>{words} words. It is sent at the start of every session, so keep it under 300.</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] leading-5 font-bold text-text-secondary">Language</span>
            <input value={draft.language} onChange={(e) => set({ language: e.target.value })} placeholder="English" className={field} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] leading-5 font-bold text-text-secondary">What to call you</span>
            <input value={draft.address} onChange={(e) => set({ address: e.target.value })} placeholder="Nothing: no name or nickname" className={field} />
          </label>
          <Select label="Length of answers" value={draft.verbosity} onChange={(v) => set({ verbosity: v })} options={LENGTHS} />
          <Select label="Humor" value={draft.humor} onChange={(v) => set({ humor: v })} options={HUMOR} />
        </div>

        <div className="flex flex-col gap-3">
          <Check label="Plain words" hint="Everyday words. A technical term is followed by a few plain words." on={draft.plain} onChange={(v) => set({ plain: v })} />
          <Check label="Emoji" hint="Allow emoji in chat replies." on={draft.emoji} onChange={(v) => set({ emoji: v })} />
        </div>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-1 p-0 text-[13px] leading-5 font-bold text-text-secondary">Kona's own lines</legend>
          {([["greeting", "On the start screen"], ["started", "When a session starts"], ["ended", "When a session ends"], ["limit", "Near the plan limit"]] as const).map(([k, label]) => (
            <label key={k} className="grid grid-cols-[170px_minmax(0,1fr)] items-center gap-3">
              <span className="text-[14px] leading-5 text-text-secondary">{label}</span>
              <input value={draft.lines[k]} onChange={(e) => setLine(k, e.target.value)} className={field} />
            </label>
          ))}
          <span className="text-[13px] leading-5 text-text-tertiary">Write <code className="font-mono">{"{project}"}</code> where the project's name should go. Permission questions, warnings and error messages always stay plain.</span>
        </fieldset>

        <details className="border border-line-subtle bg-surface-1 px-4 py-3">
          <summary className="cursor-pointer text-[14px] leading-5 font-bold text-text-secondary">What Claude is told</summary>
          <p className="mt-3 mb-0 whitespace-pre-wrap font-mono text-[13px] leading-5 text-text-secondary">{prompt || "Nothing: the voice is off."}</p>
        </details>

        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex items-center justify-between gap-3">
          <Button variant={confirmReset ? "danger" : "ghost"} onClick={reset}>{confirmReset ? "Yes, go back to the first voice" : "Go back to the first voice"}</Button>
          <div className="flex items-center gap-3">
            {saved && !changed && <span className="flex items-center gap-2 text-[13px] text-text-secondary"><Glyph state="done" size={16} /> Saved</span>}
            <Button onClick={save} disabled={!changed}>Save</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
