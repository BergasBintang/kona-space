// The Servers place (feature F8): the servers a project may reach, as REFERENCES. Kona keeps a name, host, port, user, the path of the key file,
// the server's fingerprint and which roles may use it. It never opens or stores a key. A role can run ssh, scp or sftp only to a server listed
// here for that role; every such command still shows an approval card with the server's name. Kona never connects to a server for you: the one
// thing it does on request is read a server's public fingerprint, after you confirm.
import { useCallback, useEffect, useMemo, useState } from "react";
import { saveServer, listServers, removeServer, readFingerprints, keyState, pickFile, type Fingerprint, type KeyState, type Project, type Role, type Server } from "../lib/api";
import { Button, Glyph, RoleMark } from "./ui";
import { Confirm } from "./Confirm";
import { MultiSelect } from "./pick";
import { Help } from "./Help";

const blank = (project_id: string): Server => ({ id: "", project_id, label: "", host: "", port: 22, user: "", key_path: "", fingerprints: [], roles: [], notes: "" });
const field = "h-11 rounded-control border border-line-strong bg-inset px-3.5 text-[15px] text-text placeholder:text-text-tertiary";

/** A ready-to-paste entry for `~\.ssh\config`: the key is named, and only that key is tried. Kona never writes that file. */
export const configEntry = (s: Server) => `Host ${s.host}\n  User ${s.user}\n  Port ${s.port}\n  IdentityFile ${s.key_path}\n  IdentitiesOnly yes`;

