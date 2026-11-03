// An .html file read as a page (the Files reader). The page is drawn inside a sandboxed frame: its scripts do not run, its links go nowhere, and nothing is fetched from the web.
// The pictures and style sheets that sit next to it in the project are read by the reader and put into the page here, so a file that points at "logo.svg" shows the logo.

const WEB = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i; // http:, https:, data:, blob:, //host ...
const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
};
const isSheet = (tag: string) => /\bstylesheet\b/i.test(attr(tag, "rel") ?? "");
const decode = (s: string) => s.replace(/&amp;/gi, "&");

/** The files a page names on this computer: its pictures and its style sheets, as written in the page, once each. Web addresses and inline data are not files. */
export function pageRefs(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<(img|link)\b[^>]*>/gi)) {
    const tag = m[0];
    const ref = m[1].toLowerCase() === "img" ? attr(tag, "src") : isSheet(tag) ? attr(tag, "href") : undefined;
    if (ref && !WEB.test(ref.trim())) out.add(decode(ref.trim()));
  }
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
  return { html: out, scripts, web };
}
