// The memory of a conversation: everything Claude reads again with every step (the whole chat so far, kept in a cache that the plan counts). It grows with the chat, so a long
// chat costs more per message. It is shown from 100,000 tokens up, in words, with a button to make it smaller (the /compact command of Claude Code, which keeps what matters).
// The cache is kept for one hour after its last use; after a longer rest, the next message has to write the whole memory again, at a higher price.

export const MEMORY_SHOWN = 100_000;
export const MEMORY_LONG = 250_000;
export const REST_MS = 60 * 60 * 1000;

export type Memory = { state: "waiting" | "left"; word: string };

/** How the memory reads now, or null while it is small enough to say nothing. */
export function memoryOf(tokens: number | undefined): Memory | null {
  if (!tokens || tokens < MEMORY_SHOWN) return null;
  return tokens >= MEMORY_LONG ? { state: "left", word: "long" } : { state: "waiting", word: "getting long" };
}

/** True when the cache has gone cold: the last step of the conversation was an hour ago or more. `lastAt` is 0 when nothing has been seen yet. */
export const isRested = (lastAt: number | undefined, now: number): boolean => !!lastAt && now - lastAt >= REST_MS;

export const kilo = (tokens: number): string => (tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens));
