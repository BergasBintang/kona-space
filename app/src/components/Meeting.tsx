// The Meeting (decision 78 of kona-space-app.md): the sheet that the long table of the meeting room opens. Two tabs. "Chat" is one group chat for a run of a workflow: what each
// person says piles up in the order it was said, each with their name and face, tool uses are folded into one line, and a permission or a question is answered right in the chat. The
// owner can write in it too: to whoever is working now, or to a person by name. "Workflows" is the plan editor (components/Workflows.tsx), where Run starts a meeting.
// Behind the chat every person is still their own session; lib/useruns.ts moves the run on, lib/meetingchat.ts makes the lines.
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { buildChat, type Line } from "../lib/meetingchat";
import { dollars, type Session } from "../lib/sessions";
import { doneCount, runWords, totalCost, workingIndex, type Run, type RunStep } from "../lib/workflowrun";
import type { Project, Role, Workflow } from "../lib/api";
import { Markdown } from "./brain/Markdown";
import { PermissionCard, QuestionCard } from "./Chat";
import { Help } from "./Help";
import { IconButton } from "./Icon";
import { Select } from "./pick";
import { Button, Glyph, RoleMark, type GlyphState } from "./ui";
import { Workflows } from "./Workflows";

const STEP_STATE: Record<RunStep["status"], GlyphState> = { waiting: "idle", working: "live", done: "done", failed: "left", stopped: "stopped" };

export type MeetingProps = {
  project: Project | null; roles: Role[];
  runs: Run[]; sessions: Record<string, Session>;
  onRun: (w: Workflow) => Promise<void>;
  onStop: (id: string) => void; onRetry: (id: string) => void; onRemove: (id: string) => void;
  /** the owner writes in the meeting; resolves with the name of who heard it, or null when nobody is left */
  onSay: (id: string, text: string) => Promise<string | null>;
  dispatch: (a: any) => void;
};

export function Meeting(p: MeetingProps) {
  const [tab, setTab] = useState<"meeting" | "plans">("meeting");
  const run = async (w: Workflow) => { await p.onRun(w); setTab("meeting"); };
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div role="tablist" aria-label="Meeting views" className="flex shrink-0 gap-2 border-b border-line-subtle bg-surface-1 px-8 py-2">
        {([["meeting", "Chat"], ["plans", "Workflows"]] as const).map(([id, label]) => (
          <Button key={id} small role="tab" aria-selected={tab === id} variant={tab === id ? "primary" : "quiet"} onClick={() => setTab(id)}>{label}</Button>
        ))}
      </div>
      {tab === "plans"
        ? <Workflows project={p.project} roles={p.roles} onRun={run} />
        : <MeetingChat {...p} onPlans={() => setTab("plans")} />}
    </div>
  );
}

const when = (t: number) => new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function MeetingChat({ project, runs, sessions, onStop, onRetry, onRemove, onSay, dispatch, onPlans }: MeetingProps & { onPlans: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const newest = runs[0]?.id ?? null;
  useEffect(() => { setPicked(null); setConfirmDelete(false); }, [newest]); // a new meeting is the one to look at
  const run = runs.find((r) => r.id === (picked ?? newest)) ?? null;

  if (!project) return <div className="flex flex-1 items-center justify-center text-text-tertiary">Open a project first.</div>;
  if (!run) {
    return (
      <div className="flex flex-1 flex-col items-start gap-3 p-8">
        <p className="m-0 text-[15px] leading-6 text-text-secondary">No meeting yet.</p>
        <Button onClick={onPlans}>Choose a workflow to run</Button>
      </div>
    );
  }
  const active = run.status === "running";
  const working = workingIndex(run);
  const live = working >= 0 ? sessions[run.steps[working].sessionId ?? ""] : undefined;
  const waitingOnYou = !!live && live.run === "waiting";
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-subtle px-8 py-3">
        <div className="min-w-[220px] flex-1">
          <Select ariaLabel="Which meeting" value={run.id} onChange={(v) => { setPicked(v); setConfirmDelete(false); }}
            options={runs.map((r) => ({ value: r.id, label: `${r.name} · ${when(r.startedAt)}`, hint: runWords(r) }))} />
        </div>
        <span className="flex items-center gap-2 text-[14px] leading-5 font-bold">
          <Glyph state={active ? (waitingOnYou ? "waiting" : "live") : run.status === "done" ? "done" : "stopped"} size={16} />{runWords(run, waitingOnYou)}
        </span>
        <span className="text-[13px] leading-5 text-text-secondary" title="An estimate at list price">{doneCount(run)} of {run.steps.length} done · {dollars(totalCost(run) + (live?.costTotal ?? 0))}</span>
        <Help title="The meeting">
          <p className="m-0">The people of the steps work one after another. Each one hands their last written words to the next, who starts at once. Everyone has their own conversation; this chat shows what each of them says, in order.</p>
          <p className="m-0">Write in the box to talk to whoever is working now. Start with a name (Jiro, use PostgreSQL) to talk to one person: a person whose turn has not come reads it when they start.</p>
          <p className="m-0">If someone needs a permission or has a question, it shows here and the meeting waits for you. Stop ends the person who is working now.</p>
        </Help>
        <span className="flex-1" />
        {active && <IconButton icon="stop" label="Stop the meeting" variant="danger" onClick={() => onStop(run.id)} />}
        {run.status === "stopped" && <Button small onClick={() => onRetry(run.id)}>Try again</Button>}
        {!active && <Button small variant={confirmDelete ? "danger" : "ghost"} onClick={() => { if (!confirmDelete) { setConfirmDelete(true); return; } setConfirmDelete(false); onRemove(run.id); }}>{confirmDelete ? "Yes, delete it" : "Delete"}</Button>}
        <Button small variant="quiet" onClick={onPlans}>Workflows</Button>
      </div>
      <Steps run={run} sessions={sessions} />
      <Chat run={run} sessions={sessions} dispatch={dispatch} />
      <Say run={run} onSay={onSay} />
    </div>
  );
}

