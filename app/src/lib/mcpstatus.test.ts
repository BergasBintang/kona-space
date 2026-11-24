import test from "node:test";
import assert from "node:assert/strict";
import { mcpLines, mcpPeople, type McpSession } from "./mcpstatus.ts";

const s = (id: string, roleId: string | null, mcp?: { name: string; status: string }[], run = "ready"): McpSession => ({ id, roleId, run, mcp });

test("nothing open, nothing said", () => {
  assert.deepEqual(mcpLines("shadcn", true, ["frontend"], []), []);
});

test("a conversation that has not had its first message says nothing is known yet", () => {
  assert.deepEqual(mcpLines("shadcn", true, ["frontend"], [s("1", "frontend")]), [{ roleId: "frontend", state: "waiting" }]);
});

test("connected, still starting, and failed are told apart", () => {
  const lines = mcpLines("shadcn", true, ["frontend", "design", "qa"], [
    s("1", "frontend", [{ name: "shadcn", status: "connected" }]),
    s("2", "design", [{ name: "shadcn", status: "pending" }]),
    s("3", "qa", [{ name: "shadcn", status: "failed" }]),
  ]);
  assert.deepEqual(lines.map((l) => l.state), ["connected", "starting", "failed"]);
  assert.equal(mcpLines("shadcn", true, ["qa"], [s("3", "qa", [{ name: "shadcn", status: "needs-auth" }])])[0].state, "failed");
});

test("a conversation that began before the tool was given does not have it", () => {
  assert.deepEqual(mcpLines("shadcn", true, ["frontend"], [s("1", "frontend", [{ name: "other", status: "connected" }])]), [{ roleId: "frontend", state: "older" }]);
});

test("a person who is not allowed says nothing, unless the tool is still loaded in their conversation", () => {
  assert.deepEqual(mcpLines("shadcn", true, ["frontend"], [s("1", "design", [])]), []);
  assert.deepEqual(mcpLines("shadcn", false, ["frontend"], [s("1", "frontend", [{ name: "shadcn", status: "connected" }])]), [{ roleId: "frontend", state: "still" }]);
  assert.deepEqual(mcpLines("shadcn", false, ["frontend"], [s("1", "frontend", [])]), [], "switched off and not loaded: nothing to say");
});

test("ended conversations and conversations without a person are ignored; the newest conversation of a person counts", () => {
  const lines = mcpLines("shadcn", true, ["frontend"], [
    s("1", "frontend", [{ name: "shadcn", status: "failed" }]),
    s("2", "frontend", [{ name: "shadcn", status: "connected" }]),
    s("3", null, [{ name: "shadcn", status: "connected" }]),
    s("4", "frontend", [{ name: "shadcn", status: "failed" }], "ended"),
  ]);
  assert.deepEqual(lines, [{ roleId: "frontend", state: "connected" }]);
});

test("the tool server is told each person's newest open conversation and what Claude Code listed in it", () => {
  const people = mcpPeople([
    s("1", "frontend", [{ name: "shadcn", status: "failed" }], "ended"),
    s("2", "frontend", [{ name: "shadcn", status: "connected" }]),
    s("3", "design"),
    s("4", null, [{ name: "shadcn", status: "connected" }]),
    s("5", "qa", [{ name: "shadcn", status: "connected" }], "ended"),
  ]);
  assert.deepEqual(people, [
    { role: "frontend", session: "2", servers: [{ name: "shadcn", status: "connected" }] },
    { role: "design", session: "3", servers: null },
  ], "an ended conversation and one without a person are left out; no message yet is null, not an empty list");
  assert.deepEqual(mcpPeople([]), []);
});
