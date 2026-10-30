// The Kona cat: one cat for every role, told apart by a small icon beside its head.
// A frame is 28 x 20 pixels. The cat itself is 16 x 18 at x 6, y 2; the card with the role icon is held on the left (x 0, y 9); the raised paw uses the right edge.
import { Img, fromRows } from "./lib.mjs";

export const PAL = {
  o: "#33241a", f: "#e8b25a", d: "#b87f35", l: "#f7e1b0", e: "#1f1712", n: "#e8827e", p: "#f0a8a0", t: "#74cbb9",
  w: "#f4efe5", g: "#8a9199", s: "#c3cad2", y: "#f2c94c", r: "#d9604f", b: "#5aa7e0", k: "#4a4f55", G: "#6fbf73", m: "#a77bc9",
};

const head = (x) => ".o" + x + "o.";
const torso = (x) => "..o" + x + "o..";
const CAT = [
  "..oo........oo..",
  ".offo......offo.",
  ".opffooooooffpo.",
  head("ffffffffffff"),
  head("fffffddfffff"),
  head("ffeffffffeff"),
  head("ffeffffffeff"),
  head("fflllnnlllff"),
  head("fffllllllfff"),
  "..oooooooooooo..",
  "...o" + "tttttttt" + "o...",
  torso("ffllllllff"),
  torso("ffllllllff"),
  torso("ffllllllff"),
  torso("dfllllllfd"),
  torso("ffllllllff"),
  torso("ffffffffff"),
  "..oooooooooooo..",
];
// The logo keeps the first turned cat: nearly the front, with the face a little to one side.
const LOGO_RIGHT = CAT.slice();
LOGO_RIGHT[4] = head("fffffffddfff"); LOGO_RIGHT[5] = LOGO_RIGHT[6] = head("fffffeffffef"); LOGO_RIGHT[7] = head("fffflllnnllf"); LOGO_RIGHT[8] = head("ffffllllllff");
const flip = (row) => [...row].reverse().join(""); // a row of the picture seen in a mirror (the picture is as wide each side of its middle)
const LOGO_LOOK = LOGO_RIGHT.map(flip);

// The cat seen from the four directions the building can turn it (dir). Two looks are drawn, the other two are their mirror images (the whole frame is mirrored,
// so the card and the raised paw change sides too). 0 looks down-left: a three-quarter view with the eyes, the muzzle and the belly turned to the left, light from
// the left so the right cheek and flank are in shade. 2 looks up-left: seen from behind, with the left cheek and the inside of the left ear showing. 1 and 3 are 0 and 2 mirrored.
export const TURNED = [
  "..oo........oo..", ".offo......ofdo.", ".opffoooooopfdo.",
  head("fffffffffffd"), head("fffddfffffdd"), head("feffffefffdd"), head("feffffefffdd"), head("fllnnllfffdd"), head("fflllllfffdd"),
  "..oooooooooooo..", "...o" + "tttttttt" + "o...",
  torso("fllllllfdd"), torso("fllllllfdd"), torso("fllllllfdd"), torso("dllllllfdd"), torso("fllllllfdd"), torso("ffffffffdd"), "..oooooooooooo..",
];
export const BEHIND = [
  "..oo........oo..", ".offo......ofdo.", ".opffooooooffdo.",
  head("fffffffffffd"), head("ffffffffffdd"), head("ffffffffffdd"), head("lfffffffffdd"), head("llffffffffdd"), head("lllfffffffdd"),
  "..oooooooooooo..", "...o" + "tttttttt" + "o...",
  torso("ffffffffdd"), torso("ffffffffdd"), torso("ffffffffdd"), torso("dfffffffdd"), torso("ffffffffdd"), torso("ffffffffdd"), "..oooooooooooo..",
];
const LOOKS = { 0: TURNED, 2: BEHIND, logo: LOGO_LOOK };
export const TAIL = [[14, 17], [15, 17], [15, 16], [15, 15], [15, 14], [14, 14]]; // up behind the body on the right, inside the cat's 16 x 18 (x counted from CX)
export const DIRS = 4;

