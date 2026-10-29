// The needs check, shown on the start screen: the local tools this role and this project need, and which of them this PC has.
// Kona only looks. For a missing tool it shows the install command as text and the owner decides (decision: never install by itself).
import { useEffect, useMemo, useState } from "react";
import { checkTools, projectHints, type Hint, type Project, type Role, type ToolStatus } from "../lib/api";
import { Glyph } from "./ui";

export function Needs({ project, role }: { project: Project; role: Role | null }) {
  const [hints, setHints] = useState<Hint[]>([]);
  const [status, setStatus] = useState<ToolStatus[] | null>(null);
  const [again, setAgain] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { projectHints(project.folder).then(setHints).catch(() => setHints([])); }, [project.folder]);

  // why each tool is on the list: the role, the project's files, or both
  const why = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const id of role?.needs ?? []) m.set(id, [`${role!.name} needs it`]);
    for (const h of hints) m.set(h.id, [...(m.get(h.id) ?? []), h.because]);
    return m;
  }, [role, hints]);
  const ids = useMemo(() => [...why.keys()].sort(), [why]);
  const key = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) { setStatus([]); return; }
    let live = true;
    setStatus(null);
    checkTools(ids).then((s) => { if (live) setStatus(s); }).catch(() => { if (live) setStatus([]); });
    return () => { live = false; };
  }, [key, again]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ids.length === 0) return null;
  const rows = (status ?? []).slice().sort((a, b) => Number(a.installed) - Number(b.installed) || a.name.localeCompare(b.name));
  const missing = rows.filter((r) => !r.installed).length;

  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000); } catch { /* the text is on screen to copy by hand */ }
  };

  return (
    <section aria-label="Tools this session needs" className="flex flex-col gap-3 border border-line-subtle bg-surface-1 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] leading-5 font-bold text-text-secondary">Tools this session needs</span>
        <span className="flex items-center gap-3 text-[13px] leading-5 text-text-tertiary">
          {status === null ? "Looking…" : missing === 0 ? "All here" : `${missing} missing`}
          <button type="button" onClick={() => setAgain((n) => n + 1)} className="font-bold text-text-secondary hover:text-text">Check again</button>
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 text-[14px] leading-5">
              <Glyph state={r.installed ? "done" : "left"} size={16} />
              <span className="font-bold">{r.name}</span>
              <span className={r.installed ? "truncate font-mono text-[13px] text-text-secondary" : "text-state-left"}>{r.installed ? r.version : "Missing"}</span>
              <span className="ml-auto truncate text-[13px] text-text-tertiary">{why.get(r.id)?.join(" · ")}</span>
            </div>
            {!r.installed && (
              <div className="ml-[26px] flex items-center gap-3">
                <code className="min-w-0 truncate bg-inset px-2 py-1 font-mono text-[13px] text-text-secondary" title={r.install}>{r.install}</code>
                {r.install.startsWith("winget") && <button type="button" onClick={() => copy(r.id, r.install)} className="shrink-0 text-[13px] font-bold text-text-secondary hover:text-text">{copied === r.id ? "Copied" : "Copy"}</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {missing > 0 && <p className="m-0 text-[13px] leading-5 text-text-tertiary">Kona never installs anything by itself. You can start anyway; Claude will say if it needs a missing tool.</p>}
    </section>
  );
}
