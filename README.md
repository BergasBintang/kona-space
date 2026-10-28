# Kona

A desktop workspace for [Claude Code](https://claude.com/claude-code), for Windows. One window to start Claude Code sessions per project, browse the project's files, give each session a role, keep track of what it costs, and run a small board of tickets that Claude can read and update itself.

Kona is a personal project, made by one person for their own PC. It is early (see `VERSION`), it changes often, and nothing is promised.

## What works today

- **Projects and files:** add a project (a folder), browse it, read files (text, JSON, markdown, pictures, PDFs). Read-only.
- **Sessions:** chat with Claude Code per project, see each step, approve or refuse each command or file change (or always allow one here), paste pictures, resume an earlier session. At most two run at once by default.
- **Roles:** ten starting roles (Product, Design, Frontend, Backend, QA, Security, DevOps, Marketing, Content and SEO, Support), each with a model, a permission mode and a short brief. You can change them and add your own.
- **Accounts:** two or more Claude logins, chosen per session.
- **Costs:** what sessions cost in dollars (an estimate at list price, not a bill), by project, role, ticket, account, model, day or session.
- **Needs check:** which local tools (Git, Node, PHP, Docker and so on) a role or project needs, and which are missing. It only looks; it never installs.
- **Voice:** how Claude talks to you in chat, set once.
- **Board:** tickets as plain files in the project, five columns, and a built-in tool server so Claude can raise and update tickets (never move one to Done).
- **Worktrees:** a ticket's session can work in its own copy of the repo on its own branch. A page shows every copy (ahead and behind, files changed, a conflict preview) and merges or removes one after you confirm.
- **Leftovers:** the programs a session started (dev servers) and which are still running after it ended, with their ports; stop one after a confirmation. Claude's scratch files per session.
- **Brain:** a graph of linked notes: your own notes, Claude's memory for the project (read-only) and starter notes about working with agents. Ask it a question and it says plainly whether the answer is found, partly there, or not in the brain. A session that ends writes a short note, and Claude can search the brain itself.
- **Servers:** the servers a project may reach, kept as references (never a key). A role can run ssh, scp or sftp only to a server listed for it, and every such command still asks you.
- **Settings and backups:** the window size (100, 90 or 80%), the session limit, each project's GitHub address, and one-press backups of Kona's data, tickets and notes.

Not built yet: an installer, syntax colours in the file viewer, a voice per role.

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

## Where things are

| What | Where |
|---|---|
| The app (Rust core and React screen) | [app/](app/) |
| The plan: decisions, features, research, progress | [kona-space-app.md](kona-space-app.md) |
| The look: rules, colours, parts, screens | [docs/DESIGN.md](docs/DESIGN.md) and the previews in `docs/design/previews/` |
| The design file and the scripts that draw it in FigCraft | `docs/design/` ([docs/FIGCRAFT.md](docs/FIGCRAFT.md)) |
| What was checked, measured and left open | [docs/AUDIT.md](docs/AUDIT.md) |
| How versions are numbered | [docs/VERSIONING.md](docs/VERSIONING.md), [CHANGELOG.md](CHANGELOG.md) |
| Small throwaway tests of how Claude Code behaves | `spikes/` |
| Rules for an AI agent working in this folder | [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) |

## Your data

Kona keeps its own data on your PC: `%APPDATA%\Kona` (projects, roles, accounts, the voice, the cost ledger) and a hidden `.kona` folder inside each project you add (tickets), which Kona tells Git to ignore. Nothing leaves your PC except what Claude Code itself sends to Anthropic. Kona never stores a login or a key; each account is a folder that Claude Code owns.

## License

No license has been chosen yet, so all rights are reserved until one is added.
