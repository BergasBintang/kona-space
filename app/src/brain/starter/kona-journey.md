---
title: The journey of a product: one note that holds the whole map
kind: starter
source: starter
---
# The journey of a product: one note that holds the whole map

A journey is the path a person takes through a product, written once, in one note. Every other view of the path (a drawing, a table, a clickable page) is made from that note. Never keep a second copy of the path in another note, a picture or a page. When the path changes, change this note in the same ticket.

## Where it is saved

- It is a project note whose front matter says `kind: journey`. Save it with the `save_note` tool, with the kind journey, like any other note. Keep the block compact, one step on each line, because a note saved that way holds at most 60 KB.
- The map itself is one block between a line that starts with three backticks and the word `journey`, and a line of three backticks. A journey note holds exactly one such block, and any plain words around it.
- Kona reads the block and checks it. A mistake is reported in plain words, with the step it is about. It never stops Kona from opening the note.

## What a step holds

- `id` (lower case letters, numbers and dashes), `name` (plain words a non-technical person understands, such as Upload CV) and `lane` are always written.
- `kind` is `step` or `screen`. `status` is `built`, `in-progress` or `not-built`; leave it out and it means not built.
- `next` lists where the person goes after this step. A branch has a `label`, the choice that leads there. `start` marks where a path begins and `end` where it stops.
- `actor` says who acts: `person`, `system`, `ai` (with `ai` saying what it does and which model), or `people` (one person talks to another person). A lane can name its usual actor, so a step only writes it when it differs.
- `access` lists the user kinds who can reach the step. The user kinds are listed once at the top, under `users`. They are the product's own kinds of user (a guest, a member, an admin), never Kona's roles.
- `updated` is the day someone last checked the step against the product, written 2026-11-13. `mockup` names the mockup folder in the Mockups sheet and, if needed, its page, such as `photo-albums/sign-in.html`. `tickets` and `notes` name what decided it. `see` points to a diagram of the database, the servers or a login that stays separate.

## A screen holds only what changes where the person goes

A screen step lists its key `fields`, its `buttons` (each with the step it leads to), and the `errors` the person can run into (each with the step it leads to). Only parts that change where the person goes next, or that can block them, belong here: a wrong password, an unreadable file. Styling, layout and hover states do not. The full detail stays in the mockup.

## What is checked

These are checked by script, without any model: a step that leads to a step that is not in the map, a step in a lane that does not exist, a user kind that is not listed, two steps with one id, a step that leads nowhere and is not an end, a step nothing leads to that is not a start, a screen with no mockup, a built step that names no ticket and no note, and an AI step that does not say what the AI does.

## Keeping it current

- A ticket that changes a step, a screen, a field or an error updates this note in the same ticket, saved with `save_note`, which stamps the ticket on the note. If nothing in the journey changes, write the line `Journey: no change` in the ticket's Done when.
- Kona draws the note on the Journey page of the Brain. A step whose ticket is finished, but whose journey was not saved under it and does not say no change, is marked. A mockup that changed after the step was last checked is only a hint.
- Each file that makes a page or a modal of a step carries one comment with the step's id, written by the worker inside the ticket (Kona never writes into your files): `kona-step: sign-in`, in any kind of comment. Kona searches the project for that text. A marker the map does not know is drawn as a draft step, Not confirmed. A built screen with no marker is marked No page found. A marker says only that a page exists; where the person goes next stays written in the map.

## A worked example

```journey
{
  "title": "Photo albums",
  "lanes": [
    { "id": "person", "name": "Person", "actor": "person" },
    { "id": "app", "name": "App", "actor": "system" },
    { "id": "server", "name": "Server", "actor": "system" }
  ],
  "users": [
    { "id": "guest", "name": "Guest" },
    { "id": "member", "name": "Member" }
  ],
  "steps": [
    { "id": "visit", "name": "Open the site", "lane": "person", "start": true, "access": ["guest"],
      "next": [{ "to": "sign-in" }], "status": "built", "updated": "2026-11-10", "tickets": ["T-0001"] },
    { "id": "sign-in", "name": "Sign in", "lane": "app", "kind": "screen", "access": ["guest"],
      "fields": ["Email", "Password"],
      "buttons": [{ "label": "Sign in", "to": "check-login" }],
      "errors": [{ "text": "Wrong email or password", "to": "sign-in" }],
      "status": "built", "updated": "2026-11-10", "mockup": "photo-albums/sign-in.html", "tickets": ["T-0002"] },
    { "id": "check-login", "name": "Check the login", "lane": "server",
      "next": [{ "to": "home", "label": "correct" }, { "to": "sign-in", "label": "wrong" }],
      "status": "built", "updated": "2026-11-10", "tickets": ["T-0002"] },
    { "id": "home", "name": "Your albums", "lane": "app", "kind": "screen", "access": ["member"],
      "buttons": [{ "label": "New album", "to": "suggest-title" }],
      "status": "built", "updated": "2026-11-11", "mockup": "photo-albums/home.html", "tickets": ["T-0003"] },
    { "id": "suggest-title", "name": "Suggest a title", "lane": "server", "actor": "ai",
      "ai": { "does": "Suggests a title from the photos", "model": "a small language model" },
      "next": [{ "to": "share", "label": "title accepted" }], "status": "not-built" },
    { "id": "share", "name": "A friend opens the link", "lane": "person", "actor": "people", "end": true,
      "access": ["guest"], "status": "not-built" }
  ]
}
```

Mockups: [[kona-mockups]]. Saving a note and how notes work: [[how-the-brain-works]]. Writing the ticket that changes the path: [[good-tickets-and-prompts]].
