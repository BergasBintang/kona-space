import { connect } from './fig.mjs';
import { makeKit, T, tint, SHADOW_OVERLAY } from './kona-lib.mjs';
import { makeParts } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';
import { makeShell } from './kona-shell.mjs';
import { makeInteractive } from './kona-interactive.mjs';

const OUT = decodeURIComponent(new URL('./build-output/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); // screenshots go here (ignored by Git)
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
const Q = makeParts2(k, P);
const I = makeInteractive(k, P, Q, f);
const S = makeShell(k, P, Q, I);
const doc = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
await f.run('page.select', { id: doc.pages.find((p) => p.name === 'Screens').id });
const { text, row, col, frame, rect } = k;
const only = process.argv[2];
const on = (n) => !only || only === n;

// ============================================================ 9. Leftovers
if (on('left')) {
  const A = await S.screen('9 Leftovers', 0, 10200);
  await S.sidebar(A, 'Leftovers');
  await S.vrule(A);
  const main = await frame(A, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  const { actions } = await S.pageHeader(main, 'Leftovers', 'Things Claude started that are still running or still lying around. Kona never stops or deletes anything without asking.');
  await P.button(actions, 'Check again', { variant: 'quiet', size: 'sm' });
  const body = await col(main, 'Body', { gap: 28, padding: [0, 32, 28, 32], sizingH: 'fill', sizingV: 'fill' });
  const group = async (title, sub) => {
    const g = await col(body, title, { gap: 12, sizingH: 'fill' });
    const h = await row(g, 'Heading', { gap: 12 });
    await text(h, title, { type: 'heading' });
    await text(h, sub, { type: 'small', color: T.textTertiary });
    return col(g, title + ' list', { gap: 0, padding: [4, 20, 4, 20], sizingH: 'fill', fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  };
  const item = async (parent, last, main1, where, detail, btn, st = 'left', first = false) => {
    const r = await row(parent, 'Leftover / ' + main1, { gap: 16, padding: [16, 0, 16, 0], sizingH: 'fill' });
    await k.glyph(r, st, 20, T[st]);
    const m = await col(r, 'Text', { gap: 4, sizingH: 'fill' });
    await text(m, main1, { type: 'mono', size: 14 });
    await text(m, where, { type: 'small', color: T.textTertiary });
    if (detail) await text(r, detail, { type: 'mono', size: 12.5, color: T.textTertiary });
    if (first) await I.button(r, 'stop-it-sm', '9b Leftovers, confirm');
    else await P.button(r, btn, { variant: 'quiet', size: 'sm' });
    if (!last) await P.line(parent);
  };
  const g1 = await group('Servers still running', '2 found');
  await item(g1, false, 'php -S localhost:3000', 'Started 2 hours ago by Backend, for \u201cFix the login redirect\u201d. That session has ended.', 'port 3000 \u00b7 pid 18244', 'Stop it', 'left', true);
  await item(g1, true, 'npm run dev', 'Started yesterday by DevOps. Still answering on its port.', 'port 5173 \u00b7 pid 9420', 'Stop it');
  const g2 = await group('Programs left in the background', '1 found');
  await item(g2, true, 'node watch.js', 'Started 5 hours ago by QA. Not tied to a session any more.', 'pid 20816', 'Stop it');
  const g3 = await group('Files left on disk', '3 items \u00b7 48 MB');
  await item(g3, false, 'Screenshots from the browser check', 'Temporary folder \u00b7 21 files', '31 MB', 'Delete', 'idle');
  await item(g3, false, 'Test output', 'D:\\projects\\shop-api\\.kona\\tmp', '12 MB', 'Delete', 'idle');
  await item(g3, true, 'Worktree of a merged branch: fix/cart-total', 'The branch is in main. The folder can go.', '5 MB', 'Remove', 'done');
  await k.shot([A], OUT + 'screen-leftovers.png', 1);
}

// ============================================================ 9b. Leftovers, confirm
if (on('left')) {
  const A = await S.screen('9b Leftovers, confirm', 0, 11200);
  await S.sidebar(A, 'Leftovers');
  await S.vrule(A);
  const dim = await col(A, 'Scrim', { sizingH: 'fill', sizingV: 'fill', padding: [150, 0, 0, 0], crossAlign: 'center', fill: '#05080A99' });
  await P.leftoverDialog(dim, { width: 560, buttons: async (r) => { await I.button(r, 'keep-running', '9 Leftovers'); await I.button(r, 'stop-it', '9 Leftovers'); } });
  I.screenKeys(A, [{ trigger: { type: 'keyPress', key: 'Esc' }, action: { type: 'back' } }]);
  await k.shot([A], OUT + 'screen-leftovers-confirm.png', 1);
}

// ============================================================ 10. Brain: now drawn by build-brain.mjs (six screens)

// ============================================================ 11. Settings
if (on('settings')) {
  const A = await S.screen('11 Settings', 0, 13200, 1440, 1200);
  await S.sidebar(A, 'Settings');
  await S.vrule(A);
  const main = await frame(A, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  await S.pageHeader(main, 'Settings', 'Kona has one login and one look. Everything here is yours to change.');
  const body = await col(main, 'Body', { gap: 30, padding: [0, 32, 28, 32], sizingH: 'fill' });
  const sec = async (title, sub) => {
    const s = await row(body, title, { gap: 40, sizingH: 'fill', crossAlign: 'min' });
    const l = await col(s, 'Label', { gap: 6, sizingH: 'fixed', width: 280 });
    await text(l, title, { type: 'heading' });
    if (sub) await text(l, sub, { type: 'small', color: T.textTertiary, fixedWidth: 270 });
    return col(s, title + ' content', { gap: 16, padding: 22, sizingH: 'fill', fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  };
  const s1 = await sec('Your Claude login', 'Kona uses the login already on this PC.');
  const l1 = await row(s1, 'Login', { gap: 12, sizingH: 'fill' });
  await k.glyph(l1, 'done', 20, T.done);
  const lt = await col(l1, 'Text', { gap: 2, sizingH: 'fill' });
  await text(lt, 'Signed in with your Claude account', { type: 'body' });
  await text(lt, 'Plan: Pro \u00b7 checked a minute ago', { type: 'small', color: T.textTertiary });
  await P.button(l1, 'Sign out', { variant: 'quiet', size: 'sm' });
  await P.line(s1);
  await P.button(s1, 'Add another account', { variant: 'ghost', size: 'sm', iconName: 'plus' });
  const s2 = await sec('Sessions at once', 'Two is easy on this PC. A third waits in line.');
  await P.select(s2, { label: 'At the same time', value: '2 sessions', width: 320 });
  await Q.toggle(s2, true, 'Let a third one start when the PC has room');
  const s3 = await sec('Servers for shop-api', 'Kona keeps the name and the path to your key file. It never keeps the key itself.');
  for (const [n, d, kf] of [['staging', 'deploy on staging.example.com', 'key file: ~\\.ssh\\shop_staging'], ['live', 'deploy on shop.example.com', 'key file: ~\\.ssh\\shop_live']]) {
    const r = await row(s3, 'Server / ' + n, { gap: 14, sizingH: 'fill' });
    await Q.icon2(r, 'key', 18, T.textSecondary);
    const m = await col(r, 'Text', { gap: 2, sizingH: 'fill' });
    await text(m, n, { type: 'bodyStrong' });
    await text(m, d, { type: 'mono', size: 12.5, color: T.textTertiary });
    await text(m, kf, { type: 'mono', size: 12.5, color: T.textTertiary });
    await P.button(r, 'Edit', { variant: 'ghost', size: 'sm' });
  }
  await P.button(s3, 'Add a server', { variant: 'ghost', size: 'sm', iconName: 'plus' });
  const s4 = await sec('How Kona talks to you', 'Only the words you read. Code, files and tickets are never written in this voice.');
  await P.select(s4, { label: 'Voice', value: 'Short and plain', width: 320 });
  await Q.checkbox(s4, true, 'Say what finished, what failed and what is next');
  await Q.checkbox(s4, false, 'Add a little humour');
  const s5 = await sec('Look', 'Dark is the only look for now.');
  await P.tabsSegmented(s5, ['Dark', 'Light (later)'], 'Dark');
  await Q.toggle(s5, true, 'Slow breathing on the live mark');
  await Q.toggle(s5, true, 'Stop all motion when Windows asks for less motion');
  await k.shot([A], OUT + 'screen-settings.png', 1);
}

// ============================================================ 12. Command palette
if (on('palette')) {
  const A = await S.screen('12 Command palette', 0, 14500);
  await S.sidebar(A, 'Sessions');
  await S.vrule(A);
  const dim = await col(A, 'Scrim', { sizingH: 'fill', sizingV: 'fill', padding: [110, 0, 0, 0], crossAlign: 'center', fill: '#05080A99' });
  await Q.palette(dim, { width: 680 });
  I.screenKeys(A, [{ trigger: { type: 'keyPress', key: 'Esc' }, action: { type: 'back' } }, { trigger: { type: 'keyPress', key: 'Enter' }, action: { type: 'navigate', destKey: '6 Worktrees' }, transition: { type: 'dissolve' }, durationMs: 140 }]);
  await k.shot([A], OUT + 'screen-palette.png', 1);
}

// ============================================================ 13. New session
if (on('new')) {
  const A = await S.screen('13 New session', 0, 15500);
  await S.sidebar(A, 'Sessions');
  await S.vrule(A);
  const dim = await col(A, 'Scrim', { sizingH: 'fill', sizingV: 'fill', padding: [70, 0, 0, 0], crossAlign: 'center', fill: '#05080A99' });
  const d = await col(dim, 'New session dialog', { gap: 20, padding: 28, sizingH: 'fixed', width: 600, fill: T.surface2, cornerRadius: 18, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', effects: SHADOW_OVERLAY });
  await text(d, 'New session', { type: 'heading' });
  await P.select(d, { label: 'Role', value: 'Backend', role: 'Backend', width: 544, open: true });
  await P.menu(d, [{ label: 'Product', role: 'Product' }, { label: 'Backend', role: 'Backend' }, { label: 'QA', role: 'QA', hover: true }, { label: 'DevOps', role: 'DevOps' }], 'Backend', { width: 544 });
  await P.select(d, { label: 'Ticket', value: 'T-0013  Rename the orders table', width: 544 });
  const wt = await col(d, 'Where', { gap: 10, sizingH: 'fill' });
  await text(wt, 'Where it works', { type: 'smallStrong', color: T.textSecondary });
  const o1 = await row(wt, 'Own copy', { gap: 12 }); await Q.radio(o1, true); await text(o1, 'In its own copy of the project (a new worktree)', { type: 'body' });
  const o2 = await row(wt, 'Main folder', { gap: 12 }); await Q.radio(o2, false); await text(o2, 'In the main folder', { type: 'body' });
  await Q.alert(d, 'idle', 'Two sessions are running', 'This one will start as soon as one of them ends.', null, { width: 544 });
  const ft = await row(d, 'Footer', { sizingH: 'fill', mainAlign: 'max', gap: 12 });
  await I.button(ft, 'cancel', ':back');
  await I.button(ft, 'start-session', '1 Sessions / Chat');
  await k.shot([A], OUT + 'screen-newsession.png', 1);
}

// ============================================================ 14. Add project
if (on('add')) {
  const A = await S.screen('14 Add project', 0, 16500);
  await S.sidebar(A, 'Sessions', { badges: {} });
  await S.vrule(A);
  const dim = await col(A, 'Scrim', { sizingH: 'fill', sizingV: 'fill', padding: [90, 0, 0, 0], crossAlign: 'center', fill: '#05080A99' });
  const d = await col(dim, 'Add project dialog', { gap: 22, padding: 28, sizingH: 'fixed', width: 600, fill: T.surface2, cornerRadius: 18, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', effects: SHADOW_OVERLAY });
  await text(d, 'Add a project', { type: 'heading' });
  await text(d, 'Pick the folder where the code lives. Kona adds a hidden folder inside it for notes and tickets, and tells Git to ignore it.', { type: 'body', color: T.textSecondary, fixedWidth: 544 });
  const fr = await row(d, 'Folder row', { gap: 12, sizingH: 'fill', crossAlign: 'max' });
  await P.field(fr, { label: 'Folder', value: 'D:\\projects\\shop-api', mono: true, width: 420 });
  await P.button(fr, 'Browse', { variant: 'quiet' });
  await P.field(d, { label: 'Name', value: 'shop-api', width: 544 });
  await P.field(d, { label: 'GitHub address (optional)', placeholder: 'owner/repo', helper: 'Used to open pull requests. You can add it later.', width: 544, mono: true });
  const ft = await row(d, 'Footer', { sizingH: 'fill', mainAlign: 'max', gap: 12 });
  await I.button(ft, 'cancel', ':back');
  await I.button(ft, 'add-project', 'F4 Creating the project');
  await k.shot([A], OUT + 'screen-addproject.png', 1);
}

console.log('screens 2c built');
f.close();
