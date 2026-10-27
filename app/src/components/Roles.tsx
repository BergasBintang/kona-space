// The Roles place: the team. Each role is a saved setup for a session: its mark, model, permission mode and a short brief.
import { useEffect, useMemo, useState } from "react";
import { removeRole, saveRole, type Account, type Role, type ToolInfo } from "../lib/api";
import { Button, Glyph, MARKS, RoleMark } from "./ui";
import { MultiSelect, Select } from "./pick";
import { modeWord } from "../lib/sessions";

export const GROUPS = ["Plan", "Build", "Ship", "Grow"];
export const MODE_CHOICES: { id: string; word: string; says: string }[] = [
  { id: "default", word: "Ask every time", says: "Claude asks before it changes a file or runs a command." },
  { id: "acceptEdits", word: "Edits free, commands asked", says: "Claude changes files on its own, but asks before it runs a command." },
  { id: "plan", word: "Plan only", says: "Claude reads and plans. It changes nothing." },
];
export const MODEL_CHOICES = [["sonnet", "Sonnet (the usual choice)"], ["opus", "Opus (the most capable, slower)"], ["haiku", "Haiku (the quickest and cheapest)"]];

const blank = (): Role => ({ id: "", name: "", group: "Build", mark: "dot", model: "sonnet", mode: "default", brief: "", account: null, needs: [], own_copy: false });

