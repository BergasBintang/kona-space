// What a click on a room opens (components/Office.tsx, components/TeamRoom.tsx, App.tsx). A room with cats at desks opens a list of them; every other room opens its page
// in the sheet that slides up from below. A room with two pages opens the first one and shows the second as a tab.
import type { Place } from "./places";

/** who sits in which room */
export const DESKS: Record<string, string[]> = {
  plan: ["product", "design"], build: ["frontend", "backend", "qa", "security"], marketing: ["marketing"], content: ["content"], support: ["support"], git: ["devops"], secretary: ["secretary"],
};
/** the pages of a room without cats; a room with more than one gets tabs */
export const PAGES: Record<string, Place[]> = {
  board: ["board", "workflows"], library: ["brain"], archive: ["files"], servers: ["servers"], costs: ["costs"], backoffice: ["voice", "settings"], closet: ["leftovers"], entrance: ["accounts"],
};
/** what else a room with cats leads to */
export const MORE: Record<string, { label: string; place: Place }[]> = {
  git: [{ label: "Open Worktrees", place: "worktrees" }],
  secretary: [{ label: "See all sessions", place: "sessions" }],
  plan: [{ label: "See the roles", place: "roles" }], build: [{ label: "See the roles", place: "roles" }], marketing: [{ label: "See the roles", place: "roles" }],
  content: [{ label: "See the roles", place: "roles" }], support: [{ label: "See the roles", place: "roles" }],
};
/** the tabs of the sheet that shows this page: the pages of its room, or none when the room has only one */
export const tabsFor = (p: Place): Place[] => Object.values(PAGES).find((g) => g.length > 1 && g.includes(p)) ?? [];
