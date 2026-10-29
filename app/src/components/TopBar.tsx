// The top bar, always in view: the Kona mark (back to the welcome page), the project, a way back to the office and a list of every room,
// what is waiting on you, the account of the project and the two plan bars. It replaces the sidebar (decision 44).
import { Button, Glyph, PlanBar } from "./ui";
import { KonaMark } from "./KonaMark";
import { Select } from "./pick";
import { PLACES, type Place } from "../lib/places";
import type { Project } from "../lib/api";
import type { Plan } from "../lib/sessions";

export function TopBar({ projects, project, onProject, onHome, place, onPlace, attention, leftBehind, plan, accountLabel, limitLine, version }: {
  projects: Project[]; project: Project | null; onProject: (id: string) => void; onHome: () => void; place: Place; onPlace: (p: Place) => void;
  attention: number; leftBehind: number; plan: Plan | undefined; accountLabel: string | null; limitLine: string; version: string;
}) {
  return (
    <header className="flex min-h-[72px] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-line-strong bg-surface-1 px-5 py-2">
      <button type="button" onClick={onHome} title="Back to the welcome page" aria-label="Kona, back to the welcome page" className="flex items-center gap-2.5 py-1 hover:opacity-80">
        <KonaMark size={32} />
        <span className="text-[22px] leading-[30px] font-bold">Kona</span>
      </button>

      {!project && place !== "office" && <Button variant="quiet" small onClick={() => onPlace("office")}>← Back</Button>}
      {project && (
        <>
          <div className="w-[200px]"><Select ariaLabel="Project" bold value={project.id} onChange={onProject} options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.folder }))} /></div>
          <div className="w-[170px]"><Select ariaLabel="Go to" value={place} onChange={(v) => onPlace(v as Place)} search={false} options={PLACES.map((p) => ({ value: p.id, label: p.label, hint: p.room }))} /></div>
          {place !== "office" && <Button variant="quiet" small onClick={() => onPlace("office")}>← Office</Button>}
        </>
      )}

      <div className="flex-1" />

      {attention > 0 && (
        <Button variant="quiet" small onClick={() => onPlace("sessions")} aria-label={`${attention} waiting on you`}><Glyph state="waiting" size={16} />{attention} waiting on you</Button>
      )}
      {leftBehind > 0 && (
        <Button variant="quiet" small onClick={() => onPlace("leftovers")} aria-label={`${leftBehind} left behind`}><Glyph state="left" size={16} />{leftBehind} left behind</Button>
      )}
      {project && (
        <div className="flex items-center gap-4">
          {accountLabel && <span className="font-pixel text-[14px] leading-5 font-bold text-text-secondary">{accountLabel}</span>}
          <PlanBar compact label="Session" window={plan?.fiveHour} readAt={plan?.at} warnLine={limitLine} />
          <PlanBar compact label="Week" window={plan?.sevenDay} readAt={plan?.at} warnLine={limitLine} />
        </div>
      )}
      <span className="font-mono text-[12px] text-text-tertiary">{version ? `v${version}` : ""}</span>
    </header>
  );
}
