import { connect } from './fig.mjs';
import { makeKit, T, tint } from './kona-lib.mjs';
import { makeParts } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';
import { L, pairs, ratio } from './lightcheck.mjs';

const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
const Q = makeParts2(k, P);
{ const d = (await f.tool('inspect_document', { depth: 0, allPages: true })).json; await f.run('page.select', { id: d.pages.find((x) => x.name === 'Parts').id }); }

const page = await k.frame(undefined, 'Kona parts, states and themes', {
  x: 4800, y: 0, width: 1440, layout: 'vertical', gap: 72, padding: [72, 80, 88, 80],
  fill: T.ground, sizingH: 'fixed', sizingV: 'hug', crossAlign: 'min',
});
const head = await k.col(page, 'Title block', { gap: 12 });
await k.text(head, 'States, light theme and density', { type: 'display' });
await k.text(head, 'The looks a part has when nothing is there yet, when it is loading, and when the theme or density changes. The light theme and compact density are proposals, not part of the first version.', { type: 'body', color: T.textSecondary, fixedWidth: 820 });

async function section(title, note) {
  const s = await k.col(page, title, { gap: 24, sizingH: 'fill' });
  const h = await k.col(s, title + ' heading', { gap: 6 });
  await k.text(h, title, { type: 'title' });
  if (note) await k.text(h, note, { type: 'small', color: T.textTertiary, fixedWidth: 820 });
  return k.col(s, title + ' specimens', { gap: 28, padding: 32, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', sizingH: 'fill' });
}
const cap = (p, s) => k.text(p, s, { type: 'small', color: T.textTertiary });

{
  const c = await section('Loading', 'Quiet bars stand where text and marks will be. They do not shimmer; the live mark is the only thing that moves.');
  const r = await k.row(c, 'Row', { gap: 48, crossAlign: 'min' });
  const a = await k.col(r, 'Session rows', { gap: 8 }); await cap(a, 'Session list');
  await Q.skeletonRow(a, 300); await Q.skeletonRow(a, 300); await Q.skeletonRow(a, 300);
  const b = await k.col(r, 'Card', { gap: 8 }); await cap(b, 'Ticket card');
  await Q.skeletonCard(b, 220);
  const d = await k.col(r, 'Text', { gap: 8 }); await cap(d, 'Reply being read');
  await Q.skeletonLines(d, [420, 380, 260]);
}
{
  const c = await section('Nothing here yet', 'One short sentence and, where it helps, the next step. A dashed edge marks a place something will be added.');
  const r = await k.row(c, 'Row', { gap: 28, crossAlign: 'min' });
  await Q.emptyNote(r, 'No tickets yet', 'Tickets are work you hand to a role.', { width: 220 });
  await Q.emptyNote(r, 'Nothing left behind', 'Servers and temporary files show up here when a session leaves them.', { width: 260 });
  await Q.emptyNote(r, 'No changes', 'This session has not changed any file yet.', { width: 220 });
  await Q.emptyNote(r, 'No sessions yet', 'Start one from a ticket or with New.', { width: 220 });
}
{
  const c = await section('Light theme (proposal)', 'Warm paper instead of basalt, the same sea glass made deeper so it holds on light. Every pair below is computed (WCAG ratio). Text needs 4.5, borders of controls need 3.');
  const r = await k.row(c, 'Row', { gap: 40, crossAlign: 'min' });
  const sw = await k.frame(r, 'Swatches', { layout: 'horizontal', wrap: true, gap: 14, crossGap: 14, sizingH: 'fixed', width: 560, sizingV: 'hug' });
  for (const [name, hex] of Object.entries(L)) {
    const s = await k.col(sw, 'Swatch / ' + name, { gap: 6, sizingH: 'fixed', width: 100 });
    const chip = await k.frame(s, 'chip', { fill: hex, cornerRadius: 10, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' }, { width: 100, height: 48 });
    await k.text(s, name, { type: 'small', size: 12, color: T.textSecondary });
    await k.text(s, hex, { type: 'mono', size: 11.5, color: T.textTertiary });
  }
  const t = await k.col(r, 'Contrast', { gap: 10, sizingH: 'fill' });
  for (const [n, a, b] of pairs) {
    const q = ratio(a, b);
    const row = await k.row(t, 'Pair', { gap: 14, sizingH: 'fill' });
    await k.text(row, n, { type: 'small', color: T.textSecondary, sizingH: 'fill' });
    await k.text(row, q.toFixed(1) + ' : 1', { type: 'mono', color: q >= 4.5 || n.includes('non-text') && q >= 3 ? T.done : T.waiting });
  }
  await cap(t, 'Not yet checked: every state colour on its own tint, a greyscale pass, shadows on light.');
}
{
  const c = await section('Density (proposal)', 'Comfortable is the default. Compact fits more rows when the window is small. Heights never take values between the two.');
  const tbl = await k.col(c, 'Table', { gap: 0, sizingH: 'fixed', width: 760 });
  const rows = [['Part', 'Comfortable', 'Compact'], ['Control height', '44 px', '36 px'], ['List row', '64 px', '48 px'], ['Body text', '15 / 24', '14 / 22'], ['Space between blocks', '24 px', '16 px'], ['Card padding', '24 px', '16 px']];
  for (let i = 0; i < rows.length; i++) {
    const r = await k.row(tbl, 'Row', { gap: 16, padding: [12, 0, 12, 0], sizingH: 'fill' });
    for (let j = 0; j < 3; j++) { const cell = await k.row(r, 'Cell', { sizingH: j === 0 ? 'fixed' : 'fill', ...(j === 0 ? { width: 260 } : {}) }); await k.text(cell, rows[i][j], i === 0 ? { type: 'smallStrong', color: T.textTertiary } : j === 0 ? { type: 'body', color: T.textSecondary } : { type: 'mono', size: 14 }); }
    if (i < rows.length - 1) await P.line(tbl);
  }
}
console.log('parts3 built');
f.close();
