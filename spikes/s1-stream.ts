// Spike S1: can a program run `claude`, read its streamed messages, get tokens and cost, and ask for /usage?
// It starts one persistent `claude` in streaming mode in a throwaway folder, sends two messages ("ok" and "/usage"),
// and logs every record type it sees. It uses the cheapest model (haiku) and no tools. A few tokens of plan usage.
//   node spikes/s1-stream.ts <throwaway working folder>
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const cwd = resolve(process.argv[2] ?? '');
if (!process.argv[2]) { console.error('give a throwaway folder as the first argument'); process.exit(1); }
mkdirSync(cwd, { recursive: true });
const CLAUDE = 'C:/Program Files/nodejs/node_modules/@anthropic-ai/claude-code/bin/claude.exe';
const sessionId = randomUUID();
const args = ['-p', '--output-format', 'stream-json', '--input-format', 'stream-json', '--include-partial-messages', '--verbose',
  '--permission-prompt-tool', 'stdio', '--model', 'haiku', '--session-id', sessionId];

const t0 = Date.now();
const ms = () => `${String(Date.now() - t0).padStart(6)} ms`;
const child = spawn(CLAUDE, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
console.log(`started claude, pid ${child.pid}, session ${sessionId}`);
console.log(`command: claude ${args.join(' ')}\n`);

const counts = new Map<string, number>();
const results: any[] = [];
let usageReport: any = null;
let buf = '';
const waiters: Array<() => void> = [];
const send = (text: string) => child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }) + '\n');
const nextResult = (limitMs: number) => new Promise<boolean>((res) => {
  const timer = setTimeout(() => res(false), limitMs);
  waiters.push(() => { clearTimeout(timer); res(true); });
});

const keys = (o: any) => (o && typeof o === 'object' ? Object.keys(o).join(',') : '');
function handle(line: string) {
  let r: any;
  try { r = JSON.parse(line); } catch { console.log(`${ms()}  (not json) ${line.slice(0, 80)}`); return; }
  const kind = r.type + (r.subtype ? '/' + r.subtype : '');
  counts.set(kind, (counts.get(kind) ?? 0) + 1);
  if (r.type === 'stream_event') return; // the partial chunks: counted, not printed
  if (r.type === 'system' && r.subtype === 'init') console.log(`${ms()}  init: model ${r.model}, tools ${r.tools?.length}, mcp ${r.mcp_servers?.length}, permissionMode ${r.permissionMode}, keys ${keys(r)}`);
  else if (r.type === 'assistant') console.log(`${ms()}  assistant: model ${r.message?.model}, usage ${keys(r.message?.usage)}`);
  if (r.type === 'assistant' && r.message?.model === '<synthetic>') console.log('            synthetic message content: ' + JSON.stringify(r.message.content).slice(0, 1500));
  if (r.type === 'rate_limit_event') console.log('            rate_limit_info: ' + JSON.stringify(r.rate_limit_info));
  if (r.type === 'result' && r.local_command) console.log('            local_command: ' + JSON.stringify(r.local_command).slice(0, 300) + ' result: ' + JSON.stringify(r.result).slice(0, 1500));
  else if (r.type === 'result') {
    results.push(r);
    console.log(`${ms()}  result ${r.subtype}: cost ${r.total_cost_usd}, duration ${r.duration_ms} ms, turns ${r.num_turns}, error ${r.is_error}`);
    console.log(`            usage ${JSON.stringify(r.usage)}`);
    console.log(`            modelUsage ${JSON.stringify(r.modelUsage)}`);
    console.log(`            result keys ${keys(r)}`);
    if (typeof r.result === 'string' && r.result.length < 400) console.log(`            text: ${JSON.stringify(r.result)}`);
    waiters.splice(0).forEach((w) => w());
  } else console.log(`${ms()}  ${kind}: keys ${keys(r)}`);
  if (/usage_report|usage-report/.test(line)) usageReport = r;
}
child.stdout.on('data', (d) => { buf += d.toString('utf8'); let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) handle(l); } });
child.stderr.on('data', (d) => console.log(`${ms()}  stderr: ${d.toString().trim().slice(0, 200)}`));
child.on('exit', (c) => console.log(`${ms()}  exited with code ${c}`));

const rss = () => { try { return execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${child.pid}).WorkingSet64 / 1MB`], { encoding: 'utf8' }).trim(); } catch { return '?'; } };

console.log(`${ms()}  sending turn 1`);
send('Reply with the single word: ok');
const ok1 = await nextResult(90_000);
console.log(`${ms()}  turn 1 ${ok1 ? 'finished' : 'TIMED OUT'}; claude.exe working set about ${rss()} MB`);

console.log(`${ms()}  sending turn 2: /usage`);
send('/usage');
const ok2 = await nextResult(45_000);
console.log(`${ms()}  turn 2 ${ok2 ? 'finished' : 'did not produce a result within 45 s'}`);

child.stdin.end();
await new Promise((r) => setTimeout(r, 2500));
if (child.exitCode === null) { child.kill(); console.log('had to stop it'); }
console.log('\nrecord kinds seen:');
for (const [k, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);
console.log(`usage_report seen: ${usageReport ? 'yes ' + JSON.stringify(usageReport).slice(0, 600) : 'no'}`);
