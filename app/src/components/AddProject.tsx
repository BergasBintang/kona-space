// Add a project: pick the folder, name it, file it in a group, choose its account. Kona adds a hidden folder for its notes and tells Git to ignore it.
// Every field is the same width and 48 px high: the folder is a field too (pressing it opens the folder dialog), so no button sits beside a box.
import { useEffect, useId, useMemo, useState } from "react";
import { accountStatusCached, addProject, baseName, pickFolder, type Account, type AccountStatus, type AddResult } from "../lib/api";
import { Select } from "./pick";
import { triggerBase } from "./pick/parts";
import { Button, Glyph } from "./ui";
import { Help } from "./Help";
import { KonaMark } from "./KonaMark";

export function AddProject({ first, accounts, groups, onDone, onCancel, onOpenAccounts }: { first: boolean; accounts: Account[]; groups: string[]; onDone: (r: AddResult) => void; onCancel: () => void; onOpenAccounts: () => void }) {
  const [folder, setFolder] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState<Record<string, AccountStatus>>({}); // an account with no entry has not answered yet
  const folderLabel = useId();
  useEffect(() => {
    accounts.forEach((a) => { accountStatusCached(a.id).then((r) => setStatus((s) => ({ ...s, [a.id]: r }))).catch(() => setStatus((s) => ({ ...s, [a.id]: { logged_in: false } }))); });
  }, [accounts]);
  const signedIn = useMemo(() => accounts.filter((a) => status[a.id]?.logged_in), [accounts, status]);
  const asking = accounts.some((a) => status[a.id] === undefined);
  useEffect(() => { if (!account && signedIn.length === 1) setAccount(signedIn[0].id); }, [signedIn, account]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    const p = await pickFolder("Pick the folder of the project");
    if (p) { setFolder(p); setName((n) => n || baseName(p)); setError(null); }
  };
  const add = async () => {
    setBusy(true); setError(null);
    try { onDone(await addProject(folder, name.trim() || undefined, account, group.trim() || undefined)); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-1 overflow-y-auto p-8">
      <div className="m-auto flex w-full max-w-[560px] flex-col gap-6">
        <div className="flex items-center gap-3"><KonaMark size={36} /><h1 className="m-0 text-[30px] leading-[38px] font-bold">{first ? "Add your first project" : "Add a project"}</h1><Help title="What a project is"><p className="m-0">A project is one folder with your code in it. Every session in it uses the account you choose here.</p><p className="m-0">Kona adds a hidden folder inside it for notes and tickets, and tells Git to ignore that folder. Nothing else in your project is changed.</p></Help></div>
        <div className="flex flex-col gap-2">
          <span id={folderLabel} className="text-[13px] leading-5 font-bold text-text-secondary">Folder</span>
          <button type="button" onClick={choose} aria-labelledby={folderLabel} className={`${triggerBase} font-mono text-[14px]`}>
            <span className={`min-w-0 flex-1 truncate ${folder ? "" : "text-text-tertiary"}`}>{folder || "No folder picked yet"}</span>
            <span className="shrink-0 text-[13px] font-bold text-text-secondary">{folder ? "Change" : "Choose a folder"}</span>
          </button>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="shop-api" className="h-12 w-full px-2 text-[15px] text-text placeholder:text-text-tertiary" />
        </label>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] leading-5 font-bold text-text-secondary">Group (optional)</span>
            <input value={group} maxLength={40} onChange={(e) => setGroup(e.target.value)} placeholder="No group" className="h-12 w-full px-2 text-[15px] text-text placeholder:text-text-tertiary" />
          </label>
          {groups.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Groups that exist">
              {groups.map((g) => <Button key={g} variant="quiet" small on={group.trim().toLowerCase() === g.toLowerCase()} aria-pressed={group.trim().toLowerCase() === g.toLowerCase()} onClick={() => setGroup(g)}>{g}</Button>)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {signedIn.length > 0 || asking
            ? <Select label="Account" value={account} onChange={setAccount} placeholder={asking ? "Checking the accounts…" : "Choose an account"} disabled={asking} options={signedIn.map((a) => ({ value: a.id, label: a.label, hint: status[a.id]?.email ?? undefined }))} />
            : <div className="flex flex-col items-start gap-2"><span className="text-[13px] leading-5 font-bold text-text-secondary">Account</span><span className="text-[14px] leading-5 text-text-secondary">{accounts.length === 0 ? "Kona has no account yet. A project needs one." : "No account is signed in. A project needs one."}</span><Button variant="quiet" small onClick={onOpenAccounts}>{accounts.length === 0 ? "Add an account" : "Sign in to an account"}</Button></div>}
        </div>
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex justify-end gap-3">
          <Button variant="quiet" onClick={onCancel}>Cancel</Button>
          <Button onClick={add} disabled={!folder || !account || busy}>{busy ? "Adding…" : "Add project"}</Button>
        </div>
      </div>
    </div>
  );
}
