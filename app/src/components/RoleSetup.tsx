// Set up a role (decisions 50 and 51). Two parts, kept apart on purpose:
//   the role itself, the same in every project: personality, the job, model, permission mode;
//   what the role may use IN THIS PROJECT: its skills (they live in the project's own .kona\skills folder) and its tool connectors.
// Everything not ticked is left out of the session, so it costs no tokens. A skill on this computer is only a place to copy from: it does nothing
// for any session until it is copied into the project. A dialog, like the "?" help. The page keeps to short words; every full explanation is behind a "?".
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computerSkills, importSkill, mcpCatalog, resetRole, saveRole, saveRoleKit, skillCatalog, skillFolder, type McpInfo, type Project, type Role, type RoleKit, type SkillInfo } from "../lib/api";
import { modeWord } from "../lib/sessions";
import { Button, RoleMark } from "./ui";
import { Help } from "./Help";

const MODELS = [{ value: "sonnet", label: "Sonnet", hint: "Usual choice" }, { value: "opus", label: "Opus", hint: "Hard problems" }, { value: "haiku", label: "Haiku", hint: "Fast, cheap" }];
const MODES = [{ value: "plan", hint: "Reads only" }, { value: "default", hint: "Asks first" }, { value: "acceptEdits", hint: "Edits free" }];
const STARTERS = ["Careful and blunt: says what is wrong first.", "Warm and patient: explains as if to a friend.", "Short and dry: facts only, no filler.", "Curious: asks one question before starting."];

const area = "border border-line-strong bg-inset px-3.5 py-3 text-[15px] leading-6 text-text placeholder:text-text-tertiary";

