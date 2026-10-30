// Set up a role (decisions 50 and 51). Two parts, kept apart on purpose:
//   the role itself, the same in every project: personality, the job, model, permission mode;
//   what the role may use IN THIS PROJECT: its skills (they live in the project's own .kona\skills folder) and its tool connectors.
// Everything not ticked is left out of the session, so it costs no tokens. A skill on this computer is only a place to copy from: it does nothing
// for any session until it is copied into the project. A dialog, like the "?" help.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computerSkills, importSkill, mcpCatalog, resetRole, saveRole, saveRoleKit, skillCatalog, skillFolder, type McpInfo, type Project, type Role, type RoleKit, type SkillInfo } from "../lib/api";
import { modeWord } from "../lib/sessions";
import { Button, RoleMark } from "./ui";

const MODELS = [{ value: "sonnet", label: "Sonnet", hint: "The usual choice" }, { value: "opus", label: "Opus", hint: "Slower, for hard problems" }, { value: "haiku", label: "Haiku", hint: "Fast and cheap" }];
const MODES = [{ value: "plan", hint: "Reads and plans, changes nothing" }, { value: "default", hint: "Asks before every change" }, { value: "acceptEdits", hint: "Edits files freely, asks before commands" }];
const STARTERS = ["Careful and blunt: says what is wrong first.", "Warm and patient: explains as if to a friend.", "Short and dry: facts only, no filler.", "Curious: asks one question before starting."];

const area = "border border-line-strong bg-inset px-3.5 py-3 text-[15px] leading-6 text-text placeholder:text-text-tertiary";

function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string; hint: string }[]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-[13px] leading-5 font-bold text-text-secondary">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} title={o.hint}
            className={`h-10 border-2 px-3 text-[14px] font-bold ${value === o.value ? "border-accent bg-surface-3 text-text" : "border-line-subtle bg-surface-2 text-text-secondary hover:bg-surface-3"}`}>{o.label}</button>
        ))}
      </div>
      <span className="text-[13px] leading-5 text-text-tertiary">{options.find((o) => o.value === value)?.hint}</span>
    </div>
  );
}

