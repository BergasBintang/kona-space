// Kona's logo (version 2, chosen 2026-10-28 from the options in CHANGELOG 0.19.4): a black cat with soft pointed ears, two tilted white oval
// eyes and a sunflower between the ears, on an ice-blue rounded square. The cat is the name's owner; the sunflower is for the owner's girlfriend.
// Plain SVG, no FigCraft needed. Run:  node docs/design/build/build-logo.mjs
// Writes: docs/design/logo/kona-icon.svg (the app icon), docs/design/logo/kona-mark.svg (the flat gold mark),
//         app/public/favicon.svg (the icon again) and app/src/components/KonaMark.tsx (the mark as a component; generated, do not edit by hand).
// The app's icon files (app/src-tauri/icons) are made from kona-icon.svg: see docs/design/logo/README.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.resolve(HERE, '../logo');
const APP = path.resolve(HERE, '../../../app');
const CX = 100;
const mx = ([x, y]) => [2 * CX - x, y];
const f = (n) => Number(n.toFixed(2));
const P = ([x, y]) => `${f(x)} ${f(y)}`;

// the head is drawn as its right half and mirrored, so it is exactly symmetric
function mirrored(start, segs) {
  const pts = [start, ...segs.map((s) => (s.L ? s.L[0] : s.C[2]))];
  let d = `M${P(start)}`;
  for (const s of segs) d += s.L ? ` L${P(s.L[0])}` : ` C${P(s.C[0])} ${P(s.C[1])} ${P(s.C[2])}`;
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i], prev = pts[i];
    d += s.L ? ` L${P(mx(prev))}` : ` C${P(mx(s.C[1]))} ${P(mx(s.C[0]))} ${P(mx(prev))}`;
  }
  return d + ' Z';
}
const HEAD = mirrored([100, 83], [
  { C: [[110, 80], [118, 82], [124, 88]] },
  { L: [[148, 60]] },
  { C: [[156, 70], [159, 90], [159, 110]] },
  { C: [[159, 141], [136, 157], [100, 157]] },
]);
const SQUARE = 'M60 8 H140 C176 8 192 24 192 60 V140 C192 176 176 192 140 192 H60 C24 192 8 176 8 140 V60 C8 24 24 8 60 8 Z';
const EYES = [[80, 115, 7], [120, 115, -7]]; // x, y, tilt in degrees
const EYE_RX = 9.5, EYE_RY = 13.5;
const FLOWER = { cx: 100, cy: 70, r: 13, petals: 9 };

const petalEllipses = (fill) => {
  const { cx, cy, r, petals } = FLOWER;
  let s = '';
  for (let i = 0; i < petals; i++) s += `<ellipse cx="${cx}" cy="${f(cy - r * 0.95)}" rx="${f(r * 0.36)}" ry="${f(r * 0.62)}" transform="rotate(${(360 / petals) * i} ${cx} ${cy})" fill="${fill}"/>`;
  return s;
};

// ---- the app icon: ice-blue square, black cat, white eyes, gold flower
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs>
  <linearGradient id="k-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6ecff"/><stop offset="1" stop-color="#6fa8e6"/></linearGradient>
  <linearGradient id="k-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="k-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>
  <linearGradient id="k-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34293f"/><stop offset="0.55" stop-color="#17101f"/><stop offset="1" stop-color="#09060d"/></linearGradient>
  <linearGradient id="k-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="k-petal" cx="0.5" cy="0.3" r="0.9"><stop offset="0" stop-color="#ffd884"/><stop offset="1" stop-color="#e0952a"/></radialGradient>
  <filter id="k-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
  <clipPath id="k-head"><path d="${HEAD}"/></clipPath>
