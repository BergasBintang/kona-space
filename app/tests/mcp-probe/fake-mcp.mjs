// A tiny MCP server over stdio for the MCP tests (tests/mcp-access.mjs): one tool, "echo_probe", that returns the given word with the marker KONA-MCP-OK. No libraries, no network.
import readline from "node:readline";
const rl = readline.createInterface({ input: process.stdin });
const send = (o) => process.stdout.write(JSON.stringify(o) + "\n");
rl.on("line", (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.method === "initialize") send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "fake", version: "1.0.0" } } });
  else if (m.method === "tools/list") send({ jsonrpc: "2.0", id: m.id, result: { tools: [{ name: "echo_probe", description: "Returns the given word with the marker KONA-MCP-OK", inputSchema: { type: "object", properties: { word: { type: "string" } }, required: ["word"] } }] } });
  else if (m.method === "tools/call") send({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: "KONA-MCP-OK:" + (m.params?.arguments?.word ?? "") }] } });
  else if (m.id !== undefined) send({ jsonrpc: "2.0", id: m.id, result: {} });
});
