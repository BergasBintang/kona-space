// Spike S5: can Kona list worktrees and preview a merge conflict without touching any file?
// It builds a throwaway repo in the folder given as the first argument (must not exist yet), makes two worktrees
// with edits that clash, then reads them back with `git worktree list --porcelain` and `git merge-tree`.
//   node spikes/s5-worktrees.ts <new empty folder>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const base = resolve(process.argv[2] ?? '');
if (!process.argv[2] || existsSync(base)) { console.error('give a folder that does not exist yet'); process.exit(1); }
const main = join(base, 'main');
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const gitTry = (cwd: string, ...args: string[]) => { try { return { ok: true, out: git(cwd, ...args) }; } catch (e: any) { return { ok: false, out: String(e.stdout ?? ''), err: String(e.stderr ?? '') }; } };

mkdirSync(main, { recursive: true });
git(main, 'init', '-b', 'main');
git(main, 'config', 'user.email', 'spike');
git(main, 'config', 'user.name', 'spike');
writeFileSync(join(main, 'cart.php'), 'total = price * qty\nshipping = 5\n');
git(main, 'add', '.'); git(main, 'commit', '-m', 'start');
git(main, 'worktree', 'add', '-b', 'fix/rounding', join(base, 'wt-rounding'));
git(main, 'worktree', 'add', '-b', 'feat/free-shipping', join(base, 'wt-shipping'));
writeFileSync(join(base, 'wt-rounding', 'cart.php'), 'total = round(price * qty, 2)\nshipping = 5\n');
git(join(base, 'wt-rounding'), 'commit', '-am', 'round the total');
writeFileSync(join(base, 'wt-shipping', 'cart.php'), 'total = price * qty\nshipping = 0\n');
git(join(base, 'wt-shipping'), 'commit', '-am', 'free shipping');
writeFileSync(join(base, 'wt-shipping', 'notes.txt'), 'not committed yet\n'); // an uncommitted file

// 1. list worktrees
type Wt = { path: string; head?: string; branch?: string; bare?: boolean; detached?: boolean; locked?: boolean; prunable?: boolean };
const parse = (out: string): Wt[] => out.trim().split(/\r?\n\r?\n/).map((block) => {
  const w: Wt = { path: '' };
  for (const line of block.split(/\r?\n/)) {
    const [k, ...rest] = line.split(' '); const v = rest.join(' ');
    if (k === 'worktree') w.path = v; else if (k === 'HEAD') w.head = v; else if (k === 'branch') w.branch = v.replace('refs/heads/', '');
    else if (k === 'bare') w.bare = true; else if (k === 'detached') w.detached = true; else if (k === 'locked') w.locked = true; else if (k === 'prunable') w.prunable = true;
  }
  return w;
}).filter((w) => w.path);
const wts = parse(git(main, 'worktree', 'list', '--porcelain'));
console.log('worktrees:'); for (const w of wts) console.log(`  ${w.branch ?? '(detached)'}  ${w.path}`);

// 2. per worktree: uncommitted changes, ahead and behind main
for (const w of wts) {
  const dirty = git(w.path, 'status', '--porcelain').trim().split('\n').filter(Boolean).length;
  const [behind, ahead] = git(w.path, 'rev-list', '--left-right', '--count', 'main...HEAD').trim().split(/\s+/).map(Number);
  console.log(`  ${w.branch}: ${dirty} uncommitted, ${ahead} ahead, ${behind} behind main`);
}

// 3. conflict preview between the two branches, without touching a file or the index
const before = readFileSync(join(base, 'wt-shipping', 'cart.php'), 'utf8');
const mt = gitTry(main, 'merge-tree', '--write-tree', '--name-only', '--no-messages', 'fix/rounding', 'feat/free-shipping');
console.log(`\nmerge-tree exit: ${mt.ok ? '0 (clean merge)' : 'non-zero (conflicts)'}`);
console.log('merge-tree output (tree id, then the files in conflict):');
console.log(mt.out.trim().split('\n').map((l) => '  ' + l).join('\n'));
const mtClash = gitTry(main, 'merge-tree', '--write-tree', '--name-only', '--no-messages', 'main', 'fix/rounding');
console.log(`\nfix/rounding into main: ${mtClash.ok ? 'clean' : 'conflict'}`);
const untouched = readFileSync(join(base, 'wt-shipping', 'cart.php'), 'utf8') === before && git(join(base, 'wt-shipping'), 'status', '--porcelain').includes('notes.txt');
console.log(`worktree files untouched by the preview: ${untouched}`);