function Pick({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h4 className="m-0 text-[15px] leading-6 font-bold">{title}</h4>
      {empty ? <p className="m-0 text-[14px] leading-5 text-text-tertiary">{empty}</p> : <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto border border-line-subtle bg-inset p-2">{children}</div>}
    </section>
  );
}

function Row({ on, onChange, name, tag, hint, note }: { on: boolean; onChange: (v: boolean) => void; name: string; tag: string; hint?: string; note?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-1 py-1.5 hover:bg-surface-3">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]" />
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-baseline gap-x-2"><span className="font-bold">{name}</span><span className="text-[12px] leading-5 text-text-tertiary">{tag}</span>{note && <span className="text-[12px] leading-5 text-text-tertiary">{note}</span>}</span>
        {hint && <span className="text-[13px] leading-5 text-text-secondary">{hint}</span>}
      </span>
    </label>
  );
}

export function RoleSetup({ role, project, accountId, kit, onSaved, onKitSaved, onClose }: {
  role: Role; project: Project; accountId: string | null; kit: RoleKit; onSaved: (r: Role) => void; onKitSaved: (roleId: string, kit: RoleKit) => void; onClose: () => void;
}) {
  const [persona, setPersona] = useState(role.persona ?? "");
  const [brief, setBrief] = useState(role.brief);
  const [model, setModel] = useState(role.model);
  const [mode, setMode] = useState(role.mode);
  const [skills, setSkills] = useState<string[]>(kit.skills);
  const [mcp, setMcp] = useState<string[]>(kit.mcp);
  const [catalog, setCatalog] = useState<SkillInfo[] | null>(null);
  const [computer, setComputer] = useState<SkillInfo[] | null>(null);
  const [servers, setServers] = useState<McpInfo[] | null>(null);
  const [folder, setFolder] = useState("");
  const [showComputer, setShowComputer] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const first = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    let live = true;
    skillCatalog(project.folder).then((c) => { if (live) setCatalog(c); }).catch(() => { if (live) setCatalog([]); });
    computerSkills(accountId, project.folder).then((c) => { if (live) setComputer(c); }).catch(() => { if (live) setComputer([]); });
    mcpCatalog(accountId, project.folder).then((c) => { if (live) setServers(c); }).catch(() => { if (live) setServers([]); });
    skillFolder(project.folder).then((p) => { if (live) setFolder(p); }).catch(() => {});
    return () => { live = false; };
  }, [accountId, project.folder]);

  const toggle = (list: string[], set: (v: string[]) => void, name: string, on: boolean) => set(on ? [...list, name] : list.filter((x) => x !== name));
  const cost = useMemo(() => (catalog ?? []).filter((s) => skills.includes(s.name)).reduce((n, s) => n + s.tokens, 0), [catalog, skills]);
  const picked = skills.filter((s) => catalog?.some((c) => c.name === s)).length;
  const left = Math.max(0, (catalog?.length ?? 0) - picked);
  const words = persona.trim() ? persona.trim().split(/\s+/).length : 0;

  const copy = async (name: string) => {
    setCopying(name); setError(null);
    try {
      const got = await importSkill(accountId, project.folder, name);
      setCatalog((c) => [...(c ?? []), got].sort((a, b) => a.name.localeCompare(b.name)));
      setComputer((c) => (c ?? []).filter((s) => s.name !== name));
      setSkills((s) => (s.includes(name) ? s : [...s, name]));
    } catch (e) { setError(String(e)); }
    setCopying(null);
  };

  const finish = async (work: () => Promise<{ role: Role; kit: RoleKit }>) => {
    setBusy(true); setError(null);
    try { const out = await work(); onSaved(out.role); onKitSaved(role.id, out.kit); onClose(); } catch (e) { setError(String(e)); setBusy(false); }
  };
  const save = () => finish(async () => ({ role: await saveRole(role.id, { persona, brief, model, mode }), kit: await saveRoleKit(project.folder, role.id, { skills, mcp }) }));
  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    void finish(async () => ({ role: await resetRole(role.id), kit: await saveRoleKit(project.folder, role.id, { skills: [], mcp: [] }) }));
  };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Set up ${role.name}`} onKeyDown={onKey} className="flex max-h-full w-full max-w-[760px] flex-col gap-5 overflow-y-auto px-card px-shadow p-3">
        <div className="flex items-center gap-3">
          <RoleMark roleId={role.id} size={32} />
          <div className="flex flex-col"><h2 className="m-0 text-[22px] leading-7 font-bold">Set up {role.name}</h2><span className="text-[13px] leading-5 text-text-secondary">{role.group} · every session as {role.name} starts with exactly this</span></div>
        </div>

        <section className="flex flex-col gap-4" aria-label="The role">
          <h3 className="m-0 text-[17px] leading-6 font-bold">The role, in every project</h3>
          <label className="flex flex-col gap-2">
            <span className="text-[15px] leading-6 font-bold">Personality</span>
            <textarea ref={first} value={persona} onChange={(e) => setPersona(e.target.value)} rows={3} className={area} placeholder="How this role behaves and sounds. For example: careful and blunt, says what is wrong first." />
            <span className="flex flex-wrap items-center gap-2">
              {STARTERS.map((s) => <button key={s} type="button" onClick={() => setPersona(s)} className="border border-line-subtle bg-surface-2 px-2 py-0.5 text-[13px] leading-5 text-text-secondary hover:bg-surface-3">{s.split(":")[0]}</button>)}
              <span className={`ml-auto text-[13px] leading-5 ${words > 150 ? "text-state-left" : "text-text-tertiary"}`}>{words} words</span>
            </span>
            <span className="text-[13px] leading-5 text-text-tertiary">This is how the role works. Your Voice (how Claude words things to you) still applies on top, unless you turn it off for a session.</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[15px] leading-6 font-bold">The job</span>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} className={area} />
            <span className="text-[13px] leading-5 text-text-tertiary">Told to Claude at the start of every session as this role.</span>
          </label>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Choice label="Model" value={model} options={MODELS} onChange={setModel} />
            <Choice label="Permissions" value={mode} options={MODES.map((m) => ({ ...m, label: modeWord(m.value) }))} onChange={setMode} />
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-label={`In ${project.name}`}>
          <h3 className="m-0 text-[17px] leading-6 font-bold">In {project.name}</h3>
          <p className="m-0 text-[13px] leading-5 text-text-tertiary">Skills and connectors belong to the project. Another project has its own list for this role.</p>
          <Pick title="Skills of this project" empty={catalog && catalog.length === 0 ? "This project has no skills yet. Copy one from this computer below, or put a skill folder in the folder named at the bottom." : undefined}>
            {catalog === null ? <span className="text-[14px] text-text-tertiary">Looking…</span> : catalog.map((s) => (
              <Row key={s.name} on={skills.includes(s.name)} onChange={(v) => toggle(skills, setSkills, s.name, v)} name={s.name} tag="in this project" note={`about ${s.tokens} tokens`} hint={s.description} />
            ))}
          </Pick>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => setShowComputer((v) => !v)} aria-expanded={showComputer} className="self-start border border-line-subtle bg-surface-2 px-2.5 py-1 text-[14px] font-bold text-text-secondary hover:bg-surface-3">
              {showComputer ? "Hide" : "Copy a skill from this computer"}{computer && computer.length > 0 && !showComputer ? ` (${computer.length} found)` : ""}
            </button>
            {showComputer && (computer === null ? <span className="text-[14px] text-text-tertiary">Looking…</span> : computer.length === 0
              ? <p className="m-0 text-[14px] leading-5 text-text-tertiary">Nothing else found on this computer.</p>
              : (
                <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto border border-line-subtle bg-inset p-2">
                  <p className="m-0 px-1 text-[13px] leading-5 text-text-tertiary">These do nothing in any session until you copy them into {project.name}. A copy is a separate file: changing it here does not change the original.</p>
                  {computer.map((s) => (
                    <div key={s.name} className="flex items-start gap-3 px-1 py-1.5">
                      <span className="flex min-w-0 flex-1 flex-col"><span className="flex flex-wrap items-baseline gap-x-2"><span className="font-bold">{s.name}</span><span className="text-[12px] leading-5 text-text-tertiary">about {s.tokens} tokens</span></span><span className="text-[13px] leading-5 text-text-secondary">{s.description}</span></span>
                      <Button small variant="quiet" disabled={copying !== null || busy} onClick={() => void copy(s.name)}>{copying === s.name ? "Copying…" : "Copy here"}</Button>
                    </div>
                  ))}
                </div>
              ))}
          </div>
          <Pick title="Connectors" empty={servers && servers.length === 0 ? "No connectors found for this project. Add one in Claude Code (claude mcp add) and it appears here. Connectors of your Claude account, like Google Drive, are off in every role." : undefined}>
            {servers === null ? <span className="text-[14px] text-text-tertiary">Looking…</span> : servers.map((s) => (
              <Row key={s.name} on={mcp.includes(s.name)} onChange={(v) => toggle(mcp, setMcp, s.name, v)} name={s.name} tag={s.kind} hint={`From ${s.source}.`} />
            ))}
          </Pick>
        </section>

        <p className="m-0 text-[14px] leading-5 text-text-secondary" role="status">
          {picked === 0 ? "No skills" : `${picked} skill${picked === 1 ? "" : "s"}, about ${cost} tokens`} at the start of every session as {role.name} in {project.name}.{left > 0 ? ` ${left} other skill${left === 1 ? " is" : "s are"} left out.` : ""} Kona's board tools are always there. Everything else is left out.
          {folder && <span className="block text-text-tertiary">This project's skills live in {folder}</span>}
        </p>

        {error && <p role="alert" className="m-0 text-[14px] leading-5 font-bold text-state-left">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void save()} disabled={busy}>Save</Button>
          <Button variant="quiet" onClick={onClose} disabled={busy}>Cancel</Button>
          <span className="flex-1" />
          <Button variant={confirmReset ? "danger" : "ghost"} small onClick={reset} disabled={busy}>{confirmReset ? "Yes, back to the start" : "Back to the starting setup"}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
