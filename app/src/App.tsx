import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { initialState, loadPlans, reducer, savePlans, type Session } from "./lib/sessions";
import { PLAIN_LINES, leftoverOverview, listAccounts, roleLabel, listProjects, accountStatus, getPersona, listRoles, roleKits, samePlace, type Account, type AddResult, type Project, type Persona, type LeftoverOverview, type Role, type RoleKit, type TicketView } from "./lib/api";
import { TopBar } from "./components/TopBar";
import { PLACES, type Place } from "./lib/places";
import { Office } from "./components/Office";
import { OfficeEditor } from "./components/OfficeEditor";
import { STANDARD, ensurePages, parseMap } from "./office/map";
import type { OfficeMap } from "./office/engine/types";
import { Sheet, type Guard } from "./components/Sheet";
import { officeLooks, looksSignature } from "./lib/office";
import { Hello } from "./components/Hello";
import { AddProject } from "./components/AddProject";
import { PERSON_TABS, PersonSheet, type PersonTab } from "./components/PersonSheet";
import type { Attached } from "./components/Chat";
import { Files } from "./components/Files";
import { Mockups } from "./components/Mockups";
import { Accounts } from "./components/Accounts";
import { Kit } from "./components/Kit";
import { Costs } from "./components/Costs";
import { Board } from "./components/Board";
import { Workflows } from "./components/Workflows";
import { Worktrees } from "./components/Worktrees";
import { Leftovers } from "./components/Leftovers";
import { BRAIN_TABS, BrainPlace, type BrainTab } from "./components/brain/Brain";
import { Servers } from "./components/Servers";
import { Settings } from "./components/Settings";
import { Button, Glyph } from "./components/ui";
import { autoNoteOn, buildDigest, writeSessionNote } from "./lib/brain/summary.ts";
import { localDate, redact } from "./lib/brain/text.ts";
import { loadZoom, stepZoom } from "./lib/zoom";
import { checkForUpdate } from "./lib/update";
import { UpdateCard } from "./components/UpdateCard";
import { getSettings, earlierSessions, costRows, saveNote, wantedRemove, officeSay, officeMapLoad, officeMapSave, officeMapReset, mockupTicketDraft, type Earlier } from "./lib/api";

