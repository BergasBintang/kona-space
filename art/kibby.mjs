// Kibby, the office boy: a grey cat (light grey head with three dark stripes on the forehead, paler body) in a blue apron and a red neckerchief, with a mug in his paw. He is not one of the eleven roles (no desk, no session): he walks the
// hall and talks. He is drawn like the cats (the same 28 x 20 frame and the same 16 x 18 body) with the same two drawn looks (0 down-left, 2 up-left; 1 and 3 are their mirror
// images), but his frames are a walk: a small hop with a small lean, one way then the other (walkA, walkB, walkC, walkD), plus idle, blink and happy (while he talks).
import { Img, fromRows } from "./lib.mjs";
import { PAL, FRAME_W, FRAME_H, TURNED, BEHIND, TAIL, layer, CX, CY } from "./cat.mjs";

// A light grey head (f, with d for its shade and S for the three dark stripes on the forehead), a paler grey body (B, with D for its shade) and a lighter muzzle (l).
export const KIBBY = { f: "#c7c7c7", d: "#acacac", S: "#363b43", l: "#f1f3f6", B: "#e3e7ec", D: "#c6ccd5", t: "#d9604f", e: "#1f1712", p: "#f0a8a0", A: "#5a86c8", a: "#46699e", P: "#f4efe5", c: "#6f4a30" };
const KPAL = { ...PAL, ...KIBBY };
const torso = (x) => "..o" + x + "o..";
const body = (r) => r.replace(/f/g, "B").replace(/d/g, "D"); // the rows below are written with f and d; the body takes the light grey
const APRON = ["fAAAAAAAdd", "fAAAAAAAdd", "fAPPPAAAdd", "fAPPPAAAdd", "fAAAAAAAdd", "faaaaaaadd"].map(body); // a bib with a pocket, a darker hem
const BACK = ["ffffffffdd", "ffffffffdd", "ffffffffdd", "fAAAAAAAdd", "fffAAfffdd", "ffffffffdd"].map(body); // from behind: the coat, the apron's belt and the bow of its strings
const put = (row, x, c) => row.slice(0, x) + c + row.slice(x + 1);
// three stripes on the forehead (the middle one is the longest), seen from the front only; the old shade patch on the forehead goes
const STRIPES = [[4, 3], [4, 4], [6, 3], [6, 4], [6, 5], [8, 3], [8, 4]]; // [column, row] inside the 16 x 18 cat
const forehead = TURNED.map((r, n) => (n === 4 ? r.replace(/d/g, (m, i) => (i < 8 ? "f" : m)) : r));
const front = forehead.map((r, n) => (n >= 11 && n <= 16 ? torso(APRON[n - 11]) : STRIPES.reduce((s, [x, y]) => (y === n ? put(s, x, "S") : s), r)));
const behind = BEHIND.map((r, n) => (n >= 11 && n <= 16 ? torso(BACK[n - 11]) : r));
const MUG = fromRows([".ooooo.", "owcccwo", "owwwwwo", "owwwwwo", ".owwwo.", "..ooo.."], KPAL); // 7 x 6, held where the role cats hold their card

export const FRAMES = ["idle", "blink", "walkA", "walkB", "walkC", "walkD", "happy"];
export const LOOKS = 4;
const LEAN_ROWS = 12; // the rows above this lean (the head and the top of the body); the feet stay

// the whole frame, hopped up and the top of it leaned
function pose(src, hop, lean) {
  const out = new Img(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const p = src.get(x, y); if (p[3]) out.set(x + (y < LEAN_ROWS ? lean : 0), y - hop, p); }
  return out;
}
const WALK = { walkA: [2, -1], walkB: [0, 0], walkC: [2, 1], walkD: [0, 0] }; // [hop in pixels, lean in pixels]

function drawn(frame, dir) { // dir 0 or 2
  const back = dir === 2, img = new Img(FRAME_W, FRAME_H);
  img.blit(fromRows(back ? behind : front, KPAL), CX, CY);
  const eyes = [3, 8], eye = (x, y, c) => img.set(CX + x, CY + y, c);
  const skin = (x, y) => img.get(CX + x + (x === eyes[0] ? 1 : -1), CY + y);
  if (!back && frame === "blink") eyes.forEach((x) => eye(x, 5, skin(x, 5)));
  if (!back && frame === "happy") { eyes.forEach((x) => eye(x, 6, skin(x, 6))); eyes.forEach((x) => { eye(x, 5, PAL.o); eye(x - 1, 6, PAL.o); eye(x + 1, 6, PAL.o); }); }
  img.blit(layer(TAIL.map(([x, y]) => [CX + x, CY + y]), KIBBY.B), 0, 0);
  if (!back) { img.blit(MUG, 0, 10); img.blit(layer([[7, 13], [7, 14]], KIBBY.B), 0, 0); } // the mug, and the arm that holds it
  return img;
}

export function kibby(frame, dir = 0) {
  if (dir % 2 === 1) return kibby(frame, dir - 1).flipX();
  const w = WALK[frame];
  return w ? pose(drawn("idle", dir), w[0], w[1]) : drawn(frame, dir);
}

// one row per look, one column per frame
export function kibbySheet() {
  const s = new Img(FRAME_W * FRAMES.length, FRAME_H * LOOKS);
  for (let dir = 0; dir < LOOKS; dir++) FRAMES.forEach((f, col) => s.blit(kibby(f, dir), col * FRAME_W, dir * FRAME_H));
  return s;
}
