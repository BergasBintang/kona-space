// A workflow that runs by itself (decision 78 of kona-space-app.md). The steps of a workflow are done one after another, in the order they are listed: each step is one person (a role)
// who works in a fresh session, and when they finish, their written result is handed to the next person. No tickets are made and the Board is not touched. The record of a run
// (this file's `Run`) is kept by the core as one plain file per run. The sums are here, apart from the screen, so they can be tested.
import type { Workflow } from "./api.ts";

/** One line of what a person said in the meeting, kept with the step so the chat can be read again after Kona was closed: what they wrote, what the owner wrote, a folded run of tool uses, a problem. */
export type SavedLine = { k: "say" | "you" | "tools" | "note"; text?: string; tools?: { name: string; status: string; summary: string }[]; tone?: "info" | "problem" };
export const LOG_MAX_LINES = 80;
export const LOG_MAX_CHARS = 40000;

export type StepStatus = "waiting" | "working" | "done" | "failed" | "stopped";
export type RunStatus = "running" | "done" | "stopped";

export type RunStep = {
  stepId: string; title: string; role: string; note: string; after: string[];
  /** the name of the person, as it was when the run started */
  who: string;
  status: StepStatus;
  sessionId?: string;
  /** what the person wrote at the end: this is what the next person is given */
  result?: string;
  /** why a step failed or stopped, in plain words */
  error?: string;
  cost: number;
  /** what the owner said in the meeting to this person before their step began: it is put in their briefing */
  notes?: string[];
  /** what was said during the step, kept when it ends */
  log?: SavedLine[];
  startedAt?: number;
  endedAt?: number;
};

export type Run = {
  id: string; workflowId: string; name: string;
  status: RunStatus;
  startedAt: number; endedAt?: number;
  steps: RunStep[];
};

/** the longest result that is handed on and kept: a long reply is cut, and says so */
export const RESULT_MAX = 6000;

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const letters = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A run for a workflow, all its steps waiting, in the order they are listed. `who` turns a role id into the person's name. */
export function newRun(w: Workflow, who: (role: string) => string, now = Date.now(), rnd: () => number = Math.random): Run {
  const d = new Date(now);
  const tag = Array.from({ length: 4 }, () => letters[Math.floor(rnd() * letters.length) % letters.length]).join("");
  return {
    id: `run-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${tag}`,
    workflowId: w.id, name: w.name, status: "running", startedAt: now,
    steps: w.steps.map((s) => ({ stepId: s.id, title: s.title, role: s.role, note: s.note ?? "", after: [...s.after], who: who(s.role), status: "waiting" as const, cost: 0 })),
  };
}

export const isActive = (r: Run): boolean => r.status === "running";
export const totalCost = (r: Run): number => r.steps.reduce((n, s) => n + (s.cost || 0), 0);
export const doneCount = (r: Run): number => r.steps.filter((s) => s.status === "done").length;
/** the step that is being worked on now */
export const workingIndex = (r: Run): number => r.steps.findIndex((s) => s.status === "working");
/** the next step to start: the first one still waiting, if nothing is being worked on */
export const nextIndex = (r: Run): number => (workingIndex(r) >= 0 ? -1 : r.steps.findIndex((s) => s.status === "waiting"));

/** What a person wrote at the end of their turn: the last thing Claude said, cut to RESULT_MAX. Items are the session's items, in order. */
export function lastReply(items: { kind: string; text?: string }[]): string {
  let text = "";
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.kind === "user") break;
    if (it.kind === "assistant" && typeof it.text === "string" && it.text.trim() !== "") { text = it.text.trim(); break; }
  }
  return text.length > RESULT_MAX ? text.slice(0, RESULT_MAX).trimEnd() + "\n\n[The rest was cut: this result was longer than " + RESULT_MAX + " characters.]" : text;
}

/** The results of the steps that step `i` comes after, as far as they are done: what the person is handed. */
export function handedOver(r: Run, i: number): { step: RunStep; number: number }[] {
  const me = r.steps[i];
  return r.steps.flatMap((s, n) => (me.after.includes(s.stepId) && s.status === "done" ? [{ step: s, number: n + 1 }] : []));
}

