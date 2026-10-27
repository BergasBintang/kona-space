# Changelog

Newest first. How versions are named: `docs/VERSIONING.md`.

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
