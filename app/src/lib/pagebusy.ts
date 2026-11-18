// What a page would lose if it were closed (decision 95): a page tells here, by the key of its page, why closing it is not free ("a mockup's program is running; closing the page stops it").
// The sheet asks before it is closed and offers to minimize it instead. Typed text that was not sent is another reason, found by the sheet itself (lib/unsaved.ts).
import { useEffect } from "react";

const reasons = new Map<string, string>();

export const busyOf = (key: string): string | null => reasons.get(key) ?? null;

export function useBusy(key: string, reason: string | null): void {
  useEffect(() => {
    if (reason) reasons.set(key, reason); else reasons.delete(key);
    return () => { reasons.delete(key); };
  }, [key, reason]);
}