/** The first message to the person of step `i`. It says where they are in the chain, hands over what the people before them wrote, and asks for a written result at the end. */
export function stepPrompt(r: Run, i: number): string {
  const me = r.steps[i], last = i === r.steps.length - 1;
  const list = r.steps.map((s, n) => `${n + 1}. ${s.title} (${s.who})${n === i ? "  <- you" : ""}`).join("\n");
  const given = handedOver(r, i);
  const before = given.length === 0
    ? (me.after.length === 0 ? "Nothing was handed over: your step comes first." : "The people before you left no written result. Look at the project itself to see what was done.")
    : given.map((h) => `--- From step ${h.number}, ${h.step.title} (${h.step.who}) ---\n${h.step.result?.trim() || "(no written result)"}\n---`).join("\n\n");
  return [
    `You are one person in a small team. You have one step of a workflow that runs by itself: "${r.name}". Each person finishes their own step and hands a written result to the next person. Nobody is watching each step, so do the work and do not stop to ask what to do next.`,
    `The steps, in order:\n${list}`,
    `Your step (number ${i + 1} of ${r.steps.length}): ${me.title}${me.note.trim() ? `\n${me.note.trim()}` : ""}`,
    ...((me.notes ?? []).length > 0 ? [`What the owner said in the meeting for you, before your turn:\n${(me.notes ?? []).map((n) => `- ${n}`).join("\n")}`] : []),
    `What the people before you handed over:\n${before}`,
    `Work in this project folder. Do only your own step: the people after you do theirs. If you truly need an answer from the owner, ask with the question tool, and do not end your turn with a question in plain text.`,
    `When you are done, end with a written result for ${last ? "the owner, since yours is the last step: it is the result of the whole workflow" : "the next person"}, in plain words: what you did, what you decided and why, which files you made or changed, and what is still open. Keep it under 300 words. Those last words are all that is handed on.`,
  ].join("\n\n");
}

// The changes of a run. Each returns a new run; the one that was given is never changed.
const setStep = (r: Run, i: number, patch: Partial<RunStep>): Run => ({ ...r, steps: r.steps.map((s, n) => (n === i ? { ...s, ...patch } : s)) });

export const startStep = (r: Run, i: number, now = Date.now()): Run => setStep(r, i, { status: "working", startedAt: now, endedAt: undefined, error: undefined, sessionId: undefined });
export const attachSession = (r: Run, i: number, sessionId: string): Run => setStep(r, i, { sessionId });
export const finishStep = (r: Run, i: number, result: string, cost: number, now = Date.now(), log?: SavedLine[]): Run => setStep(r, i, { status: "done", result, cost, endedAt: now, ...(log ? { log } : {}) });
/** Something the owner said to a person whose turn has not come: it goes in their briefing. */
export const addNote = (r: Run, i: number, text: string): Run => setStep(r, i, { notes: [...(r.steps[i].notes ?? []), text.trim().slice(0, 1000)].slice(-10) });
/** What a step keeps when it ends or stops: the lines, cut to a size that fits a file. */
export function keepLog(lines: SavedLine[]): SavedLine[] {
  const out: SavedLine[] = [];
  let chars = 0;
  for (const l of lines.slice(-LOG_MAX_LINES)) {
    const text = l.text !== undefined ? l.text.slice(0, RESULT_MAX) : undefined;
    chars += (text?.length ?? 0) + (l.tools ?? []).reduce((n, t) => n + t.name.length + t.summary.length, 0);
    if (chars > LOG_MAX_CHARS) break;
    out.push({ ...l, ...(text !== undefined ? { text } : {}), ...(l.tools ? { tools: l.tools.slice(0, 40).map((t) => ({ name: t.name.slice(0, 40), status: t.status.slice(0, 12), summary: t.summary.slice(0, 160) })) } : {}) });
  }
  return out;
}

/** The run is over: every step is done (`done`), or it is cut short (`stopped`). */
export function failStep(r: Run, i: number, error: string, now = Date.now()): Run {
  return { ...setStep(r, i, { status: "failed", error, endedAt: now }), status: "stopped", endedAt: now };
}
export function stopRun(r: Run, now = Date.now()): Run {
  const i = workingIndex(r);
  const run = i >= 0 ? setStep(r, i, { status: "stopped", error: "Stopped by you.", endedAt: now }) : r;
  return { ...run, status: "stopped", endedAt: now };
}
export const completeRun = (r: Run, now = Date.now()): Run => ({ ...r, status: "done", endedAt: now });

