import { connect } from './fig.mjs';
import { makeKit, T, tint } from './kona-lib.mjs';
import { makeParts } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';
import { makeShell } from './kona-shell.mjs';
import { makeInteractive } from './kona-interactive.mjs';
import { ROLES, MODE_WORDS } from './kona-lib.mjs';

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
const { text, row, col, frame, rect, ellipse, vec } = k;
const only = process.argv[2];

// ============================================================ 5. Files
if (!only || only === 'files') {
  const A = await S.screen('5 Files', 0, 6000);
  await S.sidebar(A, 'Files');
  await S.vrule(A);
  const tree = await frame(A, 'Tree panel', { layout: 'vertical', sizingH: 'fixed', width: 320, sizingV: 'fill', padding: [26, 12, 18, 12], gap: 14 });
  const th = await row(tree, 'Head', { sizingH: 'fill', padding: [0, 8, 0, 8], mainAlign: 'spaceBetween' });
  await text(th, 'Files', { type: 'heading' });
  await text(th, 'shop-api', { type: 'mono', color: T.textTertiary });
  const sf = await row(tree, 'Search files', { gap: 10, padding: [0, 12, 0, 12], height: 36, sizingH: 'fill', sizingV: 'fixed', fill: T.inset, cornerRadius: 10, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside' });
  await Q.icon2(sf, 'search', 16, T.textTertiary);
  await text(sf, 'Find a file', { type: 'body', size: 14, color: T.textTertiary });
  const tl = await col(tree, 'Tree', { gap: 1, sizingH: 'fill' });
  const W = 296;
  await Q.treeRow(tl, { kind: 'folder', name: 'app', open: true, width: W });
  await Q.treeRow(tl, { kind: 'folder', name: 'Http', open: true, depth: 1, width: W });
  await Q.treeRow(tl, { name: 'AuthController.php', depth: 2, selected: true, note: 'edited', noteColor: T.waiting, width: W });
  await Q.treeRow(tl, { name: 'Kernel.php', depth: 2, width: W });
  await Q.treeRow(tl, { kind: 'folder', name: 'Payments', depth: 1, width: W });
  await Q.treeRow(tl, { kind: 'folder', name: 'config', width: W });
  await Q.treeRow(tl, { name: 'session.php', depth: 1, note: 'edited', noteColor: T.waiting, width: W });
  await Q.treeRow(tl, { kind: 'folder', name: 'routes', open: true, width: W });
  await Q.treeRow(tl, { name: 'auth.php', depth: 1, note: 'edited', noteColor: T.waiting, width: W });
  await Q.treeRow(tl, { name: 'web.php', depth: 1, width: W });
  await Q.treeRow(tl, { kind: 'folder', name: 'tests', width: W });
  await Q.treeRow(tl, { name: 'composer.json', width: W });
  await Q.treeRow(tl, { name: 'README.md', width: W });
  await S.spacer(tree);
  await text(tree, '“edited” marks files an agent changed.', { type: 'small', color: T.textTertiary, sizingH: 'fill' });
  await S.vrule(A);
  const main = await frame(A, 'Viewer', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  const tabs = await row(main, 'Open files', { gap: 4, padding: [18, 20, 0, 20], sizingH: 'fill', crossAlign: 'max' });
  for (const [n, on] of [['AuthController.php', true], ['session.php', false]]) {
    const t = await row(tabs, 'File tab / ' + n, { gap: 10, padding: [0, 14, 0, 14], height: 40, sizingV: 'fixed', fill: on ? T.surface1 : 'none', cornerRadius: [10, 10, 0, 0], stroke: on ? T.borderSubtle : 'none', strokeWeight: 1, strokeAlign: 'inside' });
    await text(t, n, { type: on ? 'bodyStrong' : 'body', size: 14, color: on ? T.text : T.textTertiary });
    await Q.icon2(t, 'close', 14, T.textTertiary);
  }
  const crumbs = await row(main, 'Path', { gap: 10, padding: [14, 32, 14, 32], sizingH: 'fill', mainAlign: 'spaceBetween', fill: T.surface1 });
  await text(crumbs, 'app / Http / AuthController.php', { type: 'mono', size: 13, color: T.textSecondary });
  const ca = await row(crumbs, 'Actions', { gap: 8 });
  await P.button(ca, 'Show changes', { variant: 'ghost', size: 'sm' });
  await P.button(ca, 'Open in VS Code', { variant: 'ghost', size: 'sm' });
  const code = await col(main, 'Code', { gap: 0, padding: [14, 0, 14, 0], sizingH: 'fill', sizingV: 'fill', fill: T.surface1 });
  const L = (n, segs, o) => Q.codeLine(code, n, segs, o);
  await L(1, [['kw', '<?php']]);
  await L(2, [['plain', '']]);
  await L(3, [['kw', 'namespace '], ['plain', 'App\\Http\\Controllers;']]);
  await L(4, [['plain', '']]);
  await L(5, [['kw', 'use '], ['plain', 'Illuminate\\Http\\Request;']]);
  await L(6, [['kw', 'use '], ['plain', 'Illuminate\\Support\\Facades\\Auth;']]);
  await L(7, [['plain', '']]);
  await L(8, [['kw', 'class '], ['plain', 'AuthController extends Controller']]);
  await L(9, [['plain', '{']]);
  await L(10, [['kw', '    public function '], ['plain', 'login(Request $request)']]);
  await L(11, [['plain', '    {']]);
  await L(12, [['plain', '        $ok = Auth::attempt($request->only('], ['str', "'email'"], ['plain', ', '], ['str', "'password'"], ['plain', '));']]);
  await L(13, [['plain', '']]);
  await L(14, [['com', '        // the session must be saved before we redirect']], { highlight: true });
  await L(15, [['plain', '        $request->session()->save();']], { highlight: true });
  await L(16, [['kw', '        return '], ['plain', "redirect('/home');"]], { highlight: true });
  await L(17, [['plain', '    }']]);
  await L(18, [['plain', '}']]);
  await S.spacer(code);
  const st = await row(main, 'Status', { gap: 20, padding: [10, 32, 10, 32], sizingH: 'fill', fill: T.ground });
  await text(st, 'PHP', { type: 'mono', color: T.textTertiary });
  await text(st, '18 lines', { type: 'mono', color: T.textTertiary });
  await text(st, 'Changed by Backend 14 min ago \u00b7 lines 14 to 16', { type: 'small', color: T.textTertiary });
  await k.shot([A], OUT + 'screen-files.png', 1);
}

// ============================================================ 6. Worktrees
if (!only || only === 'wt') {
  const A = await S.screen('6 Worktrees', 0, 7000);
  await S.sidebar(A, 'Worktrees');
  await S.vrule(A);
  const main = await frame(A, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  const { actions } = await S.pageHeader(main, 'Worktrees', 'Each agent works in its own copy of the project, so two of them never overwrite each other.');
  await P.button(actions, 'Remove finished ones', { variant: 'quiet', size: 'sm' });
  const body = await row(main, 'Body', { gap: 28, padding: [0, 32, 28, 32], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });
  // graph card
  const card = await row(body, 'Graph card', { gap: 0, padding: [10, 18, 10, 6], sizingH: 'fixed', width: 700, sizingV: 'hug', fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', crossAlign: 'min' });
  const RH = 56, GW = 150;
  const rows = [
    { lane: 2, role: 'QA', msg: 'Verify the webhook signature', tag: 'check/webhook', st: 'live', age: '3 min' },
    { lane: 1, role: 'Backend', msg: 'Save the session before the redirect', tag: 'fix/login-redirect', st: 'waiting', age: '14 min', sel: true },
    { lane: 1, role: 'Backend', msg: 'Add a failing login test', st: null, age: '31 min' },
    { lane: 2, role: 'QA', msg: 'Log every webhook call', st: null, age: '1 h' },
    { lane: 0, role: 'DevOps', msg: 'Move the staging database', tag: 'main', st: 'done', age: 'yesterday' },
    { lane: 0, role: 'QA', msg: 'Cache the product list', st: null, age: 'yesterday' },
    { lane: 0, role: 'Backend', msg: 'Fix the cart total', st: null, age: 'Monday' },
  ];
  const X = [26, 66, 106];
  const gf = await frame(card, 'Graph', {}, { width: GW, height: RH * rows.length });
  const Y = (i) => i * RH + RH / 2;
  const lineC = [T.borderStrong, T.textTertiary, T.textTertiary];
  const lane = async (l, a, b, color, w = 2) => vec(gf, 'Lane ' + l, `M${X[l]} ${Y(a)} L${X[l]} ${Y(b)}`, { stroke: color, strokeWeight: w });
  const curve = async (l1, i1, l2, i2, color) => vec(gf, 'Fork', `M${X[l1]} ${Y(i1)} C${X[l1]} ${Y(i2)} ${X[l2]} ${Y(i1)} ${X[l2]} ${Y(i2)}`, { stroke: color, strokeWeight: 2 });
  await lane(0, 4, 6, lineC[0]);
  await lane(1, 1, 2, T.accent);
  await lane(2, 0, 3, T.textTertiary);
  await curve(1, 2, 0, 4, T.accent);
  await curve(2, 3, 0, 5, T.textTertiary);
  const nodeShape = async (role, x, y, color, filled) => {
    const g = await frame(gf, 'Node / ' + role, {}, { x: x - 10, y: y - 10, width: 20, height: 20 });
    const bgc = T.surface1;
    if (role === 'Product') await ellipse(g, 's', 14, 14, { fill: bgc, stroke: color, strokeWeight: 2.2, strokeAlign: 'inside' }, { x: 3, y: 3 });
    if (role === 'Backend') await rect(g, 's', 13, 13, { fill: filled ? color : bgc, stroke: color, strokeWeight: 2, strokeAlign: 'inside', cornerRadius: 3 }).then((id) => k.call('set_properties', { ids: [id], props: { x: 3.5, y: 3.5 } }));
    if (role === 'QA') await vec(g, 's', 'M10 3.5 L17 16 L3 16 Z', { fill: filled ? color : bgc, stroke: color, strokeWeight: 2 });
    if (role === 'DevOps') await vec(g, 's', 'M10 2.5 L17.5 10 L10 17.5 L2.5 10 Z', { fill: filled ? color : bgc, stroke: color, strokeWeight: 2 });
  };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const c = r.st === 'live' ? T.accent : r.st === 'waiting' ? T.waiting : r.lane === 0 ? T.textSecondary : T.textTertiary;
    await nodeShape(r.role, X[r.lane], Y(i), r.lane === 1 ? T.accent : c, r.st === 'live' || r.st === 'waiting' || r.sel);
  }
  const lines = await col(card, 'Rows', { gap: 0, sizingH: 'fill' });
  for (const r of rows) {
    const rw = await row(lines, 'Commit', { gap: 12, height: RH, sizingH: 'fill', sizingV: 'fixed', padding: [0, 10, 0, 10], cornerRadius: 10, fill: r.sel ? T.surface3 : 'none' });
    const m = await col(rw, 'Text', { gap: 4, sizingH: 'fill' });
    await text(m, r.msg, { type: 'body', size: 14.5 });
    const sub = await row(m, 'Sub', { gap: 8 });
    await text(sub, r.role, { type: 'small', color: T.textTertiary });
    await text(sub, '\u00b7 ' + r.age, { type: 'small', color: T.textTertiary });
    if (r.tag) await Q.chip(rw, r.tag, { mono: true, color: r.sel ? T.accent : T.textSecondary, bg: r.sel ? tint(T.accent, 14) : T.surface3 });
  }
  // detail
  const det = await col(body, 'Detail', { gap: 18, padding: 24, sizingH: 'fill', fill: T.surface2, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  const dh = await row(det, 'Head', { gap: 12 });
  await k.roleMark(dh, 'Backend', 32);
  const dt = await col(dh, 'Titles', { gap: 2 });
  await text(dt, 'fix/login-redirect', { type: 'monoStrong', size: 15 });
  await text(dt, 'Backend \u00b7 ticket T-0012', { type: 'small', color: T.textTertiary });
  await P.line(det);
  const kv = async (a, b, mono = true) => { const r = await col(det, 'Fact ' + a, { gap: 4, sizingH: 'fill' }); await text(r, a, { type: 'small', color: T.textTertiary }); await text(r, b, { type: mono ? 'mono' : 'body', size: mono ? 13 : 15, sizingH: 'fill' }); };
  await kv('Folder', 'D:\\projects\\shop-api-wt\\fix-login-redirect');
  await kv('Compared with main', '2 commits ahead, 0 behind', false);
  await kv('Changed files', '4', false);
  await P.line(det);
  await Q.alert(det, 'idle', 'Nothing here blocks a merge', 'No other worktree touches these files.', null, { width: 292 });
  await S.spacer(det);
  await P.button(det, 'Open the session', { variant: 'primary', fillWidth: true });
  await P.button(det, 'Merge into main', { variant: 'quiet', fillWidth: true });
  await P.button(det, 'Remove this worktree', { variant: 'ghost', fillWidth: true });
  await k.shot([A], OUT + 'screen-worktrees.png', 1);
}

// ============================================================ 7. Costs
if (!only || only === 'costs') {
  const A = await S.screen('7 Costs', 0, 8000);
  await S.sidebar(A, 'Costs');
  await S.vrule(A);
  const main = await frame(A, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  const { actions } = await S.pageHeader(main, 'Costs', 'Estimates at list price. Your Claude plan covers the real bill.');
  await P.tabsSegmented(actions, ['By role', 'By ticket', 'By project'], 'By role');
  await Q.chip(actions, 'October 2026', {});
  const body = await row(main, 'Body', { gap: 28, padding: [0, 32, 28, 32], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });
  const left = await col(body, 'Left', { gap: 22, sizingH: 'fill' });
  const sum = await row(left, 'Sum', { gap: 16, crossAlign: 'max' });
  await text(sum, '$18.40', { type: 'display', props: {} });
  await text(sum, 'this month in shop-api, an estimate', { type: 'body', color: T.textTertiary });
  const tbl = await col(left, 'Table', { gap: 0, padding: [6, 20, 6, 20], sizingH: 'fill', fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  const th = await row(tbl, 'Head', { gap: 16, padding: [12, 0, 12, 0], sizingH: 'fill' });
  const cell = async (r, str, w, o = {}) => { const c = await row(r, 'Cell', { sizingH: 'fixed', width: w, mainAlign: o.right ? 'max' : 'min' }); await text(c, str, o.mono ? { type: 'mono', color: o.color || T.text } : { type: o.strong ? 'bodyStrong' : 'small', color: o.color || T.textTertiary, size: o.strong ? 15 : undefined }); return c; };
  await cell(th, 'Role', 200); await cell(th, 'Sessions', 80, { right: true }); await cell(th, 'Tokens', 100, { right: true }); await cell(th, 'Share', 140); await cell(th, 'Cost', 90, { right: true });
  await P.line(tbl);
  const data = [['Backend', 9, '1.8M', 33, '$6.10'], ['QA', 14, '0.9M', 20, '$3.70'], ['Frontend', 7, '1.1M', 17, '$3.20'], ['DevOps', 4, '0.7M', 15, '$2.80'], ['Product', 6, '0.3M', 9, '$1.60'], ['Marketing', 3, '0.2M', 6, '$1.00']];
  for (let i = 0; i < data.length; i++) {
    const [role, n, tok, share, cost] = data[i];
    const r = await row(tbl, 'Row / ' + role, { gap: 16, padding: [14, 0, 14, 0], sizingH: 'fill' });
    const c1 = await row(r, 'Role', { gap: 12, sizingH: 'fixed', width: 200 });
    await k.roleMark(c1, role, 28);
    await text(c1, role, { type: 'body' });
    await cell(r, String(n), 80, { right: true, mono: true });
    await cell(r, tok, 100, { right: true, mono: true });
    const sc = await row(r, 'Share', { gap: 10, sizingH: 'fixed', width: 140 });
    await Q.shareBar(sc, share, 70, T.textSecondary);
    await text(sc, share + '%', { type: 'mono', size: 12, color: T.textTertiary });
    await cell(r, cost, 90, { right: true, mono: true });
    if (i < data.length - 1) await P.line(tbl);
  }
  await text(left, 'Design, Security, Content and SEO, and Support had no sessions this month.', { type: 'small', color: T.textTertiary });
  await Q.alert(left, 'idle', 'Sessions started in the terminal or VS Code are not counted', 'Only sessions Kona opened are in this list. Kona does not read older sessions.', null, { width: 719 });
  // right: plan and days
  const right = await col(body, 'Right', { gap: 26, padding: 24, sizingH: 'fixed', width: 380, fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
  await text(right, 'Your plan', { type: 'heading' });
  await P.planBar(right, { label: 'This session', percent: 12, note: 'Resets in 3 h 10 min', width: 332 });
  await P.planBar(right, { label: 'This week', percent: 35, note: 'Resets on Friday', width: 332 });
  await P.line(right);
  await text(right, 'Last 14 days', { type: 'heading' });
  const chart = await frame(right, 'Daily bars', {}, { width: 332, height: 150 });
  const vals = [2, 5, 9, 4, 0, 0, 12, 7, 15, 10, 8, 0, 3, 11];
  for (let i = 0; i < vals.length; i++) {
    const h = Math.max(3, Math.round((vals[i] / 15) * 120));
    await rect(chart, 'Day ' + (i + 1), 16, h, { fill: i === 13 ? T.accent : T.textTertiary, cornerRadius: 3 }).then((id) => k.call('set_properties', { ids: [id], props: { x: 3 + i * 23.5, y: 130 - h } }));
  }
  await rect(chart, 'Base', 332, 1, { fill: T.borderSubtle }).then((id) => k.call('set_properties', { ids: [id], props: { x: 0, y: 134 } }));
  const ax = await row(right, 'Axis', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  await text(ax, '12 Oct', { type: 'mono', size: 12, color: T.textTertiary });
  await text(ax, 'Today \u00b7 $2.10', { type: 'mono', size: 12, color: T.accent });
  await k.shot([A], OUT + 'screen-costs.png', 1);
}

// ============================================================ 8. Roles
if (!only || only === 'roles') {
  const A = await S.screen('8 Roles', 0, 9000, 1440, 1000);
  await S.sidebar(A, 'Roles');
  await S.vrule(A);
  const list = await frame(A, 'Role list', { layout: 'vertical', sizingH: 'fixed', width: 300, sizingV: 'fill', padding: [26, 10, 20, 10], gap: 12 });
  const lh = await row(list, 'Head', { sizingH: 'fill', mainAlign: 'spaceBetween', padding: [0, 10, 0, 10] });
  await text(lh, 'Roles', { type: 'heading' });
  await P.button(lh, 'New role', { variant: 'quiet', size: 'sm', iconName: 'plus' });
  const ll = await col(list, 'List', { gap: 2, sizingH: 'fill' });
  let last = null;
  for (const r of ROLES) {
    if (r.group !== last) {
      last = r.group;
      const gh = await row(ll, 'Group ' + r.group, { padding: [10, 12, 4, 12], sizingH: 'fill' });
      await text(gh, r.group, { type: 'smallStrong', color: T.textTertiary });
    }
    const on = r.key === 'Marketing';
    const rw = await row(ll, 'Role row / ' + r.key, { gap: 12, padding: [0, 12, 0, 12], height: 52, sizingH: 'fill', sizingV: 'fixed', cornerRadius: 12, fill: on ? T.surface3 : 'none' });
    await k.roleMark(rw, r.key, 28);
    const m = await col(rw, 'Text', { gap: 1, sizingH: 'fill' });
    await text(m, r.name, { type: 'body', size: 14.5 });
    await text(m, MODE_WORDS[r.mode], { type: 'small', size: 12.5, color: T.textTertiary });
  }
  await S.vrule(A);
  const ed = await col(A, 'Editor', { gap: 26, padding: [26, 36, 24, 36], sizingH: 'fill', sizingV: 'fill' });
  const eh = await row(ed, 'Head', { gap: 16, sizingH: 'fill', mainAlign: 'spaceBetween' });
  const el = await row(eh, 'Left', { gap: 14 });
  await k.roleMark(el, 'Marketing', 44);
  const et = await col(el, 'Titles', { gap: 2 });
  await text(et, 'Marketing', { type: 'title' });
  await text(et, 'Campaigns, landing pages and launch plans. Used in 3 tickets this week.', { type: 'small', color: T.textTertiary });
  await P.button(eh, 'Save changes', { variant: 'primary', size: 'sm' });
  const two = await row(ed, 'Fields', { gap: 28, sizingH: 'fill', crossAlign: 'min' });
  const c1 = await col(two, 'Left column', { gap: 20, sizingH: 'fill' });
  const c2 = await col(two, 'Right column', { gap: 20, sizingH: 'fill' });
  await text(c1, 'What it may do without asking', { type: 'heading' });
  const modes = await col(c1, 'Modes', { gap: 10, sizingH: 'fill' });
  await Q.modeOption(modes, { title: 'Ask me every time', body: 'Every change and every command shows a card first.', on: true, width: 390 });
  await Q.modeOption(modes, { title: 'Allow edits, ask for commands', body: 'Files change freely. Commands wait for your answer.', width: 390 });
  await Q.modeOption(modes, { title: 'Let Claude decide', body: 'Claude’s own checker approves safe steps and asks about risky ones.', width: 390 });
  await Q.modeOption(modes, { title: 'Plan only', body: 'Reads and writes a plan. Changes nothing.', width: 390 });
  await text(c1, 'Claude setting behind this choice: default', { type: 'mono', size: 12, color: T.textTertiary });
  await text(c2, 'Skills it can use', { type: 'heading' });
  const sk = await row(c2, 'Skills', { gap: 8 });
  await Q.chip(sk, 'copywriting'); await Q.chip(sk, 'seo-check'); await Q.chip(sk, 'humanize');
  await P.button(sk, 'Add', { variant: 'ghost', size: 'sm', iconName: 'plus' });
  await P.line(c2);
  await text(c2, 'Tools it can reach (MCP servers)', { type: 'heading' });
  const mc = await col(c2, 'MCP', { gap: 14, sizingH: 'fill' });
  for (const [n, on, d] of [['Browser', true, 'Open pages and take screenshots'], ['Search statistics, read only', true, 'See which words bring visitors'], ['Social posting', false, 'Publish posts. Off until you turn it on']]) {
    const r = await row(mc, 'MCP / ' + n, { gap: 14, sizingH: 'fill', mainAlign: 'spaceBetween' });
    const m = await col(r, 'Text', { gap: 2 });
    await text(m, n, { type: 'body' });
    await text(m, d, { type: 'small', color: T.textTertiary });
    await Q.toggle(r, on, null);
  }
  await P.line(c2);
  await text(c2, 'Programs this role needs on the PC', { type: 'heading' });
  const nd = await col(c2, 'Needs', { gap: 12, sizingH: 'fill' });
  for (const [n, st, w] of [['Node', 'done', 'found'], ['Chrome', 'done', 'found'], ['ImageMagick', 'left', 'not found. Kona can show how to install it']]) {
    const r = await row(nd, 'Need / ' + n, { gap: 12 });
    await k.glyph(r, st, 18, T[st]);
    await text(r, n, { type: 'body' });
    await text(r, w, { type: 'small', color: st === 'left' ? T.left : T.textTertiary });
  }
  await k.shot([A], OUT + 'screen-roles.png', 1);
}

console.log('screens 2b built');
f.close();
