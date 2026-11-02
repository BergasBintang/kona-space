---
name: build-a-screen
description: Use when building or changing something people see and click, such as a screen, form or component. Matches what the project already has, handles every state, and is checked in the real window.
---

# Build a screen

Keep changes small and say which files you changed.

1. **Know what done looks like.** Read the ticket and any design notes. Unclear? Ask one question before coding, or name the assumption you made.
2. **Read the neighbours.** Find the closest thing in the code. Use its components, colour names, spacing and patterns. Search before you write a new component; a second copy of a button is a bug waiting to happen.
3. **Change as little as possible.** No clean-up on the way unless the ticket asks for it. Note what else you saw and leave it.
4. **Handle every state:** loading, empty, failed, a lot of content, busy while saving. A screen that only works when all goes well is not finished.
5. **Keep work safe.** Double clicks, leaving with unsaved changes, a slow answer arriving after the person moved on.
6. **Basic access:** real buttons and labels, keyboard works, focus is visible. For more, see the skill `accessibility-check`.
7. **Logic that can break gets a test;** see `write-tests-first`.
8. **Look at it.** Run the program, open the screen, do the job with your own hands, make the window narrow. Passing tests do not prove that a screen looks right. If you cannot run it, say so.

Report the files changed, what you checked by eye, and what you did not check.