/** Who is in the meeting and where it stands: one chip for each step, with the person's face. */
function Steps({ run, sessions }: { run: Run; sessions: Record<string, Session> }) {
  return (
    <ol aria-label="The steps" className="m-0 flex shrink-0 list-none gap-2 overflow-x-auto border-b border-line-subtle px-8 py-2">
      {run.steps.map((s, n) => {
        const ses = s.sessionId ? sessions[s.sessionId] : undefined;
        const state: GlyphState = s.status === "working" && ses?.run === "waiting" ? "waiting" : STEP_STATE[s.status];
        return (
          <li key={s.stepId} aria-current={s.status === "working" ? "step" : undefined}
            className={`flex shrink-0 items-center gap-2 border px-2.5 py-1.5 ${s.status === "working" ? "border-accent bg-surface-2" : "border-line-subtle bg-surface-1"}`}>
            <RoleMark roleId={s.role} size={20} />
            <span className="flex flex-col"><span className="text-[13px] leading-4 font-bold">{n + 1}. {s.title}</span><span className="text-[12px] leading-4 text-text-tertiary">{s.who}</span></span>
            <Glyph state={state} size={14} />
          </li>
        );
      })}
    </ol>
  );
}

function Chat({ run, sessions, dispatch }: { run: Run; sessions: Record<string, Session>; dispatch: (a: any) => void }) {
  const lines = useMemo(() => buildChat(run, sessions), [run, sessions]);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // the chat follows the newest line unless the owner has scrolled up to read
  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [lines]);
  const sessionOf = (step: number) => run.steps[step]?.sessionId ?? "";
  const answer = async (step: number, it: Extract<Line, { kind: "card" }>["item"], allow: boolean, remember?: unknown[]) => {
    if (it.kind !== "permission") return;
    dispatch({ type: "permission-answered", sessionId: sessionOf(step), requestId: it.requestId, allowed: allow });
    await invoke("answer_permission", { sessionId: sessionOf(step), requestId: it.requestId, allow, input: allow ? it.input : null, message: allow ? null : "The owner said no.", remember: allow && remember ? remember : null });
  };
  const question = async (step: number, it: Extract<Line, { kind: "card" }>["item"], answers: Record<string, string> | null) => {
    if (it.kind !== "question") return;
    dispatch({ type: "question-answered", sessionId: sessionOf(step), requestId: it.requestId, answers });
    await invoke("answer_permission", { sessionId: sessionOf(step), requestId: it.requestId, allow: answers !== null, input: answers ? { ...(it.input as object), answers } : null, message: answers ? null : "The owner chose not to answer this question.", remember: null });
  };
  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 py-5" role="log" aria-label="The meeting"
      onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {lines.map((l) => <Row key={l.id} line={l} answer={answer} question={question} />)}
    </div>
  );
}

