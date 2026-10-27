// Tiny Chrome DevTools Protocol client for driving Kona's window in tests (WebView2 test port 9223, this PC only).
import fs from 'node:fs';
export async function attach(port = 9223) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find((p) => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };
  const shot = async (file) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (js, ms = 60000, step = 500) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(js)) return true; await sleep(step); } return false; };
  return { send, ev, shot, sleep, waitFor, close: () => ws.close() };
}
