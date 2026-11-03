// The device frames of the mockup previewer (ticket T-0014, decisions 75 and 76 in kona-space-app.md).
// A mockup page runs at the true size of a device (its width and height in CSS pixels) and the whole device is scaled to fit the sheet.
// The frame around the screen is pixel art and must never be stretched, so it is drawn at one fixed size and shown at a whole-number zoom `k`
// (every art pixel is `k` x `k` CSS pixels). Only the screen scales. The frame is a 9-slice for CSS `border-image` (like the buttons' frames):
// the four corners stay as drawn, the four edges repeat, the middle is the screen.
//
//   node build-devices.mjs     writes out/devices/*.png, out/devices/devices.json and out/devices/devices-preview.png
//
// Five devices: small phone (320 wide), phone (390), tablet (768), laptop (1024), desktop monitor (1440). The two phones and the tablet also exist turned
// on their side. The laptop has a base under the lid and the monitor a stand; small details (a speaker slot, a camera dot) are separate pictures that
// the sheet places in the middle of one side of the bezel, so they do not repeat along the edge.
import { Img } from "./lib.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = "out/devices";
const K = 2; // CSS pixels per art pixel

// O outline, H highlight (the sides the light falls on), W body, S shade next to the screen, D dark side, I the line that frames the screen, backdrop: behind a rounded screen corner
const MATERIAL = {
  dark: { O: "#1f1912", H: "#6a5d4a", W: "#3d352a", S: "#2e281f", D: "#241f18", I: "#0f0c08", backdrop: "#14100b", detail: "#5a4d3a", lens: "#0f0c08" },
  light: { O: "#6b5638", H: "#fffaf0", W: "#e9e0cb", S: "#d8ccb0", D: "#cdbb92", I: "#4a3d2a", backdrop: "#1b1712", detail: "#b9a67c", lens: "#4a3d2a" },
};

// thickness of the bezel per side in art pixels: [top, right, bottom, left]. A corner must be at least as big as its radius, because the corner tile is the bezel's own thickness.
const DEVICES = [
  { id: "phone-s", label: "Small phone", screen: [320, 568], mat: "dark", bezel: [10, 7, 10, 7], radius: 7, screenRadius: 4, turns: true, detail: { kind: "speaker", side: "top" } },
  { id: "phone", label: "Phone", screen: [390, 844], mat: "dark", bezel: [10, 7, 10, 7], radius: 7, screenRadius: 5, turns: true, detail: { kind: "speaker", side: "top" } },
  { id: "tablet", label: "Tablet", screen: [768, 1024], mat: "dark", bezel: [11, 11, 11, 11], radius: 8, screenRadius: 3, turns: true, detail: { kind: "camera", side: "top" } },
  { id: "laptop", label: "Laptop", screen: [1024, 640], mat: "light", bezel: [7, 7, 9, 7], radius: 5, screenRadius: 1, turns: false, detail: { kind: "camera", side: "top" }, base: true },
  { id: "monitor", label: "Desktop", screen: [1440, 900], mat: "light", bezel: [8, 8, 14, 8], radius: 4, screenRadius: 1, turns: false, detail: null, stand: true },
];

// distance from the outside of a rounded rectangle, negative inside (pixel centres)
function sd(x, y, W, H, R) {
  const px = x + 0.5, py = y + 0.5;
  const qx = Math.abs(px - W / 2) - (W / 2 - R), qy = Math.abs(py - H / 2) - (H / 2 - R);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R;
}

// the 9-slice of a bezel: the middle tile (1 x 1) is the screen and stays empty
function bezel(mat, [t, r, b, l], R) {
  const c = MATERIAL[mat], M = 1, W = l + M + r, H = t + M + b;
  const img = new Img(W, H);
  const inOpening = (x, y) => x >= l && x < l + M && y >= t && y < t + M;
  const nearOpening = (x, y, d) => x >= l - d && x < l + M + d && y >= t - d && y < t + M + d;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inOpening(x, y)) continue;
    const s = sd(x, y, W, H, R);
    if (s >= 0) continue; // outside the rounded outline
    const layer = Math.floor(-s);
    const dTop = y + 0.5, dLeft = x + 0.5, dBottom = H - y - 0.5, dRight = W - x - 0.5, near = Math.min(dTop, dLeft, dBottom, dRight);
    const lit = near === dTop || near === dLeft;
    let col;
    if (nearOpening(x, y, 1)) col = c.I;
    else if (nearOpening(x, y, 2)) col = c.S;
    else if (layer === 0) col = c.O;
    else if (layer === 1) col = lit ? c.H : c.D;
    else col = c.W;
    img.set(x, y, col);
  }
  return img;
}

