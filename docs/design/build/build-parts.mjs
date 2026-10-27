import { connect } from './fig.mjs';
import { makeKit, T, tint } from './kona-lib.mjs';
import { makeParts, STATE_WORD } from './kona-parts.mjs';

const OUT = decodeURIComponent(new URL('./build-output/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); // screenshots go here (ignored by Git)
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const only = process.argv[2]; // optional: build only one section while iterating
const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
await k.ensurePage('Parts');

const page = await k.frame(undefined, 'Kona parts', {
  x: 0, y: 0, width: 1440, layout: 'vertical', gap: 72, padding: [72, 80, 88, 80],
  fill: T.ground, sizingH: 'fixed', sizingV: 'hug', crossAlign: 'min',
});
const head = await k.col(page, 'Title block', { gap: 12 });
await k.text(head, 'Kona base parts', { type: 'display' });
await k.text(head, 'The first six parts, with every state they have, plus the two signature parts that make Kona look like Kona: the state glyphs and the plan bar. Built only from the tokens.', { type: 'body', color: T.textSecondary, fixedWidth: 760 });

async function section(title, note) {
  const s = await k.col(page, title, { gap: 24, sizingH: 'fill' });
  const h = await k.col(s, title + ' heading', { gap: 6 });
  await k.text(h, title, { type: 'title' });
  if (note) await k.text(h, note, { type: 'small', color: T.textTertiary, fixedWidth: 760 });
  const card = await k.col(s, title + ' specimens', { gap: 28, padding: 32, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', sizingH: 'fill' });
  return card;
}
const cap = (parent, s) => k.text(parent, s, { type: 'small', color: T.textTertiary });
const cell = (parent, w, name = 'cell') => k.frame(parent, name, { layout: 'horizontal', sizingH: 'fixed', width: w, sizingV: 'hug', crossAlign: 'center' });

// 1. Buttons
{
  const c = await section('Button', 'Four kinds, five states. The main button is the only place the accent fills a surface. Heights are 44 px, or 36 px in tight rows.');
  const states = ['default', 'hover', 'focus', 'pressed', 'disabled'];
  const hdr = await k.row(c, 'States', { gap: 0 });
  await cell(hdr, 140);
  for (const s of states) { const x = await cell(hdr, 190); await cap(x, s[0].toUpperCase() + s.slice(1)); }
  for (const [variant, label] of [['primary', 'Main'], ['quiet', 'Quiet'], ['danger', 'Stop or delete'], ['ghost', 'Plain']]) {
    const r = await k.row(c, 'Row ' + variant, { gap: 0, crossAlign: 'center' });
    const nm = await cell(r, 140); await k.text(nm, label, { type: 'small', color: T.textSecondary });
    for (const s of states) {
      const x = await cell(r, 190);
      await P.button(x, variant === 'danger' ? 'Stop it' : variant === 'primary' ? 'Add a project' : variant === 'quiet' ? 'Don\u2019t allow' : 'Always allow here', { variant, state: s, size: variant === 'ghost' ? 'sm' : 'md' });
    }
  }
  const sm = await k.row(c, 'Sizes', { gap: 16, crossAlign: 'center' });
  const nm = await cell(sm, 140); await k.text(nm, 'Compact and icon', { type: 'small', color: T.textSecondary });
  await P.button(sm, 'Add image', { variant: 'quiet', size: 'sm', iconName: 'image' });
  await P.button(sm, 'Send', { variant: 'primary', size: 'sm', iconName: 'send' });
  await P.button(sm, 'Add a project', { variant: 'primary', iconName: 'folder' });
}

// 2. State badge and glyphs
{
  const c = await section('State glyph and badge', 'Six states, one family of glyphs. A glyph never stands alone: the word always sits beside it. The same glyph appears on badges, session rows, board cards and the leftovers list.');
  const big = await k.row(c, 'Glyph sheet', { gap: 40, crossAlign: 'min' });
  for (const s of ['live', 'waiting', 'idle', 'done', 'stopped', 'left']) {
    const x = await k.col(big, 'Glyph ' + s, { gap: 12, crossAlign: 'center' });
    await k.glyph(x, s, 56, T[s]);
    await k.text(x, STATE_WORD[s], { type: 'small', color: T[s] });
  }
  await k.line?.(c);
  const bd = await k.row(c, 'Badges', { gap: 14 });
  for (const s of ['live', 'waiting', 'idle', 'done', 'stopped', 'left']) await P.badge(bd, s);
  const roles = await k.row(c, 'Role marks', { gap: 28, crossAlign: 'center' });
  for (const r of ['Product', 'Backend', 'QA', 'DevOps']) {
    const x = await k.row(roles, 'Role ' + r, { gap: 12 });
    await k.roleMark(x, r, 40);
    await k.text(x, r, { type: 'body' });
  }
}

// 3. Text field
{
  const c = await section('Text field', 'Labels sit above the box because a form needs them; they are plain text, not a decoration. Errors say what to do next, in everyday words.');
  const r = await k.row(c, 'Fields', { gap: 32, crossAlign: 'min' });
  await P.field(r, { width: 270, label: 'Project folder', placeholder: 'Choose a folder on this PC', helper: 'Kona keeps its notes in a hidden folder inside it.', state: 'default' });
  await P.field(r, { width: 270, label: 'Project folder', value: 'D:\\projects\\shop-api', state: 'focus', mono: true });
  await P.field(r, { width: 270, label: 'Project folder', value: 'D:\\projects\\shop-ap', state: 'error', mono: true, helper: 'Kona cannot find that folder. Check the spelling and try again.' });
  await P.field(r, { width: 270, label: 'Project folder', value: 'D:\\projects\\shop-api', state: 'disabled', mono: true, helper: 'Locked while a session is running.' });
  const cp = await k.row(c, 'Captions', { gap: 32 });
  for (const s of ['Default', 'Focus', 'Error', 'Disabled']) { const x = await cell(cp, 270); await cap(x, s); }
}

// 4. Select and menu
{
  const c = await section('Select and menu', 'Picking a role shows its mark, so the choice is recognisable by shape as well as by name. The open menu is the only place besides dialogs that casts a shadow.');
  const r = await k.row(c, 'Select row', { gap: 48, crossAlign: 'min' });
  const left = await k.col(r, 'Closed', { gap: 16 });
  await P.select(left, { label: 'Role', value: 'Backend', role: 'Backend' });
  await cap(left, 'Closed');
  const right = await k.col(r, 'Open', { gap: 16 });
  const holder = await k.col(right, 'Open stack', { gap: 6 });
  await P.select(holder, { label: 'Role', value: 'Backend', role: 'Backend', open: true });
  await P.menu(holder, [{ label: 'Product', role: 'Product' }, { label: 'Backend', role: 'Backend' }, { label: 'QA', role: 'QA', hover: true }, { label: 'DevOps', role: 'DevOps' }], 'Backend');
  await cap(right, 'Open, with the chosen row ticked and the pointer over QA');
}

// 5. Tabs
{
  const c = await section('Tabs', 'The count chip fades away at zero. It turns amber only when something needs you.');
  await P.tabsUnderline(c, [{ label: 'Chat' }, { label: 'Files' }, { label: 'Changes', count: 4 }, { label: 'Tickets', count: 2, attention: true }, { label: 'Leftovers' }], 'Chat', { width: 640 });
  await P.tabsSegmented(c, ['Board', 'List', 'Graph'], 'Board');
}

// 6. Dialogs
{
  const c = await section('Dialog', 'The permission card shows the exact command and says in everyday words what it does. The leftover dialog asks before stopping anything, and names the session it came from.');
  const r = await k.row(c, 'Dialogs', { gap: 40, crossAlign: 'min' });
  await P.permissionCard(r, { width: 560 });
  await P.leftoverDialog(r, { width: 560 });
}

// 7. Signature parts
{
  const c = await section('Plan bar and session row', 'The plan bar always says what it measures in words. Past 80 percent it turns amber and adds a glyph and a sentence. The session row shows state as a glyph plus a word, and the role as a shape.');
  const r = await k.row(c, 'Bars', { gap: 48, crossAlign: 'min' });
  await P.planBar(r, { label: 'This session', percent: 12, note: 'Resets in 3 h 10 min' });
  await P.planBar(r, { label: 'This week', percent: 35, note: 'Resets on Friday' });
  await P.planBar(r, { label: 'This week, Opus', percent: 86, note: 'Resets on Friday' });
  const rows = await k.col(c, 'Rows', { gap: 4 });
  await P.sessionRow(rows, { role: 'Backend', title: 'Fix the login redirect', state: 'waiting', age: 'started 14 min ago', cost: '$0.42', selected: true, width: 520 });
  await P.sessionRow(rows, { role: 'QA', title: 'Check payment webhook', state: 'live', age: 'started 3 min ago', cost: '$0.08', width: 520 });
  await P.sessionRow(rows, { role: 'DevOps', title: 'Move the staging database', state: 'done', age: 'finished yesterday', cost: '$1.96', width: 520 });
  await P.sessionRow(rows, { role: 'Product', title: 'Plan the invoice export', state: 'idle', age: 'open since Monday', cost: '$0.31', width: 520 });
}

await k.shot([page], OUT + 'parts.png', 1);
console.log('parts built', page);
f.close();
