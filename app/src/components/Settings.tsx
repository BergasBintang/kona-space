// The settings of Kona itself, on the welcome page: the accounts, how many sessions a project may run at once when it has no number of its own,
// the size of the window, updates, backups, and where Kona keeps its things. Nothing here belongs to one project (those are in ProjectSettings),
// and nothing here changes a project's own files.
import { useCallback, useEffect, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { backupNow, deleteBackup, getSettings, listBackups, setSettings, type Account, type BackupInfo, type Settings as SettingsT } from "../lib/api";
import { Accounts } from "./Accounts";
import { Button, Glyph } from "./ui";
import { Confirm } from "./Confirm";
import { Help } from "./Help";
import { Select } from "./pick";
import { DEFAULT_ZOOM, getZoom, onZoom, setZoom, ZOOMS, type Zoom } from "../lib/zoom";
import { checkForUpdate, installUpdate, useUpdate } from "../lib/update";
import { KonaMark } from "./KonaMark";

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const when = (name: string) => name.replace(/^(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})$/, "$1 $2:$3");

export function GeneralSettings({ accounts, onAccounts, version }: { accounts: Account[]; onAccounts: (next: Account[]) => void; version: string }) {
  const [s, setS] = useState<SettingsT | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropBackup, setDropBackup] = useState<BackupInfo | null>(null);
  const [zoom, setZoomState] = useState<Zoom>(getZoom());
  useEffect(() => onZoom(setZoomState), []);
  const update = useUpdate();

  const load = useCallback(() => { getSettings().then(setS).catch(() => {}); listBackups().then(setBackups).catch(() => setBackups([])); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 9000); return () => clearTimeout(t); }, [notice]);
  const doBackup = async () => {
    setBusy(true); setError(null);
    try { const b = await backupNow(); setNotice(`Backed up ${b.files} files (${size(b.bytes)}) to ${b.path}`); load(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex w-full flex-col gap-8 px-8 pt-8 pb-10">
        <h1 className="m-0 text-[30px] leading-[38px] font-bold">Settings</h1>
        {notice && <div role="status" className="flex items-start gap-2.5 border border-line-subtle bg-surface-2 px-4 py-3 text-[14px] leading-5"><Glyph state="done" size={16} /> <span className="break-all">{notice}</span></div>}
        {error && <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}

        <Accounts accounts={accounts} onChanged={onAccounts} />

        <section className="flex flex-col gap-3" aria-label="Size">
          <div className="flex items-center gap-2.5"><h2 className="m-0 text-[18px] leading-7 font-bold">Size</h2><Help title="Size"><p className="m-0">How big everything is drawn. Smaller fits more on a small screen.</p><p className="m-0">Ctrl and minus or plus change it from anywhere; Ctrl and 0 goes back to 100%.</p></Help></div>
          <div className="max-w-[240px]"><Select ariaLabel="Size" value={String(zoom)} onChange={(v) => setZoom(Number(v) as Zoom)} options={ZOOMS.map((z) => ({ value: String(z), label: `${z}%`, hint: z === DEFAULT_ZOOM ? "Default" : undefined }))} /></div>
        </section>

        <section className="flex flex-col gap-3" aria-label="Updates">
          <div className="flex items-center gap-2.5"><h2 className="m-0 text-[18px] leading-7 font-bold">Updates</h2><Help title="Updates"><p className="m-0">When Kona starts, it can ask GitHub whether a newer version has been published. It sends nothing about you.</p><p className="m-0">If there is one, it asks you first; it never updates by itself without your yes.</p></Help></div>
          {s && (
            <label className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={s.check_updates} onChange={(e) => { setError(null); void setSettings({ ...s, check_updates: e.target.checked }).then(setS).catch((er) => setError(String(er))); }} />
              Look for a new version when Kona starts
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="quiet" onClick={() => void checkForUpdate(true)} disabled={update.phase === "checking" || update.phase === "downloading" || update.phase === "installing"}>{update.phase === "checking" ? "Checking…" : "Check now"}</Button>
            {update.phase === "current" && <span className="flex items-center gap-2 text-[14px] text-text-secondary"><Glyph state="done" size={16} /> Kona {version} is the newest version.</span>}
            {update.phase === "available" && <><span className="flex items-center gap-2 text-[14px] text-text-secondary"><Glyph state="waiting" size={16} /> Kona {update.version} is ready.</span><Button onClick={() => void installUpdate()}>Update and restart</Button></>}
            {update.phase === "error" && <span className="flex items-center gap-2 text-[14px] text-state-left"><Glyph state="left" size={16} /> {update.message}</span>}
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-label="Sessions at once by default">
          <div className="flex items-center gap-2.5"><h2 className="m-0 text-[18px] leading-7 font-bold">Sessions at once</h2><Help title="Sessions at once"><p className="m-0">How many sessions one project may run at once, unless that project has its own number (in its settings, under Sessions at once).</p><p className="m-0">Each running session uses about 400 MB of this PC's memory. Kona refuses to start more than the project allows, and never more than 6 in all.</p></Help></div>
          {s && <div className="max-w-[240px]"><Select ariaLabel="Sessions at once" value={String(s.max_sessions)} onChange={(v) => { setError(null); void setSettings({ ...s, max_sessions: Number(v) }).then(setS).catch((e) => setError(String(e))); }}
            options={[1, 2, 3].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "session" : "sessions"}`, hint: n === 2 ? "The usual for a small PC" : undefined }))} /></div>}
        </section>

        <section className="flex flex-col gap-3" aria-label="Backups">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5"><h2 className="m-0 text-[18px] leading-7 font-bold">Backups</h2><Help title="Backups"><p className="m-0">A copy of Kona's own files, the cost ledger, and each project's tickets and brain notes.</p><p className="m-0">Not your project's code (that is Git's job) and not the ticket working copies.</p></Help></div>
            <Button onClick={doBackup} disabled={busy}>{busy ? "Backing up…" : "Back up now"}</Button>
          </div>
          {backups.length === 0 && <p className="m-0 text-[14px] leading-5 text-text-tertiary">No backups yet. Kona never deletes one by itself.</p>}
          {backups.map((b) => (
            <div key={b.name} className="flex items-center justify-between gap-4 border border-line-subtle bg-surface-1 px-4 py-3">
              <div className="flex min-w-0 flex-col"><span className="font-bold">{when(b.name)}</span><span className="text-[13px] leading-5 text-text-tertiary">{b.files} files · {size(b.bytes)}</span></div>
              <div className="flex shrink-0 gap-2"><Button variant="ghost" small onClick={() => void revealItemInDir(b.path)}>Show in Explorer</Button><Button variant="ghost" small onClick={() => setDropBackup(b)}>Delete…</Button></div>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2" aria-label="About">
          <div className="flex items-center gap-2.5"><h2 className="m-0 text-[18px] leading-7 font-bold">About</h2><Help title="Where Kona keeps things"><p className="m-0">Kona keeps its own data in %APPDATA%\Kona and each project's tickets and brain in a hidden .kona folder inside it.</p><p className="m-0">Nothing leaves this PC except what Claude Code itself sends to Anthropic.</p></Help></div>
          <p className="m-0 flex items-center gap-2.5 font-mono text-[13px] leading-5 text-text-secondary"><KonaMark size={20} />Kona {version}</p>
        </section>
      </div>

      {dropBackup && (
        <Confirm title="Delete this backup?" confirmLabel="Delete it" danger onConfirm={() => { void deleteBackup(dropBackup.name).then(() => { setDropBackup(null); load(); }).catch((e) => { setError(String(e)); setDropBackup(null); }); }} onCancel={() => setDropBackup(null)}>
          <p className="m-0">The backup of {when(dropBackup.name)} ({dropBackup.files} files, {size(dropBackup.bytes)}) is deleted from the disk. Your projects and Kona's live data are not touched.</p>
        </Confirm>
      )}
    </main>
  );
}
