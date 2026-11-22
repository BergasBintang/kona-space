// UI details: small plain-JavaScript helpers, no library. Each function stands alone: import only the ones you need, for example
//   import { attachTips, countTo } from './ui-details.js';
// They were run in a real browser (23 checks, see references/snippets.md for what each is for and how to style it).
// Names of classes and data attributes are the ones the matching CSS in motion-tokens.css uses; rename both together.

// Tooltips that warm up. Put data-tip="Save" on a control. The first waits 400 ms; for 300 ms after one closes the next shows at once. Shows on keyboard focus, never on touch. Returns a function that hides the tip.
export function attachTips(root = document) {
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

// A number that counts to its new value and holds the final value in hidden text for screen readers. Needs the markup and CSS of the 'A number that counts' piece. Returns a function that stops it.
export function countTo(el, to, { ms = 600, format = (n) => Math.round(n) + '%' } = {}) {
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

// A progress bar that follows an expected time but waits at 90 percent until the work is really done. Call the returned function when it is done.
export function honestProgress(el, expectedMs) {
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

// A live timer in an element (milliseconds under 10 seconds, then seconds). Call the returned function to stop it. Give the element tabular digits and a minimum width.
export function liveTimer(el) {
  const t0 = performance.now();
  const fmt = (ms) => (ms < 10000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s');
  let raf = 0;
  const tick = (now) => { el.textContent = fmt(now - t0); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); el.textContent = fmt(performance.now() - t0); };
}

// Hold to confirm: fills over 2 seconds; letting go, a hidden tab, a lost focus or a far move cancels it; Space and Enter work; a quick press is a tap.
export function holdToConfirm(btn, { ms = 2000, onTap, onDone } = {}) {
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

// A message box that grows to 5 lines, sends on Enter (not Shift+Enter) and never while an input method is composing text.
export function chatBox(box, send, { maxLines = 5, lineHeight = 22 } = {}) {
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

// Marks the page data-input-mode=keyboard or pointer, so focus rings can show for the keyboard only.
export function trackInputMode() {
  const set = (m) => { if (document.documentElement.dataset.inputMode !== m) document.documentElement.dataset.inputMode = m; };
  const keys = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']);
  addEventListener('keydown', (e) => { if (!e.metaKey && !e.ctrlKey && !e.altKey && keys.has(e.key)) set('keyboard'); }, true);
  addEventListener('pointerdown', () => set('pointer'), true);
  set('pointer');
}

// Marks elements with data-live as data-paused when they are off screen. Returns a function that stops watching.
export function pauseOffscreen(selector = '[data-live]') {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.toggleAttribute('data-paused', !e.isIntersecting);
  }, { rootMargin: '100px' });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
  return () => io.disconnect();
}

// Calls onSlow(level) each time the machine cannot keep up (median frame over 24 ms). Returns a function that stops it.
export function watchFrames(onSlow, { warmup = 1500, windowSize = 60, slowMs = 24, maxLevel = 4 } = {}) {
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

// Sizes a canvas for the screen but never above twice the density. Returns the ratio used.
export function sizeCanvas(canvas, width, height) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  return ratio;
}
