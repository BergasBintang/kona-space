// Make a skill, or change one of the project's. A skill is a folder (docs/SKILL.md says what goes in it): SKILL.md with its name, one line on when to use it and the steps, and any other files that come
// with it (templates, references, examples, scripts). The dialog shows the folder on the left and the picked file on the right. A new skill's SKILL.md is three boxes; an existing one is shown as the
// file itself, so nothing in it is hidden or lost. Nothing is written until Save, and then it all goes at once.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readSkill, readSkillFiles, saveSkillFolder, type SkillInfo } from "../lib/api";
import { KINDS, addLine, composeSkill, newPath, pathProblem, renameIn, unmentioned, type FileKind } from "../lib/skillfiles";
import { Button } from "./ui";
import { Help } from "./Help";

const field = "bare border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-text-tertiary";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 40);
/** one file beside SKILL.md: `onDisk` is its path on disk, null for a new one; `text` is null for what cannot be edited here (a picture, or a very large file) */
type Item = { key: number; path: string; text: string | null; onDisk: string | null; saved: string | null; bytes: number };
const MAIN = -1;

export function SkillEditor({ folder, name, onSaved, onClose }: { folder: string; /** the skill to change, or nothing for a new one */ name?: string; onSaved: (s: SkillInfo) => void; onClose: () => void }) {
  const editing = name !== undefined;
  const [id, setId] = useState(name ?? "");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [rawSaved, setRawSaved] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [gone, setGone] = useState<string[]>([]); // files on disk that will be removed on save
  const [picked, setPicked] = useState(MAIN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const nextKey = useRef(0);
  const pathBefore = useRef("");

  useEffect(() => {
    if (!editing) return;
    let live = true;
    Promise.all([readSkill(folder, name!), readSkillFiles(folder, name!)]).then(([t, files]) => {
      if (!live) return;
      setRaw(t); setRawSaved(t);
      setItems(files.map((f) => ({ key: nextKey.current++, path: f.path, text: f.text, onDisk: f.path, saved: f.text, bytes: f.bytes })));
    }).catch((e) => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [folder, name, editing]);
  useEffect(() => { box.current?.focus(); }, []);

  const main = editing ? raw ?? "" : body;
  const setMain = (f: (t: string) => string) => { if (editing) setRaw((r) => f(r ?? "")); else setBody(f); };
  const paths = items.map((i) => i.path);
  const problems = useMemo(() => items.map((it) => (it.text === null && it.onDisk === it.path ? null : pathProblem(it.path, items.filter((o) => o.key !== it.key).map((o) => o.path)))), [items]);
  const emptyNew = items.filter((i) => i.text !== null && !i.text.trim()).map((i) => i.path);
  const missing = unmentioned(main, paths);
  const current = items.find((i) => i.key === picked);
  const dirty = editing ? raw !== rawSaved || gone.length > 0 || items.some((i) => i.path !== i.onDisk || i.text !== i.saved) : id !== "" || description.trim() !== "" || body.trim() !== "" || items.length > 0;
  const ready = (editing ? raw !== null && raw.trim() !== "" && dirty : id !== "" && description.trim() !== "" && body.trim() !== "") && problems.every((p) => !p) && emptyNew.length === 0;

  const add = (kind: FileKind) => {
    const k = KINDS.find((x) => x.id === kind)!;
    const path = newPath(kind, paths);
    const key = nextKey.current++;
    setItems((l) => [...l, { key, path, text: k.start, onDisk: null, saved: null, bytes: 0 }]);
    setMain((t) => addLine(t, k.pointer(path))); // the steps must say when to open it, or it never gets opened
    setPicked(key);
    setError(null);
  };
  const change = (key: number, patch: Partial<Item>) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const remove = (it: Item) => {
    setItems((l) => l.filter((i) => i.key !== it.key));
    if (it.onDisk) setGone((g) => [...g, it.onDisk!]);
    if (picked === it.key) setPicked(MAIN);
  };
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const text = editing ? raw ?? "" : composeSkill(id, description, body);
      const writes = items.filter((i) => i.text !== null && (i.path !== i.onDisk || i.text !== i.saved)).map((i) => ({ path: i.path, text: i.text! }));
      const deletes = [...gone, ...items.filter((i) => i.onDisk && i.onDisk !== i.path).map((i) => i.onDisk!)];
      onSaved(await saveSkillFolder(folder, id, text, !editing, writes, deletes));
      onClose();
    } catch (e) { setError(String(e)); setBusy(false); }
  };
  const tryClose = () => { if (dirty) setLeaving(true); else onClose(); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); tryClose(); } };

  const fileButton = (key: number, label: string, note: string, bad: boolean) => (
    <button type="button" aria-pressed={picked === key} onClick={() => setPicked(key)} title={label} className={`flex min-w-0 flex-1 flex-col border-l-2 px-2 py-1.5 text-left ${picked === key ? "border-accent bg-surface-3" : "border-transparent hover:bg-surface-3"}`}>
      <span className={`truncate font-mono text-[13px] leading-5 ${bad ? "text-state-left" : "text-text"}`}>{label}</span>
      <span className="truncate font-sans text-[12px] leading-4 tracking-normal text-text-tertiary">{note}</span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) tryClose(); }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={editing ? `Change the skill ${name}` : "A new skill"} onKeyDown={onKey} className="flex h-[min(88vh,820px)] w-full max-w-[1120px] flex-col gap-3 px-card px-shadow p-3 outline-none">
        <div className="flex items-center gap-2">
          <h2 className="m-0 text-[22px] leading-7 font-bold">{editing ? `Change ${name}` : "A new skill"}</h2>
          <Help title="What goes in a skill">
            <p className="m-0">A skill is a folder. SKILL.md is what the person reads when the skill fits; the other files are opened only when its steps say so, so they cost nothing until they are needed.</p>
            <p className="m-0">The top of SKILL.md, between the two lines of three dashes, names the skill and says when to use it. That line is sent at the start of every conversation of the people who have the skill, so keep it short. The name at the top must stay the same.</p>
            <p className="m-0">Nothing is written until you save, and then it all goes at once.</p>
          </Help>
        </div>

        <div className="flex min-h-0 flex-1 border border-line-subtle">
          <div className="flex w-[280px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line-subtle bg-surface-1 p-3" role="group" aria-label="The files of the skill">
            <h3 className="m-0 truncate text-[15px] leading-6 font-bold">{id || "The folder"}</h3>
            <div className="flex flex-col gap-1">
              <div className="flex">{fileButton(MAIN, "SKILL.md", "The steps. Every skill has one", false)}</div>
              {items.map((it, n) => (
                <div key={it.key} className="flex items-stretch">
                  {fileButton(it.key, it.path, it.text === null ? `Cannot be changed here, ${Math.ceil(it.bytes / 1024)} KB` : KINDS.find((k) => it.path.startsWith(`${k.id}/`))?.label ?? "A file", !!problems[n])}
                  <button type="button" aria-label={`Remove ${it.path}`} title="Remove this file" onClick={() => remove(it)} className="w-8 shrink-0 text-[15px] text-text-tertiary hover:bg-surface-3 hover:text-text">×</button>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-3">
              <span className="font-sans text-[13px] leading-5 font-bold text-text-secondary">Add to the folder</span>
              {KINDS.map((k) => (
                <button key={k.id} type="button" onClick={() => add(k.id)} title={k.hint} className="flex flex-col border border-line-subtle bg-surface-2 px-2 py-1.5 text-left hover:bg-surface-3">
                  <span className="text-[14px] leading-5">+ {k.label}</span>
                  <span className="font-sans text-[12px] leading-4 tracking-normal text-text-tertiary">{k.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {current ? (
              current.text === null ? (
                <p className="m-0 text-[14px] leading-6 text-text-secondary"><span className="font-mono">{current.path}</span> is not plain text, or is larger than 200 KB, so it cannot be changed here. It stays in the folder unless you remove it.</p>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">Where it sits in the folder</span>
                    <input value={current.path} aria-label="Path of the file" className={`${field} h-10 font-mono text-[14px]`} onFocus={() => { pathBefore.current = current.path; }} onChange={(e) => change(current.key, { path: e.target.value.trim() })}
                      onBlur={() => { if (!problems[items.indexOf(current)]) setMain((t) => renameIn(t, pathBefore.current, current.path)); }} /></label>
                  {problems[items.indexOf(current)] && <p role="alert" className="m-0 text-[13px] leading-5 font-bold text-state-left">{problems[items.indexOf(current)]}</p>}
                  <textarea value={current.text} onChange={(e) => change(current.key, { text: e.target.value })} spellCheck={false} aria-label={`The text of ${current.path}`} className={`${field} min-h-[260px] flex-1 py-3 font-mono text-[13px] leading-5`} />
                </>
              )
            ) : editing ? (
              <>
                {raw === null && !error ? <span className="text-[14px] text-text-tertiary">Looking…</span> : (
                  <textarea value={raw ?? ""} onChange={(e) => setRaw(e.target.value)} spellCheck={false} aria-label="The skill file" className={`${field} min-h-[260px] flex-1 py-3 font-mono text-[13px] leading-5`} />
                )}
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">Name (lower case, dashes)</span>
                  <input value={id} onChange={(e) => setId(slug(e.target.value))} maxLength={40} placeholder="check-a-contract" aria-label="Skill name" className={`${field} h-10 font-mono`} autoFocus /></label>
                <label className="flex flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">When to use it (one line)</span>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={220} placeholder="Use when someone sends a contract to read before signing." aria-label="When to use it" className={`${field} h-10`} /></label>
                <label className="flex min-h-0 flex-1 flex-col gap-1.5"><span className="text-[13px] leading-5 font-bold text-text-secondary">What to do</span>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={"1. First do this.\n2. Then check that.\n\nLong lists and forms go in their own files: add them on the left."} aria-label="The instructions" className={`${field} min-h-[200px] flex-1 py-3 leading-6`} /></label>
              </>
            )}
          </div>
        </div>

        {missing.length > 0 && <p className="m-0 text-[13px] leading-5 text-text-secondary">Nothing in the steps points at {missing.slice(0, 3).map((m, i) => <span key={m}>{i > 0 && ", "}<span className="font-mono">{m}</span></span>)}{missing.length > 3 && ` and ${missing.length - 3} more`}, so it would never be opened. Say in SKILL.md when to open it.</p>}
        {emptyNew.length > 0 && <p className="m-0 text-[13px] leading-5 text-text-secondary"><span className="font-mono">{emptyNew[0]}</span> is empty. Write something in it or remove it.</p>}
        {error && <p role="alert" className="m-0 text-[14px] leading-5 font-bold text-state-left">{error}</p>}
        {leaving ? (
          <div role="alert" className="flex flex-wrap items-center gap-3"><span className="text-[14px] leading-5 font-bold">Leave without saving? What you wrote here is lost.</span><Button variant="danger" onClick={onClose}>Leave</Button><Button variant="quiet" onClick={() => setLeaving(false)}>Keep writing</Button></div>
        ) : (
          <div className="flex gap-3"><Button onClick={() => void save()} disabled={busy || !ready}>{editing ? "Save the change" : "Make the skill"}</Button><Button variant="quiet" onClick={tryClose}>Cancel</Button></div>
        )}
      </div>
    </div>,
    document.body,
  );
}
