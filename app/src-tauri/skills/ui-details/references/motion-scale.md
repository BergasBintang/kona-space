# One small set of timings

Write these down once. A screen that moves with five different curves feels broken; one that uses the same two everywhere feels designed.

## The set

```css
:root {
  /* fast start, soft landing: things that appear or answer the person */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  /* slow-fast-slow: things that move from one place to another, or change shape */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  /* panels and drawers that slide in from an edge */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

  --dur-press: 120ms;    /* a button going down or up */
  --dur-tooltip: 160ms;
  --dur-menu: 200ms;     /* menus, popovers, small fades */
  --dur-panel: 280ms;    /* panels, drawers, dialogs */
}
```

Use `--ease-out` unless you have a reason. Never use plain `linear` for movement; it looks like a machine. Linear is right only for a clock, a spinner or a progress fill that follows real time.

## Which time for what

| What happens | Time | Notes |
|---|---|---|
| Press down on a button | 120 ms | Scale to 0.97 or darken. Let it come back on release at the same speed. |
| Hover or focus on a control | 120 to 160 ms | Colour or outline only. No movement. |
| Tooltip appears | 160 ms | Wait before it appears; see `patterns-everyday.md`. |
| Menu, select list, popover | 180 to 200 ms | Grows from the control that opened it (set the origin there). |
| Panel, drawer, dialog | 280 ms | The way out is a little faster, about 200 ms. |
| Page or view change | 300 ms | A fade. Keep scroll position and focus sensible. |
| A list row entering | 200 ms, 40 ms apart | Only the first 8 rows are staggered; the rest appear together. |
| A list row leaving | 200 ms | Collapse its height after it fades so the list closes the gap. |
| A bigger move across the screen | 360 to 520 ms | Rare. If you want this often, the screen is doing too much. |

Leaving is always a little faster than arriving. People are done with a thing when it leaves.

## What to animate

- Animate **opacity and transform** (move, scale, rotate). They are cheap and smooth.
- Do not animate width, height, top, left or margin. They make the page redo its layout on every frame. To open and close a box use a grid-rows trick or a clip, or fade it and move what is below it with a transform.
- A blur of 2 to 3 px while something swaps is fine for a short moment. Not as a permanent look.

## Springs, when the project has a spring tool

- Everyday interface changes: a spring that settles in about 0.3 s with **no bounce**.
- A little bounce (0.2) only for a happy, small confirmation: a tick, a counter, a like. Never for an error, a warning or a delete.
- A drag that is let go snaps back with a gentle bounce (0.2 to 0.4). Resistance while you drag past the limit: move only about half as far as the pointer (0.55).

## Loops (things that keep moving)

- Breathing: opacity between 0.55 and 1 over about 1.6 s.
- Shimmer or pulse: about 1.8 s a round. Never faster than 1 s.
- At most one loop in view in each area of a screen. Stop it the moment the thing is done.
- A loop must stop when its tab is hidden or it is off screen (see `safety-rules.md`).

## Waiting and delays

- Never delay feedback to a press. It answers at once.
- A placeholder for loading appears after about 140 ms, fades in over 240 ms and pulses every 1.8 s, so a fast load never flashes it.
- A spinner or a bar that shows "working" should hold at about 90 percent until the job really ends. A bar that reaches 100 and then waits is lying.
