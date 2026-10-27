// What the screen knows about each session, built from the messages Claude Code streams (see src-tauri/src/session.rs).
// The messages are forwarded unchanged; this file turns them into things to draw. Unknown records are ignored, because
// the stream format is not documented and can change (risk 4 in the plan).

export type RunState = "starting" | "ready" | "working" | "waiting" | "ended";

export type Item =
  | { kind: "user"; id: string; text: string; images: string[] }
  | { kind: "assistant"; id: string; text: string }
  | { kind: "tool"; id: string; toolUseId: string; name: string; summary: string; status: "running" | "done" | "error" | "denied"; preview?: string }
  | { kind: "permission"; id: string; requestId: string; toolName: string; description: string; command?: string; where?: string; input: unknown; status: "asking" | "allowed" | "denied" }
  | { kind: "note"; id: string; text: string; tone: "info" | "problem" };

export type PlanWindow = { utilization: number; resetsAt: number };

export type Session = {
  id: string;
  folder: string;
  roleId: string | null; // the role it runs as, if any
  accountId: string; // the Claude login it runs on
  voice: boolean; // the voice is on for this session
  endedLine: string; // what Kona says when it ends, in the voice if it is on
  model: string;
  mode: string;
  title: string; // the first thing you asked, shortened
  run: RunState;
  items: Item[];
  draft: string; // text that is still arriving
  costTotal: number; // dollars so far, an estimate at list price
  costLast: number; // dollars the last turn added
  turns: number;
};

/** The two plan bars of one account, and when they were last read. Each account has its own limits. */
export type Plan = { fiveHour?: PlanWindow; sevenDay?: PlanWindow; at: number };

export type State = {
  sessions: Record<string, Session>;
  order: string[];
  selected: string | null;
  plans: Record<string, Plan>; // by account id
};

// the last readings are kept, so the bars are not empty when Kona opens
export function loadPlans(): Record<string, Plan> {
  try { return JSON.parse(localStorage.getItem("kona.plans") ?? "{}"); } catch { return {}; }
}
export function savePlans(p: Record<string, Plan>) {
  try { localStorage.setItem("kona.plans", JSON.stringify(p)); } catch { /* the readings are just not kept */ }
}

export const initialState: State = { sessions: {}, order: [], selected: null, plans: {} };

export type Action =
  | { type: "event"; sessionId: string; record: any }
  | { type: "select"; id: string }
  | { type: "user-sent"; sessionId: string; text: string; images: string[] }
  | { type: "permission-answered"; sessionId: string; requestId: string; allowed: boolean }
  | { type: "forget"; id: string };

let counter = 0;
const nextId = (p: string) => `${p}-${++counter}`;

const MODE_WORDS: Record<string, string> = { default: "Ask every time", acceptEdits: "Edits free, commands asked", plan: "Plan only" };
export const modeWord = (m: string) => MODE_WORDS[m] ?? m;

/** One plain line for a tool call, shown in the transcript. */
export function summarize(name: string, input: any): string {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  switch (name) {
    case "Bash": return s(input?.command).split("\n")[0].slice(0, 140);
    case "Read": case "Write": case "Edit": case "MultiEdit": case "NotebookEdit": return s(input?.file_path);
    case "Glob": case "Grep": return s(input?.pattern);
    case "WebFetch": return s(input?.url);
    case "WebSearch": return s(input?.query);
    default: return s(input?.description) || "";
  }
}

/** Plain-words title for the "may I run this?" card. */
export function permissionTitle(toolName: string): string {
  if (toolName === "Bash" || toolName === "PowerShell") return "Claude wants to run a command";
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) return "Claude wants to change a file";
  if (toolName === "Read") return "Claude wants to read a file";
  if (toolName === "WebFetch" || toolName === "WebSearch") return "Claude wants to look something up on the web";
  return `Claude wants to use ${toolName}`;
}

function update(state: State, id: string, f: (s: Session) => Session): State {
  const s = state.sessions[id];
  if (!s) return state;
  return { ...state, sessions: { ...state.sessions, [id]: f(s) } };
}

const push = (s: Session, item: Item): Session => ({ ...s, items: [...s.items, item] });

export function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "select": return { ...state, selected: a.id };
    case "forget": {
      const { [a.id]: _gone, ...rest } = state.sessions;
      const order = state.order.filter((x) => x !== a.id);
      return { ...state, sessions: rest, order, selected: state.selected === a.id ? order[0] ?? null : state.selected };
    }
    case "user-sent":
      return update(state, a.sessionId, (s) => ({ ...push(s, { kind: "user", id: nextId("u"), text: a.text, images: a.images }), title: s.title || a.text.replace(/s+/g, " ").slice(0, 48), run: "working", draft: "" }));
    case "permission-answered":
      return update(state, a.sessionId, (s) => ({
        ...s,
        run: "working",
        items: s.items.map((it) => (it.kind === "permission" && it.requestId === a.requestId ? { ...it, status: a.allowed ? "allowed" : "denied" } : it)),
      }));
    case "event": return onEvent(state, a.sessionId, a.record);
  }
}

