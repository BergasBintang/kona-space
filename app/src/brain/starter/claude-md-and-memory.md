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

## Instructions are context, not a lock
Claude treats CLAUDE.md as guidance. To force something, use a permission rule or a hook. See [[skills-mcp-and-hooks]] and [[roles-and-permission-modes]].
