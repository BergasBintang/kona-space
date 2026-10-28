# Kona's logo

A cat head with pointed ears, a sunflower in its face, and two eyes in the middle of the flower. The cat is the name's owner; the sunflower is for the owner's girlfriend. Gold (`--color-brand`, #e8b25a) on Kona's dark surface.

| File | What |
|---|---|
| `kona-mark.svg` | The mark, gold, with the flower cut out (a mask, so it sits on any background) |
| `kona-icon.svg` | The app icon: dark cat on a gold rounded square. Also the favicon (`app/public/favicon.svg`) |
| `../kona-logo.figcraft`, `../previews/logo.png` | The board: mark, icon and small sizes |

Everything is made by `docs/design/build/build-logo.mjs` (headless, no FigCraft window). It also writes `app/src/components/KonaMark.tsx`, which the sidebar uses. Change the script, not the outputs.

## Remaking the app icon files

The files in `app/src-tauri/icons` come from `kona-icon.svg`. FigCraft's render puts the picture on a light page, so render the icon twice (once on black, once on white) and recover the see-through corners from the difference, then run Tauri's icon command on the 1024 px PNG:

1. Make two copies of `kona-icon.svg` with a full-size `<rect width="200" height="200">` first, one filled black, one white.
2. `figcraft-cli render copy.svg -o copy.png --scale 5.12` for each.
3. Alpha is 1 minus the mean of (white minus black) over 255; colour is black divided by alpha. Save as a 1024 px RGBA PNG.
4. `cd app && npx tauri icon <that png>`, then delete `src-tauri/icons/android`, `ios` and `64x64.png` (not used).
