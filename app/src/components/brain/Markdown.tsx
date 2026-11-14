// A small reader for the notes and for what Claude writes: headings (each with an id, so a link or the outline can jump to it), paragraphs, lists (nested, and checklists),
// quotes and callouts (> [!WARNING], > **Note:**), tables (sortable, see MdTable), code blocks with Copy, ```mermaid diagrams drawn as pictures (see GraphView), ```chart blocks drawn as charts (see Chart), `code`, **bold**,
// *italic*, [text](address) and [[links]]. A link to a note that exists opens it; one that does not is shown struck-through in red with the words "no such note" (a link that
// goes nowhere is a warning, not a stop). A link to another file or heading ([text](docs/other.md), [text](#part)) is followed when the place gives a `go`; a web address (http, https)
// opens in the owner's browser. Numbered items keep counting across a blank line between them, and start at the number the first one carries.
import { lazy, Suspense, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { frontMatter } from "../../lib/brain/parse.ts";
import { parseTable } from "../../lib/brain/table.ts";
import { parseCallout, type CalloutKind } from "../../lib/brain/callout.ts";
import { headingsOf } from "../../lib/brain/outline.ts";
import { Glyph, type GlyphState } from "../ui";
import { CodeBlock } from "./Copy";
import { GraphView } from "./GraphView";
import { MdTable } from "./MdTable";

const DIAGRAM = new Set(["mermaid", "flowchart", "graph"]);
// a ```chart block is drawn by Chart.tsx (lib/brain/chart.ts has the syntax). It is loaded the first time a note holds one, so a note without a chart pays nothing for it.
const Chart = lazy(() => import("./Chart"));
const ITEM = /^(\s*)([-*]|\d+[.)])\s+(.*)$/;

