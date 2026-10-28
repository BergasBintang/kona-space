// Builds the signed installer and the small file that tells installed copies of Kona there is a new version.
//   npm run release            (in the app folder)
// It signs with the private key in your user folder (default %USERPROFILE%\.kona-signing\kona-updater.key; set KONA_SIGNING_KEY to use another
// path). The key is never copied into the project and never printed. The result is in src-tauri/target/release/bundle/nsis:
//   Kona_<version>_x64-setup.exe   the installer (also what an update downloads)
//   Kona_<version>_x64-setup.exe.sig   its signature
//   latest.json                    what installed copies read; it goes on the same GitHub release
// `npm run publish-release` (tools/publish.mjs) then puts the three files on GitHub. The steps are in docs/RELEASING.md.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(APP, '..');
const REPO = 'BergasBintang/kona-space';
const version = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
const keyPath = process.env.KONA_SIGNING_KEY ?? path.join(os.homedir(), '.kona-signing', 'kona-updater.key');
if (!fs.existsSync(keyPath)) {
  console.error(`The signing key was not found at ${keyPath}. Without it an update cannot be signed. See docs/RELEASING.md.`);
  process.exit(1);
}

const run = spawnSync('npx', ['tauri', 'build'], {
  cwd: APP, stdio: 'inherit', shell: true,
  env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: keyPath, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.KONA_SIGNING_PASSWORD ?? '' },
});
if (run.status !== 0) process.exit(run.status ?? 1);

const dir = path.join(APP, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const exe = `Kona_${version}_x64-setup.exe`;
const sig = path.join(dir, exe + '.sig');
if (!fs.existsSync(path.join(dir, exe)) || !fs.existsSync(sig)) {
  console.error(`Expected ${exe} and its .sig in ${dir}; the build did not make them.`);
  process.exit(1);
}

// the notes shown on the update card: the first lines of this version's entry in CHANGELOG.md
const log = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');
const at = log.indexOf(`## ${version}`);
let notes = '';
if (at >= 0) {
  const end = log.indexOf('\n## ', at + 3);
  const body = log.slice(at, end < 0 ? undefined : end).split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  notes = body.slice(0, 3).map((l) => l.replace(/^- /, '').replace(/`/g, '')).join(' ');
  if (notes.length > 300) notes = notes.slice(0, 297) + '...';
}

const latest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: fs.readFileSync(sig, 'utf8').trim(),
      url: `https://github.com/${REPO}/releases/download/v${version}/${exe}`,
    },
  },
};
fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
console.log(`\nReady in ${dir}\n  ${exe}\n  ${exe}.sig\n  latest.json\nNext: push the commit and the tag v${version}, then run npm run publish-release (see docs/RELEASING.md).`);
