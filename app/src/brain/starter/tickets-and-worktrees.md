---
title: Tickets and worktrees
kind: starter
source: starter
checked: 2026-10-28
---
# Tickets and worktrees

## A ticket is one job
A ticket has a title, what needs doing, how you can tell it is done, a role and a next step. Small tickets with a clear "done when" give agents something to check their own work against. See [[good-tickets-and-prompts]].

## A worktree is a second working copy
A worktree is another folder of the same repository on its own branch. Two agents working in two worktrees cannot overwrite each other's files, and your main folder stays as it was. Kona puts them in the project's hidden `.kona/worktrees` folder.

## The cycle
1. Write the ticket and give it a role.
2. Start a session from the card: Kona makes the branch and the copy, and tells Claude which ticket it is on.
3. The agent works, commits on its branch and moves the card to Review with a next step.
4. You read the diff. If it is good, merge from the Worktrees place. Git checks for clashes first.
5. Done means merged. Only you move a card to Done.

## Things to remember
- A new copy has no installed packages (for example `node_modules`); install them there before running tests.
- Remove a copy only when its work is merged or you mean to throw it away.
- See [[kona-board]] for how agents raise and update tickets themselves.
