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
| **Bulky walls**: a wall is a block as big as a tile, tall where open air is behind it on the side you look from, low elsewhere; every wall is the one colour #d8cdb6 in three shades (since 0.27.0, decision 59) | `engine/walls.ts`, `engine/scene.ts` | Done. The building grew from 32 x 19 to 45 x 27 tiles. |
| **Doors, windows and boards as data**: window, door (painted), art boards on a wall tile; a doorway is an opening in a wall line | `engine/decor.ts`, `engine/scene.ts` | Done. |
| **The engine runs inside Kona**: floor, walls, furniture catalog, drawing order, hit areas for the rooms | `office/engine/` | Done; one side builds in about 0.3 s. |
| **One map per project**, kept in `.kona/office-map.json` | `src-tauri/src/office_map.rs`, `lib/api.ts`, `App.tsx` | Done. A map that cannot be read shows the standard office and the file is left alone. |
| **The editor screen**: plan from above, palette, live picture, undo and redo, warnings, save | `components/OfficeEditor.tsx`, `office/edit.ts` | Done (version 1). |
| Kibby walks the hall tiles of the map | `lib/kibby.ts` | Done. |

### Not done, on purpose or for later

- Hand-drawn floor tiles (a PNG that replaces the tile the script makes) were possible in the first pipeline and are not in the engine yet.
- The editor cannot rename or recolour rooms, add a room or change its floor pattern: it paints with the rooms that exist. A map made by hand can.
- The plan has no zoom by mouse wheel (buttons only), no box select, no copy and paste.
- Windows only on tall walls (the back of the side you look from); a low wall shows only a door.
- **A door is where Bako fetches the food (2026-11-03).** Bako, the second office boy, goes to a door of the map now and then and brings a bento to a worker. With several doors he picks one by chance; with none, or none he can walk to (the floor in front of it must be free), he only sweeps.
- The first pipeline (`art/office.mjs` and friends) was removed in 0.26.0 (it is in git history).

## The editor since 2026-11-02 (ticket T-0005, decision 60)

- **Icons, one list of things (2026-11-02).** Select and move, Erase, Undo, Redo, Save, Close, Zoom in and out, Center, Edit the office and the turn buttons are pixel icons with no words (the name is in the hover and for the screen reader; icons are in `components/Icon.tsx`). "Use the standard office" is now "Default map". Every part that can be put down lives in one list called Things, each with a picture, and picking one chooses the tool: Floor (a grid of 24 small swatches and "no ground"), Walls (Wall, Doorway), On a wall (window, door, boards) and the furniture groups. The pictures of walls, doorways and wall things are made by `engine/thumb.ts` like the furniture ones. Zoom sits on the right of the plan; a dashed "+" strip along each edge of the plan adds a row or a column there.
- **Required parts (2026-11-02).** A person's desk, each piece that opens a screen and the two boards that open one carry a small ringed asterisk in the Things list; hovering the row says in a few words what it is for and what is lost without it. A legend sits beside the heading.
- **A preview where a thing on a wall will land (2026-11-02).** With a window, door or board picked, moving over a wall tile colours the tiles it would cover blue and draws a heavy line on the side it would hang on; the line at the bottom says it in words ("This door will hang on the top side of this wall, over 2 tiles"). When it cannot hang there the tiles turn red and the line says why. Which side: the free side nearest to the pointer inside the tile.
- **Doorways on the plan (2026-11-02).** A doorway is a gap in a line of wall, at most four tiles wide, with a wall tile at each end. On the plan it is a tinted tile with a dashed line (the wall, open here) and a double arrow across it (people walk through); the old pair of dots is gone. With the Doorway tool the tile under the pointer shows how it would look (blue; red when it cannot be one) and the line at the bottom says why. A doorway in no wall line is named in the warnings ("does nothing"). In 3D the gap has a post at each end, whatever its width (engine/doorway.ts holds the rule; before, only a one-tile gap had posts and the wider ones showed nothing).
- **One view.** The editor opens on the editable plan. "See in 3D" shows the office in 3D (look only, with the turn buttons); "Back to the plan" returns. In 3D the tools are off and the keys do nothing.
- **A wider left column** with a real picture of each piece (`engine/thumb.ts` draws a piece alone on a tiny floor with the same engine; `components/Thumb.tsx` shows it).
- **One of each.** Each person's desk (each person is its own item in the group of desks), each piece that opens a screen (`Kind.opens`, `Kind.unique`) and the boards in `UNIQUE_ARTS` exist once. Placed, they are dimmed grey in the list ("Already in the office") and cannot be placed again (`edit.ts`: `uniqueKey`, `isPlaced`, `artHung`); removing one frees it. A hand-made map with a duplicate still gets the warning from `checkMap`.

## Floor styles instead of rooms (ticket T-0007, decision 59)

- A **room is not a thing any more**. A floor tile names a **floor style** (two colours and a pattern). Kona ships a palette of 24 (`engine/styles.ts`, `STYLES`); the Floor tool paints with those and nothing else. A map keeps the definition of every style it uses (`OfficeMap.styles`), and a style no tile uses is dropped when the map is saved (`trimMap`).
- A map saved before this change (it has `rooms`, with names, kinds, wall colours) is read as styles with the same colours; the rest is dropped (`parseMap`). It draws the same ground.
- Rugs choose from Kona's colour pairs (`RUG_PAIRS`).
- **What an office must have** (`needs` in `map.ts`): a desk for each person, each piece that opens a screen and the two boards that open one. **Saving is refused** while any is missing (`missingPieces`). A saved office that lacks one gets it put back when it is opened (`ensurePages`: the standard office's place if it is free, else the nearest free floor), with one notice; the file changes when the owner saves.
- `checkMap` no longer asks every room for a door; it names an area with something in it that has no way to the rest of the office (the open floor is the biggest connected stretch of floor).
- **Kibby** walks on any floor tile with no wall and nothing standing on it (`Scene.walkable`).

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
