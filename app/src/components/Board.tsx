// The Board place: tickets as cards in five columns. Tickets are plain files in the project (`.kona/tickets`), read and written by the
// core. Agents raise and update cards through the built-in tool server, so the board polls every two seconds while it is open.
// Agents may move a card up to Review; only the owner moves one to Done (the core and the tool server both enforce that for agents).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTicket, listTickets, removeTicket, updateTicket, worktreeStatus, type Project, type Role, type TicketView, type WorktreeStatus } from "../lib/api";
import { dollars, type State } from "../lib/sessions";
import { Button, Glyph, RoleMark } from "./ui";
import { Select } from "./pick";
import { Confirm } from "./Confirm";
import { Help } from "./Help";

export const COLUMNS = [
  { id: "backlog", name: "Backlog", says: "Ideas and things to do someday" },
  { id: "ready", name: "Ready", says: "Clear enough to start" },
  { id: "in-progress", name: "In progress", says: "Someone is on it" },
  { id: "review", name: "Review", says: "Waiting for you to look" },
  { id: "done", name: "Done", says: "Only you move cards here" },
] as const;

/** What the sessions on this ticket are doing now, from the live sessions. */
function liveState(t: TicketView, state: State): "waiting" | "working" | null {
  let any: "waiting" | "working" | null = t.waiting ? "waiting" : null;
  for (const id of t.sessions) {
    const run = state.sessions[id]?.run;
    if (run === "waiting") return "waiting";
    if (run === "working" && any === null) any = "working";
  }
  return any;
}

