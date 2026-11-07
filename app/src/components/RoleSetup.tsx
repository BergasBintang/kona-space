// The Set up tab of a person's sheet (decisions 50, 51 and 63): the person themselves, the same in every project: how they sound, the job, their voice, the model and the permissions.
// What a person may use IN A PROJECT (skills, connectors, tools) has tabs of its own: Skills and Tools. A change here is kept with Save and used by the next conversation.
import { useState } from "react";
import { type VoiceSettings, resetRole, roleLabel, saveRole, type Role } from "../lib/api";
import { modeWord } from "../lib/sessions";
import { Button } from "./ui";
import { Help } from "./Help";

const MODELS = [{ value: "sonnet", label: "Sonnet", hint: "Usual choice" }, { value: "opus", label: "Opus", hint: "Hard problems" }, { value: "haiku", label: "Haiku", hint: "Fast, cheap" }];
const MODES = [{ value: "plan", hint: "Reads only" }, { value: "default", hint: "Asks first" }, { value: "acceptEdits", hint: "Edits free" }, { value: "auto", hint: "A checker decides" }];
const STARTERS = ["Careful and blunt: says what is wrong first.", "Warm and patient: explains as if to a friend.", "Short and dry: facts only, no filler.", "Curious: asks one question before starting."];

const area = "border border-line-strong bg-inset px-3.5 py-3 text-[15px] leading-6 text-text placeholder:text-text-tertiary";

function Choice({ label, value, options, onChange, help }: { label: string; value: string; options: { value: string; label: string; hint: string }[]; onChange: (v: string) => void; help: React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-[13px] leading-5 font-bold text-text-secondary">{label}<Help title={label}>{help}</Help></span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o.value} variant="quiet" small role="radio" aria-checked={value === o.value} on={value === o.value} onClick={() => onChange(o.value)} title={o.hint || undefined}>{o.label}</Button>
        ))}
      </div>
      {options.find((o) => o.value === value)?.hint && <span className="text-[13px] leading-5 text-text-tertiary">{options.find((o) => o.value === value)?.hint}</span>}
    </div>
  );
}

