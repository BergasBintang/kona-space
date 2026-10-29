// A smoke test of the real window, driven over the DevTools port (this PC only). Start Kona first with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223
// (the development window or the release program), have at least one project added with a signed-in account, then run:  node tests/smoke.mjs
// It checks the welcome page, opens the first project, checks the office is drawn with its rooms, opens every place through the top bar's
// Go to list and checks each one draws, and checks nothing is blocked by the content policy. It changes nothing and starts no session.
// Since 0.20.0 (the office replaced the sidebar) this script was rewritten and has NOT been run against the real window yet.
import { attach } from './cdp.mjs';

const c = await attach(Number(process.env.PORT ?? 9223));
let failed = 0;
const ok = (name, v) => { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) failed++; };
const click = (label) => c.ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}) && !x.disabled); if (!b) return false; b.click(); return true; })()`);
// the top bar's Go to list: open it, then choose the row
const goTo = (place) => c.ev(`(async () => {
  const t = document.querySelector('header [role=combobox][aria-label="Go to"]'); if (!t) return false; t.click();
  await new Promise((r) => setTimeout(r, 250));
  const o = [...document.querySelectorAll('[role=option]')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(place)})); if (!o) return false; o.click(); return true;
})()`);

await c.ev(`window.__v = []; window.addEventListener('securitypolicyviolation', (e) => window.__v.push(e.violatedDirective + ' ' + e.blockedURI)); true`);
ok('the welcome page is drawn', await c.waitFor(`document.body.innerText.includes('Welcome to Kona')`, 15000, 200));
ok('a project card opens', await c.waitFor(`[...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Open' && !x.disabled)`, 15000, 200) && await click('Open'));
ok('the top bar is drawn', await c.waitFor(`!!document.querySelector('header')`, 15000, 200));
ok('the office is drawn with its rooms', await c.waitFor(`document.querySelectorAll('svg polygon[role=button]').length >= 15`, 15000, 200));
for (const place of ['Sessions', 'Board', 'Worktrees', 'Brain', 'Files', 'Leftovers', 'Costs', 'Roles', 'Voice', 'Servers', 'Accounts', 'Settings', 'Office']) {
  const went = await goTo(place);
  await c.sleep(900);
  const text = await c.ev(`document.body.innerText.length`);
  ok(`${place} opens and draws`, went && text > 80);
}
const violations = await c.ev(`window.__v`);
ok('nothing was blocked by the content policy', violations.length === 0);
if (violations.length) console.log(violations);
c.close();
process.exit(failed ? 1 : 0);
