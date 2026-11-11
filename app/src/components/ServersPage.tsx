// The Connections page with its two views (decision 80): Access (servers and GitHub repos) and Terminal. The two buttons are in the
// sheet's header, like the other pages with views. The terminal stays mounted once opened, so switching views does not lose the screen.
import { useEffect, useState } from "react";
import type { Project, Role } from "../lib/api";
import { Servers } from "./Servers";
import { Terminal } from "./Terminal";

export type ServersTab = "connections" | "terminal";
export const SERVERS_TABS: { id: ServersTab; label: string }[] = [{ id: "connections", label: "Access" }, { id: "terminal", label: "Terminal" }];

export function ServersPage({ project, roles, tab }: { project: Project; roles: Role[]; tab: ServersTab }) {
  const [opened, setOpened] = useState(false); // the shell starts the first time the Terminal view is opened, not before
  useEffect(() => { if (tab === "terminal") setOpened(true); }, [tab]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={tab === "connections" ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}><Servers project={project} roles={roles} /></div>
      {opened && <div className={tab === "terminal" ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}><Terminal project={project} visible={tab === "terminal"} /></div>}
    </div>
  );
}
