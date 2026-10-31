// Furniture. Every piece stands on whole tiles (a footprint of w x d tiles with its corner on a tile corner) and is built from boxes that are a whole number of steps high.
// A detail smaller than a step (a keyboard, a row of books, a light) is painted on a face or on the top, as part of the piece's own picture. A piece is drawn in its own frame:
// x along its width, y from its back (0) to its front (d). It faces one of four ways on the plan (0: its front looks towards +j, 1: towards -i, 2: towards -j, 3: towards +i). The
// same drawing is turned with the plan, so a piece looks right from all four sides of the building. `KINDS` is the catalog: what can be placed, how big it is and how it is drawn.
import { Img, type Colour } from "./img.ts";
import { M, OUT, mix, shade, type Material } from "./palette.ts";
import { STEP, type Iso } from "./iso.ts";
import type { Facing, Obj } from "./types.ts";

/** One thing to draw: a picture with its place on the screen and its place in the drawing order. A cat has no picture (it is drawn from the cat sheet). */
export type Item = {
  kind: "wall" | "post" | "deco" | "obj" | "cat";
  img: Img | null;
  x: number;
  y: number;
  depth: number;
  /** where it stands on the ground in the camera's space, [u0, u1, v0, v1]; null for what has a fixed place in the order (the tall back walls, wall art) */
  fp: [number, number, number, number] | null;
  label: string;
  /** the index of the object of the map it belongs to, or -1 */
  ref: number;
  role?: string;
  dir?: number;
};
export type Foot = { label: string; i0: number; j0: number; wi: number; dj: number; h: number; ref: number };
export type Rug = { i: number; j: number; w: number; d: number; c: string; c2: string };

const DESK = 8;
const FRAME_H = 20; // the cat's picture: 28 x 20

/** The frame of one piece: boxes and paint in the piece's own coordinates. */
type Frame = {
  at: (x: number, y: number) => [number, number];
  b: (x: number, y: number, bw: number, bd: number, h: number, m: Material, z0?: number) => void;
  top: (x: number, y: number, bw: number, bd: number, z: number, c: Colour) => void;
  fy: (y: number, xa: number, xb: number, za: number, zb: number, c: Colour, s?: 1 | -1) => void;
  fx: (x: number, ya: number, yb: number, za: number, zb: number, c: Colour, s?: 1 | -1) => void;
};

export class Stage {
  iso: Iso;
  items: Item[] = [];
  feet: Foot[] = [];
  rugs: Rug[] = [];
  constructor(iso: Iso) { this.iso = iso; }

  private box(img: Img, i0: number, j0: number, wi: number, dj: number, h: number, m: Material, z0 = 0) {
    const { iso } = this, { PR } = iso;
    const c = [[i0, j0], [i0 + wi, j0], [i0, j0 + dj], [i0 + wi, j0 + dj]].map(([i, j]) => iso.rot(i, j));
    const u0 = Math.min(...c.map((p) => p[0])), u1 = Math.max(...c.map((p) => p[0])), v0 = Math.min(...c.map((p) => p[1])), v1 = Math.max(...c.map((p) => p[1])), zt = z0 + h;
    img.poly([PR(u0, v0, zt), PR(u1, v0, zt), PR(u1, v1, zt), PR(u0, v1, zt)], m[0]);
    img.poly([PR(u0, v1, zt), PR(u1, v1, zt), PR(u1, v1, z0), PR(u0, v1, z0)], m[1]);
    img.poly([PR(u1, v0, zt), PR(u1, v1, zt), PR(u1, v1, z0), PR(u1, v0, z0)], m[2]);
    const ln = (a: number[], b: number[]) => img.line(a[0], a[1], b[0], b[1], OUT);
    img.polyLine([PR(u0, v0, zt), PR(u1, v0, zt), PR(u1, v1, zt), PR(u0, v1, zt)], OUT);
    ln(PR(u0, v1, zt), PR(u0, v1, z0)); ln(PR(u1, v1, zt), PR(u1, v1, z0)); ln(PR(u1, v0, zt), PR(u1, v0, z0));
    ln(PR(u0, v1, z0), PR(u1, v1, z0)); ln(PR(u1, v1, z0), PR(u1, v0, z0));
  }

