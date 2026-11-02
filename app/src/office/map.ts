// The standard office (built into Kona, never changed by the editor), reading a saved map safely, and the checks that say what looks wrong in a map. Nothing here draws.
import standardJson from "./standard.json" with { type: "json" };
import cats from "./cats.json" with { type: "json" };
import { KINDS, footprintOf } from "./engine/furniture.ts";
import { FACES, type Attach, type AttachKind, type FloorStyle, type Obj, type OfficeMap, type Pattern } from "./engine/types.ts";
import { ARTS, WALL_PAGES } from "./engine/decor.ts";
import { attachProblem, doorwayAxis } from "./edit.ts";
import { PLACES } from "../lib/places.ts";

export const STANDARD = standardJson as unknown as OfficeMap;
/** the eleven roles that have a cat, in the order of the cat sheet */
export const CAT_ROLES: { id: string; name: string }[] = cats.rows.map((r) => ({ id: r.id, name: r.name }));

const HEX = /^#[0-9a-fA-F]{6}$/;
const PATTERNS: Pattern[] = ["tiles", "checker", "planks", "stripeI", "carpet"];
const ATTACH_KINDS: AttachKind[] = ["window", "door", "art", "doorway"];
const MAX_SIDE = 120;
/** Kinds of furniture that Kona used to have and no longer has (a screen was retired: the voice booth, the logbook stand). A saved office that still holds one is read without it, without a word. */
const RETIRED_KINDS = new Set(["voice booth", "logbook stand"]);
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
  // a map of today has `styles`; a map saved before decision 59 has `rooms`, which are read as styles with the same colours (the name, the kind, the wall colour and the rest are dropped)
  const rawStyles = Array.isArray(raw.styles) ? raw.styles : Array.isArray(raw.rooms) ? raw.rooms : null;
  if (!rawStyles || rawStyles.length === 0 || rawStyles.length > 60) return { error: "it has no floor styles" };
  const styles: FloorStyle[] = [], ids = new Set<string>();
  for (const r of rawStyles) {
    if (!isObj(r) || typeof r.id !== "string" || !r.id || ids.has(r.id)) return { error: "a floor style is not right" };
    if (!Array.isArray(r.floor) || r.floor.length !== 2 || !r.floor.every((c) => typeof c === "string" && HEX.test(c))) return { error: `the floor style ${r.id} has no colours` };
    if (!PATTERNS.includes(r.pattern as Pattern)) return { error: `the floor style ${r.id} has no pattern` };
    ids.add(r.id);
    styles.push(clean({ id: r.id, name: typeof r.name === "string" && r.name ? r.name : r.id, floor: r.floor as [string, string], pattern: r.pattern as Pattern, grout: typeof r.grout === "string" && HEX.test(r.grout) ? r.grout : undefined }));
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
    if (RETIRED_KINDS.has(o.kind)) continue;
    const facing = o.facing === 0 || o.facing === 1 || o.facing === 2 || o.facing === 3 ? o.facing : undefined; // a turn that is not 0 to 3 is dropped
    objects.push(clean({ ...o, kind: o.kind, i: o.i as number, j: o.j as number, facing }) as Obj);
  }
  return { map: { version: 1, cols, rows, styles, floor: floor as (string | null)[][], walls: walls as boolean[][], attach, objects } };
}

