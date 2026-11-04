// The Servers place (feature F8): the servers a project may reach, and the GitHub repos it uses, as REFERENCES. Kona keeps a name, host, port, user, the
// path of the key file, the fingerprint and which roles may use it. It never opens or stores a key. A role can run ssh, scp or sftp only to a host listed
// here for that role; every such command still shows an approval card with the name. Kona never connects to a server for you: the one thing it does on
// request is read a public fingerprint, after you confirm.
// A GitHub repo is a card of its own (kind "github"): the nickname its git address uses (an entry of `~\.ssh\config`), the machine behind that nickname,
// the read-write key on this PC, the read-only key that is handed to servers, and the servers that pull the repo with where that key is ON each server
// (a note: Kona never sees it). It is a server entry underneath, so the same checks apply to its nickname.
import { useCallback, useEffect, useMemo, useState } from "react";
import { roleLabel, saveServer, listServers, removeServer, readFingerprints, keyState, pickFile, type Fingerprint, type KeyState, type Project, type Pull, type Role, type Server } from "../lib/api";
import { Button, Glyph, RoleMark } from "./ui";
import { Confirm } from "./Confirm";
import { MultiSelect, Select } from "./pick";
import { Help } from "./Help";

const blank = (project_id: string, kind = ""): Server => ({
  id: "", project_id, label: "", host: "", port: 22, user: kind === "github" ? "git" : "", key_path: "", fingerprints: [], roles: [], notes: "",
  kind, real_host: kind === "github" ? "github.com" : "", repo: "", ro_key_path: "", pulled_by: [],
});
const field = "h-11 border border-line-strong bg-inset px-3.5 text-[15px] text-text placeholder:text-text-tertiary";
const label = "text-[13px] leading-5 font-bold text-text-secondary";

/** A ready-to-paste entry for `~\.ssh\config`: the key is named, and only that key is tried. Kona never writes that file. */
export const configEntry = (s: Server) => `Host ${s.host}\n${s.real_host ? `  HostName ${s.real_host}\n` : ""}  User ${s.user}\n  Port ${s.port}\n  IdentityFile ${s.key_path}\n  IdentitiesOnly yes`;
/** The same entry for the server that pulls a repo: the read-only key is at `keyPath` ON that server. */
export const serverEntry = (s: Server, keyPath: string) => `Host ${s.host}\n  HostName ${s.real_host || s.host}\n  User ${s.user}\n  Port ${s.port}\n  IdentityFile ${keyPath}\n  IdentitiesOnly yes`;
/** What goes after `git clone` or into `git remote`: the nickname stands where github.com would. */
export const gitAddress = (s: Server) => `git@${s.host}:${s.repo}.git`;

function KeyLine({ path, what }: { path: string; what?: string }) {
  const [st, setSt] = useState<KeyState | null>(null);
  useEffect(() => { let live = true; if (path) keyState(path).then((s) => { if (live) setSt(s); }).catch(() => {}); return () => { live = false; }; }, [path]);
  const lead = what ? <span className="font-bold text-text">{what}<span className="font-normal text-text-tertiary"> · </span></span> : null;
  if (!path) return <span className="flex items-center gap-2 text-[13px] leading-5 text-state-waiting"><Glyph state="waiting" size={14} /><span>{lead}No key file named</span></span>;
  return (
    <div className="flex flex-col gap-1 text-[13px] leading-5">
      <span className="flex items-center gap-2"><Glyph state={st?.is_file ? "done" : st ? "left" : "idle"} size={14} /><span className={st && !st.is_file ? "font-bold text-state-left" : "text-text-secondary"}>{lead}{st === null ? "Checking the key file…" : st.is_file ? "Key file found" : st.exists ? "That path is not a file" : "Key file not found"}</span></span>
      {st?.inside_a_project && <span className="flex items-center gap-2 font-bold text-state-waiting"><Glyph state="waiting" size={14} />The key file is inside a project folder, where Git could pick it up. Move it out.</span>}
      {st?.synced_folder && <span className="flex items-center gap-2 font-bold text-state-waiting"><Glyph state="waiting" size={14} />The key file is in a folder that syncs to the cloud. Keep keys out of synced folders.</span>}
    </div>
  );
}

