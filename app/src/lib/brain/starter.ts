// The starter brain: notes about how to work with Claude Code agents and how to use Kona, shipped inside the app. They never touch the
// disk, they cannot be edited (a project note of the same name wins), and they link to each other and to the owner's notes with [[names]].
import type { RawNote } from "./parse.ts";

const files = import.meta.glob("../../brain/starter/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const STARTER_VERSION = "2026-10-28";

export const starterNotes: RawNote[] = Object.entries(files)
  .map(([path, text]) => ({ id: path.split("/").pop()!.replace(/\.md$/, ""), layer: "starter" as const, text, readonly: true }))
  .sort((a, b) => a.id.localeCompare(b.id));
