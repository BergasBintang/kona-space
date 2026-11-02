---
name: write-a-brief
description: Use when an agreed idea needs writing down before it is built, as a product brief or PRD, so that design and engineering can work from it without asking what was meant.
---

# Write a brief

A brief answers "what are we making, for whom, and how will we know it is right". It does not say how to code it.

1. Check that the idea is agreed. If it is still vague, use `shape-an-idea` first.
2. Read what exists: earlier tickets, notes, the screens or code this touches. A brief that ignores what is there gets thrown away.
3. Open `templates/brief.md` and fill it in. Leave a heading out if it truly does not apply; do not pad it.
4. Write what people do, not what the system contains. "Sen can filter tickets by person" beats "add a filter component".
5. Make every requirement checkable. "Fast" is not checkable; "the list opens in under a second with 1,000 tickets" is.
6. Mark every guess with (guess). Never invent a number, a customer or a quote.
7. Read it as the person who will build it. Anything they would have to ask about, answer now or list under open questions.

Keep it to what one reader can finish in five minutes. If it runs longer, the piece of work is probably too big: split it.

Done when the owner has agreed it. Next comes `slice-the-work`.