  frame(img: Img, i0: number, j0: number, w: number, d: number, facing: Facing): Frame {
    const { iso } = this, { PR, P } = iso;
    const toPlan = (x: number, y: number): [number, number] => (facing === 0 ? [i0 + x, j0 + y] : facing === 1 ? [i0 + d - y, j0 + x] : facing === 2 ? [i0 + w - x, j0 + d - y] : [i0 + y, j0 + w - x]);
    const dir = (dx: number, dy: number): [number, number] => { const a = toPlan(0, 0), b = toPlan(dx, dy); return [b[0] - a[0], b[1] - a[1]]; };
    const rect = (x: number, y: number, bw: number, bd: number): [number, number, number, number] => {
      const p = toPlan(x, y), r = toPlan(x + bw, y + bd);
      return [Math.min(p[0], r[0]), Math.min(p[1], r[1]), Math.abs(r[0] - p[0]), Math.abs(r[1] - p[1])];
    };
    const plane = (p0: [number, number], p1: [number, number], n: [number, number], za: number, zb: number, c: Colour) => { // a flat face, painted only when it looks towards the camera
      const a = iso.rot(...p0), b = iso.rot(...p1), s = iso.rot(p0[0] + n[0], p0[1] + n[1]);
      if (s[0] - a[0] <= 0 && s[1] - a[1] <= 0) return;
      img.poly([PR(a[0], a[1], zb), PR(b[0], b[1], zb), PR(b[0], b[1], za), PR(a[0], a[1], za)], c);
    };
    return {
      at: toPlan,
      b: (x, y, bw, bd, h, m, z0 = 0) => this.box(img, ...rect(x, y, bw, bd), h, m, z0),
      top: (x, y, bw, bd, z, c) => { const [a, b, w2, d2] = rect(x, y, bw, bd); img.poly([P(a, b, z), P(a + w2, b, z), P(a + w2, b + d2, z), P(a, b + d2, z)], c); },
      fy: (y, xa, xb, za, zb, c, s = 1) => plane(toPlan(xa, y), toPlan(xb, y), dir(0, s), za, zb, c),
      fx: (x, ya, yb, za, zb, c, s = 1) => plane(toPlan(x, ya), toPlan(x, yb), dir(s, 0), za, zb, c),
    };
  }

  /** h: the height of the highest point. */
  piece(ref: number, i0: number, j0: number, w: number, d: number, facing: Facing, label: string, h: number, build: (L: Frame) => void): Item | null {
    const { iso } = this;
    const sw = facing % 2 ? d : w, sd = facing % 2 ? w : d; // its footprint on the plan
    this.feet.push({ label, i0, j0, wi: sw, dj: sd, h, ref });
    const [u0, u1, v0, v1] = iso.foot(i0, j0, sw, sd);
    const x0 = iso.PR(u0, v1)[0] - 3, x1 = iso.PR(u1, v0)[0] + 3, y0 = iso.PR(u0, v0, h)[1] - 3, y1 = iso.PR(u1, v1, 0)[1] + 3;
    const img = new Img(x1 - x0, y1 - y0, x0, y0);
    build(this.frame(img, i0, j0, w, d, facing));
    const t = img.trim();
    if (!t) return null;
    const item: Item = { kind: "obj", img: t, x: t.ox, y: t.oy, depth: iso.D(i0 + sw / 2, j0 + sd / 2), fp: iso.foot(i0, j0, sw, sd, 0.15), label, ref };
    this.items.push(item);
    return item;
  }
}