export function Roles({ roles, accounts, tools, onChanged }: { roles: Role[]; accounts: Account[]; tools: ToolInfo[]; onChanged: (next: Role[]) => void }) {
  const [pickedId, setPickedId] = useState<string | null>(roles[0]?.id ?? null); // "" is a role not saved yet
  const saved = roles.find((r) => r.id === pickedId) ?? null;
  const [draft, setDraft] = useState<Role | null>(saved);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null); // the role just saved, for the "Saved" note

  useEffect(() => { setDraft(saved ?? (pickedId === "" ? blank() : null)); setError(null); setConfirmRemove(false); }, [pickedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const names = [...GROUPS, ...roles.map((r) => r.group).filter((g) => !GROUPS.includes(g))];
    return [...new Set(names)].map((g) => ({ name: g, roles: roles.filter((r) => r.group === g) })).filter((g) => g.roles.length > 0);
  }, [roles]);

  const changed = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved ?? (pickedId === "" ? blank() : null));
  const set = (patch: Partial<Role>) => { setDraft((d) => (d ? { ...d, ...patch } : d)); };

  const save = async () => {
    if (!draft) return;
    setError(null);
    try {
      const out = await saveRole(draft);
      onChanged(draft.id ? roles.map((r) => (r.id === out.id ? out : r)) : [...roles, out]);
      setPickedId(out.id); setDraft(out); setSavedId(out.id);
    } catch (e) { setError(String(e)); }
  };
  const remove = async () => {
    if (!saved) return;
    if (!confirmRemove) { setConfirmRemove(true); return; }
    try {
      await removeRole(saved.id);
      const next = roles.filter((r) => r.id !== saved.id);
      onChanged(next); setPickedId(next[0]?.id ?? null);
    } catch (e) { setError(String(e)); }
  };

  return (
    <>
      <div className="flex h-full w-[320px] shrink-0 flex-col gap-3.5 bg-ground px-2.5 pt-6 pb-5">
        <div className="flex items-center justify-between px-2.5">
          <h2 className="m-0 text-[17px] leading-6 font-bold">Roles</h2>
          <Button variant="quiet" small onClick={() => setPickedId("")}>New role</Button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" aria-label="Roles">
          {roles.length === 0 && <p className="m-0 px-2.5 text-[13px] leading-5 text-text-tertiary">No roles yet. Press New role.</p>}
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col gap-0.5">
              <span className="px-3.5 pb-1 text-[13px] leading-5 font-bold text-text-tertiary">{g.name}</span>
              {g.roles.map((r) => {
                const on = pickedId === r.id;
                return (
                  <button key={r.id} onClick={() => setPickedId(r.id)} aria-current={on ? "true" : undefined}
                    className={`flex h-14 items-center gap-3 rounded-xl px-3.5 text-left transition-colors ${on ? "bg-surface-3" : "hover:bg-surface-2"}`}>
                    <RoleMark mark={r.mark} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-bold">{r.name}</span>
                      <span className="truncate text-[13px] leading-5 text-text-tertiary">{modeWord(r.mode)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
      <div className="w-px bg-line-subtle" />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {!draft ? (
          <div className="flex flex-1 items-center justify-center p-8 text-text-tertiary">Pick a role on the left, or press New role.</div>
        ) : (
          <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-8 pt-8 pb-10">
            <div className="flex items-center gap-3.5">
              <RoleMark mark={draft.mark} size={44} />
              <h1 className="m-0 text-[26px] leading-[34px] font-bold">{draft.name.trim() || "New role"}</h1>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">Name</span>
              <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Mobile" className="h-11 rounded-control border border-line-strong bg-inset px-3.5 text-[15px] text-text placeholder:text-text-tertiary" />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <Select label="Group" value={draft.group} onChange={(v) => set({ group: v })} options={[...new Set([...GROUPS, draft.group])].map((g) => ({ value: g, label: g }))} />
              <Select label="Model" value={draft.model} onChange={(v) => set({ model: v })} options={MODEL_CHOICES.map(([value, label]) => ({ value, label }))} />
            </div>

            {accounts.length > 1 && (
              <Select label="Usual account" value={draft.account ?? ""} onChange={(v) => set({ account: v || null })}
                options={[{ value: "", label: "Whichever you used last" }, ...accounts.map((a) => ({ value: a.id, label: a.label }))]} />
            )}

            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-[13px] leading-5 font-bold text-text-secondary">Mark</legend>
              <div className="flex flex-wrap gap-2">
                {MARKS.map((m) => (
                  <button key={m} type="button" onClick={() => set({ mark: m })} aria-pressed={draft.mark === m} aria-label={`Mark ${m}`} title={m}
                    className={`rounded-xl p-1 ${draft.mark === m ? "ring-2 ring-accent" : "hover:bg-surface-2"}`}>
                    <RoleMark mark={m} size={32} />
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-[13px] leading-5 font-bold text-text-secondary">What Claude may do on its own</legend>
              {MODE_CHOICES.map((m) => {
                const on = draft.mode === m.id;
                return (
                  <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-control border px-4 py-3 ${on ? "border-accent bg-surface-2" : "border-line-subtle hover:bg-surface-1"}`}>
                    <input type="radio" name="mode" checked={on} onChange={() => set({ mode: m.id })} className="mt-1.5 accent-[var(--color-accent)]" />
                    <span className="flex flex-col">
                      <span className="font-bold">{m.word}</span>
                      <span className="text-[13px] leading-5 text-text-secondary">{m.says}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="flex flex-col gap-2">
              <MultiSelect label="Tools this role needs" values={draft.needs} onChange={(v) => set({ needs: v })} placeholder="None" options={tools.map((t) => ({ value: t.id, label: t.name }))} />
              <span className="text-[13px] leading-5 text-text-tertiary">Kona checks these are on this PC before a session starts. It only looks; it never installs.</span>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={!!draft.own_copy} onChange={(e) => set({ own_copy: e.target.checked })} className="mt-1.5 h-4 w-4 accent-[var(--color-accent)]" />
              <span className="flex flex-col"><span className="font-bold">Tickets work in their own copy of the repo</span><span className="text-[13px] leading-5 text-text-secondary">A separate folder on its own branch, so this role cannot step on your main folder or on another ticket. A ticket can override it.</span></span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">Brief</span>
              <textarea value={draft.brief} onChange={(e) => set({ brief: e.target.value })} rows={5}
                className="rounded-control border border-line-strong bg-inset px-3.5 py-3 text-[15px] leading-6 text-text placeholder:text-text-tertiary" placeholder="What this role does, in a few plain sentences." />
              <span className="text-[13px] leading-5 text-text-tertiary">Claude is told this at the start of every session run as this role.</span>
            </label>

            {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
            <div className="flex items-center justify-between gap-3">
              <div>
                {saved && <Button variant={confirmRemove ? "danger" : "ghost"} onClick={remove}>{confirmRemove ? "Yes, remove this role" : "Remove role"}</Button>}
              </div>
              <div className="flex items-center gap-3">
                {savedId !== null && savedId === draft.id && !changed && <span className="flex items-center gap-2 text-[13px] text-text-secondary"><Glyph state="done" size={16} /> Saved</span>}
                <Button onClick={save} disabled={!changed}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
