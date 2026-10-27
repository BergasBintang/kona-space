// Interactive parts: component sets with a resting and a hover look, and the links that make the prototype move.
import { T, tint } from './kona-lib.mjs';
import * as R from './reg.mjs';

export const NAV = [
  ['Sessions', 'chat'], ['Board', 'board'], ['Files', 'folder'], ['Worktrees', 'branch'],
  ['Costs', 'coin'], ['Roles', 'roles'], ['Leftovers', 'flag'], ['Brain', 'brain'],
];
export const NAV_DEST = {
  Sessions: '1 Sessions / Chat', Board: '3 Board', Files: '5 Files', Worktrees: '6 Worktrees',
  Costs: '7 Costs', Roles: '8 Roles', Leftovers: '9 Leftovers', Brain: '10 Brain', Settings: '11 Settings',
};
export const BADGED = { Sessions: { n: 1, danger: false }, Leftovers: { n: 2, danger: true } };

export const BUTTONS = {
  'check-pc': ['Check this PC', 'primary', 'md'],
  'add-a-project': ['Add a project', 'primary', 'md', 'folder'],
  'add-project': ['Add project', 'primary', 'md'],
  cancel: ['Cancel', 'quiet', 'md'],
  'start-a-session': ['Start a session', 'primary', 'md'],
  'start-session': ['Start session', 'primary', 'md'],
  'new-session': ['New', 'quiet', 'sm', 'plus'],
  'open-session': ['Open the session', 'primary', 'md'],
  'allow-once': ['Allow once', 'primary', 'md'],
  'dont-allow': ['Don’t allow', 'quiet', 'md'],
  'close-ghost': ['Close', 'ghost', 'sm'],
  'stop-it-sm': ['Stop it', 'quiet', 'sm'],
  'keep-running': ['Keep it running', 'quiet', 'md'],
  'stop-it': ['Stop it', 'danger', 'md'],
  continue: ['Continue', 'primary', 'md'],
  'check-again': ['Check again', 'quiet', 'md'],
  'open-install': ['Open the install page', 'primary', 'md'],
  'see-team': ['See the team', 'quiet', 'md'],
  'sign-in': ['Sign in', 'primary', 'md'],
  'go-board': ['Open the board', 'quiet', 'md'],
};

export const TABS = [['Chat', null], ['Changes', 4], ['Files', null], ['Ticket', null]];
export const TAB_DEST = { Chat: '1 Sessions / Chat', Changes: '2 Sessions / Changes', Files: '5 Files', Ticket: '4 Board / Ticket open' };

export const SESSIONS = [
  { key: 'Fix the login redirect', role: 'Backend', title: 'Fix the login redirect', state: 'waiting', age: '14 min', cost: '$0.42' },
  { key: 'Check payment webhook', role: 'QA', title: 'Check payment webhook', state: 'live', age: '3 min', cost: '$0.08' },
  { key: 'Move the staging database', role: 'DevOps', title: 'Move the staging database', state: 'done', age: 'yesterday', cost: '$1.96' },
  { key: 'Plan the invoice export', role: 'Product', title: 'Plan the invoice export', state: 'idle', age: 'Monday', cost: '$0.31' },
];

export const ANSWERED = { ...SESSIONS[0], key: 'Fix the login redirect, answered', state: 'live', age: 'now' };

