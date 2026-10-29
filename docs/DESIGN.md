# Kona design, version 4

The look of Kona as built in 0.20.x (2026-10-30): a light paper and cream look, pixel art everywhere, and an isometric office in place of the sidebar. It replaces versions 0 to 3, which were drawn in FigCraft (a dark theme with a sidebar). That design and its scripts were removed on 2026-10-30; they stay in git history (the commit of Kona 0.20.1 still has them). The decisions behind this file are rows 42 to 48 of the Decisions table in `kona-space-app.md`.

## Where things are

| What | Where |
|---|---|
| The colours, fonts and the pixel classes (frames, shadow, edges) | `app/src/index.css` |
| The contrast check, run after any colour change | `npm run contrast` in `app/` (`app/tools/contrast.mjs`) |
| Small shared parts: state glyphs, badge, buttons, plan bar, a role's cat | `app/src/components/ui.tsx` |
| The pickers (select, multi select, smart search) | `app/src/components/pick/` |
| The office, the top bar, the welcome page | `app/src/components/Office.tsx`, `TopBar.tsx`, `Hello.tsx`; the list of places in `app/src/lib/places.ts` |
| The art (cats, the building, the frames, the logo) and the scripts that draw it | `art/` (start with `art/README.md`); the copies the app uses are in `app/src/assets` and `app/src/office` |
| The owner's taste, read-only source | `C:\miralis-canon\DESIGN.md`. Kona takes its discipline, not its marks |

## Mood

Calm and warm, roomy, playful but never loud. Bright but not too bright: an off-white cream, never pure white, with dark brown text. The owner chose "pixel art, in the manner of Kairosoft's cut-away rooms" and "a light paper or cream look" (decisions 45, 46, 48).

## Rules

1. Sentence case everywhere. No small label above a heading or a number.
2. One accent per screen area. The accent (teal) is Kona's voice: the one main button, the focus ring, the live state. Gold is decoration: the logo, a hover outline, the selection colour. It is never a button colour, because a darker gold is also "waiting".
3. State is a glyph plus a word. Never colour alone, never a plain dot. A cat's speech bubble follows the same rule.
4. Flat at rest. A hard pixel shadow appears only when something floats (menus, dialogs, notices, bubbles).
5. A box means something. A framed card is a thing you can open or a group you read as one; a stat tile with nothing in it is not allowed.
6. An empty screen shows one next step first, then anything else.
7. Plain words. No short forms such as "14D" or "WK". Permission and warning text says what the thing does in everyday words, with the exact command beside it.
8. Machine text (commands, paths, ports, ids, file contents) is set in the mono face.
9. Icon-only buttons carry a word or a clear tooltip.
10. The pixel font is for the interface only (headings, buttons, labels, numbers in bars, bubbles, room names). Long text (chat replies, notes, tickets) and anything that must be read exactly (code, paths) stays in a plain font.
11. Pixels are never stretched. Pictures are drawn on a small grid and shown at a whole-number scale (the office at 1x to 3x, frames at 2x). Frames repeat, they are never scaled.
12. Hard edges. There is no rounded corner anywhere.

## Colour tokens

Meaning-based names, set in the `@theme` block of `app/src/index.css`. Hover goes darker on this light ground.

```css
@theme {
  /* surfaces */
  --color-ground: #f2e9d4;      /* app background */
  --color-surface-1: #ece1c9;   /* top bar, quiet panels */
  --color-surface-2: #f8f1e1;   /* cards, dialogs, menus */
  --color-surface-3: #e3d6ba;   /* hover, selected row, chips */
  --color-inset: #fbf6ea;       /* text fields */
  /* lines */
  --color-line-subtle: #d6c8a8; /* decoration: dividers */
  --color-line-strong: #85755a; /* control edges */
  /* text */
  --color-text: #2d2218;
  --color-text-secondary: #54452f;
  --color-text-tertiary: #6b5b43;
  --color-text-disabled: #9a8c72;
  /* the gold: the logo, the selection colour, hover outlines (decoration only) */
  --color-brand: #b57a14;
  /* the one accent */
  --color-accent: #1a6558;
  --color-accent-hover: #145045;
  --color-accent-pressed: #0f4037;
  --color-on-accent: #fffaf0;
  /* states */
  --color-state-live: #1a6558;
  --color-state-waiting: #7a4f03;
  --color-state-idle: #4f6068;
  --color-state-done: #2f6228;
  --color-state-stopped: #565c61;
  --color-state-left: #a33727;  /* also used for danger */
  --color-on-danger: #fffaf0;
}
```

