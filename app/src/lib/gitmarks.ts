// The little letters beside files in the Files tree, like the ones an editor shows: U (new, not in Git yet), A (added), M (changed), D (deleted), C (a clash to fix).
// The list comes from Git (`git_marks`); this turns it into answers for one row: the letter of a file, or the strongest state inside a folder.
import type { GitMark } from "./api";

export type GitCode = "U" | "A" | "M" | "D" | "C";

/** What each letter means, in words (for the hover text and for a screen reader). */
export const GIT_WORD: Record<GitCode, string> = {
  U: "New, not in Git yet",
  A: "Added to Git",
  M: "Changed",
  D: "Deleted",
  C: "A clash to fix",
};

// when a folder holds several states, the strongest one speaks for it
const RANK: GitCode[] = ["C", "D", "M", "A", "U"];

const key = (p: string) => p.toLowerCase().replace(/\//g, "\\").replace(/\\+$/, "");

export type GitView = {
  /** The state of a file, or of a folder (its own, or the strongest one of what is inside it). undefined when nothing changed. */
  of: (path: string, isDir: boolean) => GitCode | undefined;
  count: number;
};

export function gitView(marks: GitMark[]): GitView {
  const exact = new Map<string, GitCode>();
  const below = new Map<string, GitCode>(); // folder -> the strongest state of anything inside it
  const untrackedDirs: string[] = []; // a folder Git lists as one line: everything in it is new
  for (const m of marks) {
    const code = m.code as GitCode;
    if (!RANK.includes(code)) continue;
    const k = key(m.path);
    exact.set(k, code);
    if (m.dir) untrackedDirs.push(k);
    for (let up = k.lastIndexOf("\\"); up > 0; ) {
      const folder = k.slice(0, up);
      const cur = below.get(folder);
      if (!cur || RANK.indexOf(code) < RANK.indexOf(cur)) below.set(folder, code);
      up = folder.lastIndexOf("\\");
    }
  }
  return {
    count: marks.length,
    of(path, isDir) {
      const k = key(path);
      const own = exact.get(k);
      if (own) return own;
      if (untrackedDirs.some((d) => k.startsWith(d + "\\"))) return "U";
      return isDir ? below.get(k) : undefined;
    },
  };
}
