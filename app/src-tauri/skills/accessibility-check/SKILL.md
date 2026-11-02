---
name: accessibility-check
description: Use when checking whether a screen can be used by everyone, including with a keyboard, a screen reader, large text or poor sight, or when building a form, dialog or menu that must be accessible.
---

# Accessibility check

Use it, do not only read about it. Unplug the mouse in your head and try the screen.

1. **Keyboard.** Tab through everything. Can every action be reached and used? Is the order sensible? Is the focus always visible? Does Esc close what opened, and does the focus come back? Does anything trap you?
2. **Names.** Every button, link and field has a name a screen reader can say. An icon-only button needs a label. A field needs a real label, not only a placeholder.
3. **Structure.** Real headings in order, real buttons and links instead of clickable boxes, lists as lists.
4. **Colour and contrast.** Measure, do not guess: normal text at least 4.5 to 1, large text and shapes at least 3 to 1. Never colour alone for state.
5. **Size.** Zoom to 200 percent: nothing cut off. Things to click are comfortably large, at least 24 by 24 pixels.
6. **Motion.** Respect the reduced-motion setting. Nothing flashes more than three times a second.
7. **Forms and errors.** The error sits by its field, says how to fix it, and is announced.

Open `references/wcag-short.md` and go down its list before you report. Report each problem with where it is, who it stops, and the fix, worst first. Say plainly what you could not test (for example with a real screen reader).
