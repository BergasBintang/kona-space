---
name: bug-report
description: Use when something is broken and needs describing so that someone else can fix it, either found in testing or reported by a user. Gives exact steps, expected and actual results, and how bad it is.
---

# Bug report

The test of a good report: someone who has never seen the problem can make it happen in one try.

1. **Make it happen again** yourself, from a clean start. Cut the steps to the fewest that still show it. If you cannot repeat it, say so and say how often it was seen.
2. **Check it is not known:** `list_tickets` first. If it is there, add what you learned to that one.
3. **Open `templates/report.md`** and fill it in.
4. **Facts only.** What you did, what you saw. Mark any guess about the cause as a guess. Do not blame anyone.
5. **Keep evidence:** the exact error text, a screenshot, a log line. Remove passwords, keys and people's personal data first.
6. **Say how bad it is,** by what it does to people:
   - **Blocker:** data lost, money wrong, a security hole, nobody can do the main job.
   - **Major:** a main job fails and the way around it is painful.
   - **Minor:** annoying, with an easy way around.
   - **Small:** looks wrong, nothing fails.
7. **One problem per report.**

Raise it with `create_ticket` for the right person. Do not fix it unless asked.
