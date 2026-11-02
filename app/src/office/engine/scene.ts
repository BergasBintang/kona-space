// The scene: a map seen from one side, ready to draw. It holds the ground (the slab, the floors, the rugs) as one picture, and everything that stands on it as a list of pictures
// ordered from back to front: the walls, the things on the walls, the furniture and the cats. It also says what can be clicked (the people and the pieces that open a screen), and which
// tiles Kibby may walk on.
import { Img } from "./img.ts";
import { WALL_SHADES } from "./palette.ts";
import { Iso, LOW, WALL, STEP } from "./iso.ts";
import { KINDS, Stage, footprintOf, type Item } from "./furniture.ts";
import { renderWalls, type WallBox } from "./walls.ts";
import { ARTS, UNIQUE_ARTS, WALL_PAGES, decorPlan, decorRect } from "./decor.ts";
import { drawGround } from "./floor.ts";
import { doorwayGaps } from "./doorway.ts";
import type { FloorStyle, OfficeMap } from "./types.ts";

/** Something to click: a person (a cat with its desk) or a piece that opens a screen (furniture, or a board on a wall). `rect` is [x0, y0, x1, y1] in the picture's own pixels. */
export type Hit = { key: string; kind: "person" | "piece"; /** the role of a person */ role?: string; /** the screen a piece opens (a Place) */ opens?: string; label: string; rect: [number, number, number, number]; /** the nearer ones are on top, so they win a click */ front: number };
export type Scene = {
  iso: Iso;
  width: number;
  height: number;
  /** the part of the picture that is filled: [x0, y0, x1, y1] */
  content: [number, number, number, number];
  ground: Img;
  /** from back to front */
  items: Item[];
  /** the screen box of each item, [x0, y0, x1, y1] */
  boxes: number[][];
  cats: { role: string; x: number; y: number; depth: number; dir: number }[];
  /** what can be clicked: the people and the pieces that open a screen, the nearest last */
  hits: Hit[];
  /** the plan tiles Kibby may stand on: floor, no wall, nothing standing on it */
  walkable: boolean[][];
  /** the tiles of the plan that are tall brick walls on this side */
  tall: Set<string>;
};

const ARTS_LABEL = (art: string) => ARTS[art]?.label ?? art;

export const styleMap = (map: OfficeMap) => new Map(map.styles.map((r) => [r.id, r] as [string, FloorStyle]));

