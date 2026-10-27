// Cleaning what the model wrote before it is saved as a note (pure, so it is tested under Node).

/** Turn any [[link]] the model made up (not in `known`) back into plain words, and drop front matter or a repeated title it may have added. */
export function cleanBody(text: string, known: Set<string>): { title: string; body: string } {
  const lines = text.replace(/\r/g, "").split("\n");
  let title = "";
  const ti = lines.findIndex((l) => /^\s*TITLE:/i.test(l));
  if (ti >= 0) { title = lines[ti].replace(/^\s*TITLE:\s*/i, "").trim(); lines.splice(ti, 1); }
  let body = lines.join("\n").trim().replace(/^---[\s\S]*?\n---\s*/, "").replace(/^#\s+.*\n+/, "");
  body = body.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_m, target: string, shown?: string) => (known.has(target.trim().toLowerCase()) ? `[[${target.trim()}]]` : (shown ?? target).trim()));
  return { title: title.replace(/[*`#]/g, "").slice(0, 100), body: body.slice(0, 6000) };
}
