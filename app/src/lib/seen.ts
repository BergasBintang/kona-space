// Which version of each file the owner last opened in the Files place, so a file an agent changed since then can say so.
// One small map (path to the file's change time in seconds) kept on this PC; the oldest paths are forgotten past `CAP`.
export type Seen = Record<string, number>;

const KEY = "kona.seen";
export const CAP = 400;

export function readSeen(): Seen {
  try { const s = localStorage.getItem(KEY); const v = s ? JSON.parse(s) : {}; return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

/** The map with this file stamped as seen at `modified`. The file moves to the newest place, and the oldest ones go when there are more than `cap`. */
export function stamp(seen: Seen, path: string, modified: number, cap = CAP): Seen {
  const next: Seen = {};
  for (const [p, m] of Object.entries(seen)) if (p !== path) next[p] = m;
  next[path] = modified;
  const keys = Object.keys(next);
  for (const p of keys.slice(0, Math.max(0, keys.length - cap))) delete next[p];
  return next;
}

export function writeSeen(seen: Seen): void {
  try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* the marks last until the window closes */ }
}

/** True when the file was opened before and has been changed since. A file never opened is not "changed": it is new to the owner. */
export const changedSince = (seen: Seen, path: string, modified: number | null): boolean => modified !== null && seen[path] !== undefined && modified > seen[path];