const remembered = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const remember = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* the choice is just not kept */ } };

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initialState, plans: loadPlans() }));
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(remembered("kona.project"));
  const [roles, setRoles] = useState<Role[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [lo, setLo] = useState<LeftoverOverview>({ items: [], sessions: [] }); // what sessions started and left behind
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsReady, setAccountsReady] = useState(false); // the welcome page needs the accounts, or every project looks accountless
  const [helloNote, setHelloNote] = useState<string | null>(null); // why the welcome page came back
  const [lastAccount, setLastAccount] = useState(remembered("kona.account") ?? "main"); // the account used last
  const [place, setPlace] = useState<Place>("office"); // the page open in the sheet over the office; "office" means no page
  const sheetGuard = useRef<Guard | null>(null); // the open sheet, which asks before anything that would throw away unsaved text
  const [greeted, setGreeted] = useState(false); // the welcome page comes first on every launch
  // the account of a project, or null when it has none (or its account was removed): then nothing starts until the owner picks one on the welcome page
  const accountOf = (p: Project | null | undefined) => (p?.account && accounts.some((a) => a.id === p.account) ? p.account : null);
  const NO_ACCOUNT = "This project has no account yet. Click the Kona mark and choose one.";
  const [person, setPerson] = useState<string | null>(null); // the person whose sheet is open (a role id): what a click on a cat opens
  const [tab, setTab] = useState<PersonTab>("chat");
  const [brainTab, setBrainTab] = useState<BrainTab>("map");
  const [personError, setPersonError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, true>>({}); // sessions the owner put away with New conversation: they stay in the list of what ran, but are not shown with the person
  const [kits, setKits] = useState<Record<string, RoleKit>>({}); // what each role may use in the open project (its skills and connectors)
  const [adding, setAdding] = useState(false); // the Add a project screen
  const [notice, setNotice] = useState<string | null>(null);
  const [officeMap, setOfficeMap] = useState<OfficeMap>(STANDARD); // the office of the open project: its own map, or the standard one
  const [ownMap, setOwnMap] = useState(false); // the project has a map of its own
  const told = useRef(new Set<string>()); // the projects whose office was told about missing pieces in this run (once is enough)
  const [brokenMap, setBrokenMap] = useState<string | null>(null); // why the project's map file could not be used (the standard office is shown, the file is left alone)
  const [editing, setEditing] = useState(false); // the Edit the office screen
  const [version, setVersion] = useState("");
  // the latest of these, for the listener below (it is set up once, so it cannot read them from the render)
  const live = useRef({ state, projects, roles });
  live.current = { state, projects, roles };
  const noting = useRef(new Set<string>());
  const [earlier, setEarlier] = useState<Earlier[]>([]); // sessions Claude Code saved earlier, for History
  const [roleBy, setRoleBy] = useState<Record<string, string | null>>({}); // which role each session of the cost ledger ran as

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
  // the office of a project is kept in the project (.kona/office-map.json); a project with none, or with one that cannot be read, shows the standard office and its file is left as it is
  useEffect(() => {
    setEditing(false);
    setBrokenMap(null);
    if (!project) { setOfficeMap(STANDARD); setOwnMap(false); return; }
    let live = true;
    officeMapLoad(project.folder).then((text) => {
      if (!live) return;
      if (text == null) { setOfficeMap(STANDARD); setOwnMap(false); return; }
      const r = parseMap(text);
      if ("map" in r) {
        // a saved office that lacks a person's desk or a piece that opens a screen gets them put back (in memory; the file changes when the owner saves in Edit the office), and the owner is told once
        const e = ensurePages(r.map);
        setOfficeMap(e.map); setOwnMap(true);
        if ((e.added.length || e.failed.length) && !told.current.has(project.id)) {
          told.current.add(project.id);
          setNotice(e.failed.length ? `This project's office lacks things that open screens and some could not be placed: ${e.failed.join(" ")} Open Edit the office to fix it.` : `This project's office lacked ${e.added.join(", ")}, so they were put back. Open Edit the office and Save to keep them, and move them where you like.`);
        }
      }
      else { setOfficeMap(STANDARD); setOwnMap(false); setBrokenMap(r.error); setNotice(`The office map of this project could not be read (${r.error}), so the standard office is shown. The file was not touched.`); }
    }).catch((e) => { if (live) { setOfficeMap(STANDARD); setOwnMap(false); setBrokenMap("the file could not be opened"); setNotice(`The office map of this project could not be opened (${String(e)}), so the standard office is shown. The file was not touched.`); } });
    return () => { live = false; };
  }, [project?.folder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!greeted || place !== "office") setEditing(false); }, [greeted, place]); // going anywhere else closes the editor (it asked first if there was something unsaved)
  const [seen, setSeen] = useState<Record<string, number>>({}); // for each session, how many turns the owner has seen: "Finish" over a cat stays until the owner opens that person's chat
  const looksSig = looksSignature(state, seen);
  const looks = useMemo(() => officeLooks(project, state, seen), [project, looksSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const attention = useMemo(() => state.order.filter((id) => state.sessions[id].run === "waiting").length, [state]);
  const pickProject = useCallback((id: string) => { setProjectId(id); remember("kona.project", id); setPerson(null); }, []);
  // do a move that leaves the sheet's page (home, another page from the top bar), asking first if the page holds text that was not sent or saved
  const leave = (go: () => void) => { if (sheetGuard.current) sheetGuard.current.leave(go); else go(); };
  const closeSheet = () => { setPlace("office"); setPerson(null); };
  // the office's actions keep one identity, so the office does not redraw for a reason it cannot see
  const openPlace = useCallback((p: Place) => { setPerson(null); setPlace(p); }, []);
  const projectRef = useRef(project);
  projectRef.current = project;
  // a click on a person opens their sheet, on the chat
  const openPerson = useCallback((roleId: string) => { setPlace("office"); setPerson(roleId); setTab("chat"); setPersonError(null); }, []);
  // a person does one thing at a time in a project (decision 62): why a new conversation with them is refused, or null when they are free (the core refuses too, whatever asks)
  const busyMessage = (roleId: string | null): string | null => {
    const p = projectRef.current, st = live.current.state, r = live.current.roles.find((x) => x.id === roleId);
    const s = roleId && p ? st.order.map((id) => st.sessions[id]).find((x) => x.roleId === roleId && x.run !== "ended" && samePlace(x.folder, p.folder)) : undefined;
    if (!s) return null;
    const who = r?.person || "This person";
    return `${who} is busy: ${s.ticketId ? `working on ${s.ticketId}` : "a conversation is open"} in this project. Click ${who} in the office to open it, or end it, before starting another.`;
  };
  const names = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, roleLabel(r)])), [roles]);
  // the conversation shown with a person: their latest session in this project that the owner did not put away
  const sessionOf = (roleId: string | null): Session | null => (roleId && project ? state.order.map((id) => state.sessions[id]).filter((s) => s.roleId === roleId && samePlace(s.folder, project.folder) && !dismissed[s.id]).pop() ?? null : null);
  const personRole = person ? roles.find((r) => r.id === person) ?? null : null;
  const shown = sessionOf(person);
  const current = shown; // (the account of the conversation that is open, for the plan bars)
  useEffect(() => { if (person && tab === "chat" && shown && seen[shown.id] !== shown.turns) setSeen((s) => ({ ...s, [shown.id]: shown.turns })); }, [person, tab, shown?.id, shown?.turns]); // eslint-disable-line react-hooks/exhaustive-deps

  const added = (r: AddResult) => {
    setProjects((cur) => [...(cur ?? []), r.project]);
    pickProject(r.project.id);
    setGreeted(true);
    setAdding(false);
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
  const leftTotal = lo.items.filter((i) => i.left_behind && !i.ignored).length;

  // the earlier conversations of the open person: Claude Code's own transcript files of this project, filed by the role the cost ledger says each one ran as; a conversation with no role on record is
  // filed under the Secretary (the front desk), because the role of an old session was not recorded
  useEffect(() => {
    if (!project || !person) return;
    let live = true;
    Promise.all([earlierSessions(project.id), costRows(null)]).then(([l, rows]) => { if (live) { setEarlier(l); setRoleBy(Object.fromEntries(rows.map((r) => [r.session_id, r.role_id]))); } }).catch(() => { if (live) { setEarlier([]); setRoleBy({}); } });
    return () => { live = false; };
  }, [project?.id, person, state.order.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const history = useMemo(() => earlier.filter((e) => (!state.sessions[e.id] || dismissed[e.id]) && (roleBy[e.id] ?? (person === "secretary" ? "secretary" : null)) === person), [earlier, state.sessions, dismissed, roleBy, person]);

  // Resume an earlier conversation of this person: the same session id, in the same folder. It keeps the account it was saved under: its transcript lives in that account's folder.
  const resume = async (role: Role, e: Earlier) => {
    if (!project || !persona) return;
    const busy = busyMessage(role.id);
    if (busy) { setNotice(busy); return; }
    try {
      const status = await accountStatus(e.account_id);
      if (!status.logged_in) throw new Error("The account of that conversation is not signed in. Open Accounts to sign in.");
      await invoke<string>("start_session", { folder: project.folder, roleId: role.id, accountId: e.account_id, useVoice: persona.enabled, ticketId: null, brainDigest: null, model: role.model, mode: role.mode, resume: e.id });
      setDismissed((d) => { const { [e.id]: _gone, ...rest } = d; return rest; });
      setTab("chat");
    } catch (err) { setNotice(`Could not resume it: ${String(err)}`); }
  };

  // New conversation: end the open one (if it is still going) and put it away; the person is free and the chat is empty again
  const newConversation = async (s: Session) => {
    if (s.run !== "ended") await invoke("stop_session", { sessionId: s.id }).catch(() => {});
    setDismissed((d) => ({ ...d, [s.id]: true }));
    setPersonError(null);
  };

  // keep the plan readings for the next time Kona opens
  useEffect(() => { savePlans(state.plans); }, [state.plans]);

  // The first message to a person starts their session (nothing runs before it): the person's model, permissions and voice, the project's account, a digest of what the Brain knows.
  const sendFirst = async (role: Role, text: string, images: Attached[]) => {
    if (!project || !persona) return;
    setPersonError(null);
    const busy = busyMessage(role.id);
    if (busy) { setPersonError(busy); return; }
    try {
      if (/PRIVATE KEY-----/.test(text)) throw new Error(`The message holds the text of a private key. Keys stay in their files; give ${role.person || role.name} the path, never the key.`);
      const accountId = accountOf(project);
      if (!accountId) throw new Error(NO_ACCOUNT);
      const status = await accountStatus(accountId);
      if (!status.logged_in) throw new Error("That account is not signed in. Open Accounts to sign in.");
      const brainDigest = await buildDigest(project.id, { roleId: role.id, roleName: role.name });
      const id = await invoke<string>("start_session", { folder: project.folder, roleId: role.id, accountId, useVoice: persona.enabled, ticketId: null, brainDigest, model: role.model, mode: role.mode, resume: null });
      setLastAccount(accountId); remember("kona.account", accountId);
      dispatch({ type: "user-sent", sessionId: id, text, images: images.map((i) => i.url) });
      await invoke("send_message", { sessionId: id, text, images: images.map((i) => ({ media_type: i.mediaType, data: i.data })) });
    } catch (e) { setPersonError(String(e)); }
  };

  // Start a session from a ticket card: the role's model, mode and account, the voice as set, and the ticket told to Claude.
  const startTicket = async (t: TicketView) => {
    if (!project || !persona) return;
    const role = roles.find((r) => r.id === t.role);
    if (!role) throw new Error("Choose a role for this ticket first");
    const busy = busyMessage(role.id);
    if (busy) throw new Error(busy);
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
    openPerson(role.id);
  };

  // Kibby and Bako, the office boys, answer through the project's account (a cheap one-shot Haiku call; the talk is not kept).
  const sayToOffice = async (who: string, history: { who: string; text: string }[], message: string) => {
    if (!project) throw new Error("Open a project first");
    const accountId = accountOf(project);
    if (!accountId) throw new Error(NO_ACCOUNT);
    const status = await accountStatus(accountId);
    if (!status.logged_in) throw new Error("That account is not signed in. Open Accounts to sign in.");
    return officeSay(project.id, accountId, who, history, message);
  };

  // Send from the Mockups sheet: the draft of a ticket from the pins is one cheap call through the project's account
  const draftMockupTicket = async (prompt: string) => {
    if (!project) throw new Error("Open a project first");
    const accountId = accountOf(project);
    if (!accountId) throw new Error(NO_ACCOUNT);
    const status = await accountStatus(accountId);
    if (!status.logged_in) throw new Error("That account is not signed in. Open Accounts to sign in.");
    return mockupTicketDraft(project.id, accountId, prompt);
  };

  // Ask a question from the Brain: the Secretary (general questions) takes it, in a new session in plan-only mode (it can read, not change), with the question sent at once.
  const askClaude = async (question: string) => {
    if (!project) return;
    const kupa = roles.find((r) => r.id === "secretary");
    if (!kupa) throw new Error("The Secretary is not here to answer.");
    const busy = busyMessage(kupa.id);
    if (busy) throw new Error(busy);
    const accountId = accountOf(project);
    if (!accountId) throw new Error(NO_ACCOUNT);
    const status = await accountStatus(accountId);
    if (!status.logged_in) throw new Error("That account is not signed in. Open Accounts to sign in.");
    const brainDigest = await buildDigest(project.id, { roleId: kupa.id, roleName: kupa.name });
    const id = await invoke<string>("start_session", { folder: project.folder, roleId: kupa.id, accountId, useVoice: persona?.enabled ?? false, ticketId: null, brainDigest, model: "sonnet", mode: "plan", resume: null });
    dispatch({ type: "brain-question", sessionId: id, question });
    dispatch({ type: "user-sent", sessionId: id, text: question, images: [] });
    await invoke("send_message", { sessionId: id, text: question, images: [] });
    openPerson(kupa.id);
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
      <div className="relative flex h-full overflow-hidden">
        <Hello projects={projects} accounts={accounts} version={version}
          note={helloNote}
          onOpen={(id) => { pickProject(id); setHelloNote(null); setGreeted(true); setAdding(false); setPlace("office"); }}
          onAdd={() => { setGreeted(true); setAdding(true); setPlace("office"); }}
          onOpenAccounts={() => { setGreeted(true); setAdding(false); setPlace("accounts"); }}
          onProjects={setProjects} />
        <UpdateCard running={state.order.filter((id) => state.sessions[id].run !== "ended").length} />
      </div>
    );
  }

  // the page of a place; the sheet shows it over the office
  const pageOf = (which: Place): React.ReactNode => {
    if (!project) return null;
    switch (which) {
      case "accounts": return <Accounts accounts={accounts} onChanged={setAccounts} />;
      case "files": return <Files project={project} />;
      case "mockups": return <Mockups project={project} send={{ designer: roles.find((r) => r.id === "design")?.person || "the designer", draft: draftMockupTicket, start: startTicket }} />;
      case "settings": return <Settings projects={projects} version={version} onProjects={(next) => { setProjects(next); if (projectId && !next.some((p) => p.id === projectId)) { setProjectId(next[0]?.id ?? null); remember("kona.project", next[0]?.id ?? ""); } }} />;
      case "servers": return <Servers project={project} roles={roles} />;
      case "brain": return <BrainPlace project={project} tab={brainTab} onTab={setBrainTab} onAsk={askClaude} />;
      case "leftovers": return <Leftovers state={state} roles={roles} overview={lo} onRefresh={() => { void leftoverOverview().then(setLo); }} />;
      case "worktrees": return <Worktrees project={project} onChanged={() => {}} />;
      case "board": return <Board project={project} roles={roles} state={state} onStart={startTicket} onOpenSession={(id) => openPerson(state.sessions[id]?.roleId ?? "secretary")} />;
      case "workflows": return <Workflows project={project} roles={roles} onOpenBoard={() => setPlace("board")} onStart={startTicket} />;
      case "costs": return <Costs project={project} roles={roles} accounts={accounts} />;
      default: return null;
    }
  };

  let content: React.ReactNode;
  let sheet: React.ReactNode = null;
  if (place === "accounts" && !adding && !project) {
    content = <Accounts accounts={accounts} onChanged={setAccounts} />; // no project yet, so there is no office to open it over
  } else if (adding || !project) {
    content = <AddProject first={!project} accounts={accounts} onDone={added} onCancel={() => setAdding(false)} onOpenAccounts={() => { setAdding(false); setPlace("accounts"); }} />;
  } else {
    content = editing
      ? <OfficeEditor key={project.id} names={names} map={officeMap} hasOwn={ownMap} broken={brokenMap} guard={sheetGuard}
          onSave={async (m) => { await officeMapSave(project.folder, JSON.stringify(m)); setOfficeMap(m); setOwnMap(true); setBrokenMap(null); setNotice("Saved the office of this project."); }}
          onReset={async () => { await officeMapReset(project.folder); setOfficeMap(STANDARD); setOwnMap(false); setBrokenMap(null); setNotice("This project shows the standard office again."); }}
          onClose={() => setEditing(false)} />
      : <Office map={officeMap} looks={looks} sheetOpen={place !== "office" || person !== null} names={names} onOpen={openPlace} onOpenPerson={openPerson} onSay={sayToOffice} onEdit={() => setEditing(true)} />;
    if (place !== "office") {
      const info = PLACES.find((x) => x.id === place);
      const brainTabs = place === "brain" ? { tabs: BRAIN_TABS, active: brainTab, onTab: (id: string) => setBrainTab(id as BrainTab), keepDraftOnTab: true } : {};
      sheet = <Sheet key="sheet" title={info?.label ?? place} {...brainTabs} onClose={closeSheet} guard={sheetGuard}>{pageOf(place)}</Sheet>;
    } else if (person && personRole) {
      sheet = (
        <Sheet key={`person-${person}`} title={roleLabel(personRole)} tabs={PERSON_TABS} active={tab} onTab={(id) => setTab(id as PersonTab)} keepDraftOnTab onClose={closeSheet} guard={sheetGuard}>
          <PersonSheet tab={tab} onTab={setTab} role={personRole} project={project} session={shown} history={history} accountId={accountOf(project)} kit={kits[personRole.id] ?? { skills: [], mcp: [], notes: {} }} error={personError} dispatch={dispatch as (a: unknown) => void}
            onFirst={(text, images) => void sendFirst(personRole, text, images)} onResume={(e) => void resume(personRole, e)} onNew={() => shown && void newConversation(shown)} onNote={() => shown && void noteSession(shown.id, true)}
            onSaveAnswer={(text) => shown && void saveAnswer(shown.id, text)} onSaved={(saved) => setRoles((all) => all.map((r) => (r.id === saved.id ? saved : r)))} onKitSaved={(id, kit) => setKits((all) => ({ ...all, [id]: kit }))} />
        </Sheet>
      );
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar project={project} onHome={() => leave(() => { setAdding(false); setGreeted(false); })} sheetOpen={sheet !== null} place={place}
        onPlace={(p) => leave(() => { setAdding(false); setPerson(null); setPlace(p); })} onAttention={() => leave(() => { const w = state.order.map((id) => state.sessions[id]).find((s) => s.run === "waiting" && project && samePlace(s.folder, project.folder)); if (w) openPerson(w.roleId ?? "secretary"); })} attention={attention} leftBehind={leftTotal} plan={state.plans[current?.accountId ?? accountOf(project) ?? lastAccount]}
        limitLine={PLAIN_LINES.limit} accountLabel={project ? accounts.find((a) => a.id === (current?.accountId ?? accountOf(project)))?.label ?? null : null} version={version} />
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {content}
        {sheet}
        <UpdateCard running={state.order.filter((id) => state.sessions[id].run !== "ended").length} />
        {notice && (
          <div role="status" className="absolute right-6 bottom-6 z-20 flex max-w-[440px] items-start gap-3 px-card px-shadow p-2">
            <Glyph state="done" size={20} />
            <span className="text-[14px] leading-5 text-text-secondary">{notice}</span>
            <Button variant="ghost" tiny className="ml-2" onClick={() => setNotice(null)}>Close</Button>
          </div>
        )}
      </div>
    </div>
  );
}
