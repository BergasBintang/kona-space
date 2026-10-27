import { connect } from './fig.mjs';
import { makeKit, T } from './kona-lib.mjs';
import { makeParts } from './kona-parts.mjs';
import { makeParts2 } from './kona-parts2.mjs';
import { makeInteractive } from './kona-interactive.mjs';

const f = await connect(7979);
const k = makeKit(f);
const P = makeParts(k);
const Q = makeParts2(k, P);
const I = makeInteractive(k, P, Q, f);
const d = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
await f.run('page.select', { id: d.pages.find((x) => x.name === 'Parts').id });
const stage = await k.frame(undefined, 'Interactive parts', {
  x: 3200, y: 0, width: 1440, layout: 'vertical', gap: 64, padding: [72, 80, 88, 80],
  fill: T.ground, sizingH: 'fixed', sizingV: 'hug', crossAlign: 'min',
});
const head = await k.col(stage, 'Title block', { gap: 12 });
await k.text(head, 'Interactive parts', { type: 'display' });
await k.text(head, 'The parts that react in the prototype. Each is a component with a resting look and a hover look, and the screens use copies of them. Change one here and every screen follows.', { type: 'body', color: T.textSecondary, fixedWidth: 820 });
await I.buildAll(stage);
console.log('components built', Object.keys(I.reg.sets).length, 'sets');
f.close();
