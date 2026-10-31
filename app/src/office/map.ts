// The standard office (built into Kona, never changed by the editor), reading a saved map safely, and the checks that say what looks wrong in a map. Nothing here draws.
import standardJson from "./standard.json" with { type: "json" };
import cats from "./cats.json" with { type: "json" };
import { KINDS, footprintOf } from "./engine/furniture.ts";
import { FACES, type Attach, type AttachKind, type Obj, type OfficeMap, type Pattern, type RoomDef } from "./engine/types.ts";

export const STANDARD = standardJson as unknown as OfficeMap;
/** the eleven roles that have a cat, in the order of the cat sheet */
export const CAT_ROLES: { id: string; name: string }[] = cats.rows.map((r) => ({ id: r.id, name: r.name }));

const HEX = /^#[0-9a-fA-F]{6}$/;
const PATTERNS: Pattern[] = ["tiles", "checker", "planks", "stripeI", "carpet"];
const ATTACH_KINDS: AttachKind[] = ["window", "door", "art", "doorway"];
const MAX_SIDE = 120;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
/** a copy without the fields that are undefined, so a map that is read and written again comes out the same */
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Read a saved map. Returns the map, or the words that say what is wrong with it. Nothing in it can make the screen fail: a thing it does not understand is an error here. */
export function parseMap(text: string): { map: OfficeMap } | { error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: "it is not valid JSON" }; }
  if (!isObj(raw) || raw.version !== 1) return { error: "it is not a map of version 1" };
  const { cols, rows } = raw;
  if (!isInt(cols) || !isInt(rows) || cols < 1 || rows < 1 || cols > MAX_SIDE || rows > MAX_SIDE) return { error: "its size is not right" };
  if (!Array.isArray(raw.rooms) || raw.rooms.length === 0 || raw.rooms.length > 60) return { error: "it has no rooms" };
  const rooms: RoomDef[] = [], ids = new Set<string>();
  for (const r of raw.rooms) {
    if (!isObj(r) || typeof r.id !== "string" || !r.id || ids.has(r.id) || typeof r.name !== "string") return { error: "a room is not right" };
    if (r.kind !== "hall" && r.kind !== "team" && r.kind !== "place") return { error: `the room ${r.id} has no kind` };
    if (!Array.isArray(r.floor) || r.floor.length !== 2 || !r.floor.every((c) => typeof c === "string" && HEX.test(c))) return { error: `the room ${r.id} has no floor colours` };
    if (!PATTERNS.includes(r.pattern as Pattern)) return { error: `the room ${r.id} has no floor pattern` };
    if (typeof r.wall !== "string" || !HEX.test(r.wall)) return { error: `the room ${r.id} has no wall colour` };
    ids.add(r.id);
    rooms.push(clean({ id: r.id, name: r.name, kind: r.kind, open: r.open === true ? true : undefined, color: typeof r.color === "string" && HEX.test(r.color) ? r.color : undefined, floor: r.floor as [string, string], pattern: r.pattern as Pattern,
      grout: typeof r.grout === "string" && HEX.test(r.grout) ? r.grout : undefined, wall: r.wall, holds: typeof r.holds === "string" ? r.holds : "" }));
  }
  const { floor, walls } = raw;
  if (!Array.isArray(floor) || floor.length !== rows || !Array.isArray(walls) || walls.length !== rows) return { error: "its floor or its walls are not as big as the map" };
  for (let j = 0; j < rows; j++) {
    const f = floor[j], w = walls[j];
    if (!Array.isArray(f) || f.length !== cols || !Array.isArray(w) || w.length !== cols) return { error: `row ${j} is not as wide as the map` };
    for (let i = 0; i < cols; i++) if ((f[i] !== null && !(typeof f[i] === "string" && ids.has(f[i]))) || typeof w[i] !== "boolean") return { error: `the tile ${i},${j} is not right` };
  }
  const inside = (i: unknown, j: unknown) => isInt(i) && isInt(j) && i >= 0 && j >= 0 && i < cols && j < rows;
  const attach: Attach[] = [];
  if (!Array.isArray(raw.attach)) return { error: "it has no list of things on walls" };
  for (const a of raw.attach) {
    if (!isObj(a) || !inside(a.i, a.j) || !FACES.includes(a.face as never) || !ATTACH_KINDS.includes(a.kind as AttachKind)) return { error: "a thing on a wall is not right" };
    attach.push(clean({ i: a.i as number, j: a.j as number, face: a.face as Attach["face"], kind: a.kind as AttachKind, art: typeof a.art === "string" ? a.art : undefined, span: isInt(a.span) && a.span >= 1 && a.span <= 12 ? a.span : undefined }));
  }
  const objects: Obj[] = [];
  if (!Array.isArray(raw.objects) || raw.objects.length > 1000) return { error: "it has no list of objects" };
  for (const o of raw.objects) {
    if (!isObj(o) || typeof o.kind !== "string" || !inside(o.i, o.j)) return { error: "an object is not right" };
    const facing = o.facing === 0 || o.facing === 1 || o.facing === 2 || o.facing === 3 ? o.facing : undefined; // a turn that is not 0 to 3 is dropped
    objects.push(clean({ ...o, kind: o.kind, i: o.i as number, j: o.j as number, facing }) as Obj);
  }
  return { map: { version: 1, cols, rows, rooms, floor: floor as (string | null)[][], walls: walls as boolean[][], attach, objects } };
}

