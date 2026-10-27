import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { initialState, loadPlans, reducer, savePlans } from "./lib/sessions";
import { PLAIN_LINES, leftoverOverview, listAccounts, listProjects, accountStatus, getPersona, listRoles, listTools, samePlace, type Account, type AddResult, type Project, type Persona, type LeftoverOverview, type Role, type TicketView, type ToolInfo } from "./lib/api";
import { Sidebar, type Place } from "./components/Sidebar";
import { SessionList } from "./components/SessionList";
import { Welcome } from "./components/Welcome";
import { AddProject } from "./components/AddProject";
import { Chat } from "./components/Chat";
import { Files } from "./components/Files";
import { Roles } from "./components/Roles";
import { Accounts } from "./components/Accounts";
import { Kit } from "./components/Kit";
import { Costs } from "./components/Costs";
import { Voice } from "./components/Voice";
import { Board } from "./components/Board";
import { Worktrees } from "./components/Worktrees";
import { Leftovers } from "./components/Leftovers";
import { BrainPlace } from "./components/brain/Brain";
import { Servers } from "./components/Servers";
import { Settings } from "./components/Settings";
import { Glyph } from "./components/ui";
import { autoNoteOn, buildDigest, writeSessionNote } from "./lib/brain/summary.ts";
import { localDate, redact } from "./lib/brain/text.ts";
import { earlierSessions, saveNote, wantedRemove, type Earlier } from "./lib/api";

