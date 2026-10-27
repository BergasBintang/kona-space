---
title: Safe habits
kind: starter
source: starter
checked: 2026-10-28
---
# Safe habits

- **Secrets never go in the chat.** Keys, tokens, passwords and IP addresses do not belong in a prompt, a ticket or a note. Put them in your password store or an ignored file. Kona hides what looks like a secret from its search index and reports it in the health report.
- **Read before you approve.** Each approval card shows the exact command or file. Allow once is safer than always allow.
- **Ask before delete.** Be careful with anything that removes files, branches or servers. Kona asks you first for every removal.
- **Commit before a big change.** A clean Git state lets you undo a bad run. Work on a branch, in a worktree. See [[tickets-and-worktrees]].
- **Plan first when unsure.** Plan only mode costs little and avoids wrong turns. See [[roles-and-permission-modes]].
- **Read the diff.** An agent saying it is done is a claim, not a proof. Check the changes and run the tests.
- **Stop what is left running.** Dev servers an agent starts can outlive its session. See [[kona-leftovers]].
- **Skipping all permission checks is a last resort.** Kona does not offer it.
