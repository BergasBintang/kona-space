// Kona's logo: a cat head (pointed ears) with a sunflower in its face, and two gold eyes in the middle of the flower. The cat is the
// name's owner; the sunflower is for the owner's girlfriend. Chosen from the options on 2026-10-28 (see CHANGELOG).
// Drawn headless (no FigCraft window). Run:  node docs/design/build/build-logo.mjs
// Writes: docs/design/kona-logo.figcraft and previews/logo.png (the board), docs/design/logo/kona-mark.svg and kona-icon.svg,
//         app/public/favicon.svg and app/src/components/KonaMark.tsx (generated: do not edit by hand; change this script).
// The app's icon files (app/src-tauri/icons) are made from kona-icon.svg: see docs/design/logo/README.md
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, M, L, Q, Z, polar, petal, disc, oval, place, arcCmds, makeSteps } from './logo-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, '..');
const APP = path.resolve(HERE, '../../../app');
const CLI = process.env.FIGCRAFT_CLI ?? 'C:/Program Files/FigCraft/figcraft-cli.exe';

/** one cat head in one piece: a round head, two pointed ears with softened tips, a gentle dip between them. (cx, cy) is the head's centre, `u` scales it. */
function head(name, fill, cx = 100, cy = 118, u = 1, soft = 5) {
  const R = 66 * u, tipY = cy - 92 * u, tipDx = 38 * u;
  const pA = polar(cx, cy, R, -80), pB = polar(cx, cy, R, -9), pA2 = polar(cx, cy, R, 80), pB2 = polar(cx, cy, R, 9);
  const tipL = [cx - tipDx, tipY], tipR = [cx + tipDx, tipY];
  const along = (from, to, d) => { const dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy); return [from[0] + (dx / len) * d, from[1] + (dy / len) * d]; };
  const d = soft * u;
  const tipCmds = (tip, a, b) => { const p1 = along(tip, a, d), p2 = along(tip, b, d); return [L(...p1), Q(tip[0], tip[1], ...p2)]; };
  return { name, fill, cmds: [M(...pA), ...tipCmds(tipL, pA, pB), L(...pB), Q(cx, cy - 58 * u, ...pB2), ...tipCmds(tipR, pB2, pA2), L(...pA2), ...arcCmds(cx, cy, R, 80, 280), Z] };
}
const rrect = (name, x, y, w, h, r, fill) => {
  const k = 0.5523 * r;
  return { name, fill, cmds: [M(x + r, y), L(x + w - r, y), { k: 'C', p: [[x + w - r + k, y], [x + w, y + r - k], [x + w, y + r]] }, L(x + w, y + h - r), { k: 'C', p: [[x + w, y + h - r + k], [x + w - r + k, y + h], [x + w - r, y + h]] }, L(x + r, y + h), { k: 'C', p: [[x + r - k, y + h], [x, y + h - r + k], [x, y + h - r]] }, L(x, y + r), { k: 'C', p: [[x, y + r - k], [x + r - k, y], [x + r, y]] }, Z] };
};

const BG = C.surface1;
const GOLD = C.gold;

/** the mark on a tile: gold head, the petals and the middle cut out, two gold eyes in the middle (`cut` shapes are the cut-outs) */
function mark() {
  const s = [head('cat', GOLD)];
  for (let i = 0; i < 12; i++) s.push({ ...petal('petal ' + i, 100, 118, i * 30, 25, 51, 5.4, BG), cut: true });
  s.push({ ...disc('centre', 100, 118, 20, BG), cut: true });
  s.push(oval('eye left', 92, 117, 3.6, 5, GOLD), oval('eye right', 108, 117, 3.6, 5, GOLD));
  return s;
}
/** the app icon: a gold rounded square, the cat in the dark, the flower and eyes in gold and dark */
function icon() {
  const cx = 100, cy = 120, u = 0.8;
  const s = [rrect('icon', 0, 0, 200, 200, 46, GOLD), head('cat', C.ground, cx, cy, u, 5)];
  for (let i = 0; i < 12; i++) s.push(petal('petal ' + i, cx, cy, i * 30, 25 * u, 51 * u, 5.4 * u, GOLD));
  s.push(disc('centre', cx, cy, 20 * u, GOLD));
  s.push(oval('eye left', cx - 8 * u, cy - 1 * u, 3.6 * u, 5 * u, C.ground), oval('eye right', cx + 8 * u, cy - 1 * u, 3.6 * u, 5 * u, C.ground));
  return s;
}

