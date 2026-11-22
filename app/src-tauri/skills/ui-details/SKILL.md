---
name: ui-details
description: Use when a screen feels flat or lacks states, motion, hover and press feedback, tooltips, loading or confirmations.
---

# UI details

A flat screen is one that does not answer the person. They press and nothing moves. They wait and see nothing. A job ends and nothing changes. This skill is a small library of the details that make a screen answer, and the rules that keep it calm, fast and usable for everyone.

Motion is never decoration. It says "I heard you", "this is happening" or "this changed". If a detail does not say one of those, leave it out.

## The rule

**Before you write or change a single line of code or design, open the files this skill points to.** The short version below is a reminder, not a replacement: the details (timings per kind of change, patterns, tested code) are in the files, and a screen made from memory comes out flat or wrong. In order: `templates/flat-test.md`, then `templates/motion-tokens.css`, then the pattern file that fits (step 3).

## The short version

- One small set of timings, written once, used everywhere: ease-out `cubic-bezier(0.23, 1, 0.32, 1)` for things that appear or answer, ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)` for things that move or change shape; press 120 ms, tooltip 160 ms, menu 200 ms, panel 280 ms.
- Animate opacity and transform only. Never width, height, top or left.
- Feedback answers at once: a press goes down (scale 0.97) in 120 ms. Hover and focus change colour, not position.
- Every moment of waiting, success and failure shows something and says it in words too (a status region, polite for ordinary news).
- Numbers use tabular digits and a minimum width, and count to the new value instead of jumping.
- Reduced motion changes the screen (shorter, fades, no bounce or spin); it does not just delete the answers.
- Every hover has a keyboard twin. Loops pause when hidden. No library, no heavy effect.

## Steps

1. **Read what the project already has.** Its timings, easing, how hover and press look, whether it uses a motion library. Follow that. Only when it has none, open `templates/motion-tokens.css` and copy it into the project's styles (it holds the set above and the base styles that use it, with plain default colours to replace), and open `references/motion-scale.md` for the full table of what gets which time.
2. **Do the flat test.** Open `templates/flat-test.md` and fill it in for the screen before you write any code. For each moment (press, hover, focus, wait, success, failure, empty, a number changing, leaving) write whether the screen answers or stays silent.
3. **Fix the silent moments, biggest first. Do not work from memory: open the file for each kind you touch before you write the code.**
   - A task, a tool call, a thinking line, a chat box, a confirmation or an undo: open `references/patterns-agent-screens.md`.
   - Buttons, tooltips, numbers, switches, menus, lists, loading, drag: open `references/patterns-everyday.md`.
   - Code you can use (plain CSS and a little JavaScript, no library, tested): open `references/snippets.md` to see what each piece is and how it is styled, then copy `templates/ui-details.js` into the project and import only the functions you need. Its styles are in `templates/motion-tokens.css`.
4. **Check the rules before you call it done.** Open `references/safety-rules.md`. Reduced motion, the keyboard twin of every hover, spoken changes, touch, cleanup and speed are not extras. A detail that breaks one of them is a bug.
5. **Keep it calm.** At most one bigger moment in each area of a screen. Everything else is small and short. Open `references/what-to-skip.md` before you reach for a heavy effect, a library or a looping background.
6. **Look at it moving.** Run it in a real browser or window if you are allowed to. Check it with reduced motion on, in a narrow window, and with the keyboard only. A still picture cannot show motion; say so, and say what you saw yourself and what you could not check.

## If the project has a pixel or blocky look

Move pixel-drawn things (marks, bars, sprites) in steps (`steps(8)` and the like) so they stay on the grid. Keep smooth easing for panels, menus and tooltips. Follow the project's own look first; these timings give lengths, the project's look gives the character.

## What to hand over

For each moment you changed: what the person now sees, the timing you used (the names from the project's set), what happens with reduced motion, and what you chose not to do and why. Name what you could not check.
