// Publishes the version in package.json as a GitHub release, with the three files that installed copies of Kona need.
//   npm run publish-release            (in the app folder, after npm run release, the commit pushed and the tag pushed)
//   npm run publish-release -- --yes   skip the question (for a run that has no keyboard)
// It uses GitHub's command-line tool (gh), signed in once with `gh auth login`. It looks for gh on the PATH, then at KONA_GH, then in
// D:\toolchain\gh\bin. It checks everything first and asks before it publishes: with "release immutability" on, a published release cannot be
// changed, so a wrong file means a new version number.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(APP, '..');
const REPO = 'BergasBintang/kona-space';
const version = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
const tag = `v${version}`;
const dir = path.join(APP, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const exe = `Kona_${version}_x64-setup.exe`;
const files = [exe, `${exe}.sig`, 'latest.json'].map((f) => path.join(dir, f));

const stop = (why) => { console.error(`\nNot published. ${why}`); process.exit(1); };
const out = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT, ...opts });

const gh = [process.env.KONA_GH, 'gh', 'D:\\toolchain\\gh\\bin\\gh.exe'].filter(Boolean).find((c) => out(c, ['--version']).status === 0);
if (!gh) stop('GitHub\'s command-line tool (gh) was not found. See docs/RELEASING.md.');
if (out(gh, ['auth', 'status']).status !== 0) stop('gh is not signed in. Run: gh auth login');

for (const f of files) if (!fs.existsSync(f)) stop(`${path.basename(f)} is missing in ${dir}. Run npm run release first.`);
const latest = JSON.parse(fs.readFileSync(files[2], 'utf8'));
if (latest.version !== version) stop(`latest.json says ${latest.version}, but this is version ${version}. Run npm run release again.`);
if (!latest.platforms?.['windows-x86_64']?.url.endsWith(`/${tag}/${exe}`)) stop('latest.json does not point at this release\'s installer.');

// the tag must be on GitHub, and the program's own code (app/src and app/src-tauri) must be exactly what the tag holds, so the installer matches it.
// Notes, scripts and docs may have moved on since.
const code = ['app/src', 'app/src-tauri'];
if (out('git', ['status', '--porcelain', '--', ...code]).stdout.trim()) stop('The program\'s code has uncommitted changes. Commit them first, so the release matches the code.');
const local = out('git', ['rev-list', '-n', '1', tag]).stdout.trim();
// an annotated tag (git tag -a, as docs/VERSIONING.md says) lists itself and, with ^{}, the commit it points to; a plain tag lists only the commit
const refs = out('git', ['ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`]).stdout.trim().split('\n').filter(Boolean).map((l) => l.split(/\s+/));
const remote = (refs.find((r) => r[1]?.endsWith('^{}')) ?? refs[0] ?? [])[0];
if (!local) stop(`The tag ${tag} does not exist here. Run the release steps in docs/RELEASING.md first.`);
if (local !== remote) stop(`The tag ${tag} is not on GitHub yet (or points elsewhere). Run: git push origin main ${tag}`);
if (out('git', ['diff', '--name-only', tag, 'HEAD', '--', ...code]).stdout.trim()) stop(`The program's code has changed since ${tag}, so the installer would not match it. Make a new version.`);
if (out(gh, ['release', 'view', tag, '--repo', REPO]).status === 0) stop(`A release ${tag} already exists. A published release cannot be changed; make a new version.`);

// the release text: this version's entry in CHANGELOG.md
const log = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');
const at = log.indexOf(`## ${version}`);
if (at < 0) stop(`CHANGELOG.md has no entry for ${version}.`);
const end = log.indexOf('\n## ', at + 3);
const body = log.slice(at, end < 0 ? undefined : end).split('\n').slice(1).join('\n').trim();

console.log(`\nAbout to publish ${tag} to ${REPO} as a normal, latest release:`);
for (const f of files) console.log(`  ${path.basename(f)}  (${fs.statSync(f).size} bytes)`);
console.log(`\n${body}\n`);
if (!process.argv.includes('--yes')) {
  if (!process.stdin.isTTY) stop('No keyboard to ask on. Run it in a terminal, or add --yes.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Publish it now? A published release cannot be changed. (y/N) ')).trim().toLowerCase();
  rl.close();
  if (answer !== 'y' && answer !== 'yes') stop('You answered no.');
}

const notesFile = path.join(dir, 'release-notes.md');
fs.writeFileSync(notesFile, body + '\n');
const made = spawnSync(gh, ['release', 'create', tag, ...files, '--repo', REPO, '--verify-tag', '--title', `Kona ${version}`, '--notes-file', notesFile, '--latest'], { stdio: 'inherit' });
fs.rmSync(notesFile, { force: true });
if (made.status !== 0) stop('gh could not create the release. Check on GitHub whether a draft was left behind.');
console.log(`\nPublished: https://github.com/${REPO}/releases/tag/${tag}`);
