// The walls of the office, drawn as ONE structure and then cut into pieces, so that every case looks right without being drawn by hand:
// a wall on its own, the end of a run, the middle of a run, a corner, a T, a cross, a door post.
// How: every wall is a box on a tile edge (a quarter of a tile thick) and every door gets a post. All boxes are painted into one picture, and for each
// pixel we remember WHICH box painted it and WHICH SURFACE it belongs to (the top at a height, or the side face on a plane, in a colour).
// Then the outlines: a pixel gets a dark outline where its surface meets a different surface (or open air), and only on the nearer of the two.
// Two walls that run on into each other are the same surface there, so no line shows where they join; a corner is where two different faces meet, so it
// gets its line. Last, every box takes the pixels it painted: that is its picture. Pieces that look the same share one file later.
// Everything works in the camera's own space (u runs down-right, v down-left), so the same code serves all four quarter-turn views.
import { Img } from "./lib.mjs";

/**
 * edges: [{ o: "J" (along u, at v = c) or "I" (along v, at u = c), c, k (from k to k + 1), h (height), m: [top, +v face, +u face], band: [+v, +u] or null,
 *           brick, tall, hides, label }]
 * posts: [{ u, v, h, m, hides, label }]   (a post stands on a corner point)
 * PR(u, v, z): the camera's projection. size: { w, h } of the picture. T: half the thickness of a wall. OUT: the outline colour.
 * Returns [{ sprite, x, y, depth, label, hides, tall, fp }] (fp: the box on the ground, [u0, u1, v0, v1], to order it against the furniture).
 */
