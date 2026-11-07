// The Servers place (feature F8): the servers a project may reach, and the GitHub repos it uses, as REFERENCES. Kona keeps a name, host, port, user, the
// path of the key file, the fingerprint and which roles may use it. It never opens or stores a key. A role can run ssh, scp or sftp only to a host listed
// here for that role; every such command still shows an approval card with the name. Kona never connects to a server for you: the one thing it does on
// request is read a public fingerprint, after you confirm.
// A GitHub repo is a card of its own (kind "github"): the nickname its git address uses (an entry of `~\.ssh\config`), the machine behind that nickname,
// the read-write key on this PC, the read-only key that is handed to servers, and the servers that pull the repo with where that key is ON each server
// (a note: Kona never sees it). It is a server entry underneath, so the same checks apply to its nickname.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { roleLabel, saveServer, listServers, removeServer, readFingerprints, keyState, pickFile, type Fingerprint, type KeyState, type Project, type Pull, type Role, type Server } from "../lib/api";
import { Button, Glyph, RoleMark } from "./ui";
import { Confirm } from "./Confirm";
import { MultiSelect, Select } from "./pick";
import { useDismiss } from "./pick/parts";
import { Help } from "./Help";
import { cleanPort, configEntry, gitAddress, serverEntry } from "../lib/sshconfig";

const blank = (project_id: string, kind = ""): Server => ({
  id: "", project_id, label: "", host: "", port: 22, user: kind === "github" ? "git" : "", key_path: "", fingerprints: [], roles: [], notes: "",
  kind, real_host: kind === "github" ? "github.com" : "", repo: "", ro_key_path: "", pulled_by: [],
});
// every box and button in the form is 48 px tall (h-12), the same as Kona's pickers; the pixel frame of a text box comes from the stylesheet
const field = "h-12 min-w-0 px-2 text-[15px] text-text placeholder:text-text-tertiary";
const label = "text-[13px] leading-5 font-bold text-text-secondary";

// The text to paste (configEntry, serverEntry, gitAddress) is built in lib/sshconfig.ts. Kona never writes `~\.ssh\config`.

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

/** The key's state on a card, in one short line (a glyph and a few words). A warning about where the file sits is the only thing that adds a line. */
function KeyChip({ path, what }: { path: string; what: string }) {
  const [st, setSt] = useState<KeyState | null>(null);
  useEffect(() => { let live = true; setSt(null); if (path) keyState(path).then((s) => { if (live) setSt(s); }).catch(() => {}); return () => { live = false; }; }, [path]);
  const glyph = !path ? "waiting" : st === null ? "idle" : st.is_file ? "done" : "left";
  const word = !path ? `${what}: no file named` : st === null ? `${what}: checking…` : st.is_file ? `${what} found` : st.exists ? `${what}: not a file` : `${what}: file not found`;
  const tone = !path ? "text-state-waiting" : st && !st.is_file ? "font-bold text-state-left" : "text-text-secondary";
  return (
    <span className="flex flex-col gap-1 text-[13px] leading-5">
      <span className={`flex items-center gap-2 ${tone}`}><Glyph state={glyph} size={14} />{word}</span>
      {st?.inside_a_project && <span className="flex items-center gap-2 font-bold text-state-waiting"><Glyph state="waiting" size={14} />The key file is inside a project folder, where Git could pick it up. Move it out.</span>}
      {st?.synced_folder && <span className="flex items-center gap-2 font-bold text-state-waiting"><Glyph state="waiting" size={14} />The key file is in a folder that syncs to the cloud. Keep keys out of synced folders.</span>}
    </span>
  );
}

