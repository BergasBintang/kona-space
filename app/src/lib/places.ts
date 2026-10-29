// The places of Kona. Each one is a room in the office (components/Office.tsx); the top bar lists them too, as a way to jump.
export type Place = "office" | "sessions" | "files" | "roles" | "accounts" | "costs" | "voice" | "board" | "worktrees" | "leftovers" | "brain" | "servers" | "settings";

export const PLACES: { id: Place; label: string; room: string }[] = [
  { id: "office", label: "Office", room: "The whole building" },
  { id: "sessions", label: "Sessions", room: "Front desk" },
  { id: "board", label: "Board", room: "Notice wall" },
  { id: "worktrees", label: "Worktrees", room: "Git room" },
  { id: "brain", label: "Brain", room: "Library" },
  { id: "files", label: "Files", room: "Archive" },
  { id: "leftovers", label: "Leftovers", room: "Storage closet" },
  { id: "servers", label: "Servers", room: "Server room" },
  { id: "costs", label: "Costs", room: "Accounting" },
  { id: "roles", label: "Roles", room: "Staff board" },
  { id: "voice", label: "Voice", room: "Back office" },
  { id: "accounts", label: "Accounts", room: "Entrance" },
  { id: "settings", label: "Settings", room: "Back office" },
];