function KeyLine({ path }: { path: string }) {
  const [st, setSt] = useState<KeyState | null>(null);
  useEffect(() => { let live = true; keyState(path).then((s) => { if (live) setSt(s); }).catch(() => {}); return () => { live = false; }; }, [path]);
  if (!path) return <span className="flex items-center gap-2 text-[13px] leading-5 text-state-waiting"><Glyph state="waiting" size={14} />No key file named</span>;
  return (
    <div className="flex flex-col gap-1 text-[13px] leading-5">
      <span className="flex items-center gap-2"><Glyph state={st?.is_file ? "done" : st ? "left" : "idle"} size={14} /><span className={st && !st.is_file ? "font-bold text-state-left" : "text-text-secondary"}>{st === null ? "Checking the key file…" : st.is_file ? "Key file found" : st.exists ? "That path is not a file" : "Key file not found"}</span></span>
      {st?.inside_a_project && <span className="flex items-center gap-2 font-bold text-state-waiting"><Glyph state="waiting" size={14} />The key file is inside a project folder, where Git could pick it up. Move it out.</span>}
      {st?.synced_folder && <span className="flex items-center gap-2 font-bold text-state-waiting"><Glyph state="waiting" size={14} />The key file is in a folder that syncs to the cloud. Keep keys out of synced folders.</span>}
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

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "A removed role";
  const save = async (s: Server) => {
    setBusy(true); setError(null);
    try { await saveServer(s); setDraft(null); load(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const runLook = async (s: Server) => {
    setAsked(null); setLook({ server: s });
    try { setLook({ server: s, prints: await readFingerprints(s.host, s.port) }); } catch (e) { setLook({ server: s, error: String(e) }); }
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
  const roleOptions = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name, hint: r.group })), [roles]);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[calc(1160px*var(--k))] flex-col gap-6 px-8 pt-8 pb-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><h1 className="m-0 text-[30px] leading-[38px] font-bold">Servers</h1><Help title="Servers"><p className="m-0">The servers {project.name} may reach. Kona keeps where the key file is, never the key.</p><p className="m-0">A role can use a server only if it is listed here for that role, and every command still asks you first.</p></Help></div>
          <Button onClick={() => { setDraft(blank(project.id)); setError(null); }}>Add a server</Button>
        </div>

        {list === null && <p className="m-0 text-text-tertiary">Reading the list…</p>}
        {list && list.length === 0 && !draft && (
          <div className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong p-6">
            <span className="font-bold">No servers for this project yet.</span>
            <span className="text-[14px] leading-5 text-text-secondary">Until you add one, no role can run ssh, scp or sftp in this project: those commands are refused before they run.</span>
          </div>
        )}

        {(list ?? []).map((s) => {
          const st = state(s, look?.server.id === s.id ? look.prints : undefined);
          return (
            <section key={s.id} aria-label={s.label} className="flex flex-col gap-4 rounded-card border border-line-subtle bg-surface-1 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="m-0 truncate text-[18px] leading-7 font-bold">{s.label}</h2>
                  <span className="font-mono text-[14px] leading-5 text-text-secondary">{s.user}@{s.host}{s.port !== 22 ? `:${s.port}` : ""}</span>
                  <span className="truncate font-mono text-[12px] leading-5 text-text-tertiary" title={s.key_path}>{s.key_path || "(no key file)"}</span>
                </div>
                <div className="flex shrink-0 gap-2"><Button variant="ghost" small onClick={() => { setDraft(s); setError(null); }}>Edit</Button><Button variant="ghost" small onClick={() => setConfirmDrop(s)}>Remove…</Button></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] leading-5 font-bold text-text-secondary">Roles that may use it:</span>
                {s.roles.length === 0 && <span className="text-[13px] leading-5 text-state-waiting">none, so no role can connect</span>}
                {s.roles.map((r) => <span key={r} className="flex items-center gap-1.5 rounded-full bg-surface-3 py-0.5 pr-2.5 pl-1 text-[12px] leading-5 font-bold"><RoleMark roleId={r} size={20} />{roleName(r)}</span>)}
              </div>
              <KeyLine path={s.key_path} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`flex items-center gap-2 text-[13px] leading-5 font-bold ${st.tone}`}><Glyph state={st.glyph} size={16} />{st.word}</span>
                <div className="flex gap-2">
                  <Button variant="quiet" small onClick={() => copy(s.id, configEntry(s))}>{copied === s.id ? "Copied" : "Copy ssh config entry"}</Button>
                  <Button variant="quiet" small onClick={() => setAsked(s)}>{s.fingerprints.length ? "Check the fingerprint" : "Read the fingerprint…"}</Button>
                </div>
              </div>
              {s.fingerprints.length > 0 && <div className="flex flex-col gap-0.5 font-mono text-[12px] leading-5 text-text-tertiary">{s.fingerprints.map((f) => <span key={f} className="break-all">{f}</span>)}</div>}
              {s.notes && <p className="m-0 text-[13px] leading-5 text-text-secondary">{s.notes}</p>}
            </section>
          );
        })}

        {draft && (
          <section aria-label={draft.id ? "Edit server" : "Add a server"} className="flex flex-col gap-4 rounded-card border border-accent bg-surface-1 p-5">
            <h2 className="m-0 text-[18px] leading-7 font-bold">{draft.id ? "Edit the server" : "Add a server"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2"><span className="text-[13px] leading-5 font-bold text-text-secondary">Name</span><input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Web server" aria-label="Name" className={field} /></label>
              <label className="flex flex-col gap-2"><span className="text-[13px] leading-5 font-bold text-text-secondary">Host (what you type after ssh)</span><input value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} placeholder="web.example.com" aria-label="Host" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className="text-[13px] leading-5 font-bold text-text-secondary">User</span><input value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} placeholder="deploy" aria-label="User" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className="text-[13px] leading-5 font-bold text-text-secondary">Port</span><input value={String(draft.port)} inputMode="numeric" onChange={(e) => setDraft({ ...draft, port: Number(e.target.value.replace(/\D/g, "")) || 0 })} aria-label="Port" className={`${field} font-mono`} /></label>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">Key file (the path only: Kona never opens it)</span>
              <div className="flex gap-3">
                <input value={draft.key_path} onChange={(e) => setDraft({ ...draft, key_path: e.target.value })} placeholder="C:\Users\you\.ssh\web_deploy" aria-label="Key file path" className={`${field} min-w-0 flex-1 font-mono`} />
                <Button variant="quiet" onClick={async () => { const p = await pickFile("Pick the key file"); if (p) setDraft((d) => (d ? { ...d, key_path: p } : d)); }}>Choose…</Button>
              </div>
              {draft.key_path && <KeyLine path={draft.key_path} />}
            </div>
            <MultiSelect label="Roles that may use this server" values={draft.roles} onChange={(v) => setDraft({ ...draft, roles: v })} placeholder="None: no role can connect" options={roleOptions} />
            <label className="flex flex-col gap-2"><span className="text-[13px] leading-5 font-bold text-text-secondary">Notes (no passwords or keys)</span><textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} aria-label="Notes" className="rounded-control border border-line-strong bg-inset px-3.5 py-3 text-[15px] leading-6 text-text" /></label>
            {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
            <div className="flex justify-end gap-3"><Button variant="quiet" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={() => save(draft)} disabled={busy || !draft.label.trim() || !draft.host.trim() || !draft.user.trim()}>{busy ? "Saving…" : "Save"}</Button></div>
          </section>
        )}
      </div>

      {asked && (
        <Confirm title="Read this server's fingerprint?" confirmLabel="Connect and read it" onConfirm={() => void runLook(asked)} onCancel={() => setAsked(null)}>
          <p className="m-0">Kona will connect to <span className="font-mono text-[14px] text-text">{asked.host}:{asked.port}</span> only to read the server's public host keys. It sends no login and runs nothing on the server.</p>
          <p className="m-0">Nothing is saved until you have compared what comes back with the server's own record.</p>
        </Confirm>
      )}
      {look && (
        <Confirm title={look.prints ? (look.server.fingerprints.length === 0 ? "Is this the right server?" : state(look.server, look.prints).glyph === "left" ? "The fingerprint has changed" : "The fingerprint matches") : "Reading the fingerprint…"}
          confirmLabel={look.server.fingerprints.length === 0 ? "Trust and save" : "Save the new fingerprint"} danger={!!look.prints && look.server.fingerprints.length > 0 && state(look.server, look.prints).glyph === "left"}
          busy={!look.prints && !look.error} disabled={!look.prints || (look.server.fingerprints.length > 0 && state(look.server, look.prints).glyph === "done")} error={look.error} onConfirm={() => void trust()} onCancel={() => setLook(null)}>
          {look.prints && (
            <>
              {look.prints.map((p) => <p key={p.fingerprint} className="m-0 break-all font-mono text-[13px] leading-5 text-text"><span className="font-sans font-bold text-text-secondary">{p.kind}</span> {p.fingerprint}</p>)}
              {look.server.fingerprints.length === 0
                ? <p className="m-0">Compare these with the server's own record before you trust them. On the server: <span className="font-mono text-[13px] text-text">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</span>. If they differ, do not save.</p>
                : state(look.server, look.prints).glyph === "left"
                  ? <p className="m-0 font-bold text-state-left">None of these match the fingerprint you saved. The server may have been rebuilt, or something may be in the way of the connection. Find out which before you trust it again.</p>
                  : <p className="m-0">These match what you saved. Nothing to do.</p>}
            </>
          )}
        </Confirm>
      )}
      {confirmDrop && (
        <Confirm title="Remove this server?" confirmLabel="Remove it" danger onConfirm={() => { void removeServer(confirmDrop.id).then(() => { setConfirmDrop(null); load(); }); }} onCancel={() => setConfirmDrop(null)}>
          <p className="m-0">“{confirmDrop.label}” is taken off the list. Roles that used it can no longer connect to it through Kona. Nothing on the server or in your key file changes.</p>
        </Confirm>
      )}
    </main>
  );
}
