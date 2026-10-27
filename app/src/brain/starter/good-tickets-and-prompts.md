---
title: Good tickets and good prompts
kind: starter
source: starter
checked: 2026-10-28 (Claude Code documentation)
---
# Good tickets and good prompts

## Be specific
Name the file, the behaviour and the result. "Add input validation to the login function in auth.ts" is better than "improve login".

## Say how to check
Include the test to run, the screen to look at or the output you expect. When Claude can verify its own work it fixes mistakes before you see them.

## Small and self-contained
One ticket, one outcome. If you cannot write "done when" in two sentences, split it.

## Plan, then build
For anything big, start in plan mode, agree the approach, then switch to a mode that can edit. See [[roles-and-permission-modes]].

## Steer early
If Claude heads the wrong way, press Escape at once. Claude Code can rewind the conversation and the code to an earlier point. A short correction early is cheaper than a long fix later. See [[context-and-cost]].

## Good ticket shape
- Title: a few plain words.
- What needs doing: what and why.
- Done when: how you can tell.
- Role: who should do it.
See [[tickets-and-worktrees]].
