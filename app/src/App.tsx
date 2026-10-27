import { useEffect, useReducer, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { initialState, reducer } from "./lib/sessions";
import { Sidebar } from "./components/Sidebar";
import { Welcome } from "./components/Welcome";
import { Chat } from "./components/Chat";

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
    // every message from every running `claude`, forwarded by the Rust core
    const un = listen<{ sessionId: string; record: unknown }>("session-event", (e) => dispatch({ type: "event", sessionId: e.payload.sessionId, record: e.payload.record }));
    return () => { void un.then((f) => f()); };
  }, []);

  const start = async (folder: string, model: string, mode: string) => {
    setError(null);
    try {
      await invoke<string>("start_session", { folder, model, mode, resume: null });
      setAdding(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const current = state.selected ? state.sessions[state.selected] : null;
  const showWelcome = adding || !current;
  return (
    <div className="flex h-full">
      <Sidebar state={state} version={version} onSelect={(id) => { setAdding(false); dispatch({ type: "select", id }); }} onNew={() => { setError(null); setAdding(true); }} />
      <main className="flex min-w-0 flex-1 flex-col">
        {showWelcome ? <Welcome onStart={start} error={error} /> : <Chat key={current.id} s={current} dispatch={dispatch} />}
      </main>
    </div>
  );
}
