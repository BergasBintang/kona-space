import { connect } from './fig.mjs';
import { makeKit, T, tint } from './kona-lib.mjs';
import { makeParts } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';

const OUT = decodeURIComponent(new URL('./build-output/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); // screenshots go here (ignored by Git)
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
const Q = makeParts2(k, P);
{ const d = (await f.tool('inspect_document', { depth: 0, allPages: true })).json; await f.run('page.select', { id: d.pages.find((x) => x.name === 'Parts').id }); }

const page = await k.frame(undefined, 'Kona parts, second batch', {
  x: 1600, y: 0, width: 1440, layout: 'vertical', gap: 72, padding: [72, 80, 88, 80],
  fill: T.ground, sizingH: 'fixed', sizingV: 'hug', crossAlign: 'min',
});
const head = await k.col(page, 'Title block', { gap: 12 });
await k.text(head, 'Kona base parts, second batch', { type: 'display' });
await k.text(head, 'The rest of the small parts the screens are made from: icons, switches and boxes, chips, tooltip, toast and alert, file tree rows, code and changes lines, the ticket card, the terminal pane, the command palette and the permission mode choice. Built only from the tokens.', { type: 'body', color: T.textSecondary, fixedWidth: 820 });

async function section(title, note) {
  const s = await k.col(page, title, { gap: 24, sizingH: 'fill' });
  const h = await k.col(s, title + ' heading', { gap: 6 });
  await k.text(h, title, { type: 'title' });
  if (note) await k.text(h, note, { type: 'small', color: T.textTertiary, fixedWidth: 820 });
  return k.col(s, title + ' specimens', { gap: 28, padding: 32, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', sizingH: 'fill' });
}
const cap = (parent, s) => k.text(parent, s, { type: 'small', color: T.textTertiary });

// 1. Icons
{
  const c = await section('Icons', 'A 16 px grid, 1.75 px stroke, round ends. An icon always sits beside a word, except the close mark, which has a tooltip.');
  const r = await k.row(c, 'Icon row', { gap: 36 });
  for (const kind of ['chat', 'board', 'folder', 'file', 'branch', 'coin', 'roles', 'brain', 'gear', 'search', 'terminal', 'key', 'flag', 'chevronR', 'chevronD', 'close']) {
    const cl = await k.col(r, kind, { gap: 10, crossAlign: 'center' });
    await Q.icon2(cl, kind, 24, T.text);
    await cap(cl, kind);
  }
}

// 2. Choice controls
{
  const c = await section('Switch, box and round choice', 'On is the accent. Off is a quiet track with a strong edge. Each has a word beside it.');
  const r = await k.row(c, 'Row', { gap: 64, crossAlign: 'min' });
  const a = await k.col(r, 'Switch', { gap: 16 });
  await cap(a, 'Switch');
  await Q.toggle(a, true, 'Ask me before Claude runs a command');
  await Q.toggle(a, false, 'Keep this window on top');
  const b = await k.col(r, 'Checkbox', { gap: 16 });
  await cap(b, 'Box');
  await Q.checkbox(b, true, 'Read files');
  await Q.checkbox(b, true, 'Change files');
  await Q.checkbox(b, false, 'Run commands');
  const d = await k.col(r, 'Radio', { gap: 16 });
  await cap(d, 'Round choice');
  const d1 = await k.row(d, 'a', { gap: 12 }); await Q.radio(d1, true); await k.text(d1, 'Ask every time', { type: 'body' });
  const d2 = await k.row(d, 'b', { gap: 12 }); await Q.radio(d2, false); await k.text(d2, 'Let Claude decide', { type: 'body' });
}

// 3. Chips, keys, tooltip
{
  const c = await section('Chip, key and tooltip', 'A chip is a small fact. A key shows a shortcut. A tooltip names an icon-only button.');
  const r = await k.row(c, 'Row', { gap: 28 });
  await Q.chip(r, 'Laravel');
  await Q.chip(r, 'T-0012', { mono: true });
  await Q.chip(r, 'From the terminal', { color: T.idle, bg: tint(T.idle, 14) });
  await Q.chip(r, 'From VS Code', { color: T.idle, bg: tint(T.idle, 14) });
  await Q.keys(r, ['Ctrl', 'K']);
  await Q.tooltip(r, 'Close this tab', ['Ctrl', 'W']);
}

// 4. Alerts and toasts
{
  const c = await section('Alert and toast', 'An alert stays in the page and says what happened and what to do. A toast floats for a few seconds and never carries the only copy of an error.');
  const r = await k.row(c, 'Row', { gap: 32, crossAlign: 'min' });
  const a = await k.col(r, 'Alerts', { gap: 14 });
  await Q.alert(a, 'waiting', 'You are close to the weekly limit', 'About 85 percent is used. It resets on Friday.', null, { width: 600 });
  await Q.alert(a, 'left', 'The login on this PC has expired', 'Sign in again so sessions can start.', 'Sign in', { width: 600 });
  await Q.alert(a, 'done', 'The branch is merged', 'fix/login-redirect is in main. The worktree can go.', 'Remove worktree', { width: 600 });
  await Q.alert(a, 'idle', 'This ticket is not assigned to a role yet', 'Pick a role and Kona will open a session for it.', null, { width: 600 });
  const b = await k.col(r, 'Toasts', { gap: 14 });
  await Q.toast(b, 'done', 'Backend finished', 'Fix the login redirect \u00b7 $0.42', 'Open', { width: 420 });
  await Q.toast(b, 'waiting', 'QA needs an answer', 'Check payment webhook', 'Answer', { width: 420 });
}

// 5. File tree and code
{
  const c = await section('File tree row, code lines and changes lines', 'Names are plain text. Notes beside a file are mono. A changed line carries a plus or minus sign, so colour is never the only signal.');
  const r = await k.row(c, 'Row', { gap: 48, crossAlign: 'min' });
  const t = await k.col(r, 'Tree', { gap: 2, padding: 8, fill: T.surface1, cornerRadius: 12, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  await Q.treeRow(t, { kind: 'folder', name: 'app', open: true, width: 280 });
  await Q.treeRow(t, { kind: 'folder', name: 'Http', open: true, depth: 1, width: 280 });
  await Q.treeRow(t, { name: 'AuthController.php', depth: 2, selected: true, note: 'edited', noteColor: T.waiting, width: 280 });
  await Q.treeRow(t, { name: 'Kernel.php', depth: 2, width: 280 });
  await Q.treeRow(t, { kind: 'folder', name: 'routes', depth: 0, width: 280 });
  await Q.treeRow(t, { name: 'composer.json', width: 280 });
  const right = await k.col(r, 'Code', { gap: 20 });
  const cb = await k.col(right, 'Code block', { gap: 0, padding: [10, 0, 10, 0], width: 640, sizingH: 'fixed', fill: T.inset, cornerRadius: 12, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  await Q.codeLine(cb, 12, [['kw', 'public function '], ['plain', 'login(Request $request)']]);
  await Q.codeLine(cb, 13, [['plain', '{']]);
  await Q.codeLine(cb, 14, [['plain', '    $ok = Auth::attempt($request->only('], ['str', "'email'"], ['plain', ', '], ['str', "'password'"], ['plain', '));']], { highlight: true });
  await Q.codeLine(cb, 15, [['com', '    // the session must be saved before we redirect']]);
  await Q.codeLine(cb, 16, [['kw', '    return '], ['plain', "redirect('/home');"]]);
  const df = await k.col(right, 'Changes', { gap: 0, padding: [10, 0, 10, 0], width: 640, sizingH: 'fixed', fill: T.inset, cornerRadius: 12, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  await Q.diffLine(df, ' ', 12, 12, 'public function login(Request $request)');
  await Q.diffLine(df, '-', 14, null, '    return redirect(\'/home\');');
  await Q.diffLine(df, '+', null, 14, '    $request->session()->save();');
  await Q.diffLine(df, '+', null, 15, '    return redirect(\'/home\');');
}

// 6. Ticket card
{
  const c = await section('Ticket card', 'A card is a thing you can open. It shows the ticket number in mono, the title, who holds it and its state. A card that needs an answer gets an amber edge and the words \u201cWaiting on you\u201d.');
  const r = await k.row(c, 'Row', { gap: 24, crossAlign: 'min' });
  await Q.kanbanCard(r, { id: 'T-0012', title: 'Fix the login redirect', role: 'Backend', flag: true, branch: 'fix/login-redirect' });
  await Q.kanbanCard(r, { id: 'T-0014', title: 'Check the payment webhook', role: 'QA', state: 'live', cost: '$0.08' });
  await Q.kanbanCard(r, { id: 'T-0015', title: 'Plan the invoice export', state: null, note: 'No role yet.', cost: null });
  await Q.kanbanCard(r, { id: 'T-0009', title: 'Move the staging database', role: 'DevOps', state: 'done', selected: true });
}

// 7. Terminal pane
{
  const c = await section('Terminal pane', 'Real command output in mono on the inset surface. The accent marks what you typed.');
  await Q.terminal(c, [
    ['prompt', 'php artisan test --filter=Login'],
    ['dim', 'Running 6 tests'],
    ['plain', '  PASS  Tests\\Feature\\LoginTest'],
    ['err', '  FAIL  Tests\\Feature\\RedirectTest'],
    ['dim', 'Tests: 1 failed, 5 passed'],
  ], { width: 760 });
}

// 8. Command palette
{
  const c = await section('Command palette', 'Opens with Ctrl and K. One field, results in two short groups, the three keys that matter at the bottom.');
  await Q.palette(c, { width: 680 });
}

// 9. Permission mode choice
{
  const c = await section('Permission mode choice', 'A role keeps one of these. Words say what Claude may do without asking. The exact Claude setting is shown small on the right in the editor, never as the label.');
  const r = await k.col(c, 'Options', { gap: 12 });
  await Q.modeOption(r, { title: 'Ask me every time', body: 'Every change and every command shows a card first. Reading files is allowed.', on: false, width: 640 });
  await Q.modeOption(r, { title: 'Allow edits, ask for commands', body: 'Claude changes files freely. Commands wait for your answer.', on: true, width: 640 });
  await Q.modeOption(r, { title: 'Let Claude decide', body: 'Claude\u2019s own checker approves safe steps and asks you about risky ones.', on: false, width: 640 });
  await Q.modeOption(r, { title: 'Plan only', body: 'Claude reads and writes a plan. It changes nothing.', on: false, width: 640 });
}

await k.shot([page], OUT + 'parts2.png', 1, 4000);
console.log('parts2 built', page);
f.close();
