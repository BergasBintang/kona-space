# UI research: what a large library of animated parts teaches the Design and Frontend people (2026-11-22)

**What this is for.** The owner wants the people of Kona who design and build screens (Nokka the Design, Jiro the Frontend) to make screens that do not feel flat, in any project they work on. This note is the research behind the built-in skill `ui-details` (`app/src-tauri/skills/ui-details/`). It is not a plan for Kona's own interface. The skill is the library; this note is the evidence.

**How it was done.** React Bits (github.com/DavidHDev/react-bits) was cloned shallow (`git clone --depth 1`, 9,647 files, 802 MB, mostly videos and pictures) into a temp folder and read and counted with scripts that only read files; nothing from it was installed or run. Drawing speed was timed in a window that has graphics acceleration off. Tags: **(seen)** counted or read in the files, **(measured)** timed on this PC.

## 1. What it is

- **219 components** (the README says "215+"), counted in the folders: Text animations 33, Animations 38, Components 48, Micro 35, Backgrounds 65. Four flavors each (JavaScript or TypeScript, CSS or Tailwind) (seen).
- **Licence: MIT + Commons Clause** (seen). Use inside an application or product is allowed, including a paid one, and changing it is allowed. Selling, bundling or redistributing the components themselves is not. So the skill carries **ideas, timings and rules written fresh, and no copied code**.
- **Process worth copying** (seen, CONTRIBUTING.md): a live demo with controls for every component; a change goes into all four flavors; a script checks that documented defaults match the code; each visible change adds a dated line to a per-component changelog.
- **Tooling around it** (seen): install by the shadcn command, jsrepo, or an MCP server; five browser tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab).

## 2. What runs through all 219 (seen)

| Habit | How many | Meaning |
|---|---:|---|
| Handles reduced motion | 202 | Almost everything adapts instead of switching off |
| Cleans up its animation frame | 177 | No leaks |
| Has `aria-` labels | 192 | Spoken words are part of the build |
| Pauses when the tab is hidden / when off screen | 92 / 136 | Saves the processor |
| Caps the screen density at 2 | 117 | A sharp screen does not cost four times the work |
| Watches its own size | 163 | Redraws only when the size changes |
| Pointer capture (a drag survives leaving the control) | 48 | Drags never get stuck |
| No text selection while pressing | 86 | No flashes |
| A keyboard handler | 54 | A pointer effect also has a key version |
| Hidden text for screen readers | 28 | A rolling number is read once |
| Announces changes (`aria-live`) | 11 | "Done" is spoken, not only drawn |

**The motion numbers it keeps using.**
- Curves: `cubic-bezier(0.23, 1, 0.32, 1)` 96 times; `0.22, 1, 0.36, 1` 36 times; `0.77, 0, 0.175, 1` for morphs and shakes. Its own tokens are named ease-out, ease-in-out and ease-drawer.
- Time scale: press 120 ms, tooltip 160 ms, menu 200 ms, panel 280 ms. Common CSS durations are 200 and 300 ms for small things and 360 to 520 ms for bigger moves.
- The spring for interface changes: duration 0.3 s, bounce 0. Bounce (0.2) is kept for small playful things.

**What each uses to draw.** 105 use WebGL, 19 use a 2D canvas, **95 are plain HTML and CSS**. In the Backgrounds group 63 of 65 are WebGL.

## 3. What heavy drawing costs (measured, graphics acceleration off, software rendering)

| Area | Work | Result |
|---|---|---|
| 800 x 500 | light shader | 60 frames a second |
| 1920 x 1080 | light (8 loops) | 20 |
| 1920 x 1080 | medium (24 loops) | 9 |
| 1920 x 1080 | rich (48 loops) | 5 |
| 800 x 500 | 2D canvas, 1,500 moving dots | 60 |

A full-window shader background is a gamble on any machine without a good graphics card; a small simple one, a 2D canvas and plain CSS are safe. This is why the skill says not to use full-window shader backgrounds.

## 4. The details, and where each went into the skill

| Detail found | Where in `ui-details` |
|---|---|
| The motion token set and the time per kind of change; animate opacity and transform only; loops; honest progress | `references/motion-scale.md` |
| Status mark (ring, arc, check, cross, with words); tool-call chip with a timer that holds at 90 %, shakes 6 px on failure and offers Retry; thinking line with a stopwatch that folds into "Thought for 12.4 s"; chat box (5 lines, Enter without breaking input methods, Send becomes Stop, a queue with Send now); hold to confirm (2 s, cancels on blur or hidden tab); undo on a 4 s fuse; toast | `references/patterns-agent-screens.md` |
| Press, hover, focus twin; the warm tooltip (400 ms cold, 300 ms warm, 140 ms swap, 80 ms grace, touch by long press); numbers that roll with tabular digits and one spoken value; switches and tabs; menus that open from the control and a highlight that glides; lists; delayed placeholders (140 ms, 240 ms, 1.8 s); drag rules; pixel-grid page transitions | `references/patterns-everyday.md` |
| Reduced motion adapts; keyboard twin; spoken changes; pointer capture and touch action; cleanup; pause when hidden or off screen; density cap; the speed governor (60-frame windows after 1.5 s, step down when the median is over 24 ms, start low on 2 cores or 2 GB, remember per session); focus rings by input mode; sound off by default | `references/safety-rules.md` |
| The measured cost table; what not to use (full-window shaders, 3D and physics libraries, gradient text, playful physics for daily tools); when a bigger effect is fine; keep the project's own look | `references/what-to-skip.md` |
| Ten tested pieces of plain code, and the same code as two ready files to copy: a CSS file with the timings and base styles, a JavaScript file with the helpers | `references/snippets.md`, `templates/motion-tokens.css`, `templates/ui-details.js` |
| The flat test: every moment of a screen, answers or silent | `templates/flat-test.md` |

## 5. Proof

- **Code:** the two drop-in files (which a test checks hold exactly the code of `snippets.md`) were run in a headless Edge (`app/tests/ui-details-snippets.mjs`) and 23 promises were checked (a tooltip waits 400 ms and then opens at once while warm; a touch never shows one; a number counts and holds the final value in hidden text; an honest bar stays at 90 percent; a hold confirms only when held; Enter while composing text does not send; the box stops at 5 lines; the governor steps down on slow frames; the canvas density stops at 2). All passed.
- **Jiro (Frontend)**, real conversations in a throwaway project (`app/tests/ui-details-skill.mjs`), asked to make a flat page answer the person. The skill was used every time and every page had named timings, press and focus states, reduced-motion handling, a status region, tabular digits and no library. But he opened none of the files in one of the first three runs, because the short version in the skill's body felt like enough. The skill now begins with a rule ("before you write a single line, open these files") and since then two runs in two opened five files each, including the ready CSS and JavaScript.
- **Nokka (Design)** (`app/tests/ui-details-nokka.mjs`), asked to do the flat test on the page and say what to add, with no file touched. Three runs used the skill and read its files, wrote no file, and answered moment by moment, in a table, with timings, reduced motion, the keyboard and spoken changes.
- **Not tried:** sound; a real project of the owner's; a worked before-and-after example page (offered, not chosen).

## 6. How to redo the research
`git clone --depth 1 https://github.com/DavidHDev/react-bits.git` into a temp folder (never inside `D:\kona-refs`, never a Claude working folder: its own files would be loaded as instructions). The main places: `src/tailwind/<Group>/<Name>/` (code), `src/constants/Information.js` (descriptions), `src/css/variables.css` and `skeleton.css` (tokens), `src/hooks/` and `src/utils/inputMode.js` (governors), `src/sounds/` (sound).
