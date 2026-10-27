// The sidebar: the Kona mark, the project, the places that exist so far, the two plan bars.
import { Glyph, PlanBar } from "./ui";
import { Select } from "./pick";
import type { Project } from "../lib/api";
import type { Plan } from "../lib/sessions";

export type Place = "sessions" | "files" | "roles" | "accounts" | "costs" | "voice" | "board" | "worktrees" | "leftovers";

const ICONS: Record<Place, React.ReactNode> = {
  sessions: <path d="M2.5 3.5 L13.5 3.5 L13.5 10.5 L7 10.5 L4 13 L4 10.5 L2.5 10.5 Z" />,
  files: <path d="M2 5 L2 12.5 L14 12.5 L14 6 L7.5 6 L6.5 4 L2 4 Z" />,
  leftovers: <path d="M3 4 H13 M5 4 V12.5 H11 V4 M6.5 6.5 V10 M9.5 6.5 V10 M6 2.5 H10" />,
  worktrees: <><circle cx="4.5" cy="4" r="1.6" /><circle cx="4.5" cy="12" r="1.6" /><circle cx="11.5" cy="6.5" r="1.6" /><path d="M4.5 5.6 V10.4 M4.5 8.5 C4.5 7 8 8 10 6.9" /></>,
  board: <path d="M2.5 3.5 H6 V12.5 H2.5 Z M6.75 3.5 H9.25 V9 H6.75 Z M10 3.5 H13.5 V7 H10 Z" />,
  voice: <path d="M3 6.5 V9.5 M6 4 V12 M9 5.5 V10.5 M12 3.5 V12.5" />,
  costs: <path d="M3 13 V8.5 M7 13 V4 M11 13 V6.5 M14 13 H2" />,
  accounts: <><circle cx="6" cy="8" r="2.8" /><path d="M8.8 8 H14 M12 8 V10.5" /></>,
  roles: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13 C3 10.2 5 9 8 9 C11 9 13 10.2 13 13 Z" /></>,
};
const PLACES: { id: Place; label: string }[] = [{ id: "sessions", label: "Sessions" }, { id: "board", label: "Board" }, { id: "worktrees", label: "Worktrees" }, { id: "files", label: "Files" }, { id: "leftovers", label: "Leftovers" }, { id: "costs", label: "Costs" }, { id: "roles", label: "Roles" }, { id: "voice", label: "Voice" }, { id: "accounts", label: "Accounts" }];

export function Sidebar({ projects, project, onProject, onAddProject, place, onPlace, attention, leftBehind, plan, accountLabel, limitLine, version }: {
  projects: Project[]; project: Project | null; onProject: (id: string) => void; onAddProject: () => void;
  place: Place; onPlace: (p: Place) => void; attention: number; leftBehind: number; plan: Plan | undefined; accountLabel: string | null; limitLine: string; version: string;
}) {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-5 bg-surface-1 px-3.5 pt-7 pb-[22px]">
      <div className="flex items-center gap-2.5 px-1.5">
        <Glyph state="live" size={24} color="var(--color-accent)" />
        <span className="text-[22px] leading-[30px] font-bold">Kona</span>
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col gap-2">
          <Select ariaLabel="Project" bold value={project?.id ?? ""} onChange={onProject} options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.folder }))}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-text-secondary"><path d="M2 5 L2 12.5 L14 12.5 L14 6 L7.5 6 L6.5 4 L2 4 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>} />
          <button onClick={onAddProject} className="self-start rounded-lg px-1.5 text-[13px] leading-5 font-bold text-text-secondary hover:text-text">Add another project</button>
        </div>
      )}

      {project && (
        <nav className="flex flex-col gap-0.5" aria-label="Places">
          {PLACES.map((p) => {
            const on = place === p.id;
            return (
              <button key={p.id} onClick={() => onPlace(p.id)} aria-current={on ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-control px-3 text-left transition-colors ${on ? "bg-surface-3 font-bold text-text" : "text-text-secondary hover:bg-surface-2"}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={on ? "text-accent" : ""} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">{ICONS[p.id]}</svg>
                <span className="flex-1">{p.label}</span>
                {p.id === "leftovers" && leftBehind > 0 && (
                  <span className="rounded-[10px] px-[7px] font-mono text-[12px]" style={{ color: "var(--color-state-left)", background: "color-mix(in srgb, var(--color-state-left) 16%, transparent)" }} aria-label={`${leftBehind} left behind`}>{leftBehind}</span>
                )}
                {p.id === "sessions" && attention > 0 && (
                  <span className="rounded-[10px] px-[7px] font-mono text-[12px]" style={{ color: "var(--color-state-waiting)", background: "color-mix(in srgb, var(--color-state-waiting) 16%, transparent)" }} aria-label={`${attention} waiting on you`}>{attention}</span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      <div className="flex-1" />
      <div className="flex flex-col gap-4 px-1.5">
        {accountLabel && <span className="text-[13px] leading-5 font-bold text-text-secondary">Account: {accountLabel}</span>}
        <PlanBar label="This session" window={plan?.fiveHour} readAt={plan?.at} warnLine={limitLine} />
        <PlanBar label="This week" window={plan?.sevenDay} readAt={plan?.at} warnLine={limitLine} />
        <span className="font-mono text-[12px] text-text-disabled">Kona {version}</span>
      </div>
    </aside>
  );
}
