// The Costs place: what the sessions cost, from Kona's own ledger. Pick a period and how to group it (project, role, account,
// model, day or session). Dollars are an estimate at list price, never a bill (decision 25).
import { useEffect, useMemo, useState } from "react";
import { costRows, listTickets, baseName, samePlace, type Account, type CostRow, type Project, type Role } from "../lib/api";
import { dollars } from "../lib/sessions";
import { Glyph } from "./ui";

type By = "project" | "role" | "ticket" | "account" | "model" | "day" | "session";
const BYS: { id: By; word: string }[] = [
  { id: "project", word: "Project" }, { id: "role", word: "Role" }, { id: "ticket", word: "Ticket" }, { id: "account", word: "Account" },
  { id: "model", word: "Model" }, { id: "day", word: "Day" }, { id: "session", word: "Session" },
];
type Period = "today" | "week" | "month" | "all";
const PERIODS: { id: Period; word: string; days: number | null }[] = [
  { id: "today", word: "Today", days: 0 }, { id: "week", word: "7 days", days: 6 }, { id: "month", word: "30 days", days: 29 }, { id: "all", word: "All time", days: null },
];

const localDay = (back: number) => { const d = new Date(); d.setDate(d.getDate() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
/** "claude-sonnet-5-5" -> "Sonnet 5.5" */
function modelName(m: string): string {
  const x = m.replace(/^claude-/, "").replace(/-\d{8}$/, "");
  const parts = x.split("-");
  const name = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : m;
  const ver = parts.slice(1).join(".");
  return ver ? `${name} ${ver}` : name;
}

type Line = { key: string; label: string; sub?: string; cost: number; input: number; output: number; cache: number; turns: number; sessions: Set<string> };

function Chips<T extends string>({ label, value, onChange, items }: { label: string; value: T; onChange: (v: T) => void; items: { id: T; word: string }[] }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-control border border-line-strong p-0.5">
      {items.map((i) => (
        <button key={i.id} type="button" aria-pressed={value === i.id} onClick={() => onChange(i.id)}
          className={`h-9 rounded-[10px] px-3.5 text-[14px] ${value === i.id ? "bg-surface-3 font-bold text-text" : "text-text-secondary hover:text-text"}`}>{i.word}</button>
      ))}
    </div>
  );
}

export function Costs({ projects, roles, accounts }: { projects: Project[]; roles: Role[]; accounts: Account[] }) {
  const [period, setPeriod] = useState<Period>("week");
  const [by, setBy] = useState<By>("project");
  const [rows, setRows] = useState<CostRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketOf, setTicketOf] = useState<Map<string, { key: string; label: string; sub: string }>>(new Map()); // session id -> its ticket

  // which ticket each session worked on, read from the ticket files of every project
  useEffect(() => {
    Promise.all(projects.map((p) => listTickets(p.id).then((ts) => ts.map((t) => ({ p, t }))).catch(() => [])))
      .then((all) => { const m = new Map<string, { key: string; label: string; sub: string }>(); for (const { p, t } of all.flat()) for (const s of t.sessions) m.set(s, { key: `${p.id}|${t.id}`, label: `${t.id} ${t.title}`, sub: p.name }); setTicketOf(m); });
  }, [projects]);

  useEffect(() => {
    const days = PERIODS.find((p) => p.id === period)!.days;
    setRows(null); setError(null);
    costRows(days === null ? null : localDay(days)).then(setRows).catch((e) => setError(String(e)));
  }, [period]);

  const projectName = (folder: string | null | undefined) => {
    if (!folder) return "Unknown folder";
    return projects.find((p) => samePlace(p.folder, folder))?.name ?? baseName(folder);
  };
  const roleName = (id: string | null | undefined) => roles.find((r) => r.id === id)?.name ?? (id ? "A removed role" : "No role");
  const accountName = (id: string | null | undefined) => accounts.find((a) => a.id === (id ?? "main"))?.label ?? "A removed account";

  const lines = useMemo<Line[]>(() => {
    const map = new Map<string, Line>();
    for (const r of rows ?? []) {
      let key: string, label: string, sub: string | undefined;
      switch (by) {
        case "project": key = (r.folder ?? "").toLowerCase().replace(/\\/g, "/"); label = projectName(r.folder); sub = r.folder ?? undefined; break;
        case "role": key = r.role_id ?? ""; label = roleName(r.role_id); break;
        case "ticket": { const k = ticketOf.get(r.session_id); key = k?.key ?? ""; label = k?.label ?? "No ticket"; sub = k?.sub; break; }
        case "account": key = r.account_id ?? "main"; label = accountName(r.account_id); break;
        case "model": key = r.model; label = modelName(r.model); sub = r.model; break;
        case "day": key = r.day; label = new Date(`${r.day}T12:00:00`).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); break;
        case "session": key = r.session_id; label = new Date(r.first_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); sub = `${projectName(r.folder)} · ${roleName(r.role_id)}`; break;
      }
      const l = map.get(key) ?? { key, label, sub, cost: 0, input: 0, output: 0, cache: 0, turns: 0, sessions: new Set<string>() };
      l.cost += r.cost; l.input += r.input; l.output += r.output; l.cache += r.cache_read + r.cache_write; l.turns += r.turns; l.sessions.add(r.session_id);
      map.set(key, l);
    }
    const all = [...map.values()];
    return by === "day" ? all.sort((a, b) => b.key.localeCompare(a.key)) : all.sort((a, b) => b.cost - a.cost);
  }, [rows, by, projects, roles, accounts, ticketOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = lines.reduce((s, l) => s + l.cost, 0);
  const sessionCount = new Set((rows ?? []).map((r) => r.session_id)).size;
  const turnCount = (rows ?? []).reduce((s, r) => s + r.turns, 0);
  const top = Math.max(...lines.map((l) => l.cost), 0);
  const period_ = PERIODS.find((p) => p.id === period)!;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[calc(1160px*var(--k))] flex-col gap-6 px-8 pt-8 pb-10">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-[30px] leading-[38px] font-bold">Costs</h1>
          <p className="m-0 text-text-secondary">What your sessions cost, from the ledger Kona keeps on this PC. Only sessions Kona ran are in it.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Chips label="Period" value={period} onChange={setPeriod} items={PERIODS} />
          <Chips label="Group by" value={by} onChange={setBy} items={BYS} />
        </div>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="font-mono text-[34px] leading-[44px] font-bold">{dollars(total)}</span>
          <span className="text-[14px] leading-5 text-text-secondary">{period_.word === "All time" ? "in all" : period_.word === "Today" ? "today" : `in the last ${period_.word}`} · {sessionCount} {sessionCount === 1 ? "session" : "sessions"} · {turnCount} {turnCount === 1 ? "turn" : "turns"}</span>
        </div>
        <p className="m-0 -mt-3 text-[13px] leading-5 text-text-tertiary">An estimate at list price, not your bill. On a Pro or Max plan you pay a flat fee; use these figures to compare, not to count money.</p>

        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        {rows === null && !error && <p className="m-0 text-text-tertiary">Reading the ledger…</p>}
        {rows !== null && lines.length === 0 && (
          <div className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong p-6">
            <span className="font-bold">Nothing spent {period === "all" ? "yet" : "in this period"}.</span>
            <span className="text-[14px] leading-5 text-text-secondary">{period === "all" ? "Start a session and each finished turn is saved here." : "Try a longer period."}</span>
          </div>
        )}

        {lines.length > 0 && (
          <div role="table" aria-label={`Cost by ${by}`} className="flex flex-col">
            <div role="row" className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_88px_88px_104px] items-center gap-4 border-b border-line-subtle px-3 pb-2 text-[13px] leading-5 font-bold text-text-tertiary">
              <span role="columnheader">{BYS.find((b) => b.id === by)!.word}</span><span role="columnheader" aria-label="Share of the total" />
              <span role="columnheader" className="text-right">Sent</span><span role="columnheader" className="text-right">Written</span><span role="columnheader" className="text-right">Dollars</span>
            </div>
            {lines.map((l) => (
              <div role="row" key={l.key} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_88px_88px_104px] items-center gap-4 rounded-lg px-3 py-3 hover:bg-surface-1">
                <span role="cell" className="flex min-w-0 flex-col">
                  <span className="truncate font-bold" title={l.label}>{l.label}</span>
                  <span className="truncate text-[13px] leading-5 text-text-tertiary" title={l.sub}>
                    {l.sub ? `${l.sub} · ` : ""}{by !== "session" && `${l.sessions.size} ${l.sessions.size === 1 ? "session" : "sessions"} · `}{l.turns} {l.turns === 1 ? "turn" : "turns"}
                  </span>
                </span>
                <span role="cell" className="flex items-center gap-2.5" aria-label={`${total > 0 ? Math.round((l.cost / total) * 100) : 0} percent of the total`}>
                  <span className="h-2 flex-1 overflow-hidden rounded bg-surface-3"><span className="block h-full rounded bg-accent" style={{ width: `${top > 0 ? Math.max(3, (l.cost / top) * 100) : 0}%` }} /></span>
                  <span className="w-10 text-right font-mono text-[13px] text-text-secondary">{total > 0 ? Math.round((l.cost / total) * 100) : 0}%</span>
                </span>
                <span role="cell" className="text-right font-mono text-[13px] text-text-secondary" title="Tokens Claude read, new and from cache">{tokens(l.input + l.cache)}</span>
                <span role="cell" className="text-right font-mono text-[13px] text-text-secondary" title="Tokens Claude wrote">{tokens(l.output)}</span>
                <span role="cell" className="text-right font-mono text-[14px] font-bold">{dollars(l.cost)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
