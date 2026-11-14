---
name: build-a-journey
description: Use when a project needs its journey written down as one note, the map of what a person does in the product, or when that note is missing, wrong or out of date.
---

# Build a journey

The journey is the path a person takes through the product, written once, in one note. Kona draws it on the Journey page of the Brain and checks it. Everything else (a picture, a table, a clickable page) is made from that note, so there is never a second copy to keep up to date.

## Before you write

1. **Look first.** Search the brain for a note of kind journey. If there is one, read it and change it; do not start again. If the owner's notes describe the path in several places, read them all, and write down where they disagree instead of choosing.
2. **Learn the format.** Read the starter note `kona-journey` with `read_note`. Open `templates/journey.md` for a note to start from.
3. **Read the product, not your memory of it.** List the routes and the pages of the project, and the cards in `.kona/mockups`. List the tickets with `list_tickets` to see what is built. Do not run the project's server, and never use real people's data.

## Writing it

1. **Ask only what the files cannot say:** the kinds of user (a guest, a member, an admin), the lanes if the project needs others than Person, App and Server, and where an AI takes part and which model. Ask once, with the options. Read first what the code already says, and treat it as fact: the router and its guards (which screens exist and who may open them), the layout or menu each part of the product uses, and the links between screens. If the product has parts with their own layout and menu (a sign-in part, a main part, an admin part), write them as `layers` and give every step its `layer`. If access is given in more than one way (a role and a duty at a branch), give each kind of user its `system` and put what only narrows access, such as "own branches only", in `limits`. The starter note `kona-journey` shows both.
2. **Start from the person.** Write the Person lane first: what someone sees and clicks, in plain words a non-technical reader understands ("Upload CV", not "POST /cv"). Then the screens in the App lane, then the work behind them in the Server lane.
3. **A screen lists only what changes where the person goes:** its key fields, its buttons and links with where each leads, and the errors the person can meet in the product's own words. Not colours, layout or hover states; the mockup has those.
4. **Every step says where it leads.** Put the choice on a branch (`correct`, `wrong`). Mark where a path starts and where it ends.
5. **Be honest about the status.** `built` only when you saw the page or the code. A guess is `not-built`. Write `updated` only for a step you checked against the product today. Never invent a step: when you are not sure it exists, leave it out and say so in your answer.
6. **Name what decides each step:** its mockup (the folder in Mockups, and the page when needed), its tickets, and the notes that explain it.
7. **Keep the block compact:** one step on each line, no blank lines. `save_note` takes at most 60 KB, and a long journey must still fit in one note.

## Check it before you save

Write the text of the note to a scratch file outside the project, open `templates/check-journey.mjs`, and run it with Node on that file. It reports each mistake in plain words with the step it is about. Fix every error and every warning you can; say plainly in your answer which warnings you left and why. Then save the note with `save_note` as kind journey.

## Markers

Each file that makes a page or a modal of a step carries one comment with the step's id, `kona-step: <id>`, in any comment syntax. If you may change code in this ticket, add them. If not, raise one ticket for the frontend person listing each page file and the id it needs. Kona never writes into the owner's files.

## Hand over

Tell the owner in a few lines: how many steps, how many are built, the kinds of user, every warning that is left and why, the places where the owner's notes disagreed, and what you did not cover.
