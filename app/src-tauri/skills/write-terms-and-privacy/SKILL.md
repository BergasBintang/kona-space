---
name: write-terms-and-privacy
description: Use when a product needs Terms and Conditions or a privacy notice written or fixed, especially for users in Indonesia under UU PDP. Builds them from facts about what the product really does, in plain words.
---

# Write the Terms and the privacy notice

A terms page and a privacy notice are promises. A promise the product does not keep is worse than none, so every sentence here comes from a fact: something the code does, something the owner told you, or something the law requires. This is a draft for a person to read, and for a lawyer to check before it goes live. Say that in your reply.

## Steps

1. **Know the job.** New terms, new privacy notice, both, or a fix to old ones? In which language do the users read (Indonesian, English, both)? Is the product for the public, for businesses, or for children?
2. **Collect the facts.** Open `templates/facts-sheet.md` and fill in everything the project can show you: read the code, forms, database models, third-party services and settings. Ask the owner only for what the code cannot show (company name, address, contact, prices, refund rules, retention periods). Never guess a fact. A gap stays as `[TBD: what is missing]` and goes in the list of open questions.
3. **Compare with a check, if there is one.** If a `uu-pdp-audit` report exists, read it. A promise that the audit marked Missing or Cannot tell must not be written as true. Write what the product does today, or put the fix in a ticket first and say so.
4. **Plan the parts.** Open `references/notice-parts.md` for what the privacy notice must tell people and how consent must be asked. Open `references/terms-parts.md` for the parts of the terms and the traps in each.
5. **Write.** Open `templates/terms-skeleton.md` and `templates/privacy-skeleton.md` and start from them. Drop the parts that do not apply and fill the rest from the facts sheet. Plain sentences, one idea each, "we" and "you". Say what you do, with whom, for how long and how a person asks for their data or deletion.
6. **Check every sentence against the facts sheet.** For each promise (encrypted, never sold, deleted in 30 days) name the fact behind it. No fact, no sentence. Check that the terms and the privacy notice do not contradict each other and that names, dates and amounts are the same everywhere.
7. **Finish the language, before you return anything.** This step is part of the job, not an extra for someone else. Start `humanize-indonesian` on Indonesian text and `humanize-text` on English text with the skill tool, and apply it to the plain sentences only. Leave alone every `[TBD: ...]` mark, every team note, article numbers, deadlines such as 3 x 24 jam, and the legal terms (*data pribadi*, *pengendali*, *persetujuan*). Do not let the polish drop a required part (the seven things of Pasal 21 in `references/notice-parts.md`, the list of rights), soften a duty into a wish, or add a promise. Then repeat the check of step 6 on the final text. Only if neither skill is in your list, say that Nobo the Content can do this pass. Do not translate legal clauses word for word: write the idea in the other language.
8. **Return** the two texts, the list of open `[TBD]` items, the list of promises that need a ticket before they are true, whether the language pass was done, and what you did not check.

## Rules

- **Never invent** a company name, address, registration number, price, deadline, retention period, officer or vendor. Use `[TBD: ...]` and ask.
- **Never copy** another company's terms. Their facts are not yours, and copying can break their copyright.
- **Never say** the product "complies with UU PDP", "is fully secure" or "never shares data" unless a check proved it. Say what it does.
- **A sentence about what the company does is a promise,** even when it comes from a skeleton ("we record your consent", "we tell you when data is deleted"). Keep it only when the code or the owner shows it is true today. Otherwise write what happens today, or a `[TBD: ...]` mark.
- **Notes for the team** go in the reply, or in the text only as a block that starts "Catatan untuk tim, hapus sebelum terbit", and the reply says how many there are. Never leave a note in the text without that start.
- **Consent is its own step.** Do not hide consent inside the terms. Each separate purpose (marketing, analytics, sharing with a partner) gets its own unticked choice, in plain language. See `references/notice-parts.md`.
- **Do not take away what the law gives people.** A clause that makes a person give up their data rights, or that takes data without valid consent, is void by the law (Pasal 22 and 23). Leave it out.
- Legal claims you cannot read in the checklist or the notice file are marked `(to verify)` for the lawyer. Do not state them as fact.
- Do not publish, send or change the product's pages yourself. Return the texts, and raise a ticket for putting them in the product.

Open `templates/facts-sheet.md` first. Then open `references/notice-parts.md` and `references/terms-parts.md`, and `templates/terms-skeleton.md` and `templates/privacy-skeleton.md` when you write. Use `uu-pdp-audit` to check what the product really does.
