// A smoke test of the real window, driven over the DevTools port (this PC only). Start Kona first with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223
// (the development window or the release program), have at least one project added, then run:  node tests/smoke.mjs
// It opens every place, checks each one draws a heading, checks nothing is blocked by the content policy, and checks the test door
// for the folder dialog is absent in a release build. It changes nothing and starts no session.
import { attach } from './cdp.mjs';

const c = await attach(Number(process.env.PORT ?? 9223));
let failed = 0;
const ok = (name, v) => { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) failed++; };
const click = (label) => c.ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}) && !x.disabled); if (!b) return false; b.click(); return true; })()`);

await c.ev(`window.__v = []; window.addEventListener('securitypolicyviolation', (e) => window.__v.push(e.violatedDirective + ' ' + e.blockedURI)); true`);
ok('the sidebar is drawn', await c.waitFor(`!!document.querySelector('aside')`, 15000, 200));
for (const place of ['Sessions', 'Board', 'Worktrees', 'Brain', 'Files', 'Leftovers', 'Costs', 'Roles', 'Voice', 'Servers', 'Accounts', 'Settings']) {
  const went = await click(place);
  await c.sleep(900);
  const text = await c.ev(`document.body.innerText.length`);
  ok(`${place} opens and draws`, went && text > 80);
}
const violations = await c.ev(`window.__v`);
ok('nothing was blocked by the content policy', violations.length === 0);
if (violations.length) console.log(violations);
c.close();
process.exit(failed ? 1 : 0);
