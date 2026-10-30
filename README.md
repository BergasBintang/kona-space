# Kona

A desktop workspace for [Claude Code](https://claude.com/claude-code), for Windows. One window to start Claude Code sessions per project, browse the project's files, give each session a role (a cat at its own desk in a small pixel office), keep track of what it costs, and run a small board of tickets that Claude can read and update itself.

Kona is a personal project, made by one person for their own PC. It is early (see `VERSION`), it changes often, and nothing is promised.

## What works today

- **Projects and files:** add a project (a folder), browse it, read files (text, JSON, markdown, pictures, PDFs). Read-only.
- **Sessions:** chat with Claude Code per project, see each step, approve or refuse each command or file change (or always allow one here), paste pictures, resume an earlier session. At most two run at once by default.
- **The office:** Kona opens on a welcome page with a card per project, then an isometric pixel-art office with a room for every place below. A cat sits at a desk for each role and types, waves or blinks from what its session is doing. A top bar keeps the project, a list of every room, what waits on you, the account and the plan bars in view.
- **Roles:** ten roles (Product, Design, Frontend, Backend, QA, Security, DevOps, Marketing, Content and SEO, Support) and a Secretary at the front desk who turns what you say into tickets. Each has a model, a permission mode and a short brief. They come with Kona and cannot be changed.
- **Accounts:** two or more Claude logins. Each project uses exactly one, chosen on the welcome page.
- **Costs:** what sessions cost in dollars (an estimate at list price, not a bill), by project, role, ticket, account, model, day or session.
- **Needs check:** which local tools (Git, Node, PHP, Docker and so on) a role or project needs, and which are missing. It only looks; it never installs.
- **Voice:** how Claude talks to you in chat, set once.
- **Board:** tickets as plain files in the project, five columns, and a built-in tool server so Claude can raise and update tickets (never move one to Done).
- **Worktrees:** a ticket's session can work in its own copy of the repo on its own branch. A page shows every copy (ahead and behind, files changed, a conflict preview) and merges or removes one after you confirm.
- **Leftovers:** the programs a session started (dev servers) and which are still running after it ended, with their ports; stop one after a confirmation. Claude's scratch files per session.
- **Brain:** a graph of linked notes: your own notes, Claude's memory for the project (read-only) and starter notes about working with agents. Ask it a question and it says plainly whether the answer is found, partly there, or not in the brain. A session that ends writes a short note, and Claude can search the brain itself.
- **Servers:** the servers a project may reach, kept as references (never a key). A role can run ssh, scp or sftp only to a server listed for it, and every such command still asks you.
- **Updates:** a few seconds after start Kona can ask GitHub if a newer version exists (one small request, nothing about you is sent). If so it asks you; on yes it downloads the signed installer, installs it and starts again. Turn it off in Settings. How a version is published: [docs/RELEASING.md](docs/RELEASING.md).
- **Settings and backups:** the window size (100, 90 or 80%), the session limit, each project's GitHub address, and one-press backups of Kona's data, tickets and notes.

Not built yet: syntax colours in the file viewer, a voice per role.

## What you need

- Windows 10 or 11 (with WebView2, which Windows 11 includes)
- [Claude Code](https://claude.com/claude-code), installed and signed in
- Node.js 22 or newer
- Rust (through `rustup`) and the Microsoft C++ build tools, as listed in the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Run it

```
cd app
npm install
npm run tauri dev
```

The first build takes several minutes. More in [app/README.md](app/README.md).

To make an installer instead: `npm run tauri build` in `app`. It writes `app/src-tauri/target/release/bundle/nsis/Kona_<version>_x64-setup.exe` (about 3 MB), which installs for the current user only, with no administrator rights. The first time, Tauri downloads the NSIS packer.

## Where things are

| What | Where |
|---|---|
| The app (Rust core and React screen) | [app/](app/) |
| The plan: decisions, features, research, progress | [kona-space-app.md](kona-space-app.md) |
| The look: rules, colours, parts (partly out of date, see its first lines) | [docs/DESIGN.md](docs/DESIGN.md) |
| The pixel art: cats, the office, frames, the logo, and the scripts that draw them | `art/` ([art/README.md](art/README.md)) |
| What was checked, measured and left open | [docs/AUDIT.md](docs/AUDIT.md) |
| Security reports | [SECURITY.md](SECURITY.md) |
| What was learned building the office, roles and workflows, and how to tackle it next time | [docs/LESSONS.md](docs/LESSONS.md) |
| How a version is published and how installed copies update | [docs/RELEASING.md](docs/RELEASING.md) |
| How versions are numbered | [docs/VERSIONING.md](docs/VERSIONING.md), [CHANGELOG.md](CHANGELOG.md) |
| Rules for an AI agent working in this folder | [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) |

## Your data

Kona keeps its own data on your PC: `%APPDATA%\Kona` (projects, accounts, the voice, the cost ledger) and a hidden `.kona` folder inside each project you add (tickets), which Kona tells Git to ignore. Nothing leaves your PC except what Claude Code itself sends to Anthropic, and the update check (one request to GitHub for a small file, which you can turn off). Kona never stores a login or a key; each account is a folder that Claude Code owns.

## License

[MIT](LICENSE). Use it, change it, share it; there is no warranty. Security reports: see [SECURITY.md](SECURITY.md).
