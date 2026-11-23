# The skills that come with Kona

## What a skill is

A skill is a folder, not one text file. Claude reads `SKILL.md` when the skill fits, and opens the rest only when `SKILL.md` sends it there.

| In the folder | What it is for | When Claude pays for it |
|---|---|---|
| `SKILL.md`, top lines | Name and one line on when to use it | At the start of every conversation |
| `SKILL.md`, the rest | The steps | When the skill is used |
| `templates/` | A form to fill in | When it is opened |
| `references/` | Long checklists, tables, background | When it is opened |
| `scripts/` | Programs that run instead of being read | Only their output |
| Anything else | Example files, pictures, fonts | When it is opened |

The dialog for a new skill or a change shows this folder: SKILL.md and the files beside it, with buttons to add a template, a reference, an example or a script. Adding one also adds a line to the steps that says when to open it, because a file nothing points at never gets opened. All of it is saved at once.

Kona's built-in skills use `templates/` and `references/`. They have no `scripts/` on purpose: a script has to run on every user's PC, needs a program that may not be there, and Kona promises not to install anything. Instead they use what Claude can already do (search, read, run the project's own tools).

## How they ship

- Everything under `app/src-tauri/skills/<name>/` goes inside the program. `build.rs` lists the files, so a new file needs no other change.
- `app/src-tauri/skills/default-tree.json` is the starting tree: for each person, the branches, and in each branch the skills with a short line on when to take them.
- **A new project** gets all the skills in `.kona/skills/` and everyone's tree in `.kona/role-kits.json` when it is added. A folder that already has `role-kits.json` is left alone.
- **An older project** keeps what it has. The Skills tab offers "Use it for this person" and "For everyone in this project"; the tree joins what is there, and nothing of the owner's is replaced.
- **Updates.** `.kona/builtin-skills.json` holds a fingerprint of what Kona wrote. When a new version of Kona has better text, a copy still exactly as Kona wrote it is replaced. A copy the owner changed, and a skill the owner deleted, stay that way.
- **Cost.** A session only sees that person's skills (`--plugin-dir`), so forty-eight skills in the folder cost nothing extra. Each person starts at about 280 to 500 tokens: their list plus the tree.

## Rules for a built-in skill

`cargo test` checks the ones marked (test).

- The name is lower case with dashes, and does not contain "claude" or "anthropic". (test)
- The description starts "Use when", is at most 220 letters, and has no colon followed by a space and no angle brackets, because those break the top of the file when it is read as YAML. (test)
- `SKILL.md` stays under 500 lines, and what it points at is one level deep and exists. (test)
- Every skill is in somebody's tree, and every person has a tree with at least two branches. (test)
- Each person stays under 800 tokens at the start of a conversation. (test)
- No private names, keys or addresses. (test, partly)
- It must fit the person's job. Kiki and Kupa change no project files; Sen reports and does not fix; Sora says what a command does before running it.
- Never invent numbers, customers or quotes in a marketing or content skill.
- Plain words. Say what done looks like, and what to report.
- Every file beside `SKILL.md` is pointed at as an order: "Open `templates/x.md` and fill it in". (test)

## The research behind them (2026-11-02)

**On this PC:** 75 different skills. They are the owner's own company skills (not for other users), design-taste skills with no stated licence, Anthropic's official plugins (mostly about building plugins, MCP servers and documents), and Impeccable (Apache 2.0, 52 files, a design tool with its own programs). None could simply be shipped, because of who they are for, their licence, or what they need to run.

**On GitHub** (read 2026-11-02):

| Source | What it has | Licence | What we took |
|---|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 15 skills on how to work: debugging, tests first, plans, check before claiming | MIT | The ideas behind `find-root-cause`, `write-tests-first`, `verify-before-done` and `shape-an-idea` |
| [anthropics/skills](https://github.com/anthropics/skills) | 19 skills | Apache 2.0 for many; docx, pdf, pptx and xlsx are source-available | The folder layout, and the idea of `test-in-the-browser` and `accessibility`-style checks |
| [trailofbits/skills](https://github.com/trailofbits/skills) | Security audits with CodeQL and Semgrep | not checked | The idea of proving each finding |
| [travisvn](https://github.com/travisvn/awesome-claude-skills) and [ComposioHQ](https://github.com/ComposioHQ/awesome-claude-skills) lists | Directories of other skills | varies | Showed that support, product and secretary work are thinly covered elsewhere |
| [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits) (read 2026-11-22, cloned to a temp folder and counted by scripts, nothing installed) | 219 animated React parts in five groups, of which 35 "micro" ones are agent screens (status mark, tool-call chip, thinking line, chat box, hold to confirm, undo), plus a motion token set, tooltip, number and speed-governor helpers | MIT + Commons Clause: use inside a product is allowed, selling or bundling the parts is not | The ideas, timings and rules only, written fresh, no code copied: the skill `ui-details`. Details and the measured cost of heavy effects: `docs/UI-RESEARCH-react-bits.md` |

**Rules from Anthropic's pages** ([Claude Code skills](https://code.claude.com/docs/en/skills), [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)):

- The list of skills has a budget of about 1% of the context window. When it overflows, descriptions are dropped, starting with the least used skills.
- A description is at most 1,024 characters. It says what the skill does and when to use it, with words people really use.
- `SKILL.md` stays under 500 lines, and references are one level deep.

**All 43 were written fresh for Kona.** (The first 40 on 2026-11-02, the three mockup skills on 2026-11-04.) No text was copied from these sources, so no licence comes along with them. The methods are common practice; thanks to the authors above for writing them down well.

**Tried in real conversations (2026-11-02, a throwaway project, Sonnet, through Kona's window):**

- Sora, told the shop was down, chose `incident-response` by itself. Kenn, given a double charge, chose `support-reply`. Neither needed a permission card, and each followed the skill's rules.
- Both saw the tree, and only their own skills plus the ones inside Claude Code.
- In the first run Sora did not open the template, because the skill only said "the template has both forms". After every pointer was changed to an order ("open the template"), Sora opened it. `cargo test` now checks this wording.
- A built-in skill in the project was updated by itself when the program had new text.
- A description with a colon in it was read correctly, so the rule against colons is a caution and not a proven need.

## The mockup skills (2026-11-04, 0.33.0)

| Skill | Who has it | What it does |
|---|---|---|
| `make-a-mockup` | design, frontend | Draws a page or flow that runs by itself in the Mockups sheet, with made-up data. HTML and CSS are required, JavaScript is optional. Every size has a code and a variable; a derived value is a `calc()` formula; an unknown value is `[TBD]` and is listed. `templates/` holds a starter login page and dashboard, a style sheet, `mockup.json`, the fake API and data, and `check.mjs` (an optional Node check) |
| `make-a-live-mockup` | design, frontend | Writes the `live` recipe of a card (a start command, a port, a folder, an optional setup that makes a throwaway demo database) so Kona runs the project's real program in the Mockups sheet, in the device frames. Real screens, animations and a login for every role, so it cannot drift. Says what to cut (mail, queues, payments, secrets), to serve a built front end, and to list the demo accounts. `templates/mockup.live.json` is the shape of the recipe |
| `reverse-a-mockup` | design, frontend | Reads a built project's own source and rebuilds a few pages as a static mockup with made-up data. Never the live site, never real accounts. Says for each page whether it was compared with the live site (public pages) or checked against the source only |
| `build-from-a-mockup` | frontend | Builds the page for real in the project's stack: maps the mockup's value codes to the project's tokens, keeps the HTML and CSS, swaps the fake API for the real client, and lists every difference |

**Tried in real conversations (2026-11-04, Haiku, a throwaway school project, the built program):** Jiro built a sign-in page and a course list from a card in a ticket copy and handed over a faithful report; Nokka made a course page that runs in the sheet; a session reversed two pages of the built site. **Found:** a mockup runs where a form cannot be sent, so a submit button does nothing (the skills now say to use a plain button with a click handler); a ticket copy needs read access to the main folder's mockups and skill files (a read rule, not `--add-dir`, which also allows writing). Details: `docs/LESSONS.md`, section 15.

## The humanizer skills (2026-11-23, decision 103)

Two skills for text that sounds machine-made or translated, one per language. They are in the trees of Content, Marketing, Support and the Secretary.

| Skill | What it does | Files it opens |
|---|---|---|
| `humanize-text` | English. Marks the tells (staging instead of stating, inflation, forced rhythm, formatting by rule, chat leftovers, writing for the wrong reader), rewrites keeping every fact, checks the draft against the source, and sends Indonesian to the other skill | `references/english-tells.md`, `references/before-after-en.md` |
| `humanize-indonesian` | Bahasa Indonesia. Chooses the register and the form of address first, marks the tells by strength, edits with the official rules behind every correction, and also guides writing Indonesian from nothing | `references/registers.md`, `references/tells-id.md`, `references/official-rules.md`, `references/before-after-id.md` |

**Sources read (2026-11-23).** All written fresh, no text copied; the ideas and the public rules were used.

| Source | What it has | Licence | What we took |
|---|---|---|---|
| [blader/humanizer](https://github.com/blader/humanizer) | One skill, 26 patterns in six groups, a four-step way of working; patterns from Wikipedia's "Signs of AI writing" | MIT | The groups, the "when not to act" list, the rule to keep every fact |
| [adhiprib/humanizer-indonesia](https://github.com/adhiprib/humanizer-indonesia) | A long Indonesian catalog (syntax, words, cohesion, discourse), thresholds, registers | MIT | The idea of nominalization and calques as tells, the exemptions (patents, contracts, quotes) |
| [apissaj/humanizer-id](https://github.com/apissaj/humanizer-id) | Editing modes, 14 sub-skills, a data file of calques, references to PUEBI, EYD and the Badan Bahasa books | MIT | The list of official sources worth reading, the "safe harbors" idea |
| [ardha27/humanizer-id](https://github.com/ardha27/humanizer-id) | Casual and slang control, built on slang datasets | MIT | The warning against over-gaul and against mixing *gue/lo* with *aku/kamu* |
| [ariosenodev/humanizer-bahasa-indonesia](https://github.com/ariosenodev/humanizer-bahasa-indonesia) | 21 patterns adapted from the Wikipedia guide | MIT | The pattern list for stock phrases |
| Badan Bahasa (Kemendikdasmen): *Bentuk dan Pilihan Kata*, *Kalimat*, *Paragraf* (2019), EYD Edisi V (2022), KBBI VI Daring | The rules | Public documents | The rules in `official-rules.md`, each with how well it is backed (read, inference, not verified) |

**What the research found, in plain words.** Almost nothing about AI-written Indonesian is measured. One study of high-school essays (ChatGPT-4o) found less word variety, fewer modal verbs and more even sentences in the machine texts. Its classifier reached about 90% on that one kind of text and fell to about 71 to 77% on paraphrased text in another project, and it flagged a formal human essay. Every list of stock phrases comes from commercial blogs or translated English lists. The one calque with a real source is *di mana* and *yang mana* used as relative words (Badan Bahasa calls it `penggunaan kata yang tidak cermat`). Detectors are unreliable. So the skills present themselves as an editing aid, label every tell with its strength, and never promise to beat a detector.

**Rules these two skills keep.** Never invent a fact, a name, a number or a consequence; leave quotes, legal text, names, code and data alone; do not shorten more than the author would; change nothing when there is nothing to fix; do not type badly on purpose to look human; say what was and was not done.

**Tried in a real conversation.** `app/tests/humanize-skills.mjs`, in a throwaway project, with Nobo (Content): an Indonesian post, an English post, a letter with nothing to fix and a thin bio, in one conversation. The first runs found that the English reference was sometimes not opened and that a consequence was added to a fact; both were fixed in the wording and tried again.

**Not covered.** A native Indonesian editor has not judged the example sentences. The TBBBI was not read directly. The two skills do not rewrite code comments or commit messages as a special case.
