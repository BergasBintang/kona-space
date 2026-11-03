// The Files place: a folder tree on the left, a read-only viewer on the right (feature F4).
// Folders are read one level at a time, only when opened, so a big project costs nothing until you look in it.
// The viewer follows links between files (with a way back), lists the headings of a long page, finds words in it, copies tables and code, and says when an agent
// changed the file: the open file and the open folders are looked at again every few seconds while the window is showing.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { baseName, humanSize, listDir, readFile, type Entry, type FileView, type Project } from "../lib/api";
import { dirOf, outline, resolveLink, slugify, type Heading } from "../lib/brain/outline.ts";
import { changedSince, readSeen, stamp, writeSeen, type Seen } from "../lib/seen.ts";
import { buildPage, pageRefs } from "../lib/htmlpage.ts";
import { Button, Glyph } from "./ui";
import { Markdown } from "./brain/Markdown";
import { clearPaint, findIn, paint } from "./find";

const QUIET = new Set([".git", "node_modules", "target", "dist", ".kona", "__pycache__", ".next", ".venv"]);
const SEP = /[\\/]/;
const same = (a: string, b: string) => a.toLowerCase().replace(/\//g, "\\") === b.toLowerCase().replace(/\//g, "\\");

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
type Reveal = { dirs: string[]; n: number };

/** The file a path names, as the folders list it (so the case of every name is the real one), and the folders on the way to it. null when there is no such file. */
async function locate(root: string, target: string): Promise<{ entry: Entry; dirs: string[] } | null> {
  const rootParts = root.split(SEP).filter(Boolean), parts = target.split(SEP).filter(Boolean);
  let dir = root;
  const dirs = [root];
  for (let i = rootParts.length; i < parts.length; i++) {
    let list: Entry[];
    try { list = await listDir(dir); } catch { return null; }
    const e = list.find((x) => x.name.toLowerCase() === parts[i].toLowerCase());
    if (!e) return null;
    if (i === parts.length - 1) return e.is_dir ? null : { entry: e, dirs };
    if (!e.is_dir) return null;
    dir = e.path; dirs.push(dir);
  }
  return null;
}

/** `root` is the folder the tree starts at (the project's own folder unless said otherwise); `only` keeps just the entries of that folder with these names (a person's own skills). */
function TreePanel({ project, selected, onPick, root, only, title, seen, reveal }: { project: Project; selected: string | null; onPick: (e: Entry) => void; root?: string; only?: string[]; title?: string; seen: Seen; reveal: Reveal | null }) {
  const rootDir = root ?? project.folder;
  const [tree, setTree] = useState<Tree>({});
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set([rootDir]));

  const load = useCallback(async (dir: string) => {
    setTree((t) => ({ ...t, [dir]: "loading" }));
    try { const entries = await listDir(dir); setTree((t) => ({ ...t, [dir]: entries })); }
    catch (e) { setTree((t) => ({ ...t, [dir]: { error: String(e) } })); }
  }, []);

  useEffect(() => { setTree({}); setOpenDirs(new Set([rootDir])); void load(rootDir); }, [rootDir, load]);

  // a file opened by a link: its folders open, so the tree shows where it is
  useEffect(() => {
    if (!reveal) return;
    setOpenDirs((cur) => new Set([...cur, ...reveal.dirs]));
    for (const d of reveal.dirs) void load(d);
  }, [reveal, load]);

  // folders that are open are read again every few seconds, so a file an agent made or changed shows up
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      for (const d of openDirs) listDir(d).then((list) => setTree((cur) => (JSON.stringify(cur[d]) === JSON.stringify(list) ? cur : { ...cur, [d]: list }))).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [openDirs]);

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
    if ("error" in node) return depth === 0 && only
      ? <div className="py-1 text-[13px] leading-5 text-text-tertiary" style={{ paddingLeft: 12 + depth * 18 }}>No skills yet. Copy one from this computer on the right.</div> // the project has no skills folder until a skill is put in it
      : <div className="py-1 text-[13px] leading-5 text-state-left" style={{ paddingLeft: 12 + depth * 18 }}>{node.error}</div>;
    const list = depth === 0 && only ? node.filter((e) => only.includes(e.name)) : node;
    if (list.length === 0) return <div className="py-1 text-[13px] leading-5 text-text-tertiary" style={{ paddingLeft: 12 + depth * 18 }}>{depth === 0 && only ? "No skills yet. Tick one on the right." : "Empty folder"}</div>;
    return list.map((e) => {
      const isOpen = e.is_dir && openDirs.has(e.path);
      const on = selected !== null && same(selected, e.path);
      const changed = !e.is_dir && changedSince(seen, e.path, e.modified);
      return (
        <div key={e.path}>
          <button
            onClick={() => (e.is_dir ? toggle(e) : onPick(e))}
            role="treeitem" data-path={e.path} data-parent={dir} data-dir={e.is_dir ? "1" : undefined} aria-level={depth + 1}
            aria-expanded={e.is_dir ? isOpen : undefined}
            aria-current={on ? "true" : undefined}
            title={changed ? `${e.path}\nChanged since you last opened it` : e.path}
            className={`flex h-8 w-full items-center gap-1.5 pr-2.5 text-left text-[14px] transition-colors ${on ? "bg-surface-3" : "hover:bg-surface-2"} ${QUIET.has(e.name) ? "text-text-tertiary" : ""}`}
            style={{ paddingLeft: 8 + depth * 18 }}
          >
            {e.is_dir ? <Chevron open={isOpen} /> : <span className="w-4 shrink-0" />}
            {e.is_dir ? <FolderIcon /> : <FileIcon />}
            <span className="truncate">{e.name}</span>
            {changed && <><span aria-hidden="true" className="ml-auto size-2 shrink-0 bg-accent" /><span className="sr-only">Changed since you last opened it</span></>}
          </button>
          {isOpen && rows(e.path, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col gap-3 overflow-y-auto bg-ground px-2.5 pt-6 pb-5" role="tree" aria-label={`Files of ${title ?? project.name}`} onKeyDown={onKey}>
      <div className="px-2.5 text-[17px] leading-6 font-bold">{title ?? project.name}</div>
      <div className="flex flex-col gap-px">{rows(rootDir, 0)}</div>
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

/** "On this page": the headings of a long file; the one being read is marked, and a click jumps to one. */
function Outline({ heads, active, onJump }: { heads: Heading[]; active: string | null; onJump: (id: string) => void }) {
  const low = Math.min(...heads.map((h) => h.level));
  return (
    <nav aria-label="On this page" className="hidden w-[250px] shrink-0 flex-col gap-0.5 overflow-y-auto border-l border-line-subtle py-5 pr-3 pl-4 lg:flex">
      <div className="px-2 pb-1.5 text-[15px] leading-6 font-bold">On this page</div>
      {heads.map((h) => (
        <button key={h.id} type="button" onClick={() => onJump(h.id)} aria-current={h.id === active ? "location" : undefined} title={h.text}
          className={`border-l-2 py-1 pr-2 text-left text-[14px] leading-5 ${h.id === active ? "border-accent font-bold text-text" : "border-transparent text-text-secondary hover:text-text"}`}
          style={{ paddingLeft: 10 + (h.level - low) * 14 }}>
          <span className="line-clamp-2">{h.text}</span>
        </button>
      ))}
    </nav>
  );
}

type Note = { tone: "info" | "warn"; text: string };

/** An .html file drawn as a page inside a sandboxed frame: its scripts do not run and nothing comes from the web. Its pictures and style sheets from the project are read and put in first. */
function HtmlFrame({ html, path, bound, name }: { html: string; path: string; bound: string; name: string }) {
  const [shown, setShown] = useState<{ url: string; scripts: number; web: number } | null>(null);
  useEffect(() => {
    let live = true, url = "";
    (async () => {
      const got = new Map<string, string>();
      for (const ref of pageRefs(html).slice(0, 60)) {
        const to = resolveLink(path, ref, bound);
        if (!to) continue;
        try {
          const v = await readFile(to.path);
          if (v.kind === "image") got.set(ref, `data:${v.mime};base64,${v.data}`);
          else if (v.kind === "text" && /\.css$/i.test(ref.split(/[?#]/)[0])) got.set(ref, v.text);
        } catch { /* a file that is not there: the page shows its own broken picture */ }
      }
      if (!live) return;
      const page = buildPage(html, got);
      url = URL.createObjectURL(new Blob([page.html], { type: "text/html" }));
      setShown({ url, scripts: page.scripts, web: page.web });
    })();
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [html, path, bound]);

  if (!shown) return <p className="m-0 p-8 text-text-tertiary">Reading…</p>;
  const says = [shown.scripts > 0 && "This page has scripts. Kona does not run them.", shown.web > 0 && "Pictures from the web are not loaded."].filter(Boolean).join(" ");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {says && <div className="px-8 pb-2 text-[13px] leading-5 text-text-tertiary">{says}</div>}
      <iframe title={name} src={shown.url} sandbox="" className="min-h-0 flex-1 border-0 bg-white" />
    </div>
  );
}

function Viewer({ project, entry, note, anchor, canGoBack, backName, onBack, onFollow, onFresh }: {
  project: Project; entry: Entry | null; note: Note | null; anchor: { id: string; n: number } | null; canGoBack: boolean; backName: string; onBack: () => void; onFollow: (href: string) => void; onFresh: (e: Entry) => void;
}) {
  const [rendered, setRendered] = useState(true); // a markdown or html file is shown read as a page, with a switch to the plain text
  const [view, setView] = useState<FileView | { error: string } | "loading" | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState({ count: 0, at: 0 });
  const matches = useRef<Range[]>([]);
  const body = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const finder = useRef<HTMLInputElement>(null);
  const shown = useRef<string | null>(null);
  const done = useRef(0);

  useEffect(() => {
    const again = shown.current === (entry?.path ?? null); // the same file read again after a change: keep what is on the screen, and the place in it
    shown.current = entry?.path ?? null;
    if (!again) { setView(entry ? "loading" : null); setPdfUrl(null); setActive(null); }
    if (!entry) return;
    let live = true;
    readFile(entry.path).then((v) => { if (live) setView(v); }).catch((e) => { if (live) setView({ error: String(e) }); });
    return () => { live = false; };
  }, [entry]);

  // the open file is looked at again every few seconds: when an agent changes it, the page follows
  useEffect(() => {
    if (!entry) return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const now = (await listDir(dirOf(entry.path))).find((x) => x.path === entry.path);
        if (now && (now.modified !== entry.modified || now.size !== entry.size)) onFresh(now);
      } catch { /* the folder cannot be read just now: try again next time */ }
    }, 3000);
    return () => clearInterval(t);
  }, [entry, onFresh]);

  useEffect(() => {
    if (!view || typeof view === "string" || "error" in view || view.kind !== "pdf") return;
    const bytes = Uint8Array.from(atob(view.data), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [view]);

  const text = view && typeof view !== "string" && !("error" in view) && view.kind === "text" ? view : null;
  const md = !!entry && /\.(md|markdown)$/i.test(entry.name);
  const html = !!entry && /\.html?$/i.test(entry.name);
  const finds = text && !(html && rendered) ? text : null; // a drawn html page sits in its own frame, which the search cannot reach
  const heads = useMemo(() => (text && md && rendered ? outline(text.text).filter((h) => h.level <= 3) : []), [text, md, rendered]);

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ block: "start" }); setActive(id); }
    return !!el;
  }, []);

  // a link that named a heading of another file: go to it once that file is on the screen
  useEffect(() => {
    if (!anchor || anchor.n === done.current || !text || !rendered) return;
    done.current = anchor.n;
    let a = anchor.id;
    try { a = decodeURIComponent(a); } catch { /* as written */ }
    requestAnimationFrame(() => { if (!jump(`md-${a.toLowerCase()}`)) jump(`md-${slugify(a)}`); });
  }, [anchor, text, rendered, jump]);

  // which heading is being read: the last one that has reached the top of the page
  useEffect(() => {
    const box = scroller.current;
    if (!box || heads.length === 0) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = box.getBoundingClientRect().top;
      let cur = heads[0].id;
      for (const h of heads) { const el = document.getElementById(h.id); if (!el) continue; if (el.getBoundingClientRect().top - top <= 48) cur = h.id; else break; }
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => { box.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [heads]);

  // find in this file: Ctrl+F opens the box, Enter and Shift+Enter step, Esc closes
  useEffect(() => {
    if (!entry) return;
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && finds) { e.preventDefault(); setFinding(true); requestAnimationFrame(() => finder.current?.select()); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [entry, finds]);
  useEffect(() => {
    if (!finding || !query || !body.current || !finds) { matches.current = []; setHits({ count: 0, at: 0 }); clearPaint(); return; }
    const found = findIn(body.current, query);
    matches.current = found;
    setHits({ count: found.length, at: 0 });
    paint(found, 0, found.length > 0);
    return clearPaint;
  }, [finding, query, finds, rendered, entry?.path]);
  useEffect(() => { setFinding(false); setQuery(""); }, [entry?.path]);
  const step = (d: number) => {
    if (matches.current.length === 0) return;
    const at = (hits.at + d + matches.current.length) % matches.current.length;
    setHits({ count: matches.current.length, at });
    paint(matches.current, at, true);
  };

  if (!entry) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="m-0 max-w-[420px] text-center text-text-tertiary">Pick a file on the left to read it. Kona only reads here. It never changes your files from this screen.</p>
      </div>
    );
  }
  const rel = entry.path.slice(project.folder.length).replace(/^[\\/]+/, "");
  const ext = baseName(entry.path).split(".").pop()?.toLowerCase();

  let content: React.ReactNode;
  if (view === "loading" || view === null) content = <p className="m-0 p-8 text-text-tertiary">Reading…</p>;
  else if ("error" in view) content = <div className="flex items-start gap-2.5 p-8 text-state-left"><Glyph state="left" size={18} /> {view.error}</div>;
  else if (view.kind === "text") {
    let t = view.text, tidy = false;
    if (ext === "json") { try { t = JSON.stringify(JSON.parse(view.text), null, 2); tidy = true; } catch { /* show it as it is */ } }
    content = html && rendered ? (
      <HtmlFrame html={view.text} path={entry.path} bound={project.folder} name={entry.name} />
    ) : md && rendered ? (
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view.truncated && <div className="px-8 pb-2 text-[13px] leading-5 text-text-tertiary">Only the first 2 MB are shown.</div>}
          <div ref={scroller} className="min-h-0 flex-1 overflow-auto px-8 py-5"><div className="max-w-[calc(1180px*var(--k))]"><Markdown text={view.text} resolve={() => null} open={() => {}} wiki={false} front go={onFollow} /></div></div>
        </div>
        {heads.length >= 3 && <Outline heads={heads} active={active} onJump={jump} />}
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col">
        {(view.truncated || tidy) && <div className="px-8 pb-2 text-[13px] leading-5 text-text-tertiary">{view.truncated ? "Only the first 2 MB are shown." : "Shown with tidy spacing."}</div>}
        <div className="min-h-0 flex-1 overflow-auto py-3"><Gutter text={t} /></div>
      </div>
    );
  } else if (view.kind === "image") content = <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-inset p-6"><img src={`data:${view.mime};base64,${view.data}`} alt={entry.name} className="max-h-full max-w-full" /></div>;
  else if (view.kind === "pdf") content = pdfUrl ? <embed src={pdfUrl} type="application/pdf" className="min-h-0 flex-1" /> : <p className="m-0 p-8 text-text-tertiary">Reading…</p>;
  else content = (
    <div className="flex flex-col items-start gap-4 p-8">
      <p className="m-0 max-w-[520px] text-text-secondary">{view.kind === "toolarge" ? `This file is ${humanSize(view.size)}, too big to show here.` : "This is not a text file, so Kona cannot show it here."}</p>
      <Button variant="quiet" small onClick={() => void revealItemInDir(entry.path)}>Show it in Explorer</Button>
    </div>
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex flex-col gap-1 px-8 pt-6 pb-4">
        <div className="flex items-center gap-3">
          {canGoBack && <Button variant="quiet" small onClick={onBack} title={`Back to ${backName}`}>← Back</Button>}
          <h2 className="m-0 min-w-0 flex-1 truncate text-[22px] leading-[30px] font-bold">{entry.name}</h2>
          {finds && <Button variant="ghost" small onClick={() => { setFinding((f) => !f); requestAnimationFrame(() => finder.current?.select()); }} aria-pressed={finding} title="Find in this file (Ctrl+F)">Find</Button>}
        </div>
        <div className="flex flex-wrap gap-x-4 text-[13px] leading-5 text-text-tertiary">
          <span className="truncate font-mono">{rel}</span>
          {(md || html) && <button type="button" onClick={() => setRendered((r) => !r)} aria-pressed={rendered} className="font-bold text-text-secondary hover:text-text">{rendered ? "Show the text" : "Show it as a page"}</button>}
          <span>{humanSize(entry.size)}</span>
          {entry.modified && <span>changed {new Date(entry.modified * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
        </div>
        {note && (
          <div role="status" className={`flex items-center gap-2 text-[13px] leading-5 font-bold ${note.tone === "warn" ? "text-state-left" : "text-state-live"}`}>
            <Glyph state={note.tone === "warn" ? "left" : "live"} size={14} />{note.text}
          </div>
        )}
        {finding && finds && (
          <div role="search" className="mt-1 flex flex-wrap items-center gap-3">
            <input ref={finder} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find in this file" aria-label="Search in this file"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); } else if (e.key === "Escape") { e.preventDefault(); setFinding(false); } }}
              className="h-9 w-64 border border-line-strong bg-inset px-3 text-[14px] text-text placeholder:text-text-tertiary" />
            <span className="text-[13px] leading-5 text-text-tertiary" aria-live="polite">{!query ? "" : hits.count === 0 ? "Nothing found" : `${hits.at + 1} of ${hits.count}`}</span>
            <button type="button" onClick={() => step(-1)} disabled={hits.count === 0} className="font-bold text-text-secondary hover:text-text disabled:text-text-disabled">Previous</button>
            <button type="button" onClick={() => step(1)} disabled={hits.count === 0} className="font-bold text-text-secondary hover:text-text disabled:text-text-disabled">Next</button>
            <button type="button" onClick={() => setFinding(false)} className="font-bold text-text-secondary hover:text-text">Close the search</button>
          </div>
        )}
      </div>
      <div className="mx-8 h-px bg-line-subtle" />
      <div ref={body} className="flex min-h-0 flex-1 flex-col">{content}</div>
    </div>
  );
}

/** The tree and the reader together; `bound` is the folder a link may not leave. */
function Place({ project, root, only, title }: { project: Project; root?: string; only?: string[]; title?: string }) {
  const bound = root ?? project.folder;
  const [picked, setPicked] = useState<Entry | null>(null);
  const [trail, setTrail] = useState<Entry[]>([]);
  const [seen, setSeen] = useState<Seen>(readSeen);
  const [note, setNote] = useState<Note | null>(null);
  const [anchor, setAnchor] = useState<{ id: string; n: number } | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const seenNow = useRef(seen);
  seenNow.current = seen;

  const mark = useCallback((e: Entry) => { const s = stamp(seenNow.current, e.path, e.modified ?? 0); writeSeen(s); setSeen(s); }, []);
  const open = useCallback((e: Entry, from: "tree" | "link" | "back") => {
    setNote(changedSince(seenNow.current, e.path, e.modified) ? { tone: "info", text: "Changed since you last opened it" } : null);
    mark(e);
    setPicked(e);
    if (from === "tree") setTrail([]);
  }, [mark]);

  const follow = useCallback(async (href: string) => {
    if (!picked) return;
    const to = resolveLink(picked.path, href, bound);
    if (!to) { setNote({ tone: "warn", text: /^[a-z][a-z0-9+.-]*:/i.test(href) ? "Kona does not open web addresses from here." : "That link points outside this folder, so Kona does not open it." }); return; }
    const hash = to.anchor ? { id: to.anchor, n: Date.now() } : null;
    if (same(to.path, picked.path)) { if (hash) setAnchor(hash); return; }
    const found = await locate(bound, to.path);
    if (!found) { setNote({ tone: "warn", text: `${baseName(to.path)} is not there.` }); return; }
    setTrail((t) => [...t, picked]);
    open(found.entry, "link");
    setReveal({ dirs: found.dirs, n: Date.now() });
    setAnchor(hash);
  }, [picked, bound, open]);

  const back = useCallback(() => {
    const prev = trail[trail.length - 1];
    if (!prev) return;
    setTrail((t) => t.slice(0, -1));
    void locate(bound, prev.path).then((f) => { open(f?.entry ?? prev, "back"); if (f) setReveal({ dirs: f.dirs, n: Date.now() }); });
  }, [trail, bound, open]);

  // the open file was changed on disk: show the new text, and say so
  const fresh = useCallback((e: Entry) => { mark(e); setPicked(e); setNote({ tone: "info", text: "Updated just now. Someone or something changed this file." }); }, [mark]);

  return (
    <div className="flex h-full min-w-0 flex-1">
      <TreePanel project={project} root={root} only={only} title={title} selected={picked?.path ?? null} onPick={(e) => open(e, "tree")} seen={seen} reveal={reveal} />
      <div className="w-px bg-line-subtle" />
      <Viewer project={project} entry={picked} note={note} anchor={anchor} canGoBack={trail.length > 0} backName={trail.length ? trail[trail.length - 1].name : ""} onBack={back} onFollow={follow} onFresh={fresh} />
    </div>
  );
}

export function Files({ project }: { project: Project }) {
  return <Place key={project.id} project={project} />;
}

/** The same tree and reader, but only for some folders of one place: a person's own skills, read-only. `root` is the project's skills folder, `names` the skills this person has. */
export function SkillFiles({ project, root, names, title }: { project: Project; root: string; names: string[]; title: string }) {
  return <Place project={project} root={root} only={names} title={title} />;
}
