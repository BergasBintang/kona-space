// The sidebar: the Kona mark, the project, the places that exist so far, the two plan bars.
import { Glyph, PlanBar } from "./ui";
import type { Project } from "../lib/api";
import type { PlanWindow } from "../lib/sessions";

export type Place = "sessions" | "files" | "roles";

const ICONS: Record<Place, React.ReactNode> = {
  sessions: <path d="M2.5 3.5 L13.5 3.5 L13.5 10.5 L7 10.5 L4 13 L4 10.5 L2.5 10.5 Z" />,
  files: <path d="M2 5 L2 12.5 L14 12.5 L14 6 L7.5 6 L6.5 4 L2 4 Z" />,
  roles: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13 C3 10.2 5 9 8 9 C11 9 13 10.2 13 13 Z" /></>,
};
const PLACES: { id: Place; label: string }[] = [{ id: "sessions", label: "Sessions" }, { id: "files", label: "Files" }, { id: "roles", label: "Roles" }];

export function Sidebar({ projects, project, onProject, onAddProject, place, onPlace, attention, plan, version }: {
  projects: Project[]; project: Project | null; onProject: (id: string) => void; onAddProject: () => void;
  place: Place; onPlace: (p: Place) => void; attention: number; plan: { fiveHour?: PlanWindow; sevenDay?: PlanWindow }; version: string;
}) {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-5 bg-surface-1 px-3.5 pt-7 pb-[22px]">
      <div className="flex items-center gap-2.5 px-1.5">
        <Glyph state="live" size={24} color="var(--color-accent)" />
        <span className="text-[22px] leading-[30px] font-bold">Kona</span>
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="relative flex h-11 items-center rounded-control border border-line-strong">
            <span className="sr-only">Project</span>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute left-3 text-text-secondary"><path d="M2 5 L2 12.5 L14 12.5 L14 6 L7.5 6 L6.5 4 L2 4 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            <select value={project?.id ?? ""} onChange={(e) => onProject(e.target.value)} className="h-full w-full appearance-none rounded-control bg-transparent pr-9 pl-9 text-[15px] font-bold text-text">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute right-3 text-text-secondary"><path d="M4 6 L8 10 L12 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </label>
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
        <PlanBar label="This session" window={plan.fiveHour} />
        <PlanBar label="This week" window={plan.sevenDay} />
        <span className="font-mono text-[12px] text-text-disabled">Kona {version}</span>
      </div>
    </aside>
  );
}
