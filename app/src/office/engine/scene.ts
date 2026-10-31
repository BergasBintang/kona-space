// The scene: a map seen from one side, ready to draw. It holds the ground (the slab, the floors, the rugs) as one picture, and everything that stands on it as a list of pictures
// ordered from back to front: the walls, the things on the walls, the furniture and the cats. It also says where each room can be clicked, where its name goes, and which tiles
// of the hall Kibby may walk on.
import { Img } from "./img.ts";
import { CAP, CAPC, BRICK, NEUTRAL_WALL, mix, shade } from "./palette.ts";
import { Iso, LOW, WALL, STEP } from "./iso.ts";
import { KINDS, Stage, footprintOf, type Item } from "./furniture.ts";
import { renderWalls, type WallBox } from "./walls.ts";
import { decorPlan } from "./decor.ts";
import { drawGround } from "./floor.ts";
import type { OfficeMap, RoomDef } from "./types.ts";

export type RoomHit = { id: string; name: string; team: boolean; color: string | null; holds: string; /** where the name goes on the picture */ plate: [number, number]; /** the clickable area, as an SVG path */ path: string; /** the front of the room: front rooms win a click */ front: number };
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
  rooms: RoomHit[];
  /** the plan tiles of the hall Kibby may stand on: floor of the hall, no wall, nothing standing on it */
  walkable: boolean[][];
  /** the tiles of the plan that are tall brick walls on this side */
  tall: Set<string>;
};

const RAISE = 28; // a room also owns the strip of wall and furniture above its floor

export const roomMap = (map: OfficeMap) => new Map(map.rooms.map((r) => [r.id, r]));
const isHall = (r: RoomDef | undefined) => !r || r.kind === "hall" || r.open === true;

