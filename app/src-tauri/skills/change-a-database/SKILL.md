---
name: change-a-database
description: Use when changing a database structure or moving data, such as a migration, a new column, a renamed field or an index. Keeps real data safe, keeps the program running, and always has a way back.
---

# Change a database

The code can be replaced; the data cannot. Never run anything on real data without the owner's yes.

1. **Know what is there.** Read the current structure and how many rows it has. A change that takes a moment on 100 rows may lock a table for minutes on 10 million.
2. **Find everything that uses it.** Queries, jobs, reports, other services. Search for the name.
3. **Use the project's migration tool,** as a new file. Never edit a migration that has already run anywhere.
4. **Split risky changes** so the old and new code can both run during a deploy. Open `references/safe-steps.md` and follow the steps for this kind of change.
5. **Write the way back** and run it, for real, on a copy. If there is no way back (a dropped column), say so in capitals and ask first.
6. **Try it on a copy** with realistic data. Compare counts and spot-check some rows before and after.
7. **Before running on real data,** say what will happen, how long it should take, what the backup is, and how you would undo it. Then wait for the yes.

Add a test for the new behaviour, and an index for any new query on a big table; measure rather than guess. Report the files, what you tried it on, the counts, and what you did not check.
