---
title: Context and cost
kind: starter
source: starter
checked: 2026-10-28 (Claude Code documentation)
---
# Context and cost

## Why cost grows
Cost follows how much Claude has to read. Every request carries the whole conversation plus the results of every tool it ran. Prompt caching makes repeated text cheaper, but a long conversation is still a large request each time. The first message after a long break misses the cache and costs more.

## What helps
- **Clear between tasks.** A new session for unrelated work costs nothing to start; a stale context wastes tokens on every later message.
- **Compact when you must continue.** Summarising a large conversation is itself a large request, so do it before the context is huge, not after.
- **Pick the model to match the job.** Sonnet handles most work; keep Opus for hard design or long reasoning; Haiku suits simple, quick jobs.
- **Be specific.** "Add input validation to the login function in auth.ts" reads a few files. "Improve the codebase" reads many.
- **Use plan mode first on big changes.** Agreeing on the approach before editing avoids expensive redoing.
- **Keep instructions short.** CLAUDE.md is loaded into every session; long, rarely needed instructions are better as skills, which load only when used. See [[skills-mcp-and-hooks]].
- **Turn off tool servers you do not use.** Their descriptions take space.

## What the numbers mean
Dollars shown in Claude Code and in Kona are an estimate at list price. On a Pro or Max plan you pay a flat fee, so they are for comparing sessions, not a bill. The plan bars show how much of your 5-hour and weekly allowance is used. See [[kona-costs-and-plan-bars]].
