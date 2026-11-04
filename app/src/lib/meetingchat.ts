// The meeting chat (decision 78 of kona-space-app.md): one chat for a whole run, in which what each person says piles up in the order it was said, as in a group chat. Behind it every
// person is still their own session; this file turns the steps of a run and their sessions into the lines of the one chat. A step that is being worked on reads from its live session;
// a step that is over reads from the lines saved with it, so the chat can be read again after Kona was closed. The sums are here so they can be tested.
import type { Item, Session } from "./sessions.ts";
import { keepLog, type Run, type RunStep, type SavedLine } from "./workflowrun.ts";

export type ToolUse = { name: string; status: string; summary: string };
export type Line =
  | { kind: "divider"; id: string; step: number; text: string }
  | { kind: "say"; id: string; step: number; who: string; role: string; text: string }
  | { kind: "you"; id: string; text: string }
  | { kind: "tools"; id: string; step: number; tools: ToolUse[] }
  /** a permission or a question that is waiting for the owner (or was answered): it can be answered right in the chat */
  | { kind: "card"; id: string; step: number; who: string; item: Extract<Item, { kind: "permission" | "question" }> }
  | { kind: "handover"; id: string; text: string }
  | { kind: "note"; id: string; text: string; tone: "info" | "problem" }
  | { kind: "working"; id: string; step: number; who: string };

/** The lines of one session, as they are kept with a step: the briefing (the first thing said to the person, written by Kona) is left out; what the owner said, what the person wrote, a run of tool uses folded into one line. */
export function savedLinesOf(items: Item[], draft = ""): SavedLine[] {
  const out: SavedLine[] = [];
  let firstUser = true;
  for (const it of items) {
    if (it.kind === "user") {
      if (firstUser) { firstUser = false; continue; }
      if (it.text.trim()) out.push({ k: "you", text: it.text });
    } else if (it.kind === "assistant") {
      if (it.text.trim()) out.push({ k: "say", text: it.text });
    } else if (it.kind === "tool") {
      const last = out[out.length - 1];
      const use = { name: it.name, status: it.status, summary: it.summary };
      if (last?.k === "tools") last.tools = [...(last.tools ?? []), use];
      else out.push({ k: "tools", tools: [use] });
    } else if (it.kind === "note" && it.tone === "problem") {
      out.push({ k: "note", text: it.text, tone: "problem" });
    }
  }
  if (draft.trim()) out.push({ k: "say", text: draft });
  return out;
}

/** What to keep with a step that ends: the lines of its session, cut to a size that fits in a file. */
export const logOfSession = (s: Session): SavedLine[] => keepLog(savedLinesOf(s.items, s.draft));

/** One step's lines for the chat, from its live session (with the cards that can still be answered) or from what was kept. */
function stepLines(run: Run, n: number, step: RunStep, session: Session | undefined): Line[] {
  const out: Line[] = [];
  const base = `${run.id}-${n}`;
  const say = (text: string, id: string): Line => ({ kind: "say", id, step: n, who: step.who, role: step.role, text });
  if (session && (step.status === "working" || !step.log)) {
    let firstUser = true;
    for (const it of session.items) {
      if (it.kind === "user") { if (firstUser) { firstUser = false; continue; } if (it.text.trim()) out.push({ kind: "you", id: `${base}-${it.id}`, text: it.text }); }
      else if (it.kind === "assistant") { if (it.text.trim()) out.push(say(it.text, `${base}-${it.id}`)); }
      else if (it.kind === "tool") {
        const last = out[out.length - 1], use = { name: it.name, status: it.status, summary: it.summary };
        if (last?.kind === "tools") last.tools = [...last.tools, use]; else out.push({ kind: "tools", id: `${base}-${it.id}`, step: n, tools: [use] });
      }
      else if (it.kind === "permission" || it.kind === "question") out.push({ kind: "card", id: `${base}-${it.id}`, step: n, who: step.who, item: it });
      else if (it.kind === "note" && it.tone === "problem") out.push({ kind: "note", id: `${base}-${it.id}`, text: it.text, tone: "problem" });
    }
    if (session.draft.trim()) out.push(say(session.draft, `${base}-draft`));
    if (step.status === "working" && session.run === "working") out.push({ kind: "working", id: `${base}-working`, step: n, who: step.who });
    return out;
  }
  (step.log ?? []).forEach((l, k) => {
    const id = `${base}-log${k}`;
    if (l.k === "say" && l.text) out.push(say(l.text, id));
    else if (l.k === "you" && l.text) out.push({ kind: "you", id, text: l.text });
    else if (l.k === "tools" && l.tools?.length) out.push({ kind: "tools", id, step: n, tools: l.tools });
    else if (l.k === "note" && l.text) out.push({ kind: "note", id, text: l.text, tone: l.tone ?? "info" });
  });
  // a step that was finished with no lines kept (an older record) still shows what it handed over
  if (out.length === 0 && step.result) out.push(say(step.result, `${base}-result`));
  return out;
}

