// A small reader for the notes and for what Claude writes: headings, paragraphs, lists, quotes, tables (shown as they are, in a fixed-width block), code blocks, `code`, **bold**, *italic*, [text](address) and [[links]]. A link to a note that exists opens it;
// one that does not is shown struck-through in red with the words "no such note" (a link that goes nowhere is a warning, not a stop).
import type { ReactNode } from "react";
import { frontMatter } from "../../lib/brain/parse.ts";

const LINK = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]|`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:[^)\s]+)\)|(?<![*\w])\*([^*\s][^*]*?)\*(?![*\w])|(?<![\w])_([^_\s][^_]*?)_(?![\w])/g;

function inline(text: string, resolve: (raw: string) => string | null, open: (id: string) => void, key: string, wiki = true): ReactNode[] {
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
    else if (m[6] !== undefined) out.push(<span key={`${key}-${i++}`} title={m[7]} className="underline decoration-text-tertiary underline-offset-2">{m[6]}</span>); // shown, not followed: a link must not take the window away from Kona
    else out.push(<em key={`${key}-${i++}`} className="italic">{m[8] ?? m[9]}</em>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** One line of text with its inline marks (bold, italic, code), for a place that is not a whole document. */
export function Inline({ text }: { text: string }) {
  return <>{inline(text, () => null, () => {}, "i", false)}</>;
}

/** chat: Claude's own words in a session: no front matter, and the text takes the colour and size of the place it is in. */
export function Markdown({ text, resolve = () => null, open = () => {}, wiki = true, chat = false }: { text: string; resolve?: (raw: string) => string | null; open?: (id: string) => void; wiki?: boolean; chat?: boolean }) {
  const { bodyStart } = chat ? { bodyStart: 0 } : frontMatter(text);
  const lines = text.replace(/\r/g, "").split("\n").slice(bodyStart);
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) {
      const code: string[] = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="m-0 overflow-x-auto bg-inset p-3 font-mono text-[13px] leading-5 text-text-secondary">{code.join("\n")}</pre>);
    } else if (/^#{1,6}\s/.test(l)) {
      const level = l.match(/^#+/)![0].length;
      const body = l.replace(/^#+\s+/, "");
      const cls = level === 1 ? "m-0 mt-2 text-[24px] leading-8 font-bold" : level === 2 ? "m-0 mt-3 text-[18px] leading-7 font-bold" : "m-0 mt-2 text-[15px] leading-6 font-bold";
      const Tag = (`h${Math.min(level + 1, 6)}`) as "h2";
      blocks.push(<Tag key={k++} className={cls}>{inline(body, resolve, open, `h${k}`, wiki)}</Tag>);
      i++;
    } else if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d+[.)]/.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+[.)])\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={k++} className={`m-0 flex flex-col gap-1.5 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((t, j) => <li key={j} className="pl-1 leading-6">{inline(t, resolve, open, `l${k}-${j}`, wiki)}</li>)}</List>);
    } else if (/^\s*\|/.test(l)) { // a table: kept as it was written, in a fixed-width block
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      blocks.push(<pre key={k++} className="m-0 overflow-x-auto bg-inset p-3 font-mono text-[13px] leading-5 text-text-secondary">{rows.join("\n")}</pre>);
    } else if (/^\s*>/.test(l)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={k++} className="m-0 border-l-2 border-line-strong pl-3 leading-6 text-text-secondary">{inline(quote.join(" "), resolve, open, `q${k}`, wiki)}</blockquote>);
    } else if (/^\s*([-*_])\1{2,}\s*$/.test(l)) {
      blocks.push(<hr key={k++} className="m-0 border-0 border-t border-line-subtle" />);
      i++;
    } else if (l.trim() === "") {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|\s*```|\s*\||\s*>|\s*([-*]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={k++} className="m-0 leading-6">{inline(para.join(" "), resolve, open, `p${k}`, wiki)}</p>);
    }
  }
  return <div className={chat ? "flex flex-col gap-3" : "flex flex-col gap-3 text-[15px] text-text-secondary"}>{blocks}</div>;
}
