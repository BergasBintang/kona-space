---
title: Roles and permission modes
kind: starter
source: starter
checked: 2026-10-28 (Claude Code documentation)
---
# Roles and permission modes

## Permission modes
A permission mode decides what Claude may do without asking:
- **Ask every time (default):** reading inside the project is free; editing files and running commands ask first.
- **Edits free, commands asked (acceptEdits):** file edits and simple file commands in the project go through; other commands still ask.
- **Plan only (plan):** Claude reads and plans, and does not edit your source files.
- Claude Code also has **dontAsk** (refuse anything that would ask), **auto** (a checker decides) and **bypassPermissions** (skip prompts). Kona does not offer the last one in roles.

## Rules
Rules say yes, ask or no for specific tools and commands. They are checked in this order: deny first, then ask, then allow. The first match wins, so an allow rule can never undo a deny rule.

## What a role is in Kona
A role is a saved setup for a session: a model, a permission mode, a short brief and the local tools it needs. Pick the mode to fit the job:
- A **strict reviewer** (QA, Security): ask every time, so you see each step.
- An **auto builder** (Frontend, Backend): edits free, commands asked, inside its own copy of the repo. See [[tickets-and-worktrees]].
- A **planner** (Product): plan only, so it cannot change files.

Permission rules and modes are not a guarantee against a mistake in a command you approve. Read what you approve. See [[safe-habits]].
