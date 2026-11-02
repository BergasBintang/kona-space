// A person's sheet (decision 62): what opens when you click a person in the office. Five tabs: Chat (it opens here), History, Skills, Tools and Set up. The chat and the setup both stay mounted while
// you change tab, so a message you were typing and a setup you were editing are not lost. With no conversation yet there is no session: the first message starts it (App.tsx).
import { Chat, EmptyChat, type Attached } from "./Chat";
import { RoleSetup } from "./RoleSetup";
import { SkillsTab } from "./SkillsTab";
import { ToolsTab } from "./ToolsTab";
import { HistoryList } from "./HistoryList";
import type { Earlier, Project, Role, RoleKit } from "../lib/api";
import type { Session } from "../lib/sessions";

export type PersonTab = "chat" | "history" | "skills" | "tools" | "setup";
export const PERSON_TABS: { id: PersonTab; label: string }[] = [{ id: "chat", label: "Chat" }, { id: "history", label: "History" }, { id: "skills", label: "Skills" }, { id: "tools", label: "Tools" }, { id: "setup", label: "Set up" }];

export function PersonSheet({ tab, role, project, session, history, accountId, kit, error, dispatch, onTab, onFirst, onResume, onNew, onNote, onSaveAnswer, onSaved, onKitSaved }: {
  tab: PersonTab; role: Role; project: Project; session: Session | null; history: Earlier[]; accountId: string | null; kit: RoleKit; error: string | null; dispatch: (a: unknown) => void; onTab: (t: PersonTab) => void;
  onFirst: (text: string, images: Attached[]) => void; onResume: (e: Earlier) => void; onNew: () => void; onNote: () => void; onSaveAnswer: (text: string) => void;
  onSaved: (r: Role) => void; onKitSaved: (roleId: string, kit: RoleKit) => void;
}) {
  return (
    <>
      <div className={tab === "chat" ? "flex min-h-0 min-w-0 flex-1" : "hidden"}>
        {session
          ? <Chat key={session.id} s={session} role={role} dispatch={dispatch} onNote={onNote} onSaveAnswer={onSaveAnswer} onNew={onNew} />
          : <EmptyChat role={role} project={project} kit={kit} onTools={() => onTab("tools")} onFirst={onFirst} error={error} />}
      </div>
      <div className={tab === "history" ? "flex min-h-0 min-w-0 flex-1" : "hidden"}>
        <HistoryList role={role} items={history} onResume={onResume} busy={!!session && session.run !== "ended"} />
      </div>
      {tab === "skills" && <SkillsTab key={`${project.id}-${role.id}`} role={role} project={project} accountId={accountId} kit={kit} onKitSaved={onKitSaved} />}
      {tab === "tools" && <ToolsTab key={`${project.id}-${role.id}`} role={role} project={project} kit={kit} onKit={(k) => onKitSaved(role.id, k)} />}
      <div className={tab === "setup" ? "flex min-h-0 min-w-0 flex-1" : "hidden"}>
        <RoleSetup key={role.id} role={role} onSaved={onSaved} />
      </div>
    </>
  );
}
