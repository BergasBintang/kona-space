// The Accounts place: which Claude logins Kona can use. Each account is a folder Claude Code owns; Kona only asks
// whether it is signed in and never keeps a token. Two or three accounts of your own, each for its own purpose.
import { useCallback, useEffect, useState } from "react";
import { accountStatus, addAccount, removeAccount, renameAccount, signInAccount, type Account, type AccountStatus } from "../lib/api";
import { Button, Glyph } from "./ui";
import { Help } from "./Help";

function Card({ account, status, onChanged, onRemoved, onRefresh }: {
  account: Account; status: AccountStatus | undefined; onChanged: (a: Account) => void; onRemoved: (id: string) => void; onRefresh: () => void;
}) {
  const isMain = account.id === "main";
  const [name, setName] = useState<string | null>(null); // not null while renaming
  const [signing, setSigning] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setSigning(true); setError(null);
    try { await signInAccount(account.id); } catch (e) { setError(String(e)); }
    setSigning(false); onRefresh();
  };
  const rename = async () => {
    if (name === null) return;
    try { onChanged(await renameAccount(account.id, name)); setName(null); setError(null); } catch (e) { setError(String(e)); }
  };
  const remove = async () => {
    if (!confirm) { setConfirm(true); return; }
    try { await removeAccount(account.id); onRemoved(account.id); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-line-subtle bg-surface-1 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {name === null
            ? <div className="flex items-center gap-2.5"><h2 className="m-0 min-w-0 truncate text-[19px] leading-7 font-bold">{account.label}</h2>
                <Help title="About this account"><p className="m-0">{isMain ? "The login already on this PC, the one the terminal uses." : "Its own login folder, kept apart from the main account. It starts clean: sessions on this account do not see your personal Claude settings, skills or servers from the main account."}</p></Help></div>
            : <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void rename(); if (e.key === "Escape") setName(null); }}
                aria-label="Account name" className="h-10 w-[260px] rounded-control border border-line-strong bg-inset px-3 text-[15px] text-text" />}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] leading-5">
            {status === undefined
              ? <span className="text-text-tertiary">Checking…</span>
              : status.logged_in
                ? (<><Glyph state="done" size={16} /><span className="font-bold whitespace-nowrap">Signed in</span><span className="min-w-0 break-all text-text-secondary">{[status.plan && `${status.plan[0].toUpperCase()}${status.plan.slice(1)} plan`, status.email].filter(Boolean).join(" · ")}</span></>)
                : (<><Glyph state="left" size={16} /><span className="font-bold whitespace-nowrap text-state-left">Not signed in</span></>)}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {name === null
            ? <Button variant="ghost" small onClick={() => setName(account.label)}>Rename</Button>
            : (<><Button variant="ghost" small onClick={() => setName(null)}>Cancel</Button><Button small onClick={rename}>Save name</Button></>)}
          <Button variant={status?.logged_in ? "quiet" : "primary"} small onClick={signIn} disabled={signing}>{signing ? "Waiting for the browser…" : status?.logged_in ? "Sign in again" : "Sign in"}</Button>
        </div>
      </div>

      {account.config_dir && <span className="truncate font-mono text-[12px] leading-5 text-text-tertiary" title={account.config_dir}>{account.config_dir}</span>}
      {signing && <p className="m-0 text-[13px] leading-5 text-text-secondary">A sign-in page opened in your browser. Finish it there, then come back. Kona never sees your password.</p>}
      {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
      {!isMain && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] leading-5 text-text-tertiary">{confirm ? "Kona forgets this account. The folder and its login stay on the disk." : ""}</span>
          <Button variant={confirm ? "danger" : "ghost"} small onClick={remove}>{confirm ? "Yes, remove this account" : "Remove account"}</Button>
        </div>
      )}
    </div>
  );
}

export function Accounts({ accounts, onChanged }: { accounts: Account[]; onChanged: (next: Account[]) => void }) {
  const [status, setStatus] = useState<Record<string, AccountStatus>>({});
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    accounts.forEach((a) => { accountStatus(a.id).then((s) => setStatus((cur) => ({ ...cur, [a.id]: s }))).catch(() => setStatus((cur) => ({ ...cur, [a.id]: { logged_in: false } }))); });
  }, [accounts]);
  useEffect(refresh, [refresh]);

  const add = async () => {
    try { const a = await addAccount(label); onChanged([...accounts, a]); setLabel(""); setError(null); } catch (e) { setError(String(e)); }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[calc(880px*var(--k))] flex-col gap-6 px-8 pt-8 pb-10">
        <div className="flex items-center gap-3"><h1 className="m-0 text-[30px] leading-[38px] font-bold">Accounts</h1><Help title="Accounts"><p className="m-0">The Claude logins Kona can use. Pick one when you start a session, or give a role a usual one.</p><p className="m-0">Each account has its own limits. Use a second account for a real separate purpose, such as work and personal, not to get around a limit.</p></Help></div>
        {accounts.map((a) => (
          <Card key={a.id} account={a} status={status[a.id]} onRefresh={refresh}
            onChanged={(x) => onChanged(accounts.map((y) => (y.id === x.id ? x : y)))} onRemoved={(id) => onChanged(accounts.filter((y) => y.id !== id))} />
        ))}
        <div className="flex flex-col gap-3 rounded-card border border-dashed border-line-strong p-5">
          <div className="flex items-center gap-2.5"><h2 className="m-0 text-[17px] leading-6 font-bold">Add an account</h2><Help title="Add an account"><p className="m-0">Kona makes an empty login folder for it. Press Sign in on the new card to log in once.</p></Help></div>
          <div className="flex gap-3">
            <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && label.trim()) void add(); }} placeholder="Work"
              aria-label="Name of the new account" className="h-11 min-w-0 flex-1 rounded-control border border-line-strong bg-inset px-3.5 text-[15px] text-text placeholder:text-text-tertiary" />
            <Button onClick={add} disabled={!label.trim()}>Add account</Button>
          </div>
          {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        </div>
      </div>
    </main>
  );
}
