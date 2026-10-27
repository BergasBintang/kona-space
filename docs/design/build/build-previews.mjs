// Writes a PNG preview of every screen and part frame into docs/design/previews.
import fs from 'node:fs';
import { connect } from './fig.mjs';
import { makeKit } from './kona-lib.mjs';
import * as R from './reg.mjs';
const f = await connect(7979); const k = makeKit(f); const reg = R.load();
const OUT = new URL('../previews/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
fs.mkdirSync(OUT, { recursive: true });
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const [name, id] of Object.entries(reg.screens)) { await k.shot([id], OUT + slug(name) + '.png', 1); }
const d = (await f.tool('inspect_document', { depth: 1, allPages: true })).json;
for (const pn of ['Tokens', 'Parts']) {
  const pg = d.pages.find((p) => p.name === pn); await f.run('page.select', { id: pg.id });
  const dd = (await f.tool('inspect_document', { depth: 1 })).json;
  for (const c of dd.pages.find((p) => p.id === pg.id).children ?? []) await k.shot([c.id], OUT + 'part-' + slug(c.name) + '.png', 1, 4000);
}
console.log('previews done');
f.close();
