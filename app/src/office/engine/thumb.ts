// A small picture of one piece of furniture, for the editor's list of things to put down: the piece is stood alone on a tiny floor and drawn by the same engine as the office,
// from the first side, then cut out. A cat has no picture of its own (it is drawn from the cat sheet), so its place is returned for the screen to draw.
import { buildScene } from "./scene.ts";
import { Img } from "./img.ts";
import { decorPlan } from "./decor.ts";
import { Iso } from "./iso.ts";
import { FACE_N, type Attach, type Face, type Obj, type OfficeMap } from "./types.ts";

export type Thumb = { img: Img | null; cat: { x: number; y: number; dir: number; role: string } | null };

const SIZE = 9;
const cache = new Map<string, Thumb | null>();

/** A map that holds nothing but the floor and this one object (the object is put on its own tile near the middle). */
function tiny(o: Obj): OfficeMap {
  return {
    version: 1, cols: SIZE, rows: SIZE,
    styles: [{ id: "t", name: "t", floor: ["#e9e2d3", "#e1dac9"], pattern: "tiles" }],
    floor: Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill("t")),
    walls: Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false)),
    attach: [],
    objects: [{ ...o, i: 3, j: 3, facing: o.facing ?? 0 }],
  };
}

/** The picture of an object, or null when it draws nothing of its own (a rug). Kept for the next time the same thing is asked for. */
export function thumbOf(o: Obj): Thumb | null {
  const key = JSON.stringify({ ...o, i: 0, j: 0 });
  if (cache.has(key)) return cache.get(key)!;
  let out: Thumb | null = null;
  try {
    const scene = buildScene(tiny(o), 0), parts = scene.items.filter((t) => t.ref === 0);
    const all = new Img(scene.width, scene.height);
    let cat: Thumb["cat"] = null;
    for (const t of parts) {
      if (t.kind === "cat") cat = { x: t.x, y: t.y, dir: t.dir ?? 0, role: t.role ?? "" };
      else if (t.img) all.blit(t.img, t.x, t.y);
    }
    const img = all.trim();
    out = img || cat ? { img, cat } : null;
  } catch { out = null; }
  cache.set(key, out);
  return out;
}

// ---- the parts of a building that are not furniture: a wall, a doorway, and what hangs on a wall. Each is stood on a tiny map of its own, the same way.
const STYLE = { id: "t", name: "t", floor: ["#e9e2d3", "#e1dac9"] as [string, string], pattern: "tiles" as const };
const blank = (): OfficeMap => ({
  version: 1, cols: SIZE, rows: SIZE, styles: [STYLE],
  floor: Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(null)),
  walls: Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false)),
  attach: [], objects: [],
});

/** The whole picture of a tiny map (the ground too), cut out. */
function pictureOf(map: OfficeMap): Thumb | null {
  try {
    const scene = buildScene(map, 0), all = new Img(scene.width, scene.height);
    all.blit(scene.ground, 0, 0);
    for (const t of scene.items) if (t.img) all.blit(t.img, t.x, t.y);
    const img = all.trim();
    return img ? { img, cat: null } : null;
  } catch { return null; }
}

/** A wall run of `len` tiles that the camera sees from the front, with a strip of floor before it. `face` is the side a thing on it would look out of. */
function wallRun(len: number, face: Face, attach?: Omit<Attach, "i" | "j" | "face">): OfficeMap {
  const m = blank(), alongI = FACE_N[face][1] !== 0, sign = alongI ? FACE_N[face][1] : FACE_N[face][0];
  for (let k = 0; k < len; k++) {
    const wi = alongI ? 3 + k : 3, wj = alongI ? 3 : 3 + k;
    m.walls[wj][wi] = true;
    for (let s = 1; s <= 2; s++) { const fi = alongI ? wi : 3 + sign * s, fj = alongI ? 3 + sign * s : wj; m.floor[fj][fi] = "t"; }
  }
  if (attach) m.attach.push({ i: 3, j: 3, face, ...attach } as Attach);
  return m;
}

/** The face of a wall that looks towards the camera (from the first side), so that what hangs on it is drawn. */
const FRONT: Face = (() => {
  const iso = new Iso(SIZE, SIZE, 0);
  return (["j+", "i+", "j-", "i-"] as Face[]).find((face) => decorPlan(iso, { i: 3, j: 3, face, kind: "window" }) !== null) ?? "j+";
})();

const extra = new Map<string, Thumb | null>();
const once = (key: string, make: () => Thumb | null) => { if (!extra.has(key)) extra.set(key, make()); return extra.get(key)!; };

/** A piece of wall. */
export const thumbOfWall = () => once("wall", () => pictureOf(wallRun(3, FRONT)));

/** Something hung on a wall: a window, a door or a board. */
export const thumbOfAttach = (a: { kind: "window" | "door" | "art"; art?: string; span: number }) =>
  once(`attach:${a.kind}:${a.art ?? ""}:${a.span}`, () => pictureOf(wallRun(Math.max(2, a.span), FRONT, { kind: a.kind, art: a.art, span: a.span })));

/** A doorway: a gap in a wall with a post on each side. */
export const thumbOfDoorway = () => once("doorway", () => {
  const m = wallRun(5, FRONT), alongI = FACE_N[FRONT][1] !== 0;
  const gap = alongI ? [5, 3] : [3, 5];
  m.walls[gap[1]][gap[0]] = false; m.floor[gap[1]][gap[0]] = "t";
  m.attach.push({ i: gap[0], j: gap[1], face: "j+", kind: "doorway" });
  return pictureOf(m);
});