function Choice({ label, value, options, onChange, help }: { label: string; value: string; options: { value: string; label: string; hint: string }[]; onChange: (v: string) => void; help: React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-[13px] leading-5 font-bold text-text-secondary">{label}<Help title={label}>{help}</Help></span>
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

function Pick({ title, empty, help, children }: { title: string; empty?: string; help: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-center gap-2"><h4 className="m-0 text-[15px] leading-6 font-bold">{title}</h4><Help title={title}>{help}</Help></div>
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
        {hint && <span className="line-clamp-2 text-[13px] leading-5 text-text-secondary">{hint}</span>}
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
          <div className="flex flex-col"><h2 className="m-0 text-[22px] leading-7 font-bold">Set up {role.name}</h2><span className="text-[13px] leading-5 text-text-secondary">{role.group}</span></div>
        </div>

        <section className="flex flex-col gap-4" aria-label="The role">
          <div className="flex items-center gap-2"><h3 className="m-0 text-[17px] leading-6 font-bold">The role</h3><Help title="The role"><p className="m-0">This part is the same in every project: the personality, the job, the model and the permissions.</p><p className="m-0">Every session you start as {role.name} begins with exactly this and nothing else. Skills and connectors are set per project, further down.</p></Help></div>
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-[15px] leading-6 font-bold">Personality<Help title="Personality"><p className="m-0">How this role behaves and sounds, for example careful and blunt, or warm and patient. Keep it short: it is sent at the start of every session.</p><p className="m-0">Your Voice (how Claude words things to you) still applies on top, unless you turn it off for a session.</p></Help></span>
            <textarea ref={first} value={persona} onChange={(e) => setPersona(e.target.value)} rows={3} className={area} placeholder="For example: careful and blunt" />
            <span className="flex flex-wrap items-center gap-2">
              {STARTERS.map((s) => <button key={s} type="button" onClick={() => setPersona(s)} className="border border-line-subtle bg-surface-2 px-2 py-0.5 text-[13px] leading-5 text-text-secondary hover:bg-surface-3">{s.split(":")[0]}</button>)}
              <span className={`ml-auto text-[13px] leading-5 ${words > 150 ? "text-state-left" : "text-text-tertiary"}`}>{words} words</span>
            </span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-[15px] leading-6 font-bold">The job<Help title="The job"><p className="m-0">Told to Claude at the start of every session as this role. It says what the role is for and what it must not do.</p></Help></span>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} className={area} />
          </label>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Choice label="Model" value={model} options={MODELS} onChange={setModel} help={<><p className="m-0">Sonnet is the usual choice. Opus is slower and costs more of your plan, and is for hard problems. Haiku is fast and cheap, for simple jobs.</p></>} />
            <Choice label="Permissions" value={mode} options={MODES.map((m) => ({ ...m, label: modeWord(m.value) }))} onChange={setMode} help={<><p className="m-0">Plan only: the role reads and plans and changes nothing.</p><p className="m-0">Ask every time: it asks before every change.</p><p className="m-0">Edits free, commands asked: it edits files freely and asks before running commands.</p></>} />
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-label={`In ${project.name}`}>
          <div className="flex items-center gap-2"><h3 className="m-0 text-[17px] leading-6 font-bold">In {project.name}</h3><Help title={`In ${project.name}`}><p className="m-0">Skills and connectors belong to the project. Another project has its own list for this role.</p><p className="m-0">What is not ticked is left out of the session, so it costs no tokens.</p></Help></div>
          <Pick title="Skills" empty={catalog && catalog.length === 0 ? "No skills yet." : undefined} help={<><p className="m-0">The skills of this project, kept in the project's own folder{folder ? ` (${folder})` : ""}. Tick the ones this role may use; the rest are left out of its sessions.</p><p className="m-0">This project has none until you copy one from this computer (the button below) or put a skill folder in that folder.</p></>}>
            {catalog === null ? <span className="text-[14px] text-text-tertiary">Looking…</span> : catalog.map((s) => (
              <Row key={s.name} on={skills.includes(s.name)} onChange={(v) => toggle(skills, setSkills, s.name, v)} name={s.name} tag="" note={`~${s.tokens} tokens`} hint={s.description} />
            ))}
          </Pick>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2"><button type="button" onClick={() => setShowComputer((v) => !v)} aria-expanded={showComputer} className="self-start border border-line-subtle bg-surface-2 px-2.5 py-1 text-[14px] font-bold text-text-secondary hover:bg-surface-3">
              {showComputer ? "Hide" : "Copy from this computer"}{computer && computer.length > 0 && !showComputer ? ` (${computer.length})` : ""}
            </button><Help title="Copy from this computer"><p className="m-0">These skills are on this computer. They do nothing in any session until you copy them into {project.name}.</p><p className="m-0">A copy is a separate file: changing it here does not change the original.</p></Help></div>
            {showComputer && (computer === null ? <span className="text-[14px] text-text-tertiary">Looking…</span> : computer.length === 0
              ? <p className="m-0 text-[14px] leading-5 text-text-tertiary">Nothing else found.</p>
              : (
                <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto border border-line-subtle bg-inset p-2">
                  {computer.map((s) => (
                    <div key={s.name} className="flex items-start gap-3 px-1 py-1.5">
                      <span className="flex min-w-0 flex-1 flex-col"><span className="flex flex-wrap items-baseline gap-x-2"><span className="font-bold">{s.name}</span><span className="text-[12px] leading-5 text-text-tertiary">about {s.tokens} tokens</span></span><span className="text-[13px] leading-5 text-text-secondary">{s.description}</span></span>
                      <Button small variant="quiet" disabled={copying !== null || busy} onClick={() => void copy(s.name)}>{copying === s.name ? "Copying…" : "Copy here"}</Button>
                    </div>
                  ))}
                </div>
              ))}
          </div>
          <Pick title="Connectors" empty={servers && servers.length === 0 ? "None found." : undefined} help={<><p className="m-0">Tools this role may reach, found in this project. Tick the ones it may use; the rest are left out of its sessions.</p><p className="m-0">To add one, use Claude Code (claude mcp add) and it appears here. Connectors of your Claude account, like Google Drive, are off in every role.</p></>}>
            {servers === null ? <span className="text-[14px] text-text-tertiary">Looking…</span> : servers.map((s) => (
              <Row key={s.name} on={mcp.includes(s.name)} onChange={(v) => toggle(mcp, setMcp, s.name, v)} name={s.name} tag={s.kind} hint={s.source} />
            ))}
          </Pick>
        </section>

        <p className="m-0 flex items-center gap-2 text-[14px] leading-5 text-text-secondary" role="status">
          {picked === 0 ? "No skills" : `${picked} skill${picked === 1 ? "" : "s"}, ~${cost} tokens`} at the start of a session
          <Help title="What a session starts with"><p className="m-0">{picked === 0 ? "No skills" : `${picked} skill${picked === 1 ? "" : "s"}, about ${cost} tokens`} at the start of every session as {role.name} in {project.name}.{left > 0 ? ` ${left} other skill${left === 1 ? " is" : "s are"} left out.` : ""}</p><p className="m-0">Kona's board tools are always there. Everything else is left out.</p>{folder && <p className="m-0">This project's skills live in {folder}</p>}</Help>
        </p>

        {error && <p role="alert" className="m-0 text-[14px] leading-5 font-bold text-state-left">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void save()} disabled={busy}>Save</Button>
          <Button variant="quiet" onClick={onClose} disabled={busy}>Cancel</Button>
          <span className="flex-1" />
          <Button variant={confirmReset ? "danger" : "ghost"} small onClick={reset} disabled={busy}>{confirmReset ? "Yes, reset" : "Reset role"}</Button><Help title="Reset role"><p className="m-0">Puts the personality, the job, the model and the permissions back to the starting setup, and clears this project's skills and connectors for {role.name}.</p></Help>
        </div>
      </div>
    </div>,
    document.body,
  );
}
