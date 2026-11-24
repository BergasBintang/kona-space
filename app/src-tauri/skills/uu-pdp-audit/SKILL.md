---
name: uu-pdp-audit
description: Use when a project handles personal data of people in Indonesia and you must check it against UU PDP (Law 27 of 2022), such as sign-up, consent, deletion, security or a data leak plan. Reports, does not fix.
---

# UU PDP audit (Indonesia's personal data law)

Look at what the project really does with people's data and compare it with Law No. 27 of 2022 on Personal Data Protection (UU PDP). Report what is met, what is missing and what you cannot tell. This is an engineer's checklist, not legal advice: say so at the top of the report.

## First, does it apply?

UU PDP covers anyone who processes the personal data of people in Indonesia, so a product with Indonesian users is in scope even when the company or the servers are elsewhere. If the project has no personal data, or no Indonesian users and none planned, say that and stop. If you cannot tell, ask one question: who are the users and where are they?

## Steps

1. **Scope.** Whole project or one feature? Say what you will and will not read. Use the project's own words for its data (customer, student, patient).
2. **Find the personal data.** Search the database models, migrations, forms, API shapes, uploads, logs, analytics and third-party calls. List each kind of data, where it comes in, where it is stored and who can see it. Mark the kinds the law calls specific (health, biometric, genetic, criminal record, children, personal finance): they raise the bar.
3. **Open `references/uu-pdp-checklist.md`** and go through every area. For each, look in the code first. A thing the code cannot show (a policy, a contract, a decision to appoint an officer) is "Cannot tell", never "Met".
4. **Prove each finding.** Give the file and line, and what happens to a real person's data. Never write a key, password or a real person's data into the report: show where it is and its first few letters.
5. **Rate each area** as Met, Partly, Missing or Cannot tell, and rank what is wrong by legal and human harm: data of many people exposed or kept without a basis first, missing paperwork last.
6. **Open `templates/audit-report.md`** and fill it in. Keep the "Cannot tell" list: it is the questions for the owner.

## Rules

- Do not change code or project files. Offer tickets for the fixes, with the smallest change each.
- Do not say a project "complies" or "is certified". Say which checks passed.
- Cite articles (Pasal) only from the checklist. If you need one that is not there, say it is unchecked.
- Do not attack live systems or open real people's records. Work on the code and on made-up data.
- Save the report to a file only when asked, and ask where. Otherwise give it in the reply.
- Say what you did not look at.

Use `security-check` for holes in the code beyond personal data, `find-secrets` for leaked keys, and `write-terms-and-privacy` when the notices are missing or wrong.

Open `references/uu-pdp-checklist.md` first and `templates/audit-report.md` when you write the result.
