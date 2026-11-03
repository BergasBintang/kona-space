// Bako, the second office boy: Kibby's shape (the same rows, the same hop and lean) in other colours. A very dark brown head and body, three peach stripes on the forehead, light eyes
// (so they stand out on the dark head), a peach apron and the same red neckerchief. Kibby helps and holds a mug; Bako is the social one who knows every bit of office gossip.
// He is not one of the eleven roles either. He has two jobs (lib/bako.ts): he sweeps the hall with a broom, and he fetches a bento at the door and brings it to someone at a desk.
// His sheet is out/bako.png: a row per look (only 0 and 2 are drawn, 1 and 3 are mirrors), a column per frame. The first seven frames are Kibby's (with the broom), then the same walk with the bento.
import { Img, fromRows } from "./lib.mjs";
import { PAL, FRAME_W, FRAME_H, TAIL, layer, CX, CY } from "./cat.mjs";
import { front, behind, pose, WALK } from "./kibby.mjs";

// f and d are the head (its shade), B and D the body: the same dark brown. S is the stripes, A the apron (a, its hem; P, its pocket), l the muzzle, t the neckerchief, e the eyes.
export const BAKO = { f: "#1c110f", d: "#130b09", B: "#1c110f", D: "#130b09", S: "#fdd8ac", l: "#3a2720", t: "#d9604f", e: "#f7d44f", p: "#e3a98a", A: "#fdd8ac", a: "#d4aa7a", P: "#fff4e0", c: "#8a5a33", Y: "#c9a23a" };
const BPAL = { ...PAL, ...BAKO };

// the broom: a 7 x 18 picture at (0, 2): a thin handle and a head of straw on the floor, held by a paw
const BROOM = fromRows([
  "...c...", "...c...", "...c...", "...c...", "...c...", "...c...", "...c...", "...c...", "...c...", "...c...", "...c...", "...c...", "...c...", "...c...",
  "..ooo..", ".oyyyo.", "oyyYyyo", "ooooooo",
], BPAL);
// the bento: a 7 x 6 red box tied with a yellow band, held where Kibby holds his mug
const BENTO = fromRows([".ooooo.", "orrrrro", "oyyyyyo", "orrwrro", "orrrrro", ".ooooo."], BPAL);

export const FRAMES = ["idle", "blink", "walkA", "walkB", "walkC", "walkD", "happy", "carryIdle", "carryA", "carryB", "carryC", "carryD"];
export const LOOKS = 4;

function drawn(frame, dir, carry) { // dir 0 or 2
  const back = dir === 2, img = new Img(FRAME_W, FRAME_H);
  img.blit(fromRows(back ? behind : front, BPAL), CX, CY);
  const eyes = [3, 8], eye = (x, y, c) => img.set(CX + x, CY + y, c);
  const skin = (x, y) => img.get(CX + x + (x === eyes[0] ? 1 : -1), CY + y);
  if (!back && frame === "blink") eyes.forEach((x) => eye(x, 5, skin(x, 5)));
  if (!back && frame === "happy") { eyes.forEach((x) => eye(x, 6, skin(x, 6))); eyes.forEach((x) => { eye(x, 5, BAKO.e); eye(x - 1, 6, BAKO.e); eye(x + 1, 6, BAKO.e); }); } // the smiling eyes are light, not dark
  img.blit(layer(TAIL.map(([x, y]) => [CX + x, CY + y]), BAKO.B), 0, 0);
  // (seen from behind too: the paw on the handle, or the arm round the bento, comes out on the left side of the body in every look)
  if (carry) { img.blit(BENTO, 0, 10); img.blit(layer([[7, 13], [7, 14]], BAKO.B), 0, 0); }
  else { img.blit(BROOM, 0, 2); img.blit(layer([[4, 12], [5, 12], [6, 12]], BAKO.B), 0, 0); img.blit(layer([[4, 13], [5, 13], [6, 13]], PAL.o), 0, 0); } // the paw on the handle
  return img;
}

export function bako(frame, dir = 0) {
  if (dir % 2 === 1) return bako(frame, dir - 1).flipX();
  const carry = frame.startsWith("carry"), name = carry ? (frame === "carryIdle" ? "idle" : "walk" + frame.slice(5)) : frame, w = WALK[name];
  return w ? pose(drawn("idle", dir, carry), w[0], w[1]) : drawn(name, dir, carry);
}

// one row per look, one column per frame
export function bakoSheet() {
  const s = new Img(FRAME_W * FRAMES.length, FRAME_H * LOOKS);
  for (let dir = 0; dir < LOOKS; dir++) FRAMES.forEach((f, col) => s.blit(bako(f, dir), col * FRAME_W, dir * FRAME_H));
  return s;
}
