// The screen before a session: check that Claude Code is here, pick a folder, start.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button, Glyph, RoleMark } from "./ui";
import type { Project, Role } from "../lib/api";

type ClaudeInfo = { path: string; version: string | null };
const MODELS = [["sonnet", "Sonnet (the usual choice)"], ["opus", "Opus (the most capable, slower)"], ["haiku", "Haiku (the quickest and cheapest)"]];
const MODES = [["default", "Ask every time"], ["acceptEdits", "Edits free, commands asked"], ["plan", "Plan only"]];

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] leading-5 font-bold text-text-secondary">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-control border border-line-strong bg-inset px-3.5 text-[15px] text-text">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function Welcome({ project, roles, onStart, error }: { project: Project; roles: Role[]; onStart: (folder: string, roleId: string | null, model: string, mode: string) => Promise<void>; error: string | null }) {
  const [claude, setClaude] = useState<ClaudeInfo | "missing" | null>(null);
  const [model, setModel] = useState("sonnet");
  const [mode, setMode] = useState("default");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const role = roles.find((r) => r.id === roleId) ?? null;
  const pickRole = (r: Role | null) => { setRoleId(r?.id ?? null); setModel(r?.model ?? "sonnet"); setMode(r?.mode ?? "default"); };

  useEffect(() => { invoke<ClaudeInfo>("check_claude").then(setClaude).catch(() => setClaude("missing")); }, []);
  const start = async () => { setBusy(true); try { await onStart(project.folder, roleId, model, mode); } finally { setBusy(false); } };

  return (
    <div className="flex h-full flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="flex w-full max-w-[560px] flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-[30px] leading-[38px] font-bold">Start a session</h1>
          <p className="m-0 text-text-secondary">Claude will work inside this project. Nothing leaves this PC except what Claude itself sends to Anthropic.</p>
        </div>

        <div className="flex items-center gap-2.5 text-[13px] leading-5">
          {claude === null && <span className="text-text-tertiary">Looking for Claude Code…</span>}
          {claude === "missing" && (<><Glyph state="left" size={18} /><span className="text-state-left">Claude Code was not found on this PC. Install it, then reopen Kona.</span></>)}
          {claude && claude !== "missing" && (<><Glyph state="done" size={18} /><span className="text-text-secondary">Claude Code {claude.version ?? ""} found</span></>)}
        </div>

        <div className="flex flex-col gap-1.5 rounded-control border border-line-subtle bg-surface-1 px-4 py-3">
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
                  className={`flex h-11 items-center gap-2.5 rounded-control border pr-4 pl-2 text-[15px] ${on ? "border-accent bg-surface-3 font-bold" : "border-line-strong text-text-secondary hover:bg-surface-2"}`}>
                  {r ? <RoleMark mark={r.mark} size={28} /> : <span className="w-2" />}
                  {r?.name ?? "No role"}
                </button>
              );
            })}
          </div>
          <p className="m-0 text-[13px] leading-5 text-text-tertiary">{role ? role.brief || "This role has no brief." : "A plain session. Claude gets no role and you choose what it may do."}</p>
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Model" value={model} onChange={setModel} options={MODELS} />
          <Select label="What Claude may do on its own" value={mode} onChange={setMode} options={MODES} />
        </div>
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex justify-end"><Button onClick={start} disabled={claude === "missing" || claude === null || busy}>{busy ? "Starting…" : "Start session"}</Button></div>
      </div>
    </div>
  );
}