// Every role is its own cat: a coat, a collar, eye colour, and sometimes patches. Coordinates are inside the 16 x 18 cat.
// f fur, d stripes, l belly and muzzle, ear = the inside of the ears, paint = [x0, y0, x1, y1, from, to] swaps a colour inside a box
export const SKINS = {
  product: { name: "orange tabby", f: "#e8b25a", d: "#b87f35", l: "#f7e1b0", collar: "#74cbb9", eye: "#1f1712" },
  design: { name: "calico", f: "#e8a24a", d: "#b87f35", l: "#fbf3e4", collar: "#e8827e", eye: "#1f1712",
    paint: [[2, 3, 6, 8, "f", "#fbf3e4"], [9, 2, 13, 5, "f", "#4a3a30"], [7, 11, 12, 16, "f", "#fbf3e4"], [3, 12, 5, 14, "f", "#4a3a30"]] },
  frontend: { name: "blue-grey tabby", f: "#9aa9b8", d: "#6f7e8e", l: "#dbe3ea", collar: "#5aa7e0", eye: "#1f1712" },
  backend: { name: "black cat", f: "#4a5060", d: "#363b48", l: "#6b7384", collar: "#e8b25a", eye: "#f2c94c", ear: "#8a5a6a" },
  qa: { name: "siamese", f: "#f0dcc0", d: "#7a5a45", l: "#fff3de", collar: "#a77bc9", eye: "#5aa7e0", ear: "#a47d66",
    paint: [[0, 0, 15, 2, "f", "#7a5a45"], [5, 7, 10, 8, "f", "#7a5a45"], [5, 7, 10, 8, "l", "#c9a98a"]] },
  security: { name: "tuxedo", f: "#4a5060", d: "#363b48", l: "#f4efe5", collar: "#d9604f", eye: "#f2c94c", ear: "#8a5a6a",
    paint: [[6, 3, 9, 8, "f", "#4a5060"]] },
  devops: { name: "teal cat", f: "#74cbb9", d: "#4aa08f", l: "#cdeee6", collar: "#e8b25a", eye: "#1f1712" },
  marketing: { name: "ginger", f: "#d9786a", d: "#a9503f", l: "#f6d4c8", collar: "#f2c94c", eye: "#1f1712" },
  content: { name: "chocolate", f: "#9a6a47", d: "#6f4a30", l: "#e4c9a8", collar: "#8ed8c9", eye: "#f2c94c" },
  support: { name: "lilac cat", f: "#b9a9d0", d: "#8e7fb0", l: "#ece6f5", collar: "#f2c94c", eye: "#1f1712" },
  secretary: { name: "white cat", f: "#f4efe5", d: "#cfc6b4", l: "#ffffff", collar: "#d9604f", eye: "#5aa7e0", ear: "#f0a8a0" },
};
const baseCache = {};
function baseCat(role, dir = 0) { // dir is 0, 2 or "logo"
  const key = role + dir;
  if (baseCache[key]) return baseCache[key];
  const s = SKINS[role];
  const img = fromRows(LOOKS[dir], { ...PAL, f: s.f, d: s.d, l: s.l, t: s.collar, e: s.eye, p: s.ear ?? PAL.p });
  (s.paint ?? []).forEach(([x0, y0, x1, y1, from, to]) => {
    const fromC = from === "f" ? s.f : from === "l" ? s.l : from === "d" ? s.d : from;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = img.get(x, y);
      const want = rgbaOf(fromC);
      if (px[3] && px[0] === want[0] && px[1] === want[1] && px[2] === want[2]) img.set(x, y, to);
    }
  });
  return (baseCache[key] = img);
}
const rgbaOf = (c) => { const h = c.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };

// the icons, 5 wide and 6 tall
const ICONS = {
  product: [".yyy.", "owwwo", "ogggo", "owwwo", "ogggo", "ooooo"], // clipboard
  design: ["...or", "..oyo", ".oyo.", "oyo..", "ono..", "oo..."], // pencil
  frontend: ["ooooo", "obbbo", "obwbo", "ooooo", ".ooo.", "..o.."], // screen
  backend: ["ooooo", "oggGo", "ooooo", "oggGo", "ooooo", "ooooo"], // server
  qa: [".sss.", "s...s", "s...s", ".sss.", "...yy", "....y"], // magnifier
  security: ["ooooo", "obbbo", "obwbo", "obbbo", ".obo.", "..o.."], // shield
  devops: ["ss.ss", "sssss", ".sss.", "..s..", "..s..", "..s.."], // wrench
  marketing: ["....r", "..rrr", "orrrr", "orrrr", "..rrr", "....r"], // megaphone
  content: [".sss.", "s...s", "sssss", "s...s", "s...s", "....."], // the letter A
  support: [".sss.", "s...s", "s...s", "gg.gg", "gg.gg", "..m.."], // headset
  secretary: ["..y..", ".yyy.", ".yyy.", "yyyyy", "ooooo", "..o.."], // desk bell
};
const iconCache = {};
const icon = (role) => (iconCache[role] ??= fromRows(ICONS[role], PAL));

