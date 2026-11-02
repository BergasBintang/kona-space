---
name: design-an-api
description: Use when adding or changing an API, endpoint or service that other code depends on. Settles the shape, the errors, who may call it and how it changes later, before the code is written.
---

# Design an API

Changing an API after others use it is expensive. Spend the thinking now.

1. **Start from the caller.** Who calls it, and what do they need at that moment? Write the call as they would like to write it, then build towards that.
2. **Read the neighbours.** Follow the names, formats, errors and paging the project already has, even if you would do it differently. Two styles in one API are worse than one imperfect style.
3. **Write the contract first:** what goes in, what comes out, every error. Open `templates/contract.md` and fill it in.
4. **Decide who may call it.** Check who is asking and whether this record is theirs, on every call, on the server. The screen hiding a button protects nothing.
5. **Trust nothing that comes in.** Check type, size and range, and refuse clearly. Send back only the fields needed, never the whole database row.
6. **Plan for failure.** A call that may be retried must be safe to repeat. Set time limits on what you call. Lists always have a limit.
7. **Plan for change.** Adding is safe. Removing or renaming breaks callers: keep the old one working while they move.

Build it with `write-tests-first`: tests for success, for each error, and for "someone else's record". Keep changes small and say which files you changed.
