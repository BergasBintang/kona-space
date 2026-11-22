# Rules every detail must keep

If a detail breaks one of these, it is a bug. Check them before you hand a screen over.

## Reduced motion: change it, do not just switch it off

People who ask for reduced motion (a system setting, `prefers-reduced-motion: reduce`) get sick from large movement, zoom, spinning and parallax. They still need to see that something changed.

- Remove: movement across the screen, zoom, parallax, bounce, spinning, big shakes and looping backgrounds.
- Keep, and shorten if you like: fades, colour changes, a changing number, a progress mark.
- Replace, do not delete: a slide becomes a fade; a hold-to-confirm fill becomes a plain fade over the same time; a breathing glyph breathes less (opacity 0.8 to 1) and slower; a shake becomes a brief colour flash.
- A blanket rule that sets every animation and transition to zero also removes the answers people need. Use it only as a last safety net.

## Everything that reacts to a pointer has a keyboard twin

Hover has focus. A drag has arrow keys. A swipe has a button. A long press has a menu key or a button. A tooltip shows on focus. Test the screen with the keyboard only.

## Say the change out loud

- A status that changes (working, done, failed) lives in a region marked as a status (`role="status"`), marked busy while it works. Say the new state once, politely (`aria-live="polite"`). An error that needs a decision may interrupt (`role="alert"`).
- A rolling number or a ticking timer is hidden from screen readers while it moves; the final value is in text that is read.
- Every icon-only control has a name. Every state shown only by colour or shape also has a word.
- A progress mark says its value (`aria-valuenow`, `aria-valuetext` such as "High").

## Touch and pointer

- Take the pointer for a drag (`setPointerCapture`) and release it at the end.
- Declare how a control moves (`touch-action: none` on a slider handle, `pan-y` on a horizontal swipe row).
- Hit areas of at least 44 px. Do not rely on hover for anything that matters.
- Turn off text selection and the touch highlight on controls that are pressed or dragged.

## Clean up and pause

- Everything that starts must stop: cancel animation frames, clear timers, remove listeners, stop observers, close audio. Do it when the thing leaves the page.
- **Pause when the tab is hidden** and **pause when it is off screen** (an intersection observer with a margin of about 100 px). A loop nobody can see must not use the processor.
- Do the work of an animation that runs every frame (a timer, a position) directly on the element, not by asking the framework to redraw the whole component on every frame.
- Stop a loop when its thing is done.

## Speed on a small or old computer

- **Cap the pixel density at 2** for anything drawn on a canvas. A sharp screen at density 3 costs nine times the work of density 1 for no visible gain.
- Draw only when the size changes; watch the element's size instead of the window's.
- Keep the number of moving things small. Past about 8 rows entering together, stop staggering.
- **A speed governor:** after about 1.5 s of warm-up, measure the middle frame time over 60 frames. If it is over about 24 ms (under 40 frames a second), step down one level: lower the density, drop the glow and the blur, then turn effects off. Remember the level for the session. Start at the lowest level on 2 or fewer processor cores, 2 GB of memory or less, or when the person asks for less transparency. Ignore frames measured while the tab was hidden. Code is in `snippets.md`.

## Text input

- A message box sends on Enter only when the person is not composing text with an input method.
- Never remove focus from a text field because something animated.

## Keyboard focus rings

Show a clear ring for keyboard users. If the project hides it for the mouse, keep it for the keyboard: notice the last kind of input (a key like Tab or an arrow, or a pointer press) and mark the page, so styles can use it.

## Sound

Off until the person turns it on. Short (under 0.3 s), quiet, never the only sign of something (always paired with a visible one), and never used for success of ordinary actions.
