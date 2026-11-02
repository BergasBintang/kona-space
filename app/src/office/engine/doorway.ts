// A doorway is a gap in a line of wall: a few floor tiles (at most four) with a wall tile at each end. The tiles marked as a doorway in the map say where the gap is; the gap is drawn with a post
// at each end (scene.ts), and the plan of the editor shows it with a dashed line and an arrow. Pure: it reads a map and draws nothing.
import type { OfficeMap } from "./types.ts";

/** The widest gap in a wall that is a doorway, in tiles. */
export const GAP = 4;

/** Which way the wall runs through a doorway tile, or null when it stands in no wall line (then it is not a doorway and nothing is drawn for it). "i": the wall runs left and right; "j": up and down. */
export function doorwayAxis(m: OfficeMap, i: number, j: number): "i" | "j" | null {
  const ends = (dx: number, dy: number) => { let x = i, y = j; for (let k = 0; k < GAP; k++) { x += dx; y += dy; if (m.walls[y]?.[x] === true) return true; if (m.floor[y]?.[x] == null) return false; } return false; };
  return ends(-1, 0) && ends(1, 0) ? "i" : ends(0, -1) && ends(0, 1) ? "j" : null;
}

/** Every gap that holds a tile marked as a doorway: which way its wall runs, and its first and last tile (so the two posts go at the ends of the whole gap, however wide it is). */
export function doorwayGaps(m: OfficeMap): { axis: "i" | "j"; first: [number, number]; last: [number, number] }[] {
  const out = new Map<string, { axis: "i" | "j"; first: [number, number]; last: [number, number] }>();
  for (const a of m.attach) {
    if (a.kind !== "doorway" || m.walls[a.j]?.[a.i] === true || m.floor[a.j]?.[a.i] == null) continue;
    const axis = doorwayAxis(m, a.i, a.j);
    if (!axis) continue;
    const [dx, dy] = axis === "i" ? [1, 0] : [0, 1];
    let [fi, fj] = [a.i, a.j], [li, lj] = [a.i, a.j];
    while (m.walls[fj - dy]?.[fi - dx] !== true) { fi -= dx; fj -= dy; }
    while (m.walls[lj + dy]?.[li + dx] !== true) { li += dx; lj += dy; }
    out.set(`${axis}:${fi},${fj}`, { axis, first: [fi, fj], last: [li, lj] });
  }
  return [...out.values()];
}
