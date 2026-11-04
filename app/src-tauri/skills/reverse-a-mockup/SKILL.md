---
name: reverse-a-mockup
description: Use when a project is already built and you need a static copy of some of its pages with made-up data, to look at or audit without running its server. Reads the project's own source.
---

# Reverse a mockup

A built project is hard to look at: it needs its server, its database and an account. Instead, read its source and build a **static twin** of a few pages that runs by itself with made-up data. The owner then clicks through it in the Mockups sheet. The format of the twin is the one in the skill `make-a-mockup`; follow that skill for the files, the sandbox and the values.

## What you may read

1. **The project's own source is the truth:** its pages, components, style sheets, design values and the shape of its API answers.
2. **Never the live site as a source, never a real account, never real data.** A school's pages hold real students; a shop's hold real orders. If a seed file or a fixture holds real names, emails or numbers, do not copy them. Invent new ones (`Mira Example`, `mira@example.test`).
3. Do not run the project's server, its database or its tests for this. Reading is enough.

## Steps

1. **Ask which pages.** List the routes you can find (a short list, with what each is for) and ask the owner to pick a few. Do a few at a time. Do not reverse the whole site in one go.
2. **Name the card.** One card per mockup, in `.kona/mockups/<card>/`. Pages inside it link to each other as the real site does. A landing page and the app behind it can be one card.
3. **Survey the whole system before any page.** Find the style sheets, the design values (variables, a theme file, a framework config) and the shared components. Count how often each size, gap and radius is used. The variables must describe the system, not the first page you looked at.
4. **Fill the values table from the source's own CSS.** Read the numbers from the files. Do not open a browser to measure them. A value the source does not give is `[TBD]`, listed in `mockup.json`. A formula in the source stays a formula in the twin.
5. **Rebuild each page from its source,** keeping the sandbox rules of `make-a-mockup` in mind (above all, a form is never sent, so its button is a plain button that runs the action on click): the parts as `data-part`, the real words as written in the source, every state the source can reach (empty, loading, error, long text). If the project has a dark theme, rebuild it as well.
6. **Write the fake API** to the same function names and answer shapes as the project's real client, so a later build can swap it back. The data is made up and long enough to break the layout.
7. **A login page is pre-filled** with made-up values and the next page opens at one click. A wrong password and an account with nothing in it can both be tried live, through the fake accounts of `make-a-mockup`.
8. **Run the check script** that comes with `make-a-mockup` (its check file), or read the same four points by hand.

## What can be compared

Say for every page which of these it is.

- **A public page** (no login): it may be compared with the live site at 320, 390, 768, 1024 and 1440 pixels wide, if you have a browser tool. Say what differs. If you could not look, say that.
- **A page behind a login:** it can only be checked against the source. Say so. Do not say it looks the same.

## Hand over

Tell the owner:
- the card and the pages in it, and which pages came from which source files;
- the accounts and what each shows;
- every `[TBD]`, and every place where the source did not say enough;
- for each page, "compared with the live site" or "checked against the source only";
- what you left out, and which routes remain.