/** A box in front of a checklist item: ticked or empty, with the word for a screen reader. */
const Tick = ({ done }: { done: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" role="img" aria-label={done ? "Done" : "Not done"} className="mt-1 shrink-0">
    <rect x="1.5" y="1.5" width="13" height="13" fill={done ? "var(--color-accent)" : "var(--color-inset)"} stroke={done ? "var(--color-accent)" : "var(--color-line-strong)"} strokeWidth="1.5" />
    {done && <path d="M4.5 8.5 L7 11 L11.5 5" fill="none" stroke="var(--color-on-accent)" strokeWidth="2" strokeLinecap="square" />}
  </svg>
);

// a callout says its kind as a glyph and a word, never by colour alone
const CALLOUT: Record<CalloutKind, { state: GlyphState; word: string; color: string }> = {
  note: { state: "idle", word: "Note", color: "var(--color-state-idle)" },
  tip: { state: "done", word: "Tip", color: "var(--color-state-done)" },
  important: { state: "live", word: "Important", color: "var(--color-state-live)" },
  warning: { state: "waiting", word: "Warning", color: "var(--color-state-waiting)" },
  caution: { state: "left", word: "Caution", color: "var(--color-state-left)" },
};

const LINK = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]|`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![*\w])\*([^*\s][^*]*?)\*(?![*\w])|(?<![\w])_([^_\s][^_]*?)_(?![\w])/g;

function inline(text: string, resolve: (raw: string) => string | null, open: (id: string) => void, key: string, wiki = true, go?: (href: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(LINK)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1] !== undefined && !wiki) out.push(m[0]);
    else if (m[1] !== undefined) {
      const target = resolve(m[1]);
      const label = (m[3] ?? m[1]).trim();
      out.push(target
        ? <button key={`${key}-${i++}`} type="button" onClick={() => open(target)} className="font-bold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">{label}</button>
        : <span key={`${key}-${i++}`} title="No such note" className="text-state-left line-through decoration-state-left/60">{label} <span className="no-underline">(no such note)</span></span>);
    } else if (m[4] !== undefined) out.push(<code key={`${key}-${i++}`} className="bg-inset px-1.5 py-0.5 font-mono text-[13px] text-text">{m[4]}</code>);
    else if (m[5] !== undefined) out.push(<strong key={`${key}-${i++}`} className="font-bold text-text">{m[5]}</strong>);
    else if (m[6] !== undefined) {
      const href = m[7];
      if (go && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) { // a file or a heading of this place: followed
        out.push(<button key={`${key}-${i++}`} type="button" title={href} onClick={() => go(href)} style={{ fontFamily: "var(--font-sans)", letterSpacing: "normal", fontWeight: 700 }} className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">{m[6]}</button>);
      } else if (/^https?:\/\//i.test(href)) { // a web address opens in the owner's own browser, never inside Kona's window
        out.push(<button key={`${key}-${i++}`} type="button" title={`Open ${href} in your browser`} onClick={() => { void openUrl(href); }} style={{ fontFamily: "var(--font-sans)", letterSpacing: "normal", fontWeight: "inherit" }} className="text-left text-text underline decoration-text-tertiary underline-offset-2 hover:decoration-text">{m[6]}</button>);
      } else out.push(<span key={`${key}-${i++}`} title={href} className="underline decoration-text-tertiary underline-offset-2">{m[6]}</span>); // any other address (mailto:, a file: path) is shown, not followed
    } else out.push(<em key={`${key}-${i++}`} className="italic">{m[8] ?? m[9]}</em>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** One line of text with its inline marks (bold, italic, code), for a place that is not a whole document. */
export function Inline({ text }: { text: string }) {
  return <>{inline(text, () => null, () => {}, "i", false)}</>;
}

/** The front matter of a file as a row of small facts (kind, date, status), so a note's own header is not lost when the page shows only its body. */
function FrontCard({ meta }: { meta: Record<string, string> }) {
  const rows = Object.entries(meta).filter(([, v]) => v !== "").slice(0, 10);
  if (rows.length === 0) return null;
  return (
    <dl className="m-0 flex flex-wrap gap-x-5 gap-y-1.5 border border-line-subtle bg-surface-2 px-3.5 py-2.5" aria-label="About this file">
      {rows.map(([k, v]) => (
        <div key={k} className="flex min-w-0 items-baseline gap-2">
          <dt className="text-[13px] leading-5 text-text-tertiary">{k}</dt>
          <dd className="m-0 min-w-0 truncate text-[14px] leading-5 font-bold text-text-secondary" title={v}>{v.length > 80 ? v.slice(0, 80) + "…" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** chat: Claude's own words in a session: no front matter, and the text takes the colour and size of the place it is in.
 *  front: show the file's front matter above its body. go: follow a link to another file or heading ([text](docs/other.md), [text](#part)). */
export function Markdown({ text, resolve = () => null, open = () => {}, wiki = true, chat = false, front = false, go }: {
  text: string; resolve?: (raw: string) => string | null; open?: (id: string) => void; wiki?: boolean; chat?: boolean; front?: boolean; go?: (href: string) => void;
}) {
  const { meta, bodyStart } = chat ? { meta: {}, bodyStart: 0 } : frontMatter(text);
  const lines = text.replace(/\r/g, "").split("\n").slice(bodyStart);
  const heads = chat ? [] : headingsOf(lines); // the same list the outline uses, so a heading's id is the same in both
  const blocks: ReactNode[] = [];
  const txt = (s: string, key: string) => inline(s, resolve, open, key, wiki, go);
  let i = 0, k = 0, h = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) {
      const lang = (/^\s*```\s*([\w-]*)/.exec(l)?.[1] ?? "").toLowerCase();
      const code: string[] = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      const closed = i < lines.length; // a reply still being written has no closing fence yet: it is not drawn until it has one
      i++;
      blocks.push(
        DIAGRAM.has(lang) && closed ? <GraphView key={k++} source={code.join("\n")} />
        : lang === "chart" && closed ? <Suspense key={k++} fallback={<div className="my-3 h-48 border border-line-subtle bg-inset" aria-busy="true" />}><Chart source={code.join("\n")} /></Suspense>
        : <CodeBlock key={k++} text={code.join("\n")} />,
      );
    } else if (/^#{1,6}\s/.test(l)) {
      const level = l.match(/^#+/)![0].length;
      const body = l.replace(/^#+\s+/, "").replace(/\s+#+\s*$/, "");
      const cls = level === 1 ? "m-0 mt-2 text-[24px] leading-8 font-bold" : level === 2 ? "m-0 mt-3 text-[18px] leading-7 font-bold" : "m-0 mt-2 text-[15px] leading-6 font-bold";
      const Tag = (`h${Math.min(level + 1, 6)}`) as "h2";
      blocks.push(<Tag key={k++} id={heads[h++]?.id} className={`${cls} scroll-mt-3`}>{txt(body, `h${k}`)}</Tag>);
      i++;
    } else if (ITEM.test(l)) {
      // the depth of an item is its place among the indents seen so far, so two or four spaces both work; an indented line under an item continues it
      const items: { depth: number; ordered: boolean; num: number; text: string }[] = [];
      const indents: number[] = [];
      while (i < lines.length) {
        const m = ITEM.exec(lines[i]);
        if (m) {
          const ind = m[1].replace(/\t/g, "    ").length;
          while (indents.length && ind < indents[indents.length - 1]) indents.pop();
          if (!indents.length || ind > indents[indents.length - 1]) indents.push(ind);
          items.push({ depth: indents.length - 1, ordered: /\d/.test(m[2]), num: parseInt(m[2], 10), text: m[3] });
          i++;
        } else if (/^\s{2,}\S/.test(lines[i]) && !/^\s*```/.test(lines[i])) { items[items.length - 1].text += " " + lines[i++].trim(); }
        else if (lines[i].trim() === "") { // a blank line between two items does not end the list, or "1. 1. 1." would be drawn for 1, 2, 3
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === "") j++;
          if (j < lines.length && ITEM.test(lines[j])) i = j; else break;
        } else break;
      }
      const count: (number | undefined)[] = [];
      blocks.push(
        <ul key={k++} className="m-0 flex list-none flex-col gap-1.5 p-0">
          {items.map((it, j) => {
            const prev = count[it.depth];
            count.length = it.depth + 1; count[it.depth] = it.ordered ? (prev === undefined ? it.num : prev + 1) : undefined; // the first number is kept ("3." starts at 3), then it counts on; a bullet between two numbered runs starts the numbering again
            const task = /^\[([ xX])\]\s+/.exec(it.text);
            const marker = task ? <Tick done={task[1] !== " "} />
              : it.ordered ? <span className="min-w-6 shrink-0 text-right text-text-tertiary">{count[it.depth]}.</span>
              : <span aria-hidden="true" className={`mt-[10px] ml-1.5 mr-0.5 size-1.5 shrink-0 ${it.depth === 0 ? "bg-text-tertiary" : "border border-text-tertiary"}`} />;
            return (
              <li key={j} className="flex gap-2.5 leading-6" style={{ marginLeft: it.depth * 24 }}>
                {marker}<span className="min-w-0">{txt(task ? it.text.slice(task[0].length) : it.text, `l${k}-${j}`)}</span>
              </li>
            );
          })}
        </ul>);
    } else if (/^\s*\|/.test(l)) { // a table with a divider row is drawn as a table; pipe lines without one stay as written
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const table = parseTable(rows);
      blocks.push(table
        ? <MdTable key={`t${k++}-${table.head.join("|")}-${table.rows.length}`} table={table} source={rows.join("\n")} cell={(s, key) => <>{txt(s, key)}</>} />
        : <CodeBlock key={k++} text={rows.join("\n")} />);
    } else if (/^\s*>/.test(l)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      const call = parseCallout(quote);
      if (call) {
        const c = CALLOUT[call.kind];
        blocks.push(
          <aside key={k++} aria-label={c.word} className="flex flex-col gap-1.5 border border-line-subtle border-l-4 bg-surface-2 px-3.5 py-2.5" style={{ borderLeftColor: c.color }}>
            <span className="flex items-center gap-2 font-pixel text-[15px] leading-5 font-bold" style={{ color: c.color }}><Glyph state={c.state} size={16} />{c.word}</span>
            {call.paragraphs.map((p, j) => <p key={j} className="m-0 leading-6 text-text-secondary">{txt(p, `c${k}-${j}`)}</p>)}
          </aside>);
      } else blocks.push(<blockquote key={k++} className="m-0 border-l-2 border-line-strong pl-3 leading-6 text-text-secondary">{txt(quote.join(" "), `q${k}`)}</blockquote>);
    } else if (/^\s*([-*_])\1{2,}\s*$/.test(l)) {
      blocks.push(<hr key={k++} className="m-0 border-0 border-t border-line-subtle" />);
      i++;
    } else if (l.trim() === "") {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|\s*```|\s*\||\s*>|\s*([-*]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={k++} className="m-0 leading-6">{txt(para.join(" "), `p${k}`)}</p>);
    }
  }
  return (
    <div className={chat ? "flex min-w-0 flex-col gap-3 [overflow-wrap:anywhere]" : "flex flex-col gap-3 text-[15px] text-text-secondary"}>
      {front && !chat && <FrontCard meta={meta} />}
      {blocks}
    </div>
  );
}
