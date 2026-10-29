# Kona art kit

Pixel art for the office (ticket T-0001, decisions 44 and 45 in `kona-space-app.md`). A first pass drawn by script, to be refined by the owner in LibreSprite.

- `node build-cats.mjs` writes `out/cats.png` (a sprite sheet: a row per role, a column per frame), `out/cats.json` (the frame size, order and roles) and a 5x preview.
- `node build-office.mjs` writes `out/office.png` (the building at 1x, 544 x 316), `out/office-x3.png` (a 3x preview) and `out/rooms.json` (the 15 rooms with their outlines).
- `lib.mjs` is a small pixel canvas (no packages). `cat.mjs` is the cat and the role icons. `office.mjs` is the building.
- The building is one flat picture for now. The app will need it split into layers (floor, walls, each piece of furniture) so cats can move and rooms can light up.
- `node build-frames.mjs` writes `out/frame-wood-normal.png`, `-hover.png` and `-pressed.png` (18 x 18, 3 x 3 tiles of 6 x 6) and a 4x preview. It is a tiled frame for buttons, cards and dialogs: the corners stay, the edges repeat, the middle is empty. In CSS: `border: 12px solid transparent; background-clip: padding-box; border-image: url(frame-wood-normal.png) 6 / 12px repeat; image-rendering: pixelated;`. Tested in Edge at several sizes; not yet used in the app.
