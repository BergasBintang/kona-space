// Minimizing pages (decision 95), tried in the REAL window over the DevTools port (this PC only). Start Kona first with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then   node tests/pages.mjs
// It opens a project that already exists in Kona (the first one), opens pages from the office, types a draft in the Brain's Ask box, and checks: the question when a page with a draft is left
// (Minimize, Close and lose it, Cancel), the tray under the top bar, that a minimized page is ALIVE (its draft is still there), that a page with nothing to lose closes without asking, the cap of
// six minimized pages, and that the office has no chip. It starts no session and changes no file. (The mockup that runs is tried in tests/live.mjs.)
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shown = () => c.ev(`document.querySelector('section[data-sheet]:not([hidden])')?.getAttribute('aria-label') ?? null`);
const chips = () => c.ev(`[...document.querySelectorAll('nav[aria-label="Open pages"] button[role=tab]')].map((b) => b.getAttribute('aria-label'))`);
const dialog = () => c.ev(`document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ') ?? null`);
const pressIn = (text, scope) => c.ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope + " button")})].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`);
const openPage = async (name) => { await c.ev(`document.querySelector('[aria-label=${JSON.stringify("Open " + name)}]')?.click(); true`); return c.waitFor(`document.querySelector('section[data-sheet]:not([hidden])')?.getAttribute('aria-label') === ${JSON.stringify(name)}`, 8000, 100); };
const minimize = () => c.ev(`document.querySelector('section[data-sheet]:not([hidden]) button[aria-label^="Minimize"]').click(); true`);
const key = async (k, code, vk) => { await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }); };
const DRAFT = "a question that was not sent";

try {
  await c.send("Page.bringToFront");
  if (!(await c.ev(`document.querySelectorAll('[aria-label^="Open "]').length >= 10`))) {
    ok("the welcome page is drawn", await c.waitFor(`document.body.innerText.includes('Welcome to Kona')`, 15000, 200));
    ok("a project card opens", await c.waitFor(`[...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Open' && !x.disabled)`, 15000, 200) && await c.ev(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Open' && !x.disabled).click(); true`));
  }
  ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200));
  // nothing is minimized to begin with: no tray, no chip for the office
  await c.ev(`document.querySelectorAll('nav[aria-label="Open pages"] button[aria-label^="Close"]').forEach((b) => b.click()); true`);
  ok("with no page minimized there is no tray, and the office has no chip", await c.ev(`!document.querySelector('nav[aria-label="Open pages"]')`) && (await shown()) === null);

  // ---- a page with a draft, left: the question, with its three answers
  ok("the Brain opens", await openPage("Brain"));
  await c.ev(`[...document.querySelectorAll('section[data-sheet] [role=tab]')].find((b) => b.textContent.trim() === 'Ask')?.click(); true`);
  await c.waitFor(`!!document.querySelector('section[data-sheet]:not([hidden]) input[aria-label="Ask the brain"]')`, 6000, 100);
  await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) input[aria-label="Ask the brain"]').focus(); true`);
  await c.send("Input.insertText", { text: DRAFT }); await wait(300);
  await key("Escape", "Escape", 27); await wait(500);
  const ask = (await dialog()) ?? "";
  ok("Esc on a page with a draft asks: Close without saving?, with Minimize, Close and lose it and Cancel", /Close without saving\?/.test(ask) && /Minimize/.test(ask) && /Close and lose it/.test(ask) && /Cancel/.test(ask), ask.slice(0, 200));
  ok("Cancel changes nothing: the page is still shown, with its draft, and there is no tray", await pressIn("Cancel", "[role=dialog]") && (await shown()) === "Brain" && await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) input[aria-label="Ask the brain"]').value`) === DRAFT && await c.ev(`!document.querySelector('nav[aria-label="Open pages"]')`));

  // ---- minimized: out of sight, alive, in the tray
  await minimize(); await wait(500);
  ok("Minimize puts the page away: the office is there, no page is shown, and the tray has one chip for the Brain", (await shown()) === null && JSON.stringify(await chips()) === JSON.stringify(["Brain, minimized, Open"]), JSON.stringify(await chips()));
  ok("the tray says how many are minimized", await c.ev(`document.querySelector('nav[aria-label="Open pages"]').innerText.includes('1 of 6 minimized')`));
  ok("the minimized page is still in the window, out of sight, with its draft (it is alive, not drawn again)", await c.ev(`(() => { const s = document.querySelector('section[data-page="place:brain"]'); return !!s && s.hidden && s.querySelector('input[aria-label="Ask the brain"]')?.value === ${JSON.stringify(DRAFT)}; })()`));
  ok("a page that is out of sight does not take Esc: nothing happens", await (async () => { await key("Escape", "Escape", 27); await wait(400); return (await dialog()) === null && JSON.stringify(await chips()) === JSON.stringify(["Brain, minimized, Open"]); })());

  // ---- another page next to it, then back by the chip
  ok("Files opens from the office while the Brain is minimized", await openPage("Files"));
  ok("the tray has two chips: the Brain minimized and Files shown", JSON.stringify(await chips()) === JSON.stringify(["Brain, minimized, Open", "Files, shown, Open"]), JSON.stringify(await chips()));
  ok("a click on the Brain's chip leaves Files without asking (it has nothing to lose) and shows the Brain with its draft", await c.ev(`document.querySelector('nav[aria-label="Open pages"] button[aria-label^="Brain"]').click(); true`) && await c.waitFor(`document.querySelector('section[data-sheet]:not([hidden])')?.getAttribute('aria-label') === 'Brain'`, 6000, 100) && (await dialog()) === null && await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) input[aria-label="Ask the brain"]').value`) === DRAFT);
  ok("Files was closed, not kept: the tray is gone (nothing is minimized) and Files is not in the window", await c.ev(`!document.querySelector('nav[aria-label="Open pages"]') && !document.querySelector('section[data-page="place:files"]')`));

  // ---- closing the Brain loses the draft, after asking
  await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) button[aria-label^="Close"]').click(); true`);
  ok("the X on a page with a draft asks, and Close and lose it closes it", await c.waitFor(`!!document.querySelector('[role=dialog]')`, 3000, 100) && await pressIn("Close and lose it", "[role=dialog]") && await c.waitFor(`!document.querySelector('section[data-page="place:brain"]')`, 4000, 100) && (await shown()) === null);

  // ---- the cap: six pages may be minimized, a seventh is refused with a plain line
  const six = ["Board", "Meeting", "Worktrees", "Brain", "Files", "Mockups"];
  for (const p of six) { await openPage(p); await minimize(); await wait(300); }
  ok("six pages are minimized, in the order they were put away", (await chips()).length === 6 && (await chips()).every((l) => /minimized/.test(l)), JSON.stringify(await chips()));
  ok("the tray says six of six", await c.ev(`document.querySelector('nav[aria-label="Open pages"]').innerText.includes('6 of 6 minimized')`));
  ok("a seventh page opens", await openPage("Costs"));
  await minimize(); await wait(500);
  ok("Minimize of a seventh is refused with a plain line, and the page stays shown", (await shown()) === "Costs" && await c.ev(`document.body.innerText.includes('6 pages are minimized already')`));
  ok("closing the shown page frees nothing of the six (it was never minimized)", await c.ev(`document.querySelector('section[data-sheet]:not([hidden]) button[aria-label^="Close"]').click(); true`) && await c.waitFor(`!document.querySelector('section[data-page="place:costs"]')`, 4000, 100) && (await chips()).length === 6);

  // ---- closing every chip: each closes without asking (none has anything to lose), and the tray goes
  for (let i = 0; i < 6; i++) { await c.ev(`document.querySelector('nav[aria-label="Open pages"] button[aria-label^="Close"]')?.click(); true`); await wait(250); }
  ok("closing every chip empties the tray, and no page is left in the window", await c.waitFor(`!document.querySelector('nav[aria-label="Open pages"]') && document.querySelectorAll('section[data-sheet]').length === 0`, 5000, 100));
} catch (e) { console.log("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 500)); failed++; }
finally { c.close(); }
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
