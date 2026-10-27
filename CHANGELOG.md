# Changelog

Newest first. How versions are named: `docs/VERSIONING.md`.

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
