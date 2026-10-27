// Minimal MCP client for FigCraft (stdio JSON-RPC to `figcraft-cli mcp --attach PORT`).
import { spawn } from 'node:child_process';

// where FigCraft's command line tool is; set FIGCRAFT_CLI if it is installed somewhere else
const CLI = process.env.FIGCRAFT_CLI ?? 'C:/Program Files/FigCraft/figcraft-cli.exe';

export async function connect(port = 7979) {
  const child = spawn(CLI, ['mcp', '--attach', String(port)], { stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '';
  let nextId = 0;
  const pending = new Map();
  child.stdout.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const m = JSON.parse(line);
        if (m.id != null && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      } catch { /* ignore non-JSON */ }
    }
  });
  const rpc = (method, params) => new Promise((res) => {
    const id = ++nextId; pending.set(id, res);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'kona-design', version: '0.1' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tool = async (name, args = {}) => {
    const r = await rpc('tools/call', { name, arguments: args });
    if (r.error) throw new Error(name + ': ' + JSON.stringify(r.error));
    const content = r.result?.content ?? [];
    const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    const images = content.filter((c) => c.type === 'image');
    if (r.result?.isError) throw new Error(name + ' failed: ' + text);
    let json = null;
    try { json = JSON.parse(text); } catch { /* plain text */ }
    return { text, json, images };
  };
  const run = (command, params = {}) => tool('run_command', { command, params });
  const close = () => { try { child.stdin.end(); child.kill(); } catch { /* done */ } };
  return { rpc, tool, run, close, init };
}
