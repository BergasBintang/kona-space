# Ready code: plain CSS and JavaScript, no library

Each piece stands alone. Copy what you need, rename the classes to the project's own, and use the project's own timing names where it has them. The timing names (`--ease-out`, `--dur-press` and the rest) come from `motion-scale.md`.

## Press, hover and focus

```css
.btn {
  transition: transform var(--dur-press) var(--ease-out), background-color var(--dur-press) var(--ease-out);
  user-select: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.btn:active { transform: scale(0.97); }
@media (hover: hover) { .btn:hover { background-color: var(--btn-hover); } }
.btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```

## Reduced motion: adapt, do not delete

```css
@media (prefers-reduced-motion: reduce) {
  .panel { transform: none; transition: opacity var(--dur-menu) linear; }
  .breathe { animation-duration: 2.4s; --breathe-low: 0.8; }
  .failed { animation: flash 300ms linear; }
}
@keyframes flash { 50% { background-color: var(--danger-soft); } }
```

## A placeholder that never flashes

```css
.skel {
  background: var(--skel);
  animation: skel-in 240ms var(--ease-out) 140ms both, skel-pulse 1.8s ease-in-out 380ms infinite;
}
@keyframes skel-in { from { opacity: 0; } }
@keyframes skel-pulse { 50% { opacity: 0.55; } }
```

## A check that draws itself

```html
<svg class="mark" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9" />
  <path class="check" d="M7 12.5 10.5 16 17 8.5" pathLength="1" />
</svg>
```

```css
.mark .check { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 240ms var(--ease-in-out) 120ms; }
.mark.done .check { stroke-dashoffset: 0; }
```

## A shake for a failure

```css
@keyframes shake {
  0%, 100% { transform: none; }
  15% { transform: translateX(-6px); }
  30% { transform: translateX(6px); }
  50% { transform: translateX(-4px); }
  70% { transform: translateX(4px); }
  85% { transform: translateX(-2px); }
}
.failed { animation: shake 350ms var(--ease-in-out); }
```

## Tooltips that warm up

Put `data-tip="Save"` on a control. One tooltip element is shared. The first waits 400 ms; for 300 ms after one closes, the next shows at once. It also shows on keyboard focus and never on touch.

```js
function attachTips(root = document) {
  const tip = Object.assign(document.createElement('div'), { role: 'tooltip', id: 'tip' });
  tip.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;opacity:0;transition:opacity 160ms';
  document.body.append(tip);
  let timer = 0, warmUntil = 0, current = null;
  const show = (el) => {
    current = el;
    tip.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px';
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 6) + 'px';
    tip.style.opacity = '1';
    el.setAttribute('aria-describedby', 'tip');
  };
  const hide = () => {
    clearTimeout(timer);
    if (current) { current.removeAttribute('aria-describedby'); warmUntil = performance.now() + 300; current = null; }
    tip.style.opacity = '0';
  };
  const target = (e) => e.target.closest?.('[data-tip]');
  root.addEventListener('pointerover', (e) => {
    const el = target(e);
    if (!el || e.pointerType === 'touch' || el === current) return;
    clearTimeout(timer);
    const wait = current || performance.now() < warmUntil ? 0 : 400;
    timer = setTimeout(() => show(el), wait);
  });
  root.addEventListener('pointerout', (e) => { if (target(e) && !e.relatedTarget?.closest?.('[data-tip]')) hide(); });
  root.addEventListener('focusin', (e) => { const el = target(e); if (el && e.target.matches(':focus-visible')) show(el); });
  root.addEventListener('focusout', hide);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return hide;
}
```

## A number that counts, and is read once

```html
<span class="num"><span aria-hidden="true" data-view>0%</span><span class="sr-only" data-final>0%</span></span>
```

```css
.num [data-view] { font-variant-numeric: tabular-nums; display: inline-block; min-width: 4ch; text-align: right; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
```

```js
function countTo(el, to, { ms = 600, format = (n) => Math.round(n) + '%' } = {}) {
  const view = el.querySelector('[data-view]'), final = el.querySelector('[data-final]');
  const from = parseFloat(view.dataset.value ?? '0');
  view.dataset.value = String(to);
  final.textContent = format(to);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) { view.textContent = format(to); return () => {}; }
  let raf = 0, t0 = 0;
  const step = (now) => {
    t0 ||= now;
    const p = Math.min(1, (now - t0) / ms), eased = 1 - Math.pow(1 - p, 4);
    view.textContent = format(from + (to - from) * eased);
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
```

## An honest progress bar

It follows an expected time but stops at 90 percent until the work is really done.

