// The Skills tab of a person's sheet (decisions 50, 63 and 66). Two columns, said in words:
//   on the left what this person has in this project: their skills (each with a note on when to use it), and their connectors;
//   on the right where to get more: the project's other skills, the skills that come with Kona, the skills on this computer, and a button to write a new one.
// Every click is kept at once (nothing to save): giving a skill, taking it away, a note, a connector. A skill is a folder in the project (.kona\skills); taking a skill away from a person
// leaves it in the project, and deleting it removes the folder. A new project starts with the skills that come with Kona and each person's starting tree (decision 67); an older project can take the tree with one button.
import { useEffect, useMemo, useState } from "react";
import { applyDefaultTree, computerSkills, defaultRoleKit, deleteSkill, importSkill, listRoles, mcpCatalog, roleKits, saveRoleKit, skillCatalog, type McpInfo, type Project, type Role, type RoleKit, type SkillInfo } from "../lib/api";
import { Button } from "./ui";
import { Help } from "./Help";
import { SkillEditor } from "./SkillEditor";
import { SkillTree } from "./SkillTree";

const SHOWN = 6; // skills of this computer shown before "Show all"

export function SkillsTab({ role, project, accountId, kit, onKitSaved }: { role: Role; project: Project; accountId: string | null; kit: RoleKit; onKitSaved: (roleId: string, kit: RoleKit) => void }) {
  const who = role.person || role.name;
  const [catalog, setCatalog] = useState<SkillInfo[] | null>(null);
  const [computer, setComputer] = useState<SkillInfo[] | null>(null);
  const [servers, setServers] = useState<McpInfo[] | null>(null);
  const [find, setFind] = useState("");
  const [all, setAll] = useState(false);
  const [editor, setEditor] = useState<{ name?: string } | null>(null);
  const [saves, setSaves] = useState(0); // goes up when the editor saves, so an open folder view looks again
  const [deleting, setDeleting] = useState<string | null>(null);
  const [start, setStart] = useState<RoleKit | null>(null); // what Kona gives this person to start with
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [c, p] = await Promise.all([skillCatalog(project.folder).catch(() => [] as SkillInfo[]), computerSkills(accountId, project.folder).catch(() => [] as SkillInfo[])]);
    setCatalog(c); setComputer(p);
  };
  useEffect(() => { void reload(); }, [project.folder, accountId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let live = true; defaultRoleKit(role.id).then((k) => { if (live) setStart(k); }).catch(() => {}); return () => { live = false; }; }, [role.id]);
  useEffect(() => { let live = true; mcpCatalog(accountId, project.folder).then((s) => { if (live) setServers(s); }).catch(() => { if (live) setServers([]); }); return () => { live = false; }; }, [accountId, project.folder]);

  /** keep a change of this person's list at once */
  const keep = async (next: Partial<RoleKit>) => {
    setError(null);
    try { onKitSaved(role.id, await saveRoleKit(project.folder, role.id, { ...kit, ...next })); return true; }
    catch (e) { setError(String(e)); return false; }
  };
  const give = (s: SkillInfo) => keep({ skills: [...kit.skills.filter((x) => x !== s.name), s.name] });
  const takeAway = (name: string) => { const { [name]: _gone, ...notes } = kit.notes ?? {}; return keep({ skills: kit.skills.filter((x) => x !== name), notes }); };
  const copy = async (s: SkillInfo) => {
    setBusy(true); setError(null);
    try { const got = await importSkill(accountId, project.folder, s.name); await reload(); await give(got); } catch (e) { setError(String(e)); }
    setBusy(false);
  };
  /** give this person, or everybody, Kona's starting tree; it joins what they already have */
  const takeStart = async (everyone: boolean) => {
    setBusy(true); setError(null);
    try {
      const ids = everyone ? (await listRoles()).map((r) => r.id) : [role.id];
      for (const id of ids) onKitSaved(id, await applyDefaultTree(project.folder, id));
      await reload();
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };
  const remove = async (name: string) => {
    setBusy(true); setError(null);
    try {
      await deleteSkill(project.folder, name); setDeleting(null);
      const kits = await roleKits(project.folder);
      for (const [rid, k] of Object.entries(kits)) onKitSaved(rid, k);
      if (!(role.id in kits)) onKitSaved(role.id, { skills: [], mcp: [], notes: {}, tools_add: kit.tools_add ?? [], tools_skip: kit.tools_skip ?? [] });
      await reload();
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const mine = useMemo(() => kit.skills.map((n) => ({ name: n, info: (catalog ?? []).find((s) => s.name === n) })), [kit.skills, catalog]);
  const tokens = mine.reduce((n, m) => n + (m.info?.tokens ?? 0), 0);
  const q = find.trim().toLowerCase();
  const match = (s: SkillInfo) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  const others = (catalog ?? []).filter((s) => !kit.skills.includes(s.name) && match(s));
  const builtin = (computer ?? []).filter((s) => s.source === "builtin" && match(s)).sort((a, b) => Number(!!b.roles?.includes(role.id)) - Number(!!a.roles?.includes(role.id)) || a.name.localeCompare(b.name));
  const onPc = (computer ?? []).filter((s) => s.source === "computer" && match(s));
  const onPcShown = all || q ? onPc : onPc.slice(0, SHOWN);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="m-0 text-[18px] leading-6 font-bold">{who}'s skills in {project.name}</h2>
          <Help title={`${who}'s skills`}>
            <p className="m-0">A skill is a folder of instructions {who} can reach for. The tree shows how {who} chooses: read it from the top. {who} gets a job, takes the branch that fits, then the skill under it.</p>
            <p className="m-0">A branch is a kind of work, for example “Shipping”. Each skill has a line on when to take it. {who} is told the same tree at the start of every conversation, and Claude still decides.</p>
            <p className="m-0">Open a skill to change its line, move it to another branch, read its files or change it. Every change is kept at once.</p>
          </Help>
          <span className="text-[14px] leading-5 text-text-tertiary">{kit.skills.length === 0 ? "No skill yet" : `${kit.skills.length} skill${kit.skills.length === 1 ? "" : "s"} · about ${tokens} tokens`}</span>
        </div>

        <SkillTree role={role} project={project} kit={kit} infos={catalog} start={start}
          actions={{ keep, onChange: (name) => setEditor({ name }), onTakeAway: (name) => void takeAway(name), onDelete: (name) => void remove(name), onStart: (everyone) => void takeStart(everyone), deleting, setDeleting, busy, saves }} />

        <section className="flex flex-col gap-2" aria-label="Connectors">
          <div className="flex items-center gap-2"><h3 className="m-0 text-[16px] leading-6 font-bold">Connectors</h3><Help title="Connectors"><p className="m-0">Outside services {who} may reach from {project.name}, found in the project. What is not ticked is left out, so it costs nothing. To add one, use Claude Code (claude mcp add) and it shows up here.</p></Help></div>
          {servers === null ? <span className="text-[14px] text-text-tertiary">Looking…</span>
            : servers.length === 0 ? <p className="m-0 text-[14px] leading-5 text-text-tertiary">None found in this project.</p>
            : servers.map((s) => (
              <label key={s.name} className="flex cursor-pointer items-start gap-3 px-1 py-1.5 hover:bg-surface-3">
                <input type="checkbox" checked={kit.mcp.includes(s.name)} onChange={(e) => void keep({ mcp: e.target.checked ? [...kit.mcp, s.name] : kit.mcp.filter((x) => x !== s.name) })} className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]" />
                <span className="flex min-w-0 flex-col"><span className="flex items-baseline gap-2"><span className="font-bold">{s.name}</span><span className="text-[12px] leading-5 text-text-tertiary">{s.kind}</span></span><span className="text-[13px] leading-5 text-text-secondary">{s.source}</span></span>
              </label>
            ))}
        </section>
        {error && <p role="alert" className="m-0 text-[14px] leading-5 font-bold text-state-left">{error}</p>}
      </div>

      <aside className="flex w-[460px] shrink-0 flex-col gap-4 overflow-y-auto [&>*]:shrink-0 border-l border-line-subtle bg-surface-1 px-6 py-6" aria-label="Add a skill">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-[18px] leading-6 font-bold">Add a skill</h2><Button variant="quiet" small onClick={() => setEditor({})}>+ Write a new skill</Button></div>
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a skill" aria-label="Find a skill" className="bare h-10 border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-text-tertiary" />

        <Group title={`In ${project.name}`} note={`Skills the project has that ${who} does not use yet.`} empty={catalog === null ? "Looking…" : others.length === 0 ? (q ? "Nothing found." : "No other skills in the project.") : null}>
          {others.map((s) => <Item key={s.name} s={s} action={`Give to ${who}`} disabled={busy} onClick={() => void give(s)} />)}
        </Group>

        <Group title="Come with Kona" note="Written for Kona's people. New projects start with all of them. These are the ones this project does not have."
          empty={computer === null ? "Looking…" : builtin.length === 0 ? (q ? "Nothing found." : "All of them are in the project.") : null}>
          {builtin.map((s) => <Item key={s.name} s={s} tag={s.roles?.includes(role.id) ? `suggested for ${who}` : s.roles?.length ? `for ${s.roles.slice(0, 2).join(", ")}` : undefined} action={`Add for ${who}`} disabled={busy} onClick={() => void copy(s)} />)}
        </Group>

        <Group title="On this computer" note="From your own Claude folder. A copy goes into the project; the original is not touched."
          empty={computer === null ? "Looking…" : onPc.length === 0 ? (q ? "Nothing found." : "Nothing else found.") : null}>
          {onPcShown.map((s) => <Item key={s.name} s={s} action={`Copy and give to ${who}`} disabled={busy} onClick={() => void copy(s)} />)}
          {!all && !q && onPc.length > SHOWN && <Button variant="ghost" small onClick={() => setAll(true)}>Show all {onPc.length}</Button>}
        </Group>
      </aside>

      {editor && <SkillEditor folder={project.folder} name={editor.name} onClose={() => setEditor(null)}
        onSaved={async (info) => { setSaves((n) => n + 1); await reload(); if (editor.name === undefined) await give(info); }} />}
    </div>
  );
}

function Group({ title, note, head, empty, children }: { title: string; note: string; head?: React.ReactNode; empty: string | null; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-center gap-2"><h3 className="m-0 text-[15px] leading-6 font-bold">{title}</h3><Help title={title}><p className="m-0">{note}</p></Help><span className="flex-1" />{head}</div>
      {empty ? <p className="m-0 text-[14px] leading-5 text-text-tertiary">{empty}</p> : <div className="flex flex-col">{children}</div>}
    </section>
  );
}

function Item({ s, tag, action, disabled, onClick }: { s: SkillInfo; tag?: string; action: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-subtle py-2.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-baseline gap-x-2"><span className="font-bold">{s.name}</span>{tag && <span className="text-[12px] leading-5 font-bold text-text-secondary">{tag}</span>}<span className="text-[12px] leading-5 text-text-tertiary">~{s.tokens} tokens</span></span>
        <span className="line-clamp-3 text-[13px] leading-5 text-text-secondary" title={s.description}>{s.description}</span>
      </span>
      <Button variant="quiet" small disabled={disabled} onClick={onClick}>{action}</Button>
    </div>
  );
}
