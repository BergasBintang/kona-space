// A first note for a skill, drafted from the skill's own description (decision 63): the first sentence, at most 200 letters. No model is asked; the owner edits it.
export const draftNote = (description: string): string => {
  const flat = description.replace(/\s+/g, " ").trim();
  const first = flat.split(/(?<=[.!?])\s/)[0] ?? flat;
  return first.length > 200 ? first.slice(0, 197).trimEnd() + "..." : first;
};
