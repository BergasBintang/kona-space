// Things on a wall: windows, a door, boards. A thing is painted on the face of a wall tile (a plane of the plan) and only when that face looks towards the camera, which for a tall
// brick wall is when it is one of the two back walls of the current side. So every outer wall of the building can carry its windows, seen from whichever side the camera is on.
// A wall is painted in "t" (how far along the wall, in tiles) and "z" (how high, in pixels).
// It is painted INTO the picture of each wall tile it covers (see walls.ts), clipped to that tile's own face, so it is always drawn with its wall: a thing on a wall can never end up
// in front of or behind the wrong piece, whatever the side of the building.
import type { Colour, Img } from "./img.ts";
import { LOW, WALL, type Iso } from "./iso.ts";
import { FACE_N, type Attach } from "./types.ts";

type Wall = {
  pt: (t: number, z: number) => [number, number];
  rect: (t0: number, t1: number, z0: number, z1: number, c: Colour) => void;
  line: (t0: number, z0: number, t1: number, z1: number, c: Colour) => void;
  dot: (t: number, z: number, c: Colour) => void;
};
type Art = { label: string; draw: (w: Wall, a: number, b: number) => void };

/** The boards that can hang on a wall; `a` and `b` are where the board starts and ends along the wall. */
export const ARTS: Record<string, Art> = {
  window: {
    label: "Window", draw: (w, a, b) => {
      const t0 = a + 0.125, t1 = b - 0.125;
      w.rect(t0 - 0.125, t1 + 0.125, 9, 29, "#efe3c8"); w.rect(t0, t1, 11, 27, "#9fd0e8"); w.rect(t0, t1, 11, 19, "#b8dff0");
      w.line((t0 + t1) / 2, 11, (t0 + t1) / 2, 27, "#efe3c8"); w.line(t0, 19, t1, 19, "#efe3c8"); w.rect(t0 - 0.125, t1 + 0.125, 8, 10, "#d9c39a");
    },
  },
  door: {
    label: "Door", draw: (w, a, b) => { // a frame, two leaves with glass, handles
      const mid = (a + b) / 2;
      w.rect(a, b, 0, 28, "#6c4727"); w.rect(a + 0.125, b - 0.125, 0, 26, "#b07d4f"); w.line(mid, 0, mid, 26, "#6c4727");
      for (const [pa, pb] of [[a + 0.25, mid - 0.125], [mid + 0.125, b - 0.25]]) { w.rect(pa, pb, 14, 23, "#9fd0e8"); w.rect(pa, pb, 14, 18, "#b8dff0"); w.rect(pa, pb, 3, 11, "#946236"); }
      w.dot(mid - 0.25, 8, "#f3c978"); w.dot(mid + 0.25, 8, "#f3c978");
    },
  },
  cork: {
    label: "Cork board", draw: (w, a, b) => {
      w.rect(a, b, 8, 29, "#7a5530"); w.rect(a + 0.125, b - 0.125, 9.5, 27.5, "#c89b63");
      const noteC = ["#f3c978", "#8ed8c9", "#d9786a", "#7fb1e0", "#f7e1b0"], cols = Math.max(1, Math.floor((b - a - 0.25) / 0.625));
      for (let c = 0; c < cols; c++) { const x = a + 0.25 + c * 0.625; w.line(x - 0.0625, 10, x - 0.0625, 27, "#85602f"); for (let k = 0; k < 3 - (c % 2); k++) w.rect(x, x + 0.5, 21 - k * 5, 25 - k * 5, noteC[(c + k) % 5]); }
    },
  },
  branches: {
    label: "Branch board", draw: (w, a, b) => {
      w.rect(a, b, 8, 29, "#2d3643"); w.rect(a + 0.125, b - 0.125, 9.5, 27.5, "#3b4658");
      w.line(a + 0.5, 12, a + 2.375, 12, "#8ed8c9"); w.line(a + 1.125, 12, a + 1.125, 17.5, "#f3c978"); w.line(a + 1.125, 17.5, a + 1.75, 17.5, "#f3c978"); w.line(a + 1.75, 17.5, a + 1.75, 23, "#d9786a");
      w.line(a + 1.75, 23, a + 2.375, 23, "#d9786a"); w.line(a + 1.75, 17.5, a + 2.375, 12, "#8ed8c9");
      ([[0.5, 12, "#8ed8c9"], [1.125, 12, "#8ed8c9"], [1.75, 12, "#8ed8c9"], [2.375, 12, "#8ed8c9"], [1.125, 17.5, "#f3c978"], [1.75, 17.5, "#f3c978"], [1.75, 23, "#d9786a"], [2.375, 23, "#d9786a"]] as [number, number, string][])
        .forEach(([t, z, c]) => w.dot(a + t, z, c));
    },
  },
  staff: {
    label: "Staff board", draw: (w, a, b) => {
      w.rect(a, b, 12, 27, "#7a5530"); w.rect(a + 0.125, b - 0.125, 13.2, 25.8, "#e9dfc8");
      for (let k = 0; k < 5; k++) { // a peg is 3 pixels wide and 2 high
        const t = a + 0.5 + k * 0.5625;
        for (const [z, c] of [[22, "#e8b25a"], [17, k % 2 ? "#8ed8c9" : "#d9786a"]] as [number, string][]) for (const dt of [-0.0625, 0, 0.0625]) for (const dz of [0, -1]) w.dot(t + dt, z + dz, c);
      }
    },
  },
};
Object.setPrototypeOf(ARTS, null); // looked up with a name from a saved map: no inherited names

