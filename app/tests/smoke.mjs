// A smoke test of the real window, driven over the DevTools port (this PC only). Start Kona first with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223
// (the development window or the release program), have at least one project added with a signed-in account, then run:  node tests/smoke.mjs
// It checks the welcome page, opens the first project, checks the office is drawn with its rooms, opens every place in the sheet by clicking its room
// (and the tab or button that leads to it) and checks each one draws and the sheet closes, with the X button and with Esc, and checks nothing is blocked
// by the content policy. It changes nothing and starts no session. Since 0.24.0 there is no Go to list: the pages open in a sheet from below.
import { attach } from './cdp.mjs';

const c = await attach(Number(process.env.PORT ?? 9223));
let failed = 0;
const ok = (name, v) => { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) failed++; };
const click = (label) => c.ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}) && !x.disabled); if (!b) return false; b.click(); return true; })()`);
// open a page: click its room (a room is an svg polygon named after it), then, for a page the room does not open first, the tab or button that leads to it
const open = (room, then) => c.ev(`(async () => {
  const poly = [...document.querySelectorAll('svg polygon[role=button]')].find((p) => p.getAttribute('aria-label') === ${JSON.stringify(room)});
  if (!poly) return false;
  poly.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));
  const then = ${JSON.stringify(then ?? null)};
  if (then) { const b = [...document.querySelectorAll('section button')].find((x) => x.textContent.trim() === then); if (!b) return false; b.click(); }
  return !!document.querySelector('section[data-sheet]');
})()`);
const closeX = () => c.ev(`(() => { const b = document.querySelector('section button[aria-label^="Close"]'); if (!b) return false; b.click(); return true; })()`);
const turnOff = () => c.ev(`[...document.querySelectorAll('[aria-label^="Turn the building to"]')].every((b) => b.disabled)`);

await c.ev(`window.__v = []; window.addEventListener('securitypolicyviolation', (e) => window.__v.push(e.violatedDirective + ' ' + e.blockedURI)); true`);
ok('the welcome page is drawn', await c.waitFor(`document.body.innerText.includes('Welcome to Kona')`, 15000, 200));
ok('a project card opens', await c.waitFor(`[...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Open' && !x.disabled)`, 15000, 200) && await click('Open'));
ok('the top bar is drawn', await c.waitFor(`!!document.querySelector('header')`, 15000, 200));
ok('the office is drawn with its rooms', await c.waitFor(`document.querySelectorAll('svg polygon[role=button]').length >= 15`, 15000, 200));
ok('Kibby, the office boy, is in the office', await c.waitFor(`!!document.querySelector('button[aria-label^="Talk to Kibby"]')`, 10000, 200));
ok('there is no Go to list in the top bar', await c.ev(`!document.querySelector('header [aria-label="Go to"]')`));
// [page, room, the tab or button that leads to it]
const pages = [['Sessions', 'Front desk', 'See all sessions'], ['Board', 'Board'], ['Workflows', 'Board', 'Workflows'], ['Worktrees', 'DevOps and Git', 'Open Worktrees'], ['Brain', 'Library'], ['Files', 'Archive'],
  ['Leftovers', 'Storage closet'], ['Costs', 'Accounting'], ['Roles', 'Product and design', 'See the roles'], ['Voice', 'Back office'], ['Settings', 'Back office', 'Settings'], ['Servers', 'Server room'], ['Accounts', 'Entrance']];
for (const [page, room, then] of pages) {
  const went = await open(room, then);
  await c.sleep(900);
  const text = await c.ev(`document.body.innerText.length`);
  ok(`${page} opens in the sheet and draws`, went && text > 80 && await c.ev(`document.querySelector('section[data-sheet]').getAttribute('aria-label') === ${JSON.stringify(page)}`));
  if (page === 'Sessions') ok('the building cannot be turned while the sheet is open', await turnOff());
  ok(`${page} closes with the X button`, await closeX() && await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100));
}
await open('Library');
await c.sleep(500);
await c.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
ok('Esc closes the sheet', await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100));
ok('the turn buttons work again', !(await c.ev(`[...document.querySelectorAll('[aria-label^="Turn the building to"]')].some((b) => b.disabled)`)));
const violations = await c.ev(`window.__v`);
ok('nothing was blocked by the content policy', violations.length === 0);
if (violations.length) console.log(violations);
c.close();
process.exit(failed ? 1 : 0);
