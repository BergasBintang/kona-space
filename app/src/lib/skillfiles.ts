// A skill is a folder: SKILL.md and whatever comes with it (docs/SKILLS.md). These are the small rules the skill editor works by; Kona's core checks the paths and sizes again when it saves.
export type FileKind = "templates" | "references" | "examples" | "scripts";

export const KINDS: { id: FileKind; label: string; hint: string; first: string; start: string; pointer: (p: string) => string }[] = [
  { id: "templates", label: "Template", hint: "A form to fill in, so the result always has the same shape", first: "template.md", start: "# [Title]\n\n**[Heading]:** ...\n", pointer: (p) => `Fill in \`${p}\`.` },
  { id: "references", label: "Reference", hint: "A long checklist or background, opened only when needed", first: "checklist.md", start: "# [What this is]\n\n- ...\n", pointer: (p) => `Read \`${p}\` when you need it.` },
  { id: "examples", label: "Example", hint: "A good result to copy the style of", first: "example.md", start: "# A good example\n\n", pointer: (p) => `See \`${p}\` for a good example.` },
  { id: "scripts", label: "Script", hint: "A small program Claude runs instead of reading; it needs what it runs on to be installed", first: "script.js", start: "// What this does, in one line\n", pointer: (p) => `Run \`${p}\`, and say what it does first.` },
];

/** a path for a new file of this kind that no other file has: templates/template.md, templates/template-2.md ... */
export function newPath(kind: FileKind, taken: string[]): string {
  const k = KINDS.find((x) => x.id === kind)!;
  const dot = k.first.lastIndexOf(".");
  const [stem, ext] = [k.first.slice(0, dot), k.first.slice(dot)];
  const used = new Set(taken.map((t) => t.toLowerCase()));
  let n = 1;
  const at = () => `${kind}/${stem}${n === 1 ? "" : `-${n}`}${ext}`;
  while (used.has(at().toLowerCase())) n++;
  return at();
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;

/** what is wrong with a file's path inside its skill, in words, or null. The same rule as the core: a plain relative path, never out of the folder. */
export function pathProblem(path: string, others: string[]): string | null {
  const parts = path.split("/");
  if (!path.trim()) return "Give the file a name.";
  if (parts.length > 4) return "Too many folders in that path.";
  if (parts.some((p) => !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(p) || p.endsWith(".") || RESERVED.test(p) || p.length > 80)) return "Use letters, digits, dashes and dots, with / between a folder and a file.";
  if (path.toLowerCase() === "skill.md") return "SKILL.md is the main file of the skill.";
  if (others.some((o) => o.toLowerCase() === path.toLowerCase())) return "Another file has this name.";
  return null;
}

/** the files the main text never mentions: nothing would tell Claude to open them */
export const unmentioned = (main: string, paths: string[]): string[] => paths.filter((p) => !main.includes(p));

/** add a line to the end of the main text */
export const addLine = (main: string, line: string): string => `${main.trimEnd()}\n\n${line}\n`;

/** a file was renamed: the main text follows */
export const renameIn = (main: string, from: string, to: string): string => (from === to ? main : main.split(from).join(to));

/** the description line of a new skill; quoted when it holds what would break the top of the file (a colon, for example) */
export function descriptionLine(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return /[:#"'[\]{}<>&*!|%@`]/.test(flat) ? `"${flat.replace(/\\/g, "").replace(/"/g, "'")}"` : flat;
}

/** the whole SKILL.md of a new skill */
export const composeSkill = (name: string, description: string, body: string): string => `---\nname: ${name}\ndescription: ${descriptionLine(description)}\n---\n\n${body.trim()}\n`;
