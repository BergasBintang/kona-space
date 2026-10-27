# Changelog

Newest first. How versions are named: `docs/VERSIONING.md`.

## 0.13.0, 2026-10-28

The Brain learns from sessions.

- When a session ends, Kona writes a short note about it into the project's brain: what happened, decisions, open items and what was touched. One cheap Haiku call, after the conversation is cleaned of secrets. You can turn it off in Brain, and press "Write a note" in any session to do it by hand.
- A note says where it came from (the session, the role, the ticket, `source: summary`). Claude may link only to notes that exist; any other link it made up is turned back into plain words. The call's dollars are saved in the cost ledger under that session.
- A new session starts with a short digest from the brain: open items and recent sessions for its role and ticket, and a hint that it can look things up.
- Claude can search the brain itself with two new tools, `search_brain` and `read_note`. The answer says Found, Partly or Not in the brain, with the note and lines, and a miss goes on the wanted list. A note or section that looks like it holds a secret is never shown to it.
- "Ask Claude in a session" from the Brain now offers to save the answer as a note when it arrives.
- The sidebar scrolls when the window is short: the places scroll, the two plan bars stay in view.

## 0.12.0, 2026-10-28

The Brain.

- A Brain place: a graph of linked notes. Three layers: your own notes (plain markdown in the project's hidden `.kona/brain` folder, which you can write, edit and delete), 14 starter notes that ship with Kona (how to work with Claude Code agents and how to use Kona), and Claude's memory for the project, read in read-only.
- Ask the brain: every answer is Found in the brain, Partly in the brain, or Not in the brain, in words and a glyph. Found and partly answers show the note, the layer, the exact lines and how much of the question the section covers. A miss offers choices (ask Claude in a plan-only session, search the web after a confirmation, open the nearest topic, write the note) and never acts alone.
- A wanted list: questions the brain could not answer are kept in the project, shown in the report, and come off the list when you write the note.
- A map of the notes (dots, written and guessed links, soft groups), a notes list with a layer filter, and a note reader where `[[links]]` open notes and links to nothing are marked.
- A health report: links that go nowhere, notes nothing links to, decisions with no source, open items older than 30 days, notes that look like they hold a secret, the most connected notes, and how the notes group compared with how they are filed.
- Text that looks like a key, a password or an IP address is hidden from the search and from answers, and is never saved to the wanted list.
- Not yet: a note written by a session when it ends, a digest at the start of a session, and a search tool for Claude itself (the next version).

## 0.11.0, 2026-10-28

Leftovers.

- A Leftovers place: the programs your sessions started (dev servers, watchers) and which of them are still running after the session ended.
- Each item shows the program, the exact command, the port it listens on, which session (and role) started it and for how long. A red count on Leftovers in the sidebar, and "1 left behind" on the session row.
- Stop a program after a confirmation that shows the command, the port and what else it started. Kona only stops the very same program it listed (the same process id and start time). Ignore hides one you want to keep running.
- Scratch files: the size of Claude's temporary folder for each session, Show in Explorer, and Delete for a finished session after a confirmation.
- Removing a ticket's own copy warns when programs from that ticket's sessions are still running.
- Fixed: the first words of a session's title lost every letter s.
- Kona looks every 4 seconds only while a session is open or something is alive, and does nothing otherwise. Everything it sees is also written to `leftovers.jsonl` in Kona's data folder.

## 0.10.0, 2026-10-28

The worktree graph.

- A Worktrees place: a picture of the project's branches (where each left the main branch, how many commits ahead, how far the main branch moved on) and one card per working copy.
- Each card shows the branch, the folder, the ticket that owns it (or none), the last commit, how many files changed and are not committed, and a state: merges cleanly, would clash (with the files named), nothing to merge, or the folder is gone.
- Merge a copy's branch into the main branch from the card. Git checks for clashes first, the main folder must have no uncommitted changes, and a half-done merge is undone. The ticket history records it.
- Remove a copy from the card. A copy with uncommitted files is only removed after you tick a box that names what will be thrown away; a branch with unmerged commits is kept unless you choose to throw it away.
- Moving a ticket to Done asks first when its own copy still has commits the main branch lacks.
- A new confirmation dialog: one question, plain words, Cancel has the focus, Esc cancels.

## 0.9.0, 2026-10-28

A worktree per ticket.

- A ticket's session can work in its own copy of the repo: a separate folder inside the project's hidden `.kona/worktrees`, on its own branch `feat/T-0012-login-page`. It cannot step on your main folder or on another ticket.
- Frontend and Backend work in their own copy by default (a setting on the role), and a ticket can override it: follow the role, its own copy, or the main folder.
- A second session on the same ticket continues in the same copy. The card and the ticket show the branch, how many commits it is ahead or behind, and how many files changed and are not committed.
- The chat header says "Own copy" and shows the folder Claude is working in. Costs, the session list and the board still group by project.
- Claude is told it is in the ticket's own copy and on which branch. Merging and clean-up come with the worktree graph.

## 0.8.1, 2026-10-28

A cleaner repository for anyone who downloads it.

- A `README.md` at the top: what Kona is, what works, what you need, how to run it, where things are.
- A `.gitattributes`, so text files have the same line endings on every PC and pictures and the design file are never altered.
- The design scripts no longer point at one person's temporary folder: their screenshots go to `docs/design/build/build-output/` (ignored by Git), and `FIGCRAFT_CLI` can name FigCraft's command line tool.
- The author's own screenshots of other tools (`docs/trials/`) and the VS Code workspace file are no longer in the repository. They stay on the author's PC.
- More things are ignored by Git: local Claude Code settings, local database files, backups and temporary files.

## 0.8.0, 2026-10-27

Tickets and the board.

- A Board place with five columns: Backlog, Ready, In progress, Review, Done. Create a ticket, drag cards between columns, open a card to edit it, set its role, next step and a "waiting on you" flag.
- Tickets are plain text files in the project's hidden `.kona` folder, so you can read, edit and back them up without Kona.
- "Start session as ..." on a card opens a session as the ticket's role with the ticket told to Claude. The card moves to In progress, links the session, and shows what the session has cost.
- Claude can raise and update tickets itself through a small tool server Kona starts with each session (list, read, create and update). It can move a card up to Review, never to Done and never remove one. The history says exactly which session and role did each change. These tools run without an approval card, even in Plan only.
- The Costs place can group by ticket.
- Not yet: a separate worktree per ticket (next version), a summary written into the ticket when a session ends, drag with the keyboard (use the Column choice in the card).

## 0.7.0, 2026-10-27

The voice.

- A Voice place where you describe how Claude talks to you: a short description, language, length of answers, humor, emoji, plain words, and what to call you. The first voice is the terse operator you chose: short, plain words, no jokes, no emoji, no nickname.
- Kona's own lines on four screens (the start screen, a session starting, a session ending, near the plan limit) are in the same voice, and you can rewrite them.
- The voice is told to Claude at the start of a session, with a fixed rule that it only changes wording: never code, files, commit or ticket text, commands, warnings, errors or numbers, and never the facts or the advice.
- A "What Claude is told" box shows the exact text. When you start a session you can switch the voice off for that session.
- Permission questions, warnings and error messages always stay plain.

## 0.6.0, 2026-10-27

The needs check.

- Each role lists the tools it needs (Git, Node.js, npm, PHP, Composer, Python, Docker, Rust and Cargo, GitHub CLI, OpenSSH). The starting roles come with sensible lists, and you can change them in the Roles place.
- The start screen shows what the role and the project need, which are on this PC (with their version) and which are missing. The project's own files add to the list: for example a `package.json` suggests Node.js and npm.
- For a missing tool Kona shows the install command as text, with a Copy button. It never installs anything, and you can still start the session.

## 0.5.0, 2026-10-27

Costs.

- A Costs place: what your sessions cost, from the ledger Kona keeps. Pick a period (today, 7 days, 30 days, all time) and group it by project, role, account, model, day or session. Each line shows its share, the tokens sent and written, and the dollars.
- Dollars are an estimate at list price, not your bill, and the screen says so.
- Only sessions Kona ran are counted.

## 0.4.0, 2026-10-27

Accounts, and better lists.

- An Accounts place for two or three Claude logins. Add one, name it, sign in, rename or remove it. "Main" is the login already on this PC.
- Choose the account when you start a session, or give a role a usual account. A warning stops you starting on an account that is not signed in.
- Each account has its own plan bars, kept between runs with their age. The ledger saves the account of every turn.
- New base parts for choosing from a list: single select, multi select and a smart search box (typo-tolerant, initials, any word order, matched letters marked, a clear "nothing found" message). They replace the system dropdowns, which were white on the dark window.
- Not yet: signing in with an API key instead of a login.

## 0.3.0, 2026-10-27

Roles.

- A Roles place with ten starting roles: Product, Design, Frontend, Backend, QA, Security, DevOps, Marketing, Content and SEO, Support. Each has a mark, a model, a permission mode and a short brief.
- You can change any role, add your own and remove one. The list is kept on this PC.
- Start a session "as" a role: it starts with that role's model and permission mode, and Claude is told the role's brief. You can still change the mode for one session.
- The session list and the chat header show the role. Each paid turn in the cost ledger now records its role, ready for cost views.
- Only the three safe modes are offered (ask every time, edits free, plan only).
- Not yet: skills and tool servers per role, accounts, the board, the Brain, leftovers, resuming old sessions.

## 0.2.0, 2026-10-27

Projects and files.

- Add a project (a folder with your code). Kona makes a hidden folder inside it for its notes and tells Git to ignore it. Nothing else in the project changes.
- Switch between projects. Sessions are listed per project.
- A Files place: a folder tree and a read-only viewer for text, JSON, pictures and PDFs. Kona never changes your files from there, and it refuses any folder that is not in a project.
- Not yet: roles, accounts, the board, the Brain, leftovers, resuming old sessions.

## 0.1.0, 2026-10-27

The first Kona that works: one session, in a real window.

- Pick a folder and chat with Claude Code. Answers stream in as they are written.
- Claude asks before it runs a command or changes a file. Two buttons: Allow once, Don't allow.
- Paste or add a picture and send it along.
- Each session shows what it has cost so far in dollars (an estimate at list price, not your bill), and every turn is saved in a local cost ledger.
- The two plan bars (this 5-hour session and this week) fill in by themselves.
- Closing or killing Kona stops every Claude it started, and every program Claude started from it.
- Not yet: roles, accounts, files, the board, the Brain, leftovers, resuming old sessions.

## 0.0.2, 2026-10-27

A window opens. The build tools are in place.

- Rust and the C++ build tools are installed on D:, so Kona can be built here.
- `app/` holds the first Tauri window (React and TypeScript). It shows the starter page, not Kona yet.
- First build: 4 minutes 26 seconds. The idle window uses about 450 MB, above the 200 MB aim (see the plan, test S6).
- `VERSION` is the one place the version number is written; the app files copy it.

## 0.0.1, 2026-10-27

Before the app runs. This is the plan, the design and the first tests.

- The plan, in `kona-space-app.md`: what Kona is, 16 features, 41 decisions, the build order and the tests to run first.
- The design, in `docs/design/kona-design.figcraft`: tokens, parts, about 35 screens, a clickable prototype, a collapsed sidebar, and a Brain drawn as a graph of linked notes. Rules in `docs/DESIGN.md`.
- Three tests run in `spikes/`, all passed:
  - S1: a streaming `claude` session gives answers, exact cost, and the two plan bars with no unofficial address.
  - S3: a project's sessions can be listed from the transcript files.
  - S5: worktrees can be listed and a merge clash previewed without touching a file.
- No app yet.