// ---- the board in FigCraft
const { steps, rect, text, drawing } = makeSteps();
const W = 1200, H = 760;
rect('canvas', 0, 0, W, H, C.canvas);
text('title', 'Kona: the logo', 80, 56, 30, C.text, 'Bold');
text('subtitle', 'A cat with pointed ears, a sunflower in its face, and two eyes in the flower.', 80, 100, 15, C.text2);
rect('tile', 80, 160, 420, 420, BG, 24);
drawing('big', place(mark(), 80 + 50, 160 + 50, 1.6));
rect('icon tile', 540, 160, 420, 420, C.ground, 24);
drawing('icon', place(icon(), 540 + 80, 160 + 80, 1.3));
text('mark label', 'The mark', 80, 604, 20, C.text, 'Bold');
text('mark note', 'Gold on Kona\'s dark surface. Used beside the name and in the sidebar.', 80, 638, 14, C.text2, 'Regular', 420);
text('icon label', 'The app icon', 540, 604, 20, C.text, 'Bold');
text('icon note', 'Window, taskbar and installer. Same drawing, dark on a gold square.', 540, 638, 14, C.text2, 'Regular', 420);
rect('small tile', 1000, 160, 120, 420, C.ground, 16);
[[64, 0.32, 200], [32, 0.16, 290], [24, 0.12, 345], [16, 0.08, 395]].forEach(([px, sc, y]) => drawing(`${px}`, place(mark(), 1034, 160 + y - 120 + 40, sc)));

const script = path.join(HERE, '.logo-steps.json');
fs.writeFileSync(script, JSON.stringify(steps));
const file = path.join(DOCS, 'kona-logo.figcraft');
const out = execFileSync(CLI, ['run', script, '--out', file], { encoding: 'utf8', maxBuffer: 1 << 26 });
fs.rmSync(script);
const bad = out.split('\n').filter((l) => /"error"|"ok":false/.test(l));
if (bad.length) console.log(bad.slice(0, 5).join('\n'));
fs.mkdirSync(path.join(DOCS, 'previews'), { recursive: true });
execFileSync(CLI, ['render', file, '-o', path.join(DOCS, 'previews', 'logo.png')]);
console.log('wrote', file, fs.statSync(file).size, 'bytes');

// ---- plain files
const ds = (shapes) => place(shapes, 0, 0, 1);
const head0 = ds(mark());
const cuts = head0.filter((s) => s.cut), solid = head0.filter((s) => !s.cut);
const maskedSvg = (id, colour) => `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><path d="${solid[0].d}" fill="#fff"/>${cuts.map((c) => `<path d="${c.d}" fill="#000"/>`).join('')}</mask></defs>
<path d="${solid[0].d}" fill="${colour}" mask="url(#${id})"/>${solid.slice(1).map((e) => `<path d="${e.d}" fill="${colour}"/>`).join('')}`;
fs.mkdirSync(path.join(DOCS, 'logo'), { recursive: true });
fs.writeFileSync(path.join(DOCS, 'logo', 'kona-mark.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">\n<title>Kona</title>\n${maskedSvg('cut', GOLD)}\n</svg>\n`);
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">\n<title>Kona</title>\n${ds(icon()).map((sh) => `<path d="${sh.d}" fill="${sh.fill}"/>`).join('\n')}\n</svg>\n`;
fs.writeFileSync(path.join(DOCS, 'logo', 'kona-icon.svg'), iconSvg);
fs.writeFileSync(path.join(APP, 'public', 'favicon.svg'), iconSvg);

fs.writeFileSync(path.join(APP, 'src', 'components', 'KonaMark.tsx'), `// The Kona mark: a cat head with a sunflower in its face. GENERATED by docs/design/build/build-logo.mjs; change the script, not this file.
import { useId } from "react";

export function KonaMark({ size = 24, color = "var(--color-brand)", title }: { size?: number; color?: string; title?: string }) {
  const id = "kona-cut-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} className="shrink-0">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <path d="${solid[0].d}" fill="#fff" />
${cuts.map((c) => `          <path d="${c.d}" fill="#000" />`).join('\n')}
        </mask>
      </defs>
      <path d="${solid[0].d}" fill={color} mask={\`url(#\${id})\`} />
${solid.slice(1).map((e) => `      <path d="${e.d}" fill={color} />`).join('\n')}
    </svg>
  );
}
`);
console.log('wrote the SVG files, the favicon and KonaMark.tsx');
