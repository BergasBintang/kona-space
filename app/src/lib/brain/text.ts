// Small text helpers for the brain: turning words into comparable terms, and hiding what looks like a secret.
// Both are plain functions with no model and no network, so the same text always gives the same answer.

const STOP = new Set(`a an and are as at be been but by can could do does for from had has have how i if in into is it its me my no not of on or our
so than that the their them then there these they this to us was we were what when where which who why will with would you your should
about after again all any each more most other some such only own same too very also may just over out per one`.split(/\s+/));

/** Lower case, no accents. */
export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** A light stem so "servers" and "server", "costs" and "cost" meet. It does not need to be right, only the same on both sides. */
export function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 6 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 5 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** The meaningful terms of a text: folded, split at anything that is not a letter or digit, without filler words. */
export function terms(text: string): string[] {
  return fold(text).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

export const words = (text: string) => (text.match(/\S+/g) ?? []).length;

// What looks like a secret. Only the shapes of well-known keys and obvious "name = value" lines, so it errs towards not hiding ordinary prose.
const SECRET_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g },
  { kind: "Anthropic key", re: /\bsk-ant-[A-Za-z0-9_-]{10,}/g },
  { kind: "API key", re: /\bsk-[A-Za-z0-9]{20,}/g },
  { kind: "GitHub token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { kind: "AWS key", re: /\bAKIA[0-9A-Z]{12,}\b/g },
  { kind: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: "bearer token", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g },
  { kind: "password or secret", re: /\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"']{8,}/gi },
  { kind: "IP address", re: /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b(?<!\b127\.0\.0\.1)(?<!\b0\.0\.0\.0)/g },
];

/** The text with every secret-looking piece replaced by `[hidden: kind]`, and the kinds that were found. */
export function redact(text: string): { text: string; found: string[] } {
  let out = text;
  const found: string[] = [];
  for (const { kind, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(out)) {
      found.push(kind);
      re.lastIndex = 0;
      out = out.replace(re, `[hidden: ${kind}]`);
    }
  }
  return { text: out, found };
}

/** Today as YYYY-MM-DD on this PC's clock (not UTC, which can be the day before in the morning). */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
