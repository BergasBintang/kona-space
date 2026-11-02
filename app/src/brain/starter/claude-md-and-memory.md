---
title: CLAUDE.md and Claude's memory
kind: starter
source: starter
checked: 2026-10-28 (Claude Code documentation)
---
# CLAUDE.md and Claude's memory

## CLAUDE.md
CLAUDE.md files are instructions you write. Claude reads them at the start of every session: a personal one in your home `.claude` folder, one at the project root and optional ones in subfolders. Keep each under about 200 lines; longer files cost context and are followed less well. Contradicting instructions make Claude pick one at random, so review them now and then.

## Auto memory
Claude also writes its own notes from your corrections and preferences. They live in a memory folder for the project, with an index file `MEMORY.md`. Only the start of the index (about the first 200 lines) is loaded into each session.

## Kona and Claude's memory
Kona reads Claude's memory folder into the brain as a separate, read-only layer. Each note shows its date, because a memory records what was true when it was written. Kona never writes there. See [[how-the-brain-works]].

## What Kona tells every session, and what stays out of CLAUDE.md
Kona gives each session its own rules at the start: where to keep lasting knowledge (the brain's `save_note`), how to write files so Kona's reader draws them, and how to use the board. They live inside the program, so every Kona update replaces them for everyone. Do not copy them into a CLAUDE.md: that copy would go out of date, and sessions are told to follow Kona's current rules over an older one. Keep CLAUDE.md for what is true about your project and must be followed in every session.

## Instructions are context, not a lock
Claude treats CLAUDE.md as guidance. To force something, use a permission rule or a hook. See [[skills-mcp-and-hooks]] and [[roles-and-permission-modes]].
