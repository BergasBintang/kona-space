---
name: humanize-text
description: Use when a text reads as if a machine wrote it or translated it, with stock openers, empty praise, forced triads, hollow closers or chat leftovers. Edits English. Indonesian goes to humanize-indonesian.
---

# Humanize text

Make a text sound like a person who knows the subject wrote it for a reader they respect. This is editing, not disguise: the facts stay, the habits go.

## Step 0: which language

- **English:** follow this skill.
- **Indonesian, or a mix with Indonesian:** use the `humanize-indonesian` skill. Its rules replace the English patterns, because Indonesian fails in different ways. The steps and the checks below still apply.
- **Another language:** say so. Edit only what is plainly wrong in any language (chat leftovers, invented facts, empty praise) and say which rules you did not apply.

## Steps

1. **Know the job.** Who reads this, what should they do or know after it, and what register fits (a reply, an article, a README, a product page, a bio, a commit message)? If the owner gave a sample of their own writing, match its voice.
2. **Mark the tells.** Read the whole text once. Open `references/english-tells.md` before you change a word, every time, even if you know the usual patterns: it also holds what you must leave alone (quotations, one weak tell, specific detail). Mark what you find, strongest first. Check the shape of paragraphs too, not only words.
3. **Rewrite.** Keep every claim the source supports. Say the point first. Shorten, merge, split, reorder. Where a sentence is vague, put the specific fact from the source in its place. If the source has no such fact, write the plainer sentence or ask. Rewrite a whole paragraph when one sentence in it stays awkward after a fix.
4. **Check against the original.** Names, numbers, dates, quotes, links, code, citations, rankings and "at the same time" claims are exactly as before. Nothing was added: no example, no person, no "in my experience". Hedges that were true are still there.
5. **Look again for the survivors.** The tells that live through a first edit: a contrast nobody asked for, a one-line closer, a triad, a connective on every sentence, a heading repeated by the line under it.
6. **Return it** in the form below.

## Rules

- Never invent. A text that is vaguer but true beats a text that is specific and made up. That includes a benefit or consequence the source does not state: "cuts sync time by 30%" does not become "so teams wait less". Say the fact and stop.
- Do not add a personality. A voice comes from true detail, not from "I", jokes or slang that were not there.
- Leave quotations, titles, names, contract and legal text, code, commands, paths and data exactly as they are. In a file, edit the prose only.
- Do not make the text shorter than the author would. Remove what is empty, keep what is said.
- Do not promise it will pass a detector. These are habits of machine text, not proof of who wrote it. If asked to hide that a text was machine-made, say what this skill does (makes it better writing) and what it does not.
- When a text has no tells, say so and change nothing.

## What to return

- **Text pasted in the chat:** the rewrite, then one line on what you changed in kind ("cut the run-up and the closer, replaced two vague claims with the figures from your notes"), then any question you need answered (a missing fact). Do not paste the old text back.
- **A file:** edit the prose in place, change nothing else, and say which sections you read and anything you did not cover.
- **Inside another job** (a pull request text, an email, a page you are writing): return only the final text.

Open `references/before-after-en.md` for worked examples, including one where the right move is to ask for a fact and one where the right move is to leave the text alone.
