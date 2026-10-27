---
title: Skills, tool servers and hooks
kind: starter
source: starter
checked: 2026-10-28 (Claude Code documentation)
---
# Skills, tool servers and hooks

## Skills
A skill is a folder with instructions that Claude loads only when it needs them. Put detailed, occasional instructions (a review checklist, a release routine) in a skill instead of CLAUDE.md, and every session stays lighter.

## Tool servers (MCP)
A tool server gives Claude new abilities: reading a database, driving a design tool, raising Kona tickets. Each connected server adds its tool names to the context, so connect only what the job needs and turn the rest off. A command-line tool such as `git` or `gh` is lighter than a server for the same job.

## Hooks
A hook is a command that Claude Code runs automatically at a moment such as before a tool runs. Unlike an instruction in CLAUDE.md, a hook is not a suggestion: use one when something must always happen or must never happen, for example blocking a dangerous command.

## Subagents
A subagent is a helper Claude hands a side task to. It works in its own fresh context and returns only a summary, which keeps noisy output (logs, search results) out of your main conversation. Its requests still count against your usage. See [[agents-and-sessions]] and [[context-and-cost]].