// ---- the plain shapes
const block = (S: Stage, ref: number, o: Obj, w: number, d: number, h: number, m: Material, label: string) => {
  const f = (o.facing ?? 0) as Facing;
  S.piece(ref, o.i, o.j, w, d, f, label, h, (L) => L.b(0.125, 0.125, (f % 2 ? d : w) - 0.25, (f % 2 ? w : d) - 0.25, h, m)); // a little inside its footprint, so two neighbours do not melt into one block
};
const seat = (S: Stage, ref: number, o: Obj, w: number, h: number, m: Material, label: string) => {
  const f = (o.facing ?? 0) as Facing;
  S.piece(ref, o.i, o.j, w, 1, f, label, h, (L) => L.b(0.125, 0.125, w - 0.25, 0.75, h, m)); // a seat only: a backrest and arms made the picture busy
};
const barsOn = (L: Frame, y: number, w: number, bars: [string, number][]) => {
  const edge = 0.25, bw = Math.max(0.25, Math.floor(((w - 2 * edge) / bars.length) * 8) / 8);
  bars.forEach(([c, bh], k) => L.fy(y, edge + k * bw, edge + k * bw + bw - 0.125, 6, 6 + Math.min(9, Math.round(bh * 0.6)), c));
};
const standing = (S: Stage, ref: number, o: Obj, w: number, decor: (L: Frame, y: number, w: number) => void) => { // a framed panel on two short legs
  S.piece(ref, o.i, o.j, w, 1, (o.facing ?? 0) as Facing, "board", 20, (L) => {
    L.b(0.125, 0.25, 0.125, 0.125, 4, M.darkwood); L.b(w - 0.25, 0.25, 0.125, 0.125, 4, M.darkwood);
    L.b(0, 0.25, w, 0.125, 16, M.white, 4);
    decor(L, 0.375, w);
  });
};
const mat = (o: Obj, fallback = "wood"): Material => M[String(o.m ?? fallback)] ?? M[fallback];
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
/** a size in tiles: a whole number from 1 to 24, whatever a file says (a saved map is not trusted to be sensible) */
const dim = (v: unknown, d: number) => Math.max(1, Math.min(24, Math.round(num(v, d))));

/** what each role keeps on the desk, so you can tell the desks apart. (x, y) is a free spot of 1/4 tile on the desk top. */
const PROPS: Record<string, (L: Frame, x: number, y: number) => void> = {
  marketing: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.red, DESK); L.b(x + 0.125, y, 0.125, 0.25, 4, M.white, DESK + 4); }, // a megaphone
  content: (L, x, y) => { L.top(x, y, 0.25, 0.25, DESK, M.paper[0]); L.b(x + 0.125, y + 0.125, 0.125, 0.125, 4, M.gold, DESK); }, // paper and a pencil cup
  support: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.blue, DESK); }, // a phone
  product: (L, x, y) => { L.top(x, y, 0.25, 0.25, DESK, M.gold[0]); L.top(x + 0.125, y + 0.125, 0.125, 0.125, DESK, M.red[0]); }, // sticky notes
  design: (L, x, y) => { ["#f3c978", "#d9786a", "#7fb1e0", "#8ed8c9"].forEach((c, k) => L.b(x + (k % 2) * 0.125, y + (k >> 1) * 0.125, 0.125, 0.125, 4, shade(c), DESK)); }, // paint pots
  frontend: (L, x, y) => { L.b(x, y, 0.25, 0.125, 8, M.black, DESK); L.fy(y, x, x + 0.25, DESK + 2, DESK + 7, "#4a7a9c", -1); }, // a second screen
  backend: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.server, DESK); L.fy(y + 0.25, x, x + 0.125, DESK + 1, DESK + 2, "#8ed8c9"); }, // a small server
  qa: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.leaf, DESK); L.top(x + 0.125, y + 0.125, 0.125, 0.125, DESK + 4, M.red[0]); }, // a jar with a bug
  security: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.gold, DESK); L.b(x + 0.125, y + 0.125, 0.125, 0.125, 4, M.black, DESK + 4); }, // a padlock
  devops: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.teal, DESK); }, // a deploy light
  secretary: (L, x, y) => { L.b(x, y, 0.25, 0.25, 4, M.gold, DESK); }, // the bell
};

/** A workstation: a desk and a chair with a cat on it. They are ONE thing: moved, turned and deleted together. The chair is one tile and the desk one tile deep (one or two wide),
 * the chair at the desk's end, facing the desk. The cat sits on the chair, looking at the camera's side of it. */
