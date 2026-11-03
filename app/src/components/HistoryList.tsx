// The History tab of a person's sheet: their earlier conversations in this project, newest first. Resume opens one again in the Chat tab, when the person is free.
import { IconButton } from "./Icon";
import { Help } from "./Help";
import { roleLabel, type Earlier, type Role } from "../lib/api";

export function HistoryList({ role, items, onResume, busy }: { role: Role; items: Earlier[]; onResume: (e: Earlier) => void; busy: boolean }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-8 py-6">
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-[18px] leading-6 font-bold">Earlier conversations with {role.person || roleLabel(role)}</h2>
        <Help title="Earlier conversations"><p className="m-0">Resume opens one again in the Chat tab, with everything said so far. While {role.person || "this person"} has a conversation open, end it or start a new one first.</p></Help>
      </div>
      {busy && <p className="m-0 text-[14px] leading-5 text-text-secondary">{role.person || "They"} has a conversation open, so an old one cannot be resumed yet.</p>}
      {items.length === 0 && <p className="m-0 text-[15px] leading-6 text-text-tertiary">No earlier conversations yet.</p>}
      <div className="flex flex-col">
        {items.map((e) => (
          <div key={e.id} data-earlier={e.id} className="flex items-center gap-4 border-b border-line-subtle px-2 py-3 hover:bg-surface-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] leading-6">{e.title || "(no first message)"}</span>
              <span className="text-[13px] leading-5 text-text-tertiary">{new Date(e.modified).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </span>
            <IconButton icon="play" label="Resume" variant="primary" disabled={busy} title={busy ? "End the open conversation first" : "Resume this conversation"} onClick={() => onResume(e)} />
          </div>
        ))}
      </div>
    </div>
  );
}
