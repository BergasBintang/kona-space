---
title: Agents and sessions
kind: starter
source: starter
checked: 2026-10-28 (Claude Code documentation)
---
# Agents and sessions

## What an agent is
An agent is Claude working through a task by itself: it reads files, runs commands, edits files and tells you what it did. In Kona each agent runs in a session.

## What a session is
A session is one running Claude Code conversation in one folder. Every session starts with a fresh context window: it does not remember earlier sessions. What carries over is only what is written down: your CLAUDE.md files, Claude's memory notes and, in Kona, the brain. See [[claude-md-and-memory]].

## What an agent can touch
Inside its working folder an agent can read freely. Editing files and running commands need your approval unless the permission mode allows them. It can also reach the web and any tool server you connect. Control this with [[roles-and-permission-modes]].

## Why a long session gets worse
Claude sends the whole conversation with every request. A session that has been open for hours carries a lot of old text, costs more per message and follows instructions less well. Start a fresh session for unrelated work. See [[context-and-cost]].

## One agent, one job
Give each agent one clear job and its own branch. See [[tickets-and-worktrees]] and [[good-tickets-and-prompts]].
