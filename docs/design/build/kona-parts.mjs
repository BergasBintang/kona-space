// Kona base parts, drawn from the tokens. Each function returns the id of the part it made.
import { T, tint, SHADOW_OVERLAY } from './kona-lib.mjs';

export const STATE_WORD = { live: 'Live', waiting: 'Waiting on you', idle: 'Idle', done: 'Done', stopped: 'Stopped', left: 'Left behind' };

export function makeParts(k) {
  const { frame, row, col, text, rect, ellipse, vec, glyph, roleMark, icon, call } = k;
  const hue = (s) => T[s];
  const line = (parent, color = T.borderSubtle) =>
    rect(parent, 'rule', 1, 1, { fill: color }).then((id) => call('set_properties', { ids: [id], props: { sizingH: 'fill', height: 1 } }).then(() => id));

  // ---------- Button
  async function button(parent, label, o = {}) {
    const { variant = 'primary', state = 'default', size = 'md', iconName, fillWidth = false } = o;
    const h = size === 'md' ? 44 : 36;
    const padX = size === 'md' ? 20 : 14;
    const fs = size === 'md' ? 15 : 14;
    let bg = 'none', fg = T.text, border = null;
    const hv = state === 'hover', pr = state === 'pressed';
    if (variant === 'primary') { bg = hv ? T.accentHover : pr ? T.accentPressed : T.accent; fg = T.onAccent; }
    if (variant === 'quiet') { bg = hv ? T.surface3 : pr ? T.surface1 : 'none'; border = T.borderStrong; }
    if (variant === 'danger') { bg = hv ? '#EE8C81' : pr ? '#CF6A5F' : T.danger; fg = T.onDanger; }
    if (variant === 'ghost') { bg = hv ? T.surface3 : pr ? T.surface2 : 'none'; fg = T.textSecondary; }
    if (state === 'disabled') { bg = variant === 'primary' || variant === 'danger' ? T.surface3 : 'none'; fg = T.textDisabled; border = variant === 'quiet' ? T.borderSubtle : null; }
    let host = parent;
    if (state === 'focus') host = await frame(parent, 'Focus ring', { layout: 'horizontal', padding: 4, cornerRadius: 14, stroke: T.accent, strokeWeight: 2, strokeAlign: 'inside', sizingH: 'hug', sizingV: 'hug' });
    const props = { gap: 8, padding: [0, padX, 0, padX], height: h, sizingV: 'fixed', cornerRadius: 10, mainAlign: 'center', fill: bg, ...(border ? { stroke: border, strokeWeight: 1, strokeAlign: 'inside' } : {}) };
    if (fillWidth) props.sizingH = 'fill';
    const b = await row(host, `Button / ${variant} / ${state}`, props);
    if (iconName) await icon(b, iconName, 16, fg);
    await text(b, label, { type: 'bodyStrong', size: fs, color: fg });
    return state === 'focus' ? host : b;
  }

  // ---------- State badge: glyph plus word, tinted pill
  async function badge(parent, state, label) {
    const c = hue(state);
    const b = await row(parent, 'State badge / ' + state, { gap: 8, padding: [5, 12, 5, 9], fill: tint(c, 14), cornerRadius: 16 });
    await glyph(b, state, 16, c);
    await text(b, label || STATE_WORD[state], { type: 'smallStrong', color: c });
    return b;
  }

  // ---------- Text field
  async function field(parent, o = {}) {
    const { label, value, placeholder, helper, state = 'default', width = 340, mono = false } = o;
    const wrap = await col(parent, 'Field / ' + state, { gap: 8, sizingH: 'fixed', width });
    if (label) await text(wrap, label, { type: 'smallStrong', color: T.textSecondary });
    let host = wrap;
    if (state === 'focus') host = await frame(wrap, 'Focus halo', { layout: 'horizontal', padding: 3, cornerRadius: 13, fill: tint(T.accent, 22), sizingH: 'fill', sizingV: 'hug' });
    const border = state === 'focus' ? T.accent : state === 'error' ? T.danger : state === 'disabled' ? T.borderSubtle : T.borderStrong;
    const box = await row(host, 'Input', { gap: 8, padding: [0, 14, 0, 14], height: 44, sizingH: 'fill', sizingV: 'fixed', fill: state === 'disabled' ? T.surface1 : T.inset, cornerRadius: 10, stroke: border, strokeWeight: 1, strokeAlign: 'inside' });
    const shown = value ?? placeholder ?? '';
    const isPlaceholder = value == null;
    await text(box, shown, { type: mono ? 'mono' : 'body', size: mono ? 14 : undefined, color: state === 'disabled' ? T.textDisabled : isPlaceholder ? T.textTertiary : T.text });
    if (state === 'focus') await rect(box, 'caret', 1.5, 20, { fill: T.accent });
    if (helper) {
      if (state === 'error') {
        const r = await row(wrap, 'Error', { gap: 6, crossAlign: 'min' });
        await glyph(r, 'left', 16, T.danger);
        await text(r, helper, { type: 'small', color: T.danger, fixedWidth: width - 24 });
      } else await text(wrap, helper, { type: 'small', color: T.textTertiary, fixedWidth: width });
    }
    return wrap;
  }

  // ---------- Select (closed) and its menu (open)
  async function select(parent, o = {}) {
    const { label, value, role, width = 340, open = false } = o;
    const wrap = await col(parent, 'Select', { gap: 8, sizingH: 'fixed', width });
    if (label) await text(wrap, label, { type: 'smallStrong', color: T.textSecondary });
    const box = await row(wrap, 'Select box', { gap: 10, padding: [0, 14, 0, 14], height: 44, sizingH: 'fill', sizingV: 'fixed', fill: T.inset, cornerRadius: 10, stroke: open ? T.accent : T.borderStrong, strokeWeight: 1, strokeAlign: 'inside' });
    if (role) await roleMark(box, role, 24);
    const t = await text(box, value, { type: 'body' });
    await call('set_properties', { ids: [t], props: { sizingH: 'fill' } }).catch(() => {});
    await icon(box, 'chevron', 16, T.textSecondary);
    return wrap;
  }

  async function menu(parent, items, selected, o = {}) {
    const { width = 340 } = o;
    const m = await col(parent, 'Menu', { gap: 2, padding: 6, sizingH: 'fixed', width, fill: T.surface2, cornerRadius: 14, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', effects: SHADOW_OVERLAY });
    for (const it of items) {
      const isSel = it.label === selected;
      const hov = it.hover;
      const r = await row(m, 'Menu item', { gap: 10, padding: [0, 10, 0, 10], height: 40, sizingH: 'fill', sizingV: 'fixed', cornerRadius: 9, fill: isSel ? tint(T.accent, 12) : hov ? T.surface3 : 'none' });
      if (it.role) await roleMark(r, it.role, 24);
      const t = await text(r, it.label, { type: 'body', color: T.text });
      await call('set_properties', { ids: [t], props: { sizingH: 'fill' } }).catch(() => {});
      if (isSel) await icon(r, 'check', 16, T.accent);
    }
    return m;
  }

  // ---------- Tabs
  async function tabsUnderline(parent, items, active, o = {}) {
    const { width = 640 } = o;
    const wrap = await col(parent, 'Tabs / underline', { gap: 0, sizingH: 'fixed', width });
    const tr = await row(wrap, 'Tab row', { gap: 28, crossAlign: 'max' });
    for (const it of items) {
      const on = it.label === active;
      const t = await col(tr, 'Tab / ' + it.label, { gap: 0 });
      const lr = await row(t, 'Tab label', { gap: 8, padding: [10, 0, 12, 0] });
      await text(lr, it.label, { type: on ? 'bodyStrong' : 'body', color: on ? T.text : T.textTertiary });
      if (it.count) {
        const chip = await row(lr, 'Count', { padding: [1, 7, 1, 7], fill: it.attention ? tint(T.waiting, 16) : T.surface3, cornerRadius: 10 });
        await text(chip, String(it.count), { type: 'mono', size: 12, color: it.attention ? T.waiting : T.textSecondary });
      }
      await rect(t, 'Underline', 10, 2, { fill: on ? T.accent : 'none', cornerRadius: 1 }).then((id) => call('set_properties', { ids: [id], props: { sizingH: 'fill', height: 2 } }));
    }
    await line(wrap);
    return wrap;
  }

  async function tabsSegmented(parent, items, active) {
    const track = await row(parent, 'Tabs / segmented', { gap: 4, padding: 4, fill: T.surface2, cornerRadius: 12, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
    for (const it of items) {
      const on = it === active;
      const seg = await row(track, 'Segment / ' + it, { padding: [0, 16, 0, 16], height: 36, sizingV: 'fixed', cornerRadius: 9, fill: on ? T.surface3 : 'none', mainAlign: 'center' });
      await text(seg, it, { type: on ? 'bodyStrong' : 'body', size: 14, color: on ? T.text : T.textTertiary });
    }
    return track;
  }

  // ---------- Plan bar (progress)
  async function planBar(parent, o = {}) {
    const { label, percent, note, width = 280 } = o;
    const warn = percent >= 80;
    const c = warn ? T.waiting : T.accent;
    const wrap = await col(parent, 'Plan bar / ' + label, { gap: 8, sizingH: 'fixed', width });
    const top = await row(wrap, 'Plan bar top', { sizingH: 'fill', mainAlign: 'spaceBetween' });
    await text(top, label, { type: 'small', color: T.textSecondary });
    await text(top, percent + '%', { type: 'monoStrong', color: warn ? T.waiting : T.text });
    const track = await frame(wrap, 'Track', { fill: T.surface3, cornerRadius: 4 }, { width, height: 8 });
    await rect(track, 'Fill', Math.max(8, Math.round((width * percent) / 100)), 8, { fill: c, cornerRadius: 4 });
    if (note) await text(wrap, note, { type: 'small', color: T.textTertiary });
    if (warn) {
      const r = await row(wrap, 'Warning', { gap: 6 });
      await glyph(r, 'waiting', 14, T.waiting);
      await text(r, 'Close to the limit', { type: 'smallStrong', color: T.waiting });
    }
    return wrap;
  }

  // ---------- Session row
  async function sessionRow(parent, o = {}) {
    const { role, title, state, age, cost, selected = false, hover = false, width = 380, showRole = true } = o;
    const r = await row(parent, 'Session row / ' + title, { gap: 12, padding: [0, 14, 0, 12], height: 64, sizingH: 'fixed', width, sizingV: 'fixed', cornerRadius: 12, fill: selected ? T.surface3 : hover ? T.surface2 : 'none' });
    await roleMark(r, role, 32);
    const mid = await col(r, 'Text', { gap: 2 });
    await call('set_properties', { ids: [mid], props: { sizingH: 'fill' } }).catch(() => {});
    const tt = await text(mid, title, { type: 'body' });
    await call('set_properties', { ids: [tt], props: { sizingH: 'fill' } }).catch(() => {});
    const sub = await row(mid, 'Sub', { gap: 6 });
    await glyph(sub, state, 14, hue(state));
    await text(sub, STATE_WORD[state], { type: 'small', color: hue(state) });
    await text(sub, '\u00b7 ' + (showRole ? role + ' \u00b7 ' : '') + age, { type: 'small', color: T.textTertiary });
    if (cost) await text(r, cost, { type: 'mono', color: T.textTertiary });
    return r;
  }

  // ---------- Dialogs
  async function codeBlock(parent, cmd, where) {
    const b = await col(parent, 'Command', { gap: 4, padding: 14, sizingH: 'fill', fill: T.inset, cornerRadius: 10, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside' });
    await text(b, cmd, { type: 'mono', size: 14, color: T.text });
    if (where) await text(b, where, { type: 'mono', color: T.textTertiary });
    return b;
  }

  async function permissionCard(parent, o = {}) {
    const { width = 560, floating = true } = o;
    const c = await col(parent, 'Permission card', { gap: 16, padding: 24, sizingH: 'fixed', width, fill: T.surface2, cornerRadius: 18, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', ...(floating ? { effects: SHADOW_OVERLAY } : {}) });
    const h = await row(c, 'Header', { gap: 12 });
    await glyph(h, 'waiting', 22, T.waiting);
    await text(h, 'Claude wants to run a command', { type: 'heading' });
    await text(c, 'It will list the files in this folder. It cannot change anything.', { type: 'body', color: T.textSecondary, fixedWidth: width - 48 });
    await codeBlock(c, 'ls -la', 'in D:\\projects\\shop-api');
    const f2 = await row(c, 'Footer', { sizingH: 'fill', mainAlign: 'spaceBetween' });
    await button(f2, 'Always allow here', { variant: 'ghost', size: 'sm' });
    const right = await row(f2, 'Answers', { gap: 12 });
    await button(right, 'Don\u2019t allow', { variant: 'quiet' });
    await button(right, 'Allow once', { variant: 'primary' });
    return c;
  }

  async function leftoverDialog(parent, o = {}) {
    const { width = 560 } = o;
    const c = await col(parent, 'Confirm dialog / stop server', { gap: 16, padding: 24, sizingH: 'fixed', width, fill: T.surface2, cornerRadius: 18, stroke: T.borderSubtle, strokeWeight: 1, strokeAlign: 'inside', effects: SHADOW_OVERLAY });
    const h = await row(c, 'Header', { gap: 12 });
    await glyph(h, 'left', 22, T.left);
    await text(h, 'Stop this server?', { type: 'heading' });
    await text(c, 'A PHP server is still running on port 3000. Kona started it two hours ago for the session \u201cFix the login redirect\u201d, and that session has ended.', { type: 'body', color: T.textSecondary, fixedWidth: width - 48 });
    await codeBlock(c, 'php -S localhost:3000', 'port 3000 \u00b7 pid 18244 \u00b7 started 2 h ago');
    const f2 = await row(c, 'Footer', { sizingH: 'fill', mainAlign: 'max', gap: 12 });
    if (o.buttons) await o.buttons(f2);
    else {
      await button(f2, 'Keep it running', { variant: 'quiet' });
      await button(f2, 'Stop it', { variant: 'danger' });
    }
    return c;
  }

  // ---------- Empty state
  async function emptyState(parent, o = {}) {
    const { width = 560 } = o;
    const c = await col(parent, 'Empty state', { gap: 20, sizingH: 'fixed', width });
    await text(c, 'Add your first project', { type: 'display' });
    await text(c, 'A project is one folder on this PC. Kona keeps its notes, tickets and sessions inside it, in a hidden folder that Git ignores.', { type: 'body', color: T.textSecondary, fixedWidth: width });
    const b = await row(c, 'Actions', { gap: 12 });
    await button(b, 'Add a project', { variant: 'primary', iconName: 'folder' });
    return c;
  }

  return { button, badge, field, select, menu, tabsUnderline, tabsSegmented, planBar, sessionRow, permissionCard, leftoverDialog, emptyState, codeBlock, line };
}