function workstation(S: Stage, ref: number, o: Obj) {
  const { iso } = S, facing = (o.facing ?? 0) as Facing, wide = o.wide === true, role = String(o.role ?? ""), dw = wide ? 2 : 1;
  const W = S.frame(new Img(0, 0), o.i, o.j, dw, 2, facing);
  const corner = (x0: number, y0: number, x1: number, y1: number): [number, number] => { const p = W.at(x0, y0), r = W.at(x1, y1); return [Math.min(p[0], r[0]), Math.min(p[1], r[1])]; };
  const [ci, cj] = corner(0, 0, 1, 1), [di, dj] = corner(0, 1, dw, 2);
  S.piece(ref, ci, cj, 1, 1, facing, "chair", 4, (L) => L.b(0.125, 0.125, 0.75, 0.75, 4, M.red));
  S.piece(ref, di, dj, dw, 1, facing, `desk of ${role}`, 12, (L) => { // (the screen reaches 16, but it is thin)
    L.b(0, 0.125, dw, 0.75, DESK, M.wood);
    for (const [y, s] of [[0.875, 1], [0.125, -1]] as [number, 1 | -1][]) { L.fy(y, 0.125, dw - 0.125, 1, 5, shade(M.wood[1])[1], s); L.fy(y, 0.375, 0.625, 3, 4, "#33241a", s); } // a drawer on each long side
    L.top(0.25, 0.25, 0.5, 0.125, DESK, M.white[0]); // the keyboard
    L.b(0.25, 0.5, 0.5, 0.125, 8, M.black, DESK); L.fy(0.5, 0.375, 0.625, DESK + 2, DESK + 7, "#2e4a5c", -1); L.fy(0.5, 0.375, 0.5, DESK + 3, DESK + 6, "#8ed8c9", -1); // the screen, lit on the cat's side
    PROPS[role]?.(L, wide ? 1.25 : 0.75, 0.5);
  });
  const c = W.at(0.5, 0.5), [sx, sy] = iso.P(c[0], c[1], 4);
  const to = iso.rot(c[0] + [0, -1, 0, 1][facing], c[1] + [1, 0, -1, 0][facing]), from = iso.rot(c[0], c[1]);
  const dir = to[1] > from[1] ? 0 : to[0] > from[0] ? 1 : to[0] < from[0] ? 2 : 3; // which way the cat looks on the screen: 0 down-left
  S.items.push({ kind: "cat", img: null, x: Math.round(sx) - 14, y: Math.round(sy) - FRAME_H + 1, depth: iso.D(c[0], c[1]) + 0.01, fp: iso.foot(ci, cj, 1, 1, 0.15), label: `cat ${role}`, ref, role, dir });
}

