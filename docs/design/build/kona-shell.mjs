// The app shell shared by every screen: sidebar with project nav, then the page.
import { T, tint } from './kona-lib.mjs';
import { NAV, SESSIONS, TABS } from './kona-interactive.mjs';

export function makeShell(k, P, Q, I) {
  const { frame, row, col, text, rect, glyph, call } = k;

  async function vrule(parent) {
    const id = await rect(parent, 'Divider', 1, 10, { fill: T.borderSubtle });
    await call('set_properties', { ids: [id], props: { width: 1, sizingV: 'fill' } });
    return id;
  }
  const spacer = (parent) => frame(parent, 'Spacer', { layout: 'vertical', sizingH: 'fill', sizingV: 'fill' });
  async function screen(name, x, y, w = 1440, h = 900) {
    const id = await frame(undefined, name, { x, y, width: w, height: h, layout: 'horizontal', sizingH: 'fixed', sizingV: 'fixed', fill: T.ground, clip: true, crossAlign: 'min' });
    I.registerScreen(name, id);
    return id;
  }

  async function wordmark(parent) {
    const w = await row(parent, 'Wordmark', { gap: 10 });
    await glyph(w, 'live', 24, T.accent);
    await text(w, 'Kona', { type: 'title' });
    return w;
  }

  // The collapsed sidebar: a 72 px rail that keeps the Kona mark, the project, every place, the plan meters and Settings.
  // railDest says where each place leads (a collapsed twin if one exists); expandTo is the screen the unfold button leads to.
  async function railSidebar(parent, active, o = {}) {
    const { badges = true, noProject = false, railDest = {}, expandTo } = o;
    const sb = await frame(parent, 'Sidebar (collapsed)', { layout: 'vertical', sizingH: 'fixed', width: 72, sizingV: 'fill', fill: T.surface1, padding: [28, 12, 22, 12], gap: 14, crossAlign: 'center', clip: false });
    await glyph(sb, 'live', 28, T.accent);
    await I.sidebarToggle(sb, 'expand', expandTo);
    if (!noProject) {
      const proj = await row(sb, 'Project switcher', { padding: 0, height: 44, width: 48, sizingH: 'fixed', sizingV: 'fixed', cornerRadius: 10, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside', fill: 'none', mainAlign: 'center' });
      await Q.icon2(proj, 'folder', 18, T.textSecondary);
      const nav = await col(sb, 'Navigation', { gap: 4, sizingH: 'fill', crossAlign: 'center', clip: false });
      for (const [label] of NAV) await I.railItem(nav, label, label === active, badges, railDest);
    }
    await spacer(sb);
    if (!noProject) {
      const bars = await col(sb, 'Plan', { gap: 14, crossAlign: 'center' });
      for (const [label, pct] of [['This session', 12], ['This week', 35]]) {
        const m = await col(bars, 'Plan meter / ' + label, { gap: 5, crossAlign: 'center' });
        await text(m, pct + '%', { type: 'mono', size: 11.5, color: T.text });
        const track = await frame(m, 'Track', { fill: T.surface3, cornerRadius: 3 }, { width: 40, height: 6 });
        await rect(track, 'Fill', Math.max(5, Math.round(40 * pct / 100)), 6, { fill: T.accent, cornerRadius: 3 });
      }
    }
    const key = 'Rail / Settings';
    const sid = await I.inst(sb, key, active === 'Settings' ? 'State=active' : 'State=default');
    I.link(sid, [
      ...(active === 'Settings' ? [] : [
        { trigger: { type: 'mouseEnter' }, action: { type: 'changeTo', destId: I.reg.sets[key].variants['State=hover'] } },
        { trigger: { type: 'mouseLeave' }, action: { type: 'changeTo', destId: I.reg.sets[key].variants['State=default'] } },
      ]),
      I.nav('11 Settings'),
    ]);
    return sb;
  }

  // active: nav label or 'Settings'. badges: show the counts on Sessions and Leftovers.
  // collapseTo: the screen the fold button leads to (none: the button is drawn but not wired).
  async function sidebar(parent, active, o = {}) {
    const { badges = true, project = 'shop-api', noProject = false, collapseTo } = o;
    if (o.collapsed) return railSidebar(parent, active, o);
    const sb = await frame(parent, 'Sidebar', { layout: 'vertical', sizingH: 'fixed', width: 248, sizingV: 'fill', fill: T.surface1, padding: [28, 14, 22, 14], gap: 20, clip: false });
    const brand = await row(sb, 'Brand pad', { padding: [0, 6, 0, 6], sizingH: 'fill', mainAlign: 'spaceBetween', clip: false });
    await wordmark(brand);
    if (!noProject) await I.sidebarToggle(brand, 'collapse', collapseTo);
    if (noProject) {
      const pr = await col(sb, 'Projects', { gap: 10, padding: [0, 6, 0, 6] });
      await text(pr, 'Projects', { type: 'bodyStrong', color: T.textSecondary });
      await text(pr, 'None yet.', { type: 'small', color: T.textTertiary });
    } else {
      const proj = await row(sb, 'Project switcher', { gap: 10, padding: [0, 12, 0, 12], height: 44, sizingH: 'fill', sizingV: 'fixed', cornerRadius: 10, stroke: T.borderStrong, strokeWeight: 1, strokeAlign: 'inside', fill: 'none' });
      await Q.icon2(proj, 'folder', 16, T.textSecondary);
      await text(proj, project, { type: 'bodyStrong', sizingH: 'fill' });
      await Q.icon2(proj, 'chevronD', 16, T.textSecondary);
      const nav = await col(sb, 'Navigation', { gap: 2, sizingH: 'fill' });
      for (const [label] of NAV) await I.navItem(nav, label, label === active, badges);
    }
    await spacer(sb);
    if (!noProject) {
      const bars = await col(sb, 'Plan', { gap: 16, sizingH: 'fill', padding: [0, 6, 0, 6] });
      await P.planBar(bars, { label: 'This session', percent: 12, width: 208 });
      await P.planBar(bars, { label: 'This week', percent: 35, width: 208 });
    }
    const key = 'Nav / Settings';
    const sid = await I.inst(sb, key, active === 'Settings' ? 'State=active' : 'State=default');
    I.link(sid, [
      ...(active === 'Settings' ? [] : [
        { trigger: { type: 'mouseEnter' }, action: { type: 'changeTo', destId: I.reg.sets[key].variants['State=hover'] } },
        { trigger: { type: 'mouseLeave' }, action: { type: 'changeTo', destId: I.reg.sets[key].variants['State=default'] } },
      ]),
      I.nav('11 Settings'),
    ]);
    return sb;
  }

  async function pageHeader(parent, title, sub) {
    const hd = await row(parent, 'Page header', { gap: 16, padding: [26, 32, 20, 32], sizingH: 'fill', mainAlign: 'spaceBetween', crossAlign: 'center' });
    const l = await col(hd, 'Titles', { gap: 4 });
    await text(l, title, { type: 'title' });
    if (sub) await text(l, sub, { type: 'small', color: T.textTertiary });
    const r = await row(hd, 'Actions', { gap: 12 });
    return { hd, actions: r };
  }

  // Session list column used by the Sessions page.
  async function sessionColumn(parent, o = {}) {
    const { selected = SESSIONS[0].key, list: rows = SESSIONS } = o;
    const c = await frame(parent, 'Session list', { layout: 'vertical', sizingH: 'fixed', width: 320, sizingV: 'fill', fill: T.ground, padding: [24, 10, 20, 10], gap: 14 });
    const hd = await row(c, 'Head', { sizingH: 'fill', mainAlign: 'spaceBetween', padding: [0, 10, 0, 10] });
    await text(hd, 'Sessions', { type: 'heading' });
    await I.button(hd, 'new-session', '13 New session');
    const list = await col(c, 'List', { gap: 2, sizingH: 'fill' });
    for (const s of rows) await I.sessionRow(list, s, s.key === selected);
    await spacer(c);
    await text(c, 'Two sessions at once. A third waits.', { type: 'small', color: T.textTertiary, sizingH: 'fill' });
    return c;
  }

  async function sessionHeader(parent, o = {}) {
    const { role = 'Backend', title = 'Fix the login redirect', state = 'waiting', ticket = 'T-0012', branch = 'fix/login-redirect', cost = '$0.42 so far' } = o;
    const hd = await row(parent, 'Session header', { gap: 16, padding: [22, 32, 18, 32], sizingH: 'fill', mainAlign: 'spaceBetween', crossAlign: 'center' });
    const hl = await row(hd, 'Left', { gap: 16 });
    await k.roleMark(hl, role, 44);
    const ht = await col(hl, 'Titles', { gap: 6 });
    await text(ht, title, { type: 'title' });
    const hs = await row(ht, 'Facts', { gap: 12 });
    await P.badge(hs, state);
    await text(hs, role, { type: 'small', color: T.textSecondary });
    await text(hs, ticket, { type: 'mono', color: T.textTertiary });
    await text(hs, branch, { type: 'mono', color: T.textTertiary });
    const hr = await col(hd, 'Cost', { gap: 2, crossAlign: 'max' });
    await text(hr, cost, { type: 'monoStrong', size: 14 });
    await text(hr, 'An estimate, not your bill', { type: 'small', color: T.textTertiary });
    return hd;
  }

  async function sessionTabs(parent, active) {
    const host = await frame(parent, 'Tabs host', { layout: 'vertical', padding: [0, 32, 0, 32], sizingH: 'fill', sizingV: 'hug' });
    const wrap = await col(host, 'Tabs / underline', { gap: 0, sizingH: 'fill' });
    const tr = await row(wrap, 'Tab row', { gap: 28, crossAlign: 'max' });
    for (const [label] of TABS) await I.tab(tr, label, label === active);
    await P.line(wrap);
    return host;
  }

  return { vrule, spacer, screen, wordmark, sidebar, railSidebar, pageHeader, sessionColumn, sessionHeader, sessionTabs };
}