export function buildScene(map: OfficeMap, view: number): Scene {
  const iso = new Iso(map.cols, map.rows, view), styleOf = styleMap(map);
  const stage = new Stage(iso);
  map.objects.forEach((o, k) => { try { KINDS[o.kind]?.make(stage, k, o); } catch { /* a broken object is left out; checks.ts names it */ } });
  const ground = drawGround(map, iso, stage.rugs, styleOf);

  // ---- walls: a block on every wall tile, tall where the open air is behind it, low elsewhere; all one colour (palette.ts WALL_COLOUR)
  const wallAt = (i: number, j: number) => map.walls[j]?.[i] === true;
  const hasGround = (u: number, v: number) => { if (u < 0 || v < 0 || u >= iso.U || v >= iso.V) return false; const [i, j] = iso.unCell(u, v); return map.floor[j]?.[i] != null || wallAt(i, j); };
  const tall = new Set<string>(), boxes: WallBox[] = [], boxAt = new Map<string, WallBox>();
  for (let j = 0; j < map.rows; j++) for (let i = 0; i < map.cols; i++) {
    if (!wallAt(i, j)) continue;
    const [u, v] = iso.cell(i, j), isTall = !hasGround(u - 1, v) || !hasGround(u, v - 1);
    if (isTall) tall.add(`${i},${j}`);
    // every wall is the same colour in the same three shades; only the height differs
    const box: WallBox = { u0: u, u1: u + 1, v0: v, v1: v + 1, h: isTall ? WALL : LOW, m: WALL_SHADES, band: null, tall: isTall, label: isTall ? `back wall ${i},${j}` : `wall ${i},${j}`, ref: -1, kind: "wall" };
    box.tile = [i, j]; boxes.push(box); boxAt.set(`${i},${j}`, box);
  }
  // things on walls are painted into the picture of each wall tile they cover (walls.ts)
  map.attach.forEach((a) => {
    const p = decorPlan(iso, a);
    if (p) for (const [i, j] of p.cells) { const b = boxAt.get(`${i},${j}`); if (b) (b.decor ??= []).push(p); }
  });
  // a doorway is an opening in a wall line, of any width up to four tiles: a post at each end of the gap, in the wall's colour (engine/doorway.ts)
  for (const g of doorwayGaps(map)) {
    const m = WALL_SHADES;
    // a post is 0.2 of a tile along the wall and 0.25 across it, at the very end of the gap: Kibby stands on the middle of a tile and is 0.6 of a tile wide, so he never touches one
    const posts = g.axis === "i" ? [iso.foot(g.first[0], g.first[1] + 0.375, 0.2, 0.25), iso.foot(g.last[0] + 0.8, g.last[1] + 0.375, 0.2, 0.25)] : [iso.foot(g.first[0] + 0.375, g.first[1], 0.25, 0.2), iso.foot(g.last[0] + 0.375, g.last[1] + 0.8, 0.25, 0.2)];
    for (const [u0, u1, v0, v1] of posts) boxes.push({ u0, u1, v0, v1, h: LOW + STEP, m, band: null, tall: false, label: `door post at ${g.first[0]},${g.first[1]}`, ref: -1, kind: "post" });
  }
  const items: Item[] = [...renderWalls(boxes, iso), ...stage.items];

  // ---- the order of drawing. Sorting by the centre of a piece is wrong for a long piece beside a wall (the wall is in front of one half of it and behind the other). So whatever
  // has a footprint is ordered by what really lies in front of what: A goes before B when A lies wholly behind B along u or along v. Where that says nothing, the order by depth stays.
  const sorted = items.sort((a, b) => a.depth - b.depth);
  {
    const slots: number[] = [], solids: Item[] = [];
    sorted.forEach((t, n) => { if (t.fp) { slots.push(n); solids.push(t); } });
    const behind = (a: Item, b: Item) => a.fp![1] <= b.fp![0] + 1e-6 || a.fp![3] <= b.fp![2] + 1e-6;
    const before: number[][] = solids.map(() => []), waiting = solids.map(() => 0);
    for (let x = 0; x < solids.length; x++) for (let y = 0; y < solids.length; y++) {
      if (x === y || !behind(solids[x], solids[y]) || behind(solids[y], solids[x])) continue; // behind both ways: side by side on the screen, no order needed
      before[x].push(y); waiting[y]++;
    }
    const ready = solids.map((_, n) => n).filter((n) => !waiting[n]), order: number[] = [], done = new Set<number>();
    while (order.length < solids.length) {
      if (!ready.length) { const rest = solids.map((_, n) => n).filter((n) => !done.has(n)); ready.push(rest.sort((a, b) => solids[a].depth - solids[b].depth)[0]); } // a loop: break it at the nearest
      ready.sort((a, b) => solids[a].depth - solids[b].depth);
      const n = ready.shift()!;
      if (done.has(n)) continue;
      order.push(n); done.add(n);
      for (const m of before[n]) if (--waiting[m] === 0) ready.push(m);
    }
    order.forEach((n, k) => { sorted[slots[k]] = solids[n]; });
  }
  const sbox = sorted.map((t) => (t.img ? [t.x, t.y, t.x + t.img.w, t.y + t.img.h] : [t.x, t.y, t.x + 28, t.y + 20]));

  // ---- what can be clicked: each person (the chair, the desk and the cat together) and each piece that opens a screen; and the boards on tall walls that open one
  const hits: Hit[] = [];
  map.objects.forEach((o, k) => {
    const kd = KINDS[o.kind];
    if (!kd || (o.kind !== "workstation" && !kd.opens)) return;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    sorted.forEach((it, n) => { if (it.ref === k) { const b = sbox[n]; bx0 = Math.min(bx0, b[0]); by0 = Math.min(by0, b[1]); bx1 = Math.max(bx1, b[2]); by1 = Math.max(by1, b[3]); } });
    if (!Number.isFinite(bx0)) return;
    const person = o.kind === "workstation";
    hits.push({ key: person ? `person:${String(o.role)}` : `piece:${o.kind}`, kind: person ? "person" : "piece", role: person ? String(o.role) : undefined, opens: kd.opens, label: kd.label, rect: [bx0 - 2, by0 - 2, bx1 + 2, by1 + 2], front: by1 });
  });
  map.attach.forEach((a) => {
    const page = a.kind === "art" && a.art && UNIQUE_ARTS.includes(a.art) ? WALL_PAGES[a.art] : undefined;
    if (!page || !a.art) return;
    const r = decorRect(iso, a);
    if (r && decorPlan(iso, a)!.cells.every(([i, j]) => tall.has(`${i},${j}`))) hits.push({ key: `board:${a.art}`, kind: "piece", opens: page, label: ARTS_LABEL(a.art), rect: [r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1], front: r[3] });
  });
  hits.sort((a, b) => a.front - b.front);

  // ---- where Kibby may walk
  const walkable = Array.from({ length: map.rows }, (_, j) => Array.from({ length: map.cols }, (_, i) => map.floor[j][i] != null && !wallAt(i, j)));
  for (const o of map.objects) {
    const f = KINDS[o.kind] && o.kind !== "rug" ? footprintOf(o) : null;
    if (f) for (let j = f[1]; j < f[1] + f[3]; j++) for (let i = f[0]; i < f[0] + f[2]; i++) if (walkable[j]?.[i] !== undefined) walkable[j][i] = false;
  }

  // ---- the filled part of the picture
  let x0 = iso.width, y0 = iso.height, x1 = 0, y1 = 0;
  const g = ground.trim();
  if (g) { x0 = g.ox; y0 = g.oy; x1 = g.ox + g.w; y1 = g.oy + g.h; }
  for (const b of sbox) { x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  if (x1 <= x0) { x0 = 0; y0 = 0; x1 = iso.width; y1 = iso.height; }

  const cats = sorted.filter((t) => t.kind === "cat").map((t) => ({ role: t.role!, x: t.x, y: t.y, depth: t.depth, dir: t.dir! }));
  return { iso, width: iso.width, height: iso.height, content: [x0, y0, x1, y1], ground, items: sorted, boxes: sbox, cats, hits, walkable, tall };
}

/** Kibby standing at (i, j) of the plan (a point, in tiles): where his picture goes and the place in the list of items where he is drawn (between what lies behind him and what lies in
 * front of him, as for a cat). `k` is the index of the first item drawn after him. */
export const KIB = { w: 28, h: 20, bx: 6, by: 2, bw: 16, bh: 18, footX: 14, footY: 19, half: 0.3 };
export function kibbySlot(scene: Scene, i: number, j: number): { x: number; y: number; k: number } {
  const { iso } = scene, [px, py] = iso.P(i, j), x = Math.round(px) - KIB.footX, y = Math.round(py) - KIB.footY;
  const rect = [x + KIB.bx, y + KIB.by, x + KIB.bx + KIB.bw, y + KIB.by + KIB.bh];
  const [u, v] = iso.rot(i, j), h = KIB.half, K = [u - h, u + h, v - h, v + h], kd = u + v;
  const behind = (a: number[], b: number[]) => a[1] <= b[0] + 1e-6 || a[3] <= b[2] + 1e-6;
  let lo = 0, hi = scene.items.length;
  scene.items.forEach((t, n) => { // only what overlaps his picture on the screen decides where he goes in the list
    const b = scene.boxes[n];
    if (!(b[0] < rect[2] && rect[0] < b[2] && b[1] < rect[3] && rect[1] < b[3])) return;
    if (t.fp) {
      const tb = behind(t.fp, K), kb = behind(K, t.fp);
      if (tb && !kb) lo = Math.max(lo, n + 1); else if (kb && !tb) hi = Math.min(hi, n);
    } else if (t.depth <= kd) lo = Math.max(lo, n + 1); else hi = Math.min(hi, n);
  });
  return { x, y, k: Math.min(lo, scene.items.length) }; // if something asks for a place before and after the same piece, he goes after it
}
