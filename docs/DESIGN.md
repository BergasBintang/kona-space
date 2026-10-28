# Kona design, version 3

Drafted on 2026-10-25 in FigCraft (0.7.0, early alpha) at the owner's request. The owner approved version 0 ("love it, go on"), then asked for the full front end (version 1) and then for a clickable prototype with the first-run flow, a full SaaS team of roles, and one tidy file that is the source of truth (version 2). Nothing here is built in code yet.

**Version 3 (2026-10-27)** changes two things the owner asked for. (1) The Brain is now a graph of linked notes with a starter brain and an honest "is this in the brain?" answer (six screens, section "The Brain" below). (2) The sidebar can fold down to a 72 px rail that keeps the Kona mark (section "The collapsed sidebar"). Every other screen is unchanged except for the fold button added to its sidebar.

## Where things are

| What | Where |
|---|---|
| The design file (open it in FigCraft) | `docs/design/kona-design.figcraft`. Three pages: **Tokens**, **Parts** (four frames side by side: base parts, second batch, interactive parts, states and themes), **Screens** (six columns: first run, sessions, board and project, costs and upkeep, Brain, collapsed sidebar). It is the source of truth and also the clickable prototype |
| Previews | `docs/design/previews/`: one PNG per screen (named after the screen, for example `1-sessions-chat.png`) and one per parts frame (`part-*.png`) |
| The scripts that drew it | `docs/design/build/`. They talk to a running FigCraft through its MCP server (`figcraft --control 7979`, then `figcraft-cli mcp --attach 7979`). Screenshots they take go to `docs/design/build/build-output/` (ignored by Git); set `FIGCRAFT_CLI` if FigCraft's command line tool is not in its usual place. `run-all.sh` rebuilds the whole file in order (it needs FigCraft running with `--control 7979`). `build-previews.mjs` writes the PNGs. Shared code: `kona-lib.mjs` (tokens, role marks, the role list), `kona-parts.mjs`, `kona-parts2.mjs`, `kona-interactive.mjs` (hover sets and prototype links), `kona-shell.mjs`. Version 3 added `build-brain.mjs` (the six Brain screens; `INPLACE=1` redraws them in an open file) and `build-rail.mjs` (the collapsed sidebar and its twins; runs last). `run-all.sh` lists both, but a full run of it was **not** repeated after version 3: the two scripts were run on their own on the open file. `registry.json` is generated while building |
| The owner's taste, read-only source | `C:\miralis-canon\DESIGN.md`. Kona takes its discipline, not its marks |

## Mood

Calm and quiet, technical and terminal-like, warm and friendly. Dark first, roomy. The owner chose these words (question 14).

## Rules

1. Sentence case everywhere. No small label above a heading or a number.
2. One accent per screen area. The accent (sea glass) is Kona's voice: the main button, the focus ring and the live state.
3. State is a glyph plus a word. Never colour alone, never a plain dot.
4. Flat at rest. A shadow appears only when something floats (menus and dialogs).
5. A box means something. A bordered card is a thing you can open or a group you read as one; a stat tile with nothing in it is not allowed.
6. An empty screen shows one next step first, then anything else.
7. Plain words. No short forms such as "14D" or "WK". Permission and warning text says what the thing does in everyday words, with the exact command beside it.
8. Machine text (commands, paths, ports, ids, numbers) is set in the mono face, with even digit widths.
9. Icon-only buttons carry a word or a clear tooltip. The draft uses words.

## Colour tokens

Names are meaning-based. Raw ramps come later, when light mode is designed.

