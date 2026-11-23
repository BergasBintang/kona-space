// The Connections page with its two views (decision 80): Access (servers, GitHub repos and, from decision 102, MCP tools) and Terminal. The two buttons are in the
// sheet's header, like the other pages with views. The terminal stays mounted once opened, so switching views does not lose the screen.
import { useEffect, useState } from "react";
import type { Project, Role, RoleKit } from "../lib/api";
import type { McpSession } from "../lib/mcpstatus";
import { Mcp } from "./Mcp";
import { Servers } from "./Servers";
import { Terminal } from "./Terminal";

export type ServersTab = "connections" | "terminal";
export const SERVERS_TABS: { id: ServersTab; label: string }[] = [{ id: "connections", label: "Access" }, { id: "terminal", label: "Terminal" }];

export function ServersPage({ project, roles, tab, accountId, sessions, onKits, onOpenFile }: { project: Project; roles: Role[]; tab: ServersTab; accountId: string | null; sessions: McpSession[]; onKits: (kits: Record<string, RoleKit>) => void; onOpenFile: (absolutePath: string) => void }) {
  const [opened, setOpened] = useState(false); // the Terminal view is made the first time it is opened (it still starts no shell until Start is pressed)
  useEffect(() => { if (tab === "terminal") setOpened(true); }, [tab]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={tab === "connections" ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}><Servers project={project} roles={roles} extra={<Mcp project={project} roles={roles} accountId={accountId} sessions={sessions} onKits={onKits} />} /></div>
      {opened && <div className={tab === "terminal" ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}><Terminal project={project} visible={tab === "terminal"} onOpenFile={onOpenFile} /></div>}
    </div>
  );
}
