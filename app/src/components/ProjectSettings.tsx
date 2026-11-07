// The settings of the project that is open (the Settings door of the office): what belongs to this project only.
// The settings of Kona itself (accounts, size, updates, backups) are on the welcome page. A field saves by itself and says Saved.
import { useEffect, useMemo, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { accountStatusCached, getSettings, removeProject, renameProject, setProjectAccount, setProjectGroup, setProjectSessions, type Account, type AccountStatus, type Project } from "../lib/api";
import { Button, Glyph } from "./ui";
import { Confirm } from "./Confirm";
import { Help } from "./Help";
import { Select } from "./pick";

const DEFAULT = "default";

export function ProjectSettings({ project, accounts, groups, runningHere, onProject, onRemoved }: {
  project: Project; accounts: Account[]; groups: string[]; runningHere: number; onProject: (next: Project) => void; onRemoved: (id: string) => void;
}) {
  const [status, setStatus] = useState<Record<string, AccountStatus>>({});
  const [fallback, setFallback] = useState(2); // the default number of sessions (Settings on the welcome page)
  const [name, setName] = useState(project.name);
  const [group, setGroup] = useState(project.group ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drop, setDrop] = useState(false);

  useEffect(() => { setName(project.name); setGroup(project.group ?? ""); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getSettings().then((s) => setFallback(s.max_sessions)).catch(() => {}); }, []);
  useEffect(() => {
    accounts.forEach((a) => { accountStatusCached(a.id).then((r) => setStatus((s) => ({ ...s, [a.id]: r }))).catch(() => setStatus((s) => ({ ...s, [a.id]: { logged_in: false } }))); });
  }, [accounts]);
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(null), 4000); return () => clearTimeout(t); }, [saved]);

  const save = async (what: string, go: () => Promise<Project>) => {
    setError(null);
    try { onProject(await go()); setSaved(what); } catch (e) { setError(String(e)); }
  };
  const signedIn = useMemo(() => accounts.filter((a) => status[a.id]?.logged_in), [accounts, status]);
  const mine = accounts.find((a) => a.id === project.account) ?? null;
  const mineStatus = mine ? status[mine.id] : undefined;
  // the account the project has is always in the list, even while it is signed out, so the box never shows nothing
  const options = useMemo(() => {
    const list = signedIn.map((a) => ({ value: a.id, label: a.label, hint: status[a.id]?.email ?? undefined }));
    return mine && !list.some((o) => o.value === mine.id) ? [{ value: mine.id, label: mine.label, hint: "Signed out" }, ...list] : list;
  }, [signedIn, status, mine]);
  const cap = project.max_sessions ?? fallback;

  const field = "h-12 w-full px-2 text-[15px] text-text placeholder:text-text-tertiary";
  const h2 = "m-0 text-[18px] leading-7 font-bold";

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex w-full max-w-[720px] flex-col gap-8 px-8 pt-8 pb-10">
        <div role="status" aria-live="polite" className="min-h-5 empty:hidden">
          {saved && <span className="flex items-center gap-2 text-[14px] leading-5 text-text-secondary"><Glyph state="done" size={16} />Saved. {saved}</span>}
        </div>
        {error && <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}

        <section className="flex flex-col gap-3" aria-label="Account">
          <div className="flex items-center gap-2.5"><h2 className={h2}>Account</h2><Help title="Account"><p className="m-0">Every session in this project runs on this Claude login and spends its plan.</p><p className="m-0">The accounts themselves (adding one, signing in) are in Settings on the welcome page.</p></Help></div>
          <div className="max-w-[420px]">
            <Select ariaLabel="Account of this project" value={project.account ?? ""} placeholder={options.length === 0 ? "No account is signed in" : "Choose an account"} disabled={options.length === 0}
              onChange={(v) => void save("The account of this project.", () => setProjectAccount(project.id, v))} options={options} />
          </div>
          {mine && mineStatus && (
            <span className="flex items-center gap-2 text-[14px] leading-5">
              <Glyph state={mineStatus.logged_in ? "done" : "left"} size={16} />
              <span className={mineStatus.logged_in ? "text-text-secondary" : "font-bold text-state-left"}>{mineStatus.logged_in ? `Signed in${mineStatus.email ? ` · ${mineStatus.email}` : ""}` : "Signed out. Sign in from the welcome page, under Settings."}</span>
            </span>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-label="Sessions at once">
          <div className="flex items-center gap-2.5"><h2 className={h2}>Sessions at once</h2><Help title="Sessions at once"><p className="m-0">How many sessions this project may run at the same time. Another project can have a different number.</p><p className="m-0">Each running session uses about 400 MB of this PC's memory, and Kona never runs more than 6 in all.</p></Help></div>
          <div className="max-w-[240px]">
            <Select ariaLabel="Sessions at once in this project" value={project.max_sessions ? String(project.max_sessions) : DEFAULT}
              onChange={(v) => void save("How many sessions this project runs at once.", () => setProjectSessions(project.id, v === DEFAULT ? null : Number(v)))}
              options={[{ value: DEFAULT, label: `Default (${fallback})`, hint: "From Settings on the welcome page" }, ...[1, 2, 3].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "session" : "sessions"}` }))]} />
          </div>
          <span className="flex items-center gap-2 text-[14px] leading-5 text-text-secondary"><Glyph state={runningHere > 0 ? "live" : "idle"} size={16} />{runningHere} of {cap} running now</span>
        </section>

        <section className="flex flex-col gap-3" aria-label="Name and group">
          <div className="flex items-center gap-2.5"><h2 className={h2}>Name and group</h2><Help title="Name and group"><p className="m-0">The name is what Kona shows. The folder keeps its own name.</p><p className="m-0">Groups file the projects on the welcome page, A to Z.</p></Help></div>
          <label className="flex flex-col gap-2 max-w-[420px]">
            <span className="text-[13px] leading-5 font-bold text-text-secondary">Name</span>
            <input data-autosaves value={name} onChange={(e) => setName(e.target.value)} className={field}
              onBlur={() => { if (name.trim() && name.trim() !== project.name) void save("The name.", () => renameProject(project.id, name)); else setName(project.name); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
          </label>
          <div className="flex max-w-[420px] flex-col gap-2">
            <label className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">Group</span>
              <input data-autosaves value={group} maxLength={40} onChange={(e) => setGroup(e.target.value)} placeholder="No group" className={field}
                onBlur={() => { if (group.trim() !== (project.group ?? "")) void save("The group.", () => setProjectGroup(project.id, group.trim() || null)); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            </label>
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Groups that exist">
                {groups.map((g) => { const on = group.trim().toLowerCase() === g.toLowerCase(); return <Button key={g} variant="quiet" small on={on} aria-pressed={on} onClick={() => { setGroup(g); void save("The group.", () => setProjectGroup(project.id, g)); }}>{g}</Button>; })}
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-label="Folder">
          <div className="flex items-center gap-2.5"><h2 className={h2}>Folder</h2></div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 truncate font-mono text-[13px] leading-5 text-text-secondary" title={project.folder}>{project.folder}</span>
            <Button variant="quiet" small onClick={() => void revealItemInDir(project.folder)}>Show in Explorer</Button>
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-label="Remove">
          <h2 className={h2}>Remove</h2>
          <div><Button variant="danger" small onClick={() => setDrop(true)}>Remove from Kona…</Button></div>
        </section>
      </div>

      {drop && (
        <Confirm title={`Remove ${project.name} from Kona?`} confirmLabel="Remove it" danger onConfirm={() => { void removeProject(project.id).then(() => onRemoved(project.id)).catch((e) => { setError(String(e)); setDrop(false); }); }} onCancel={() => setDrop(false)}>
          <p className="m-0">Kona forgets this project. Its folder, its code and its hidden .kona folder (tickets and brain notes) stay exactly where they are, and adding the project again brings them back.</p>
        </Confirm>
      )}
    </main>
  );
}
