// Run: node tests/ui-details-snippets.mjs (needs Microsoft Edge; set KONA_EDGE to its path if it is not in the usual place). Starts a headless Edge of its own on port 9333 and closes it again.
// Runs every code block of the ui-details snippets in a real (headless) browser and checks what each one promises.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const SNIP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src-tauri/skills/ui-details/references/snippets.md");
const OUT = path.join(os.tmpdir(), "kona-uidetails-snippets") + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const md = fs.readFileSync(SNIP, "utf8");
const blocks = [...md.matchAll(/```(css|js|html)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1], code: m[2] }));
const DROP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src-tauri/skills/ui-details/templates/");
const dropCss = fs.readFileSync(path.join(DROP, "motion-tokens.css"), "utf8");
const dropJs = fs.readFileSync(path.join(DROP, "ui-details.js"), "utf8").replace(/^export /gm, "");
// the two drop-in files are what is tested, and they must hold exactly the code of the snippets page
const css = dropCss;
const js = dropJs;
const missing = blocks.filter((b) => b.lang !== "html").filter((b) => !(b.lang === "css" ? dropCss : dropJs).includes(b.code.trim()));
console.log(missing.length ? "FAIL the drop-in files miss " + missing.length + " block(s) of snippets.md: build them again" : "PASS the drop-in files hold every code block of snippets.md");
const html = blocks.filter((b) => b.lang === "html").map((b) => b.code).join("\n");
console.log(`blocks: ${blocks.filter((b) => b.lang === "css").length} css, ${blocks.filter((b) => b.lang === "js").length} js, ${blocks.filter((b) => b.lang === "html").length} html`);

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
</style></head><body>
<button class="btn" data-tip="Save" id="b1">Save</button> <button class="btn" data-tip="Open" id="b2">Open</button>
<div class="num" id="num"><span aria-hidden="true" data-view>0%</span><span class="sr-only" data-final>0%</span></div>
<div style="width:200px;height:10px"><div id="bar" style="height:10px;background:#000;transform-origin:left;transform:scaleX(0)"></div></div>
<span id="timer"></span>
<button class="hold" id="hold">Hold to delete</button>
<textarea id="box" rows="1"></textarea>
<div id="live" data-live style="margin-top:3000px;height:20px">far down</div>
<canvas id="cv"></canvas>
${html}
<script>
${js}
</script></body></html>`;
fs.writeFileSync(OUT + "snippets-test.html", page);

const EDGE = process.env.KONA_EDGE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const profile = path.join(OUT, "edge-profile-snip");
fs.rmSync(profile, { recursive: true, force: true });
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9333", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 40; i++) { try { list = await (await fetch("http://127.0.0.1:9333/json")).json(); if (list.some((p) => p.type === "page")) break; } catch {} await wait(500); }
const target = list.find((p) => p.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const k = ++id; pending.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
await send("Page.enable");
await send("Page.navigate", { url: "file:///" + (OUT + "snippets-test.html").replace(/\\/g, "/") });
await wait(1500);

const checks = await ev(`(async () => {
  const out = []; const ok = (n, v, d = '') => out.push((v ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : ''));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ptr = (type, el, extra = {}) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', pointerId: 1, ...extra }));
  // css parses and holds what it promises
  const sheet = [...document.styleSheets][0];
  const names = [...sheet.cssRules].filter((r) => r.type === CSSRule.KEYFRAMES_RULE).map((r) => r.name);
  ok('the css parses, with the keyframes skel-in, skel-pulse, shake, flash', ['skel-in', 'skel-pulse', 'shake', 'flash'].every((n) => names.includes(n)), names.join(','));
  ok('a placeholder starts after a 140 ms delay', getComputedStyle(Object.assign(document.body.appendChild(document.createElement('div')), { className: 'skel' })).animationDelay.split(',')[0].trim() === '0.14s');
  // tooltips
  const hide = attachTips();
  const b1 = document.getElementById('b1'), b2 = document.getElementById('b2'), tip = document.getElementById('tip');
  ptr('pointerover', b1); await wait(200);
  ok('a cold tooltip does not show before 400 ms', tip.style.opacity === '0');
  await wait(300);
  ok('it shows after 400 ms with the right text and is linked to the control', tip.style.opacity === '1' && tip.textContent === 'Save' && b1.getAttribute('aria-describedby') === 'tip');
  ptr('pointerout', b1, { relatedTarget: document.body }); await wait(30);
  ok('it hides', tip.style.opacity === '0');
  ptr('pointerover', b2); await wait(60);
  ok('the next one opens at once while warm', tip.style.opacity === '1' && tip.textContent === 'Open', tip.textContent);
  ptr('pointerout', b2, { relatedTarget: document.body }); await wait(450);
  ptr('pointerover', b1, { pointerType: 'touch' }); await wait(500);
  ok('a touch never shows a tooltip', tip.style.opacity === '0');
  b1.focus(); b1.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  // number
  const num = document.getElementById('num'); countTo(num, 80, { ms: 200 }); await wait(120);
  const mid = parseFloat(num.querySelector('[data-view]').textContent);
  ok('a number counts: mid-way it is between 0 and 80', mid > 0 && mid < 80, String(mid));
  await wait(300);
  ok('it ends on 80% and the hidden text holds the final value from the start', num.querySelector('[data-view]').textContent === '80%' && num.querySelector('[data-final]').textContent === '80%');
  // honest progress
  const bar = document.getElementById('bar'); const done = honestProgress(bar, 100); await wait(600);
  const p = parseFloat(bar.style.transform.replace(/[^0-9.]/g, ''));
  ok('an honest bar waits at 90 percent past its expected time', p > 0.85 && p <= 0.9, String(p));
  done(); await wait(50);
  ok('and completes only when told', bar.style.transform === 'scaleX(1)');
  // timer
  const t = document.getElementById('timer'); const stop = liveTimer(t); await wait(300);
  ok('a live timer shows milliseconds under 10 seconds', /^\\d+ ms$/.test(t.textContent), t.textContent);
  stop();
  // hold to confirm (keyboard path)
  const h = document.getElementById('hold'); let doneCount = 0, taps = 0;
  holdToConfirm(h, { ms: 300, onDone: () => doneCount++, onTap: () => taps++ });
  h.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); await wait(100);
  h.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })); await wait(300);
  ok('a quick press is a tap, not a confirm', taps === 1 && doneCount === 0, taps + '/' + doneCount);
  h.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(500);
  ok('holding for the full time confirms once', doneCount === 1, String(doneCount));
  h.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  h.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(100);
  h.dispatchEvent(new Event('blur')); await wait(350);
  ok('losing focus cancels a hold', doneCount === 1, String(doneCount));
  // chat box
  const box = document.getElementById('box'); let sent = [];
  chatBox(box, (v) => sent.push(v), { maxLines: 5, lineHeight: 22 });
  box.value = 'hello'; box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
  ok('Enter while composing text does not send', sent.length === 0);
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok('Enter sends otherwise', sent.length === 1 && sent[0] === 'hello');
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
  ok('Shift+Enter does not send', sent.length === 1);
  box.value = Array.from({ length: 20 }, (_, i) => 'line ' + i).join('\\n'); box.dispatchEvent(new Event('input'));
  ok('the box stops growing at 5 lines (110 px) and then scrolls', parseInt(box.style.height) <= 110 && box.style.overflowY === 'auto', box.style.height);
  // input mode
  trackInputMode();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  const k = document.documentElement.dataset.inputMode;
  window.dispatchEvent(new Event('pointerdown'));
  ok('the page knows keyboard from pointer', k === 'keyboard' && document.documentElement.dataset.inputMode === 'pointer', k);
  // pause offscreen
  const stopIO = pauseOffscreen(); await wait(300);
  ok('something far off screen is marked paused', document.getElementById('live').hasAttribute('data-paused'));
  stopIO();
  // frame governor
  let slow = []; const stopW = watchFrames((l) => slow.push(l), { warmup: 0, windowSize: 10, slowMs: 24, maxLevel: 2 });
  await new Promise((res) => { let n = 0; const f = () => { const t0 = performance.now(); while (performance.now() - t0 < 35); if (++n < 40) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  ok('the speed governor steps down when frames are slow', slow.length >= 1 && slow[0] === 1, JSON.stringify(slow));
  stopW();
  // canvas density cap
  Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
  const cv = document.getElementById('cv'); const ratio = sizeCanvas(cv, 100, 50);
  ok('a canvas never gets more than twice the density', ratio === 2 && cv.width === 200 && cv.style.width === '100px', ratio + ' / ' + cv.width);
  return out.join('\\n');
})()`);
console.log(checks);
const fails = (checks.match(/^FAIL/gm) ?? []).length;
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
ws.close();
try { edge.kill(); } catch {}
await wait(500);
try { fs.rmSync(OUT, { recursive: true, force: true }); } catch {}
process.exit(fails ? 1 : 0);
