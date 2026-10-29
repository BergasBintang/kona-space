// Checks that the colours in src/index.css keep Kona's contrast rules: text 4.5 to 1, control borders and the focus ring 3 to 1 (WCAG 2).
// Run: npm run contrast. It reads the tokens from the @theme block, so a changed colour is checked at once. Exits with 1 if a pair fails.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const theme = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));
const T = Object.fromEntries([...theme.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const TEXT = 4.5, NONTEXT = 3;
const pairs = [];
for (const bg of ["ground", "surface-1", "surface-2", "surface-3", "inset"]) {
  pairs.push([`text on ${bg}`, "text", bg, TEXT], [`secondary on ${bg}`, "text-secondary", bg, TEXT], [`tertiary on ${bg}`, "text-tertiary", bg, TEXT]);
}
for (const bg of ["ground", "surface-2", "surface-3"]) {
  for (const s of ["live", "waiting", "idle", "done", "stopped", "left"]) pairs.push([`${s} on ${bg}`, `state-${s}`, bg, TEXT]);
  pairs.push([`accent text on ${bg}`, "accent", bg, TEXT]);
}
for (const a of ["accent", "accent-hover", "accent-pressed"]) pairs.push([`on-accent on ${a}`, "on-accent", a, TEXT]);
pairs.push(["on-danger on danger", "on-danger", "state-left", TEXT]);
for (const bg of ["ground", "surface-2", "inset"]) pairs.push([`strong border on ${bg}`, "line-strong", bg, NONTEXT]);
pairs.push(["focus ring on ground", "accent", "ground", NONTEXT], ["brand gold on ground (decoration)", "brand", "ground", NONTEXT]);

let bad = 0;
for (const [name, fg, bg, min] of pairs) {
  if (!T[fg] || !T[bg]) { console.log("missing token for", name); bad++; continue; }
  const r = ratio(T[fg], T[bg]);
  const ok = r >= min;
  if (!ok) bad++;
  console.log(r.toFixed(1).padStart(5), ok ? "ok  " : "FAIL", name, `(needs ${min})`);
}
console.log(bad ? `${bad} pair(s) fail` : "every pair passes");
process.exit(bad ? 1 : 0);
