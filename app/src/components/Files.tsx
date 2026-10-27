// The Files place: a folder tree on the left, a read-only viewer on the right (feature F4).
// Folders are read one level at a time, only when opened, so a big project costs nothing until you look in it.
import { useCallback, useEffect, useMemo, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { baseName, humanSize, listDir, readFile, type Entry, type FileView, type Project } from "../lib/api";
import { Button, Glyph } from "./ui";
import { Markdown } from "./brain/Markdown";

const QUIET = new Set([".git", "node_modules", "target", "dist", ".kona", "__pycache__", ".next", ".venv"]);

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-text-tertiary" style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 120ms" }}>
      <path d="M6 4 L10 8 L6 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-text-secondary"><path d="M2 5 L2 12.5 L14 12.5 L14 6 L7.5 6 L6.5 4 L2 4 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);
const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-text-tertiary"><path d="M3.5 2 L9.5 2 L12.5 5 L12.5 14 L3.5 14 Z M9.5 2 L9.5 5 L12.5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
);

type Tree = Record<string, Entry[] | "loading" | { error: string }>;

function TreePanel({ project, selected, onPick }: { project: Project; selected: string | null; onPick: (e: Entry) => void }) {
  const [tree, setTree] = useState<Tree>({});
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set([project.folder]));

  const load = useCallback(async (dir: string) => {
    setTree((t) => ({ ...t, [dir]: "loading" }));
    try { const entries = await listDir(dir); setTree((t) => ({ ...t, [dir]: entries })); }
    catch (e) { setTree((t) => ({ ...t, [dir]: { error: String(e) } })); }
  }, []);

  useEffect(() => { setTree({}); setOpenDirs(new Set([project.folder])); void load(project.folder); }, [project.folder, load]);

  const toggle = (e: Entry) => {
    const next = new Set(openDirs);
    if (next.has(e.path)) next.delete(e.path); else { next.add(e.path); if (!tree[e.path]) void load(e.path); }
    setOpenDirs(next);
  };

  // Arrow keys: Down and Up move through the rows that are showing; Right opens a folder (or steps into it); Left closes it (or steps out to its folder);
  // Home and End jump to the first and last row; Enter and Space do what a click does.
  const onKey = (ev: React.KeyboardEvent) => {
    const cur = (ev.target as HTMLElement).closest<HTMLElement>("[data-path]");
    if (!cur) return;
    const all = [...ev.currentTarget.querySelectorAll<HTMLElement>("[data-path]")];
    const i = all.indexOf(cur);
    const focus = (el?: HTMLElement) => { if (el) { ev.preventDefault(); el.focus(); } };
    const isDir = cur.dataset.dir === "1", isOpen = cur.getAttribute("aria-expanded") === "true";
    const entry = (path: string) => { for (const v of Object.values(tree)) if (Array.isArray(v)) { const e = v.find((x) => x.path === path); if (e) return e; } return undefined; };
    switch (ev.key) {
      case "ArrowDown": focus(all[i + 1]); break;
      case "ArrowUp": focus(all[i - 1]); break;
      case "Home": focus(all[0]); break;
      case "End": focus(all[all.length - 1]); break;
      case "ArrowRight": if (isDir && !isOpen) { ev.preventDefault(); const e = entry(cur.dataset.path!); if (e) toggle(e); } else if (isDir) focus(all[i + 1]); break;
      case "ArrowLeft": if (isDir && isOpen) { ev.preventDefault(); const e = entry(cur.dataset.path!); if (e) toggle(e); } else focus(all.find((x) => x.dataset.path === cur.dataset.parent)); break;
    }
  };

  const rows = (dir: string, depth: number): React.ReactNode => {
    const node = tree[dir];
    if (!node || node === "loading") return <div className="py-1 text-[13px] leading-5 text-text-tertiary" style={{ paddingLeft: 12 + depth * 18 }}>Reading…</div>;
    if ("error" in node) return <div className="py-1 text-[13px] leading-5 text-state-left" style={{ paddingLeft: 12 + depth * 18 }}>{node.error}</div>;
    if (node.length === 0) return <div className="py-1 text-[13px] leading-5 text-text-tertiary" style={{ paddingLeft: 12 + depth * 18 }}>Empty folder</div>;
    return node.map((e) => {
      const isOpen = e.is_dir && openDirs.has(e.path);
      const on = selected === e.path;
      return (
        <div key={e.path}>
          <button
            onClick={() => (e.is_dir ? toggle(e) : onPick(e))}
            role="treeitem" data-path={e.path} data-parent={dir} data-dir={e.is_dir ? "1" : undefined} aria-level={depth + 1}
            aria-expanded={e.is_dir ? isOpen : undefined}
            aria-current={on ? "true" : undefined}
            title={e.path}
            className={`flex h-8 w-full items-center gap-1.5 rounded-lg pr-2.5 text-left text-[14px] transition-colors ${on ? "bg-surface-3" : "hover:bg-surface-2"} ${QUIET.has(e.name) ? "text-text-tertiary" : ""}`}
            style={{ paddingLeft: 8 + depth * 18 }}
          >
            {e.is_dir ? <Chevron open={isOpen} /> : <span className="w-4 shrink-0" />}
            {e.is_dir ? <FolderIcon /> : <FileIcon />}
            <span className="truncate">{e.name}</span>
          </button>
          {isOpen && rows(e.path, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col gap-3 overflow-y-auto bg-ground px-2.5 pt-6 pb-5" role="tree" aria-label={`Files of ${project.name}`} onKeyDown={onKey}>
      <div className="px-2.5 text-[17px] leading-6 font-bold">{project.name}</div>
      <div className="flex flex-col gap-px">{rows(project.folder, 0)}</div>
    </div>
  );
}

function Gutter({ text }: { text: string }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const numbers = useMemo(() => lines.map((_, i) => i + 1).join("\n"), [lines]);
  return (
    <div className="flex min-w-0 font-mono text-[13px] leading-5">
      <pre className="m-0 shrink-0 select-none border-r border-line-subtle pr-3 pl-4 text-right text-text-disabled" aria-hidden="true">{numbers}</pre>
      <pre className="m-0 min-w-0 flex-1 overflow-x-auto pr-6 pl-4 whitespace-pre text-text">{text}</pre>
    </div>
  );
}

function Viewer({ project, entry }: { project: Project; entry: Entry | null }) {
  const [rendered, setRendered] = useState(true); // a markdown file is shown read as a page, with a switch to the plain text
  const [view, setView] = useState<FileView | { error: string } | "loading" | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    setView(entry ? "loading" : null);
    setPdfUrl(null);
    if (!entry) return;
    let live = true;
    readFile(entry.path).then((v) => { if (live) setView(v); }).catch((e) => { if (live) setView({ error: String(e) }); });
    return () => { live = false; };
  }, [entry]);

  useEffect(() => {
    if (!view || typeof view === "string" || "error" in view || view.kind !== "pdf") return;
    const bytes = Uint8Array.from(atob(view.data), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [view]);

  if (!entry) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="m-0 max-w-[420px] text-center text-text-tertiary">Pick a file on the left to read it. Kona only reads here. It never changes your files from this screen.</p>
      </div>
    );
  }
  const rel = entry.path.slice(project.folder.length).replace(/^[\\/]+/, "");
  const ext = baseName(entry.path).split(".").pop()?.toLowerCase();

  let body: React.ReactNode;
  if (view === "loading" || view === null) body = <p className="m-0 p-8 text-text-tertiary">Reading…</p>;
  else if ("error" in view) body = <div className="flex items-start gap-2.5 p-8 text-state-left"><Glyph state="left" size={18} /> {view.error}</div>;
  else if (view.kind === "text") {
    let text = view.text, tidy = false;
    if (ext === "json") { try { text = JSON.stringify(JSON.parse(view.text), null, 2); tidy = true; } catch { /* show it as it is */ } }
    const md = ext === "md" || ext === "markdown";
    body = md && rendered ? (
      <div className="flex min-h-0 flex-1 flex-col">
        {view.truncated && <div className="px-8 pb-2 text-[13px] leading-5 text-text-tertiary">Only the first 2 MB are shown.</div>}
        <div className="min-h-0 flex-1 overflow-auto px-8 py-5"><div className="max-w-[760px]"><Markdown text={view.text} resolve={() => null} open={() => {}} wiki={false} /></div></div>
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col">
        {(view.truncated || tidy) && <div className="px-8 pb-2 text-[13px] leading-5 text-text-tertiary">{view.truncated ? "Only the first 2 MB are shown." : "Shown with tidy spacing."}</div>}
        <div className="min-h-0 flex-1 overflow-auto py-3"><Gutter text={text} /></div>
      </div>
    );
  } else if (view.kind === "image") body = <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-inset p-6"><img src={`data:${view.mime};base64,${view.data}`} alt={entry.name} className="max-h-full max-w-full" /></div>;
  else if (view.kind === "pdf") body = pdfUrl ? <embed src={pdfUrl} type="application/pdf" className="min-h-0 flex-1" /> : <p className="m-0 p-8 text-text-tertiary">Reading…</p>;
  else body = (
    <div className="flex flex-col items-start gap-4 p-8">
      <p className="m-0 max-w-[520px] text-text-secondary">{view.kind === "toolarge" ? `This file is ${humanSize(view.size)}, too big to show here.` : "This is not a text file, so Kona cannot show it here."}</p>
      <Button variant="quiet" small onClick={() => void revealItemInDir(entry.path)}>Show it in Explorer</Button>
    </div>
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex flex-col gap-1 px-8 pt-6 pb-4">
        <h2 className="m-0 truncate text-[22px] leading-[30px] font-bold">{entry.name}</h2>
        <div className="flex flex-wrap gap-x-4 text-[13px] leading-5 text-text-tertiary">
          <span className="truncate font-mono">{rel}</span>
          {(ext === "md" || ext === "markdown") && <button type="button" onClick={() => setRendered((r) => !r)} aria-pressed={rendered} className="rounded font-bold text-text-secondary hover:text-text">{rendered ? "Show the text" : "Show it as a page"}</button>}
          <span>{humanSize(entry.size)}</span>
          {entry.modified && <span>changed {new Date(entry.modified * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
        </div>
      </div>
      <div className="mx-8 h-px bg-line-subtle" />
      {body}
    </div>
  );
}

export function Files({ project }: { project: Project }) {
  const [picked, setPicked] = useState<Entry | null>(null);
  useEffect(() => setPicked(null), [project.id]);
  return (
    <div className="flex h-full min-w-0 flex-1">
      <TreePanel project={project} selected={picked?.path ?? null} onPick={setPicked} />
      <div className="w-px bg-line-subtle" />
      <Viewer project={project} entry={picked} />
    </div>
  );
}
