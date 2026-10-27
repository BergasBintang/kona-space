# Kona (kona-space): Master Note

Everything decided, planned and learned about Kona. Written on 2026-10-24 from one Claude Code session (model Sonnet 5.5, VS Code extension) plus the earlier [session-notes.md](session-notes.md), which stays as the full original record.

**Status: planning only. No code exists yet.** The folder `D:\kona-space` holds this note, `session-notes.md` and `kona-space.code-workspace`. It is not a git repository yet.

Tags used in this note:

| Tag | Meaning |
|---|---|
| (seen) | Checked on this PC or in a screenshot during the session |
| (web) | Read on a web page during the session, not tested. Verify before relying on it |
| (proposal) | A suggestion from Claude. Not agreed, not built |
| (to verify) | An assumption that needs a small test before anything depends on it |

This note holds no keys, tokens, passwords, IP addresses or e-mail addresses, on purpose. If a later edit needs one, keep it out of this file.

## Contents

**Part A: The project**
1. What Kona is, in the owner's words
2. Full feature list
3. Decisions and corrections
4. Questions for the owner, and the answers
5. Risks and unknowns

**Part B: Design (all proposals)**

6. The core idea: one chain, many views
7. How each feature would work
8. Kona's design rules
9. Light-on-the-PC plan
10. Technology choices
11. Existing tools (research)

**Part C: Plan**

12. Build order
13. Small tests to run first (spikes)
14. Next actions

**Part D: Context**

15. Environment and numbers
16. Keeping Kona out of Miralis
17. Plain-language explanations from this session
18. Glossary

**Part E: Carried over from session-notes.md**

19. Digest of every section of session-notes.md
20. Sources

---

## Start here

**What Kona is.** A personal desktop app for one person (the owner), installed on the owner's own Windows PC. It wraps Claude Code in a workspace the owner controls, so the owner depends less on VS Code and on the Claude terminal. It is not a SaaS product and not a Miralis product. It has no landing page, backend, web app or mobile app.

**What it should do, one line each**
1. Show a folder tree and open files of any type, like VS Code.
2. Keep projects (one repo each), and let each role open its own sessions, with its own skills and MCP servers, for the tickets assigned to it.
3. Show cost and usage like the terminal does, including the plan bars.
4. Take pasted images in a session, like the VS Code extension.
5. Make switching Claude accounts easy.
6. Keep one "brain" per project, so no session is left behind.
7. Keep a place for SSH keys per project (the VPS servers).
8. Draw a graph of git worktrees, because agents create their own branches.
9. Show a Kanban board of tickets: who raised each one, which agent finished it, what is next.
10. Recommend which local apps each session needs.
11. Log ports, processes, screenshots and temp data per session, so leftovers are visible.
12. Run lightly: "as long as it can run nicely in my PC".
13. Give every small base component (button, badge, field, menu, tab, dialog, progress bar...) a look and behavior that is recognisably Kona's own.
14. Give Kona a customizable personality for talking to the owner, without touching the work Claude does.
15. Keep a record of what each session costs in dollars, like the terminal's `Total cost`, per session, role and project, in a local database (SQLite).

**Where things stand** (after the owner answered the 21 questions on 2026-10-24)
- Decided by the owner: a personal local app, not Miralis, light on the PC. One project is one repo with its own brain, SSH entries and GitHub repo path. Roles open the sessions for the tickets assigned to them. SQLite for the cost ledger. The interface is in English, built with Tailwind v4 and React Aria, dark and roomy, with a calm, technical and warm mood. Kona's voice is terse, in words anyone can follow. The full list is in section 4 and in the decisions table (section 3).
- **Decided on 2026-10-24: build from scratch, borrowing patterns** (section 11.6). Claudette ran fine on this PC (about 540 MB idle, about 700 MB with two sessions) but covers only sessions, worktrees and image paste, and the owner did not like its screens (section 10.6). Kanban Code was read from source, not built: its card model and column rules are worth borrowing (F10), but its Windows terminals need WSL and it edits the Claude settings file. Claudette's trial files were deleted on the owner's yes.
- **Design draft v0 done on 2026-10-25** in FigCraft (`docs/DESIGN.md`, `docs/design/`). It waits for the owner's reaction. Two more existing apps were trialled on throwaway projects after the owner named them: Vibe Kanban (section 11.8) and CloudCLI (section 11.9). Section 11.10 compares the four looks. All trial files were deleted afterwards. One new open question came out of it: should Kona's sessions run in the owner's auto mode (no approval cards for what auto approves) or in an explicit mode where every call reaches Kona's card (section 11.9)?
- **Owner answers on 2026-10-25:** design v0 approved ("love it, go on"). Permission mode is set **per role** (for example a strict reviewer and an auto builder), which answers the open question above. The first version must have the file tree and viewer, role sessions, cost and usage, and the Kanban board. Working style: build a whole chunk, then report; stop only for decisions, installs and deletes. How many Claude accounts the owner uses is still unanswered.
- **Trial leftovers thrown away on 2026-10-25** at the owner's request: the Kanban Code and Vibe Kanban source clones in `D:\kona-refs` and every helper file in the session scratch folder. Only the two Untitled UI reference repos remain there. The trial screenshots and RAM samples in `docs/trials/` were kept as evidence for sections 11.8 and 11.9.
- **Design version 2 (2026-10-25):** after the owner pointed out that four roles is thin, Kona now ships ten roles (Product, Design, Frontend, Backend, QA, Security, DevOps, Marketing, Content and SEO, Support), each with its own mark. The design file was merged to three pages (Tokens, Parts, Screens) and is now also a clickable prototype in FigCraft with hover states and a first-run flow (checks, add first project). New: states (empty, loading, signed out), a light theme proposal, a density table. See `docs/DESIGN.md`. First-run steps chosen by the owner: check Claude and login, add the first project.
- **Design version 3 (2026-10-27):** the Brain screens were redrawn for the linked-note brain (six screens) and the sidebar can fold to a 72 px rail with the Kona mark kept, after a VS Code picture from the owner. Two collapsed twin screens in the prototype, 49 component sets. See `docs/DESIGN.md`, sections "The Brain" and "The collapsed sidebar". Not tried in the presenter.
- **Full front-end design (version 1) drawn on 2026-10-25** in FigCraft: a second batch of parts plus fourteen screens (chat, changes, board, ticket, files, worktrees, costs, roles with permission mode, leftovers, brain, settings, command palette, new session, add project). See `docs/DESIGN.md` and the previews in `docs/design/previews/`. Superseded by version 2 above.
- Done: the Untitled UI React repos were pulled into `D:\kona-refs` as throwaway references, and the Miralis canon was read without changes (sections 10.6 and 11.7). `CLAUDE.md`, `AGENTS.md` and `docs/` were created in this folder. `git init` was not ticked, so the folder is still not a git repo.
- Proposed by Claude and not contradicted: Tauri shell, TypeScript interface with a thin Rust core, plain files plus SQLite, drive the real `claude` program, the build order in section 12.

**Progress so far** (everything done up to 2026-10-26; the details are in the sections named in the right column)

| When | What was done | Where |
|---|---|---|
| Earlier | Research session; 21 questions answered by the owner; decisions table, risks, build order, spikes written; `CLAUDE.md`, `AGENTS.md`, `docs/` created (no `git init`) | sections 3 to 5, 12, 13 |
| 2026-10-24 | Interface kit research: Untitled UI repos pulled to `D:\kona-refs` as reading material; the Miralis canon read for the owner's taste (discipline taken, marks not) | 10.6, 11.7 |
| 2026-10-24 | Trial of Claudette on a throwaway project, then deleted. Owner disliked its screens. **Decision: build from scratch**, borrowing patterns | 11.6 |
| 2026-10-24 | Kanban Code read from source (not run) | 11.6, F10 |
| 2026-10-25 | Vibe Kanban and CloudCLI each run once on a throwaway project after the owner named them; findings and RAM numbers recorded; all trial files deleted. Four-app comparison written | 11.8, 11.9, 11.10 |
| 2026-10-25 | Design v0 drawn in FigCraft (tokens, first parts, two screens); owner answered "love it, go on". Permission mode decided **per role**. First version must have: file tree and viewer, role sessions, cost and usage, Kanban board | 10.6, `docs/DESIGN.md` |
| 2026-10-25 | Trial leftovers thrown away (Kanban Code and Vibe Kanban clones, scratch files). Screenshots and RAM samples kept in `docs/trials/` | this section |
| 2026-10-25 | Design v1: second batch of parts and 14 screens | `docs/DESIGN.md` |
| 2026-10-25 | Design v2: the owner said four roles is too thin, so Kona ships **ten roles** (Product, Design, Frontend, Backend, QA, Security, DevOps, Marketing, Content and SEO, Support) with a mark each. File merged to three pages (Tokens, Parts, Screens). Hover sets for sidebar places, tabs, session rows and buttons (38 component sets). First-run flow (welcome, checks, add first project, creating, ready) with the two failure paths (Claude missing, not signed in). States: loading, empty, signed out. Light theme and compact density as proposals. 710 prototype links | `docs/DESIGN.md` |
| 2026-10-26 | Every screen made a fixed 1440 by 900 window; taller or wider content scrolls inside it (chat, lists, diff, board columns, files, settings, roles and more). The scroll setting is applied but was not tried in the presenter | `docs/DESIGN.md` |
| 2026-10-27 | Brain redrawn as a graph of linked notes (map, notes, report, three answers: found, partly, not in the brain). Plan: F7 and decisions 40 and 41. Starter brain, Claude memory folder read-only, gap awareness, wanted notes | F7, `docs/DESIGN.md` |
| 2026-10-27 | Collapsed sidebar: a 72 px rail that keeps the Kona mark, with a fold button on every project screen, hover tooltips, and two collapsed twin screens (Chat and the Brain map). Design version 3. `run-all.sh` was not repeated end to end; the two new scripts were run on the open file | `docs/DESIGN.md` |
| 2026-10-27 | Spikes S1, S3 and S5 run and passed (plain TypeScript in `spikes/`, no install). `git init` done, first commit and tag `v0.0.1`, version naming in `docs/VERSIONING.md` (decision 14). Owner chose the Tauri desktop app now | section 13, `CHANGELOG.md` |
| 2026-10-27 | Toolchain installed on D: (Rust 1.99.1, C++ build tools). Hello-world Tauri app in `app/`, version 0.0.2: first build 4 min 26 s, idle window about 450 MB (over the 200 MB budget, S6 and S7) | section 13 |
| 2026-10-27 | **Step 1 built: Kona 0.1.0.** One working session in the Tauri window (Rust core, job object, cost ledger, React screen), checked in the real window; spike S1b and test S2 passed. Release build measured: 402 MB working set, 213 MB private, 0.03 CPU seconds idle | section 12 (step 1), section 13 |
| 2026-10-27 | **Kona 0.2.0: projects and the file viewer** (first part of step 2): add and switch projects, a lazy file tree, read-only viewer for text, JSON, pictures and PDFs, sessions per project | section 12 (step 2) |
| 2026-10-27 | **Kona 0.3.0: roles** (second part of step 2): ten starting roles, a Roles place to edit them, start a session as a role, role saved in the cost ledger | section 12 (step 2) |

**Where the work lives**
- Design file: `docs/design/kona-design.figcraft` (open in FigCraft; it is also the clickable prototype). Previews: `docs/design/previews/`. Rules and tokens: `docs/DESIGN.md`.
- Scripts that draw it: `docs/design/build/`. `run-all.sh` rebuilds the whole file while FigCraft runs with its control port. `build-previews.mjs` writes the PNGs.
- Trial evidence: `docs/trials/`. Reading material: `D:\kona-refs` (the two Untitled UI repos only).
- Memory summary for future sessions: Claude's `kona-app-purpose` and `kona-ui-taste` memory files.

**Spikes run on 2026-10-27:** S1 (streaming, cost, plan bars), S3 (transcripts) and S5 (worktrees) all passed, in plain TypeScript run by Node 22 with no install (`spikes/`). **Not done yet:** no app shell, no toolchain installed (Rust and C++ build tools), S1b approval cards and image paste untested, S2, S4, S6 to S12 not run. Git is initialised (first commit, tag `v0.0.1`, nothing pushed). Still open for the owner: are ten roles and their starting modes right, do the ten marks read at small size, how many Claude accounts, should dialogs dim the whole window, which mono font.

**Next three actions**
1. Run the small tests in section 13 (S1, S3, S5) to prove the risky parts, starting with reading the hooks documentation.
2. Install the toolchain (Rust and the C++ build tools, with build output on D:) only after the owner's yes, and prove a hello-world window (S6, S7).
3. Decide `git init` when the ticket and worktree features start.

**Not yet:** writing app code, packaging an installer, `git init`, installing the Rust toolchain. `D:\kona-refs` holds reading material only (the two Untitled UI repos and the Kanban Code and Vibe Kanban sources), never installed or built (sections 11.7 and 11.8).

### For future Claude sessions (read this first)
- Treat `D:\kona-space` as **not a Miralis repo**. Skip the Miralis canon sync, the `miralis-*` skills and the Miralis effort rule, even though the global instructions mention them. See section 16.
- The owner is learning programming concepts. Explain in plain words with short analogies, and define a term the first time it appears.
- Ask before downloading, installing, deleting or killing anything. Ask before running any command on a server.
- The PC is small (7.3 GB RAM, 4 cores). Do not propose heavy runtimes or many parallel agents without saying what they cost.
- Never write keys, tokens or passwords into this folder or into notes.
- Never start a session with a working folder inside `D:\kona-refs`. Those cloned repos carry their own `CLAUDE.md`, which would load as instructions.
- Anything tagged (to verify) is an assumption. Test it before building on it.
- This note is the plan. `session-notes.md` is the earlier research. Claude's own memory holds a short summary (section 15). When a decision changes, update the Decisions table (section 3) instead of starting a new note.

---

# Part A: The project

## 1. What Kona is, in the owner's words

The first description, lightly cleaned:

> I want to build a personal app for me, named Kona, that installs on my own machine. It is designed to make me less locked in to VS Code, or even the Claude terminal (even though it also uses some of the Claude terminal). Basically I want an app like VS Code, where I can see the folder tree and what is inside a file, across any extension. I also want a way to group my projects, so that every section can open a session with different types of skills and MCP servers per role. It should read the cost usage like the terminal does, and also let me inject an image into Claude, like the Claude extension in VS Code. Also, make switching accounts easier.

