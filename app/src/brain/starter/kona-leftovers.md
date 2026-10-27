---
title: Leftovers and how to stop them
kind: starter
source: starter
---
# Leftovers and how to stop them

## What a leftover is
A program a session started (a dev server, a watcher) that is still running after the session ended. It keeps a port and some memory until it is stopped.

## What Kona does
Kona sees every program its sessions start and which port each one listens on. When a session ends and one is still alive, it shows in Leftovers with a red count, with the exact command. You choose: **Stop** (after a confirmation that shows the command and the port) or **Ignore** (you want it to keep running).

## Good to know
- A session run by `claude -p` can stay open while a background command is still running, so "finished" can mean "waiting on a server".
- When Kona itself closes, it stops everything its sessions started.
- Kona cannot see programs started from a terminal or the VS Code extension.
- Claude keeps scratch files per session; Kona shows their size and can delete a finished session's folder after you confirm.
See [[safe-habits]].
