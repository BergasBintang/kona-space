// The Costs place: what the open project's sessions cost, from Kona's own ledger. It is always one project; to see another, open it.
// Pick a period. The page shows the same total cut several ways at once (per day, by role, by ticket, by model, the most expensive sessions), so nothing has to be
// switched to see another cut. Dollars are an estimate at list price, never a bill (decision 25), so they are shown in cents with "about".
import { useEffect, useMemo, useState } from "react";
import { costHours, costRows, listTickets, roleLabel, samePlace, type Account, type CostRow, type HourRow, type Project, type Role } from "../lib/api";
import { Button, Glyph } from "./ui";
import { Help } from "./Help";
import { CHEVRON } from "./pick/parts";
import { smoothPath } from "../lib/curve";

type By = "role" | "ticket" | "account" | "model" | "session";
type Period = "today" | "week" | "month" | "all";
const PERIODS: { id: Period; word: string; days: number | null }[] = [
  { id: "today", word: "Today", days: 0 }, { id: "week", word: "7 days", days: 6 }, { id: "month", word: "30 days", days: 29 }, { id: "all", word: "All time", days: null },
];
// two colours of the theme for the two kinds of token: what Claude read (slate) and what it wrote (gold). Never colour alone: the words Read and Written sit beside them.
const READ_COLOUR = "var(--color-state-idle)";
const WRITE_COLOUR = "var(--color-brand)";
const SHOWN = 5; // each list shows this many lines, the rest sit behind "Show more"
const STRIP_MAX = 60; // "All time" draws at most this many days
const DOTS_UNTIL = 40; // a chart with more points than this has no dot for each

const localDay = (back: number) => { const d = new Date(); d.setDate(d.getDate() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dayWord = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
/** Cents, not four decimals: the figure is an estimate. */
const money = (n: number) => (n > 0 && n < 0.005 ? "under $0.01" : `$${n.toFixed(2)}`);
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
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((i) => <Button key={i.id} variant="quiet" small aria-pressed={value === i.id} on={value === i.id} onClick={() => onChange(i.id)}>{i.word}</Button>)}
    </div>
  );
}