```css
@theme {
  /* surfaces, darkest to lightest */
  --color-canvas: #0B0E10;      /* behind the app, design pages */
  --color-ground: #101417;      /* app background */
  --color-surface-1: #151A1E;   /* sidebar, quiet panels */
  --color-surface-2: #1B2126;   /* cards, dialogs, menus */
  --color-surface-3: #242B31;   /* hover, selected row, chips */
  --color-inset: #0E1215;       /* fields, code blocks */
  /* lines */
  --color-line-subtle: #2A3238; /* decoration: card edges, dividers */
  --color-line-strong: #5C666D; /* control edges (3.1 to 3.2 : 1 against ground and inset) */
  /* text */
  --color-text: #ECE6DA;
  --color-text-secondary: #B9B4AA;
  --color-text-tertiary: #8E9396;
  --color-text-disabled: #5F666B;
  /* the one accent */
  --color-accent: #6CC6B4;
  --color-accent-hover: #86D4C4;
  --color-accent-pressed: #58AE9D;
  --color-on-accent: #0D1517;
  /* states */
  --color-state-live: #6CC6B4;
  --color-state-waiting: #E8B25A;
  --color-state-idle: #8FA3AD;
  --color-state-done: #8FBF7F;
  --color-state-stopped: #8A9297;
  --color-state-left-behind: #E5776B;  /* also used for danger */
  --color-on-danger: #1A0E0C;
}
```

State backgrounds are the state colour at 14 percent on the surface. Focus is a 2 px accent ring with a 2 px gap. A focused field also gets a 3 px halo at 22 percent accent.

### Contrast, computed on 2026-10-25 (WCAG ratios)

| Pair | Ratio |
|---|---|
| Text on ground, on surface 2 | 14.9, 13.1 |
| Secondary on ground, on surface 2 | 9.0, 7.9 |
| Tertiary on ground, surface 2, surface 3 | 6.0, 5.2, 4.6 |
| Accent on ground, on surface 2 | 9.1, 8.0 |
| On-accent on accent, hover, pressed | 9.1, 10.8, 7.0 |
| On-danger on danger | 6.5 |
| State colour on its own 14 percent tint: live, waiting, idle, done, left behind | 6.6, 6.9, 5.3, 6.4, 4.9 |
| State colour on its own tint: stopped | 4.5 (the lowest, on the limit) |
| Disabled text on ground | 3.2 (disabled text is exempt) |
| Line strong against ground and inset | 3.1 and 3.2 (was 2.0 in the first pass and was raised) |

Not yet checked: contrast of every state on every surface, a greyscale pass, a keyboard-only pass.

## Type

| Style | Size and line | Weight | Use |
|---|---|---|---|
| Display | 30 / 38 | Bold | Empty-state headline |
| Title | 22 / 30 | Bold | Page and session titles, section headings |
| Heading | 17 / 24 | Bold | Dialog titles |
| Body | 15 / 24 | Regular | Everything you read |
| Body strong | 15 / 24 | Bold | Buttons, tabs |
| Small | 13 / 20 | Regular | Help, captions, sub-lines |
| Small strong | 13 / 20 | Bold | Labels in forms, badges |
| Mono | 13 / 20 | Regular | Commands, paths, ports, ids, numbers |

