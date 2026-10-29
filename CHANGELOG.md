# Changelog

Newest first. How versions are named: `docs/VERSIONING.md`.

## 0.20.1, 2026-10-30

Cleanup of what the old look left behind. Nothing new to learn.

- The leftover rounded-corner classes (100 uses) and the radius tokens of the soft look are gone, along with an unused colour token.
- A command nothing called (`running_sessions`) is removed, and the backup no longer copies the old `roles.json`.
- The README and the Accounts help now describe the office, the fixed roles and one account per project.
- Still waiting for a decision (ticket T-0003): the old design files in `docs/design`, the FigCraft guide, the early trials and spikes, and a few files outside the project.

## 0.20.0, 2026-10-30

The office: a new look, a welcome page, one account per project, and a pixel office instead of the sidebar.

- **Welcome page.** Kona opens on a page with a card for each project: its account, and whether that account is signed in. A signed-out account offers Sign in or Use another account. A project with no account yet asks "Which account does this project use?" once. The Kona mark in the top bar brings you back to it.
- **One account per project.** Every session in a project (a role, a ticket, a Brain question) uses the project's account. Adding a project asks for one of the signed-in accounts. The account of a role is gone. Removing an account clears it from the projects that used it, and they ask for another on the welcome page. Resuming an old session keeps the account it was saved under, because its transcript lives there.
- **The office.** The sidebar is replaced by one isometric pixel-art building with a room for every place (Board, Brain, Files, Servers, Git, Costs and so on). Click a room to zoom in and open what it holds. A top bar stays in view with the project, a Go to list of every place, a way back to the office, what is waiting on you, the account, and the two plan bars.
- **Cats at their desks.** Every role is its own cat, at its own desk. A cat types while its session works, raises a paw when it waits on you, and looks pleased when it is done, with a small bubble that says so in words. Cats blink when idle. Motion stops under Windows "reduce motion" and when the window is hidden.
- **A secretary.** A new role at the front desk for general questions. She turns what you say into tickets for the other roles.
- **Roles are fixed.** The ten roles and the secretary come with Kona and cannot be edited. Roles now shows them read-only. The old roles file is no longer read (it is left where it is). A custom role made before this version is no longer available: a ticket that used one asks you to choose a role again.
- **A light paper look.** Warm cream and paper colours, bright but not too bright, with dark brown text. Every pair of colours is checked by `npm run contrast` (text 4.5 to 1, borders and the focus ring 3 to 1). Hover goes darker. No rounded corners anywhere.
- **Pixel art everywhere.** A new pixel logo and app icon (the orange cat), pixel state marks, tiled pixel frames for buttons, cards, dialogs and text boxes (paper for most, teal for the main button, red for a button that cannot be undone), and a clean pixel font (Pixelify Sans, licence OFL) for headings, buttons and labels. Long text, code and paths keep plain fonts.
- Not done: the window zoom steps (90 and 80 percent) make pixels uneven, so the office and frames look slightly rough there; moving furniture and a way to add rooms; the cleanup ticket (T-0003) that removes the leftovers of the old look and design files.

## 0.19.4, 2026-10-28

A new logo, and Costs is always one project.

- A new logo: a black cat with soft pointed ears and two tilted white oval eyes, with a gold sunflower between its ears. The app icon is the cat on an ice-blue rounded square; inside the app the mark is the same cat in flat gold. It is drawn by `docs/design/build/build-logo.mjs`, which now writes plain SVG (no FigCraft needed).
- Costs is always for the open project. The This project or All projects switch from 0.19.3 is gone, and so is Group by Project (it would be one line). Open another project to see its costs. Costs of projects that are no longer in Kona stay in the ledger file but are not shown.

## 0.19.3, 2026-10-28

Costs shows the open project.

- Costs now opens on the open project only. A new switch next to the period, This project or All projects, shows the whole ledger again when you want it. Before, every project in the ledger was listed, including ones you had removed from Kona, which looked like another project's costs leaking into a new one.
- With one project shown, Group by Project is hidden (it would be a single line) and the grouping starts on Role. The ? next to Costs explains the switch.

## 0.19.2, 2026-10-28

A softer, lighter look.

- The dark theme is lifted one step: the page background goes from near-black to a soft slate, the cards and panels follow, and the text is a little warmer. Text and state colours keep their contrast (body text about 13 to 1; the state words stay readable on their tints).
- The logo's gold shows up in a few places that are not state colours: a thin marker on the active place in the sidebar, the Kona mark beside the title on Start a session and Add a project, the mark on the update card and beside the version in Settings, and the highlight of selected text. Gold is still never a button colour, because it is also the colour of waiting.
- The state colours for idle, done, stopped and left behind are a little lighter, and their tinted backgrounds a little fainter, so they stay clear on the lighter surfaces.

## 0.19.1, 2026-10-28

Help buttons, a map you can move, and a crop fix.

- Explanations are no longer shown under headings. Each one is behind a circled "?" next to the heading; pressing it opens the explanation in a small window (Esc, Close or a click outside closes it). This covers Settings, the page titles, Accounts, Scratch files, the Brain note switch and the Brain report. Messages about what is happening now (counts, errors, empty lists) stay on the page.
- The Brain map can be moved and zoomed: drag it, scroll the wheel, or use Zoom in, Zoom out and Fit all. It opens zoomed out so every group is fully inside the frame.
- Fixed Start a session and Add a project being cut off at the top when the window is short: the content is centred only when there is room, and can always be scrolled to the top.

## 0.19.0, 2026-10-28

Updates.

