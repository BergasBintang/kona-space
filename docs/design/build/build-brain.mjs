// The Brain screens (design version 3): a graph of linked notes, with a starter brain, and an honest answer
// to "is this in the brain?". Six screens: 10 Brain (the map), 10a Notes, 10b Report, 10c Ask found,
// 10d Ask partly found, 10e Ask not in the brain.
//   node build-brain.mjs                a normal build step (run-all.sh runs it after build-screens2c)
//   INPLACE=1 node build-brain.mjs      redraw just these screens in an open file: keeps the id of "10 Brain" so the
//                                       links that point at it survive, attaches only the new links, saves
// KONA_SHOTS=<folder> also writes a PNG of each screen there.
import fs from 'node:fs';
import { connect } from './fig.mjs';
import { makeKit, T, tint } from './kona-lib.mjs';
import { makeParts } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';
import { makeShell } from './kona-shell.mjs';
import { makeInteractive } from './kona-interactive.mjs';

const INPLACE = !!process.env.INPLACE;
const SHOTS = process.env.KONA_SHOTS;
const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
const Q = makeParts2(k, P);
const I = makeInteractive(k, P, Q, f);
const S = makeShell(k, P, Q, I);
const { text, row, col, frame, rect, ellipse, vec, glyph, roleMark } = k;
const reg = I.reg;
const doc = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
await f.run('page.select', { id: doc.pages.find((p) => p.name === 'Screens').id });
const knownLinks = new Set(reg.pending.map((p) => p.id)); // links that exist before this run; the rest are new