// the same frame at a real size: sw x sh screen pixels (art pixels), the edges repeated, with a sample page on the screen. Only for the preview and for checking the join.
function stitch(frame, [t, r, b, l], sw, sh, mat, screenRadius, sample = true) {
  const c = MATERIAL[mat], W = l + sw + r, H = t + sh + b, out = new Img(W, H);
  const px = (sx, sy, dx, dy) => { const o = (sy * frame.w + sx) * 4; if (frame.d[o + 3]) out.set(dx, dy, [frame.d[o], frame.d[o + 1], frame.d[o + 2], 255]); };
  for (let y = 0; y < t; y++) { for (let x = 0; x < l; x++) px(x, y, x, y); for (let x = 0; x < r; x++) px(l + 1 + x, y, W - r + x, y); for (let x = 0; x < sw; x++) px(l, y, l + x, y); }
  for (let y = 0; y < b; y++) { for (let x = 0; x < l; x++) px(x, t + 1 + y, x, H - b + y); for (let x = 0; x < r; x++) px(l + 1 + x, t + 1 + y, W - r + x, H - b + y); for (let x = 0; x < sw; x++) px(l, t + 1 + y, l + x, H - b + y); }
  for (let y = 0; y < sh; y++) { for (let x = 0; x < l; x++) px(x, t, x, t + y); for (let x = 0; x < r; x++) px(l + 1 + x, t, W - r + x, t + y); }
  // the screen: a rounded corner shows the backdrop, the page sits inside
  const sc = screenRadius;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const cx = x < sc ? sc - x - 0.5 : x >= sw - sc ? x - (sw - sc) + 0.5 : 0, cy = y < sc ? sc - y - 0.5 : y >= sh - sc ? y - (sh - sc) + 0.5 : 0;
    const outside = (cx > 0 || cy > 0) && Math.hypot(cx, cy) > sc;
    out.set(l + x, t + y, outside || !sample ? c.backdrop : "#fbf6ea");
  }
  if (sample) {
    out.rect(l + 2, t + 2, sw - 4, Math.max(2, Math.round(sh * 0.06)), "#1a6558");
    for (let i = 0; i < 4; i++) out.rect(l + 3, t + 2 + Math.round(sh * 0.12) + i * Math.max(4, Math.round(sh * 0.07)), Math.round(sw * (i % 2 ? 0.5 : 0.7)), 2, "#c9bc9a");
  }
  return out;
}

// small details placed in the middle of one side of the bezel
function speaker(mat, vertical) {
  const c = MATERIAL[mat], img = new Img(vertical ? 2 : 12, vertical ? 12 : 2);
  img.rect(0, 0, img.w, img.h, c.detail);
  return img;
}
function camera(mat) {
  const c = MATERIAL[mat], img = new Img(4, 4);
  img.rect(0, 0, 4, 4, c.detail); img.rect(1, 1, 2, 2, c.lens);
  for (const [x, y] of [[0, 0], [3, 0], [0, 3], [3, 3]]) img.d.fill(0, (y * 4 + x) * 4, (y * 4 + x) * 4 + 4); // round the four corners
  return img;
}

