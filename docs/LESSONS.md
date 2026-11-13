# What we learned, and how to tackle it next time

Written 2026-10-30, at the end of the long session that produced versions 0.20.x to 0.22.0 (roles you can set up, skills per project, the office built from parts and turnable, workflows). It is for you (the owner) and for any future Claude session. Read the part you need; each part says what was found, why, and what to do.

Plain words are used on purpose. Terms are explained the first time.

---

## The benchmark: read this first, in every session

Every line was paid for with a correction or a wasted hour. Before showing the owner any work, go down the list. A line that fails means the work is not ready. The reasons and the stories are in the sections below (most in section 10).

**Listening**

1. Something the owner said once still holds. Before building a screen, read this list and search the Decisions table for what was already agreed.
2. When a redesign replaces a screen, list what the old one had first. Nothing agreed may disappear without saying so.
3. If a word could mean two things (they said "b-tree", or "vertically scrolled per group"), show a small picture of what you understood before building it. For a layout, say in one line what stacks which way (groups top to bottom, cards left to right) before the first edit. A wrong guess costs more than one question. Before saying a new idea overlaps something that exists, say what you think it is for and ask.
4. When the owner says "I don't understand", take things away. More explaining text makes it worse.
5. A question gets answered first, in plain words ("WHAT IS THIS?" means explain it). While the owner says "we are discussing", change nothing. "Would that be a disaster, right?" is a question, not a request (it got a rebuild that was then undone).

**Screens**

6. No explanation sits on the page. It goes behind the round "?" (`Help`) beside the heading. Only what is true right now stays: empty, busy, failed, a warning at the moment of an action, live numbers.
7. The same words never appear twice on one screen. Look at the opened state too, not only the closed one.
8. A box shows the text that already exists, ready to change. It saves by itself and says "Saved". No empty box with an example inside when real text exists.
9. Only Kona's own pickers (`Select`, `SmartSearch`), never a system `<select>`. Icons are centred, and where the owner asked for an icon, there are no words.
10. Try it with a real amount: forty skills, long names, an empty project, a narrow window. One item proves nothing about a list.
11. A file or thing nothing points at is a dead end. Whatever can be placed or added shows where it lands, or says when it is used, before you commit to it.

**The office**

12. Look at all four sides before saying anything drawn is fixed, and say which sides were looked at.
13. Change the default map through `art/build-standard.mjs`, never by hand. `checkMap` must report nothing.
14. A piece of several parts paints in call order: use `near` so nearer parts paint last. Kibby is checked against doorway posts too.

**Saying it works**

15. Tests passing does not mean it works. Say what was seen in the real window and what was not. Anything Claude has to use (a skill, a tool, a prompt) is proven only by a real conversation in a throwaway project.
16. Never warn about a risk that can be tested in a minute. Test it, then report the result. A "not tested" list holds only what cannot be tested here, and before saying a test covered a case, look at the real condition (the path, the drive, the number).
17. A running window can be older than the code. `cargo test` does not update it, and `tauri dev` does not rebuild for files outside the Rust code (touch `src/lib.rs`). Check the program's time before believing a window test.

**The owner's data**

18. Never test on the owner's project (a test that clicks picks by an exact match and checks that the throwaway project is the one open): add a throwaway one, remove it afterwards, and delete its folder and its Claude transcripts. If a real project must be touched, save a copy of its data first and say so.
19. Reloading the window throws away what the owner has open. Do not reload or drive it while they may be in the office editor with unsaved work.

**Shipping**

20. What goes inside the program must work for anyone who downloads it: no company names, keys, addresses or local paths. Text from other people's projects stays out; write it fresh.
21. Commit, tag, publish and anything on a server wait for the owner's word.

**Tools on this PC**

22. Long scripts: write the file with the Write tool, then run it. No heredocs with quotes, backticks or backslashes, and never `python -` or `python3 -` (it waited for input for two minutes). A change to a file full of backticks goes through the Edit tool or a script file, never through `sed`. Keep each file's own line endings.
23. A Rust compile error kills the dev window. A backslash in a Rust test string is the usual cause.
24. Open choices go to the owner through the question tool, the recommended answer first. Ask only what has not been said.
25. A piece placed in the office is looked at in the picture of the real office, from all four sides, and nothing stands beside a doorway (a test checks it).
26. A page, a mockup or a button that people click is proven by clicking it in the real window. A test of its logic in Node proves only the logic: a form button that could not be sent passed every such test.
27. A form or the details of a card open in a dialog (a button or Esc closes it), never below a list or in a panel that squeezes the page. Everything pressed is Kona's `Button` or `IconButton` in the pixel frame; a chosen choice uses `on`. No flat box with an onClick, no `×` or `↺` character as an icon. A card shows only what is true now; the rest is in Edit.
28. The owner watches the dev window live, and every save reloads it. Save in an order that never leaves a reference to something not written yet (a missing component crashed the open page for a few seconds).

---

## How this file grows

The owner asked for this on 2026-11-02, so that every session ends up teaching the next one.

1. **At the start of a session:** read the benchmark above.
2. **As it happens:** when the owner corrects something, or a test or a real run shows a surprise, add a row to the section of the current session straight away. Summaries of a long session lose these details.
3. **Before a commit or a release, at the end of a session, or when the owner says "write the lessons":**
   - Run `node tests/owner-said.mjs` in `app/`. It prints everything the owner typed in the newest session on this PC. If the newest session is only today's short one, run it again with the path of the earlier session files (the biggest ones in `~/.claude/projects/d--kona-space/`), or the long session of the day before is never read.
   - Go down it. For each correction, each repeated request and each "why": is the lesson in the file? Add what is missing as a row: what was seen, the cause, the rule to keep.
   - Add your own mistakes too (a wrong guess, a wasted hour), not only the owner's corrections.
   - If a rule was broken twice, or would have saved real time, make it a line of the benchmark. Keep the benchmark short: replace a weaker line rather than letting it grow past about 25.
   - Correct what has turned out wrong in older sections; mark it instead of quietly deleting it.
4. Never write keys, passwords, addresses or e-mail addresses here.

---

## 1. Where everything is

| What | Where |
|---|---|
| The art scripts (cat, office, walls) | `art/` (read `art/README.md` first) |
| The office plan (rooms, doors, furniture, windows) | `app/src/office/standard.json` (the map), `docs/EDITOR.md` |
| The walls, drawn as one structure | `app/src/office/engine/walls.ts` |
| The cat in four looks | `art/cat.mjs` |
| Kibby, the office boy (his art, his route, his talk) | `art/kibby.mjs`, `app/src/lib/kibby.ts` (his route is the hall tiles of the map), `app/src/components/KibbyChat.tsx`, `app/src-tauri/src/kibby.rs` |
| Build the pictures | `cd art`, then `node build-cats.mjs`, `node to-app.mjs` (the cats). The office is drawn by the app: `node render-map.mjs` draws it to a picture |
| What the app reads | `app/src/office/` (`views/v0..v3.json`, `parts/*.png`, `cats.png`, `cats.json`) |
| The office on screen | `app/src/components/Office.tsx` |
| Set up a role (personality, job, model, permissions, skills, connectors) | `app/src/components/RoleSetup.tsx`, `app/src-tauri/src/roles.rs`, `skills.rs`, `session.rs` |
| Workflows | `app/src/components/Workflows.tsx`, `app/src-tauri/src/workflows.rs` |
| Tickets (the Board) | `app/src-tauri/src/tickets.rs`, `app/src/components/Board.tsx` |
| Updates | `app/src/lib/update.ts`, `app/src/components/UpdateCard.tsx` |
| Releasing | `docs/RELEASING.md`, `docs/VERSIONING.md` |
| The plan and the decisions (rows 49 to 54 are from this session) | `kona-space-app.md` |
| The skills that ship with Kona, and each person's starting tree | `app/src-tauri/skills/`, `default-tree.json`, `docs/SKILLS.md` |
| The Skills tab, the tree and the skill dialog | `app/src/components/SkillsTab.tsx`, `SkillTree.tsx`, `SkillEditor.tsx`, `app/src-tauri/src/skills.rs` |
| The "?" beside a heading | `app/src/components/Help.tsx` |
| The default office | `art/build-standard.mjs` makes `app/src/office/standard.json` |

Data on disk, per project: `<project>\.kona\role-kits.json` (skills and connectors per role), `.kona\skills\<name>\SKILL.md`, `.kona\role-plugins\` (built once per kit, pruned after 14 days), `.kona\workflows\<id>.json`, `.kona\brain\workflow-<id>.md`, `.kona\tickets\T-nnnn.md`. Per computer: `%APPDATA%\Kona\role-profiles.json` (personality, job, model, permissions), `%APPDATA%\Kona\skills` (the shelf of skills to copy from).

---

## 2. The office art

> **Changed in 0.26.0 (decision 57).** The office is no longer built by `art/office.mjs` and `art/walls.mjs`: it is a map drawn by the engine in `app/src/office/engine/`, with walls as full-tile blocks. Sections 2.1, 2.4, 2.5, 2.6 and 2.10 below describe the first pipeline and are kept as history. What still holds: the rules of 2.2 (tile, steps, 1/8 positions, plain seats), the idea of 2.3 (four sides from one drawing), the ordering rule of 2.5 (A before B when A lies wholly behind B along u or v, which `scene.ts` uses), the cat (2.8) and Kibby's look (2.9; he now walks the hall tiles of the map). Read `docs/EDITOR.md`.

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
- Each wall piece carries `hides` (the room it stands in front of). The app no longer uses it (the zoom into a room was removed in 0.24.0); it stays in the data.
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
- Looks: 0 down-left, 1 down-right, 2 up-left, 3 up-right. **Only two are drawn** (`TURNED` and `BEHIND` in `cat.mjs`); 1 and 3 are the whole frame mirrored (`Img.flipX()`), so the raised paw swaps sides with them. Look 0 is a three-quarter view: eyes, muzzle and belly turned left, light from the left so the right cheek and flank are in shade (`d`), a tail curling up on the right. Look 2 is from behind, the left cheek and the inside of the left ear showing. From behind there are no typing hands. (The cats held a role card until 2026-11-03; it was removed, decision 69.) Draw a change once, in one of the two, never in a mirrored one.
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
- **Bako, the second office boy (2026-11-03, decision 70):** the same shape as Kibby, drawn from the same rows (`art/bako.mjs` imports `front`, `behind`, `pose` and `WALK` from `kibby.mjs`; change the shape there and both follow). Colours: head and body `#1c110f`, stripes and apron `#fdd8ac` (the two colours the owner gave), eyes gold so they stand out on the dark head. His sheet `out/bako.png` has twelve frames: Kibby's seven with a broom, then `carryIdle` and `carryA` to `carryD` with a bento (red box, yellow band) in the paw. Look at the back views too: a paw must hold the broom and the bento from behind (the owner asked "where are his hands in this pose?"). His jobs are in `lib/bako.ts`: `sweep`, then `fetch` (a walk to the floor in front of a door of the map, found with a breadth-first walk over the walkable tiles), `pickup` (three seconds, the bento in his hand for the last one and a half), `bring` (to the floor beside a desk, behind the chair first) and `give` (two seconds, a smile). Every walk is of single steps on the walkable tiles, the same on every side of the building; `bako.test.ts` runs 120000 ticks and checks the order of the jobs, that he waits in front of a door, that he hands over beside the right desk, that it is a different worker each time and that two doors are picked by chance. His talk is `BAKO_PERSONA` in `kibby.rs`; the two share `KibbyChat.tsx` and the command `office_say`. Seen in the real window: him sweeping, the bento carried through rooms and seen from behind, his dialog, and his two bubbles ("Got it, thanks!" at the door, "Bento for (first name)!" at the desk). Not seen: a real conversation with him.
- **Two mistakes found by the owner right after (2026-11-03).** (1) On an errand he showed the standing picture for one tick at every tile, because the walk stopped on arrival and chose the next tile on the next tick; Kibby had been fixed for this in 0.27.1 and Bako was written without reading that test. Any new walker takes the "never still between two tiles" test along. (2) What a boy holds sticks out 6 to 12 pixels beside the body, and the drawing place (`kibbySlot`) only looked at the body, so the broom handle was hidden behind a shelf, a cabinet or a board standing behind him. A place for something that sticks out must look at the whole picture. The fix looks at the paw's side too (the left of the picture in looks 0 and 2, the right in 1 and 3) and uses a wider ground only where the body's own ground says nothing about a piece. A first try that widened the ground for every piece broke pieces that were right (1194 of 6248 places changed; the better rule changes 64): compare old and new places over every tile and side before trusting a change to the drawing order, and draw the few that change (an offline picture, old above and new below).
- **Turning the building is locked while the sheet is open** (the two buttons are disabled); close the sheet first. Kibby and the cats hold still then.

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

