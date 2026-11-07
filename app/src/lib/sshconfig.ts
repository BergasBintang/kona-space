// The text the Connections screen hands out to paste. Kona never writes `~/.ssh/config`; it only builds text, and these are the pure functions that build it
// (no window, so they can be tested). The key path is written the way a hand-written file would have it: forward slashes, and `~/.ssh/` for a key in the
// user's own `.ssh` folder.
import type { Server } from "./api.ts";

type Entry = Pick<Server, "host" | "real_host" | "user" | "port" | "key_path" | "repo">;

/** A key path as it reads in an ssh config: forward slashes, `~/.ssh/name` for `X:\Users\<name>\.ssh\name`, quoted when it holds a space. */
export function sshPath(path: string): string {
  const p = path.trim().replace(/\\/g, "/").replace(/^[A-Za-z]:\/Users\/[^/]+\/\.ssh\//i, "~/.ssh/");
  return /\s/.test(p) ? `"${p}"` : p;
}

const keyLines = (path: string) => (path.trim() ? `\n  IdentityFile ${sshPath(path)}\n  IdentitiesOnly yes` : "");

/** An entry for `~/.ssh/config` on this PC: the key is named, and only that key is tried. */
export const configEntry = (s: Entry) => `Host ${s.host}\n${s.real_host ? `  HostName ${s.real_host}\n` : ""}  User ${s.user}\n  Port ${s.port || 22}${keyLines(s.key_path)}`;

/** The same entry for the server that pulls a repo: the read-only key is at `keyPath` ON that server. */
export const serverEntry = (s: Entry, keyPath: string) => `Host ${s.host}\n  HostName ${s.real_host || s.host}\n  User ${s.user}\n  Port ${s.port || 22}${keyLines(keyPath)}`;

/** What goes after `git clone` or into `git remote`: the nickname stands where github.com would. */
export const gitAddress = (s: Entry) => `git@${s.host}:${s.repo}.git`;

/** A port typed into a box: digits only, never above 65535; 0 means "not set" (a repo then uses 22). */
export const cleanPort = (typed: string) => Math.min(65535, Number(typed.replace(/\D/g, "")) || 0);
