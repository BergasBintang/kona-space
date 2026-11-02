---
name: write-a-runbook
description: Use when writing down how to run, deploy, back up, restore or fix a system, so that someone who has never done it can follow it at three in the morning without asking anyone.
---

# Write a runbook

The reader is tired and worried and knows nothing about this system. Write for them.

1. **Pick one job per runbook:** "Restore the database from backup". Not "everything about the database".
2. **Follow what really happens.** Read the scripts and settings. Do not write from memory. Mark what you could not confirm with (not checked).
3. **Open `templates/runbook.md`** and fill it in.
4. **Each step is one action:** the exact command, what it does, and what you should see afterwards. Say what to do if you see something else.
5. **Mark the dangerous steps** clearly, and give the way back.
6. **Never write a password, key or address into it.** Say where to find them: "the database password is in the team's password manager, under X".
7. **Try it,** on a copy if you can. A runbook nobody has tried is only a theory. Say so if it has not been tried.

Write the date on it and who keeps it up to date. Say when it should be read again.
