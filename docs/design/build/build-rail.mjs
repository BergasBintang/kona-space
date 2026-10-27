// The collapsed sidebar (design version 3).
//   1. the rail items and the fold / unfold buttons as component sets (if the Parts page does not have them yet)
//   2. a fold button in the sidebar of every screen that has a project (if the shell did not draw it already)
//   3. collapsed twins of two screens (Chat and the Brain map): a copy of the screen whose sidebar is replaced by the rail
// It runs LAST (after build-wire) and attaches its own links, so it is safe to run on its own in an open file:
//   node build-rail.mjs
// KONA_SHOTS=<folder> also writes a PNG of each twin there.
import fs from 'node:fs';
import { connect } from './fig.mjs';
import { makeKit, T } from './kona-lib.mjs';
import { makeParts } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';
import { makeShell } from './kona-shell.mjs';
import { makeInteractive } from './kona-interactive.mjs';

const SHOTS = process.env.KONA_SHOTS;
const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
const Q = makeParts2(k, P);
const I = makeInteractive(k, P, Q, f);
const S = makeShell(k, P, Q, I);
const reg = I.reg;
const knownLinks = new Set(reg.pending.map((p) => p.id));
reg.railLinked ??= [];
const page = async (name) => {
  const d = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
  await f.run('page.select', { id: d.pages.find((p) => p.name === name).id });
};

// which collapsed twin a screen's fold button leads to
const TWIN_OF = { '1 Sessions / Chat': '1 Sessions / Chat, collapsed', '1b Chat, answered yes': '1 Sessions / Chat, collapsed', '1c Chat, answered no': '1 Sessions / Chat, collapsed' };
const twinFor = (name) => TWIN_OF[name] ?? (name.split(' ')[0].startsWith('10') ? '10 Brain, collapsed' : undefined);
const TWINS = [['1 Sessions / Chat', '1 Sessions / Chat, collapsed', 'Sessions', true], ['10 Brain', '10 Brain, collapsed', 'Brain', true]];
const RAIL_DEST = { Sessions: '1 Sessions / Chat, collapsed', Brain: '10 Brain, collapsed' };

// ---------- 1. the sets
await page('Parts');
if (!reg.sets['Rail / Sessions']) {
  const top = (await f.tool('inspect_document', { depth: 1 })).json;
  const parts = top.pages.find((p) => p.name === 'Parts');
  const stage = (parts.children ?? []).find((c) => c.name === 'Interactive parts');
  if (!stage) throw new Error('no Interactive parts frame on the Parts page');
  await I.buildRail(stage.id);
  console.log('rail sets built');
}
await page('Screens');

// tooltips sit outside their component, so the components must not clip
for (const [key, st] of Object.entries(reg.sets)) if (key.startsWith('Rail / ') || key.startsWith('Sidebar / ')) await k.call('set_properties', { ids: Object.values(st.variants), props: { clip: false } });

// ---------- 2. a fold button in each sidebar
const expanded = Object.entries(reg.screens).filter(([n]) => !n.endsWith(', collapsed'));
let patched = 0;
for (const [name, id] of expanded) {
  const g = (await f.tool('get_node', { id, depth: 3 })).json;
  const sb = (g.children ?? []).find((c) => c.name === 'Sidebar');
  if (!sb) continue;
  if (!(sb.children ?? []).some((c) => c.name === 'Project switcher')) continue; // first-run screens have no project yet
  const brand = (sb.children ?? []).find((c) => c.name === 'Brand pad');
  if (!brand) continue;
  await k.call('set_properties', { ids: [sb.id, brand.id], props: { clip: false } }); // so the fold button's tooltip can show
  const dest = twinFor(name);
  if ((brand.children ?? []).length >= 2) {
    const tg = brand.children[brand.children.length - 1].id;
    if (dest && !reg.railLinked.includes(tg)) { I.clickTo(tg, dest); reg.railLinked.push(tg); }
    continue;
  }
  await k.call('set_properties', { ids: [brand.id], props: { sizingH: 'fill', mainAlign: 'spaceBetween' } });
  const tg = await I.sidebarToggle(brand.id, 'collapse', dest);
  if (dest) reg.railLinked.push(tg);
  patched++;
}
I.persist();
console.log('fold buttons added', patched);

// the twin is wider than its source: stretch the tab line, and let the rail's tooltips show outside it
const fixTwin = async (id) => {
  const g = (await f.tool('get_node', { id, depth: 6 })).json;
  const noClip = [], wide = [];
  (function w(n) { if (['Sidebar (collapsed)', 'Navigation'].includes(n.name)) noClip.push(n.id); if (n.name === 'Tabs / underline') wide.push(n.id); (n.children ?? []).forEach(w); })(g);
  if (noClip.length) await k.call('set_properties', { ids: noClip, props: { clip: false } });
  if (wide.length) await k.call('set_properties', { ids: wide, props: { sizingH: 'fill' } });
};

// ---------- 3. the twins
const findChild = async (id, name) => ((await f.tool('get_node', { id, depth: 1 })).json.children ?? []).find((c) => c.name === name);
let y = 0;
for (const [src, twin, active, badges] of TWINS) {
  const srcId = reg.screens[src];
  if (!srcId) { console.log('missing source', src); continue; }
  if (reg.screens[twin] && !process.env.REBUILD_TWINS) { await fixTwin(reg.screens[twin]); console.log('kept', twin); y += 900 + 120; continue; }
  if (reg.screens[twin]) { await f.run('edit.delete', { ids: [reg.screens[twin]] }).catch(() => {}); delete reg.screens[twin]; reg.railLinked = []; }
  const dup = await f.run('edit.duplicate', { ids: [srcId] });
  const newId = dup.json?.ids?.[0] ?? dup.json?.id ?? dup.json?.created?.[0] ?? dup.json?.duplicated?.[0];
  if (newId == null) throw new Error('duplicate gave no id: ' + dup.text.slice(0, 200));
  await k.call('set_properties', { ids: [newId], props: { name: twin, x: 8000, y } });
  const old = await findChild(newId, 'Sidebar');
  if (old) await f.run('edit.delete', { ids: [old.id] });
  const rail = await S.railSidebar(newId, active, { badges, railDest: RAIL_DEST, expandTo: src });
  await f.run('node.reorder', { id: rail, index: 0 });
  I.registerScreen(twin, newId);
  await fixTwin(newId);
  y += 900 + 120;
}
await k.text(undefined, 'Collapsed sidebar', { type: 'display' }).then((id) => k.call('set_properties', { ids: [id], props: { x: 8000, y: -150 } }));

// the twins that now exist are where the fold buttons lead: attach those that were waiting
await I.applyPending(knownLinks);
if (SHOTS) {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [, twin] of TWINS) await k.shot([reg.screens[twin]], SHOTS + '/' + twin.split(' ')[0] + '-collapsed.png', 1);
}
console.log((await f.run('file.save', {})).text);
f.close();
