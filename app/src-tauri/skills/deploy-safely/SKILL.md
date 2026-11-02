---
name: deploy-safely
description: Use when putting a new version on a server or live environment, or changing live settings. Says what each command does, moves in small steps, watches for trouble, and keeps a way back ready.
---

# Deploy safely

Never touch a server without being asked, and say what a command will do before asking to run it. Ask again if the target or the plan changes: a yes for staging is not a yes for production.

**Before**
1. Read the project's deploy notes and scripts. Do not invent a new way when one exists.
2. Is this the right version, built from the right commit, with tests passed? (`release-checklist`)
3. Is there a database change? Does the old code still work with it? (`change-a-database`)
4. Is there a fresh backup, and how do you go back? Write the exact commands down now.
5. Is it a good moment? Not right before the end of the day, unless it is urgent.
6. Say the plan in a few lines and wait for the yes: what runs, where, how long, what users will notice.

**During**
7. One step at a time. Read each output before the next step. Stop at the first surprise and do not push on.
8. On a server: never use broad delete commands, never edit live files by hand if a script exists, and never turn off host key checks.

**After**
9. Open the real thing and do the main job yourself. Check the health page, the logs and the error count.
10. Keep watching for a little while.
11. Say what was done, the version, and what you looked at.

**If something is wrong:** going back comes first and working out why comes later. Follow `incident-response`.
