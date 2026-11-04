---
name: make-a-mockup
description: Use when asked to draw or mock up a page, a flow or a few options as a clickable picture the owner can open in Kona's Mockups sheet. Plain HTML and CSS, made-up data, no server.
---

# Make a mockup

A mockup is a small web page that runs by itself, with made-up data, so the owner can click through it in the Mockups sheet (the big screen in the Lounge) at phone, tablet and desktop widths. It is not the real code. Say what you will draw before you draw it.

## Where it goes

1. Save it in `.kona/mockups/<card>/` in the project. One card is one mockup: a whole site, or one draft (three options for one slot are three cards). The card name is lower case with dashes.
2. Pages inside a card link to each other as a real site does, with plain `<a href="page.html">`. A landing page and its app can share one card.
3. Write a small `mockup.json` beside the pages with the name, the entry page, the project folder it came from and the values table. Open `templates/mockup.json` and copy its shape.

## What a mockup holds

- **HTML is required.** It is the bone. Every part of a page carries `data-part="name"` (a short plain name such as `login-form` or `course-list`). No inline styles. The empty, loading and error states can each be reached (a button, a link or an account), not only the happy state. Open `templates/index.html` for a login page, and `templates/dashboard.html` for the page it leads to.
- **CSS is required.** One style sheet. It opens with the design values as variables, the dark values included. If the project already has a style sheet or design values, read them first and reuse them (copy the values in; never point outside the card). Open `templates/style.css` for the layout of the file.
- **JavaScript is optional.** Use it only when something must be tried live, such as a wrong password, a search or a menu. Keep it in plain files with no framework: `api.js` is a fake of the project's real API, with the same function names and answer shapes. `data.js` holds made-up people and lists. `app.js` holds the behaviour. Open `templates/api.js`, `templates/data.js` and `templates/app.js`.

## Where a mockup runs

It runs in a sandbox, so some things that work in a browser do not here.

- No web calls, no web addresses inside the card, no fonts or pictures from a web page. Fonts, pictures and video are files next to the pages. If one must be downloaded, ask the owner first.
- No saving between runs: no `localStorage`, no cookies. The Refresh button puts the mockup back to its start. To carry who is signed in to the next page, put it in the address: `dashboard.html?as=full`.
- **A form cannot be sent here, and the browser never fires its "submit" event.** A submit button that relies on it does nothing, with no error. Give the button `type="button"`, run the action on its `click`, and handle Enter in the fields with `keydown`, as `templates/app.js` does.
- Use ordinary `<script src="app.js"></script>` at the end of the page, not modules, and do not fetch files. Put data in a `.js` file that sets a variable.
- Dark mode: the sheet sets `data-theme="dark"` on the root of the page. Write the dark values for both `[data-theme="dark"]` and `prefers-color-scheme`, as `templates/style.css` does.

## Sizes are never bare numbers

- Every size (space, radius, border, type size, width) has a **code** and a **variable**: `S2` is `--space-2`. A rule in the style sheet uses the variable, never `13px`.
- A value that follows from others is a formula written in the style sheet with `calc()` from the variables. The inside radius is the outside radius minus the border minus the padding, so it is written `calc(var(--radius-outer) - var(--border) - var(--space-inset))`, not typed as a number.
- The values table in `mockup.json` lists each one: code, variable, value, formula.
- Never invent a value. If the project does not say it and nobody told you, write `[TBD]` as the value, list it in the table, and tell the owner at the end. A guessed number looks like a fact.
- Open `templates/check.mjs`. If Node is on the PC, run `node check.mjs <card folder>`: it fails when a variable is used but not declared, a table entry is missing from the style sheet, a formula uses a code that is not in the table, or a `[TBD]` is unlisted. If there is no Node, check the same four things by reading.

## Made-up data

- Never a real person, school, company, email or phone number. Use obvious inventions: `Mira Example`, `mira@example.test`.
- The login page lists three fake accounts and fills the form when one is chosen: one with data, one empty, one whose requests fail. Add a wrong password to the list of things to try. Nothing needs a real secret.
- Make lists long enough to break the layout (a long name, forty rows), not only three tidy rows.

## Before you say it is done

1. Run the check, or read the four points by hand.
2. Open each page and say which widths you looked at. If you did not open it in the Mockups sheet, say so; do not say it looks right.
3. Tell the owner: the card name and where it is, how to open it (the big screen in the Lounge), the accounts and what each shows, every `[TBD]`, and what you did not check.
