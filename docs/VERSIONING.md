# How Kona names its versions

A version is a number you can read, never a code like `a3f9c2e`. Git keeps a long code for every save underneath. Kona never uses it as a name.

## The number

`MAJOR.MINOR.PATCH`, for example `0.1.0`.

- **PATCH** (0.1.0 to 0.1.1): a fix. Nothing new to learn.
- **MINOR** (0.1.1 to 0.2.0): something new you can use.
- **MAJOR**: stays `0` until the owner says Kona is steady. `0.x` honestly means "not stable yet" (decision 14).

`0.0.x` is the time before the app runs: plan, design, spikes. The first app that opens a window and talks to Claude is `0.1.0`.

## Where the number lives

One place decides it: the file `VERSION` at the top of this folder, once it exists. The app's own files (`package.json`, the Tauri settings) copy it. A version change is one commit that changes all of them together.

## How a version is marked

1. Add a section at the top of `CHANGELOG.md`: the number, the date, and what changed in plain words.
2. Commit it with a message like `Kona 0.1.0: first session runs`.
3. Mark that commit with a tag named `v0.1.0`: `git tag -a v0.1.0 -m "Kona 0.1.0"`.
4. On GitHub, a release called **Kona 0.1.0** points at that tag, and its text is the changelog section.

To see what version a folder is on: `git describe --tags`. Right on a version it prints `v0.1.0`. Between versions it adds the count of saves since, for example `v0.1.0-4-g…`. That is a work in progress, not a version.

## Plain commit messages

Start with what changed, in words anyone can read: `Add the cost ledger`, `Fix the plan bar rounding`. Not `update`, not `wip`. Branch names say the job: `fix/login-redirect`, `feat/brain-map`.

## Not done yet

Nothing is pushed anywhere. There is no GitHub repository yet. When there is one, push the tags too (`git push --tags`).
