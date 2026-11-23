---
name: humanize-indonesian
description: Use when Indonesian text reads like AI wrote it or like a translation, or when writing Bahasa Indonesia for a reader. Fixes stock phrases, English calques and stiff rhythm in the right register, with the official rules.
---

# Humanize Indonesian (Bahasa Indonesia)

Make Indonesian text read like an Indonesian person who knows the subject wrote it for this reader. This is editing and good writing, not disguise: the facts stay, the habits go. It also applies when you write Indonesian from nothing: choose the register first, then write.

Indonesian fails differently from English. Most of what sounds "machine" is (1) the wrong register, (2) English thinking translated clause by clause, and (3) a few stock phrases. This skill has the English skill's steps, with Indonesian rules. If the text is English, use `humanize-text`.

## What is solid and what is not

Be honest with the owner about this. Measured evidence about AI-written Indonesian is thin. What is measured: machine text has more even sentence lengths, less variety of words, fewer modals (*dapat*, *harus*, *bisa*), and a tidier, more formal tone. Most phrase lists ("Di era digital…", "Penting untuk dicatat bahwa…") come from blogs and translated English lists, not from Indonesian counts, and human writers use them too. Detectors are unreliable on Indonesian, and a formal student essay has been flagged as ChatGPT. So:

- Fix **rules and waste** with confidence: they are backed by Badan Bahasa.
- Fix **habits** only when several appear together.
- Never claim a text "passes" a detector, and never help hide that a text was machine-made. You make it better writing.

## Steps

1. **Know the job and pick the register.** Who reads this, in what channel, and what should they do next? Open `references/registers.md` first, every time: resmi, konsultatif, santai or gaul; *Anda* or *kamu* or *Kak* or *Bapak/Ibu*. If the owner gave a sample of their writing, match its register and address. If you do not know, use konsultatif and say so.
2. **Mark what you find.** Read the whole text once. Open `references/tells-id.md` before you change a word, every time, even if you know the usual patterns: each tell has a strength (Aturan, Hemat, Kebiasaan, Lemah) and a fix, and the file also says what to leave alone. Mark the strongest first. Look at paragraph shape too.
3. **Check the facts you may correct.** Before you say "this is wrong", open `references/official-rules.md` and be able to name the rule. If the only support is taste, call it style or just do it.
4. **Rewrite.** Keep every claim the source supports. Say the point first. For a calque, test: could a speaker say this out loud? If you can picture the English sentence behind it, rewrite the idea, not the words. For a vague sentence, put the specific fact from the source in its place; if the source has none, write the plainer sentence or ask. Rewrite the whole paragraph if one sentence stays awkward after a fix.
5. **Check against the original.** Names, numbers, dates, quotes, links, citations, code, figures, and legal or technical terms are exactly as before. Nothing was added: no example, no person, no study, no "menurut pengalaman saya". Hedges that were true are still there. Spelling follows the standard (KBBI, EYD Edisi V) unless the register is casual. Address and capitals are consistent (*Anda* with a capital, one form throughout).
6. **Look again for survivors.** The ones that live through a first pass: a connective on every paragraph, *tidak hanya … tetapi juga*, a triad, a slogan closer, *yang mana*, a stacked pair like *meskipun … tetapi*.
7. **Return it** as below.

## Rules

- **Never invent.** Not a number, a name, a source, a quote, a place, a date, and not a benefit or a consequence the source does not state ("penjualan naik 4,5%" does not become "sehingga toko makin dikenal"). A vaguer true text beats a specific false one. Where the source is thin, ask.
- **Do not add a personality or slang** that the owner or brand did not ask for. Do not type badly on purpose (typos, *yg*, doubled commas) to look human.
- **Leave alone:** direct quotes, titles, names of people, institutions, laws and brands, contract and legal clauses, patent claims, validated questionnaires, code, commands, file paths, data. Passive voice in methods and results, and *merupakan* in a real definition, are fine. A formal text is not a machine text because it is formal.
- **Do not shorten more than the author would.** Cut what is empty; keep what is said.
- **When there is nothing to fix, say so** and change nothing.
- **Say what you did and did not do.** If you did not check a spelling, a fact or a figure, say it.

## What to return

- **Text pasted in the chat:** the rewrite; one line on what you changed in kind ("dua penghubung ganda diperbaiki, tiga frasa pembuka dibuang, satu klaim samar diganti angka dari catatan Anda"); a question for every fact you were missing. Do not paste the old text back.
- **A file:** edit the prose only, change nothing else, and say which sections you read and which you did not.
- **Inside another job** (an email, a page, a ticket): return only the final text.
- Reply to the owner in the language they wrote to you in.

Open `references/registers.md` first, then `references/tells-id.md`. Open `references/official-rules.md` before you tell anyone a form is wrong, and `references/before-after-id.md` for worked examples, including one where the right move is to ask for a fact and two where the right move is to leave the text alone.
