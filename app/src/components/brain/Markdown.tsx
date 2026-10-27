// A small reader for the notes: headings, paragraphs, lists, code blocks, `code`, **bold** and [[links]]. A link to a note that exists opens it;
// one that does not is shown struck-through in red with the words "no such note" (a link that goes nowhere is a warning, not a stop).
import type { ReactNode } from "react";
import { frontMatter } from "../../lib/brain/parse.ts";

const LINK = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]|`([^`]+)`|\*\*([^*]+)\*\*/g;

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
        ? <button key={`${key}-${i++}`} type="button" onClick={() => open(target)} className="rounded font-bold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">{label}</button>
        : <span key={`${key}-${i++}`} title="No such note" className="text-state-left line-through decoration-state-left/60">{label} <span className="no-underline">(no such note)</span></span>);
    } else if (m[4] !== undefined) out.push(<code key={`${key}-${i++}`} className="rounded bg-inset px-1.5 py-0.5 font-mono text-[13px] text-text">{m[4]}</code>);
    else out.push(<strong key={`${key}-${i++}`} className="font-bold text-text">{m[5]}</strong>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, resolve, open, wiki = true }: { text: string; resolve: (raw: string) => string | null; open: (id: string) => void; wiki?: boolean }) {
  const { bodyStart } = frontMatter(text);
  const lines = text.replace(/\r/g, "").split("\n").slice(bodyStart);
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) {
      const code: string[] = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="m-0 overflow-x-auto rounded-control bg-inset p-3 font-mono text-[13px] leading-5 text-text-secondary">{code.join("\n")}</pre>);
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
    } else if (l.trim() === "") {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|\s*```|\s*([-*]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={k++} className="m-0 leading-6">{inline(para.join(" "), resolve, open, `p${k}`, wiki)}</p>);
    }
  }
  return <div className="flex flex-col gap-3 text-[15px] text-text-secondary">{blocks}</div>;
}
