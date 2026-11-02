// The Tools tab of a person's sheet (decision 65): the programs on this PC that this person needs for this project (Git, Node.js, Docker ...), whether each is there, which ones to hide or add
// for this project, and the list of all the tools Kona knows, with a way to add your own. Kona only looks; it never installs anything.
import { useState } from "react";
import type { Project, Role, RoleKit } from "../lib/api";
import { Help } from "./Help";
import { Needs } from "./Needs";
import { ToolsLibrary } from "./ToolsLibrary";

export function ToolsTab({ role, project, kit, onKit }: { role: Role; project: Project; kit: RoleKit; onKit: (kit: RoleKit) => void }) {
  const [version, setVersion] = useState(0); // goes up when the list of all tools changes, so the list above looks again
  const who = role.person || role.name;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
      <Needs project={project} role={role} kit={kit} onKit={onKit} editable refresh={version} help={<Help title={`Tools ${who} needs`}>
          <p className="m-0">A tool is a program on this PC, like Git or Node.js. Kona checks that each one is installed, so {who} does not get stuck halfway. The list starts from what {who}'s job needs and what the files of {project.name} say. Hide what this project does not use, and add what it does.</p>
          <p className="m-0">This list is only for {who} in {project.name}. Tools you add or hide here do not change any other person or project.</p>
          <p className="m-0">Kona never installs anything by itself. You can start anyway; Claude will say if it needs a missing tool.</p>
        </Help>} />
      <ToolsLibrary onChanged={() => setVersion((n) => n + 1)} />
    </div>
  );
}
