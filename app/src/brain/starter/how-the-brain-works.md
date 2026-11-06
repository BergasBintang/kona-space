---
title: How the brain works
kind: starter
source: starter
---
# How the brain works

## A graph of linked notes
The brain is made of notes. A note can link to another with `[[its name]]`. Links make a map, and notes that link to each other end up in the same group.

## Three layers
- **Project:** your own notes in the project's `.kona/brain` folder. You can edit them.
- **Starter:** these notes, shipped with Kona. Read-only.
- **Claude's memory:** the notes Claude keeps for the project, read-only. See [[claude-md-and-memory]].

## One source of truth
The brain is the one place that says what is true: decisions and their reasons, facts the code does not show, research, reports, plans and work still open. A document is a note, so there is no second pile of documents to keep in step. Each fact lives in one note; the others link to it with `[[its name]]` instead of copying it. Your own notes live on disk in the project's `.kona/brain` folder. A sample PDF or a picture cannot be a note and stays where it is.

## Who writes notes
You can write notes in the Brain place. Kona also writes a short note when a session ends (kind `session`). And every session is told to keep lasting knowledge here, with its `save_note` tool: decisions with their reason, facts the code does not show, research results, reports, work still open. A session that works on a ticket gets that ticket written on its notes by Kona itself, so a note always says where it came from. Those notes say "Saved by a session". A session can change one section of a note it saved, or add to it. If you edit one, it becomes yours and no session can change it again. Sessions find notes with `search_brain` and `list_notes`.

## Trust
Notes are the current truth of the project, so sessions use them. When two notes disagree, or a note is older than the note it points to, a session says so and asks you, and does not guess. The code and git remain the last word on what the code does.

## Search
Every note is cut into sections at its headings. Searching looks through the sections and tells you plainly whether the answer is found, partly there, or not in the brain. A miss goes on the wanted list in the report.

## The report
The report lists links that go nowhere, notes nothing links to, the most connected notes, open items that have waited more than 30 days, notes that look like they hold a secret, and how your notes group.

## Secrets
Text that looks like a key or a password is hidden from the search index and flagged. See [[safe-habits]].
