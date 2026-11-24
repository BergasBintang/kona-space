// What the open conversations say about their tool servers reaches the board's tool server (decision 107), proven WITHOUT a conversation (no cost, no sign-in needed).
// Start the DEVELOPMENT window with the test port (see mcp-access.mjs), then: node tests/mcp-status-live.mjs
// It makes a throwaway project, has the REAL window save what two people's open conversations said (the command the window calls whenever a conversation changes), then starts the REAL
// board tool server (Kona's own program, as Claude Code starts it) and asks it list_connections and list_team. It checks the answers, that a person's own line is marked, that a
// project with no word from the window says so, and that a window that is gone is not believed. Afterwards it removes the project, its folder and the status file it caused.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const here = path.dirname(fileURLToPath(import.meta.url));
const exe = path.join(here, "..", "src-tauri", "target", "debug", "app.exe");
const base = path.join(process.env.APPDATA ?? "", "Kona");
const statusDir = path.join(base, "mcp-status");
const statusBefore = new Set(fs.existsSync(statusDir) ? fs.readdirSync(statusDir) : []);
const NAME = "kona-status-live";
const root = path.join(os.tmpdir(), `kona-status-${process.pid}`);
fs.mkdirSync(path.join(root, ".kona"), { recursive: true });
const probe = path.join(here, "mcp-probe", "fake-mcp.mjs").replace(/\\/g, "/");
fs.writeFileSync(path.join(root, ".mcp.json"), JSON.stringify({ mcpServers: { probe: { command: "node", args: [probe] }, playwright: { command: "node", args: [probe] } } }));
fs.writeFileSync(path.join(root, ".kona", "mcp-on.json"), JSON.stringify({ on: ["probe", "playwright"] }));
fs.writeFileSync(path.join(root, ".kona", "role-kits.json"), JSON.stringify({ frontend: { mcp: ["probe", "playwright"] }, backend: { mcp: ["probe"] } }));

/** Start the board's tool server for one session and ask it for one tool, the way Claude Code does. */
const ask = (role, session, tool) => new Promise((resolve, reject) => {
  const p = spawn(exe, ["--mcp-board", "--folder", root, "--session", session, "--role", role, "--ticket", "", "--base", base, "--account-dir", ""], { stdio: ["pipe", "pipe", "ignore"] });
  let out = "";
  const timer = setTimeout(() => { p.kill(); reject(new Error("the tool server did not answer")); }, 15000);
  p.stdout.on("data", (d) => {
    out += d;
    const line = out.split("\n").slice(0, -1).find((l) => /"id": ?2[,}]/.test(l)); // a whole line only: the last piece may still be arriving
    if (line) { clearTimeout(timer); p.kill(); try { resolve(JSON.parse(line).result.content[0].text); } catch (e) { reject(e); } }
  });
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } }) + "\n");
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: {} } }) + "\n");
});

let id = null;
try {
  const accounts = await invoke("list_accounts");
  id = (await invoke("add_project", { folder: root, name: NAME, account: accounts[0]?.id ?? null })).project.id;
  const connections = () => ask("backend", "abc12345-session", "list_connections");

  ok("before the window says anything, the answer says it is not known", (await connections()).includes("not known just now"));

  // what the window saves when two conversations are open: Jiro's has probe working and playwright failed, Kit has sent no message yet
  await invoke("mcp_status_save", { folder: root, people: [
    { role: "frontend", session: "s-jiro", servers: [{ name: "probe", status: "connected" }, { name: "playwright", status: "failed" }] },
    { role: "backend", session: "abc12345-session", servers: null },
  ] });
  const said = await connections();
  ok("Jiro's line says probe connected and playwright could not start", said.includes("Jiro the Frontend: connected") && said.includes("Jiro the Frontend: could not start it"), said.slice(0, 600));
  ok("Kit asks and is marked as the one asking, with nothing guessed", said.includes("Kit the Backend (you): not known yet"), said.slice(0, 600));
  const team = await ask("frontend", "s-jiro", "list_team");
  ok("list_team says it next to what each person may use", team.includes("probe (connected)") && team.includes("playwright (could not start it") && team.includes("probe (not known yet"), team.slice(0, 600));

  // the window says a new conversation began for Kit, and that Jiro's has ended
  await invoke("mcp_status_save", { folder: root, people: [{ role: "backend", session: "abc12345-session", servers: [{ name: "probe", status: "pending" }] }] });
  const later = await connections();
  ok("the answer follows the window: Kit is still starting, Jiro is no longer mentioned", later.includes("Kit the Backend (you): still starting") && !later.includes("Jiro the Frontend: connected"), later.slice(0, 600));

  // every conversation ended
  await invoke("mcp_status_save", { folder: root, people: [] });
  ok("with no open conversation the answer says so", (await connections()).includes("No conversation is open"));

  // a file written by a window that is gone is not believed
  const made = fs.readdirSync(statusDir).filter((f) => !statusBefore.has(f));
  ok("the window wrote one file for the project, in Kona's data folder and not in the project", made.length === 1 && !fs.existsSync(path.join(root, ".kona", "mcp-status.json")), made.join(","));
  const file = path.join(statusDir, made[0]);
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...j, started: j.started + 1 }));
  ok("a status from a window that is gone says not known", (await connections()).includes("not known just now"));
} catch (e) {
  ok("the test ran to the end", false, String(e).slice(0, 400));
} finally {
  try { if (id) await invoke("remove_project", { id }); } catch (e) { console.log("could not remove the project: " + e); }
  fs.rmSync(root, { recursive: true, force: true });
  if (fs.existsSync(statusDir)) for (const f of fs.readdirSync(statusDir)) if (!statusBefore.has(f)) fs.rmSync(path.join(statusDir, f), { force: true });
  ok("the project list and folders are as before", !(await invoke("list_projects")).some((p) => p.name === NAME) && !fs.existsSync(root));
  console.log(failed ? `${failed} FAILED` : "ALL PASSED");
  process.exit(failed ? 1 : 0);
}