Added later, in the order the owner asked:
1. **Plan-limit bars.** Claude raised doubt that the "12% of session, 35% of week" bars could be read by an app. The owner answered: it works, because the terminal already shows them.
2. **A unified brain** for each project, so "no session is left behind".
3. **A path to store SSH keys** for every project, including the keys to the VPS servers.
4. **A graph about git worktrees**, because agents will pull or create different git streams.
5. **A Kanban board** to see every project ticket that was raised or finished, by which agent, and what to do next.
6. **A recommendation of which local apps** each session might need.
7. **Light on the PC**: "I don't want it to burden my PC", then "as long as it can run nicely in my PC".
8. **A ledger of leftovers**: every port in use, every PHP or npm process that runs, every screenshot or temp file, logged per session, so the owner can see what is still running or left behind. The owner said this problem happened in a previous session.
9. The owner apologised for asking for a lot ("I know it's a little bit too much"). The answer was: ideas are cheap, the build order is where scope gets cut (section 12).
10. **A look and feel of Kona's own** (sent while this note was being written). Pull the Untitled UI repository onto this machine first as inspiration ("and then we can throw it later"), and maybe use the Miralis canon's base components too. The goal, in the owner's words: "making every little base component have an identity for Kona itself" (sections 10.6 and 11.7).
11. **A customizable personality** (also sent while this note was being written). Kona should be able to have a personality the owner can customize, "only for talking to human and not to do the work", because the owner still needs Claude's ability to make changes here and there (feature F15).
12. **A cost ledger** (also sent while this note was being finished, with a screenshot of the terminal's Session block). The owner wants the usage cost in dollars, like the terminal's `Total cost`, "to be able to differentiate", and stored on the local machine "using sqlite or pgsql" per session, per role and per project (feature F16).

### 1.1 What Kona is not
- Not a SaaS product with a landing page, backend, web app and mobile app. Claude guessed this early in the session from the earlier notes, and the owner corrected it.
- Not a Miralis product or a Miralis Studio client build.
- Not a new AI client. It builds on Claude Code, so it uses Claude's models, tools, skills and MCP servers.
- Not a replacement for all of VS Code. The file viewer starts read-only. Editing, diffs and git come later, if still wanted.
- Not for other people. One user, one PC. No logins to share, no hosting.

### 1.2 Why it exists
The owner wants less lock-in. Today the work lives in two places that each own part of the experience: the VS Code extension (sees the editor, shows images and diffs, clickable files) and the terminal (shows `/usage`, scriptable, works over SSH). Kona keeps the owner's data (tickets, summaries, role setups) in plain files the owner controls, and owns the window.

### 1.3 Who and what
- One user (the owner), Windows 11, Claude Pro plan, uses the VS Code extension and the terminal today.
- Works across many projects, uses several skills, two connected MCP servers (seen), and has at least one VPS to deploy to.
- Account switching is a stated goal, but the owner has one account for now (question 5).

---

## 2. Full feature list

| ID | Feature | In simple terms | Build step |
|---|---|---|---|
| F1 | Session runner | Chat with Claude Code inside Kona. See answers as they stream, see each tool call, approve or deny actions, resume old sessions, stop a session. Every session has a folder, a role, an account and a model | 1 |
| F2 | Image input | Paste or drop a screenshot into the message box, like the VS Code extension | 1 |
| F3 | Usage panel | Tokens and cost per session, shown in dollars the way the terminal does (an estimate at list price, see F16). Plus the two plan bars (5-hour "session" and 7-day "week") with reset times | 1 |
| F4 | Projects, file tree, viewer | A project is one repo, with its own brain, SSH entries and GitHub repo path. Browse its tree. Open any file read-only first: code, markdown, images, PDF, JSON | 2 |
| F5 | Roles | A role is a saved setup: which skills, MCP servers, model and permissions a session gets. Start a session "as" Backend, QA, DevOps and so on | 2 |
| F6 | Accounts | Choose which Claude account a session uses. Each account has its own login folder | 2 |
| F12 | Needs check | Each role or project lists the local tools it needs (PHP, Composer, Node, Git, Docker...). Kona checks what is installed and recommends what is missing. It never installs by itself | 2 (basic) |
| F11 | Leftovers ledger | Per session: processes, ports, screenshots and temp files it started or created, and whether they are still alive or left behind. Safe cleanup actions | 1 (job object), 3 (panel) |
| F10 | Kanban board | Tickets per project in columns. Each ticket links to the session, role, worktree, branch and commits. Agents can raise and update tickets through a built-in MCP server. The owner moves cards to Done | 4 |
| F9 | Worktree graph | A picture of branches and worktrees, which agent owns each, uncommitted changes, ahead or behind main, and a merge-conflict preview | 5 |
| F7 | Project brain | A graph of linked notes (wiki links, section index, clusters, health report, a map). Every session becomes a note. New sessions start with a short digest | 6 |
| F8 | SSH registry | Per project: which server, user and key file to use. References only, never the key itself. Only certain roles may connect | 7 |
| F13 | Light on the PC | A rule that applies to everything: caps, lazy loading, narrow file watching (section 9) | all |
| F14 | Kona UI kit | Every small base component (button, badge, field, menu, tabs, dialog, bars, rings...) built once from Kona's own tokens and identity marks, and reused by every screen (section 10.6) | 1 (tokens and the first six components), then grows with each step |
| F15 | Personality (Kona's voice) | A voice the owner can design (name, tone, language, humor, length) that is used only for talking to the owner. Claude's work, and everything written to files, stays plain. One click turns it off (section 7) | 2 (first version) |
| F16 | Cost ledger | Kona saves what every session costs in dollars, like the terminal's `Total cost`, so cost can be compared per session, role, project, ticket and account. Stored in a local SQLite file (section 7) | 1 (tables), 2 (views by role and project) |

---

## 3. Decisions and corrections

Status values: **Owner** = the owner decided. **Proposed** = Claude suggested it and the owner did not object. **Open** = undecided. **Reversed** = changed during the session.

| # | Topic | Choice | Why | Status |
|---|---|---|---|---|
| 1 | What Kona is | Personal local desktop app for one user | The owner said so | Owner |
| 2 | Miralis | Not a Miralis repo | The earlier notes say so, the folder is not under `C:\` and is not named `miralis*`, and the owner calls it a personal app | Owner |
| 3 | Downloads | Do not download the existing GUI apps now (Claudette, Kanban Code and others). Exception, by the owner's later request: the Untitled UI repos in `D:\kona-refs` | The owner said "don't download it now", then asked for the UI repos to be pulled first | Owner |
| 4 | Weight | Must run nicely on this PC | The PC has 7.3 GB RAM and about 0.9 GB was free when checked (seen) | Owner |
| 5 | Base | Build on Claude Code (drive the real `claude` program, or the Agent SDK) and not a new AI client | Sessions, skills, MCP, images, tool permissions and cost data already exist there | Proposed |
| 6 | Shell | Tauri (the app uses the Edge engine already in Windows) | Lighter than Electron at run time | Proposed (replaced Electron) |
| 7 | Languages | TypeScript for the interface, a thin Rust core | SDK and web libraries are TypeScript. Rust is light and good for file and process work | Proposed |
| 8 | Storage | Plain markdown and JSON files as the source of truth, SQLite as a rebuildable index | No lock-in, easy to read and back up | Proposed |
| 9 | Roles | Roles are profiles (skills, MCP, model, permissions, needs) | Keeps each session lean and limits access | Proposed |
| 10 | Accounts | One login folder per account, chosen per session through `CLAUDE_CONFIG_DIR` | Kona starts each session as its own process, so it controls the environment | Proposed |
| 11 | SSH | Store references, never key bytes | Keys must not enter prompts, transcripts or the brain | Proposed |
| 12 | Kanban | Tickets are plain files. Agents propose status changes. The owner moves cards to Done | Agents otherwise declare victory early | Proposed |
| 13 | Safety | Kona never kills, deletes or installs anything without a yes, and shows exactly what | Matches how the owner already works | Proposed |
| 14 | Version | Readable numbers, never a commit code: `0.0.x` before the app runs, `0.1.0` for the first app, tags `v0.1.0`, a changelog and a GitHub release named "Kona 0.1.0" (`docs/VERSIONING.md`) | `0.x` honestly says "not stable yet" (section 19.4). The owner asked on 2026-10-27 to be sure which version is which, not a code like "ahsads" | Owner |
| 15 | Fork or scratch | **Build from scratch**, borrowing patterns from Claudette and Kanban Code. Decided on 2026-10-24 after the trial (section 11.6) | Claudette ran well but has none of the owner's distinctive features, is about 290,000 lines, and its look is not the owner's taste. Kanban Code's Windows port needs WSL for full terminals | Owner |
| 16 | Installed app or browser tab first | **Installed app (Tauri) from the start**, chosen by the owner on 2026-10-27 over the browser-tab-first option. The browser tab stays the fallback if the first Rust build is too heavy for this PC | The owner said "as long as it can run nicely", then chose the real window now | Owner |
| 17 | Interface references | Pull the Untitled UI React repos into `D:\kona-refs` as throwaway references. Read the Miralis canon without changing it | The owner asked: "pull it first, and then we can throw it later", and said Kona "might use" the canon's base components | Owner |
| 18 | Kona's own identity | Every base component gets Kona's own look. No Miralis marks (hexagon, cut line, ticks, state line) and no Untitled UI default look | The owner's goal: "an identity for Kona itself" | Owner (goal), Proposed (how) |
| 19 | Interface building blocks | React Aria Components for behavior, design tokens for the look, Kona's own components on top. Styling with Tailwind CSS v4 unless the owner prefers plain CSS | Accessible by default, styling is built ahead of time so it costs nothing at run time, and it is the pattern the reference repo uses | Proposed |
| 20 | Reuse rules | Copy code only from MIT sources (Untitled UI React), keeping the copyright notice. Treat the Vite starter (no license file) and the Miralis canon as reading material | License and identity | Proposed |
| 21 | Personality scope | A customizable persona (Kona's voice) only for talking to the owner. Never for the work: code, files, commit messages, tickets, tool inputs, prompts for other agents, permission and safety text | The owner wants Claude's ability to change things kept intact | Owner |
| 22 | Personality mechanism | A custom output style with `keep-coding-instructions: true`. An appended prompt file as the fallback. An optional rewrite pass later | These are documented ways to change the voice without removing Claude's coding behavior (web) | Proposed |
| 23 | Interface voice | Kona's own greetings, empty states and toasts use template lines from the persona (no model call). Permission, safety and error text stays plain | Free, and nothing important gets softened | Proposed |
| 24 | Cost storage | SQLite (one local file), not PostgreSQL. Append-only ledger tables, exported to CSV every month | No server, tiny memory use, easy backup. PostgreSQL is a background service that would load this small PC | Proposed |
| 25 | What the dollars mean | Dollars are shown like the terminal (four decimals), labelled as an estimate at list price, and used to compare sessions, roles and projects. Plan percent is shown beside them | Claude Code computes them locally, and Anthropic says they are not for billing, least of all on a Pro or Max plan (web) | Proposed |
| 26 | How a turn is recorded | Store each result's running total and compute the turn as the difference. Account from `modelUsage`. Handle `/clear`, resume, fork and crashes as in section 7, F16 | The totals are cumulative, so summing would count the same spend twice (web) | Proposed |
| 27 | What a project is | One project = one repo. It holds its own brain, SSH entries and GitHub repo path. Nothing above projects for now | The owner's answers to questions 3 and 4 | Owner |
| 28 | Roles replace sections | Tickets are assigned to roles, and each role opens its own sessions for the tasks assigned to it | The owner's answer to question 3 | Owner |
| 29 | Brain and tickets location | Inside each project in a `.kona` folder, kept out of git (through the local git exclude file, so no tracked file changes) | Question 4 | Owner (location), Proposed (exclude file) |
| 30 | Accounts | One account for now. The model supports many. Each account is either a login or an API key | Questions 5 and 6 | Owner |
| 31 | Kanban columns | Backlog, Ready, In progress, Review, Done, plus a "waiting on you" flag | Question 7 | Owner |
| 32 | Parallel agents | 2 at a time, hard cap 3 | Question 8 (one `claude` process measured 247 MB) | Owner |
| 33 | Folder setup | CLAUDE.md, AGENTS.md and docs/ created on 2026-10-24. No `git init` yet | Question 9 | Owner (done) |
| 34 | Design tool | None now, with an empty slot on the designer role | Question 10 | Owner |
| 35 | Cost ledger | SQLite. Views by role, project and ticket. No backfill: the ledger starts fresh | Questions 19 to 21 | Owner |
| 36 | Look | English labels. Tailwind v4 with React Aria. Mood: calm and quiet, technical and terminal-like, warm and friendly. Dark theme, roomy density | Questions 13 to 15 | Owner |
| 37 | Voice | Terse operator, English, no nickname for the owner. Every word must be understandable by someone with little tech knowledge. One persona for everything, with room for one per role later | Questions 17 and 18 and the owner's note | Owner |
| 38 | Reference folder | Keep `D:\kona-refs` until the first six components exist, then ask | Question 16 | Owner |
| 39 | Design draft | Claude drafted tokens, the first six parts, two signature parts and two screens in FigCraft on 2026-10-25 (`docs/DESIGN.md`, `docs/design/kona-design.figcraft`). It is a v0 for the owner to react to, not an approved look | The owner asked for "design first" and for it to be done in FigCraft so they could see it | Owner (reaction pending) |
| 40 | Brain model | A graph of linked notes: `[[wiki links]]`, a section index, computed clusters beside curated ones, a health report and a map, in the manner of graphify and the Miralis canon's note graph. Built by Kona's own plain code from the notes it writes. A model is used only for the one summary per session | The owner asked on 2026-10-27 for a brain "like graphify with clustering, indexing and wiki links, like the Miralis Canon". Graphify itself needs Python and model calls on every run, which a small PC and a Pro plan do not suit | Owner (direction), Proposed (how) |
| 41 | Starter brain and gap awareness | Kona ships with a read-only starter brain (how to use agents, how to use Kona). Every brain lookup says Found, Partly or Not in the brain, and on a miss offers choices (ask Claude in a session, search the web after asking, open the nearest starter topic, save the answer as a note) and logs a wanted note. Claude's memory folder is read into the brain, read-only. Kona writes its own graph code and may port the canon's method to TypeScript ("Kona need to convert it") | The owner's answers on 2026-10-27 to the three open questions on the brain | Owner |

### 3.1 Corrections log (what Claude got wrong and fixed)
- **First guess about the product.** Claude guessed a SaaS with landing page, backend, web app and mobile app. Wrong. Kona is a personal desktop workspace.
- **Electron first, then Tauri.** Claude first recommended Electron and said RAM "matters little on your own machine". After checking the PC (7.3 GB RAM, 0.9 GB free), that was wrong. Electron is dropped for run-time weight.
- **Plan bars.** First marked as "unknown whether the SDK exposes them". Research found two routes: GitHub reports of an undocumented field, and then Anthropic's own Agent SDK reference, which documents an experimental `/usage` report with a percent and a reset time per limit (section 7, F3). Still (to verify) in code.
- **"$0.0000 on Pro".** Claude first read the `$0.0000` in the screenshots as "cost is notional on Pro". Wrong cause. Those were fresh sessions with no model calls. On a subscription the terminal still computes a dollar estimate from tokens at list price, and Anthropic's docs call it not relevant for billing there (sections 7, F3 and F16).
- **Build order moved.** The first order put accounts last. Accounts and the leftovers job object are small and fix real pain, so section 12 moves them earlier.

---

## 4. Questions for the owner, and the answers

The 21 questions were asked and answered in the chat on 2026-10-24. Number 12 was answered by measuring. The table keeps the original numbers, because other sections refer to them ("question 14" and so on).

| # | Question | Answer | What it changes |
|---|---|---|---|
| 1 | Fork or build from scratch? | Try the two closest apps first (Claudette and Kanban Code), then decide. After the trial (section 11.6) the owner chose: **build from scratch** | Decision row 15. Claudette's trial files were deleted on the owner's yes |
| 2 | What does "recommend local apps per session" mean? | A needs list plus an installed check | F12 as designed |
| 3 | What is a "section"? | There is none. A project is a repo that holds the big brain, SSH entries "here and there" and the GitHub repo path. Each role opens its own sessions for the tasks assigned to it | The Section entity is gone. Roles take its place. Project = one repo (sections 6 and 7) |
| 4 | Where do tickets and the brain live? | Inside each project, kept out of git | A `.kona` folder in the repo, hidden from git through the local exclude file (proposal) |
| 5 | How many Claude accounts? | One for now | The model keeps many. The switching screen comes when a second account exists |
| 6 | Login or API key for Kona's sessions? | Per account: some use a login, some an API key | Each account has an auth type (section 6.1) |
| 7 | Kanban columns | Backlog, Ready, In progress, Review, Done, plus a "waiting on you" flag | F10 as designed |
| 8 | How many agents at once? | 2, hard cap 3 | Section 9 |
| 9 | Folder setup | `CLAUDE.md`, `AGENTS.md` and `docs/`. No `git init` | Done on 2026-10-24. Ask about `git init` again when the ticket and worktree features start |
| 10 | Design tool | None now, but leave a slot to hold one later. **Update 2026-10-25:** the owner asked Claude to draft Kona's design in FigCraft (installed on this PC), so FigCraft is the first tool in that slot | The designer role has an empty tool slot (F5). The draft is in `docs/DESIGN.md` and `docs/design/` (section 10.6) |
| 11 | What got left behind before? | Dev servers holding ports, background PHP, Node and npm processes, screenshots and temp folders | F11 watches these three first. Old branches and worktrees are lower priority |
| 12 | Free space on C: | Measured: 23.4 GB free of 138.6 GB. D: has 68 GB free | Enough for the Rust tools, but tight. Put build output and caches on D: |
| 13 | Language of the interface | English | One labels file, so a translation stays possible |
| 14 | Mood of Kona's look | Calm and quiet, technical and terminal-like, warm and friendly. Dark theme, roomy density | Section 10.6 |
| 15 | Styling approach | Tailwind CSS v4 with React Aria Components | Section 10.6 |
| 16 | What happens to `D:\kona-refs`? | Keep it until the first six base components exist, then ask | Nothing is deleted before then |
| 17 | Kona's voice | Terse operator, English, no nickname for the owner. Every word must be understandable by someone with little knowledge of tech | F15 (plain-words rule) |
| 18 | One persona or one per role? | One for everything, with room left for one per role later | The role keeps an optional persona field that stays empty for now |
| 19 | Which cost breakdowns? | By role, by project and by ticket (a session is always included) | F16 |
| 20 | Fill the ledger from old sessions? | No, start fresh | F16 has no backfill in version 1 |
| 21 | SQLite or PostgreSQL? | SQLite | F16 |

**Still open after the answers**
- **`git init`.** Left unticked. Ask again when the worktree and ticket features start.
- **Data to enter later, not decisions:** each project's servers and GitHub repo path.

---

## 5. Risks and unknowns

| # | Risk | Why it matters | How to check | Fallback |
|---|---|---|---|---|
| 1 | Subscription use through a tool that is not Anthropic's own | Anthropic changed the rules several times in 2026 for third-party tools that use a subscription login (section 19.11). A Kona that drives Claude might fall in a grey zone | Read Anthropic's own help article "Use the Claude Agent SDK with your Claude plan" (support.claude.com article 15036540, it appeared in a search this session, not opened) and the Consumer Terms | Drive the real `claude` program with the owner's own login, or use an API key (stable but billed per use) |
| 2 | Plan bars depend on an experimental report | Anthropic's Agent SDK reference documents a `usage_report` (percent used and reset time per limit) that arrives when `/usage` is sent as a prompt, and marks the type experimental. It only appears for a claude.ai login with the right permissions. Otherwise the answer is plain text to parse (web) | Test S1 in section 13 | Parse the plain `/usage` text, or embed the real `claude` terminal in a pane and run `/usage` there |
| 3 | Driving `claude` directly may not cover everything the SDK does | The CLI offers streaming JSON in and out, a permission-prompt tool, and MCP and settings flags (web), so Kona can probably skip a Node helper that costs RAM. Whether every SDK feature (the `skills` option, the `canUseTool` callback) has a CLI equivalent is not confirmed | Test S1 and S8 | Run the SDK in a small Node helper |
| 4 | Transcript format is not documented | The brain and session list read transcripts under `~/.claude/projects/`. The format can change | Test S3 | Tolerant, read-only parser that skips what it does not understand |
| 5 | Hooks may not cover every event Kona wants | The leftovers ledger and brain rely on hooks for exact attribution. The docs name events such as SessionStart, SessionEnd, PermissionRequest and Elicitation, and say some events (Notification, SessionEnd, PreCompact, PostCompact) never show up in the output stream (web) | Read the hooks page, run test S4 | The OS scan alone (less exact) |
| 6 | Windows maturity of the forkable apps is unknown | The READMEs do not say how complete the Windows builds are | **Checked 2026-10-24:** Claudette runs well on this PC. Kanban Code's Windows port needs WSL and tmux for full terminals, and native Windows mode is a stopgap in its own source | Build from scratch (chosen) |
| 7 | The Rust build is heavy on this PC | A first Tauri build on 4 cores and 7.3 GB RAM may take many minutes and several GB of RAM (estimate, not measured). The C++ build tools and Rust toolchain also need disk on drive C:, which has 23.4 GB free (measured), so keep build output and caches on D: | Tests S6 and S7, check C: space first | Local server plus browser tab first |
| 8 | AGPL license if forking opcode | Changes to an AGPL app must be shared if it is distributed or run as a service. Personal local use is fine | Read the LICENSE | Fork Claudette (MIT) or Kanban Code (Apache-2.0) instead |
| 9 | Secrets flow into transcripts and then into the brain | A pasted key lands in the transcript, then in summaries | Secret scan before indexing (rule in section 8) | Block ingestion of anything that matches key patterns |
| 10 | Parallel agents exhaust RAM | Each Claude Code session is its own process. Several at once will not fit in 7.3 GB | Measure with Task Manager during S6 | Cap at 2, queue the rest, shut down idle sessions |
| 11 | Scope is large | Six big features were added after the first idea. A half-built everything is worse than a finished small tool | Section 12 keeps v1 small | Cut from the bottom of the build order |
| 12 | Account switching may be read as limit evasion | Terms are unclear about switching only to dodge limits (section 19.14) | Use a second account only for a real separate purpose | Do not build "auto switch when limit hit" |
| 13 | Building Kona uses plan limits | The Pro plan resets weekly. In the screenshot 35% of the week was already used, and higher effort levels use limits faster (seen) | Watch the usage bars | Work in small steps, spread over weeks |
| 14 | The repo `CLAUDE.md` opt-out was never tested | The earlier notes say it only tells Claude to ignore Miralis parts and cannot switch off global rules. The files were missing until 2026-10-24 and now exist | Start a fresh session in this folder and see whether Miralis rules appear | Mention the opt-out at the top of each session |
| 15 | Process ID reuse and shared ports | Windows reuses process IDs. A port may belong to something the owner wants running, such as a database | Identify a process by ID plus start time. Never act on a port alone | Always show the command line and ask |
| 16 | Keys in synced folders | The server-access note is under OneDrive Desktop, which syncs to the cloud. If any private key sits in a synced folder, it syncs too | Look for key files under OneDrive paths (not checked) | Move keys to `~/.ssh` and keep them passphrase-protected |
| 17 | Web numbers are unreliable | Stars, release status and feature claims came from READMEs and vendor pages | The one-hour trial and each repo's own Releases page | Treat as leads, not facts |
| 18 | Git is installed, the GitHub CLI is not | Worktree features need git, and git 2.54.0 is installed (seen). Kanban Code's pull-request features rely on `gh`, which is not installed | Run `gh --version` if PR features are wanted | Install `gh` only if needed (ask first) |
| 19 | Interface license mix | Untitled UI React is MIT, but its Vite starter has no license file (reference only), its icons repo shows "NOASSERTION" (unclear), and its PRO components are under a separate paid license | Read each LICENSE before copying anything. Keep the MIT copyright notice on copied files | Draw Kona's own icons. Copy nothing from the starter |
| 20 | Kona ends up looking like Untitled UI or Miralis | Copying components keeps the donor's look. The owner wants Kona's own identity | The swap test (section 10.6) on the first six components | Re-skin through tokens first, then through the identity marks |
| 21 | A Claude session started inside `D:\kona-refs` | Each cloned repo has its own `CLAUDE.md`, which Claude Code would load as project instructions there | Never open a session with that folder as the working folder | Delete `D:\kona-refs` once it has done its job (needs the owner's yes) |
| 22 | The kit grows before the app works | About 28 base components were listed. Building all of them first would delay everything | Build only the first six, then add one when a screen needs it | Cut to the six |
| 23 | Bare mode ignores the subscription login | `--bare` is the cleanest "load only what I pass" mode, but it never reads OAuth or the keychain, so it needs an API key (web) | Read the bare-mode section before using it | Use `--strict-mcp-config`, `--setting-sources`, per-role config folders or the SDK `skills` option instead |
| 24 | The persona leaks into the work | A voice instruction can seep into commit messages, comments, ticket text or prompts written for other agents. An output style is an instruction Claude follows, nothing enforces it (web) | Test S11, and scan diffs, commit messages and tickets for the persona's marker phrases | Keep the persona text short and scoped, switch it off, or use the optional rewrite pass (the work then never sees the persona) |
| 25 | A custom output style drops Claude's coding instructions | Unless `keep-coding-instructions: true` is set, a custom style leaves out Claude Code's built-in software-engineering instructions (how to scope changes, how to verify work). That is exactly what the owner wants to keep (web) | Always set the field to `true`, set `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` to `0` so the field takes effect on every model, and check in S11 that Claude still verifies its work | Use `--append-system-prompt-file`, which appends and removes nothing |
| 26 | The persona hides or softens what the owner must know | A cheerful voice could blur an error, a warning or a permission request. A persona must also never agree more or flatter | Permission, safety and error text is always plain (design rule 16). The persona changes wording only, never facts or advice | Turn the persona off for that message |
| 27 | Dollar figures are estimates | Claude Code computes them locally from a bundled price table. They drift when prices change or a model is unknown (`costBasis` of `unknown`), and on Pro or Max they are not what the owner pays (web) | Label every figure "estimate". Keep tokens beside dollars so costs can be recomputed from an editable price table | Recompute from tokens with the price table |
| 28 | Double counting in the ledger | Totals are running totals. Resume and fork restore old spend. `/clear` restarts totals. Parallel tool calls share one message ID. Per-step output tokens are placeholders (web) | Store each result's total and use differences. Test S12 | Mark rows "opening balance", and rebuild from transcripts |
| 29 | `/usage` is rate limited | The usage endpoint can be rate limited. The terminal then shows the last-known bars for up to 60 minutes (web) | Space the calls out. Show the age of the numbers | Parse the plain text. Show "last known" |

---

# Part B: Design (all proposals)

Everything in Part B is a suggestion. Nothing is built, and the owner has not signed off on the details.

## 6. The core idea: one chain, many views

The features are not separate programs. They are different views of one chain of linked things. If Kona stores the links from day one, each feature is a small screen on top of the same data. If it does not, every feature needs its own glue code.

```
Project (one repo: folder, GitHub repo path, brain)
 |-- SSH host references (several servers)
 |-- Ticket (assigned to a role) --+
 |                                 v
 |            Session (role, account, model, folder)
 |               |      |      |
 |               |      |      +--> Leftovers (processes, ports, files)
 |               |      +---------> Summary (the brain)
 |               v
 |            Worktree / branch ---> Commits
```

Views over this chain: Kanban shows tickets. The graph shows worktrees and commits. The brain shows summaries. The leftovers panel shows leftovers. The usage panel shows tokens and cost, and because sessions link to tickets, it can also show **cost per ticket**.

### 6.1 The things (entities)

| Thing | Key fields (examples) | Notes |
|---|---|---|
| Account | label, login-folder path, plan, auth type (login or API key) | No tokens in files. A login lives in the folder that Claude Code owns. An API key would sit in the Windows keystore (proposal) |
| Project | name, repo folder, GitHub repo path, brain location, SSH hosts | One project is one repo (the owner's answer to question 3). A product made of several repos is several projects |
| Role | name, model, permission mode, skills, MCP servers, denied tools, SSH hosts allowed, needs, tool slot (empty for now, the designer role keeps one for a design tool), default account, persona (empty for now) | A saved setup for the work of a session. Tickets are assigned to roles. The voice is a separate thing (Persona) |
| Ticket | id, title, description, acceptance, status, raised by, role, sessions, branch, worktree, commits, cost, next step, history | One file per ticket |
| Session | Claude session id, project, ticket, role, persona, account, model, folder, start, end, state, tokens, cost, summary link, transcript path | Matches the Claude session ID so terminal and VS Code sessions can be adopted too |
| Worktree | path, branch, base branch, ticket, sessions, uncommitted changes, ahead/behind, conflict preview, last used | Read from git |
| Commit | hash, branch, author (human or role/session), message, ticket | Linked through branch name or a commit note |
| Summary | session, date, decisions, open items, files touched, next steps, edited-by-owner mark | The brain's building block |
| Leftover | kind (process, port, file, folder), identity (process id + start time, port, path), command line, folder, started by session, source (hook or scan), first seen, last seen, alive, size, confidence (certain or probable), status (open, ignored, stopped, cleaned) | One row per thing found |
| SSH host | project, label, host, port, user, key-file path, fingerprint, roles allowed | References only |
| Need | tool name, check command, version hint, install hint | Used by roles and projects |
| Persona | id, name, language, formality, humor, verbosity, emoji, how it addresses the owner, mode (style, append, rewrite, off), marker phrases, interface lines, voice text | Voice only. Chosen globally, per role or per session. Never applied to work output (F15) |
| Usage turn | session, turn number, time, model, input, output, cache read and cache write tokens, cost as reported, cost as computed, cost basis (list, managed, unknown, computed), price-table version, kind (turn, opening balance, adjustment) | One row per finished turn and model. The dollar ledger (F16). Append-only |
| Price entry | model, price per million tokens for input, output, cache read and cache write (5 minute and 1 hour), version, effective date | An editable table. Prices are never written into code |
| Plan snapshot | session, time, account, kind (`session`, `weekly_all`, `weekly_scoped`), percent, resets at, extra-usage credits used and limit | From the usage report. Shows how much of the plan a session used (F16) |

### 6.2 Where the data lives (proposal)

```
Inside each project (kept or ignored by git, open question 4)
  <project>\.kona\
    tickets\T-0012.md           one file per ticket
    brain\index.md              the front page: clusters, hub notes, open items, wanted notes (rebuilt, like graphify's wiki index)
    brain\notes\                one note per session, decision or topic, linked with [[wiki links]]
    brain\notes\2026-10-24-<session>.md
    brain\graph.json            links with weight and trust, section index, clusters, health report (rebuildable)
    leftovers.jsonl             event log for the ledger (probably git-ignored)

Kona's own app-data folder
  %APPDATA%\Kona\
    kona.db                     SQLite: an index rebuildable from the files and from transcripts, plus the cost ledger tables, which are NOT rebuildable
    exports\usage-YYYY-MM.csv   monthly CSV backup of the cost ledger
    (inside the app itself, read-only) starter-brain\   the notes Kona ships with: agents, Kona's screens, safe habits
    accounts.json               account labels and login-folder paths (no tokens)
    roles\<role>.json           role profiles (global, a project may override)
    personas\<id>.md            voice files: front matter plus a short text (no secrets)
    projects.json               projects: repo folder, GitHub repo path, SSH host names
    ssh-hosts.json              references to servers and key paths (no key text)
```

Every JSON file gets a `version` number so later changes can be migrated.

Example ticket file (field names are examples):

```
---
id: T-0012
title: Login page
status: in-progress
role: frontend
raised_by: session a1b2 (role: planner)
branch: feat/T-0012-login
worktree: D:\work\app-T-0012
sessions: [a1b2, c3d4]
cost_usd_estimate: 0.00
next: Wire the form to the API once T-0011 is merged
---
Description and acceptance criteria go here.

History:
- 2026-10-24 21:40 raised by planner session a1b2
- 2026-10-24 22:05 moved to in-progress, frontend session c3d4 started
```

Example role file (field names are examples):

```json
{
  "version": 1,
  "name": "backend",
  "description": "Laravel and PHP API work",
  "model": "sonnet",
  "permissionMode": "ask-before-edit",
  "skills": ["laravel-expert", "secure-code-guardian"],
  "mcpServers": ["kona-board"],
  "deniedTools": [],
  "sshHosts": [],
  "needs": ["php", "composer", "git", "node"],
  "defaultAccount": "main",
  "persona": "kona-default"
}
```

---

## 7. How each feature would work

### F1. Session runner
- **What:** chat with Claude Code inside Kona. Streaming answers, each tool call visible, approve or deny prompts, stop button, resume old sessions.
- **How:** Kona starts the real `claude` program once per session, in the session's folder, with the role's settings and the account's login folder. The documented way (web, Anthropic's CLI and headless pages) is print mode with streaming JSON in and out: `-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages`. The stream opens with a `system/init` event (model, tools, MCP servers, plugins) and each turn ends with a `result` message (final text, cost, session metadata). Kona reads every message: text, tool calls, tool results, token usage and rate-limit events. Approve or deny prompts can go to an MCP tool that Kona runs and names with `--permission-prompt-tool`. Other documented flags Kona would use: `--session-id`, `--resume` (by ID, by name, or by the path of a transcript file), `--fork-session`, `--name`, `--permission-mode`, `--model`, `--add-dir`, `--max-turns` and `--max-budget-usd`. The alternative is the Agent SDK in a small Node helper. It runs the same engine and adds a `canUseTool` callback and a `skills` option, but costs extra RAM.
- **Watch out:** permission prompts (the SDK has a `canUseTool` callback and the CLI has `--permission-prompt-tool`, both documented, web), readable diffs and smooth streaming are most of what makes the VS Code extension feel good. Budget real time for them. Resume by session ID from the transcript. Cap live sessions (section 9).
- **First version:** one session, text and images, streaming, stop, approve or deny.

### F2. Image input
- **What:** paste or drop a screenshot into the message box.
- **How:** Kona saves the image in the session's images folder and sends it as an image part of the message. In this session Claude's temp folder holds pasted images as `images\1.png`, `images\2.png` (seen). Sending format through the CLI is (to verify).
- **Watch out:** large images cost many tokens, so resize before sending (proposal). Images are part of the leftovers ledger (F11).
- **First version:** paste, drop, thumbnail preview.

### F3. Usage panel
- **Per message and per session:** input, output, cache read and cache write tokens, and the dollar cost, shown with four decimals like the terminal (`$0.0000`). The lines of the terminal's Session block map one to one to the documented `usage_report.session` fields (web): Total cost is `total_cost_usd`, Total duration (API) is `total_api_duration_ms`, Total duration (wall) is `total_duration_ms`, Total code changes is `total_lines_added` and `total_lines_removed`, and Usage is `model_usage` (tokens and dollars per model).
- **What the dollars mean (web):** Claude Code computes the figure locally from token counts at list price, so it is an estimate. On a Pro or Max plan the owner pays a flat fee, and Anthropic's docs say the session cost "isn't relevant for billing purposes" there. Use the dollars to compare sessions, roles and projects, and use the plan bars for the real limit. The `$0.0000` in the screenshots comes from fresh sessions that had not called the model yet (0 API time, 0 tokens). It is not a Pro-plan effect. Saving and comparing the figures is feature F16.
- **Plan bars, as the terminal shows them (seen):** "Current session 12% used, resets 9:50pm (Asia/Jakarta)" and "Current week (all models) 35% used, resets Oct 25, 12am (Asia/Jakarta)". The terminal also shows "What's contributing to your limits usage?" by skill for the last 24 hours (for example `/miralis-frontend-audit` 6%, `/keybindings-help` 1%). It says this is approximate, based on local sessions on this machine only, and does not include other devices or claude.ai. It also shows "Usage credits are off".
- **Where Kona gets the bars (web, to verify in code).** Three routes, best first:
  1. **The usage report (documented, experimental).** Anthropic's Agent SDK reference describes an `SDKUsageReport`, attached as `usage_report` to an assistant message when `/usage` is sent as a prompt. It holds session totals (cost, durations, lines added and removed, usage per model) and `rate_limits.limits`, a list of rows. Each row has a `kind` (`session`, `weekly_all` or `weekly_scoped`), a `group` (`session` or `weekly`), a `percent`, a `resets_at`, an optional `scope` (a model or a surface), a `severity` and `is_active`. It also has `extra_usage` (whether usage credits are on, the monthly limit, credits used). That is the same data as the terminal's `/usage` screen. **Conditions:** the session must use a claude.ai login with the right permission (a token made with `claude setup-token` does not qualify by default), and the account must not be on usage-based billing. Otherwise the answer arrives as plain text in the message, so Kona needs a text fallback. Anthropic marks the type **experimental**, so its shape may change. It needs Agent SDK v0.3.273 or later.
  2. **The live signal (documented).** A `rate_limit_event` carries `rate_limit_info`: a `status` of `allowed`, `allowed_warning` or `rejected`, an optional `resetsAt`, an optional `utilization`, and for an exhausted subscription an `errorCode` of `credits_required` (v2.1.181 or later). It is emitted when the session meets a rate limit. The page does not say what `utilization` measures, so use it as a warning light, not as the bar.
  3. **An older lead (GitHub reports, undocumented).** A `unifiedWindows` object with `five_hour` and `seven_day` entries. The official page does not mention it. Last choice.

  Kona would send `/usage` at session start, at session end and when the owner opens the usage panel (not after every turn), and draw one bar per row by `kind`. Anthropic's docs say commands such as `/usage` may make small requests of their own, and that the usage endpoint can be rate limited. The terminal then shows the last-known bars for up to 60 minutes with a "Showing last-known usage" note. So Kona should space these calls out (at most every few minutes), show how old the numbers are, and accept the plain-text fallback. Whether `/usage` sent as a prompt costs tokens is (to verify) in S1.
- **Fallback:** an embedded real terminal pane that runs `/usage`.
- **Always show which account** the bars belong to (F6).
- **Own "what contributes":** Kona can count tokens per role and per ticket from its own data. Like the terminal's, it only covers this machine.
- **Nice to have:** a context meter (how full the session's memory is). Claudette has one (web).

### F4. Projects, file tree, viewer
- **Project:** one repo. It carries its own brain, its SSH entries (several servers) and its GitHub repo path. There is no separate "section": the **roles** are the sections, and each role opens its own sessions for the tickets assigned to it (the owner's answer to question 3). A product made of several repos is several projects.
- **Tree:** loads one level at a time, hides or greys `node_modules`, `vendor` and `.git` internals, adds git status marks later.
- **Viewer, read-only first:** code and text in the Monaco editor (the editor inside VS Code), loaded only when a file is opened. Markdown rendered. Images. PDF. JSON and CSV as text. Unknown or binary files show size and type plus "open in default app". "Any extension" means Kona always shows something and never just an error.
- **Later:** editing, diff view, search in files, git status. Do not rebuild all of VS Code.

### F5. Roles
- **What:** a role is a profile with a name, description, model, permission mode, skills, MCP servers, denied tools, allowed SSH hosts, needs and a default account.
- **Why:** many skills cost context and make Claude less focused (notes section 7 caveat). Roles also limit access, for example only DevOps may use SSH.
- **A real example from this session:** the session loaded about 18 `miralis-*` skills and many design skills even though this is not a Miralis repo. A role-based session would load only what the role needs.
- **Starting roles (from the team guide in 19.2):** Product Owner or PM, UX/UI Designer, Architect or Tech Lead, Backend, Frontend, Mobile, QA, DevOps or SRE, Marketing or Content. A solo owner can begin with three or four (for example Planner, Builder, Reviewer, DevOps) and add more later (proposal).
- **Skill candidates per role:** see 19.7.
- **How to give a session only some skills and MCP servers (web, to verify in S8).**
  - **MCP:** `--mcp-config` plus `--strict-mcp-config` loads only the listed servers.
  - **Tools:** `--tools`, `--allowedTools` and `--disallowedTools`. A bare tool name in the deny list removes that tool from Claude's context.
  - **Settings:** `--settings` (a file or inline JSON, overriding the same keys for that session) and `--setting-sources` (`user`, `project`, `local`).
  - **Skills:** the TypeScript SDK has a `skills` option (a list of names, or `all`), which suggests a per-session choice. For the CLI the options are a separate config folder per role, or `.claude/skills` inside each worktree.
  - **Bare mode** (`--bare`) is the cleanest way to start with nothing loaded, but it never reads the subscription login. It needs an API key, so it does not fit a Pro login (section 5, risk 23).
- **A role-based clean profile also keeps Miralis instructions out** (notes section 13).
- **Roles are the "sections" (question 3).** A ticket is assigned to a role, and each role opens its own sessions for the tasks assigned to it.
- **Design tool slot (question 10).** The designer role keeps an empty tool slot (a name, how to start it, an optional MCP server). Nothing is chosen now. Penpot and the Craft Apps stay as examples (section 19.3).
- **Persona field (question 18).** The role has an optional `persona` field that stays empty for now, so one persona per role is possible later.

### F6. Accounts
- **How (web, from the notes):** each account gets its own config folder, selected with the `CLAUDE_CONFIG_DIR` environment variable. Log in once per folder with `/login`. Kona sets the variable when it starts a session, so there is nothing to switch, the owner just chooses.
- **Why Kona is better than the VS Code extension here:** the extension has no built-in switcher, one report says it ignores the variable, and another reported the wrong account's token being used (section 19.13). Kona owns the process, so it avoids this.
- **A new config folder** has none of the global rules or installed skills until copied. That is useful as a clean profile for non-Miralis work, but wanted skills must be copied in.
- **Limits:** each account has its own 5-hour and weekly limits.
- **Show it:** the account name and its bars in every session header. Confirm the active account with the usage bars, not only a label.
- **Terms (section 19.14):** two accounts of your own for separate purposes is fine. No sharing the login. No new accounts to dodge a ban. "Switch to B every time A runs out" is unclear, so do not build an auto-switch on limit.
- **Never store tokens in Kona.** The login stays in the folder Claude Code owns.
- **One account for now (question 5).** The model keeps many accounts, and the switching screen comes when a second account exists.
- **Each account has an auth type (question 6):** a login (the folder Claude Code owns) or an API key. An API key would be kept in the Windows keystore (Credential Manager), never in a file, and given to the session through its environment (to verify). With an API key, the dollars in the ledger are real money.

### F7. Project brain
- **What:** a per-project memory, so every session's outcome is kept and the next session starts informed. "No session left behind."
- **Where the data comes from:** Claude Code saves every session as a transcript file (JSONL) under `~/.claude/projects/<project folder name>/`, whether the session ran in the terminal, in VS Code or in Kona. On this PC the folder for this project is `C:\Users\asus\.claude\projects\d--kona-space\` (the project path with separators replaced by dashes) (seen). Kona only reads these. The format is not documented.
- **Seen working in CloudCLI (2026-10-25, section 11.9):** it lists every project and its sessions straight from these transcript folders, and it showed this very chat while it was still running ("Running in the Claude CLI", token count, model name, tool calls as small cards), with no hooks. One trap it also showed: the same project appeared **twice** when the drive letter differed in case (`c:\` and `C:\`, for example 28 and 3 sessions for one project), so Kona must compare paths without case.
- **Direction (owner, 2026-10-27):** the brain is a **graph of linked notes**, like graphify and like the Miralis canon's note graph (`tools/graph.mjs`, `tools/graph-index.mjs`, read on 2026-10-27, not run): wiki links between notes, an index cut into sections, clusters, a health report, and a map to look at. Not a flat pile of summaries. See decision 40.
- **Pipeline:** capture, summarize, link, index, cluster, inject, search.
  1. **Capture:** watch the transcript folders of open projects.
  2. **Summarize:** when a session ends, a small cheap model (Haiku) writes one note: decisions, open items, files and tickets touched, next steps. Once per session, not per message. The note uses `[[wiki links]]` to the tickets, roles, files, decisions and earlier notes it concerns (the model is told the existing note names, so it links instead of inventing).
  3. **Store:** plain markdown in `.kona\brain\`, one file per note (a session, a decision, an open item, a topic page). Front matter has the date, session ID, ticket, role and an "edited by owner" mark. The files are the source of truth (decision 8); the graph is rebuilt from them.
  4. **Link (the graph):** a link is a node-to-node edge with a weight: `[[wiki link]]` 3, the note's file name or a ticket id named in text 2, a section reference 1 (the canon's weights, read). Every edge also carries a **trust label** as in graphify: EXTRACTED (written in the note, certain), INFERRED (a model guessed it, shown dashed) or AMBIGUOUS (flagged for the owner). A link to a note that does not exist is a warning, not a stop (agents write these notes; the canon stops its own build on a broken link).
  5. **Index (sections, not files):** each note is cut at its headings into sections with start and end lines and its most telling words (a word counts more the rarer it is across the notes). A task then reads three sections of three notes, not three whole files. Plain code, no model, no extra program.
  6. **Cluster:** group notes by the links they make (label propagation, the canon's method: no model, same answer every run), compared with the **curated** groups, which are the project's roles, tickets and areas. Where the two disagree, Kona says so. Lesson from the canon (read): a few notes that everything links to pull the whole graph into one blob, so each link counts less the more heavily connected its two ends are.
  7. **Report (health):** hub notes (most connected, graphify's "god nodes"), notes nothing links to, broken links, decisions with no source session, open items older than 30 days, sections too long to read as one, and surprising links between clusters.
  8. **Inject:** a short digest at the start of new sessions, built from the index page and the open items of the session's role and ticket, through the repo `CLAUDE.md` or an appended system prompt (which one is to verify). Details are fetched on demand through `search_brain` on Kona's built-in MCP server (F10), which answers with section line ranges, like the canon's `route.mjs` (read).
  9. **Search and look:** keyword search over the section index is enough to start (Kanban Code uses BM25, web). The Brain screen shows the map (nodes coloured by cluster, edges by trust), a note, and the report. Vector search only if needed.
- **How this differs from graphify (read, `~/.claude/skills/graphify`):** graphify extracts nodes and edges with model calls over many files, needs Python, and costs tokens on every run. Kona's graph is built from notes it writes itself, so links and sections cost nothing to rebuild and the only model use is one cheap summary per session. A model may be added later for INFERRED edges. If a project already has a `graphify-out\graph.json`, Kona can show it as an extra layer (a code graph) without running graphify (proposal).
- **Watch out:**
  - Do not load everything into every session. It burns context.
  - Summaries drift. A wrong summary becomes a "fact". Let the owner edit and delete, and keep dates.
  - Secrets leak into transcripts. Scan for key patterns and redact before indexing or summarizing.
  - Summaries use plan limits. Skip them when the PC is busy.
- **Claude Code's own memory:** it keeps a memory folder per project, for example `...\projects\d--kona-space\memory\` with a `MEMORY.md` index (seen). Decide whether Kona's brain reads it, writes to it, or ignores it (to decide).
- **First version (step 6):** summaries as linked notes, the section index, keyword search and the health report. The map and the clusters come right after, because they only show something once there are tens of notes.
- **Owner's answers, 2026-10-27 (decision 41):**
  1. **A starter brain ships with Kona.** From the first launch Kona already knows how to use agents and how to use Kona itself. Starter notes are part of the app (read-only, versioned, marked `source: starter`), live in their own layer beside the project's notes, and link into them with the same `[[wiki links]]`. Planned topics (proposal, to be written from Claude Code's documentation, not from memory): what an agent is and what it can touch; sessions, context and why a long one gets worse; roles and permission modes (strict reviewer, auto builder); tickets and worktrees (one branch per agent); skills, MCP servers and hooks; cost and plan bars; leftovers and how to stop them; safe habits (secrets never in chat, ask before delete, read the diff); how to write a good ticket and a good prompt; what each Kona screen is for.
  2. **Kona knows when the answer is not in the brain.** Every search and every digest lookup ends in one of three results, shown in words and a glyph (not colour alone): **Found** (a section matches strongly; show it with its note and lines), **Partly** (only weak matches; show the closest three and say they are close, not exact), **Not in the brain** (nothing clears the bar). The bar is a score threshold on the section index, to be set by testing on real notes. On **Not in the brain**, Kona offers choices, never acts alone: ask Claude in a session (suggesting the role that fits), search the web (asks first, because it sends the words out), open the nearest starter topic, or write a note once an answer is found ("Save this answer to the brain?"). Each miss is kept on a **wanted notes** list in the health report, so gaps show up as a to-do instead of being forgotten. The question text stays on this PC.
  3. **Kona may write its own graph code, and convert the canon's.** The owner answered "Sure" and then "Kona need to convert it" (2026-10-27): Kona may port the canon's note-graph method to TypeScript (the canon is the owner's own work). Decision 20 (copy only from MIT sources) is relaxed for this one case.
  4. **Claude's memory folder is read into the brain, read-only.** Each file under `~\.claude\projects\<project>\memory\` (and its `MEMORY.md` index) becomes a note in a `source: claude-memory` layer, with the file's date shown, because a memory records what was true when written. Kona never writes there. The secret scan runs before indexing. Its `[[name]]` links become graph edges.
- **Still open:** does the brain also cover the repo's own documents and code (the answer to question 1 was about the starter brain, not about this)? Until said otherwise: session notes, the starter brain and the memory folder only.

### F8. SSH registry
- **What:** per project, which servers, users and keys to use. This answers "a path to store SSH keys for every project".
- **Recommendation:** Kona stores **references**, not key files. Each entry holds a label, host, port, user, the path to the key file, the server's fingerprint, which roles may use it, and notes.
- **Keys** stay in `~/.ssh` (or one chosen folder), protected by a passphrase, and loaded with the Windows OpenSSH agent (the agent service may need enabling, to verify). One key per server per user. The owner's current VPS has an admin login and a `deploy` login without sudo, so that is two entries with two keys.
- **If the owner wants one folder per project for keys:** keep it outside OneDrive and other synced folders, outside git, restrict its Windows permissions to the owner, and passphrase-protect every key. Kona keeps the path and checks that permissions are tight. OpenSSH on Windows may refuse keys with loose permissions (to verify).
- **Use `~/.ssh/config`** entries with `IdentityFile` and `IdentitiesOnly yes`, so SSH tries only the right key.
- **Rules:**
  - Only roles marked for SSH may connect.
  - Every `ssh` or `scp` command needs an approval prompt that shows the host and the command. This enforces the owner's existing rule to confirm before running commands on the server.
  - Never disable host-key checking. Store the fingerprint on first connect and warn if it changes.
  - Key text never enters prompts, transcripts or the brain. Kona blocks any message that contains a private-key header.
  - If Kona must hold a secret (for example a passphrase), it uses the Windows keystore (Credential Manager or DPAPI), never a plain file.
- **Not in this folder:** the owner's own server-access note lives outside this project. Do not copy its contents here.

### F9. Worktree graph
- **A worktree, simply:** a second working folder of the same repo on a different branch, so two agents can work at once without touching each other's files.
- **Data:** `git worktree list --porcelain` for worktrees (path, HEAD, branch), and the git log for commits. Kona runs `git` and parses the output. It does not write its own git engine. It watches the `.git` folder for changes instead of polling.
- **Linking to agents:** sessions that Kona starts know their worktree, because it is their folder. For worktrees made elsewhere, match by the folder recorded in the session transcript. Claude Code can create worktrees by itself, so they will appear.
- **Show per branch:** owner (role, session, ticket), uncommitted changes, ahead or behind main, a **merge-conflict preview** (`git merge-tree` can test a merge without touching files), age and a cleanup button.
- **Seen in other apps (section 11.8 and 11.9):** CloudCLI has a Worktrees tab (list, create) with a plain empty state ("Work on branches in parallel. A worktree checks out a branch in its own folder, so you can run separate chat sessions side by side and merge the results back when they are ready", one button). Vibe Kanban makes one worktree per task but puts it in the temporary folder, which Kona must not do.
- **Catches:** git does not let two worktrees check out the same branch. Ignored files such as `vendor`, `node_modules` and `.env` (Laravel) are missing in a new worktree, so each needs a setup step. Unused worktrees pile up. Every worktree with its own dependencies uses disk (D: has 68 GB free, seen) and file watchers.
- **Drawing:** a graph library or plain SVG, limited to the most recent commits for speed.
- **Needs git.** Git 2.54.0 is installed on this PC (seen). The GitHub CLI (`gh`) is not.

### F10. Kanban board and built-in MCP server
- **Tickets are plain files** in the project (section 6.2). Fields: id, title, description, acceptance, status, who raised it, role, sessions, branch and worktree, commits, cost, next step, history.
- **Columns:** Backlog, Ready, In progress, Review, Done, plus a "waiting on you" flag (open question 7).
- **Links:** dragging a ticket to In progress opens a session for the right role in a fresh worktree on a branch like `feat/T-0012-login`. When the session ends, the summary writes what was done and what comes next back into the ticket. A ticket is Done only after it is merged and the owner approves.
- **Agents propose, the owner decides.** Agents may move a card to Review. The owner moves it to Done.
- **Built-in MCP server (proposal):** Kona runs a small local MCP server with tools such as `list_tickets`, `get_ticket`, `create_ticket`, `update_ticket` and `search_brain`. Sessions get it according to their role. Because the call comes from a known session, "which agent raised this ticket" is exact, and Kona does not have to guess from chat text.
- **Per-ticket history:** who (role and session), what, when.
- **Cost per ticket:** the sum of its sessions.
- **Ideas to borrow from Kanban Code (seen in its Windows source, 2026-10-24):**
  - **Activity from the session file.** It decides whether a session is working by watching the modified time of Claude's own session file (the `.jsonl` transcript under `~/.claude/projects`): changing means working, stable for under 5 minutes means Claude stopped and needs you, over 5 minutes means ended, over 24 hours means stale. It needs no hook and no extra process, and it also sees sessions started from the terminal or VS Code. That fits "no session left behind" (F7) and the "waiting on you" flag. The exact thresholds are a proposal for Kona (to verify, spike).
  - **Column rules in one small function.** A working session always wins. Then archived. Then "all pull requests merged or closed" means Done. Then a column the owner dragged a card to is kept (a manual override). Then a pull request with a stopped session means Review. Then an activity state. A task with no session is Backlog. Kona's rules should be written the same way: one small function with a manual override that always wins.
  - **One source of truth.** Its architecture note says the board had two sources of truth and five independent writers racing, so cards bounced between columns. It fixed that with one pure function (state plus action gives new state plus a list of side effects). Kona should do the same for tickets and sessions, and keep every write to a ticket file in one place.
  - **A `kanban` command-line tool** (list, show, send a prompt to a card, export a session as Markdown). Same idea as Claudette's tool; Kona can ship one.
  - **Import GitHub issues as Backlog cards** (later).
  - **Not to copy:** its Windows terminals run through tmux inside WSL (a Linux virtual machine on the PC, heavy on a 7.3 GB machine), and its native Windows mode is a stopgap.

### F11. Leftovers ledger
The goal: for every session, see what it started or created and what is still alive or left behind.

1. **Prevent (for sessions Kona starts).** Put the session and everything it launches into one Windows **job object** with the "kill on close" setting. When the session closes, everything under it closes. This fixes orphan servers at the source. Processes started from the terminal or VS Code cannot be wrapped this way, and a program that deliberately breaks away from the job can escape it (to verify in test S2).

   What the docs add (web): on SIGTERM, Claude Code ends the process tree of any shell command still running, then runs its `SessionEnd` hooks. A print-mode run (`claude -p`) stays open while a background command that Claude started (a dev server, a watch build) is still running, so "the session is finished" can really mean "waiting on a server". Kona must show that state and offer to stop it. Setting `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` switches background commands off, a simple way to stop agents leaving servers running. A role that does not need a dev server could use it.
2. **Record intent (hooks).** Claude Code can run a small command at events such as session start, session end, and after a tool runs (the docs name SessionStart, SessionEnd, PermissionRequest and Elicitation among others, and the full list is to verify). A hook on shell commands writes: session ID, role, command, folder, time. This shows what the agent *meant* to start, for example `php artisan serve` or `npm run dev`, including background ones.
3. **Observe reality (OS scan).** List running processes and listening TCP ports with Windows' own APIs (for example the IP Helper `GetExtendedTcpTable`, to verify) and the `sysinfo` library in Rust. Do not start PowerShell for every scan, because that costs memory and time. For each: process ID and start time (to avoid ID reuse), command line, parent chain, working folder, port.
4. **Join.** Match scan rows to hook records, job membership, the parent chain or the folder. The result reads: "started by session X, 3 hours ago, still running on port 8000, session already ended".
5. **Files.** Claude's own temp folders have a known layout. In this session: `D:\temp\claude\<project>\<session>\scratchpad` and `\images` (seen). Kona can show size and age per session with confidence. For other temp files, only a time window is available ("created while the session ran, under the project folder or the system temp folder"), so mark those **probable**.
6. **Act, with a yes.** Per item: stop, clean, ignore, open folder. Always show the command line or the file list first. Never act on a port alone. An "ignore" list keeps things the owner wants running, such as a local database.

**Priorities (the owner's answer to question 11):** watch dev servers holding ports first, then background PHP, Node and npm processes, then screenshots and temp folders. Old branches and worktrees come later.

**Measured on 2026-10-24 (seen):** `D:\temp\claude` held 14,859 files, about 230 MB. At that moment no PHP, Node or similar server was listening on a local port (the filter only matched common names and local addresses, so this is not a guarantee).

**Panel:** type, what it is, which session and role started it, when, alive or not, size. A badge on a session that ended with things left behind ("2 left behind"). A warning when closing a ticket whose worktree still has running things.

**Cost control:** scan every 30 to 60 seconds only while sessions are open, plus once when a session ends. Log events to `leftovers.jsonl`: started, seen, ended, stopped, cleaned.

### F12. Needs check ("recommend local apps")
This is Claude's reading of the request (open question 2).
- **Two sources of needs.** The role (for example Backend: PHP, Composer, Git, Node) and the project, from hint files:

| Hint file or folder | Suggests |
|---|---|
| `composer.json`, `artisan` | PHP and Composer |
| `package.json` | Node and npm |
| `Dockerfile`, `docker-compose.yml` | Docker |
| `Cargo.toml` | Rust and Cargo |
| `pyproject.toml`, `requirements.txt` | Python |
| `.git` | Git |
| `.env` with a database setting | a database server |

- **Check:** look for the tool on the PATH (like `where php`) and in common install folders, run `<tool> --version` once, and cache the answer.
- **Show before the session starts:** "This session needs PHP 8.3 (installed), Composer (missing)". For a missing tool, show the install command as text. **Never install automatically.**
- **Also useful:** the designer role could list Penpot (runs in the browser) or one of the Craft Apps. A role can also list MCP servers it needs, and Kona checks they are reachable.

### F13. Light on the PC
See section 9.

### F14. Kona UI kit
See section 10.6.

### F15. Customizable personality (the voice of Kona)
- **What:** Kona can speak with a personality the owner designs: a name, a tone, a language mix, how much humor, how long its answers are, and what it calls the owner. The personality is **only for talking to the human**. Claude's ability to read, change and run things stays exactly as it is.
- **Where the persona applies, and where it never does**

| Applies to | Never applies to |
|---|---|
| Claude's chat replies to the owner | Code and code comments |
| Kona's own interface words: greetings, empty states, toasts, status lines | File contents, commit messages, pull-request text |
| Progress notes inside a session | Ticket text and brain notes (they are records, and later sessions read them) |
| | Tool inputs: commands, paths, queries, SSH commands |
| | Prompts Claude writes for other agents |
| | Permission prompts, safety warnings, error messages, and numbers such as cost, usage and limits |

- **How it works: three ways, in order of preference (proposal)**
  1. **Output style (documented, web).** A custom output style is a markdown file in `~/.claude/output-styles` or `.claude/output-styles`, with a `name`, a `description` and a `keep-coding-instructions` field. Setting `keep-coding-instructions: true` keeps Claude's built-in software-engineering behavior (scoping changes, verifying work) and only adds the voice. Without it, a custom style leaves those instructions out, the opposite of what the owner wants. The docs say the field only matters on the full system prompt, so Kona should also set `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0` (to verify). A style applies to the main conversation and to forks. Other subagents run their own system prompt, so the persona does not reach them. A style is chosen with the `outputStyle` setting (the name is case-sensitive), with the `/output-style` command (it also works in non-interactive and SDK sessions from v2.1.269), or inline through `--settings` (to verify). A switch in the middle of a session applies from the next message, and the first message after it loses some prompt caching.
  2. **Appended prompt (documented, web).** `--append-system-prompt-file persona.md` adds the persona text to the end of the default prompt and removes nothing. It is the simplest route, but changing the persona needs a new process (resume the same session by its ID).
  3. **Rewrite pass (optional, later).** Claude works with no persona at all. Kona passes Claude's finished chat reply through a cheap model that restyles the wording. Code blocks, inline code, paths, numbers and commands are masked first and restored after, so facts cannot change. A "show original" toggle stays on every message. It costs plan usage and a short delay, and it cannot restyle live streaming. It is the strongest guarantee that the persona never touches the work.
- **Kona's own interface voice needs no model.** Each persona carries a small table of lines for situations: greeting, session started, session finished, something failed, limit getting close, leftovers found, asking permission. Kona fills them in like templates, so they are free.
- **A persona is a file:** `personas\<id>.md` in Kona's app-data folder. Front matter: `id`, `name`, `language`, `formality`, `humor`, `verbosity`, `emoji`, `address_owner_as`, `mode` (`style`, `append`, `rewrite` or `off`) and `markers`. Body: a short voice description (aim for 300 words or fewer, because the text goes out with every request), do and don't lists, the table of sample lines, and the scope clause from the table above.
- **Where it is chosen:** a global default, a default per role (the Planner may speak differently from the Reviewer), and an override per session. One click on "persona off" gives plain Claude.
- **Leak guard:** each persona lists a few `markers` (signature words or phrases). Kona scans diffs, commit messages, ticket files and brain notes for them and warns if one shows up where the persona must not be.
- **The owner's choice (questions 17 and 18):** the default persona is a **terse operator**, in English, with no nickname for the owner. **Every word must be understandable by someone with little knowledge of tech.** In practice: short sentences, everyday words, and a technical term is followed by a few plain words. No humor and no emoji. One persona for everything. The role keeps an empty `persona` field so one per role stays possible later. The plain-words rule also applies to Kona's own interface text.
- **Other presets stay as examples only:** Plain (no persona), Casual buddy, Calm mentor.
- **Honesty rule:** a persona changes wording, never facts, advice or warnings, and it never makes Claude agree more or flatter (design rule 16).
- **First version:** one persona file, `style` mode, a global default, the table of interface lines, and the one-click off switch. Per-role personas and the rewrite mode come later.

### F16. Cost ledger (dollars per session, per role, per project)
- **What:** Kona keeps its own record of what every session costs, in dollars like the terminal's `Total cost`, so the owner can compare sessions, roles, projects, tickets and accounts over time. As far as the docs show, the terminal shows one session's totals at a time and restarts them when `/clear` starts a new session. It has no history of dollars by role or project, so Kona saves them.
- **What the dollars are (web):** Claude Code computes them locally from token counts at list price, using a price table bundled with the program. Anthropic calls `total_cost_usd` and `costUSD` "client-side estimates, not authoritative billing data". They can drift when prices change or when the installed version does not know a model. On a Pro or Max plan the owner pays a flat fee, and the docs say the session cost figure "isn't relevant for billing purposes" there. So in Kona the dollar figure is a **comparison unit** ("what this work would cost at API prices"), always labelled *estimate*. The real limit on Pro is the plan bars, so the ledger also records the plan percent before and after each session (below). If usage credits are on, real money can be spent beyond the plan, and the usage report shows it (`extra_usage`), so Kona records that too.
- **Database: SQLite, not PostgreSQL.** SQLite is one file with no server, uses a few MB of RAM, ships inside the app (opcode uses `rusqlite`, web) and is backed up by copying the file. PostgreSQL would be a background service using far more memory on a 7.3 GB PC, and if it ran in Docker Desktop that adds a virtual machine on top (my reading). It only pays off with several users or machines, or heavy concurrent writing, and none of that applies here. Write the SQL in a portable way so a later move to PostgreSQL stays possible. Keep the file out of OneDrive and other synced folders, because a sync tool can damage a database that is open.
- **Tables (proposal):**
  - `session`: one row per Claude session, with project, ticket, role, persona, account, source (started by Kona or adopted), folder, start, end, wall and API time, lines added and removed.
  - `usage_turn`: one row per finished turn and model. Append-only.
  - `price_entry`: editable prices with versions.
  - `plan_snapshot`: plan percent rows and extra usage from the usage report.
  - Views answer the questions: cost by session, role, project, ticket, account, model, persona, day and week.
- **How a turn is recorded (web, from Anthropic's cost-tracking page):**
  - Kona reads each `result` message. In streaming input mode every turn emits one, and `total_cost_usd` and `modelUsage` are **running totals** for the whole call. So Kona stores the cumulative figures and computes each turn as the **difference from the previous result**. It never sums the results.
  - `modelUsage` has per model: `costUSD`, input, output, cache read and cache write tokens, and a `costBasis` of `list`, `managed` or `unknown` (Claude Code v2.1.246 or later). It covers subagents and internal calls such as compaction. The plain `usage` field leaves subagents out, so Kona accounts from `modelUsage`.
  - Per-step `output_tokens` on assistant messages is only a placeholder, and parallel tool calls share one message ID. So Kona does not rebuild costs from per-step usage, except as a crash fallback.
  - `/clear`, `/reset` and `/new` restart the running totals, and the `/clear` turn carries a new session ID. When a total drops, or the session ID changes, Kona starts a new row and links it to the old one.
  - Resume and fork restore the earlier spend into the totals (from Claude Code v2.1.277, before that a resumed session started at zero). The difference method handles this when Kona has the last stored total. When it does not (a session first seen on resume), the first total is stored as an **opening balance**, not as a turn. For a fork, the parent's last total is the starting point.
  - A crashed session may end with a result whose cost fields are zero. Kona keeps the last good total and marks the session as crashed.
  - Error results also carry cost, and a result that hits `--max-budget-usd` counts the response that crossed the limit in `total_cost_usd` and `modelUsage` but not in `usage`. Kona records every result, not only successes.
- **Plan percent per session:** with the usage report, Kona saves the `session` and `weekly_all` percent at the start and end of a session. The difference approximates how much of the plan the session used. Other devices and claude.ai draw from the same limits, so the number is approximate, and Kona says so.
- **No backfill in version 1 (question 20):** the ledger starts fresh with the first session Kona runs. **Sessions Kona did not start (terminal, VS Code)** are therefore not in it. Their transcripts hold per-message token usage, so a read-only backfill stays possible later, with the role "unassigned", the project taken from the folder, and duplicates removed by message ID. Two other possible live feeds, not examined: the status line has a cost field, and Claude Code can export OpenTelemetry metrics (both mentioned on Anthropic's costs page, web).
- **Screens:** a table by session with tokens and dollars (four decimals, like the terminal), and totals by role, project and ticket first (the owner's choice, question 19), then account, model, day and week, each with a small bar. A "top sessions this week" list. A persona overhead view (average output tokens per turn, by persona, F15).
- **Budget guard (optional, later):** `--max-budget-usd` stops a print-mode run at a dollar amount, using the same estimate. Useful as a runaway guard for background agents, not as a Pro-plan limit.
- **Never:** use these numbers as an invoice. On an API key, Anthropic's Console usage page is the authoritative bill.
- **First version:** save one `usage_turn` row per finished turn plus the `session` row (Step 1), then the views by role and project (Step 2).

---

## 8. Kona's design rules

1. **Files are the truth.** SQLite is a cache that can be deleted and rebuilt. The one exception is the cost ledger (F16): it is append-only, and it is exported to a CSV file every month as its backup.
2. **Read transcripts, never write them.**
3. **Never store secrets.** Keep references. Scan and redact before anything enters the brain.
4. **Never kill, delete or install without showing exactly what and getting a yes.**
5. **Agents propose, the owner decides:** Done, cleanup, and anything outward-facing.
6. **Roles decide access:** SSH, tools, MCP servers.
7. **Identify a process by ID plus start time.** Never act on a port alone.
8. **Use an undocumented field only with a fallback.**
9. **Light first:** caps, lazy loading, narrow watching (section 9).
10. **Always show the account, role and folder** a session runs as.
11. **Start at 0.x and version the file formats.**
12. **One small feature fully working beats five half-done.**
13. **Build each base component once, from tokens, and reuse it.** No one-off styles on a screen. State is never shown by colour alone.
14. **Kona's look is Kona's own.** Take methods from other design systems, not their marks.
15. **A persona is a voice, never the work.** It shapes only what Kona says to the owner in chat and in its own interface. It never appears in code, comments, file contents, commit messages, ticket text, brain notes, tool inputs or prompts for other agents.
16. **Permission, safety and error text is always plain and exact.** A persona never changes facts, advice or warnings, and never agrees more or flatters. A permission prompt shows the exact command and, beside it, a one-line explanation in everyday words.

---

## 9. Light-on-the-PC plan

**The machine (seen, 2026-10-24):** AMD Ryzen 3 7320U (4 cores, 8 threads), 7.3 GB RAM with about 0.9 GB free while VS Code and Claude were open, 68 GB free on drive D:, Windows 11 Home.

**What actually loads the PC.** The window Kona runs in is not the biggest cost:
1. **The agents.** Each Claude Code session is its own process. One `claude` process measured 247 MB when the PC was checked (seen). Five at once will not fit in 7.3 GB, whatever Kona is written in.
2. **File watchers.** Watching `node_modules` or `vendor` across several worktrees eats CPU and memory.
3. **The shell.** Electron ships its own Chromium. Tauri uses the Edge engine (WebView2) that Windows already has, which is usually lighter at idle. WebView2 still runs as several processes, so measure instead of assuming.
4. **The editor.** Monaco is heavy if many copies are open.
5. **Background jobs.** Summaries and scans.

**Rules**

| Area | Rule |
|---|---|
| Agents | Default 2 live sessions, hard cap 3, the rest queue. Idle sessions are shut down and resumed later from their transcript |
| File watching | Only the open project. Skip `node_modules`, `vendor`, `.git` internals and build output. Use the OS's native change notifications, not polling |
| Editor | One Monaco instance, loaded when the first file opens. Very large files open in a plain viewer. No language servers in the first versions |
| Data | SQLite on disk with paged queries. No big in-memory lists. Rotate logs |
| Background work | One job at a time. Summaries only after a session ends, with a small model. Defer them while agents are working |
| Scans | Every 30 to 60 seconds, only while sessions are open, plus one at session end. Native calls, not PowerShell |
| Worktrees | Prefer few. Clean up after merge. Each one duplicates dependencies |
| Graph | Draw only the most recent commits |
| Startup | Start the window first, load the rest lazily |
| Interface kit | Styling is built ahead of time (Tailwind), so it costs nothing at run time. In version 1 avoid chart, animation and carousel libraries (draw bars and rings as small SVG). No Storybook, use one atlas page. Do not install the reference repos |
| Persona | Keep the persona text to about 300 words or fewer. It is sent with every request (cached after the first), and switching persona mid-session costs some caching. Interface lines are templates, not model calls. The rewrite pass is off by default |

**Proposed budgets (to measure in S6, then adjust):**
- Idle, no live sessions: aim for 200 MB or less across all of Kona's processes (including the WebView2 processes), and about 0% CPU.
- Kona's own overhead with two live sessions: aim for 300 MB or less, not counting the agents.
- Startup to a usable window: aim for under 3 seconds.

**A trap to avoid.** Free RAM was only about 0.9 GB with VS Code and Claude open. A fixed rule such as "pause background jobs below 1 GB free" would pause everything all the time. Express thresholds relative to Kona's own use, or tune them after measuring.

**A possible bonus (unverified).** If Kona replaces VS Code for much of the daily work, total memory use might go down, because VS Code is itself an Electron app. Measure before claiming it.

---

## 10. Technology choices

### 10.1 The plan (proposal)
- **Shell:** Tauri 2. The app is a small Rust program that shows a web interface inside the Edge engine that Windows already provides.
- **Interface:** TypeScript with React and Vite. The three forkable apps use the same family: Claudette (React), opcode (React 18, Vite 6), Kanban Code's Windows app (React, TypeScript, Zustand) (web). Libraries for the editor (Monaco), drag-and-drop for the board, and graph drawing are all JavaScript.
- **Core (Rust):** starting `claude` and reading its output, Windows job objects, file watching, process and port scanning, git commands, SQLite access.
- **Storage:** plain markdown and JSON files, plus SQLite (opcode uses it through `rusqlite`, Claudette for local metrics) (web).
- **Terminal pane (fallback and extras):** xterm.js in the interface, with a pseudo-terminal in the Rust core (the exact Rust library is to verify).
- **Git:** run the `git` program and parse its output.
- **Driving Claude:** run the real `claude` program in print mode with streaming JSON in and out (documented, web), with an MCP permission-prompt tool. If the SDK turns out to be needed (for its `skills` option or the `canUseTool` callback), run it in a small Node helper (costs RAM). When starting a session through the SDK, note that its `env` option replaces the environment, so pass the full environment plus `CLAUDE_CONFIG_DIR`.

### 10.2 Options considered

| Option | Good | Bad | Verdict |
|---|---|---|---|
| TypeScript with Electron | One language, easiest to build and debug, SDK works directly | Ships its own Chromium. Heavy on a 7.3 GB PC | Dropped |
| TypeScript UI with a Rust core (Tauri 2) | Light at run time. What the forkable apps use | Two languages. First build is heavy. The SDK is TypeScript, so it may need a Node helper | **Chosen (proposal)** |
| Node local server plus a browser tab | No packaging, almost no extra memory, quick to start | Less like an installed app | Fallback |
| PHP with Laravel (for example NativePHP) | The owner may know it from Miralis | No official Claude SDK for PHP, weak for long streaming sessions and file watching | Rejected |
| Python | The SDK exists | Clumsy desktop windows, and the interface would still be JavaScript | Rejected |
| Rust only | Smallest and fastest | Hardest to change, weaker interface options, overkill | Rejected |

### 10.3 Why TypeScript for the interface
- The Agent SDK is TypeScript-first, because Claude Code itself is written in it.
- Almost every needed library is JavaScript: Monaco, drag-and-drop, graphs, xterm.js.
- AI coding tools are strongest on TypeScript and have the most examples. The type checker catches the AI's mistakes early. The owner will direct Claude to write most of the code, so this matters.

### 10.4 Things to check before installing the toolchain
- **Free space on drive C:** the Rust toolchain and the Windows C++ build tools install there by default and need several GB (not measured). Only D: has been measured.
- **WebView2:** usually already present on Windows 11 (to verify).
- **Windows prerequisites for Tauri apps (web, from opcode's README):** Microsoft C++ Build Tools and WebView2. Kanban Code's Windows app also lists Node.js 18+ and Rust.
- **Git and the GitHub CLI** (`gh`): git 2.54.0 is installed (seen). `gh` is not, and is only needed for pull-request features.
- **First build cost:** Rust is light to run but heavy to build. A first Tauri build on this PC may take many minutes and several GB of RAM (estimate). Later builds are faster.

### 10.5 If an existing app is forked
The fork's stack is inherited. Claudette and Kanban Code (Windows) are Tauri 2 with Rust and React, so the plan above already matches them.

### 10.6 Interface kit: base components with Kona's own identity

**The goal (owner):** "making every little base component have an identity for Kona itself". Every small building block (button, badge, field, menu, tab, dialog, progress bar, list row) should look and feel like Kona and like nobody else. This is feature F14.

**The test.** Cover the logo. A screenshot of one Kona screen should still be recognisable as Kona. (The idea is borrowed from the Miralis canon's "swap test".)

**Chosen so far (owner, 2026-10-24):** the mood words **calm and quiet, technical and terminal-like, warm and friendly**. A **dark** theme by default and a **roomy** density. **Tailwind CSS v4 with React Aria Components.** **English** labels. The owner did not pick "bold and playful". Everything else in this section is still a proposal.

**Three layers (proposal)**

| Layer | What it holds | Where it comes from |
|---|---|---|
| 1. Behavior | Keyboard use, focus, screen-reader labels, menus, select lists, popovers, dialogs | React Aria Components, the library Untitled UI React is built on. These parts are hard to get right by hand |
| 2. Tokens | Colours, type, spacing, corner radius, shadow, motion and density, written once as CSS variables: first the raw colour ramps, then names by meaning ("background primary", "text secondary", "border primary") | Kona's own file. The two-step pattern is how Untitled UI's `theme.css` is organised (seen) |
| 3. Identity marks | A few small signature details that every component carries | Kona's own (examples below) |

**Candidate identity marks (proposal, they need the owner's taste, open question 14)**
1. **State glyphs.** One small family of glyphs for the states Kona cares about: live, waiting for you, idle, stopped, left behind, done. The same glyph appears on badges, session rows, kanban cards, graph nodes and leftovers rows. State is never shown by colour alone. The identity comes from what Kona does, not from decoration.
2. **Role marks.** Each role (Planner, Builder, Reviewer, DevOps...) gets a stable shape and colour, so an agent is recognisable on the board, the graph and the session list.
3. **Developer-tool type.** A monospaced face with tabular numerals for IDs, ports, hashes, paths and numbers, and one distinctive face for titles (to choose).
4. **Density and edge.** The owner chose a **roomy** density: control heights of about 36 to 44 px, close to the Miralis app mode ("Sheet", 44 and 36 px, seen in its `DESIGN.md`). One consistent corner and edge treatment (to decide). Soft contrast and rounded-but-not-bubbly corners would fit "calm" and "warm", and crisp mono details would fit "technical" (proposal).
5. **Quiet motion.** A slow "breathing" on live sessions and a short answer to every click. Everything else stays still. Reduced-motion is respected.
6. **One focus ring and one selection style** used by every component.

These are examples, not decisions.

**The owner's taste (seen, 2026-10-24).** After seeing Claudette's start screen the owner said "the dashboard is not my type" and "I expect better", and pointed to the Miralis rules as the written form of their UI taste. What was wrong with that screen, read against `C:\miralis-canon\DESIGN.md`:
- Six number tiles that were all zero and four panels that said "no data yet". Empty charts say nothing. Show a tile only when it has something to say.
- A small all-caps label above every number ("COMMITS · 14D", "CHURN · 7D", "ANALYTICS"). The canon calls this the No Kicker Rule: the heading or the number carries its own weight.
- Short forms the owner would have to decode ("14D", "WK", a cut-off "completed sessi…"). Plain words only, which matches the voice rule (question 17).
- One orange accent on many things at once (numbers, underlines, the active icon). The canon's One Voice Rule: one accent per screen area.
- A row of five icon-only buttons at the bottom left. Controls need a word or a clear tooltip.
- The one thing that mattered ("Let's set up your first project") sat at the bottom, half off screen. An empty Kona screen should show the single next step first.
- Every tile is a boxed card. In Kona, a box should mean "you can click this" (a visible cue at rest); everything else stays flat.

**Rules Kona takes from the canon (the discipline, not the marks).** No label above a heading or number. One accent per area. State as a small line glyph plus a word, never colour alone and never a plain dot. Flat at rest, drawn edges, a shadow only to answer a state. Tabular numerals for numbers. Words, never invented abbreviations. Control heights of 36 and 44 px. Kona stays dark, roomy, calm, technical and warm, and uses no hexagon, cut lines or ticks. Every first-six component and every screen mock-up gets checked against this list before the owner sees it.

**Design draft v0 (2026-10-25, seen in FigCraft; the owner has not reacted yet).** Claude started FigCraft with its control port (`figcraft --control 7979`, reachable from this PC only, file access confined to `docs/design`), attached its MCP server, and drew the file through it while the owner could watch the window. Result: `docs/design/kona-design.figcraft` (about 60 KB, pages Tokens, Parts, Screens), four PNG previews, and `docs/DESIGN.md` with the tokens as Tailwind v4 `@theme` variables, the type scale, rules, contrast numbers and open points. What it proposes:
- **Palette:** warm-dark basalt surfaces, cream text, one accent (sea glass `#6CC6B4`), and six state hues. Chosen to differ from Claudette (orange on brown), Untitled UI (purple) and Miralis (grey, blue and vermilion).
- **Type:** Nunito Sans for words (friendly), a mono face for machine text. Consolas is a stand-in; an open-licence mono must be chosen.
- **Identity marks:** six state glyphs (ring plus one inner mark, always with a word), four role shapes (ring, square, triangle, diamond), the exact command beside every approval, plan bars that say what they measure, an "estimate" line beside every dollar figure.
- **Parts drawn:** button (4 kinds, 5 states), state badge, text field (4 states), select and menu, tabs, permission card, leftover dialog, plan bar, session row, empty state.
- **Screens drawn:** a start screen (one next step, a checks list) and a working screen (sessions with state, a chat with a pending approval, plan bars).
- **Checks done:** contrast ratios computed (all text at least 4.5 : 1 except disabled text; the first pass had control borders at 2.0 : 1, which was raised to 3.1 : 1). Not done: greyscale pass, keyboard pass, light theme, motion, compact density.
- **FigCraft notes (seen):** FigCraft 0.7.0 worked well through its MCP server (several full rebuilds of three pages, thousands of layers created, no crash; about 420 MB of RAM for the app at the start), but its built-in Nunito Sans only has Regular and Bold (SemiBold falls back to Regular), and text set to truncate wrapped instead.

**Do not copy another identity**
- **Untitled UI's default look** is a neutral SaaS look: a purple brand ramp (`brand-600` is rgb 127 86 217), the Inter font, and soft shadows with a slight inner edge (seen in `theme.css`). Take its structure, not its look.
- **Miralis's identity** is the "die-cut sheet": dashed cut lines, registration ticks, a detached hexagon, state drawn as a line, Bricolage Grotesque and Figtree fonts, Indonesian interface copy (seen in `DESIGN.md` and `MIRALIS.md`). The canon's own rules say the hexagon is the studio's signature on every Miralis build. Kona is not a Miralis build, so none of these marks go into Kona unless the owner chooses.

**What to take from each source**

| Source | Take (the method) | Leave |
|---|---|---|
| Untitled UI React (MIT) | The folder layout (`base`, `application`, `foundations`). Compound components such as `Select.Item`. Style objects by size (xs to xl) and by colour variant, built with a small `sortCx` helper. Semantic tokens on top of raw ramps. React Aria for behavior. A demo file beside each component | Default colours, fonts and shadows. Heavy extras (chart, animation and carousel libraries, Next.js). The PRO components, which are not in the repo and have a separate license |
| Miralis canon (reading only) | The parts list as a checklist with "use when" notes (below). The rules: compose from parts, no hard-coded colours, state never by colour alone, flat by default, tabular numbers. The atlas page idea. The swap test | `miralis.css`, `miralis.js` and the four marks. The landing-page (Stage), deck and print parts. Indonesian copy rules. Its tools (never run them for Kona) |

**Base components Kona needs, first pass.** "Untitled UI folder" comes from folder names only (seen). "Miralis part" comes from `PARTS.md` (seen), with its code in brackets.

| Component | Used in Kona for | Untitled UI React folder | Miralis part |
|---|---|---|---|
| Button, icon button | Every screen | `base/buttons` | Button (BTN), IconButton (ICB) |
| Badge, state pill | Session, ticket and leftover state | `base/badges` | Badge (BDG) |
| Avatar | Which role or agent did something | `base/avatar` | Avatar (AVT) |
| Text field, textarea, number | Ticket, role, SSH entry and settings forms | `base/input`, `base/textarea`, `base/form` | Field (FLD), NumberStepper (NUM) |
| Select, combobox | Choose a role, account or model | `base/select` | SelectField (SEL), Combobox (CMB) |
| Checkbox, radio, switch | Settings and permissions | `base/checkbox`, `base/radio-buttons`, `base/toggle` | ChoiceControls (CHC) |
| Menu, dropdown, popover | Row actions, account menu | `base/dropdown` | ActionMenu (MNU), Popover (POP) |
| Tooltip | Icon-only buttons, reasons for a disabled control | `base/tooltip` | Tooltip (TIP) |
| Tag, chip | Labels, skills shown on a role | `base/tags` | Tag (TAG), Chips (CHP) |
| Progress bar, ring | The plan bars, context meter, cost per ticket. A signature element | `base/progress-indicators` | ProgressBar (PRG), ScoreRing (RNG) |
| Tabs, segmented control | Project sections, views | `application/tabs` | UnderlineTabs (TAB), SegmentedTabs (SEG) |
| Sidebar navigation | Projects and sections | `application/app-navigation` | SidebarNav (SBN) |
| Dialog, confirm, drawer | Stop a process, approve a command, ticket detail | `application/modals`, `application/slideout-menus` | Modal (MDL), ConfirmDialog (CFM), Drawer (DRW) |
| Table, list row | Sessions, leftovers, commits | `application/table` | DataTable (TBL), ListRow (ROW) |
| Empty state, loading, skeleton | Every list | `application/empty-state`, `application/loading-indicator` | EmptyState (EMP), Skeleton (SKL), Spinner (SPN) |
| Toast, notification | Background failures, "session finished" | no folder seen (a toast library, `sonner`, is a dependency) | Toast (TST), NotificationPanel (NTF) |
| File drop, image paste | Images in a session | `application/file-upload`, `base/file-upload-trigger` | FileInput (FIL) |
| Key-value list | Session header, SSH entry, ticket facts | none seen | KeyValue (KVL) |
| Copy field | Commands, paths, fingerprints | none seen | CopyField (CPY) |
| Timeline, stepper, stage bar | Ticket and session history | none seen | Timeline (TML), Stepper (STP), StageBar (STG) |
| Breadcrumb, back link, page header | Moving around inside a project | not checked | Breadcrumb (BRD), BackLink (BCK), PageHeader (PGH) |
| Accordion | Grouped detail | none seen | Accordion (ACC) |
| Alert, announcement bar | Warnings such as "limit close" or "server left running" | none seen | Alert (ALT), AnnouncementBar (ANN) |
| Command palette | Jump to a project, session or ticket | none seen | CommandPalette (CMD, draft) |
| Small chart | Usage trend | `application/charts` (uses a chart library) | MiniChart (CHT). Draw it as small SVG instead |
| Settings and detail layouts | Settings, record pages | none seen | SettingsLayout (SET), DetailLayout (DET) |
| Date and time pickers, pagination | Little needed in version 1 | `application/date-picker`, `application/pagination` | DatePicker (DTE), TimePicker (TME), Pagination (PGN) |

**Kona-only components** (neither source has them, as far as folder names and `PARTS.md` show): file tree, resizable split panes, a code and markdown viewer wrapper, terminal pane, chat message with tool-call block and approve or deny prompt, diff view, kanban board and draggable card, worktree graph, usage panel (bars and ring), leftovers row with a stop button, role card, account switcher, session list item, image paste zone with thumbnails.

**How to build the kit (proposal)**
1. Write the tokens first: one file, raw ramps plus meaning-based names, light and dark.
2. Build the first six: Button, state badge, Field, Select and menu, Tabs, and a confirm Dialog. Give each every state: default, hover, focus, pressed, disabled, loading, error, empty.
3. Make one dev-only **atlas page** that shows every component in every state at both densities. It is the visual test, and it replaces Storybook, which is heavy for this PC. (The Untitled UI repo's dev dependencies include Storybook, ESLint plugins and Next.js.) The idea comes from the canon's `views/index.html` atlas.
4. Run the tests: the swap test, a greyscale test (every state readable without colour), and a keyboard-only test.
5. Build screens from the kit only after that.
6. Add components when a screen needs them, not in advance.

**Styling approach (decided: Tailwind v4 with React Aria, question 15).** Tailwind CSS v4 with the tokens in `@theme` is built ahead of time, so it costs nothing at run time. It is what Untitled UI uses, so code from it drops in, and AI tools know it well. The alternative is plain CSS variables and CSS modules, closer to the Miralis canon and with fewer build tools. Default: Tailwind v4 with React Aria Components.

**Weight rules for the kit**
- Do not install the reference repos. Copy only the files needed, and keep the MIT copyright notice on them.
- Runtime libraries for version 1: React, React Aria Components, `tailwind-merge`. Tailwind itself is build-time. Skip the chart, animation (`motion`) and carousel libraries.
- Icons: the Untitled UI icon repo shows its license as "NOASSERTION" (unclear), so check before using it, or draw Kona's own small set. A custom icon set is part of an identity anyway.
- Sizes seen for scale: Untitled UI `theme.css` is 45,006 bytes, `typography.css` 12,979, `globals.css` 1,807. The Miralis canon's `tokens.css` is 7,966 bytes and its full `miralis.css` is 178,402. A Kona token file should be nearer the small end.

**Interface language (decided: English, question 13).** All labels live in one file, so a translation stays possible.

**The design document.** Write `docs/DESIGN.md` for Kona in the same shape as the canon's `DESIGN.md` (seen): front matter with colors, typography, rounded, spacing and components, then Overview, Colors, Typography, Layout, Elevation, Shapes, Components, and Do's and Don'ts. Installed design skills that are not Miralis skills could help draft it: `stitch-design-taste` (writes DESIGN.md files), `impeccable` and its documenter agent, `brandkit`, `industrial-brutalist-ui` and `minimalist-ui`. Pick after the owner gives the mood words (open question 14).

**Pairs with the voice.** Kona's look (this section) and Kona's voice (F15) should be briefed together, so the words, the shapes and the state glyphs feel like one character.

---

### 10.7 FigCraft: what Claude can do and must do

FigCraft is the design tool Kona is drawn in. The full guide is `docs/FIGCRAFT.md`; this is the short version.

- **Can do:** draw layers with auto layout, build components with hover variants, wire a clickable prototype (click, hover, delay and key triggers; navigate, back and change-to actions), set scrolling on frames, make flows, export screenshots, save the file. All through a local control port (`figcraft --control 7979`), driven by scripts in `docs/design/build/`.
- **Must do:** use only the Kona tokens; draw parts first and build screens from them; rebuild by script (`run-all.sh`) so the file and scripts never drift; save and re-export previews after each build; look at every result and say what was not checked; compute contrast; ask before starting or closing a FigCraft window or deleting a page that holds work (each window costs 450 to 600 MB of RAM).
- **Traps:** only Regular and Bold render in the built-in font; `fill: 'none'` is invalid (use an empty fills list); spaces between text pieces need non-breaking spaces; a rebuilt page gets new ids; variant frames must be named `Property=value` before they become components.

## 11. Existing tools (research)

### 11.1 Method and limits
Done on 2026-10-24 with web searches and by reading each project's README or site page. **Nothing was downloaded, installed or run.** Star counts, activity and feature claims come from those pages. No page states how mature its Windows build is.

### 11.2 Candidates

| Tool | License | Stack | What it does | Gaps against Kona |
|---|---|---|---|---|
| **Kanban Code** (langwatch) | Apache-2.0 | macOS: SwiftUI. Windows: Tauri 2, Rust, React, TypeScript, Zustand | Kanban board where each card links a Claude session, git worktree, tmux terminal and GitHub PR. Six columns: Backlog, In Progress, Waiting, In Review, Done, All Sessions. Cards move by Claude's activity or by drag. Finds sessions in `~/.claude/projects/`, with BM25 search, fork, checkpoint and rollback. Remote runs through boxd or Mutagen over SSH. Tracks PRs, CI and reviews, imports GitHub issues. Pushover notifications. `kanban` CLI, and its `status` shows tokens and cost. 333 stars, 35 forks, 11 open issues, 7 open pull requests, 1,099 commits, no releases listed | Roles, accounts, image paste, file viewer, worktree graph, leftovers. The Mac app needs macOS 26. The Windows app needs Node 18+, Rust and the Claude Code CLI, defaults to `cmd.exe` for the terminal, and its maturity is not stated |
| **Claudette** (utensils) | MIT | Tauri 2, Rust, React, SQLite | Parallel agents, each in its own git worktree with its own session and terminal, multi-session tabs. Monaco editor and diff viewer. MCP supervision and connectors, a bundled Claude Code skill. Per-turn token use (input, output, cache) and a context meter, local per-workspace analytics. Drag-and-drop attachments. Remote sessions over an encrypted connection. macOS, Linux, Windows | Kanban, account switching, cost figures, image paste (not mentioned), a worktree graph. Windows maturity and the latest release date are not stated |
| **opcode** (winfunc, formerly Claudia) | AGPL-3.0 | Tauri 2, React 18, Vite 6, Tailwind v4, shadcn/ui, Rust, SQLite (rusqlite), Bun | Project and session management, custom agents ("CC Agents"), usage analytics dashboard (by model, project and time, exportable), MCP server management, timeline checkpoints with forking and comparison, a CLAUDE.md editor. About 22.4k stars, 1.7k forks, 268 open issues, 69 open pull requests, 202 commits | Worktrees, kanban, accounts, image paste. Prebuilt Windows files were "not yet available" on the page. Maintenance cannot be confirmed from the page. Several forks and mirrors exist, so use the original |
| **Vibe Kanban** (BloopAI) | Apache-2.0 | Not checked | Kanban card per task, each with an isolated worktree and an agent. About 22.6k stars (March 2026 snapshot) and 27.9k (April 2026 snapshot), 3.0k forks | Reported as shut down as a company and now community-maintained or sunsetting, so long-term care is uncertain |
| **Conductor** | Not checked | Mac app | Runs a team of coding agents in parallel, one worktree per task. Free, Apple Silicon only. Also has a cloud option. Works with Claude Code, Codex and others | **Mac only**, no Windows build found |
| **Nimbalyst** | MIT (desktop app) | Not checked | Session kanban and optional per-session worktree isolation | Its comparison articles are written by the vendor |
| **Auto Claude** | Not checked | Not checked | Kanban plus worktree isolation, up to 12 agent terminals, listed for Windows, Mac and Linux | Not examined closely |
| **FleetCode** | Not checked | Desktop terminal app | Runs Claude or Codex sessions each in its own worktree and restores sessions after a restart | No kanban |
| **Claude Squad** | Not checked | Terminal only (tmux and worktrees) | Manages several agents in isolated workspaces | No GUI |
| claudecodeui | | | The search found nothing | |

### 11.3 How the three closest cover Kona's features

| Feature | Kanban Code | Claudette | opcode |
|---|---|---|---|
| F1 Session runner | Yes (tmux terminals per card) | Yes (tabs, terminal per agent) | Yes (manage and resume sessions) |
| F2 Image paste | Not covered | Drag-and-drop attachments, paste not mentioned | Not listed |
| F3 Usage | Partly (CLI `status` shows tokens and cost) | Partly (per-turn tokens, context meter, no cost figure) | Yes (analytics dashboard) |
| F4 Tree and viewer | Not listed | Partly (Monaco and diff viewer, tree not stated) | Partly (projects, CLAUDE.md editor) |
| F5 Roles | Not described | Partly (MCP supervision, a bundled skill) | Partly (custom agents, MCP management) |
| F6 Accounts | Not covered | Not mentioned | Not listed |
| F7 Brain | Partly (BM25 session search, fork, checkpoint) | No (local analytics only) | Partly (history, checkpoints) |
| F8 SSH registry | Partly (remote runs over SSH, not a key registry) | No (encrypted remote sessions) | No |
| F9 Worktree graph | Worktrees yes, graph not described | Worktrees yes, graph not described | No worktrees listed |
| F10 Kanban | **Yes** | No | No |
| F11 Leftovers | Not covered | Not covered | Not covered |
| F12 Needs check | Onboarding wizard on Windows | Not mentioned | Not mentioned |

### 11.4 My read
No existing tool comes close to 70% of Kona's list. Each covers roughly a quarter to a third of it, by feature count (a rough estimate from README text, not measured), and mostly the same part: sessions, worktrees and usage. Nothing found covers per-role skills and MCP sets, easy account switching, the project brain, the SSH registry, a real worktree graph, the leftovers ledger or the needs check. Those are Kona's own parts.

### 11.5 Licenses in plain words
- **MIT and Apache-2.0:** you may copy, change and keep your version private. Keep the copyright notice. Apache-2.0 also gives a patent grant and asks you to mark changes.
- **AGPL-3.0 (opcode):** if you share a modified version, or let other people use it over a network, you must publish your source under AGPL too. Personal use on one's own PC is not affected.

### 11.6 The trial (approved by the owner on 2026-10-24, about an hour)
**Results for Claudette v0.28.0 (seen, 2026-10-24).** Claude drove the app itself: it opened a debug port on the window that only this PC can reach (port 9222, trial only) to take screenshots and click, and used Claudette's own command-line tool (`claudette.exe`, which talks to the running app over a local socket) to create workspaces and send prompts. The owner clicked nothing.

| Question | Result |
|---|---|
| Install and start | Portable zip (24.5 MB download, 62 MB unpacked: `claudette-app.exe` 56.6 MB and `claudette.exe` 5.2 MB). No install, no Rust, no C++ tools. Unsigned. Window ready about 4 seconds after launch |
| RAM and CPU | **Idle: about 540 MB** (app 58 MB plus the WebView2 pieces). **Two sessions that had just answered: about 700 MB** (peak 695), CPU about 4% on average with one 27% spike while the sessions started. Free RAM on the PC stayed between 1.17 and 1.95 GB, with VS Code and this chat still open (about 1.7 GB of RAM) |
| Image paste | **Works.** A pasted image shows as a thumbnail with a close button in the message box. Tested with a simulated paste (a real clipboard paste was not tested) |
| Accounts | **One account only:** it uses the Claude Code login on the PC ("Sign in with `claude auth login`") and offers a Re-authenticate button. No switching. Also lists Codex and Ollama as other providers |
| Plan bars | An **Experimental, off by default** switch ("Claude Code Usage"). When on, it reads the Claude login file and calls an unofficial Anthropic address (`/api/oauth/usage`), refreshing the login token if it is about to expire. That refresh could log the terminal out, so it was left off. No dollar figure was seen under an answer (only token counts and seconds, such as "4 in · 91 out · 6s"); the start screen has a 30-day cost tile |
| Where it keeps data | Its own database, logs and worktrees go where `CLAUDETTE_HOME` and `CLAUDETTE_DATA_DIR` point (redirected to `D:\kona-refs\trial\data`). Two small things stay in the Windows profile: `AppData\Local\Claudette\app.json` (1 KB, how the command-line tool finds the app) and `AppData\Local\com.claudette.app` (11 MB, the WebView2 cache) |
| Network | No analytics or tracking code found (source skim, not a full audit). It checks GitHub for updates, and talks to OpenRouter or OpenAI only if the owner sets those up. Its voice feature has its own web calls |
| Roles, skills, MCP per session | Per repository MCP servers with health checks, extra instructions, extra `claude` flags in Settings, pinned prompts, plugins. **No roles.** An optional "Claudette MCP" lets agents ask the owner questions and request approvals through cards in the chat (off by default) |
| Tickets, Kanban, worktree graph, SSH, brain, leftovers, cost ledger, personas | **None of these exist.** It has worktrees (one per workspace), a dashboard and a file/changes/tasks side panel |
| Project health | MIT, last push 2026-09-22, 83 stars, a nightly build. About 140,000 lines of Rust and 150,000 lines of TypeScript, plus a server, a mobile client, a Lua plugin runtime and a voice feature. Big to take over for one person on a small PC |

**What Claudette teaches Kona (useful as a pattern)**
- It starts `claude` with exactly the flags this note planned for S1: `--print --output-format stream-json --input-format stream-json --include-partial-messages --verbose --permission-prompt-tool stdio`, then `--session-id` for a new chat or `--resume` for an old one, plus `--model`, `--effort`, `--mcp-config`, `--settings`, `--append-system-prompt` and `--allowedTools`. The chat shows one line "claude.exe · haiku · session id · 14 flags" that expands to the full command. That line is a good idea for Kona (it shows the real command), as long as the words around it stay plain.
- A small command-line tool that drives the running app over a local socket made it possible to test the app with no clicking. Kona could ship the same, which also helps the "agents raise tickets" idea.
- A persistent process per session, one worktree per workspace, and `--replay-user-messages` so that messages sent from outside still show up in the chat.
- A read-only `ls` ran without a permission prompt. The prompt screen (approve and deny) was not exercised.

**What is wrong with it for Kona**
- The start screen. See section 10.6, "The owner's taste".
- At a narrower window the message-box toolbar overlaps itself ("Plan" and the context counter collide), and several controls are icon-only.
- It is a big, many-feature code base, and nothing on the owner's list beyond sessions, worktrees and image paste is in it.

**Kanban Code (read from source, not built or run; 2026-10-24).** Apache-2.0, 333 stars, last push 2026-10-19, about 16 MB. The source is cloned for reading at `D:\kona-refs\kanban-code-src` (it carries its own `CLAUDE.md`, so never start a Claude session in it). It is mostly Swift (about 95,000 lines, the macOS app). The Windows port is a smaller Tauri app (about 25,000 lines of Rust and TypeScript) with the same card model: board state, a card reconciler, a function that assigns columns, an activity detector, session discovery, a hook manager, git worktrees, PR links, and a `kanban` command-line tool. What it means for a trial:
- **Building it needs** Node, Rust and the C++ build tools, then a long release build (link-time optimisation, 4 cores), which is slow and heavy on 7.3 GB of RAM.
- **Full terminals need WSL.** Its embedded Claude terminals run in `tmux` inside WSL. WSL 2 is installed on this PC (Ubuntu, seen with `wsl --status`), but it runs a Linux virtual machine that costs RAM. Its native Windows mode is a stopgap (a single-use terminal, with a "PTY pool" still marked as a to-do in its source).
- **It edits the owner's Claude settings.** Its hook manager adds hooks to `~/.claude/settings.json` so Claude sends events to it. Running it would change that file. (Claudette did not.)
- **Session discovery scans the Claude project folders** (`%USERPROFILE%\.claude\projects` and the WSL equivalent). That is the "no session left behind" idea, and it is cheap.
Because the main ideas can be read directly from the source (see F10), a build was judged not worth its cost. A build can still be done later, after the toolchain is installed for Kona, if the owner wants to see it run.

**Decision (owner, 2026-10-24): build from scratch** (Tauri, TypeScript interface, thin Rust core), borrowing patterns: Claudette's flags, one process per session, the local-socket command-line tool and the "show the real command" line; Kanban Code's card model, activity-from-session-file and column rules (F10). Claudette is not forked: the base is huge, none of the owner's distinctive features are in it, and its look is not the owner's taste. Forking would mean deleting more than keeping.

**Cleanup (owner said yes on 2026-10-24; done).** Claudette was closed through its window (no leftover `claude` processes, no open debug port). Deleted: `D:\kona-refs\trial` (about 140 MB: zip, unpacked app, source clone, throwaway project, its two worktrees and its data), `C:\Users\asus\AppData\Local\Claudette` and `C:\Users\asus\AppData\Local\com.claudette.app`. Nothing was left in `~/.claudette` or the Temp folder. The two test sessions had also left three folders of session transcripts in `C:\Users\asus\.claude\projects` (names starting `D--kona-refs-trial`, 440 KB); they were looked at first and deleted too. Claudette did not change any other file in `~/.claude`. `D:\kona-refs` now holds the two Untitled UI repos and `kanban-code-src`.

**What Claudette's process list showed (seen).** One idle session was one `claude.exe`, one `claudette-app.exe --agent-mcp` helper and one `conhost.exe`. So a session is three processes. The leftovers ledger (F11) must count all three, not just `claude.exe`.

**What the release pages show (seen, 2026-10-24)**
- **Claudette:** MIT, 83 stars, last push 2026-09-22. The stable release v0.28.0 (2026-08-31) and a nightly build (0.29.0-dev, 2026-09-22) ship for Windows as a **portable zip** (`claudette-windows-x86_64.zip`, 24.5 MB) and as an installer (`..._x64-setup.exe`, 18.7 MB), plus small command-line and server zips. The portable zip needs no install, so it is the first thing to try.
- **Kanban Code:** Apache-2.0, 333 stars, last push 2026-10-19. Its releases (latest v0.1.32, 2026-08-10) hold **macOS zips only**. There is no Windows download, so trying it means building the Windows app from source (Tauri 2: Node.js 18+, Rust and the Claude Code CLI). That needs the Rust toolchain and the C++ build tools on C:, which has 23.4 GB free. Plan: judge it from its source and README first, and build it only if Claudette is not enough.
- **Safety for the trial:** the zip is unreviewed third-party code that will run Claude Code with the owner's login. Download it into its own new folder (`D:\kona-refs\trial\claudette`), read its source for network calls and credential use first, run it only on a throwaway project, and close the other apps so the RAM numbers mean something.

### 11.7 Interface references pulled to this PC (2026-10-24)

Done at the owner's request: "pull this repo in to this machine first, and then we can throw it later". The link the owner gave is a GitHub **organization** (`github.com/untitleduico`), not one repository, so Claude listed its public repositories through the GitHub API (seen) and picked the ones that matter for Kona.

| Repository | License shown by GitHub | Stars | Last push | Pulled? |
|---|---|---|---|---|
| `react` | MIT | 1,975 | 2026-10-09 | Yes |
| `untitledui-vite-starter-kit` | none stated | 35 | 2026-09-26 | Yes (reading only) |
| `untitledui-nextjs-starter-kit` | none stated | 51 | 2026-09-26 | No (Next.js is not Kona's stack) |
| `untitledui-tanstack-starter-kit` | none stated | 0 | 2026-09-26 | No |
| `untitledui-stackblitz-nextjs-starter-kit` | none stated | 0 | 2026-09-26 | No |
| `icons` | NOASSERTION (license not recognised) | 78 | 2026-09-22 | No (license unclear) |

**How it was pulled.** `git clone --depth 1 --single-branch --no-tags` into two new folders. Nothing was installed, built or run, and no package manager was used. Size on disk, including git data: 4.0 MB for `react` (343 files without `.git`) and 2.8 MB for the Vite starter (257 files).

**Where.** `D:\kona-refs\untitled-ui-react` and `D:\kona-refs\untitled-ui-vite-starter`. `D:\kona-refs` is new, made by these clones, and sits outside the project. **To throw it away later: delete the folder `D:\kona-refs`.** Nothing is deleted without the owner's yes.

**What is in `untitled-ui-react` (seen)**
- The README says the open-source components are MIT, that the PRO components are a separate paid license, and that the kit is built with React 19.3, Tailwind CSS 4.3, TypeScript 6.0 and React Aria Components. The `LICENSE` file is MIT, "Copyright (c) 2025 Untitled UI".
- Folders: `components/base` (17 groups), `components/application` (12 groups), `components/foundations` (featured icon, integration, payment and social icons, logo), `components/shared-assets` (background patterns, a credit card, illustrations), `hooks`, `styles`, `utils` (including the `cx` and `sortCx` helpers), plus Storybook settings.
- Style pattern: each component has a style object by size (`xs` to `xl`) and by colour variant (`primary`, `secondary`, `tertiary`, link styles, destructive versions), written as Tailwind classes that use meaning-based tokens such as `bg-brand-solid`, `text-secondary` and `ring-primary`. `theme.css` maps raw ramps to those meaning-based tokens, and dark mode is a `.dark-mode` class.
- Dev dependencies are heavy (Storybook 10.6, many ESLint plugins, Next.js 16) and the run-time list includes chart, animation and carousel libraries. That is why the repo is reference material only.

**What is in `untitled-ui-vite-starter` (seen).** A Vite and React 19 starter with the same Tailwind and React Aria stack, plus `react-router`, `react-hotkeys-hook` and `react-stately`, and folders for pages, providers and hooks. It has **no LICENSE file**, so by default its code cannot be copied. Read it only.

**Each repo has its own `CLAUDE.md`.** It holds developer conventions for that repo (kebab-case file names, an `Aria` prefix on `react-aria-components` imports, compound components, `sortCx` style objects). It was read as information and is not an instruction for Kona. Do not start a Claude session with a working folder inside `D:\kona-refs`, or that file would load as project instructions. Neither clone has a `.claude` folder or hooks (seen in the top-level listings).

**The Miralis canon was read, not copied.** `C:\miralis-canon` is a git repository at version 0.36.0, last commit 2026-10-23 (seen with a read-only `git log`). Read: `PARTS.md`, `DESIGN.md` and the top of `MIRALIS.md`. Listed only: its folders and file sizes. No canon tool was run and nothing in it was changed.
- `PARTS.md` indexes about 110 parts, each with a code, a status (stable, draft, proposed or discouraged), its base classes and a "use when" line. About a third are for landing pages, decks and print, which Kona does not need.
- `DESIGN.md` records the look: "The Die-Cut Sheet", with dashed cut lines, registration ticks, a detached hexagon and state drawn as a line. Colour, font and radius are per-repo tokens, the grammar is fixed. Its named rules include "No Hard-Coded Hex", "Flat By Default" and "State is never colour alone".
- Sizes: `dist/miralis.css` 178,402 bytes, `dist/miralis.js` 60,668, `dist/manifest.json` 302,505, `src/tokens.css` 7,966, `src/components.css` 97,823. The canon is plain CSS classes and vanilla JavaScript, so it does not drop into a React app. A `src/vue` folder exists and was not opened.
- The owner's global instructions say to follow the canon in Miralis repos. Kona is not one, so using it is the owner's choice. The owner said Kona "might use" it, and the plan in 10.6 uses it for its parts list and rules only.

---

# Part C: Plan

### 11.8 Third look: Vibe Kanban (source read, then run on a throwaway project; 2026-10-25)

The owner asked Claude to find another open-source repo, trial it and report what is good and bad, "just for the sake of getting more information". Claude picked **Vibe Kanban** because it is the most popular open-source app that goes from a ticket on a board to a workspace (own branch, terminal and dev server), to a diff, to a pull request. That is the part Claudette lacks and Kona wants (F9, F10).

**Candidates checked (seen on the GitHub API, 2026-10-25; none tested)**

| Repo | Stars | License | Kind | Windows download | Note |
|---|---|---|---|---|---|
| BloopAI/vibe-kanban | 28,444 | Apache-2.0 | Rust and TypeScript, local web app (also a desktop shell) | MSI 53 MB and installer 35 MB | **Sunsetting.** Last release v0.1.44 on 2026-04-24, last push 2026-09-19. Chosen |
| generalaction/emdash | 6,070 | Apache-2.0 | Electron | exe 182 MB, msi 193 MB | Active (release 2026-10-23), YC-backed. Electron, so heavy on this PC |
| coder/mux | 2,062 | AGPL-3.0 | Electron | exe 216 MB (nightly) | Active. AGPL |
| siteboon/claudecodeui (CloudCLI) | 14,267 | AGPL-3.0 | Web interface, run with Node | none (npm) | Active (push 2026-10-24). File explorer, git, sessions. A good candidate for the file tree and "no session left behind" ideas |
| winfunc/opcode | 22,423 | AGPL-3.0 | Tauri | none | Last release 2025-08-31 |
| stravu/crystal | 3,133 | MIT | Electron | none | Now called Nimbalyst. Last release 2026-02-26 |
| savannahfeder/agentbox | 98 | GPL-3.0 | JavaScript desktop app | none | "Answer agents like email". Tiny, pushed today |

**What happened.** Claude first tried to run it (`npx vibe-kanban@0.1.44`, which downloads a prebuilt program from the maker's file host and runs it). The permission system **blocked** the command, because the owner had not named this package, and Claude did not work around that. Claude read the source instead (`D:\kona-refs\vibe-kanban-src`, 140 MB, reading only, never start a session in it). The owner then answered "vibe kanban first, then the CloudCLI", which named it, and Claude ran it.

**How the live run was kept safe (seen).** Throwaway project in `D:\kona-refs\trial-vk`. The server listened only on this PC (port 3399). Before any prompt Claude switched off analytics and the relay (remote access through the maker's cloud) and turned the Claude profile's "skip permissions" off, all through the app's own settings interface. Models: Haiku. The package has no install scripts. Claude drove the web page with a separate headless Chrome (a clean profile; an Edge attempt was dropped because Edge signed itself in with the Windows account and showed a sync prompt). Screenshots are in `docs/trials/vibe-kanban/`.

**Results of the live run (seen)**

| Question | Result |
|---|---|
| Install and start | `npx` fetched a 47.6 MB program (`vibe-kanban.exe`, kept in `~/.vibe-kanban`) and started in under a minute. Server on port 3399, plus a "preview proxy" on a second port. It also opened the owner's default browser by itself (Chrome, about 1.3 GB of RAM in 11 processes right afterwards; how much of that was the owner's own tabs was not checked) |
| RAM, server | **Idle: 54 to 73 MB** (a Rust program, much lighter than Claudette's 540 MB) |
| RAM, a running turn | **Peak 1,471 MB** for the server plus the agent processes while a Haiku turn started (free RAM on the PC fell to 0.36 GB at that instant, with FigCraft, VS Code and my headless Chrome also open), then about 640 MB during the turn, and **back to 61 to 73 MB when the turn ended**, because the agent process exits after each turn. A second turn peaked at 645 MB. Free RAM otherwise stayed between 1.1 and 1.6 GB |
| First screen | "Which repositories would you like to work on?" with Recent, Browse and Create. Browse is a file browser inside the page that lists the owner's home folder (it runs on the server, so any page that can reach port 3399 can list folders; the app checks the page's origin). Its path box shows a Unix example (`/path/to/your/project`) on Windows |
| Workspace | Created in seconds. Branch `vk/ea85-add-a-function-f` (a short id plus the first words of the task, cut off). The worktree went to `D:\temp\vibe-kanban\worktrees\...`, which is the **temporary folder**, so a clean-up tool could delete a day of unmerged work |
| Defaults that cost money | The model picker started on **Opus, High effort**. Haiku was one click away |
| Task test 1 (skip permissions off, approvals off) | Claude read `app.py`, tried to edit it and was refused. It then wrote "I need your permission to edit app.py. Please approve the tool call". **There was no approve button anywhere.** The run showed "Running" with a Stop button until it ended |
| Task test 2 (approvals switched on) | Same result: "The permission was denied. The user hasn't approved the write operation yet", and no approval card appeared. So in this trial the only way to get work done was the default, which skips every permission. Not known: whether an approval card appears with some other setting that was not found |
| Kanban board | **Needs a cloud login.** The "Projects" icon says "Sign in to view projects" and the start screen says "Sign in to organise your coding agents with kanban boards". Not signed in, there is only a list of workspaces grouped as **Needs Attention, Running, Idle**. The maker's service is closing, so the board's future is unclear |
| Network | On start its log says it set up a remote client for the maker's cloud address. Its page shows a GitHub star count ("28k") and a Discord member count ("190"), which suggests the page calls those sites (not verified). The data folder is `%APPDATA%\bloop\vibe-kanban`, with a database, config and a signing key |
| UI quality | The sidebar groups sessions by state (Needs Attention, Running, Idle), which is the right idea. Raw lines such as "requesting" and "System initialized with model: claude-haiku-4-5-20251001" appear in the chat, which is jargon. A saved draft is listed under "Needs Attention". There are no state glyphs, only coloured dots, and no cost or token numbers were seen |

**Good (read from the source, docs and screenshots)**
- **The whole flow in one app.** A board (To do, In progress, In review, Done) with issues. Each issue becomes a workspace with its own branch (the screenshot shows `vk/143a-add-a-readme-to`: id plus a short name), a terminal and a dev server. The issue text is the prompt for the agent. The agent works in a chat, you read the diff, leave inline comments that go back to the agent, then open a pull request and merge. This is the loop Kona wants.
- **Setup and cleanup scripts per workspace** (screenshots: "No setup script configured. Setup scripts run before the coding agent starts", "Cleanup Script: Completed successfully"). A natural place to start and stop dev servers, which is what the leftovers ledger (F11) needs.
- **The diff view with inline comments and a file tree beside the chat** is dense and useful. A built-in browser preview with devtools.
- **It drives `claude` the same way as Claudette and this plan:** stream-json in and out, partial messages, `--replay-user-messages`, an optional permission-prompt tool (seen in `crates/executors/src/executors/claude.rs`). Second independent confirmation of S1.
- **Ten agents behind one list** (Claude Code, Codex, Gemini, Copilot, Amp, Cursor, OpenCode, Droid, CCR, Qwen). An MCP server crate exists (what it offers was not checked).
- **Licence is Apache-2.0**, so ideas and even code could be reused with attribution.

**Bad**
- **It is shutting down.** The README's first headline says Vibe Kanban is sunsetting. The last release is 2026-04-24. Anyone who built a workflow on it now owns an unmaintained base. Lesson for Kona: keep the owner's data in plain files and SQLite on their own disk, never in a service.
- **It skips every permission by default.** `crates/executors/default_profiles.json` sets `dangerously_skip_permissions: true` for Claude Code, so the agent runs any command without asking. That is the opposite of Kona's approve-or-deny design and of the owner's plain-words prompt. An approvals mode exists but is off by default.
- **Analytics are on by default.** The current config version sets `analytics_enabled: true`, and signing in to its cloud account switches it back on. PostHog and Sentry code are in the project (read from source; what exactly is sent was not checked).
- **A lot that a solo local user does not need.** About 35 Rust crates, many for teams, a cloud "organisation", relay tunnels, WebRTC and SSH. Roughly 109,000 lines of Rust and 108,000 of TypeScript.
- **A trial would leave files outside any folder you choose.** Its data folder uses the Windows app-data folder through a library that ignores environment variables, and the launcher keeps a program cache under the user profile. (Both would need deleting after a trial.)
- **Look (from its own screenshots):** the board is a light page with lots of empty space and a brown-orange accent used on the main button, a selected-card border and the stop button, and the workspace is a separate dark developer view. It has a state dot with a word on the board (a dot plus a word, not a glyph).
- **Not known without a run:** RAM and CPU, how its terminal behaves on Windows, where it puts worktrees, speed.

**What Kona borrows:** issue to workspace with a branch named from the ticket id and a short name; setup and cleanup scripts; inline diff comments sent back to the agent; "open workspace" from the card. **What Kona avoids:** bypass-permissions by default, analytics on by default, cloud and team features, a separate "light board, dark workspace" look.

**Cleanup (done on 2026-10-25).** Everything was stopped (no leftover processes, ports 3399 and 9333 closed) and deleted: `~/.vibe-kanban` (189 MB), `%APPDATA%\bloop`, `D:\temp\vibe-kanban`, `D:\kona-refs\trial-vk` (141 MB, including the Chrome profile), the `npx` cache entry for this package, and four session-transcript folders in `C:\Users\asus\.claude\projects`. Kept: the source clone `D:\kona-refs\vibe-kanban-src` (reading only) and five screenshots plus the memory samples in `docs/trials/vibe-kanban/`. The launcher checks a SHA-256 value that comes from the same file host, so it protects against a corrupt download, not against a tampered host.

**What this adds for Kona**
- **A per-turn process is light on RAM.** Vibe Kanban starts the agent for each turn and lets it exit, so idle cost is 60 to 70 MB instead of Claudette's persistent sessions. The price is a slow start (about a 1.5 GB spike here, which on this PC is a real risk). Kona should measure both designs in spike S1 (S1b: one turn at a time versus a persistent process).
- **The approval prompt is the part that must work.** Two apps that drive `claude` could not give a working approve button in this trial (Vibe Kanban) or were not tested on it (Claudette). Kona's permission card (spike S1) is not optional polish: without it the only workable mode is "skip everything".
- **Group sessions by state**, with a word, as Vibe Kanban does (Needs Attention, Running, Idle), but with Kona's glyphs. Kona's own list uses the same idea (waiting on you first).
- **Never put worktrees in the temporary folder.** Kona keeps them in the project's own folder.
- **Kanban must work offline.** Vibe Kanban's board needing a cloud login is exactly what the owner does not want.

### 11.9 Fourth look: CloudCLI (run on a throwaway project, 2026-10-25)

CloudCLI (package `@cloudcli-ai/cloudcli` 1.37.5, repo `siteboon/claudecodeui`, AGPL-3.0, 14.3k stars, active, a web interface run with Node) was the second app the owner named ("vibe kanban first, then the CloudCLI"). It is the best match for Kona's file tree (F4), session brain (F7) and worktrees (F9).

**How it was kept safe (seen).** Started with its `HOST` setting limited to this PC only (the default is every network interface, so the page that runs Claude on this PC would be reachable from the local network), port 3001, with its database path variable pointed into the trial folder (whether it honoured that was not confirmed). A throwaway local account (single-user, password not kept anywhere). The project was the throwaway folder. Haiku only. Screenshots (with the project list cropped out) and memory samples are in `docs/trials/cloudcli/`. The postinstall script of the package was read first (it only fixes a macOS file permission), the install ran for about two minutes and pulled about 650 packages, including three native ones (`bcrypt`, `better-sqlite3`, `node-pty`); they installed without errors.

**Results (seen)**

| Question | Result |
|---|---|
| Start | Account creation (a single-user system), a setup wizard (git name and email, then which agents are signed in: Claude Code "Authenticated", Cursor, Codex and OpenCode not found) |
| RAM | Server **idle about 90 MB**. A **spike to 1.16 GB for roughly 10 seconds** right after the first page load (probably the project scan; not confirmed). During a Haiku turn about 316 MB in total, then back to about 90 MB. My own headless Chrome (about 500 MB) is separate and not part of the app |
| Session brain | **Works from the transcript folders.** The left list shows every Claude project on the PC with its session count, including projects started in the terminal or VS Code. Opening this very chat showed it live ("Running in the Claude CLI", 502K tokens, the model name, the newest tool calls) with no setup. The same project is listed twice when its drive letter has different case (28 and 3 sessions, 19 and 3, 37 and 16) |
| Files | List, preview and table views, search, upload, new file and folder. Opening the 221,000-character, 1,914-line master note gave an editor with line numbers and colour within 4 seconds, with Ctrl+S to save. Details: a permissions column shows Unix text (`rw-rw-rw-`), the age says "1 hours ago", and at a narrow width the columns squash |
| Source control | Changes, Compare, Commits, Branches and **Worktrees** tabs; commit box; a list of changed files with a diff. A plain-words empty state for worktrees (see F9) |
| Working on a task | A Haiku turn wrote `notes.txt` in the throwaway project and said so. **No approval was asked.** The owner's own Claude setting `defaultMode: auto` was applied, and the program's source says why: in auto and bypass modes the Agent SDK decides before it calls the approval callback, so the callback never runs |
| Approval flow in the code | A real one: the server sends a `permission_request` (with a request id) to the page, shows a notification "action required", waits for allow or deny, can remember the rule, replays the question after a page refresh, and handles cancel and timeout. This is the design Kona's permission card needs. It uses the **Agent SDK** (`query` and `canUseTool`) rather than the raw `claude` program |
| Installing | About 650 packages, about 2 minutes. Data in two folders in the user profile (`.cloudcli`, `.claude-code-ui`, both tiny), plus the npx cache |
| Limits | New projects must be inside the user's home folder ("Workspace path must be within the allowed workspace root: C:\Users\asus"), so a project on D: cannot be created from the page (projects on D: that already have sessions are listed). The setup wizard re-saved the git name and email as global git settings (the existing values, so nothing changed; checked). It adds a GitHub star button, "Report issue" and "Join community" links to the sidebar |
| Licence | AGPL-3.0-or-later. Ideas are free to borrow. Copying its code into Kona would pull Kona under AGPL if it were ever shared |

**What Kona borrows from it.** Read the transcript folders to discover and mirror every session, with no hooks. Show running state, token count and model per session. The permission request protocol (id, remember rule, replay, notification, cancel). The Files, Source Control and Worktrees tab structure. The plain-words empty state. **What Kona avoids:** listening on every network interface by default, the home-folder-only rule, listing one project twice because of letter case, the 1 GB spike at first load, and the AGPL.

**Important for spike S1.** Because the owner runs `defaultMode: auto`, an approval card would **never appear** for anything that mode auto-approves. Kona must decide on purpose: either start its sessions with an explicit permission mode (so every tool call reaches Kona's card) or accept auto mode and show what it did afterwards. Which one is a question for the owner; it changes how the plain-words approval card is used.

**Cleanup (done).** Stopped (ports 3001 and 9333 closed, no leftover processes) and deleted: `D:\kona-refs\trial-cc` (118 MB), `C:\Users\asus\kona-trial-cc`, `~/.cloudcli`, `~/.claude-code-ui`, the npx cache entry (about 650 packages) and one session-transcript folder in `C:\Users\asus\.claude\projects`. Checked: the global git settings key list is unchanged, and `~/.claude.json` has no stale trial entries.

### 11.10 What the four looks teach, side by side

| | Claudette | Kanban Code | Vibe Kanban | CloudCLI |
|---|---|---|---|---|
| Kind | Desktop app (Tauri) | macOS app, Windows port | Local web app, sunsetting | Local web app, active |
| Run here? | Yes | No (source only) | Yes | Yes |
| Idle RAM | 540 MB | n/a | 54 to 73 MB (server) | about 90 MB (server) |
| One agent turn | about 700 MB (two persistent sessions) | n/a | spike to 1.5 GB, then 640 MB | about 316 MB |
| Tickets and board | No | Yes | Needs a cloud login | No |
| Worktrees | One per workspace | Yes | One per task, in the temp folder | A tab to list and create |
| Session brain from the terminal | No | Reads session files | No | Yes, from the transcripts |
| File tree and editor | A side panel | No | Diff and file tree | Yes, with an editor |
| Approval prompt | Not exercised | n/a | Never appeared | Real code path, skipped by auto mode |
| Dollar cost | Not seen | n/a | Not seen | Tokens only |
| Permissions by default | Normal | n/a | Skip everything | Follows the owner's settings |
| Look | Orange on brown, empty tiles | n/a | Light board, dark workspace, jargon | Generic dark with blue accent |
| Licence | MIT | Apache-2.0 | Apache-2.0 | AGPL-3.0 |

None covers the owner's whole list. The gaps no one fills: plain-words approvals, per-role sessions, the cost ledger by role, project and ticket, the leftovers ledger, SSH references, the persona, and a Kanban board that works offline.

## 12. Build order

Proposed. It moves accounts and the leftovers job object earlier than first suggested in the chat, because they are small and fix real pain. **v1 is steps 1 to 3.** If v1 is not finished, no new features are added. After each step the owner uses Kona for real work for a few days before the next step.

| Step | What | Done when |
|---|---|---|
| 0 | **Prep (no app code).** The 21 questions are answered (done). The trial of Claudette (done) and the reading of Kanban Code's source (done); the owner chose to build from scratch. `CLAUDE.md`, `AGENTS.md` and `docs/` created (done). `git init` when the ticket and worktree features start. Free space on C: checked, 23.4 GB (done). Git 2.54.0 is installed (done). Install the toolchain (Rust, C++ build tools, Node) only after a yes, with build output on D: | The trial gave a fork-or-scratch answer (done: scratch), and the toolchain works with a hello-world window |
| 1 | **One working session (F1, F2, F3, the cost ledger tables of F16, plus the job object from F11) and the first Kona UI kit (F14).** The data model from section 6, the design tokens, and the first six base components (section 10.6) | The owner can open Kona, pick a folder, chat, paste an image, see streamed answers, approve or deny tool prompts, see per-session tokens and cost in dollars (each finished turn is saved to the cost ledger), see the plan bars (or the embedded `/usage` fallback), and closing a session leaves no stray child process. Every control on screen comes from the Kona UI kit and passes the swap and no-colour-alone tests |

**Step 1 status (2026-10-27, Kona 0.1.0).** Built and checked in the real window (driven over the DevTools port, see `app/README.md`):
- **Done and seen working:** pick a folder (the button opens the folder dialog; the test started the session by command because a native dialog cannot be clicked from a script), chat with streamed answers, the approve-or-deny card (both buttons), a pasted picture (a paste event with a PNG; a real clipboard paste was not tried), per-session cost in dollars (each finished turn saved to the ledger as the difference of the running total, shown as "$0.0052 so far"; the ledger rows were read back from SQLite and added up to the figure on screen), the two plan bars from `rate_limit_event` (32 percent and 11 percent while the terminal's `/usage` said 21 and 10 a few minutes earlier), Stop, and a clear "Ended" state.
- **Test S2 passed for real:** with Kona killed from outside, the `claude` program it started was gone within 4 seconds, and so was a `ping` that Claude had started detached through PowerShell. The Windows job object in `job.rs` covers programs started later by the session, not only the direct child.
- **Not done yet from the "done when" line:** the Kona UI kit tests (the swap test and the no-colour-alone test were not run on the new screens; state is drawn as glyph plus word), keyboard-only use was not tried, "Always allow here", resume of an old session, the `/usage` fallback (not needed: the bars arrive by themselves), and the window has no role or account yet (steps 2 and later).
- **Known rough edges:** the header's folder path wraps under the badges; the session list shows only sessions started since Kona opened (old sessions come from the transcript reader, S3, in a later step); one `claude` per session means about 225 MB each (cap of 2 live sessions, decision 32, is not enforced yet).

**Step 2, first part (2026-10-27, Kona 0.2.0): projects, the file tree and the viewer (F4).** Checked in the real window, driven over the DevTools port.
- **Projects:** the list lives in `%APPDATA%\Kona\projects.json`. "Add a project" takes a folder and a name, makes the hidden `.kona` folder inside it and, for a Git repo, adds `.kona/` to `.git/info/exclude` (seen: the line appeared, no tracked file changed). Adding the same folder written another way (lower case, forward slashes) is refused with "already a project" (the case trap from CloudCLI, section 11.9). Removing a project only forgets it; the Rust side has the command, the screen has no button yet.
- **Files place:** a lazy folder tree (a folder is read only when opened, 320 px wide, quiet colour for `.git`, `node_modules`, `target` and similar) and a read-only viewer. Seen working: a text file with line numbers in mono, a 188 KB JSON file shown with tidy spacing (and a note saying so), a PNG, a PDF (WebView2's own viewer inside the window), a binary file (a message and "Show it in Explorer"). Text over 2 MB is cut at 2 MB with a note; images and PDFs over 25 MB are refused with a message. No syntax colours and no Markdown rendering yet.
- **Safety:** the core refuses any path that is not inside a project (seen: asking for `C:\Windows` returned "That folder is not inside a project"). Files are never changed from this screen. "Show it in Explorer" is the only way out, instead of "open with the default program", which could start a script.
- **Sessions are now per project:** the Sessions place lists the sessions of the chosen project (matched without regard to case or slashes), the new-session screen shows the project instead of a folder picker, and a session's title is the first thing you asked.
- **Left for step 2:** roles with a permission mode each (F5), accounts (F6), the "needs check" (F12), the voice (F15), the cost views (F16). The sidebar shows only the two places that exist (Sessions, Files); the others from the design are added as they are built.
- **Rough edges:** the plan bars read "not read yet" until the first turn of the first session (they could be kept from the last run with a note on how old they are); the add-project screen has no GitHub address field; there is no button to remove a project; the tree has no keyboard arrow navigation yet (it is Tab-able buttons with `aria-expanded`); the viewer's first open of a 188 KB JSON file takes a visible moment.
- **Test hook:** in a development build only, `window.__KONA_TEST_FOLDER__` answers the folder dialog, because a script cannot click a native dialog. A release build has no such door (`import.meta.env.DEV`).

**Step 2, second part (2026-10-27, Kona 0.3.0): roles (F5, first version).** Checked in the real window.
- **The team:** ten starting roles (Product, Design, Frontend, Backend, QA, Security, DevOps, Marketing, Content and SEO, Support) with the marks and starting modes from `docs/DESIGN.md`, written to `%APPDATA%\Konaoles.json` on the first run. Only Frontend and Backend are loosened to "Edits free, commands asked"; Product is "Plan only"; the rest ask every time.
- **The Roles place:** a grouped list and an editor (name, group, mark, model, permission mode with a sentence for each, brief). Seen working: all ten listed, a new role saved and found in `roles.json`, a duplicate name refused ("Another role already has that name"), a rename, and a two-click remove.
- **Start as a role:** the new-session screen has a "Start as" row. A role fills in the model and the mode (still changeable for one session); its brief goes to Claude through `--append-system-prompt`. Seen: a Product session ran in "Plan only" and answered "Product" when asked which role it was.
- **Ledger:** `usage_turn` gained a `role_id` column (an older file is upgraded in place; old rows stay empty). A Product turn was saved with `role_id = product`, ready for the cost views (F16).
- **Only three modes are offered** (ask every time, edits free, plan only). The core refuses anything else, so a role can never carry a "skip all checks" mode.
- **Not in this version:** skills and tool servers per role, denied tools, allowed SSH hosts, needs (F12), default account (F6), persona (F15). Roles are global; a project cannot override them yet.
| 2 | **Projects, roles, voice and cost views (F4, F5, F6, F12 basic, F15 first version, F16 views)** | The owner can add a project, browse files read-only, start a session as a role that loads only that role's skills and MCP servers, under a chosen account, see "missing: Composer" before it starts, see the bars for the right account, and see Kona's replies in the chosen persona while code and commit messages stay neutral, and the cost screen shows dollars per role and per project |
| 3 | **Leftovers panel (F11)** | A session that started a dev server shows it with session and role, the owner can stop it after a confirmation, ended sessions with leftovers get a badge, and temp-folder size per session is shown |
| 4 | **Tickets and Kanban (F10) with the built-in MCP server, and a worktree per ticket** | Dragging a card to In progress opens a role session in a new worktree. The card shows who, what and next. An agent can create a ticket through the MCP tool |
| 5 | **Worktree graph (F9)** | The graph shows branches, owners, ahead or behind, a conflict preview, and cleanup |
| 6 | **Brain (F7), a graph of linked notes** | Ending a session writes a linked note. New sessions start with a short digest. Search returns sections with line ranges. The health report lists broken links and orphans. The map and clusters show once there are about 30 notes. Secrets are redacted before anything is indexed |
| 7 | **SSH registry (F8)** | Hosts are stored as references, SSH needs a role and an approval prompt, and no key text appears anywhere |
| 8 | **Polish and package** | An installer, backups of the `.kona` folders, the budgets from section 9 re-measured, docs, version 0.x |

Why this order:
- Steps 1 to 3 replace the owner's daily use of one terminal session and fix the leftovers problem.
- Kanban needs sessions, roles and worktrees underneath, so it comes after them.
- The brain needs a lot of session history to be worth it.
- SSH is where a mistake costs the most. The design is settled now, but it is built late and carefully.

---

## 13. Small tests to run first (spikes)

Small experiments that prove the risky parts before any real building. None of them is the app.

**S1. Streaming session and the plan bars**
- **Question:** can a program run `claude`, read its streamed messages, get tokens and cost, send an image through, receive a `usage_report` (percent and reset time per limit) after sending `/usage`, and see a `rate_limit_event`?
- **How:** a small script starts `claude` in its non-interactive streaming mode, sends one prompt (and one image), then `/usage`, and logs every message type.
- **Pass if:** text, tool calls and usage numbers appear, and a `usage_report` arrives with a `session` row and a `weekly_all` row (or, failing that, the plain `/usage` text can be parsed). Also note whether `/usage` costs tokens.
- **If it fails:** use the SDK in a Node helper, or embed the terminal for `/usage`.
- **Cost:** a few tokens of plan usage.
- **S1b (added 2026-10-25 after the trials):** run the same two turns once with a persistent `claude` process (Claudette's way) and once with a fresh process per turn using `--resume` (Vibe Kanban's way). Record the start time, the RAM peak and the idle RAM of each. On this PC Vibe Kanban's start spiked to about 1.5 GB, so the choice may decide how many sessions can run at once. Also check that the permission-prompt tool really gives Kona an approve-or-deny call for a write (two trialled apps did not show one).

**S1 result (2026-10-27, run twice; `spikes/s1-stream.ts`; PASSED for everything it tested).** Streaming session, cost and plan bars all work with the real `claude` program and no unofficial address.
- **Start and answer:** one persistent `claude` (flags: `-p --output-format stream-json --input-format stream-json --include-partial-messages --verbose --permission-prompt-tool stdio --model haiku --session-id <uuid>`) sent its `init` record 3.5 s after launch and its first `result` at 6.6 s. Records seen: `system/init`, `system/status`, `system/thinking_tokens`, `stream_event` (the partial chunks), `assistant`, `rate_limit_event`, `result`.
- **Memory:** the idle `claude.exe` after a turn was **about 225 MB** (seen, both runs).
- **Cost:** each `result` carries `total_cost_usd`, a `usage` block and `modelUsage` per model with `inputTokens`, `outputTokens`, cache reads and writes, `costUSD` and `costBasis: "list"`. One haiku turn cost $0.0083 (an estimate at list price). The totals are cumulative, as decision 26 assumed.
- **Plan bars, the good news:** a `rate_limit_event` arrives with the first turn and carries `unifiedWindows`: `five_hour` and `seven_day`, each with a `utilization` (0.21 and 0.09 in the run) and a `resetsAt` time. That is F3's two bars with no `/usage` call and no unofficial address (to verify: how often it is sent, and whether it appears on every turn).
- **`/usage` works and is free:** sent as a message it came back as a local reply (`result.local_command: "usage"`, 0 turns, cost unchanged), as text with "Current session: 21% used", "Current week (all models): 10% used" and the reset times, plus an `assistant` record with a `usage_report` field (not opened further). The text also lists the last 24 hours and 7 days of requests and the top skills, which could feed the cost views.
- **The session starts in the owner's permission mode.** `init` said `permissionMode: auto` (the owner's own setting). Kona must pass a mode per role on purpose (to verify with `--permission-mode`), or every role would start in auto.
- **Not tested:** an image in a message, the approve-or-deny card (`--permission-prompt-tool stdio` with a tool that needs approval), the S1b comparison with a fresh process per turn (`--resume`), and `/clear`, resume and fork for the cost ledger (S12).
- **Left behind by the test:** two throwaway sessions in `~\.claude\projects` (a folder ending `scratchpad-s1-work`, 444 KB). Listed, not deleted. Delete only on the owner's yes.

**S1b result (2026-10-27, `spikes/s1b-approval-and-image.ts`; PASSED).**
- **The approval card:** with `--permission-mode default` and `--permission-prompt-tool stdio`, Claude prints a `control_request` (`request.subtype: "can_use_tool"`) with `tool_name`, a plain `description`, the `input` (for a command, `command`), `blocked_path`, `tool_use_id` and `permission_suggestions` (add an allow rule, add a folder, switch to acceptEdits). Kona answers on standard input with a `control_response`: allow is `{behavior: "allow", updatedInput: <the input>}`, deny is `{behavior: "deny", message: "..."}`. A denial reaches Claude as an error result with that message, Claude says so and does not retry, and the final `result` lists it in `permission_denials`.
- **Read-only commands never ask:** `cat` and `ls` ran without a card even in default mode, so "ask every time" really means "ask for anything that changes something". Use commands that change files to test cards.
- **Images:** a base64 image block (`{type: "image", source: {type: "base64", media_type, data}}`) placed before the text in a user message works; Claude read a red square as "Red".
- **Not tested:** the "Always allow here" button (it would send one of the `permission_suggestions` back as `updatedPermissions`; to verify), the S1b comparison of one persistent process against a fresh process per turn.

**S2. Kill the whole tree**
- **Question:** does closing a Windows job object stop every child, including a dev server started by a child?
- **How:** start a process in a job that starts a small local server, then close the job.
- **Pass if:** no listener remains.
- **If it fails:** rely on the scan and manual stop.

**S3. Read a transcript**
- **Question:** can Kona list a project's sessions from `~/.claude/projects/`?
- **How:** read one transcript file, list the message types, extract session ID, folder, times, model and usage. Do not print message text, because transcripts can contain secrets.
- **Pass if:** a session list for this project can be rebuilt.
- **If it fails:** a tolerant parser that skips unknown records.

**S3 result (2026-10-27, `spikes/s3-read-transcripts.ts`; PASSED).** Kona can rebuild the session list of a project from `~\.claude\projects\<folder>\*.jsonl` with a tolerant reader and no message text printed. For `d--kona-space`: 2 files, 5,779 lines, 0 unreadable. Each file gives `sessionId`, `cwd`, first and last timestamp, the models and token usage. Record types seen: `assistant`, `user`, `attachment`, `api-request`, `api-request-blob`, `ai-title`, `last-prompt`, `queue-operation`, `system`, `mode`, `file-history-*`, `cost-state` and a few more. The format is undocumented, so unknown types are counted and skipped.
- **A second source for the cost ledger:** `cost-state` records hold `totalCostUSD`, `totalAPIDuration`, `totalLinesAdded`, `totalDuration`, `startTime` and `modelUsage`. Only 2 were found in 2 sessions (one at the start with zeros, one later with $2.11), so when they are written is not clear (to verify).
- **`ai-title`** records give each session a ready-made title for the list.
- **Not checked:** that the token sums match the terminal's total (the sums are large because of the cache reads, and a message may be logged more than once), and the case-insensitive path trap from CloudCLI (section 11.9).

**S4. Hook log**
- **Question:** can a hook record every shell command a session runs, with its session ID?
- **How:** a test settings file (not the global one) with a hook that appends session ID, command, folder and time to a log. Start a background server from a session.
- **Pass if:** the log has the entry with the session ID.
- **Needs:** the owner's approval to add a hook.

**S5. Worktrees and conflict preview**
- **Question:** can Kona parse worktrees and preview a merge conflict without touching files?
- **How:** in a throwaway git repo, create two worktrees with conflicting edits, run `git worktree list --porcelain` and `git merge-tree`.
- **Pass if:** the list parses and the conflict is reported.

**S5 result (2026-10-27, `spikes/s5-worktrees.ts`; PASSED).** In a throwaway repo with two worktrees whose commits touched neighbouring lines: `git worktree list --porcelain` parsed into path, branch and head; per worktree, uncommitted files came from `git status --porcelain` and ahead and behind from `git rev-list --left-right --count main...HEAD`; `git merge-tree --write-tree --name-only` exited non-zero for the clashing pair and listed `cart.php`, and exited 0 for a clean pair. The preview left every working file and the uncommitted file untouched (it writes only objects to the git store). Git 2.54 here; `merge-tree --write-tree` needs git 2.38 or later.

**S6. Tauri hello-world memory**
- **Question:** how much RAM does an idle Tauri window take on this PC, compared with VS Code?
- **How:** build a hello-world, add up all its processes (including WebView2) in Task Manager.
- **Pass if:** within the proposed budget in section 9.
- **Needs:** the toolchain install (a yes, and a free-space check on C:).

**S7. First build cost**
- **Question:** how long and how much memory does the first Tauri build take here?
- **How:** time it, watch peak memory.
- **Pass if:** acceptable to the owner. If not, start with the local server plus browser tab.

**S6 and S7 result (2026-10-27; toolchain installed, hello-world built and run; `app/`).**
- **Installed, with the owner's go:** Rust 1.99.1 (minimal profile) in `D:\toolchain\rustup` and `D:\toolchain\cargo` (user variables `RUSTUP_HOME`, `CARGO_HOME` and the `PATH` entry set); the C++ build tools 17.14 (MSVC 14.44) in `D:\toolchain\vsbuildtools` through winget, which also put shared parts on C:. Disk now: C: 23.6 to 21.4 GB free (about 2.2 GB used), D: about 4 GB used by the toolchain and 2.9 GB by the first build. The rustup installer was checked against the published checksum. The download folder is `D:\toolchain\downloads` (the installer file can be deleted; ask first).
- **S7, first build:** a plain `cargo build` of the new Tauri 2 app took **4 min 26 s** on this PC. Free RAM fell to **191 MB** at the lowest point (the sampler read every 3 seconds; VS Code, Chrome and FigCraft were open). So it works, but close other apps before a big build. The `target` folder is 2.9 GB. Later builds are incremental (a rebuild after a one-line change took 6.6 s).
- **S6, idle window (debug build, started with `npm run tauri dev`):** the Kona window was **about 450 MB**: `app.exe` 37 MB plus six `msedgewebview2` processes (18, 43, 133, 119, 20 and 83 MB). The dev server (Vite and the Tauri tool, four `node` processes) added about 260 MB more, which a shipped app does not have. That is **over the 200 MB idle budget** in section 9, and close to Claudette's 540 MB. A release build is lighter, but WebView2 alone looks likely to stay above 200 MB (to verify with a release build). The budget probably needs to be restated as "about 300 to 400 MB with no live session".
- **Release build (measured later the same day, `npm run tauri build -- --no-bundle`, no installer):** built in **6 min 17 s** (free RAM fell to 321 MB); `app.exe` is 4.4 MB. Idle after 25 s: **402 MB working set** (the sum Task Manager's Details tab shows, which counts shared Windows pages in every process) and **213 MB private memory** (the memory only these processes use). **CPU: 0.03 seconds in 10 seconds of idle.** The honest reading: the 200 MB aim is met if counted as private memory (213 MB, about on the line) and missed if counted as working set (402 MB). Section 9 should say which number it means; proposal: private memory, aim 250 MB or less with no live session. The six WebView2 processes are most of it; the app itself is 29 MB.
- **Stopped afterwards:** the window and dev server were stopped by killing the process tree I had started; nothing else was touched.
- **Not done:** the installer (`npm run tauri build` without `--no-bundle`; it downloads the bundling tools, ask first), and whether a 1440 by 900 window fits this PC's screen (not checked).

**S8. Per-role skills and MCP servers**
- **Question:** what is the cleanest way to give one session only some skills and MCP servers?
- **How:** try `--mcp-config` with `--strict-mcp-config`, `--setting-sources`, a per-role config folder, per-worktree `.claude/skills`, and the SDK's `skills` option. Ask the session which skills it sees. Do not use `--bare` with the Pro login, because it ignores that login.
- **Pass if:** a test session lists only the chosen skills and servers.

**S9. Account per session**
- **Question:** do two sessions started with different `CLAUDE_CONFIG_DIR` values really use different accounts and show different bars?
- **How:** start one session per folder and compare `/status` and the usage bars.
- **Needs:** the owner logging a second account into a second folder.

**S10. Kona UI kit v0**
- **Question:** can a small token file plus six components give a screen that passes the swap test, without heavy libraries?
- **How:** in the hello-world app, write the tokens and build Button, state badge, Field, Select, Tabs and a confirm Dialog on React Aria Components. Add one dev-only atlas page that shows every component in every state at both densities.
- **Pass if:** the swap test passes (a screenshot without the logo is recognisably Kona), every state can be told apart without colour, everything works from the keyboard, and the extra weight (CSS size and idle RAM) stays inside the budget in section 9.
- **Needs:** the toolchain from S6, the owner's mood words (open question 14), and the reference repos in `D:\kona-refs`.
- **Status 2026-10-25:** the design v0 exists in FigCraft (section 10.6, `docs/DESIGN.md`). The code version has not started.

**S11. The persona stays out of the work**
- **Question:** with a persona on, does Claude still do the work as well, and does the voice stay out of everything except the chat reply?
- **How:** write a small custom output style with `keep-coding-instructions: true`. In a throwaway git repo give the same small task twice (change a function, run its test, commit): once with the persona off, once on. Compare. Optional: repeat with the field set to `false` to see what is lost.
- **Pass if:** the code change and the test run match in substance, the commit message and any comments are neutral, no marker phrase appears in any file, and the chat reply is in the persona's voice.
- **If it fails:** try the appended prompt file, shorten the persona, or use the rewrite pass.
- **Cost:** a few small sessions of plan usage.

**S12. Cost ledger accuracy**
- **Question:** do the stored per-turn differences add up to what the terminal shows, including after resume, fork, `/clear` and subagents?
- **How:** run a small scripted session of three turns that includes one subagent call. Store each `result`'s running total and compute the differences. Compare the sum with the `Total cost` and the per-model line from `/usage`, and with the transcript's tokens times the price table. Then resume the session, fork it and send `/clear`, and check that no spend is counted twice.
- **Pass if:** the sum matches the terminal figure to the precision shown, resume and fork give an opening balance and no double counting, and a `/clear` starts a new linked row.
- **If it fails:** keep the opening-balance rows, and recompute from transcripts and the price table.
- **Cost:** a few small sessions of plan usage.

---

## 14. Next actions

All 21 questions were answered on 2026-10-24 (section 4). What is left:

**You**
- [x] Fork or scratch: build from scratch (decided 2026-10-24). Trial files deleted on your yes.
- [ ] Say whether to install the toolchain now (Rust and the C++ build tools), or run the small tests (S1, S3, S5) first.
- [ ] Later: decide `git init` when the ticket and worktree features start.
- [ ] Later: the servers and the GitHub repo path of each project (data to enter, not a decision).
- [ ] Later: say when `D:\kona-refs` can go. It stays until the first six base components exist.

**Claude, trial (done 2026-10-24, results in section 11.6)**
- [x] Claudette downloaded (portable zip), source skimmed, run on a throwaway project with two sessions. RAM, image paste, accounts, plan bars and data location checked.
- [x] Kanban Code read from its source (not built; it needs WSL for full terminals and edits the Claude settings file).
- [x] Owner chose: build from scratch, borrow patterns.

**Claude, then**
- [ ] Read the hooks documentation (risk 5).
- [ ] Run S1, S3 and S5 (small, local, read-mostly) when you say go.
- [ ] Install the toolchain (Rust, C++ build tools, Node) with build output on D:, then S6 and S7. Ask first.
- [x] Draft Kona's design tokens, first parts and two screens in FigCraft, and write `docs/DESIGN.md` (done 2026-10-25, v0). Next for the design: the owner's reaction, then the same parts in code with React Aria (S10).
- [ ] Draft the persona file (terse, plain words) and run S11 (section 7, F15).
- [ ] Draft the cost-ledger schema and run S12 (section 7, F16).
- [ ] Turn the settled decisions into a short brief and start Step 1.

---

# Part D: Context

## 15. Environment and numbers

### 15.1 The PC (seen, 2026-10-24)

| Item | Value |
|---|---|
| Operating system | Windows 11 Home Single Language (10.0.26200) |
| CPU | AMD Ryzen 3 7320U with Radeon Graphics, 4 cores, 8 threads |
| RAM | 7.3 GB total, about 0.9 GB free while VS Code and Claude were open |
| Drive D: | 68 GB free of 97.7 GB |
| Drive C: | 23.4 GB free of 138.6 GB |
| Shells available | PowerShell (primary) and Git Bash |
| Time zone | Asia/Jakarta |
| Claude temp data | `D:\temp\claude` held 14,859 files, about 230 MB |
| Listening dev servers at that moment | none matching PHP, Node, npm, Vite, Python, Artisan, MySQL, nginx, Apache, Laragon, XAMPP, Bun or Deno (local addresses only) |
| Biggest memory users at that moment | Memory Compression 538 MB (a sign Windows was already short of RAM, my reading), Chrome (six processes between 153 and 334 MB each), one `claude` process 247 MB, VS Code (232 MB and 169 MB in two of its processes), Explorer 218 MB, Windows Defender 193 MB |
| Tools found | Git 2.54.0 is installed. The GitHub CLI `gh` is not. No WSL distribution was running. A `DockerDesktopWSL` folder exists on D:, which suggests Docker Desktop is installed (not confirmed) |

### 15.2 Claude Code setup (seen in the two screenshots)

| Item | Value |
|---|---|
| Claude Code version | 2.1.293 |
| VS Code extension version | 2.1.310 |
| Login method | Claude Pro account (organization named after the account e-mail, left out here) |
| Model | Sonnet 5.5 (`claude-sonnet-5-5`) |
| MCP servers | 2 connected |
| Setting sources | User settings |
| Auto mode server | Enabled |
| Cloud sessions | Not set up (`/web-setup` connects GitHub) |
| Working folder | `D:\kona-space`, opened as the workspace "kona-space (Workspace)" through the `.code-workspace` file |
| Editor tabs open | `session-notes.md`, "Kona Space welcome" (this Claude session) and "Claude Code" |

### 15.3 Usage at the time of the screenshot

| Item | Value |
|---|---|
| Session cost | $0.0000 in a fresh terminal session that had not called the model yet (0 API time, 0 tokens). This is not a Pro-plan effect |
| A third screenshot, later | Again a fresh session: Total cost $0.0000, API duration 0s, wall duration 26s, 0 lines added and removed, 0 input, 0 output, 0 cache read, 0 cache write |
| Code changes | 0 lines added, 0 removed |
| Current session | 12% used, resets 9:50pm (Asia/Jakarta) |
| Current week (all models) | 35% used, resets Oct 25, 12am (Asia/Jakarta) |
| Usage credits | Off (`/usage-credits` turns them on) |
| Skills in the last 24 hours | `/miralis-frontend-audit` 6%, `/keybindings-help` 1%. The terminal says this is approximate, based on local sessions on this machine, and does not include other devices or claude.ai |

### 15.4 Places on disk

| What | Where |
|---|---|
| This project | `D:\kona-space` (not a git repo) |
| Claude Code's per-project folder (transcripts) | `C:\Users\asus\.claude\projects\d--kona-space\` |
| Claude's memory notes for this project | `C:\Users\asus\.claude\projects\d--kona-space\memory\` with `MEMORY.md` and `kona-app-purpose.md` (purpose, wanted features, PC limits, research summary) |
| Claude's temp data | `D:\temp\claude\<project>\<session>\` with `scratchpad` and `images` (pasted screenshots such as `images\1.png`) |
| Claude's global instructions | `C:\Users\asus\.claude\CLAUDE.md` |
| The earlier notes | `D:\kona-space\session-notes.md` (47,827 bytes) |
| Interface references (throwaway) | `D:\kona-refs\untitled-ui-react` and `D:\kona-refs\untitled-ui-vite-starter`. Delete the whole `D:\kona-refs` folder when done (needs the owner's yes) |
| The Miralis canon (read only) | `C:\miralis-canon`, version 0.36.0 |
| This project's rule files | `D:\kona-space\CLAUDE.md`, `D:\kona-space\AGENTS.md` and the empty folder `D:\kona-space\docs\`, all created on 2026-10-24 |
| Other folders at the root of D: (not examined) | `miralis-data`, `miralis-sources`, `norbit-business`, `tools`, `temp`, `DockerDesktopWSL` |

### 15.5 Other small facts
- At the start of this session the folder held only `kona-space.code-workspace` (one folder, path `.`, no settings) and `session-notes.md`.
- The browser connection (Claude in Chrome) closed early in the session. Nothing depended on it.
- The earlier notes mention Claude's global effort level shown as "Sonnet 5.5, Extra high" in an older screenshot, and that a higher effort level uses limits faster.

---

## 16. Keeping Kona out of Miralis

**The problem.** The owner's global `CLAUDE.md` defines many Miralis rules: a design system, a canon sync at the start of each session, an effort rule, shared VPS access, and a list of skills. Kona is not a Miralis venture or client build.

**What to skip here (from the earlier notes, section 1)**
- the `miralis` skill and every `miralis-*` skill
- the canon sync (`update.mjs`, `sync.mjs`, `stamp.mjs`, `shoot.mjs` in `C:\miralis-canon`)
- `miralis.css`, `miralis.js`, `mi-*` classes, Stage and Sheet modes, `miralis.repo.json`
- the Miralis effort rule
- the shared Miralis VPS
- the question "is this a Miralis product?" (the answer is no)

**Notes**
- The folder is not under `C:\` and its name does not start with `miralis`, so the global rules probably would not have matched anyway.
- A repo `CLAUDE.md` cannot switch off global instructions. It only tells Claude to ignore the Miralis parts here. This was never tested in a fresh session.
- **Current state:** the earlier notes say a `CLAUDE.md` and an `AGENTS.md` were created, but neither was in this folder at the start of this session (seen). Both were created on 2026-10-24 at the owner's request, together with an empty `docs/` folder. Whether they keep the Miralis rules out in a fresh session is still untested (risk 14).
- **What carries over on purpose:** the owner's server rules (SSH keys only, confirm before running commands on a server, never disable host-key checking) are general safety habits. Kona's SSH design (F8) reuses them.

**The first proposal for `CLAUDE.md`.** The file that was actually created on 2026-10-24 is `CLAUDE.md` in this folder and is the current version. It follows this proposal, with plain-words rules added:

```
# Kona

This repo is NOT a Miralis product or client build. Ignore the Miralis parts of
the global instructions here: the miralis and miralis-* skills, the canon sync
(C:\miralis-canon tools), miralis.css / miralis.js / mi-* classes, Stage and
Sheet modes, miralis.repo.json, the Miralis effort rule, and the shared VPS.
Do not ask whether this is a Miralis product (the answer is no).

Read kona-space-app.md first. It is the master note for this project.

Rules: ask before downloading, installing, deleting or killing anything.
Explain in plain words. Keep the load on the PC light. Never write keys,
tokens or passwords into this folder.
```

`AGENTS.md` would be a short file that points to `CLAUDE.md`, for other agent tools that read that name.

**Reading the canon for Kona's interface.** The owner said Kona "might use" the canon's base components. The canon's rules (compose from parts, never edit `dist/`, keep the hexagon on every build) are for Miralis repos, and Kona is not one, so they do not bind Kona. They also would not give Kona its own identity. The plan is to read the canon for its parts list and its rules, and to leave its code and marks (section 10.6). It stays read-only: no canon tool (`update.mjs`, `sync.mjs`, `install-skill.mjs` and so on) is ever run for Kona.

---

## 17. Plain-language explanations from this session

The owner asked these questions while thinking about what to build. They are kept here so the answers do not get lost.

### 17.1 Why is everyone excited about Rust?
A mix of real technical wins and good timing.
1. **It solves an old problem people had accepted.** C and C++ give speed and control, but one mistake can corrupt memory (use-after-free, buffer overflow, data races). Microsoft and Google have each said that roughly 70% of their serious security bugs come from memory safety. Rust removes that whole class of bug at compile time, without a garbage collector. Before Rust you picked between safe and slow, or fast and dangerous.
2. **The compiler is a strict teacher.** The borrow checker is frustrating at first. Once it clicks, people say they write better code in every language. "If it compiles, it usually works" feels strong.
3. **The tooling is good.** Cargo (package manager and build tool) is easy and consistent. Error messages and docs are good.
4. **Institutions back it.** Rust is in the Linux kernel. Government security agencies recommend memory-safe languages. Big companies use it in production.
5. **Social effects.** It has been Stack Overflow's "most admired" language for years. Many fast new tools in the JavaScript and Python worlds are written in Rust, so "fast" and "Rust" get linked.

**The skeptical side:** the learning curve is steep, compile times are long, many jobs (web backends, scripts) are fine in Go, Python or TypeScript, and some of the hype is ordinary enthusiasm for a new tool. Rust is the best answer to a specific problem: fast code that is also safe.

**Link to Kona:** the Tauri shell has a Rust core, the Craft Apps (section 19.3) are written in Rust, and the Graphite editor is built with Rust and WebAssembly.

### 17.2 What is the difference between Laravel, Python, PHP, C, Rust?
First, **Laravel is not a language.** It is a toolkit (a framework) built on top of PHP.

Analogy, building a house: a language is the material and tools. A framework is a prefab kit with walls, plumbing and wiring already designed.

| | Speed | Easy to learn | Main use | Analogy |
|---|---|---|---|---|
| C | Very fast | Hard | Operating systems, hardware, game engines | A manual race car with no seatbelts. It trusts you completely |
| Rust | Very fast | Hard | Safe systems, fast tools | A race car with a roll cage and a coach who will not let you leave the track |
| Python | Slower | Easy | AI, data, automation, scripts | An automatic car. Easy to drive, not at top speed |
| PHP | Medium | Easy | Websites (powers a huge part of the web, including WordPress) | A delivery van built for one job: carrying web pages |
| Laravel | Medium | Medium | Web apps, built on PHP | PHP is a pile of lumber, Laravel is the house kit with the blueprint |

How to choose: ask what you are building. Website or web app: PHP with Laravel, or Python with a framework such as Django. AI or data work: Python. Extremely fast or tiny hardware: C or Rust. No language is "the best".

### 17.3 Why can my machine "read" all of them? Compilers and interpreters
It cannot. The processor only understands machine code, which is raw numbers. Every language needs a translator.

| | Compiler | Interpreter |
|---|---|---|
| Languages | C, Rust | Python, PHP |
| How | Translates the whole program once into a program file (on Windows, an `.exe`). The computer runs that file directly | Reads the code line by line and carries it out each time it runs |
| Analogy | Translating a whole book before publishing it | A live interpreter at a meeting |
| Result | Fast, and mistakes can be caught before running (Rust's compiler does a lot of this) | Quick to start and change, slower to run |

Your machine "reads" them because **you installed the translators**: the Python interpreter, PHP, `rustc`, and a C compiler such as GCC or Clang. Without them, a `.py` or `.rs` file is just text.

The line is blurry. Python first compiles to simpler **bytecode** and then interprets that. PHP does something similar and can compile hot parts while running (**JIT**). Java and C# compile to bytecode that a virtual machine runs. Laravel is just PHP files, so the PHP interpreter runs it, plus a web server to hand it requests.

### 17.4 Can I run all of them locally?
Yes. What changes is what you need installed and what you hand to other people.

| Language | Needs installed | How you run it |
|---|---|---|
| C | A C compiler | Compile it, then run the `.exe` |
| Rust | Rust (`rustc` and `cargo`) | `cargo run` |
| Python | The Python interpreter | `python myfile.py` |
| PHP | PHP | `php myfile.php` |
| Laravel | PHP plus Composer (PHP's package manager) | `php artisan serve`, then open `localhost:8000` |

Laravel is a website, so `php artisan serve` starts a small web server on your own machine. It never touches the internet.

**Installed software (apps you double-click):**
- C and Rust produce a standalone `.exe`. It is already machine code, so nothing else has to be installed on the user's computer.
- Python and PHP do not produce a standalone file by default. The user would need the interpreter. Developers **bundle** the interpreter inside the app (PyInstaller does this for Python).
- A compiled `.exe` runs on **Windows only**. For Mac or Linux, compile separately. Interpreted languages avoid this, since the same Python file runs anywhere with Python installed.
- **Desktop software** runs entirely on your machine. **Web software** has two sides: the server side runs PHP or Python somewhere, and your browser shows the result. In development both sides are your own machine (`localhost`). In production the server side lives on someone else's computer.

### 17.5 What is Electron? And what is Tauri?
**Electron** makes desktop apps out of web technology (HTML, CSS, JavaScript). An Electron app bundles two things: **Chromium** (the engine behind Chrome, to draw the interface) and **Node.js** (JavaScript outside the browser, so the app can read files and open system windows). Analogy: you build a website and ship it with its own private copy of Chrome.
- **Why developers like it:** one codebase for every OS, web skills are enough, a huge ecosystem of ready-made interface pieces.
- **Examples:** VS Code, Discord, Slack, Notion, WhatsApp Desktop, Figma Desktop.
- **Downsides:** heavy on memory (every app carries its own Chromium), large downloads (100 MB or more), slower than native apps.

**Tauri** is the lighter alternative. It uses the web view the operating system already has (on Windows, WebView2, the Edge engine) instead of bundling Chromium, and its back end is written in Rust. Apps are much smaller and lighter. This is why Kona's plan uses Tauri.

### 17.6 What is an SDK? (and an API, and a CLI)
The owner asked "what is SDK btw?" while this note was being written.

**SDK** stands for Software Development Kit. It is a ready-made toolbox of code that lets your own program use someone else's software or service without building all the plumbing yourself. Analogy: a Lego set, or flat-pack furniture with the parts and instructions in the box, instead of cutting the wood yourself. Many services have one (Stripe, AWS, Android).

**The Claude Agent SDK** is the same engine that powers Claude Code, packaged as a library for TypeScript or Python: the loop that lets Claude think, call tools, read and edit files and run commands, plus permissions and sessions. Your program calls one function (`query`), gets a stream of messages back (text, tool calls, results, cost), and can plug in callbacks, for example "ask me before running this command". Under the hood the SDK starts the same `claude` program and talks to it.

Three levels for talking to Claude, from lowest to highest:

| Level | What it is | You build | Example |
|---|---|---|---|
| API | The doorway: your program sends messages to the model over the internet | Everything: tools, file editing, permissions, memory, sessions | A chatbot coded from scratch, billed per token with an API key |
| CLI | The `claude` program you type in a terminal. `claude -p` is its scriptable form (print mode), which can stream JSON in and out | Only the window around it | What Kona plans to run |
| SDK | A TypeScript or Python library that wraps the CLI and adds typed messages and callbacks | Less than with the API, a little more code than with the CLI | A small helper program inside Kona, if the CLI alone is not enough |

**Why it matters for Kona.** Kona does not talk to the model itself. It runs `claude` (the CLI) and falls back to the SDK in a small Node helper only if it needs something the CLI lacks (the `skills` option or the `canUseTool` callback). Both use the same engine, so skills, MCP servers, memory and settings behave the same.

---

## 18. Glossary

| Term | Plain meaning |
|---|---|
| Agent | A program made of a model (the brain), tools (run commands, edit files, browse) and memory. Claude Code is an agent |
| Agent SDK | The software kit Claude Code is built on. Lets other programs run Claude sessions |
| Aggregator | A service that resells access to many AI models. Different from an agent |
| AGPL-3.0 | A license that requires publishing your source if you share a modified version or let others use it over a network |
| Apache-2.0, MIT | Permissive licenses. You may copy and change the code, keep the copyright notice |
| Bytecode | A simple in-between code that some languages compile to before running |
| Branch | A named line of work in git |
| Cargo | Rust's package manager and build tool |
| `CLAUDE.md` | A file Claude reads at the start of a session with instructions for that project |
| `CLAUDE_CONFIG_DIR` | An environment variable that points Claude Code to a different config and login folder. Used for a second account |
| Compiler | Translates a whole program into machine code before it runs |
| Context | What Claude can see in one session. Skills and long history use it up |
| DPAPI | Windows' built-in way to encrypt a secret for one user |
| Electron | A tool that makes desktop apps from web technology by bundling Chromium |
| Fork | Your own copy of someone else's project that you can change |
| Framework | A prefab kit built on a language (Laravel on PHP) |
| Hook | A small command Claude Code runs at certain events (session start, after a tool runs). Configured in settings |
| Interpreter | Reads and runs code line by line |
| JIT | Compiling the hot parts of a program while it runs |
| Job object (Windows) | A group of processes that can be closed together. Kona uses it so a session's children do not outlive it |
| JSONL | A file with one JSON record per line. Claude's transcripts use it |
| Kanban | A board with columns (Backlog, In progress, Done) and cards |
| Lock-in | Being stuck with one tool because your data and habits live there |
| MCP | Model Context Protocol. A standard way to give Claude extra tools (a database, a browser, a design app) |
| Monaco | The code editor component inside VS Code, usable on its own |
| MVP | The smallest version that proves the idea |
| Node.js | JavaScript running outside a browser |
| Orphan process | A program that kept running after the session that started it ended |
| Plan limits | The 5-hour "session" limit and the weekly limit on a Claude plan |
| Pull request (PR) | A request to merge a branch, usually reviewed first |
| `rate_limit_event` | A message the SDK sends with plan-limit information (web, undocumented fields) |
| SemVer, `0.x` | Version numbers MAJOR.MINOR.PATCH. `0.x` means "not declared stable" |
| Session | One conversation with Claude Code, saved as a transcript |
| Skill | A folder with a `SKILL.md` instruction file that Claude loads when relevant |
| Spike | A small throwaway test that answers one risky question |
| SQLite | A small database stored in one file |
| ssh-agent | A program that holds unlocked SSH keys in memory so you do not retype the passphrase |
| Tauri | A tool for light desktop apps: a Rust program showing a web interface in the system's web view |
| Token | A small piece of text. Usage and cost are counted in tokens |
| Transcript | The saved record of a session on disk |
| TypeScript | JavaScript with type checking |
| Vite | A fast build tool for web interfaces |
| WebView2 | The Edge-based web view built into Windows, used by Tauri |
| Worktree | A second working folder of the same git repo, on a different branch |
| xterm.js | A terminal display component for web interfaces |

### Interface and voice words (added with sections 10.6 and 7, F15)

| Term | Plain meaning |
|---|---|
| Atlas page | One page that shows every component in every state. Used as the visual test |
| Base component | A small reusable interface part: button, badge, field, menu... |
| Design tokens | The named values (colours, type sizes, spacing, radius, shadow) that every component reads, so changing one value changes everything |
| Identity mark | A small signature detail that every component carries so the product is recognisable |
| Leak scan | A check that persona phrases did not end up in files, commits or tickets |
| Output style | A Claude Code feature (a markdown file) that sets Claude's role, tone and response format for a session. A custom one needs `keep-coding-instructions: true` to keep the coding behavior |
| Persona | Kona's voice: a customizable personality used only when talking to the owner |
| React Aria Components | A library of accessible interface behavior (menus, selects, dialogs) without a fixed look |
| Rewrite pass | An optional step where a cheap model restyles Claude's finished reply in the persona's voice, with code and facts masked first |
| Semantic token | A token named by meaning ("text secondary") that points at a raw colour, so a theme changes in one place |
| Shallow clone | A copy of a git repo with only the latest version (`--depth 1`). Smaller and faster |
| Storybook | A tool that shows components one by one. Useful but heavy, so Kona uses a simple atlas page |
| Swap test | Cover the logo and check whether the screen is still recognisable as the product |
| System prompt | The hidden instructions Claude Code sends with every request. Output styles and `--append-system-prompt` change it |
| Tailwind CSS | A styling tool that builds the CSS ahead of time from class names and tokens |
| Usage report | The structured form of `/usage` (percent and reset time per limit). Documented as experimental |
| Voice layer | The part of Kona that decides how it speaks, kept separate from the part that does the work |
| API | A doorway for programs to talk to a service. For Claude, sending messages straight to the model over the internet, billed per token |
| CLI | Command-line interface: a program you run by typing in a terminal. `claude` is Claude Code's |
| SDK | Software Development Kit: a ready-made toolbox of code for using a service from your own program (section 17.6) |
| Cost ledger | Kona's saved record of what each session cost (F16) |
| Opening balance | A starting total stored when a session is first seen part-way through, so spend is not counted twice |
| Price table | The list of prices per million tokens used to turn tokens into dollars |

---

# Part E: Carried over from session-notes.md

## 19. Digest of every section of session-notes.md

The earlier file stays as the full original record, including its web research. This digest keeps every fact that could matter for Kona. Web facts were found in the earlier session by web search and by reading pages through a summarizing tool. Treat prices, star counts and versions as of 2026-10-24 and verify before relying on them. Each part ends with a short "For Kona".

### 19.1 Keeping the repo out of Miralis (notes section 1)
Covered in section 16. One extra detail: `AGENTS.md` was meant as a short version that points to `CLAUDE.md`, for other agent tools that read that filename.

### 19.2 How a real IT team builds a product (notes section 2)
The four parts of a product (landing page, backend, web app, mobile app) are not built one after another. They share one foundation and branch off it.

```
Idea -> Discovery -> Design -> Architecture -> Build (in sprints) -> Test -> Release -> Operate -> Improve
                                                  ^                                            |
                                                  +----------------- feedback loop ------------+
```

**Roles**

| Role | Owns |
|---|---|
| Product Owner / PM | What to build and in what order. Writes the backlog |
| UX Researcher / Designer | User flows, wireframes, UI design, design system |
| Tech Lead / Architect | Stack, system design, standards, big technical decisions |
| Backend Dev | API, database, business logic, integrations |
| Frontend Dev (web) | Web app UI, state, API consumption |
| Mobile Dev | iOS and Android (or Flutter or React Native) app |
| QA Engineer | Test plans, automation, bug triage |
| DevOps / SRE | Servers, CI/CD, monitoring, backups |
| Marketing / Content | Landing page copy, SEO, analytics |

Solo or small teams: one person wears many hats, but the stages stay the same and are done lighter.

**Stage 0, Discovery (before any code).** Problem statement (who has what problem, and why it matters). Users and personas (two or three concrete people, not "everyone"). Competitor and market scan. Value proposition in one sentence. Scope: the MVP versus later. Success metrics (for example 100 signups, 30% weekly retention). Constraints: budget, deadline, team size, legal or compliance (payments, personal data). Outputs: a one-page brief, a prioritized feature list, a rough roadmap.

**Stage 1, Requirements.** User stories: "As a [user], I want [action] so that [benefit]". Acceptance criteria: "Given X, when Y, then Z". Functional requirements (what it does) and non-functional ones (speed, uptime, security, supported devices, languages, accessibility). Prioritization with MoSCoW (Must, Should, Could, Won't) or RICE. Outputs: a PRD and a backlog (Linear, Jira, Trello or GitHub Projects).

**Stage 2, UX and UI design** (runs about one sprint ahead of development): user flows (signup, onboarding, core action, result); information architecture; wireframes (low fidelity, validated first); a design system (colors, type, spacing, buttons, inputs, icons) built once and reused on web, mobile and landing; high-fidelity mockups; states (loading, empty, error, success, offline, the most forgotten); a prototype shown to 5 real people; developer handoff. Outputs: a Figma (or equivalent) file, the design system, a component list.

**Stage 3, Architecture.** A monolith is usually right for an MVP, microservices come later if ever. Choose the stack. A relational database (PostgreSQL or MySQL) is the safe default, add Redis for cache and queues. Auth: sessions or JWT, social login, roles and permissions. Hosting: VPS, cloud provider or managed platform. Third parties: payments, email, SMS, push, file storage, maps, analytics. Documents: the ERD (data model, the hardest thing to change later), an API contract in OpenAPI or Swagger before coding so web and mobile can build against mocks, ADRs (one short note per major decision), a security plan (passwords, tokens, personal data, rate limiting, input validation).

**Stage 4, Project setup.** A monorepo (`apps/landing`, `apps/web`, `apps/mobile`, `apps/api`) is easy for small teams. Git workflow: `main` is always deployable, work happens on feature branches (`feat/login`, `fix/cart-bug`), every change goes through a pull request with at least one review, clear commit messages (Conventional Commits: `feat:`, `fix:`, `chore:`). Environments: `local`, `staging` (a copy of production), `production`, each with its own database, keys and config. `.env` files stay out of git, a secrets manager in production. Code quality tooling: linter, formatter, type checking, pre-commit hooks. CI/CD: on every PR run lint, tests and a build, on merge to `main` deploy to staging, a manual approval promotes to production. Docker, a README with setup steps, a CONTRIBUTING guide.

**Stage 5, Building in sprints** (1 to 2 weeks): planning, daily standup, build (branch, tests, PR), code review, QA on staging, sprint review (demo), retrospective. A build order that avoids blocking: (1) backend foundation: skeleton, DB migrations, auth (register, login, refresh, logout, password reset), roles; (2) backend core features one vertical slice at a time (endpoint, validation, business rules, queries, tests); (3) web and mobile in parallel, first against the OpenAPI mock and then the real API; (4) the landing page, often built early and independently so it can go live first (waitlist, SEO); (5) integrations: payments, email, push, file upload; (6) admin tooling (back office), easy to forget and needed on day one of operating.

**The four parts in detail**
- **Landing page:** explains the value and converts visitors. Content: headline, subheadline, benefits, how it works, social proof, pricing, FAQ, CTA. Static or server-rendered (Next.js or Astro) for speed and SEO. Must-haves: SEO (titles, meta descriptions, Open Graph, sitemap, structured data), Core Web Vitals, optimized images, analytics and conversion tracking, mobile-first layout, legal pages (privacy, terms), forms connected to the backend or an email tool with spam protection.
- **Backend and API:** layers are routes or controllers (HTTP), services (business logic), repositories or models (DB). Always include input validation on every request, a consistent error format and status codes, pagination, filtering and sorting, rate limiting and CORS rules, logging with request IDs, background jobs for slow work, versioned migrations, seed data, API versioning (`/v1/`) so old mobile apps do not break. Security basics (OWASP): hashed passwords (bcrypt or argon2), parameterized queries, authorization checks on every resource, HTTPS only, no secrets in code. Tests: unit, integration (endpoints plus DB), contract tests that the API matches the spec.
- **Web frontend:** pages and routes, reusable components from the design system, state management (server state through React Query or similar), one API client layer. Professional details: form validation with clear messages, loading skeletons, empty states, error boundaries, auth guards and token refresh, accessibility, responsive layouts, i18n if needed, error tracking (Sentry). Tests: component tests and end-to-end tests (Playwright or Cypress) for signup, login and the core action.
- **Mobile frontend:** native (Swift or Kotlin) or cross-platform (Flutter or React Native). Mobile-only concerns: secure token storage (Keychain or Keystore), offline behavior, push notifications (FCM or APNs), deep links, permissions, app size, battery and startup time, many screen sizes and OS versions. Releases are slower: developer accounts (Apple $99 a year, Google $25 once), TestFlight and Play internal testing, store review (hours to days). Old app versions stay in use for months, so keep the API backward compatible or add a force-update mechanism. Store listing assets are required.

**Stage 6, Testing in layers**

| Layer | What | Who |
|---|---|---|
| Unit | One function or class | Dev |
| Integration | Modules plus DB | Dev |
| API | Endpoints against the spec | Dev or QA |
| End-to-end | Real flows in a browser or device | QA |
| Regression | Did a change break old things? | Automated |
| Performance and load | Can it handle N users? | QA or DevOps |
| Security | Vulnerability scan, pen-test | Security or DevOps |
| UAT | Real users or stakeholders approve | Product |
| Device matrix | Browsers, phones, screen sizes | QA |

Bug lifecycle: reported, reproduced, prioritized (P0 to P3), fixed, verified, closed. Definition of Done: reviewed, tests pass, QA signed off, docs updated, deployed to staging.

**Stage 7, Release and deployment.** Pre-launch checklist: backups, monitoring, valid SSL, error pages, legal pages, rate limits, secured admin accounts, a rollback plan. Strategies: blue-green, canary (for example 5% of users first), feature flags. Versioning: semantic versioning (1.4.2) plus a changelog. Database migrations on deploy need the most care, keep them backward compatible. Soft launch to a small group, fix, then go wide.

**Stage 8, Operating.** Monitoring and alerting (uptime, CPU, memory, disk, error rates, slow queries, alerts to an on-call person). Centralized logging. Automated backups and tested restores. An incident process: detect, mitigate, communicate, fix, blameless postmortem. Security upkeep: dependency updates, patching, key rotation. A support channel feeding the backlog, product analytics (funnels, retention), cost watching.

**Stage 9, Iterate.** Measure, learn, prioritize, build, release, repeat.

**Suggested order for a small team or solo builder:** (1) one-page brief, personas, MVP scope, metrics; (2) user stories for the MVP only; (3) wireframes and a small design system; (4) choose the stack, draw the ERD, write the OpenAPI spec; (5) set up the repo, git workflow, CI, staging and production; (6) build and launch the landing page with a waitlist; (7) build the backend, auth first, then the core feature slice by slice; (8) build the web app against the API; (9) build the mobile app once the API is stable; (10) QA, beta test with real users, harden, set up monitoring; (11) launch, operate, iterate.

**Common mistakes to avoid:** coding before knowing the problem; building every feature before showing anyone; skipping the API contract; no staging environment; treating security, backups and monitoring as "later"; changing the DB schema without migrations; letting `main` break because PR checks are missing; forgetting empty, error and loading states; breaking old mobile app versions with an API change.

**Not yet known about the product (in the earlier notes):** what it does, who it is for, and the preferred stack. Offered next steps were: write the brief and MVP scope, propose a stack and monorepo layout, draft the ERD and API contract, save the guide into a `docs/` folder.

**For Kona.** The product question is now answered (section 1). This guide applies in a light form: this note is the discovery and brief, version 1 (steps 1 to 3) is the MVP, the Kona UI kit is the design system, section 10 and the decisions table play the part of ADRs, and the data model in section 6 plays the part of the ERD. Keep the feature-branch and commit habits even when working alone. A staging environment is not needed for a local app, but test data for the spikes should be separate. The mistakes list applies as it is, especially empty, error and loading states, and security "later".

### 19.3 Open-source design tools: Penpot, ArtCraft, Craft Apps (notes section 3)

**The first question** ("a free Adobe, now also a free Figma") found no single clear match. Candidates:
- **Penpot:** the best-known open-source Figma alternative. Made by Kaleidos (Spain), runs in the browser, self-hostable. One source gave about 61k GitHub stars (Oct 2026), another 35k+. Sources disagreed on its license (MPL-2.0 versus AGPL), so check the repo.
- **Graphite:** a free open-source 2D editor mixing vector and raster work, built with Rust and WebAssembly. Alpha stage. Often called an Illustrator or Photoshop alternative, not a Figma replacement.
- **OpenPencil:** newer open-source (MIT) Figma alternative that reads `.fig` files. About 9.2k stars.
- **OpenDesign:** free, Apache-2.0, design-to-code. One source says it is not a canvas editor.
- Older free tools: GIMP, Krita, Inkscape.

**ArtCraft** (the one the owner then named). From Storyteller, at `github.com/storytold/artcraft`, site getartcraft.com. Brandon Thomas (previously CEO of Storyteller.ai) is named as the founder. Two different things share the name: the **ArtCraft studio** (a desktop and web app for controlled AI image and video) and the **Craft Apps** (13 separate native desktop apps in Rust plus a launcher), which are almost certainly the "free Adobe and Figma" the owner had heard about.

**ArtCraft studio**
- Version v0.41.0. Windows x64 `.exe`, macOS universal `.dmg`, and a free web app at app.getartcraft.com. Requirements: Windows 10+ or macOS 12+, 8 GB RAM recommended, 2 GB disk. No Linux package, but it builds from source.
- Features: Image to Location, 2D and 3D compositing, Image to 3D mesh, mixed assets, character posing, background removal, text to image, image to video.
- Models: the README lists 62 (16 image, 25 video, 5 music or sound, 11 3D mesh, 5 world models). Other providers listed: Grok, Midjourney, Sora, World Labs. The README lists Kling, Google, Runway and Luma as planned, while the pricing page already lists Kling 3.0 Pro (a discrepancy).
- License: dual MIT or Apache-2.0, at the user's option (per the README). Repo stats: 36.2k stars, 5.7k forks, 390 open issues. The repo contains a `CLAUDE.md` and an `AGENTS.md`, so the team uses AI coding agents.
- Pricing: the software is free, hosted credits are optional.

| Plan | Monthly (20% launch discount) | List price | Yearly total | Credits per month |
|---|---|---|---|---|
| Basic | $8 | $10 | $96 | 1,000 |
| Pro | $28 | $35 | $336 | 3,750 |
| Max | $48 | $60 | $576 | 6,600 |
| Enterprise | Custom | | | Bespoke |

No free credits are listed. One-time credit packs never expire (prices not shown). Credits are refunded on failed generations. Cancel anytime, checkout through Stripe. Approximate output on Basic, Pro and Max: Nano Banana images about 250, 938 and 1,650; Seedance 2.0 video about 63, 234 and 413 seconds; Kling 3.0 Pro video about 45, 167 and 295 seconds.
- Site content: 8 FAQ guides (2D canvas, 3D editor, text to image, image to video, inpaint and more), 3 video tutorials, a blog with 2 posts (January 2026, about world models for film), a press kit with promo videos and 62 screenshots. Support through Discord (discord.gg/artcraft) and an e-mail contact on the site.

**The 13 Craft Apps.** All are pure Rust, native (no Electron), free and open source, with no account and no telemetry. Twelve also compile to WebAssembly and run in a browser tab (FilmCraft is the exception). Each has a headless CLI, a JSON control channel and an MCP server so AI agents can drive them. No page names which commercial product each app replaces. The pairings below are a reading from feature lists and press.

| App | Likely equivalent | Version and stage | Notable claims |
|---|---|---|---|
| PhotoCraft | Photoshop | 0.10.0, early alpha | Layers, masks, adjustment layers, smart objects. Opens and saves PSD and PSB (134 of 135 test files round-trip byte for byte). 16 adjustment layers, 70+ filters, CMYK, Lab, ICC, 8, 16 and 32-bit, on-device selection, GPU canvas |
| VectorCraft | Illustrator | 0.13.1, in development | Pen, exact curve booleans, gradient mesh, envelope distort, perspective grid, image trace (12 presets), SVG and PDF I/O. Claims 20,000 shapes in about 27 ms |
| FilmCraft | Premiere | 0.9.0, in development | Multi-track timeline, color tools, scopes, about 55 effects and 30 transitions, its own codecs (no FFmpeg) |
| LightCraft | Lightroom | 0.9.1, in development | Non-destructive 32-bit raw developer, masking, pure-Rust raw decoders (DNG, CR2, ARW, NEF, RAF, RW2, PEF, ORF), local library |
| PdfCraft | Acrobat | 0.9.0, early alpha | Rendering, search, page organizing, combine and split, AES-256 support, comments. Zero crashes claimed across a 983-file corpus |
| EffectCraft | After Effects | 0.11.1, in development | 259 effects, 38 blend modes, 3D layers with ray-traced shadows, JavaScript expressions, Lottie, EXR and ProRes-with-alpha export |
| DesignCraft | InDesign | 0.9.0, in development | Spreads, threaded text, Knuth-Plass line breaking, CMYK and spot colors, bleed and crop marks, PDF/A |
| FigCraft | Figma | 0.7.0, early alpha | Auto layout, components and variants, variables with modes, vector networks, prototyping, Dev Mode (generates CSS, HTML, React, SwiftUI, Compose), live multi-user sessions, 400+ commands |
| WordCraft | Word | 0.8.0, in development | `.docx` read and write, track changes, citations (APA, MLA, Chicago, IEEE), mail merge, offline spellcheck |
| SoundCraft | Pro Tools or Logic | 0.8.0, in development | Edit and Mix windows, automation, CLAP plugins, piano roll, notation, surround up to 9.1.6 |
| DeckCraft | PowerPoint | 0.8.0, in development | `.pptx` read and write, Morph transition, 150+ shapes, presenter view |
| CADCraft | AutoCAD | 0.8.0, in development | DXF read and write, opens DWG (read only), paper space, associative dimensions, parametric constraints |
| GridCraft | Excel | 0.8.0, in development | `.xlsx` read and write, 500+ functions, dynamic arrays, LAMBDA and LET, 17 chart types, PivotTables |

**Platforms for every Craft App:** macOS (universal), Windows (x64, x86, ARM64; MSI or portable), Linux (x86_64 and ARM64; Flatpak, AppImage, deb, rpm, tarball), FreeBSD 14, and a self-hostable web build, with SHA-256 checksums.

**ArtCraft Launcher** (v0.5.1, early alpha) installs, updates and launches all the apps, picks the right build, checks every download against its published SHA-256 hash, and macOS builds are signed and notarized. About 4k stars. The code is MIT or Apache-2.0, but the ArtCraft name and logo are trademarks, so forks must remove them.

**GitHub organization `storytold`:** "Open Source Tools and Models for Makers, Builders, and Creatives." 61.6k followers and 68 repos. Star counts shown: photocraft 72.2k, pdfcraft 17.5k, filmcraft 16k, lightcraft 14.5k, vectorcraft 10.6k, cadcraft 6.6k, gridcraft 6.4k, designcraft 4.7k, deckcraft 4.2k, soundcraft 3.7k. The repos listed show Apache-2.0. Some are described as "clean-room" rebuilds (CADCraft, SoundCraft, GridCraft). Other repos: `artcraft-services`, `craft-libs`, a forked `egui`, `craft-i18n`.

**Things to be skeptical about**
- None of the apps is past 1.0. Three are "early alpha", the rest "in development". File compatibility (PSD, `.docx`, `.pptx`, `.xlsx`, DWG) is where problems show first.
- PhotoCraft having 72k stars while "early alpha" is unusually high next to the main repo (36k). It may be hype, a viral launch, or something else. It was not determined.
- Performance and compatibility numbers come from the vendor's own pages.
- App pages do not state a license. The org listing shows Apache-2.0. Read each LICENSE file before commercial use.
- Earlier reviews said ArtCraft had no Linux build, while the site shows Linux for the Craft Apps.
- The site hides who is behind the company (the press kit has a contact but no team page).
- The AI studio is free, but hosted generations are metered through credits. Local use needs your own API keys.

**Relevance in the earlier notes.** UI design: FigCraft is too early to rely on, Penpot is the safer pick today, and FigCraft's Dev Mode export (React, SwiftUI, Compose) is worth revisiting in a few months. Marketing visuals: the AI studio and VectorCraft could help if the terms check out. Every app has an MCP server, so an agent could drive design tools directly.

**For Kona.** A designer role could use Penpot (browser) or, later, a Craft App through its MCP server. The needs check (F12) can list such apps. The Craft Apps and Graphite are examples of Rust-native tools, and the ArtCraft repo keeps a `CLAUDE.md` and `AGENTS.md`, the same pair of files proposed in section 16.

### 19.4 What "version 0.x" means (notes section 4)
Semantic versioning is MAJOR.MINOR.PATCH, for example `0.10.0`.
- **0.x:** the authors have not declared the product stable. Things can break between releases (features renamed or removed, file formats changed). Expect bugs and missing features. There is no promise of backward compatibility: a file saved in 0.9 may not open in 0.12.
- **1.0:** public behavior is considered stable. Breaking changes only come in a new major version (2.0). It is a public statement that the product is ready for real use (though "ready" is a judgment call).
- For the Craft Apps (0.7 to 0.13, early alpha or in development): not meant for client work or important files yet. Rapid version bumps mean fast iteration, not maturity. Keep backups and export to open formats (PSD, SVG, `.docx`) as you go.
- Caveats: versioning is a convention. Some projects sit at 0.x for years while stable, and some ship a buggy "1.0". Stage labels run alpha, beta, release candidate, 1.0. Rule of thumb: do not build anything critical on a 0.x tool unless you can swap it out.

**For Kona.** Kona itself starts at 0.1.0. Version the file formats (rule 11). Two of the forkable apps list no releases at all (section 11.2).

### 19.5 Local app or web version (notes section 5)
Recommendation then: download the desktop version to experiment, use the web only for a quick first look.
- **Desktop.** Pros: it is the main product, faster (direct GPU use), files stay on your machine, works offline (the AI studio still needs the internet for generation), easy updates through the Launcher, more features (CLI, full file access). Cons: you must install it, early software can misbehave so test on non-critical files and keep backups. macOS builds are signed and notarized per the launcher README. Windows signing was not stated, so check the SHA-256 checksum if cautious.
- **Web.** Pros: no install, nothing on your computer. Cons: slower and less capable (WebAssembly limits), browser storage can be cleared so save and export often. A hosted web app exists for the AI studio (app.getartcraft.com). For the Craft Apps the "web build" was only seen as a zip to self-host, with no hosted link found.
- Suggested path: try the AI studio on the web, install the Launcher for the Craft Apps, use throwaway files, and hold off on real work until they mature. To judge FigCraft, test it with a simple screen such as a login page.

**For Kona.** The same trade-off drives the "installed app or browser tab first" decision (section 3, row 16).

### 19.6 VectorCraft versus FigCraft (notes section 6)
VectorCraft is for making artwork (logos, icons, illustrations, print graphics), like Illustrator. FigCraft is for designing software interfaces (app screens, websites, prototypes), like Figma.

| | VectorCraft | FigCraft |
|---|---|---|
| Main job | Illustration, logos, icons | App and website UI design |
| Version and stage | 0.13.1, in development | 0.7.0, early alpha |
| Core tools | Pen, booleans, gradient mesh, envelope distort, blends, perspective grid, image trace | Frames, auto layout, components and variants, variables |
| Effects | Live effects: glows, shadows, 3D revolve, repeats | Basic styles |
| Layout | Free-form artboards | Responsive rules: auto layout, constraints, grids |
| Prototyping | No | Yes (connections, transitions, presentation view) |
| Developer handoff | No | Yes (Dev Mode: measurements, generated CSS, HTML, React, SwiftUI, Compose) |
| Collaboration | Not mentioned | Live sessions with shared cursors and chat |
| Formats | SVG, PDF, PNG, JPEG, WebP, native JSON | Not detailed |
| Automation | MCP server and CLI | MCP server and CLI (400+ commands) |

Example use for a new product: draw the logo and icons in VectorCraft and export as SVG, then import them into FigCraft for the login screen, dashboard and mobile screens. For serious UI work today, Penpot is the safer pick.

**For Kona.** Kona's own icon set and logo could be drawn in VectorCraft or any SVG tool (section 10.6). Nothing here is required.

### 19.7 Open-source skills for each team role (notes section 7)
A "skill" is a folder with a `SKILL.md` instruction file that Claude loads when relevant. None of the skills below were installed or tested in the earlier session. They were read through repo pages.

**The repos**

| Repo | License | Stars (as shown) | What it is | Install |
|---|---|---|---|---|
| alirezarezvani/claude-skills | MIT | 28.6k | Role-based library (product, engineering, marketing, PM) | `/plugin marketplace add alirezarezvani/claude-skills` |
| Jeffallan/claude-skills | MIT | n/a (a mirror said about 10.7k) | 67 developer-role skills | `/plugin marketplace add jeffallan/claude-skills`, then `/plugin install fullstack-dev-skills@fullstack-dev-skills` |
| coreyhaines31/marketingskills | MIT | 56.3k | 52 marketing skills | `npx skills add coreyhaines31/marketingskills` |
| vercel-labs/agent-skills | MIT | 32.9k | Vercel's React, UI and React Native rules | `npx skills add vercel-labs/agent-skills` |
| obra/superpowers | MIT | 304k | Workflow skills (planning, TDD, debugging, review) | `/plugin install superpowers@claude-plugins-official` |
| anthropics/skills | Mixed | 183k | Anthropic's official skills | `/plugin marketplace add anthropics/skills` |

In `anthropics/skills` the document skills (`docx`, `pdf`, `pptx`, `xlsx`) are source-available, not open source. Many of the others are Apache-2.0, so check each folder.

**Skills by role**
1. **Product Owner or PM:** `product-manager`, `agile-po`, `strategist`, `discovery`, `roadmap-communicator`, `experiment-designer`, and `code-to-prd` (turns code into a PRD) (alirezarezvani). `Feature Forge` (requirements and specs) and `Spec Miner` (reverse-engineer specs from code) (Jeffallan). `brainstorming` and `writing-plans` (superpowers). Scrum master, Jira and Confluence skills (alirezarezvani `pm-skills`).
2. **UX or UI designer:** `ux-researcher`, `ui-design`, `apple-hig-expert` (alirezarezvani). `frontend-design`, `theme-factory`, `brand-guidelines`, `canvas-design` (anthropics). `web-design-guidelines` (100+ accessibility, performance and UX rules) (vercel). `customer-research` (coreyhaines31).
3. **Tech Lead or Architect:** `Architecture Designer` (system design and ADRs), `API Designer`, `Microservices Architect`, `Cloud Architect`, `Legacy Modernizer`, and `The Fool` (challenges decisions) (Jeffallan). `senior-architect`, `database-designer`, `dependency-auditor` (alirezarezvani). `requesting-code-review`, `receiving-code-review`, `subagent-driven-development` (superpowers).
4. **Backend developer:** `NestJS Expert`, `Django Expert`, `FastAPI Expert`, `Spring Boot Engineer`, `Laravel Specialist`, `Rails Expert`, `.NET Core Expert`, `Postgres Pro`, `SQL Pro`, `Database Optimizer`, `Secure Code Guardian` (Jeffallan). `env-secrets-manager` (alirezarezvani).
5. **Frontend developer (web):** `react-best-practices` (40+ ranked rules), `composition-patterns`, `react-view-transitions` (vercel). `React Expert`, `Next.js Developer`, `Vue Expert`, `Angular Architect`, `TypeScript Pro` (Jeffallan). `frontend-design`, `web-artifacts-builder` (anthropics).
6. **Mobile developer:** `React Native Expert`, `Flutter Expert`, `Swift Expert`, `Kotlin Specialist` (Jeffallan). `react-native-guidelines` (vercel). `apple-hig-expert` (alirezarezvani). `aso` and `paywalls` (coreyhaines31). `mobile-developer` (sickn33/agentic-awesome-skills) and `senior-mobile` (borghei/Claude-Skills), found only through registry listings. The second one's license is "MIT with Commons Clause", so check it.
7. **QA engineer:** `Test Master`, `Playwright Expert`, `Code Reviewer`, `Debugging Wizard` (Jeffallan). `playwright-pro`, `api-test-suite-builder`, `performance-profiler`, an accessibility audit skill (alirezarezvani). `webapp-testing` (anthropics). `test-driven-development`, `systematic-debugging`, `verification-before-completion` (superpowers).
8. **DevOps or SRE:** `DevOps Engineer`, `Kubernetes Specialist`, `Terraform Engineer`, `Monitoring Expert`, `SRE Engineer`, `Chaos Engineer`, `Security Reviewer` (Jeffallan). `ci-cd-pipeline-builder`, `observability-designer`, `runbook-generator`, `incident-commander` (alirezarezvani).
9. **Marketing or Content:** `copywriting`, `copy-editing`, `cro`, `seo-audit`, `content-strategy`, `schema`, `programmatic-seo`, `ai-seo`, `analytics`, `launch`, `emails`, `social` (coreyhaines31). `content-creator`, `aeo` (alirezarezvani). `writing-guidelines` (vercel). `internal-comms`, `brand-guidelines` (anthropics).

**Caveats.** The repos overlap (testing skills appear in three of them), so pick one source per job. Counts differ between listings, verify on GitHub. Skills can include scripts that run on your machine, so read each `SKILL.md` and any scripts before installing (alirezarezvani has a `skill-security-auditor` skill, but audit that too). Loading many skills costs context and makes the assistant less focused, so install a few per project. The stack was not decided then. Nothing was installed. The offered next step was a lean starter set of about 10 to 15 skills, installed into a repo's `.claude/skills/` after a yes, so they only apply to that repo.

**For Kona.** This is the raw material for role profiles (F5). The role editor should show each skill's description and whether it ships scripts. Given the 18 `miralis-*` skills and many design skills already loaded globally (section 7, F5), a role that loads only three or four skills is a real saving.

### 19.8 Skills already installed in the earlier session (notes section 8)
- **Design and frontend (general):** `impeccable`, `design-taste-frontend`, `design-taste-frontend-v1`, `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `gpt-taste`, `redesign-existing-projects`, `stitch-design-taste`, `image-to-code`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `brandkit`, `full-output-enforcement`.
- **Miralis (turned off for this repo):** `miralis`, `miralis-app`, `miralis-landing`, `miralis-brand`, `miralis-copy`, `miralis-deck`, `miralis-diagram`, `miralis-docs`, `miralis-motion`, `miralis-video`, `miralis-seo`, `miralis-rebuild`, `miralis-repo`, `miralis-sync`, `miralis-update`, `miralis-audit`, `miralis-frontend-audit`, `miralis-backend-audit`.
- **Code and workflow:** `code-review`, `simplify`, `security-review`, `init`, `graphify`, `run`, `claude-api`, `loop`, `schedule`, `fewer-permission-prompts`.
- **Claude Code setup:** `update-config`, `keybindings-help`, `plugin-authoring`.
- **Data and artifacts:** `dataviz`, `artifact-design`, `artifact-capabilities`, `artifact-diagramming`.
- **Documents and files (Anthropic):** `anthropic-skills:docx`, `pdf`, `pptx`, `xlsx`, `docs`, `google-workspace`, `skill-creator`, `deep-research`, `morning`, `setup-writing-style`, `import-memory`.
- **Browser and computer control:** `anthropic-skills:built-in-browser`, `chrome-browser`, `computer-use`. The browser connection was closed earlier in that session, so these could not run.
- **Gaps for the team roles:** nothing for product management, QA or testing, DevOps or SRE, backend frameworks, mobile development, or marketing and SEO (apart from the Miralis ones, which are off here). Frontend and design are already well covered.

**For Kona.** The same list appeared in this session's skill listing, so it still holds. These are all loaded in every session unless a role narrows them.

### 19.9 OpenClaw and Hermes Agent (notes section 9)
Both showed up in the compatibility list of the alirezarezvani skills repo ("Claude Code, Codex CLI, Gemini CLI, Cursor, OpenClaw, Hermes Agent...").

**OpenClaw**
- An open-source agent that runs on your own hardware and is used through chat apps (Telegram, Discord and others). It acts by running commands, managing files and browsing. It runs persistently in the background and keeps memory across sessions.
- Started by Peter Steinberger (founder of PSPDFKit) in November 2025 as "Clawdbot", renamed Moltbot after trademark concerns about "Claude", then OpenClaw. MIT license. One source reports 350k+ GitHub stars as of May 2026 (not verified).
- Security warning: it acts on your behalf, so it is risky if misconfigured. One source quotes the maintainer saying it is far too dangerous if you cannot use a command line.

**Hermes Agent**
- An open-source, self-improving agent from Nous Research (also a maker of open language models). It keeps persistent memory and creates reusable skills from past work.
- Works with any provider (OpenAI, Anthropic, OpenRouter, local models). Reachable on 15+ messaging platforms, plus a CLI and desktop apps. Reportedly MIT. A hosted version costs $20 to $200 a month.
- About 214k stars (one aggregator). Press reports a $90M raise at a $1.5B valuation (WSJ, not official). Often described as a direct rival to OpenClaw.

| | Claude Code | OpenClaw or Hermes |
|---|---|---|
| Focus | Coding in a repo, in terminal or IDE | General personal agent, always on |
| How you talk to it | Terminal or VS Code | Mostly chat apps |
| Model | Claude | Any model |
| Runs | When you start a session | Continuously in the background |

Neither was needed for the project then. Sources are mostly blogs and aggregators, so the official repos are the primary sources.

**For Kona.** Kona is not an always-on agent: it starts sessions when asked and ends them. Two ideas are worth borrowing later: persistent memory (the brain, F7) and turning repeated work into reusable skills.

### 19.10 Agents versus aggregators (notes section 10)
An **agent** is a program with three parts: a **model** as the brain (Claude, GPT, a local model), **tools** (run commands, read and write files, browse, send messages) and **memory**. OpenClaw, Hermes and Claude Code are all agents. An **aggregator** is a service that resells access to many AI models (ArtCraft's site says "no aggregator between you and the models"). Analogy: the model is the brain, the agent is the body with hands and a notebook, and an aggregator is a store that sells access to many brains. A skill (`SKILL.md`) is a text instruction file, so any agent that can read it can use it, which is why one repo's skills work across many tools.

### 19.11 API key versus monthly plan (notes section 11)
Both tools above are free software. The model is what costs money, through an API key or a free local model. A chat subscription (Claude Pro or Max, ChatGPT Plus) is a separate product from API access.

**OpenClaw with Claude: the policy changed several times**
- Feb 20, 2026: Anthropic's terms banned using subscription logins in third-party tools.
- Apr 4, 2026: Pro and Max subscriptions stopped working with OpenClaw.
- May 13, 2026: Anthropic announced a reversal, with third-party agent use returning through a separate monthly "Agent SDK credit" billed at API rates from June 15.
- Jun 15, 2026: that change was paused ("Nothing changes for now").
- Oct 7, 2026: Anthropic's help center reportedly says "For now, nothing has changed", and third-party tools built on the Agent SDK still draw from normal subscription limits. This reading comes from one blog (BetterClaw), not from Anthropic's own page.
- So a subscription may work right now, but nothing is guaranteed. An API key is the stable choice for an always-on agent.

**Hermes Agent**
- Cost is model plus hosting: about $5 to $80 a month by one estimate. The cheapest route is a local model through Ollama (electricity only, lower quality than Claude or GPT). Cheap paid APIs: DeepSeek, MiniMax.
- One source says Hermes connects through API endpoints, so a chat subscription will not work. No official docs confirmed either way.
- Hosted: Nous Portal free tier or $20 per month Plus. An always-on agent also needs a computer or a VPS ($4 to $25 a month).

| Option | Cost | Works with a monthly plan? |
|---|---|---|
| Claude Code | Your Claude plan | Yes, officially supported |
| OpenClaw plus Claude | API usage (safest) | Maybe, unstable |
| Hermes plus Claude or GPT | API usage | Unclear, likely not |
| Either plus a local model | Hardware and electricity | Not applicable |

Set a spending limit before trying either with an API.

**For Kona.** This is the root of risk 1 (section 5). Kona's safest path is to drive the real `claude` program with the owner's own login. New facts from this session (web): Anthropic's docs say `--bare` mode never reads the subscription login (risk 23), and the usage report only appears for a claude.ai login (section 7, F3).

### 19.12 VS Code extension versus terminal (notes section 12)
Both run the same Claude Code engine: the same model, tools, `CLAUDE.md`, skills, settings and plan usage.
- **VS Code extension:** sees your editor (open file, selection, diagnostics), visual side-by-side diffs, clickable file and line references, paste or drag images and click permission buttons, a session manager panel with Local and Web tabs. Best for working in one project while reading code.
- **Terminal:** works anywhere (SSH, tmux, containers, machines without an editor), scriptable with `claude -p "..."` for CI and scheduled jobs, some slash commands, keybindings and settings (for example the status line) appear in the terminal first or only, lighter, works with any editor. Best for automation and remote servers.
- Day to day, the extension is easier. For server work, use the terminal over SSH. Using both at once is fine, but each session has its own chat history, so avoid editing the same file in both at the same time.
- The effort level (shown as "Sonnet 5.5, Extra high" in a screenshot then) uses limits faster. The Miralis effort rule does not apply in this repo.

**For Kona.** Kona is meant to take the best of both: the extension's images, diffs and clickable references, and the terminal's `/usage` and scripting. Section 17's screenshots show the extension (version 2.1.310) connected to Claude Code 2.1.293.

### 19.13 Running two Claude accounts (notes section 13)
**Terminal (works well).** Each account gets its own config folder through the `CLAUDE_CONFIG_DIR` environment variable.

```powershell
# Account A (default)
claude

# Account B: separate folder, then log in once
$env:CLAUDE_CONFIG_DIR = "$HOME\.claude-b"
claude        # run /login and sign in with the second account
```

Add two PowerShell profile functions (for example `claude-a` and `claude-b`) that set the folder and run `claude`. Both terminals can run at the same time.

**VS Code extension (shaky)**
- One fixed account by default and no built-in switcher. A multi-account request from May 2026 was still open.
- One report says the extension ignores `CLAUDE_CONFIG_DIR` when set in the shell profile.
- It has a `claudeCode.environmentVariables` setting, but one bug report said API calls still used the wrong account's token even though the panel showed the other. It was closed May 5, 2026, with no fix described.
- A configurable-config-directory request was marked resolved on April 9, 2026. What shipped was not confirmed.
- Third-party switchers (`claude-swap`, `ccsw`, `aisw`) exist. They handle login tokens, so treat them like any third-party code.
- On macOS, one report says credentials can leak across profiles through the Keychain. Not relevant on Windows.

**Practical setup then:** use the terminal for the second account, keep VS Code on the main one, and after logging in confirm the active account using the usage bars, not just the panel label.

**Other notes:** each account has its own 5-hour and weekly limits. A second config folder will not have the global Miralis rules or installed skills until they are copied in, which could be useful as a clean profile that never loads Miralis instructions. Editing the PowerShell profile (outside the repo) needs the owner's approval first.

**For Kona.** This is feature F6. Kona sets the variable per session, so the PowerShell functions are not needed.

### 19.14 What Anthropic's terms say (notes section 14)
Read from the Consumer Terms (effective Oct 8, 2025) and the Usage Policy (the page showed an effective date of Nov 12, 2026, which is after the session date, so it may be an upcoming version).

**Consumer Terms**
- Multiple accounts: no clause found.
- Creating accounts to evade usage limits: no clause found. Section 3 bars "bypassing any of our systems or protective measures".
- Sharing logins (Section 2): "You may not share your Account login information, Anthropic API key, or Account credentials with anyone else." "You also may not make your Account available to anyone else." "You are responsible for all activity occurring under your Account."
- Automated access (Section 3, item 7): no bots or scripts, except through an API key or where Anthropic explicitly permits it.
- Usage limits: no specific terms. Section 12 says Anthropic may "increase or decrease capacity limits".

**Usage Policy**
- Bars coordinating malicious activity "across multiple accounts, or create multiple accounts, to avoid detection".
- Bars circumventing "a ban through the use of a different account, such as the creation of a new account".
- Bars "intentionally bypass or interfere with capabilities, restrictions, or guardrails established within our products" (usage and rate limits are not named).
- Bars reselling or proxying access to Claude "through unauthorized means".
- Enforcement: Anthropic may "warn you or throttle, limit, suspend, or terminate your access".

**Reports from others**
- Anthropic's stated position, as reported by blogs, is that having multiple accounts is not against the terms and that enforcement targets misuse.
- Some people reported bans in February 2026 for holding multiple Claude Max subscriptions, which conflicts with that position.
- When weekly limits were introduced in 2025, Anthropic said they aimed at account sharing and resale.
- One blog put "hit the limit on account A, switch to B repeatedly" in a medium-risk category. That is the blogger's opinion, not an Anthropic rule.

**Plain-terms summary**
- Okay: two accounts of your own with separate purposes (personal and a side project, or personal and work), only you log in, each with its own plan.
- Not okay: letting someone else use your account, reselling access, creating a new account after a ban, making many accounts to hide bad behavior.
- Unclear: switching to account B every time account A runs out, only to avoid limits. Not named as banned, but "bypassing protective measures" could be read to cover it.
- Advice: use a second account only for a real separate purpose, do not switch just to get around limits, never share your login.

This is a summary, not legal advice. The official pages are the final word.

**For Kona.** No auto-switch when a limit is hit (risk 12). Kona is a tool for the owner only, which fits the rule against sharing logins.

### 19.15 Using your own account on several devices (notes section 15)
Using your own account on two or three of your own devices is fine. "Sharing" means a different person uses the account.
- Fine: your laptop, desktop and phone, used only by you; home and work; VS Code on one machine and the terminal on another.
- Not fine: a friend, coworker or family member uses your login, or a team shares one account to save money.
- All devices draw from the same 5-hour and weekly limits, so more devices does not give more usage. The terms read did not mention a device cap. Anthropic's help pages were not checked, so a limit could exist elsewhere.
- Do not stay logged in on a computer you do not control (library, a friend's PC). Log out when done. You are responsible for anything done under your account.
- If the project grows and several people need Claude, each should have their own account or a team plan.

**For Kona.** The terminal's `/usage` skill breakdown only covers this machine (section 15.3), while the plan bars cover the whole account. Kona's own per-role numbers will also be local only.

### 19.16 Open items from the notes, and where they stand now (notes section 16)

| Open item in the earlier notes | Where it stands now |
|---|---|
| What the product does, who it is for, the stack | Answered: Kona, a personal desktop workspace (sections 1 and 10) |
| Whether `CLAUDE.md` and `AGENTS.md` keep Miralis rules out in a fresh session | Still untested, and the files are missing from this folder (risk 14) |
| License of each Craft App, and whether FigCraft is usable for real UI work | Open. Not needed until a designer role exists |
| Whether the huge star counts (PhotoCraft at 72k while "early alpha") are real | Open |
| The current state of the OpenClaw-on-subscription policy | Open. Anthropic's help article on using the Agent SDK with a Claude plan appeared in a search and has not been opened (risk 1) |
| Whether the VS Code extension now honors per-workspace account settings | Open, and not needed if Kona owns the processes |
| The effective date of the Usage Policy (Nov 12, 2026 was after the session date) | Open |

Possible next steps offered in the earlier notes, and what became of them:

| Offered next step | What became of it |
|---|---|
| 1. Write the product brief and MVP scope | This note (sections 1, 2 and 12) |
| 2. Propose a stack and monorepo layout | Section 10 (a single app, not a monorepo) |
| 3. Draft the ERD and OpenAPI contract | Section 6 (the data model). There is no web API |
| 4. Save the team-workflow guide into `docs/` | Section 19.2 |
| 5. Suggest and install a lean skills set into the repo | Roles (F5), after test S8. Nothing installed |
| 6. Dig into one Craft App, a LICENSE and README, or compare FigCraft with Penpot | Deferred |
| 7. Write PowerShell profile functions for two Claude accounts | Replaced by Kona's account feature (F6). Editing the profile would need approval |

---

## 20. Sources

**From the earlier notes (session-notes.md, section 17)**

Design tools and ArtCraft
- https://github.com/open-pencil/open-pencil
- https://webreveal.io/alternatives/figma-alternatives.html
- https://open-design.ai/alternatives/figma/
- https://brinolo.com/open-source/figma/
- https://uxmagic.ai/blog/figma-alternatives
- https://best-of-web.builder.io/library/GraphiteEditor/Graphite
- https://selfhostedworld.com/alternative/illustrator
- https://andrew.ooo/posts/artcraft-review-open-source-ai-ide-for-artists/
- https://www.blog.brightcoding.dev/2026/10/08/storytoldartcraft-open-source-ide-for-controlled-ai-image-video
- https://ossinsight.io/analyze/storytold/artcraft
- https://propakistani.pk/2026/10/09/free-open-source-copies-of-photoshop-premiere-and-lightroom-are-here/
- https://www.smartworld.it/news/artcraft-alternativa-gratuita-open-source-adobe.html
- https://getartcraft.com/ (and /pricing, /download, /apps, /apps/*, /faq, /news, /tutorials, /support, /press-kit)
- https://github.com/storytold/artcraft
- https://github.com/storytold/craft-launcher
- https://github.com/storytold

Skills
- https://github.com/alirezarezvani/claude-skills
- https://github.com/Jeffallan/claude-skills (README through cdn.jsdelivr.net/gh/jeffallan/claude-skills@main/README.md, and SKILLS_GUIDE.md)
- https://github.com/coreyhaines31/marketingskills
- https://github.com/vercel-labs/agent-skills
- https://github.com/obra/superpowers
- https://github.com/anthropics/skills
- https://snyk.io/articles/top-claude-skills-ui-ux-engineers/
- https://claudemarketplaces.com/skills/vercel-labs/agent-skills/react-native-skills
- https://linuxhandbook.com/blog/devops-engineer-claude-skills/
- https://github.com/travisvn/awesome-claude-skills

OpenClaw, Hermes and subscription policy
- https://operator.io/blog/what-is-openclaw
- https://www.mindstudio.ai/blog/what-is-openclaw-ai-agent
- https://techradar.com/pro/what-is-openclaw
- https://ai.g2.com/marketplace/tools/hermes-agent
- https://twit.tv/posts/tech/what-makes-hermes-agent-stand-out-open-source-innovation-nous-researchs-jeffrey
- https://www.trendingtopics.eu/nous-research-raises-90-million-hermes/
- https://www.betterclaw.io/blog/openclaw-anthropic-subscription-ban
- https://www.mindstudio.ai/blog/anthropic-openclaw-ban-oauth-authentication
- https://mlq.ai/news/anthropic-ends-paid-access-for-claude-in-third-party-tools-like-openclaw/
- https://www.gradually.ai/en/hermes-agent-costs/
- https://www.hostinger.com/tutorials/?p=150154
- https://haimaker.ai/blog/hermes-api-costs-pricing.md

Multiple accounts and terms
- https://claudeissues.com/issue/55621-feature-multi-account-support-in-vscode-extension
- https://claudeissues.com/issue/43911-feature-support-configurable-config-directory-in-vscode-extension-for-multi-acco
- https://claudeissues.com/issue/34888-vscode-extension-ignores-per-workspace-auth-when-using-claude-config-dir
- https://blog.codeminer42.com/ai-tip-running-two-claude-code-accounts/
- https://github.com/realiti4/claude-swap
- https://www.anthropic.com/legal/consumer-terms
- https://www.anthropic.com/legal/aup
- https://metricnexus.ai/blog/anthropic-banning-multiple-claude-accounts
- https://www.grandlinux.com/en/blogs/claude-account-ban-risk.html
- https://en.ain.ua/2025/07/30/anthropic-introduces-weekly-limits-for-claude-code/

**Added in this session (2026-10-24)**

Anthropic documentation (read this session, not tested)
- https://code.claude.com/docs/en/agent-sdk/typescript (the `SDKRateLimitEvent` type, the `SDKUsageReport` type, `canUseTool`, and the `systemPrompt`, `skills`, `settingSources`, `mcpServers`, `env` and `resume` options)
- https://code.claude.com/docs/en/cli-reference (all CLI flags)
- https://code.claude.com/docs/en/headless (print mode, stream-json, bare mode, permission prompts, background tasks, SIGTERM)
- https://code.claude.com/docs/en/output-styles (custom output styles and `keep-coding-instructions`)
- https://code.claude.com/docs/en/agent-sdk/cost-tracking (how `total_cost_usd`, `modelUsage` and per-step usage work, running totals, resume, fork, `/clear`)
- https://code.claude.com/docs/en/costs (the `/usage` Session block, what the dollar figure means on a subscription, the plan usage breakdown, OpenTelemetry)
- https://support.claude.com/fr/articles/15036540-utilisez-le-claude-agent-sdk-avec-votre-plan-claude (appeared in a search, not opened)

Plan bars (earlier lead, GitHub issue reports)
- https://claudeissues.com/issue/50518-claude-agent-sdk-expose-per-bucket-rate-limit-utilization-to-headless-sdk-consum
- https://claudeissues.com/issue/91857-agent-sdk-rate-limit-event-already-carries-per-bucket-unifiedwindows-utilization
- https://claudeissues.com/issue/26392-docs-agent-sdk-missing-sdkratelimitinfo-and-sdkratelimitevent-type-documentation

Existing tools
- https://github.com/langwatch/kanban-code
- https://utensils.io/claudette/ (repo: https://github.com/utensils/Claudette)
- https://github.com/winfunc/opcode
- https://www.conductor.build/workflows/run-parallel-claude-codes
- https://claudeskills.info/harness/vibe-kanban/
- https://nimbalyst.com/blog/best-git-worktree-tools-ai-coding-2026/
- https://nimbalyst.com/blog/best-agent-management-tools-2026/
- https://nimbalyst.com/blog/best-claude-code-gui-tools-2026/

Interface references
- https://github.com/untitleduico (organization), https://github.com/untitleduico/react and https://github.com/untitleduico/untitledui-vite-starter-kit
- https://api.github.com/orgs/untitleduico/repos (the repository list, 2026-10-24)
- https://api.github.com/repos/utensils/Claudette/releases and https://api.github.com/repos/langwatch/kanban-code/releases (release files and dates, 2026-10-24)
- Local, read only: `C:\miralis-canon\PARTS.md`, `C:\miralis-canon\DESIGN.md`, `C:\miralis-canon\MIRALIS.md`, and the folder listings of `dist` and `src`
- Local clones, reading only: `D:\kona-refs\untitled-ui-react` and `D:\kona-refs\untitled-ui-vite-starter`

**Measured on this PC (seen):** RAM, CPU, free disk, top memory users, listening ports and the size of `D:\temp\claude`, all on 2026-10-24 (section 15).

---

End of note. When a decision changes, update the Decisions table (section 3) and the Open questions (section 4) instead of starting a new note.
