# Kona art kit

Pixel art for Kona (ticket T-0001, decisions 44, 45 and 57 in `kona-space-app.md`). Drawn by script, to be refined by the owner in LibreSprite.

## What is here

- `node build-cats.mjs` writes `out/cats.png` (a sprite sheet: a row per role and look, a column per frame; the cat has four looks, one block of rows each), `out/cats.json` (the frame size, order, roles and number of looks), Kibby's sheet `out/kibby.png` with `out/kibby.json`, and a 5x preview. `node to-app.mjs` copies them into `app/src/office`.
- `cat.mjs` is the cat and the role icons, `kibby.mjs` is Kibby, `lib.mjs` is a small pixel canvas for these scripts (no packages).
- `node build-frames.mjs` writes the tiled frames (paper, teal and red, large 18 x 18 and small 12 x 12, each in normal, hover and pressed looks) and a 4x preview of each. They are for buttons, cards and dialogs: the corners stay, the edges repeat, the middle is empty. In CSS: `border: 12px solid transparent; background-clip: padding-box; border-image: url(frame-paper-normal.png) 6 / 12px repeat; image-rendering: pixelated;`.
- `node build-logo.mjs` writes the logo and the app icon.
- `node render-map.mjs [map.json] [side 0 to 3] [out.png] [scale]` draws a map of the office to a picture with the same engine the app uses (the standard office by default), to look at a change without opening Kona.

## The office is not drawn here any more

Since 0.26.0 the office is a **map** (a grid of tiles, decision 57): `app/src/office/standard.json` is the standard office built into Kona, and a project may have its own map in `.kona/office-map.json`. The app draws it with the engine in `app/src/office/engine/` (floor, walls, furniture, wall decorations, the order of drawing) and the map maker `app/src/components/OfficeEditor.tsx` edits it. Read `docs/EDITOR.md` first. The rules that still hold for any piece of furniture (written in `engine/furniture.ts`): the tile is 32 x 16 px; heights are whole steps of 4 px; positions snap to 1/8 of a tile; a piece is drawn in its own frame and turned with the plan; details smaller than a step are painted on a face.

The first pipeline (a script that drew the office with thin walls, `office.mjs`, `walls.mjs`, `layout.mjs`, `tiles.mjs`, `build-office.mjs`) was removed in 0.26.0; it is in git history (commit `4d72069` and before). `art/find-joints.mjs` lists where tall walls meet low ones, and `art/joint-sheet.mjs` draws a made-up map with every kind of wall joint from all four sides: use them after a change to the walls.

## Rules that still hold

- Everything is placed on a grid of 1/8 tile, so slanted edges have clean, even steps. Do not use other fractions for a piece or a detail.
- The cats have four looks; only two are drawn (`TURNED`, `BEHIND` in `cat.mjs`), the other two are their mirror images. Draw a change once, in one of the two.