- Words: Nunito Sans, with even digit widths turned on (`tnum`).
- Mono: the draft uses Consolas as a stand-in. It cannot be shipped. Pick an open-licence face (JetBrains Mono, Cascadia Mono or IBM Plex Mono) when fonts are bundled.
- The preview has only two real weights, Regular and Bold (FigCraft's built-in Nunito Sans rendered "SemiBold" as Regular). The app will bundle a variable font and use a true semibold (600) where this draft shows Bold. Check the look then.

## Shape and space

- Control height 44 px, or 36 px in tight rows. Never anything between.
- Radius: small 6, control 10, card 14, dialog 18.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Shadow: only on menus and dialogs. `0 16 40 -8` at 40 percent black in this draft.
- Borders: 1 px inside. Cards use the subtle line, controls use the strong line.

## Identity marks (what makes it Kona)

1. **State glyphs.** A ring plus one inner mark. Live (filled core), waiting on you (two bars), idle (dashed ring), done (check), stopped (square), left behind (exclamation). The same six appear on badges, session rows, the checks list and the leftover dialog. A glyph always sits beside its word.
2. **Role marks.** A neutral tile plus one shape per role, ten shapes in all (table under The team). Shape, not colour, tells roles apart, so the accent stays single.
3. **Mono for machine text**, and the exact command shown beside every approval, with one sentence of plain words above it.
4. **The plan bar.** Says what it measures in words, shows the percent in mono, turns amber past 80 percent and adds a glyph and a sentence.
5. **The "estimate" line** next to every dollar figure ("An estimate, not your bill").
6. **Motion (not drawn yet):** the live glyph breathes slowly (a 3 second ease between 100 and 70 percent opacity of its core); nothing else moves except short responses to clicks. Reduced-motion turns the breathing off.

## The team (roles)

Kona ships with ten roles. Each has a mark made of one shape, a group on the Roles page and a starting permission mode. The owner can add, rename and remove any of them. Shape, not colour, tells roles apart; the name always sits beside the mark.

| Group | Role | Mark | Starting permission mode |
|---|---|---|---|
| Plan | Product | ring | Plan only |
| Plan | Design | half disc | Ask every time |
| Build | Frontend | rounded square outline | Edits free, commands asked |
| Build | Backend | filled square | Edits free, commands asked |
| Build | QA | triangle outline | Ask every time |
| Build | Security | plus | Ask every time |
| Ship | DevOps | diamond | Ask every time |
| Grow | Marketing | ring with a dot | Ask every time |
| Grow | Content and SEO | three lines | Ask every time |
| Grow | Support | filled dot | Ask every time |

The earlier drafts showed only four roles. That was sample data, not a limit. These ten are a proposal. The starting modes are a proposal too: the safe default is "ask every time", and the two build roles that edit files are the only ones loosened.

## Parts

All on the page **Parts**, four frames side by side.

1. **Kona parts** (button, state badge, text field, select and menu, tabs, plan bar, session row, permission card, leftover dialog, empty state).
2. **Kona parts, second batch** (second icon set, switch, box, round choice, chip, key cap, tooltip, alert, toast, file tree row, code line, changes line, ticket card, board column, terminal pane, command palette, permission mode choice).
3. **Interactive parts**: 49 component sets, each with a resting and a hover look (and a selected look where it applies): nine navigation items (Sessions and Leftovers can carry a count), four session tabs, five session rows, twenty buttons that lead somewhere, and the **collapsed sidebar** items (nine rail items and the fold and unfold buttons, see below). The screens use copies of these, so changing one here changes every screen.
4. **States and themes**: loading bars, empty notes, a light theme proposal with computed contrast, a density table (comfortable and compact).

Not drawn yet: a drag state for ticket cards, hover on tree rows and ticket cards (they have no hover in the prototype), real window chrome, keyboard focus drawn on every new part (the focus rule is the same as batch 1), a greyscale pass.

## Base pickers (built in code, not yet drawn in FigCraft)

Three base parts for choosing from a list, in `app/src/components/pick/`. They replace the system dropdown, which is white on a dark window. The behaviour follows the Miralis canon's SelectField and Combobox (`src/js/20-select.js`, `30-combobox.js`) and its smart-search guide (`guide/26-smart-search.md`); the look is Kona's. Never use a plain `<select>` in Kona.

| Part | Use it for | Notes |
|---|---|---|
| **Select** (single) | one choice from a list | the trigger looks like a text field; a second line (hint) per option; a disabled option shows but cannot be chosen; a search row appears above 8 options |
| **MultiSelect** | several choices from a list | a box per row that fills with the accent; the list stays open; footer says how many are chosen and has Clear; the trigger shows the names, or "3 chosen" |
| **SmartSearch** | finding one thing in a long list, in the page or from a server | text field with a magnifier and a clear button; 2 letters before a fetch, 200 ms wait, the old request aborted, rows kept dimmed until the new ones arrive, 20 rows at most; an optional "typed text is the value" mode |

**The matcher** is one shared function (`app/src/lib/search.ts`): lower-case and no accents; words split at spaces and `- _ . , / ( ) &`; every word must match, in any order; scores are exact 100, starts with 90, a word starts with 80, initials 60, contained 45, one typo 27, two typos 19 (words of 6+ letters), letters in order 12; hints count at 0.6; ties keep their order. A word of one or two letters is never forgiven.

**Rules:** matched letters are marked by weight and underline as well as colour; "nothing found" says what was searched and where, then offers "Did you mean ...?" and "Clear the search"; the count is announced (`aria-live`); keys are Down, Up, Home, End, Enter, Space, Esc (clears the text first, then closes) and Tab; the list opens under the field or above it when there is no room, and is never clipped by a scrolling page.

## The shell

A 248 px sidebar on every project screen: logo and a fold button, project switcher, eight places (Sessions, Board, Files, Worktrees, Costs, Roles, Leftovers, Brain), the two plan bars, Settings. Counts sit as chips beside a place: amber for something waiting on the owner, red for leftovers. The Sessions place adds a second column with the session list. A session has four tabs: Chat, Changes, Files, Ticket.

## The collapsed sidebar

Asked for by the owner on 2026-10-27, with a picture of VS Code's icon strip as the reference: "make the sidebar able to minimize while maintaining the logo".

- **A 72 px rail** holds, top to bottom: the Kona mark (the logo: a cat head with a sunflower in its face, 28 px, in the logo gold; see `docs/design/logo/README.md`), the unfold button, the project (a folder icon in an outlined square), the eight places as 48 by 44 icon tiles, the two plan meters, and Settings.
- **The mark stays.** The word "Kona" goes, the mark does not.
- **Plan meters** become a percent in mono over a 40 px bar. Their words ("This session", "This week") live in the node names and in the tooltip to add; they are not drawn on the rail (to decide: a tooltip on hover is the plan).
- **Counts** stay as small chips on the corner of the icon (amber for waiting, red for leftovers), the way the VS Code strip shows its number.
- **Icons carry no words, so the hover look shows the name as a tooltip** (rule 9: icon-only buttons carry a clear tooltip). The fold and unfold buttons do the same ("Make the sidebar smaller", "Open the sidebar"). A keyboard-focus tooltip is the same look (not drawn).
- **The active place** is a raised tile with the accent icon, as in the open sidebar.
- **Fold button** sits at the right of the logo row in the open sidebar and on every project screen (26 screens). First-run screens have no project and no fold button.
- **In the prototype** two screens have a collapsed twin: `1 Sessions / Chat, collapsed` and `10 Brain, collapsed` (the Screens page, last column). The fold button on the Chat screens and on the six Brain screens leads to its twin, and the unfold button on a twin leads back. In a twin, the Sessions and Brain places lead to the other twin; the other places lead to their open screens. That is a limit of the draft, not a rule: in the app the folded state stays while you move between places. The twins are copies of the open screens with the sidebar swapped, so the main area is 176 px wider and some content (the map, the side panels) keeps its width and sits to the left.
- **To decide:** is the folded state remembered between launches (proposal: yes, per window), does a narrow window fold it by itself (proposal: below 1100 px, yes), and does Ctrl and B toggle it (proposal: yes, as in VS Code).
- Built by `build-rail.mjs` (runs last in `run-all.sh`) with the sets made by `kona-interactive.mjs` (`buildRail`) and the rail drawn by `kona-shell.mjs` (`railSidebar`).

## The Brain

Redrawn on 2026-10-27 after the owner asked for a brain "like graphify with clustering, indexing and wiki links, like the Miralis canon", with a starter brain and an honest answer when something is not in it. The plan is in `kona-space-app.md` (F7, decisions 40 and 41). Six screens on the Screens page, column "Brain", built by `build-brain.mjs`.

| Screen | What it shows |
|---|---|
| 10 Brain | **The map.** Notes as dots, links as lines, clusters as soft regions with a name. A question box ("Ask the brain") sits above the tabs Map, Notes (62) and Report (4). The side panel shows the selected note: its layer and cluster, what it says, what it links to (each link marked written or guessed, with the lines it points at) and what links to it |
| 10a Brain / Notes | The notes as a list, newest first, with a layer filter (All, Project, Starter, Claude memory). Each card says where the note came from and how many links go out and in. Beside it: "Not finished" (open items) and the starter brain card |
| 10b Brain / Report | The health report: **Wanted notes** (questions the brain could not answer, with "Write this note"), **Needs a look** (links that go nowhere, a decision with no session behind it, a note nothing links to, an open item 34 days old), **Most connected** and **How your notes group** (computed groups against yours) |
| 10c Brain / Ask, found | A question with a strong match: badge "Found in the brain", the sections with note, layer, lines and a match bar, and a card saying what Kona looked at |
| 10d Brain / Ask, partly | Only weak matches: badge "Partly in the brain", the three closest marked loose or weak, and a card with the choices when none fits |
| 10e Brain / Ask, not in the brain | No match: badge "Not in the brain", a plain sentence that Kona will not guess, four choices (ask Claude in a session with a suggested role, search the web after asking, read the nearest starter topic, write the note yourself), a card of what Kona looked at, and a note that the question was added to the wanted-notes list |

- **Three layers, told apart without colour.** A project note is a filled disc, a starter note is a ring in the accent (Kona's own voice), a Claude memory note is a grey ring. Each sits beside its word on the legend, the chips and the cards.
- **Links told apart without colour.** A written link (a wiki link or a name in the text) is a solid line, a guessed link is dashed. The legend and the side panel say so in words. Heavier lines are wiki links.
- **Clusters** are regions with a name, not colours. Bigger dots have more links. Only the most connected notes carry a name on the map; a hovered note shows a tooltip.
- **Found, Partly, Not in the brain** use the existing state glyphs: done, idle (dashed ring) and waiting (Kona needs the owner's call). The numbers in the drawn answers (a 35 percent bar, "12 percent") are sample data. The real bar is to be set by testing on real notes.
- **Accent:** the Ask button is the only filled accent button on the Brain tabs; on an answer the Ask button turns quiet and the best next choice takes the accent.
- **Wired in the prototype:** the Ask button leads to 10c, "Ask again" cycles 10c, 10d, 10e and back to the map, the tabs move between Map, Notes and Report, Close and Esc return, "Start a session" and "Ask Backend" open New session. A flow "Ask the brain" starts at the map. Everything else is drawn, not wired.
- **Not drawn:** the starter notes list, a single note opened for reading, the Write a note dialog, the "Search the web" confirmation, a map with 60 notes (the map shows the 20 most connected), a map in the light theme.

## Screens

On the page **Screens**, in four columns. Frame names start with a number or an F so the prototype links can find them.

| Column | Screens |
|---|---|
| First time you open Kona | F1 Welcome, F2 Checking this PC, F2c Checks passed, F2b Claude is missing, F2e Not signed in, F3 Add your first project, 14 Add project, F4 Creating the project, F5 Project ready |
| Sessions | 1 Chat (asking), 1b Chat answered yes, 1c Chat answered no, 2 Changes, 13 New session, 12 Command palette, S2 Loading, S3 Login expired |
| Board and project | 3 Board, 4 Ticket open, S1 Board empty, 5 Files, 6 Worktrees |
| Costs, roles, upkeep | 7 Costs, 8 Roles (Marketing open), 9 Leftovers, 9b Leftovers confirm, 11 Settings |
| Brain | 10 Brain (the map), 10a Notes, 10b Report, 10c Ask found, 10d Ask partly, 10e Ask not in the brain |
| Collapsed sidebar | 1 Sessions / Chat, collapsed, 10 Brain, collapsed |

### The first-run flow

1. **F1 Welcome**: one sentence about what Kona is, one button, one line that nothing leaves the PC.
2. **F2 Checking this PC** (moves on by itself after about 1.6 seconds): Claude Code installed, signed in, Git, Node. Kona only looks.
3. **F2c Checks passed**, then **Continue**.
   - If Claude Code is missing: **F2b** says so in plain words and offers to open the install page. Kona does not install anything by itself.
   - If there is no login: **F2e** offers to open the sign-in page. Kona never sees the password.
4. **F3 Add your first project**, with the three checks still visible.
5. **14 Add project**: folder, name, GitHub address (optional).
6. **F4 Creating the project** (moves on by itself): hidden folder for notes and tickets, Git told to ignore it, project read, team made ready.
7. **F5 Project ready**: Start a session, Open the board, and the ten roles with a See the team button.

Chosen by the owner: the flow checks Claude and the login, and adds the first project. It does not ask the owner to pick a team (the ten roles are simply ready) and does not force a first ticket.

## The prototype

Open the file in FigCraft and press the Present command (Alt, Cmd or Ctrl, and Enter), or pick a flow in the Prototype panel. Seven flows have a starting point: first time you open Kona, Claude Code is not installed, you are not signed in, a session asks for permission, the board and a ticket, roles and permission modes, ask the brain.

- **Hover and click:** the sidebar places, session tabs, session rows and the buttons that lead somewhere change on hover and move to the next screen on click. About 710 links were added in version 2, and the Brain and rail work in version 3 added about 300 more; none failed to attach (the scripts count failures and printed none). Counts come from the build scripts' own tallies, not from a recount in FigCraft.
- **Keys:** Ctrl and K opens the palette from the chat; Esc goes back; Enter in the palette goes to Worktrees.
- **Ticket T-0012** on the board opens its drawer. Allow once and Don't allow in the chat lead to two different follow-up screens.
- **Scrolling:** every screen is a fixed 1440 by 900 window, like the real app. Where content is taller or wider it scrolls inside the window and the header, sidebar and message box stay put: chat transcript, session list, changed files and diff, each board column and the board sideways, file tree and code, worktrees, costs, leftovers, brain, settings, the role list and the role editor. Set with `build-scroll.mjs`. The scroll setting is applied and the cut-off looks right in the previews, but scrolling itself was not tried in the presenter.
- **Not interactive:** everything that is not a navigation target (most buttons inside forms, tree rows, ticket cards other than T-0012, text fields). Those are drawn, not wired.
- **Checked:** the links exist and point at the right frames and variants. It was not checked by clicking through the presenter.

## Open points for the owner

- Are ten roles the right starting team, and are the groups (Plan, Build, Ship, Grow) and the starting permission modes right?
- Ten shapes are harder to tell apart than four. Do the marks read at small size next to the names, or should the names carry more?
- Do the colours feel right? Sea glass on warm-dark basalt is a proposal.
- Is Bold too heavy for headings (the real app will use semibold)?
- Which mono face (Consolas is a stand-in)?
- Light theme and compact density are proposals. Wanted at all?
- Settings shows "Add another account" and the Pro plan as examples. The number of accounts is still unanswered.
- The servers section stores a key file path, not the key. This is a proposal (to verify when the first server entry is built).
- In the dialog screens the sidebar is not dimmed. Should dialogs cover the whole window?
- The first-run flow has no team-picking step and no first-ticket step, as chosen. Add them later?
- Brain: should the map show names on every note once a project has 60 or more (proposal: only on hover, plus the hubs), and is "Partly in the brain" the right wording for a weak match?
- Collapsed sidebar: remembered between launches, folds by itself in a narrow window, Ctrl and B to toggle (all proposals, see the section above).
- Not checked in version 3: the hover tooltips of the rail and the fold button (drawn inside the hover looks, seen in the Parts frame, not tried in the presenter); every prototype link by clicking; scrolling in the presenter; contrast of the new greys on the map (the lines use the tertiary text grey, 5.2 to 1 on surface 2, not measured against every region); a greyscale pass.