export const ROLES = [
  { id: "product", name: "Product", group: "Plan" }, { id: "design", name: "Design", group: "Plan" },
  { id: "frontend", name: "Frontend", group: "Build" }, { id: "backend", name: "Backend", group: "Build" },
  { id: "qa", name: "QA", group: "Build" }, { id: "security", name: "Security", group: "Build" },
  { id: "devops", name: "DevOps", group: "Ship" },
  { id: "marketing", name: "Marketing", group: "Grow" }, { id: "content", name: "Content and SEO", group: "Grow" }, { id: "support", name: "Support", group: "Grow" },
  { id: "secretary", name: "Secretary", group: "Office" },
];

export const FRAMES = ["idle", "blink", "typeA", "typeB", "waitA", "waitB", "happy"];
export const FRAME_W = 28, FRAME_H = 20;
export const CX = 6, CY = 2;

export function layer(fur, c = PAL.f) {
  const l = new Img(FRAME_W, FRAME_H);
  fur.forEach(([x, y]) => l.set(x, y, c));
  l.outline(PAL.o);
  return l;
}
// a small card the cat holds, with the role icon on it (7 x 8)
const cardCache = {};
function card(role) {
  if (cardCache[role]) return cardCache[role];
  const c = new Img(7, 8);
  c.rect(0, 0, 7, 8, PAL.o);
  c.rect(1, 1, 5, 6, PAL.w);
  [[0, 0], [6, 0], [0, 7], [6, 7]].forEach(([x, y]) => c.set(x, y, [0, 0, 0, 0]));
  c.blit(icon(role), 1, 1);
  return (cardCache[role] = c);
}
export const hand = (x, y, c) => { const l = new Img(FRAME_W, FRAME_H); l.rect(x, y, 2, 1, c); l.rect(x, y + 1, 2, 1, PAL.o); return l; };

export function cat(role, frame, dir = 0) {
  if (dir % 2 === 1) return cat(role, frame, dir - 1).flipX();
  const img = new Img(FRAME_W, FRAME_H);
  const fur = SKINS[role].f, back = dir === 2;
  img.blit(baseCat(role, dir), CX, CY);
  const eyes = [3, 8]; // the columns of the two eyes (rows 5 and 6), the near one first
  const eye = (x, y, c) => img.set(CX + x, CY + y, c);
  const skin = (x, y) => img.get(CX + x + (x === eyes[0] ? 1 : -1), CY + y); // the fur beside an eye, on the side of the face
  if (!back && frame === "blink") eyes.forEach((x) => eye(x, 5, skin(x, 5)));
  if (!back && frame === "happy") { eyes.forEach((x) => eye(x, 6, skin(x, 6))); eyes.forEach((x) => { eye(x, 5, PAL.o); eye(x - 1, 6, PAL.o); eye(x + 1, 6, PAL.o); }); }
  if (!back && frame === "typeA") { img.blit(hand(CX + 5, CY + 12, fur), 0, 0); img.blit(hand(CX + 9, CY + 13, fur), 0, 0); }
  if (!back && frame === "typeB") { img.blit(hand(CX + 5, CY + 13, fur), 0, 0); img.blit(hand(CX + 9, CY + 12, fur), 0, 0); }
  if (frame === "waitA") img.blit(layer([[CX + 14, 9], [CX + 15, 9], [CX + 14, 10], [CX + 15, 10], [CX + 14, 11], [CX + 15, 11], [CX + 14, 12], [CX + 14, 13]], fur), 0, 0);
  if (frame === "waitB") img.blit(layer([[CX + 15, 8], [CX + 16, 8], [CX + 15, 9], [CX + 16, 9], [CX + 15, 10], [CX + 16, 10], [CX + 15, 11], [CX + 14, 12], [CX + 14, 13]], fur), 0, 0);
  img.blit(layer(TAIL.map(([x, y]) => [CX + x, CY + y]), fur), 0, 0);
  if (back) return img; // from behind: no card
  img.blit(card(role), 0, 9);
  img.blit(layer([[7, 13], [7, 14]], fur), 0, 0);
  return img;
}

// all roles, frames and sides in one sheet: a row per role and side (the four sides one after the other), a column per frame
export function sheet() {
  const s = new Img(FRAME_W * FRAMES.length, FRAME_H * ROLES.length * DIRS);
  for (let dir = 0; dir < DIRS; dir++) ROLES.forEach((r, row) => FRAMES.forEach((f, col) => s.blit(cat(r.id, f, dir), col * FRAME_W, (dir * ROLES.length + row) * FRAME_H)));
  return s;
}

// the cat alone, 16 x 18, without the card or the paw: for the logo and the small faces
export const catBody = (role) => baseCat(role, "logo");
