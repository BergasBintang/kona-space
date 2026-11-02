---
name: verify-before-done
description: Use when about to say that something is done, fixed, passing or working, or before closing a ticket or moving work on. Runs the check and shows the result, because a claim without evidence is a guess.
---

# Check before saying done

Do not say it works until you have seen it work, on this version, just now.

1. **Say what would prove it.** What command or action shows that this claim is true? For a ticket, go through each "done when" line.
2. **Run it, all of it,** fresh. Not an earlier run, and not a smaller run.
3. **Read the output.** The count of failures, the exit code, the warnings. Do not stop at the first green line.
4. **Then speak,** with the evidence: what you ran and what it said.

| The claim | What proves it | What does not |
|---|---|---|
| Tests pass | The test run, just now, 0 failed | "It should pass", an old run |
| The bug is fixed | The steps that showed the bug no longer do | The code looks right |
| The build works | The build finished with no errors | The tests passed |
| The screen is right | You opened it and looked | The tests passed |
| It is deployed | You opened the real thing | The command finished |

**Words that mean you have not checked:** should, probably, seems, I think, looks good. Replace them with a check, or with "I have not checked this".

**Say what you could not check, and why.** A short honest gap is worth more than a confident guess. If something fails, report the failure and its output; never hide it or quietly remove the test.
