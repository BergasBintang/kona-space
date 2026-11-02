// The skill tree of a person (decision 63): how they decide which skill to reach for, and where the owner shapes it. Read from the top:
//   the job  ->  a branch for each kind of work (with a line on when to take it)  ->  the skills under the branch (each with a line on when to take it)  ->  the files of the skill.
// A skill that is under no branch hangs straight under the job. Every change is kept at once. The same tree, in words, is what the person is told at the start of every conversation
// (session.rs skill_notes); Claude still decides in the end.
import { useEffect, useRef, useState } from "react";
import { skillFolder, type Project, type Role, type RoleKit, type SkillInfo } from "../lib/api";
import { addBranch, branchOf, changeBranch, moveSkill, nameProblem, removeBranch, treeOf, type Branch } from "../lib/skilltree";
import { draftNote } from "../lib/skillnote";
import { Button, RoleMark } from "./ui";
import { Select } from "./pick";
import { SkillFiles } from "./Files";

const field = "bare h-10 min-w-0 border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-text-tertiary";
const area = "border border-line-strong bg-inset px-3 py-2 text-[14px] leading-5 text-text placeholder:text-text-tertiary";

export type TreeActions = {
  keep: (next: Partial<RoleKit>) => Promise<boolean>; // false when it could not be kept (the tab shows why)
  onChange: (name: string) => void; // open the skill to read and change it
  onTakeAway: (name: string) => void;
  onDelete: (name: string) => void;
  onStart: (everyone: boolean) => void; // give this person, or everybody, Kona's starting tree
  deleting: string | null;
  setDeleting: (name: string | null) => void;
  busy: boolean;
  saves: number; // how many times the editor has saved, so an open folder view looks again
};

/** one place in the tree: a line down the side and a tick across to the node */
function Place({ last, children }: { last: boolean; children: React.ReactNode }) {
  return (
    <li className="relative pb-3 pl-7">
      <span aria-hidden className={`absolute top-0 left-0 w-[2px] bg-line-strong ${last ? "h-6" : "h-full"}`} />
      <span aria-hidden className="absolute top-6 left-0 h-[2px] w-6 bg-line-strong" />
      {children}
    </li>
  );
}
const Down = ({ children }: { children: React.ReactNode }) => <ul className="m-0 ml-5 flex list-none flex-col p-0 pt-3">{children}</ul>;
const Tag = ({ children }: { children: React.ReactNode }) => <span className="shrink-0 border border-line-subtle bg-surface-3 px-1.5 text-[12px] leading-5 font-bold text-text-secondary">{children}</span>;

