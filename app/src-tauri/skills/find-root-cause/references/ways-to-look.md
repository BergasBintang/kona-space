# Ways to look when you are stuck

**Cut it in half.** Remove half of the suspects (half the steps, half the data, half the commits with `git bisect`). See which half still fails. Repeat.

**Make it smaller.** Remove everything that is not needed for the failure, until a tiny case remains. The cause is usually obvious by then.

**Print what is true.** Put the actual values at each boundary: what went in, what came out. Do not reason about what they should be. Take the prints out afterwards.

**Question the things you are sure of.** Is that the file that actually runs? Is the program using the new build? Is that the right database, account and folder? Many long hunts end here.

**Timing.** Fails only sometimes? Think about order: two things racing, an answer arriving late, a cache, a clock, tests sharing state. Add waits only to confirm the idea, never as the fix.

**Environment.** Works here and not there? Compare versions, settings, paths, line endings, upper and lower case in file names, and permissions.

**Data.** Fails for one person only? Look at their data: empty fields, odd characters, very long values, old records from before a change.

**Speed.** Measure before changing anything. Find the one slow step; it is rarely where you first think. Check for one query per row, and for missing indexes.

**Explain it out loud.** Write what happens step by step for someone who knows nothing. The step you cannot explain is the place to look.