</defs>
<path d="${SQUARE}" fill="url(#k-bg)"/><path d="${SQUARE}" fill="url(#k-gloss)" opacity="0.5"/><path d="${SQUARE}" fill="none" stroke="url(#k-rim)" stroke-width="1.6"/>
<ellipse cx="100" cy="164" rx="46" ry="7" fill="#000" opacity="0.35" filter="url(#k-soft)"/>
<path d="${HEAD}" fill="url(#k-dark)" stroke="url(#k-dark)" stroke-width="8" stroke-linejoin="round"/>
<g clip-path="url(#k-head)"><rect x="40" y="54" width="120" height="62" fill="url(#k-sheen)"/></g>
${EYES.map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="${EYE_RX}" ry="${EYE_RY}" fill="#fff" transform="rotate(${a} ${x} ${y})"/>`).join('')}
<circle cx="84" cy="108" r="2.6" fill="#fff" opacity="0.9"/><circle cx="124" cy="108" r="2.6" fill="#fff" opacity="0.9"/>
${petalEllipses('url(#k-petal)')}<circle cx="${FLOWER.cx}" cy="${FLOWER.cy}" r="${f(FLOWER.r * 0.5)}" fill="#5a3410"/><circle cx="${f(FLOWER.cx - FLOWER.r * 0.13)}" cy="${f(FLOWER.cy - FLOWER.r * 0.15)}" r="${f(FLOWER.r * 0.15)}" fill="#fff" opacity="0.35"/>
</svg>
`;

// ---- the flat mark: one colour (gold by default), the eyes and a ring around the flower cut out of the head
const HALO = f(FLOWER.r * 1.7);
const markBody = (id, color) => `<defs>
  <mask id="${id}-head" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#fff"/>
    ${EYES.map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="${EYE_RX}" ry="${EYE_RY}" fill="#000" transform="rotate(${a} ${x} ${y})"/>`).join('')}
    <circle cx="${FLOWER.cx}" cy="${FLOWER.cy}" r="${HALO}" fill="#000"/></mask>
  <mask id="${id}-flower" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#fff"/>
    <circle cx="${FLOWER.cx}" cy="${FLOWER.cy}" r="${f(FLOWER.r * 0.5)}" fill="#000"/></mask>
</defs>
<g mask="url(#${id}-head)"><path d="${HEAD}" fill="${color}" stroke="${color}" stroke-width="8" stroke-linejoin="round"/></g>
<g mask="url(#${id}-flower)">${petalEllipses(color)}<circle cx="${FLOWER.cx}" cy="${FLOWER.cy}" r="${f(FLOWER.r * 0.5)}" fill="${color}"/></g>`;
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n${markBody('m', '#e8b25a')}\n</svg>\n`;

const tsx = `// The Kona mark: a cat head with a sunflower between its ears. GENERATED by docs/design/build/build-logo.mjs; change the script, not this file.
import { useId } from "react";

export function KonaMark({ size = 24, color = "var(--color-brand)", title }: { size?: number; color?: string; title?: string }) {
  const id = "kona-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} className="shrink-0">
      ${markBody('${id}', '${color}').replace(/\n/g, '\n      ').replace(/stroke-width/g, 'strokeWidth').replace(/stroke-linejoin/g, 'strokeLinejoin').replace(/maskUnits/g, 'maskUnits').replace(/mask="url\(#\$\{id\}-(head|flower)\)"/g, 'mask={`url(#${id}-$1)`}').replace(/<mask id="\$\{id\}-(head|flower)"/g, '<mask id={`${id}-$1`}').replace(/fill="\$\{color\}"/g, 'fill={color}').replace(/stroke="\$\{color\}"/g, 'stroke={color}')}
    </svg>
  );
}
`;

fs.writeFileSync(path.join(LOGO, 'kona-icon.svg'), icon);
fs.writeFileSync(path.join(LOGO, 'kona-mark.svg'), markSvg);
fs.writeFileSync(path.join(APP, 'public', 'favicon.svg'), icon);
fs.writeFileSync(path.join(APP, 'src', 'components', 'KonaMark.tsx'), tsx);
console.log('written: kona-icon.svg, kona-mark.svg, favicon.svg, KonaMark.tsx');
