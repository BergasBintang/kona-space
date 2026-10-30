# What we learned, and how to tackle it next time

Written 2026-10-30, at the end of the long session that produced versions 0.20.x to 0.22.0 (roles you can set up, skills per project, the office built from parts and turnable, workflows). It is for you (the owner) and for any future Claude session. Read the part you need; each part says what was found, why, and what to do.

Plain words are used on purpose. Terms are explained the first time.

---

## 1. Where everything is

| What | Where |
|---|---|
| The art scripts (cat, office, walls) | `art/` (read `art/README.md` first) |
| The office plan (rooms, doors, furniture, windows) | `art/office.mjs` (`DEFS` at the top is the floor plan) |
| The walls, drawn as one structure | `art/walls.mjs` |
| The cat in four looks | `art/cat.mjs` |
| Kibby, the office boy (his art, his route, his talk) | `art/kibby.mjs`, `WALK` in `art/office.mjs`, `app/src/lib/kibby.ts`, `app/src/components/KibbyChat.tsx`, `app/src-tauri/src/kibby.rs` |
| Build the pictures | `cd art`, then `node build-cats.mjs`, `node build-office.mjs`, `node to-app.mjs` |
| What the app reads | `app/src/office/` (`views/v0..v3.json`, `parts/*.png`, `cats.png`, `cats.json`) |
| The office on screen | `app/src/components/Office.tsx` |
| Set up a role (personality, job, model, permissions, skills, connectors) | `app/src/components/RoleSetup.tsx`, `app/src-tauri/src/roles.rs`, `skills.rs`, `session.rs` |
| Workflows | `app/src/components/Workflows.tsx`, `app/src-tauri/src/workflows.rs` |
| Tickets (the Board) | `app/src-tauri/src/tickets.rs`, `app/src/components/Board.tsx` |
| Updates | `app/src/lib/update.ts`, `app/src/components/UpdateCard.tsx` |
| Releasing | `docs/RELEASING.md`, `docs/VERSIONING.md` |
| The plan and the decisions (rows 49 to 54 are from this session) | `kona-space-app.md` |

