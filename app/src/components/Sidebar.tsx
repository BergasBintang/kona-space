// The sidebar: the Kona mark, the sessions of this run, the two plan bars. (The other places come with later steps.)
import { Button, Glyph, PlanBar, type GlyphState } from "./ui";
import { dollars, type Session, type State } from "../lib/sessions";

const folderName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;
const RUN: Record<Session["run"], { state: GlyphState; word: string }> = {
  starting: { state: "idle", word: "Starting" }, ready: { state: "idle", word: "Ready" }, working: { state: "live", word: "Working" },
  waiting: { state: "waiting", word: "Waiting on you" }, ended: { state: "stopped", word: "Ended" },
};

export function Sidebar({ state, onSelect, onNew, version }: { state: State; onSelect: (id: string) => void; onNew: () => void; version: string }) {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-5 bg-surface-1 px-3.5 pt-7 pb-[22px]">
      <div className="flex items-center gap-2.5 px-1.5">
        <Glyph state="live" size={24} color="var(--color-accent)" />
        <span className="text-[22px] leading-[30px] font-bold">Kona</span>
      </div>
      <div className="flex items-center justify-between px-1.5">
        <span className="text-[15px] leading-6 font-bold text-text-secondary">Sessions</span>
        <Button variant="quiet" small onClick={onNew}>New</Button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Sessions">
        {state.order.length === 0 && <p className="m-0 px-1.5 text-[13px] leading-5 text-text-tertiary">None yet.</p>}
        {state.order.map((id) => {
          const s = state.sessions[id];
          const r = RUN[s.run];
          const on = state.selected === id;
          return (
            <button key={id} onClick={() => onSelect(id)} aria-current={on ? "true" : undefined}
              className={`flex h-16 items-center gap-3 rounded-xl px-3.5 text-left transition-colors ${on ? "bg-surface-3" : "hover:bg-surface-2"}`}>
              <Glyph state={r.state} size={18} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{folderName(s.folder)}</span>
                <span className="truncate text-[13px] leading-5 text-text-tertiary">{r.word} · {s.model}</span>
              </span>
              <span className="font-mono text-[13px] text-text-tertiary">{dollars(s.costTotal)}</span>
            </button>
          );
        })}
      </nav>
      <div className="flex flex-col gap-4 px-1.5">
        <PlanBar label="This session (5 hours)" window={state.plan.fiveHour} />
        <PlanBar label="This week" window={state.plan.sevenDay} />
        <span className="font-mono text-[12px] text-text-disabled">Kona {version}</span>
      </div>
    </aside>
  );
}