/** What looks wrong in a map. These are warnings: the map is still drawn and saved, and the owner decides. */
export function checkMap(map: OfficeMap): string[] {
  const out: string[] = [], roomOf = new Map(map.rooms.map((r) => [r.id, r]));
  const wallAt = (i: number, j: number) => map.walls[j]?.[i] === true;
  const floorAt = (i: number, j: number) => (i >= 0 && j >= 0 && i < map.cols && j < map.rows ? map.floor[j][i] : null);
  const taken = new Map<string, string>(); // tile -> label of what stands on it
  const roles = new Map<string, number>();
  map.objects.forEach((o) => {
    const k = KINDS[o.kind];
    if (!k) { out.push(`There is something here that Kona does not know (${o.kind}) at ${o.i},${o.j}.`); return; }
    const f = footprintOf(o)!;
    if (o.kind === "workstation") roles.set(String(o.role), (roles.get(String(o.role)) ?? 0) + 1);
    for (let j = f[1]; j < f[1] + f[3]; j++) for (let i = f[0]; i < f[0] + f[2]; i++) {
      if (floorAt(i, j) == null) { out.push(`${k.label} at ${o.i},${o.j} stands on ground that is not floor.`); return; }
      if (wallAt(i, j)) { out.push(`${k.label} at ${o.i},${o.j} stands in a wall.`); return; }
      if (o.kind === "rug") continue;
      const key = `${i},${j}`, other = taken.get(key);
      if (other) { out.push(`${k.label} at ${o.i},${o.j} overlaps ${other}.`); return; }
      taken.set(key, `${k.label} at ${o.i},${o.j}`);
    }
  });
  for (const r of CAT_ROLES) {
    const n = roles.get(r.id) ?? 0;
    if (n === 0) out.push(`${r.name} has no desk, so there is no cat for it in the office.`);
    else if (n > 1) out.push(`${r.name} has ${n} desks; only one cat can sit at a time.`);
  }
  // every room needs a way to the hall: one of its open tiles next to a tile of the hall (a doorway is such a tile)
  for (const room of map.rooms) {
    if (room.kind === "hall" || room.open) continue;
    let tiles = 0, touches = false;
    for (let j = 0; j < map.rows && !touches; j++) for (let i = 0; i < map.cols; i++) {
      if (map.floor[j][i] !== room.id || wallAt(i, j)) continue;
      tiles++;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { const id = floorAt(a, b), r = id == null ? undefined : roomOf.get(id); if (r && !wallAt(a, b) && (r.kind === "hall" || r.open)) touches = true; }
    }
    if (tiles > 0 && !touches) out.push(`${room.name} has no way to the hall: open a doorway in its wall.`);
  }
  map.attach.forEach((a) => {
    if (a.kind === "doorway") { if (wallAt(a.i, a.j)) out.push(`The doorway at ${a.i},${a.j} is on a wall tile: take the wall away.`); else if (floorAt(a.i, a.j) == null) out.push(`The doorway at ${a.i},${a.j} is not on floor.`); }
    else if (!wallAt(a.i, a.j)) out.push(`The ${a.kind} at ${a.i},${a.j} is not on a wall.`);
  });
  return out;
}
