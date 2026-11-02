# Changing things in safe steps

During a deploy, old code and new code run at the same time. Every step has to work with both.

**Add a column**
1. Add it allowing empty, or with a default that does not rewrite the table.
2. Ship code that writes it.
3. Fill in old rows in small batches, with short pauses.
4. Ship code that reads it. Then make it required if needed.

**Rename a column**
Never rename directly.
1. Add the new one.
2. Write to both.
3. Copy old values in small batches.
4. Read from the new one.
5. Stop writing the old one.
6. Remove the old one later, after a backup and some days of quiet.

**Remove something**
1. Ship code that no longer uses it, and wait.
2. Check that nothing reads it: logs, reports, other services.
3. Take a backup. Then remove it. This has no way back.

**Add an index on a big table**
Use the way that does not lock writes (for example `CONCURRENTLY` on PostgreSQL), and do it at a quiet hour. It can fail halfway: check and clean up.

**Move a lot of data**
Small batches, safe to restart, a way to see how far it got. Watch the load. Never one giant transaction.

**Always**
- A fresh backup you know can be restored.
- A time limit on the lock, so a stuck change fails instead of stopping everything.
