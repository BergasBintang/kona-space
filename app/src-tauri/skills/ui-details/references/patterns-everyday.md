# Details for everyday screens

Timings use the names from `motion-scale.md`. Ready code is in `snippets.md`.

## Buttons and clickable things

- **Press:** goes down to scale 0.97 (or a darker shade) in 120 ms and comes back on release. It answers on pointer down, not on release.
- **Hover:** a colour change in 120 to 160 ms. No movement, so nothing under the pointer shifts.
- **Focus (keyboard):** a clear outline, 2 px, with a 2 px gap. Everything that reacts to hover must have the same reaction on focus. Hover-only features are bugs on a keyboard and on a touch screen.
- **Disabled:** lower contrast, no hover, a reason in a tooltip or nearby text.
- **Busy:** the button shows it is busy, keeps its width and cannot be pressed twice.
- **Done:** the word or mark changes for about a second ("Saved") and goes back.
- **Hit area:** at least 44 by 44 px for a finger. A small icon can have invisible padding.
- Do not let text be selected while pressing (`user-select: none` on the control).

## Tooltips

A tooltip is a short name or hint for a control. Plain browser tooltips (the `title` attribute) are slow, plain, and do not show for the keyboard or touch.

- **Cold start:** wait about 400 ms before the first tooltip shows.
- **Warm rule:** for about 300 ms after a tooltip closes, the next one opens at once. Moving along a row of icons then feels instant.
- **Moving between neighbours:** the text slides about 10 px and crossfades (with a 3 px blur) in 140 ms instead of closing and reopening.
- **Leaving:** wait about 80 ms before closing, so the pointer can cross the small gap to the tooltip.
- **Placement:** on the side with room, at least 8 px inside the window edge, with a small arrow or a 6 px gap.
- **Keyboard:** show it on focus too. Escape closes it.
- **Touch:** show it on a long press, not on a tap.
- Keep it to a few words. If it needs a paragraph, it is not a tooltip.

## Numbers that change

- Use **tabular digits** (`font-variant-numeric: tabular-nums`) so each digit has the same width, and give a changing number a **minimum width**, so the line around it never shivers.
- A number that jumps feels cheap. Let it **roll or count** over 400 to 700 ms with `--ease-out`: the digits that change move up (or down when the value falls), one digit after the next, about 40 ms apart.
- A screen reader should hear the final number once, not every step. Put the final number in hidden text and mark the rolling digits as hidden from screen readers.
- Format with the person's locale (separators, decimals, currency).
- Colour a number only when it carries a state (near a limit), and add a mark or word too.

## Switches, checkboxes and choices

- **Checkbox:** the box fills and the tick is drawn in one smooth motion (about 240 ms). A checked item in a to-do list can fade and strike through a moment later.
- **Switch:** the thumb slides in 200 ms; the track changes colour in about 300 ms. Dragging it works as well as clicking. It has a label in words.
- **Segmented control or tabs:** one highlight slides (and stretches a little) from the old choice to the new, in about 220 ms, instead of two things switching. Arrow keys move between choices.
- **Radio chips:** the chosen one grows a little (1.03) and the others make room.

## Menus, selects and popovers

- Open **from the control**: set the transform origin to where it opened. Scale from 0.95 and fade in over 180 to 200 ms.
- The highlight **glides** between rows (about 220 ms) instead of jumping. It remembers where it was.
- Arrow keys, Home and End, type-ahead, Enter to pick, Escape to close and give focus back to the control.
- Keep the list inside the window; flip it up when there is no room below.

## Lists

- **Entering:** rows fade in and rise about 8 px, 200 ms each, 40 ms apart, for the first 8 only.
- **Leaving:** the row fades in 200 ms, then the gap closes.
- **Reordering or inserting:** move the other rows with a transform, so they slide to their new places and do not jump.
- **A row you can swipe:** it follows the pointer, shows its actions behind it, snaps open past about 40 percent, and a long swipe (about 60 percent) does the main action. Always have a visible button as well, for people who cannot swipe.
- **Selection:** the selected row's highlight slides in; keep the selected row in view while arrow keys move it.

## Loading

- Keep the layout still: the placeholder takes the space the real content will take, so nothing jumps when it arrives.
- Show a placeholder only if loading takes more than about 140 ms. Fade it in over 240 ms and pulse it every 1.8 s.
- Swap to the real content with a short fade (200 ms), not a hard cut.
- A very short wait gets no spinner at all. A wait over a few seconds says what is being waited for, and for how long it has been.

## Moving between views

- A fade of about 300 ms between pages or tabs. Keep the scroll position when going back. Move focus to the new view's heading.
- Prepare the next view when the pointer goes over its link or it gets focus (a prefetch), so the page opens instantly.
- If the app has a look made of pixels or blocks, a transition made of small squares appearing in a random or spreading order (a grid of 8 to 12 across, about 400 ms in all) fits it. Keep it short and skip it for reduced motion.

## Drag and slide

- Take the pointer for the whole drag (pointer capture) so it keeps working when the pointer leaves the control.
- Tell the browser how the control moves (`touch-action`) so a drag does not scroll the page.
- Past a limit, move only about half as far as the pointer. Let go and it snaps back with a small bounce.
- A "slide to confirm" handle spins while the action runs and turns into a done mark. It must have a plain button as an alternative.

## Small touches that help

- A tiny burst at a click or a gentle sweep of light over a card on hover can add life. Use one of them, rarely, and never on the main action of a serious screen.
- Show **how long** things took ("Saved in 0.4 s", "Thought for 12 s"). It is a quiet detail that people like.
- A short, soft sound for "someone is waiting for you" is useful when the app is in the background. It must be off until the person turns it on, and it must be quiet and under 0.3 s.