type Spec = { label: string; w: number; d: number; h: number; draw: (L: Frame) => void };
const fixed: Record<string, Spec> = {
  "reading table": { label: "Reading table", w: 2, d: 1, h: 12, draw: (L) => { L.b(0.125, 0.125, 1.75, 0.75, 8, M.wood); L.b(0.5, 0.375, 0.375, 0.25, 4, M.red, 8); L.top(1.125, 0.375, 0.375, 0.25, 8, M.paper[0]); } },
  "folder table": { label: "Folder table", w: 2, d: 1, h: 12, draw: (L) => { L.b(0.125, 0.125, 1.75, 0.75, 8, M.wood); L.b(0.25, 0.25, 0.5, 0.375, 4, M.paper, 8); L.b(1.0, 0.25, 0.5, 0.375, 4, M.paper, 8); } },
  "cooling unit": { label: "Cooling unit", w: 1, d: 1, h: 20, draw: (L) => { L.b(0.125, 0.125, 0.75, 0.75, 20, M.metal); L.fy(0.875, 0.25, 0.75, 14, 17, "#76808c"); L.fy(0.875, 0.25, 0.75, 8, 11, "#76808c"); } },
  "console": { label: "Console", w: 2, d: 1, h: 4, draw: (L) => { L.b(0.125, 0.125, 1.75, 0.75, 4, M.server); L.fy(0.875, 0.25, 1.75, 1, 3, "#8ed8c9"); } },
  "deploy console": { label: "Deploy console", w: 2, d: 1, h: 16, draw: (L) => { L.b(0.125, 0.125, 1.75, 0.75, 16, M.metal); [0, 1, 2].forEach((k) => L.fy(0.875, 0.25 + k * 0.5, 0.5 + k * 0.5, 9, 12, ["#8ed8c9", "#f3c978", "#d9786a"][k])); } },
  "rocket": { label: "Rocket", w: 1, d: 1, h: 20, draw: (L) => { L.b(0.125, 0.125, 0.75, 0.75, 4, M.black); L.b(0.25, 0.25, 0.5, 0.5, 12, M.white, 4); L.b(0.375, 0.375, 0.25, 0.25, 4, M.red, 16); } },
  "accounts desk": { label: "Accounts desk", w: 1, d: 1, h: 12, draw: (L) => { L.b(0.125, 0.125, 0.75, 0.75, 8, M.wood); [4, 8].forEach((h, k) => L.b(0.25 + k * 0.25, 0.25, 0.25, 0.25, h, M.gold, 8)); L.b(0.25, 0.625, 0.375, 0.125, 4, M.white, 8); } },
  "crates": { label: "Crates", w: 1, d: 1, h: 16, draw: (L) => { L.b(0.125, 0.125, 0.75, 0.75, 8, M.crate); L.b(0.25, 0.25, 0.5, 0.5, 8, M.crate, 8); } },
  "bin": { label: "Bin", w: 1, d: 1, h: 16, draw: (L) => { L.b(0.25, 0.25, 0.5, 0.5, 12, M.metal); L.b(0.125, 0.125, 0.75, 0.75, 4, M.black, 12); } },
  "water cooler": { label: "Water cooler", w: 1, d: 1, h: 20, draw: (L) => { L.b(0.25, 0.25, 0.5, 0.5, 12, M.white); L.b(0.375, 0.375, 0.25, 0.25, 8, M.blue, 12); } },
  "meeting table": { label: "Meeting table", w: 2, d: 1, h: 8, draw: (L) => L.b(0.125, 0.125, 1.75, 0.75, 8, M.wood) },
  "queue desk": { label: "Queue desk", w: 1, d: 1, h: 12, draw: (L) => { L.b(0.125, 0.125, 0.75, 0.75, 8, M.wood); L.b(0.25, 0.25, 0.5, 0.25, 4, M.blue, 8); } },
  "key desk": { label: "Key desk", w: 1, d: 1, h: 12, draw: (L) => { L.b(0.125, 0.125, 0.75, 0.75, 8, M.wood); [0, 1, 2].forEach((k) => L.b(0.25 + k * 0.25, 0.375, 0.125, 0.125, 4, M.gold, 8)); } },
  "control panel": { label: "Control panel", w: 2, d: 1, h: 16, draw: (L) => { L.b(0.125, 0.125, 1.75, 0.5, 16, M.metal); [0, 1, 2, 3].forEach((k) => L.fy(0.625, 0.25 + k * 0.375, 0.5 + k * 0.375, 6, 9 + (k % 2) * 2, ["#8ed8c9", "#f3c978", "#d9786a", "#7fb1e0"][k])); } },
  "voice booth": { label: "Voice booth", w: 1, d: 1, h: 28, draw: (L) => { L.b(0.125, 0.125, 0.75, 0.75, 20, M.teal); L.b(0.125, 0.125, 0.75, 0.75, 4, M.white, 20); L.b(0.375, 0.375, 0.125, 0.125, 4, M.black, 24); } },
};

const BOOKS = ["#d9786a", "#8ed8c9", "#f3c978", "#7fb1e0", "#b793d0", "#e8b25a"];
type Param = { key: string; label: string; kind: "number" | "text" | "material" | "role" | "flag"; min?: number; max?: number };
/** The catalog: what can be placed on the floor. `size` is the footprint on the plan (width, depth) for the object as it is placed; `make` draws it; `params` are the settings the editor offers. */
export type Kind = { label: string; group: "seating" | "tables" | "storage" | "machines" | "boards" | "desks" | "other"; defaults: Record<string, unknown>; params: Param[]; size: (o: Obj) => [number, number]; make: (S: Stage, ref: number, o: Obj) => void };

const swap = (o: Obj, w: number, d: number): [number, number] => ((o.facing ?? 0) % 2 ? [d, w] : [w, d]);
const fixedKind = (key: string, group: Kind["group"]): Kind => {
  const s = fixed[key];
  return { label: s.label, group, defaults: {}, params: [], size: (o) => swap(o, s.w, s.d), make: (S, ref, o) => { S.piece(ref, o.i, o.j, s.w, s.d, (o.facing ?? 0) as Facing, key, s.h, s.draw); } };
};