function KeyPath({ value, onChange, aria, what }: { value: string; onChange: (v: string) => void; aria: string; what: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={label}>{what}</span>
      <div className="flex gap-3">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="C:\Users\you\.ssh\name" aria-label={aria} className={`${field} min-w-0 flex-1 font-mono`} />
        <Button variant="quiet" onClick={async () => { const p = await pickFile("Pick the key file"); if (p) onChange(p); }}>Choose…</Button>
      </div>
      {value && <KeyLine path={value} />}
    </div>
  );
}

export function Servers({ project, roles }: { project: Project; roles: Role[] }) {
  const [list, setList] = useState<Server[] | null>(null);
  const [draft, setDraft] = useState<Server | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState<Server | null>(null);
  const [look, setLook] = useState<{ server: Server; prints?: Fingerprint[]; error?: string } | null>(null); // the fingerprint dialog
  const [asked, setAsked] = useState<Server | null>(null); // the "Kona will connect" confirmation
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => { listServers(project.id).then(setList).catch((e) => { setList([]); setError(String(e)); }); }, [project.id]);
  useEffect(() => { setList(null); setDraft(null); load(); }, [load]);

  const servers = useMemo(() => (list ?? []).filter((s) => s.kind !== "github"), [list]);
  const repos = useMemo(() => (list ?? []).filter((s) => s.kind === "github"), [list]);
  const serverName = (id: string) => servers.find((x) => x.id === id)?.label ?? "A removed server";
  const roleName = (id: string) => { const r = roles.find((x) => x.id === id); return r ? roleLabel(r) : "A removed role"; };
  const save = async (s: Server) => {
    setBusy(true); setError(null);
    try { await saveServer(s); setDraft(null); load(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  /** where the fingerprint is read from: the real machine behind a nickname, else the host itself */
  const reads = (s: Server) => s.real_host || s.host;

  const runLook = async (s: Server) => {
    setAsked(null); setLook({ server: s });
    try { setLook({ server: s, prints: await readFingerprints(reads(s), s.port) }); } catch (e) { setLook({ server: s, error: String(e) }); }
  };
  const trust = async () => {
    if (!look?.prints) return;
    await save({ ...look.server, fingerprints: look.prints.map((p) => p.fingerprint) });
    setLook(null);
  };
  const copy = async (id: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000); } catch { /* shown on screen to copy by hand */ } };
  const state = (s: Server, prints?: Fingerprint[]) => {
    if (s.fingerprints.length === 0) return { glyph: "idle" as const, word: "Fingerprint not checked yet", tone: "text-text-secondary" };
    if (prints && !prints.some((p) => s.fingerprints.includes(p.fingerprint))) return { glyph: "left" as const, word: "The fingerprint CHANGED", tone: "text-state-left" };
    return { glyph: "done" as const, word: `Fingerprint saved (${s.fingerprints.length})`, tone: "text-state-done" };
  };
  const roleOptions = useMemo(() => roles.map((r) => ({ value: r.id, label: roleLabel(r), hint: r.group })), [roles]);

  const card = (s: Server) => {
    const st = state(s, look?.server.id === s.id ? look.prints : undefined);
    const isRepo = s.kind === "github";
    return (
      <section key={s.id} aria-label={s.label} className="flex flex-col gap-4 border border-line-subtle bg-surface-1 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="m-0 truncate text-[18px] leading-7 font-bold">{s.label}</h2>
            {isRepo
              ? <span className="truncate font-mono text-[14px] leading-5 text-text-secondary" title={gitAddress(s)}>{gitAddress(s)}</span>
              : <>
                  <span className="font-mono text-[14px] leading-5 text-text-secondary">{s.user}@{s.host}{s.port !== 22 ? `:${s.port}` : ""}</span>
                  <span className="truncate font-mono text-[12px] leading-5 text-text-tertiary" title={s.key_path}>{s.key_path || "(no key file)"}</span>
                </>}
          </div>
          <div className="flex shrink-0 gap-2"><Button variant="ghost" small onClick={() => { setDraft(s); setError(null); }}>Edit</Button><Button variant="ghost" small onClick={() => setConfirmDrop(s)}>Remove…</Button></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Roles that may use it:</span>
          {s.roles.length === 0 && <span className="text-[13px] leading-5 text-state-waiting">none, so no role can connect</span>}
          {s.roles.map((r) => <span key={r} className="flex items-center gap-1.5 bg-surface-3 py-0.5 pr-2.5 pl-1 text-[12px] leading-5 font-bold"><RoleMark roleId={r} size={20} />{roleName(r)}</span>)}
        </div>
        {isRepo
          ? <>
              <KeyLine path={s.key_path} what="Read and write key, this PC" />
              {s.ro_key_path && <KeyLine path={s.ro_key_path} what="Read-only key, this PC" />}
              {s.pulled_by.length > 0 && (
                <div className="flex flex-col gap-2">
                  {s.pulled_by.map((p) => {
                    const srv = servers.find((x) => x.id === p.server_id);
                    return (
                      <div key={p.server_id} className="flex flex-wrap items-center justify-between gap-3">
                        <span className="min-w-0 text-[13px] leading-5 text-text-secondary"><span className="font-bold text-text">Pulled by {serverName(p.server_id)}</span> · read-only key there: <span className="font-mono text-[12px] text-text-tertiary">{p.key_path || "(path not noted)"}</span></span>
                        {srv && <Button variant="quiet" small onClick={() => copy(`${s.id}:${p.server_id}`, serverEntry(s, p.key_path))}>{copied === `${s.id}:${p.server_id}` ? "Copied" : "Copy server entry"}</Button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          : <KeyLine path={s.key_path} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`flex items-center gap-2 text-[13px] leading-5 font-bold ${st.tone}`}><Glyph state={st.glyph} size={16} />{st.word}</span>
          <div className="flex flex-wrap gap-2">
            {isRepo && <Button variant="quiet" small onClick={() => copy(`${s.id}:git`, gitAddress(s))}>{copied === `${s.id}:git` ? "Copied" : "Copy git address"}</Button>}
            <Button variant="quiet" small onClick={() => copy(s.id, configEntry(s))}>{copied === s.id ? "Copied" : "Copy ssh config entry"}</Button>
            <Button variant="quiet" small onClick={() => setAsked(s)}>{s.fingerprints.length ? "Check the fingerprint" : "Read the fingerprint…"}</Button>
          </div>
        </div>
        {s.fingerprints.length > 0 && <div className="flex flex-col gap-0.5 font-mono text-[12px] leading-5 text-text-tertiary">{s.fingerprints.map((f) => <span key={f} className="break-all">{f}</span>)}</div>}
        {s.notes && <p className="m-0 text-[13px] leading-5 text-text-secondary">{s.notes}</p>}
      </section>
    );
  };

  const form = (d: Server) => {
    const isRepo = d.kind === "github";
    const set = (p: Partial<Server>) => setDraft({ ...d, ...p });
    const setPull = (i: number, p: Partial<Pull>) => set({ pulled_by: d.pulled_by.map((x, k) => (k === i ? { ...x, ...p } : x)) });
    const free = servers.filter((x) => !d.pulled_by.some((p) => p.server_id === x.id));
    const ready = !!d.label.trim() && !!d.host.trim() && (isRepo ? !!d.repo.trim() : !!d.user.trim());
    return (
      <section aria-label={d.id ? (isRepo ? "Edit repo" : "Edit server") : (isRepo ? "Add a GitHub repo" : "Add a server")} className="flex flex-col gap-4 border border-accent bg-surface-1 p-5">
        <h2 className="m-0 text-[18px] leading-7 font-bold">{d.id ? (isRepo ? "Edit the repo" : "Edit the server") : (isRepo ? "Add a GitHub repo" : "Add a server")}</h2>
        {isRepo ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2"><span className={label}>Name</span><input value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="Kona" aria-label="Name" className={field} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Repo (owner/name)</span><input value={d.repo} onChange={(e) => set({ repo: e.target.value })} placeholder="owner/name" aria-label="Repo" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Nickname (the name in your ssh config)</span><input value={d.host} onChange={(e) => set({ host: e.target.value })} placeholder="github-kona" aria-label="Nickname" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Real address (the machine behind the nickname)</span><input value={d.real_host} onChange={(e) => set({ real_host: e.target.value })} placeholder="github.com" aria-label="Real address" className={`${field} font-mono`} /></label>
            </div>
            <KeyPath value={d.key_path} onChange={(v) => set({ key_path: v })} aria="Read and write key file path" what="Read and write key on this PC (the path only: Kona never opens it)" />
            <KeyPath value={d.ro_key_path} onChange={(v) => set({ ro_key_path: v })} aria="Read-only key file path" what="Read-only key on this PC, the copy you hand to a server (optional)" />
            <div className="flex flex-col gap-3">
              <span className={label}>Servers that pull this repo</span>
              {d.pulled_by.map((p, i) => (
                <div key={p.server_id} className="flex items-end gap-3">
                  <Select ariaLabel={`Server that pulls it ${i + 1}`} value={p.server_id} onChange={(v) => setPull(i, { server_id: v })} options={servers.filter((x) => x.id === p.server_id || free.includes(x)).map((x) => ({ value: x.id, label: x.label }))} className="w-64 shrink-0" />
                  <input value={p.key_path} onChange={(e) => setPull(i, { key_path: e.target.value })} placeholder="Where the read-only key is on that server: ~/.ssh/name" aria-label={`Key path on the server ${i + 1}`} className={`${field} min-w-0 flex-1 font-mono`} />
                  <Button variant="ghost" small onClick={() => set({ pulled_by: d.pulled_by.filter((_, k) => k !== i) })}>Remove</Button>
                </div>
              ))}
              {servers.length === 0
                ? <span className="text-[13px] leading-5 text-state-waiting">No servers in this project yet. Add one to say which server pulls this repo.</span>
                : <div><Button variant="quiet" small disabled={free.length === 0} onClick={() => set({ pulled_by: [...d.pulled_by, { server_id: free[0].id, key_path: "" }] })}>Add a server that pulls it</Button></div>}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2"><span className={label}>Name</span><input value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="Web server" aria-label="Name" className={field} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Host (what you type after ssh)</span><input value={d.host} onChange={(e) => set({ host: e.target.value })} placeholder="web.example.com" aria-label="Host" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className={label}>User</span><input value={d.user} onChange={(e) => set({ user: e.target.value })} placeholder="deploy" aria-label="User" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Port</span><input value={String(d.port)} inputMode="numeric" onChange={(e) => set({ port: Number(e.target.value.replace(/\D/g, "")) || 0 })} aria-label="Port" className={`${field} font-mono`} /></label>
            </div>
            <KeyPath value={d.key_path} onChange={(v) => set({ key_path: v })} aria="Key file path" what="Key file (the path only: Kona never opens it)" />
          </>
        )}
        <MultiSelect label="Roles that may use this" values={d.roles} onChange={(v) => set({ roles: v })} placeholder="None: no role can connect" options={roleOptions} />
        <label className="flex flex-col gap-2"><span className={label}>Notes (no passwords or keys)</span><textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} aria-label="Notes" className="border border-line-strong bg-inset px-3.5 py-3 text-[15px] leading-6 text-text" /></label>
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex justify-end gap-3"><Button variant="quiet" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={() => save(d)} disabled={busy || !ready}>{busy ? "Saving…" : "Save"}</Button></div>
      </section>
    );
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex w-full flex-col gap-6 px-8 pt-8 pb-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><h1 className="m-0 text-[30px] leading-[38px] font-bold">Servers</h1><Help title="Servers"><p className="m-0">The servers and GitHub repos {project.name} may reach. Kona keeps where the key files are, never the keys.</p><p className="m-0">A role can use one only if it is listed here for that role, and every command still asks you first.</p></Help></div>
          <div className="flex shrink-0 gap-3">
            <Button variant="quiet" onClick={() => { setDraft(blank(project.id, "github")); setError(null); }}>Add a GitHub repo</Button>
            <Button onClick={() => { setDraft(blank(project.id)); setError(null); }}>Add a server</Button>
          </div>
        </div>

        {list === null && <p className="m-0 text-text-tertiary">Reading the list…</p>}
        {list && list.length === 0 && !draft && (
          <div className="flex flex-col gap-2 border border-dashed border-line-strong p-6">
            <span className="font-bold">No servers for this project yet.</span>
            <span className="text-[14px] leading-5 text-text-secondary">Until you add one, no role can run ssh, scp or sftp in this project: those commands are refused before they run.</span>
          </div>
        )}

        {servers.map(card)}
        {repos.map(card)}
        {draft && form(draft)}
      </div>

      {asked && (
        <Confirm title="Read this server's fingerprint?" confirmLabel="Connect and read it" onConfirm={() => void runLook(asked)} onCancel={() => setAsked(null)}>
          <p className="m-0">Kona will connect to <span className="font-mono text-[14px] text-text">{reads(asked)}:{asked.port}</span> only to read the public host keys. It sends no login and runs nothing on the server.</p>
          <p className="m-0">Nothing is saved until you have compared what comes back with the real record.</p>
        </Confirm>
      )}
      {look && (
        <Confirm title={look.prints ? (look.server.fingerprints.length === 0 ? "Is this the right server?" : state(look.server, look.prints).glyph === "left" ? "The fingerprint has changed" : "The fingerprint matches") : look.error ? "Could not read the fingerprint" : "Reading the fingerprint…"}
          confirmLabel={look.server.fingerprints.length === 0 ? "Trust and save" : "Save the new fingerprint"} danger={!!look.prints && look.server.fingerprints.length > 0 && state(look.server, look.prints).glyph === "left"}
          noConfirm={!!look.error} cancelLabel={look.error ? "Close" : "Cancel"} busy={!look.prints && !look.error} disabled={!look.prints || (look.server.fingerprints.length > 0 && state(look.server, look.prints).glyph === "done")} error={look.error} onConfirm={() => void trust()} onCancel={() => setLook(null)}>
          {look.prints && (
            <>
              {look.prints.map((p) => <p key={p.fingerprint} className="m-0 break-all font-mono text-[13px] leading-5 text-text"><span className="font-sans font-bold text-text-secondary">{p.kind}</span> {p.fingerprint}</p>)}
              {look.server.fingerprints.length === 0
                ? (look.server.kind === "github"
                  ? <p className="m-0">Compare these with the fingerprints GitHub publishes for its own servers before you trust them. If they differ, do not save.</p>
                  : <p className="m-0">Compare these with the server's own record before you trust them. On the server: <span className="font-mono text-[13px] text-text">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</span>. If they differ, do not save.</p>)
                : state(look.server, look.prints).glyph === "left"
                  ? <p className="m-0 font-bold text-state-left">None of these match the fingerprint you saved. The server may have been rebuilt, or something may be in the way of the connection. Find out which before you trust it again.</p>
                  : <p className="m-0">These match what you saved. Nothing to do.</p>}
            </>
          )}
        </Confirm>
      )}
      {confirmDrop && (
        <Confirm title={confirmDrop.kind === "github" ? "Remove this repo?" : "Remove this server?"} confirmLabel="Remove it" danger onConfirm={() => { void removeServer(confirmDrop.id).then(() => { setConfirmDrop(null); load(); }); }} onCancel={() => setConfirmDrop(null)}>
          <p className="m-0">“{confirmDrop.label}” is taken off the list. Roles that used it can no longer connect to it through Kona. Nothing on the server, on GitHub or in your key files changes.</p>
        </Confirm>
      )}
    </main>
  );
}
