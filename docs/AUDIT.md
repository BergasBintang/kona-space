# Audit of Kona 0.16.0

Date: 2026-10-28. Covers everything built from 0.1.0 to 0.16.0. Written after the plan's build steps were finished.

Tags used below: (seen) checked on this PC while writing this, (not checked) could not be checked.

## Verdict

The build plan is finished except the installer and a few small items listed under "Known gaps". Nothing found in the audit is left open as a bug. The things that are not checked are listed on purpose, so nobody assumes they were.

## How it was checked

| Check | Result |
|---|---|
| `npm test` (the brain engine: parsing, linking, search, redaction) | 12 of 12 pass (seen) |
| `cargo test --lib` (brain search twin, ssh rules, what a session may start with) | 10 of 10 pass (seen) |
| `npx tsc --noEmit`, `cargo check` | clean (seen) |
| `npm audit` | 0 vulnerabilities (seen) |
| Fresh clone of the repo, install and build | builds (seen, earlier in the run) |
| Release program (no console window): every place opens, markdown, image and PDF show, no content-policy violation | passes (seen); `npm run smoke` repeats this on a running Kona |
| Real sessions: approvals, plan mode, resume, board tools, ssh refusal | worked (seen, each step in the changelog) |
| Rust lint with clippy | not run, clippy is not installed (not checked) |

## What was reviewed for safety

| Area | Finding | State |
|---|---|---|
| What the screen can ask the core to start | A mode that skips permission checks, a model name that is really a program option, a resume id that is not an id, or a folder outside every project could have been sent by a compromised screen | Fixed: `check_launch` and the project-folder check refuse them, with a unit test |
| Paths | File reads and writes go through the project folder check; backup deletion accepts only a backup's own date-time name; a path with `..` was refused (seen) | Fine |
| Program control | Sessions and their children sit in one Windows job object, so closing Kona closes them. Stopping a leftover uses a key of process id plus start time, so a reused id cannot be hit | Fine |
| Servers (ssh) | A role may run ssh, scp or sftp only to a host listed for it; every such command still asks; Kona's rules are "ask" rules, which beat the owner's own allow rules (seen); a private-key message is blocked before it is sent | Fine |
| Built-in tool server | Kona's exe in `--mcp-board` mode, stdio only, no port. Tools can raise and update tickets but not move one to Done | Fine |
| Screen content policy | The window had no content-security policy | Fixed: a real policy in `tauri.conf.json`; no violation in any place (seen) |
| Secrets | Brain redaction hides secret shapes before a note is saved or searched. A search over text with a letter whose lower case is longer (for example a dotted capital I) could shift a position | Fixed: ASCII lower case only, with a test |
| Keys and logins | Kona stores none; accounts are folders that Claude Code owns | Fine |
| Network | Nothing leaves the PC except what Claude Code sends to Anthropic. The test port exists only when started with a variable | Fine |

## The plan against what was built

| Feature | Built | Note |
|---|---|---|
| F1 Projects and file tree | Yes | Read-only; arrow keys work |
| F2 File viewer | Partly | Text, JSON, markdown, pictures, PDF. No syntax colours (Monaco was not used, to keep memory low) |
| F3 Sessions | Yes | Approvals, plan mode, pasted pictures, resume |
| F4 Roles | Yes | Ten starting roles, own roles, brief, model, mode |
| F5 Accounts | Yes | Per session; sign-in in a second browser account not checked |
| F6 Costs | Yes | By project, role, ticket, account, model, day, session. The monthly CSV export was not built |
| F7 Needs check | Yes | Looks only, never installs |
| F8 Voice | Yes | One voice for all roles, set once; carried by an appended system prompt instead of an output style |
| F9 Board | Yes | Five columns, files in the project, agent tickets |
| F10 Worktrees | Yes | Per ticket, merge and remove after confirmation |
| F11 Leftovers | Yes | Programs left behind with their ports |
| F12 Brain | Yes | Graph, ask with found, partly and not-in-the-brain, wanted list, notes from sessions |
| F13 Servers | Yes | References only |
| F14 Limits | Yes | Hard cap of 3 sessions, default 2 |
| F15 Settings and backups | Yes | |
| F16 Resume | Yes | |

Decisions that changed on the way, and are updated in the plan: the voice uses an appended prompt; the session cap is a hard 3 (it was 6); React Aria Components were not used (own select, multi-select and smart-search parts instead); each Claude session was found to take about 400 MB, not 225.

## Measured against the budgets (release program, seen)

| Budget | Target | Measured |
|---|---|---|
| Kona's own memory, idle | at most 200 MB | about 119 MB (was 235 MB before the graphics process was turned off) |
| Kona plus two sessions, Kona's share | at most 300 MB | about 118 MB; each Claude session about 400 MB on top |
| Idle CPU | near zero | about 0% (was 21% of a core before the breathing mark was made a stepped animation and the logo still) |
| Start to window | under 3 s | about 1.2 s |

## Found and fixed during the run

- A session title lost every letter "s" (a pattern that was missing a backslash).
- A process start time lost precision as a number, so Stop and Ignore failed on leftovers; items now carry a text key.
- Leftovers listed Claude's own shell wrapper.
- Board tools asked for approval in plan mode; Kona now answers its own tool requests.
- The drawer's Save stayed active when only the minute of the stamp matched.
- A resumed session wrote a negative row to the cost ledger (resumed totals start from zero); seeding removed, a guard added, the bad row deleted.
- The sidebar overflowed in a short window; its top part now scrolls and the plan bars stay pinned.
- A summary written when a session ended could run while other sessions worked; it now waits.
- Idle CPU and graphics-process memory (above).

## Known gaps

- Installer: not built. It needs the NSIS packer downloaded; waiting for a yes.
- Clippy: not installed, so no deeper Rust lint.
- Not checked: signing in to a second Claude account in the browser, a real mouse drag of a file, a real clipboard paste of a picture, swapping the UI kit, a pass with the keyboard only, and that colour is never the only sign of a state.
- The FigCraft design file does not yet show the newer places (Worktrees, Brain, Leftovers, Servers, Settings).
- Not built: syntax colours, a monthly CSV export of the ledger, a voice per role, guessed links in the brain, API-key accounts.
- Open decision for the owner: whether the brain should also cover a project's own docs and code.