export const KINDS: Record<string, Kind> = {
  workstation: {
    label: "Cat and desk", group: "desks", defaults: { role: "support", frame: "idle", wide: false }, params: [{ key: "role", label: "Cat", kind: "role" }, { key: "wide", label: "Wide desk", kind: "flag" }],
    size: (o) => { const [w, d] = [o.wide === true ? 2 : 1, 2]; return swap(o, w, d); }, make: (S, ref, o) => workstation(S, ref, o),
  },
  chair: { label: "Chair", group: "seating", defaults: { m: "red" }, params: [{ key: "m", label: "Colour", kind: "material" }], size: () => [1, 1], make: (S, ref, o) => { S.piece(ref, o.i, o.j, 1, 1, (o.facing ?? 0) as Facing, "chair", 4, (L) => L.b(0.125, 0.125, 0.75, 0.75, 4, mat(o, "red"))); } },
  armchair: { label: "Armchair", group: "seating", defaults: { m: "rose" }, params: [{ key: "m", label: "Colour", kind: "material" }], size: () => [1, 1], make: (S, ref, o) => seat(S, ref, o, 1, 8, mat(o, "rose"), "armchair") },
  sofa: { label: "Sofa or bench", group: "seating", defaults: { w: 2, m: "rose", label: "sofa" }, params: [{ key: "w", label: "Length", kind: "number", min: 1, max: 6 }, { key: "m", label: "Colour", kind: "material" }], size: (o) => swap(o, dim(o.w, 2), 1), make: (S, ref, o) => seat(S, ref, o, dim(o.w, 2), 8, mat(o, "rose"), String(o.label ?? "sofa")) },
  block: {
    label: "Block (bench, table, crate)", group: "tables", defaults: { w: 2, d: 1, h: 8, m: "wood", label: "table" },
    params: [{ key: "w", label: "Width", kind: "number", min: 1, max: 8 }, { key: "d", label: "Depth", kind: "number", min: 1, max: 8 }, { key: "h", label: "Height (4 to 32)", kind: "number", min: 4, max: 32 }, { key: "m", label: "Colour", kind: "material" }],
    size: (o) => swap(o, dim(o.w, 2), dim(o.d, 1)), make: (S, ref, o) => block(S, ref, o, dim(o.w, 2), dim(o.d, 1), Math.max(4, Math.min(64, Math.round(num(o.h, 8) / STEP) * STEP)), mat(o), String(o.label ?? "block")),
  },
  shelf: {
    label: "Bookshelf", group: "storage", defaults: { n: 0 }, params: [], size: () => [1, 1],
    make: (S, ref, o) => { const n = num(o.n, 0); S.piece(ref, o.i, o.j, 1, 1, (o.facing ?? 0) as Facing, "shelf", 28, (L) => {
      L.b(0, 0, 1, 0.5, 28, M.darkwood);
      for (let sh = 0; sh < 3; sh++) { const z = 3 + sh * 8; L.fy(0.5, 0, 1, z, z + 6, "#4d3320"); for (let b = 0; b < 6; b++) L.fy(0.5, 0.125 + b * 0.125, 0.25 + b * 0.125, z, z + 5 - ((b * 3 + n) % 3), BOOKS[(b + n * 2 + sh) % 6]); }
    }); },
  },
  rack: {
    label: "Server rack", group: "machines", defaults: { n: 0 }, params: [], size: () => [1, 1],
    make: (S, ref, o) => { const n = num(o.n, 0); S.piece(ref, o.i, o.j, 1, 1, (o.facing ?? 0) as Facing, "rack", 32, (L) => {
      L.b(0.125, 0, 0.75, 0.75, 32, M.server);
      for (let u = 0; u < 5; u++) { const z = 3 + u * 5.5; L.fy(0.75, 0.25, 0.75, z, z + 4, "#2a313c"); [0.25, 0.375, 0.5].forEach((off, k) => L.fy(0.75, off, off + 0.125, z + 1.5, z + 2.6, (u + k + n) % 4 === 0 ? "#f3c978" : "#8ed8c9")); }
    }); },
  },
  cabinet: {
    label: "Filing cabinet", group: "storage", defaults: { n: 0 }, params: [], size: () => [1, 1],
    make: (S, ref, o) => { const n = num(o.n, 0); S.piece(ref, o.i, o.j, 1, 1, (o.facing ?? 0) as Facing, "cabinet", 24, (L) => {
      L.b(0.125, 0, 0.75, 0.625, 20 + (n % 2) * 4, M.metal);
      for (let d = 0; d < 3; d++) { const z = 2 + d * 6; L.fy(0.625, 0.25, 0.75, z, z + 5, "#aeb7c2"); L.fy(0.625, 0.375, 0.625, z + 2, z + 3, "#33241a"); }
    }); },
  },
  chart: {
    label: "Standing chart", group: "boards", defaults: { w: 2, bars: [["#8ed8c9", 6], ["#f3c978", 11], ["#7fb1e0", 8], ["#d9786a", 14]] }, params: [{ key: "w", label: "Width", kind: "number", min: 1, max: 4 }], size: (o) => swap(o, dim(o.w, 2), 1),
    make: (S, ref, o) => { const bars = (Array.isArray(o.bars) ? o.bars.slice(0, 12) : []).map((b) => [String(Array.isArray(b) ? b[0] : "#8ed8c9"), num(Array.isArray(b) ? b[1] : 6, 6)] as [string, number]); standing(S, ref, o, dim(o.w, 2), (L, y, ww) => { L.fy(y, 0.125, ww - 0.125, 17, 19, bars[0]?.[0] ?? "#8ed8c9"); barsOn(L, y, ww, bars.length ? bars : [["#8ed8c9", 6]]); }); },
  },
  "hooks board": { label: "Board of hooks", group: "boards", defaults: {}, params: [], size: () => [1, 1], make: (S, ref, o) => standing(S, ref, o, 1, (L, y) => [0, 1, 2, 3].forEach((k) => L.fy(y, 0.125 + k * 0.25, 0.25 + k * 0.25, 8 + (k % 2) * 3, 12 + (k % 2) * 3, "#f3c978"))) },
  "reading table": fixedKind("reading table", "tables"), "folder table": fixedKind("folder table", "tables"), "meeting table": fixedKind("meeting table", "tables"),
  "cooling unit": fixedKind("cooling unit", "machines"), "console": fixedKind("console", "machines"), "deploy console": fixedKind("deploy console", "machines"), "rocket": fixedKind("rocket", "machines"),
  "control panel": fixedKind("control panel", "machines"), "voice booth": fixedKind("voice booth", "machines"),
  "accounts desk": fixedKind("accounts desk", "desks"), "queue desk": fixedKind("queue desk", "desks"), "key desk": fixedKind("key desk", "desks"),
  "crates": fixedKind("crates", "storage"), "bin": fixedKind("bin", "other"), "water cooler": fixedKind("water cooler", "other"),
  rug: {
    label: "Rug", group: "other", defaults: { w: 3, d: 2, c: "#c6ece2", c2: "#2f8f7c" }, params: [{ key: "w", label: "Width", kind: "number", min: 1, max: 12 }, { key: "d", label: "Depth", kind: "number", min: 1, max: 12 }],
    size: (o) => [dim(o.w, 3), dim(o.d, 2)], make: (S, _ref, o) => { S.rugs.push({ i: o.i, j: o.j, w: dim(o.w, 3), d: dim(o.d, 2), c: String(o.c ?? "#c6ece2"), c2: String(o.c2 ?? mix(String(o.c ?? "#c6ece2"), "#000000", 0.35)) }); },
  },
};

/** The footprint of an object on the plan, [i, j, width, depth], or null when its kind is unknown. */
export function footprintOf(o: Obj): [number, number, number, number] | null {
  const k = KINDS[o.kind];
  if (!k) return null;
  const [w, d] = k.size(o);
  if (o.kind === "workstation") {
    // the desk is the far row of the two the object covers; the footprint is the whole 1 or 2 by 2 block, turned with the facing
    return [o.i, o.j, w, d];
  }
  return [o.i, o.j, w, d];
}

// the catalogs are looked up with names that come from a saved map, so they must not have the inherited names ("constructor", "toString") of an ordinary object
for (const o of [KINDS, PROPS, fixed]) Object.setPrototypeOf(o, null);