**Contrast, computed by `npm run contrast` on 2026-10-30 (WCAG ratios; text needs 4.5 to 1, control borders and the focus ring need 3 to 1).** Every pair passes. The lowest ones: tertiary text on surface 3, 4.6; idle on surface 3, 4.6; stopped and left behind on surface 3, 4.7. Text on ground 12.8, on cards 13.8; secondary text on ground 7.7; tertiary on ground 5.4. Every state colour on ground and cards is 5.4 to 6.4. Text on the teal button 6.6 (hover 8.9, pressed 11.2); on the red button 6.4. A strong border on ground 3.7, on cards 4.0, on a field 4.2. The focus ring on ground 5.7. Gold on ground is 3.0, which is why it is decoration only. Disabled text is exempt. The first draft of the state colours failed on the hover background and was darkened, which is why the checker exists.

Focus is a 2 px accent ring with a 2 px gap.

## Type

| Face | Use |
|---|---|
| Nunito Sans (variable) | Everything you read: replies, notes, tickets, help, the small print. Even digit widths turned on. |
| Pixelify Sans (variable, open licence, bundled) | The interface: h1 to h4, every button, legends, badges, the plan bars, room names, speech bubbles |
| Cascadia Mono, then Consolas | Commands, paths, ports, ids, file contents |

Sizes are by feel at the window: titles 22 to 34, headings 17 to 20, body 15, small 13 to 14. A pixel font looks right at its design size; the sizes were chosen by looking at the real window, not by the old scale. Fallback if the pixel font fails: Nunito, then Segoe UI.

## Shape and space

- Control height 40 px (small) or 48 px. Spacing in 4, 8, 12, 16, 24, 32, 48.
- No radius. Borders are 2 px, hard.
- **Frames** (art kit, `art/frame.mjs`): a 3 by 3 grid of tiles. Corners stay, edges repeat, the middle is empty so the element's own colour shows. Three looks each: normal, hover, pressed.

| Frame | Tiles | Shows as | Used for |
|---|---|---|---|
| Paper, large | 6 px | 12 px | Cards, dialogs, the room panel, notices (`px-card`) |
| Paper, small | 4 px | 8 px | Text boxes, select triggers, quiet buttons (`px-field`, `px-btn-paper`) |
| Teal, small | 4 px | 8 px | The one main button of a screen (`px-btn-teal`) |
| Red, small | 4 px | 8 px | A button that cannot be undone (`px-btn-red`) |

- Hover: paper frames turn the outline gold; teal and red get darker. Pressed: the bevel flips and the button sits one pixel lower. Disabled: 55 percent opacity.
- Shadow: a hard offset, `4px 4px 0` at 20 percent brown (`px-shadow`), only on floating things.

## Identity marks (what makes it Kona)

1. **State glyphs.** A pixel ring plus one inner mark on a 16 by 16 grid: live (filled core), waiting on you (two bars), idle (dashed ring), done (check), stopped (square), left behind (exclamation). Shown at 16 px (up to 24) or 32 px. A glyph always sits beside its word.
2. **The cat.** Every role is its own cat (own coat, collar and eyes) with a small card showing a role icon. A role's face is the avatar everywhere a role is named. The logo and the app icon are the face of the orange cat.
3. **Speech bubbles.** A cat that is not idle has a bubble with a glyph and a word: "Working…", "Waiting for you", "Done", "Starting…".
4. **The plan bar.** Says what it measures in words, shows the percent, turns amber past 80 percent and adds a mark. In the top bar it is the compact form (a label, the percent, a bar); the reset time and the warning are in its tooltip.
5. **The "estimate" line** next to every dollar figure ("An estimate, not your bill"). The cost is never gamified.
6. **Motion.** Cats move in four steps a second (typing, a waving paw, blinks). The live glyph breathes in steps. The working word has a light sweep. Everything stops under Windows "reduce motion", and the cats pause when the window is hidden. Smooth fades are not used (a smooth SVG fade cost 15 percent of a core on this PC).

## The team (roles)

Kona ships with ten roles and a secretary. The list is fixed: it cannot be edited (decision 43). Every role uses the account of the project. Models start as Sonnet. A role's brief is told to Claude at the start of a session.

| Group | Role | Cat | Starting permission mode |
|---|---|---|---|
| Plan | Product | orange tabby | Plan only |
| Plan | Design | calico | Ask every time |
| Build | Frontend | blue-grey tabby | Edits free, commands asked |
| Build | Backend | black cat | Edits free, commands asked |
| Build | QA | siamese | Ask every time |
| Build | Security | tuxedo | Ask every time |
| Ship | DevOps | teal cat | Ask every time |
| Grow | Marketing | ginger | Ask every time |
| Grow | Content and SEO | chocolate | Ask every time |
| Grow | Support | lilac cat | Ask every time |
| Office | Secretary | white cat | Ask every time |

The secretary sits at the front desk, answers general questions and turns what the owner says into tickets for the other roles. Her model (Sonnet) is a proposal.

## The shell