/** The whole chat of a run, top to bottom. `sessions` are the live sessions by id (a step whose session is gone reads from its saved lines). */
export function buildChat(run: Run, sessions: Record<string, Session | undefined>): Line[] {
  const out: Line[] = [{ kind: "note", id: `${run.id}-start`, tone: "info", text: `${run.name}: ${run.steps.length} ${run.steps.length === 1 ? "step" : "steps"}, one after another.` }];
  run.steps.forEach((step, n) => {
    if (step.status === "waiting" && !step.log) return;
    out.push({ kind: "divider", id: `${run.id}-${n}-div`, step: n, text: `${n + 1}. ${step.title} (${step.who})` });
    out.push(...stepLines(run, n, step, step.sessionId ? sessions[step.sessionId] : undefined));
    if (step.status === "failed" || step.status === "stopped") out.push({ kind: "note", id: `${run.id}-${n}-end`, tone: "problem", text: step.error ?? (step.status === "stopped" ? "Stopped." : "This step could not be finished.") });
    const next = run.steps[n + 1];
    if (step.status === "done" && next) out.push({ kind: "handover", id: `${run.id}-${n}-hand`, text: `${step.who} handed over to ${next.who}.` });
  });
  // what the owner said to a person whose turn has not come yet (it is in their briefing when they start)
  run.steps.forEach((step, n) => { if (step.status === "waiting") (step.notes ?? []).forEach((note, k) => out.push({ kind: "you", id: `${run.id}-${n}-note${k}`, text: `To ${step.who}, for their turn: ${note}` })); });
  if (run.status === "done") out.push({ kind: "note", id: `${run.id}-end`, tone: "info", text: "The meeting is over: every step is done." });
  return out;
}

/** Who a message of the owner is for: a name at the start ("Jiro, use PostgreSQL", "@Jiro use PostgreSQL" or "Jiro: use PostgreSQL") picks that person if they are in the run; otherwise it is for whoever is working now. */
export function addressee(run: Run, text: string): { step: number; text: string } | null {
  const t = text.trim();
  const m = /^@?([\p{L}][\p{L}'-]*)\s*[,:]?\s+([\s\S]+)$/u.exec(t);
  if (m) {
    const name = m[1].toLowerCase();
    const n = run.steps.findIndex((s, i) => (s.who.toLowerCase() === name || s.who.toLowerCase().split(/[\s,]+/)[0] === name) && (s.status === "working" || s.status === "waiting") && i >= 0);
    if (n >= 0) return { step: n, text: m[2].trim() };
  }
  const now = run.steps.findIndex((s) => s.status === "working");
  if (now >= 0) return { step: now, text: t };
  const next = run.steps.findIndex((s) => s.status === "waiting");
  return next >= 0 ? { step: next, text: t } : null;
}
