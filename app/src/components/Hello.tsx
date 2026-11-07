// The first screen of every launch: the Kona mark, a greeting, Settings (the settings of Kona itself), and the projects filed under groups, A to Z,
// one card under the other. A project has exactly one account (decision 42). A project without one asks for it here, once. A signed-out account
// offers Sign in or Use another account. A card's group is changed in a small dialog.
import { useCallback, useEffect, useMemo, useState } from "react";
import { accountStatusCached, forgetAccountStatus, setProjectAccount, setProjectGroup, signInAccount, type Account, type AccountStatus, type Project } from "../lib/api";
import { Button, Glyph } from "./ui";
import { Select } from "./pick";
import { Confirm } from "./Confirm";
import { checkForUpdate, useUpdate } from "../lib/update";
import { groupNames, groupProjects } from "../lib/groups";
import { prepare, rank } from "../lib/search";
import { KonaMark } from "./KonaMark";

type Status = AccountStatus | "asking";

export function Hello({ projects, accounts, version, note = null, onOpen, onAdd, onOpenSettings, onProjects }: {
  version: string; note?: string | null; projects: Project[]; accounts: Account[]; onOpen: (id: string) => void; onAdd: () => void; onOpenSettings: () => void; onProjects: (next: Project[]) => void;
}) {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [swapping, setSwapping] = useState<string | null>(null); // the project whose account is being changed
  const [grouping, setGrouping] = useState<Project | null>(null); // the project whose group is being changed
  const [groupText, setGroupText] = useState("");
  const [query, setQuery] = useState(""); // the search box: only the projects that match are shown, still in their groups
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdate();
  const busyUpdate = update.phase === "checking" || update.phase === "downloading" || update.phase === "installing";

  const look = useCallback((id: string) => {
    setStatus((s) => ({ ...s, [id]: "asking" }));
    accountStatusCached(id).then((r) => setStatus((s) => ({ ...s, [id]: r }))).catch(() => setStatus((s) => ({ ...s, [id]: { logged_in: false } })));
  }, []);
  useEffect(() => { accounts.forEach((a) => look(a.id)); }, [accounts, look]);

  const all = useMemo(() => groupProjects(projects), [projects]);
  const names = useMemo(() => groupNames(projects), [projects]);
  const headed = all.some((g) => !g.none); // with no group at all there is nothing to head
  // the search looks at the name first, and at the group, the folder and the account too (Kona's smart search: every word must match, typos forgiven)
  const entries = useMemo(() => prepare(projects.map((p) => ({ value: p.id, label: p.name, hint: [p.group, p.folder, accounts.find((a) => a.id === p.account)?.label].filter(Boolean).join(" ") }))), [projects, accounts]);
  const searching = query.trim() !== "";
  const found = useMemo(() => new Set(rank(query, entries).map((h) => h.opt.value)), [query, entries]);
  const total = useMemo(() => new Map(all.map((g) => [g.none ? "-" : g.name.toLowerCase(), g.projects.length])), [all]);
  const groups = useMemo(() => (searching ? groupProjects(projects.filter((p) => found.has(p.id))) : all), [searching, projects, found, all]);
  const showSearch = projects.length >= 4;
  const signedIn = accounts.filter((a) => { const s = status[a.id]; return s && s !== "asking" && s.logged_in; });
  const replace = (next: Project) => onProjects(projects.map((x) => (x.id === next.id ? next : x)));
  const choose = async (p: Project, accountId: string) => {
    setError(null);
    try { replace(await setProjectAccount(p.id, accountId)); setSwapping(null); }
    catch (e) { setError(String(e)); }
  };
  const saveGroup = async () => {
    if (!grouping) return;
    try { replace(await setProjectGroup(grouping.id, groupText.trim() || null)); setGrouping(null); setError(null); }
    catch (e) { setError(String(e)); setGrouping(null); }
  };
  const signIn = async (a: Account) => {
    setBusy(a.id); setError(null);
    try { await signInAccount(a.id); } catch (e) { setError(String(e)); }
    finally { setBusy(null); forgetAccountStatus(a.id); look(a.id); }
  };

  const picker = (p: Project, current: string | null) => (
    signedIn.length > 0
      ? <Select ariaLabel={`Account for ${p.name}`} value={current ?? ""} placeholder="Choose an account" onChange={(v) => void choose(p, v)} options={signedIn.map((a) => ({ value: a.id, label: a.label, hint: (status[a.id] as AccountStatus).email ?? undefined }))} />
      : <div className="flex flex-col items-start gap-2 text-[13px] leading-5 text-text-secondary">{accounts.length === 0 ? "Kona has no account yet." : "No account is signed in yet."}<Button variant="quiet" small onClick={onOpenSettings}>{accounts.length === 0 ? "Add an account" : "Sign in to an account"}</Button></div>
  );

  const card = (p: Project) => {
    const acc = accounts.find((a) => a.id === p.account) ?? null;
    const st = acc ? status[acc.id] : undefined;
    const checking = !!acc && (st === undefined || st === "asking");
    const ok = !!acc && !!st && st !== "asking" && st.logged_in;
    const email = ok ? (st as AccountStatus).email ?? null : null;
    return (
      <div key={p.id} className="px-card flex flex-1 flex-col gap-4 p-3">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 truncate text-[19px] leading-7 font-bold">{p.name}</h3>
          <span className="truncate font-mono text-[13px] leading-5 text-text-tertiary" title={p.folder}>{p.folder}</span>
        </div>

        {!acc && (
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-[14px] leading-5 font-bold text-state-waiting"><Glyph state="waiting" size={16} />Which account does this project use?</span>
            {picker(p, null)}
          </div>
        )}
        {acc && (
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] leading-5">
              <Glyph state={checking ? "idle" : ok ? "done" : "left"} size={16} />
              <span className="text-text-secondary">Account: <span className="font-bold text-text">{acc.label}</span></span>
              <span className={ok ? "text-text-tertiary" : checking ? "text-text-tertiary" : "font-bold text-state-left"}>· {checking ? "checking" : ok ? "signed in" : "signed out"}</span>
              {email && <span className="min-w-0 truncate text-text-tertiary">· {email}</span>}
            </span>
            {swapping === p.id && picker(p, p.account ?? null)}
          </div>
        )}

        {/* the same two actions on the left, and on the right Open, or Sign in while the account is signed out, so every card has the same shape */}
        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {acc && !checking && <Button variant="ghost" small onClick={() => setSwapping(swapping === p.id ? null : p.id)}>Change account</Button>}
            <Button variant="ghost" small onClick={() => { setGrouping(p); setGroupText(p.group ?? ""); }}>{p.group ? "Change group" : "Add to a group"}</Button>
          </div>
          {acc && !checking && !ok
            ? <Button small disabled={busy === acc.id} onClick={() => void signIn(acc)}>{busy === acc.id ? "Waiting…" : "Sign in"}</Button>
            : <Button small disabled={!ok} onClick={() => onOpen(p.id)} title={ok ? undefined : "Choose an account that is signed in first"}>Open</Button>}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="relative shrink-0">
        <div className="absolute top-6 right-8 z-10 flex w-[132px] flex-col gap-2">
          <Button variant="quiet" small className="w-full" onClick={onOpenSettings}>Settings</Button>
          {projects.length > 0 && <Button small className="w-full" onClick={onAdd} aria-label="Add a project">+ Project</Button>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-3 px-8 pt-6 text-center">
        <KonaMark size={64} />
        <h1 className="m-0 text-[34px] leading-[42px] font-bold">Welcome to Kona</h1>
        {showSearch && (
          <input type="text" role="searchbox" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }}
            placeholder="Search projects" aria-label="Search projects" autoComplete="off" spellCheck={false} className="h-12 w-[420px] max-w-full px-2 text-[15px] text-text placeholder:text-text-tertiary" />
        )}
        {note && <p role="status" className="m-0 flex items-center justify-center gap-2 text-center text-[14px] leading-5 font-bold text-state-waiting"><Glyph state="waiting" size={16} />{note}</p>}
      </div>

      {projects.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-8 pb-10">
          <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
            <button type="button" onClick={onAdd} className="flex min-h-[112px] flex-col items-center justify-center gap-2 border-2 border-dashed border-line-strong text-text-secondary hover:bg-surface-2 hover:text-text">
              <span className="text-[28px] leading-8" aria-hidden="true">+</span>
              <span className="text-[15px] font-bold">Add your first project</span>
            </button>
            {error && <div className="flex items-start justify-center gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
          </div>
        </div>
      ) : (
        <>
          {error && <div className="flex shrink-0 items-start justify-center gap-2.5 px-8 pt-3 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
          {/* the groups are stacked from top to bottom, A to Z; the projects of a group sit side by side in one row that scrolls sideways by itself */}
          <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-6 pb-10 [scrollbar-gutter:stable]">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8">
              {searching && groups.length === 0 && <p role="status" className="m-0 text-center text-[15px] leading-6 text-text-secondary">No project matches “{query.trim()}”. It looks at the name, the group, the folder and the account.</p>}
              {groups.map((g) => (
                <section key={g.none ? "-" : g.name.toLowerCase()} aria-label={g.name} className="flex min-w-0 flex-col gap-4">
                  {headed && (
                    <div className="flex items-baseline gap-3 border-b-2 border-line-strong pb-2">
                      <h2 className="m-0 truncate text-[18px] leading-7 font-bold">{g.name}</h2>
                      <span className="shrink-0 text-[13px] leading-5 text-text-tertiary">{searching ? `${g.projects.length} of ${total.get(g.none ? "-" : g.name.toLowerCase())}` : g.projects.length} {(searching ? total.get(g.none ? "-" : g.name.toLowerCase()) : g.projects.length) === 1 ? "project" : "projects"}</span>
                    </div>
                  )}
                  <div className="flex items-stretch gap-4 overflow-x-auto pb-3">{g.projects.map((p) => <div key={p.id} className="flex w-[420px] shrink-0 flex-col">{card(p)}</div>)}</div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t-2 border-line-subtle px-8 py-3 text-[13px] leading-5 text-text-tertiary">
        <span className="font-mono">{version ? `Kona v${version}` : "Kona"}</span>
        <Button variant="ghost" small disabled={busyUpdate} onClick={() => void checkForUpdate(true)}>{update.phase === "checking" ? "Checking…" : "Check for updates"}</Button>
        {update.phase === "current" && <span className="flex items-center gap-1.5"><Glyph state="done" size={16} /> This is the newest version.</span>}
        {update.phase === "available" && <span className="flex items-center gap-1.5 text-text-secondary"><Glyph state="waiting" size={16} /> Kona {update.version} is ready.</span>}
        {update.phase === "error" && update.during === "check" && <span className="flex items-center gap-1.5 text-state-left"><Glyph state="left" size={16} /> {update.message}</span>}
      </div>

      {grouping && (
        <Confirm title={`Group of ${grouping.name}`} confirmLabel="Save" onConfirm={() => void saveGroup()} onCancel={() => setGrouping(null)}>
          <input autoFocus value={groupText} maxLength={40} onChange={(e) => setGroupText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveGroup(); }} placeholder="No group" aria-label="Group name" className="h-12 w-full px-2 text-[15px] text-text placeholder:text-text-tertiary" />
          {names.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Groups that exist">
              {names.map((n) => <Button key={n} variant="quiet" small on={groupText.trim().toLowerCase() === n.toLowerCase()} aria-pressed={groupText.trim().toLowerCase() === n.toLowerCase()} onClick={() => setGroupText(n)}>{n}</Button>)}
            </div>
          )}
        </Confirm>
      )}
    </div>
  );
}

/** The bar over the sub-pages of the welcome page (Add a project, Settings): the same back button as the top bar of a project, back to the projects. */
export function WelcomeBar({ onBack }: { onBack: () => void }) {
  return (
    <header className="flex min-h-[72px] shrink-0 items-center gap-4 border-b-2 border-line-strong bg-surface-1 px-5 py-2">
      <button type="button" onClick={onBack} title="Back to the projects" aria-label="Kona, back to the projects" className="px-btn px-btn-paper flex items-center gap-1.5 px-2">
        <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-text-secondary">
          <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
        <KonaMark size={32} />
        <span className="ml-1 text-[22px] leading-[30px] font-bold">Kona</span>
      </button>
    </header>
  );
}
