// Starts a clean rebuild: forgets old ids and removes the draft pages that are being merged.
import { connect } from './fig.mjs';
import * as R from './reg.mjs';
R.reset();
const f = await connect(7979);
const d = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
await f.run('page.select', { id: d.pages.find((p) => p.name === 'Tokens').id });
for (const name of ['Parts 2', 'Screens 2', 'Scratch']) {
  const p = d.pages.find((x) => x.name === name);
  if (p) { await f.run('page.delete', { id: p.id }); console.log('deleted page', name); }
}
f.close();
