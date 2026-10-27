// The second column of the Sessions place: this project's sessions, and the New button.
import { Button, Glyph, RoleMark, type GlyphState } from "./ui";
import { baseName, samePlace, type Project, type Role } from "../lib/api";
import { dollars, type Session, type State } from "../lib/sessions";

const RUN: Record<Session["run"], { state: GlyphState; word: string }> = {
  starting: { state: "idle", word: "Starting" }, ready: { state: "idle", word: "Ready" }, working: { state: "live", word: "Working" },
  waiting: { state: "waiting", word: "Waiting on you" }, ended: { state: "stopped", word: "Ended" },
};

export function SessionList({ state, project, roles, leftBehind, onSelect, onNew, creating }: { state: State; project: Project; roles: Role[]; leftBehind: Record<string, number>; onSelect: (id: string) => void; onNew: () => void; creating: boolean }) {
  const mine = state.order.filter((id) => samePlace(state.sessions[id].folder, project.folder));
  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col gap-3.5 bg-ground px-2.5 pt-6 pb-5">
      <div className="flex items-center justify-between px-2.5">
        <h2 className="m-0 text-[17px] leading-6 font-bold">Sessions</h2>
        <Button variant="quiet" small onClick={onNew}>New</Button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Sessions">
        {mine.length === 0 && <p className="m-0 px-2.5 text-[13px] leading-5 text-text-tertiary">No sessions in {project.name} yet. Press New.</p>}
        {mine.map((id) => {
          const s = state.sessions[id];
          const r = RUN[s.run];
          const role = roles.find((x) => x.id === s.roleId);
          const on = state.selected === id && !creating;
          return (
            <button key={id} onClick={() => onSelect(id)} aria-current={on ? "true" : undefined}
              className={`flex h-16 items-center gap-3 rounded-xl px-3.5 text-left transition-colors ${on ? "bg-surface-3" : "hover:bg-surface-2"}`}>
              <Glyph state={r.state} size={18} />
              {role && <RoleMark mark={role.mark} size={26} />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{s.title || baseName(s.folder)}</span>
                <span className="truncate text-[13px] leading-5 text-text-tertiary">{r.word} · {role ? role.name : s.model}{leftBehind[id] > 0 && <span className="ml-2 font-bold text-state-left">{leftBehind[id]} left behind</span>}</span>
              </span>
              <span className="font-mono text-[13px] text-text-tertiary">{dollars(s.costTotal)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