- `npx tsc --noEmit`, `npm test`, `npm run build`, `cargo test` (19 pass, 2 are manual), and the office tests (`npm test`) pass.
- Look at all four sides of the office and the screens that changed.
- (First run: 2026-10-30, 0.22.0, all passed.) Run the smoke test on the built program when your own Kona is closed: start the built program with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`, then `node tests/smoke.mjs` in `app/`. It changes nothing and starts no session.

---

## 7. What is still open

| Open | How to tackle it |
|---|---|
| Room layout on whole tiles | **Closed 2026-11-04.** The owner looked: it is fine now. |
| Cat looks | **Closed 2026-11-04** by the owner. The cats stay as drawn by script; a hand-drawn set is not wanted for now. |
| Font | Jersey 20 was tried on this PC only. If a letter looks wrong, send a crop; `docs/FONTS.md` says how to go back or make the text a little bigger. |
| Real window | Done once for 0.22.0 on 2026-10-30, with your Kona closed: all 19 smoke checks passed (welcome page, office, every place including Workflows, no content-policy blocks), and a short extra check showed the turn buttons change and remember the side, the Workflows screen has its three suggestions and its chart, and the top bar shows v0.22.0. Run it again after each release (section 6.3). |
| Workflow follow-ups | Looked at in the real window on 2026-11-04: Start, the tickets, the waiting steps that become Ready by themselves, Save and Delete all worked. That way of running a workflow has since been replaced (decision 78). The three follow-ups were never built; the owner replaced them with a new idea (a workflow that runs by itself and hands each result to the next person, with no tickets), see decision 78 of `kona-space-app.md`. |
| Kibby inside the rooms | **Closed 2026-11-04.** The owner says it is done. |
| Kibby's talk, measured | Measure the cost and the delay of a message, then decide on a longer memory or a saved talk. |
| Decor on every wall | **Closed 2026-11-04** by the owner. No more art boards. |
| Workflows and the Board in the office | A room may later show a "Workflows" tag of its own; today the Board room opens both. |

---

## 8. What was found in the session of 2026-10-31 (0.24.2 to 0.26.1)

Each line: what was seen, the cause, the rule to keep.

| Seen | Cause | Keep |
|---|---|---|
| Floor tiles looked odd, rugs hid the pattern | The floor was drawn tile by tile with its own rules | One picture of one tile per colour (33 x 17 px) with its grout on the rim, copied onto every tile; rugs removed (0.25.0 and 0.26.0) |
| A 1 to 2 px black gap along the open edge of the hall | A slab edge was counted as ground but not drawn | Every counted ground tile is drawn: a lip of hall floor |
| Floor shifted on turned sides | The tile sprite assumed the top corner | Use the highest of the four corners |
| Strange wall joints from some sides | Tall walls had a fixed early drawing place, so a low wall was painted over them | Every wall tile has a footprint and is ordered like furniture; windows, doors and boards are painted into the wall tile they hang on (`docs/EDITOR.md`) |
| Kibby walked one tile and stopped | Too many pauses and no preference for going straight | Straight on first, fewer pauses, and a test that the average run is more than 3 tiles |
| Kibby's eye blended with his forehead stripes | The stripes reached the eye | Stripes shortened (`art/kibby.mjs`, `STRIPES`) |
| Dots of one carpet on the hall tiles above it | `h >> 8` is signed in JavaScript: half the hashes gave a negative offset, so the dot moved up a tile | Use `>>>` for a hash; the test "the dots of a carpet stay on the carpet tile" checks all four sides |
| The editor's bottom had two lines at different heights | The picked-thing bar lived under the plan and the warnings under the preview, each with its own border | One full-width band under both: the picked thing left, the warnings right |
| "c" read as "o" in buttons | Pixelify Sans bold is nearly closed there | Jersey 20, weight 400 (`docs/FONTS.md`) |
| The smoke test failed with "welcome page" | The app was already in the project | The test now skips what is already done; it needs the map editor closed |
| A synthetic pointer capture threw and left a drag stuck | `setPointerCapture` needs a real pointer | try/catch around it |

Habits that paid off: look at all four sides before saying a wall or floor is fixed; find the general cause (an ordering rule, a number type) before touching a picture; write long patch scripts to a file with the Write tool, never a shell heredoc; keep each file's own line endings; never run the editor test on a project that has its own map.

### 8.1 Audit of old and unused files (2026-10-31, before 0.26.1)

Checked: every file of `app/src` against the imports from `main.tsx`, every export, every npm and Rust dependency, the tracked files outside the program, and the links in the notes.

- **Unused, still in the repo (not deleted, the owner decides):** `app/src/assets/frames/frame-paper-hover.png` and `frame-paper-pressed.png` (the big paper frame is only ever used in its normal look); the unused exports `STARTER_VERSION` (`lib/brain/starter.ts`), `TILE_W` (`engine/iso.ts`) and `SEE` (`engine/palette.ts`).
- **Old text, kept as history:** sections 2.1 to 2.9 of this file still describe the first pipeline (`office.mjs`, `walls.mjs`); they have a banner saying it was replaced in 0.26.0, and three rows of section 7 ("Room layout", "Kibby inside the rooms", "Decor on every wall") name the old scripts too. `docs/AUDIT.md` is the audit of 0.16.0.
- **Not a problem:** the 14 Brain starter notes (loaded by `import.meta.glob`), `typescript` (used by `npm run build`), `art/out` (the generated sheets and frames the app copies and the owner can redraw), no Rust warnings, no unused locals.
- **Big and safe to rebuild:** `app/src-tauri/target` is about 9.4 GB of build output (ignored by git). `cargo clean` frees it; the next build takes several minutes.

---

## 9. Roles as people (the talk of 2026-11-02)

What was found and decided, so it is not found again. Details: decisions 59 to 64 in `kona-space-app.md`; tickets T-0004 to T-0013.

- **Rooms were only used for clicking and for names.** Once a person is a cat you click, and a screen is a piece you click, nothing needs a room: rooms became decoration, the floor became a style (two colours and a pattern) from Kona's own palette, and every wall became one colour. The old per-room data still reads (it becomes styles with the same colours).
- **"Everything must be openable" is a rule of the map.** A person needs a desk and a screen needs a piece, or nothing can open it. So an office is refused on Save without them (`missingPieces`), and a saved office that lacks them gets them put back when it opens (`ensurePages`).
- **Kibby was easier than feared.** The drawing order for a walker (`kibbySlot`) already worked for any tile; free walking was one change to `Scene.walkable`.
- **A test was worth a few cents.** Whether Claude Code offers its question tool in Kona's mode was a guess until one Haiku session in a scratch folder showed it does (row 64).
- **Mistakes of the session.** A shell heredoc with quotes and backslashes broke twice; writing a script file with the Write tool and running it was reliable. Some files are CRLF (`App.tsx`, `sessions.ts`): a script that edits them must read and write the line endings as they are. `python -` in a shell waits for input forever on this PC: do not use it.
- **Not looked at, when this was written.** The real window. The pictures, the tests and the type checks were all done, but no one had seen the bubbles, the sheet, the editor's 3D button or the question card in Kona itself. The sheet and the editor have been seen since (section 10).

---

## 10. What was found in the session of 2026-11-02 (roles as people, the editor, the skills)

Each row: what was seen, the cause, the rule to keep. The strongest rows are in the benchmark at the top.

### 10.1 Working with the owner

| Seen | Cause | Keep |
|---|---|---|
| "I thought I already told you", about explanations on the page | The rule was in section 3.4 of this file and in the owner's taste notes, but new screens were built without reading them | Read the benchmark first. A rule stated once holds for every later screen |
| "Where is the b-tree skill graph????????" | My redesign of the Skills tab quietly dropped something agreed earlier | List what a screen has before replacing it |
| "The b-tree isn't actually a b-tree I actually need" | I guessed at the word twice: first a flat list called Tree, and only then real levels (job, branch, skill, files) | Show a small picture of what you understood before building |
| "I still can't get a comprehend" after each fix | I answered confusion with more words on the page. Three views also showed the same skills | One view you work in directly. Remove before adding |
| Three identical lines in one opened skill | The note was drafted from the description, so the title row, the description and the box all said the same | Look at the opened state. Do not store a copy of text that exists; only a change is kept as a note, which also stops paying tokens twice |
| "A hint should be the one already exist and save" | I emptied the box and added an example inside it | A box shows the real text, saves by itself and says "Saved" |
| "A new skill can't be like this" | The dialog treated a skill as one text file | Check what the thing really is (a folder) before drawing its form |
| "WHAT IS THIS?" about a line I wrote | I named `CLAUDE.md` as if the owner knew it | Explain a term the first time. Answer that first, then recommend |
| "We are still in discussion, so don't change anything" | The owner works in stages | Talk, then questions in a form, then plan mode, then tickets, then build, in that order, and only when told |
| "Summarize everything so we don't lose any detail" | Long talks lose detail, also through compaction | Write agreed things down at once: the Decisions table and tickets |
| "Why doesn't it use our own dropdown?" | I used a system `<select>` | Kona's own `Select` and `SmartSearch` everywhere |

### 10.2 Screens

| Seen | Cause | Keep |
|---|---|---|
| The plan was blank after See in 3D and Back | The draw effect did not depend on the view mode, and the canvas was new | Add `mode` to the effect's list. Try going there and back on anything that switches views |
| Icons not centred | Each icon sat by its own numbers | `path()` centres them automatically (`Icon.tsx`). Check at the real size |
| The search box was only 24 pixels high | Children of a scrolling flex column can shrink | `shrink-0` on them (`[&>*]:shrink-0`), then measure it |
| "Could not open the folder (os error 3)" in Skills | A project without a skills folder was treated as an error | A folder that is not there yet is an empty state in words |
| Bubbles overlapped in a crowded room | They were placed separately | Position in screen pixels and lift the later ones |
| Text being typed in a branch's line was wiped | The save comes back a moment later and reset the box | Do not overwrite a box that has the focus (`typing` ref in `SkillTree.tsx`) |
| "Add the 4 for Sen" could lose skills | A loop saved from a kit read once, so each save overwrote the last | Keep one action on the core side (`apply_default_tree`) rather than a loop of saves on the screen |
| A row's note in the pixel font was hard to read | Every button gets the pixel font | `font-sans tracking-normal` for long text inside a button |
| After giving a skill, the Files panel did not refresh | It only read on mount | `key={saves}` so it looks again |
| Closing the skill dialog would lose a lot of writing | Esc and a click outside just closed it, which was fine for a small form | A dialog that holds real work asks first |

### 10.3 The office

| Seen | Cause | Keep |
|---|---|---|
| A window landed between two walls, buried | "Nearest wall" with no thought of which side is free | Wall things go on a free side (`attachCells`, `sideFree`), with a live preview and a warning (`attachProblem`) |
| "Without any clue where it will land is kinda dumb" | No preview | Anything placed shows where it lands before the click |
| Doorways drew nothing in 3D, and wide gaps were dead data | The rule only knew a one-tile gap | A doorway is a gap of up to 4 floor tiles with a wall at each end (`doorwayAxis`, `engine/doorway.ts`); posts per gap, in plan and in 3D |
| Warnings on the standard office after that rule | Gaps run through floor tiles | `doorwayAxis` walks through floor tiles up to the limit |
| "Kibby buried in that post" | Doorway posts were not in his checks | Posts count as things he walks around (`scene.ts`), with a test |
| Kibby hitched back to idle at each tile | The walk ended at each tile and chose again | Keep walking when there is a next tile (`choose()` in `kibby.ts`). The old test counted stops, so it now counts tiles by position (`x % 8 == 4`) |
| A white strip with no depth, a drawer drawn wrong from one side, things beside a computer | Several parts of one piece painted in call order | `L.near(...)` orders them for the camera, in `furniture.ts`; look from all four sides |
| The default map made no sense as a place | It grew by small edits | It is generated by `art/build-standard.mjs`, and reads as one plan |
| "Kona does not know (voice booth)" on the real Norbit office | A saved office held pieces that had been retired | `parseMap` drops `RETIRED_KINDS` silently, with a test. Removing a kind always means old saves still open |
| A flow board looked like the standing chart, and close to the booth | Only the shape was different, and only from one side | Distinct from all sides; a test measures the colour distance |
| Screens with no sign they can be opened | Nothing marked them | A faint icon over each piece that opens a screen, which the owner liked |

### 10.4 Skills and Claude (real conversations, 2026-11-02)

| Seen | Cause | Keep |
|---|---|---|
| Sora used the skill but did not open its template | The skill only said "the template has both forms" | Each file is pointed at as an order: "Open `templates/x.md`". After the change it was opened. `cargo test` checks the wording |
| I warned that a colon in a description might stop Claude reading it | A guess: I had not tried it | Claude read it correctly. The rule stays as a caution, because the top of the file is meant to be YAML, but the warning was wrong. Test first |
| Choosing worked at once | A clear "Use when ..." line. Sora took `incident-response`, Kenn `support-reply`, with no permission card | Keep the "Use when" lines exact, with the words people really use |
| The session sees only that person's skills plus those inside Claude Code | `--setting-sources` and `--plugin-dir` work as planned | 40 skills in the folder cost nothing extra; about 280 to 500 tokens a person |
| The cost of a test | Four conversations on Sonnet came to about $0.39 by Kona's estimate; the first turn costs the most | A real test is cheap against a wrong guess. Say what it will cost first |
| The old skills were thin | 12 skills of about 150 words, one file each, and "a place to copy from" | Forty folders, written fresh, in the program, as the default for a new project. Details in `docs/SKILLS.md` |
| Licences | Only some GitHub skill collections say their licence clearly; many local skills state none | Read for ideas. Write fresh. Name the sources |
| A built-in copy nobody changed should follow Kona, one the owner changed should not | A plain copy cannot tell the two apart | A fingerprint of what Kona wrote (`.kona/builtin-skills.json`). Only an identical copy is replaced |
| Claude searched for a template with Glob before reading it | It works out the skill's folder first | Fine; it found it. Keep the paths relative to the skill |

### 10.5 Tools, testing and this PC

| Seen | Cause | Keep |
|---|---|---|
| The window test showed old skill text | `tauri dev` did not rebuild for a change in `skills/`, and `cargo test` builds a different program | `touch src/lib.rs`, wait, and compare `target/debug/app.exe`'s time with the file's |
| The window jumped back to the welcome page, and a script failed | A code change can reload the whole page | Scripts first check where the window is. Do not assume a screen stayed open |
| A test left a skill and a branch on Nokka in Norbit | I tested on the owner's project, and the reload stopped my script halfway | Use a throwaway project. If a real one is used, restore it at once and say so |
| A button was not found by its text | Its text includes the hint under it ("+ TemplateA form to fill in") | Match with `startsWith`, or use `aria-label` |
| Rust did not compile, and the dev window died | `"..\evil"` in a test string | `../evil`, or `\\`; use the Edit tool for such lines |
| A heredoc with quotes and backslashes broke, and `python -` hung twice | Shell quoting | Write the script with the Write tool, then run it |
| `App.tsx` would not match a multi-line replace | CRLF | Read and keep each file's own line endings |
| "t?.closest is not a function" in a test | My made-up window events, not a real bug | Use `Input.dispatchMouseEvent`, and do not chase errors the test itself caused |
| Removing a temp file with a relative path was refused by a safety check | It resolved to the root of the drive | Keep temp files in the scratchpad, with full paths |
| A test held the first part of a server address, and decisions carried tomorrow's date | I wrote them from memory; the secret scan before the commit and `date` caught them | Before a commit, scan what is being added for addresses, keys and e-mail addresses, and take the date from the PC |
| `git rm` refused a file with changes | It had local changes | Look at the file first, then `git rm -qf` if it is meant to go |
| `gh` is not found in the shell | It is not on the PATH | `D:\toolchain\gh\bin`, or read the web page instead |

### 10.6 Checked on the built 0.27.0 at the end of the session (real window, throwaway project, Haiku)

| Checked | Result |
|---|---|
| Bubbles | Working, Questioning and Finish show over the cat, and Finish goes once the chat is read |
| Voice | Setting Bahasa Indonesia gave replies in Indonesian |
| One thing at a time | A second start is refused by the core, and Start on the Board says the person is busy |
| Question card | The card appears, the pick goes back, Claude answers with it |
| Save in the editor | Erasing a desk makes Save refuse and say why, Undo clears it, a moved desk saves and survives a reload, and Default map asks first and removes the file |
| The update | The installed Kona became 0.27.0 and restarted. How it was started (the card or the installer) was not confirmed |

Also found: the smoke test still clicked rooms that no longer exist, so it had been failing unnoticed since people became clickable. Rewritten; `tests/editor.mjs` still has the old labels and has not been updated. **Run the smoke test after changing how things are clicked, not only at a release.** And the dialog behind "Default map" still said "standard office", so a word change must be searched for everywhere it appears.

I told the owner that Norbit has a saved office to back up. It has none (`.kona/office-map.json` is not there). Look at the disk before warning about it.

Real touchpad gestures (two fingers, pinch): the owner tried them and they work.

Still not checked: the skills nobody has picked yet in a real conversation (29 of the 40).

### 10.7 All eleven people, one real job each (built 0.27.0, throwaway project, Sonnet)

Each chose the skill below by itself. "Opened" means it also opened a file beside SKILL.md.

| Person | The job | Skill chosen | Opened |
|---|---|---|---|
| Kiki | A vague loyalty idea | `shape-an-idea`, then asked one question on a card | Not yet (the template comes at the end) |
| Nokka | A checkout page | `design-a-screen` | `references/states.md` |
| Jiro | A real bug in a real file | `find-root-cause`, then fixed the cause | It has one file, for when stuck; not needed |
| Kit | An API for partners | `design-an-api` | `templates/contract.md` |
| Sen | What to test before shipping | `test-plan` | Both of its files |
| Bejo | Picture uploads, not built yet | `threat-model` | `references/ways-to-attack.md` |
| Yuzu | Words for a landing page | `landing-copy` | It has no other file |
| Nobo | A page to be found on Google | `seo-brief` | `templates/brief.md` |
| Kupa | A broken Pay button | `route-the-work`, then showed three tickets first and raised none yet, as the skill says | `references/the-people.md` |
| Sora, Kenn | Section 10.4 | `incident-response`, `support-reply` | Their templates |

- **The one miss teaches something.** Asked "how would you go about it?" in an empty folder, Jiro answered from his own head and took no skill. Given a real bug in a real file, he took the skill. Test with a real job, not a question about a job.
- **Being honest held up.** When Jiro was refused a command, he said he had not clicked the button and told the owner how to check. Kiki's plan-only mode did not get in the way of skills.
- **Test scripts must be strict.** A card for a web search was allowed by accident, because the script matched words elsewhere on the page. It did no harm here, but read only the card's own text before allowing anything.

## 11. What was found in the session of 2026-11-02 to 2026-11-03 (0.27.1: the chat box, the Brain, the shaking map)

| Seen | Cause | Keep |
|---|---|---|
| The office behind a person's sheet shook, but only for a person who already had a chat (Kupa yes, Kenn no) | The chat scrolled to its end with `scrollIntoView`, which also scrolls every box around it, including the one that holds the office, while the sheet slides in | Scroll the box itself (`scrollTop = scrollHeight`), never `scrollIntoView`, inside a sheet. When something moves only in one case, compare it with the case where it does not: the difference is the cause |
| From a screen recording I listed six "problems"; the owner said four of them were decisions or not a problem (the sheet covering most of the window, the repeated titles, small text) | I judged a layout from the pictures only. The sheet's size is on purpose, and a comment in the code says so | Before calling a layout wrong, read the code that makes it. Say how sure each point is. Show the owner a short list and let them mark what matters |
| Of the six, only the Brain header was a real problem: it used 600 of 1080 pixels before any content | The page had its own heading, counts, checkbox, question box and tabs stacked, below a sheet title bar that already said "Brain" | The Brain's tabs live in the sheet's title bar like a person's. The page's own heading is dropped when the title bar says it. Tabs in a sheet cannot show counts, because the sheet does not know the page's data |
| Names on the Brain map sat on top of each other (two long names on dots side by side) | The name was always put under the dot, with no look at its neighbours | `lib/brain/labels.ts` tries under, above, right and left and leaves a name off if it fits nowhere. It is a plain function so a test can run it on the real starter notes (`labels.test.ts`) |
| The message box showed two lines for a long message | A fixed `rows={2}` | It grows from two to six lines, then scrolls (48, 72 ... 144 px, measured in the real window). It measures again when its width changes, because a hidden tab measures zero |
| The smoke test failed once on "the map is drawn at a whole number of screen pixels" and passed on the next run with nothing changed | The check ran right after the window loaded, before the office settled (the numbers read back were exact a minute later) | Run a failing smoke check again before blaming the last change, and say that it was flaky |
| A command that read a script from standard input (`python -I -`) waited for two minutes | It was left in by mistake, with a file written below it | Benchmark line 22 again: write the script with the Write tool, then run the file |
| Listing the running programs with PowerShell was refused by the permission check | It is a broad command | To stop what Claude started, use what the program offers: the test window closes over its own debug connection (`Browser.close`), and `tauri dev` takes its helper with it. Then check with `tasklist` that nothing is left |

**The throwaway project worked as written (benchmark 18):** a folder in the scratch directory, the project list saved to a copy, swapped for one entry, restored after, `cmp` showing the file identical, the folder deleted, no Claude transcripts (the smoke test starts no session).

**Checked by the owner, not by Claude:** after trying the dev window the owner said it was good. Claude did not run a real chat to see the shaking gone (it needs a running session), and did not see the Brain map with a project's own notes and Claude's memory (the throwaway project has only the 14 starter notes).

### 11.1 The file reader (2026-11-03: tables, diagrams, checklists)

| Seen | Cause | Keep |
|---|---|---|
| A method called `declare` stopped every test from loading | `declare` is a TypeScript word, and Node strips types itself, without a compiler | Files that tests load (`lib/`) avoid TypeScript-only words and shortcuts (`constructor(private x)`). `npx tsc` alone does not catch it, `npm test` does |
| An edit made through a Python script turned `\r` and `\n` into real line breaks inside the code | The quotes of the shell and of Python each ate a backslash | Benchmark line 22 again: for a line with backslashes use the Edit tool, not a script |
| A command with `python3 -I -` waited for two minutes | A leftover reading from standard input | Benchmark line 22 a third time |
| Chrome's extension was not connected, so the screen could not be looked at | Nothing | Edge is on this PC: start it headless with a debug port, drive it with a copy of `tests/cdp.mjs` pointed at the right tab, on a throwaway Vite port (`npx vite --port 5199`). Stop both and delete the test page after |
| Numbered items kept counting across a bullet | The counter went up for bullets too | A bullet resets the count at its depth |
| A new row for the Decisions table went to the end of the note | The anchor I edited at ("---" and "End of note") is the end of the file, not the end of the table | Add a table row next to the row before it (search for `\| 67 \|`), and look at the lines around it after |
| The Files place could be checked in a browser although it needs Tauri | Its only link to Tauri is `invoke`, and `window.__TAURI_INTERNALS__.invoke` can be replaced by a pretend folder | For a screen that reads files: a temporary page that fakes `list_dir` and `read_file`, driven over the debug port; delete it after (done for 0.28: links, back, find, outline, polling) |
| A link in a sentence was drawn in the interface font with wide spacing | The global rule for `button` is outside Tailwind's layers, so a `font-sans` class loses to it | A button that must look like text sets its font in `style`, not in a class |
| A label on a left-to-right arrow hid the arrow | The gap between boxes was fixed, the label was wider | Along the flow the gap is the longest label plus room |
| `cargo test mcp:: brain_search::` was refused | `cargo test` takes one name | `cargo test --lib` runs them all (about the same cost) |
| Sessions "did not know where to put" lasting knowledge | The only hint was a line about searching; nothing said how to save, and the only place an agent knows is CLAUDE.md | Kona's own rules for sessions live in the program's prompt (`session.rs`), never in a project's CLAUDE.md, so an update fixes them for everyone. The prompt says to follow them over an older CLAUDE.md and never to copy them into one. Keep both paragraphs short: every session pays for them (about 400 tokens) |
| Norbit's CLAUDE.md had nothing about Kona, only the "not Miralis" rules | It was written before the Brain tools existed | A project's CLAUDE.md carries only what is true of that project. It got a short "Where things go" section saying so (2026-11-03) |

## 12. What was found in the session of 2026-11-03 (0.30.0: the memory of a chat, links, numbering, the zoom)

| Seen | Cause | Keep |
|---|---|---|
| A numbered list in a reply showed 1, 1, 1 | The reader ended a list at a blank line, so each item was a list of its own and counted from 1 | A blank line between two items does not end a list; a list starts at the number its first item carries. Test with the shape of a real reply (items with blank lines between), not with a tight list |
| A link to a web page could not be opened | It had been drawn as plain text on purpose, "so it cannot take the window away from Kona" | A link that does nothing is a dead end (benchmark 11). The risk was solved by opening the owner's browser, not by doing nothing. Only http and https open |
| The first zoom step of the map jumped to twice the size | Whole-number zoom steps (1, 2, 3...) keep the pixel art sharp, and 1 to 2 is a doubling | The size glides for 0.2 seconds and settles on a whole number; the point under the pointer stays put. The rule of whole numbers stays |
| "One message uses 1% of the session" | Not a fault. A prompt is about three steps (calls), and every step re-reads the whole chat from the cache. 63 steps at 245k tokens read 8.4 million tokens | Count steps, not prompts. Kona's sessions start at about 25k tokens against about 50-60k in the VS Code extension and have no cache misses; the long ones simply grow. A usage question is answered from the transcripts (`usage` fields only), not from the code |
| I said extension chats are usually fresh and short, and that it warns before compacting | A guess | The transcripts showed the opposite (up to 950 steps, 709k tokens, 2 to 6 compactions each). Check a claim about how something is used before saying it, and correct it in the next message |
| `/compact` works through Kona's own stream-json mode | Tested in a throwaway folder with Haiku, then in a real session (181k tokens, Sonnet) | Claude Code sends `system` / `compact_boundary` with `pre_tokens` and `post_tokens` and then an empty, successful `result`. `post_tokens` leaves out Claude Code's own start (about 18k), so the screen waits for the next reply to show the real size. The four messages of the real test (one of 181k tokens, one compaction) moved the session bar from 33 to 37 percent |
| `npm run tauri dev` failed: "Port 1420 is already in use" | A Vite server was already running (the owner's) | Run `src-tauri/target/debug/app.exe` itself with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`; the debug program loads the running Vite server, so edits show at once. Its Rust is the last build (it says 0.28.0 and offers the update card: do not click it) |
| A temporary dev route in `App.tsx` left the file with joined lines | The edit began with a line break and the file has CRLF endings | Test pages go in their own `probe.html` and `src/probe.tsx` (Vite serves them), deleted after. If a file is damaged, `git checkout` it when it holds no real change |
| `window.__TAURI_INTERNALS__.invoke` could not be replaced to catch the opener's call | The property is read-only | Click for real and look for an error (none), or fake the folder with a temporary page. The browser opening was not seen |
| `add_project` said "That folder does not exist" for a folder that exists | My commands lose a backslash: `"D:\\temp"` arrived as `D:<tab>emp` | Build a path with a backslash in code (`String.fromCharCode(92)`) or use forward slashes. The same cut `"D:\\x"` in a test page |
| The throwaway project stayed in the owner's project list | My script failed on a line break inside a string, and the next command closed the window before `remove_project` ran | Remove the throwaway in a `finally` before closing the window, then list the projects to see only the owner's are left. It was removed after restarting the window |
| `python -` waited for standard input again, and stopping it by killing every python program was refused | The fourth time (benchmark 22); a wide kill is not allowed | Write the script with the Write tool, run the file. To stop my own background command use `TaskStop` on its id |

