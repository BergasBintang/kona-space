// A smoke test of the real window, driven over the DevTools port (this PC only). Start Kona first with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223
// (the development window or the release program), have at least one project added with a signed-in account, then run:  node tests/smoke.mjs
// It checks the welcome page, opens the first project, checks the office is drawn, opens every screen by clicking its piece of furniture or board, opens a person and
// each tab of their sheet, checks that each one draws and that the sheet closes with the X button and with Esc, and checks nothing is blocked by the content policy.
// It changes nothing and starts no session. Rewritten for 0.27.0, when rooms stopped being clickable.
import { attach } from './cdp.mjs';
import { buildScene } from '../src/office/engine/scene.ts';
import { STANDARD, parseMap } from '../src/office/map.ts';

const c = await attach(Number(process.env.PORT ?? 9223));
let failed = 0;
const ok = (name, v) => { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) failed++; };
const click = (label) => c.ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}) && !x.disabled); if (!b) return false; b.click(); return true; })()`);
// open a screen or a person: click the piece or the cat, which is named "Open ..."
const open = (name) => c.ev(`(async () => {
  const el = document.querySelector('[aria-label=' + JSON.stringify('Open ' + ${JSON.stringify(name)}) + ']');
  if (!el) return false;
  if (el.click) el.click(); else el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));
  return !!document.querySelector('section[data-sheet]');
})()`);
const clickTool = (label) => c.ev(`(() => { const b = [...document.querySelectorAll('aside[aria-label="Tools"] button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}) && !x.disabled); if (!b) return false; b.click(); return true; })()`);
const closeX = () => c.ev(`(() => { const b = document.querySelector('section button[aria-label^="Close"]'); if (!b) return false; b.click(); return true; })()`);
const turnOff = () => c.ev(`[...document.querySelectorAll('[aria-label^="Turn the building to"]')].every((b) => b.disabled)`);

await c.ev(`window.__v = []; window.addEventListener('securitypolicyviolation', (e) => window.__v.push(e.violatedDirective + ' ' + e.blockedURI)); true`);
if (await c.ev(`document.querySelectorAll('[aria-label^="Open "]').length >= 10`)) console.log('SKIP the welcome page and the project card: Kona is already inside the project');
else {
  ok('the welcome page is drawn', await c.waitFor(`document.body.innerText.includes('Welcome to Kona')`, 15000, 200));
  ok('a project card opens', await c.waitFor(`[...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Open' && !x.disabled)`, 15000, 200) && await click('Open'));
}
ok('the top bar is drawn', await c.waitFor(`!!document.querySelector('header')`, 15000, 200));
ok('the office is drawn with its people and pieces', await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 22`, 15000, 200));
ok('Kibby, the office boy, is in the office', await c.waitFor(`!!document.querySelector('button[aria-label^="Talk to Kibby"]')`, 10000, 200));
ok('there is no Go to list in the top bar', await c.ev(`!document.querySelector('header [aria-label="Go to"]')`));
const pages = ['Board', 'Meeting', 'Worktrees', 'Brain', 'Files', 'Mockups', 'Leftovers', 'Costs', 'Settings', 'Connections', 'Accounts'];
for (const page of pages) {
  const went = await open(page);
  await c.sleep(900);
  const text = await c.ev(`document.body.innerText.length`);
  ok(`${page} opens in the sheet and draws`, went && text > 80 && await c.ev(`document.querySelector('section[data-sheet]').getAttribute('aria-label') === ${JSON.stringify(page)}`));
  if (page === 'Board') ok('the building cannot be turned while the sheet is open', await turnOff());
  ok(`${page} closes with the X button`, await closeX() && await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100));
}
// a person: the sheet opens on Chat, and each tab draws
ok('a person opens in the sheet', await open('Kiki, Product'));
await c.sleep(800);
for (const tab of ['History', 'Skills', 'Tools', 'Set up', 'Chat']) {
  const on = await click(tab);
  await c.sleep(500);
  ok(`the tab ${tab} draws`, on && await c.ev(`document.querySelector('section[data-sheet]').innerText.length > 60`));
}
ok('the person closes with the X button', await closeX() && await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100));
await open('Brain');
await c.sleep(500);
await c.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
ok('Esc closes the sheet', await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100));
ok('the turn buttons work again', !(await c.ev(`[...document.querySelectorAll('[aria-label^="Turn the building to"]')].some((b) => b.disabled)`)));

// ---- the map: its own zoom, the wheel, Shift and the wheel, Ctrl and drag, Center
const mapBox = () => c.ev(`(() => { const cv = document.querySelector('canvas[aria-label^="The Kona office"]'); const r = cv.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, dpr: window.devicePixelRatio }; })()`);
const wheelOn = (dx, dy, shift) => c.ev(`(() => { const box = document.querySelector('canvas[aria-label^="The Kona office"]').parentElement.parentElement; box.dispatchEvent(new WheelEvent('wheel', { deltaX: ${dx}, deltaY: ${dy}, shiftKey: ${shift}, bubbles: true, cancelable: true })); return true; })()`);
const press = (label) => c.ev(`(() => { const b = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
let m0 = await mapBox();
ok('the map is drawn at a whole number of screen pixels for each pixel of the drawing', Math.abs((m0.w * m0.dpr) / (await c.ev(`document.querySelector('canvas[aria-label^="The Kona office"]').width`)) % 1) < 0.001);
const ctrlWheel = (dy) => c.ev(`(() => { const box = document.querySelector('canvas[aria-label^="The Kona office"]').parentElement.parentElement; const r = box.getBoundingClientRect(); box.dispatchEvent(new WheelEvent('wheel', { deltaY: ${dy}, ctrlKey: true, clientX: r.x + 200, clientY: r.y + 200, bubbles: true, cancelable: true })); return true; })()`);
ok('there are no zoom buttons: Ctrl and the wheel zoom', !(await press('Zoom the map in (+)')) && !(await press('Zoom the map out (-)')));
await ctrlWheel(-100); await c.sleep(300);
const m1 = await mapBox();
ok('Ctrl and the wheel up makes the map bigger', m1.w > m0.w);
await ctrlWheel(100); await c.sleep(300);
ok('Ctrl and the wheel down brings it back', Math.abs((await mapBox()).w - m0.w) < 1);
await wheelOn(0, 120, false); await c.sleep(200);
const m2 = await mapBox();
ok('the wheel moves the map up and down only', m2.y < m0.y - 1 && Math.abs(m2.x - m0.x) < 1);
await wheelOn(0, 120, true); await c.sleep(200);
const m3 = await mapBox();
ok('Shift and the wheel move it left and right only', m3.x < m2.x - 1 && Math.abs(m3.y - m2.y) < 1);
await c.ev(`(() => { const box = document.querySelector('canvas[aria-label^="The Kona office"]').parentElement.parentElement; const r = box.getBoundingClientRect(); const o = { pointerId: 7, bubbles: true, cancelable: true, ctrlKey: true, button: 0, isPrimary: true };
  box.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: r.x + 300, clientY: r.y + 300 })); box.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: r.x + 340, clientY: r.y + 330 })); box.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: r.x + 340, clientY: r.y + 330 })); return true; })()`);
await c.sleep(200);
const m4 = await mapBox();
ok('Ctrl and the left button drag the map with the hand', m4.x > m3.x + 5 && m4.y > m3.y + 5);
ok('the end of a drag does not open anything', !(await c.ev(`!!document.querySelector('section[data-sheet]')`)));
await press('Center the map on the secretary'); await c.sleep(300);
const view = Number(await c.ev(`localStorage.getItem('kona.office.view') || '0'`)), own = await c.ev(`window.__TAURI_INTERNALS__.invoke('list_projects', {}).then((ps) => window.__TAURI_INTERNALS__.invoke('office_map_load', { folder: ps[0].folder }))`), shown = own ? (parseMap(own).map ?? STANDARD) : STANDARD, cat = buildScene(shown, view).cats.find((x) => x.role === 'secretary');
const where = await c.ev(`(() => { const cv = document.querySelector('canvas[aria-label^="The Kona office"]'); const r = cv.getBoundingClientRect(); const box = cv.parentElement.parentElement.getBoundingClientRect(); return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, k: r.width / cv.width, x: r.x, y: r.y }; })()`);
ok('Center puts the secretary in the middle of the window (the map of the project, or the standard office)', Math.abs(where.x + (cat.x + 14) * where.k - where.cx) < 3 && Math.abs(where.y + (cat.y + 10) * where.k - where.cy) < 3);
// the percent view does not change the map: Ctrl and minus is the window's own zoom
const before = await mapBox();
await c.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', ctrlKey: true, bubbles: true })); true`); await c.sleep(800);
const after = await mapBox();
ok('the map keeps its size when the percent view changes (' + before.dpr.toFixed(2) + ' to ' + after.dpr.toFixed(2) + ')', Math.abs(before.w * before.dpr - after.w * after.dpr) < 2);
await c.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true })); true`); await c.sleep(500);

// ---- Edit the office: opens, shows the plan, the picture and the checks, asks before it throws changes away, and closes
ok('Edit the office opens', await press('Edit the office') && await c.waitFor(`!!document.querySelector('[aria-label="Edit the office"] canvas[aria-label^="The plan"]')`, 5000, 100));
ok('See in 3D shows the office, and Back brings the plan back', await click('See in 3D') && await c.waitFor(`!!document.querySelector('canvas[aria-label="The office as it will look"]')`, 5000, 100) && await click('Back to the plan') && await c.waitFor(`!!document.querySelector('canvas[aria-label^="The plan"]')`, 5000, 100));
ok('the standard office has nothing to warn about', await c.ev(`document.body.innerText.includes('Nothing looks wrong')`));
const planBox = await c.ev(`(() => { const r = document.querySelector('canvas[aria-label^="The plan"]').getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
const clickPlan = (i, j) => c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: planBox.x + i * 16 + 8, y: planBox.y + j * 16 + 8, button: 'left', clickCount: 1 }).then(() => c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: planBox.x + i * 16 + 8, y: planBox.y + j * 16 + 8, button: 'left', clickCount: 1 }));
await clickTool('Wall'); await clickPlan(1, 1);
await c.sleep(400);
ok('a change makes it say it is not saved', await c.ev(`document.body.innerText.includes('Not saved yet')`));
ok('Undo takes the change back', await press('Undo (Ctrl+Z)') && await c.waitFor(`!document.body.innerText.includes('Not saved yet')`, 3000, 100));
await clickTool('Wall'); await clickPlan(1, 1); await c.sleep(300);
await press('Close (Esc)');
ok('closing with a change asks first', await c.waitFor(`!!document.querySelector('[role=dialog][aria-label="Close without saving?"]')`, 3000, 100));
await c.ev(`(() => { [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Cancel').click(); return true; })()`); await c.sleep(300);
ok('Cancel keeps the editor open', await c.ev(`!!document.querySelector('[aria-label="Edit the office"] canvas[aria-label^="The plan"]')`));
await press('Undo (Ctrl+Z)'); await c.sleep(300);
await press('Close (Esc)');
ok('Close with nothing changed closes at once', await c.waitFor(`!document.querySelector('[aria-label="Edit the office"] canvas[aria-label^="The plan"]') && !!document.querySelector('canvas[aria-label^="The Kona office"]')`, 3000, 100));

const violations = await c.ev(`window.__v`);
ok('nothing was blocked by the content policy', violations.length === 0);
if (violations.length) console.log(violations);
c.close();
process.exit(failed ? 1 : 0);
