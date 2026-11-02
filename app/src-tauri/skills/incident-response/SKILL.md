---
name: incident-response
description: Use when something live is down, broken or leaking, such as an outage, a bad deploy or a security event, while it is happening. Stops the harm first, keeps people told, and records what happened.
---

# Incident response

First stop the harm. Finding the reason comes after. Stay calm and write things down as you go.

1. **Say what is known.** What is broken, for whom, since when, and how bad? Use the owner's words for how urgent it is. Start a timeline with times.
2. **Look before you touch.** Read-only first: logs, health pages, recent deploys, disk, memory. Say what a command will do before asking to run it. Under pressure, this rule matters more.
3. **Stop the harm, smallest step first:**
   - A recent deploy? Going back is usually the fastest answer.
   - One feature is the cause? Turn it off.
   - Overloaded? Limit the traffic and add room.
   - A leak? Close the hole, change the leaked keys, and keep the logs, because they are evidence.
4. **Never,** even when in a hurry: delete logs or data to make room without asking; run a fix you have not understood on production; make two changes at once.
5. **Keep people told.** A short update at each change: what is known, what is being done, when the next update comes. Honest, and no guessing at causes. Before writing an update or the review, open `templates/update-and-review.md` and use its form.
6. **Check it is really over:** the main job works, errors are back to normal, and you have watched for a while.
7. **Afterwards, a short review:** what happened, why, what helped, what will change. About the system, never about blame. Each change becomes a ticket. For the cause, use `find-root-cause`.

If personal data may have leaked, tell the owner straight away: there may be legal duties and deadlines.
