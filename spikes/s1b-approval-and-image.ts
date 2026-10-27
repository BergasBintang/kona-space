// Spike S1b: does the approve-or-deny card work, and does an image go through?
// One persistent `claude` in streaming mode, permission mode "default" so that a command needs approval.
//   turn 1: ask it to run a harmless command  -> expect a control_request; we answer allow
//   turn 2: ask it to run another one          -> expect a control_request; we answer deny
//   turn 3: send a small red picture           -> expect it to say red
//   node spikes/s1b-approval-and-image.ts <throwaway working folder>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';

const cwd = resolve(process.argv[2] ?? '');
if (!process.argv[2]) { console.error('give a throwaway folder'); process.exit(1); }
mkdirSync(cwd, { recursive: true });
writeFileSync(join(cwd, 'hello.txt'), 'hello from the spike\n');
const CLAUDE = 'C:/Program Files/nodejs/node_modules/@anthropic-ai/claude-code/bin/claude.exe';
const args = ['-p', '--output-format', 'stream-json', '--input-format', 'stream-json', '--include-partial-messages', '--verbose',
  '--permission-prompt-tool', 'stdio', '--permission-mode', 'default', '--model', 'haiku', '--session-id', randomUUID()];

// a 16 by 16 red PNG, made here so nothing has to be downloaded
function redPng(): string {
  const crc = (buf: Buffer) => { let c, crc = ~0; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; };
  const chunk = (type: string, data: Buffer) => { const t = Buffer.concat([Buffer.from(type), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(t)); return Buffer.concat([len, t, c]); };
  const w = 16, h = 16, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 220; raw[o + 1] = 20; raw[o + 2] = 20; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

const t0 = Date.now();
const ms = () => `${String(Date.now() - t0).padStart(6)} ms`;
const child = spawn(CLAUDE, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
const decide: Array<'allow' | 'deny'> = ['allow', 'deny'];
let asked = 0, buf = '';
const waiters: Array<() => void> = [];
const send = (content: any[]) => child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
const nextResult = (limit: number) => new Promise<boolean>((res) => { const t = setTimeout(() => res(false), limit); waiters.push(() => { clearTimeout(t); res(true); }); });

function handle(line: string) {
  let r: any; try { r = JSON.parse(line); } catch { return; }
  if (r.type === 'control_request') {
    const verdict = decide[asked++] ?? 'deny';
    console.log(`${ms()}  CONTROL REQUEST ${JSON.stringify(r)}`);
    const body = verdict === 'allow'
      ? { behavior: 'allow', updatedInput: r.request?.input ?? {} }
      : { behavior: 'deny', message: 'The owner said no.' };
    const reply = { type: 'control_response', response: { subtype: 'success', request_id: r.request_id, response: body } };
    console.log(`${ms()}  we answer ${verdict}: ${JSON.stringify(reply)}`);
    child.stdin.write(JSON.stringify(reply) + '\n');
  } else if (r.type === 'assistant') {
    for (const c of r.message?.content ?? []) {
      if (c.type === 'text') console.log(`${ms()}  assistant text: ${c.text.slice(0, 300).replace(/\n/g, ' ')}`);
      if (c.type === 'tool_use') console.log(`${ms()}  assistant wants tool ${c.name} ${JSON.stringify(c.input).slice(0, 200)}`);
    }
  } else if (r.type === 'user') {
    for (const c of r.message?.content ?? []) if (c.type === 'tool_result') console.log(`${ms()}  tool result (is_error ${c.is_error}): ${JSON.stringify(c.content).slice(0, 200)}`);
  } else if (r.type === 'result') {
    console.log(`${ms()}  result ${r.subtype}: cost ${r.total_cost_usd}, denials ${JSON.stringify(r.permission_denials)?.slice(0, 300)}`);
    waiters.splice(0).forEach((w) => w());
  } else if (r.type !== 'stream_event' && r.type !== 'system' && r.type !== 'rate_limit_event') console.log(`${ms()}  other ${r.type}: ${line.slice(0, 200)}`);
}
child.stdout.on('data', (d) => { buf += d.toString('utf8'); let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) handle(l); } });
child.stderr.on('data', (d) => console.log(`${ms()}  stderr: ${d.toString().trim().slice(0, 200)}`));

const text = (t: string) => [{ type: 'text', text: t }];
console.log('turn 1: allow'); send(text('Use the Bash tool to run exactly this command: touch made-by-spike.txt'));
console.log('turn 1 finished:', await nextResult(90_000));
console.log('turn 2: deny'); send(text('Now use the Bash tool to run exactly this command: rm hello.txt'));
console.log('turn 2 finished:', await nextResult(90_000));
console.log('turn 3: image'); send([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: redPng() } }, { type: 'text', text: 'What single colour is this picture? One word.' }]);
console.log('turn 3 finished:', await nextResult(90_000));
child.stdin.end();
await new Promise((r) => setTimeout(r, 2500));
if (child.exitCode === null) child.kill();
console.log(`exit code ${child.exitCode}`);
