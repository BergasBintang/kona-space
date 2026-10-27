import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { initialState, reducer } from "./lib/sessions";
import { listProjects, listRoles, samePlace, type AddResult, type Project, type Role } from "./lib/api";
import { Sidebar, type Place } from "./components/Sidebar";
import { SessionList } from "./components/SessionList";
import { Welcome } from "./components/Welcome";
import { AddProject } from "./components/AddProject";
import { Chat } from "./components/Chat";
import { Files } from "./components/Files";
import { Roles } from "./components/Roles";
import { Glyph } from "./components/ui";

const remembered = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const remember = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* the choice is just not kept */ } };

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(remembered("kona.project"));
  const [roles, setRoles] = useState<Role[]>([]);
  const [place, setPlace] = useState<Place>("sessions");
  const [adding, setAdding] = useState(false); // the Add a project screen
  const [creating, setCreating] = useState(false); // the Start a session screen
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState("");

  // a notice goes away by itself after a few seconds
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 9000); return () => clearTimeout(t); }, [notice]);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
    listProjects().then(setProjects).catch(() => setProjects([]));
    listRoles().then(setRoles).catch(() => setRoles([]));
    // every message from every running `claude`, forwarded by the Rust core
    const un = listen<{ sessionId: string; record: unknown }>("session-event", (e) => dispatch({ type: "event", sessionId: e.payload.sessionId, record: e.payload.record }));
    return () => { void un.then((f) => f()); };
  }, []);

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

  const start = async (folder: string, roleId: string | null, model: string, mode: string) => {
    setError(null);
    try { await invoke<string>("start_session", { folder, roleId, model, mode, resume: null }); setCreating(false); }
    catch (e) { setError(String(e)); }
  };

  if (projects === null) return <div className="flex h-full items-center justify-center text-text-tertiary">Opening Kona…</div>;

  let content: React.ReactNode;
  if (adding || !project) {
    content = <AddProject first={!project} onDone={added} onCancel={() => setAdding(false)} />;
  } else if (place === "files") {
    content = <Files project={project} />;
  } else if (place === "roles") {
    content = <Roles roles={roles} onChanged={setRoles} />;
  } else {
    content = (
      <>
        <SessionList state={state} project={project} roles={roles} creating={creating || !current} onSelect={(id) => { setCreating(false); dispatch({ type: "select", id }); }} onNew={() => { setError(null); setCreating(true); }} />
        <div className="w-px bg-line-subtle" />
        <main className="flex min-w-0 flex-1 flex-col">
          {creating || !current ? <Welcome key={project.id} project={project} roles={roles} onStart={start} error={error} /> : <Chat key={current.id} s={current} role={roles.find((r) => r.id === current.roleId)} dispatch={dispatch} />}
        </main>
      </>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar projects={projects} project={project} onProject={pickProject} onAddProject={() => setAdding(true)} place={place}
        onPlace={(p) => { setAdding(false); setPlace(p); }} attention={attention} plan={state.plan} version={version} />
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
