// The MCP section of a project's Access page (decision 102). An MCP tool is a small program (or a web address) that gives a person new abilities, like shadcn's component search.
// Kona keeps one list for all projects: whatever one project (or the account) has shows here in every project, OFF. A project uses a tool only after you switch it on here, and then
// only the people you tick can use it. Switching it off keeps the ticks. There is no Add button: a person adds a tool the way Claude Code does (claude mcp add, or the project's
// .mcp.json) and it appears. Each card says how the tool went in the open conversations (connected, could not start, not in that conversation yet).
import { useCallback, useEffect, useState } from "react";
import { mcpCatalog, mcpRemove, mcpSetOn, mcpSetRoles, type McpRow, type Project, type Role, type RoleKit } from "../lib/api";
import { mcpLines, type McpLine, type McpSession } from "../lib/mcpstatus";
import { Button, Glyph, RoleMark, type GlyphState } from "./ui";
import { Confirm } from "./Confirm";
import { Help } from "./Help";

const LINE: Record<McpLine["state"], { glyph: GlyphState; text: (who: string) => string; bad?: boolean }> = {
  connected: { glyph: "done", text: (w) => `${w}: connected` },
  failed: { glyph: "left", text: (w) => `${w}: could not start it`, bad: true },
  starting: { glyph: "waiting", text: (w) => `${w}: still starting when the conversation began` },
  waiting: { glyph: "idle", text: (w) => `${w}: checked when the first message is sent` },
  older: { glyph: "waiting", text: (w) => `${w}: the open conversation began before this, a new one will have it` },
  still: { glyph: "waiting", text: (w) => `${w}: the open conversation keeps it until a new one starts` },
};

const label = "text-[13px] leading-5 font-bold text-text-secondary";