export function RoleSetup({ role, onSaved }: { role: Role; onSaved: (r: Role) => void }) {
  const [persona, setPersona] = useState(role.persona ?? "");
  const [voice, setVoice] = useState<VoiceSettings>(role.voice);
  const [brief, setBrief] = useState(role.brief);
  const [model, setModel] = useState(role.model);
  const [mode, setMode] = useState(role.mode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);
  const words = persona.trim() ? persona.trim().split(/\s+/).length : 0;
  const who = role.person || "this person";

  const finish = async (work: () => Promise<Role>) => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const out = await work(); onSaved(out);
      setSaved(true); setConfirmReset(false); setPersona(out.persona ?? ""); setVoice(out.voice); setBrief(out.brief); setModel(out.model); setMode(out.mode);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };
  const save = () => finish(() => saveRole(role.id, { persona, brief, model, mode, voice }));
  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    void finish(() => resetRole(role.id));
  };

  return (
    <div aria-label={`Set up ${roleLabel(role)}`} className="@container flex min-h-0 w-full flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
      <section className="flex flex-col gap-4" aria-label="The role">
        <div className="flex items-center gap-2">
          <h2 className="m-0 text-[18px] leading-6 font-bold">{role.person || role.name} in every project</h2>
          <Help title="Set up"><p className="m-0">This is the same in every project. Every conversation with {role.person || role.name} begins with exactly this. What {who} may use in a project is on the Skills and Tools tabs.</p></Help>
        </div>
        <div className="grid grid-cols-1 items-start gap-x-10 gap-y-5 @3xl:grid-cols-2">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[15px] leading-6 font-bold">Tone<Help title="Tone"><p className="m-0">How {who} sounds, in your own words, for example careful and blunt, or warm and patient. Keep it short: it is sent at the start of every conversation.</p><p className="m-0">It changes the wording of chat replies only, never the work, the files, the tickets or the warnings.</p></Help></span>
              <textarea value={persona} onChange={(e) => setPersona(e.target.value)} rows={3} className={area} placeholder="For example: careful and blunt" />
              <span className="flex flex-wrap items-center gap-2">
                {STARTERS.map((s) => <Button key={s} variant="quiet" tiny onClick={() => setPersona(s)}>{s.split(":")[0]}</Button>)}
                <span className={`ml-auto text-[13px] leading-5 ${words > 150 ? "text-state-left" : "text-text-tertiary"}`}>{words} words</span>
              </span>
            </label>
            <label className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[15px] leading-6 font-bold">The job<Help title="The job"><p className="m-0">Told to Claude at the start of every session as this role. It says what the role is for and what it must not do.</p></Help></span>
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={10} className={area} />
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <div className="@container flex flex-col gap-4 border border-line-subtle bg-surface-1 p-4" role="group" aria-label="Voice">
              <div className="flex items-center gap-2"><h4 className="m-0 text-[15px] leading-6 font-bold">Voice</h4><Help title="Voice"><p className="m-0">How {who} talks to you in chat. Each person has their own, so two people can sound quite different.</p><p className="m-0">The voice never touches code, files, tickets, commands, warnings or numbers, and it never changes a fact.</p></Help></div>
              <div className="grid grid-cols-1 gap-5 @md:grid-cols-2">
                <Choice label="Length of replies" value={voice.verbosity} options={[{ value: "terse", label: "Short", hint: "A few sentences, the answer first" }, { value: "normal", label: "Normal", hint: "Enough to be clear, no more" }, { value: "detailed", label: "Full", hint: "Full explanations when the topic needs them" }]} onChange={(v) => setVoice({ ...voice, verbosity: v })} help={<p className="m-0">How long the replies usually are.</p>} />
                <Choice label="Humor" value={voice.humor} options={[{ value: "none", label: "None", hint: "No jokes" }, { value: "light", label: "A little", hint: "A light touch, never at the cost of clarity" }]} onChange={(v) => setVoice({ ...voice, humor: v })} help={<p className="m-0">Whether a joke is allowed now and then.</p>} />
              </div>
              <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                <label className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">Language</span>
                  <input value={voice.language} onChange={(e) => setVoice({ ...voice, language: e.target.value })} maxLength={40} aria-label="Language" className="bare h-10 border border-line-strong bg-inset px-3 text-[15px] text-text" /></label>
                <label className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">What {role.person || "they"} calls you</span>
                  <input value={voice.address} onChange={(e) => setVoice({ ...voice, address: e.target.value })} maxLength={40} placeholder="Nothing: no name or nickname" aria-label="What it calls you" className="bare h-10 border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-text-tertiary" /></label>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={voice.plain} onChange={(e) => setVoice({ ...voice, plain: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />Plain words, and a short explanation after a technical term</label>
                <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={voice.emoji} onChange={(e) => setVoice({ ...voice, emoji: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />Emoji allowed</label>
              </div>
            </div>
            <div className="@container"><div className="grid grid-cols-1 gap-5 @md:grid-cols-2">
              <Choice label="Model" value={model} options={MODELS} onChange={setModel} help={<p className="m-0">Sonnet is the usual choice. Opus is slower and costs more of your plan, and is for hard problems. Haiku is fast and cheap, for simple jobs.</p>} />
              <Choice label="Permissions" value={mode} options={MODES.map((m) => ({ ...m, label: modeWord(m.value), hint: "" }))} onChange={setMode} help={<><p className="m-0">Plan only: the role reads and plans and changes nothing.</p><p className="m-0">Ask every time: it asks before every change.</p><p className="m-0">Edits free, commands asked: it edits files freely and asks before running commands.</p><p className="m-0">Auto: a safety checker built into Claude Code decides, so you are asked only when it holds something back. Commands to a server still ask. It needs an account and a model that Claude Code allows it for.</p></>} />
            </div></div>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="m-0 text-[14px] leading-5 font-bold text-state-left">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={busy}>Save</Button>
        {saved && <span role="status" className="text-[14px] leading-5 text-text-secondary">Saved. It is used by the next conversation.</span>}
        <span className="flex-1" />
        <Button variant={confirmReset ? "danger" : "ghost"} small onClick={reset} disabled={busy}>{confirmReset ? "Yes, reset" : "Reset role"}</Button><Help title="Reset role"><p className="m-0">Puts the personality, the job, the voice, the model and the permissions back to the starting setup. The skills, connectors and tools of {who} in each project are not touched.</p></Help>
      </div>
    </div>
  );
}
