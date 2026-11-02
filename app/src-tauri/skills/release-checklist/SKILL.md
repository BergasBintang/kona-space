---
name: release-checklist
description: Use when getting a version ready to ship, or being asked whether it is ready. Goes through tests, notes, version numbers, secrets and a way back, and says what was checked. Does not publish on its own.
---

# Release checklist

Never ship on a guess. Go down the list and say what you checked. Do not tag, publish or deploy until the owner says so, in words, for this version.

Say what each command does before asking to run it.

1. **What is in it.** List what changed since the last version, from the commits, not from memory. Is anything half finished? Is anything in it that nobody meant to include?
2. **Tests.** They pass on this exact version, and you saw them pass.
3. **The real program.** Build it as a user will get it, start it, and open the main screens. Passing tests are not enough.
4. **Upgrade.** Old saved data and settings still open. Any database change has been tried on a copy (`change-a-database`).
5. **Notes.** Change notes say in plain words what is new, what changes for people and what they must do.
6. **Version number.** The same in every file that holds it.
7. **Nothing secret.** No keys or personal data in what ships. See `find-secrets`.
8. **The way back.** You know how to return to the last good version, and that version is still kept. If there is no way back from some part, say so.
9. **People.** Those who need to know are told what changes for them, and when.

Answer in a table: item, checked or not, evidence. End with one sentence: ready, or not ready and why.

**Publishing a version cannot be taken back quietly.** After the yes, follow `deploy-safely`, and then open the real thing and look.
