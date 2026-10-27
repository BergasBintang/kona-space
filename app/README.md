# Kona (the app)

A Tauri 2 desktop app: a Rust core (`src-tauri/`) and a React and TypeScript screen (`src/`). It starts the real `claude` program, one per session, and shows what it streams. The plan is in `../kona-space-app.md`, the look in `../docs/DESIGN.md`.

## Run it

You need Node.js 22 or newer, Rust (through `rustup`) and the Microsoft C++ build tools. In a new terminal, `cargo` must be on the PATH. (The author keeps the Rust tools on the D: drive and points `RUSTUP_HOME`, `CARGO_HOME` and the PATH there; that is a choice, not a requirement.)

```
npm install          once
npm run tauri dev    opens the window, rebuilds as you edit
npm run tauri build -- --no-bundle    the release program, src-tauri\target\release\app.exe
```

The first build takes about 4 to 6 minutes and needs a few hundred MB of free RAM, so close other apps first.

## Where things are

| What | Where |
|---|---|
| Start, talk to and stop `claude` | `src-tauri/src/session.rs` |
| Everything Kona starts stops with Kona (Windows job object) | `src-tauri/src/job.rs` |
| The cost ledger (SQLite at `%APPDATA%\Kona\kona.db`) | `src-tauri/src/ledger.rs` |
| Turning the stream into things to draw | `src/lib/sessions.ts` |
| The screen | `src/components/` |
| Projects, files, roles, accounts, the voice, settings | `projects.rs`, `files.rs`, `roles.rs`, `accounts.rs`, `persona.rs`, `backup.rs` (settings and backups) |
| Tickets, and the board's tool server (Claude starts it, over standard input and output) | `tickets.rs`, `mcp.rs` |
| Worktrees (Git's own commands only) | `worktrees.rs` |
| Programs left running, ports, scratch files (Windows calls in `winproc.rs`) | `leftovers.rs`, `winproc.rs` |
| The brain: files in `brain.rs`; the engine (links, groups, search, report, map) in `src/lib/brain/`; the same search for Claude in `brain_search.rs`; starter notes in `src/brain/starter/` | |
| Notes written about sessions (one cheap Haiku call) | `summary.rs`, `src/lib/brain/summary.ts` |
| Servers as references, and the rules for ssh, scp and sftp | `ssh.rs` |
| Cost views, needs check | `ledger.rs`, `needs.rs` |

## Tests

```
npm test                  the brain engine (12 tests, run by Node itself)
cd src-tauri && cargo test --lib    the Rust side (brain search, the ssh rules, what a session may start with)
npm run smoke             opens every place of a running Kona (see tests/smoke.mjs for how to start it)
```

## Testing the real window

Start it with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` and a script can click and type in it over the Chrome DevTools protocol (this PC only). That is how step 1 was checked. Never leave that port open outside a test.
