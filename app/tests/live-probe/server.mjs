// A tiny program for the Live mockup test (decision 94): a made-up school login with four roles, a session cookie, a form that is sent, a redirect with the program's own
// address in it, absolute asset paths, a data page read from a SQLite file, a write through fetch, and local storage. It is what a real project looks like to Kona: a program that
// listens on a port. It starts with `node server.mjs` in this folder, after `node seed.mjs` made the demo database.
import { DatabaseSync } from "node:sqlite";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";

const PORT = Number(process.env.KONA_LIVE_PORT ?? 8099);
const db = new DatabaseSync(process.env.DEMO_DB ?? "demo.db");
const sessions = new Map();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cookies = (req) => Object.fromEntries((req.headers.cookie ?? "").split(";").map((p) => p.trim().split("=")).filter((p) => p[0]));
const body = (req) => new Promise((res) => { const b = []; req.on("data", (d) => b.push(d)); req.on("end", () => res(Buffer.concat(b).toString())); });
const page = (title, inner) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="/assets/app.css"></head><body><main data-part="main">${inner}</main><script src="/assets/app.js"></script></body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const me = sessions.get(cookies(req).sid);
  const send = (status, type, text, extra = {}) => { res.writeHead(status, { "Content-Type": type, ...extra }); res.end(text); };
  if (url.pathname === "/assets/app.css") return send(200, "text/css", fs.readFileSync(new URL("./app.css", import.meta.url)));
  if (url.pathname === "/assets/app.js") return send(200, "text/javascript", fs.readFileSync(new URL("./app.js", import.meta.url)));
  if (url.pathname === "/up") return send(200, "text/plain", "up");
  // what a real program may do that a drawn page cannot: a big answer, an answer in pieces, an answer that never ends
  if (url.pathname === "/big") {
    const mb = Number(url.searchParams.get("mb") ?? 1);
    const chunk = Buffer.alloc(1024 * 1024, 97);
    res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": mb * 1024 * 1024 });
    let i = 0;
    const next = () => { while (i < mb) { i++; if (!res.write(chunk)) return res.once("drain", next); } res.end(); };
    return next();
  }
  if (url.pathname === "/chunks") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    let i = 0;
    const t = setInterval(() => { res.write(`piece ${++i}\n`); if (i === 6) { clearInterval(t); res.end("end\n"); } }, 400);
    return;
  }
  if (url.pathname === "/endless") {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const t = setInterval(() => res.write("data: tick\n\n"), 1000);
    req.on("close", () => clearInterval(t));
    return;
  }
  if (url.pathname === "/login" && req.method === "GET") {
    return send(200, "text/html; charset=utf-8", page("Sign in", `<h1>Sign in</h1><form id="f" action="/login" method="post"><input name="email" placeholder="Email"><input name="password" type="password" placeholder="Password"><button id="go">Sign in</button></form><p id="err">${url.searchParams.get("error") ? "Wrong email or password." : ""}</p><p class="visits" id="visits"></p>`));
  }
  if (url.pathname === "/login" && req.method === "POST") {
    // like a framework that checks where a form came from: it must be the program's own address
    if (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${PORT}`) return send(403, "text/plain", "Wrong origin " + req.headers.origin);
    const f = new URLSearchParams(await body(req));
    const u = db.prepare("SELECT id, name, role FROM users WHERE email = ? AND password = ?").get(f.get("email"), f.get("password"));
    if (!u) return send(302, "text/plain", "", { Location: `http://127.0.0.1:${PORT}/login?error=1` });
    const sid = crypto.randomBytes(8).toString("hex");
    sessions.set(sid, u);
    return send(302, "text/plain", "", { Location: `http://127.0.0.1:${PORT}/dashboard`, "Set-Cookie": [`sid=${sid}; Path=/; HttpOnly; Domain=127.0.0.1`, "seen=1; Path=/"] });
  }
  if (url.pathname === "/logout") { sessions.delete(cookies(req).sid); return send(302, "text/plain", "", { Location: "/login", "Set-Cookie": "sid=; Path=/; Max-Age=0" }); }
  if (!me) return send(302, "text/plain", "", { Location: "/login" });
  if (url.pathname === "/") return send(302, "text/plain", "", { Location: "/dashboard" });
  if (url.pathname === "/api/me") return send(200, "application/json", JSON.stringify(me));
  if (url.pathname === "/api/notes" && req.method === "POST") {
    const t = JSON.parse((await body(req)) || "{}").text;
    db.prepare("INSERT INTO notes (user_id, text) VALUES (?, ?)").run(me.id, String(t ?? "").slice(0, 200));
    return send(200, "application/json", JSON.stringify({ ok: true }));
  }
  if (url.pathname === "/dashboard") {
    const rows = me.role === "admin" ? db.prepare("SELECT name, role FROM users ORDER BY id").all().map((r) => `${r.name} (${r.role})`)
      : me.role === "teacher" ? db.prepare("SELECT title FROM classes").all().map((r) => r.title)
      : me.role === "student" ? db.prepare("SELECT c.title || ': ' || g.score AS t FROM grades g JOIN classes c ON c.id = g.class_id WHERE g.user_id = ?").all(me.id).map((r) => r.t)
      : db.prepare("SELECT u.name AS t FROM users u WHERE u.id = (SELECT child_id FROM parents WHERE parent_id = ?)").all(me.id).map((r) => `Child: ${r.t}`);
    const notes = db.prepare("SELECT text FROM notes WHERE user_id = ? ORDER BY id").all(me.id).map((r) => `<li>${esc(r.text)}</li>`).join("");
    return send(200, "text/html; charset=utf-8", page("Dashboard", `<h1 id="who">${esc(me.name)} · ${esc(me.role)}</h1><ul id="rows">${rows.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><a id="self" href="http://127.0.0.1:${PORT}/dashboard">Reload</a> <a id="out" href="/logout">Sign out</a><h2>Notes</h2><ul id="notes">${notes}</ul><button id="add" type="button">Add a note</button><div class="pulse" id="pulse"></div><p id="store"></p><p class="caps"><button id="c-copy" type="button">copy</button> <button id="c-popup" type="button">popup</button> <button id="c-dl" type="button">download</button> <button id="c-alert" type="button">alert</button> <button id="c-confirm" type="button">confirm</button> <button id="c-prompt" type="button">prompt</button> <button id="c-print" type="button">print</button> <button id="c-geo" type="button">where</button></p>`));
  }
  send(404, "text/plain", "Not found");
});
// a web socket: the program says yes (101), which the go-between cannot pass on
server.on("upgrade", (req, socket) => { socket.end("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"); });
server.listen(PORT, "127.0.0.1", () => console.log(`probe program listening on ${PORT}`));