// the laptop's base: a 9-slice in one direction (a left cap, a repeating middle 1 px wide, a right cap); the ends slope in
function laptopBase() {
  const c = MATERIAL.light, cap = 10, H = 9, W = cap * 2 + 1, slope = 3, img = new Img(W, H);
  const inset = (y) => Math.floor((y * slope) / (H - 1)); // how far in from the end this row starts
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, W - 1 - x); // distance from the nearer end
    const i = inset(y);
    if (d < i) continue;
    let col = c.W;
    if (y === 0) col = c.D; // the shadow under the lid
    else if (y === 1) col = c.H;
    else if (y >= H - 3 && y < H - 1) col = c.S;
    if (y === H - 1 || d === i) col = c.O; // the outline: the bottom and the sloping ends
    img.set(x, y, col);
  }
  return { img, cap, H, W };
}
function notch(mat) {
  const c = MATERIAL[mat], img = new Img(16, 3);
  img.rect(0, 0, 16, 2, c.S); img.rect(1, 2, 14, 1, c.D);
  for (const [x, y] of [[0, 0], [15, 0]]) img.d.fill(0, (y * 16 + x) * 4, (y * 16 + x) * 4 + 4);
  return img;
}
// the monitor's stand: a neck and a foot, one fixed picture centred under the screen
function monitorStand() {
  const c = MATERIAL.light, W = 36, H = 18, img = new Img(W, H);
  for (let y = 0; y < 13; y++) for (let x = 13; x < 23; x++) img.set(x, y, x === 13 || x === 22 ? c.O : x === 14 ? c.H : x >= 20 ? c.D : c.W);
  for (let y = 13; y < H; y++) for (let x = 0; x < W; x++) {
    const inset = y === 13 ? 8 : y === 14 ? 3 : y === 15 ? 1 : 0, d = Math.min(x, W - 1 - x);
    if (d < inset) continue;
    img.set(x, y, y === H - 1 || d === inset ? c.O : y === 14 ? c.H : y === 16 ? c.D : c.W);
  }
  return img;
}

const turned = ([t, r, b, l]) => [l, t, r, b]; // turn clockwise: the top becomes the right side

mkdirSync(OUT, { recursive: true });

const info = [];
const previewParts = [];
const preview = (frame, bz, screen, d) => {
  const f = 0.4; // how the sheet usually fits a device, only for this picture
  const sw = Math.max(16, Math.round((screen[0] * f) / K)), sh = Math.max(16, Math.round((screen[1] * f) / K));
  return stitch(frame, bz, sw, sh, d.mat, d.screenRadius);
};

for (const d of DEVICES) {
  const entry = { id: d.id, label: d.label, screen: { w: d.screen[0], h: d.screen[1] }, turns: d.turns, k: K, material: d.mat, backdrop: MATERIAL[d.mat].backdrop, screenRadius: d.screenRadius, frames: {} };
  const variants = d.turns ? [["upright", d.bezel, d.screen, false], ["turned", turned(d.bezel), [d.screen[1], d.screen[0]], true]] : [["upright", d.bezel, d.screen, false]];
  for (const [name, bz, screen, isTurned] of variants) {
    const frame = bezel(d.mat, bz, d.radius);
    const file = `${d.id}-${name}.png`;
    frame.save(`${OUT}/${file}`);
    const f = { image: file, size: [frame.w, frame.h], slice: bz.map((v) => v), widthCss: bz.map((v) => v * K), screen: { w: screen[0], h: screen[1] }, details: [] };
    // the detail moves with the turn: a detail on the top goes to the left side when the device lies on its side
    if (d.detail) {
      const side = isTurned ? "left" : d.detail.side, vertical = side === "left" || side === "right";
      const img = d.detail.kind === "speaker" ? speaker(d.mat, vertical) : camera(d.mat);
      const dfile = `${d.id}-${d.detail.kind}-${side}.png`;
      img.save(`${OUT}/${dfile}`);
      f.details.push({ image: dfile, side, size: [img.w, img.h] });
    }
    entry.frames[name] = f;
    const shot = preview(frame, bz, screen, d);
    // the details on the preview: centred on their side of the bezel
    for (const det of f.details) {
      const img = Img.fromPng(`${OUT}/${det.image}`);
      const [t, r, b, l] = bz;
      const x = det.side === "left" ? Math.floor((l - img.w) / 2) : Math.floor((shot.w - img.w) / 2);
      const y = det.side === "top" ? Math.floor((t - img.h) / 2) : Math.floor((shot.h - img.h) / 2);
      shot.blit(img, x, y);
    }
    previewParts.push({ img: shot, label: `${d.id} ${name}`, base: d.base, stand: d.stand });
  }
  if (d.base) {
    const { img, cap, H, W } = laptopBase();
    img.save(`${OUT}/laptop-base.png`);
    const nt = notch(d.mat);
    nt.save(`${OUT}/laptop-notch.png`);
    entry.base = { image: "laptop-base.png", size: [W, H], capLeft: cap, capRight: cap, overhangArt: 8, notch: { image: "laptop-notch.png", size: [nt.w, nt.h] } };
  }
  if (d.stand) {
    const st = monitorStand();
    st.save(`${OUT}/monitor-stand.png`);
    entry.stand = { image: "monitor-stand.png", size: [st.w, st.h] };
  }
  const up = entry.frames.upright;
  const wpx = up.widthCss.map((v) => v + "px").join(" ");
  entry.css = `border-style: solid; border-color: transparent; border-width: ${wpx}; border-image: url(${up.image}) ${up.slice.join(" ")} / ${wpx} repeat; image-rendering: pixelated;`;
  info.push(entry);
}

