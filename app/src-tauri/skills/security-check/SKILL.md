---
name: security-check
description: Use when reviewing code, a feature or a whole project for security problems such as injection, broken access and leaks, especially around logins, money, uploads or personal data. Ranks real problems by how bad they are.
---

# Security check

Say how bad it is first. Never write a key or a password into a file, a ticket or a reply, even as an example from the code: say where it is and show only its first few letters.

1. **Decide the scope.** Whole project, one feature, or one change? Say what you covered.
2. **Map it.** Where does outside input come in (forms, URLs, files, webhooks)? What is worth stealing or breaking? Where are the logins and permission checks?
3. **Follow the input** from where it enters to where it is used: a database query, a shell command, a file path, the page, another server.
4. **Open `references/what-to-check.md`** and go through the parts that apply.
5. **Prove each finding.** Name the file and line, and a concrete way to exploit it. If nobody could actually reach it, say so and rank it low. Do not report what a scanner would say without checking. Do not attack live systems; test on your own copy, and only when asked.
6. **Rank by** what an attacker gets, and how easily:
   - **Critical:** taking over accounts, reading all data, running code, with no login or little effort.
   - **High:** other people's data; needs a normal login.
   - **Medium:** needs unusual conditions, or gives away little.
   - **Low:** hardening.

For each: how bad, where, how it could be exploited, what it costs, the smallest fix. Also say what you did not look at. Use `find-secrets` and `check-dependencies` for those two parts; use `threat-model` when a design is not built yet. Raise tickets for fixes; change code only if asked.
