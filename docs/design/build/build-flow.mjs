// The first-run flow (F1 to F5) and the screens that show a state (empty, loading, signed out).
import { connect } from './fig.mjs';
import { makeKit, T, tint, SHADOW_OVERLAY, ROLES } from './kona-lib.mjs';
import { makeParts, STATE_WORD } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';
import { makeShell } from './kona-shell.mjs';
import { makeInteractive, SESSIONS } from './kona-interactive.mjs';

const OUT = decodeURIComponent(new URL('./build-output/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); // screenshots go here (ignored by Git)
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
const Q = makeParts2(k, P);
const I = makeInteractive(k, P, Q, f);
const S = makeShell(k, P, Q, I);
{ const d = (await f.tool('inspect_document', { depth: 0, allPages: true })).json; await f.run('page.select', { id: d.pages.find((x) => x.name === 'Screens').id }); }
const { text, row, col, frame, rect } = k;
const after = (ms, dest) => ({ trigger: { type: 'afterDelay', ms }, action: { type: 'navigate', destKey: dest }, transition: { type: 'dissolve' }, durationMs: 200 });

// a centred card used by the checks screens
async function checksScreen(name, y, o) {
  const A = await S.screen(name, 0, y);
  const main = await frame(A, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', mainAlign: 'center', crossAlign: 'center', gap: 32 });
  const w = await row(main, 'Wordmark', { gap: 12 });
  await k.glyph(w, 'live', 28, T.accent);
  await text(w, 'Kona', { type: 'title' });
  const head = await col(main, 'Head', { gap: 10, sizingH: 'fixed', width: 600 });
  await text(head, o.title, { type: 'display', fixedWidth: 600 });
  await text(head, o.body, { type: 'body', color: T.textSecondary, fixedWidth: 600 });
  const card = await col(main, 'Checks', { gap: 0, padding: [6, 24, 6, 24], sizingH: 'fixed', width: 600, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  for (let i = 0; i < o.checks.length; i++) {
    const [st, a, b] = o.checks[i];
    const r = await row(card, a, { gap: 12, padding: [16, 0, 16, 0], sizingH: 'fill' });
    await k.glyph(r, st, 18, T[st]);
    await text(r, a, { type: 'body', sizingH: 'fill' });
    await text(r, b, { type: 'small', color: st === 'left' ? T.left : T.textTertiary });
    if (i < o.checks.length - 1) await P.line(card);
  }
  if (o.alert) await Q.alert(main, o.alert[0], o.alert[1], o.alert[2], null, { width: 600 });
  if (o.buttons) { const br = await row(main, 'Actions', { gap: 12 }); await o.buttons(br); }
  return A;
}

// ---------------------------------------------------------------- F1 Welcome
const F1 = await S.screen('F1 Welcome', 0, 0);
{
  const main = await frame(F1, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', mainAlign: 'center', crossAlign: 'center', gap: 36 });
  const w = await row(main, 'Wordmark', { gap: 16 });
  await k.glyph(w, 'live', 56, T.accent);
  await text(w, 'Kona', { type: 'display', size: 48, lh: 56 });
  const c = await col(main, 'Words', { gap: 14, sizingH: 'fixed', width: 620, crossAlign: 'center' });
  await text(c, 'A quiet place to run Claude Code.', { type: 'display', align: 'center', fixedWidth: 620 });
  await text(c, 'Kona keeps your projects, sessions, tickets and costs in one window. It tells you in plain words what Claude wants to do, and waits for your answer.', { type: 'body', color: T.textSecondary, align: 'center', fixedWidth: 560 });
  await I.button(main, 'check-pc', 'F2 Checking this PC');
  await text(main, 'Everything stays on this PC. Kona uses the Claude login you already have.', { type: 'small', color: T.textTertiary });
}

// ---------------------------------------------------------------- F2 Checking
const F2 = await checksScreen('F2 Checking this PC', 1000, {
  title: 'Checking this PC',
  body: 'This takes a few seconds. Kona only looks. It changes nothing.',
  checks: [['done', 'Claude Code is installed', 'found on this PC'], ['live', 'You are signed in', 'checking'], ['idle', 'Git is installed', 'waiting'], ['idle', 'Node is installed', 'waiting']],
});
I.screenKeys(F2, [after(1600, 'F2c Checks passed')]);

// ---------------------------------------------------------------- F2c Passed
await checksScreen('F2c Checks passed', 2000, {
  title: 'Everything is ready',
  body: 'You are signed in with your Claude account. Next, tell Kona where your first project lives.',
  checks: [['done', 'Claude Code is installed', 'found on this PC'], ['done', 'You are signed in', 'Pro plan'], ['done', 'Git is installed', 'found'], ['done', 'Node is installed', 'found']],
  buttons: async (r) => { await I.button(r, 'continue', 'F3 Add your first project'); },
});

// ---------------------------------------------------------------- F2b Claude missing
await checksScreen('F2b Claude is missing', 3000, {
  title: 'Claude Code is not installed',
  body: 'Kona runs sessions through Claude Code, so it needs it on this PC.',
  checks: [['left', 'Claude Code is installed', 'not found'], ['idle', 'You are signed in', 'not checked'], ['idle', 'Git is installed', 'not checked'], ['idle', 'Node is installed', 'not checked']],
  alert: ['left', 'Install Claude Code, then check again', 'Kona can open the install page for you. It will not install anything by itself.'],
  buttons: async (r) => { await I.button(r, 'open-install', null); await I.button(r, 'check-again', 'F2 Checking this PC'); },
});

// ---------------------------------------------------------------- F2e Not signed in
await checksScreen('F2e Not signed in', 4000, {
  title: 'You are not signed in',
  body: 'Claude Code is here, but it has no login. Sign in once and Kona will use it.',
  checks: [['done', 'Claude Code is installed', 'found on this PC'], ['left', 'You are signed in', 'no login found'], ['idle', 'Git is installed', 'not checked'], ['idle', 'Node is installed', 'not checked']],
  alert: ['waiting', 'Sign in with your Claude account', 'Kona opens the sign-in page in your browser. Kona never sees your password.'],
  buttons: async (r) => { await I.button(r, 'sign-in', null); await I.button(r, 'check-again', 'F2 Checking this PC'); },
});

// ---------------------------------------------------------------- F3 Add your first project
const F3 = await S.screen('F3 Add your first project', 0, 5000);
{
  await S.sidebar(F3, null, { noProject: true });
  await S.vrule(F3);
  const main = await frame(F3, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', mainAlign: 'center', crossAlign: 'center', gap: 40 });
  const c = await col(main, 'Empty state', { gap: 20, sizingH: 'fixed', width: 560 });
  await text(c, 'Add your first project', { type: 'display' });
  await text(c, 'A project is one folder on this PC. Kona keeps its notes, tickets and sessions inside it, in a hidden folder that Git ignores.', { type: 'body', color: T.textSecondary, fixedWidth: 560 });
  await I.button(c, 'add-a-project', '14 Add project');
  const card = await col(main, 'Checks', { gap: 0, padding: [6, 24, 6, 24], sizingH: 'fixed', width: 560, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  const checks = [['done', 'Claude is installed', 'found on this PC'], ['done', 'You are signed in', 'with your Claude login'], ['idle', 'No project yet', 'add one above']];
  for (let i = 0; i < checks.length; i++) {
    const [st, a, b] = checks[i];
    const r = await row(card, a, { gap: 12, padding: [16, 0, 16, 0], sizingH: 'fill' });
    await k.glyph(r, st, 18, T[st]);
    await text(r, a, { type: 'body', sizingH: 'fill' });
    await text(r, b, { type: 'small', color: T.textTertiary });
    if (i < checks.length - 1) await P.line(card);
  }
}

// ---------------------------------------------------------------- F4 Creating the project
const F4 = await S.screen('F4 Creating the project', 0, 6000);
{
  await S.sidebar(F4, null, { noProject: true });
  await S.vrule(F4);
  const dim = await col(F4, 'Scrim', { sizingH: 'fill', sizingV: 'fill', padding: [160, 0, 0, 0], crossAlign: 'center', fill: '#05080A99' });
  const d = await col(dim, 'Setting up dialog', { gap: 22, padding: 28, sizingH: 'fixed', width: 560, fill: T.surface2, cornerRadius: 18, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', effects: SHADOW_OVERLAY });
  await text(d, 'Setting up shop-api', { type: 'heading' });
  const st = await col(d, 'Steps', { gap: 16, sizingH: 'fill' });
  for (const [s, a, b] of [['done', 'Folder found', 'D:\\projects\\shop-api'], ['done', 'Hidden folder made for notes and tickets', '.kona'], ['done', 'Git told to ignore it', ''], ['live', 'Reading the project', 'Laravel, PHP 8.3'], ['idle', 'Getting your team of ten roles ready', '']]) {
    const r = await row(st, 'Step', { gap: 12, sizingH: 'fill' });
    await k.glyph(r, s, 18, T[s]);
    await text(r, a, { type: 'body', sizingH: 'fill', color: s === 'idle' ? T.textTertiary : T.text });
    if (b) await text(r, b, { type: 'mono', size: 12.5, color: T.textTertiary });
  }
  await P.planBar(d, { label: 'Setting up', percent: 60, width: 504 });
}
I.screenKeys(F4, [after(1800, 'F5 Project ready')]);

// ---------------------------------------------------------------- F5 Project ready
const F5 = await S.screen('F5 Project ready', 0, 7000);
{
  await S.sidebar(F5, 'Sessions', { badges: false });
  await S.vrule(F5);
  const main = await frame(F5, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', mainAlign: 'center', crossAlign: 'center', gap: 44 });
  const c = await col(main, 'Empty state', { gap: 20, sizingH: 'fixed', width: 640 });
  await text(c, 'shop-api is ready', { type: 'display' });
  await text(c, 'Nothing is running yet. Start a session for one of your roles, or open the board and make a ticket first.', { type: 'body', color: T.textSecondary, fixedWidth: 640 });
  const br = await row(c, 'Actions', { gap: 12 });
  await I.button(br, 'start-a-session', '13 New session');
  await I.button(br, 'go-board', '3 Board');
  const team = await col(main, 'Team', { gap: 0, padding: [20, 24, 20, 24], sizingH: 'fixed', width: 640, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  const th = await row(team, 'Head', { sizingH: 'fill', mainAlign: 'spaceBetween', padding: [0, 0, 16, 0] });
  await text(th, 'Your team is ready', { type: 'bodyStrong' });
  await I.button(th, 'see-team', '8 Roles');
  const grid = await frame(team, 'Roles', { layout: 'horizontal', wrap: true, gap: 16, crossGap: 18, sizingH: 'fill', sizingV: 'hug' });
  for (const r of ROLES) {
    const it = await row(grid, 'Role / ' + r.key, { gap: 10, sizingH: 'fixed', width: 176 });
    await k.roleMark(it, r.key, 28);
    await text(it, r.name, { type: 'small', size: 14, color: T.textSecondary });
  }
}

// ---------------------------------------------------------------- state screens
const S1 = await S.screen('S1 Board, empty', 0, 8000);
{
  await S.sidebar(S1, 'Board', { badges: false });
  await S.vrule(S1);
  const main = await frame(S1, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  const { actions } = await S.pageHeader(main, 'Board', 'shop-api \u00b7 tickets only for this project');
  await P.button(actions, 'New ticket', { variant: 'primary', size: 'sm', iconName: 'plus' });
  const cols = await row(main, 'Columns', { gap: 12, padding: [0, 28, 0, 28], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });
  for (const [n, h] of [['Backlog', 'Ideas and things to do later.'], ['Ready', 'Clear enough to start.'], ['In progress', 'A role is working on it.'], ['Review', 'Waiting for a check.'], ['Done', 'Finished and merged.']]) {
    const c = await Q.kanbanColumn(cols, n, 0, 680, { width: 216, hint: h });
    if (n === 'Backlog') await Q.emptyNote(c, 'No tickets yet', 'Tickets are work you hand to a role. Make the first one with New ticket.', { width: 192 });
  }
}
const S2 = await S.screen('S2 Sessions, loading', 0, 9000);
{
  await S.sidebar(S2, 'Sessions');
  await S.vrule(S2);
  const lc = await frame(S2, 'Session list', { layout: 'vertical', sizingH: 'fixed', width: 320, sizingV: 'fill', padding: [24, 10, 20, 10], gap: 14 });
  const hd = await row(lc, 'Head', { sizingH: 'fill', mainAlign: 'spaceBetween', padding: [0, 10, 0, 10] });
  await text(hd, 'Sessions', { type: 'heading' });
  await P.button(hd, 'New', { variant: 'quiet', size: 'sm', iconName: 'plus' });
  const list = await col(lc, 'List', { gap: 2, sizingH: 'fill' });
  for (let i = 0; i < 4; i++) await Q.skeletonRow(list, 300);
  await S.vrule(S2);
  const main = await frame(S2, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', padding: [34, 32, 24, 32], gap: 28 });
  const th = await row(main, 'Head', { gap: 16 });
  await k.ellipse(th, 'mark', 44, 44, { fill: T.surface3 });
  await Q.skeletonLines(th, [320, 200], 12);
  await Q.skeletonLines(main, [700, 640, 520], 14);
  await Q.skeletonLines(main, [680, 420], 14);
}
const S3 = await S.screen('S3 Login expired', 0, 10000);
{
  await S.sidebar(S3, 'Sessions');
  await S.vrule(S3);
  await S.sessionColumn(S3);
  await S.vrule(S3);
  const main = await frame(S3, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  await S.sessionHeader(main, { state: 'stopped' });
  await S.sessionTabs(main, 'Chat');
  const tr = await frame(main, 'Transcript', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', padding: [26, 32, 14, 32], gap: 20, crossAlign: 'min' });
  await Q.alert(tr, 'left', 'Your Claude login has expired', 'Sessions cannot start or continue until you sign in again. Your work is saved.', 'Sign in', { width: 790 });
  await text(tr, 'The conversation so far is kept below.', { type: 'small', color: T.textTertiary });
  const user = await row(tr, 'You', { sizingH: 'fill', mainAlign: 'max' });
  const ub = await col(user, 'Your message', { padding: [14, 18, 14, 18], fill: T.surface3, cornerRadius: 16, sizingH: 'fixed', width: 460 });
  await text(ub, 'After I type the right password, the site sends me back to the sign-in page. Can you find out why?', { type: 'body', fixedWidth: 424 });
  await S.spacer(tr);
  const comp = await frame(main, 'Composer host', { layout: 'vertical', padding: [0, 32, 26, 32], sizingH: 'fill', sizingV: 'hug' });
  const cb = await col(comp, 'Composer', { gap: 12, padding: [14, 18, 12, 18], fill: T.surface1, cornerRadius: 16, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', sizingH: 'fill' });
  await text(cb, 'Sign in to send a message.', { type: 'body', color: T.textDisabled });
  const cr = await row(cb, 'Actions', { sizingH: 'fill', mainAlign: 'max' });
  await P.button(cr, 'Send', { variant: 'primary', size: 'sm', iconName: 'send', state: 'disabled' });
}

for (const [n, id] of [['flow-1-welcome', F1], ['flow-2-checking', F2], ['flow-3-add', F3], ['flow-4-creating', F4], ['flow-5-ready', F5], ['state-board-empty', S1], ['state-loading', S2], ['state-login-expired', S3]]) await k.shot([id], OUT + n + '.png', 1);
console.log('flow built');
f.close();