/** Something on a wall, ready to be painted: the wall tiles it covers, and how to paint it on one of them. */
export type DecorPlan = {
  /** the wall tiles it covers, as [i, j] */
  cells: [number, number][];
  /** the wall it hangs on runs along i (its face looks along j) */
  alongI: boolean;
  /** paint it on the face of one wall tile: `img` takes only the pixels that belong to that tile; `lo` and `hi` are where the tile starts and ends along the wall; `tall` is a brick wall */
  paint: (img: Img, lo: number, hi: number, tall: boolean) => void;
};

/** A thing on a wall, or null when its face looks away from the camera. */
export function decorPlan(iso: Iso, a: Attach): DecorPlan | null {
  if (a.kind === "doorway") return null;
  const n = FACE_N[a.face], alongI = n[1] !== 0; // a face that looks along j belongs to a wall that runs along i
  const span = Math.max(1, a.span ?? 1), t0 = alongI ? a.i : a.j, t1 = t0 + span;
  const plane = alongI ? a.j + (n[1] > 0 ? 1 : 0) : a.i + (n[0] > 0 ? 1 : 0);
  const p0: [number, number] = alongI ? [t0, plane] : [plane, t0], at = iso.rot(...p0), s = iso.rot(p0[0] + n[0], p0[1] + n[1]);
  if (s[0] - at[0] <= 0 && s[1] - at[1] <= 0) return null; // this face looks away from the camera
  const kind = a.kind === "art" ? ARTS[a.art ?? ""] : ARTS[a.kind];
  if (!kind) return null;
  const pt = (t: number, z: number): [number, number] => iso.P(alongI ? t : plane, alongI ? plane : t, z);
  const cells = Array.from({ length: span }, (_, k): [number, number] => (alongI ? [a.i + k, a.j] : [a.i, a.j + k]));
  return {
    cells, alongI,
    paint: (img, lo, hi, tall) => {
      if (!tall && a.kind !== "door") return; // only a door shows on a low wall
      const top = tall ? WALL : LOW - 3, cl = (t: number) => Math.min(hi, Math.max(lo, t));
      const w: Wall = {
        pt,
        rect: (a0, b0, z0, z1, c) => { const u = cl(a0), v = cl(b0); if (v > u) img.poly([pt(u, Math.min(z1, top)), pt(v, Math.min(z1, top)), pt(v, z0), pt(u, z0)], c); },
        line: (ta, za, tb, zb, c) => { // the part of the line that lies over this tile
          if ((ta < lo && tb < lo) || (ta > hi && tb > hi)) return;
          const at = (t: number) => (tb === ta ? za : za + ((t - ta) / (tb - ta)) * (zb - za));
          const f = Math.max(lo, Math.min(ta, tb)), g = Math.min(hi, Math.max(ta, tb)), p = pt(f, at(f)), r = pt(g, at(g));
          img.line(p[0], p[1], r[0], r[1], c);
        },
        dot: (t, z, c) => { if (t >= lo && t < hi) { const p = pt(t, z); img.set(p[0], p[1], c); } },
      };
      kind.draw(w, t0, t1);
    },
  };
}