writeFileSync(`${OUT}/devices.json`, JSON.stringify({
  note: "Art pixels are shown at k x k CSS pixels (k = 2) so they stay square. slice is in art pixels [top, right, bottom, left]; widthCss is the same in CSS pixels. The page runs at screen.w x screen.h CSS pixels, then the whole device is scaled; the bezel keeps its size. screenRadius is in art pixels: clip the screen to it and put `backdrop` behind. details are placed in the middle of one side of the bezel. A base (laptop) is a left cap, a repeating middle and a right cap; a stand (monitor) is one fixed picture centred under the frame.",
  devices: info,
}, null, 2));

// the preview: every frame with a sample page on a screen, plus the laptop base and the monitor stand, 3x
const GROUND = "#f2e9d4", PAD = 10, ROWW = 760;
const placed = [];
let x = PAD, y = PAD, rowH = 0;
for (const p of previewParts) {
  let w = p.img.w, h = p.img.h + (p.base ? 9 : 0) + (p.stand ? 18 : 0);
  if (x + w + PAD > ROWW) { x = PAD; y += rowH + PAD; rowH = 0; }
  placed.push({ ...p, x, y, w, h });
  x += w + PAD; rowH = Math.max(rowH, h);
}
const sheet = new Img(ROWW, y + rowH + PAD, GROUND);
for (const p of placed) {
  sheet.blit(p.img, p.x, p.y);
  if (p.base) {
    const { img, cap } = laptopBase();
    const over = 8, baseW = p.img.w + over * 2, mid = baseW - cap * 2;
    const bx = p.x - over, by = p.y + p.img.h;
    for (let yy = 0; yy < img.h; yy++) {
      for (let xx = 0; xx < cap; xx++) { const o = (yy * img.w + xx) * 4; if (img.d[o + 3]) sheet.set(bx + xx, by + yy, [img.d[o], img.d[o + 1], img.d[o + 2], 255]); }
      for (let xx = 0; xx < mid; xx++) { const o = (yy * img.w + cap) * 4; if (img.d[o + 3]) sheet.set(bx + cap + xx, by + yy, [img.d[o], img.d[o + 1], img.d[o + 2], 255]); }
      for (let xx = 0; xx < cap; xx++) { const o = (yy * img.w + cap + 1 + xx) * 4; if (img.d[o + 3]) sheet.set(bx + cap + mid + xx, by + yy, [img.d[o], img.d[o + 1], img.d[o + 2], 255]); }
    }
    const nt = notch("light");
    sheet.blit(nt, bx + Math.floor((baseW - nt.w) / 2), by + 1);
  }
  if (p.stand) { const st = monitorStand(); sheet.blit(st, p.x + Math.floor((p.img.w - st.w) / 2), p.y + p.img.h); }
}
sheet.scale(3).save(`${OUT}/devices-preview.png`);
console.log(`devices ok: ${info.map((d) => d.id).join(", ")} (out/devices)`);