/** Try again: the step that failed or was stopped goes back to waiting and the run goes on from there. Steps already done keep their results. */
export function retryRun(r: Run): Run {
  const steps = r.steps.map((s) => (s.status === "failed" || s.status === "stopped" ? { ...s, status: "waiting" as const, error: undefined, sessionId: undefined, endedAt: undefined } : s));
  return { ...r, steps, status: "running", endedAt: undefined };
}

/** A run that was still running when Kona was closed has no session any more: it is shown as stopped. */
export function markStale(r: Run, now = Date.now()): Run {
  if (r.status !== "running") return r;
  const i = workingIndex(r);
  const run = i >= 0 ? setStep(r, i, { status: "stopped", error: "Kona was closed while this step was being done.", endedAt: now }) : r;
  return { ...run, status: "stopped", endedAt: now };
}

/** Is this record a run that the screen can use? Records come from files, so every part is checked. */
export function readRun(v: unknown): Run | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const str = (x: unknown, max = 400) => (typeof x === "string" ? x.slice(0, max) : null);
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const id = str(o.id, 60), workflowId = str(o.workflowId, 60), name = str(o.name, 120), startedAt = num(o.startedAt);
  if (!id || !workflowId || name === null || startedAt === null || !Array.isArray(o.steps) || o.steps.length === 0 || o.steps.length > 20) return null;
  if (o.status !== "running" && o.status !== "done" && o.status !== "stopped") return null;
  const steps: RunStep[] = [];
  for (const s of o.steps as Record<string, unknown>[]) {
    if (typeof s !== "object" || s === null) return null;
    const stepId = str(s.stepId, 60), title = str(s.title, 160), role = str(s.role, 60), status = s.status;
    if (!stepId || title === null || !role || !["waiting", "working", "done", "failed", "stopped"].includes(String(status))) return null;
    steps.push({
      stepId, title, role, note: str(s.note, 2000) ?? "", after: Array.isArray(s.after) ? s.after.filter((a): a is string => typeof a === "string").slice(0, 20) : [], who: str(s.who, 80) ?? role,
      status: status as StepStatus, sessionId: str(s.sessionId, 80) ?? undefined, result: str(s.result, RESULT_MAX + 200) ?? undefined, error: str(s.error, 400) ?? undefined,
      cost: num(s.cost) ?? 0, startedAt: num(s.startedAt) ?? undefined, endedAt: num(s.endedAt) ?? undefined,
      notes: Array.isArray(s.notes) ? s.notes.filter((n): n is string => typeof n === "string").map((n) => n.slice(0, 1000)).slice(-10) : undefined,
      log: readLog(s.log),
    });
  }
  return { id, workflowId, name, status: o.status, startedAt, endedAt: num(o.endedAt) ?? undefined, steps };
}

function readLog(v: unknown): SavedLine[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SavedLine[] = [];
  for (const l of v.slice(0, LOG_MAX_LINES) as Record<string, unknown>[]) {
    if (typeof l !== "object" || l === null || !["say", "you", "tools", "note"].includes(String(l.k))) continue;
    const tools = Array.isArray(l.tools) ? (l.tools as Record<string, unknown>[]).filter((t) => typeof t === "object" && t !== null).slice(0, 40).map((t) => ({ name: String(t.name ?? "").slice(0, 40), status: String(t.status ?? "").slice(0, 12), summary: String(t.summary ?? "").slice(0, 160) })) : undefined;
    out.push({ k: l.k as SavedLine["k"], ...(typeof l.text === "string" ? { text: l.text.slice(0, RESULT_MAX + 200) } : {}), ...(tools ? { tools } : {}), ...(l.tone === "problem" || l.tone === "info" ? { tone: l.tone } : {}) });
  }
  return out;
}

/** The status of a run in words, for one line */
export function runWords(r: Run, waitingOnYou = false): string {
  if (r.status === "done") return "Done";
  if (r.status === "stopped") return "Stopped";
  return waitingOnYou ? "Waiting on you" : "Running";
}

/** Who sits at the meeting table while a run goes on: everybody whose step has begun (they keep their chair until the run ends). `seatOf` gives each person's chair number. */
export function seatedOf(r: Run | undefined, seatOf: Record<string, number>): Record<string, number> {
  if (!r || r.status !== "running") return {};
  const out: Record<string, number> = {};
  for (const s of r.steps) if (s.status !== "waiting" && seatOf[s.role] !== undefined) out[s.role] = seatOf[s.role];
  return out;
}
