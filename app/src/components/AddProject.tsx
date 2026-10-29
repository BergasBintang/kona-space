// Add a project: pick the folder, name it. Kona adds a hidden folder for its notes and tells Git to ignore it.
import { useEffect, useMemo, useState } from "react";
import { accountStatusCached, addProject, baseName, pickFolder, type Account, type AccountStatus, type AddResult } from "../lib/api";
import { Select } from "./pick";
import { Button, Glyph } from "./ui";
import { Help } from "./Help";
import { KonaMark } from "./KonaMark";

export function AddProject({ first, accounts, onDone, onCancel, onOpenAccounts }: { first: boolean; accounts: Account[]; onDone: (r: AddResult) => void; onCancel: () => void; onOpenAccounts: () => void }) {
  const [folder, setFolder] = useState("");
  const [name, setName] = useState("");
  const [github, setGithub] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState<Record<string, AccountStatus>>({}); // an account with no entry has not answered yet
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
    try { onDone(await addProject(folder, name.trim() || undefined, github.trim() || undefined, account)); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-1 overflow-y-auto p-8">
      <div className="m-auto flex w-full max-w-[560px] flex-col gap-6">
        <div className="flex items-center gap-3"><KonaMark size={36} /><h1 className="m-0 text-[30px] leading-[38px] font-bold">{first ? "Add your first project" : "Add a project"}</h1><Help title="What a project is"><p className="m-0">A project is one folder with your code in it.</p><p className="m-0">Kona adds a hidden folder inside it for notes and tickets, and tells Git to ignore that folder. Nothing else in your project is changed.</p></Help></div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Folder</span>
          <div className="flex gap-3">
            <div className="flex h-11 min-w-0 flex-1 items-center border border-line-strong bg-inset px-3.5 font-mono text-[14px]">
              <span className={`truncate ${folder ? "" : "text-text-tertiary"}`}>{folder || "No folder picked yet"}</span>
            </div>
            <Button variant="quiet" onClick={choose}>Choose a folder</Button>
          </div>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="shop-api" className="h-11 border border-line-strong bg-inset px-3.5 text-[15px] text-text placeholder:text-text-tertiary" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">GitHub address (optional)</span>
          <input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="owner/name" aria-label="GitHub address" className="h-11 border border-line-strong bg-inset px-3.5 font-mono text-[15px] text-text placeholder:text-text-tertiary" />
        </label>
        <div className="flex flex-col gap-2">
          {signedIn.length > 0 || asking
            ? <Select label="Account" value={account} onChange={setAccount} placeholder={asking ? "Checking the accounts…" : "Choose an account"} disabled={asking} options={signedIn.map((a) => ({ value: a.id, label: a.label, hint: status[a.id]?.email ?? undefined }))} />
            : <div className="flex flex-col items-start gap-2"><span className="text-[13px] leading-5 font-bold text-text-secondary">Account</span><span className="text-[14px] leading-5 text-text-secondary">No account is signed in. A project needs one.</span><Button variant="quiet" small onClick={onOpenAccounts}>Sign in to an account</Button></div>}
          <span className="text-[13px] leading-5 text-text-tertiary">Every session in this project will use this account.</span>
        </div>
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex justify-end gap-3">
          {!first && <Button variant="quiet" onClick={onCancel}>Cancel</Button>}
          <Button onClick={add} disabled={!folder || !account || busy}>{busy ? "Adding…" : "Add project"}</Button>
        </div>
      </div>
    </div>
  );
}
