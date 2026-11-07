import { test } from "node:test";
import assert from "node:assert/strict";
import { groupNames, groupProjects } from "./groups.ts";

const p = (name: string, group?: string | null) => ({ id: name, name, folder: `C:\\${name}`, group });

test("groups run A to Z, and the projects with no group come last", () => {
  const g = groupProjects([p("Norbit", "Miralis"), p("Quantum", "Clients"), p("Loose"), p("Kona", "miralis"), p("Acme", "Clients")]);
  assert.deepEqual(g.map((x) => x.name), ["Clients", "Miralis", "No group"]);
  assert.deepEqual(g[0].projects.map((x) => x.name), ["Acme", "Quantum"], "inside a group the projects run A to Z too");
  assert.deepEqual(g[1].projects.map((x) => x.name), ["Kona", "Norbit"], "Miralis and miralis are one group");
  assert.equal(g[2].none, true);
});

test("a group name is compared without case and with numbers by value", () => {
  const g = groupProjects([p("App 10", "b"), p("App 2", "b"), p("x", "a")]);
  assert.deepEqual(g.map((x) => x.name), ["a", "b"]);
  assert.deepEqual(g[1].projects.map((x) => x.name), ["App 2", "App 10"]);
});

test("a blank group is no group, and no projects make no groups", () => {
  assert.deepEqual(groupProjects([p("A", "   "), p("B", null)]).map((x) => x.name), ["No group"]);
  assert.deepEqual(groupProjects([]), []);
  assert.deepEqual(groupNames([p("A", "Zed"), p("B"), p("C", "Alpha")]), ["Alpha", "Zed"], "the names to pick from leave out No group");
});
