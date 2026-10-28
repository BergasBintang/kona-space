# Kona's logo

A black cat with soft pointed ears and two tilted white oval eyes, with a sunflower between its ears. The cat is the name's owner; the sunflower is for the owner's girlfriend. The app icon is the cat on an ice-blue rounded square (the cool blue-grey of Kona's dusk theme, lighter). The mark inside the app is the same cat in one colour, the logo gold (`--color-brand`, #e8b25a), with the eyes and a ring around the flower cut out.

Version 2, chosen on 2026-10-28 (the first logo was a cat with a sunflower in its face; it and its FigCraft board are in the Git history, before the commit that removed them).

| File | What |
|---|---|
| `kona-icon.svg` | The app icon: ice-blue square, black cat, white eyes, gold flower. Also the favicon (`app/public/favicon.svg`) |
| `kona-mark.svg` | The flat gold mark, with the eyes and a ring around the flower cut out (masks, so it sits on any background) |
| `../previews/logo.png` | The board: the icon at several sizes and the mark |

Everything is made by `docs/design/build/build-logo.mjs` (plain Node, no FigCraft). It also writes `app/src/components/KonaMark.tsx`, which the sidebar, the update card and the start screens use. Change the script, not the outputs.

## Remaking the app icon files

The files in `app/src-tauri/icons` come from `kona-icon.svg`:

1. Make an HTML page with the SVG at 1024 by 1024 on a transparent body, and screenshot it with Edge, keeping the background see-through:
   `msedge --headless=new --default-background-color=00000000 --window-size=1024,1024 --screenshot=icon-1024.png file:///.../icon.html`
2. `cd app && npx tauri icon <that png>`, then delete `src-tauri/icons/android`, `ios` and `64x64.png` (not used).
