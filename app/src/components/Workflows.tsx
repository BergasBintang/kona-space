// Workflows: the usual steps of one kind of work (a feature, a fix, a launch), each step owned by a role, drawn as a flowchart and editable.
// The chart is the plan, never the state: "Start" raises one Board ticket per step (a step that comes after another waits for its ticket), and the Board
// stays the one place that shows where the work stands. Saving also writes a Brain note with the steps in words. Files: `.kona/workflows/<id>.json`.
import { useEffect, useMemo, useState } from "react";
import { deleteWorkflow, listWorkflows, saveWorkflow, startWorkflow, type Project, type Role, type Step, type Workflow } from "../lib/api";
import { Button, Glyph, RoleMark } from "./ui";
import { Help } from "./Help";

const BOX_W = 168, BOX_H = 58, GAP_X = 44, GAP_Y = 26;

/** Which column each step sits in: one further right than the furthest step it comes after. Steps are listed before the steps that follow them. */
function columns(steps: Step[]): Map<string, number> {
  const col = new Map<string, number>();
  for (const s of steps) col.set(s.id, s.after.length === 0 ? 0 : Math.max(...s.after.map((a) => col.get(a) ?? 0)) + 1);
  return col;
}

function Chart({ steps, roles, pick, onPick }: { steps: Step[]; roles: Role[]; pick: string | null; onPick: (id: string) => void }) {
  const col = columns(steps);
  const rows = new Map<number, number>();
  const at = new Map<string, { x: number; y: number }>();
  for (const s of steps) {
    const c = col.get(s.id) ?? 0, r = rows.get(c) ?? 0;
    rows.set(c, r + 1);
    at.set(s.id, { x: 12 + c * (BOX_W + GAP_X), y: 12 + r * (BOX_H + GAP_Y) });
  }
  const w = 24 + (Math.max(0, ...col.values()) + 1) * (BOX_W + GAP_X) - GAP_X, h = 24 + Math.max(1, ...rows.values()) * (BOX_H + GAP_Y) - GAP_Y;
  return (
    <div className="overflow-auto border border-line-subtle bg-inset p-2">
      <svg width={w} height={h} role="img" aria-label="The steps of this workflow, with arrows from a step to the steps that come after it" style={{ display: "block" }}>
        <defs><marker id="wf-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--color-text-tertiary)" /></marker></defs>
        {steps.flatMap((s) => s.after.map((a) => {
          const from = at.get(a), to = at.get(s.id);
          if (!from || !to) return null;
          const x1 = from.x + BOX_W, y1 = from.y + BOX_H / 2, x2 = to.x, y2 = to.y + BOX_H / 2, mid = (x1 + x2) / 2;
          return <path key={`${a}-${s.id}`} d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2 - 2},${y2}`} fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" markerEnd="url(#wf-arrow)" />;
        }))}
        {steps.map((s) => {
          const p = at.get(s.id)!, role = roles.find((r) => r.id === s.role);
          return (
            <g key={s.id} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-label={`${s.title}, ${role?.name ?? s.role}`} style={{ cursor: "pointer", outline: "none" }}
              onClick={() => onPick(s.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(s.id); } }}>
              <rect width={BOX_W} height={BOX_H} fill="var(--color-surface-1)" stroke={pick === s.id ? "var(--color-accent)" : "var(--color-line-strong)"} strokeWidth={pick === s.id ? 3 : 2} />
              <foreignObject x="6" y="6" width={BOX_W - 12} height={BOX_H - 12}>
                <div className="flex h-full items-center gap-2 overflow-hidden text-text">
                  <RoleMark roleId={s.role} size={20} />
                  <span className="flex min-w-0 flex-col"><span className="line-clamp-2 text-[13px] leading-4 font-bold">{s.title}</span><span className="truncate text-[11px] leading-4 text-text-tertiary">{role?.name ?? s.role}</span></span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36);
const fresh = (steps: Step[]) => { let n = steps.length + 1; while (steps.some((s) => s.id === `step-${n}`)) n++; return `step-${n}`; };

export function Workflows({ project, roles, onOpenBoard }: { project: Project | null; roles: Role[]; onOpenBoard: () => void }) {
  const [list, setList] = useState<Workflow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Workflow | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = (keep?: string) => {
    if (!project) return;
    listWorkflows(project.folder).then((l) => { setList(l); const id = keep ?? openId ?? l[0]?.id ?? null; setOpenId(id); setDraft(structuredClone(l.find((w) => w.id === id) ?? l[0] ?? null)); }).catch((e) => setError(String(e)));
  };
  useEffect(() => { setList(null); setDraft(null); setOpenId(null); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [project?.folder]);

  const saved = list?.find((w) => w.id === openId) ?? null;
  const dirty = useMemo(() => !!draft && !!saved && JSON.stringify({ ...draft, starter: false }) !== JSON.stringify({ ...saved, starter: false }), [draft, saved]);
  const step = draft?.steps.find((s) => s.id === pick) ?? null;

  const choose = (id: string) => { setOpenId(id); setDraft(structuredClone(list?.find((w) => w.id === id) ?? null)); setPick(null); setError(null); setNote(null); setConfirmStart(false); setConfirmDelete(false); };
  const change = (fn: (w: Workflow) => void) => setDraft((d) => { if (!d) return d; const next = structuredClone(d); fn(next); return next; });
  const changeStep = (id: string, patch: Partial<Step>) => change((w) => { w.steps = w.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)); });

  const addStep = () => change((w) => { const id = fresh(w.steps); w.steps.push({ id, title: "New step", role: roles[0]?.id ?? "product", after: w.steps.length ? [w.steps[w.steps.length - 1].id] : [], note: "" }); setPick(id); });
  const removeStep = (id: string) => { change((w) => { w.steps = w.steps.filter((s) => s.id !== id).map((s) => ({ ...s, after: s.after.filter((a) => a !== id) })); }); setPick(null); };
  const move = (id: string, by: -1 | 1) => change((w) => {
    const i = w.steps.findIndex((s) => s.id === id), j = i + by;
    if (j < 0 || j >= w.steps.length) return;
    [w.steps[i], w.steps[j]] = [w.steps[j], w.steps[i]];
    const seen = new Set<string>(); // a step may only come after steps listed before it: drop the links that no longer hold
    w.steps = w.steps.map((s) => { const after = s.after.filter((a) => seen.has(a)); seen.add(s.id); return { ...s, after }; });
  });
  const newWorkflow = () => {
    const base = "My workflow"; let id = slug(base), n = 2;
    while (list?.some((w) => w.id === id)) id = `${slug(base)}-${n++}`;
    const w: Workflow = { id, name: base, about: "", starter: true, steps: [{ id: "step-1", title: "First step", role: roles[0]?.id ?? "product", after: [], note: "" }] };
    setList((l) => [...(l ?? []), w]); setOpenId(id); setDraft(w); setPick("step-1"); setNote(null); setError(null);
  };

  const save = async () => {
    if (!project || !draft) return;
    setBusy(true); setError(null); setNote(null);
    try { const out = await saveWorkflow(project.folder, draft); setNote("Saved, and written to the Brain."); load(out.id); } catch (e) { setError(String(e)); }
    setBusy(false);
  };
  const start = async () => {
    if (!project || !draft) return;
    if (!confirmStart) { setConfirmStart(true); return; }
    setBusy(true); setError(null); setConfirmStart(false);
    try { const made = await startWorkflow(project.folder, draft); setNote(`Raised ${made.length} tickets on the Board, from ${made[0].id} to ${made[made.length - 1].id}.`); } catch (e) { setError(String(e)); }
    setBusy(false);
  };
  const remove = async () => {
    if (!project || !draft) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true); setConfirmDelete(false);
    try { await deleteWorkflow(project.folder, draft.id); setOpenId(null); load(); } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  if (!project) return <div className="flex flex-1 items-center justify-center text-text-tertiary">Open a project first.</div>;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-8">
      <div className="flex items-center gap-2.5">
        <h1 className="m-0 text-[26px] leading-8 font-bold">Workflows</h1>
        <Help title="Workflows">
          <p className="m-0">A workflow is the usual list of steps for one kind of work, with a role on each step. A step that comes after another waits for it.</p>
          <p className="m-0">It is a plan, not a status. Press Start and Kona raises one ticket on the Board for each step; the Board then shows where each piece stands.</p>
          <p className="m-0">Saving also writes a note in the Brain, so the steps can be found by asking. The file lives in this project's .kona folder.</p>
        </Help>
        <span className="flex-1" />
        <Button variant="quiet" small onClick={onOpenBoard}>Open the Board</Button>
      </div>

      {list === null && !error && <p className="m-0 text-text-tertiary">Reading the workflows…</p>}
      {list !== null && (
        <div className="flex min-h-0 flex-col gap-5 lg:flex-row">
          <nav aria-label="Workflows" className="flex shrink-0 flex-col gap-1 lg:w-[220px]">
            {list.map((w) => (
              <button key={w.id} type="button" onClick={() => choose(w.id)} aria-current={w.id === openId}
                className={`flex flex-col items-start border px-3 py-2 text-left ${w.id === openId ? "border-accent bg-surface-2" : "border-line-subtle bg-surface-1 hover:bg-surface-2"}`}>
                <span className="text-[15px] leading-5 font-bold">{w.name}</span>
                <span className="text-[12px] leading-4 text-text-tertiary">{w.steps.length} steps{w.starter ? " · not saved yet" : ""}</span>
              </button>
            ))}
            <Button variant="quiet" small onClick={newWorkflow}>+ New workflow</Button>
          </nav>

          {draft && (
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[220px] flex-1 flex-col gap-1"><span className="text-[13px] leading-5 font-bold text-text-secondary">Name</span>
                  <input value={draft.name} onChange={(e) => change((w) => { w.name = e.target.value; })} maxLength={60} className="h-10 border border-line-strong bg-inset px-3 text-[15px] text-text" /></label>
                <label className="flex min-w-[220px] flex-[2] flex-col gap-1"><span className="text-[13px] leading-5 font-bold text-text-secondary">About</span>
                  <input value={draft.about} onChange={(e) => change((w) => { w.about = e.target.value; })} maxLength={300} placeholder="One line" className="h-10 border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-text-tertiary" /></label>
              </div>

              <Chart steps={draft.steps} roles={roles} pick={pick} onPick={setPick} />

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="quiet" small onClick={addStep} disabled={draft.steps.length >= 20}>+ Add a step</Button>
                <Help title="Steps"><p className="m-0">Click a step in the chart to change it. A step can only come after steps listed before it, so a workflow can never loop. Use the arrows to change the order.</p></Help>
              </div>

              {step && (
                <section className="flex flex-col gap-3 border border-line-subtle bg-surface-1 p-3" aria-label="The step">
                  <div className="flex flex-wrap gap-3">
                    <label className="flex min-w-[220px] flex-[2] flex-col gap-1"><span className="text-[13px] leading-5 font-bold text-text-secondary">Step</span>
                      <input value={step.title} onChange={(e) => changeStep(step.id, { title: e.target.value })} maxLength={80} className="h-10 border border-line-strong bg-inset px-3 text-[15px] text-text" /></label>
                    <label className="flex min-w-[160px] flex-1 flex-col gap-1"><span className="text-[13px] leading-5 font-bold text-text-secondary">Role</span>
                      <select value={step.role} onChange={(e) => changeStep(step.id, { role: e.target.value })} className="h-10 border border-line-strong bg-inset px-2 text-[15px] text-text">
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        {!roles.some((r) => r.id === step.role) && <option value={step.role}>{step.role}</option>}
                      </select></label>
                  </div>
                  <fieldset className="m-0 flex flex-col gap-1 border-0 p-0"><legend className="p-0 text-[13px] leading-5 font-bold text-text-secondary">Comes after</legend>
                    {draft.steps.slice(0, draft.steps.findIndex((s) => s.id === step.id)).length === 0
                      ? <span className="text-[14px] text-text-tertiary">Nothing: it is the first.</span>
                      : <div className="flex flex-wrap gap-x-4 gap-y-1">{draft.steps.slice(0, draft.steps.findIndex((s) => s.id === step.id)).map((o) => (
                        <label key={o.id} className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={step.after.includes(o.id)}
                          onChange={(e) => changeStep(step.id, { after: e.target.checked ? [...step.after, o.id] : step.after.filter((a) => a !== o.id) })} />{o.title}</label>))}</div>}
                  </fieldset>
                  <label className="flex flex-col gap-1"><span className="text-[13px] leading-5 font-bold text-text-secondary">Note for the ticket</span>
                    <textarea value={step.note} onChange={(e) => changeStep(step.id, { note: e.target.value })} rows={2} maxLength={500} className="border border-line-strong bg-inset px-3 py-2 text-[15px] leading-6 text-text" /></label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" small onClick={() => move(step.id, -1)} aria-label="Move the step earlier">↑ Earlier</Button>
                    <Button variant="ghost" small onClick={() => move(step.id, 1)} aria-label="Move the step later">↓ Later</Button>
                    <span className="flex-1" />
                    <Button variant="ghost" small onClick={() => removeStep(step.id)} disabled={draft.steps.length <= 1}>Remove the step</Button>
                  </div>
                </section>
              )}

              {error && <p role="alert" className="m-0 flex items-start gap-2 text-[14px] leading-5 font-bold text-state-left"><Glyph state="left" size={16} />{error}</p>}
              {note && <p role="status" className="m-0 flex items-start gap-2 text-[14px] leading-5 text-text-secondary"><Glyph state="done" size={16} />{note}</p>}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void save()} disabled={busy || (!dirty && !draft.starter)}>{draft.starter ? "Save in this project" : "Save"}</Button>
                <Button variant={confirmStart ? "primary" : "quiet"} onClick={() => void start()} disabled={busy}>{confirmStart ? `Yes, raise ${draft.steps.length} tickets` : "Start"}</Button>
                {confirmStart && <Button variant="ghost" small onClick={() => setConfirmStart(false)}>Not now</Button>}
                <Help title="Start"><p className="m-0">Raises one ticket on the Board for each step, with the role of the step. The first steps are Ready. A step that comes after others waits in Backlog and shows what it waits for.</p><p className="m-0">It starts from what you see here, saved or not.</p></Help>
                <span className="flex-1" />
                {!draft.starter && <Button variant={confirmDelete ? "danger" : "ghost"} small onClick={() => void remove()} disabled={busy}>{confirmDelete ? "Yes, delete it" : "Delete"}</Button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
