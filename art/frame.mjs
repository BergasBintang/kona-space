// A tiled frame: 3 x 3 tiles. Large frames use tiles of 6 x 6 pixels (18 x 18), small frames 4 x 4 (12 x 12).
// The four corners stay as drawn, the four edges repeat, the middle is left empty (the element's own background shows through).
// In CSS: border-image: url(frame.png) 6 / 12px repeat; image-rendering: pixelated  (small: 4 / 8px).
// The edges are drawn to join seamlessly, so any width and height works. Three looks: normal, hover, pressed (the bevel flips).
import { Img } from "./lib.mjs";
import { writeFileSync } from "node:fs";

// palettes: O outline, H highlight, W body, S shade, D dark side, I inner line
const SETS = {
  // paper: cards, dialogs, inputs and quiet buttons on the cream ground. Hover turns the outline gold.
  paper: {
    normal: { O: "#6b5638", H: "#fffaf0", W: "#f6edd8", S: "#e2d3b0", D: "#cdbb92", I: "#c7b58b" },
    hover: { O: "#b57a14", H: "#fffaf0", W: "#faf3e1", S: "#e8dbba", D: "#d3c198", I: "#cdbb92" },
    pressed: { O: "#6b5638", H: "#fffaf0", W: "#ebdfc2", S: "#d8c8a2", D: "#c4b087", I: "#bfae88" },
  },
  // teal: the one main button of a screen. Light text sits on the inside.
  teal: {
    normal: { O: "#0d3a33", H: "#59ad9b", W: "#1a6558", S: "#145045", D: "#0f4037", I: "#0d3a33" },
    hover: { O: "#0d3a33", H: "#72c3b1", W: "#145045", S: "#0f4037", D: "#0d3a33", I: "#0d3a33" },
    pressed: { O: "#0d3a33", H: "#59ad9b", W: "#0f4037", S: "#0d3a33", D: "#0d3a33", I: "#0d3a33" },
  },
  // red: a button that cannot be undone (stop, remove). Light text sits on the inside.
  red: {
    normal: { O: "#4a1810", H: "#d98070", W: "#a33727", S: "#8a2d20", D: "#6f2519", I: "#4a1810" },
    hover: { O: "#4a1810", H: "#e59a8a", W: "#8a2d20", S: "#6f2519", D: "#4a1810", I: "#4a1810" },
    pressed: { O: "#4a1810", H: "#d98070", W: "#6f2519", S: "#4a1810", D: "#4a1810", I: "#4a1810" },
  },
};
// from the outside of the frame inwards: the side the light falls on (top and left), and the far side (bottom and right)
const lit = (k, T) => (T === 6 ? [k.O, k.H, k.W, k.W, k.S, k.I] : [k.O, k.H, k.W, k.I]);
const shade = (k, T) => (T === 6 ? [k.O, k.D, k.S, k.W, k.W, k.I] : [k.O, k.D, k.W, k.I]);

function build(set, look, pressed, T) {
  const k = SETS[set][look];
  const top = pressed ? shade(k, T) : lit(k, T), left = top, bottom = pressed ? lit(k, T) : shade(k, T), right = bottom;
  const img = new Img(T * 3, T * 3);
  // one darker fleck per edge tile so a large surface is not flat
  const grain = (x, y, c, edge) => (T === 6 && edge && ((x === 2 && y === 2) || (x === 3 && y === 3)) && c === k.W ? k.S : c);
  for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
    if (tx === 1 && ty === 1) continue; // the middle stays empty
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c;
      if (ty === 0 && tx === 1) c = top[y];
      else if (ty === 2 && tx === 1) c = bottom[T - 1 - y];
      else if (tx === 0 && ty === 1) c = left[x];
      else if (tx === 2 && ty === 1) c = right[T - 1 - x];
      else {
        // a corner: a = distance from its outer vertical edge, b = from its outer horizontal edge
        const a = tx === 0 ? x : T - 1 - x, b = ty === 0 ? y : T - 1 - y;
        if (a + b <= 1) continue; // the cut-off corner
        const l = a + b === 2 ? 0 : Math.min(a, b);
        const fromTopOrBottom = b <= a;
        const pal = fromTopOrBottom ? (ty === 0 ? top : bottom) : (tx === 0 ? left : right);
        c = pal[l];
      }
      img.set(tx * T + x, ty * T + y, grain(x, y, c, (tx === 1) !== (ty === 1)));
    }
  }
  return img;
}

// draw a box of w x h pixels from the frame, the way CSS does (repeat), to check the join before it goes into the app
export function box(frame, w, h, T = 6) {
  const out = new Img(w, h);
  const tile = (sx, sy, dx, dy) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const o = ((sy + y) * frame.w + sx + x) * 4; if (frame.d[o + 3] && dx + x < w && dy + y < h) out.set(dx + x, dy + y, [frame.d[o], frame.d[o + 1], frame.d[o + 2], 255]); } };
  tile(0, 0, 0, 0); tile(2 * T, 0, w - T, 0); tile(0, 2 * T, 0, h - T); tile(2 * T, 2 * T, w - T, h - T);
  for (let x = T; x < w - T; x += T) { tile(T, 0, x, 0); tile(T, 2 * T, x, h - T); }
  for (let y = T; y < h - T; y += T) { tile(0, T, 0, y); tile(2 * T, T, w - T, y); }
  return out;
}

// size "lg" (6 px tiles) or "sm" (4 px tiles); files: frame-<set>[-sm]-<look>.png
export function buildFrames(dir, set, ground, size = "lg") {
  const T = size === "sm" ? 4 : 6, tag = size === "sm" ? "-sm" : "";
  const files = {};
  for (const [name, pressed] of [["normal", false], ["hover", false], ["pressed", true]]) {
    const img = build(set, name, pressed, T);
    img.save(`${dir}/frame-${set}${tag}-${name}.png`);
    files[name] = img;
  }
  // a preview on the ground colour: three looks at a few sizes, 4x
  const sizes = [[54, 24], [90, 24], [130, 48]];
  const W = 8 + sizes.reduce((a, [w]) => a + w + 8, 0), H = 8 + 3 * (60 + 8);
  const sheet = new Img(W, H, ground);
  ["normal", "hover", "pressed"].forEach((name, row) => {
    let x = 8;
    sizes.forEach(([w, h]) => { sheet.blit(box(files[name], w, h, T), x, 8 + row * 68 + 6); x += w + 8; });
  });
  sheet.scale(4).save(`${dir}/frame-${set}${tag}-preview.png`);
  writeFileSync(`${dir}/frame-${set}${tag}.json`, JSON.stringify({ tile: T, size: T * 3, css: `border-image: url(frame-${set}${tag}-normal.png) ${T} / ${T * 2}px repeat; image-rendering: pixelated;`, looks: ["normal", "hover", "pressed"] }, null, 2));
}