function Row({ line: l, answer, question }: { line: Line; answer: (step: number, it: any, allow: boolean, remember?: unknown[]) => void; question: (step: number, it: any, a: Record<string, string> | null) => void }) {
  if (l.kind === "divider") return <div className="flex items-center gap-3 pt-2 text-[13px] leading-5 font-bold text-text-secondary"><span className="h-px flex-1 bg-line-subtle" />{l.text}<span className="h-px flex-1 bg-line-subtle" /></div>;
  if (l.kind === "handover") return <div className="flex items-center justify-center gap-2 text-[13px] leading-5 text-text-tertiary"><Glyph state="done" size={14} />{l.text}</div>;
  if (l.kind === "note") return <div className={`flex items-start gap-2.5 text-[13px] leading-5 ${l.tone === "problem" ? "text-state-left" : "text-text-tertiary"}`}><Glyph state={l.tone === "problem" ? "left" : "stopped"} size={16} /><span className="whitespace-pre-wrap">{l.text}</span></div>;
  if (l.kind === "you") return <div className="flex justify-end"><div className="flex max-w-[560px] flex-col gap-1 bg-surface-3 px-4 py-3"><span className="font-pixel text-[12px] leading-4 font-bold text-text-tertiary">You</span><span className="whitespace-pre-wrap">{l.text}</span></div></div>;
  if (l.kind === "tools") return <Tools tools={l.tools} />;
  if (l.kind === "working") return <div className="flex items-center gap-2.5" role="status" aria-label={`${l.who} is working`}><Glyph state="live" size={16} color="var(--color-brand)" /><span className="kona-shimmer text-[14px] leading-5">{l.who} is working…</span></div>;
  if (l.kind === "card") {
    return l.item.kind === "permission"
      ? <PermissionCard it={l.item} who={l.who} onAnswer={(a, r) => answer(l.step, l.item, a, r)} />
      : <QuestionCard it={l.item} who={l.who} onAnswer={(a) => question(l.step, l.item, a)} />;
  }
  return (
    <div className="flex max-w-[calc(980px*var(--k))] items-start gap-3">
      <RoleMark roleId={l.role} size={28} />
      <div className="flex min-w-0 flex-1 flex-col gap-1"><span className="font-pixel text-[13px] leading-4 font-bold text-text-tertiary">{l.who}</span><Markdown chat text={l.text} wiki={false} /></div>
    </div>
  );
}

function Tools({ tools }: { tools: { name: string; status: string; summary: string }[] }) {
  const [open, setOpen] = useState(false);
  const failed = tools.filter((t) => t.status === "error" || t.status === "denied").length;
  return (
    <div className="ml-10 flex max-w-[calc(980px*var(--k))] flex-col gap-1">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-2 self-start text-[13px] leading-5 text-text-secondary hover:text-text">
        <Glyph state={failed > 0 ? "left" : "done"} size={14} />{tools.length} {tools.length === 1 ? "tool use" : "tool uses"}{failed > 0 ? `, ${failed} failed` : ""}
      </button>
      {open && <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pl-6">{tools.map((t, i) => <li key={i} className="truncate font-mono text-[12px] leading-5 text-text-tertiary">{t.name}{t.summary ? `: ${t.summary}` : ""}</li>)}</ul>}
    </div>
  );
}

function Say({ run, onSay }: { run: Run; onSay: MeetingProps["onSay"] }) {
  const [text, setText] = useState("");
  const [line, setLine] = useState<string | null>(null);
  const active = run.status === "running";
  const send = async () => {
    const t = text.trim();
    if (!t || !active) return;
    if (/PRIVATE KEY-----/.test(t)) { setLine("The message holds the text of a private key. Keys stay in their files; give the path, never the key."); return; }
    setText("");
    try { const who = await onSay(run.id, t); setLine(who ? `Sent to ${who}.` : "Nobody is left to hear it."); }
    catch (e) { setLine(String(e).replace(/^Error:\s*/, "")); }
  };
  if (!active) return null;
  return (
    <div className="flex shrink-0 flex-col gap-1 border-t border-line-subtle px-8 py-3">
      <div className="flex items-end gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Say something to the meeting" placeholder="Say something to the meeting"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          className="min-w-0 flex-1 border border-line-strong bg-inset px-3.5 py-2.5 text-[15px] leading-6 text-text placeholder:text-text-tertiary" />
        <IconButton icon="send" label="Send to the meeting" variant="primary" disabled={text.trim() === ""} onClick={() => void send()} />
      </div>
      {line && <span role="status" className="text-[13px] leading-5 text-text-tertiary">{line}</span>}
    </div>
  );
}