Data on disk, per project: `<project>\.kona\role-kits.json` (skills and connectors per role), `.kona\skills\<name>\SKILL.md`, `.kona\role-plugins\` (built once per kit, pruned after 14 days), `.kona\workflows\<id>.json`, `.kona\brain\workflow-<id>.md`, `.kona\tickets\T-nnnn.md`. Per computer: `%APPDATA%\Kona\role-profiles.json` (personality, job, model, permissions), `%APPDATA%\Kona\skills` (the shelf of skills to copy from).

---

## 2. The office art

### 2.1 What the picture is made of

- The office is no longer one baked picture. Every desk, chair, wall piece, floor piece, plant, board and rug is its own small PNG with a place (`x`, `y`) and a front-to-back number (`d`). The cats are in the same list so a cat is drawn between the pieces behind it and the pieces in front of it.
- The build draws the whole office from four sides (`setView(0..3)`). For each side it writes a list (`out/views/vN.json`). Pieces that look the same share one file (named by a hash of the picture).
- **The proof.** After each side the build puts its parts back in order and compares with the picture pixel for pixel. If they differ the build stops. Keep this: it catches every ordering or cropping mistake in the parts pipeline.
- `to-app.mjs` copies what the app needs and removes pictures no side names any more. `out/parts/` and `out/views/` are made again by each build and are not in git.

### 2.2 The rules that make it look right

1. **The tile is the unit.** A floor tile is 32 x 16 px. Pieces stand on whole tiles, anchored at a tile corner (a chair, a plant and a cat take one tile each, but may be drawn smaller inside it).
2. **Height is in whole steps of 4 px.** Low wall 8 px, desk 8, chair seat 4, plant 16, shelf 28, rack 32, brick back wall 32. Anything smaller than a step (keyboard, book rows, lights, chart bars) is *painted on a face or on a top* as part of the piece's own picture, never a loose object. The build prints `CHECK:` if a box is not whole steps.
3. **Positions snap to 1/8 of a tile** (2 px across, 1 px down). Other fractions give ragged slanted edges. Do not invent other fractions.
4. **A piece is drawn in its own frame** (`frame()` / `piece()` in `office.mjs`): x along its width, y from its back (0) to its front. It faces one of four ways, and the same drawing is turned with the plan. So one drawing gives the four looks. Details on a face go through `fy`/`fx` (a face is painted only when it looks towards the camera).
5. **Chairs, sofas and armchairs are plain seats.** You asked for this twice: a backrest and arms made the picture busy and caused glitches. Do not add them back.

### 2.3 Four views: the idea that unlocks everything

- Work in the camera's own space: `u` runs down-right, `v` runs down-left. `rot()` turns a plan point for the current view, `unrot()` goes back. A face is visible only if its normal has a positive `u` or `v` part.
- Which walls are tall brick and which are low is **not** fixed: a wall is tall when there is open ground behind it for the current camera, and low otherwise. Compute it from the camera, never hard-code a side.
- Decor on walls (windows, boards) goes on the *inner* face of every outer wall and draws only when that face looks at the camera, so it shows on whichever two walls are the back walls of the current view.

### 2.4 Walls: why they are a separate program

- Hand-drawn walls kept breaking at corners, T joints and ends ("a V at the corner", "jagged teeth", "walls with gaps"). Patching each case made it worse ("IT JUST GETTING WORSE").
- `walls.mjs` solves all cases at once: it paints every wall box into one picture and remembers, per pixel, which box painted it and which *surface* it is (a top at a height, or a side face on a plane in a colour). An outline is drawn only where a surface meets a *different* surface or air, and only on the nearer one. Two walls that run on into each other are the same surface, so no seam shows. Then each box takes the pixels it painted as its own piece.
- Each wall piece carries `hides` (the room it stands in front of). When you zoom into a room the app leaves those pieces out, like a dollhouse with its front open.
- **If a wall looks wrong, fix `walls.mjs` or the wall plan, not one picture.**

### 2.5 Drawing order: the most expensive lesson

- Sorting by the centre of a piece is wrong for a long piece beside a wall: the wall is in front of one half of it and behind the other half. That caused the grey box that looked stuck into a wall.
- The fix (in `office.mjs`, near `const sorted`): furniture, cats and low walls carry a *footprint* in camera space (`[u0, u1, v0, v1]`, shrunk by 0.15 tile so a wall on the tile edge is clearly beside the piece, not under it). Piece A goes before B when A lies wholly behind B along `u` or along `v`. Where that says nothing, the order by depth stays. Floors, rugs, wall art and the tall back walls keep fixed depths.
- The cat sits at the chair's depth + 0.01, so it is drawn after its chair and before a desk in front of it.

### 2.6 The checks the build runs (read the `CHECK:` lines after every build)

A `CHECK:` line is a problem to fix, not noise. A clean build prints none. They cover:

- a piece overlapping another, crossing a wall or leaving the floor (first view only: these are about the plan);
- two tiles in front of every door stay clear (the exact width of the door);
- **a low piece (under 16 px) needs floor of its own room on all four sides**, because from some side of the building a wall stands in front of it and would hide it. A chair counts as a low piece, so a cat's chair may not stand on the edge of a room. Tall pieces are exempt;
- nothing may cover a cat, in every one of the four views (the build renders it and counts pixels);
- the whole-tile and whole-step rule.

### 2.7 Design rules found the hard way

- **Keep a tall piece two tiles from a cat** along a row or column. One tile away, from the opposite side of the building it hides the cat.
- **Back-to-back desks** (Engineering) fit more cats than desks in a row: cat, desk, desk, cat. Cats stay off the room edge.
- **No outline notches of one or two tiles.** A notch (one room one row shorter than its neighbour) shows up from another side as a short stub of brick wall standing next to low walls. It is geometrically right and looks wrong. Support was made as deep and as wide as its neighbours for this reason. After a plan change, check that there is no short tall-wall run (the debug script used in the session listed tall runs of 2 tiles or fewer in all four views).
- **A tall standing board near a wall, with something tall on the other side of that wall** (a plant, a shelf) reads as the object sitting on top of the board from one side. The Marketing "wall of posts" board did this, and was removed. If you add a standing board, put it where nothing tall stands just beyond the wall behind it, in all four views.
- A very large single piece in a room corner (the Engineering server box) looked heavy against the front walls. Prefer small pieces at corners.

### 2.8 The cat

- 28 x 20 frame, a 16 x 18 body, seven frames (idle, blink, typeA, typeB, waitA, waitB, happy), eleven roles, four looks.
- The sheet has a block of rows per look: row = `dir * 11 + roleIndex`. In the app: `catRow(role, dir)`. `cats.json` has `dirs: 4`.
- Looks: 0 down-left, 1 down-right, 2 up-left, 3 up-right. **Only two are drawn** (`TURNED` and `BEHIND` in `cat.mjs`); 1 and 3 are the whole frame mirrored (`Img.flipX()`), so the card and the raised paw swap sides with them. Look 0 is a three-quarter view: eyes, muzzle and belly turned left, light from the left so the right cheek and flank are in shade (`d`), a tail curling up on the right. Look 2 is from behind, the left cheek and the inside of the left ear showing. From behind there is no card and no typing hands. Draw a change once, in one of the two, never in a mirrored one.
- The logo keeps its own look (`LOGO_LOOK`, the older nearly-front cat) so a change to the cats does not move the logo and the app icon. `catBody()` returns that one.
- The look a cat gets comes from its workstation's facing and the camera side (`workstation()` in `office.mjs`).
- A latent bug fixed on the way: the right eye never blinked. The cat is drawn by script (letters in rows, one letter per pixel). A hand-drawn version in LibreSprite would be nicer; keep the sheet layout above (frame size, frame order, `row = dir * 11 + roleIndex`). Checking a change: `node build-cats.mjs`, then look at the sheet at 7x on the floor colour, all frames (idle, blink, typing, waving, happy), all four looks, not only idle.

### 2.9 Kibby, the office boy (added after 0.22.0)

- **What he is:** a cat in an apron who walks the hall and talks about anything. He is **not a role** (no desk, no session, no tools, no project knowledge). His sheet is `out/kibby.png` (28 x 20 frames like the cats; a row per look, a column per frame: idle, blink, walkA, walkB, walkC, walkD, happy). Like the cats, only looks 0 and 2 are drawn; 1 and 3 are mirrors. The walk is a **hop of 2 px and a lean of 1 px of the top 12 rows**, one way, then the other (walkA hop + lean left, walkB landing, walkC hop + lean right, walkD landing). To change it, change `WALK` (hop, lean) in `kibby.mjs`.
- **His route** is `WALK` in `art/office.mjs`: places (nodes) on the hall and straight stretches (edges) between them, in tiles; the corridor's middle is the line between its two tile rows (j = 8). The build turns every eighth of a tile of every stretch, for every side, into a step `[x, y, k, look]` in `views/vN.json` under `walk`. `k` is the place in the list of pieces where he is drawn.
- **Depth, the part that must not go wrong:** `placeWalker()` in `office.mjs` finds `k` the way the cats are ordered. Among the pieces whose picture overlaps his, a piece wholly behind him must be drawn before him and a piece wholly in front of him after him; if both hold at once there is no place, which is a CHECK line. It also counts the pixels of his body that anything drawn after him would cover (more than 20 is a CHECK line, the cats' rule), refuses a step off the hall floor and one that walks through a piece. Read the `CHECK: Kibby on ...` lines after every build, like the others. Zero lines today.
- **What was fixed to make his route clean:** the plant at (10, 9) moved to (10, 14), the two shelves of Content and SEO moved from the wall next to the hall to the far wall, the two standing boards of Marketing and Support moved one tile into their rooms (they hid the hall behind them from two sides). A tall piece standing against the wall next to the hall hides the corridor from the sides where the room is in front: keep such pieces away from the hall wall, or move the route.
- **On screen** (`Office.tsx`, component `Living`): his own clock, 8 steps a second (`TICK_MS` in `lib/kibby.ts`); at a place he stands 2 to 6 seconds, then picks a stretch that starts there (not straight back unless it is the only way). He stops while a room is zoomed (and is hidden), while you talk to him, and with Windows "reduce motion" (he then stands at one place). A click box over him opens the dialog; hover shows his name. The walking logic is plain functions in `lib/kibby.ts`, tested in `lib/kibby.test.ts`.
- **His talk** (`KibbyChat.tsx`, `kibby.rs`): a dialog like an old role-playing game (a name tab, his face, text typed letter by letter, a click or "reduce motion" shows it at once). He starts with a plain "Hi!". Each message is **one one-shot Haiku call** with no tools (`summary::run_haiku`), his character as the system prompt (`PERSONA` in `kibby.rs`: kind, a little shy, quirks, kind gossip about the eleven role cats, cannot read or change anything, short plain replies, no markdown) and the last 12 turns in the prompt. The talk is on screen only. The call uses the project's account, and its dollars go in the ledger under the kind `kibby`. **Not measured yet:** the cost and the delay of one message on this PC.
- **To change his character:** edit `PERSONA` in `kibby.rs` (the test `the_character_says_what_he_cannot_do` checks two promises in it). **To give him a longer memory or save the talk:** the history is passed from the screen; keep 12 turns unless the cost is measured.
- **Turning the building is locked while a room is zoomed** (the two buttons are disabled with a short hint); go back first.

### 2.10 How to handle a glitch you send me

1. A crop of the picture is enough, but **say which side** (first, or after pressing a turn button). Most glitches are in the rotated sides.
2. I rebuild, then look at the same place in all four views at 4x to 8x (a crop with a few features: a rug colour, a plant, a wall end, a chair, is enough to find the place).
3. Find the *cause* (ordering, a wall rule, a footprint, a plan notch) and fix the rule, not the single picture. Then add or tighten a `CHECK:` so it cannot come back.
4. Look at all four sides again before saying it is fixed, and say which sides I looked at.

---

## 3. Roles, skills and tokens

### 3.1 What was measured (this PC, Claude Code 2.1.293, Haiku)

| Case | Tokens at session start |
|---|---|
| Nothing restricted | about 41,200 |
| Restricted (project and local settings only, strict connectors) | about 33,200 |
| Restricted plus one skill | about 33,100 to 33,300 |

- About 16 built-in skills (about 250 tokens) stay in every session; they cannot be removed.
- `--disable-slash-commands` also removes the plugin skills, so it cannot be used.

### 3.2 How a role session is narrowed

- Flags on a role session: `--setting-sources project,local`, `--strict-mcp-config`, `--mcp-config` (Kona's board tools plus only the chosen connectors), `--plugin-dir` (a folder with only the chosen skills).
- The plugin folder is named by a fingerprint of the kit, built once, and pruned after 14 days. (It was deleted and rebuilt on every start before, which broke two sessions running at once.)
- Skills belong to the project (`.kona\skills`). A skill on the computer is only something to copy from. The personality, job, model and permissions are the same in every project; skills and connectors are per project.
- 15 of the 33 skills on this computer are symlinks; scanning must follow them (`fs::metadata`, not `symlink_metadata`).

### 3.3 Reviewing outside skill collections (done as reading only, nothing installed)

Rule: read the `SKILL.md` first, install nothing without a yes, and install only into a project, never the whole computer. Three of the seven repos looked good (obra/superpowers, mattpocock/skills, wheelry/deep-skill-finder were the shortlist at the time). A "suggested skills" button is possible later; it needs your yes per skill.

### 3.4 The Set up window pattern

Keep the page to short words; put every full explanation behind a "?" (`Help`). A label, a one-line hint, a "?". Do this for any new settings screen.

---

## 4. Workflows (built in 0.22.0)

- **Idea:** the usual steps of a kind of work, a role on each, drawn as a flowchart you can edit. It is the *plan*; the Board is the *state*. They must never both hold state.
- **Storage:** one plain JSON file per workflow in the project; saving also writes a Brain note with the steps in words so asking the Brain finds it.
- **Rules:** a step may only come after steps listed before it (so no loops); up to 20 steps; ids are small letters, digits and dashes.
- **Start:** raises one Board ticket per step. A step with something before it is Backlog and has `blocked_by` (the earlier tickets); the card says "Waits for ...". We chose `blocked_by` over a second "waiting" state so the Board keeps one meaning of "waiting" (waiting on the owner).
- **Starters:** New feature, Bug fix and Launch are suggestions until you save your own.
- **A waiting step becomes Ready by itself (added after 0.22.0).** `tickets::release_waiting` runs when a ticket is moved to Done and when one is removed: every ticket still in Backlog whose `blocked_by` tickets are all done (or no longer exist) moves to Ready, with a line in its history. A ticket the owner already moved elsewhere is left alone. Agents still cannot move a ticket to Done, so only the owner starts a chain going. Tests are in `workflows.rs`.
- **"Running now" on the Workflows screen:** lists the open tickets of the opened workflow (status in words, what each waits for) and gives every Ready step a "Start as <role>" button that starts the role session on that ticket, the same code as the Board's button. **It does not start a session on its own, by choice:** a session spends the owner's plan and can change files, so the owner presses the button. If you later want auto-start, make it a per-workflow switch that is off by default.
- **Not done yet, and how to tackle it:**
  - *Roles read only the steps they are part of.* Add the steps of a ticket's workflow to the ticket prompt (`tickets::prompt_for`).
  - *Chart lines that skip a column pass behind a box.* Route them around (add a lane) if it starts to confuse.

---

## 5. Screens and small things worth remembering

- **Markdown.** What Claude writes and the update notes are Markdown. The shared reader is `components/brain/Markdown.tsx` (use `Markdown chat` for a session, `Inline` for one line). It draws bold, italics, code, lists, quotes, headings, code blocks and tables (kept as written in a fixed-width block). A link is shown as text and never opens inside Kona (it would take the window away from the app). Any new place that shows text from Claude should use it.
- **Room names** sit in the middle of each room, a little see-through (`bg-surface-2/70`), solid on hover. They used to be door signs on the hall floor.
- **Welcome page** shows the version and a Check for updates button; the update card shows there too.
- **Turn buttons** turn the building a quarter; the side is remembered in `localStorage` (`kona.office.view`), always wrapped in try/catch.

---

## 6. Releasing, and what went wrong

### 6.1 The steps (from `docs/RELEASING.md`)

1. Version in seven places: `VERSION`, `app/package.json`, `app/package-lock.json` (twice), `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock`, `app/src-tauri/tauri.conf.json`. Then `CHANGELOG.md` (the first lines become the notes on the update card).
2. Commit, tag `vX.Y.Z` (annotated), then `cd app && npm run release` (heavy: a full Rust release build, many minutes on this PC).
3. `git push origin main vX.Y.Z`, then `npm run publish-release -- --yes` (with `D:\toolchain\gh\bin` on the PATH). The tool checks the three files, the tag on GitHub and that the program code equals the tag.
4. Check on a machine with an older Kona: Settings, Updates, Check now. (This worked for 0.21.0: the update card appeared with the new notes.)

### 6.2 Mistakes made and what to do instead

- **Changing code after tagging.** Fixes kept arriving after the tag, so the build was stopped and redone three times. Do *all* the changes, run *all* the checks, then bump, commit, tag, build. A tag is only moved while nothing is pushed.
- **Stopping a background build.** Stopping the task does not stop `cargo`/`rustc`. They keep running and hold the build lock. Wait for the build to finish, or ask before ending those processes (killing was refused once; do not try to get around that).
- **Version numbers.** A change you can use is a MINOR bump (0.21.0 to 0.22.0). 0.21.1 was never published; its changes went out in 0.22.0 and the local tag was deleted.
- **Calling something fixed without looking.** Say which sides, which screens and which checks were looked at, and which were not (the real window and the smoke test were not run for a long time).
- **Shell quoting.** Long Python patches inside a shell heredoc failed (`unexpected EOF`). Write patch scripts to a file with the Write tool and run them.
- **Line endings.** Some files are CRLF. Patches must keep each file's own line endings, and a lone `\r` inside a note must never be written (a `\r` in a Python replacement template turned `\role-*.json` into a carriage return once).
- **Over-fixing.** When a glitch got worse after a fix ("IT JUST GETTING WORSE"), the right move was to stop, find the cause in a general rule, and rebuild that part (that is how `walls.mjs` and the ordering rule were born).

### 6.3 Before you say a release is ready

- `npx tsc --noEmit`, `npm test`, `npm run build`, `cargo test` (19 pass, 2 are manual), and `node build-office.mjs` prints no `CHECK:` and four "pixel for pixel" lines.
- Look at all four sides of the office and the screens that changed.
- (First run: 2026-10-30, 0.22.0, all passed.) Run the smoke test on the built program when your own Kona is closed: start the built program with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`, then `node tests/smoke.mjs` in `app/`. It changes nothing and starts no session.

