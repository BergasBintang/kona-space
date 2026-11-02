// All the tools Kona can look for: the ten that come with Kona (read only) and the owner's own, which can be added, changed and removed (decision 65). A section of the Tools tab.
// A tool of your own is a program name and one of a few version flags ("terraform" and "version"): that is all Kona ever runs, once, to see whether it is there.
import { useEffect, useState } from "react";
import { deleteTool, listTools, saveTool, type ToolInfo } from "../lib/api";
import { Button } from "./ui";
import { Help } from "./Help";
import { Select } from "./pick";

const FLAGS = ["--version", "-version", "-v", "-V", "version"];
const field = "bare h-10 border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-text-tertiary";
type Draft = { id: string; name: string; program: string; flag: string; install: string };
const EMPTY: Draft = { id: "", name: "", program: "", flag: "--version", install: "" };

export function ToolsLibrary({ onChanged }: { onChanged: () => void }) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => listTools().then(setTools).catch((e) => setError(String(e)));
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!draft) return;
    setBusy(true); setError(null);
    try { await saveTool({ id: draft.id, name: draft.name, program: draft.program, flag: draft.flag, install: draft.install }); setDraft(null); await load(); onChanged(); }
    catch (e) { setError(String(e)); }
    setBusy(false);
  };
  const remove = async (id: string) => {
    setBusy(true); setError(null);
    try { await deleteTool(id); setSure(null); await load(); onChanged(); } catch (e) { setError(String(e)); }
    setBusy(false);
  };
  const own = tools.filter((t) => !t.builtin);

  return (
    <section aria-label="All the tools Kona can look for" className="flex flex-col gap-4 border border-line-subtle bg-surface-1 px-4 py-4">
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-[16px] leading-6 font-bold">All the tools Kona can look for</h2>
        <Help title="All the tools Kona can look for"><p className="m-0">These are the tools any person can be asked to have, in every project. The ten built in cannot be changed. Add your own with a program name and how it shows its version; Kona runs only that one command, to look, and never installs anything.</p><p className="m-0">A tool that is not in the search above can be made here.</p></Help>
      </div>

      <div className="flex flex-col">
        {tools.map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-b border-line-subtle px-1 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-baseline gap-2"><span className="font-bold">{t.name}</span><span className="text-[12px] leading-5 text-text-tertiary">{t.builtin ? "built in" : "yours"}</span></span>
              <span className="truncate font-mono text-[13px] leading-5 text-text-secondary">{t.program} {t.flag}</span>
              {t.install && <span className="truncate text-[13px] leading-5 text-text-tertiary" title={t.install}>{t.install}</span>}
            </span>
            {!t.builtin && (sure === t.id
              ? <span className="flex shrink-0 items-center gap-2 text-[13px]">Remove it? <Button variant="danger" small disabled={busy} onClick={() => void remove(t.id)}>Yes, remove</Button><Button variant="quiet" small onClick={() => setSure(null)}>No</Button></span>
              : <span className="flex shrink-0 gap-2"><Button variant="quiet" small onClick={() => { setDraft({ id: t.id, name: t.name, program: t.program, flag: t.flag, install: t.install }); setError(null); }}>Change</Button><Button variant="ghost" small onClick={() => setSure(t.id)}>Remove</Button></span>)}
          </div>
        ))}
        {own.length === 0 && <p className="m-0 px-1 py-3 text-[14px] leading-5 text-text-tertiary">None of your own yet.</p>}
      </div>

      {draft ? (
        <div className="flex flex-col gap-3 border border-line-subtle bg-surface-2 p-4" role="group" aria-label={draft.id ? "Change the tool" : "A new tool"}>
          <h3 className="m-0 text-[16px] leading-6 font-bold">{draft.id ? `Change ${draft.name || "the tool"}` : "A new tool"}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">Name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} placeholder="Terraform" aria-label="Tool name" className={field} autoFocus /></label>
            <label className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">Program</span>
              <input value={draft.program} onChange={(e) => setDraft({ ...draft, program: e.target.value })} maxLength={40} placeholder="terraform" aria-label="Program name" className={`${field} font-mono`} /></label>
            <div className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">Asks for its version with</span>
              <Select ariaLabel="Version flag" search={false} value={draft.flag} onChange={(v) => setDraft({ ...draft, flag: v })} options={FLAGS.map((f) => ({ value: f, label: f }))} /></div>
            <label className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">How to get it (a note, never run)</span>
              <input value={draft.install} onChange={(e) => setDraft({ ...draft, install: e.target.value })} maxLength={160} placeholder="winget install Hashicorp.Terraform" aria-label="How to get it" className={field} /></label>
          </div>
          <p className="m-0 text-[13px] leading-5 text-text-tertiary">Kona will run: <span className="font-mono">{draft.program.trim() || "program"} {draft.flag}</span></p>
          <div className="flex gap-3"><Button onClick={() => void save()} disabled={busy || !draft.name.trim() || !draft.program.trim()}>{draft.id ? "Save the change" : "Add the tool"}</Button><Button variant="quiet" onClick={() => { setDraft(null); setError(null); }}>Cancel</Button></div>
        </div>
      ) : (
        <div><Button variant="quiet" small onClick={() => { setDraft(EMPTY); setError(null); }}>+ A new tool</Button></div>
      )}
      {error && <p role="alert" className="m-0 text-[14px] leading-5 font-bold text-state-left">{error}</p>}
    </section>
  );
}
