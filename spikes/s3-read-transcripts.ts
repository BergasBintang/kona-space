// Spike S3: can Kona list a project's sessions by reading the transcript files Claude Code leaves behind?
// Read only. It never prints message text, because transcripts can hold secrets: only ids, times, models and counts.
//   node spikes/s3-read-transcripts.ts [project folder name under ~/.claude/projects]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
type Session = {
  file: string;
  sessionId: string | null;
  cwd: string | null;
  first: string | null;
  last: string | null;
  models: Set<string>;
  types: Map<string, number>;
  usage: Usage;
  lines: number;
  badLines: number;
  bytes: number;
};

const root = join(homedir(), '.claude', 'projects');
const folder = process.argv[2] ?? 'd--kona-space';
const dir = join(root, folder);

function readSession(path: string): Session {
  const s: Session = {
    file: path.slice(dir.length + 1), sessionId: null, cwd: null, first: null, last: null,
    models: new Set(), types: new Map(), usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    lines: 0, badLines: 0, bytes: statSync(path).size,
  };
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    s.lines++;
    let r: any;
    try { r = JSON.parse(line); } catch { s.badLines++; continue; } // a tolerant reader skips what it cannot read
    const type = typeof r?.type === 'string' ? r.type : '(none)';
    s.types.set(type, (s.types.get(type) ?? 0) + 1);
    if (r.sessionId && !s.sessionId) s.sessionId = r.sessionId;
    if (r.cwd && !s.cwd) s.cwd = r.cwd;
    if (typeof r.timestamp === 'string') { s.first ??= r.timestamp; s.last = r.timestamp; }
    const m = r.message;
    if (m && typeof m === 'object') {
      if (typeof m.model === 'string') s.models.add(m.model);
      const u = m.usage;
      if (u && typeof u === 'object') {
        s.usage.input += u.input_tokens ?? 0;
        s.usage.output += u.output_tokens ?? 0;
        s.usage.cacheRead += u.cache_read_input_tokens ?? 0;
        s.usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
      }
    }
  }
  return s;
}

const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f));
console.log(`folder: ${dir}`);
console.log(`transcript files: ${files.length}\n`);
const sessions = files.map(readSession).sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''));
const allTypes = new Map<string, number>();
for (const s of sessions) {
  for (const [t, n] of s.types) allTypes.set(t, (allTypes.get(t) ?? 0) + n);
  console.log(`${s.sessionId ?? '(no id)'}  ${s.first?.slice(0, 16) ?? '?'} to ${s.last?.slice(0, 16) ?? '?'}  ${(s.bytes / 1024).toFixed(0)} KB  ${s.lines} lines (${s.badLines} unreadable)`);
  console.log(`    cwd ${s.cwd ?? '?'} | models ${[...s.models].join(', ') || '?'} | tokens in ${s.usage.input} out ${s.usage.output} cache read ${s.usage.cacheRead} write ${s.usage.cacheWrite}`);
}
console.log('\nrecord types seen across all sessions:');
for (const [t, n] of [...allTypes].sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${n}`);
