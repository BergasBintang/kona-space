// The Roles place: the team. The roles are fixed (decision 43): each is a cat with a name, a model, a permission mode and a short brief.
// Nothing here can be changed; the list comes with Kona. In the office the same roles sit at their desks.
import { useMemo } from "react";
import type { Role, ToolInfo } from "../lib/api";
import { RoleMark } from "./ui";
import { Help } from "./Help";
import { modeWord } from "../lib/sessions";

const GROUPS = ["Plan", "Build", "Ship", "Grow", "Office"];
const MODEL_WORD: Record<string, string> = { sonnet: "Sonnet", opus: "Opus", haiku: "Haiku" };

export function Roles({ roles, tools }: { roles: Role[]; tools: ToolInfo[] }) {
  const groups = useMemo(() => GROUPS.map((g) => ({ name: g, roles: roles.filter((r) => r.group === g) })).filter((g) => g.roles.length > 0), [roles]);
  const toolName = (id: string) => tools.find((t) => t.id === id)?.name ?? id;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="m-0 text-[30px] leading-[38px] font-bold">Roles</h1>
          <Help title="Roles"><p className="m-0">Each role is a cat with a job. Start a session as a role and Claude is told what that job is. The roles come with Kona and cannot be changed. All of them use the account of the project.</p></Help>
        </div>
        {groups.map((g) => (
          <section key={g.name} className="flex flex-col gap-3" aria-label={g.name}>
            <h2 className="m-0 text-[18px] leading-6 font-bold">{g.name}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {g.roles.map((r) => (
                <article key={r.id} className="px-card flex flex-col gap-3 p-3">
                  <div className="flex items-center gap-3">
                    <RoleMark roleId={r.id} size={32} />
                    <div className="flex min-w-0 flex-col">
                      <h3 className="m-0 truncate text-[17px] leading-6 font-bold">{r.name}</h3>
                      <span className="text-[13px] leading-5 text-text-secondary">{MODEL_WORD[r.model] ?? r.model} · {modeWord(r.mode)}</span>
                    </div>
                  </div>
                  <p className="m-0 text-[14px] leading-5 text-text-secondary">{r.brief}</p>
                  {r.needs.length > 0 && <span className="text-[13px] leading-5 text-text-tertiary">Needs: {r.needs.map(toolName).join(", ")}</span>}
                  {r.own_copy && <span className="text-[13px] leading-5 text-text-tertiary">Tickets run in their own copy of the project.</span>}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
