// The first screen of every launch: the Kona mark, a greeting, then one card per project with its account.
// A project has exactly one account (decision 42). A project without one asks for it here, once. A signed-out account offers Sign in or Use another account.
import { useCallback, useEffect, useState } from "react";
import { accountStatusCached, forgetAccountStatus, setProjectAccount, signInAccount, type Account, type AccountStatus, type Persona, type Project } from "../lib/api";
import { Button, Glyph } from "./ui";
import { Select } from "./pick";
import { checkForUpdate, useUpdate } from "../lib/update";
import { KonaMark } from "./KonaMark";

type Status = AccountStatus | "asking";

export function Hello({ projects, accounts, persona, version, note = null, onOpen, onAdd, onOpenAccounts, onProjects }: {
  version: string; note?: string | null; projects: Project[]; accounts: Account[]; persona: Persona; onOpen: (id: string) => void; onAdd: () => void; onOpenAccounts: () => void; onProjects: (next: Project[]) => void;
}) {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [swapping, setSwapping] = useState<string | null>(null); // the project whose account is being changed
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdate();
  const busyUpdate = update.phase === "checking" || update.phase === "downloading" || update.phase === "installing";

  const look = useCallback((id: string) => {
    setStatus((s) => ({ ...s, [id]: "asking" }));
    accountStatusCached(id).then((r) => setStatus((s) => ({ ...s, [id]: r }))).catch(() => setStatus((s) => ({ ...s, [id]: { logged_in: false } })));
  }, []);
  useEffect(() => { accounts.forEach((a) => look(a.id)); }, [accounts, look]);

  const signedIn = accounts.filter((a) => { const s = status[a.id]; return s && s !== "asking" && s.logged_in; });
  const choose = async (p: Project, accountId: string) => {
    setError(null);
    try { const next = await setProjectAccount(p.id, accountId); onProjects(projects.map((x) => (x.id === p.id ? next : x))); setSwapping(null); }
    catch (e) { setError(String(e)); }
  };
  const signIn = async (a: Account) => {
    setBusy(a.id); setError(null);
    try { await signInAccount(a.id); } catch (e) { setError(String(e)); }
    finally { setBusy(null); forgetAccountStatus(a.id); look(a.id); }
  };

  const picker = (p: Project, current: string | null) => (
    signedIn.length > 0
      ? <Select ariaLabel={`Account for ${p.name}`} value={current ?? ""} placeholder="Choose an account" onChange={(v) => void choose(p, v)} options={signedIn.map((a) => ({ value: a.id, label: a.label, hint: (status[a.id] as AccountStatus).email ?? undefined }))} />
      : <div className="flex flex-col items-start gap-2 text-[13px] leading-5 text-text-secondary">No account is signed in yet.<Button variant="quiet" small onClick={onOpenAccounts}>Sign in to an account</Button></div>
  );

  return (
    <div className="flex h-full flex-1 overflow-y-auto p-8">
      <div className="m-auto flex w-full max-w-[820px] flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <KonaMark size={64} />
          <h1 className="m-0 text-[34px] leading-[42px] font-bold">Welcome to Kona</h1>
          <p className="m-0 max-w-[520px] text-[15px] leading-6 text-text-tertiary">{persona.enabled ? persona.lines.greeting : "Pick a project to open its office."}</p>
        </div>

        {note && <p role="status" className="m-0 flex items-center justify-center gap-2 text-center text-[14px] leading-5 font-bold text-state-waiting"><Glyph state="waiting" size={16} />{note}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((p) => {
            const acc = accounts.find((a) => a.id === p.account) ?? null;
            const st = acc ? status[acc.id] : undefined;
            const checking = !!acc && (st === undefined || st === "asking");
            const ok = !!acc && !!st && st !== "asking" && st.logged_in;
            return (
              <div key={p.id} className="px-card flex flex-col gap-4 p-3">
                <div className="flex flex-col gap-1">
                  <h2 className="m-0 truncate text-[19px] leading-7 font-bold">{p.name}</h2>
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
                    <span className="flex items-center gap-2 text-[14px] leading-5">
                      <Glyph state={checking ? "idle" : ok ? "done" : "left"} size={16} />
                      <span className="text-text-secondary">Account: <span className="font-bold text-text">{acc.label}</span></span>
                      <span className={ok ? "text-text-tertiary" : checking ? "text-text-tertiary" : "font-bold text-state-left"}>· {checking ? "checking" : ok ? "signed in" : "signed out"}</span>
                    </span>
                    {!checking && (
                      <div className="flex flex-wrap gap-2">
                        {!ok && <Button variant="quiet" small disabled={busy === acc.id} onClick={() => void signIn(acc)}>{busy === acc.id ? "Waiting for the sign-in…" : "Sign in"}</Button>}
                        <Button variant="ghost" small onClick={() => setSwapping(swapping === p.id ? null : p.id)}>{ok ? "Change account" : "Use another account"}</Button>
                      </div>
                    )}
                    {swapping === p.id && picker(p, p.account ?? null)}
                  </div>
                )}

                <div className="flex justify-end"><Button small disabled={!ok} onClick={() => onOpen(p.id)} title={ok ? undefined : "Sign in first"}>Open</Button></div>
              </div>
            );
          })}
          <button type="button" onClick={onAdd} className="flex min-h-[148px] flex-col items-center justify-center gap-2 border-2 border-dashed border-line-strong text-text-secondary hover:bg-surface-2 hover:text-text">
            <span className="text-[28px] leading-8" aria-hidden="true">+</span>
            <span className="text-[15px] font-bold">Add another project</span>
          </button>
        </div>
        {error && <div className="flex items-start justify-center gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[13px] leading-5 text-text-tertiary">
          <span className="font-mono">{version ? `Kona v${version}` : "Kona"}</span>
          <Button variant="ghost" small disabled={busyUpdate} onClick={() => void checkForUpdate(true)}>{update.phase === "checking" ? "Checking…" : "Check for updates"}</Button>
          {update.phase === "current" && <span className="flex items-center gap-1.5"><Glyph state="done" size={16} /> This is the newest version.</span>}
          {update.phase === "available" && <span className="flex items-center gap-1.5 text-text-secondary"><Glyph state="waiting" size={16} /> Kona {update.version} is ready.</span>}
          {update.phase === "error" && update.during === "check" && <span className="flex items-center gap-1.5 text-state-left"><Glyph state="left" size={16} /> {update.message}</span>}
        </div>
      </div>
    </div>
  );
}