function Card({ t, role, live, active, onOpen }: { t: TicketView; role?: Role; live: "waiting" | "working" | null; active: boolean; onOpen: () => void }) {
  return (
    <div role="button" tabIndex={0} draggable aria-label={`${t.id} ${t.title}`}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      onDragStart={(e) => { e.dataTransfer.setData("text/kona-ticket", t.id); e.dataTransfer.effectAllowed = "move"; }}
      className={`flex cursor-grab flex-col gap-2.5 border px-3.5 py-3 text-left active:cursor-grabbing ${active ? "border-accent bg-surface-2" : "border-line-subtle bg-surface-1 hover:bg-surface-2"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12px] text-text-tertiary">{t.id}</span>
        {live && (
          <span className={`flex items-center gap-1.5 text-[12px] leading-4 font-bold ${live === "waiting" ? "text-state-waiting" : "text-state-live"}`}>
            <Glyph state={live === "waiting" ? "waiting" : "live"} size={14} />{live === "waiting" ? "Waiting on you" : "Working"}
          </span>
        )}
      </div>
      <span className="line-clamp-3 text-[15px] leading-5 font-bold">{t.title}</span>
      {t.branch && <span className="truncate font-mono text-[12px] leading-4 text-text-tertiary" title={t.branch}>{t.branch}</span>}
      {t.next && <span className="line-clamp-2 text-[13px] leading-[18px] text-text-secondary">Next: {t.next}</span>}
      <div className="flex items-center justify-between gap-2 text-[13px] leading-5 text-text-tertiary">
        <span className="flex min-w-0 items-center gap-2">{role ? (<><RoleMark roleId={role.id} size={22} /><span className="truncate">{role.name}</span></>) : <span>No role</span>}</span>
        {t.cost > 0 && <span className="shrink-0 font-mono">{dollars(t.cost)}</span>}
      </div>
    </div>
  );
}

type Draft = { title: string; description: string; acceptance: string; role: string; status: string; next: string; waiting: boolean; own_copy: string };
const draftOf = (t: TicketView | null): Draft => ({ title: t?.title ?? "", description: t?.description ?? "", acceptance: t?.acceptance ?? "", role: t?.role ?? "", status: t?.status ?? "backlog", next: t?.next ?? "", waiting: t?.waiting ?? false, own_copy: t?.own_copy ?? "auto" });
const field = "border border-line-strong bg-inset px-3.5 text-[15px] text-text placeholder:text-text-tertiary";

function Drawer({ project, roles, ticket, state, guardDone, onClose, onSaved, onRemoved, onStart, onOpenSession }: {
  project: Project; roles: Role[]; ticket: TicketView | null; state: State; guardDone: (t: TicketView) => Promise<boolean>; onClose: () => void;
  onSaved: (id: string) => void; onRemoved: () => void; onStart: (t: TicketView) => Promise<void>; onOpenSession: (id: string) => void;
}) {
  const fresh = ticket === null;
  const [draft, setDraft] = useState<Draft>(draftOf(ticket));
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = useRef<Draft>(draftOf(ticket));
  const [wt, setWt] = useState<WorktreeStatus | null>(null);
  useEffect(() => { if (!ticket?.worktree) { setWt(null); return; } worktreeStatus(project.id, ticket.id).then(setWt).catch(() => setWt(null)); }, [ticket?.id, ticket?.worktree, ticket?.updated, project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // changes whenever anything the drawer shows changes (the time alone is only to the minute)
  const stamp = ticket ? JSON.stringify([ticket.id, ticket.updated, ticket.title, ticket.status, ticket.role, ticket.next, ticket.waiting, ticket.description, ticket.acceptance, ticket.history.length, ticket.own_copy, ticket.branch]) : "new";
  const dirty = JSON.stringify(draft) !== JSON.stringify(base.current);

  // a card changed by an agent shows up here, unless the owner is in the middle of typing
  useEffect(() => {
    const next = draftOf(ticket);
    if (!dirty) setDraft(next);
    base.current = next; setError(null); setConfirm(false);
  }, [stamp]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (fresh) {
        const t = await createTicket(project.id, { title: draft.title, description: draft.description, acceptance: draft.acceptance, role: draft.role || null, status: draft.status, next: draft.next, own_copy: draft.own_copy });
        onSaved(t.id);
      } else {
        if (draft.status === "done" && base.current.status !== "done" && !(await guardDone(ticket!))) { setBusy(false); return; }
        const b = base.current; const patch: Record<string, unknown> = {};
        (Object.keys(draft) as (keyof Draft)[]).forEach((k) => { if (draft[k] !== b[k]) patch[k] = draft[k]; });
        await updateTicket(project.id, ticket!.id, patch);
        onSaved(ticket!.id);
      }
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm) { setConfirm(true); return; }
    try { await removeTicket(project.id, ticket!.id); onRemoved(); } catch (e) { setError(String(e)); }
  };
  const start = async () => { setBusy(true); setError(null); try { await onStart(ticket!); } catch (e) { setError(String(e)); } finally { setBusy(false); } };

  const role = roles.find((r) => r.id === draft.role);
  const canStart = !fresh && !dirty && draft.role !== "" && ticket!.status !== "done";
  const why = fresh ? "" : dirty ? "Save your changes first." : draft.role === "" ? "Choose a role first." : ticket!.status === "done" ? "This ticket is done." : "";

  return (
    <aside aria-label={fresh ? "New ticket" : `Ticket ${ticket!.id}`} className="absolute inset-y-0 right-0 z-20 flex w-[500px] max-w-full flex-col border-l-2 border-line-strong bg-surface-1 px-shadow">
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[13px] text-text-tertiary">{fresh ? "New ticket" : ticket!.id}</span>
          {!fresh && <span className="text-[13px] leading-5 text-text-tertiary">Raised by {ticket!.raised_by} · {ticket!.created}</span>}
        </div>
        <Button variant="ghost" small onClick={onClose}>Close</Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Title</span>
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Login page" aria-label="Title" className={`h-11 ${field}`} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Column" value={draft.status} onChange={(v) => set({ status: v })} options={COLUMNS.filter((c) => !fresh || c.id === "backlog" || c.id === "ready").map((c) => ({ value: c.id, label: c.name, hint: c.says }))} />
          <Select label="Role" value={draft.role} onChange={(v) => set({ role: v })} options={[{ value: "", label: "No role" }, ...roles.map((r) => ({ value: r.id, label: r.name, hint: r.group }))]} />
        </div>
        <div className="flex flex-col gap-2">
          <Select label="Where its sessions work" value={draft.own_copy} onChange={(v) => set({ own_copy: v })} options={[
            { value: "auto", label: role?.own_copy ? "Follow the role: its own copy of the repo" : "Follow the role: the main folder", hint: "Set on the role in Roles" },
            { value: "yes", label: "Its own copy of the repo", hint: "A separate folder on its own branch" },
            { value: "no", label: "The main folder", hint: "Claude works in your project folder itself" }]} />
          {!fresh && ticket!.branch && (
            <div className="flex flex-col gap-1 border border-line-subtle bg-inset px-3.5 py-2.5 text-[13px] leading-5">
              <span className="font-mono text-text-secondary">{ticket!.branch}</span>
              <span className="truncate font-mono text-text-tertiary" title={ticket!.worktree}>{ticket!.worktree}</span>
              {wt?.exists ? <span className="text-text-secondary">{wt.ahead} {wt.ahead === 1 ? "commit" : "commits"} ahead of {wt.base}, {wt.behind} behind · {wt.changed} {wt.changed === 1 ? "file" : "files"} changed, not committed</span> : <span className="text-text-tertiary">The folder is gone. A new session makes it again.</span>}
            </div>
          )}
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">What needs doing</span>
          <textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={4} aria-label="What needs doing" className={`py-3 leading-6 ${field}`} placeholder="What and why, in plain words." />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Done when</span>
          <textarea value={draft.acceptance} onChange={(e) => set({ acceptance: e.target.value })} rows={3} aria-label="Done when" className={`py-3 leading-6 ${field}`} placeholder="How you can tell it is finished." />
        </label>
        {!fresh && (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">Next step</span>
              <input value={draft.next} onChange={(e) => set({ next: e.target.value })} aria-label="Next step" className={`h-11 ${field}`} placeholder="What should happen next." />
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={draft.waiting} onChange={(e) => set({ waiting: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
              <span className="font-bold">Waiting on you</span>
              <span className="text-[13px] leading-5 text-text-secondary">A flag on the card. Agents set it when they need an answer.</span>
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">Sessions</span>
              {ticket!.sessions.length === 0 && <span className="text-[14px] leading-5 text-text-tertiary">No session has worked on this yet.</span>}
              {ticket!.sessions.map((id) => (
                <div key={id} className="flex items-center justify-between gap-3 text-[14px] leading-5">
                  <span className="font-mono text-text-secondary">{id.slice(0, 8)}</span>
                  {state.sessions[id] ? <button type="button" onClick={() => onOpenSession(id)} className="font-bold text-text-secondary hover:text-text">Open</button> : <span className="text-text-tertiary">Not open in this window</span>}
                </div>
              ))}
              {ticket!.cost > 0 && <span className="font-mono text-[13px] text-text-secondary">{dollars(ticket!.cost)} so far <span className="font-sans text-text-tertiary">· an estimate, not your bill</span></span>}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-bold text-text-secondary">History</span>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {[...ticket!.history].reverse().map((h, i) => <li key={i} className="text-[13px] leading-5 text-text-secondary">{h}</li>)}
              </ul>
            </div>
          </>
        )}
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
      </div>
      <div className="flex flex-col gap-3 border-t border-line-subtle px-6 py-4">
        {!fresh && (
          <div className="flex items-center justify-between gap-3">
            <Button onClick={start} disabled={!canStart || busy}>{role ? `Start session as ${role.name}` : "Start session"}</Button>
            <span className="text-right text-[13px] leading-5 text-text-tertiary">{why}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          {!fresh ? <Button variant={confirm ? "danger" : "ghost"} small onClick={remove}>{confirm ? "Yes, remove this ticket" : "Remove ticket"}</Button> : <span />}
          <Button variant={fresh ? "primary" : "quiet"} onClick={save} disabled={!dirty || busy || draft.title.trim() === ""}>{fresh ? "Create ticket" : "Save"}</Button>
        </div>
      </div>
    </aside>
  );
}

export function Board({ project, roles, state, onStart, onOpenSession }: {
  project: Project; roles: Role[]; state: State; onStart: (t: TicketView) => Promise<void>; onOpenSession: (id: string) => void;
}) {
  const [tickets, setTickets] = useState<TicketView[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null); // "" is a new ticket
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unmerged, setUnmerged] = useState<{ t: TicketView; ahead: number; resolve: (go: boolean) => void } | null>(null);

  // Done means merged: a ticket whose own copy still has commits the main branch lacks asks before it moves to Done
  const guardDone = useCallback(async (t: TicketView): Promise<boolean> => {
    if (!t.worktree) return true;
    const st = await worktreeStatus(project.id, t.id).catch(() => null);
    if (!st || !st.exists || st.ahead === 0) return true;
    return new Promise<boolean>((resolve) => setUnmerged({ t, ahead: st.ahead, resolve }));
  }, [project.id]);

  const load = useCallback(() => { listTickets(project.id).then((t) => { setTickets(t); setError(null); }).catch((e) => setError(String(e))); }, [project.id]);
  useEffect(() => { setTickets(null); setOpenId(null); load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);

  const byColumn = useMemo(() => {
    const m: Record<string, TicketView[]> = Object.fromEntries(COLUMNS.map((c) => [c.id, [] as TicketView[]]));
    for (const t of tickets ?? []) (m[t.status] ?? m.backlog).push(t);
    return m;
  }, [tickets]);
  const open = openId ? tickets?.find((t) => t.id === openId) ?? null : null;

  const drop = async (status: string, e: React.DragEvent) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData("text/kona-ticket");
    const t = tickets?.find((x) => x.id === id);
    if (!t || t.status === status) return;
    if (status === "done" && !(await guardDone(t))) return;
    setTickets((cur) => cur?.map((x) => (x.id === id ? { ...x, status } : x)) ?? null); // show it at once; the file is the truth
    try { await updateTicket(project.id, id, { status }); } catch (err) { setError(String(err)); }
    load();
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-4 px-8 pt-7 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3"><h1 className="m-0 text-[26px] leading-[34px] font-bold">Board</h1><Help title="Board"><p className="m-0">Tickets are plain files in the project's hidden .kona folder.</p></Help></div>
          <span className="text-[13px] leading-5 text-text-tertiary">{project.name}</span>
        </div>
        <Button onClick={() => setOpenId("")}>New ticket</Button>
      </div>
      {error && <div className="mx-8 mb-2 flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
      {tickets === null && !error && <p className="m-0 px-8 text-text-tertiary">Reading the tickets…</p>}
      {tickets !== null && (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-8 pb-6">
          {COLUMNS.map((c) => (
            <section key={c.id} aria-label={c.name}
              onDragOver={(e) => { e.preventDefault(); setOver(c.id); }} onDragLeave={() => setOver((o) => (o === c.id ? null : o))} onDrop={(e) => drop(c.id, e)}
              className={`flex min-w-[168px] max-w-[300px] flex-1 basis-0 flex-col gap-2.5 border px-2.5 pt-3 pb-2.5 ${over === c.id ? "border-accent bg-surface-1" : "border-transparent bg-ground"}`}>
              <div className="flex items-baseline justify-between px-1.5">
                <h2 className="m-0 text-[15px] leading-6 font-bold">{c.name}</h2>
                <span className="font-mono text-[13px] text-text-tertiary">{byColumn[c.id].length}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
                {byColumn[c.id].map((t) => <Card key={t.id} t={t} role={roles.find((r) => r.id === t.role)} live={liveState(t, state)} active={openId === t.id} onOpen={() => setOpenId(t.id)} />)}
                {byColumn[c.id].length === 0 && <p className="m-0 px-1.5 text-[13px] leading-5 text-text-tertiary">{c.says}.</p>}
              </div>
            </section>
          ))}
        </div>
      )}
      {unmerged && (
        <Confirm title="Move to Done without merging?" confirmLabel="Move to Done" onConfirm={() => { unmerged.resolve(true); setUnmerged(null); }} onCancel={() => { unmerged.resolve(false); setUnmerged(null); }}>
          <p className="m-0">{unmerged.t.id} has {unmerged.ahead} {unmerged.ahead === 1 ? "commit" : "commits"} on its own branch that your main branch does not have. Done normally means merged.</p>
          <p className="m-0">You can merge it first in Worktrees. Moving it to Done now leaves the branch as it is.</p>
        </Confirm>
      )}
      {openId !== null && (openId === "" || open) && (
        <Drawer key={openId} project={project} roles={roles} ticket={open} state={state} onClose={() => setOpenId(null)}
          guardDone={guardDone} onSaved={(id) => { setOpenId(id); load(); }} onRemoved={() => { setOpenId(null); load(); }} onStart={onStart} onOpenSession={onOpenSession} />
      )}
    </main>
  );
}
