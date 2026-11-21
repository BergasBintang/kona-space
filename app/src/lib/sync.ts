// A second Kona window changed one of the shared lists (projects, roles, accounts, settings, servers, the voice): the core read it again and said so with the event `kona-sync` (see
// `sync.rs`). A screen that shows such a list reads it again when this number changes. It starts at 0 and counts the changes made by the OTHER window, never this one's own saves.
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

export type SyncList = "projects" | "roles" | "accounts" | "voice" | "servers" | "settings";

export function useSyncTick(what: SyncList): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    let un: (() => void) | undefined;
    listen<string>("kona-sync", (e) => { if (e.payload === what) setN((x) => x + 1); }).then((f) => { if (live) un = f; else f(); }).catch(() => {});
    return () => { live = false; un?.(); };
  }, [what]);
  return n;
}