/** One ranked list: a line per group with its dollars, a bar that is its share of the whole total, and a small line of facts. A click on a line opens its tokens. The long tail sits behind a button. */
function Panel({ title, lines, total, sessions = true }: { title: string; lines: Line[]; total: number; sessions?: boolean }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set()); // the lines whose tokens are showing
  const toggle = (key: string) => setOpen((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const rest = lines.slice(SHOWN);
  const show = all ? lines : lines.slice(0, SHOWN);
  return (
    <section aria-label={title} className="px-card flex min-w-0 flex-col gap-2 p-3">
      <h2 className="m-0 pb-2 text-[17px] leading-6 font-bold">{title}</h2>
      {show.map((l) => {
        const share = total > 0 ? (l.cost / total) * 100 : 0;
        const facts = [l.sub, sessions ? `${l.sessions.size} ${l.sessions.size === 1 ? "session" : "sessions"}` : null, `${l.turns} ${l.turns === 1 ? "turn" : "turns"}`, l.turns > 0 ? `${money(l.cost / l.turns)} a turn` : null].filter(Boolean).join(" · ");
        const isOpen = open.has(l.key);
        const read = l.input + l.cache, tok = read + l.output;
        const writtenShare = tok > 0 ? (l.output / tok) * 100 : 0;
        return (
          <div key={l.key} className="flex flex-col">
            <button type="button" aria-expanded={isOpen} onClick={() => toggle(l.key)} className="flex w-full cursor-pointer flex-col gap-1 px-2 py-2 text-left hover:bg-surface-3">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-bold" title={l.label}>{l.label}</span>
                <span className="flex shrink-0 items-center gap-2"><span className="font-mono text-[14px] font-bold">{money(l.cost)}</span><span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>{CHEVRON}</span></span>
              </span>
              <span className="flex items-center gap-2.5" aria-label={`${Math.round(share)} percent of the total`}>
                <span className="h-2 flex-1 overflow-hidden bg-surface-3"><span className="block h-full bg-accent" style={{ width: `${l.cost > 0 ? Math.max(2, share) : 0}%` }} /></span>
                <span className="w-10 text-right font-mono text-[13px] text-text-secondary">{share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`}</span>
              </span>
              <span className="truncate text-[13px] leading-5 text-text-tertiary">{facts}</span>
            </button>
            {isOpen && (
              <div role="group" aria-label={`Tokens for ${l.label}`} className="flex flex-col gap-2 bg-surface-1 px-3 py-3">
                <span className="flex h-3 w-full overflow-hidden bg-surface-3" aria-hidden="true">
                  <span className="block h-full" style={{ width: `${100 - (tok > 0 ? Math.max(3, writtenShare) : 0)}%`, background: READ_COLOUR }} />
                  <span className="block h-full" style={{ width: `${tok > 0 ? Math.max(3, writtenShare) : 0}%`, background: WRITE_COLOUR }} />
                </span>
                <span className="flex items-baseline justify-between gap-3 text-[13px] leading-5"><span className="flex items-center gap-2"><span className="h-3 w-3 shrink-0" style={{ background: READ_COLOUR }} aria-hidden="true" /><span className="font-bold">Read</span></span><span className="font-mono">{tokens(read)}</span></span>
                <span className="pl-5 text-[12px] leading-4 text-text-tertiary">{tokens(l.input)} new · {tokens(l.cache)} from the cache</span>
                <span className="flex items-baseline justify-between gap-3 text-[13px] leading-5"><span className="flex items-center gap-2"><span className="h-3 w-3 shrink-0" style={{ background: WRITE_COLOUR }} aria-hidden="true" /><span className="font-bold">Written</span></span><span className="font-mono">{tokens(l.output)}</span></span>
              </div>
            )}
          </div>
        );
      })}
      {rest.length > 0 && <Button variant="ghost" small className="self-start" onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show ${rest.length} more · ${money(rest.reduce((s, l) => s + l.cost, 0))}`}</Button>}
    </section>
  );
}

export function Costs({ project, roles, accounts }: { project: Project | null; roles: Role[]; accounts: Account[] }) {
  const [period, setPeriod] = useState<Period>("week");
  const [rows, setRows] = useState<CostRow[] | null>(null);
  const [hours, setHours] = useState<HourRow[] | null>(null); // today only: what each hour of today cost
  const [error, setError] = useState<string | null>(null);
  const [ticketOf, setTicketOf] = useState<Map<string, { key: string; label: string }>>(new Map()); // session id -> its ticket

  // which ticket each session worked on, read from the open project's ticket files
  useEffect(() => {
    if (!project) { setTicketOf(new Map()); return; }
    listTickets(project.id).catch(() => [])
      .then((ts) => { const m = new Map<string, { key: string; label: string }>(); for (const t of ts) for (const s of t.sessions) m.set(s, { key: t.id, label: `${t.id} ${t.title}` }); setTicketOf(m); });
  }, [project]);

  useEffect(() => {
    const days = PERIODS.find((p) => p.id === period)!.days;
    setRows(null); setError(null);
    costRows(days === null ? null : localDay(days)).then(setRows).catch((e) => setError(String(e)));
  }, [period]);

  useEffect(() => {
    setHours(null);
    if (period === "today") costHours(localDay(0)).then(setHours).catch(() => setHours([]));
  }, [period]);

  // the ledger holds every project; this screen keeps only the open project's rows
  const shown = useMemo(() => (rows === null || !project ? null : rows.filter((r) => r.folder && samePlace(project.folder, r.folder))), [rows, project]);

  const roleName = (id: string | null | undefined) => { const r = roles.find((x) => x.id === id); return r ? roleLabel(r) : id ? "A removed role" : "No role"; };
  const accountName = (id: string | null | undefined) => accounts.find((a) => a.id === (id ?? "main"))?.label ?? "A removed account";

  const hoursShown = useMemo(() => (hours === null || !project ? null : hours.filter((h) => h.folder && samePlace(project.folder, h.folder))), [hours, project]);

  const groups = useMemo(() => {
    const build = (by: By): Line[] => {
      const map = new Map<string, Line>();
      for (const r of shown ?? []) {
        let key: string, label: string, sub: string | undefined;
        switch (by) {
          case "role": key = r.role_id ?? ""; label = roleName(r.role_id); break;
          case "ticket": { const k = ticketOf.get(r.session_id); key = k?.key ?? ""; label = k?.label ?? "No ticket"; break; }
          case "account": key = r.account_id ?? "main"; label = accountName(r.account_id); break;
          case "model": key = r.model; label = modelName(r.model); break;
          case "session": key = r.session_id; label = new Date(r.first_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); sub = roleName(r.role_id); break;
        }
        const l = map.get(key) ?? { key, label, sub, cost: 0, input: 0, output: 0, cache: 0, turns: 0, sessions: new Set<string>() };
        l.cost += r.cost; l.input += r.input; l.output += r.output; l.cache += r.cache_read + r.cache_write; l.turns += r.turns; l.sessions.add(r.session_id);
        map.set(key, l);
      }
      return [...map.values()].sort((a, b) => b.cost - a.cost);
    };
    return { role: build("role"), ticket: build("ticket"), model: build("model"), account: build("account"), session: build("session") };
  }, [shown, roles, accounts, ticketOf]); // eslint-disable-line react-hooks/exhaustive-deps

  // one point per day of the period (a day with nothing spent is a point at zero). "All time" draws the last 60 days at most (the total and the lists cover everything).
  // "Today" has a point for each hour from midnight to now.
  const unit = period === "today" ? "hour" : "day";
  const points = useMemo(() => {
    if (!shown) return [];
    if (period === "today") {
      if (!hoursShown) return [];
      const day = localDay(0);
      const per = new Map<string, number>();
      for (const h of hoursShown) per.set(h.hour, (per.get(h.hour) ?? 0) + h.cost);
      return Array.from({ length: new Date().getHours() + 1 }, (_, i) => { const hh = String(i).padStart(2, "0"); return { key: `${day} ${hh}`, label: `${hh}:00`, cost: per.get(`${day} ${hh}`) ?? 0 }; });
    }
    const per = new Map<string, number>();
    for (const r of shown) per.set(r.day, (per.get(r.day) ?? 0) + r.cost);
    let n = (PERIODS.find((p) => p.id === period)!.days ?? 0) + 1;
    if (period === "all") {
      const first = [...per.keys()].sort()[0];
      if (!first) return [];
      n = Math.min(STRIP_MAX, Math.max(2, Math.round((Date.now() - new Date(`${first}T12:00:00`).getTime()) / 86_400_000) + 1));
    }
    return Array.from({ length: n }, (_, i) => { const day = localDay(n - 1 - i); return { key: day, label: dayWord(day), cost: per.get(day) ?? 0 }; });
  }, [shown, hoursShown, period]);
  const peak = points.reduce((best, p) => (p.cost > best.cost ? p : best), { key: "", label: "", cost: 0 });
  const total = groups.role.reduce((s, l) => s + l.cost, 0);
  const sessionCount = new Set((shown ?? []).map((r) => r.session_id)).size;
  const turnCount = (shown ?? []).reduce((s, r) => s + r.turns, 0);
  const period_ = PERIODS.find((p) => p.id === period)!;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex w-full flex-col gap-6 px-8 pt-8 pb-10">
        <div className="flex items-center gap-3"><h1 className="m-0 text-[30px] leading-[38px] font-bold">Costs</h1><Help title="Costs"><p className="m-0">What your sessions cost, from the ledger Kona keeps on this PC. Only sessions Kona ran are in it.</p><p className="m-0">Costs are always for the open project. Open another project to see its costs.</p><p className="m-0">The figures are an estimate at list price, not your bill. On a Pro or Max plan you pay a flat fee; use these figures to compare, not to count money.</p><p className="m-0">Click a line to see the tokens behind it: what Claude read (new, and from the cache) and what it wrote. The bar there counts tokens, not dollars: a written token costs several times more than a read one, so a thin gold slice can still be a big part of the dollars.</p></Help></div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Chips label="Period" value={period} onChange={setPeriod} items={PERIODS} />
        </div>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="font-mono text-[34px] leading-[44px] font-bold">{total >= 0.005 ? `about ${money(total)}` : money(total)}</span>
          <span className="text-[14px] leading-5 text-text-secondary">{period_.word === "All time" ? "in all" : period_.word === "Today" ? "today" : `in the last ${period_.word}`} · {sessionCount} {sessionCount === 1 ? "session" : "sessions"} · {turnCount} {turnCount === 1 ? "turn" : "turns"}</span>
        </div>

        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        {rows === null && !error && <p className="m-0 text-text-tertiary">Reading the ledger…</p>}
        {shown !== null && groups.role.length === 0 && (
          <div className="flex flex-col gap-2 border border-dashed border-line-strong p-6">
            <span className="font-bold">Nothing spent {project ? `in ${project.name} ` : ""}{period === "all" ? "yet" : "in this period"}.</span>
            <span className="text-[14px] leading-5 text-text-secondary">{period === "all" ? "Start a session and each finished turn is saved here." : "Try a longer period."}</span>
          </div>
        )}

        {points.length > 0 && peak.cost > 0 && (
          <section aria-label={`Cost per ${unit}`} className="px-card flex flex-col gap-3 p-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="m-0 text-[17px] leading-6 font-bold">Per {unit}</h2>
              <span className="text-[13px] leading-5 text-text-tertiary">Most: {money(peak.cost)} · {peak.label}</span>
            </div>
            <div role="img" aria-label={`Cost for each of the last ${points.length} ${unit}s. The most was ${money(peak.cost)}, ${peak.label}.`} className="relative h-28 border-b border-line-subtle">
              {/* the smooth line is stretched to the box; the dots are separate squares, so they stay square whatever the width. Past 40 points a dot each would be a smear: the line stands alone */}
              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
                <path d={smoothPath(points.map((p, i) => [((i + 0.5) / points.length) * 1000, 100 - (4 + (p.cost / peak.cost) * 88)] as const))} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {points.map((p, i) => (points.length <= DOTS_UNTIL || p.key === peak.key) && (
                <span key={p.key} title={`${p.label} · ${money(p.cost)}`} className={`absolute -translate-x-1/2 translate-y-1/2 ${p.cost > 0 ? "h-2.5 w-2.5 bg-accent" : "h-1.5 w-1.5 bg-text-disabled"}`}
                  style={{ left: `${((i + 0.5) / points.length) * 100}%`, bottom: `${4 + (p.cost / peak.cost) * 88}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-[12px] leading-4 text-text-tertiary"><span>{points[0].label}</span><span>{points[points.length - 1].label}</span></div>
          </section>
        )}

        {groups.role.length > 0 && (
          <div className="flex flex-col gap-6">
            <Panel title="By role" lines={groups.role} total={total} />
            <Panel title="By ticket" lines={groups.ticket} total={total} />
            <Panel title="By model" lines={groups.model} total={total} />
            {groups.account.length > 1 && <Panel title="By account" lines={groups.account} total={total} />}
            <Panel title="Most expensive sessions" lines={groups.session} total={total} sessions={false} />
          </div>
        )}
      </div>
    </main>
  );
}
