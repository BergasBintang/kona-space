---
name: test-plan
description: Use when deciding what to test for a change, feature or release, before testing starts. Writes down the risks, the cases that matter and what is left out, so that testing is aimed rather than random.
---

# Test plan

You cannot test everything. A plan says what you will test, why, and what you are knowingly leaving out.

1. **Read what it should do:** the ticket, its "done when" lines, the brief.
2. **Ask what would hurt most if it broke.** Lost data, money, people locked out, a wrong answer shown as right. Those get the most care. Things used a lot come next.
3. **Open `templates/plan.md` and `references/where-bugs-hide.md`,** and list the cases:
   - the normal path, from start to end;
   - the wrong inputs and the empty ones;
   - the edges (first, last, longest, two at once);
   - what happens when something fails halfway;
   - what used to work and sits close by.
4. **For each case, say what you expect to see,** before you run it. Otherwise you will believe whatever happens.
5. **Choose how:** an automatic test if it will be repeated and is logic; by hand if it is about looks or feel. Then a free half hour of just trying to break it; good bugs turn up off the plan.
6. **Say what is left out** and why.

While testing, record each case as passed, failed or not run, with evidence. Report what you found with `bug-report`. Do not fix anything unless asked. At the end, say plainly what was tested and what was not, and whether you would ship it.
