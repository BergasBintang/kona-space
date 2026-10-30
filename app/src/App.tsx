import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { initialState, loadPlans, reducer, savePlans } from "./lib/sessions";
import { PLAIN_LINES, leftoverOverview, listAccounts, listProjects, accountStatus, getPersona, listRoles, listTools, roleKits, samePlace, type Account, type AddResult, type Project, type Persona, type LeftoverOverview, type Role, type RoleKit, type TicketView, type ToolInfo } from "./lib/api";
import { TopBar } from "./components/TopBar";
import type { Place } from "./lib/places";
import { Office } from "./components/Office";
import { officeLooks, looksSignature } from "./lib/office";
import { Hello } from "./components/Hello";
import { SessionList } from "./components/SessionList";
import { Welcome } from "./components/Welcome";
import { AddProject } from "./components/AddProject";
import { Chat } from "./components/Chat";
import { Files } from "./components/Files";
import { Roles } from "./components/Roles";
import { RoleSetup } from "./components/RoleSetup";
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
import { loadZoom, stepZoom } from "./lib/zoom";
import { checkForUpdate } from "./lib/update";
import { UpdateCard } from "./components/UpdateCard";
import { getSettings, earlierSessions, saveNote, wantedRemove, type Earlier } from "./lib/api";

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
  const [accountsReady, setAccountsReady] = useState(false); // the welcome page needs the accounts, or every project looks accountless
  const [helloNote, setHelloNote] = useState<string | null>(null); // why the welcome page came back
  const [lastAccount, setLastAccount] = useState(remembered("kona.account") ?? "main"); // the account used last
  const [place, setPlace] = useState<Place>("office");
  const [greeted, setGreeted] = useState(false); // the welcome page comes first on every launch
  // the account of a project, or null when it has none (or its account was removed): then nothing starts until the owner picks one on the welcome page
  const accountOf = (p: Project | null | undefined) => (p?.account && accounts.some((a) => a.id === p.account) ? p.account : null);
  const NO_ACCOUNT = "This project has no account yet. Click the Kona mark and choose one.";
  const [presetRole, setPresetRole] = useState<string | null>(null); // a role chosen in the office, for the start screen
  const [settingUp, setSettingUp] = useState<string | null>(null); // the role whose setup dialog is open
  const [kits, setKits] = useState<Record<string, RoleKit>>({}); // what each role may use in the open project (its skills and connectors)
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

  // the window size (100, 90, 80 percent) and the keys for it; the window itself never scrolls
  useEffect(() => {
    loadZoom();
    const keys = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return;
      if (e.key === "-" || e.key === "_") { e.preventDefault(); stepZoom(-1); }
      else if (e.key === "=" || e.key === "+") { e.preventDefault(); stepZoom(1); }
      else if (e.key === "0") { e.preventDefault(); stepZoom(0); }
    };
    const stay = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); };
    window.addEventListener("keydown", keys);
    window.addEventListener("scroll", stay);
    return () => { window.removeEventListener("keydown", keys); window.removeEventListener("scroll", stay); };
  }, []);

  // a few seconds after start, look for a newer version (if the owner has not turned that off); offline or a failure stays quiet
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { getSettings().then((s) => { if (live && s.check_updates) void checkForUpdate(false); }).catch(() => {}); }, 6000);
    return () => { live = false; clearTimeout(t); };
  }, []);

  // a notice goes away by itself after a few seconds
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 9000); return () => clearTimeout(t); }, [notice]);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
    listProjects().then(setProjects).catch(() => setProjects([]));
    listRoles().then(setRoles).catch(() => setRoles([]));
    getPersona().then(setPersona).catch(() => setPersona(null));
    listTools().then(setTools).catch(() => setTools([]));
    listAccounts().then((a) => { setAccounts(a); setAccountsReady(true); }).catch(() => { setAccounts([]); setAccountsReady(true); });
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
      // the plan's rule for background work: a note is written when no other session is busy (it uses the plan too), checking every 8 seconds for up to 4 minutes
      for (let i = 0; i < 30 && Object.values(live.current.state.sessions).some((x) => x.id !== id && x.run === "working"); i++) await new Promise((r) => setTimeout(r, 8000));
      const r = await writeSessionNote({ projectId: p.id, folder: p.folder, sessionId: id, workDir: s.workDir, accountId: s.accountId, roleId: s.roleId, roleName: rs.find((x) => x.id === s.roleId)?.name, ticketId: s.ticketId, sessionTitle: s.title });
      setNotice(r.existing ? `There is already a note about this session: “${r.title}”.` : `Wrote a note about the session: “${r.title}”. Find it in Brain.`);
    } catch (e) {
      if (manual) setNotice(`Could not write the note: ${String(e)}`);
    } finally { noting.current.delete(id); }
  };

  const project = useMemo(() => projects?.find((p) => p.id === projectId) ?? projects?.[0] ?? null, [projects, projectId]);
  // what each role may use in this project (its skills and connectors) is kept in the project, so it is read again whenever the project changes
  useEffect(() => {
    if (!project) { setKits({}); return; }
    let live = true;
    roleKits(project.folder).then((k) => { if (live) setKits(k); }).catch(() => { if (live) setKits({}); });
    return () => { live = false; };
  }, [project?.folder]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = useMemo(() => (project ? state.order.filter((id) => samePlace(state.sessions[id].folder, project.folder)) : []), [state, project]);
  const looksSig = looksSignature(state);
  const looks = useMemo(() => officeLooks(project, state), [project, looksSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const attention = useMemo(() => state.order.filter((id) => state.sessions[id].run === "waiting").length, [state]);
  const current = state.selected && mine.includes(state.selected) ? state.sessions[state.selected] : null;

  const pickProject = useCallback((id: string) => { setProjectId(id); remember("kona.project", id); setCreating(false); setPresetRole(null); }, []);
  useEffect(() => { if (place !== "sessions") setPresetRole(null); }, [place]);
  // the office's three actions keep one identity, so the office does not redraw for a reason it cannot see
  const openPlace = useCallback((p: Place) => setPlace(p), []);
  const startRoleHere = useCallback((id: string) => { setPresetRole(id); setError(null); setCreating(true); setPlace("sessions"); }, []);
  const openSessionHere = useCallback((id: string) => { dispatch({ type: "select", id }); setCreating(false); setPlace("sessions"); }, []);

  const added = (r: AddResult) => {
    setProjects((cur) => [...(cur ?? []), r.project]);
    pickProject(r.project.id);
    setGreeted(true);
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
  // Resuming keeps the account the session was saved under: its transcript lives in that account's folder, so no other account can find it.
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
      await invoke<string>("start_session", { folder, roleId, accountId, useVoice, ticketId: null, brainDigest, model, mode, resume: null }); setLastAccount(accountId); remember("kona.account", accountId); setCreating(false); setPresetRole(null); }
    catch (e) { setError(String(e)); }
  };

  // Start a session from a ticket card: the role's model, mode and account, the voice as set, and the ticket told to Claude.
  const startTicket = async (t: TicketView) => {
    if (!project || !persona) return;
    const role = roles.find((r) => r.id === t.role);
    if (!role) throw new Error("Choose a role for this ticket first");
    const accountId = accountOf(project);
    if (!accountId) throw new Error(NO_ACCOUNT);
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
    const accountId = accountOf(project);
    if (!accountId) throw new Error(NO_ACCOUNT);
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

  if (projects === null || persona === null || !accountsReady) return <div className="flex h-full items-center justify-center text-text-tertiary">Opening Kona…</div>;

  if (!greeted && projects.length > 0) {
    return (
      <div className="flex h-full overflow-hidden">
        <Hello projects={projects} accounts={accounts} persona={persona}
          note={helloNote}
          onOpen={(id) => { pickProject(id); setHelloNote(null); setGreeted(true); setAdding(false); setPlace("office"); }}
          onAdd={() => { setGreeted(true); setAdding(true); }}
          onOpenAccounts={() => { setGreeted(true); setAdding(false); setPlace("accounts"); }}
          onProjects={setProjects} />
      </div>
    );
  }

  let content: React.ReactNode;
  if (place === "accounts" && !adding) {
    content = <Accounts accounts={accounts} onChanged={setAccounts} />;
  } else if (adding || !project) {
    content = <AddProject first={!project} accounts={accounts} onDone={added} onCancel={() => setAdding(false)} onOpenAccounts={() => { setAdding(false); setPlace("accounts"); }} />;
  } else if (place === "office") {
    content = <Office project={project} roles={roles} looks={looks} onOpen={openPlace} onStartRole={startRoleHere} onOpenSession={openSessionHere} onSetup={setSettingUp} />;
  } else if (place === "files") {
    content = <Files project={project} />;
  } else if (place === "roles") {
    content = <Roles roles={roles} tools={tools} kits={kits} onSetup={setSettingUp} />;
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
    content = <Costs project={project} roles={roles} accounts={accounts} />;
  } else {
    content = (
      <>
        <SessionList state={state} project={project} roles={roles} leftBehind={leftBehind} earlier={shownEarlier} onResume={(e) => void resume(e)} creating={creating || !current} onSelect={(id) => { setPresetRole(null); setCreating(false); dispatch({ type: "select", id }); }} onNew={() => { setPresetRole(null); setError(null); setCreating(true); }} />
        <div className="w-px bg-line-subtle" />
        <main className="flex min-w-0 flex-1 flex-col">
          {creating || !current ? <Welcome key={`${project.id}-${presetRole ?? ""}`} initialRole={roles.find((r) => r.id === presetRole) ?? null} project={project} roles={roles} accounts={accounts} persona={persona} accountId={accountOf(project) ?? ""} onOpenAccounts={() => setPlace("accounts")} onStart={start} error={error} /> : <Chat key={current.id} s={current} onNote={() => void noteSession(current.id, true)} onSaveAnswer={(t) => void saveAnswer(current.id, t)} role={roles.find((r) => r.id === current.roleId)} account={accounts.length > 1 ? accounts.find((a) => a.id === current.accountId)?.label : undefined} dispatch={dispatch} />}
        </main>
      </>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar projects={projects} project={project} onProject={(id) => { pickProject(id); setAdding(false); const p = projects.find((x) => x.id === id); if (!accountOf(p)) { setHelloNote(`${p?.name ?? "That project"} has no account yet. Choose one on its card.`); setGreeted(false); } }} onHome={() => { setAdding(false); setGreeted(false); }} place={place}
        onPlace={(p) => { setAdding(false); setPlace(p); }} attention={attention} leftBehind={leftTotal} plan={state.plans[current?.accountId ?? accountOf(project) ?? lastAccount]}
        limitLine={persona.enabled ? persona.lines.limit : PLAIN_LINES.limit} accountLabel={project ? accounts.find((a) => a.id === (current?.accountId ?? accountOf(project)))?.label ?? null : null} version={version} />
      <div className="relative flex min-h-0 min-w-0 flex-1">
        {content}
        {settingUp && project && roles.some((r) => r.id === settingUp) && (
          <RoleSetup key={`${project.id}-${settingUp}`} role={roles.find((r) => r.id === settingUp)!} project={project} accountId={accountOf(project)} kit={kits[settingUp] ?? { skills: [], mcp: [] }}
            onSaved={(saved) => setRoles((all) => all.map((r) => (r.id === saved.id ? saved : r)))} onKitSaved={(id, kit) => setKits((all) => ({ ...all, [id]: kit }))} onClose={() => setSettingUp(null)} />
        )}
        <UpdateCard running={state.order.filter((id) => state.sessions[id].run !== "ended").length} />
        {notice && (
          <div role="status" className="absolute right-6 bottom-6 flex max-w-[440px] items-start gap-3 px-card px-shadow p-2">
            <Glyph state="done" size={20} />
            <span className="text-[14px] leading-5 text-text-secondary">{notice}</span>
            <button className="ml-2 text-[13px] font-bold text-text-secondary hover:text-text" onClick={() => setNotice(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
