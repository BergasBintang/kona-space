// The second column of the Sessions place: this project's sessions, and the New button.
import { Button, Glyph, RoleMark, type GlyphState } from "./ui";
import { baseName, samePlace, type Earlier, type Project, type Role } from "../lib/api";
import { useState } from "react";
import { dollars, type Session, type State } from "../lib/sessions";

const RUN: Record<Session["run"], { state: GlyphState; word: string }> = {
  starting: { state: "idle", word: "Starting" }, ready: { state: "idle", word: "Ready" }, working: { state: "live", word: "Working" },
  waiting: { state: "waiting", word: "Waiting on you" }, ended: { state: "stopped", word: "Ended" },
};

export function SessionList({ state, project, roles, leftBehind, earlier, onResume, onSelect, onNew, creating }: { state: State; project: Project; roles: Role[]; leftBehind: Record<string, number>; earlier: Earlier[]; onResume: (e: Earlier) => void; onSelect: (id: string) => void; onNew: () => void; creating: boolean }) {
  const [showEarlier, setShowEarlier] = useState(false);
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
              className={`flex h-16 items-center gap-3 px-3.5 text-left transition-colors ${on ? "bg-surface-3" : "hover:bg-surface-2"}`}>
              <Glyph state={r.state} size={18} />
              {role && <RoleMark roleId={role.id} size={26} />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{s.title || baseName(s.folder)}</span>
                <span className="truncate text-[13px] leading-5 text-text-tertiary">{r.word} · {role ? role.name : s.model}{leftBehind[id] > 0 && <span className="ml-2 font-bold text-state-left">{leftBehind[id]} left behind</span>}</span>
              </span>
              <span className="font-mono text-[13px] text-text-tertiary">{dollars(s.costTotal)}</span>
            </button>
          );
        })}
        {earlier.length > 0 && (
          <div className="mt-3 flex flex-col gap-0.5 border-t border-line-subtle pt-3">
            <button type="button" onClick={() => setShowEarlier((v) => !v)} aria-expanded={showEarlier} className="flex items-center justify-between px-3.5 py-2 text-left text-[14px] leading-5 font-bold text-text-secondary hover:text-text">
              <span>Earlier sessions</span><span className="font-mono text-[12px] font-normal text-text-tertiary">{earlier.length}</span>
            </button>
            {showEarlier && earlier.map((e) => (
              <div key={e.id} data-earlier={e.id} className="flex items-center gap-3 px-3.5 py-2 hover:bg-surface-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] leading-5">{e.title || "(no first message)"}</span>
                  <span className="text-[12px] leading-5 text-text-tertiary">{new Date(e.modified).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </span>
                <Button variant="quiet" small onClick={() => onResume(e)}>Resume</Button>
              </div>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}