export function renderWalls({ edges, posts, PR, size, T = 0.125, OUT }) {
  const W = size.w, H = size.h;
  const img = new Img(W, H), owner = new Int32Array(W * H).fill(-1), tag = new Int32Array(W * H);
  const tagIds = new Map();
  const tagOf = (key) => { let t = tagIds.get(key); if (!t) { t = tagIds.size + 1; tagIds.set(key, t); } return t; };

  // how many walls (and posts) meet at each corner point: a wall runs on into a corner that is shared, and stops dead at one that is not
  const use = new Map(), bump = (u, v, n = 1) => use.set(`${u},${v}`, (use.get(`${u},${v}`) ?? 0) + n);
  for (const e of edges) { if (e.o === "J") { bump(e.k, e.c); bump(e.k + 1, e.c); } else { bump(e.c, e.k); bump(e.c, e.k + 1); } }
  for (const p of posts) bump(p.u, p.v, 2);
  const joined = (u, v) => (use.get(`${u},${v}`) ?? 0) >= 2;

  const boxes = [];
  for (const e of edges) {
    const J = e.o === "J", a = J ? [e.k, e.c] : [e.c, e.k], b = J ? [e.k + 1, e.c] : [e.c, e.k + 1];
    const x0 = joined(...a) ? T : 0, x1 = joined(...b) ? T : 0;
    const r = J ? { u0: e.k - x0, u1: e.k + 1 + x1, v0: e.c - T, v1: e.c + T } : { u0: e.c - T, u1: e.c + T, v0: e.k - x0, v1: e.k + 1 + x1 };
    boxes.push({ ...r, h: e.h, m: e.m, band: e.band, brick: e.brick, o: e.o, tall: e.tall, hides: e.hides, label: e.label });
  }
  for (const p of posts) boxes.push({ u0: p.u - T, u1: p.u + T, v0: p.v - T, v1: p.v + T, h: p.h, m: p.m, hides: p.hides, label: p.label });
  for (const b of boxes) {
    b.cu = (b.u0 + b.u1) / 2; b.cv = (b.v0 + b.v1) / 2;
    b.depth = b.tall ? -80 + (b.cu + b.cv) / 1000 : b.cu + b.cv; // a tall brick back wall stands behind everything
  }
  boxes.sort((a, b) => a.depth - b.depth || a.cv - b.cv || a.cu - b.cu);
  boxes.forEach((b, id) => { b.id = id; });

  // ---- paint every box, remembering who painted each pixel and which surface it is
  const paint = (id, pts, color, key) => {
    const t = tagOf(key);
    img.poly(pts, color, (x, y) => { if (x < 0 || x >= W) return false; const o = y * W + x; owner[o] = id; tag[o] = t; return true; });
  };
  for (const b of boxes) {
    const { u0, u1, v0, v1, h, m, band, id } = b;
    paint(id, [PR(u0, v0, h), PR(u1, v0, h), PR(u1, v1, h), PR(u0, v1, h)], m[0], `top|${h}|${m[0]}`);
    const faces = [
      ["v", v1, m[1], band?.[0], (z) => [PR(u0, v1, z), PR(u1, v1, z)]],
      ["u", u1, m[2], band?.[1], (z) => [PR(u1, v0, z), PR(u1, v1, z)]],
    ];
    for (const [side, plane, color, bandColor, edge] of faces) {
      const cut = bandColor ? h - 3 : h; // the top 3 px of a face are a band of its own
      const [a0, a1] = edge(cut), [b0, b1] = edge(0);
      paint(id, [a0, a1, b1, b0], color, `${side}|${plane}|${color}`);
      if (bandColor) { const [c0, c1] = edge(h); paint(id, [c0, c1, a1, a0], bandColor, `${side}|${plane}|band|${bandColor}`); }
    }
    if (b.brick) { // mortar on the long face: rows every 4 px, the joints half a tile apart and shifted every other row
      const J = b.o === "J", colour = J ? "#b98a74" : "#a67661", s0 = J ? b.u0 : b.v0, s1 = J ? b.u1 : b.v1;
      const pt = (s, z) => (J ? PR(s, v1, z) : PR(u1, s, z));
      for (let z = 4; z < h - 3; z += 4) { const [x0, y0] = pt(s0, z), [x1, y1] = pt(s1, z); img.line(x0, y0, x1, y1, colour); }
      for (let r = 0; r * 4 < h - 3; r++) for (let n = Math.floor(s0 * 2) - 1; n <= Math.ceil(s1 * 2) + 1; n++) {
        const s = n / 2 + (r % 2 ? 0.25 : 0);
        if (s <= s0 || s >= s1) continue;
        const [x0, y0] = pt(s, r * 4), [x1, y1] = pt(s, Math.min(r * 4 + 4, h - 3));
        img.line(x0, y0, x1, y1, colour);
      }
    }
  }

  // ---- outlines: where a surface meets another surface or open air, on the nearer one's pixel
  const depth = boxes.map((b) => b.depth), mark = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = y * W + x, t = tag[o];
    if (!t) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx, nt = nx < 0 || nx >= W || ny < 0 || ny >= H ? 0 : tag[n];
      if (nt === t) continue;
      if (nt === 0) { mark.push(o); break; }
      const a = depth[owner[o]], b = depth[owner[n]];
      if (a > b || (a === b && t > nt)) { mark.push(o); break; }
    }
  }
  for (const o of mark) img.set(o % W, Math.floor(o / W), OUT);

  // ---- every box takes the pixels it painted
  const x0 = new Array(boxes.length).fill(W), y0 = new Array(boxes.length).fill(H), x1 = new Array(boxes.length).fill(-1), y1 = new Array(boxes.length).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = owner[y * W + x];
    if (id < 0 || !tag[y * W + x]) continue;
    if (x < x0[id]) x0[id] = x; if (x > x1[id]) x1[id] = x; if (y < y0[id]) y0[id] = y; if (y > y1[id]) y1[id] = y;
  }
  const out = [];
  boxes.forEach((b, id) => {
    if (x1[id] < 0) return;
    const sprite = new Img(x1[id] - x0[id] + 1, y1[id] - y0[id] + 1);
    for (let y = y0[id]; y <= y1[id]; y++) for (let x = x0[id]; x <= x1[id]; x++) if (owner[y * W + x] === id && tag[y * W + x]) sprite.set(x - x0[id], y - y0[id], img.get(x, y));
    out.push({ sprite, x: x0[id], y: y0[id], depth: b.depth, label: b.label, hides: b.hides, tall: !!b.tall, fp: [b.u0, b.u1, b.v0, b.v1] });
  });
  return out;
}
