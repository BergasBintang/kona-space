# Edit the Office: the map maker

Agreed with the owner on 2026-10-31 (decision 57 in `kona-space-app.md`). This is the plan and where it stands. Plain words on purpose.

## What the owner asked for

- A screen in Kona, "Edit the Office", to put things in the office by hand: tiles, walls, furniture, and the cats with their desks.
- A cat and its desk (and chair) are **one thing**: they move, turn and are deleted together.
- The map has **its own zoom**, not the window's percent view (100, 90, 80), which is for text and buttons.
- The mouse wheel moves the map up and down, Shift and the wheel move it left and right, Ctrl and the left button drag it.
- A button brings the map back to the centre, which is the secretary's desk.
- Walls take **a full tile** (bulky, like a block) so nobody has to work out how a thin wall meets furniture.
- What is **attached to a wall** (doors, the street door, windows, wall art such as boards and charts) can be placed, moved and removed too, on any wall tile.
- **One map per project.** Each project has its own office.

## What was built (all of it written and tested; see the checks at the end)

| Part | Where | State |
|---|---|---|
| **Map view**: own zoom (whole numbers of screen pixels, not the percent view), wheel, Shift and wheel, Ctrl and wheel (zoom round the pointer), Ctrl and drag, +/- keys, Center on the secretary | `lib/mapview.ts`, `components/Office.tsx` | Done. |
| **The map as data**: tiles with a floor and a wall block, things on walls, objects (a cat and its desk are one), rooms | `office/engine/types.ts`, `office/standard.json` (the standard office), `office/map.ts` (read a saved map safely, the checks) | Done. |
| **Bulky walls**: a wall is a block as big as a tile, tall brick where open air is behind it on the side you look from, low elsewhere | `engine/walls.ts`, `engine/scene.ts` | Done. The building grew from 32 x 19 to 45 x 27 tiles. |
| **Doors, windows and boards as data**: window, door (painted), art boards on a wall tile; a doorway is an opening in a wall line | `engine/decor.ts`, `engine/scene.ts` | Done. |
| **The engine runs inside Kona**: floor, walls, furniture catalog, drawing order, hit areas for the rooms | `office/engine/` | Done; one side builds in about 0.3 s. |
| **One map per project**, kept in `.kona/office-map.json` | `src-tauri/src/office_map.rs`, `lib/api.ts`, `App.tsx` | Done. A map that cannot be read shows the standard office and the file is left alone. |
| **The editor screen**: plan from above, palette, live picture, undo and redo, warnings, save | `components/OfficeEditor.tsx`, `office/edit.ts` | Done (version 1). |
| Kibby walks the hall tiles of the map | `lib/kibby.ts` | Done. |

### Not done, on purpose or for later

- Hand-drawn floor tiles (a PNG that replaces the tile the script makes) were possible in the first pipeline and are not in the engine yet.
- The editor cannot rename or recolour rooms, add a room or change its floor pattern: it paints with the rooms that exist. A map made by hand can.
- The plan has no zoom by mouse wheel (buttons only), no box select, no copy and paste.
- Windows only on tall brick walls (the back of the side you look from); a low wall shows only a door.
- The first pipeline (`art/office.mjs` and friends) was removed in 0.26.0 (it is in git history).

## Decisions inside the plan

- **The cat and its desk are one object** in the data (`kind: "workstation"`), as in `standard.json`.
- **Zoom is whole numbers of screen pixels** (1 to 10) so every pixel of the drawing stays square. It uses `window.devicePixelRatio`, which changes with both the percent view and Windows scaling. The map starts with the whole building in view, centred on the building; the Center button goes to the secretary.
- **One map per project** (decided 2026-10-31). It is saved in the project's own folder, `<project folder>/.kona/office-map.json`, next to the other per-project files. A project with no file shows the standard office; the first save writes the file. Kona's own built-in office is the standard one and is never changed by the editor. The engine runs inside Kona, so a project's own map is drawn as soon as it is saved.
- **Wall attachments are data, not code.** A wall tile carries a list of attachments: a `door` (an opening, with its frame and posts, onto the hall or the street), a `window`, or a piece of `art` (a board, a chart, a notice). Each says which face of the tile it is on. The standard office's windows, boards and street door are in this list.
- **Rules the editor must keep.** A room needs a door onto the hall, and the street door must have two clear tiles inside it. These stay warnings in the editor, not stops: you may build what you like and see what the checks say.

## Rules for whoever continues

- Read `art/README.md` and `docs/LESSONS.md` first.
- Check a data change by building and comparing the four pictures byte for byte (`md5sum`), as step 1a did.
- On the turned sides a tile's top corner is not its (i, j) corner: use the highest of its four corners (see `drawGround` in `engine/floor.ts`).

## The wall joint bug (found 2026-10-31, and why it cannot come back)

**Symptom.** Where a tall brick wall met a low wall, the junction looked wrong from some sides of the building and fine from others (the same tiles).
**Cause.** A wall is tall only when open air is behind it for the side you look from, so the same wall run can be tall in one place and low in the next, and which tiles are tall changes with the side. The first version of the engine gave every tall wall a fixed place at the very start of the drawing ("nothing is behind a back wall"). That is false at a joint: a low wall can lie beside and behind the end of a tall one, and it was then drawn over the brick. Windows, doors and boards had the same fixed place, so they were out of order with the wall under them too.
**Fix (engine/walls.ts, engine/decor.ts, engine/scene.ts).** Every wall tile, tall or low, has a footprint and goes through the same "A lies wholly behind B, so A first" ordering as furniture. A thing on a wall is painted into the picture of each wall tile it covers (clipped to that tile's own face), so it goes with its wall. There is a test (`office.test.ts`) that checks the order on all four sides, one that a low wall behind a tall one comes first, and one that nothing is drawn on its own any more. `art/joint-sheet.mjs` draws a made-up map with every kind of joint from all four sides, and `art/find-joints.mjs` lists where tall meets low in the standard office.