- Kona can update itself. A few seconds after it starts it asks GitHub (one small request, nothing about you is sent) whether a newer version is published. If there is, a card says so: Update and restart, or Later. On yes it downloads the installer, checks its signature, installs and starts again. If sessions are running the card says they will be closed. Offline or a failed check says nothing.
- Settings has a new Updates part: a switch for the start-up check, and Check now.
- Updates are signed with a key that lives outside the project, and Kona only installs what that key signed. `npm run release` builds the signed installer and the `latest.json` file; the steps to publish are in `docs/RELEASING.md`.
- Copies older than this one have no update check and need one manual install.
- Pages are wider, and they grow with the zoom: at 80% they keep the width they have at 100% instead of leaving wide empty margins. Buttons and badges ("Back up now", "Signed in") no longer wrap their words onto two lines.
- The repository is public and now has an MIT license (`LICENSE`) and a `SECURITY.md`.

## 0.18.0, 2026-10-28

An installer, and a Rust lint pass.

- An installer: `npm run tauri build` makes `Kona_<version>_x64-setup.exe` (2.66 MB, NSIS). It installs for the current user only, so it needs no administrator rights. The build is set to make this one kind of package only.
- Clippy (Rust's lint tool) was run over the whole core. 27 warnings, all about style, none about a bug; 22 were fixed automatically and the 10 tests still pass. The 5 left are three commands that take many arguments (Tauri passes them that way), one `sort_by_key` suggestion, and one false alarm on a line in the ssh check where two `if` statements sit side by side on purpose.
- `npm run smoke` can be pointed at another test port with `PORT=`.

## 0.17.0, 2026-10-28

Kona's logo.

- A logo: a cat head with pointed ears, a sunflower in its face, and two eyes in the middle of the flower (the cat is the name's owner, the sunflower is for the owner's girlfriend). It is gold on Kona's dark surface, and it replaces the ring mark in the sidebar, folded or open.
- The app icon (window, taskbar, installer) and the page icon are the same drawing, dark on a gold rounded square.
- The logo is drawn by `docs/design/build/build-logo.mjs` with no FigCraft window; its files and notes are in `docs/design/logo/`.
- Removed the unused Vite and Tauri sample pictures from `app/public`.

## 0.16.1, 2026-10-28

Size, a folding sidebar, and no window scroll.

- The whole window can no longer scroll: a focus jump had pushed the app up and left an empty strip at the bottom. Each part scrolls inside itself, and a stray scroll snaps back.
- Size: 100%, 90% or 80%, set in Settings or with Ctrl and minus or plus (Ctrl and 0 goes back to 100%). It is the web view's own zoom, so text, layout and pictures scale together, and it is remembered.
- The sidebar folds to a narrow strip of icons with its button or Ctrl+B, and remembers it. Waiting and left-behind counts stay visible on the icons.

## 0.16.0, 2026-10-28

Audit and hardening.

- The audit is written down in `docs/AUDIT.md`: what was checked, the plan against what was built, the measured budgets, what was fixed and what is still open.
- The window now has a content-security policy. Nothing was blocked in any place (seen in the release program).
- The graphics process is turned off (`--disable-gpu`): Kona's idle memory fell from about 235 MB to about 119 MB. The breathing mark is a stepped animation and the logo is still when idle, so idle CPU fell from 21% of a core to about 0%.
- The session limit is a hard 3 (was 6). Each Claude session takes about 400 MB, and the Settings text says so.
- A session's summary note waits while other sessions are working.
- A session can only be started with a permission mode Kona offers, a plain model name, a real session id and a folder inside a project. Anything else is refused by the core, whatever the screen sends. Unit test added.
- The brain's secret scan uses ASCII lower case so a letter with a longer lower case cannot shift a position. Test added.
- `npm run smoke` opens every place of a running Kona and checks nothing is blocked.

## 0.15.0, 2026-10-28

Polish: limits, settings, backups, resume.

- A Settings place: how many sessions may run at once (default 2, because each uses about 400 MB), each project's GitHub address, removing a project (its files and hidden folder are never touched), and where Kona keeps things.
- Kona refuses to start more sessions than the limit, with a plain message. Sessions that ended no longer count.
- Backups: one press copies Kona's own files, the cost ledger and each project's tickets and brain notes into a dated folder under `%APPDATA%\Kona\backups`. Kona never deletes a backup by itself; you can delete one after a confirmation.
- Earlier sessions: the sessions Claude Code saved for a project are listed under Sessions, and Resume continues one. The ledger counts only what the resumed session spends from then on.
- "Always allow here" on an approval card: Claude Code remembers the rule in the project's local settings and stops asking for the same thing. It is not offered for commands that reach a server.
- Add a project with an optional GitHub address.
- The file tree works with the arrow keys (Up, Down, Left, Right, Home, End), and a markdown file opens as a page, with a switch to the plain text.

## 0.14.0, 2026-10-28

The SSH registry.

- A Servers place: the servers each project may reach, kept as references. A server has a name, a host, a port, a user, the path of its key file, its fingerprint and the roles that may use it. Kona never opens, copies or stores a key; typing the text of a key is refused.
- A role can run ssh, scp or sftp only to a server listed for that role. A role with no server cannot run those commands at all. A host that is not on the list, the wrong user for a listed host, and any attempt to switch off the check of the server's identity are refused with a plain message Claude can read.
- A command to a listed server still asks you first, with a card that names the server (and says whether its fingerprint was checked), even if your own Claude settings would allow it without asking.
- Read a server's fingerprint after a confirmation (Kona connects to the port only to read the public host keys), compare it with the server's own record, and save it. If it later differs, Kona says it changed and warns you before you trust it again.
- Each server can give you a ready-to-paste entry for your ssh config. The key file is checked for being found, and for being inside a project folder or a cloud-synced folder.
- A message that contains a private key header is never sent to Claude.

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
