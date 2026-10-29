import { sheet, ROLES, FRAMES, FRAME_W, FRAME_H } from "./cat.mjs";
import { Img } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const s = sheet();
s.save("out/cats.png");
// a preview on the dark Kona background at 5x
const bg = new Img(s.w, s.h, "#1d2430"); bg.blit(s, 0, 0);
bg.scale(5).save("out/cats-preview.png");
writeFileSync("out/cats.json", JSON.stringify({ frameWidth: FRAME_W, frameHeight: FRAME_H, frames: FRAMES, rows: ROLES }, null, 2));
console.log("cats ok", s.w, "x", s.h);