export function makeInteractive(k, P, Q, f) {
  const { frame, row, col, text, call } = k;
  const reg = R.load();
  const persist = () => R.save(reg);

  async function buildSet(key, variants, stage) {
    const holder = await row(stage, 'Set / ' + key, { gap: 16, crossAlign: 'min' });
    const ids = [];
    for (const v of variants) {
      const id = await v.build(holder);
      await call('set_properties', { ids: [id], props: { name: v.name } });
      ids.push(id);
    }
    const comps = [];
    for (const id of ids) comps.push((await f.run('component.create', { ids: [id] })).json.id ?? id);
    const set = (await f.run('component.combineVariants', { ids: comps })).json.id;
    await call('set_properties', { ids: [set], props: { name: key } });
    reg.sets[key] = { set, variants: Object.fromEntries(variants.map((v, i) => [v.name, comps[i]])) };
    persist();
    return reg.sets[key];
  }

  // ---- builders for one look of each part
  async function navBuild(host, label, icon, state, badge) {
    const on = state === 'active';
    const r = await row(host, 'Nav item', { gap: 12, padding: [0, 12, 0, 12], height: 40, sizingH: 'fixed', width: 220, sizingV: 'fixed', cornerRadius: 10, fill: on ? T.surface3 : state === 'hover' ? T.surface2 : 'none' });
    await Q.icon2(r, icon, 16, on ? T.accent : state === 'hover' ? T.text : T.textSecondary);
    await text(r, label, { type: on ? 'bodyStrong' : 'body', color: on || state === 'hover' ? T.text : T.textSecondary, sizingH: 'fill' });
    if (badge) {
      const c = badge.danger ? T.left : T.waiting;
      const chip = await row(r, 'Count', { padding: [1, 7, 1, 7], fill: tint(c, 16), cornerRadius: 10 });
      await text(chip, String(badge.n), { type: 'mono', size: 12, color: c });
    }
    return r;
  }
  async function settingsBuild(host, state) {
    const on = state === 'active';
    const r = await row(host, 'Nav item', { gap: 10, padding: [0, 12, 0, 12], height: 40, sizingH: 'fixed', width: 220, sizingV: 'fixed', cornerRadius: 10, fill: on ? T.surface3 : state === 'hover' ? T.surface2 : 'none' });
    await Q.icon2(r, 'gear', 16, on ? T.accent : state === 'hover' ? T.text : T.textSecondary);
    await text(r, 'Settings', { type: on ? 'bodyStrong' : 'body', color: on || state === 'hover' ? T.text : T.textSecondary, sizingH: 'fill' });
    await k.glyph(r, 'done', 14, T.done);
    return r;
  }
  async function tabBuild(host, label, count, state) {
    const on = state === 'active';
    const t = await col(host, 'Tab', { gap: 0 });
    const lr = await row(t, 'Tab label', { gap: 8, padding: [10, 0, 12, 0] });
    await text(lr, label, { type: on ? 'bodyStrong' : 'body', color: on ? T.text : state === 'hover' ? T.textSecondary : T.textTertiary });
    if (count) {
      const chip = await row(lr, 'Count', { padding: [1, 7, 1, 7], fill: T.surface3, cornerRadius: 10 });
      await text(chip, String(count), { type: 'mono', size: 12, color: T.textSecondary });
    }
    const u = await k.rect(t, 'Underline', 10, 2, { fill: on ? T.accent : state === 'hover' ? T.borderStrong : 'none', cornerRadius: 1 });
    await call('set_properties', { ids: [u], props: { sizingH: 'fill', height: 2 } });
    return t;
  }

  // ---- the collapsed sidebar (a 72 px rail): icon only, so the hover look carries the name as a tooltip
  async function railBuild(host, label, icon, state, badge, o = {}) {
    const on = state === 'active', hv = state === 'hover';
    const r = await frame(host, 'Rail item', { fill: on ? T.surface3 : hv ? T.surface2 : 'none', cornerRadius: 12, clip: false }, { width: 48, height: 44 });
    const ic = await Q.icon2(r, icon, 20, on ? T.accent : hv ? T.text : T.textSecondary);
    await Q.move(ic, 14, 12);
    if (badge) {
      const c = badge.danger ? T.left : T.waiting;
      const chip = await row(r, 'Count', { padding: [0, 6, 0, 6], height: 18, sizingV: 'fixed', fill: tint(c, 22), cornerRadius: 9, stroke: T.surface1, strokeWeight: 2, strokeAlign: 'outside' });
      await text(chip, String(badge.n), { type: 'mono', size: 11, color: c });
      await Q.move(chip, 25, 2);
    }
    if (o.status) { const g = await k.glyph(r, 'done', 12, T.done); await Q.move(g, 27, 4); }
    if (hv) { const tip = await Q.tooltip(r, label); await Q.move(tip, 56, 7); }
    return r;
  }
  async function toggleBuild(host, kind, state) {
    const r = await frame(host, 'Sidebar toggle', { fill: state === 'hover' ? T.surface3 : 'none', cornerRadius: 10, clip: false }, { width: 36, height: 36 });
    const ic = await Q.icon2(r, kind, 18, state === 'hover' ? T.text : T.textSecondary);
    await Q.move(ic, 9, 9);
    if (state === 'hover') { const tip = await Q.tooltip(r, kind === 'collapse' ? 'Make the sidebar smaller' : 'Open the sidebar'); await Q.move(tip, kind === 'collapse' ? -150 : 44, 40); }
    return r;
  }
  // a hover look carries a tooltip that sticks out of its box, so the looks of one set sit far enough apart to read
  const roomy = async (set, gap = 130) => {
    const ids = Object.values(set.variants), small = gap > 130; // the toggles are 36 px, the rail items 48 x 44
    const w = small ? 36 : 48, h = small ? 36 : 44;
    for (let i = 0; i < ids.length; i++) await call('set_properties', { ids: [ids[i]], props: { x: 20 + i * (w + gap), y: 20 } });
    await call('set_properties', { ids: [set.set], props: { layout: null, width: 40 + ids.length * w + (ids.length - 1) * gap + (small ? 150 : 0), height: 40 + h + (small ? 70 : 0), clip: false } });
  };
  async function buildRail(stage) {
    const sec = await col(stage, 'Collapsed sidebar', { gap: 20, sizingH: 'fill' });
    const h = await col(sec, 'Collapsed sidebar heading', { gap: 6 });
    await text(h, 'Collapsed sidebar', { type: 'title' });
    await text(h, 'The sidebar folds down to a 72 px rail that keeps the Kona mark, the project, every place, the two plan meters and Settings. Icons carry no words, so the hover look shows the name as a tooltip. Counts stay as small chips on the icon.', { type: 'small', color: T.textTertiary, fixedWidth: 820 });
    const stageSets = await frame(sec, 'Collapsed sidebar sets', { layout: 'horizontal', wrap: true, gap: 24, crossGap: 24, padding: 28, sizingH: 'fill', sizingV: 'hug', fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
    for (const [label, icon] of NAV) {
      const b = BADGED[label];
      const vs = [];
      for (const st of ['default', 'hover', 'active']) {
        if (b) {
          vs.push({ name: `State=${st}, Badge=none`, build: (hh) => railBuild(hh, label, icon, st, null) });
          vs.push({ name: `State=${st}, Badge=on`, build: (hh) => railBuild(hh, label, icon, st, b) });
        } else vs.push({ name: `State=${st}`, build: (hh) => railBuild(hh, label, icon, st, null) });
      }
      await roomy(await buildSet('Rail / ' + label, vs, stageSets));
    }
    await roomy(await buildSet('Rail / Settings', ['default', 'hover', 'active'].map((st) => ({ name: `State=${st}`, build: (hh) => railBuild(hh, 'Settings', 'gear', st, null, { status: true }) })), stageSets));
    for (const kind of ['collapse', 'expand']) {
      await roomy(await buildSet('Sidebar / ' + (kind === 'collapse' ? 'Collapse' : 'Expand'), ['default', 'hover'].map((st) => ({ name: `State=${st}`, build: (hh) => toggleBuild(hh, kind, st) })), stageSets), 190);
    }
    return sec;
  }

  // ---- build every set once, on the Parts page
  async function buildAll(stage) {
    const section = async (title, note) => {
      const s = await col(stage, title, { gap: 20, sizingH: 'fill' });
      const h = await col(s, title + ' heading', { gap: 6 });
      await text(h, title, { type: 'title' });
      if (note) await text(h, note, { type: 'small', color: T.textTertiary, fixedWidth: 820 });
      return k.frame(s, title + ' sets', { layout: 'horizontal', wrap: true, gap: 24, crossGap: 24, padding: 28, sizingH: 'fill', sizingV: 'hug', fill: T.surface1, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
    };
    const nav = await section('Navigation items', 'Three looks each: resting, hover and the page you are on. Sessions and Leftovers can carry a count.');
    for (const [label, icon] of NAV) {
      const b = BADGED[label];
      const vs = [];
      for (const st of ['default', 'hover', 'active']) {
        if (b) {
          vs.push({ name: `State=${st}, Badge=none`, build: (h) => navBuild(h, label, icon, st, null) });
          vs.push({ name: `State=${st}, Badge=on`, build: (h) => navBuild(h, label, icon, st, b) });
        } else vs.push({ name: `State=${st}`, build: (h) => navBuild(h, label, icon, st, null) });
      }
      await buildSet('Nav / ' + label, vs, nav);
    }
    await buildSet('Nav / Settings', ['default', 'hover', 'active'].map((st) => ({ name: `State=${st}`, build: (h) => settingsBuild(h, st) })), nav);

    const tabs = await section('Session tabs', 'Resting, hover and selected.');
    for (const [label, count] of TABS) await buildSet('Tab / ' + label, ['default', 'hover', 'active'].map((st) => ({ name: `State=${st}`, build: (h) => tabBuild(h, label, count, st) })), tabs);

    const sess = await section('Session rows', 'Resting, hover and selected.');
    for (const s of [...SESSIONS, ANSWERED]) {
      await buildSet('Session / ' + s.key, [
        { name: 'State=default', build: (h) => P.sessionRow(h, { ...s, width: 300, showRole: false }) },
        { name: 'State=hover', build: (h) => P.sessionRow(h, { ...s, width: 300, showRole: false, hover: true }) },
        { name: 'State=selected', build: (h) => P.sessionRow(h, { ...s, width: 300, showRole: false, selected: true }) },
      ], sess);
    }

    const btn = await section('Buttons that lead somewhere', 'Each has a resting and a hover look. The prototype uses these where a click moves to another screen.');
    for (const [key, [label, variant, size, icon]] of Object.entries(BUTTONS)) {
      await buildSet('Button / ' + key, ['default', 'hover'].map((st) => ({ name: `State=${st}`, build: (h) => P.button(h, label, { variant, size, iconName: icon, state: st }) })), btn);
    }
    await buildRail(stage);
  }

  // ---- instances used by the screens
  async function inst(parent, key, variant = 'State=default') {
    const s = reg.sets[key];
    if (!s) throw new Error('no set ' + key);
    const id = (await f.run('instance.create', { component: s.variants[variant], parent })).json.id;
    return id;
  }
  const link = (id, interactions) => { reg.pending.push({ id, interactions }); persist(); };
  const hoverPair = (key, rest, hover) => [
    { trigger: { type: 'mouseEnter' }, action: { type: 'changeTo', destId: reg.sets[key].variants[hover] } },
    { trigger: { type: 'mouseLeave' }, action: { type: 'changeTo', destId: reg.sets[key].variants[rest] } },
  ];
  const nav = (dest) => ({ trigger: { type: 'onClick' }, action: dest === ':back' ? { type: 'back' } : { type: 'navigate', destKey: dest }, transition: { type: 'dissolve' }, durationMs: 140 });

  async function navItem(parent, label, active, badged) {
    const key = 'Nav / ' + label;
    const hasBadge = !!BADGED[label];
    const sfx = (st) => (hasBadge ? `State=${st}, Badge=${badged ? 'on' : 'none'}` : `State=${st}`);
    const id = await inst(parent, key, sfx(active ? 'active' : 'default'));
    link(id, [...(active ? [] : hoverPair(key, sfx('default'), sfx('hover'))), nav(NAV_DEST[label])]);
    return id;
  }
  async function tab(parent, label, active) {
    const key = 'Tab / ' + label;
    const id = await inst(parent, key, active ? 'State=active' : 'State=default');
    link(id, [...(active ? [] : hoverPair(key, 'State=default', 'State=hover')), nav(TAB_DEST[label])]);
    return id;
  }
  async function sessionRow(parent, s, selected, dest = '1 Sessions / Chat') {
    const key = 'Session / ' + s.key;
    const id = await inst(parent, key, selected ? 'State=selected' : 'State=default');
    link(id, [...(selected ? [] : hoverPair(key, 'State=default', 'State=hover')), nav(dest)]);
    return id;
  }
  async function button(parent, key, dest, extra = []) {
    const id = await inst(parent, 'Button / ' + key);
    link(id, [...hoverPair('Button / ' + key, 'State=default', 'State=hover'), ...(dest ? [nav(dest)] : []), ...extra]);
    return id;
  }
  // a rail item: the same places as navItem, as icons. railDest says where each one leads (a collapsed twin if there is one).
  async function railItem(parent, label, active, badged, railDest = {}) {
    const key = 'Rail / ' + label;
    const hasBadge = !!BADGED[label];
    const sfx = (st) => (hasBadge ? `State=${st}, Badge=${badged ? 'on' : 'none'}` : `State=${st}`);
    const id = await inst(parent, key, sfx(active ? 'active' : 'default'));
    link(id, [...(active ? [] : hoverPair(key, sfx('default'), sfx('hover'))), nav(railDest[label] ?? NAV_DEST[label])]);
    return id;
  }
  // the fold and unfold buttons: dest is the screen they lead to (none: drawn, not wired)
  async function sidebarToggle(parent, kind, dest) {
    const key = 'Sidebar / ' + (kind === 'collapse' ? 'Collapse' : 'Expand');
    const id = await inst(parent, key);
    link(id, [...hoverPair(key, 'State=default', 'State=hover'), ...(dest ? [nav(dest)] : [])]);
    return id;
  }
  // attach the links made since a snapshot of the ids (a script that runs after the wiring step does this itself)
  async function applyPending(knownIds) {
    let ok = 0, bad = 0;
    for (const p of reg.pending.filter((q) => !knownIds.has(q.id))) {
      for (const it of p.interactions) {
        const action = { ...it.action };
        if (action.destKey) { action.dest = reg.screens[action.destKey]; if (!action.dest) { console.log('no screen for', action.destKey); bad++; continue; } delete action.destKey; }
        if (action.destId) { action.dest = action.destId; delete action.destId; }
        try { await f.run('proto.interaction.add', { id: p.id, trigger: it.trigger, action, ...(it.transition ? { transition: it.transition } : {}), ...(it.durationMs ? { durationMs: it.durationMs } : {}) }); ok++; }
        catch (e) { bad++; console.log('link failed', p.id, String(e).slice(0, 140)); }
      }
    }
    console.log('links added', ok, 'failed', bad);
  }
  // any layer: click goes to a screen
  const clickTo = (id, dest) => link(id, [nav(dest)]);
  const screenKeys = (id, items) => link(id, items);

  function registerScreen(name, id) { reg.screens[name] = id; persist(); }
  const fresh = () => R.load();
  return { reg, persist, buildAll, buildRail, inst, link, navItem, railItem, sidebarToggle, applyPending, tab, sessionRow, button, clickTo, screenKeys, registerScreen, nav, fresh };
}
