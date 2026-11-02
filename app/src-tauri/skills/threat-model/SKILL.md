---
name: threat-model
description: Use when a new feature or system is being designed, especially one touching logins, money, uploads or personal data, to work out how it could be attacked before it is built, and what to do about it.
---

# Threat model

It is much cheaper to fix a design than to fix a product. Four questions, in plain words.

**1. What are we building?** Draw it in words: the people, the screens, the servers, the stores of data, the outside services. Mark the lines where trust changes, for example from the browser to the server, or from us to a payment service.

**2. What can go wrong?** Open `references/ways-to-attack.md` and go through it for each line that crosses trust. Think as someone who wants something: a curious user, a former employee, a stranger with a script. What is worth having here?

**3. What will we do about it?** For each threat, choose one and say why:
- **Stop it,** with a concrete control.
- **Limit it,** so the harm is small and is noticed.
- **Remove it,** by not collecting or not building the thing. The safest data is data you do not have.
- **Accept it,** which is the owner's decision, in writing.

**4. Did we do enough?** Is every main threat answered? Are the controls something a test could check?

Rank by how likely and how harmful, in plain terms, with no scoring theatre. Keep it to one page: the worst five, with what to do.

Output: the short description, a table (threat, how it could happen, how bad, what we do, who does it), and what was accepted and by whom. Turn the controls into tickets.
