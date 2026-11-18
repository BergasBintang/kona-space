// The places of Kona. Each one is a piece of the office that opens a screen (or a person's sheet, for the pages of a person); the top bar lists them too, as a way to jump. One page is shown at a time, in a sheet; the owner may minimize it, which keeps it alive behind a tray of the pages that are alive (decision 95), or close it.
export type Place = "office" | "mockups" | "files" | "costs" | "board" | "workflows" | "worktrees" | "leftovers" | "brain" | "servers" | "settings";

export const PLACES: { id: Place; label: string }[] = [
  { id: "office", label: "Office" },
  { id: "board", label: "Board" },
  { id: "workflows", label: "Meeting" },
  { id: "worktrees", label: "Worktrees" },
  { id: "brain", label: "Brain" },
  { id: "files", label: "Files" },
  { id: "mockups", label: "Mockups" },
  { id: "leftovers", label: "Leftovers" },
  { id: "servers", label: "Connections" }, // holds both kinds of entry: a server and a GitHub repo (decision 83)
  { id: "costs", label: "Costs" },
  { id: "settings", label: "Settings" },
];
