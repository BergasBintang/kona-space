import { connect } from './fig.mjs';
import { makeKit, T, tint, SHADOW_OVERLAY } from './kona-lib.mjs';
import { makeParts } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';
import { makeShell } from './kona-shell.mjs';
import { makeInteractive, SESSIONS, ANSWERED } from './kona-interactive.mjs';

const OUT = decodeURIComponent(new URL('./build-output/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); // screenshots go here (ignored by Git)
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
const Q = makeParts2(k, P);
const I = makeInteractive(k, P, Q, f);
const S = makeShell(k, P, Q, I);
await k.ensurePage('Screens');
const { text, row, col, frame, rect } = k;
const fill = (id) => k.call('set_properties', { ids: [id], props: { sizingH: 'fill' } });

// ============================================================ 1. Sessions: chat (asking, answered yes, answered no)
async function chat(name, y, mode) {
  const A = await S.screen(name, 0, y);
  const answered = mode !== 'ask';
  await S.sidebar(A, 'Sessions', { badges: !answered });
  await S.vrule(A);
  await S.sessionColumn(A, answered ? { list: [ANSWERED, ...SESSIONS.slice(1, 4)], selected: ANSWERED.key } : {});
  await S.vrule(A);
  const main = await frame(A, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  await S.sessionHeader(main, answered ? { state: 'live' } : {});
  await S.sessionTabs(main, 'Chat');
  const tr = await frame(main, 'Transcript', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', padding: [26, 32, 14, 32], gap: 20, crossAlign: 'min' });
  const user = await row(tr, 'You', { sizingH: 'fill', mainAlign: 'max' });
  const ub = await col(user, 'Your message', { padding: [14, 18, 14, 18], fill: T.surface3, cornerRadius: 16, sizingH: 'fixed', width: 460 });
  await text(ub, 'After I type the right password, the site sends me back to the sign-in page. Can you find out why?', { type: 'body', fixedWidth: 424 });
  const cl = await col(tr, 'Claude', { gap: 12, sizingH: 'fixed', width: 700 });
  await text(cl, 'I read the sign-in route. It redirects the visitor before the session is saved, so the next page does not see a login. I want to run the login tests to confirm.', { type: 'body', fixedWidth: 700 });
  const tool = await row(cl, 'Tool line', { gap: 10, padding: [10, 14, 10, 14], fill: T.surface1, cornerRadius: 10, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  await k.glyph(tool, 'done', 16, T.done);
  await text(tool, 'Read 3 files', { type: 'small', color: T.textSecondary });
  await text(tool, 'routes/auth.php  AuthController.php  session.php', { type: 'mono', color: T.textTertiary });
  if (!answered) {
    await P.permissionCard(tr, { width: 640, floating: false, buttons: async (r) => { await I.button(r, 'dont-allow', '1c Chat, answered no'); await I.button(r, 'allow-once', '1b Chat, answered yes'); } });
  } else {
    const t2 = await row(cl, 'Tool line 2', { gap: 10, padding: [10, 14, 10, 14], fill: T.surface1, cornerRadius: 10, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
    await k.glyph(t2, mode === 'yes' ? 'done' : 'stopped', 16, mode === 'yes' ? T.done : T.stopped);
    await text(t2, mode === 'yes' ? 'Ran a command' : 'You said no', { type: 'small', color: T.textSecondary });
    await text(t2, 'ls -la', { type: 'mono', color: T.textTertiary });
    await text(cl, mode === 'yes'
      ? 'The folder has 14 files. The login code is in app/Http. Next I will save the session before the redirect and run the login tests.'
      : 'Understood, I did not run it. I will read the files directly instead and tell you what I find.', { type: 'body', fixedWidth: 700 });
  }
  await S.spacer(tr);
  const comp = await frame(main, 'Composer host', { layout: 'vertical', padding: [0, 32, 26, 32], sizingH: 'fill', sizingV: 'hug' });
  const cb = await col(comp, 'Composer', { gap: 12, padding: [14, 18, 12, 18], fill: T.surface2, cornerRadius: 16, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside', sizingH: 'fill' });
  await text(cb, 'Message Backend. Press Enter to send, or paste a picture.', { type: 'body', color: T.textTertiary });
  const cr = await row(cb, 'Composer actions', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  await P.button(cr, 'Add image', { variant: 'ghost', size: 'sm', iconName: 'image' });
  const rr = await row(cr, 'Right', { gap: 12 });
  if (!answered) await text(rr, 'Answer the question above first', { type: 'small', color: T.textTertiary });
  await P.button(rr, 'Send', { variant: 'primary', size: 'sm', iconName: 'send', state: answered ? 'default' : 'disabled' });
  I.screenKeys(A, [{ trigger: { type: 'keyPress', key: 'Ctrl+K' }, action: { type: 'navigate', destKey: '12 Command palette' }, transition: { type: 'dissolve' }, durationMs: 140 }]);
  return A;
}
const A = await chat('1 Sessions / Chat', 0, 'ask');
const A2 = await chat('1b Chat, answered yes', 1000, 'yes');
const A3 = await chat('1c Chat, answered no', 2000, 'no');

// ============================================================ 2. Sessions: changes
const B = await S.screen('2 Sessions / Changes', 0, 3000);
{
  await S.sidebar(B, 'Sessions');
  await S.vrule(B);
  await S.sessionColumn(B);
  await S.vrule(B);
  const main = await frame(B, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  await S.sessionHeader(main);
  await S.sessionTabs(main, 'Changes');
  const body = await frame(main, 'Body', { layout: 'horizontal', sizingH: 'fill', sizingV: 'fill', gap: 0, crossAlign: 'min' });
  // changed files
  const files = await col(body, 'Changed files', { gap: 2, padding: [18, 10, 18, 14], sizingH: 'fixed', width: 270, sizingV: 'fill' });
  await text(files, '4 files changed', { type: 'smallStrong', color: T.textSecondary, props: {} });
  const rowsData = [['AuthController.php', '+4 \u22121', true], ['session.php', '+1 \u22121', false], ['LoginTest.php', '+22', false], ['auth.php', '+2', false]];
  for (const [n, d, sel] of rowsData) {
    const r = await row(files, 'File / ' + n, { gap: 8, padding: [0, 10, 0, 10], height: 36, sizingH: 'fill', sizingV: 'fixed', cornerRadius: 8, fill: sel ? T.surface3 : 'none' });
    await Q.icon2(r, 'file', 16, T.textTertiary);
    await text(r, n, { type: 'small', size: 14, color: sel ? T.text : T.textSecondary, sizingH: 'fill' });
    await text(r, d, { type: 'mono', size: 12, color: T.textTertiary });
  }
  await S.vrule(body);
  const dv = await col(body, 'Diff', { gap: 14, padding: [18, 24, 18, 24], sizingH: 'fill', sizingV: 'fill' });
  const dh = await row(dv, 'File name', { gap: 10, sizingH: 'fill', mainAlign: 'spaceBetween' });
  await text(dh, 'app/Http/AuthController.php', { type: 'mono', size: 14 });
  await P.button(dh, 'Open in Files', { variant: 'ghost', size: 'sm' });
  const box = await col(dv, 'Hunk', { gap: 0, padding: [8, 0, 8, 0], sizingH: 'fill', fill: T.inset, cornerRadius: 12, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  await Q.diffLine(box, ' ', 12, 12, 'public function login(Request $request)');
  await Q.diffLine(box, ' ', 13, 13, '{');
  await Q.diffLine(box, ' ', 14, 14, "    $ok = Auth::attempt($credentials);");
  await Q.diffLine(box, '-', 15, null, "    return redirect('/home');");
  await Q.diffLine(box, '+', null, 15, '    $request->session()->save();');
  await Q.diffLine(box, '+', null, 16, "    return redirect('/home');");
  await Q.diffLine(box, ' ', 16, 17, '}');
  // a comment on a line, sent back to Claude
  const cm = await col(dv, 'Comment', { gap: 10, padding: 16, sizingH: 'fill', fill: T.surface2, cornerRadius: 12, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  const ch = await row(cm, 'Head', { gap: 8 });
  await Q.icon2(ch, 'chat', 16, T.textSecondary);
  await text(ch, 'Your note on line 15', { type: 'smallStrong', color: T.textSecondary });
  await text(cm, 'Save the session before the redirect, and also on the register route.', { type: 'body' });
  const dr = await row(dv, 'Actions', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  await text(dr, '1 note ready to send', { type: 'small', color: T.textTertiary });
  const db = await row(dr, 'Buttons', { gap: 12 });
  await P.button(db, 'Send note to Backend', { variant: 'primary', size: 'sm' });
}

// ============================================================ 3. Board
const C = await S.screen('3 Board', 0, 4000);
let boardMain;
{
  await S.sidebar(C, 'Board');
  await S.vrule(C);
  boardMain = await frame(C, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  const { actions } = await S.pageHeader(boardMain, 'Board', 'shop-api \u00b7 tickets only for this project');
  await P.tabsSegmented(actions, ['All', 'Mine to answer', 'By role'], 'All');
  await P.button(actions, 'New ticket', { variant: 'primary', size: 'sm', iconName: 'plus' });
  const note = await row(boardMain, 'Attention', { gap: 10, padding: [0, 32, 16, 32], sizingH: 'fill' });
  await k.glyph(note, 'waiting', 16, T.waiting);
  await text(note, '1 ticket is waiting on you.', { type: 'small', color: T.waiting });
  const cols = await row(boardMain, 'Columns', { gap: 12, padding: [0, 28, 0, 28], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });
  const W = 216, CW = 192;
  const mk = async (name, n, hint) => Q.kanbanColumn(cols, name, n, 680, { width: W, hint });
  const c1 = await mk('Backlog', 2);
  await Q.kanbanCard(c1, { id: 'T-0015', title: 'Plan the invoice export', note: 'No role yet.', width: CW });
  await Q.kanbanCard(c1, { id: 'T-0016', title: 'Add rate limits to the API', role: 'Product', width: CW });
  const c2 = await mk('Ready', 2);
  await Q.kanbanCard(c2, { id: 'T-0013', title: 'Rename the orders table', role: 'Backend', width: CW });
  await Q.kanbanCard(c2, { id: 'T-0017', title: 'Backup before the next deploy', role: 'DevOps', width: CW });
  const c3 = await mk('In progress', 2);
  const tc = await Q.kanbanCard(c3, { id: 'T-0012', title: 'Fix the login redirect', role: 'Backend', flag: true, branch: 'fix/login-redirect', width: CW });
  I.clickTo(tc, '4 Board / Ticket open');
  await Q.kanbanCard(c3, { id: 'T-0014', title: 'Check the payment webhook', role: 'QA', state: 'live', width: CW });
  const c4 = await mk('Review', 1);
  await Q.kanbanCard(c4, { id: 'T-0011', title: 'Cache the product list', role: 'QA', state: 'idle', width: CW });
  const c5 = await mk('Done', 2);
  await Q.kanbanCard(c5, { id: 'T-0009', title: 'Move the staging database', role: 'DevOps', state: 'done', width: CW });
  await Q.kanbanCard(c5, { id: 'T-0008', title: 'Fix the cart total', role: 'Backend', state: 'done', width: CW });
}

// ============================================================ 4. Ticket drawer over the board
const D = await S.screen('4 Board / Ticket open', 0, 5000);
{
  await S.sidebar(D, 'Board');
  await S.vrule(D);
  const dim = await frame(D, 'Board dimmed', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0, opacity: 0.35 });
  await S.pageHeader(dim, 'Board', 'shop-api \u00b7 tickets only for this project');
  const cols = await row(dim, 'Columns', { gap: 12, padding: [0, 28, 0, 28], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });
  const d1 = await Q.kanbanColumn(cols, 'Backlog', 2, 680, { width: 216 });
  await Q.kanbanCard(d1, { id: 'T-0015', title: 'Plan the invoice export', note: 'No role yet.', width: 192 });
  await Q.kanbanCard(d1, { id: 'T-0016', title: 'Add rate limits to the API', role: 'Product', width: 192 });
  const d2 = await Q.kanbanColumn(cols, 'Ready', 2, 680, { width: 216 });
  await Q.kanbanCard(d2, { id: 'T-0013', title: 'Rename the orders table', role: 'Backend', width: 192 });
  const d3 = await Q.kanbanColumn(cols, 'In progress', 2, 680, { width: 216 });
  await Q.kanbanCard(d3, { id: 'T-0012', title: 'Fix the login redirect', role: 'Backend', flag: true, selected: true, width: 192 });
  await S.vrule(D);
  const dr = await frame(D, 'Drawer', { layout: 'vertical', sizingH: 'fixed', width: 560, sizingV: 'fill', fill: T.surface2, padding: [28, 32, 24, 32], gap: 22, effects: SHADOW_OVERLAY });
  const t0 = await row(dr, 'Top', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  await text(t0, 'T-0012', { type: 'mono', color: T.textTertiary });
  await I.button(t0, 'close-ghost', '3 Board');
  await text(dr, 'Fix the login redirect', { type: 'title' });
  const facts = await row(dr, 'Facts', { gap: 12 });
  await P.badge(facts, 'waiting');
  await Q.chip(facts, 'In progress');
  await text(dr, 'After a correct password the site sends the visitor back to the sign-in page. Find why and fix it. Keep the change small.', { type: 'body', color: T.textSecondary, fixedWidth: 496 });
  const fl = await col(dr, 'Fields', { gap: 14, sizingH: 'fill' });
  const kv = async (a, b, mono) => { const r = await row(fl, 'Fact ' + a, { sizingH: 'fill', gap: 16 }); await text(r, a, { type: 'small', color: T.textTertiary, fixedWidth: 120 }); if (typeof b === 'string') await text(r, b, { type: mono ? 'mono' : 'body', size: mono ? 13 : 15 }); return r; };
  const rl = await kv('Role', null);
  await k.roleMark(rl, 'Backend', 24);
  await text(rl, 'Backend', { type: 'body' });
  await kv('Branch', 'fix/login-redirect', true);
  await kv('Raised by', 'Product, on Monday');
  await kv('Cost so far', '$0.42 (an estimate)', false);
  await P.line(dr);
  await text(dr, 'What happened', { type: 'heading' });
  const tl = await col(dr, 'Timeline', { gap: 18, sizingH: 'fill' });
  const ev = async (st, a, b) => { const r = await row(tl, 'Event', { gap: 14, crossAlign: 'min', sizingH: 'fill' }); await k.glyph(r, st, 18, T[st]); const m = await col(r, 'Text', { gap: 2, sizingH: 'fill' }); await text(m, a, { type: 'body' }); await text(m, b, { type: 'small', color: T.textTertiary }); };
  await ev('waiting', 'Backend asks to run a command', '14 minutes ago');
  await ev('live', 'Backend started a session', '31 minutes ago \u00b7 branch made');
  await ev('idle', 'Product raised this ticket', 'Monday');
  await S.spacer(dr);
  const ft = await row(dr, 'Footer', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  await P.button(ft, 'Move to Review', { variant: 'quiet' });
  await I.button(ft, 'open-session', '1 Sessions / Chat');
}

for (const [n, id] of [['screen-chat', A], ['screen-chat-yes', A2], ['screen-chat-no', A3], ['screen-changes', B], ['screen-board', C], ['screen-ticket', D]]) await k.shot([id], OUT + n + '.png', 1);
console.log('screens 2a built', A, B, C, D);
f.close();
