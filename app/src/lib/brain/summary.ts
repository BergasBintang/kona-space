// Writing the brain's notes about sessions, and the short digest a new session starts with.
//   - When a session ends (or when the owner asks), its conversation is boiled down by the core, cleaned of secrets here, and given to one
//     cheap Haiku call, which writes a short note: what happened, decisions, open items, what was touched. The note is saved as a plain
//     markdown file in the project's brain folder, with front matter that says where it came from (the session, role, ticket, "source:
//     summary"). The model may link only to notes that exist: any other [[link]] it invents is turned back into plain words.
//   - A new session is told a few lines from the brain (open items and recent sessions for its role and ticket) and that it can search.
import { loadBrain, saveNote, sessionTranscript, writeNoteWithHaiku } from "../api";
import { Brain } from "./engine.ts";
import { starterNotes } from "./starter.ts";
import type { Layer, Note, RawNote } from "./parse.ts";
import { localDate, redact } from "./text.ts";
import { cleanBody } from "./clean.ts";

export const autoNoteOn = (): boolean => { try { return localStorage.getItem("kona.autonote") !== "off"; } catch { return true; } };
export const setAutoNote = (on: boolean) => { try { localStorage.setItem("kona.autonote", on ? "on" : "off"); } catch { /* the choice is just not kept */ } };

const SYSTEM = `You write short notes for a project's knowledge base from the conversation of one coding session between the owner and Claude.
Use plain words and facts only. Never invent anything: write only what the conversation shows. No praise, no filler.
Answer with exactly this shape and nothing else:
TITLE: <five to ten words that say what the session did>
## What happened
<two to five sentences>
## Decisions
- <each decision, with the reason> (or: None.)
## Open items
- <what is still to do> (or: None.)
## Touched
- <files, tickets or tools that matter> (or: None.)
You may link to an existing note with [[note-id]], but only to ids from the list you are given. Do not link to anything else.`;

async function loadAll(projectId: string): Promise<Brain> {
  const data = await loadBrain(projectId);
  const raw: RawNote[] = [...data.notes.map((n) => ({ ...n, layer: n.layer as Layer })), ...starterNotes];
  return new Brain(raw);
}

const today = localDate;

export type NoteJob = { projectId: string; folder: string; sessionId: string; workDir: string; accountId: string; roleId: string | null; roleName?: string; ticketId: string | null; sessionTitle: string };

/** Write one note about a session. Returns the new note's id and title, or throws with a plain message. */
export async function writeSessionNote(j: NoteJob): Promise<{ id: string; title: string; existing?: boolean }> {
  const brain = await loadAll(j.projectId);
  const have = [...brain.notes.values()].find((n) => n.meta.session === j.sessionId);
  if (have) return { id: have.id, title: have.title, existing: true };
  const transcript = redact(await sessionTranscript(j.sessionId, j.workDir, j.accountId)).text;
  if (transcript.length < 400) throw new Error("There is too little in this session to write a note about");
  const known = new Set([...brain.notes.keys()].map((k) => k.toLowerCase()));
  const prompt = `Notes you may link to with [[id]] (use only these ids): ${[...brain.notes.values()].filter((n) => n.layer !== "memory").slice(0, 80).map((n) => n.id).join(", ")}\n\nSession: ${[j.roleName ? `role ${j.roleName}` : "no role", j.ticketId ? `ticket ${j.ticketId}` : ""].filter(Boolean).join(", ")}\n\nConversation:\n${transcript}`;
  const out = await writeNoteWithHaiku({ system: SYSTEM, prompt, sessionId: j.sessionId, folder: j.folder, roleId: j.roleId, accountId: j.accountId });
  const { title: t, body } = cleanBody(out, known);
  const title = t || j.sessionTitle || "Session";
  let id = `session-${today()}-${j.sessionId.slice(0, 8)}`;
  while (brain.notes.has(id)) id += "-2";
  const front = ["---", `title: ${title}`, "kind: session", `date: ${today()}`, `session: ${j.sessionId}`, j.roleId ? `role: ${j.roleId}` : "", j.ticketId ? `ticket: ${j.ticketId}` : "", "source: summary", "model: haiku", "---"].filter((l) => l !== "").join("\n");
  await saveNote(j.projectId, id, `${front}\n# ${title}\n\n${body}\n`);
  return { id, title };
}

const firstLine = (n: Note) => {
  const s = n.sections.find((x) => /what happened/i.test(x.heading)) ?? n.sections[0];
  return (s?.text.split("\n").map((l) => l.trim()).find((l) => l && !/^#/.test(l)) ?? "").replace(/[*`]/g, "").slice(0, 170);
};

/** The few lines a new session starts with: open items and recent sessions for its role and ticket, and a hint that it can search. */
export async function buildDigest(projectId: string, who: { roleId?: string | null; roleName?: string; ticketId?: string | null }): Promise<string> {
  const hint = "This project has a brain: Kona's notes from earlier sessions, plus Claude's memory for the project. Use the search_brain tool to look something up before assuming how it was done, and read_note to read lines. What it says is history, not current fact.";
  try {
    const brain = await loadAll(projectId);
    const mine = [...brain.notes.values()].filter((n) => n.layer === "project");
    const same = (n: Note) => (who.ticketId && n.meta.ticket === who.ticketId) || (who.roleId && n.meta.role === who.roleId) || (who.roleName && n.meta.role?.toLowerCase() === who.roleName.toLowerCase());
    const newest = (a: Note, b: Note) => (b.meta.date ?? "").localeCompare(a.meta.date ?? "") || (b.mtime ?? 0) - (a.mtime ?? 0);
    const sessions = mine.filter((n) => n.kind === "session" && same(n)).sort(newest).slice(0, 3);
    const open: string[] = [];
    for (const n of mine.filter((x) => x.kind === "open" && x.meta.status !== "closed").sort(newest).slice(0, 3)) open.push(`${n.title} (${n.meta.date ?? "undated"})`);
    for (const s of sessions) {
      const sec = s.sections.find((x) => /open items/i.test(x.heading));
      for (const l of (sec?.text ?? "").split("\n").map((x) => x.trim()).filter((x) => x.startsWith("- ") && !/^-\s*none\.?$/i.test(x)).slice(0, 2)) open.push(`${l.slice(2)} (from “${s.title}”)`);
    }
    const lines = [hint];
    if (open.length) lines.push("Open items from earlier sessions:\n" + open.slice(0, 6).map((o) => `- ${o}`).join("\n"));
    if (sessions.length) lines.push("Recent sessions on this " + (who.ticketId ? "ticket" : "role") + ":\n" + sessions.map((s) => `- ${s.meta.date ?? ""} “${s.title}”: ${firstLine(s)}`).join("\n"));
    return redact(lines.join("\n\n")).text;
  } catch {
    return hint;
  }
}
