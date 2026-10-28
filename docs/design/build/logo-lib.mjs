// Shared pieces for the logo scripts: Kona's colours, and small shape makers in a 200 x 200 box.
// A shape is { name, fill, cmds }; `place` moves and scales a list of shapes onto the page and writes each path's `d`.
export const C = { canvas: '#0B0E10', ground: '#101417', surface1: '#151A1E', surface3: '#242B31', text: '#ECE6DA', text2: '#B9B4AA', teal: '#6CC6B4', gold: '#E8B25A', seed: '#2A1F17', coral: '#E5776B' };

export const rad = (d) => (d * Math.PI) / 180;
export const f = (n) => Math.round(n * 100) / 100;

/** A drawing is a list of { name, d, fill } in a 200 x 200 box; `place` moves and scales it onto the page. */
export function place(shapes, ox, oy, s) {
  const tx = (x, y) => `${f(ox + x * s)} ${f(oy + y * s)}`;
  return shapes.map((sh) => ({ ...sh, d: sh.cmds.map((c) => (c.k === 'Z' ? 'Z' : c.k + c.p.map((q) => tx(q[0], q[1])).join(' ')) ).join(' ') }));
}
export const M = (x, y) => ({ k: 'M', p: [[x, y]] });
export const L = (x, y) => ({ k: 'L', p: [[x, y]] });
export const Q = (cx, cy, x, y) => ({ k: 'Q', p: [[cx, cy], [x, y]] });
export const Z = { k: 'Z', p: [] };
export const polar = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))]; // 0 degrees is straight up

/** a pointed petal pointing at `deg`, from radius r0 to r1, half width w */
export function petal(name, cx, cy, deg, r0, r1, w, fill) {
  const [bx, by] = polar(cx, cy, r0, deg), [tx, ty] = polar(cx, cy, r1, deg);
  const mid = r0 + (r1 - r0) * 0.5, a = rad(deg), vx = Math.cos(a), vy = Math.sin(a);
  const [mx, my] = polar(cx, cy, mid, deg);
  return { name, fill, cmds: [M(bx, by), Q(mx - vx * w * 1.9, my - vy * w * 1.9, tx, ty), Q(mx + vx * w * 1.9, my + vy * w * 1.9, bx, by), Z] };
}
export const disc = (name, cx, cy, r, fill) => {
  const k = 0.5523 * r;
  return { name, fill, cmds: [M(cx, cy - r), { k: 'C', p: [[cx + k, cy - r], [cx + r, cy - k], [cx + r, cy]] }, { k: 'C', p: [[cx + r, cy + k], [cx + k, cy + r], [cx, cy + r]] }, { k: 'C', p: [[cx - k, cy + r], [cx - r, cy + k], [cx - r, cy]] }, { k: 'C', p: [[cx - r, cy - k], [cx - k, cy - r], [cx, cy - r]] }, Z] };
};
export const tri = (name, a, b, c, fill) => ({ name, fill, cmds: [M(...a), L(...b), L(...c), Z] });
export const oval = (name, cx, cy, rx, ry, fill) => {
  const kx = 0.5523 * rx, ky = 0.5523 * ry;
  return { name, fill, cmds: [M(cx, cy - ry), { k: 'C', p: [[cx + kx, cy - ry], [cx + rx, cy - ky], [cx + rx, cy]] }, { k: 'C', p: [[cx + rx, cy + ky], [cx + kx, cy + ry], [cx, cy + ry]] }, { k: 'C', p: [[cx - kx, cy + ry], [cx - rx, cy + ky], [cx - rx, cy]] }, { k: 'C', p: [[cx - rx, cy - ky], [cx - kx, cy - ry], [cx, cy - ry]] }, Z] };
};


/** cubic segments along a circle from `d1` to `d2` (degrees clockwise from up; d2 < d1 goes the other way round) */
export function arcCmds(cx, cy, r, d1, d2) {
  const out = [], n = Math.max(1, Math.ceil(Math.abs(d2 - d1) / 60)), step = (d2 - d1) / n;
  for (let i = 0; i < n; i++) {
    const a = d1 + i * step, b = a + step, h = (4 / 3) * Math.tan(rad(step) / 4) * r;
    const [x1, y1] = polar(cx, cy, r, a), [x2, y2] = polar(cx, cy, r, b);
    out.push({ k: 'C', p: [[x1 + h * Math.cos(rad(a)), y1 + h * Math.sin(rad(a))], [x2 - h * Math.cos(rad(b)), y2 - h * Math.sin(rad(b))], [x2, y2]] });
  }
  return out;
}
export const C_ = (cmds) => cmds;

/** the steps that put things on a FigCraft page */
export function makeSteps() {
  const steps = [];
  const add = (command, params) => steps.push({ command, params });
  const rect = (name, x, y, w, h, fill, r = 0) => add('node.create', { type: 'rectangle', name, x, y, width: w, height: h, props: { fill, cornerRadius: r }, select: false });
  const text = (name, str, x, y, size, color, style = 'Regular', width) => add('node.create', { type: 'text', name, text: str, x, y, ...(width ? { width } : {}), props: { fontFamily: 'Nunito Sans', fontStyle: style, fontSize: size, lineHeight: Math.round(size * 1.4) + 'px', fill: color, textAutoResize: width ? 'height' : 'widthAndHeight' }, select: false });
  const drawing = (label, shapes) => shapes.forEach((sh) => add('node.create', { type: 'vector', name: label + ' / ' + sh.name, path: sh.d, props: { fill: sh.fill }, select: false }));
  return { steps, rect, text, drawing };
}
