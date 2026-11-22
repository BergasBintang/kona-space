# Details for screens where an agent works

Screens that show an AI agent or any long job have the same moments: it is waiting, it is working, it used a tool, it finished, it failed, you may want to stop it or undo it. Each moment should answer the person. Timings use the names from `motion-scale.md`.

## 1. The status mark (one small mark for every state)

One mark, the same size everywhere, that changes shape as the state changes.

| State | The mark | Word beside it or in its label |
|---|---|---|
| Waiting (queued) | A dashed ring, still | "Waiting" |
| Working, length unknown | A ring with a short arc that turns | "Working" |
| Working, length known | The arc grows with the percentage | "Working, 40%" |
| Done | The ring fills and a check is drawn | "Done" |
| Failed | The ring fills and a cross is drawn | "Failed" |
| Stopped | A small square | "Stopped" |

- The change from one state to the next takes about 300 ms with `--ease-in-out`. The check or cross is drawn over about 240 ms after a 120 ms pause, so the eye sees the ring settle first.
- A finished task can fade its label to about 0.4 opacity and strike it through about 60 ms after the check starts.
- The state is always said in words too (a label next to it, or a hidden label for screen readers). Colour and shape alone are not enough.
- With reduced motion: switch state at once, no turning.

## 2. A tool call as a chip

For "the agent ran this command" or "it read this file": a small chip with an icon, the name, the main argument and a live timer.

- A fill wipes across the chip while it runs. It follows an expected time, **and stops at 90 percent** until the call really ends. Then it completes.
- Done: the chip turns the "done" colour and shows a check. Failed: it shakes sideways about 6 px (seven positions, 0.77 curve, about 350 ms) and offers **Retry**.
- The timer shows milliseconds under 10 seconds ("340 ms") and seconds after ("12.4 s"). Use tabular digits and a minimum width of about 6 characters so the chip does not change width as the numbers change.
- The chip announces itself as a status area, marked busy while it runs, and one polite spoken line when it ends ("npm test, done in 12.4 seconds").
- Update the timer text directly on the element, not through a redraw of the whole screen on every frame.

## 3. The thinking line

While the agent works with no visible output, show one line: a small glyph that breathes, the word ("Thinking…") with a slow shimmer, and a stopwatch.

- When it ends the line settles into "Thought for 12.4 s" over about 350 ms and folds its steps away. A click opens them again.
- If the steps are shown while it works, new ones slide in at the end; do not rearrange the old ones.
- With reduced motion: breathe less (down to 0.8 to 1) and slower (1.5 times as long), keep the stopwatch. Do not remove the line.
- A hidden live region says "Thinking" once at the start and "Done thinking, 12 seconds" at the end. Do not announce every tick.

## 4. The chat box

- It grows with the text up to **5 lines**, then scrolls inside itself. Keep the Send button in place as it grows.
- Enter sends, Shift+Enter makes a new line. **Enter must not send while the person is composing text with an input method** (Japanese, Chinese, Korean and others). Check the composing flag. This is a real bug in many chat boxes.
- **While the agent works, Send becomes Stop.** The arrow morphs into a square over about 300 ms. One button, one place, and its label says what it will do.
- A message written while the agent works waits in a visible queue above the box, each with a Remove button, and is sent by itself when the answer is done. A "Send now" stops the current answer and sends it first.
- Picking a source with `@` or a command with `/` opens a small list under the cursor: arrows move, Enter or Tab picks, Escape closes.

## 5. Hold to confirm

For things that cannot be taken back (delete, end, publish). Better than a "Are you sure?" box that people click through without reading.

- The button fills while it is held, **about 2 seconds**. If it is let go, the fill drains back in about 200 ms and nothing happens.
- Letting go is not the only way out: switching to another window, hiding the tab or moving the pointer far away also cancels it.
- Keyboard: holding Space or Enter does the same. A quick press under 250 ms is a tap and only shows a hint ("Hold to delete"). The hint is attached to the button with a description so screen readers read it.
- With reduced motion: the fill becomes a plain fade over the same time.

## 6. Undo instead of "are you sure"

For things that can be taken back (archive, move, remove from a list): do it at once, then show **Undo** for about 4 seconds.

- A thin line burns down along the edge of the button or toast to show how long Undo stays. Hovering or focusing pauses it.
- When it runs out, the undo goes away quietly. Do not ask anything.
- Say what happened in words: "Archived 3 files. Undo".

## 7. A message that disappears

A toast shows for about 4 seconds, pauses while hovered, swipes down (or sideways) to dismiss after about 40 px, and has a button when there is an action. Its words are read out politely when it appears. It never hides an error that needs a decision; an error stays until it is dismissed.

## 8. Progress that is honest

- Unknown length: a turning mark, never a bar that fills by itself.
- Known length: a bar or arc that follows the real number. Show the number.
- Estimated: hold at about 90 percent and finish only when it is done.
- When a job runs more than a few seconds, show how long it has been running.