```js
function honestProgress(el, expectedMs) {
  const t0 = performance.now();
  let raf = 0, finished = false;
  const tick = (now) => {
    if (finished) return;
    const p = Math.min(0.9, 0.9 * (1 - Math.pow(1 - Math.min(1, (now - t0) / expectedMs), 3)));
    el.style.transform = `scaleX(${p})`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { finished = true; cancelAnimationFrame(raf); el.style.transition = 'transform 200ms'; el.style.transform = 'scaleX(1)'; };
}
```

## A live timer that does not redraw the page

```js
function liveTimer(el) {
  const t0 = performance.now();
  const fmt = (ms) => (ms < 10000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s');
  let raf = 0;
  const tick = (now) => { el.textContent = fmt(now - t0); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); el.textContent = fmt(performance.now() - t0); };
}
```

Give the element `font-variant-numeric: tabular-nums` and a `min-width` of about 6ch.

## Hold to confirm

Fills while held for 2 seconds. Letting go, hiding the tab, leaving the window or moving far away cancels it. Space and Enter work too. A quick press under 250 ms is a tap.

```css
.hold { position: relative; overflow: hidden; --p: 0; }
.hold::before { content: ''; position: absolute; inset: 0; background: var(--hold-fill); transform: scaleX(var(--p)); transform-origin: left; }
```

```js
function holdToConfirm(btn, { ms = 2000, onTap, onDone } = {}) {
  let raf = 0, t0 = 0, held = false, tapAt = 0;
  const set = (p) => btn.style.setProperty('--p', p);
  const stop = () => {
    if (!held) return;
    held = false; cancelAnimationFrame(raf);
    const back = performance.now(), from = parseFloat(btn.style.getPropertyValue('--p')) || 0;
    const drain = (now) => { const k = Math.min(1, (now - back) / 200); set(from * (1 - k)); if (k < 1) requestAnimationFrame(drain); };
    requestAnimationFrame(drain);
    if (performance.now() - tapAt < 250) onTap?.();
  };
  const start = () => {
    if (held) return;
    held = true; t0 = performance.now(); tapAt = t0;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      set(p);
      if (p >= 1) { held = false; onDone?.(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch {} start(); });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
  btn.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return stop;
}
```

## A message box: Enter without breaking input methods, and growth to 5 lines

```js
function chatBox(box, send, { maxLines = 5, lineHeight = 22 } = {}) {
  const fit = () => {
    box.style.height = 'auto';
    const max = maxLines * lineHeight;
    box.style.height = Math.min(box.scrollHeight, max) + 'px';
    box.style.overflowY = box.scrollHeight > max ? 'auto' : 'hidden';
  };
  box.addEventListener('input', fit);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(box.value); }
  });
  fit();
}
```

## Keyboard focus rings only for the keyboard

```js
function trackInputMode() {
  const set = (m) => { if (document.documentElement.dataset.inputMode !== m) document.documentElement.dataset.inputMode = m; };
  const keys = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']);
  addEventListener('keydown', (e) => { if (!e.metaKey && !e.ctrlKey && !e.altKey && keys.has(e.key)) set('keyboard'); }, true);
  addEventListener('pointerdown', () => set('pointer'), true);
  set('pointer');
}
```

```css
[data-input-mode='pointer'] :focus-visible { outline: none; }
[data-input-mode='keyboard'] :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```

## Pause what nobody can see

```js
function pauseOffscreen(selector = '[data-live]') {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.toggleAttribute('data-paused', !e.isIntersecting);
  }, { rootMargin: '100px' });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
  return () => io.disconnect();
}
```

```css
[data-paused], [data-paused] * { animation-play-state: paused !important; }
```

## A speed governor

Calls `onSlow(level)` each time the machine cannot keep up. Level 1 is mild; raise the level to cut density, then glow and blur, then effects.

```js
function watchFrames(onSlow, { warmup = 1500, windowSize = 60, slowMs = 24, maxLevel = 4 } = {}) {
  let level = 0, last = 0, samples = [], raf = 0;
  const began = performance.now();
  const tick = (now) => {
    if (document.hidden) { last = 0; samples = []; }
    else {
      if (last && now - began > warmup) samples.push(now - last);
      last = now;
    }
    if (samples.length >= windowSize) {
      const median = samples.sort((a, b) => a - b)[windowSize >> 1];
      samples = [];
      if (median > slowMs && level < maxLevel) onSlow(++level);
    }
    if (level < maxLevel) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
```

Start at a lower level when `navigator.hardwareConcurrency <= 2` or `navigator.deviceMemory <= 2`, and remember the level in `sessionStorage` so a reload does not start high again.

## Cap the pixel density on a canvas

```js
function sizeCanvas(canvas, width, height) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  return ratio;
}
```
