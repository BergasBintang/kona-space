import { sheet, ROLES, FRAMES, FRAME_W, FRAME_H, DIRS } from "./cat.mjs";
import { Img } from "./lib.mjs";
import { kibbySheet, FRAMES as KFRAMES, LOOKS as KLOOKS } from "./kibby.mjs";
import { writeFileSync } from "node:fs";
const s = sheet();
s.save("out/cats.png");
// a preview on the dark Kona background at 5x
const bg = new Img(s.w, s.h, "#1d2430"); bg.blit(s, 0, 0);
bg.scale(5).save("out/cats-preview.png");
writeFileSync("out/cats.json", JSON.stringify({ frameWidth: FRAME_W, frameHeight: FRAME_H, frames: FRAMES, rows: ROLES, dirs: DIRS }, null, 2));
// Kibby, the office boy, has a sheet of his own: a row per look, a column per frame
const k = kibbySheet();
k.save("out/kibby.png");
writeFileSync("out/kibby.json", JSON.stringify({ frameWidth: FRAME_W, frameHeight: FRAME_H, frames: KFRAMES, looks: KLOOKS }, null, 2));
console.log("cats ok", s.w, "x", s.h);
