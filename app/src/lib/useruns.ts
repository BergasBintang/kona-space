// The runner of the workflows that run by themselves (decision 78 of kona-space-app.md). It keeps the runs of the open project, and moves the active one on: when the person of a step has
// finished (their session is back to ready after a turn), their last words are kept as the result, their session is ended, and the next person is started with that result in their briefing.
// It never starts a session without the owner having pressed Run. The record of every change is saved at once (the core keeps one file per run), so a run is not lost when the window is
// reloaded; a run that was still going when Kona was closed is shown as stopped, and Try again goes on from the step it stopped at.
import { useCallback, useEffect, useRef, useState } from "react";
import { runDelete, runList, runSave, type Project, type Role, type Workflow } from "./api";
import type { Session } from "./sessions";
import { addressee, logOfSession } from "./meetingchat";
import { addNote, attachSession, completeRun, failStep, finishStep, isActive, lastReply, markStale, newRun, nextIndex, readRun, retryRun, startStep, stepPrompt, stopRun, workingIndex, type Run } from "./workflowrun";

export type RunDeps = {
  project: Project | null;
  roles: Role[];
  sessions: Record<string, Session>;
  /** start the person's session and give it the briefing; resolves with the id of the session (rejects with a plain reason, for example that the person is busy) */
  startStep: (role: Role, prompt: string) => Promise<string>;
  stopSession: (id: string) => Promise<void>;
  /** say something to a running session, as the owner */
  sendTo: (sessionId: string, text: string) => Promise<void>;
  notify: (text: string) => void;
  /** why a person cannot start now (null when they are free) */
  busy: (roleId: string) => string | null;
};

