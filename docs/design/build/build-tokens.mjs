import { connect } from './fig.mjs';
import { makeKit, T, TYPE, tint, FONT, MONO } from './kona-lib.mjs';

const OUT = decodeURIComponent(new URL('./build-output/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); // screenshots go here (ignored by Git)
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const f = await connect(7979);
const k = makeKit(f);
await k.ensurePage('Tokens');

const page = await k.frame(undefined, 'Kona tokens', {
  x: 0, y: 0, width: 1440, layout: 'vertical', gap: 72, padding: [72, 80, 80, 80],
  fill: T.ground, sizingH: 'fixed', sizingV: 'hug', crossAlign: 'min',
});

// ---- Title
const head = await k.col(page, 'Title block', { gap: 12 });
await k.text(head, 'Kona design tokens', { type: 'display' });
await k.text(head, 'Calm, technical and warm. Dark first, roomy. Every value on this page is a token. Nothing inside a component is a loose colour.', { type: 'body', color: T.textSecondary, fixedWidth: 720 });

// ---- Colour
const sec = async (title, note) => {
  const s = await k.col(page, title, { gap: 28, sizingH: 'fill' });
  const h = await k.col(s, title + ' heading', { gap: 6 });
  await k.text(h, title, { type: 'title' });
  if (note) await k.text(h, note, { type: 'small', color: T.textTertiary, fixedWidth: 760 });
  return s;
};

const colour = await sec('Colour', 'One accent, used once per screen area. States get their own hues and always come with a glyph and a word.');
const groups = [
  ['Surfaces', [['Canvas', T.canvas], ['Ground', T.ground], ['Surface 1', T.surface1], ['Surface 2', T.surface2], ['Surface 3', T.surface3], ['Inset', T.inset]]],
  ['Lines', [['Border subtle', T.borderSubtle], ['Border strong', T.borderStrong]]],
  ['Text', [['Text', T.text], ['Secondary', T.textSecondary], ['Tertiary', T.textTertiary], ['Disabled', T.textDisabled]]],
  ['Accent', [['Accent', T.accent], ['Hover', T.accentHover], ['Pressed', T.accentPressed], ['On accent', T.onAccent]]],
  ['States', [['Live', T.live], ['Waiting on you', T.waiting], ['Idle', T.idle], ['Done', T.done], ['Stopped', T.stopped], ['Left behind', T.left]]],
];
for (const [gname, items] of groups) {
  const r = await k.row(colour, gname, { gap: 24, crossAlign: 'min' });
  const lab = await k.frame(r, gname + ' name', { layout: 'vertical', sizingH: 'fixed', sizingV: 'hug', width: 140, padding: [20, 0, 0, 0] });
  await k.text(lab, gname, { type: 'bodyStrong', color: T.textSecondary });
  for (const [n, hex] of items) {
    const sw = await k.col(r, n, { gap: 8 });
    await k.rect(sw, n + ' swatch', 120, 72, { fill: hex, cornerRadius: 10, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside' });
    await k.text(sw, n, { type: 'small' });
    await k.text(sw, hex.toUpperCase(), { type: 'mono', color: T.textTertiary });
  }
}

// ---- Type
const type = await sec('Type', 'Nunito Sans for words, a mono face for anything a machine wrote: commands, paths, ports, ids, numbers. The preview only has two real weights (Regular and Bold); the app will ship a variable font and use a true semibold.');
const samples = [
  ['display', 'Add your first project', 'Display · 30/38 · Bold'],
  ['title', 'Claude wants to run a command', 'Title · 22/30 · Bold'],
  ['heading', 'Fix the login redirect', 'Heading · 17/24 · Bold'],
  ['body', 'A project is one folder on this PC. Kona keeps its notes and tickets inside it.', 'Body · 15/24 · Regular'],
  ['small', 'Started 14 minutes ago. Waiting for your answer.', 'Small · 13/20 · Regular'],
  ['mono', 'npm run dev   port 3000   pid 18244', 'Mono · 13/20 · Consolas stand-in'],
];
const tcard = await k.col(type, 'Type specimens', { gap: 0, padding: [8, 28, 8, 28], fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', sizingH: 'fill' });
for (let i = 0; i < samples.length; i++) {
  const [ty, str, cap] = samples[i];
  const r = await k.row(tcard, cap, { gap: 24, padding: [18, 0, 18, 0], sizingH: 'fill', mainAlign: 'spaceBetween' });
  await k.text(r, str, { type: ty });
  await k.text(r, cap, { type: 'mono', color: T.textTertiary });
  if (i < samples.length - 1) await k.rect(tcard, 'rule', 1, 1, { fill: T.borderSubtle, sizingH: 'fill' }).then((id) => k.call('set_properties', { ids: [id], props: { sizingH: 'fill', height: 1 } }));
}

// ---- Shape and space
const shape = await sec('Shape and space', 'Roomy. Controls are 44 px tall, or 36 px when a row is tight. Corners are soft but never bubbly.');
const srow = await k.row(shape, 'Shape row', { gap: 56, crossAlign: 'min' });
const radii = await k.row(srow, 'Radii', { gap: 20, crossAlign: 'min' });
for (const [n, rd] of [['Small', 6], ['Control', 10], ['Card', 14], ['Dialog', 18]]) {
  const c = await k.col(radii, n, { gap: 8 });
  await k.rect(c, n + ' radius', 80, 80, { fill: T.surface2, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside', cornerRadius: rd });
  await k.text(c, n, { type: 'small' });
  await k.text(c, rd + ' px', { type: 'mono', color: T.textTertiary });
}
const heights = await k.row(srow, 'Control heights', { gap: 20, crossAlign: 'min' });
for (const [n, h] of [['Compact', 36], ['Default', 44]]) {
  const c = await k.col(heights, n, { gap: 8 });
  await k.rect(c, n + ' height', 120, h, { fill: T.surface3, cornerRadius: 10 });
  await k.text(c, n, { type: 'small' });
  await k.text(c, h + ' px', { type: 'mono', color: T.textTertiary });
}
const space = await k.row(srow, 'Spacing', { gap: 14, crossAlign: 'max' });
for (const s of [4, 8, 12, 16, 24, 32, 48]) {
  const c = await k.col(space, 'space ' + s, { gap: 8, crossAlign: 'center' });
  await k.rect(c, 'space ' + s + ' bar', 24, s, { fill: tint(T.accent, 55), cornerRadius: 3 });
  await k.text(c, String(s), { type: 'mono', color: T.textTertiary });
}

// ---- Rules
const rules = await sec('How the tokens are used');
const rcard = await k.col(rules, 'Rules', { gap: 14, padding: 28, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', sizingH: 'fill' });
const lines = [
  ['Sentence case everywhere.', 'No small label above a heading. The heading carries its own weight.'],
  ['One accent per screen area.', 'Sea glass is Kona\u2019s voice: the main button, the focus ring and the live state.'],
  ['State is a glyph plus a word.', 'Never colour alone and never a plain dot.'],
  ['Flat at rest.', 'A shadow only appears when something floats: menus and dialogs.'],
  ['Plain words.', 'Write \u201cthis week\u201d, not \u201cWK\u201d. Write \u201cwaiting on you\u201d, not a code.'],
  ['Machine text is mono.', 'Commands, paths, ports, ids and numbers, with even digit widths.'],
];
for (const [a, b] of lines) {
  const r = await k.row(rcard, a, { gap: 12, crossAlign: 'min' });
  await k.icon(r, 'check', 16, T.accent);
  const t = await k.col(r, a + ' text', { gap: 2 });
  await k.text(t, a, { type: 'bodyStrong' });
  await k.text(t, b, { type: 'small', color: T.textSecondary });
}

await k.shot([page], OUT + 'tokens.png', 1);
console.log('tokens page built', page);

// ---- Colour variables (so the file carries the tokens for handoff)
if (!process.env.SKIP_VARS) try {
  await f.run('variable.createCollection', { name: 'Kona colours', modes: ['Dark'] });
  const names = {
    'surface/canvas': T.canvas, 'surface/ground': T.ground, 'surface/1': T.surface1, 'surface/2': T.surface2, 'surface/3': T.surface3, 'surface/inset': T.inset,
    'line/subtle': T.borderSubtle, 'line/strong': T.borderStrong,
    'text/primary': T.text, 'text/secondary': T.textSecondary, 'text/tertiary': T.textTertiary, 'text/disabled': T.textDisabled,
    'accent/base': T.accent, 'accent/hover': T.accentHover, 'accent/pressed': T.accentPressed, 'accent/on': T.onAccent,
    'state/live': T.live, 'state/waiting': T.waiting, 'state/idle': T.idle, 'state/done': T.done, 'state/stopped': T.stopped, 'state/left-behind': T.left,
  };
  for (const [n, v] of Object.entries(names)) await f.run('variable.create', { collection: 'Kona colours', name: n, type: 'color', value: v });
  console.log('variables created:', Object.keys(names).length);
} catch (e) { console.log('variables skipped:', String(e).slice(0, 300)); }
f.close();
