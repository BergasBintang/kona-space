// The Worktrees place (feature F9): every working copy of the project's repo on one page. A picture of the branches (where each one
// left the main branch, how far it went, how far the main branch moved on), then one card per copy with its state, who owns it
// (a ticket, or nobody) and the safe actions: merge into the main branch, remove. Anything that changes files asks first.
import { useCallback, useEffect, useState } from "react";
import { mergeWorktree, removeWorktree, worktreeOverview, type Project, type WorktreeInfo } from "../lib/api";
import { Button, Glyph, type GlyphState } from "./ui";
import { Confirm } from "./Confirm";

const CAP = 10;

/** The picture: the main branch as a line, each copy leaving it where it started, with a dot per commit it is ahead. */
function Graph({ list }: { list: WorktreeInfo[] }) {
  const main = list.find((w) => w.is_main);
  const others = list.filter((w) => !w.is_main);
  if (!main) return null;
  const step = 26, x0 = 28, labelW = 250, rowH = 40;
  const L = Math.max(3, ...others.map((w) => Math.min(w.behind, CAP)));
  const width = labelW + x0 * 2 + (L + CAP + 2) * step;
  const height = 56 + others.length * rowH;
  const stateColor = (w: WorktreeInfo) => (w.conflicts.length ? "var(--color-state-left)" : w.changed > 0 ? "var(--color-state-waiting)" : "var(--color-accent)");
  return (
    <div className="overflow-x-auto rounded-card border border-line-subtle bg-surface-1 p-4">
      <svg width={width} height={height} role="img" aria-label={`The branches of ${main.branch || "the main folder"}: ${others.map((w) => `${w.branch || "detached"} is ${w.ahead} ahead and ${w.behind} behind`).join("; ") || "no other copies"}`}>
        <text x={0} y={24} fontSize="14" fontWeight="700" fill="currentColor">{main.branch || "main folder"}</text>
        <line x1={labelW + x0} y1={20} x2={labelW + x0 + L * step} y2={20} stroke="var(--color-line-strong)" strokeWidth="2" />
        {Array.from({ length: L + 1 }, (_, i) => <circle key={i} cx={labelW + x0 + i * step} cy={20} r="4" fill="var(--color-line-strong)" />)}
        {others.map((w, i) => {
          const y = 20 + (i + 1) * rowH;
          const fx = labelW + x0 + (L - Math.min(w.behind, CAP)) * step;
          const n = Math.min(w.ahead, CAP);
          const c = stateColor(w);
          return (
            <g key={w.path}>
              <text x={0} y={y + 4} fontSize="13" fill="currentColor" opacity="0.85">{(w.branch || "detached").slice(0, 32)}</text>
              <circle cx={fx} cy={20} r="6" fill="none" stroke={c} strokeWidth="2" />
              <path d={`M ${fx} 26 C ${fx} ${y - 4}, ${fx + 8} ${y}, ${fx + step} ${y}`} fill="none" stroke={c} strokeWidth="2" />
              {w.ahead > 0 && <line x1={fx + step} y1={y} x2={fx + step * Math.max(n, 1)} y2={y} stroke={c} strokeWidth="2" />}
              {Array.from({ length: n }, (_, k) => <circle key={k} cx={fx + step * (k + 1)} cy={y} r="4.5" fill={c} />)}
              {w.ahead === 0 && <circle cx={fx + step} cy={y} r="4.5" fill="none" stroke={c} strokeWidth="2" />}
              <text x={fx + step * (Math.max(n, 1) + 1)} y={y + 4} fontSize="12" fill="currentColor" opacity="0.7">{w.ahead} ahead{w.ahead > CAP ? " (not all drawn)" : ""} · {w.behind} behind</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function state(w: WorktreeInfo): { glyph: GlyphState; word: string; tone: string } {
  if (w.missing) return { glyph: "left", word: "Folder is gone", tone: "text-state-left" };
  if (w.is_main) return { glyph: w.changed > 0 ? "waiting" : "done", word: w.changed > 0 ? "Has changes not committed" : "Clean", tone: w.changed > 0 ? "text-state-waiting" : "text-state-done" };
  if (w.conflicts.length) return { glyph: "left", word: "Would clash with the main branch", tone: "text-state-left" };
  if (w.ahead === 0) return { glyph: "idle", word: w.changed > 0 ? "Nothing committed yet" : "Nothing to merge", tone: "text-text-secondary" };
  return { glyph: "done", word: "Merges cleanly", tone: "text-state-done" };
}

type Pending = { kind: "merge" | "remove"; w: WorktreeInfo };

export function Worktrees({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const [list, setList] = useState<WorktreeInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => { worktreeOverview(project.id).then((l) => { setList(l); setError(null); }).catch((e) => { setList([]); setError(String(e)); }); }, [project.id]);
  useEffect(() => { setList(null); load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 9000); return () => clearTimeout(t); }, [notice]);

  const ask = (kind: Pending["kind"], w: WorktreeInfo) => { setPending({ kind, w }); setDiscard(false); setActionError(null); };
  const run = async () => {
    if (!pending) return;
    setBusy(true); setActionError(null);
    try {
      const msg = pending.kind === "merge" ? await mergeWorktree(project.id, pending.w.path) : await removeWorktree(project.id, pending.w.path, discard);
      setNotice(msg); setPending(null); load(); onChanged();
    } catch (e) { setActionError(String(e)); } finally { setBusy(false); }
  };

  const others = (list ?? []).filter((w) => !w.is_main);
  const w = pending?.w;
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 px-8 pt-8 pb-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-[38px] font-bold">Worktrees</h1>
            <p className="m-0 text-text-secondary">The working copies of {project.name}: your main folder and every extra copy on its own branch. A ticket's own copy shows up here.</p>
          </div>
          <Button variant="quiet" small onClick={load}>Refresh</Button>
        </div>

        {error && <div className="flex items-start gap-2.5 text-[14px] leading-5 text-text-secondary"><Glyph state="idle" size={16} /> {error}</div>}
        {list === null && !error && <p className="m-0 text-text-tertiary">Asking Git…</p>}
        {notice && <div role="status" className="flex items-start gap-2.5 rounded-control border border-line-subtle bg-surface-2 px-4 py-3 text-[14px] leading-5"><Glyph state="done" size={16} /> {notice}</div>}

        {list && list.length > 0 && <Graph list={list} />}
        {list && list.length > 0 && others.length === 0 && !error && <p className="m-0 text-text-tertiary">Only the main folder so far. Start a session from a Frontend or Backend ticket and its own copy appears here.</p>}

        <div className="flex flex-col gap-3">
          {(list ?? []).map((x) => {
            const s = state(x);
            return (
              <section key={x.path} aria-label={x.branch || x.path} className="flex flex-col gap-3 rounded-card border border-line-subtle bg-surface-1 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="truncate font-mono text-[15px] font-bold">{x.branch || "(no branch)"}</span>
                      {x.is_main && <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[12px] leading-5 font-bold text-text-secondary">Main folder</span>}
                      {x.ticket_id && <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[12px] leading-5 font-bold text-text-secondary">{x.ticket_id} · {x.ticket_title}</span>}
                      {!x.is_main && !x.ticket_id && <span className="text-[13px] text-text-tertiary">Not from a ticket</span>}
                    </div>
                    <span className="truncate font-mono text-[12px] leading-5 text-text-tertiary" title={x.path}>{x.path}</span>
                  </div>
                  <span className={`flex shrink-0 items-center gap-2 text-[13px] leading-5 font-bold ${s.tone}`}><Glyph state={s.glyph} size={16} />{s.word}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] leading-5 text-text-secondary">
                  {!x.is_main && <span>{x.ahead} {x.ahead === 1 ? "commit" : "commits"} ahead · {x.behind} behind</span>}
                  <span>{x.changed} {x.changed === 1 ? "file" : "files"} changed, not committed</span>
                  {x.last_subject && <span className="truncate">Last commit: “{x.last_subject}” {x.last_when}</span>}
                </div>
                {x.conflicts.length > 0 && <p className="m-0 text-[13px] leading-5 text-state-left">Both sides changed: <span className="font-mono">{x.conflicts.slice(0, 6).join(", ")}{x.conflicts.length > 6 ? ` and ${x.conflicts.length - 6} more` : ""}</span>. Merge them by hand in the copy first.</p>}
                {!x.is_main && (
                  <div className="flex justify-end gap-2.5">
                    <Button variant="ghost" small onClick={() => ask("remove", x)}>{x.missing ? "Forget it" : "Remove copy"}</Button>
                    <Button variant="quiet" small disabled={x.ahead === 0 || x.conflicts.length > 0 || x.missing} onClick={() => ask("merge", x)}>Merge into {list?.find((m) => m.is_main)?.branch || "main"}</Button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {pending && w && pending.kind === "merge" && (
        <Confirm title={`Merge ${w.branch} into ${list?.find((m) => m.is_main)?.branch}?`} confirmLabel="Merge" busy={busy} error={actionError} onConfirm={run} onCancel={() => setPending(null)}>
          <p className="m-0">This adds {w.ahead} {w.ahead === 1 ? "commit" : "commits"} to your main folder as one merge commit. Git checked that nothing clashes.</p>
          {w.changed > 0 && <p className="m-0 font-bold text-state-waiting">{w.changed} {w.changed === 1 ? "file" : "files"} in that copy {w.changed === 1 ? "is" : "are"} changed but not committed. Those changes are not part of the merge.</p>}
          <p className="m-0">Your main folder must have no uncommitted changes to tracked files. If Git stops half way, the merge is undone.</p>
        </Confirm>
      )}
      {pending && w && pending.kind === "remove" && (
        <Confirm title={w.missing ? "Forget this copy?" : "Remove this copy?"} confirmLabel={discard ? "Remove and throw away" : "Remove copy"} danger={discard} busy={busy} disabled={w.changed > 0 && !discard} error={actionError} onConfirm={run} onCancel={() => setPending(null)}>
          <p className="m-0">{w.missing ? "Its folder is already gone. Git will forget it." : <>This deletes the folder <span className="font-mono text-[13px]">{w.path}</span> from the disk.</>}</p>
          {!w.missing && (w.ahead === 0
            ? <p className="m-0">Its branch has nothing the main branch lacks, so the branch is deleted too.</p>
            : <p className="m-0">Its branch has {w.ahead} {w.ahead === 1 ? "commit" : "commits"} that are not merged. The branch is kept unless you choose to throw it away.</p>)}
          {(w.changed > 0 || (w.ahead > 0 && !w.missing)) && (
            <label className="flex cursor-pointer items-start gap-3 rounded-control border border-line-subtle bg-inset px-3.5 py-3">
              <input type="checkbox" checked={discard} onChange={(e) => setDiscard(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-state-left)]" />
              <span className="text-[14px] leading-5 text-text">Also throw away {[w.changed > 0 ? `${w.changed} ${w.changed === 1 ? "changed file" : "changed files"}` : "", w.ahead > 0 ? `the branch and its ${w.ahead} unmerged ${w.ahead === 1 ? "commit" : "commits"}` : ""].filter(Boolean).join(" and ")}. This cannot be undone.</span>
            </label>
          )}
          {w.running > 0 && <p className="m-0 font-bold text-state-waiting">{w.running} {w.running === 1 ? "program started" : "programs started"} by this ticket's sessions {w.running === 1 ? "is" : "are"} still running. See Leftovers.</p>}
          {w.changed > 0 && !discard && <p className="m-0 text-state-waiting">{w.changed} {w.changed === 1 ? "file is" : "files are"} changed and not committed, so nothing is removed unless you tick the box.</p>}
        </Confirm>
      )}
    </main>
  );
}
