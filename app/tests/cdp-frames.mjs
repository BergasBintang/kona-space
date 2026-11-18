// Reaching INTO a frame of Kona's window over the DevTools port. A Live mockup's page is on another address than Kona's window, so the browser may keep it in a process of its own
// (an "iframe target"); this talks to it directly: run a script in it, listen to its console and its network, and click and type in it. Used by the tests of the Live mockups.
export async function attachFrames(port = 9223) {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) for (const l of listeners) l(d); };
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const downloads = [];
  const hosts = new Set(); // every address any frame asked for, over the whole run
  listeners.push((d) => { if (d.method === "Network.requestWillBeSent") { try { hosts.add(new URL(d.params.request.url).host); } catch { /* not an address */ } } });
  listeners.push((d) => { if (/downloadWillBegin$/.test(d.method)) downloads.push({ url: d.params?.url, name: d.params?.suggestedFilename }); });
  const targets = async () => (await send("Target.getTargets")).result?.targetInfos ?? [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** the frame whose address starts with `prefix`, attached; null when the browser keeps it inside the window's own process */
  const frame = async (prefix, waitMs = 15000) => {
    // the browser makes the frame's own target a moment after the frame appears: look for it for a while, and take the newest one (a frame that was just closed may still be listed for a moment)
    let t = null;
    for (const t0 = Date.now(); Date.now() - t0 < waitMs; await sleep(300)) { t = (await targets()).filter((x) => x.url.startsWith(prefix) && x.type === "iframe").pop() ?? null; if (t) break; }
    if (!t) return null;
    const { result } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    const sid = result.sessionId;
    const events = { console: [], errors: [], requests: new Map(), failed: [], dialogs: [] };
    listeners.push((d) => {
      if (d.sessionId !== sid) return;
      const p = d.params;
      // a dialog the page opens (alert, confirm, prompt) is answered at once, so a test never waits for a person
      if (d.method === "Page.javascriptDialogOpening") { events.dialogs.push({ type: p.type, message: String(p.message).slice(0, 60) }); void send("Page.handleJavaScriptDialog", { accept: true }, sid); return; }
      if (d.method === "Runtime.consoleAPICalled") events.console.push({ type: p.type, text: (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300) });
      else if (d.method === "Runtime.exceptionThrown") events.errors.push((p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "").slice(0, 400));
      else if (d.method === "Network.requestWillBeSent") events.requests.set(p.requestId, { url: p.request.url, method: p.request.method, type: p.type });
      else if (d.method === "Network.responseReceived") { const r = events.requests.get(p.requestId); if (r) { r.status = p.response.status; r.mime = p.response.mimeType; r.fromSW = p.response.fromServiceWorker; } }
      else if (d.method === "Network.loadingFailed") { const r = events.requests.get(p.requestId); events.failed.push({ url: r?.url, error: p.errorText, canceled: p.canceled }); }
    });
    for (const m of ["Runtime.enable", "Network.enable", "Page.enable", "Log.enable"]) await send(m, {}, sid);
    const ev = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sid);
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result?.result?.value;
    };
    const waitFor = async (js, ms = 20000, step = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(js)) return true; } catch { /* the page is loading */ } await sleep(step); } return false; };
    return { sid, ev, waitFor, send: (m, p) => send(m, p, sid), events, info: t, reset: () => { events.dialogs.length = 0; events.console.length = 0; events.errors.length = 0; events.requests.clear(); events.failed.length = 0; } };
  };
  return { send, targets, frame, sleep, downloads, hosts, close: () => ws.close() };
}
