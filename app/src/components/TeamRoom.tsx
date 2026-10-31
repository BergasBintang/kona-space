// What a room with cats at desks shows in the sheet: each cat (what it is doing in this project, Set up, and a session to open or start), then the other pages the room leads to.
import { Button, Glyph, RoleMark } from "./ui";
import { DESKS, MORE } from "../lib/rooms";
import type { Role } from "../lib/api";
import type { Look } from "../lib/office";
import type { Place } from "../lib/places";

export function TeamRoom({ room, roles, looks, onSetup, onStartRole, onOpenSession, onOpen }: {
  room: string; roles: Role[]; looks: Record<string, Look>; onSetup: (roleId: string) => void; onStartRole: (roleId: string) => void; onOpenSession: (id: string) => void; onOpen: (p: Place) => void;
}) {
  const more = MORE[room] ?? [];
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <ul className="m-0 flex max-w-[760px] list-none flex-col gap-3 p-0">
        {(DESKS[room] ?? []).map((id) => {
          const look = looks[id];
          return (
            <li key={id} className="flex items-center gap-3 border border-line-subtle bg-surface-2 px-4 py-3">
              <RoleMark roleId={id} size={32} />
              <span className="font-pixel min-w-[150px] text-[16px] leading-6 font-bold">{roles.find((r) => r.id === id)?.name ?? id}</span>
              <span className="flex flex-1 items-center gap-1.5 text-[14px] leading-5 text-text-secondary">{look?.glyph && <Glyph state={look.glyph} size={16} />}{look?.word ?? "At the desk"}</span>
              <Button small variant="ghost" onClick={() => onSetup(id)} aria-label={`Set up ${roles.find((r) => r.id === id)?.name ?? id}`}>Set up</Button>
              {look?.sessionId
                ? <Button small variant="primary" onClick={() => onOpenSession(look.sessionId!)}>Open</Button>
                : <Button small variant="quiet" onClick={() => onStartRole(id)}>Start a session</Button>}
            </li>
          );
        })}
      </ul>
      {more.length > 0 && <div className="flex flex-wrap gap-2">{more.map((o) => <Button key={o.label} variant="quiet" small onClick={() => onOpen(o.place)}>{o.label}</Button>)}</div>}
    </div>
  );
}
