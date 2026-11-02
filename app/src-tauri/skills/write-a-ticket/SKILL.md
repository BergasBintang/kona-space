---
name: write-a-ticket
description: Use when turning something the owner wants into one small ticket for one person, with a short title, why it matters, what to do, and how to tell it is done.
---

# Write a ticket

A ticket is one small piece of work for one person. If it needs two people, make two tickets.

Before writing, call `list_tickets` and make sure it is not there already. If it is, add to that one with `update_ticket` instead.

Open `templates/ticket.md`, then write it with `create_ticket` in that shape. Good tickets have:

- **A title** that is a verb and a thing, under 8 words: "Add a Save button to the form".
- **Why** in one sentence: what the owner gets from it.
- **What to do:** the smallest change that works. Name the files or screens if you know them; do not guess paths.
- **Done when:** two or three checks anyone can run, written as what you would see. "The form saves and shows a message", not "works correctly".
- **Not part of this:** what the person should leave alone.
- **The right person**, by name and job: for Jiro the Frontend. If you are not sure who, open `references/who-does-what.md`.

It starts in Backlog. Mark it Ready only if nothing is still unclear and the person could start now. Afterwards tell the owner in one line what you raised and for whom.