/** One "Copy…" button for everything a card can hand out, so the card carries one button for it instead of three. */
function CopyMenu({ label, items, done, onPick }: { label: string; items: { value: string; label: string }[]; done: boolean; onPick: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close);
  return (
    <div ref={wrap} className="relative" onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); close(); } }}>
      <Button variant="quiet" aria-haspopup="menu" aria-expanded={open} aria-label={`Copy from ${label}`} onClick={() => setOpen((o) => !o)}>{done ? "Copied" : "Copy…"}</Button>
      {open && (
        <div role="menu" aria-label={`Copy from ${label}`} className="absolute right-0 bottom-full z-20 mb-2 flex min-w-56 flex-col border-2 border-line-strong bg-surface-2 p-1.5 px-shadow">
          {items.map((i) => <button key={i.value} type="button" role="menuitem" onClick={() => { onPick(i.value); close(); }} className="h-10 cursor-pointer px-3 text-left text-[14px] font-bold whitespace-nowrap text-text hover:bg-surface-3">{i.label}</button>)}
        </div>
      )}
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
  // opening the dialog puts the cursor in its first box
  const formOpen = draft ? draft.id || "new" : "";
  useEffect(() => { if (formOpen) document.querySelector<HTMLElement>('[role="dialog"][aria-modal] input')?.focus(); }, [formOpen]);

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

  /** A card shows only what is true now: the address, who may use it, and a single line of states. Everything else (key paths, notes, ports) is in Edit. */
  const card = (s: Server) => {
    const st = state(s, look?.server.id === s.id ? look.prints : undefined);
    const isRepo = s.kind === "github";
    const copies = [
      ...(isRepo ? [{ value: "git", label: "Git address", text: gitAddress(s) }] : []),
      { value: "config", label: "ssh config entry", text: configEntry(s) },
      ...s.pulled_by.filter((p) => servers.some((x) => x.id === p.server_id)).map((p) => ({ value: `pull:${p.server_id}`, label: `Entry for ${serverName(p.server_id)}`, text: serverEntry(s, p.key_path) })),
    ];
    return (
      <section key={s.id} aria-label={s.label} className="px-card flex flex-col gap-3 p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="m-0 truncate text-[18px] leading-7 font-bold">{s.label}</h3>
            <span className="truncate font-mono text-[14px] leading-5 text-text-secondary" title={isRepo ? `through ${reads(s)}:${s.port}` : undefined}>{isRepo ? gitAddress(s) : `${s.user}@${s.host}${s.port !== 22 ? `:${s.port}` : ""}`}</span>
          </div>
          <div className="flex shrink-0 gap-2"><Button variant="ghost" small onClick={() => { setDraft(s); setError(null); }}>Edit</Button><Button variant="ghost" small onClick={() => setConfirmDrop(s)}>Remove…</Button></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.roles.length === 0 && <span className="flex items-center gap-2 text-[13px] leading-5 font-bold text-state-waiting"><Glyph state="waiting" size={14} />No role can use it</span>}
          {s.roles.map((r) => <span key={r} title={roleName(r)} className="flex items-center gap-1.5 bg-surface-3 py-0.5 pr-2.5 pl-1 text-[12px] leading-5 font-bold"><RoleMark roleId={r} size={20} />{roles.find((x) => x.id === r)?.person || roleName(r)}</span>)}
        </div>
        {isRepo && s.pulled_by.length > 0 && <span className="text-[13px] leading-5 text-text-secondary">Pulled by {s.pulled_by.map((p) => serverName(p.server_id)).join(", ")}</span>}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-start gap-x-5 gap-y-1">
            <KeyChip path={s.key_path} what={isRepo && s.ro_key_path ? "Read and write key" : "Key"} />
            {isRepo && s.ro_key_path && <KeyChip path={s.ro_key_path} what="Read-only key" />}
            <span className={`flex items-center gap-2 text-[13px] leading-5 font-bold ${st.tone}`}><Glyph state={st.glyph} size={14} />{st.word}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyMenu label={s.label} items={copies} done={copied === s.id} onPick={(v) => { const c = copies.find((x) => x.value === v); if (c) void copy(s.id, c.text); }} />
            <Button variant="quiet" onClick={() => setAsked(s)}>{s.fingerprints.length ? "Check the fingerprint" : "Read the fingerprint…"}</Button>
          </div>
        </div>
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
      <section aria-label={d.id ? (isRepo ? "Edit repo" : "Edit server") : (isRepo ? "Add a GitHub repo" : "Add a server")} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="m-0 text-[20px] leading-7 font-bold">{d.id ? (isRepo ? "Edit the repo" : "Edit the server") : (isRepo ? "Add a GitHub repo" : "Add a server")}</h2>
          <Help title={isRepo ? "A GitHub repo" : "A server"}>
            {isRepo
              ? <p className="m-0">The nickname is the name in your ssh config that a git address uses in place of github.com. Real address and Port are the machine behind it: Kona connects there to read the fingerprint, and the copied text says the same. If your network blocks github.com on port 22, use <span className="font-mono text-[14px]">ssh.github.com</span> and port 443.</p>
              : <p className="m-0">The host is what you type after ssh: a name, an address, or a name from your ssh config.</p>}
            <p className="m-0">Kona keeps only the path of a key file, never the key.{isRepo ? " The read-only key is the copy you hand to a server; for each server that pulls this repo, note where that key is on the server." : ""}</p>
            <p className="m-0">Kona never changes your ssh config file. "Copy…" only copies text, for you to paste into <span className="font-mono text-[14px]">~/.ssh/config</span> yourself. If you edit that file later, this record does not follow, and the other way round.</p>
            <p className="m-0">A role can only reach an entry that lists it under "Roles that may use this".</p>
          </Help>
        </div>
        {isRepo ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2"><span className={label}>Name</span><input value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="Kona" aria-label="Name" className={field} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Repo</span><input value={d.repo} onChange={(e) => set({ repo: e.target.value })} placeholder="owner/name" aria-label="Repo" className={`${field} font-mono`} /></label>
            </div>
            <div className="grid grid-cols-[1fr_1fr_6.5rem] gap-4">
              <label className="flex flex-col gap-2"><span className={label}>Nickname</span><input value={d.host} onChange={(e) => set({ host: e.target.value })} placeholder="github-kona" aria-label="Nickname" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Real address</span><input value={d.real_host} onChange={(e) => set({ real_host: e.target.value })} placeholder="github.com" aria-label="Real address" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Port</span><input value={d.port ? String(d.port) : ""} inputMode="numeric" onChange={(e) => set({ port: cleanPort(e.target.value) })} placeholder="22" aria-label="Port" className={`${field} font-mono`} /></label>
            </div>
            <KeyPath value={d.key_path} onChange={(v) => set({ key_path: v })} aria="Read and write key file path" what="Read and write key" />
            <KeyPath value={d.ro_key_path} onChange={(v) => set({ ro_key_path: v })} aria="Read-only key file path" what="Read-only key (optional)" />
            <div className="flex flex-col gap-3">
              <span className={label}>Servers that pull this repo</span>
              {d.pulled_by.map((p, i) => (
                <div key={p.server_id} className="flex items-center gap-3">
                  <Select ariaLabel={`Server that pulls it ${i + 1}`} value={p.server_id} onChange={(v) => setPull(i, { server_id: v })} options={servers.filter((x) => x.id === p.server_id || free.includes(x)).map((x) => ({ value: x.id, label: x.label }))} className="w-64 shrink-0" />
                  <input value={p.key_path} onChange={(e) => setPull(i, { key_path: e.target.value })} placeholder="Key path on that server: ~/.ssh/name" aria-label={`Key path on the server ${i + 1}`} className={`${field} min-w-0 flex-1 font-mono`} />
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
            <div className="grid grid-cols-[1fr_1fr_6.5rem] gap-4">
              <label className="flex flex-col gap-2"><span className={label}>Name</span><input value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="Web server" aria-label="Name" className={field} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Host</span><input value={d.host} onChange={(e) => set({ host: e.target.value })} placeholder="web.example.com" aria-label="Host" className={`${field} font-mono`} /></label>
              <label className="flex flex-col gap-2"><span className={label}>Port</span><input value={String(d.port)} inputMode="numeric" onChange={(e) => set({ port: cleanPort(e.target.value) })} aria-label="Port" className={`${field} font-mono`} /></label>
            </div>
            <label className="flex flex-col gap-2"><span className={label}>User</span><input value={d.user} onChange={(e) => set({ user: e.target.value })} placeholder="deploy" aria-label="User" className={`${field} font-mono`} /></label>
            <KeyPath value={d.key_path} onChange={(v) => set({ key_path: v })} aria="Key file path" what="Key file" />
          </>
        )}
        <MultiSelect label="Roles that may use this" values={d.roles} onChange={(v) => set({ roles: v })} placeholder="None: no role can connect" options={roleOptions} />
        <label className="flex flex-col gap-2"><span className={label}>Notes (no passwords or keys)</span><textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} aria-label="Notes" className="px-field resize-y p-2 text-[15px] leading-6 text-text" /></label>
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex justify-end gap-3"><Button variant="quiet" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={() => save(d)} disabled={busy || !ready}>{busy ? "Saving…" : "Save"}</Button></div>
      </section>
    );
  };

  /** One kind of entry: a heading with its count and its own Add button, a rule under it, then its cards. */
  const group = (name: string, items: Server[], kind: string, addLabel: string, empty: string) => (
    <div role="group" aria-label={name} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 border-b-2 border-line-strong pb-3">
        <h2 className="m-0 flex items-baseline gap-3 text-[22px] leading-8 font-bold">{name}<span className="text-[15px] font-normal text-text-tertiary">{items.length}</span></h2>
        <Button variant="quiet" small onClick={() => { setDraft(blank(project.id, kind)); setError(null); }}>{addLabel}</Button>
      </div>
      {items.length === 0 && <p className="m-0 text-[14px] leading-5 text-text-secondary">{empty}</p>}
      {items.map(card)}
    </div>
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex w-full flex-col gap-8 px-8 pt-8 pb-10">
        <div className="flex items-center gap-3"><h1 className="m-0 text-[30px] leading-[38px] font-bold">Connections</h1><Help title="Connections"><p className="m-0">The servers and GitHub repos {project.name} may reach. Kona keeps where the key files are, never the keys.</p><p className="m-0">A role can use one only if it is listed here for that role, and every command still asks you first.</p></Help></div>

        {list === null && <p className="m-0 text-text-tertiary">Reading the list…</p>}
        {list && group("Servers", servers, "", "Add a server", "No servers yet. Until you add one, no role can run ssh, scp or sftp in this project.")}
        {list && group("GitHub repos", repos, "github", "Add a GitHub repo", "No GitHub repos yet.")}
      </div>

      {/* the form is a dialog over the list, so adding or editing never needs a scroll. It closes only with Cancel or Esc (a stray click must not throw away what was typed) */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          onKeyDown={(e) => { if (e.key === "Escape" && !e.defaultPrevented) { e.stopPropagation(); setDraft(null); } }}>
          <div role="dialog" aria-modal="true" aria-label={draft.id ? (draft.kind === "github" ? "Edit repo" : "Edit server") : (draft.kind === "github" ? "Add a GitHub repo" : "Add a server")} className="flex max-h-full w-full max-w-[760px] flex-col overflow-y-auto px-card px-shadow p-3">
            {form(draft)}
          </div>
        </div>
      )}

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
