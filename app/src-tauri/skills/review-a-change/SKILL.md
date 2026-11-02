---
name: review-a-change
description: Use when reading a change someone made, before it is merged or shipped, as a code review of a diff or branch. Looks for real faults first, proves each one, and ranks them by how much they matter.
---

# Review a change

The aim is to find what would hurt, not to count style points.

1. **Know what it is for.** Read the ticket. Does the change do that, all of it, and nothing else?
2. **Read the whole change,** then the code around it. A bug often sits in what the change did not touch: other callers, old data.
3. **Open `references/what-to-look-for.md`** and look for what breaks.
4. **Prove it.** Run the tests. For each finding, say the exact input and what goes wrong. If you cannot make that case, mark it as a question, not a fault.
5. **Rank:**
   - **Must fix:** wrong results, lost data, security, breaks something that worked.
   - **Should fix:** will hurt soon, such as a missing test on risky logic, or a slow query on a big table.
   - **Could fix:** small and optional. Keep these few, and do not hold the change up over them.
6. **Do not rewrite it** in your own style. Follow the project's style, even where you would choose differently.

For each finding: file and line, what goes wrong, and a suggested fix. End with a plain verdict: ready, ready after the must-fix items, or not ready. Say what you did not check. If it is good, say so without inventing problems.

**When your work is the one reviewed:** check each finding yourself before acting. If it is right, fix it. If it is wrong, say why with evidence. Do not agree just to be polite.
