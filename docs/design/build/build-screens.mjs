import { connect } from './fig.mjs';
import { makeKit, T, tint } from './kona-lib.mjs';
import { makeParts, STATE_WORD } from './kona-parts.mjs';

const OUT = decodeURIComponent(new URL('./build-output/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); // screenshots go here (ignored by Git)
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
await k.ensurePage('Screens');

async function vrule(parent) {
  const id = await k.rect(parent, 'Divider', 1, 10, { fill: T.borderSubtle });
  await k.call('set_properties', { ids: [id], props: { width: 1, sizingV: 'fill' } });
  return id;
}
async function spacer(parent) {
  return k.frame(parent, 'Spacer', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill' });
}
async function wordmark(parent) {
  const w = await k.row(parent, 'Wordmark', { gap: 10 });
  await k.glyph(w, 'live', 24, T.accent);
  await k.text(w, 'Kona', { type: 'title' });
  return w;
}
const screen = (name, x, y, w, h) =>
  k.frame(undefined, name, { x, y, width: w, height: h, layout: 'horizontal', sizingH: 'fixed', sizingV: 'fixed', fill: T.ground, clip: true, crossAlign: 'min' });

// =========================================================== A. Start screen
const A = await screen('Screen / Start (nothing added yet)', 0, 0, 1280, 800);
{
  const sb = await k.frame(A, 'Sidebar', { layout: 'vertical', sizingH: 'fixed', width: 280, sizingV: 'fill', fill: T.surface1, padding: [28, 20, 24, 20], gap: 28 });
  await wordmark(sb);
  const pr = await k.col(sb, 'Projects', { gap: 10 });
  await k.text(pr, 'Projects', { type: 'bodyStrong', color: T.textSecondary });
  await k.text(pr, 'None yet.', { type: 'small', color: T.textTertiary });
  await spacer(sb);
  const acct = await k.col(sb, 'Account', { gap: 6 });
  const ar = await k.row(acct, 'Signed in', { gap: 8 });
  await k.glyph(ar, 'done', 16, T.done);
  await k.text(ar, 'Signed in with Claude', { type: 'small', color: T.textSecondary });
  await k.text(acct, 'Using the login on this PC', { type: 'small', color: T.textTertiary });
  await vrule(A);

  const main = await k.frame(A, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', mainAlign: 'center', crossAlign: 'center', gap: 40 });
  await P.emptyState(main, { width: 560 });
  const card = await k.col(main, 'Checks', { gap: 0, padding: [6, 24, 6, 24], sizingH: 'fixed', width: 560, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  const checks = [
    ['done', 'Claude is installed', 'found on this PC'],
    ['done', 'You are signed in', 'with your Claude login'],
    ['idle', 'No project yet', 'add one above'],
  ];
  for (let i = 0; i < checks.length; i++) {
    const [st, a, b] = checks[i];
    const r = await k.row(card, a, { gap: 12, padding: [16, 0, 16, 0], sizingH: 'fill' });
    await k.glyph(r, st, 18, T[st]);
    const t = await k.text(r, a, { type: 'body' });
    await k.call('set_properties', { ids: [t], props: { sizingH: 'fill' } }).catch(() => {});
    await k.text(r, b, { type: 'small', color: T.textTertiary });
    if (i < checks.length - 1) await P.line(card);
  }
}

// =========================================================== B. Working screen
const B = await screen('Screen / Working (one project, four sessions)', 0, 900, 1440, 900);
{
  const sb = await k.frame(B, 'Sidebar', { layout: 'vertical', sizingH: 'fixed', width: 340, sizingV: 'fill', fill: T.surface1, padding: [28, 18, 22, 18], gap: 22 });
  await wordmark(sb);
  const proj = await k.row(sb, 'Project switcher', { gap: 10, padding: [0, 12, 0, 12], height: 44, sizingH: 'fill', sizingV: 'fixed', cornerRadius: 10, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside', fill: 'none' });
  await k.icon(proj, 'folder', 16, T.textSecondary);
  const pt = await k.text(proj, 'shop-api', { type: 'bodyStrong' });
  await k.call('set_properties', { ids: [pt], props: { sizingH: 'fill' } }).catch(() => {});
  await k.icon(proj, 'chevron', 16, T.textSecondary);
  await P.button(sb, 'New session', { variant: 'quiet', size: 'sm', iconName: 'plus', fillWidth: true });
  const list = await k.col(sb, 'Sessions', { gap: 2, sizingH: 'fill' });
  await P.sessionRow(list, { role: 'Builder', title: 'Fix the login redirect', state: 'waiting', age: '14 min', cost: '$0.42', selected: true, width: 304, showRole: false });
  await P.sessionRow(list, { role: 'Reviewer', title: 'Check payment webhook', state: 'live', age: '3 min', cost: '$0.08', width: 304, showRole: false });
  await P.sessionRow(list, { role: 'DevOps', title: 'Move the staging database', state: 'done', age: 'yesterday', cost: '$1.96', width: 304, showRole: false });
  await P.sessionRow(list, { role: 'Planner', title: 'Plan the invoice export', state: 'idle', age: 'Monday', cost: '$0.31', width: 304, showRole: false });
  await spacer(sb);
  const bars = await k.col(sb, 'Plan', { gap: 18, sizingH: 'fill' });
  await P.planBar(bars, { label: 'This session', percent: 12, note: 'Resets in 3 h 10 min', width: 304, showRole: false });
  await P.planBar(bars, { label: 'This week', percent: 35, note: 'Resets on Friday', width: 304, showRole: false });
  const ac = await k.row(sb, 'Account', { gap: 8 });
  await k.glyph(ac, 'done', 16, T.done);
  await k.text(ac, 'Signed in with Claude', { type: 'small', color: T.textSecondary });
  await vrule(B);

  const main = await k.frame(B, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  // header
  const hd = await k.row(main, 'Session header', { gap: 16, padding: [22, 32, 18, 32], sizingH: 'fill', mainAlign: 'spaceBetween', crossAlign: 'center' });
  const hl = await k.row(hd, 'Left', { gap: 16 });
  await k.roleMark(hl, 'Builder', 44);
  const ht = await k.col(hl, 'Titles', { gap: 6 });
  await k.text(ht, 'Fix the login redirect', { type: 'title' });
  const hs = await k.row(ht, 'Facts', { gap: 12 });
  await P.badge(hs, 'waiting');
  await k.text(hs, 'Builder', { type: 'small', color: T.textSecondary });
  await k.text(hs, 'T-0012', { type: 'mono', color: T.textTertiary });
  await k.text(hs, 'branch fix/login-redirect', { type: 'mono', color: T.textTertiary });
  const hr = await k.col(hd, 'Cost', { gap: 2, crossAlign: 'max' });
  await k.text(hr, '$0.42 so far', { type: 'monoStrong', size: 14 });
  await k.text(hr, 'An estimate, not your bill', { type: 'small', color: T.textTertiary });
  // tabs
  const tabsHost = await k.frame(main, 'Tabs host', { layout: 'vertical', padding: [0, 32, 0, 32], sizingH: 'fill', sizingV: 'hug' });
  await P.tabsUnderline(tabsHost, [{ label: 'Chat' }, { label: 'Files' }, { label: 'Changes', count: 4 }, { label: 'Tickets', count: 2, attention: true }, { label: 'Leftovers' }], 'Chat', { width: 1035 });
  await k.call('set_properties', { ids: [tabsHost], props: { sizingH: 'fill' } });
  // transcript
  const tr = await k.frame(main, 'Transcript', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', padding: [28, 32, 16, 32], gap: 22, crossAlign: 'min' });
  const user = await k.row(tr, 'You', { sizingH: 'fill', mainAlign: 'max' });
  const ub = await k.col(user, 'Your message', { padding: [14, 18, 14, 18], fill: T.surface3, cornerRadius: 16, sizingH: 'fixed', width: 520 });
  await k.text(ub, 'After I type the right password, the site sends me back to the sign-in page. Can you find out why?', { type: 'body', fixedWidth: 484 });
  const cl = await k.col(tr, 'Claude', { gap: 12, sizingH: 'fixed', width: 720 });
  await k.text(cl, 'I read the sign-in route. It redirects the visitor before the session is saved, so the next page does not see a login. I want to look at how the routes are set up.', { type: 'body', fixedWidth: 720 });
  const tool = await k.row(cl, 'Tool line', { gap: 10, padding: [10, 14, 10, 14], fill: T.surface1, cornerRadius: 10, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  await k.glyph(tool, 'done', 16, T.done);
  await k.text(tool, 'Read 3 files', { type: 'small', color: T.textSecondary });
  await k.text(tool, 'routes/auth.php  app/Http/AuthController.php  config/session.php', { type: 'mono', color: T.textTertiary });
  await P.permissionCard(tr, { width: 640, floating: false });
  await spacer(tr);
  // composer
  const comp = await k.frame(main, 'Composer host', { layout: 'vertical', padding: [0, 32, 28, 32], sizingH: 'fill', sizingV: 'hug' });
  const cb = await k.col(comp, 'Composer', { gap: 14, padding: [16, 18, 14, 18], fill: T.surface2, cornerRadius: 16, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside', sizingH: 'fill' });
  await k.text(cb, 'Message Builder. Press Enter to send, or paste a picture.', { type: 'body', color: T.textTertiary });
  const cr = await k.row(cb, 'Composer actions', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  await P.button(cr, 'Add image', { variant: 'ghost', size: 'sm', iconName: 'image' });
  const rr = await k.row(cr, 'Right', { gap: 12 });
  await k.text(rr, 'Answer the question above first', { type: 'small', color: T.textTertiary });
  await P.button(rr, 'Send', { variant: 'primary', size: 'sm', iconName: 'send', state: 'disabled' });
}

await k.shot([A], OUT + 'screen-start.png', 1);
await k.shot([B], OUT + 'screen-working.png', 1);
console.log('screens built', A, B);
f.close();
