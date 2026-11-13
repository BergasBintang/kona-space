---
title: Kona Mockups: the built-in viewer and its device sizes
kind: starter
source: starter
---
# Kona Mockups: the built-in viewer and its device sizes

Kona has a viewer for mockups built in. A mockup is a small web page that runs by itself with made-up data. The owner opens it from the big screen in the Lounge (the Mockups sheet) and clicks through it in a drawn device. Do not build your own previewer, and do not tell the owner to open the files in a browser: the Mockups sheet is where a mockup is looked at.

## Where a mockup is saved

- A mockup is saved in the project's main folder, at `.kona/mockups/<card>/`. One folder is one mockup (Kona calls it a card). The start page is `index.html`; the pages of a mockup link to each other like a real site.
- A session in a ticket's own copy does not hold that folder (Git does not track `.kona`). It may read the main folder's mockups and may not change them. See [[tickets-and-worktrees]].

## The five devices and their sizes

The viewer draws five devices. The page runs at the true size of the device, in CSS pixels: its width, its height and its media queries are the device's, never the window's. The whole device is only shown smaller to fit the sheet.

| Device | Screen, upright (width × height) | Turned on its side |
|---|---|---|
| Small phone | 320 × 568 | 568 × 320 |
| Phone | 390 × 844 | 844 × 390 |
| Tablet | 768 × 1024 | 1024 × 768 |
| Laptop | 1024 × 640 | does not turn |
| Desktop | 1440 × 900 | does not turn |

The viewer starts on the Laptop and remembers the last device the owner picked. The widths to design for and to check are 320, 390, 768, 1024 and 1440 pixels. When you say you checked a mockup, say which of these widths you looked at.

## What the owner can do there

- Click through the pages, fill the forms and try the made-up accounts. The page runs its own scripts, and it cannot reach the web, Kona or anything outside its own folder. It loads again by itself when one of its files changes.
- Zoom in up to twice the true size, move the page around by hand, and go back to the fit.
- Pick a part of a page, and leave a numbered note on it. The notes are listed beside the page.
- Send the notes: Kona turns them into a ticket for the design person.

## Showing the project's journey

A mockup can show the journey note of the project without a copy. Its `mockup.json` names the note with `"journey": "<note id>"`, and its page asks for the address `_kona/journey.json`, which answers with the note's map, fresh each time. Only a note of kind journey can be read that way, and only its map. The page template is in the skill `make-a-mockup`. The format of the note is in [[kona-journey]].

## Skills for mockups

- `make-a-mockup` draws a new page that runs by itself.
- `reverse-a-mockup` reads a built project's own source and copies a few pages as a mockup.
- `build-from-a-mockup` turns an agreed mockup into the project's own code and compares the two at the five widths.

Other screens: [[kona-screens]]. Writing a ticket for the design person: [[good-tickets-and-prompts]]. The path through a whole product, which a mockup page can show: [[kona-journey]].