const remembered = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const remember = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* the choice is just not kept */ } };

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initialState, plans: loadPlans() }));
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(remembered("kona.project"));
  const [roles, setRoles] = useState<Role[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [lo, setLo] = useState<LeftoverOverview>({ items: [], sessions: [] }); // what sessions started and left behind
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lastAccount, setLastAccount] = useState(remembered("kona.account") ?? "main"); // the account used last
  const [place, setPlace] = useState<Place>("sessions");
  const [adding, setAdding] = useState(false); // the Add a project screen
  const [creating, setCreating] = useState(false); // the Start a session screen
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  // the latest of these, for the listener below (it is set up once, so it cannot read them from the render)
  const live = useRef({ state, projects, roles });
  live.current = { state, projects, roles };
  const noting = useRef(new Set<string>());
  const [earlier, setEarlier] = useState<Earlier[]>([]); // sessions Claude Code saved earlier, for Resume

  // a notice goes away by itself after a few seconds
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 9000); return () => clearTimeout(t); }, [notice]);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
    listProjects().then(setProjects).catch(() => setProjects([]));
    listRoles().then(setRoles).catch(() => setRoles([]));
    getPersona().then(setPersona).catch(() => setPersona(null));
    listTools().then(setTools).catch(() => setTools([]));
    listAccounts().then(setAccounts).catch(() => setAccounts([]));
    // every message from every running `claude`, forwarded by the Rust core
    const un = listen<{ sessionId: string; record: unknown }>("session-event", (e) => {
      dispatch({ type: "event", sessionId: e.payload.sessionId, record: e.payload.record });
      // a session that ends writes its own note into the brain (unless the owner turned that off)
      if ((e.payload.record as { type?: string })?.type === "kona/exited" && autoNoteOn()) void noteSession(e.payload.sessionId, false);
    });
    return () => { void un.then((f) => f()); };
  }, []);

  // Write a note about a session into the project's brain, with one cheap Haiku call (see lib/brain/summary.ts).
  const noteSession = async (id: string, manual: boolean) => {
    const { state: st, projects: ps, roles: rs } = live.current;
    const s = st.sessions[id];
    if (!s || s.turns < 1 || noting.current.has(id)) return;
    const p = ps?.find((x) => samePlace(x.folder, s.folder));
    if (!p) return;
    noting.current.add(id);
    try {
      const r = await writeSessionNote({ projectId: p.id, folder: p.folder, sessionId: id, workDir: s.workDir, accountId: s.accountId, roleId: s.roleId, roleName: rs.find((x) => x.id === s.roleId)?.name, ticketId: s.ticketId, sessionTitle: s.title });
      setNotice(r.existing ? `There is already a note about this session: “${r.title}”.` : `Wrote a note about the session: “${r.title}”. Find it in Brain.`);
    } catch (e) {
      if (manual) setNotice(`Could not write the note: ${String(e)}`);
    } finally { noting.current.delete(id); }
  };

  const project = useMemo(() => projects?.find((p) => p.id === projectId) ?? projects?.[0] ?? null, [projects, projectId]);
  const mine = useMemo(() => (project ? state.order.filter((id) => samePlace(state.sessions[id].folder, project.folder)) : []), [state, project]);
  const attention = useMemo(() => state.order.filter((id) => state.sessions[id].run === "waiting").length, [state]);
  const current = state.selected && mine.includes(state.selected) ? state.sessions[state.selected] : null;

  const pickProject = useCallback((id: string) => { setProjectId(id); remember("kona.project", id); setCreating(false); }, []);

  const added = (r: AddResult) => {
    setProjects((cur) => [...(cur ?? []), r.project]);
    pickProject(r.project.id);
    setAdding(false);
    setPlace("sessions");
    setNotice(r.hidden_folder ? `Added ${r.project.name}. A hidden folder for Kona's notes is inside it${r.git_ignored ? ", and Git ignores it" : ""}.` : `Added ${r.project.name}.`);
  };

  // what sessions left behind: looked at every 5 seconds, and only while there is a session to look at
  useEffect(() => {
    if (state.order.length === 0) return;
    let live = true;
    const look = () => leftoverOverview().then((o) => { if (live) setLo(o); }).catch(() => {});
    look();
    const t = setInterval(look, place === "leftovers" ? 2500 : 5000);
    return () => { live = false; clearInterval(t); };
  }, [state.order.length, place]);
  const leftBehind = useMemo(() => Object.fromEntries(lo.sessions.map((s) => [s.id, s.left_behind])) as Record<string, number>, [lo]);
  const leftTotal = lo.items.filter((i) => i.left_behind && !i.ignored).length;

  // the earlier sessions of this project (read from Claude Code's own transcript files)
  useEffect(() => {
    if (!project || place !== "sessions") return;
    let live = true;
    earlierSessions(project.id).then((l) => { if (live) setEarlier(l); }).catch(() => { if (live) setEarlier([]); });
    return () => { live = false; };
  }, [project?.id, place, state.order.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownEarlier = useMemo(() => earlier.filter((e) => !state.sessions[e.id]), [earlier, state.sessions]);

  // Resume an earlier session: the same session id, in the same folder, with no role (the old session's role is not recorded)
  const resume = async (e: Earlier) => {
    if (!project || !persona) return;
    setError(null);
    try {
      const status = await accountStatus(e.account_id);
      if (!status.logged_in) throw new Error("The account of that session is not signed in. Open Accounts to sign in.");
      await invoke<string>("start_session", { folder: project.folder, roleId: null, accountId: e.account_id, useVoice: persona.enabled, ticketId: null, brainDigest: null, model: "sonnet", mode: "default", resume: e.id });
      setCreating(false); setPlace("sessions");
    } catch (err) { setNotice(`Could not resume it: ${String(err)}`); }
  };

  // keep the plan readings for the next time Kona opens
  useEffect(() => { savePlans(state.plans); }, [state.plans]);

  const start = async (folder: string, roleId: string | null, accountId: string, useVoice: boolean, model: string, mode: string) => {
    setError(null);
    try {
      const brainDigest = await buildDigest(project?.id ?? "", { roleId, roleName: roles.find((r) => r.id === roleId)?.name });
      await invoke<string>("start_session", { folder, roleId, accountId, useVoice, ticketId: null, brainDigest, model, mode, resume: null }); setLastAccount(accountId); remember("kona.account", accountId); setCreating(false); }
    catch (e) { setError(String(e)); }
  };

  // Start a session from a ticket card: the role's model, mode and account, the voice as set, and the ticket told to Claude.
  const startTicket = async (t: TicketView) => {
    if (!project || !persona) return;
    const role = roles.find((r) => r.id === t.role);
    if (!role) throw new Error("Choose a role for this ticket first");
    const accountId = role.account && accounts.some((a) => a.id === role.account) ? role.account : accounts.some((a) => a.id === lastAccount) ? lastAccount : "main";
    const status = await accountStatus(accountId);
    if (!status.logged_in) throw new Error("That account is not signed in. Open Accounts to sign in.");
    const brainDigest = await buildDigest(project.id, { roleId: role.id, roleName: role.name, ticketId: t.id });
    const id = await invoke<string>("start_session", { folder: project.folder, roleId: role.id, accountId, useVoice: persona.enabled, ticketId: t.id, brainDigest, model: role.model, mode: role.mode, resume: null });
    setLastAccount(accountId); remember("kona.account", accountId);
    const text = `Start on ticket ${t.id}: ${t.title}.`;
    dispatch({ type: "user-sent", sessionId: id, text, images: [] });
    await invoke("send_message", { sessionId: id, text, images: [] });
    setCreating(false); setPlace("sessions");
  };

  // Ask Claude a question from the Brain: a new session in plan-only mode (it can read, not change), with the question sent at once.
  const askClaude = async (question: string) => {
    if (!project) return;
    const accountId = accounts.some((a) => a.id === lastAccount) ? lastAccount : "main";
    const status = await accountStatus(accountId);
    if (!status.logged_in) throw new Error("That account is not signed in. Open Accounts to sign in.");
    const brainDigest = await buildDigest(project.id, {});
    const id = await invoke<string>("start_session", { folder: project.folder, roleId: null, accountId, useVoice: persona?.enabled ?? false, ticketId: null, brainDigest, model: "sonnet", mode: "plan", resume: null });
    dispatch({ type: "brain-question", sessionId: id, question });
    dispatch({ type: "user-sent", sessionId: id, text: question, images: [] });
    await invoke("send_message", { sessionId: id, text: question, images: [] });
    setCreating(false); setPlace("sessions");
  };

  // Keep a session's answer to a brain question as a note (a secret-looking piece is hidden first), and take the question off the wanted list.
  const saveAnswer = async (sessionId: string, answer: string) => {
    const s = live.current.state.sessions[sessionId];
    const p = live.current.projects?.find((x) => samePlace(x.folder, s?.folder ?? ""));
    if (!s?.brainQuestion || !p) return;
    const q = s.brainQuestion;
    try {
      const base = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "answer";
      const id = `answer-${base}`;
      const text = `---\ntitle: ${q.slice(0, 100)}\nkind: topic\ndate: ${localDate()}\nsession: ${sessionId}\nsource: brain-ask\n---\n# ${q.slice(0, 100)}\n\n${redact(answer).text}\n`;
      await saveNote(p.id, id, text);
      void wantedRemove(p.id, q);
      dispatch({ type: "brain-question", sessionId, question: null });
      setNotice("Saved the answer to the brain.");
    } catch (e) { setNotice(`Could not save the answer: ${String(e)}`); }
  };

  if (import.meta.env.DEV && window.location.hash === "#kit") return <Kit />; // the base pickers on show, development only

  if (projects === null || persona === null) return <div className="flex h-full items-center justify-center text-text-tertiary">Opening Kona…</div>;

  let content: React.ReactNode;
  if (adding || !project) {
    content = <AddProject first={!project} onDone={added} onCancel={() => setAdding(false)} />;
  } else if (place === "files") {
    content = <Files project={project} />;
  } else if (place === "roles") {
    content = <Roles roles={roles} accounts={accounts} tools={tools} onChanged={setRoles} />;
  } else if (place === "settings") {
    content = <Settings projects={projects} version={version} onProjects={(next) => { setProjects(next); if (projectId && !next.some((p) => p.id === projectId)) { setProjectId(next[0]?.id ?? null); remember("kona.project", next[0]?.id ?? ""); } }} />;
  } else if (place === "servers") {
    content = <Servers project={project} roles={roles} />;
  } else if (place === "brain") {
    content = <BrainPlace project={project} onAsk={askClaude} />;
  } else if (place === "leftovers") {
    content = <Leftovers state={state} roles={roles} overview={lo} onRefresh={() => { void leftoverOverview().then(setLo); }} />;
  } else if (place === "worktrees") {
    content = <Worktrees project={project} onChanged={() => {}} />;
  } else if (place === "board") {
    content = <Board project={project} roles={roles} state={state} onStart={startTicket} onOpenSession={(id) => { dispatch({ type: "select", id }); setCreating(false); setPlace("sessions"); }} />;
  } else if (place === "voice") {
    content = <Voice persona={persona} onChanged={setPersona} />;
  } else if (place === "costs") {
    content = <Costs projects={projects} roles={roles} accounts={accounts} />;
  } else if (place === "accounts") {
    content = <Accounts accounts={accounts} onChanged={setAccounts} />;
  } else {
    content = (
      <>
        <SessionList state={state} project={project} roles={roles} leftBehind={leftBehind} earlier={shownEarlier} onResume={(e) => void resume(e)} creating={creating || !current} onSelect={(id) => { setCreating(false); dispatch({ type: "select", id }); }} onNew={() => { setError(null); setCreating(true); }} />
        <div className="w-px bg-line-subtle" />
        <main className="flex min-w-0 flex-1 flex-col">
          {creating || !current ? <Welcome key={project.id} project={project} roles={roles} accounts={accounts} persona={persona} lastAccount={lastAccount} onOpenAccounts={() => setPlace("accounts")} onStart={start} error={error} /> : <Chat key={current.id} s={current} onNote={() => void noteSession(current.id, true)} onSaveAnswer={(t) => void saveAnswer(current.id, t)} role={roles.find((r) => r.id === current.roleId)} account={accounts.length > 1 ? accounts.find((a) => a.id === current.accountId)?.label : undefined} dispatch={dispatch} />}
        </main>
      </>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar projects={projects} project={project} onProject={pickProject} onAddProject={() => setAdding(true)} place={place}
        onPlace={(p) => { setAdding(false); setPlace(p); }} attention={attention} leftBehind={leftTotal} plan={state.plans[current?.accountId ?? lastAccount]} limitLine={persona.enabled ? persona.lines.limit : PLAIN_LINES.limit} accountLabel={accounts.length > 1 ? accounts.find((a) => a.id === (current?.accountId ?? lastAccount))?.label ?? null : null} version={version} />
      <div className="relative flex min-w-0 flex-1">
        {content}
        {notice && (
          <div role="status" className="absolute right-6 bottom-6 flex max-w-[440px] items-start gap-3 rounded-card border border-line-subtle bg-surface-2 px-[18px] py-4 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.4)]">
            <Glyph state="done" size={20} />
            <span className="text-[14px] leading-5 text-text-secondary">{notice}</span>
            <button className="ml-2 text-[13px] font-bold text-text-secondary hover:text-text" onClick={() => setNotice(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