/** What looks wrong in a map. These are warnings: the map is still drawn and saved, and the owner decides. */
export function checkMap(map: OfficeMap): string[] {
  const out: string[] = [];
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
  // every area that holds something must be reachable from the rest of the office: the open floor is the biggest connected stretch of floor without walls, a doorway is just floor in a wall line
  const comp = new Map<string, number>(), sizes: number[] = [];
  for (let j = 0; j < map.rows; j++) for (let i = 0; i < map.cols; i++) {
    if (floorAt(i, j) == null || wallAt(i, j) || comp.has(`${i},${j}`)) continue;
    const id = sizes.length; let n = 0; const todo: [number, number][] = [[i, j]]; comp.set(`${i},${j}`, id);
    while (todo.length) { const [x, y] = todo.pop()!; n++; for (const [p, q] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (floorAt(p, q) != null && !wallAt(p, q) && !comp.has(`${p},${q}`)) { comp.set(`${p},${q}`, id); todo.push([p, q]); } }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(0, ...sizes)), shut = new Map<number, string>();
  map.objects.forEach((o) => { if (o.kind === "rug" || !KINDS[o.kind]) return; const id = comp.get(`${o.i},${o.j}`); if (id !== undefined && id !== main && !shut.has(id)) shut.set(id, `${KINDS[o.kind].label} at ${o.i},${o.j}`); });
  shut.forEach((what) => out.push(`${what} is in an area with no way to the rest of the office: open a doorway in its wall.`));
  map.attach.forEach((a) => {
    if (a.kind === "doorway") { if (wallAt(a.i, a.j)) out.push(`The doorway at ${a.i},${a.j} is on a wall tile: take the wall away.`); else if (floorAt(a.i, a.j) == null) out.push(`The doorway at ${a.i},${a.j} is not on floor.`); else if (!doorwayAxis(map, a.i, a.j)) out.push(`The doorway at ${a.i},${a.j} is not in a wall line (a wall tile is needed at each end of the gap), so it does nothing.`); }
    else { const why = attachProblem(map, a); if (why) out.push(why); }
  });
  return out;
}

// ---- what an office must have so that everything in Kona can be opened (decisions 60 and 61)
type Need = { text: string; have: boolean; obj?: Obj; board?: Attach };
const pageName = (p: string) => PLACES.find((x) => x.id === p)?.label ?? p;

/** A desk for each person, a piece for each screen without a person, and the boards that open a screen: each with what is wrong when it is missing, and the one the standard office has. */
function needs(map: OfficeMap): Need[] {
  const out: Need[] = [];
  for (const r of CAT_ROLES) out.push({ text: `${r.name} has no desk, so there is no cat for it in the office.`, have: map.objects.some((o) => o.kind === "workstation" && o.role === r.id), obj: STANDARD.objects.find((o) => o.kind === "workstation" && o.role === r.id) });
  for (const [kind, k] of Object.entries(KINDS)) if (k.opens) out.push({ text: `${k.label} is missing, so the ${pageName(k.opens)} screen cannot be opened.`, have: map.objects.some((o) => o.kind === kind), obj: STANDARD.objects.find((o) => o.kind === kind) });
  for (const [art, page] of Object.entries(WALL_PAGES)) out.push({ text: `The ${ARTS[art]?.label ?? art} is not hung, so the ${pageName(page)} screen cannot be opened.`, have: map.attach.some((a) => a.kind === "art" && a.art === art), board: STANDARD.attach.find((a) => a.kind === "art" && a.art === art) });
  return out;
}

/** What a map is missing that makes a person or a screen impossible to open. A map with any of these is not saved. */
export const missingPieces = (map: OfficeMap): string[] => needs(map).filter((n) => !n.have).map((n) => n.text);

/** Put back what a map is missing: each piece where the standard office has it if that place is free, else on the nearest free floor; a board on its wall if that wall is there, else on the first free stretch of wall.
 * Returns a new map, what was added (in words) and what could not be placed. */
export function ensurePages(map: OfficeMap): { map: OfficeMap; added: string[]; failed: string[] } {
  const lacking = needs(map).filter((n) => !n.have);
  if (lacking.length === 0) return { map, added: [], failed: [] };
  const out = structuredClone(map), added: string[] = [], failed: string[] = [];
  const floorAt = (i: number, j: number) => (i >= 0 && j >= 0 && i < out.cols && j < out.rows ? out.floor[j][i] : null);
  const taken = () => { const s = new Set<string>(); for (const o of out.objects) { const f = KINDS[o.kind] && o.kind !== "rug" ? footprintOf(o) : null; if (f) for (let j = f[1]; j < f[1] + f[3]; j++) for (let i = f[0]; i < f[0] + f[2]; i++) s.add(`${i},${j}`); } return s; };
  const fits = (o: Obj, used: Set<string>) => { const f = footprintOf(o); if (!f) return false; for (let j = f[1]; j < f[1] + f[3]; j++) for (let i = f[0]; i < f[0] + f[2]; i++) if (floorAt(i, j) == null || out.walls[j]?.[i] || used.has(`${i},${j}`)) return false; return true; };
  for (const n of lacking) {
    if (n.obj) {
      const used = taken();
      let spot: Obj | null = null;
      for (let d = 0; d <= out.cols + out.rows && !spot; d++) for (let di = -d; di <= d && !spot; di++) for (const dj of d === Math.abs(di) ? [0] : [-(d - Math.abs(di)), d - Math.abs(di)]) { const c = { ...n.obj, i: n.obj.i + di, j: n.obj.j + dj }; if (c.i >= 0 && c.j >= 0 && c.i < out.cols && c.j < out.rows && fits(c, used)) { spot = c; break; } }
      if (spot) { out.objects.push(spot); added.push(n.text.split(",")[0].replace(/ is missing$| has no desk$/, "")); } else failed.push(n.text);
    } else if (n.board) {
      const span = Math.max(1, n.board.span ?? 1), run = (i: number, j: number) => Array.from({ length: span }, (_, k) => k).every((k) => out.walls[j]?.[i + k] === true && !out.attach.some((a) => a.i === i + k && a.j === j && a.face === "j+" && a.kind !== "doorway"));
      let at: [number, number] | null = run(n.board.i, n.board.j) ? [n.board.i, n.board.j] : null;
      for (let j = 0; j < out.rows && !at; j++) for (let i = 0; i + span <= out.cols && !at; i++) if (run(i, j) && Array.from({ length: span }, (_, k) => k).every((k) => floorAt(i + k, j + 1) != null && !out.walls[j + 1]?.[i + k])) at = [i, j];
      if (at) { out.attach.push({ ...n.board, i: at[0], j: at[1], face: "j+" }); added.push(`The ${ARTS[n.board.art ?? ""]?.label ?? "board"}`); } else failed.push(n.text);
    } else failed.push(n.text);
  }
  return { map: out, added, failed };
}
