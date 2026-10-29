// The Leftovers place (feature F11): programs that sessions started, and which of them are still alive after the session ended. Plus
// the scratch files Claude keeps for each session. Kona only stops or deletes after the owner confirms, and shows exactly what first.
import { useCallback, useEffect, useMemo, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ignoreLeftover, sessionTemp, sessionTempClean, stopLeftover, type LeftoverItem, type LeftoverOverview, type Role, type TempInfo } from "../lib/api";
import type { State } from "../lib/sessions";
import { Button, Glyph } from "./ui";
import { Confirm } from "./Confirm";
import { Help } from "./Help";

const age = (s: number) => (s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`);
const size = (b: number) => (b < 1024 ? `${b} bytes` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function Row({ it, who, onStop, onIgnore }: { it: LeftoverItem; who: string; onStop: () => void; onIgnore?: () => void }) {
  return (
    <div className="flex flex-col gap-2 border border-line-subtle bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[15px] font-bold">{it.name}</span>
            {it.ports.map((p) => <span key={p} className="bg-surface-3 px-2.5 py-0.5 font-mono text-[12px] leading-5 text-text">Port {p}</span>)}
          </div>
          <span className="truncate font-mono text-[12px] leading-5 text-text-tertiary" title={it.cmd || it.name}>{it.cmd || "(command not readable)"}</span>
          <span className="text-[13px] leading-5 text-text-secondary">Started by {who} · running for {age(it.age_secs)} · pid {it.pid}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          {onIgnore && <Button variant="ghost" small onClick={onIgnore}>Ignore</Button>}
          <Button variant="quiet" small onClick={onStop}>Stop…</Button>
        </div>
      </div>
    </div>
  );
}

export function Leftovers({ state, roles, overview, onRefresh }: { state: State; roles: Role[]; overview: LeftoverOverview; onRefresh: () => void }) {
  const [temps, setTemps] = useState<TempInfo[]>([]);
  const [stopping, setStopping] = useState<LeftoverItem | null>(null);
  const [cleaning, setCleaning] = useState<TempInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  const ids = useMemo(() => state.order, [state.order]);
  const loadTemps = useCallback(() => { if (ids.length) sessionTemp(ids).then(setTemps).catch(() => setTemps([])); else setTemps([]); }, [ids]);
  useEffect(() => { loadTemps(); }, [loadTemps]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 9000); return () => clearTimeout(t); }, [notice]);

  const who = (sid: string) => {
    const s = state.sessions[sid];
    if (!sid) return "a session that could not be told";
    if (!s) return `session ${sid.slice(0, 8)}`;
    const role = roles.find((r) => r.id === s.roleId)?.name;
    return `${s.title ? `“${s.title}”` : `session ${sid.slice(0, 8)}`}${role ? ` as ${role}` : ""}`;
  };

  const left = overview.items.filter((i) => i.left_behind && !i.ignored);
  const running = overview.items.filter((i) => !i.left_behind && !i.ignored);
  const ignored = overview.items.filter((i) => i.ignored);

  const doStop = async () => {
    if (!stopping) return;
    setBusy(true); setError(null);
    try { setNotice(await stopLeftover(stopping.key)); setStopping(null); onRefresh(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const doClean = async () => {
    if (!cleaning) return;
    setBusy(true); setError(null);
    try { setNotice(await sessionTempClean(cleaning.session_id)); setCleaning(null); loadTemps(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const bigTemps = temps.filter((t) => t.bytes > 0);
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[calc(1160px*var(--k))] flex-col gap-7 px-8 pt-8 pb-10">
        <div className="flex items-center gap-3"><h1 className="m-0 text-[30px] leading-[38px] font-bold">Leftovers</h1><Help title="Leftovers"><p className="m-0">Programs your sessions started (dev servers, watchers) and what is still running after a session ended.</p><p className="m-0">Kona only sees sessions it started itself, and when Kona closes it stops all of them.</p></Help></div>
        {notice && <div role="status" className="flex items-start gap-2.5 border border-line-subtle bg-surface-2 px-4 py-3 text-[14px] leading-5"><Glyph state="done" size={16} /> {notice}</div>}

        <section className="flex flex-col gap-3" aria-label="Left behind">
          <h2 className="m-0 flex items-center gap-2.5 text-[17px] leading-6 font-bold"><Glyph state={left.length ? "left" : "done"} size={18} />{left.length ? `${left.length} left behind` : "Nothing left behind"}</h2>
          {left.length === 0 && <p className="m-0 text-[14px] leading-5 text-text-tertiary">When a session ends and something it started keeps running, it shows here.</p>}
          {left.map((it) => <Row key={it.key} it={it} who={who(it.session_id)} onStop={() => { setStopping(it); setError(null); }} onIgnore={() => { void ignoreLeftover(it.key).then(onRefresh); }} />)}
        </section>

        <section className="flex flex-col gap-3" aria-label="Running now">
          <h2 className="m-0 flex items-center gap-2.5 text-[17px] leading-6 font-bold"><Glyph state={running.length ? "live" : "idle"} size={18} />{running.length ? `${running.length} running in open sessions` : "Nothing running in open sessions"}</h2>
          {running.map((it) => <Row key={it.key} it={it} who={who(it.session_id)} onStop={() => { setStopping(it); setError(null); }} />)}
        </section>

        {ignored.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Ignored">
            <button type="button" onClick={() => setShowIgnored((v) => !v)} aria-expanded={showIgnored} className="self-start text-[14px] leading-5 font-bold text-text-secondary hover:text-text">{showIgnored ? "Hide" : "Show"} {ignored.length} ignored</button>
            {showIgnored && ignored.map((it) => <Row key={it.key} it={it} who={who(it.session_id)} onStop={() => { setStopping(it); setError(null); }} />)}
          </section>
        )}

        <section className="flex flex-col gap-3" aria-label="Scratch files">
          <div className="flex items-center gap-2.5"><h2 className="m-0 text-[17px] leading-6 font-bold">Scratch files</h2><Help title="Scratch files"><p className="m-0">Claude keeps a folder of temporary files (and pasted pictures) for each session. Only finished sessions can be cleaned.</p></Help></div>
          {bigTemps.length === 0 && <p className="m-0 text-[14px] leading-5 text-text-tertiary">No scratch files for the sessions open in this window.</p>}
          {bigTemps.map((t) => {
            const live = state.sessions[t.session_id]?.run !== "ended";
            return (
              <div key={t.session_id} className="flex items-center justify-between gap-4 border border-line-subtle bg-surface-1 p-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-bold">{who(t.session_id)}</span>
                  <span className="text-[13px] leading-5 text-text-secondary">{size(t.bytes)} in {t.files}{t.partial ? "+" : ""} {t.files === 1 ? "file" : "files"}{live ? " · session still open" : ""}</span>
                  <span className="truncate font-mono text-[12px] leading-5 text-text-tertiary" title={t.path}>{t.path}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" small onClick={() => void revealItemInDir(t.path)}>Show in Explorer</Button>
                  <Button variant="quiet" small disabled={live} onClick={() => { setCleaning(t); setError(null); }}>Delete…</Button>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {stopping && (
        <Confirm title={`Stop ${stopping.name}?`} confirmLabel="Stop it" danger busy={busy} error={error} onConfirm={doStop} onCancel={() => setStopping(null)}>
          <p className="m-0">Started by {who(stopping.session_id)}{stopping.left_behind ? ", which has ended" : ", which is still open"}.</p>
          <p className="m-0 break-all bg-inset px-3 py-2 font-mono text-[13px] leading-5 text-text">{stopping.cmd || stopping.name}</p>
          {stopping.ports.length > 0 && <p className="m-0">It is listening on {stopping.ports.map((p) => `port ${p}`).join(", ")}. Anything using it will lose the connection.</p>}
          <p className="m-0">Kona also stops anything this program started. Unsaved work in it is lost.</p>
          {!stopping.left_behind && <p className="m-0 font-bold text-state-waiting">The session is still open and may be using it.</p>}
        </Confirm>
      )}
      {cleaning && (
        <Confirm title="Delete these scratch files?" confirmLabel="Delete them" danger busy={busy} error={error} onConfirm={doClean} onCancel={() => setCleaning(null)}>
          <p className="m-0">{size(cleaning.bytes)} in {cleaning.files} {cleaning.files === 1 ? "file" : "files"} from {who(cleaning.session_id)}.</p>
          <p className="m-0 break-all font-mono text-[13px] leading-5">{cleaning.path}</p>
          <p className="m-0">Only this one folder inside Claude's temporary area is deleted. Your project is not touched.</p>
        </Confirm>
      )}
    </main>
  );
}
