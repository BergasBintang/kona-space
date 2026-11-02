---
name: write-tests-first
description: Use when adding a behaviour or fixing a bug in code that has logic, before writing the code itself. Writes a test that fails for the right reason, makes it pass, then tidies up.
---

# Write the test first

A test you wrote after the code tends to prove only what the code already does.

1. **Find how this project tests.** The command, the folder, the style. Run the tests once so you know they pass before you start. If they do not, say so before going on.
2. **Write one small test** for one behaviour, named as a sentence about what should happen. For a bug, the test repeats the bug.
3. **Run it and watch it fail.** Read the failure. It must fail because the behaviour is missing, not because of a typo or a bad import. A test that has never failed proves nothing.
4. **Write the least code that makes it pass.** Nothing extra for later.
5. **Run all the tests.** Everything passes.
6. **Tidy up** with the tests still passing. Then the next behaviour.

**Good tests** check what a person or caller can see, not private details. They use real code where they can and fake only what is slow or outside (network, clock, payments). They cover the awkward cases: empty, very long, wrong, twice in a row.

**Skip this** for looks, one-off scripts and throwaway trials, and say that you did. If a test is too hard to write, the code is telling you it is tangled: say so rather than dropping the test.

Never weaken or delete a test to make it pass unless the test itself is wrong, and then say why.
