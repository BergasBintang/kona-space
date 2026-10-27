// Last step: put the screens in a tidy grid, attach every prototype link, mark where the flows start, save.
import { connect } from './fig.mjs';
import { makeKit, T } from './kona-lib.mjs';
import * as R from './reg.mjs';

const f = await connect(7979);
const k = makeKit(f);
const reg = R.load();
const d = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
await f.run('page.select', { id: d.pages.find((x) => x.name === 'Screens').id });

// ---------- 1. grid
import { COLS } from './layout.mjs';
for (const col of COLS) {
  let y = 0;
  await k.text(undefined, col.title, { type: 'display', props: {} }).then((id) => k.call('set_properties', { ids: [id], props: { x: col.x, y: -150 } }));
  for (const n of col.names) {
    const id = reg.screens[n];
    if (!id) { console.log('missing screen', n); continue; }
    const g = (await f.tool('get_node', { id, depth: 0 })).json;
    await k.call('set_properties', { ids: [id], props: { x: col.x, y } });
    y += (g.height ?? 900) + 120;
  }
}
const placed = new Set(COLS.flatMap((c) => c.names));
for (const n of Object.keys(reg.screens)) if (!placed.has(n)) console.log('not placed:', n);

// ---------- 2. links
let ok = 0, bad = 0;
for (const p of reg.pending) {
  for (const it of p.interactions) {
    const action = { ...it.action };
    if (action.destKey) { action.dest = reg.screens[action.destKey]; if (!action.dest) { console.log('no screen for', action.destKey); bad++; continue; } delete action.destKey; }
    if (action.destId) { action.dest = action.destId; delete action.destId; }
    try {
      await f.run('proto.interaction.add', { id: p.id, trigger: it.trigger, action, ...(it.transition ? { transition: it.transition } : {}), ...(it.durationMs ? { durationMs: it.durationMs } : {}) });
      ok++;
    } catch (e) { bad++; console.log('link failed', p.id, JSON.stringify(it.trigger), String(e).slice(0, 160)); }
  }
}
console.log('links added', ok, 'failed', bad);

// ---------- 3. flows and presenting
const flows = [['F1 Welcome', 'First time you open Kona'], ['F2b Claude is missing', 'Claude Code is not installed'], ['F2e Not signed in', 'You are not signed in'], ['1 Sessions / Chat', 'A session asks for permission'], ['3 Board', 'The board and a ticket'], ['8 Roles', 'Roles and permission modes'], ['10 Brain', 'Ask the brain']];
for (const [n, name] of flows) await f.run('proto.flow.add', { start: reg.screens[n], name }).catch((e) => console.log('flow', n, String(e).slice(0, 120)));
await f.run('proto.settings', { device: 'Custom size', width: 1440, height: 900 }).catch((e) => console.log('settings', String(e).slice(0, 160)));
await f.run('proto.presentOptions', { scale: 'fit', deviceFrame: false, hotspotHints: true, inspect: false }).catch((e) => console.log('present opts', String(e).slice(0, 160)));
console.log((await f.run('file.save', {})).text);
f.close();