function onEvent(state: State, sessionId: string, r: any): State {
  const type: string = r?.type ?? "";

  if (type === "kona/started") {
    const session: Session = { id: sessionId, folder: r.folder, roleId: r.roleId ?? null, accountId: r.accountId ?? "main", voice: !!r.voice, endedLine: r.lines?.ended ?? "This session has ended.", model: r.model, mode: r.mode, title: "", run: "ready", items: r.lines?.started ? [{ kind: "note", id: nextId("n"), tone: "info", text: r.lines.started }] : [], draft: "", costTotal: 0, costLast: 0, turns: 0 };
    return { ...state, sessions: { ...state.sessions, [sessionId]: session }, order: [...state.order, sessionId], selected: sessionId };
  }
  if (type === "rate_limit_event") {
    const w = r.rate_limit_info?.unifiedWindows ?? {};
    const pick = (x: any): PlanWindow | undefined => (x && typeof x.utilization === "number" ? { utilization: x.utilization, resetsAt: x.resetsAt } : undefined);
    const account = state.sessions[sessionId]?.accountId ?? "main";
    const before = state.plans[account];
    return { ...state, plans: { ...state.plans, [account]: { fiveHour: pick(w.five_hour) ?? before?.fiveHour, sevenDay: pick(w.seven_day) ?? before?.sevenDay, at: Date.now() } } };
  }

  return update(state, sessionId, (s) => {
    switch (type) {
      case "stream_event": {
        const e = r.event;
        if (e?.type === "message_start") return { ...s, draft: "" };
        if (e?.type === "content_block_delta" && e.delta?.type === "text_delta") return { ...s, draft: s.draft + e.delta.text };
        return s;
      }
      case "assistant": {
        let next = s;
        const blocks: any[] = r.message?.content ?? [];
        blocks.forEach((b, i) => {
          if (b.type === "text" && b.text?.trim()) next = push(next, { kind: "assistant", id: `${r.uuid ?? nextId("a")}-${i}`, text: b.text });
          if (b.type === "tool_use") next = push(next, { kind: "tool", id: `t-${b.id}`, toolUseId: b.id, name: b.name, summary: summarize(b.name, b.input), status: "running" });
        });
        return { ...next, draft: blocks.some((b) => b.type === "text") ? "" : next.draft };
      }
      case "user": {
        const blocks: any[] = Array.isArray(r.message?.content) ? r.message.content : [];
        let items = s.items;
        for (const b of blocks) {
          if (b.type !== "tool_result") continue;
          const text = typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.map((c: any) => c.text ?? "").join(" ") : "";
          items = items.map((it) => (it.kind === "tool" && it.toolUseId === b.tool_use_id ? { ...it, status: b.is_error ? (/said no|denied|permission/i.test(text) ? "denied" : "error") : "done", preview: text.slice(0, 240) } : it));
        }
        return { ...s, items };
      }
      case "control_request": {
        const q = r.request;
        if (q?.subtype !== "can_use_tool") return s;
        const input = q.input ?? {};
        return {
          ...push(s, {
            kind: "permission", id: nextId("p"), requestId: r.request_id, toolName: q.tool_name, description: q.description ?? "",
            command: typeof input.command === "string" ? input.command : typeof input.file_path === "string" ? input.file_path : undefined,
            where: s.folder, input, status: "asking",
          }),
          run: "waiting",
        };
      }
      case "result": {
        const total = typeof r.total_cost_usd === "number" ? r.total_cost_usd : s.costTotal;
        let next: Session = { ...s, run: "ready", draft: "", costTotal: total, costLast: r.kona_turn_cost_usd ?? 0, turns: s.turns + 1 };
        if (r.is_error) next = push(next, { kind: "note", id: nextId("n"), tone: "problem", text: typeof r.result === "string" && r.result ? r.result : "Claude stopped with an error." });
        return next;
      }
      case "kona/stderr": {
        const text: string = r.text ?? "";
        return text.trim() ? push(s, { kind: "note", id: nextId("n"), tone: "problem", text }) : s;
      }
      case "kona/exited":
        return { ...push(s, { kind: "note", id: nextId("n"), tone: "info", text: s.endedLine }), run: "ended" };
      default:
        return s;
    }
  });
}

export const dollars = (n: number) => `$${n.toFixed(4)}`;
