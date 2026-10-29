// The Kona mark: the face of the orange cat (the Product cat) with its teal collar, 16 x 16 pixels. Also the app icon and the favicon.
import { Img } from "./lib.mjs";
import { catBody } from "./cat.mjs";

const body = catBody("product");
const logo = new Img(16, 16);
for (let y = 0; y < 11; y++) for (let x = 0; x < 16; x++) { const p = body.get(x, y); if (p[3]) logo.set(x, y + 3, p); }
logo.save("out/logo.png");
logo.scale(2).save("out/favicon.png");

// the app icon: the cat on a cream rounded square, 1024 x 1024 (Tauri makes every size from it)
const N = 1024, big = logo.scale(40), icon = new Img(N, N), R = 200, m = 24;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const cx = Math.min(Math.max(x, m + R), N - m - R), cy = Math.min(Math.max(y, m + R), N - m - R);
  const inside = x >= m && x < N - m && y >= m && y < N - m && (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
  if (inside) icon.set(x, y, "#f2e9d4");
}
icon.blit(big, (N - big.w) / 2, (N - big.h) / 2);
icon.save("out/app-icon-1024.png");
console.log("logo ok");