const CARD = { fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' };
const N = {
  map: '10 Brain', notes: '10a Brain / Notes', report: '10b Brain / Report',
  found: '10c Brain / Ask, found', partly: '10d Brain / Ask, partly', none: '10e Brain / Ask, not in the brain',
};
const COL_X = 6400;

// ---------- screens: new in a normal build, redrawn in place (same id) when INPLACE
async function screen(name, y) {
  if (INPLACE && reg.screens[name]) {
    const id = reg.screens[name];
    const g = (await f.tool('get_node', { id, depth: 40 })).json;
    const old = new Set();
    (function walk(n) { old.add(n.id); (n.children ?? []).forEach(walk); })(g);
    reg.pending = reg.pending.filter((p) => !old.has(p.id));
    I.persist();
    const kids = (g.children ?? []).map((c) => c.id);
    if (kids.length) await f.run('edit.delete', { ids: kids });
    return id;
  }
  const id = await S.screen(name, COL_X, y);
  return id;
}

// ---------- small shared pieces
const layerLabel = { project: 'Project note', starter: 'Starter note', memory: 'Claude memory' };
async function layerChip(parent, layer) {
  if (layer === 'starter') return Q.chip(parent, layerLabel.starter, { color: T.accent, bg: tint(T.accent, 14) });
  if (layer === 'memory') return Q.chip(parent, layerLabel.memory, { color: T.idle, bg: tint(T.idle, 14) });
  return Q.chip(parent, layerLabel.project);
}
// the mark of a layer: filled disc, accent ring, grey ring. The word always sits beside it.
async function layerMark(parent, layer, d = 12) {
  if (layer === 'starter') return ellipse(parent, 'Starter mark', d, d, { fill: tint(T.accent, 16), stroke: T.accent, strokeWeight: 2, strokeAlign: 'inside' });
  if (layer === 'memory') return ellipse(parent, 'Memory mark', d, d, { fill: 'none', stroke: T.textTertiary, strokeWeight: 1.75, strokeAlign: 'inside' });
  return ellipse(parent, 'Project mark', d, d, { fill: T.textSecondary });
}
// a short line sample: solid = written in the note, dashed = guessed by Kona
async function linkSample(parent, guessed, color) {
  const g = await frame(parent, guessed ? 'Link sample / guessed' : 'Link sample / written', {}, { width: 28, height: 24 });
  await vec(g, 'line', 'M0 12 L28 12', { stroke: color || T.textTertiary, strokeWeight: 1.75, ...(guessed ? { dashes: [5, 4] } : {}) });
  return g;
}
async function tabLinks(wrapId, dests) {
  const g = (await f.tool('get_node', { id: wrapId, depth: 3 })).json;
  const found = [];
  (function walk(n) { if (n.name?.startsWith('Tab / ')) found.push(n); (n.children ?? []).forEach(walk); })(g);
  for (const n of found) { const d = dests[n.name.slice(6)]; if (d) I.clickTo(n.id, d); }
}

// the question box and its button (the page's main action; quiet once a question is on screen)
async function askBar(parent, o = {}) {
  const { value, primary = true, label = 'Ask', dest } = o;
  const bar = await row(parent, 'Ask the brain', { gap: 12, padding: [0, 32, 18, 32], sizingH: 'fill' });
  const box = await row(bar, 'Ask field', { gap: 10, padding: [0, 16, 0, 14], height: 44, sizingH: 'fill', sizingV: 'fixed', fill: T.inset, cornerRadius: 10, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside' });
  await Q.icon2(box, 'search', 16, T.textSecondary);
  await text(box, value ?? 'Ask the brain. For example: how do I run two agents at once?', { type: 'body', color: value ? T.text : T.textTertiary, sizingH: 'fill' });
  if (value) await Q.icon2(box, 'close', 16, T.textTertiary);
  const b = await P.button(bar, label, { variant: primary ? 'primary' : 'quiet', size: 'md' });
  if (dest) I.clickTo(b, dest);
  return b;
}
async function header(main, sub, closeTo) {
  const { actions } = await S.pageHeader(main, 'Brain', sub);
  if (closeTo) await I.button(actions, 'close-ghost', closeTo);
  else await P.button(actions, 'Write a note', { variant: 'quiet', size: 'sm', iconName: 'plus' });
  return actions;
}
async function tabs(main, active) {
  const host = await frame(main, 'Tabs host', { layout: 'vertical', padding: [0, 32, 0, 32], sizingH: 'fill', sizingV: 'hug' });
  const wrap = await P.tabsUnderline(host, [{ label: 'Map' }, { label: 'Notes', count: 62 }, { label: 'Report', count: 4, attention: true }], active, { width: 1128 });
  await tabLinks(wrap, { Map: N.map, Notes: N.notes, Report: N.report });
  return host;
}
async function shell(name, y, active = 'Brain') {
  const A = await screen(name, y);
  await S.sidebar(A, active);
  await S.vrule(A);
  const main = await frame(A, 'Main', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill', gap: 0 });
  return { A, main };
}
const card = (parent, name, o = {}) => col(parent, name, { gap: 14, padding: 22, sizingH: 'fill', ...CARD, ...o });

// ============================================================ 10 Brain: the map
{
  const { A, main } = await shell(N.map, 0);
  await header(main, 'Linked notes about shop-api, so no session is left behind. They live in a hidden folder that Git ignores.');
  await askBar(main, { dest: N.found });
  await tabs(main, 'Map');
  const body = await row(main, 'Body', { gap: 32, padding: [22, 32, 28, 32], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });

  const panel = await col(body, 'Map panel', { gap: 0, sizingH: 'fixed', width: 716, sizingV: 'hug', ...CARD, clip: true });
  const CW = 716, CH = 540;
  const cv = await frame(panel, 'Map canvas', { clip: true }, { width: CW, height: CH });

  // clusters: the groups Kona computed from the links
  const clusters = [
    { name: 'Sign-in and sessions', x: 16, y: 16, w: 330, h: 236 },
    { name: 'Using agents (starter notes)', x: 370, y: 16, w: 330, h: 236 },
    { name: 'Payments', x: 16, y: 272, w: 330, h: 200 },
    { name: 'Database moves', x: 370, y: 272, w: 330, h: 200 },
    { name: 'From Claude\u2019s memory', x: 16, y: 488, w: 684, h: 44 },
  ];
  for (const c of clusters) {
    const r = await rect(cv, 'Cluster / ' + c.name, c.w, c.h, { fill: T.surface2, cornerRadius: 18, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
    await k.call('set_properties', { ids: [r], props: { x: c.x, y: c.y } });
  }
  for (const c of clusters.slice(0, 4)) {
    const t = await text(cv, c.name, { type: 'smallStrong', color: T.textTertiary });
    await Q.move(t, c.x + 18, c.y + 12);
  }
  const nodes = {
    a1: { l: 'Fix the login redirect', layer: 'project', x: 112, y: 132, d: 30, lab: 'b', sel: true },
    a2: { l: 'Save the session first', layer: 'project', x: 262, y: 88, d: 16 },
    a3: { l: 'T-0012 Login page', layer: 'project', x: 262, y: 190, d: 18, hover: true },
    a4: { l: 'Add a redirect test', layer: 'project', x: 78, y: 218, d: 14 },
    a5: { l: 'Backend notes', layer: 'project', x: 176, y: 224, d: 14 },
    d1: { l: 'Using agents', layer: 'starter', x: 540, y: 140, d: 32, lab: 'b' },
    d2: { l: 'Roles and modes', layer: 'starter', x: 416, y: 96, d: 20 },
    d3: { l: 'Context', layer: 'starter', x: 650, y: 82, d: 16 },
    d4: { l: 'Tickets and worktrees', layer: 'starter', x: 650, y: 196, d: 18 },
    d5: { l: 'Safe habits', layer: 'starter', x: 446, y: 208, d: 16 },
    c1: { l: 'Payment webhook check', layer: 'project', x: 112, y: 368, d: 26, lab: 'b' },
    c2: { l: 'config/payments.php', layer: 'project', x: 252, y: 324, d: 14 },
    c3: { l: 'Retries on failure', layer: 'project', x: 246, y: 430, d: 16 },
    c4: { l: 'Test card list', layer: 'project', x: 62, y: 446, d: 14 },
    b1: { l: 'Move the staging database', layer: 'project', x: 474, y: 366, d: 28, lab: 'b' },
    b2: { l: 'Staging before live', layer: 'project', x: 620, y: 322, d: 18 },
    b3: { l: 'Restore takes 6 minutes', layer: 'project', x: 590, y: 424, d: 14 },
    b4: { l: 'T-0009 Staging copy', layer: 'project', x: 410, y: 436, d: 16 },
    e1: { l: 'Never migrate the live database', layer: 'memory', x: 640, y: 510, d: 16, lab: 'l' },
    e2: { l: 'Laravel 11 and PHP 8.3', layer: 'memory', x: 40, y: 510, d: 14, lab: 'r' },
  };
  // [from, to, kind]: w = wiki link, n = named in the text, g = guessed by Kona
  const edges = [
    ['a1', 'a2', 'w'], ['a1', 'a3', 'w'], ['a3', 'a4', 'w'], ['a3', 'a5', 'n'],
    ['d1', 'd2', 'w'], ['d1', 'd3', 'w'], ['d1', 'd4', 'w'], ['d1', 'd5', 'w'], ['d2', 'd4', 'n'],
    ['c1', 'c2', 'w'], ['c1', 'c3', 'w'], ['c1', 'c4', 'n'], ['c3', 'c2', 'n'],
    ['b1', 'b2', 'w'], ['b1', 'b3', 'w'], ['b1', 'b4', 'w'],
    ['a1', 'd2', 'w'], ['a1', 'c1', 'g'], ['b2', 'e1', 'w'], ['c2', 'e2', 'w'],
  ];
  for (const [p, q, kind] of edges) {
    const A1 = nodes[p], B1 = nodes[q], hot = p === 'a1' || q === 'a1';
    await vec(cv, `Link ${p} to ${q}`, `M${A1.x} ${A1.y} L${B1.x} ${B1.y}`, {
      stroke: hot ? T.accent : T.textTertiary, strokeWeight: kind === 'w' ? 2 : 1.25, ...(kind === 'g' ? { dashes: [5, 4] } : {}),
    });
  }
  for (const n of Object.values(nodes)) {
    const x = n.x - n.d / 2, y = n.y - n.d / 2;
    if (n.sel) await ellipse(cv, 'Selected ring', n.d + 14, n.d + 14, { fill: 'none', stroke: T.accent, strokeWeight: 2, strokeAlign: 'inside' }, { x: n.x - (n.d + 14) / 2, y: n.y - (n.d + 14) / 2 });
    if (n.hover) await ellipse(cv, 'Hover ring', n.d + 10, n.d + 10, { fill: 'none', stroke: T.textSecondary, strokeWeight: 1.5, strokeAlign: 'inside' }, { x: n.x - (n.d + 10) / 2, y: n.y - (n.d + 10) / 2 });
    if (n.layer === 'starter') await ellipse(cv, 'Note / ' + n.l, n.d, n.d, { fill: T.surface2, stroke: T.accent, strokeWeight: 2.25, strokeAlign: 'inside' }, { x, y });
    else if (n.layer === 'memory') await ellipse(cv, 'Note / ' + n.l, n.d, n.d, { fill: T.surface2, stroke: T.textTertiary, strokeWeight: 1.75, strokeAlign: 'inside' }, { x, y });
    else await ellipse(cv, 'Note / ' + n.l, n.d, n.d, { fill: T.textSecondary }, { x, y });
  }
  // names: only the most connected notes carry one, on a small plate in the cluster's colour so a line never cuts the word
  for (const n of Object.values(nodes)) {
    if (!n.lab) continue;
    const pill = await row(cv, 'Name / ' + n.l, { padding: [1, 6, 1, 6], fill: T.surface2, cornerRadius: 6 });
    await text(pill, n.l, { type: n.sel ? 'smallStrong' : 'small', size: 12.5, color: n.sel ? T.text : T.textSecondary });
    const w = (await f.tool('get_node', { id: pill, depth: 0 })).json.width;
    const pos = n.lab === 'r' ? [n.x + n.d / 2 + 6, n.y - 11] : n.lab === 'l' ? [n.x - n.d / 2 - 6 - w, n.y - 11] : [n.x - w / 2 + (n.sel ? 26 : 0), n.y + n.d / 2 + (n.sel ? 12 : 4)];
    await Q.move(pill, Math.round(pos[0]), Math.round(pos[1]));
  }
  // one note under the pointer, to show what a hover says
  const tip = await Q.tooltip(cv, 'T-0012 Login page');
  await Q.move(tip, 286, 128);

  await P.line(panel);
  const leg = await row(panel, 'Legend', { gap: 20, padding: [14, 20, 14, 20], sizingH: 'fill', crossAlign: 'center' });
  for (const l of ['project', 'starter', 'memory']) {
    const g = await row(leg, 'Legend / ' + l, { gap: 8 });
    await layerMark(g, l, 12);
    await text(g, layerLabel[l], { type: 'small', color: T.textSecondary });
  }
  const g1 = await row(leg, 'Legend / written', { gap: 8 }); await linkSample(g1, false); await text(g1, 'Written link', { type: 'small', color: T.textSecondary });
  const g2 = await row(leg, 'Legend / guessed', { gap: 8 }); await linkSample(g2, true); await text(g2, 'Guessed link', { type: 'small', color: T.textSecondary });

  // ---- side: the selected note
  const side = await col(body, 'Selected note', { gap: 18, padding: 22, sizingH: 'fixed', width: 380, ...CARD });
  const sh = await col(side, 'Heading', { gap: 10, sizingH: 'fill' });
  const st = await row(sh, 'Title row', { gap: 12 });
  await roleMark(st, 'Backend', 32);
  await text(st, 'Fix the login redirect', { type: 'heading' });
  const chips = await row(sh, 'Chips', { gap: 8 });
  await layerChip(chips, 'project');
  await Q.chip(chips, 'Sign-in and sessions');
  await text(sh, 'The sign-in route redirected before the session was saved. Backend added a save call and a test.', { type: 'body', color: T.textSecondary, fixedWidth: 334 });
  await text(sh, 'Backend · T-0012 · 14 minutes ago', { type: 'small', color: T.textTertiary });
  await P.line(side);
  const rowOf = async (parent, title, layer, guessed, where) => {
    const r = await row(parent, 'Link / ' + title, { gap: 12, sizingH: 'fill', crossAlign: 'min' });
    await linkSample(r, guessed, guessed ? T.textSecondary : T.textTertiary);
    const m = await col(r, 'Text', { gap: 2, sizingH: 'fill' });
    await text(m, title, { type: 'body' });
    const sub = await row(m, 'Sub', { gap: 8 });
    await layerMark(sub, layer, 9);
    await text(sub, (guessed ? 'Guessed' : 'Written') + ' · ' + where, { type: 'small', color: T.textTertiary });
    return r;
  };
  const out = await col(side, 'Links to', { gap: 12, sizingH: 'fill' });
  await text(out, 'Links to 4', { type: 'bodyStrong' });
  await rowOf(out, 'Save the session first', 'project', false, 'lines 4 to 12');
  await rowOf(out, 'T-0012 Login page', 'project', false, 'lines 1 to 9');
  await rowOf(out, 'Roles and modes', 'starter', false, 'lines 22 to 40');
  await rowOf(out, 'Payment webhook check', 'project', true, 'both talk about the session cookie');
  await P.line(side);
  const inn = await col(side, 'Linked from', { gap: 12, sizingH: 'fill' });
  await text(inn, 'Linked from 2', { type: 'bodyStrong' });
  await text(inn, 'T-0012 Login page · Plan the invoice export', { type: 'small', color: T.textSecondary });
  const btns = await row(side, 'Buttons', { gap: 10 });
  await P.button(btns, 'Open note', { variant: 'quiet', size: 'sm' });
  await P.button(btns, 'Start a session with it', { variant: 'ghost', size: 'sm' });
}

// ============================================================ 10a Notes
{
  const { A, main } = await shell(N.notes, 1020);
  await header(main, 'Linked notes about shop-api, so no session is left behind. They live in a hidden folder that Git ignores.');
  await askBar(main, { dest: N.found });
  await tabs(main, 'Notes');
  const body = await row(main, 'Body', { gap: 32, padding: [22, 32, 28, 32], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });
  const left = await col(body, 'Feed', { gap: 14, sizingH: 'fill' });
  const lh = await row(left, 'Head', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  await text(lh, 'Newest first', { type: 'heading' });
  await P.tabsSegmented(lh, ['All', 'Project', 'Starter', 'Claude memory'], 'All');
  const entry = async (title, sum, layer, src, when, role, links) => {
    const c = await col(left, 'Note / ' + title, { gap: 10, padding: 18, sizingH: 'fill', ...CARD });
    const t = await row(c, 'Top', { gap: 10, sizingH: 'fill', mainAlign: 'spaceBetween' });
    const tl = await row(t, 'Left', { gap: 10 });
    if (role) await roleMark(tl, role, 24); else await layerMark(tl, layer, 14);
    await text(tl, title, { type: 'bodyStrong' });
    const tr = await row(t, 'Right', { gap: 10 });
    await layerChip(tr, layer);
    await text(tr, when, { type: 'small', color: T.textTertiary });
    await text(c, sum, { type: 'body', color: T.textSecondary, fixedWidth: 650 });
    const ft = await row(c, 'Footer', { gap: 14 });
    await text(ft, src, { type: 'small', color: T.textTertiary });
    await text(ft, links, { type: 'mono', size: 12.5, color: T.textTertiary });
  };
  await entry('Fix the login redirect', 'The sign-in route redirected before the session was saved. Backend added a save call and a test. Waiting on a command answer.', 'project', 'Kona session', '14 min ago', 'Backend', '4 links out · 2 in');
  await entry('Using agents', 'What an agent can touch, why a long session loses focus, and when to start a new one. Ships with Kona.', 'starter', 'Part of Kona, read only', 'with Kona 0.1', null, '6 links out · 9 in');
  await entry('Move the staging database', 'DevOps copied the dump and checked row counts. Left a note: restore takes about 6 minutes.', 'project', 'Kona session', 'yesterday', 'DevOps', '3 links out · 2 in');
  await entry('Never migrate the live database', 'Staging first, then ask. Saved in Claude’s memory folder on 12 October, so it may be older than the code. Kona reads it and never writes to it.', 'memory', 'Claude’s memory folder', '12 Oct', null, '1 link out · 3 in');
  await entry('Quick look at the cart total', 'Opened in the terminal. Found the rounding bug in the order total and fixed it in one file.', 'project', 'From the terminal', 'yesterday', null, '1 link out · 0 in');
  const right = await col(body, 'Side', { gap: 22, sizingH: 'fixed', width: 380 });
  const nf = await card(right, 'Not finished', { fill: T.surface2 });
  await text(nf, 'Not finished', { type: 'heading' });
  await text(nf, 'Open items from the notes, so nothing is left behind.', { type: 'small', color: T.textTertiary });
  for (const [s, a, b] of [['waiting', 'Fix the login redirect', 'Waiting on you for 14 minutes'], ['idle', 'Plan the invoice export', 'Stopped half way on Monday'], ['left', 'Cache the product list', 'Branch has changes nobody reviewed']]) {
    const r = await row(nf, 'Open thread', { gap: 12, crossAlign: 'min', sizingH: 'fill' });
    await glyph(r, s, 18, T[s]);
    const m = await col(r, 'Text', { gap: 2, sizingH: 'fill' });
    await text(m, a, { type: 'body' });
    await text(m, b, { type: 'small', color: s === 'idle' ? T.textTertiary : T[s] });
  }
  const sb = await card(right, 'Starter brain', { gap: 12 });
  await text(sb, 'The starter brain', { type: 'heading' });
  await text(sb, '14 notes come with Kona: how agents work, how to use each screen, safe habits. They are read only and update when Kona does.', { type: 'body', color: T.textSecondary, fixedWidth: 334 });
  await P.button(sb, 'Show the starter notes', { variant: 'ghost', size: 'sm' });
}

// ============================================================ 10b Report
{
  const { A, main } = await shell(N.report, 2040);
  await header(main, 'Linked notes about shop-api, so no session is left behind. They live in a hidden folder that Git ignores.');
  await askBar(main, { dest: N.found });
  await tabs(main, 'Report');
  const body = await row(main, 'Body', { gap: 32, padding: [22, 32, 28, 32], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });
  const left = await col(body, 'Left', { gap: 22, sizingH: 'fill' });

  const wanted = await card(left, 'Wanted notes');
  await text(wanted, 'Wanted notes', { type: 'heading' });
  await text(wanted, 'Questions the brain could not answer. Write the note once and the gap closes. The questions stay on this PC.', { type: 'small', color: T.textTertiary, fixedWidth: 640 });
  const ask = [['How do we deploy to the live server?', 'Asked 3 times · last yesterday'], ['Which payment provider do we use?', 'Asked once · today'], ['Where are the queue settings?', 'Asked once · Monday']];
  for (let i = 0; i < ask.length; i++) {
    const r = await row(wanted, 'Wanted / ' + ask[i][0], { gap: 14, sizingH: 'fill' });
    await glyph(r, 'waiting', 18, T.waiting);
    const m = await col(r, 'Text', { gap: 2, sizingH: 'fill' });
    await text(m, ask[i][0], { type: 'body' });
    await text(m, ask[i][1], { type: 'small', color: T.textTertiary });
    await P.button(r, 'Write this note', { variant: 'ghost', size: 'sm' });
    if (i < ask.length - 1) await P.line(wanted);
  }

  const look = await card(left, 'Needs a look');
  await text(look, 'Needs a look', { type: 'heading' });
  await text(look, 'Kona only points. It never changes a note by itself.', { type: 'small', color: T.textTertiary });
  const items = [
    ['left', '2 links go nowhere', '[[Retry policy]] · [[Refund flow]]', true],
    ['waiting', '1 decision has no session behind it', 'Staging before live', false],
    ['idle', '1 note nothing links to', 'Edit in VS Code: payment config', false],
    ['waiting', '1 open item is 34 days old', 'Plan the invoice export', false],
  ];
  for (let i = 0; i < items.length; i++) {
    const r = await row(look, 'Look / ' + items[i][1], { gap: 14, sizingH: 'fill' });
    await glyph(r, items[i][0], 18, T[items[i][0]]);
    const m = await col(r, 'Text', { gap: 2, sizingH: 'fill' });
    await text(m, items[i][1], { type: 'body' });
    await text(m, items[i][2], { type: items[i][3] ? 'mono' : 'small', size: items[i][3] ? 12.5 : undefined, color: T.textTertiary });
    await P.button(r, 'Open', { variant: 'ghost', size: 'sm' });
    if (i < items.length - 1) await P.line(look);
  }

  const right = await col(body, 'Right', { gap: 22, sizingH: 'fixed', width: 380 });
  const hub = await card(right, 'Most connected', { fill: T.surface2 });
  await text(hub, 'Most connected', { type: 'heading' });
  await text(hub, 'Everything points here, so keep these short and true.', { type: 'small', color: T.textTertiary, fixedWidth: 334 });
  for (const [n, layer, c] of [['Using agents', 'starter', '15 links'], ['Fix the login redirect', 'project', '6 links'], ['Move the staging database', 'project', '6 links'], ['Roles and modes', 'starter', '5 links']]) {
    const r = await row(hub, 'Hub / ' + n, { gap: 10, sizingH: 'fill' });
    await layerMark(r, layer, 12);
    await text(r, n, { type: 'body', sizingH: 'fill' });
    await text(r, c, { type: 'mono', size: 12.5, color: T.textSecondary });
  }
  const grp = await card(right, 'How your notes group', { gap: 12 });
  await text(grp, 'How your notes group', { type: 'heading' });
  await text(grp, 'Kona put 62 notes into 5 groups by how they link. 59 sit where your roles and tickets would put them.', { type: 'body', color: T.textSecondary, fixedWidth: 334 });
  await text(grp, '3 sit somewhere else', { type: 'smallStrong', color: T.textSecondary });
  await text(grp, 'Payment webhook check sits with Sign-in and sessions, because both talk about the session cookie.', { type: 'small', color: T.textTertiary, fixedWidth: 334 });
  await P.button(grp, 'Show on the map', { variant: 'ghost', size: 'sm' });
}

// ============================================================ the three answers
const resultCard = async (parent, o) => {
  const { title, layer, text: body, where, match, pct, primary } = o;
  const c = await col(parent, 'Result / ' + title, { gap: 12, padding: 22, sizingH: 'fill', ...CARD });
  const t = await row(c, 'Top', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  const tl = await row(t, 'Left', { gap: 10 });
  await layerMark(tl, layer, 12);
  await text(tl, title, { type: 'bodyStrong' });
  const tr = await row(t, 'Right', { gap: 10 });
  await text(tr, match, { type: 'small', color: T.textSecondary });
  await Q.shareBar(tr, pct, 72, pct >= 60 ? T.accent : T.textSecondary);
  await text(c, body, { type: 'body', color: T.textSecondary, fixedWidth: 660 });
  const ft = await row(c, 'Footer', { sizingH: 'fill', mainAlign: 'spaceBetween' });
  const fl = await row(ft, 'Left', { gap: 10 });
  await layerChip(fl, layer);
  await text(fl, where, { type: 'mono', size: 12.5, color: T.textTertiary });
  const fr = await row(ft, 'Right', { gap: 8 });
  await P.button(fr, 'Open section', { variant: 'quiet', size: 'sm' });
  if (primary) { const b = await P.button(fr, 'Start a session', { variant: 'ghost', size: 'sm' }); I.clickTo(b, '13 New session'); }
  return c;
};
const resultHead = async (parent, state, word, sentence) => {
  const h = await col(parent, 'Answer', { gap: 10, sizingH: 'fill' });
  await P.badge(h, state, word);
  await text(h, sentence, { type: 'body', color: T.textSecondary, fixedWidth: 660 });
  return h;
};
const checked = async (parent, rows) => {
  const c = await card(parent, 'What Kona looked at', { fill: T.surface2, gap: 14 });
  await text(c, 'What Kona looked at', { type: 'heading' });
  for (const [n, d] of rows) {
    const r = await row(c, 'Looked / ' + n, { gap: 12, sizingH: 'fill' });
    await glyph(r, 'done', 18, T.done);
    const m = await col(r, 'Text', { gap: 2, sizingH: 'fill' });
    await text(m, n, { type: 'body' });
    await text(m, d, { type: 'small', color: T.textTertiary });
  }
  return c;
};
const askScreen = async (name, y, value, nextDest) => {
  const { A, main } = await shell(name, y);
  await header(main, 'Linked notes about shop-api, so no session is left behind. They live in a hidden folder that Git ignores.', N.map);
  await askBar(main, { value, primary: false, label: 'Ask again', dest: nextDest });
  const body = await row(main, 'Body', { gap: 32, padding: [8, 32, 28, 32], sizingH: 'fill', sizingV: 'fill', crossAlign: 'min' });
  I.screenKeys(A, [{ trigger: { type: 'keyPress', key: 'Esc' }, action: { type: 'back' } }]);
  return { A, body };
};

// ---- 10c found
{
  const { body } = await askScreen(N.found, 3060, 'How do I run two agents at once?', N.partly);
  const left = await col(body, 'Results', { gap: 16, sizingH: 'fill' });
  await resultHead(left, 'done', 'Found in the brain', '3 sections in 3 notes. The first one answers it.');
  await resultCard(left, { title: 'Tickets and worktrees › Running two agents', layer: 'starter', text: 'Give each agent its own copy of the project (a worktree). Two agents in one folder overwrite each other’s changes, and neither can tell.', where: 'lines 31 to 58', match: 'Strong match', pct: 86, primary: true });
  await resultCard(left, { title: 'Decision: two sessions at once, a third waits', layer: 'project', text: 'Two is easy on this PC. A third waits in line. Hard cap of three, set on 24 October.', where: 'lines 3 to 9', match: 'Good match', pct: 64 });
  await resultCard(left, { title: 'Using agents › When to start a new session', layer: 'starter', text: 'A long session loses track of early details. When it starts repeating itself or forgetting rules, save a note and start a fresh one.', where: 'lines 12 to 30', match: 'Fair match', pct: 41 });
  const right = await col(body, 'Side', { gap: 22, sizingH: 'fixed', width: 380 });
  await checked(right, [['14 starter notes', '1 strong match'], ['42 project notes', '1 good match'], ['6 Claude memory notes', 'nothing close']]);
  const tip = await card(right, 'Tip', { gap: 10 });
  await text(tip, 'Not what you meant?', { type: 'heading' });
  await text(tip, 'Ask again with other words, or ask Claude in a session. If the answer is worth keeping, Kona offers to save it as a note.', { type: 'small', color: T.textSecondary, fixedWidth: 334 });
}

// ---- 10d partly
{
  const { body } = await askScreen(N.partly, 4080, 'How do I deploy to the live server?', N.none);
  const left = await col(body, 'Results', { gap: 16, sizingH: 'fill' });
  await resultHead(left, 'idle', 'Partly in the brain', 'Nothing answers this directly. These are the closest, and they may not fit.');
  await resultCard(left, { title: 'Move the staging database', layer: 'project', text: 'DevOps copied the dump and checked row counts. Left a note: restore takes about 6 minutes.', where: 'lines 4 to 19', match: 'Loose match', pct: 38 });
  await resultCard(left, { title: 'Safe habits › Before you touch a server', layer: 'starter', text: 'Staging first. Read what will run. Ask before any command on a server, and never paste a key into the chat.', where: 'lines 20 to 44', match: 'Loose match', pct: 34 });
  await resultCard(left, { title: 'Never migrate the live database', layer: 'memory', text: 'Staging first, then ask. Saved in Claude’s memory folder on 12 October.', where: 'lines 1 to 6', match: 'Weak match', pct: 29 });
  const right = await col(body, 'Side', { gap: 22, sizingH: 'fixed', width: 380 });
  const next = await card(right, 'None of these', { fill: T.surface2, gap: 14 });
  await text(next, 'None of these is it?', { type: 'heading' });
  await text(next, 'Kona will keep the question on the wanted-notes list, so the gap shows in the Report.', { type: 'small', color: T.textTertiary, fixedWidth: 334 });
  const b1 = await P.button(next, 'Ask Claude in a DevOps session', { variant: 'primary', size: 'md', fillWidth: true }); I.clickTo(b1, '13 New session');
  await P.button(next, 'Search the web…', { variant: 'quiet', size: 'md', fillWidth: true });
  await P.button(next, 'Write the note yourself', { variant: 'ghost', size: 'md', fillWidth: true, iconName: 'plus' });
}

// ---- 10e not in the brain
{
  const { body } = await askScreen(N.none, 5100, 'Which payment provider do we use?', N.map);
  const left = await col(body, 'Options', { gap: 16, sizingH: 'fill' });
  await resultHead(left, 'waiting', 'Not in the brain', 'Nothing in the brain answers this, so Kona will not guess. Pick what happens next.');
  const opt = async (iconName, title, desc, btn, o = {}) => {
    const c = await row(left, 'Option / ' + title, { gap: 16, padding: 20, sizingH: 'fill', ...CARD, crossAlign: 'center' });
    const ic = await frame(c, 'Icon tile', { fill: T.surface3, cornerRadius: 10, layout: 'horizontal', mainAlign: 'center', crossAlign: 'center' }, { width: 40, height: 40 });
    if (iconName === 'plus') await k.icon(ic, 'plus', 18, T.text); else await Q.icon2(ic, iconName, 18, T.text);
    const m = await col(c, 'Text', { gap: 4, sizingH: 'fill' });
    const tr = await row(m, 'Title row', { gap: 10 });
    await text(tr, title, { type: 'bodyStrong' });
    if (o.role) await roleMark(tr, o.role, 20);
    await text(m, desc, { type: 'small', color: T.textSecondary, fixedWidth: 440 });
    const b = await P.button(c, btn, { variant: o.primary ? 'primary' : 'quiet', size: 'sm' });
    if (o.dest) I.clickTo(b, o.dest);
    return c;
  };
  await opt('chat', 'Ask Claude in a session', 'Payments sound like a Backend question. The answer can be saved as a note afterwards.', 'Ask Backend', { primary: true, role: 'Backend', dest: '13 New session' });
  await opt('search', 'Search the web', 'This sends your question outside this PC, so Kona asks you first.', 'Search…');
  await opt('brain', 'Read the nearest starter topic', 'Using agents › Giving an agent the right context. It will not answer this, but it shows how to ask.', 'Open');
  await opt('plus', 'Write the note yourself', 'If you already know the answer, write it once and every later session can find it.', 'Write a note');
  const right = await col(body, 'Side', { gap: 22, sizingH: 'fixed', width: 380 });
  const chk = await checked(right, [['14 starter notes', 'no match'], ['42 project notes', 'no match'], ['6 Claude memory notes', 'no match']]);
  await text(chk, 'The closest section scored 12 percent, below the 35 percent Kona needs before it calls something a match.', { type: 'small', color: T.textTertiary, fixedWidth: 334 });
  const wn = await card(right, 'Wanted', { gap: 10 });
  const wr = await row(wn, 'Wanted row', { gap: 10 });
  await glyph(wr, 'waiting', 18, T.waiting);
  await text(wr, 'Added to wanted notes', { type: 'bodyStrong' });
  await text(wn, 'It shows in the Report until a note answers it. The question stays on this PC.', { type: 'small', color: T.textSecondary, fixedWidth: 334 });
  await P.button(wn, 'Don’t keep this question', { variant: 'ghost', size: 'sm' });
}

// ---------- in place: attach only the new links, add the flow, grid, save
if (INPLACE) {
  let ok = 0, bad = 0;
  for (const p of reg.pending.filter((q) => !knownLinks.has(q.id))) {
    for (const it of p.interactions) {
      const action = { ...it.action };
      if (action.destKey) { action.dest = reg.screens[action.destKey]; if (!action.dest) { console.log('no screen for', action.destKey); bad++; continue; } delete action.destKey; }
      if (action.destId) { action.dest = action.destId; delete action.destId; }
      try { await f.run('proto.interaction.add', { id: p.id, trigger: it.trigger, action, ...(it.transition ? { transition: it.transition } : {}), ...(it.durationMs ? { durationMs: it.durationMs } : {}) }); ok++; }
      catch (e) { bad++; console.log('link failed', p.id, String(e).slice(0, 140)); }
    }
  }
  console.log('links added', ok, 'failed', bad);
  await f.run('proto.flow.add', { start: reg.screens[N.map], name: 'Ask the brain' }).catch((e) => console.log('flow', String(e).slice(0, 120)));
  let y = 0;
  for (const n of Object.values(N)) {
    const id = reg.screens[n];
    await k.call('set_properties', { ids: [id], props: { x: COL_X, y } });
    y += 900 + 120;
  }
}
if (SHOTS) {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const n of Object.values(N)) await k.shot([reg.screens[n]], SHOTS + '/' + n.split(' ')[0] + '.png', 1);
}
console.log('brain screens built');
if (INPLACE) console.log((await f.run('file.save', {})).text);
f.close();
