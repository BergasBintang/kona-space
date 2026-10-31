// A test of the map maker in the real window (see smoke.mjs for how to start Kona). It moves a cat's desk, saves the map in the open project, reads the file back through Kona,
// reloads the window, checks the map survived, and then removes the project's map again ("Use the standard office"). It refuses to run when the project already has a map of
// its own, so it never touches work of yours. It writes and removes only `.kona/office-map.json` of the first project.
import { attach } from './cdp.mjs';

const c = await attach(Number(process.env.PORT ?? 9223));
let failed = 0;
const ok = (name, v) => { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) failed++; };
const invoke = (cmd, args) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then((v) => JSON.stringify(v ?? null))`).then((t) => JSON.parse(t));
const press = (label) => c.ev(`(() => { const b = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
const text = (t) => c.ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(t)} && !x.disabled); if (!b) return false; b.click(); return true; })()`);
const tool = (label) => c.ev(`(() => { const b = [...document.querySelectorAll('aside[aria-label="Tools"] button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`);
const mouse = (type, x, y) => c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const planBox = () => c.ev(`(() => { const r = document.querySelector('canvas[aria-label^="The plan"]').getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
const CS = 16;
const cellXY = async (i, j) => { const b = await planBox(); return [b.x + i * CS + CS / 2, b.y + j * CS + CS / 2]; };
const enter = async () => {
  await c.waitFor(`document.body.innerText.includes('Welcome to Kona') || document.querySelectorAll('svg path[role=button]').length >= 10`, 30000, 200);
  if (await c.ev(`document.body.innerText.includes('Welcome to Kona')`)) await text('Open');
  return c.waitFor(`document.querySelectorAll('svg path[role=button]').length >= 10`, 30000, 200);
};

ok('the project opens', await enter());
const project = (await invoke('list_projects', {}))[0];
ok('there is a project to try it on', !!project);
if ((await invoke('office_map_load', { folder: project.folder })) !== null) { console.log('This project already has a map of its own: not touching it.'); c.close(); process.exit(2); }

ok('the editor opens', await press('Edit the office') && await c.waitFor(`!!document.querySelector('canvas[aria-label^="The plan"]')`, 5000, 100));
// the secretary's desk (a wide desk with its chair: a block of 2 by 2): find its tile in the standard map and drag it two tiles to the right
const standard = JSON.parse(await c.ev(`fetch('/src/office/standard.json').then((r) => r.text())`));
const desk = standard.objects.find((o) => o.kind === 'workstation' && o.role === 'secretary');
await tool('Select and move');
const [x0, y0] = await cellXY(desk.i, desk.j), [x1, y1] = await cellXY(desk.i + 2, desk.j);
await mouse('mouseMoved', x0, y0); await mouse('mousePressed', x0, y0); await mouse('mouseMoved', (x0 + x1) / 2, y0); await mouse('mouseMoved', x1, y1); await mouse('mouseReleased', x1, y1);
await c.sleep(500);
ok('the thing is picked and moved as one (the cat and its desk)', await c.ev(`document.body.innerText.includes('Cat and desk') && document.body.innerText.includes('Not saved yet')`));
ok('Save is offered and works', await text('Save') && await c.waitFor(`document.body.innerText.includes('Saved the office of this project.')`, 5000, 100));
const saved = await invoke('office_map_load', { folder: project.folder });
ok('the map is in the project folder, as text', typeof saved === 'string' && saved.startsWith('{"version":1'));
const m = JSON.parse(saved), moved = m.objects.find((o) => o.kind === 'workstation' && o.role === 'secretary');
ok('the desk is two tiles further right in the saved map', moved && moved.i === desk.i + 2 && moved.j === desk.j);
ok('nothing else moved', m.objects.length === standard.objects.length && m.cols === standard.cols && m.rows === standard.rows);
await press('Close (Esc)');
ok('the editor closes without asking after a save', await c.waitFor(`!document.querySelector('canvas[aria-label^="The plan"]') && !!document.querySelector('canvas[aria-label^="The Kona office"]')`, 3000, 100));

// the map survives a reload of the window
await c.send('Page.reload'); await c.sleep(1500);
ok('the project opens again after a reload', await enter());
ok('the office is drawn from the saved map, with no complaint', await c.ev(`!document.body.innerText.includes('could not be read')`));
ok('Edit the office says it is this project\'s own office', await press('Edit the office') && await c.waitFor(`document.body.innerText.includes("This project's own office")`, 5000, 100));

// back to the standard office
ok('"Use the standard office" asks first', await text('Use the standard office') && await c.waitFor(`!!document.querySelector('[role=dialog][aria-label="Use the standard office again?"]')`, 3000, 100));
await c.ev(`(() => { [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Use the standard office').click(); return true; })()`);
ok('the file is gone from the project', await c.waitFor(`document.body.innerText.includes('The standard office')`, 5000, 100) && (await invoke('office_map_load', { folder: project.folder })) === null);
await press('Close (Esc)');
await c.sleep(300);
c.close();
process.exit(failed ? 1 : 0);
