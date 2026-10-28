# Releasing Kona (and how installed copies update)

Installed copies of Kona look for a new version by themselves. This is how a version gets to them.

## How an update works

1. A few seconds after Kona starts (if Settings, Updates is on, and there is a connection), it downloads one small file: `https://github.com/BergasBintang/kona-space/releases/latest/download/latest.json`. It sends nothing about the person. Offline or any failure: it says nothing.
2. If `latest.json` names a newer version, Kona shows a card: "Kona x.y.z is ready", with **Update and restart** and **Later**. Nothing starts without a yes. If sessions are running the card says they will be closed.
3. On yes it downloads the installer named in the file, checks its signature against the public key built into Kona (`tauri.conf.json`, `plugins.updater.pubkey`), runs the installer (a progress window, no questions) and starts Kona again.
4. A file that is not signed by the Kona key is refused, so a changed `latest.json` or a replaced installer cannot install anything.

Settings, Updates also has **Check now**.

## The signing key

- The private key is `%USERPROFILE%\.kona-signing\kona-updater.key` (made on 2026-10-28). It is never in this folder, and no note, chat or commit may contain it. It has **no password** (so a build can run unattended); the folder is readable only by the Windows user, SYSTEM and administrators.
- **Back it up** somewhere private (not the repo, not a public place). If it is lost, installed copies can never be updated again: they would have to be reinstalled by hand with a new key. If it leaks, someone can send fake updates: make a new key, put the new public key in `tauri.conf.json`, and ask people to reinstall.
- The public key is not secret. It is in `tauri.conf.json`.
- `KONA_SIGNING_KEY` (a path) and `KONA_SIGNING_PASSWORD` can point the build at another key.

## Publishing a version

1. Make the change, bump the version in the usual way (`docs/VERSIONING.md`: `VERSION`, `app/package.json`, `Cargo.toml`, `tauri.conf.json`, `CHANGELOG.md`), commit and push, and tag `vX.Y.Z`.
2. `cd app` then `npm run release`. It builds the installer and signs it. It writes three files into `app/src-tauri/target/release/bundle/nsis/`:
   `Kona_X.Y.Z_x64-setup.exe`, `Kona_X.Y.Z_x64-setup.exe.sig` and `latest.json`. The first lines of the version's `CHANGELOG.md` entry become the notes on the update card.
3. Push the commit and the tag: `git push origin main vX.Y.Z`.
4. `npm run publish-release`. It checks that the three files match this version, that the tag is on GitHub, that the program's code (`app/src`, `app/src-tauri`) is exactly what the tag holds, and that no release of that version exists yet. It shows what it will publish, asks, and then creates a normal, latest release `vX.Y.Z` with the three files and the changelog entry as its text. It uses GitHub's command-line tool (`gh`, signed in once with `gh auth login`; it is found on the PATH, at `KONA_GH`, or in `D:\toolchain\gh\bin`).
   By hand instead: on GitHub, Releases, Draft a new release, choose the tag, attach the **three files**, and publish. It must be a normal release (not a draft or a pre-release): `releases/latest` only finds the newest published normal release.
5. Check: on a machine with an older Kona, Settings, Updates, **Check now**.

Notes:
- The `.exe` file name in `latest.json` must match the attached file exactly. The script writes it for you.
- `latest.json` must be attached to every release: the address above always points at the newest one.
- Turning on "release immutability" in the repository settings stops a published release's files from being changed afterwards. It is a good idea for this.
- Only Windows (x64) is published.
- An installed copy older than the first release that contains the updater (0.19.0) has no update check and must be reinstalled once by hand.