**Left behind by the real test (not deleted, say so):** the folder `D:\temp\kona-e2e-project` with its `.kona`, one transcript of the throwaway session under the Miralis account, and its rows in the cost ledger.

**Not seen:** the browser opening after a click on a web link; a compaction in the built (release) program; the memory line in a chat that is resumed (its size is unknown until the first reply).

## 13. What was found in the session of 2026-11-03, later (the picture zoom, the page that lost its pictures, Auto)

| Seen | Cause | Keep |
|---|---|---|
| An .html file showed no picture in the reader, but did in the browser | The reader only fetched `<img src>` and style sheets. This page (a mock-up) draws its pictures as backgrounds in `style="...url(../screenshots/x.png)..."`, so they were never read | A page names its files in more places than `<img>`: look at `url(...)` in style attributes, style blocks and style sheets too. Test with the owner's real file, not a made-up one. A picture used by many `url()`s is written once as a CSS variable (a page cut in seven strips would carry seven copies) |
| A page that began with a huge style block could show wrong letters | The `charset` tag must sit in the first 1024 bytes, and the written-once picture pushed it far past that | The page is given to the frame with `charset=utf-8` in its type, so it never depends on where the tag sits |
| Auto was asked for as "why is it missing?" | Section 1146 of the plan had noted that in Auto the approval card may never appear, and a test asserted that `auto` is refused | It was tested in a throwaway folder with Kona's own flags: Write and Bash ran with no card, and a rule that says "ask" (the server check) still raised a card. So Auto is offered, and the old test now refuses `dontAsk` instead. Not tested: an account or model that Claude Code does not allow Auto for |
| A button that ends something looked like all the others | `IconButton` defaults to the paper look | Ending is red (`danger`), starting or resuming is the accent (`primary`). The look of a button says what it does |
| A ticket card turned into pixel letters when it became a real `<button>` | Every button is drawn in the pixel font by a rule outside the style layers, so a class like `font-sans` loses to it | Text that is to be read inside a button gets an inline `style` with `var(--font-sans)` and normal letter spacing (as the links in replies do). Look at the screen after turning a div into a button, not only at the click |
| The test page showed `é` as black diamonds | The test file itself had been written in the PC's old encoding, not UTF-8 | Write test files with an explicit UTF-8 encoding, and read the screenshot before blaming the program |
| Ctrl and the wheel did nothing over an html page | Wheel events inside a frame never reach the page that holds it | The frame is read from Kona with `allow-same-origin` (never with `allow-scripts`), and Kona puts the wheel listener on the page's own window. A real page with `onload`, `onerror` and `<script>` was tried: none of it ran |
| After End session the chat is not in History, so Resume is not there yet | An ended chat stays in the Chat tab until New conversation (built so on purpose) | Kept as it is (owner's word, 2026-11-03). The test presses New conversation first |
| Test leftovers | A throwaway project, its Claude transcripts, Jiro set to Auto on Haiku, and a test copy of the program | All of it put back: project removed, folder and transcripts deleted, the roles file restored from a copy, the test program stopped. The cost ledger keeps one small Haiku row (about 0.2 cents) |
| "Show the text" sat lower than the words beside it | Turning a 20 px text link into a 32 px `Button` inside a row that lines its items up from the top | Where a `tiny` Button sits in a line of text, the row centres its items and the button takes a negative margin so the line keeps its height. Better still: view switches live in the title row with Find and the zoom, not in a line of facts |
| The file info row was three facts nobody acts on | Path, size and date were always on the page, a row of vertical space in a short window | The facts moved into a dialog behind an info icon (with Copy path and Show in Explorer), and the name shows the path on hover. A read-only fact that no one needs at every glance does not need a row |
| The slide sheet left a strip of office above it | It was set 88 px below the top bar so the office buttons stayed visible | The sheet starts at the top bar (owner's word, 2026-11-03). A page that covers the office has no use for office buttons |

## 14. What was found in the session of 2026-11-04 (0.32.0: the mockup previewer)

What the owner said is printed by `node tests/owner-said.mjs` in `app/`. The decisions are rows 74 to 76 of `kona-space-app.md`; the tickets are T-0014 to T-0027.

### 14.1 Working with the owner

| Seen | Cause | Keep |
|---|---|---|
| I said the mockup previewer would overlap the file reader, and proposed a "Run" button in the reader | It sounded like "an html page opens in a frame", so I filed it under the reader. The owner meant a sheet of its own, with its own piece of furniture and purpose, for the app's own mockups in device frames | Before saying a new idea overlaps something that exists, say what you think it is for and what it would show, and ask. A new place is not a mode of an old one |
| A research copy (a public page kept only for investigation) was taken as the case for reversing a live site | The owner meant the project's own sites, and said "just look at the file" | When the owner points at a project, open it and read it before arguing, and say which example is which |
| The landing page and the LMS were taken for two sites with no connection, so I invented a layer of cards | I read an "under construction" page and a link I had not found as "no link". The owner said the link is only hidden for now | A link missing in the code is not a link missing in the plan. Check again, or ask, before building a structure on it. The cards stayed, but one card is one mockup, and its pages link to each other |
| "Use AskUser for this" | Three open choices in a text list are easy to skip or to answer in half | Open choices go through the question tool: the recommended answer first, each with a plain description. Ask only what the owner has not already said |
| "Critical" screen sizes: the owner pointed at a note in the Norbit project to say what the word means | I would have guessed a list of device widths | When a word is defined in the owner's own project, read that first. The list (320, 390, 768, 1024, 1440) came from there, and from what broke in it |
| The owner dropped a tool's screenshots and said "the frames should have been made by us" | Copying another tool's art or text is not an option here (benchmark 20) | The frames are drawn by script in `art/build-devices.mjs`, in Kona's own look. Ideas from other repositories (the calculation rules of a drawing skill) are taken as ideas and written fresh |
| "Why don't you tested it?" after a list of things not tested | Several of them took a minute: a very large file, another drive, what the command message really is (benchmark 16 broken again). One was wrong: I wrote that another drive was covered, but this PC's temp folder is on the same drive as Kona | A "not tested" list holds only what cannot be tested here. Before saying a test covered a case, look at the real condition (print the path, the drive, the number) |
| The big screen stood in front of the doorway to the hall; the owner saw it in a screenshot | I placed it by tile numbers; `checkMap` does not look at the tiles beside a doorway | A test now fails when anything stands next to a doorway (and I checked that it fails on the old place). After placing a piece, look at the picture of the real office, not only at the checks |

### 14.2 The previewer and its sandbox

| Seen | Cause | Keep |
|---|---|---|
| A page in the sandboxed frame has `__TAURI_INTERNALS__` and `ipc` | WebView2 injects them into every frame | A real `invoke` from the frame was seen leaving the frame and doing nothing (no project added). Check every command's own input; never rely on that |
| My first rule against reading another card did not work | It needed the `Referer` header, and WebView2 sends none for a page's own requests (only `Origin: null`) | A protection is a protection only after a test shows it holds. It was removed; the limit is written down (a page can read another card of its own project by its exact address, and has no way to send it anywhere) |
| Windows hands the mock handler `mock://localhost/...` though the page uses `http://mock.localhost/...` | wry maps one to the other | Read the path only; never test the host of the request |
| A test of the content policy needs a built program | `devCsp` is null, so the policy is not applied in `tauri dev` | `npm run tauri build -- --debug --no-bundle` (about a minute) applies the real policy; a release build with LTO adds nothing for this |
| The page saw 569 for 568 and 769 for 768 | This PC's display is scaled to 120 percent. The page's viewport is a whole number of SCREEN pixels, and a frame that does not start and end on screen pixels is a pixel off either way | The frame sits on whole screen pixels and is sized just under the pixels it needs (`phys` in `Mockups.tsx`). The page then sees the device's size or at most two screen pixels more, never less, so `min-width` breakpoints such as 768 apply; at 100 or 200 percent it is exact. A `max-width: 768px` rule does not apply at 768 on a fractional scale. The test says so and checks it |
| Esc inside the page closed the whole sheet instead of going back | A key event made by hand on `window` closed the sheet although my listener was a capture listener (seen); the sheet's own listener evidently ran first for an event that starts at `window` | Do not make a key event to reach your own handler: call the handler. The real Esc still goes through a capture listener (and not while a dialog is open) |
| The page cannot be told the theme from outside | It has an opaque origin: the window cannot reach into it | Kona puts a small helper into every page it serves (`HELPER` in `mock.rs`): the theme (first from the address, then by a message), Ctrl and the wheel, Esc, "ready". `prefers-color-scheme` inside the frame follows the frame's `color-scheme` (seen) |
| The window's own zoom of a page (a 100/scale trick) would have laid the page out at another width | A page must be laid out at the device's size and then scaled, or `vh` and media queries follow the window | The frame is exactly the device's CSS size and only a `transform: scale` shrinks it |
| Device frames at a fixed size, and the screen scales | Pixel art must not be stretched | A 9-slice for `border-image` at 2 CSS pixels per art pixel; the bezel keeps its size, only the screen scales. A laptop's base is a 3-slice with the middle filled |

### 14.3 Tools, testing and this PC

| Seen | Cause | Keep |
|---|---|---|
| A test opened the owner's real project (Norbit) in my test window, twice | It picked "the nearest part that holds the name", which matched the list around all the cards, so it clicked the first Open | Nothing was written (checked by file times), but it must not happen (benchmark 18). A test that clicks must pick by an exact, unique match and then check that the throwaway project is the one open (its name in the top bar) |
| The tests of the sheet need the real window | The sheet cannot be reached until the furniture is there | `tests/mockups.mjs` (the sheet) and `tests/mock-sandbox.mjs` (the sandbox) drive a built program over the debug port, with the owner's own Kona closed, on a throwaway project they add and remove |
| A PowerShell command with `$` run from Git Bash lost its variables | Bash expands `$o` before PowerShell sees it | Write a `.ps1` file with the Write tool and run it (benchmark 22) |
| The build failed on a function with the same name as mine | `project_folder` already existed in `lib.rs` | Search for a name before adding it to a big file |
| The owner's screen recording was a good test video | H.264 with AAC, 1080p, 19.5 s, 20.7 MB, its index at the END of the file, so the browser reads the end first (a range request) | Its path is given to the test by `MOCK_TEST_VIDEO`; the file is copied into the throwaway project and deleted with it, never changed and never kept in the repo |
| A release build is about 6 minutes and leaves little free memory; a debug build with the real policy is about a minute | LTO and one code unit in the release profile | Say the cost first. Use the debug build for tests of the window; the release build is for the release |

## 15. What was found in the session of 2026-11-04, later (0.33.0: the three mockup skills, the window)

What the owner said is printed by `node tests/owner-said.mjs` in `app/`. The tickets are T-0019 to T-0023; decisions 66, 75, 76 and 77 of `kona-space-app.md`.

| Seen | Cause | Keep |
|---|---|---|
| The Sign in button of a mockup did nothing, with no error, in the Mockups sheet. The first starter page and the first reversed card both had it. Tests in Node of the fake API had passed | A mockup runs where a form cannot be sent, so the browser never fires the form's `submit` event. A button that relies on it is dead. Proven by contrast: the same click worked on a `type="button"` version | A page people click is proven by clicking it in the real sheet (benchmark 26). The rule is now in `make-a-mockup` (plain button, click handler, Enter by hand); a second run of `reverse-a-mockup` followed it by itself |
| My own clicks in the sheet missed their targets for an hour | I took the screenshot's pixels for the window's pixels. The scale between them was 1.2, not 1.25 | Calibrate before clicking: the page can print the click it got (a temporary line that adds the clicked tag to the page). Take it out afterwards |
| A session in a ticket copy was refused the owner's mockups, and also the template files of its own skills | Git does not track `.kona`, so the copy has no `.kona`; the mockups and the person's skill files are in the main folder | The session gets two read rules (`copy_read_rules` in `tickets.rs`), not `--add-dir`: with `--add-dir` a session could also write into the mockups (a file was made there). Rule syntax on Windows: forward slashes, `Read(D:/folder/**)` |
| The same test on a Windows path: `Read(//D:/...)` was refused, `Read(D:/...)` and `Read(//d/...)` worked | Claude Code reads the rule as a path; a double slash then a drive with a colon is not one | Try the rule in a session before relying on it, and keep the form that worked in the test next to the code |
| A Rust test failed to compile after I wrote a string with a backslash through a shell heredoc | The shell halved the backslashes (benchmark 22 and 23, again) | Write Rust with the editor tool, never through a heredoc |
| A stray `python -` waited for input for ten minutes | The command line read standard input | Benchmark 22 says it: never `python -`. Use the file tools |
| Haiku built a real page from a mockup in about 3 cents: it read the card from the main folder, mapped every code to the project's own token, kept the parts, swapped the fake API for the real client, wrote tests first, committed, and listed what differed | The skill said what to read, what to map and what to hand over | A small cheap model is enough to prove a skill, and it shows where the words are unclear. Read what it hands over as a report to check, not as proof |
| The permission check refused my script that sent restore and maximise messages to the window | It looked like driving another program | I did not look for another way round it. The owner tried the window by hand: "the view is good" |
| The window restore rule is half the screen's usable width and height, centred; Kona opens full screen at an 80 percent view; the saved percent of older installs is dropped once | Owner's word of 2026-11-04 | Decision 77. The stored percent was always 100 because every start saved it, so a one-time reset (`kona.zoom.v2`) was the only way to give older installs the new default |

**Left behind by the tests:** nothing. An empty folder `D--temp-kona-e2e-project` in `.claude\projects` (from 2026-10-30, holding only an empty `memory` folder that Claude Code makes by itself) was looked at, judged safe and removed on 2026-11-04. Everything this session made was removed: the throwaway project and its folder, the test copy of the program was closed, and no transcripts exist (the test sessions ran with `--no-session-persistence`).

**Not seen:** a session started from the Kona window with the new read rules (the card path), Jiro building from a card that Nokka made, and the pages opened on a screen with a different display scale.

---

## 16. What was found in the session of 2026-11-04, last (0.34.0: pick mode, Send, SQLite)

The tickets are T-0024 to T-0027; decisions 75 and 76 of `kona-space-app.md`.

| Seen | Cause | Keep |
|---|---|---|
| A test meant to make the model call fail made a REAL Haiku call and then waited on it | The window's `invoke` is read-only (`__TAURI_INTERNALS__.invoke` is not writable), so my stub was silently ignored, and the page took the real path | Before a test relies on a stub, read it back (`Object.getOwnPropertyDescriptor`). A test that could spend money runs only behind an explicit switch (`MOCK_TEST_SEND=1`) and after the owner's word, as the ticket said. I told the owner afterwards; it was one cheap call |
| The pick helper stopped working after a page replaced its whole document | `document.open()` erases the listeners of the page's window, and the helper's overlay was in the old document | The helper keeps its listeners in a table, puts them back after `document.open` (it wraps `Document.prototype.open`) and says `ready` again, so the sheet sends pick mode and the pins once more. Seen in the real window with a page that calls `document.open` |
| The SQLite files would not go into a skill folder | The skills table is made of text files (`include_str!`), a skill folder is one level deep, and a test wants every file named by an order to "open" it | The WebAssembly program is written as one base64 line in a `.js` file and the four files sit flat in `templates/` with a `sqlite-` prefix; the skill says to copy them under their short names. A binary file in a skill needs a change to `build.rs` first |
| Haiku followed the SQLite skill, used `openDb`, `db.all` and `db.run` correctly, plain buttons and `keydown`, but could not copy the three big files | Claude Code asks before a shell command that reads outside the working folder, and a non-interactive run has nobody to ask | The skill says to ask, to copy one file at a time, and never to write the big file by hand. Not seen: the copy approved in a real Kona session |
| A regular expression written through a shell heredoc lost its backslash (`[\d.]` became `[d.]`) and the test kept failing for the wrong reason | Benchmark 22 again | Write test files with the file tools; when a check fails, print what it was checking before blaming the page |
| The real Haiku draft was good | One call (a few hundred tokens): it named each part, its page and the measured width, and wrote a "done when" for each pin, without inventing a colour | The fixed instruction that nothing may be invented, plus the facts as JSON, is enough. The program itself writes the line that says where the mockup is, so that line cannot be wrong |

**Left behind by the tests:** nothing. The throwaway projects and their folders were removed by the tests; the test copy of the program was closed; the Haiku proof sessions ran with `--no-session-persistence` in a folder of the scratchpad.

**Not seen:** after a real Send, the session of the design person on the ticket (the test stopped at the ticket check, which had a wrong word in it: the ticket says "the owner", not "owner"), a draft that Haiku gets wrong, a card made through the SQLite skill and then opened in the sheet, and the pins at other display scales.

---

## 17. What was found in the session of 2026-11-04, after 0.34.0 (the meeting room, 0.35.0)

The owner asked for two things: close the old open items, and make a workflow run by itself like real people handing work on, with a meeting room and a group chat. Decision 78 of `kona-space-app.md`.

| Seen | Cause | Keep |
|---|---|---|
| The owner marked four open items closed and asked "WHAT?" about the cats and the art boards | I had listed them as open work, but they are only looks and nobody asked for them | Say in one plain line what an item is and whether it needs doing at all before putting it in a list of what is left |
| "Workflow follow-ups: NOT TESTED IN REAL USAGE" did not mean what I first thought: the three follow-ups were never built | The note listed them as "Left" and the owner read it as "built but unproven" | Before testing something named in a note, look at the code: is it there? I tested what existed (tickets, the chain that becomes Ready) and said plainly the three were not built |
| A line on the old workflow chart runs behind two boxes (a step that skips a column) | The curve goes straight from the earlier step to the later one | Seen in the real window. Not fixed: the chart is the plan editor now, and a wrong line there is only looks. Fix it if it gets in the way |
| The owner changed a half-built request twice in one session (tickets out, a meeting room in, a group chat) | The idea grew while I built | When a new idea replaces a screen, stop, list what the old one had, show the picture of what I understood and ask the few choices that change the work (the questions tool, recommended first). Done here: branches, tickets, safety, room, chat, voice, chairs |
| A new piece of furniture needed five things at once: the catalog kind, the standard office script, the editor's put-back for saved offices, the thumbnail and the tests that every screen has one piece | A piece that opens a screen is wired in many places | Add the kind first (`engine/furniture.ts`), then the standard map (`art/build-standard.mjs`), then run `npm test` and read every failure; look at all four sides with `render-map.mjs` (`SEATED=all` and `CROP=left,top,width,height` were added to it) |
| A cat on a chair needed no new drawing | The cat of a desk is already drawn from a place and a direction; the chair's place and facing give the same | `seatCat` in `furniture.ts`: a desk without its cat, a cat on a chair, both from the same scene; a seated cat has its own click area |
| The Run test cannot be done with the window alone | A real run starts real sessions and spends plan | `tests/meeting-live.mjs` writes finished-looking run files and reads the chat (free, passed). `tests/meeting-run.mjs` is the real run, only with `MOCK_TEST_RUN=1` and the owner's word |
| The smoke test failed on the place that was renamed | It clicks pages by their names | Search the tests for a name when it changes (benchmark: a word change must be searched for everywhere it appears) |

**Not seen yet:** a real run (the hand-over between two live sessions, the cats on the chairs, the owner's note to a person whose turn has not come, a permission card answered in the chat). `tests/meeting-run.mjs` is written for it and waits for the owner's word.

## 18. What was found in the session of 2026-11-04, after 0.35.0 (the fingerprint that could not be read)

| Seen | Cause | Keep |
|---|---|---|
| "Read the fingerprint" said "did not answer with a host key", yet `ssh-keyscan` worked in Git Bash | Git Bash puts Git's own OpenSSH (10.3) first on the PATH. A normal Windows program like Kona gets only `System32\OpenSSH` (9.5), whose `ssh-keyscan` fails against modern servers with `choose_kex: unsupported KEX method sntrup761x25519-sha512@openssh.com` | "It works in my terminal" proves the tool works, not that the copy Kona runs works. Run the exact program a plain Windows process would find (full path, the Machine and User PATH) before guessing |
| The real reason was never shown | The code read only the tool's output and threw away its exit code and its own complaint, then said "did not answer" for every failure | Whenever Kona runs a tool or opens a connection, a failure shows the real reason in plain words (refused, no answer in 8 seconds, no matching method, the tool's first complaint). One catch-all sentence hides the bug |
| The "Trust and save" button looked pressable when nothing had been read | A disabled button was only drawn at 55% opacity, still in its colour, and the dialog kept its busy title after the error | A disabled button is grey. A dialog that has nothing to confirm has only a Close button (`noConfirm` in `Confirm`) |
| Kona depended on a tool being on the PC | `ssh-keyscan` and `ssh-keygen` are not on every PC, and the Windows ones are old | What ships must work for anyone: the host key is read inside Kona (`ssh.rs`). Tests: a fake SSH server on this PC, plus `live_read_of_a_real_server` (ignored; set `KONA_TEST_SSH_HOST`; read-only) |
| My line-ending check said every file was CRLF, and my splice script wrote CRLF into a file that the repo keeps as LF | `grep -c $'\r'` in this shell has an empty pattern and counts every line | Check with `git ls-files --eol` (or node) and write LF in this repo; the benchmark's "keep each file's own line endings" starts with finding out what they are |
| The test that opens the throwaway project's card did nothing: `button.click()` on "Open" returned true and the welcome page stayed | The welcome card needs a real mouse press (the old `mockups.mjs` pattern no longer opens it) | `tests/servers-fingerprint.mjs` finds the card's button, then sends `Input.dispatchMouseEvent` (moved, pressed, released) at its centre. Use that when a plain click seems to do nothing |
| The refused-connection message ended with "?." in the first window test | Two pieces of code each added their own full stop | Seen in the picture, not in the unit tests. A unit test now pins the exact sentence, and the screen test checks it |
| The project's GitHub address sat in Settings and in Add a project, and nothing read it | It was saved and shown, and the plan listed it as part of a project, but no screen or session used it | Before keeping or adding a field, say what reads it. If nothing does, take it out (old files keep the value, unread) |
| The owner could not put the key setup into words ("two keys, one for the local machine, one for the server") | The real setup was already on this PC: one ssh config nickname per repo, a read-write key and a read-only key, and a setup note for the server | When a design depends on how the owner already works, read the real setup (remotes, ssh config entries, setup notes) before asking again, and report the pattern in plain words. Never copy key names, addresses or paths into Kona's folder |
| The repo test needed the sign-in status to have loaded before the project card's Open button did anything | Each welcome card asks whether its account is signed in; the button waits for the answer | `tests/servers-repo.mjs` waits for the words "signed in" on every card before pressing Open |
| The owner twice had to write "explain it in plain terms", after my answers about repo cards and about Turso | I wrote for a developer: nickname, alias, deploy key, beta, rewrite in Rust. The first plain version came only after the owner asked | Start every design talk with the plain version (keys as house keys, what changes for the owner, what does not), a small picture, and only then the details. Same as benchmark line 4: when words are not landing, take things away |
| "It still runs in here": the owner's phone showed a spinning circle and the sheet of a Bash command that had finished long before | The remote view opens the details of any earlier tool call, and its circle spins while a reply is being written. Nothing was running on the PC | When the owner says something still runs, check the real processes first, say what was found, then say what the thing on the screen means in plain words |
| The owner had to ask what the "2 running tasks" were, and to say "stop it first" | I started the dev window for a test and did not say when it would be closed. Stopping the background task did not stop the processes under it | When starting a window or a server for a test, say so and say when it will be closed. Stop it as soon as the test is done, and check the real processes, because stopping the task leaves the children running |
| "Keep the terminal to 0.36" was read as one release with the other changes; the owner meant the terminal alone | A version number was mentioned without saying which changes go in it, and I wrote my reading into decision 80 before it was confirmed | When a version number comes up, say back which changes go in which number and wait for a yes before writing it into the plan. Done here: decision 80 was corrected, and the other changes became 0.35.1 |

**Seen (2026-11-04):** the Servers screen in the real dev window, with the built-in reader. `tests/servers-fingerprint.mjs` (throwaway project, nothing saved, removed afterwards) read all three fingerprints of the real server in 1.3 seconds, showed "Is this the right server?" with Cancel and Trust and save, and for a closed port showed "Could not read the fingerprint", the reason, and only Close. 28 checks passed; the project list and every project's servers were as before. **Not seen:** a server that needs the `ssh-keyscan` second try, and the release build (only the dev window was used). **Repo cards (later the same day):** `tests/servers-repo.mjs` (47 checks, throwaway project, nothing saved, removed afterwards) passed in the dev window: the form, a bad repo refused, the card with its key lines and three copy buttons, the fingerprint read through the real address, the edit form, and no GitHub address box left in Settings or Add a project. Rust 75 tests, front end 182 tests. **Not seen:** the release build, and a card whose nickname exists in a real ssh config.

## 19. What was found in the session of 2026-11-05 (closing the board, bringing the notes up to date)

The owner closed the last ten tickets (T-0018 to T-0027), so all 27 are Done, and asked for the plan note and these lessons to be brought up to date before adjusting the meeting table. The earlier sessions (2026-11-04) were read with `tests/owner-said.mjs`: the 24 messages of the two big sessions were checked against sections 15 to 18 and decisions 77 to 80 (the 80 percent view, the end-to-end Haiku test, the leftover search, the two keys per repo, the terminal in its own version), and no correction was found that lacked a row.

| Seen | Cause | Keep |
|---|---|---|
| `kona-space-app.md` still said "Status: planning only. No code exists yet", "not a git repository" and had a "Next three actions" list from the first week, while the program was at 0.35.1 | Every release updated the Decisions table and `CHANGELOG.md`, but nobody updated the top of the note, the progress table (it stopped at 0.19.4) or section 14 | A release is not finished until the progress table, "Where things stand now" and section 14 are true. This is now step 0 of `docs/RELEASING.md` |
| The `next` line of T-0018 to T-0023 still read "Wait for T-0018" and "Owner says yes: commit, tag" after 0.32.0 and 0.33.0 were published, so the board looked as if nothing had shipped | The line was written when the ticket was raised and never touched again; the History at the bottom was kept up to date, the header was not | Trust the History of a ticket, not its `next` line. When a version ships, set the `next` line of every ticket in its chain to what is true. I first called these tickets "probably finished" from the stale line, and the History of T-0022 listed two things not checked (the permission-card path, Jiro building from Nokka's card). Read the History before saying whether something is done |
| The owner closed T-0025 as "works for now" and T-0026 and T-0027 without trying the SQLite copy | An owner's word closes a ticket, even with a known gap | The gap is written in the ticket's History at close ("not seen by Claude either"), so it is not forgotten. Closing is the owner's call; saying what is not known is mine |
| `owner-said.mjs` printed only six lines (today's short session) | It reads only the newest session file, and a new session had already started | Give it the path of the earlier big session files. Said in "How this file grows" now |

**Seen by the owner:** a running Kona showed the new ticket statuses by itself, with no reload and no project switch, after the ticket files were edited directly. The meeting-table adjustments are not written down yet; they come next.

## 20. What was found in the session of 2026-11-05 to 2026-11-06 (the Brain map, one source of truth, the Notes work T-0028 to T-0034)

| Seen | Cause | Keep |
|---|---|---|
| I said "186 tests pass" while a new test file was not in the run at all | `npm test` lists its test files by hand (`package.json`); a new `*.test.ts` is silently left out | After adding a test file, add it to the list and check that the count of tests went up |
| A change to two starter notes made one search question fail (TP 37 to 35) | Adding a section that says "notes" and "project" moved a paraphrase out of the top three | A starter note is part of what the search is measured on: run `node tests/search-eval.mjs` after any change to one, and put the answer to the question into the new text if it must stay findable |
| A hint that two lines with different numbers may disagree found 0 of the 8 real conflicts and gave 36 to 53 false alarms | The real conflicts were in words ("the alpha has OCR" against "OCR comes later"), not in numbers; tables and sentences that merely differ look alike | Measure a detector on cases you know before building any screen for it. The check that worked was a cheap model call on request: 7 of the 8, no false alarm on 4 pairs without a conflict (one odd item in a known pair) |
| My coverage tool called whole sections "covered by the document" that said the opposite (a licence "not verified" against "checked") | It compared words, not meaning | A word check finds what is missing, not what is contradicted: read each pair, and put every real conflict to the owner with both versions quoted |
| Stamping a ticket on old notes moved their `updated` date, and the new "linked note changed later" check then flagged them | The date meant "last touched", the check needs "last changed in what it says" | Keep `updated` for text changes only |
| Moving documents into notes with their headings pushed one level down made two 1,000-word sections | Level four headings are not section boundaries for the search | Keep a document's heading levels; the document's title goes in the heading of its part |
| Merging a document into a note with `save_note` would have dropped the keys Kona does not write (where it came from) | The tool rebuilt the front matter from nothing on every save | A save keeps the keys it does not manage; a section can be changed without sending the whole note |
| The real-conversation proof failed twice before it tested anything | Claude Code could not refresh its sign-in while another Claude Code process did the same; the harness kept two sessions open and the limit is two; a `\\b` written through a heredoc into JSON became a backspace | The harness retries once a minute, stops each session after use, and test data with backslashes is written with the file tools (benchmark 22 once more) |
| Three more questions were missed after the move although every fact was there | More notes compete for the three "Partly" places, and a document's title words no longer head its sections | Measure before and after a move (done), say plainly that a move can cost a little recall, and give the document's title to its heading |
| I wrote the real project's name into the plan note | It was in my head from the work | Real project names stay out of files Git tracks (the tickets are local). Replaced with "a real project" before anything was committed |

**Left behind:** a full backup of the first moved project's documents and notes in a folder outside the project and outside the repo, with a checksum list, until the owner says it can go; the throwaway projects of the proof runs and their transcripts were removed by the scripts; the dev window is still open.

## 21. What was found in the session of 2026-11-06 to 2026-11-07 (Connections, Costs, the Brain notes list, real buttons, the Mockups note for agents)

| Seen | Cause | Keep |
|---|---|---|
| "Why do I need to scroll down to edit or create a connection?" | The form was drawn after the last card of the list | A form that a button opens appears where the owner is looking: a dialog (lesson 27 of the benchmark) |
| After the first dialog the owner listed five faults: a flat edge, a text box and its Choose button of different heights, no line between GitHub and servers, "the copy here and there is too much", cards with too much information | A thin border where Kona's pixel frame is the rule; `h-11` boxes beside `h-12` buttons; one list for two kinds; a button for every copy; every fact on the card | The frame is `px-card` / `px-btn`; every box and button in a row is 48 px; one group per kind with a heading, a count, a rule and its own Add; one Copy… menu; a card shows only what is true now |
| Asked whether "All time" would be a disaster as a dot chart, I rebuilt the chart (weeks, months). The owner had only asked, then asked for the old one back | I treated a question as a request (benchmark 5) | Answer the question, say what I would change, and wait |
| A bar scaled to the biggest row next to "42%" looked wrong (the first bar was full) | The bar and the percent had different denominators | A bar is the share of the same total the percent is |
| The owner asked for read and written in two colours on the cost bars | The ledger keeps one dollar figure per turn (Claude Code's own), not one per kind of token. The usual price ratios did not fit 400 recorded turns (the implied price of Sonnet ran from 2.0 to 3.1) | Do not draw a number that cannot be measured. The split is shown in tokens, and the page says why (decision 84) |
| A line that is 99.96% of the total shows "100%" next to a "<1%" line | Whole-number rounding | Left as it is on the owner's word. Kona's own helper calls (the Bako and Kibby chats) are filed as a "session" with 0 turns: also left |
| The Report said "Nothing links to" about the project's own index ("where to start") | Every project note with nothing pointing at it counted as lost | A rule that flags a hub is tried on the real index note before it ships. A note with 5 links out and none in is an entry point (`ENTRY_LINKS`) |
| "What is the small dot in every furniture?" | The front of a piece was a 6 px square that nothing explained | A mark has a shape that says what it is (an arrow) and a line in the "?" |
| "You forgot to disable the chevron here" (the back arrow of the top bar, live inside the office editor) | The editor is not a sheet, so `sheetOpen` was false | Every screen that takes over the page counts as an open page for the top bar |
| "Is there any button that is not a real button?" A sweep found 7 flat boxes that act as buttons, 6 kinds of choice control with a thin line, 49 plain "ghost" buttons and one round "?" | Each screen styled its own `<button>` | The fix is the benchmark line 27. Choice controls are a `Button` with `on`. The ghost buttons and the "?" were left on purpose |
| A half-finished edit of the Servers page crashed the owner's open window for a few seconds (`KeyChip is not defined`) | The card used the new component before the component was written; every save reloads the dev window | Benchmark line 28: write the new piece first, then use it |
| A Rust test string `"C:\p1"` written from a JavaScript template lost its backslash and would have stopped the build (lesson 23 again) | Backslashes in a JS template string are eaten before the Rust file is written | Paths in Rust test strings use slashes (`/p/one`). It was caught before the dev window rebuilt |
| I dropped a closing `</div>` while replacing a block | A replace by text, with no check of the tags | Run `npx tsc --noEmit` straight after a block replace |
| A session wrote in the brain that "the widths are not filled in yet, the owner will read them from the viewer" | Nothing in the starter notes, the skills or the prompts said how big the Mockups devices are, or that the viewer is built in | What a built-in tool of Kona does is written for agents: a starter note ("kona-mockups"), the skills that use it, and a test that checks the words against the file the viewer draws from (`devices.json`) |
| Adding that starter note made an old question answer from it: "drag a card to In progress" found the Mockups note first, and the first-answer rate fell from 85.0% to 83.7% | The note used "card" and "drag" in everyday senses | After any starter note, run `node tests/search-eval.mjs`; reword the common words ("card" became "folder", "drag" became "move by hand"); add questions about the new note. The baseline is now TP 40, top-1 88.4% |
| The owner asked about vector search for the Brain | At 27 notes the keyword search misses 2 of 10 "same idea, other words" questions; a model costs a 235 MB download, a second engine and the honest "Not in the brain" | Scrapped for now (decision 85). Revisit with hundreds of notes or repeated real misses; first try `aliases:` and one cheap Haiku rewrite |
| "Deploy" was meant as a Kona release | The same word means a server in the Miralis repos | In the Miralis repos "deploy" means a server. In Kona, "deploy" and "release" mean the signed installer on GitHub (docs/RELEASING.md) |
| "Wait, not like that, the usual way" after I started `npx tauri dev` | The README says `npm run tauri dev` (the same program). What the owner meant was never said | Settled 2026-11-11: the owner confirmed `npm run tauri dev` from the `app` folder is the usual way (the README already says so). Start it that way |

**Checked by the owner, not by Claude:** the owner saw the Connections form and cards, the Costs lists and charts, the Brain notes list, the Board dialog and the notes list through pictures, and said the arrow on a piece "is better". Claude did not open these new screens in the window itself: they are proven by `tsc`, the unit tests and the owner's pictures only.

**Not seen at all:** the sheet tabs and the Costs period as pressed-in chips (the header may sit 4 px taller), an answered question card in Chat with its disabled options, the + strips at the plan's edges, the Skill editor's new buttons, the Needs page, the per-hour chart on a busy day, the ticket dialog's pickers over the dialog, and the signed installer of this version on a machine with an older Kona.

## 22. What was found in the session of 2026-11-07, later (accounts that follow the PC, the welcome page, per-project settings)

| Seen | Cause | Keep |
|---|---|---|
| The project "Quantum Research" spent the Miralis plan, and nothing on the screen said so | The account Main had no folder: it was "the PC's usual login", which was now the Miralis one. Its name, "Quantum Research", was a label the owner had typed; Kona never checked it against the login. `claude auth status` of both Kona accounts returned the same organisation | A name is not a login. Show what the login is (its e-mail) wherever the name is shown, and never let an account follow something outside Kona. Proof of which login a folder holds is `claude auth status` with `CLAUDE_CONFIG_DIR` set (read-only, safe to run) |
| "Since it is already per project, the settings should be scoped per project" (sessions at once, size, updates, the project list were in a project's Settings) | Settings had been one page for everything, reached from the office | Before putting a setting on a page, say whose it is: Kona's (welcome page) or one project's (the project's own). The same question for any new setting |
| Add a project showed another project in the top bar, and Cancel opened that project | The welcome page set "greeted" and "adding" together, so the main layout drew, with the first project as its fallback | A screen reached from the welcome page is a view of the welcome page. Cancel returns to where it came from, and no top bar names a project that was not chosen |
| The folder box and "Choose a folder" did not look like the other fields | A box beside a button leaves the box narrower than the fields under it (benchmark line 27 and the earlier lesson of this file about 48 px rows) | A choice that opens a dialog is one full-width field of the same height (`triggerBase`); nothing is put beside a field to open its dialog |
| I started a Python heredoc to check the tools | Lesson 22 of the benchmark (no `python -`, no heredocs): on this PC `python` is a stub that waits | Use `node` for every script, written to a file first |
| "Make the groups vertically scrolled" and "the project is shown vertically": I built one column of cards, then groups as columns, then asked a question; the owner shouted "HORIZONTALLY!!!" and "not like that!!!" | One word, vertical, was read three ways and I built each reading in turn (and asked the owner to choose with a question box, which they refused). What they meant: groups stacked top to bottom, the projects of a group side by side in a sideways row | Benchmark line 3, now with the layout sentence. When the same correction comes twice, stop guessing: write what stacks which way as one line to the owner and build only that |
| "Where do I add a new project?" | I moved the Add button to a corner when the list became groups, and the old big box at the bottom was gone | Moving a main action needs a place that is still seen. The owner's answer was a coloured "+ Project" under Settings, the same width as it |
| Signed-out cards were taller than signed-in ones in the same row | The extra Sign in button pushed another button to a second row | A card has one shape in every state: the same left actions and one button on the right (Open, or Sign in in its place); cards in a row stretch to the same height. I measured every card (all 213 px) instead of looking at two |
| Settings and + Project were two widths | Each button took the width of its words | Buttons stacked in a column share one width (`w-full` in a fixed-width column) |
| "Why does the size and view differ between these two pictures?" | A page with a scrollbar and a page without one are centred in different widths, so the whole page moved 8 px when a search left one card. And Windows' spell checker drew a red line and a bubble of word suggestions over the search box | `scrollbar-gutter: stable` on a scroll area whose content changes length. `spellCheck={false}` on any box that holds a name, a path or a search. Measure the left edge in every state, as `search` showed it |
| A box that saves when you leave it made the sheet ask "Close without saving?" after it had saved | The sheet counts text typed after the last button press or Enter, and leaving a box is neither | A field that saves itself carries `data-autosaves`, which the sheet ignores |
| A native search field drew its own blue clear mark | `type="search"` | Use a plain text box with `role="searchbox"`; Esc clears |
| Running the dev window moved the owner's real accounts (the migration of "Main") before they had seen it | The program reads %APPDATA%\Kona, and a dev run cannot be pointed elsewhere | Save a copy of `accounts.json` and `projects.json` before any run that may migrate them (done, kept in the scratchpad), and say so |
| The login of the PC was shown under the name the owner had typed | See the first row of this section | Any new "uses the machine's usual X" default is a trap: the screen must show which X it is, or it should not exist |
| I added 15 temporary projects to the owner's real list to show a crowded group | Kona has no separate test data | Name them so they are plain to see ("Temp …"), keep their ids in a file, remove them by their ids through the same command the screen uses, delete their folders, and say so. Only things that carry the marker are removed |

**Checked by Claude in the real window (dev window, driven through the page, 2026-11-07):** the welcome page with 2, 5 and 17 projects, groups A to Z with a sideways row, equal card heights (17 cards), the search (name, group, folder, typos, no match), the group dialog, Add a project with Cancel, a project's own Settings (account, sessions at once, name, group, Remove), the general Settings, the migration of an account that followed the PC's login (it came up signed out, its project's conversations copied). Throwaway projects were added and removed through the screen.

**Not seen at all:** a real sign-in through the browser for a new account; a real session stopped by the per-project limit or the PC ceiling of 6; the History and Resume of the copied conversations; the release build (only the dev window was used before the release was made).

## 23. What was found in the session of 2026-11-07, last (a root login refused, a bubble that ran off the page, the letters in the file tree)

| Seen | Cause | Keep |
|---|---|---|
| A Sora session was refused every `ssh root@…` with "registered for the user deploy", although a Root entry existed and listed Sora | `ssh::decide` took the first entry whose address matched and only then compared the user; with a Deploy and a Root entry on one address, Deploy always won. Found by reading the incident note, then the code (`app/src-tauri/src/ssh.rs`) | Anything that looks up "the entry for this address" must look at every entry with that address and choose by user, then by role. A test with two entries on one address (`two_entries_on_one_address_are_told_apart_by_the_user`) now guards it. The incident's other guess (a permission that only applies to new sessions) was not needed |
| A pasted terminal log ran past the right edge of a chat bubble, and the whole chat scrolled sideways so the left of Sora's words was cut off | A long line with no space in it (a certbot plugin list) cannot wrap, so the box grew; the transcript could scroll sideways | Chat text gets `overflow-wrap: anywhere` and `min-w-0`, and the transcript hides sideways scrolling. Code blocks keep their own sideways scroll inside the block |
| The owner wanted the little letters an editor shows beside changed files (U, M, A, D) | The Files tree only knew "changed since you last opened it" (a teal square), not what Git thinks | The letters come from `git status` (read only, no index lock), read again every 4 seconds with the folders. A folder gets a small square in the strongest colour inside it. Colour is never the only sign: the letter and the hover words say it too |
| The owner marked four red spots on a rug and asked "why is the rag weird" | I first read "rag" as the server form (a wrong guess: I should have asked what "rag" was). The rug: its fill is a filled shape and its dashed edge was a drawn line, and the two round half a pixel differently, so the gap between the edge and the rim of the rug was 4, 4, 3 and 1 pixels on the four sides (on all ten rugs, and it moved round when the building turned). The edge itself had no missing pixels | Draw both as filled shapes (same rule), edge 1/8 tile inside the rim and 1/16 tile thick: the gap is 4 on every side. Found by printing the pixels as characters and counting the gap per side, not by looking. A test in `office.test.ts` measures the gap of every rug in all four views |

**Checked (dev window, throwaway project, 2026-11-07):** `cargo test` (ssh and files), `tsc`; the letters U, A, M and the squares on folders in the real Files tree, a file made later getting its U within 4 seconds and the letters going after a commit; a long unbroken word in a real chat bubble (it wraps, nothing scrolls sideways); a real Sora session told to run `ssh root@...` with a Deploy and a Root entry on one address: the card named the Root entry and was never allowed. The first Sora try failed with a transient "Failed to refresh OAuth token" from the Claude login and passed on the second. **Not seen:** a D letter on screen (a deleted file is not in the tree), the release build.

## 24. What was found in the session of 2026-11-09 (the default office, the turn button)

| Seen | Cause | Keep |
|---|---|---|
| The big screen (Mockups) could hardly be clicked: the owner saw "Meeting" on it in a screenshot | A click area is the box round a piece, and the nearer box wins. The long meeting table's box covered the whole screen on sides 1 and 2 (100 percent) and 70 percent on sides 0 and 3. Four of the people in Engineering and Marketing lost about 20 percent to their neighbours the same way | `art/check-layout.mjs` (run by `build-standard.mjs`) measures, on all four sides, how much of each click area a nearer one takes; the limit is 5 percent. A test in `office.test.ts` says the same. A person is two tiles long, so people sit three tiles apart; a screen goes in its own corner, not behind a table |
| The first check I wrote said chairs of the meeting table could not be reached | The row behind the chairs was one tile wide and shut in by the whiteboard and the screen | `check-layout.mjs` also walks from the front door to a free tile beside every chair, desk and screen, and checks both tiles of every doorway |
| Planning's board lost 6 percent from one side | People stood right under the cork board, and a person's box reaches up | People stand two rows away from a board on the wall; the check says when not |
| The turn button of the Mockups bar disappeared on Laptop and Desktop and the other buttons shifted | It was drawn only for devices that turn | It stays, greyed out, with a hover saying why: a control that exists on every device does not move |

**Rule that came out of it:** a layout is judged by the click areas, the doorways and the walking routes, on all four sides, with numbers (`check-layout.mjs`), not only by looking at one side.

## 25. What was found in the session of 2026-11-09, second part (removing the Accounts page, the ridges in the walls)

| Seen | Cause | Keep |
|---|---|---|
| The owner called the Accounts page of a project useless | It was the same component as the Accounts list in Settings on the welcome page. I first suggested turning it into a status page (usage bars, which projects use the account); the owner asked "are you sure? don't they already show in another page?" and the top bar and the Costs page already did. I had not looked before I suggested it | Before proposing what a page should show, look for where it is already shown (the top bar, Costs, the project's Settings). A question that starts "are you sure" means look again, not defend |
| Removing a screen leaves things that point at it | The seven error messages "Open Accounts to sign in", the starter note that lists the screens, the editor's list of screens, a test that expects a fixed number of clickable things, the smoke test, the notes. A saved office with the retired piece in it would show a dead click | Removing a screen: search every name it has (`accounts`, the piece, the label, the words a person reads), add the piece to `RETIRED_KINDS` (with a test), then drive the real window: click every piece on all four sides, open a saved office that still holds the old piece, and check the welcome page still has what it needs |
| The owner marked long wall edges where the dark line jumped a pixel every tile ("uneven ridges") | The outline of a wall is put on the nearer one of two touching surfaces. At the joint of two tiles of one run, the later tile counted as nearer, so the line sat on the top pixel in one tile and on the face pixel in the next: a run of 1 pixel above a run of 3, 44 to 52 places on each side of the office. A first try (call anything one tile apart the same wall) ate the thin side face of the doorway posts, which I saw only by printing the pixels | Two tiles of the same height and width, side by side, are one wall: neither is nearer (`sameRun` in `walls.ts`). `office.test.ts` counts the jumps on all four sides (it fails with the old rule: 47). A change to the outlines is judged by printing the pixels before and after, not by the picture alone |
| The smoke test failed on "a whole number of screen pixels" | `ratio % 1` called 0.9999999985 "not whole" at a 120 percent view | Compare the distance to the nearest whole number, never `% 1` of a float |

**Rule that came out of it:** a line of pixels is judged by its run lengths (two in every row on a 2:1 edge), counted by a script on all four sides, not by eye.

## 26. What was found in the session of 2026-11-11 (Leftovers per project, the red "!", notes per device, dark frames, sharing talk)

| Seen | Cause | Keep |
|---|---|---|
| The top-bar "left behind" and "waiting on you" counts were app-wide, and the Leftovers page too | They were counted over every session, not the open project's | Both are narrowed by the project folder (`samePlace`); a session whose folder is not known still shows everywhere, so nothing is hidden by mistake |
| The owner said "look at the font size I marked" and I first read it as the page title | The two headings meant were "Leftovers" and "Scratch files" | When a marked picture is ambiguous, say which two things I think were marked before changing sizes |
| A "!" drawn with a font letter looked off-centre to the owner | Font glyphs carry side space | Draw such marks as two pixel rectangles in an SVG and measure the centre |
| The "!" on the Leftovers piece is hidden by the hover name label when the pointer is on the crate | The label is drawn over the badge | Open: not changed, owner has not asked |
| Notes in the Mockups pick-a-part box did not say whether they were for every device or one | The pin only kept the part and the note | A pin has an optional `only` (one device); the box says "Every device" or "Only <device>", the ticket draft is told, and a test covers it |
| The laptop and desktop frames were light while phone and tablet were dark | `build-devices.mjs` had `mat` set per device | Change the script, run it, copy the outputs by hand to `app/src/assets/devices/` (the app reads that copy, not `art/out`) |
| The window went blank after editing `Mockups.tsx` ("does not provide an export named Mockups") | Vite read the file in the middle of a save and cached it empty; touching files did not help | Stop and restart the Vite process |
| A heredoc edit of `lib.rs` lost the `\n\` line ending inside the long prompt string | The shell ate the backslash | Insert with `chr(92)` and print the line with `repr` to check |
| Regex with `\n` inside a test-driver string collapsed | Escapes are reduced twice on the way | Split on `String.fromCharCode(10)` instead |
| "Can we make something like cloudflared ourselves?" | The program on the PC is the small part; the public server is what costs | Decision 90 (still in discussion). Do not build a relay for every user; see the row |

**Checked (dev window, throwaway project `leftover-demo`, 2026-11-11):** a real session waiting on a question moved the count and the card; the "!" badge centred by measurement; per-device notes saved and shown; 218 tests. **Not checked:** the waiting mark on welcome-page cards (not built), the selected state of the Every device / Only X buttons (subtle), notes for another device are not dimmed.

## 27. What was found while building the terminal (2026-11-11)

| Seen | Cause | Keep |
|---|---|---|
| Ctrl+C did nothing in the new terminal: `ping -t` and `Start-Sleep` kept going, even when the 0x03 byte was written straight to the shell | The dev window had been started from a tool that switches Ctrl+C off for itself, and a program passes that on to what it starts | `terminal.rs` calls `SetConsoleCtrlHandler(None, 0)` before it starts a shell. Seen working afterwards. If Ctrl+C ever fails again, test it first with a window started a different way |
| A test that wrote to a shell with no screen on it hung (no file was made) | A pseudo-terminal shell first asks the screen a question and waits for the answer; xterm.js answers it, a bare test does not | Test a shell only through the real xterm screen in the window |
| After a hot reload the list of shells in the page was empty | Reloading `lib/terminal.ts` made a new empty list; the Rust shell kept running unseen | The reload of that file loses the link to running shells (dev only); a full window restart is the clean way to test |
| Two ways to prove "the shell dies with Kona": counting PowerShell programs after killing the window | The job object (`job.rs`) | Seen: 0 left. Kona's window and its helper were children of app.exe, the shell too |
| The terminal never said the shell had ended after `exit` | On Windows the output pipe of a pseudo-terminal stays open after the shell ends; it only closes when the terminal itself is closed, so "pipe closed" never came | `terminal.rs` asks the shell every 0.4 s whether it has ended (`try_wait`) and then announces it. Never wait for the end of the pipe |
| A paste came out twice in a test | The test was run against an old copy of the screen: after a hot reload the old terminal was still on the page, so two handlers pasted | After changing the terminal screen, reload the whole window (`location.reload()`) before testing; a hot reload of that component can leave the old one running |
| The last line of the terminal touched the frame's bottom edge | The padding was on the box xterm measures, so the fit counted the padding wrongly | Padding goes on an outer box; the box xterm fits has none |

**Checked (dev window, 2026-11-11):** a command and its output, the folder, colours readable on the paper background, Ctrl+C, leaving the page and coming back (screen redrawn), the Leftovers page ignores the shell, shells gone when Kona is stopped. **Not checked:** typing a long line that wraps while the window is resized, Unicode (emoji, Indonesian letters) in the output, 1000+ lines of output, the Git Bash choice.

## 28. The risk test of the terminal (2026-11-11)

| Seen | Cause | Keep |
|---|---|---|
| Kona held two PowerShells for one project; the window knew of one | The screen mounts twice in development (React's strict mode) and a quick tab switch does the same: two starts ran at once and the second overwrote the first | One start per project is shared (`starting` in `lib/terminal.ts`). Count shells from the outside (the programs under app.exe), not only from the window's own list |
| After a full reload of the window (F5) the old shells stayed running, unseen | The page loses its list, the core keeps the shells | The page closes every shell in the core when it loads (`term_close_all`) |
| The keyboard was not in the terminal after opening it or switching back | Nothing gave it focus | The terminal takes focus when it is shown |
| Fear: a restart or Kona closing leaves a dev server running | Tested: a `node` child of the shell was gone after Restart, and after Kona was stopped | Seen safe. Closing the pseudo-terminal ends the whole tree, and the job object covers the rest |
| Fear: Esc in the terminal closes the page | Tested | Seen safe |
| Fear: the release program (no console window) could not host the shell | Built a release-type program without a console, in a scratch folder (5 minutes, 2 GB) | Seen: output, Ctrl+C and exit all work, and no extra window opens |

**Checked:** 218 tests, 87 Rust tests, the smoke test (52 passes; one run in three stopped with a crash I could not repeat, right after the previous run), a release-style policy added to the window (no violations), accents, Chinese letters and an emoji, 20000 lines (15 s, the window stayed alive), resizing (the shell learns the new width), two projects with their own shells, a shell closing with Kona.
**Not checked:** the real signed release (a hardened policy applies only there), ssh to a real server by me, vim or other full-screen programs, a huge paste into a program that does not read, many projects with a shell each (about 70 MB for each).
**Known and left as is:** a program started in the terminal does not show on the Leftovers page; shells of a removed project live until Kona closes; the last 400 KB of output is replayed on return, so a full-screen program may look wrong after leaving the page.

## 29. The terminal with blocks and an input bar (2026-11-11)

| Seen | Cause | Keep |
|---|---|---|
| After I rewrote the terminal screen, stray characters showed and the command headers sat in the wrong place | The rewrite dropped the line that loads the terminal's style file; without it the helper boxes show and the headers are not positioned | The style file is imported in `components/term/session.tsx`. After any rewrite of a screen, look at a screenshot before testing anything else |
| The header of each command (the "Done 0.2 s Copy" part) stayed at the left and covered the command | The terminal's own `anchor: right` option does not set the right edge when the offset is 0 | `index.css` has a rule for `[data-kona-chip]`; the session marks the element. Draw it, take a screenshot, and look |
| File paths with a drive letter were not found | The pattern needed a name before each slash, and a drive letter is followed by a slash straight away | The pattern allows a slash right after the drive; the tests cover a drive letter with both kinds of slash |
| The Find box hid the first header | It sits at the top right of the screen, where a first command's header is | Known and fine; it closes with Esc |
| A window reload left the old shell running when nobody pressed Start | The clean-up ran only when a shell was started | The clean-up runs when the page loads (`lib/terminal.ts`, last lines) |
| The sliding sheet shook for a moment when it opened with a terminal in it (the owner saw it) | Kona put the cursor into the input bar while the sheet was still sliding in; the browser scrolled the box inside the sheet by about 800 px to show the cursor, then it settled back. The same family as the `scrollIntoView` shake of section 14 | Every `focus()` in a screen that lives in a sheet is `focus({ preventScroll: true })`. Found by sampling every scroll position 40 ms apart while the sheet opened; after the fix nothing scrolled and the sheet slid from 873 to 72 px smoothly. A shake that is gone in a quick look is not gone: sample it |
| Heredocs with quotes broke whole commands | The tool collapses backslashes and chokes on odd quotes | Write files with the Write tool, not with a heredoc |

**Design as built:** one xterm screen per project kept alive outside the page (so leaving the page loses nothing); the shell prints a private mark (number 7777, base64 JSON) at each prompt from `term_init.ps1`; the input bar sends a line and Kona knows a block starts there, the next mark ends it; while a block runs the keyboard goes to the screen (ssh, a password, `Read-Host` work), when it ends the bar has it again. The terminal starts only when Start is pressed, and Close frees its memory (seen: 0 shells after Close).

**Checked (dev window, 2026-11-11):** lazy start; a block ending Done, Failed (exit 3), Stopped (Stop button) and Running with a timer; the bar disabled while running and the keyboard on the screen, then back; a script button filling the bar; Up in the bar; Read-Host answered from the screen; a path in an error opening Files; Find; Copy of one block; Clear; Restart; Close; leaving and coming back (also a command that ended while away); `exit` typed in the bar; a reload closing the old shell; 229 tests, the Rust tests, the smoke test (52 passes).

**Not checked:** a multi-line paste into the bar; a very long command row (the header covers its end); a custom prompt from the owner's own PowerShell profile (Kona's short prompt replaces it); Tab completion (the bar has none); a slow `git status` in a huge repository (it runs at every prompt); the signed release.

## 30. The header, the script buttons and the drifting headers (2026-11-11)

| Seen | Cause | Keep |
|---|---|---|
| The header buttons looked uneven | Three different button styles side by side (plain text, plain text, a framed one of another height) | One style (`quiet`, small) for all of them, a thin divider before Close. Restart was dropped: it is Close plus Start |
| Closing the terminal threw away a running command without asking | Nothing asked | Close asks when a command runs, and shows the command (`Confirm`); with nothing running it closes at once |
| "PowerShell" in the header told the owner nothing | There is one shell | Removed. A shell name comes back only when there is a choice of shells |
| After the window got narrower and wider again, the header of a command sat on the wrong row, and Copy took the wrong text | The terminal's own row markers drift when lines are wrapped again (seen: two rows off) | `relocate()` in `term/session.tsx` finds each command's row by its text after every resize and puts the header and the end of the block back. Checked at 181 columns, 92 columns and 181 again: the three rows and their copies were right each time |
| Many script buttons would not fit a row | A row of fixed buttons | The buttons that fit are shown, the rest are behind "More · n" (a list; a search box when more than 8 are hidden). The width is measured from an unseen copy of the row (`inert`), by a pure function that has tests (`fitCount`) |
| My test typed into the bar instead of the "More" list | The list had no search box with 8 or fewer entries, so the keys went on to the bar | Not a fault of the screen, but a reminder: a test that types must check where the focus is first |
| A test left 14 buttons in the owner's real Kona data file | I saved test buttons for the test project through the core | Cleaned afterwards (the file is `{}` again). A test that writes to Kona's own files must clean up before it ends |

**Built:** own buttons (name and a one-line command) are kept in Kona's own folder in `term-buttons.json` (one file for all projects, never in the project's folder, copied into the backups); the core trims and checks them (40 letters for the name, 500 for the command, one line, no duplicate name; Rust test); the screen also refuses a command that looks like it holds a key, a token or a password. The project's `package.json` scripts and `composer.json` scripts (without the hooks composer runs by itself) are read the same way. A button only puts its line in the bar.

**Checked (dev window):** the row with package scripts; adding a button of your own through the form (it came first, with its accent line and an x on hover); a secret refused; 17 buttons at full width (all fit) and at 700 px (9 shown, "More · 8", the list, picking from it); Close with a command running (asks and shows it), Cancel keeps it running, Close with nothing running does not ask; 233 tests, 88 Rust tests, the smoke test (52).
**Not checked:** a composer.json on a real project; removing a button with the x or from the list by hand in the real window (only the core's saving was checked); the "More" list with the keyboard arrows; the signed release.

## 31. Marks on the welcome page, the "Open" mark over a head, one account name (2026-11-11)

| Seen | Cause | Keep |
|---|---|---|
| A worker's "Finish" mark vanished once the owner had opened the finished chat and closed it again, although the chat was still open | The mark was only "a turn the owner has not seen"; after seeing it the person was drawn as idle, so an open chat could not be told from none | A chat that has been seen but is still open keeps a quiet mark over the head: the dashed ring and the word "Open" (`mode: "open"` in `lib/office.ts`, paler than the other bubbles). It goes when the chat ends, and a chat with no turn has none |
| From inside one project nothing told the owner that a worker of another project waited or had finished | The counts were narrowed to the open project (earlier in this session) | The welcome page card shows "N waiting on you" (the amber waiting glyph) and "N finished" (the green check) for sessions of that project, counted by `waitingByProject` and `finishedByProject` (with tests). "Finished" means the same as the bubble: a turn the owner has not looked at |
| The card said "signed in" and showed the account's e-mail | Detail the owner does not need on a card | The card shows only "Account: name". "signed out" is kept, in red, because the Sign in button needs a reason; nothing is said while it is being checked |
| "The account name should be only one per local computer" | Already true in the core (`accounts.rs`, case does not matter) | Only the message was made plainer: "Another account on this computer already has that name, and each account name can be used only once" |
| I could not get a real session into the "waiting" state cheaply | A real session needs a permission prompt and costs usage | A dev-only hook (`window.__konaDispatch`, set in `App.tsx` when the app runs in development) feeds fake session records to the reducer. Seen: the card marks, "Questioning", "Finish" and then "Open" after viewing and closing the chat. A reload clears the fake sessions |
| The owner asked what is this? about a waiting mark on welcome-page project cards, an item I had listed as an open offer | The list used a name only I knew | An open offer is written so that someone who was not there understands it: what the owner would see, where, and when (a small notice on a project's card saying a session is waiting for you) |

**Checked (dev window):** a project with one waiting and one finished session shows both on its card ("1 waiting on you", "1 finished"); opening the project shows "Questioning" and "Finish" over the two heads; opening the finished person's chat and closing it turns "Finish" into "Open" (screenshot looked at); the card shows only the account name; 236 tests, 88 Rust tests.
**Not checked:** a real session in another project (the records were made up, in the same shape as real ones); the "Open" mark in a crowded room (the bubbles lift above each other, as before); the "left behind" mark on cards (not built; the owner has not asked).


## 32. The Journey view (2026-11-13: tickets T-0035 to T-0041)

| Seen | Cause | Keep |
|---|---|---|
| A new starter note broke two search questions and made two unrelated questions "partly found" (TP 40 to 42, FN 3 to 4, FP up) | The coverage bars are a knife edge: one rare word in a new section (the words *meet*, *colour*, *card*, *progress*) moved a question across a bar | Measure after every wording change of a starter note, with a scratch script that runs the search with and without the note and prints which questions changed. Then fix the words, not the bars. Do not use ordinary words in a new note when a plainer one is free |
| The skill told workers to save a note of kind journey; `save_note` did not allow that kind | The skill and the tool were written apart and nothing compared them | Found only while preparing the real conversation. A skill that names a value of a tool is checked against the tool's own schema; there is a Rust test now. Write the real-conversation script before saying a skill is done, not after |
| The meaning check by Haiku seemed to complain about every clean journey, twice, and was dropped; the owner said to check it again, and it then found 11 of 12 planted problems and reported 0 of 36 clean journeys | **The first measure was made wrongly:** the script started `claude` through a shell (`shell: true` on Windows), which mangled the system prompt (line breaks and quotes), so the instruction never reached the model and it answered the user line alone. Kona itself starts the program with no shell, so the real button was never tested that way | A script that measures a model calls it the way the program does (the same executable, no shell, the same arguments), and a first run in which the model says it does not know what to check is read as a broken harness, not as a bad model. The second design is also better: a fixed answer shape (one verdict line for each step) that is read by a parser, so a small model cannot report what it was not asked |
| A 120-step journey first fitted at 30 percent and could not be read | The "fit" had a floor of 0.3 and a path of 120 steps in a row is wider than any window | Look at the screenshot of the real amount (lesson 10). The automatic size never goes below 55 percent; the map scrolls inside its box |
| The second run of the window test failed on the first click, with no error on the page | The narrow-window step had left the test window smaller, so the box was below the fold and the click landed on the office behind the sheet | A window test sets the window size itself at its start, scrolls the target into view before clicking, and puts the window back as it found it. A failure with no page error is a position problem first |
| The real-conversation script could not build the digest | A built program has no `/src` to import from; only the dev window has | The scripts that need the source run in `tauri dev`; the others run against the built program. Say which in the header of the script |
| A `sed` over a file with backticks and quotes made a syntax error in the test (twice); `python3 -` hung the shell for two minutes | Lesson 22 of the benchmark, broken again | Now written into the line itself |
| (a real window run spends the owner's plan: the bars in the top corner showed it, 19 percent of the session after the measures and the conversations) | Cents each, but they add up | Say it in the report: how many calls were made and that the bars moved |
| The checker for workers is a copy of the reader, and a copy drifts | Two codes for one rule | It is made from the reader by a tool (types stripped), and a test fails when the file in the skill is not what the tool makes, and when the two give different problems on the same texts. A shipped copy of a rule is generated, never written twice |
| A journey note edited by the owner can no longer be changed by a session | The brain's rule: an edited note is the owner's | Open for the owner: it may need an exception for notes of kind journey. Not decided, so not changed |

**Checked in the real window (built program, throwaway project, nothing of the owner's touched):** the Journey tab, 6 and 120 steps, the dialog, the picker, the kinds of user, a broken note, the narrow window, the table with its Check column, the marker scan, and a Mockups page that draws the journey from the note (the address answers, the ways out stay shut, a changed note shows after Start the page again). **Not checked:** a project with no journey at all; the keyboard path through the boxes; the Journey page in a project with two journeys that have markers.

## 33. The Ask page (2026-11-13: ticket T-0042)

| Seen | Cause | Keep |
|---|---|---|
| The first run of the window test did nothing on the page and failed on every question | The test looked for a button by its text, and the first button called Ask is the **tab** called Ask, not the send button | Find a control by where it is (the form, the role), never by text alone when a tab or a heading can carry the same word |
| Two throwaway scripts waited for something that never matched and then acted too early (the button was still busy), which looked like a bug of the page | The shell turned a double backslash into one, so a pattern with a digit class became the letter d and could never match; the page itself was right | A script with a pattern in it is written with the file tool, not a shell heredoc; and a wait is checked once against a state it must match before anything is concluded about the page |
| The real window run was stopped by the outer time limit and left a throwaway project in the owner's list | The cleanup is in a finally block, which a killed process never reaches | After a killed run, look at the project list and remove what is left (done here); the test names its project so it can be found |
| A first thought was to retire the question box, and the owner asked for a page instead | The box was doing three jobs (search, gap list, ask Claude) on pages that did not need it | Say what a thing is for before removing it; the part worth keeping (the free search first, then the wanted list) became the front of the new page |
| Real plan use of this ticket: 47 Haiku calls for the measure and about 10 for the window runs and the demo | Cents each | Said in the report; the bars in the top corner showed 19 percent of the session before and after, so the cost was small |