export function buildScene(map: OfficeMap, view: number): Scene {
  const iso = new Iso(map.cols, map.rows, view), roomOf = roomMap(map);
  const stage = new Stage(iso);
  map.objects.forEach((o, k) => { try { KINDS[o.kind]?.make(stage, k, o); } catch { /* a broken object is left out; checks.ts names it */ } });
  const ground = drawGround(map, iso, stage.rugs, roomOf);

  // ---- walls: a block on every wall tile, tall brick where the open air is behind it
  const wallAt = (i: number, j: number) => map.walls[j]?.[i] === true;
  const hasGround = (u: number, v: number) => { if (u < 0 || v < 0 || u >= iso.U || v >= iso.V) return false; const [i, j] = iso.unCell(u, v); return map.floor[j]?.[i] != null || wallAt(i, j); };
  const roomColourAt = (u: number, v: number): string | null => {
    if (u < 0 || v < 0 || u >= iso.U || v >= iso.V) return null;
    const [i, j] = iso.unCell(u, v), id = map.floor[j]?.[i];
    if (id == null || wallAt(i, j)) return null;
    const r = roomOf.get(id);
    return isHall(r) ? null : r!.wall;
  };
  const tall = new Set<string>(), boxes: WallBox[] = [], boxAt = new Map<string, WallBox>();
  for (let j = 0; j < map.rows; j++) for (let i = 0; i < map.cols; i++) {
    if (!wallAt(i, j)) continue;
    const [u, v] = iso.cell(i, j), isTall = !hasGround(u - 1, v) || !hasGround(u, v - 1);
    if (isTall) tall.add(`${i},${j}`);
    const own = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].map(([a, b]) => { const id = map.floor[b]?.[a]; const r = id == null || wallAt(a, b) ? undefined : roomOf.get(id); return isHall(r) ? null : r!.wall; }).find((c) => c) ?? NEUTRAL_WALL;
    const wcV = roomColourAt(u, v + 1) ?? roomColourAt(u, v - 1) ?? own, wcU = roomColourAt(u + 1, v) ?? roomColourAt(u - 1, v) ?? own;
    const dk = mix(wcU, "#000000", 0.2);
    const box: WallBox = isTall
      ? { u0: u, u1: u + 1, v0: v, v1: v + 1, h: WALL, m: [CAPC[0], BRICK[0], BRICK[1]], band: [CAPC[1], CAPC[2]], brick: true, tall: true, label: `back wall ${i},${j}`, ref: -1, kind: "wall" }
      : { u0: u, u1: u + 1, v0: v, v1: v + 1, h: LOW, m: [CAP, wcV, dk], band: [mix(wcV, "#ffffff", 0.35), mix(dk, "#ffffff", 0.35)], brick: false, tall: false, label: `wall ${i},${j}`, ref: -1, kind: "wall" };
    box.tile = [i, j]; boxes.push(box); boxAt.set(`${i},${j}`, box);
  }
  // things on walls are painted into the picture of each wall tile they cover (walls.ts)
  map.attach.forEach((a) => {
    const p = decorPlan(iso, a);
    if (p) for (const [i, j] of p.cells) { const b = boxAt.get(`${i},${j}`); if (b) (b.decor ??= []).push(p); }
  });
  // a doorway is an opening in a wall line: a post at each end, in the room's colour
  map.attach.forEach((a) => {
    if (a.kind !== "doorway" || wallAt(a.i, a.j) || map.floor[a.j]?.[a.i] == null) return;
    const room = roomOf.get(map.floor[a.j][a.i]!), accent = room?.color ?? mix(room?.wall ?? NEUTRAL_WALL, "#000000", 0.25), m = shade(accent);
    const along = wallAt(a.i - 1, a.j) && wallAt(a.i + 1, a.j) ? "i" : wallAt(a.i, a.j - 1) && wallAt(a.i, a.j + 1) ? "j" : null;
    if (!along) return;
    for (const end of [0, 0.75]) {
      const [u0, u1, v0, v1] = along === "i" ? iso.foot(a.i + end, a.j + 0.375, 0.25, 0.25) : iso.foot(a.i + 0.375, a.j + end, 0.25, 0.25);
      boxes.push({ u0, u1, v0, v1, h: LOW + STEP, m, band: null, brick: false, tall: false, label: `door post at ${a.i},${a.j}`, ref: -1, kind: "post" });
    }
  });
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

  // ---- where a room can be clicked, and its name
  const cells = new Map<string, [number, number][]>();
  for (let j = 0; j < map.rows; j++) for (let i = 0; i < map.cols; i++) {
    const id = map.floor[j][i];
    if (id == null || wallAt(i, j) || roomOf.get(id)?.kind === "hall") continue; // the front desk is open to the hall but is a room you can click
    (cells.get(id) ?? cells.set(id, []).get(id)!).push([i, j]);
  }
  const rooms: RoomHit[] = [];
  for (const r of map.rooms) {
    const list = cells.get(r.id);
    if (!list || r.kind === "hall") continue;
    let d = "", front = -Infinity, cx = 0, cy = 0;
    for (const [i, j] of list) {
      const [u, v] = iso.cell(i, j), top = iso.PR(u, v), right = iso.PR(u + 1, v), bottom = iso.PR(u + 1, v + 1), left = iso.PR(u, v + 1);
      d += `M${left[0]} ${left[1] - RAISE}L${top[0]} ${top[1] - RAISE}L${right[0]} ${right[1] - RAISE}L${right[0]} ${right[1]}L${bottom[0]} ${bottom[1]}L${left[0]} ${left[1]}Z`;
      front = Math.max(front, bottom[1]); cx += top[0]; cy += left[1];
    }
    cx /= list.length; cy /= list.length;
    let best: [number, number] = [cx, cy], bd = Infinity; // the plate goes on the tile nearest the middle, so it is always on the room's own floor
    for (const [i, j] of list) { const [u, v] = iso.cell(i, j), p = iso.PR(u + 0.5, v + 0.5), dd = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (dd < bd) { bd = dd; best = [p[0], p[1]]; } }
    rooms.push({ id: r.id, name: r.name, team: r.kind === "team", color: r.color ?? null, holds: r.holds, plate: [Math.round(best[0]), Math.round(best[1])], path: d, front });
  }
  rooms.sort((a, b) => a.front - b.front); // the front rooms are drawn last, so they win a click

  // ---- where Kibby may walk
  const walkable = Array.from({ length: map.rows }, (_, j) => Array.from({ length: map.cols }, (_, i) => { const id = map.floor[j][i]; return id != null && !wallAt(i, j) && isHall(roomOf.get(id)); }));
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
  return { iso, width: iso.width, height: iso.height, content: [x0, y0, x1, y1], ground, items: sorted, boxes: sbox, cats, rooms, walkable, tall };
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
