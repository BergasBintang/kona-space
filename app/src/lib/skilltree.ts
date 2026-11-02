// The tree a person chooses a skill by (decision 63): the job, a branch for each kind of work, the skills under each branch, and the files of each skill.
// These are the small changes the Skills tab makes to a person's branches; the rules that matter (a skill under one branch, a name once) are checked again by Kona's core when it is kept.
export type Branch = { name: string; when: string; skills: string[] };

/** the branches with only the skills the person has, and the skills that hang under no branch (still in the order of the person's list) */
export function treeOf(skills: string[], branches: Branch[]): { branches: Branch[]; loose: string[] } {
  const seen = new Set<string>();
  const out = branches.map((b) => ({ ...b, skills: b.skills.filter((s) => skills.includes(s) && !seen.has(s) && !!seen.add(s)) }));
  return { branches: out, loose: skills.filter((s) => !seen.has(s)) };
}

/** put a skill under a branch (by its place in the list), or under none with null; it leaves any branch it was in */
export function moveSkill(branches: Branch[], skill: string, to: number | null): Branch[] {
  return branches.map((b, i) => {
    const rest = b.skills.filter((s) => s !== skill);
    return i === to ? { ...b, skills: [...rest, skill] } : { ...b, skills: rest };
  });
}

/** a new, empty branch with a name no other branch has */
export function addBranch(branches: Branch[]): Branch[] {
  const taken = new Set(branches.map((b) => b.name.toLowerCase()));
  let n = 1; while (taken.has((n === 1 ? "New branch" : `New branch ${n}`).toLowerCase())) n++;
  return [...branches, { name: n === 1 ? "New branch" : `New branch ${n}`, when: "", skills: [] }];
}

export const changeBranch = (branches: Branch[], at: number, patch: Partial<Pick<Branch, "name" | "when">>): Branch[] => branches.map((b, i) => (i === at ? { ...b, ...patch } : b));

/** take a branch away; its skills stay with the person and hang under no branch */
export const removeBranch = (branches: Branch[], at: number): Branch[] => branches.filter((_, i) => i !== at);

/** which branch a skill is under, by its place, or null */
export const branchOf = (branches: Branch[], skill: string): number | null => { const i = branches.findIndex((b) => b.skills.includes(skill)); return i < 0 ? null : i; };

/** the problem with a branch name, in words, or null when it is fine: it must say something and be its own */
export function nameProblem(branches: Branch[], at: number): string | null {
  const name = branches[at].name.trim();
  if (!name) return "Give the branch a name.";
  if (name.length > 40) return "The name is longer than 40 letters.";
  if (branches.some((b, i) => i !== at && b.name.trim().toLowerCase() === name.toLowerCase())) return "Two branches have this name.";
  return null;
}