- **The welcome page** opens on every launch: the Kona mark, a greeting, one card per project with its account and whether it is signed in. A signed-out account offers Sign in and Use another account; a project without an account asks "Which account does this project use?" once; Open is enabled only when the account is signed in. "Add another project" is the last card. The Kona mark in the top bar goes back to it.
- **The top bar** is always in view: the mark, the project, a Go to list of every place, a way back to the office, what waits on you and what was left behind, the account of the project, the two plan bars and the version. There is no sidebar.
- **The office** is one isometric pixel-art building with a room for every place. Hover lights a room and shows its name; click zooms in (twice the scale, the rest fogged); Esc or "Back to the office" returns. A room's panel lists its cats with their state and a button to start or open a session as that role, and the places the room opens. A room is also reachable by keyboard (Tab, then Enter).

| Room | Holds |
|---|---|
| Board (notice wall) | Board |
| Library | Brain |
| Archive | Files |
| Server room | Servers |
| Git room | Worktrees and the DevOps desk |
| Plan | Product and Design desks, the staff board |
| Build | Frontend, Backend, QA and Security desks |
| Grow | Marketing, Content and SEO, Support desks |
| Front desk | The secretary and the session list |
| Accounting | Costs |
| Back office | Voice and Settings |
| Storage closet | Leftovers |
| Entrance | Accounts |
| Lounge, Garden | Nothing yet |

- **Sessions** is a place with a list of sessions on the left and a start screen or a chat on the right. A session has the pixel working word while Claude works.

## Parts

Buttons (primary teal, quiet paper, ghost without a frame, danger red), state badge, text field, select, tabs, plan bar, session row, permission card, the room panel, the speech bubble, the update card and notices, all in `ui.tsx`, `pick/` and the screens. The screens use these parts; they do not invent a button.

### Base pickers

Three base parts for choosing from a list, in `app/src/components/pick/`. They replace the system dropdown, which looks wrong in a custom window. The behaviour follows the Miralis canon's SelectField and Combobox and its smart-search guide; the look is Kona's. Never use a plain `<select>` in Kona.

| Part | Use it for | Notes |
|---|---|---|
| **Select** (single) | one choice from a list | the trigger is a framed field; a second line (hint) per option; a disabled option shows but cannot be chosen; a search row appears above 8 options |
| **MultiSelect** | several choices from a list | a box per row; the list stays open; the footer says how many are chosen and has Clear |
| **SmartSearch** | finding one thing in a long list | text field with a clear button; 2 letters before a fetch, 200 ms wait, the old request aborted, 20 rows at most |

The matcher is one shared function (`app/src/lib/search.ts`): lower-case and no accents; every word must match, in any order; exact 100, starts with 90, a word starts with 80, initials 60, contained 45, one typo 27, two typos 19 (words of 6+ letters), letters in order 12; ties keep their order; a word of one or two letters is never forgiven. Matched letters are marked by weight and underline as well as colour; "nothing found" says what was searched, offers "Did you mean ...?" and "Clear the search"; keys are Down, Up, Home, End, Enter, Space, Esc and Tab. An input inside a frame of its own carries the class `bare`, so it does not get a second frame.

## The Brain

A graph of linked notes (decisions 40 and 41; F7 in `kona-space-app.md`). It answers a question with "Found in the brain", "Partly in the brain" or "Not in the brain", using the glyphs done, idle and waiting.

- **Three layers, told apart without colour.** A project note is a filled disc, a starter note is a ring in the accent, a Claude memory note is a grey ring. Each sits beside its word.
- **Links told apart without colour.** A written link is a solid line, a guessed link is dashed. Heavier lines are wiki links.
- **Clusters** are regions with a name. Only the most connected notes carry a name on the map; a hovered note shows a tooltip.
- On a miss Kona offers choices (ask Claude in a session, search the web after asking, read the nearest starter topic, write the note) and adds the question to the wanted-notes list. It never guesses.

## First run

With no project yet, Kona opens on "Add your first project": folder, name, GitHub address (optional) and the account (required, from the signed-in accounts). If no account is signed in it says so and offers "Sign in to an account"; Accounts opens, and "← Back" returns. After the project is added, the start screen opens. The older drawn first-run flow (a welcome, a check of this PC, a creating screen) was never built.

## Not checked, and open points

- Nothing was checked by keyboard alone, by a greyscale pass, or at the 90 and 80 percent window sizes (they make pixels uneven; the office then looks slightly rough). A small window shows the office at a half step.
- The logo, the role icons on the cats' cards and the building are a first pass drawn by script; the owner may repaint them in LibreSprite and drop the pictures back in.
- The Go to list and the speech bubbles use plain text, not drawn icons.
- The secretary's model (Sonnet) and the room list are proposals.
- Moving furniture and adding rooms are not built (the layout is fixed, decision 44).
- Colour changes must pass `npm run contrast` before they are used.
