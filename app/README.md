# Kona (the app)

A Tauri 2 desktop app: a Rust core (`src-tauri/`) and a React and TypeScript screen (`src/`). It starts the real `claude` program, one per session, and shows what it streams. The plan is in `../kona-space-app.md`, the look in `../docs/DESIGN.md`.

## Run it

The Rust tools live on D: (`D:\toolchain`). A new terminal needs these set (they are saved as user variables, so a fresh Windows session has them):

```
RUSTUP_HOME=D:\toolchain\rustup
CARGO_HOME=D:\toolchain\cargo
PATH includes D:\toolchain\cargo\bin
```

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

## Testing the real window

Start it with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` and a script can click and type in it over the Chrome DevTools protocol (this PC only). That is how step 1 was checked. Never leave that port open outside a test.
