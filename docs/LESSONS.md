# What we learned, and how to tackle it next time

Written 2026-10-30, at the end of the long session that produced versions 0.20.x to 0.22.0 (roles you can set up, skills per project, the office built from parts and turnable, workflows). It is for you (the owner) and for any future Claude session. Read the part you need; each part says what was found, why, and what to do.

Plain words are used on purpose. Terms are explained the first time.

---

## The benchmark: read this first, in every session

Every line was paid for with a correction or a wasted hour. Before showing the owner any work, go down the list. A line that fails means the work is not ready. The reasons and the stories are in the sections below (most in section 10).

**Listening**

1. Something the owner said once still holds. Before building a screen, read this list and search the Decisions table for what was already agreed.
2. When a redesign replaces a screen, list what the old one had first. Nothing agreed may disappear without saying so.
3. If a word could mean two things (they said "b-tree"), show a small picture of what you understood before building it. A wrong guess costs more than one question. Before saying a new idea overlaps something that exists, say what you think it is for and ask.
4. When the owner says "I don't understand", take things away. More explaining text makes it worse.
5. A question gets answered first, in plain words ("WHAT IS THIS?" means explain it). While the owner says "we are discussing", change nothing.

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

22. Long scripts: write the file with the Write tool, then run it. No heredocs with quotes or backslashes, and never `python -`. Keep each file's own line endings.
23. A Rust compile error kills the dev window. A backslash in a Rust test string is the usual cause.
24. Open choices go to the owner through the question tool, the recommended answer first. Ask only what has not been said.
25. A piece placed in the office is looked at in the picture of the real office, from all four sides, and nothing stands beside a doorway (a test checks it).
26. A page, a mockup or a button that people click is proven by clicking it in the real window. A test of its logic in Node proves only the logic: a form button that could not be sent passed every such test.

---

## How this file grows

The owner asked for this on 2026-11-02, so that every session ends up teaching the next one.

1. **At the start of a session:** read the benchmark above.
2. **As it happens:** when the owner corrects something, or a test or a real run shows a surprise, add a row to the section of the current session straight away. Summaries of a long session lose these details.
3. **Before a commit or a release, at the end of a session, or when the owner says "write the lessons":**
   - Run `node tests/owner-said.mjs` in `app/`. It prints everything the owner typed in the newest session on this PC.
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
| Room layout on whole tiles | You said you will report what looks wrong. When you do: say the side and send a crop; I fix the rule, then check all four sides. Growing a room means editing `DEFS`; then rerun the build, read every `CHECK:`, check there is no short tall-wall stub, and look at all four sides. |
| Cat looks | Redrawn after 0.22.0 as a true three-quarter view with shading and a tail (section 2.8); still drawn by script. A hand-drawn LibreSprite cat can replace it, keeping the sheet layout. |
| Font | Jersey 20 was tried on this PC only. If a letter looks wrong, send a crop; `docs/FONTS.md` says how to go back or make the text a little bigger. |
| Real window | Done once for 0.22.0 on 2026-10-30, with your Kona closed: all 19 smoke checks passed (welcome page, office, every place including Workflows, no content-policy blocks), and a short extra check showed the turn buttons change and remember the side, the Workflows screen has its three suggestions and its chart, and the top bar shows v0.22.0. Run it again after each release (section 6.3). |
| Workflow follow-ups | Left: roles reading only their own steps, chart lines that skip a column, an optional auto-start. Section 4. |
| Kibby inside the rooms | He walks the hall only. Rooms need their own ordering checks (furniture, desks); extend `WALK` with a door and a few steps inside, then read the CHECK lines. |
| Kibby's talk, measured | Measure the cost and the delay of a message, then decide on a longer memory or a saved talk. |
| Decor on every wall | Windows are on all outer walls; art boards only on three. Add more through the `ART` list in `office.mjs`. |
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
