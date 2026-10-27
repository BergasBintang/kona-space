// Makes every screen a fixed 1440 x 900 window whose content scrolls when it is taller or wider, then tidies the grid.
import { connect } from './fig.mjs';
import { makeKit } from './kona-lib.mjs';
import { COLS } from './layout.mjs';
import * as R from './reg.mjs';

const f = await connect(7979);
const k = makeKit(f);
const reg = R.load();
const d = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
await f.run('page.select', { id: d.pages.find((x) => x.name === 'Screens').id });

// [screen name starts with, frame name (exact or prefix*), overflow, make it fill the height?]
const RULES = [
  ['1', 'Transcript', 'vertical', true], ['S3', 'Transcript', 'vertical', true],
  ['1', 'List', 'vertical', true], ['2', 'Changed files', 'vertical', false], ['2', 'Diff', 'vertical', true],
  ['3', 'Columns', 'horizontal', false], ['3', 'Column / *', 'vertical', false],
  ['5', 'Tree panel', 'vertical', false], ['5', 'Code', 'both', false],
  ['6', 'Body', 'vertical', true], ['7', 'Body', 'vertical', true], ['9 ', 'Body', 'vertical', true], ['10', 'Body', 'vertical', true], ['11', 'Body', 'vertical', true],
  ['10a', 'Body', 'vertical', true], ['10b', 'Body', 'vertical', true], ['10c', 'Body', 'vertical', true], ['10d', 'Body', 'vertical', true], ['10e', 'Body', 'vertical', true],
  ['8', 'Role list', 'vertical', false], ['8', 'Editor', 'vertical', false],
];
const walk = async (node, fn) => { await fn(node); for (const c of node.children ?? []) await walk(c, fn); };
let n = 0;
const only = process.argv[2]; // optional: only the screens whose name starts with this
for (const [name, id] of Object.entries(reg.screens)) {
  if (only && !name.startsWith(only)) continue;
  const g = (await f.tool('get_node', { id, depth: 14 })).json;
  if (g.height !== 900) await k.call('set_properties', { ids: [id], props: { height: 900 } });
  await k.call('set_properties', { ids: [id], props: { overflow: 'none' } });
  const rules = RULES.filter(([s]) => (s.endsWith(' ') ? name.startsWith(s) : name.split(' ')[0] === s));
  await walk(g, async (nd) => {
    for (const [, fname, ov, fillV] of rules) {
      const hit = fname.endsWith('*') ? nd.name.startsWith(fname.slice(0, -1)) : nd.name === fname;
      if (!hit || nd.type !== 'FRAME') continue;
      await k.call('set_properties', { ids: [nd.id], props: { overflow: ov, ...(fillV ? { sizingV: 'fill' } : {}) } });
      n++;
    }
  });
}
console.log('scroll areas set', n);
// regrid with the true heights
for (const col of COLS) {
  let y = 0;
  for (const nm of col.names) {
    const id = reg.screens[nm]; if (!id) continue;
    const g = (await f.tool('get_node', { id, depth: 0 })).json;
    await k.call('set_properties', { ids: [id], props: { x: col.x, y } });
    y += (g.height ?? 900) + 120;
  }
}
console.log((await f.run('file.save', {})).text);
f.close();
