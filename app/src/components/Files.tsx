// The Files place: a folder tree on the left, a read-only viewer on the right (feature F4).
// Folders are read one level at a time, only when opened, so a big project costs nothing until you look in it.
// The viewer follows links between files (with a way back), lists the headings of a long page, finds words in it, copies tables and code, and says when an agent
// changed the file: the open file and the open folders are looked at again every few seconds while the window is showing.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { baseName, gitMarks, humanSize, listDir, readFile, type Entry, type FileView, type GitMark, type Project } from "../lib/api";
import { GIT_WORD, gitView, type GitCode } from "../lib/gitmarks.ts";
import { dirOf, resolveLink } from "../lib/brain/outline.ts";
import { changedSince, readSeen, stamp, writeSeen, type Seen } from "../lib/seen.ts";
import { buildPage, cssRefs, pageRefs, renameCssRefs } from "../lib/htmlpage.ts";
import { Button, Glyph } from "./ui";
import { IconButton } from "./Icon";
import { FileInfo } from "./FileInfo";
import { Markdown } from "./brain/Markdown";
import { FindBar, Gutter, Outline, OutlineRail, useOutlineOpen, useReader } from "./brain/Reader";

const QUIET = new Set([".git", "node_modules", "target", "dist", ".kona", "__pycache__", ".next", ".venv"]);
const SEP = /[\\/]/;
const same = (a: string, b: string) => a.toLowerCase().replace(/\//g, "\\") === b.toLowerCase().replace(/\//g, "\\");

export function Chevron({ open }: { open: boolean }) {
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

// the letter beside a file that Git sees as different, like an editor shows: the colour says it too, never alone (the letter and the hover words do)
const GIT_COLOR: Record<GitCode, string> = { U: "text-state-done", A: "text-state-done", M: "text-state-waiting", D: "text-state-left", C: "text-state-left" };

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
  const [marks, setMarks] = useState<GitMark[]>([]);
  const git = useMemo(() => gitView(marks), [marks]);

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

  // what Git says is read again with the folders: the letters (U, A, M, D) follow a file an agent made or changed. A project that is not a Git folder has none.
  useEffect(() => {
    let live = true;
    const read = () => { if (document.visibilityState === "visible") gitMarks(project.folder).then((m) => { if (live) setMarks((cur) => (JSON.stringify(cur) === JSON.stringify(m) ? cur : m)); }).catch(() => {}); };
    read();
    const t = setInterval(read, 4000);
    return () => { live = false; clearInterval(t); };
  }, [project.folder]);

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
      const g = git.of(e.path, e.is_dir);
      const gWord = !g ? "" : e.is_dir && git.of(e.path, false) !== g ? "Has changes inside" : GIT_WORD[g]; // a folder that is itself new says so; one that holds changes says that
      return (
        <div key={e.path}>
          <button
            onClick={() => (e.is_dir ? toggle(e) : onPick(e))}
            role="treeitem" data-path={e.path} data-parent={dir} data-dir={e.is_dir ? "1" : undefined} aria-level={depth + 1}
            aria-expanded={e.is_dir ? isOpen : undefined}
            aria-current={on ? "true" : undefined}
            title={[e.path, gWord, changed && "Changed since you last opened it"].filter(Boolean).join("\n")}
            className={`flex h-8 w-full items-center gap-1.5 pr-2.5 text-left text-[14px] transition-colors ${on ? "bg-surface-3" : "hover:bg-surface-2"} ${QUIET.has(e.name) ? "text-text-tertiary" : ""}`}
            style={{ paddingLeft: 8 + depth * 18 }}
          >
            {e.is_dir ? <Chevron open={isOpen} /> : <span className="w-4 shrink-0" />}
            {e.is_dir ? <FolderIcon /> : <FileIcon />}
            <span className="truncate">{e.name}</span>
            {(changed || g) && (
              <span className="ml-auto flex shrink-0 items-center gap-2">
                {changed && <><span aria-hidden="true" className="size-2 shrink-0 bg-accent" /><span className="sr-only">Changed since you last opened it</span></>}
                {g && (e.is_dir
                  ? <><span aria-hidden="true" className={`size-2 shrink-0 bg-current ${GIT_COLOR[g]}`} /><span className="sr-only">{gWord}</span></>
                  : <><span aria-hidden="true" className={`font-pixel text-[13px] leading-4 font-bold ${GIT_COLOR[g]}`}>{g}</span><span className="sr-only">{gWord}</span></>)}
              </span>
            )}
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

type Note = { tone: "info" | "warn"; text: string };

/** An .html file drawn as a page inside a sandboxed frame: its scripts do not run and nothing comes from the web. Its pictures and style sheets from the project are read and put in first. */
function HtmlFrame({ html, path, bound, name, slot }: { html: string; path: string; bound: string; name: string; slot: HTMLElement | null }) {
  const [shown, setShown] = useState<{ url: string; scripts: number; web: number } | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    let live = true, url = "";
    (async () => {
      const got = new Map<string, string>();
      // a picture is read once, however many places name it
      const pictures = new Map<string, string | null>();
      const picture = async (from: string, ref: string): Promise<string | null> => {
        const to = resolveLink(from, ref, bound);
        if (!to) return null;
        if (!pictures.has(to.path)) {
          try { const v = await readFile(to.path); pictures.set(to.path, v.kind === "image" ? `data:${v.mime};base64,${v.data}` : null); }
          catch { pictures.set(to.path, null); } // a file that is not there: the page shows its own broken picture
        }
        return pictures.get(to.path) ?? null;
      };
      for (const ref of pageRefs(html).slice(0, 60)) {
        const to = resolveLink(path, ref, bound);
        if (!to) continue;
        try {
          if (/\.css$/i.test(ref.split(/[?#]/)[0])) {
            const v = await readFile(to.path);
            if (v.kind !== "text") continue;
            // the pictures a style sheet names are found from the sheet's own folder, then written into the page under a name of their own
            const names = new Map<string, string>();
            for (const r of cssRefs(v.text).slice(0, 60)) { const d = await picture(to.path, r); const target = resolveLink(to.path, r, bound); if (d && target) { got.set(`kona:${target.path}`, d); names.set(r, `kona:${target.path}`); } }
            got.set(ref, renameCssRefs(v.text, (r) => names.get(r) ?? null));
          } else {
            const d = await picture(path, ref);
            if (d) got.set(ref, d);
          }
        } catch { /* a file that cannot be read: the page shows what it can */ }
      }
      if (!live) return;
      const page = buildPage(html, got);
      url = URL.createObjectURL(new Blob([page.html], { type: "text/html;charset=utf-8" }));
      setShown({ url, scripts: page.scripts, web: page.web });
    })();
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [html, path, bound]);

  if (!shown) return <p className="m-0 p-8 text-text-tertiary">Reading…</p>;
  const says = [shown.scripts > 0 && "This page has scripts. Kona does not run them.", shown.web > 0 && "Pictures from the web are not loaded."].filter(Boolean).join(" ");
  // Ctrl and the wheel over the page zoom it. The frame may be read from here (allow-same-origin) and still runs nothing: with no allow-scripts a page's scripts and handlers are
  // switched off, and buildPage has taken the scripts out as well. The wheel listener is put on the page's own window, because wheel events inside a frame never reach this one.
  const watchWheel = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      e.currentTarget.contentWindow?.addEventListener("wheel", (w) => {
        if (!w.ctrlKey) return;
        w.preventDefault();
        setScale((s) => Math.min(PAGE_MAX, Math.max(PAGE_MIN, s * Math.exp(-w.deltaY * 0.0015))));
      }, { passive: false });
    } catch { /* the frame cannot be reached: the buttons still zoom */ }
  };
  const pct = Math.round(scale * 100);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {says && <div className="px-8 pb-2 text-[13px] leading-5 text-text-tertiary">{says}</div>}
      {slot && createPortal(<ZoomBar wheel pct={pct} canOut={scale > PAGE_MIN} canIn={scale < PAGE_MAX} onOut={() => setScale((s) => Math.max(PAGE_MIN, s / IMG_STEP))} onIn={() => setScale((s) => Math.min(PAGE_MAX, s * IMG_STEP))}
        onReset={() => setScale(1)} resetTitle="Back to 100%" />, slot)}
      {/* the page is drawn in a frame that is 1/scale as big again and then shrunk or grown, which is what a browser's zoom does: the page lays itself out again for the new width */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
        <iframe title={name} src={shown.url} sandbox="allow-same-origin" onLoad={watchWheel} className="absolute top-0 left-0 border-0 bg-white" style={{ width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "0 0" }} />
      </div>
    </div>
  );
}

const IMG_MIN = 0.1, IMG_MAX = 8, IMG_STEP = 1.25, PAGE_MIN = 0.25, PAGE_MAX = 3;

/** The three zoom controls: smaller, the percent (it goes back to the usual size; `resetTitle` says which), bigger. Shared by pictures and html pages. */
function ZoomBar({ pct, canOut, canIn, onOut, onIn, onReset, resetTitle, wheel = false }: { wheel?: boolean; pct: number; canOut: boolean; canIn: boolean; onOut: () => void; onIn: () => void; onReset: () => void; resetTitle: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Zoom">
      <IconButton icon="zoomOut" label={`Zoom out${wheel ? " (Ctrl and the mouse wheel)" : ""}`} disabled={!canOut} onClick={onOut} />
      <Button variant="quiet" small className="w-[72px]" onClick={onReset} title={resetTitle}>{pct}%</Button>
      <IconButton icon="zoomIn" label={`Zoom in${wheel ? " (Ctrl and the mouse wheel)" : ""}`} disabled={!canIn} onClick={onIn} />
    </div>
  );
}

/** A picture that can be made bigger or smaller: the two buttons, Ctrl and the mouse wheel (a pinch on a touchpad is the same thing), and a drag to move it once it is bigger than the window.
 *  It opens fitted to the window (never bigger than it really is); the percent in the middle goes to the real size and back. Zooming keeps the point under the pointer where it is. */
function ImageView({ src, name, slot }: { src: string; name: string; slot: HTMLElement | null }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<number | null>(null); // null: fitted to the window
  const anchor = useRef<{ fx: number; fy: number; px: number; py: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const fit = nat && room.w > 0 ? Math.min((room.w - 48) / nat.w, (room.h - 48) / nat.h, 1) : 1;
  const scale = zoom ?? fit;
  const now = useRef({ scale, nat });
  now.current = { scale, nat };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver(() => setRoom({ w: el.clientWidth, h: el.clientHeight }));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  /** Go to `next`, keeping the spot under (x, y) (the middle of the window when not given) where it is. */
  const zoomTo = useCallback((next: number, x?: number, y?: number) => {
    const b = box.current, i = img.current;
    if (!b || !i || !now.current.nat) return;
    const r = i.getBoundingClientRect(), br = b.getBoundingClientRect();
    const px = x ?? br.left + br.width / 2, py = y ?? br.top + br.height / 2;
    const to01 = (v: number) => Math.min(1, Math.max(0, v));
    anchor.current = { fx: to01((px - r.left) / r.width), fy: to01((py - r.top) / r.height), px: px - br.left, py: py - br.top };
    setZoom(Math.min(IMG_MAX, Math.max(IMG_MIN, next)));
  }, []);

  useLayoutEffect(() => {
    const a = anchor.current, b = box.current, i = img.current;
    anchor.current = null;
    if (!a || !b || !i) return;
    const r = i.getBoundingClientRect(), br = b.getBoundingClientRect();
    b.scrollLeft += r.left + a.fx * r.width - (br.left + a.px);
    b.scrollTop += r.top + a.fy * r.height - (br.top + a.py);
  }, [scale]);

  // Ctrl and the wheel: the listener is made by hand because a page listener may not stop the window's own zoom unless it is not passive
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTo(now.current.scale * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomTo]);

  const pct = Math.round(scale * 100);
  const real = Math.abs(scale - 1) < 0.005; // at its real size, the percent goes back to fitted; anywhere else it goes to the real size
  const bigger = !!box.current && !!nat && (nat.w * scale > room.w - 48 || nat.h * scale > room.h - 48);
  return (
    <div className="relative flex min-h-0 flex-1 bg-inset">
      <div
        ref={box}
        className={`flex min-h-0 flex-1 overflow-auto p-6 ${bigger ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        onPointerDown={(e) => { if (e.button !== 0 || !bigger || !box.current) return; drag.current = { x: e.clientX, y: e.clientY, left: box.current.scrollLeft, top: box.current.scrollTop }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current, b = box.current; if (d && b) { b.scrollLeft = d.left - (e.clientX - d.x); b.scrollTop = d.top - (e.clientY - d.y); } }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
      >
        <img
          ref={img} src={src} alt={name} draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth || 300, h: e.currentTarget.naturalHeight || 150 })}
          className="m-auto max-w-none shrink-0"
          style={nat ? { width: nat.w * scale, height: nat.h * scale, imageRendering: scale >= 2 ? "pixelated" : "auto" } : { opacity: 0 }}
        />
      </div>
      {slot && createPortal(<ZoomBar wheel pct={pct} canOut={!!nat && scale > IMG_MIN} canIn={!!nat && scale < IMG_MAX} onOut={() => zoomTo(scale / IMG_STEP)} onIn={() => zoomTo(scale * IMG_STEP)}
        onReset={() => (real ? setZoom(null) : zoomTo(1))} resetTitle={real ? "Fit it to the window" : "Show it at its real size"} />, slot)}
    </div>
  );
}

function Viewer({ project, entry, note, anchor, canGoBack, backName, onBack, onFollow, onFresh }: {
  project: Project; entry: Entry | null; note: Note | null; anchor: { id: string; n: number } | null; canGoBack: boolean; backName: string; onBack: () => void; onFollow: (href: string) => void; onFresh: (e: Entry) => void;
}) {
  const [about, setAbout] = useState(false); // the dialog with the size, the date and the path of the open file
  const [zoomSlot, setZoomSlot] = useState<HTMLElement | null>(null); // where a picture or a page puts its zoom buttons: in the title row, beside the file name
  const [rendered, setRendered] = useState(true); // a markdown or html file is shown read as a page, with a switch to the plain text
  const [view, setView] = useState<FileView | { error: string } | "loading" | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const again = shown.current === (entry?.path ?? null); // the same file read again after a change: keep what is on the screen, and the place in it
    shown.current = entry?.path ?? null;
    if (!again) { setView(entry ? "loading" : null); setPdfUrl(null); }
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
  // the outline, find and the jump to a heading are shared with the Brain's note page (brain/Reader.tsx)
  const reader = useReader({ text: text ? text.text : null, md, rendered, finds: !!finds, anchor, resetKey: entry?.path ?? null });
  const { heads, active, jump, finding, body, scroller } = reader;
  const [outlineOpen, setOutlineOpen] = useOutlineOpen();
  const hasOutline = md && rendered && heads.length >= 3;
  useEffect(() => { setAbout(false); }, [entry?.path]);

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
      <HtmlFrame key={entry.path} html={view.text} path={entry.path} bound={project.folder} name={entry.name} slot={zoomSlot} />
    ) : md && rendered ? (
      <div className="flex min-h-0 flex-1">
        {hasOutline && (outlineOpen ? <Outline heads={heads} active={active} onJump={jump} onClose={() => setOutlineOpen(false)} /> : <OutlineRail onOpen={() => setOutlineOpen(true)} />)}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view.truncated && <div className="px-8 pb-2 text-[13px] leading-5 text-text-tertiary">Only the first 2 MB are shown.</div>}
          <div ref={scroller} className="min-h-0 flex-1 overflow-auto px-8 py-5"><div className="max-w-[calc(1180px*var(--k))]"><Markdown text={view.text} resolve={() => null} open={() => {}} wiki={false} front go={onFollow} /></div></div>
        </div>
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col">
        {(view.truncated || tidy) && <div className="px-8 pb-2 text-[13px] leading-5 text-text-tertiary">{view.truncated ? "Only the first 2 MB are shown." : "Shown with tidy spacing."}</div>}
        <div className="min-h-0 flex-1 overflow-auto py-3"><Gutter text={t} /></div>
      </div>
    );
  } else if (view.kind === "image") content = <ImageView key={entry.path} src={`data:${view.mime};base64,${view.data}`} name={entry.name} slot={zoomSlot} />;
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
          <h2 className="m-0 min-w-0 flex-1 truncate text-[22px] leading-[30px] font-bold" title={rel}>{entry.name}</h2>
          {finds && <Button variant="ghost" small onClick={reader.toggleFind} aria-pressed={finding} title="Find on this page (Ctrl+F)">Find</Button>}
          {(md || html) && <Button variant="ghost" small onClick={() => setRendered((r) => !r)} aria-pressed={rendered}>{rendered ? "Show the text" : "Show it as a page"}</Button>}
          <span ref={setZoomSlot} className="flex shrink-0 items-center" />
          <IconButton icon="info" label="About this file" onClick={() => setAbout(true)} />
        </div>
        {note && (
          <div role="status" className={`flex items-center gap-2 text-[13px] leading-5 font-bold ${note.tone === "warn" ? "text-state-left" : "text-state-live"}`}>
            <Glyph state={note.tone === "warn" ? "left" : "live"} size={14} />{note.text}
          </div>
        )}
        {finding && finds && <FindBar reader={reader} />}
      </div>
      <div className="mx-8 h-px bg-line-subtle" />
      <div ref={body} className="flex min-h-0 flex-1 flex-col">{content}</div>
      {about && <FileInfo entry={entry} rel={rel} onClose={() => setAbout(false)} />}
    </div>
  );
}

/** The tree and the reader together; `bound` is the folder a link may not leave. */
function Place({ project, root, only, title, target, onUsed }: { project: Project; root?: string; only?: string[]; title?: string; target?: { path: string; n: number } | null; onUsed?: () => void }) {
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

  // a file another page asked to show (the terminal, from a path in its output): it opens in the tree and the reader, or says it is not there
  const used = useRef(onUsed);
  used.current = onUsed;
  useEffect(() => {
    if (!target) return;
    let live = true;
    void locate(bound, target.path).then((f) => {
      if (!live) return;
      if (!f) setNote({ tone: "warn", text: `${baseName(target.path)} is not in this project.` });
      else { open(f.entry, "tree"); setReveal({ dirs: f.dirs, n: Date.now() }); }
      used.current?.(); // asked once: opening Files later by hand must not jump to this file again
    });
    return () => { live = false; };
  }, [target, bound, open]);

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

export function Files({ project, target, onUsed }: { project: Project; target?: { path: string; n: number } | null; onUsed?: () => void }) {
  return <Place key={project.id} project={project} target={target} onUsed={onUsed} />;
}

/** The same tree and reader, but only for some folders of one place: a person's own skills, read-only. `root` is the project's skills folder, `names` the skills this person has. */
export function SkillFiles({ project, root, names, title }: { project: Project; root: string; names: string[]; title: string }) {
  return <Place project={project} root={root} only={names} title={title} />;
}