---

## 7. What is still open

| Open | How to tackle it |
|---|---|
| Room layout on whole tiles | You said you will report what looks wrong. When you do: say the side and send a crop; I fix the rule, then check all four sides. Growing a room means editing `DEFS`; then rerun the build, read every `CHECK:`, check there is no short tall-wall stub, and look at all four sides. |
| Cat looks | Redrawn after 0.22.0 as a true three-quarter view with shading and a tail (section 2.8); still drawn by script. A hand-drawn LibreSprite cat can replace it, keeping the sheet layout. |
| Real window | Done once for 0.22.0 on 2026-10-30, with your Kona closed: all 19 smoke checks passed (welcome page, office, every place including Workflows, no content-policy blocks), and a short extra check showed the turn buttons change and remember the side, the Workflows screen has its three suggestions and its chart, and the top bar shows v0.22.0. Run it again after each release (section 6.3). |
| Workflow follow-ups | Left: roles reading only their own steps, chart lines that skip a column, an optional auto-start. Section 4. |
| Kibby inside the rooms | He walks the hall only. Rooms need their own ordering checks (furniture, desks); extend `WALK` with a door and a few steps inside, then read the CHECK lines. |
| Kibby's talk, measured | Measure the cost and the delay of a message, then decide on a longer memory or a saved talk. |
| Decor on every wall | Windows are on all outer walls; art boards only on three. Add more through the `ART` list in `office.mjs`. |
| Workflows and the Board in the office | A room may later show a "Workflows" tag of its own; today the Board room opens both. |
