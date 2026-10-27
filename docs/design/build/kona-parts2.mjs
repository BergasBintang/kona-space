// Kona parts, second batch: the rest of the base parts the screens need.
import { T, tint, SHADOW_OVERLAY } from './kona-lib.mjs';
import { STATE_WORD } from './kona-parts.mjs';

export function makeParts2(k, P) {
  const { frame, row, col, text, rect, ellipse, vec, glyph, roleMark, call } = k;

  const setFill = (ids) => call('set_properties', { ids: Array.isArray(ids) ? ids : [ids], props: { sizingH: 'fill' } });
  const move = (id, x, y) => call('set_properties', { ids: [id], props: { x, y } });

  // ---------- Icons, second set (16 px grid, 1.75 stroke)
  async function icon2(parent, kind, size = 16, color) {
    const c = color || T.textSecondary;
    const u = size / 16;
    const g = await frame(parent, 'Icon / ' + kind, {}, { width: size, height: size });
    const p = { stroke: c, strokeWeight: 1.75 * u };
    const V = (name, d, extra = {}) => vec(g, name, d, { ...p, ...extra });
    switch (kind) {
      case 'chevronR': await V('c', `M${6 * u} ${4 * u} L${10 * u} ${8 * u} L${6 * u} ${12 * u}`); break;
      case 'chevronD': await V('c', `M${4 * u} ${6 * u} L${8 * u} ${10 * u} L${12 * u} ${6 * u}`); break;
      case 'close': await V('c', `M${4 * u} ${4 * u} L${12 * u} ${12 * u} M${12 * u} ${4 * u} L${4 * u} ${12 * u}`); break;
      // two chevrons: the sidebar folds in (collapse) or opens out (expand)
      case 'collapse': await V('c', `M${8.5 * u} ${4 * u} L${4.5 * u} ${8 * u} L${8.5 * u} ${12 * u} M${12.5 * u} ${4 * u} L${8.5 * u} ${8 * u} L${12.5 * u} ${12 * u}`); break;
      case 'expand': await V('c', `M${3.5 * u} ${4 * u} L${7.5 * u} ${8 * u} L${3.5 * u} ${12 * u} M${7.5 * u} ${4 * u} L${11.5 * u} ${8 * u} L${7.5 * u} ${12 * u}`); break;
      case 'search':
        await ellipse(g, 'lens', 9 * u, 9 * u, { fill: 'none', stroke: c, strokeWeight: 1.75 * u, strokeAlign: 'inside' }, { x: 2 * u, y: 2 * u });
        await V('handle', `M${10.5 * u} ${10.5 * u} L${14 * u} ${14 * u}`); break;
      case 'file': await V('f', `M${3.5 * u} ${2 * u} L${9.5 * u} ${2 * u} L${12.5 * u} ${5 * u} L${12.5 * u} ${14 * u} L${3.5 * u} ${14 * u} Z M${9.5 * u} ${2 * u} L${9.5 * u} ${5 * u} L${12.5 * u} ${5 * u}`, { strokeWeight: 1.5 * u }); break;
      case 'folder': await V('f', `M${2 * u} ${5 * u} L${2 * u} ${12.5 * u} L${14 * u} ${12.5 * u} L${14 * u} ${6 * u} L${7.5 * u} ${6 * u} L${6.5 * u} ${4 * u} L${2 * u} ${4 * u} Z`, { strokeWeight: 1.6 * u }); break;
      case 'chat': await V('c', `M${2.5 * u} ${3.5 * u} L${13.5 * u} ${3.5 * u} L${13.5 * u} ${10.5 * u} L${7 * u} ${10.5 * u} L${4 * u} ${13 * u} L${4 * u} ${10.5 * u} L${2.5 * u} ${10.5 * u} Z`, { strokeWeight: 1.6 * u }); break;
      case 'board':
        for (const x of [2, 6.5, 11]) await rect(g, 'col', 3 * u, (x === 6.5 ? 11 : x === 2 ? 8 : 6) * u, { fill: 'none', stroke: c, strokeWeight: 1.5 * u, strokeAlign: 'inside', cornerRadius: 1 * u }).then((id) => move(id, x * u, 2.5 * u));
        break;
      case 'branch':
        await ellipse(g, 'a', 3 * u, 3 * u, { fill: 'none', stroke: c, strokeWeight: 1.5 * u, strokeAlign: 'inside' }, { x: 3 * u, y: 2 * u });
        await ellipse(g, 'b', 3 * u, 3 * u, { fill: 'none', stroke: c, strokeWeight: 1.5 * u, strokeAlign: 'inside' }, { x: 3 * u, y: 11 * u });
        await ellipse(g, 'c', 3 * u, 3 * u, { fill: 'none', stroke: c, strokeWeight: 1.5 * u, strokeAlign: 'inside' }, { x: 10 * u, y: 5 * u });
        await V('l', `M${4.5 * u} ${5 * u} L${4.5 * u} ${11 * u} M${11.5 * u} ${8 * u} C${11.5 * u} ${10 * u} ${4.5 * u} ${9 * u} ${4.5 * u} ${11 * u}`, { strokeWeight: 1.4 * u }); break;
      case 'coin':
        await V('bars', `M${3.5 * u} ${13 * u} L${3.5 * u} ${9 * u} M${8 * u} ${13 * u} L${8 * u} ${3 * u} M${12.5 * u} ${13 * u} L${12.5 * u} ${6.5 * u}`, { strokeWeight: 2.2 * u }); break;
      case 'roles':
        await ellipse(g, 'a', 5 * u, 5 * u, { fill: 'none', stroke: c, strokeWeight: 1.5 * u, strokeAlign: 'inside' }, { x: 2 * u, y: 2.5 * u });
        await rect(g, 'b', 5 * u, 5 * u, { fill: 'none', stroke: c, strokeWeight: 1.5 * u, strokeAlign: 'inside', cornerRadius: 1 * u }).then((id) => move(id, 9 * u, 2.5 * u));
        await V('t', `M${5.5 * u} ${9.5 * u} L${8.5 * u} ${14 * u} L${2.5 * u} ${14 * u} Z`, { strokeWeight: 1.4 * u });
        await V('d', `M${11.5 * u} ${9.2 * u} L${14 * u} ${11.7 * u} L${11.5 * u} ${14.2 * u} L${9 * u} ${11.7 * u} Z`, { strokeWeight: 1.4 * u }); break;
      case 'brain': await V('b', `M${3 * u} ${3 * u} L${13 * u} ${3 * u} M${3 * u} ${8 * u} L${13 * u} ${8 * u} M${3 * u} ${13 * u} L${9 * u} ${13 * u}`); break;
      case 'gear':
        await ellipse(g, 'c', 4 * u, 4 * u, { fill: 'none', stroke: c, strokeWeight: 1.6 * u, strokeAlign: 'inside' }, { x: 6 * u, y: 6 * u });
        await V('r', `M${8 * u} ${1.5 * u} L${8 * u} ${3.2 * u} M${8 * u} ${12.8 * u} L${8 * u} ${14.5 * u} M${1.5 * u} ${8 * u} L${3.2 * u} ${8 * u} M${12.8 * u} ${8 * u} L${14.5 * u} ${8 * u}`, { strokeWeight: 1.5 * u }); break;
      case 'terminal':
        await V('p', `M${3 * u} ${4.5 * u} L${7 * u} ${8 * u} L${3 * u} ${11.5 * u} M${8.5 * u} ${12 * u} L${13 * u} ${12 * u}`); break;
      case 'key': await ellipse(g, 'h', 5 * u, 5 * u, { fill: 'none', stroke: c, strokeWeight: 1.6 * u, strokeAlign: 'inside' }, { x: 2 * u, y: 4 * u }); await V('s', `M${7 * u} ${8 * u} L${14 * u} ${8 * u} M${12 * u} ${8 * u} L${12 * u} ${11 * u}`, { strokeWeight: 1.5 * u }); break;
      case 'flag': await V('f', `M${4 * u} ${14 * u} L${4 * u} ${2 * u} M${4 * u} ${3 * u} L${12.5 * u} ${3 * u} L${10.5 * u} ${6 * u} L${12.5 * u} ${9 * u} L${4 * u} ${9 * u}`, { strokeWeight: 1.5 * u }); break;
      default: throw new Error('icon2 kind ' + kind);
    }
    return g;
  }

  // ---------- Switch, checkbox, radio
  async function toggle(parent, on, label, o = {}) {
    const r = await row(parent, 'Switch / ' + (on ? 'on' : 'off'), { gap: 12, ...(o.fill ? { sizingH: 'fill' } : {}) });
    const tr = await frame(r, 'Track', { fill: on ? T.accent : T.surface3, cornerRadius: 12, stroke: on ? T.accent : T.borderStrong, strokeWeight: 1, strokeAlign: 'inside' }, { width: 44, height: 24 });
    await ellipse(tr, 'Thumb', 16, 16, { fill: on ? T.onAccent : T.textSecondary }, { x: on ? 24 : 4, y: 4 });
    if (label) await text(r, label, { type: 'body' });
    return r;
  }
  async function checkbox(parent, checked, label, o = {}) {
    const r = await row(parent, 'Checkbox / ' + (checked ? 'on' : 'off'), { gap: 12 });
    const bx = await frame(r, 'Box', { fill: checked ? T.accent : T.inset, cornerRadius: 6, stroke: checked ? T.accent : T.borderStrong, strokeWeight: 1, strokeAlign: 'inside' }, { width: 22, height: 22 });
    if (checked) await vec(bx, 'check', 'M5.5 11.5 L9.2 15 L16.5 7', { stroke: T.onAccent, strokeWeight: 2 });
    if (label) await text(r, label, { type: 'body', color: o.color });
    return r;
  }
  async function radio(parent, on) {
    const bx = await frame(parent, 'Radio / ' + (on ? 'on' : 'off'), { fill: T.inset, cornerRadius: 11, stroke: on ? T.accent : T.borderStrong, strokeWeight: on ? 2 : 1, strokeAlign: 'inside' }, { width: 22, height: 22 });
    if (on) await ellipse(bx, 'dot', 10, 10, { fill: T.accent }, { x: 6, y: 6 });
    return bx;
  }

  // ---------- Chips and keys
  async function chip(parent, label, o = {}) {
    const { mono = false, color = T.textSecondary, bg = T.surface3 } = o;
    const c = await row(parent, 'Chip / ' + label, { gap: 6, padding: [3, 10, 3, 10], fill: bg, cornerRadius: 12 });
    await text(c, label, { type: mono ? 'mono' : 'small', size: 12.5, color });
    return c;
  }
  async function keys(parent, parts) {
    const r = await row(parent, 'Keys', { gap: 4 });
    for (const p of parts) {
      const kk = await row(r, 'Key ' + p, { padding: [1, 7, 1, 7], fill: T.inset, cornerRadius: 6, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', mainAlign: 'center' });
      await text(kk, p, { type: 'mono', size: 12, color: T.textSecondary });
    }
    return r;
  }

  // ---------- Tooltip, toast, alert
  async function tooltip(parent, label, hint) {
    const t = await row(parent, 'Tooltip', { gap: 10, padding: [8, 12, 8, 12], fill: T.surface3, cornerRadius: 9, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', effects: SHADOW_OVERLAY });
    await text(t, label, { type: 'small', color: T.text });
    if (hint) await keys(t, hint);
    return t;
  }
  async function toast(parent, state, title, body, action, o = {}) {
    const { width = 440 } = o;
    const t = await row(parent, 'Toast / ' + state, { gap: 14, padding: [16, 18, 16, 18], sizingH: 'fixed', width, fill: T.surface2, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', effects: SHADOW_OVERLAY, crossAlign: 'min' });
    await glyph(t, state, 20, T[state]);
    const m = await col(t, 'Text', { gap: 4, sizingH: 'fill' });
    await text(m, title, { type: 'bodyStrong' });
    if (body) await text(m, body, { type: 'small', color: T.textSecondary, fixedWidth: width - 120 });
    if (action) await P.button(t, action, { variant: 'quiet', size: 'sm' });
    return t;
  }
  async function alert(parent, state, title, body, action, o = {}) {
    const { width = 640 } = o;
    const c = T[state];
    const a = await row(parent, 'Alert / ' + state, { gap: 14, padding: [14, 18, 14, 18], sizingH: 'fixed', width, fill: tint(c, 10), cornerRadius: 12, stroke: tint(c, 40), strokeWeight: 1, strokeAlign: 'inside', crossAlign: 'min' });
    await glyph(a, state, 20, c);
    const m = await col(a, 'Text', { gap: 4, sizingH: 'fill' });
    await text(m, title, { type: 'bodyStrong' });
    if (body) await text(m, body, { type: 'small', color: T.textSecondary, fixedWidth: width - 160 });
    if (action) await P.button(a, action, { variant: 'quiet', size: 'sm' });
    return a;
  }

  // ---------- File tree row
  async function treeRow(parent, o = {}) {
    const { depth = 0, kind = 'file', name, open = false, selected = false, note, noteColor, width = 280 } = o;
    const r = await row(parent, 'Tree row / ' + name, { gap: 6, padding: [0, 10, 0, 8 + depth * 18], height: 32, sizingH: 'fixed', width, sizingV: 'fixed', cornerRadius: 8, fill: selected ? T.surface3 : 'none' });
    if (kind === 'folder') await icon2(r, open ? 'chevronD' : 'chevronR', 14, T.textTertiary);
    else await frame(r, 'indent', {}, { width: 14, height: 14 });
    await icon2(r, kind === 'folder' ? 'folder' : 'file', 16, kind === 'folder' ? T.textSecondary : T.textTertiary);
    const t = await text(r, name, { type: 'small', size: 14, color: selected ? T.text : T.textSecondary, sizingH: 'fill' });
    if (note) await text(r, note, { type: 'mono', size: 12, color: noteColor || T.textTertiary });
    return r;
  }

  // ---------- Code lines and diff lines (machine text, mono)
  const SYN = { kw: T.accent, str: T.done, com: T.textTertiary, plain: T.text, num: T.waiting };
  async function codeLine(parent, n, segs, o = {}) {
    const { highlight = false, width } = o;
    const r = await row(parent, 'Line ' + n, { gap: 0, sizingH: width ? 'fixed' : 'fill', ...(width ? { width } : {}), height: 22, sizingV: 'fixed', fill: highlight ? tint(T.accent, 9) : 'none' });
    const g = await row(r, 'Gutter', { sizingH: 'fixed', width: 52, mainAlign: 'max', padding: [0, 14, 0, 0] });
    await text(g, String(n), { type: 'mono', size: 12.5, color: T.textDisabled });
    const body = await row(r, 'Code', { gap: 0 });
    for (const [kind, s] of segs) await text(body, s.replace(/ /g, ' '), { type: 'mono', size: 13, color: SYN[kind] || T.text });
    return r;
  }
  async function diffLine(parent, kind, n1, n2, str, o = {}) {
    const { width } = o;
    const c = kind === '+' ? T.done : kind === '-' ? T.left : null;
    const r = await row(parent, 'Diff ' + kind, { gap: 0, sizingH: width ? 'fixed' : 'fill', ...(width ? { width } : {}), height: 22, sizingV: 'fixed', fill: c ? tint(c, 11) : 'none' });
    for (const n of [n1, n2]) {
      const g = await row(r, 'Num', { sizingH: 'fixed', width: 44, mainAlign: 'max', padding: [0, 10, 0, 0] });
      if (n != null) await text(g, String(n), { type: 'mono', size: 12, color: T.textDisabled });
    }
    const sg = await row(r, 'Sign', { sizingH: 'fixed', width: 24, mainAlign: 'center' });
    if (c) await text(sg, kind, { type: 'monoStrong', size: 13, color: c });
    await text(r, str.replace(/ /g, ' '), { type: 'mono', size: 13, color: c ? T.text : T.textSecondary });
    return r;
  }

  // ---------- Kanban card
  async function kanbanCard(parent, o = {}) {
    const { id, title, role, state, branch, cost, flag, width = 264, selected = false, note } = o;
    const c = await col(parent, 'Ticket card / ' + id, { gap: 12, padding: 16, sizingH: 'fixed', width, fill: T.surface2, cornerRadius: 14, stroke: selected ? T.accent : flag ? tint(T.waiting, 60) : T.borderSubtle, strokeWeight: selected ? 2 : 1, strokeAlign: 'inside' });
    await text(c, id, { type: 'mono', color: T.textTertiary });
    if (flag) {
      const f = await row(c, 'Waiting flag', { gap: 6, padding: [2, 9, 2, 7], fill: tint(T.waiting, 14), cornerRadius: 12 });
      await glyph(f, 'waiting', 14, T.waiting);
      await text(f, 'Waiting on you', { type: 'smallStrong', size: 12.5, color: T.waiting });
    }
    await text(c, title, { type: 'bodyStrong', fixedWidth: width - 32 });
    if (note) await text(c, note, { type: 'small', color: T.textTertiary, fixedWidth: width - 32 });
    const bot = await row(c, 'Bottom', { sizingH: 'fill', mainAlign: 'spaceBetween' });
    const who = await row(bot, 'Who', { gap: 8 });
    if (role) {
      await roleMark(who, role, 24);
      await text(who, role, { type: 'small', color: T.textSecondary });
    } else await text(who, 'Not assigned', { type: 'small', color: T.textTertiary });
    if (state && !flag) {
      const s = await row(bot, 'State', { gap: 6 });
      await glyph(s, state, 14, T[state]);
      await text(s, STATE_WORD[state], { type: 'small', color: T[state] });
    } else if (cost) await text(bot, cost, { type: 'mono', color: T.textTertiary });
    if (branch) await text(c, branch, { type: 'mono', size: 12, color: T.textTertiary });
    return c;
  }
  async function kanbanColumn(parent, name, count, h, o = {}) {
    const { width = 288, hint } = o;
    const colF = await col(parent, 'Column / ' + name, { gap: 12, padding: 12, sizingH: 'fixed', width, sizingV: 'fixed', height: h, fill: T.surface1, cornerRadius: 14 });
    const hd = await row(colF, 'Column head', { gap: 8, padding: [2, 4, 4, 4] });
    await text(hd, name, { type: 'bodyStrong' });
    await chip(hd, String(count), { mono: true });
    if (hint) await text(colF, hint, { type: 'small', color: T.textTertiary, fixedWidth: width - 24 });
    return colF;
  }

  // ---------- Terminal pane
  async function terminal(parent, lines, o = {}) {
    const { width = 640, height } = o;
    const t = await col(parent, 'Terminal', { gap: 2, padding: 16, sizingH: width === 'fill' ? 'fill' : 'fixed', ...(width === 'fill' ? {} : { width }), ...(height ? { sizingV: 'fixed', height } : {}), fill: T.inset, cornerRadius: 12, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
    for (const [kind, s] of lines) {
      const c = kind === 'prompt' ? T.accent : kind === 'dim' ? T.textTertiary : kind === 'err' ? T.left : T.text;
      await text(t, (kind === 'prompt' ? '> ' : '') + s, { type: 'mono', color: c });
    }
    return t;
  }

  // ---------- Table row and share bar
  async function shareBar(parent, pct, w = 120, color) {
    const tr = await frame(parent, 'Share', { fill: T.surface3, cornerRadius: 3 }, { width: w, height: 6 });
    await rect(tr, 'fill', Math.max(4, Math.round((w * pct) / 100)), 6, { fill: color || T.textSecondary, cornerRadius: 3 });
    return tr;
  }

  // ---------- Command palette
  async function palette(parent, o = {}) {
    const { width = 640 } = o;
    const p = await col(parent, 'Command palette', { gap: 0, sizingH: 'fixed', width, fill: T.surface2, cornerRadius: 18, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', effects: SHADOW_OVERLAY });
    const s = await row(p, 'Search', { gap: 12, padding: [0, 20, 0, 20], height: 60, sizingH: 'fill', sizingV: 'fixed' });
    await icon2(s, 'search', 18, T.textSecondary);
    await text(s, 'wh', { type: 'body', size: 16 });
    await rect(s, 'caret', 1.5, 22, { fill: T.accent });
    await P.line(p);
    const list = await col(p, 'Results', { gap: 2, padding: 8, sizingH: 'fill' });
    const group = (name) => text(list, name, { type: 'smallStrong', color: T.textTertiary });
    const item = async (label, sub, selected, hint, kind) => {
      const r = await row(list, 'Result / ' + label, { gap: 12, padding: [0, 12, 0, 12], height: 44, sizingH: 'fill', sizingV: 'fixed', cornerRadius: 10, fill: selected ? T.surface3 : 'none' });
      await icon2(r, kind, 16, selected ? T.accent : T.textSecondary);
      await text(r, label, { type: 'body', sizingH: 'fill' });
      if (sub) await text(r, sub, { type: 'small', color: T.textTertiary });
      if (hint) await keys(r, hint);
    };
    await group('Go to');
    await item('Worktrees', 'shop-api', true, ['Enter'], 'branch');
    await item('Waiting on you', '1 session', false, null, 'chat');
    await group('Open');
    await item('Fix the login redirect', 'Backend · waiting', false, null, 'chat');
    await item('webhook.php', 'app/Payments', false, null, 'file');
    const f = await row(p, 'Hints', { gap: 16, padding: [10, 20, 10, 20], sizingH: 'fill', fill: T.surface1 });
    await row(f, 'a', { gap: 6 }).then(async (id) => { await keys(id, ['↑', '↓']); await text(id, 'move', { type: 'small', color: T.textTertiary }); });
    await row(f, 'b', { gap: 6 }).then(async (id) => { await keys(id, ['Enter']); await text(id, 'open', { type: 'small', color: T.textTertiary }); });
    await row(f, 'c', { gap: 6 }).then(async (id) => { await keys(id, ['Esc']); await text(id, 'close', { type: 'small', color: T.textTertiary }); });
    return p;
  }

  // ---------- Permission mode picker (role editor)
  async function modeOption(parent, o = {}) {
    const { title, body, on = false, width = 520 } = o;
    const c = await row(parent, 'Mode / ' + title, { gap: 14, padding: 16, sizingH: 'fixed', width, fill: on ? tint(T.accent, 8) : T.surface1, cornerRadius: 12, stroke: on ? T.accent : T.borderSubtle, strokeWeight: on ? 2 : 1, strokeAlign: 'inside', crossAlign: 'min' });
    await radio(c, on);
    const m = await col(c, 'Text', { gap: 4, sizingH: 'fill' });
    await text(m, title, { type: 'bodyStrong' });
    await text(m, body, { type: 'small', color: T.textSecondary, fixedWidth: width - 100 });
    return c;
  }

  // ---------- Loading skeletons: quiet bars that stand where text will be
  const bar = (parent, w, h = 12, name = 'bar') => rect(parent, 'Skeleton ' + name, w, h, { fill: T.surface3, cornerRadius: h / 2 });
  async function skeletonRow(parent, width = 300) {
    const r = await row(parent, 'Skeleton / session row', { gap: 12, padding: [0, 14, 0, 12], height: 64, sizingH: 'fixed', width, sizingV: 'fixed' });
    await ellipse(r, 'Skeleton mark', 32, 32, { fill: T.surface3 });
    const m = await col(r, 'Lines', { gap: 10 });
    await bar(m, Math.round(width * 0.5), 12);
    await bar(m, Math.round(width * 0.32), 10);
    return r;
  }
  async function skeletonCard(parent, width = 192) {
    const c = await col(parent, 'Skeleton / ticket card', { gap: 14, padding: 16, sizingH: 'fixed', width, fill: T.surface2, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
    await bar(c, 56, 10);
    await bar(c, width - 32, 13);
    await bar(c, Math.round((width - 32) * 0.7), 13);
    const w = await row(c, 'Who', { gap: 8 });
    await ellipse(w, 'mark', 24, 24, { fill: T.surface3 });
    await bar(w, 64, 10);
    return c;
  }
  async function skeletonLines(parent, widths, gap = 12) {
    const c = await col(parent, 'Skeleton / text', { gap });
    for (const w of widths) await bar(c, w, 13);
    return c;
  }
  // A short note for an empty column or list: one sentence, optional next step.
  async function emptyNote(parent, title, body, o = {}) {
    const { width = 192 } = o;
    const c = await col(parent, 'Empty / ' + title, { gap: 8, padding: [20, 16, 20, 16], sizingH: 'fixed', width, cornerRadius: 12, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', dashes: [4, 4] });
    await text(c, title, { type: 'smallStrong', color: T.textSecondary, fixedWidth: width - 32 });
    await text(c, body, { type: 'small', size: 12.5, color: T.textTertiary, fixedWidth: width - 32 });
    return c;
  }

  return { skeletonRow, skeletonCard, skeletonLines, emptyNote, bar, icon2, toggle, checkbox, radio, chip, keys, tooltip, toast, alert, treeRow, codeLine, diffLine, kanbanCard, kanbanColumn, terminal, shareBar, palette, modeOption, setFill, move };
}