const plain = (e: unknown) => String(e).replace(/^Error:\s*/, "");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useWorkflowRuns(deps: RunDeps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const d = useRef(deps);
  d.current = deps;
  const runsRef = useRef<Run[]>([]);
  const ticking = useRef(false);
  const again = useRef(false);
  const folder = deps.project?.folder ?? null;

  const commit = useCallback((next: Run) => {
    const cur = runsRef.current;
    runsRef.current = cur.some((r) => r.id === next.id) ? cur.map((r) => (r.id === next.id ? next : r)) : [next, ...cur];
    setRuns(runsRef.current);
    const f = d.current.project?.folder;
    if (f) runSave(f, next).catch((e) => d.current.notify(`Could not save the run: ${plain(e)}`));
  }, []);

  // the runs of the project that is open; one that was running when Kona was closed has no session any more
  useEffect(() => {
    runsRef.current = []; setRuns([]);
    if (!folder) return;
    let live = true;
    runList(folder).then((raw) => {
      if (!live) return;
      const read = raw.map(readRun).filter((r): r is Run => r !== null).map((r) => { const m = markStale(r); if (m !== r) runSave(folder, m).catch(() => {}); return m; });
      runsRef.current = read; setRuns(read);
    }).catch(() => {});
    return () => { live = false; };
  }, [folder]);

  const step = useCallback(async (run: Run) => {
    const dep = d.current;
    let r = run;
    const w = workingIndex(r);
    if (w >= 0) {
      const st = r.steps[w];
      if (!st.sessionId) return; // the person is being started
      const s = dep.sessions[st.sessionId];
      if (!s) { if (Date.now() - (st.startedAt ?? 0) > 20000) commit(failStep(r, w, "The person's session is gone.")); return; }
      if (s.run === "ended") { commit(failStep(r, w, "The person's session ended before the step was finished.")); dep.notify(`${r.name}: ${st.who}'s session ended before their step was finished.`); return; }
      if (s.run !== "ready" || s.turns < 1) return; // still working, or waiting on the owner
      const text = lastReply(s.items);
      r = finishStep(r, w, text || "(no written result)", s.costTotal, Date.now(), logOfSession(s));
      commit(r);
      await dep.stopSession(s.id).catch(() => {});
      for (let k = 0; k < 40 && d.current.sessions[s.id] && d.current.sessions[s.id].run !== "ended"; k++) await wait(200); // the person is free again before the next one starts (the same person may come twice)
      r = runsRef.current.find((x) => x.id === r.id) ?? r;
      if (!isActive(r)) return;
    }
    const n = nextIndex(r);
    if (n < 0) {
      if (!r.steps.some((s) => s.status === "working")) { commit(completeRun(r)); dep.notify(`${r.name}: every step is done.`); }
      return;
    }
    const role = dep.roles.find((x) => x.id === r.steps[n].role);
    if (!role) { commit(failStep(startStep(r, n), n, "That role is not in the office any more.")); return; }
    const busy = dep.busy(role.id);
    if (busy) { commit(failStep(startStep(r, n), n, busy)); dep.notify(busy); return; }
    r = startStep(r, n);
    commit(r);
    try {
      const id = await dep.startStep(role, stepPrompt(r, n));
      const now = runsRef.current.find((x) => x.id === r.id) ?? r;
      if (!isActive(now)) { void dep.stopSession(id).catch(() => {}); return; } // the owner pressed Stop while the person was being started
      commit(attachSession(now, n, id));
    } catch (e) {
      const now = runsRef.current.find((x) => x.id === r.id) ?? r;
      if (isActive(now)) { commit(failStep(now, n, plain(e))); dep.notify(`${now.name}: ${plain(e)}`); }
    }
    again.current = true;
  }, [commit]);

  const tick = useCallback(async () => {
    if (ticking.current) { again.current = true; return; }
    ticking.current = true;
    try {
      do {
        again.current = false;
        const run = runsRef.current.find(isActive);
        if (!run) break;
        await step(run);
      } while (again.current);
    } finally { ticking.current = false; }
  }, [step]);

  // every change of the runs or of a session is a moment to look at whether the person has finished
  useEffect(() => { void tick(); }, [runs, deps.sessions, tick]);

  /** Run a workflow now. Rejects with a plain reason when it cannot start. */
  const startRun = useCallback(async (w: Workflow): Promise<Run> => {
    const dep = d.current;
    if (!dep.project) throw new Error("Open a project first.");
    if (runsRef.current.some(isActive)) throw new Error("A meeting is already running. Stop it or wait until it is done.");
    const missing = w.steps.find((s) => !dep.roles.some((r) => r.id === s.role));
    if (missing) throw new Error(`The step "${missing.title}" is for a role that is not in the office.`);
    for (const id of new Set(w.steps.map((s) => s.role))) { const b = dep.busy(id); if (b) throw new Error(b); }
    const who = (id: string) => { const r = dep.roles.find((x) => x.id === id); return r?.person || r?.name || id; };
    const run = newRun(w, who);
    commit(run);
    return run;
  }, [commit]);

  const stop = useCallback(async (id: string) => {
    const run = runsRef.current.find((r) => r.id === id);
    if (!run || !isActive(run)) return;
    const w = workingIndex(run), sid = w >= 0 ? run.steps[w].sessionId : undefined;
    commit(stopRun(run));
    if (sid) await d.current.stopSession(sid).catch(() => {});
  }, [commit]);

  const retry = useCallback((id: string) => {
    const run = runsRef.current.find((r) => r.id === id);
    if (!run || run.status !== "stopped") return;
    if (runsRef.current.some(isActive)) { d.current.notify("A meeting is already running."); return; }
    commit(retryRun(run));
  }, [commit]);

  const remove = useCallback(async (id: string) => {
    const run = runsRef.current.find((r) => r.id === id);
    if (!run) return;
    if (isActive(run)) await stop(id);
    runsRef.current = runsRef.current.filter((r) => r.id !== id); setRuns(runsRef.current);
    const f = d.current.project?.folder;
    if (f) runDelete(f, id).catch(() => {});
  }, [stop]);

  /** The owner says something in the meeting. Returns who it went to (their name), or null when nobody is left to hear it. */
  const say = useCallback(async (id: string, text: string): Promise<string | null> => {
    const run = runsRef.current.find((r) => r.id === id);
    if (!run || !text.trim()) return null;
    const to = addressee(run, text);
    if (!to) return null;
    const st = run.steps[to.step];
    const s = st.status === "working" && st.sessionId ? d.current.sessions[st.sessionId] : undefined;
    if (s && s.run !== "ended") await d.current.sendTo(s.id, to.text);
    else commit(addNote(run, to.step, to.text));
    return st.who;
  }, [commit]);

  return { runs, startRun, stop, retry, remove, say };
}