export function Mcp({ project, roles, accountId, sessions, onKits }: { project: Project; roles: Role[]; accountId: string | null; sessions: McpSession[]; onKits: (kits: Record<string, RoleKit>) => void }) {
  const [rows, setRows] = useState<McpRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // the tool being changed
  const [drop, setDrop] = useState<McpRow | null>(null);
  const [ask, setAsk] = useState<McpRow | null>(null); // a tool this project does not have itself, about to be switched on: the owner confirms it is on purpose

  const load = useCallback(() => { mcpCatalog(accountId, project.folder).then(setRows).catch((e) => { setRows([]); setError(String(e)); }); }, [accountId, project.folder]);
  useEffect(() => { setRows(null); setError(null); load(); }, [load]);

  const who = (id: string) => { const r = roles.find((x) => x.id === id); return r ? r.person || r.name : "A removed person"; };
  /** run one change; afterwards the row shows what was saved */
  const change = async (r: McpRow, run: () => Promise<Partial<McpRow>>) => {
    setBusy(r.name); setError(null);
    try { const next = await run(); setRows((cur) => cur && cur.map((x) => (x.name === r.name ? { ...x, ...next } : x))); }
    catch (e) { setError(String(e)); }
    finally { setBusy(null); }
  };
  const setOn = (r: McpRow, on: boolean) => on === r.on ? undefined : change(r, async () => { await mcpSetOn(project.folder, r.name, on); return { on }; });
  const toggle = (r: McpRow, id: string) => change(r, async () => {
    const roleIds = r.roles.includes(id) ? r.roles.filter((x) => x !== id) : [...r.roles, id];
    onKits(await mcpSetRoles(project.folder, r.name, roleIds));
    return { roles: roleIds };
  });
  const remove = async (r: McpRow) => {
    try { await mcpRemove(accountId, project.folder, r.name); setDrop(null); setRows((cur) => cur && cur.filter((x) => x.name !== r.name)); }
    catch (e) { setError(String(e)); setDrop(null); }
  };

  const card = (r: McpRow) => {
    const lines = r.on || sessions.length ? mcpLines(r.name, r.on, r.roles, sessions) : [];
    return (
      <section key={r.name} aria-label={r.name} className="px-card flex flex-col gap-3 p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="m-0 truncate text-[18px] leading-7 font-bold">{r.name}</h3>
            <span className="truncate font-mono text-[14px] leading-5 text-text-secondary">{r.kind}{r.detail && ` · ${r.detail}`}</span>
            <span className="text-[13px] leading-5 text-text-secondary">{r.source}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div role="group" aria-label={`${r.name} in ${project.name}`} className="flex gap-2">
              <Button variant="quiet" small on={!r.on} aria-pressed={!r.on} disabled={busy === r.name} onClick={() => void setOn(r, false)}>Not used here</Button>
              <Button variant="quiet" small on={r.on} aria-pressed={r.on} disabled={busy === r.name} onClick={() => r.here ? void setOn(r, true) : setAsk(r)}>Used here</Button>
            </div>
            {!r.here && <Button variant="ghost" small onClick={() => setDrop(r)}>Remove…</Button>}
          </div>
        </div>
        {r.on && (
          <div className="flex flex-col gap-2">
            <span className={label}>People who may use it</span>
            <div role="group" aria-label={`People who may use ${r.name}`} className="flex flex-wrap gap-2">
              {roles.map((p) => {
                const chosen = r.roles.includes(p.id);
                return <Button key={p.id} variant="quiet" small on={chosen} aria-pressed={chosen} disabled={busy === r.name} onClick={() => void toggle(r, p.id)}><RoleMark roleId={p.id} size={20} />{p.person || p.name}</Button>;
              })}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          {r.on && !r.here && <span className="flex items-center gap-2 text-[13px] leading-5 font-bold text-state-waiting"><Glyph state="waiting" size={14} />{project.name} does not have it itself: it runs from the copy Kona kept</span>}
          {r.on && r.roles.length === 0 && <span className="flex items-center gap-2 text-[13px] leading-5 font-bold text-state-waiting"><Glyph state="waiting" size={14} />No one can use it yet</span>}
          {r.on && r.roles.length > 0 && lines.length === 0 && <span className="flex items-center gap-2 text-[13px] leading-5 text-text-secondary"><Glyph state="idle" size={14} />No open conversation uses it yet</span>}
          {lines.map((l) => <span key={l.roleId} className={`flex items-center gap-2 text-[13px] leading-5 ${LINE[l.state].bad ? "font-bold text-state-left" : "text-text-secondary"}`}><Glyph state={LINE[l.state].glyph} size={14} />{LINE[l.state].text(who(l.roleId))}</span>)}
        </div>
      </section>
    );
  };

  return (
    <div role="group" aria-label="MCP tools" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 border-b-2 border-line-strong pb-3">
        <h2 className="m-0 flex items-baseline gap-3 text-[22px] leading-8 font-bold">MCP tools<span className="text-[15px] font-normal text-text-tertiary">{rows?.length ?? 0}</span>
          <Help title="MCP tools">
            <p className="m-0">An MCP tool is a small program that gives a person new abilities, for example shadcn's search for components. Kona lists every tool it has found in any project.</p>
            <p className="m-0">A tool does nothing in {project.name} until you switch it on here, and then only the people you tick can use it. Switching it off keeps your ticks.</p>
            <p className="m-0">A change reaches new conversations. One that is already open keeps what it started with. To add a tool, ask a person to run claude mcp add, or write it in the project's .mcp.json file.</p>
          </Help>
        </h2>
      </div>
      {rows === null && <p className="m-0 text-[14px] leading-5 text-text-tertiary">Looking…</p>}
      {rows?.length === 0 && !error && <p className="m-0 text-[14px] leading-5 text-text-secondary">None found yet.</p>}
      {error && <p role="alert" className="m-0 text-[14px] leading-5 font-bold text-state-left">{error}</p>}
      {rows?.map(card)}
      {ask && (
        <Confirm title={`Use ${ask.name} in ${project.name}?`} confirmLabel="Use it here" onConfirm={() => { const r = ask; setAsk(null); void setOn(r, true); }} onCancel={() => setAsk(null)}>
          <p className="m-0">{project.name} does not have “{ask.name}” itself. {ask.source}, and Kona kept a copy of how to start it. If you switch it on, {project.name} runs that copy.</p>
          <p className="m-0">It brings tools of its own that this project never chose. Switch it on only if you meant to.</p>
        </Confirm>
      )}
      {drop && (
        <Confirm title="Remove this tool from the list?" confirmLabel="Remove it" danger onConfirm={() => void remove(drop)} onCancel={() => setDrop(null)}>
          <p className="m-0">“{drop.name}” is taken off Kona's list, in every project. Nothing is uninstalled. If a project or your Claude settings still have it, it comes back the next time that project looks.</p>
        </Confirm>
      )}
    </div>
  );
}
