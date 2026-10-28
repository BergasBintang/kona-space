# Security

Kona is a personal project made by one person. It runs on your own PC, starts Claude Code sessions, reads your project folders, and can install updates that it downloads from this repository's releases.

## Reporting a problem

Please use GitHub's private report: on the repository page, **Security**, then **Report a vulnerability**. Do not open a public issue for something that could be misused.

Things worth reporting: a way to make Kona run a command or read a file it should not, a way to get Kona to install an update that was not signed with its key, a secret that Kona writes somewhere it should not.

## What to expect

Reports are read when the owner can, with no promised time. There is no bounty.

## What Kona does and does not do

- It never stores a login or a key. Each Claude account is a folder that Claude Code owns.
- The only network request Kona makes by itself is the optional update check (one small file from this repository's latest release, nothing about you is sent). Everything else on the network is Claude Code's own.
- An update is installed only if it is signed with Kona's update key. More in [docs/RELEASING.md](docs/RELEASING.md).
