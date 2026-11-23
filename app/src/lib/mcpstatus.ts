// What the open conversations of a project say about one MCP tool (decision 102). Claude Code lists the tools it started when the first message is sent (the `init` record):
// each with a status. Kona keeps that list on the session (`Session.mcp`); this turns it into the plain lines the card of the tool shows. Pure, so it is tested without a window.

export type McpLoaded = { name: string; status: string };
/** The parts of a session this needs. */
export type McpSession = { id: string; roleId: string | null; run: string; mcp?: McpLoaded[] };

export type McpLine = {
  roleId: string;
  /** connected: it works in that conversation. failed: Claude Code could not start it (or it needs a sign-in). starting: still starting when the conversation began.
   *  waiting: no message has been sent yet, so nothing is known. older: that conversation began before the tool was given, so it does not have it.
   *  still: the tool was taken away but that conversation still has it until a new one starts. */
  state: "connected" | "failed" | "starting" | "waiting" | "older" | "still";
};

/** One line for each open conversation of a person that has to do with this tool. `allowed` is the people ticked for it, `on` whether the project uses it. */
export function mcpLines(name: string, on: boolean, allowed: string[], sessions: McpSession[]): McpLine[] {
  const out: McpLine[] = [];
  const seen = new Set<string>(); // one line for a person: the newest conversation of theirs that is open
  for (const s of [...sessions].reverse()) {
    if (!s.roleId || s.run === "ended" || seen.has(s.roleId)) continue;
    seen.add(s.roleId);
    const has = s.mcp?.find((m) => m.name === name);
    const wanted = on && allowed.includes(s.roleId);
    if (wanted) {
      if (!s.mcp) out.push({ roleId: s.roleId, state: "waiting" });
      else if (!has) out.push({ roleId: s.roleId, state: "older" });
      else out.push({ roleId: s.roleId, state: has.status === "connected" ? "connected" : has.status === "pending" ? "starting" : "failed" });
    } else if (has && has.status === "connected") out.push({ roleId: s.roleId, state: "still" });
  }
  return out.reverse();
}
