// The needs check, shown on the start screen: the local tools this role and this project need, and which of them this PC has.
// Kona only looks. For a missing tool it shows the install command as text and the owner decides (decision: never install by itself).
// The list is not the same in every project: it starts from what the role needs and what the project's files say, and the owner can hide a tool that this project does not need
// or add one from Kona's list (the Tools tab of a person's sheet); the choice is kept for this person in this project (role-kits.json, beside the skills).
import { useEffect, useMemo, useState } from "react";
import { checkTools, listTools, projectHints, roleLabel, saveRoleKit, type Hint, type Project, type Role, type RoleKit, type ToolInfo, type ToolStatus } from "../lib/api";
import { Glyph } from "./ui";
import { SmartSearch } from "./pick";

/** `editable`: the Tools tab, where a tool can be hidden or added. Otherwise a plain check (the empty chat), with `onEdit` as a way to the Tools tab. `refresh` changes when the list of tools Kona knows has changed. */
export function Needs({ project, role, kit, onKit, editable = false, refresh = 0, onEdit, help }: { project: Project; role: Role | null; kit?: RoleKit; onKit?: (kit: RoleKit) => void; editable?: boolean; refresh?: number; onEdit?: () => void; /** the "?" beside the heading */ help?: React.ReactNode }) {
  const [hints, setHints] = useState<Hint[]>([]);
  const [catalog, setCatalog] = useState<ToolInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0); // a new search box after each pick, so it starts empty again
  useEffect(() => { listTools().then(setCatalog).catch(() => setCatalog([])); }, [refresh]);
  const [status, setStatus] = useState<ToolStatus[] | null>(null);
  const [again, setAgain] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { projectHints(project.folder).then(setHints).catch(() => setHints([])); }, [project.folder]);

  // why each tool is on the list: the role, the project's files, or both
  const why = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const id of role?.needs ?? []) m.set(id, [`${roleLabel(role!)} needs it`]);
    for (const h of hints) m.set(h.id, [...(m.get(h.id) ?? []), h.because]);
    for (const id of kit?.tools_add ?? []) m.set(id, [...(m.get(id) ?? []), "you added it for this project"]);
    for (const id of kit?.tools_skip ?? []) m.delete(id); // hidden for this project
    return m;
  }, [role, hints, kit?.tools_add, kit?.tools_skip]);
  const hidden = (kit?.tools_skip ?? []).filter((id) => catalog.some((c) => c.id === id));
  const canEdit = editable && !!role && !!kit && !!onKit;
  // the choice is saved at once, for this person in this project
  const change = async (add: string[], skip: string[]) => {
    if (!role || !kit || !onKit) return;
    setError(null);
    try { onKit(await saveRoleKit(project.folder, role.id, { ...kit, tools_add: add, tools_skip: skip })); }
    catch (e) { setError(String(e)); }
  };
  const hide = (id: string) => change((kit?.tools_add ?? []).filter((x) => x !== id), [...(kit?.tools_skip ?? []).filter((x) => x !== id), ...(role?.needs.includes(id) || hints.some((h) => h.id === id) ? [id] : [])]);
  const unhide = (id: string) => change(kit?.tools_add ?? [], (kit?.tools_skip ?? []).filter((x) => x !== id));
  const add = (id: string) => { setAddKey((n) => n + 1); return change([...(kit?.tools_add ?? []).filter((x) => x !== id), id], (kit?.tools_skip ?? []).filter((x) => x !== id)); };
  const addable = catalog.filter((c) => !why.has(c.id));
  const ids = useMemo(() => [...why.keys()].filter((id) => catalog.length === 0 || catalog.some((c) => c.id === id)).sort(), [why, catalog]);
  const key = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) { setStatus([]); return; }
    let live = true;
    setStatus(null);
    checkTools(ids).then((s) => { if (live) setStatus(s); }).catch(() => { if (live) setStatus([]); });
    return () => { live = false; };
  }, [key, again, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ids.length === 0 && !canEdit) return null;
  const heading = canEdit ? `Tools ${role!.person || roleLabel(role!)} needs in ${project.name}` : "Tools this session needs";
  const rows = (status ?? []).slice().sort((a, b) => Number(a.installed) - Number(b.installed) || a.name.localeCompare(b.name));
  const missing = rows.filter((r) => !r.installed).length;

  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000); } catch { /* the text is on screen to copy by hand */ }
  };

  return (
    <section aria-label="Tools this session needs" className="flex flex-col gap-3 border border-line-subtle bg-surface-1 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2"><span className={canEdit ? "text-[16px] leading-6 font-bold" : "text-[13px] leading-5 font-bold text-text-secondary"}>{heading}</span>{help}</span>
        <span className="flex items-center gap-3 text-[13px] leading-5 text-text-tertiary">
          {status === null ? "Looking…" : missing === 0 ? "All here" : `${missing} missing`}
          <button type="button" onClick={() => setAgain((n) => n + 1)} className="font-bold text-text-secondary hover:text-text">Check again</button>
          {!canEdit && onEdit && <button type="button" onClick={onEdit} className="font-bold text-text-secondary hover:text-text">Change the list</button>}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 text-[14px] leading-5">
              <Glyph state={r.installed ? "done" : "left"} size={16} />
              <span className="font-bold">{roleLabel(r)}</span>
              <span className={r.installed ? "truncate font-mono text-[13px] text-text-secondary" : "text-state-left"}>{r.installed ? r.version : "Missing"}</span>
              <span className="ml-auto truncate text-[13px] text-text-tertiary">{why.get(r.id)?.join(" · ")}</span>
              {canEdit && <button type="button" onClick={() => void hide(r.id)} aria-label={`${r.name} is not needed in ${project.name}`} title={`Not needed in ${project.name}: take it off this list`} className="shrink-0 border border-line-subtle px-1.5 text-[12px] leading-5 text-text-tertiary hover:bg-surface-3 hover:text-text">Not needed</button>}
            </div>
            {!r.installed && (
              <div className="ml-[26px] flex items-center gap-3">
                <code className="min-w-0 truncate bg-inset px-2 py-1 font-mono text-[13px] text-text-secondary" title={r.install}>{r.install}</code>
                {r.install.startsWith("winget") && <button type="button" onClick={() => copy(r.id, r.install)} className="shrink-0 text-[13px] font-bold text-text-secondary hover:text-text">{copied === r.id ? "Copied" : "Copy"}</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="flex flex-col gap-3 border-t border-line-subtle pt-3 text-[13px] leading-5 text-text-secondary">
          {addable.length > 0 && (
            <div className="flex max-w-[420px] flex-col gap-1.5">
              <SmartSearch key={addKey} label="Add a tool" ariaLabel="Add a tool this project needs" where="tools" placeholder="Type a name, like node or docker" value={null}
                options={addable.map((c) => ({ value: c.id, label: c.name, hint: c.builtin ? c.program : `yours: ${c.program}` }))} onChange={(o) => { if (o) void add(o.value); }} />
            </div>
          )}
          {hidden.length > 0 && <span className="flex flex-wrap items-center gap-2">Hidden for this project: {hidden.map((id) => <button key={id} type="button" onClick={() => void unhide(id)} title="Show it again" className="border border-line-subtle px-1.5 hover:bg-surface-3">{catalog.find((c) => c.id === id)?.name} ↺</button>)}</span>}
          {error && <span role="alert" className="font-bold text-state-left">{error}</span>}
        </div>
      )}
    </section>
  );
}
