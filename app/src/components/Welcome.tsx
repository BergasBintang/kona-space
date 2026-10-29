// The screen before a session: check that Claude Code is here, pick a folder, start.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button, Glyph, RoleMark } from "./ui";
import { Select } from "./pick";
import { Needs } from "./Needs";
import { accountStatus, PLAIN_LINES, type Account, type Persona, type AccountStatus, type Project, type Role } from "../lib/api";
import { Help } from "./Help";
import { KonaMark } from "./KonaMark";

type ClaudeInfo = { path: string; version: string | null };
const MODELS = [["sonnet", "Sonnet (the usual choice)"], ["opus", "Opus (the most capable, slower)"], ["haiku", "Haiku (the quickest and cheapest)"]];
const MODES = [["default", "Ask every time"], ["acceptEdits", "Edits free, commands asked"], ["plan", "Plan only"]];

const opts = (pairs: string[][]) => pairs.map(([value, label]) => ({ value, label }));

export function Welcome({ project, roles, accounts, persona, accountId, initialRole = null, onStart, onOpenAccounts, error }: {
  initialRole?: Role | null; project: Project; roles: Role[]; accounts: Account[]; persona: Persona; accountId: string; onOpenAccounts: () => void;
  onStart: (folder: string, roleId: string | null, accountId: string, voice: boolean, model: string, mode: string) => Promise<void>; error: string | null;
}) {
  const [claude, setClaude] = useState<ClaudeInfo | "missing" | null>(null);
  const [model, setModel] = useState(initialRole?.model ?? "sonnet");
  const [mode, setMode] = useState(initialRole?.mode ?? "default");
  const [roleId, setRoleId] = useState<string | null>(initialRole?.id ?? null);
  const [signedIn, setSignedIn] = useState<AccountStatus | null>(null); // null while asking
  const [voice, setVoice] = useState(persona.enabled);
  const [busy, setBusy] = useState(false);
  const role = roles.find((r) => r.id === roleId) ?? null;
  const pickRole = (r: Role | null) => { setRoleId(r?.id ?? null); setModel(r?.model ?? "sonnet"); setMode(r?.mode ?? "default"); };

  useEffect(() => { setSignedIn(null); if (!accountId) { setSignedIn({ logged_in: false }); return; } accountStatus(accountId).then(setSignedIn).catch(() => setSignedIn({ logged_in: false })); }, [accountId]);
  useEffect(() => { invoke<ClaudeInfo>("check_claude").then(setClaude).catch(() => setClaude("missing")); }, []);
  const start = async () => { setBusy(true); try { await onStart(project.folder, roleId, accountId, voice, model, mode); } finally { setBusy(false); } };

  return (
    <div className="flex h-full flex-1 overflow-y-auto p-8">
      <div className="m-auto flex w-full max-w-[560px] flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3"><KonaMark size={36} /><h1 className="m-0 text-[30px] leading-[38px] font-bold">Start a session</h1><Help title="Start a session"><p className="m-0">Claude will work inside this project. Nothing leaves this PC except what Claude itself sends to Anthropic.</p></Help></div>
          <p className="m-0 text-[15px] leading-6 text-text-tertiary">{(voice ? persona.lines.greeting : PLAIN_LINES.greeting)}</p>
        </div>

        <div className="flex items-center gap-2.5 text-[13px] leading-5">
          {claude === null && <span className="text-text-tertiary">Looking for Claude Code…</span>}
          {claude === "missing" && (<><Glyph state="left" size={18} /><span className="text-state-left">Claude Code was not found on this PC. Install it, then reopen Kona.</span></>)}
          {claude && claude !== "missing" && (<><Glyph state="done" size={18} /><span className="text-text-secondary">Claude Code {claude.version ?? ""} found</span></>)}
        </div>

        <div className="flex flex-col gap-1.5 border border-line-subtle bg-surface-1 px-4 py-3">
          <span className="text-[15px] leading-6 font-bold">{project.name}</span>
          <span className="truncate font-mono text-[13px] leading-5 text-text-tertiary" title={project.folder}>{project.folder}</span>
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] leading-5 font-bold text-text-secondary">Start as</legend>
          <div className="flex flex-wrap gap-2">
            {[null, ...roles].map((r) => {
              const on = (r?.id ?? null) === roleId;
              return (
                <button key={r?.id ?? "none"} type="button" onClick={() => pickRole(r)} aria-pressed={on}
                  className={`flex h-11 items-center gap-2.5 border pr-4 pl-2 text-[15px] ${on ? "border-accent bg-surface-3 font-bold" : "border-line-strong text-text-secondary hover:bg-surface-2"}`}>
                  {r ? <RoleMark roleId={r.id} size={28} /> : <span className="w-2" />}
                  {r?.name ?? "No role"}
                </button>
              );
            })}
          </div>
          <p className="m-0 text-[13px] leading-5 text-text-tertiary">{role ? role.brief || "This role has no brief." : "A plain session. Claude gets no role and you choose what it may do."}</p>
        </fieldset>
        <div className="flex flex-col gap-2">
          {accountId && accounts.length > 1 && <div className="flex flex-col gap-1"><span className="text-[13px] leading-5 font-bold text-text-secondary">Account</span><span className="text-[15px] leading-6">{accounts.find((a) => a.id === accountId)?.label ?? accountId}<span className="text-text-tertiary"> · the account of this project</span></span></div>}
          {!accountId && <div className="flex items-center gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> This project has no account yet. Click the Kona mark and choose one.</div>}
          {accountId && signedIn && !signedIn.logged_in && (
            <div className="flex items-center gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {accounts.length > 1 ? "This account is not signed in." : "You are not signed in to Claude."}
              <button type="button" onClick={onOpenAccounts} className="font-bold underline">Open Accounts</button></div>
          )}
        </div>
        <Select label="Voice" value={voice ? "on" : "off"} onChange={(v) => setVoice(v === "on")} options={[{ value: "on", label: `${persona.name || "Kona"}'s voice`, hint: "How Claude talks to you, set in Voice" }, { value: "off", label: "Plain Claude", hint: "No voice for this session" }]} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Model" value={model} onChange={setModel} options={opts(MODELS)} />
          <Select label="What Claude may do on its own" value={mode} onChange={setMode} options={opts(MODES)} />
        </div>
        <Needs project={project} role={role} />
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex justify-end"><Button onClick={start} disabled={claude === "missing" || claude === null || busy || signedIn === null || !signedIn.logged_in}>{busy ? "Starting…" : "Start session"}</Button></div>
      </div>
    </div>
  );
}
