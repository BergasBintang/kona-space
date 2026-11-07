// The welcome page files projects under groups. The groups run A to Z; projects that have none come last under "No group";
// inside a group the projects run A to Z too. A name is compared without regard to case or accents, and numbers by value ("App 2" before "App 10").
import type { Project } from "./api";

export const NO_GROUP = "No group";

export type Group = { name: string; projects: Project[]; none: boolean };

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
const word = (g: string | null | undefined) => (g ?? "").trim().replace(/\s+/g, " ");

export function groupProjects(projects: Project[]): Group[] {
  const by = new Map<string, Group>();
  for (const p of projects) {
    const g = word(p.group);
    // "Work" and "work" are one group; the first spelling met is the one shown
    const key = g.toLowerCase();
    const hit = by.get(key) ?? { name: g || NO_GROUP, projects: [], none: g === "" };
    hit.projects.push(p);
    by.set(key, hit);
  }
  const groups = [...by.values()];
  for (const g of groups) g.projects.sort((a, b) => collator.compare(a.name, b.name));
  return groups.sort((a, b) => (a.none === b.none ? collator.compare(a.name, b.name) : a.none ? 1 : -1));
}

/** The names of the groups that exist, A to Z (for choosing one again). */
export const groupNames = (projects: Project[]): string[] => groupProjects(projects).filter((g) => !g.none).map((g) => g.name);