export function SkillTree({ role, project, kit, infos, start, actions }: { role: Role; project: Project; kit: RoleKit; infos: SkillInfo[] | null; start: RoleKit | null; actions: TreeActions }) {
  const who = role.person || role.name;
  const [root, setRoot] = useState("");
  const [files, setFiles] = useState<string | null>(null); // the skill whose files are open
  const [open, setOpen] = useState<string | null>(null); // the skill opened to change it; the others stay one line, so the tree can be read at a glance
  const [kept, setKept] = useState<string | null>(null); // the skill whose line was just kept, to say so
  useEffect(() => { let live = true; skillFolder(project.folder).then((p) => { if (live) setRoot(p); }).catch(() => {}); return () => { live = false; }; }, [project.folder]);

  const branches: Branch[] = kit.branches ?? [];
  const { branches: shaped, loose } = treeOf(kit.skills, branches);
  const info = (n: string) => (infos ?? []).find((s) => s.name === n);
  const put = (next: Branch[]) => actions.keep({ branches: next });

  const missing = (start?.skills ?? []).filter((s) => !kit.skills.includes(s));

  const skill = (name: string) => {
    const i = info(name);
    // one line says when to take the skill: the note if the owner changed it, otherwise the skill's own words. Only a change is kept as a note, so the same words are never sent twice
    // (an old note that repeats the skill's own words counts as none).
    const saved = (kit.notes?.[name] ?? "").trim();
    const note = i && (saved === i.description.trim() || saved === draftNote(i.description).trim()) ? "" : saved;
    const at = branchOf(shaped, name);
    const opened = open === name;
    return (
      <div className="flex flex-col border border-line-subtle bg-surface-1" aria-label={`Skill ${name}`}>
        <button type="button" aria-expanded={opened} onClick={() => setOpen(opened ? null : name)} className="flex min-h-12 w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left hover:bg-surface-3">
          <span className="text-[15px] leading-5 font-bold">{name}</span>
          <span className="min-w-0 flex-1 font-sans text-[14px] leading-5 tracking-normal text-text-secondary">{!i ? "No longer in the project." : opened ? "" : <span className="line-clamp-1">{note || i.description}</span>}</span>
          {i && <span className="shrink-0 font-sans text-[12px] leading-5 tracking-normal text-text-tertiary">~{i.tokens} tokens · {i.files === 1 ? "1 file" : `${i.files ?? 1} files`}</span>}
          <span aria-hidden className={`shrink-0 text-[12px] text-text-tertiary ${opened ? "rotate-180" : ""}`}>▼</span>
        </button>
        {opened && (
          <div className="flex flex-col gap-2 border-t border-line-subtle p-3">
            {i && (
              <label className="flex flex-col gap-1">
                <span className="flex items-center justify-between gap-3 text-[13px] leading-5 font-bold text-text-secondary">When {who} takes it{kept === name && <span role="status" className="font-normal text-text-tertiary">Saved</span>}</span>
                <textarea key={`${name}-${kit.notes?.[name] ?? ""}`} rows={2} maxLength={300} defaultValue={note || i.description} aria-label={`When ${who} takes ${name}`} className={area} onFocus={() => setKept(null)}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (!v) e.target.value = i.description; // an empty box goes back to the skill's own words
                    const next = !v || v === i.description.trim() ? "" : v;
                    if (next !== note) void actions.keep({ notes: { ...kit.notes, [name]: next } }).then((ok) => { if (ok) setKept(name); });
                  }} />
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {shaped.length > 0 && (
                <span className="flex items-center gap-2 text-[13px] text-text-secondary">Under
                  <Select ariaLabel={`Branch of ${name}`} search={false} className="w-[230px]" value={at === null ? "-" : String(at)} onChange={(v) => put(moveSkill(shaped, name, v === "-" ? null : Number(v)))}
                    options={[{ value: "-", label: "No branch", hint: "Hangs straight under the job" }, ...shaped.map((b, k) => ({ value: String(k), label: b.name || "(no name)" }))]} /></span>
              )}
              <span className="flex-1" />
              {actions.deleting === name
                ? <span className="flex flex-wrap items-center gap-1.5 text-[13px]">Delete it from {project.name} for everyone? <Button variant="danger" small disabled={actions.busy} onClick={() => actions.onDelete(name)}>Delete</Button><Button variant="quiet" small onClick={() => actions.setDeleting(null)}>No</Button></span>
                : <>
                  {i && <Button variant="quiet" small aria-pressed={files === name} onClick={() => setFiles(files === name ? null : name)} title="Open the folder of this skill to read its files">Files</Button>}
                  {i && <Button variant="quiet" small onClick={() => actions.onChange(name)} title="Change its steps and its files">Change</Button>}
                  <Button variant="quiet" small onClick={() => actions.onTakeAway(name)} title={`${who} stops using it; it stays in the project`}>Take away</Button>
                  {i && <Button variant="ghost" small onClick={() => actions.setDeleting(name)} title="Remove it from the project, for every person">Delete</Button>}
                </>}
            </div>
            {files === name && root && (
              <div className="flex h-[360px] border border-line-subtle bg-surface-2" aria-label={`The files of ${name}`}>
                <SkillFiles key={actions.saves} project={project} root={root} names={[name]} title={name} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section aria-label={`How ${who} chooses a skill`} className="flex flex-col gap-3">
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border border-line-strong bg-surface-2 px-4 py-3" role="group" aria-label="Kona's starting tree">
          <span className="min-w-[260px] flex-1 text-[14px] leading-5">Kona has a starting tree for {who}: {start?.branches?.length ?? 0} branches and {start?.skills.length ?? 0} skills. {missing.length === start?.skills.length ? "" : `${missing.length} of them are not here yet. `}What you already have stays as it is.</span>
          <Button small disabled={actions.busy} onClick={() => actions.onStart(false)}>Use it for {who}</Button>
          <Button variant="quiet" small disabled={actions.busy} onClick={() => actions.onStart(true)}>For everyone in {project.name}</Button>
        </div>
      )}

      <div className="flex flex-col">
        <div className="flex w-fit items-center gap-3 border-2 border-line-strong bg-surface-2 px-3 py-2 px-shadow">
          <RoleMark roleId={role.id} size={36} />
          <span className="flex flex-col"><span className="text-[15px] leading-5 font-bold">{who} gets a job</span><span className="text-[12px] leading-4 text-text-tertiary">Which branch fits? Which skill?</span></span>
        </div>

        <Down>
          {shaped.map((b, k) => (
            <Place key={k} last={false}>
              <BranchBox branches={shaped} at={k} onChange={put} />
              {b.skills.length === 0
                ? <p className="m-0 mt-3 ml-5 text-[14px] leading-5 text-text-tertiary">No skill under this branch yet. On a skill, choose “{b.name || "this branch"}” in its Under box.</p>
                : <Down>{b.skills.map((s, j) => <Place key={s} last={j === b.skills.length - 1}>{skill(s)}</Place>)}</Down>}
            </Place>
          ))}
          {loose.map((s) => <Place key={s} last={false}>{skill(s)}</Place>)}
          <Place last>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="quiet" small onClick={() => put(addBranch(shaped))} disabled={shaped.length >= 12}>+ Add a branch</Button>
              {kit.skills.length === 0
                ? <span className="text-[14px] leading-5 text-text-tertiary">{who} has no skills in {project.name} yet. Add some from the list on the right.</span>
                : shaped.length === 0 && <span className="text-[14px] leading-5 text-text-tertiary">No branches yet: every skill hangs straight under the job. Add one for a kind of work, for example “Shipping”.</span>}
            </div>
          </Place>
        </Down>
      </div>
    </section>
  );
}

/** a branch: its name and when to take it. Typing is kept when the box is left; a name that is empty or taken is not kept, and says why. */
function BranchBox({ branches, at, onChange }: { branches: Branch[]; at: number; onChange: (next: Branch[]) => void }) {
  const b = branches[at];
  const [name, setName] = useState(b.name);
  const [when, setWhen] = useState(b.when);
  const [problem, setProblem] = useState<string | null>(null);
  const typing = useRef<"name" | "when" | null>(null); // what is kept comes back from the core a moment later; it must not wipe what is being typed meanwhile
  useEffect(() => { if (typing.current !== "name") setName(b.name); if (typing.current !== "when") setWhen(b.when); }, [b.name, b.when]);
  const commit = () => {
    if (name === b.name && when === b.when) return;
    const next = changeBranch(branches, at, { name: name.trim(), when: when.trim() });
    const p = nameProblem(next, at);
    setProblem(p);
    if (!p) onChange(next);
  };
  return (
    <div className="flex flex-col gap-2 border-2 border-line-strong bg-surface-2 p-3" role="group" aria-label={`Branch ${b.name}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Tag>Branch</Tag>
        <input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => { typing.current = "name"; }} onBlur={() => { typing.current = null; commit(); }} maxLength={40} aria-label="Branch name" placeholder="Name of the branch" className={`${field} w-[220px] font-bold`} />
        <input value={when} onChange={(e) => setWhen(e.target.value)} onFocus={() => { typing.current = "when"; }} onBlur={() => { typing.current = null; commit(); }} maxLength={200} aria-label={`When to take the branch ${b.name}`} placeholder="Take this branch when the job is about…" className={`${field} min-w-[240px] flex-1`} />
        <Button variant="ghost" small onClick={() => onChange(removeBranch(branches, at))} title="Its skills stay with the person, under no branch">Remove branch</Button>
      </div>
      {problem && <p role="alert" className="m-0 text-[13px] leading-5 font-bold text-state-left">{problem}</p>}
    </div>
  );
}
