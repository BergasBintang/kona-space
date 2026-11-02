---
name: find-root-cause
description: Use when something is broken, failing or behaving strangely, such as a bug, a failing test, a crash or a slow screen, before proposing any fix. Finds the real cause with evidence first.
---

# Find the root cause

No fix until you can say why it happens. A fix made on a guess hides the bug and often adds a second one.

1. **Read the whole error.** All of it, and the first error rather than the last. Note the file and the line.
2. **Make it happen again.** Find the exact steps. If you cannot repeat it, collect more facts instead of guessing. Does it happen every time?
3. **Look at what changed.** Recent commits, new versions, settings, data.
4. **Follow it back.** Start where it goes wrong and walk backwards to where the bad value first appears. Fix it there, not where it shows. With several parts (screen, server, database), check what goes in and out of each to find which one is wrong.
5. **Compare.** Find something similar that works and list every difference, even small ones.
6. **One idea at a time.** Say "I think X because Y". Test it with the smallest possible change or a printed value. One change at a time. Wrong? Undo it and form a new idea from what you learned.
7. **Fix.** A test that repeats the bug first (`write-tests-first`), then one fix for the cause.
8. **Prove it** with the skill `verify-before-done`.

**Stop signs:** three fixes have failed, each fix breaks something else, or you are saying "let's just try". Stop, say what you know and what you ruled out, and ask whether the design itself is the problem.

Report the cause, how you know, the fix, and how you proved it. When you are stuck, open `references/ways-to-look.md` before guessing again.
