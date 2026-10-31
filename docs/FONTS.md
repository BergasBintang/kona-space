# The interface font: why Jersey 20 (decision 58)

Done on 2026-10-31 for 0.26.1. Tags: (seen) checked on this PC, (not checked) could not be checked.

## The problem

Pixelify Sans in its bold weight (the weight every button and heading used) draws "c" almost closed, so it reads as "o": "Launch" looked like "Launoh", "Change account" like "Ohange aooount". The first answer (0.24.1) was more space between letters, which helps a little but does not fix the letter.

## What was tested (seen)

19 fonts, all from the `@fontsource` packages (licence field of each package on npm: OFL-1.1; the licence text inside each font file was not read, so this is *not checked* there). They were downloaded into a scratch folder only, never into the project.

1. **Look-alike letters.** Each pair (c/o, e/o, e/c, a/o, n/h, u/v, t/f, g/q) drawn at 13, 14 and 16 px, at screen scales 1, 1.5 (this PC) and 2. The score is how different the two pictures are (0 = the same picture). A rough proxy, not proof: it is only a number, so it was backed by looking at the real window.
2. **Width.** The 85 real labels of the app set in each font, against the current font.
3. **Characters Kona uses.** Every non-ASCII character in the interface text: … · “ ” ‘ ’ – — − × › and the accents. (The arrows ← ↑ ↓ are in none of the fonts, Nunito Sans included; they already come from the system.)
4. **The real window.** Each font was put into the running Kona (over the DevTools port). All 13 pages and the map editor were opened, and every piece of text in the pixel font was measured for spilling out of its box, being cut off, wrapping to more lines, and the page growing sideways. Done at the normal size and at 150%.

## Results

| Font | c against o (this PC, 14 px) | Width against now | In the real window |
|---|---|---|---|
| Pixelify Sans bold (what Kona had) | 0.03 (nearly the same picture) | 1.00 | 3 labels spill, 2 cut off |
| Pixelify Sans regular | 0.07 | 0.98 | 2 spill |
| **Jersey 20** | **0.17 (at every size and scale: 0.14 to 0.21)** | **0.77** | **nothing spills or is cut** |
| Jersey 15 | 0.17 here, 0.05 on a plain 1x screen | 0.76 | nothing spills |
| Jersey 10 / 25 | 0.12 / 0.09 | 0.72 / 0.78 | nothing spills |
| DotGothic16 | 0.13 (clear letters, but thin and blurry) | 0.93 | 2 spill |
| Handjet, VT323 | clear, but narrow and terminal-like | 0.69 / 0.76 | nothing spills |
| Tiny5, Bitcount | rough / same width as now | 0.86 / 1.01 | 1 to 3 spill |
| Silkscreen, Press Start 2P, Sixtyfour | all capitals and 1.2 to 2 times wider | 1.23 to 1.68 | rejected |
| Doto, Jacquard 12, Micro 5, Workbench | dotted, blackletter, tiny, dithered | | rejected by eye |

Jersey 20 won because its c and o stay clearly apart (0.14 or more) at every size and screen scale that were tried, it is a pixel-game font like the rest of Kona, it is about a fifth narrower (so long labels such as "Sonnet (the usual choice)" fit), and it is only 19 KB. Jersey 15 is nearly as good but its letters come close again on a plain screen.

## What changed

- `@fontsource/jersey-20` replaces `@fontsource-variable/pixelify-sans` (`app/package.json`, `app/src/index.css`).
- Jersey 20 has **one weight (regular)**. `index.css` now fixes the weight of headings, buttons and `.font-pixel` at 400 and turns fake bold off (`font-synthesis-weight: none`), so a `font-bold` class on a button no longer makes a smeared bold. A selected tab that used bold now only shows its underline.
- The letter spacing stays 0.1em. Text sizes are unchanged.

## After the change (seen)

Real window, 236 pieces of pixel-font text on 14 screens: 0 spill, 0 cut off, 0 pages wider than the window; the smoke test passed 52 of 52.

## Not checked, and how to go back

- Only this PC was tried (screen scale 1.5, window 1283 x 700 and the same at 150%).
- If a letter still looks wrong, send a crop with the screen and size. Going back is a change of two lines in `index.css` and `package.json`; Pixelify Sans stays in git history (0.26.0).
- The sizes were not scaled up for Jersey 20 (its letters are about 6% lower than Pixelify's); `font-size-adjust` could do that in one line if the text looks small.
- The lab used for the test is not in the repo (it was a scratch folder); the method above is enough to repeat it.
