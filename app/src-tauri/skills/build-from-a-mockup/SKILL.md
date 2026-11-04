---
name: build-from-a-mockup
description: Use when building a real page or screen from a mockup saved in .kona/mockups, in the project's own code and design values. Keeps the mockup's HTML and CSS and swaps the fake API for the real one.
---

# Build from a mockup

A mockup is a drawing that runs. It shows what the owner agreed to; it is not code to ship. Your job is to build the same page in the project's own stack, with the project's own values and its real API. There is no converter. You read, map and write.

## Find the mockup

1. The mockups are in `.kona/mockups/<card>/` in the **main project folder**. In your own ticket copy that folder is not there. The ticket says where the main folder is. Read the mockup from there and never change it.
2. If you cannot read it, stop and say so. Do not rebuild a page from memory or from the ticket's words alone.
3. Read `mockup.json` first (name, entry page, values table), then the pages, the style sheet, and `api.js` for the answer shapes.

## Steps

1. **Read the project's stack before anything else.** The framework or none, how pages and routes are made, how styles are written, where design values live, how it calls its API, how it tests. Follow what is there.
2. **List the parts.** Every `data-part` name in the mockup is a part of the page. For each, say what in the project already does that job (a component, a class, a partial) and what is new.
3. **Map the values.** Take the table in `mockup.json` (code, variable, value, formula). For each code, find the project's own token with the same value and use it. If the project has none, say so in the hand-over and ask whether to add one; do not paste a bare number. A formula stays a formula (`calc()` or the project's own way). A `[TBD]` is a question for the owner: do not pick a value.
4. **Keep the HTML and the CSS.** The structure, the order, the words and the states (empty, loading, error) come over as drawn. Rewrite them in the project's way only where the stack needs it. Keep the `data-part` names while the page is being built; the owner uses them to point at things.
5. **Swap the brain.** `api.js` and `data.js` are fakes: drop them. Call the project's real client with the same function names where it has them. If the real client differs from the fake in names or answer shapes, change the page, not the client, and list the differences in the hand-over. Drop the `?as=` account handling. Re-write `app.js` behaviour in the project's way, not by copying the file in.
6. **Test the logic you wrote** the way the project tests, before saying it works. See the skill `write-tests-first` when it is there.
7. **Compare with the mockup** at 320, 390, 768, 1024 and 1440 pixels wide when you can open both. Say which widths you looked at and what differs. If you could not open them, say that and do not claim a match.

## Hand over

- the card you built from, and the files you made or changed;
- each part and what it became;
- each code and the token it mapped to, and the ones with no token;
- each place the real API differed from the fake;
- every `[TBD]`, and what you did not check.
