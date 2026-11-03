// An .html file read as a page (the Files reader). The page is drawn inside a sandboxed frame: its scripts do not run, its links go nowhere, and nothing is fetched from the web.
// The pictures and style sheets that sit next to it in the project are read by the reader and put into the page here, so a file that points at "logo.svg" shows the logo.

const WEB = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i; // http:, https:, data:, blob:, //host ...
const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
};
const isSheet = (tag: string) => /\bstylesheet\b/i.test(attr(tag, "rel") ?? "");
const decode = (s: string) => s.replace(/&amp;/gi, "&");

const URL_IN_CSS = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s'"]+))\s*\)/gi; // url(x), url("x"), url('x'): in a style block, a style attribute or a style sheet

/** The files that CSS names with url(...): backgrounds, as written, once each. Web addresses, inline data and `#` anchors are not files. */
export function cssRefs(css: string): string[] {
  const out = new Set<string>();
  for (const m of css.matchAll(URL_IN_CSS)) {
    const ref = decode((m[1] ?? m[2] ?? m[3] ?? "").trim());
    if (ref && !ref.startsWith("#") && !WEB.test(ref)) out.add(ref);
  }
  return [...out];
}

/** The same CSS with each relative url(...) rewritten by `name` (a style sheet in another folder names its pictures from there). Others stay as they are. */
export function renameCssRefs(css: string, name: (ref: string) => string | null): string {
  return css.replace(URL_IN_CSS, (all, a?: string, b?: string, c?: string) => {
    const ref = decode((a ?? b ?? c ?? "").trim());
    if (!ref || ref.startsWith("#") || WEB.test(ref)) return all;
    const to = name(ref);
    return to === null ? all : `url("${to}")`;
  });
}

/** The files a page names on this computer: its pictures, its style sheets and the backgrounds in its CSS, as written in the page, once each. Web addresses and inline data are not files. */
export function pageRefs(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<(img|link)\b[^>]*>/gi)) {
    const tag = m[0];
    const ref = m[1].toLowerCase() === "img" ? attr(tag, "src") : isSheet(tag) ? attr(tag, "href") : undefined;
    if (ref && !WEB.test(ref.trim())) out.add(decode(ref.trim()));
  }
  for (const ref of cssRefs(html)) out.add(ref);
  return [...out];
}

export type Page = { html: string; scripts: number; web: number };

/** The page ready for the frame. `got` holds what the reader found for each name from `pageRefs`: a picture as a data address, a style sheet as its text. */
export function buildPage(html: string, got: Map<string, string>): Page {
  let scripts = 0, web = 0;
  let out = html.replace(/<script\b[^>]*\/>|<script\b[\s\S]*?<\/script\s*>|<script\b[^>]*>/gi, () => { scripts++; return ""; });
  out = out.replace(/<base\b[^>]*>|<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "");
  out = out.replace(/<(img|link|a)\b[^>]*>/gi, (tag, name: string) => {
    const n = name.toLowerCase();
    if (n === "a") return tag.replace(/(\shref\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i, (all, lead: string, a?: string, b?: string, c?: string) => {
      const v = (a ?? b ?? c ?? "").trim();
      return v.startsWith("#") ? all : `${lead}"#"`; // a link inside the page may not take the frame anywhere
    });
    const key = n === "img" ? "src" : "href";
    if (n === "link" && !isSheet(tag)) return tag;
    const ref = attr(tag, key)?.trim();
    if (!ref) return tag;
    if (WEB.test(ref)) { if (!/^data:/i.test(ref)) web++; return tag; }
    const hit = got.get(decode(ref));
    if (hit === undefined) return tag;
    return n === "img" ? tag.replace(/(\ssrc\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `$1"${hit}"`) : `<style>${hit.replace(/<\/style/gi, "<\\/style")}</style>`;
  });
  // a picture used as a background is written once, as a variable in the page, and every url(...) that names it points there:
  // a page that cuts one big picture into seven strips would otherwise carry seven copies of it
  const vars: string[] = [], seen = new Map<string, string>();
  out = out.replace(URL_IN_CSS, (all, a?: string, b?: string, c?: string) => {
    const ref = decode((a ?? b ?? c ?? "").trim());
    if (!ref || ref.startsWith("#")) return all;
    const hit = got.get(ref); // a style sheet's own pictures are named "kona:<path>" by the reader, and are found here too
    if (hit === undefined || !/^data:image\//i.test(hit)) { if (WEB.test(ref) && !/^(?:data|kona):/i.test(ref)) web++; return all; }
    let name = seen.get(ref);
    if (!name) { name = `--kona-pic-${vars.length}`; seen.set(ref, name); vars.push(`${name}:url("${hit}");`); }
    return `var(${name})`;
  });
  if (vars.length > 0) {
    const style = `<style>:root{${vars.join("")}}</style>`;
    const doc = /^\s*<!doctype[^>]*>/i.exec(out);
    out = doc ? out.slice(0, doc[0].length) + style + out.slice(doc[0].length) : style + out;
  }
  return { html: out, scripts, web };
}
