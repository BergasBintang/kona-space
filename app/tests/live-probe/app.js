// Real browser behaviour a drawn mockup cannot have: local storage that survives a page change, a form that is sent, a write through fetch.
// It also answers the test's questions (the test cannot reach into this page, which lives on another address).
(function () {
  var v = document.getElementById("visits");
  var n = 0;
  try { n = Number(localStorage.getItem("visits") || 0) + 1; localStorage.setItem("visits", String(n)); } catch (e) { n = -1; }
  if (v) v.textContent = "visits " + n;
  var s = document.getElementById("store");
  if (s) s.textContent = "storage " + n;
  var add = document.getElementById("add");
  if (add) add.addEventListener("click", function () {
    fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Note " + Date.now() }) }).then(function () { location.reload(); });
  });
  // things a real program asks of the browser; each reports what happened to the test, which clicks the button with a real mouse (several need a click to be allowed at all)
  function cap(name, v) { parent.postMessage({ probe: "cap", name: name, result: v }, "*"); }
  function on(id, fn) { var e = document.getElementById(id); if (e) e.addEventListener("click", fn); }
  on("c-copy", function () { try { navigator.clipboard.writeText("copied").then(function () { cap("copy", "ALLOWED"); }, function (x) { cap("copy", "refused " + x.name); }); } catch (x) { cap("copy", "error " + x.name); } });
  on("c-popup", function () { try { var w = window.open("/up"); cap("popup", w ? "OPENED" : "refused"); if (w) setTimeout(function () { try { w.close(); } catch (x) {} }, 500); } catch (x) { cap("popup", "error " + x.name); } });
  on("c-dl", function () { try { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["x"])); a.download = "probe.txt"; document.body.appendChild(a); a.click(); a.remove(); cap("download", "clicked"); } catch (x) { cap("download", "error " + x.name); } });
  on("c-alert", function () { try { var r = alert("probe"); cap("alert", "returned " + String(r)); } catch (x) { cap("alert", "error " + x.name); } });
  on("c-confirm", function () { try { var r = confirm("probe"); cap("confirm", "returned " + String(r)); } catch (x) { cap("confirm", "error " + x.name); } });
  on("c-prompt", function () { try { var r = prompt("probe", "dflt"); cap("prompt", "returned " + String(r)); } catch (x) { cap("prompt", "error " + x.name); } });
  on("c-print", function () { try { window.print(); cap("print", "called"); } catch (x) { cap("print", "error " + x.name); } });
  // a program that asks "leave this page?" when it is left (many forms do): Kona's window cannot show that question, and a page waiting for its answer would stop for good, so Kona drops the listener
  addEventListener("beforeunload", function (e) { e.preventDefault(); e.returnValue = "x"; });
  window.onbeforeunload = function () { return "x"; };
  on("c-geo", function () { try { navigator.geolocation.getCurrentPosition(function (p) { cap("geo", "ALLOWED " + p.coords.latitude); }, function (x) { cap("geo", "refused code " + x.code); }, { timeout: 5000 }); } catch (x) { cap("geo", "error " + x.name); } });
  function rect(sel) { var e = document.querySelector(sel); if (!e) return null; var r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }
  function info() {
    var pulse = document.getElementById("pulse");
    return { probe: "info", w: innerWidth, h: innerHeight, narrow: matchMedia("(max-width: 480px)").matches, path: location.pathname + location.search, origin: location.origin, cookie: document.cookie, storage: n,
      who: (document.getElementById("who") || {}).textContent || null, rows: [].map.call(document.querySelectorAll("#rows li"), function (l) { return l.textContent; }), notes: document.querySelectorAll("#notes li").length,
      bg: getComputedStyle(document.body).backgroundColor, anim: pulse ? getComputedStyle(pulse).animationName : null, err: (document.getElementById("err") || {}).textContent || null,
      rects: { copy: rect("#c-copy"), popup: rect("#c-popup"), dl: rect("#c-dl"), alert: rect("#c-alert"), confirm: rect("#c-confirm"), prompt: rect("#c-prompt"), print: rect("#c-print"), geo: rect("#c-geo"), email: rect("input[name=email]"), password: rect("input[name=password]"), go: rect("#go"), add: rect("#add"), out: rect("#out"), who: rect("#who") } };
  }
  addEventListener("load", function () { parent.postMessage(info(), "*"); });
  addEventListener("message", function (e) {
    if (e.source !== parent || !e.data) return;
    if (e.data.probe === "ask") parent.postMessage(info(), "*");
    if (e.data.probe === "wire") {
      // the go-between under a big answer, an answer in pieces, a web socket and an answer that never ends (the last one is asked for separately: it takes a minute)
      var out = { probe: "wire" };
      var t0 = Date.now();
      fetch("/big?mb=40").then(function (r) { return r.arrayBuffer().then(function (b) { out.big = [r.status, b.byteLength, Date.now() - t0]; }); }).catch(function (x) { out.big = "error " + x.name; })
        .then(function () { var t1 = Date.now(), seen = []; return fetch("/chunks").then(function (r) { return r.text().then(function (t) { out.chunks = [r.status, t.split(String.fromCharCode(10)).filter(Boolean).length, Date.now() - t1]; }); }); }).catch(function (x) { out.chunks = "error " + x.name; })
        .then(function () { return new Promise(function (res) { var t2 = Date.now(), done = false; try { var ws = new WebSocket("ws://" + location.host + "/ws"); ws.onopen = function () { if (!done) { done = true; out.ws = "OPENED"; res(); } }; ws.onerror = function () { if (!done) { done = true; out.ws = "refused after " + (Date.now() - t2) + " ms"; res(); } }; setTimeout(function () { if (!done) { done = true; out.ws = "no answer in 8 s"; res(); } }, 8000); } catch (x) { out.ws = "error " + x.name; res(); } }); })
        .then(function () { parent.postMessage(out, "*"); });
    }
    if (e.data.probe === "endless") {
      var t3 = Date.now(), ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 180000);
      fetch("/endless", { signal: ctl.signal }).then(function (r) { return r.text().then(function (t) { clearTimeout(timer); parent.postMessage({ probe: "endless", status: r.status, ms: Date.now() - t3, text: t.slice(0, 80) }, "*"); }); }).catch(function (x) { clearTimeout(timer); parent.postMessage({ probe: "endless", error: x.name, ms: Date.now() - t3 }, "*"); });
    }
    if (e.data.probe === "escape") {
      // what a hostile page could try: reach the window around it, and the program's own commands
      var out = { probe: "escape", dom: null, tauri: null, ipc: null };
      try { out.dom = String(parent.document.title); } catch (x) { out.dom = "blocked: " + x.name; }
      try { out.tauri = typeof parent.__TAURI_INTERNALS__; } catch (x) { out.tauri = "blocked: " + x.name; }
      fetch("http://ipc.localhost/mock_base", { method: "POST", headers: { "Content-Type": "application/json", "Tauri-Callback": "1", "Tauri-Error": "2", "Tauri-Invoke-Key": "guess" }, body: "{}" })
        .then(function (r) { return r.text().then(function (t) { out.ipc = "status " + r.status + " " + t.slice(0, 60); }); })
        .catch(function (x) { out.ipc = "blocked: " + x.name; })
        .then(function () { parent.postMessage(out, "*"); });
    }
  });
})();
