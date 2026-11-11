import { test } from "node:test";
import assert from "node:assert/strict";
import { absolute, buildButtons, composerScripts, filterButtons, findPaths, fitCount, fmtDuration, History, joinLines, looksSecret, parsePrompt, runLine, scriptsOf, shortPath } from "./blocks.ts";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o), "utf8").toString("base64");

test("the prompt mark is read, including letters outside plain ASCII", () => {
  assert.deepEqual(parsePrompt(b64({ code: 1, cwd: "D:\\proyek baru\\café", branch: "main", dirty: true })), { code: 1, cwd: "D:\\proyek baru\\café", branch: "main", dirty: true });
  assert.deepEqual(parsePrompt(b64({ code: 0, cwd: "C:\\", branch: "", dirty: false })), { code: 0, cwd: "C:\\", branch: "", dirty: false });
});
test("a broken prompt mark is ignored, never thrown", () => {
  assert.equal(parsePrompt("%%%"), null);
  assert.equal(parsePrompt(b64({ code: 0 })), null);
  assert.equal(parsePrompt(""), null);
});
test("a time is shown in plain units", () => {
  assert.equal(fmtDuration(400), "0.4 s");
  assert.equal(fmtDuration(2500), "2.5 s");
  assert.equal(fmtDuration(12000), "12 s");
  assert.equal(fmtDuration(125000), "2 min 5 s");
});
test("the folder in the header is short inside the project", () => {
  assert.equal(shortPath("D:\\work\\app", "D:\\work\\app"), ".");
  assert.equal(shortPath("d:\\work\\app\\src\\lib", "D:\\work\\app"), "src\\lib");
  assert.equal(shortPath("D:\\work\\other", "D:\\work\\app"), "D:\\work\\other");
  assert.equal(shortPath("D:\\work\\app2", "D:\\work\\app"), "D:\\work\\app2");
});
test("scripts come out with the usual ones first", () => {
  assert.deepEqual(scriptsOf(JSON.stringify({ scripts: { zeta: "x", test: "t", dev: "d", build: "b", alpha: "a" } })), ["dev", "build", "test", "alpha", "zeta"]);
  assert.deepEqual(scriptsOf("not json"), []);
  assert.deepEqual(scriptsOf("{}"), []);
  assert.equal(runLine("dev"), "npm run dev");
  assert.equal(runLine("test"), "npm test");
});
test("file paths are found in an error line", () => {
  const hits = findPaths("src/App.tsx:42:7 - error TS2322: Type 'x' is not assignable");
  assert.equal(hits.length, 1);
  assert.deepEqual([hits[0].path, hits[0].line, hits[0].col, hits[0].start], ["src/App.tsx", 42, 7, 0]);
  const win = findPaths("at D:\\app\\src\\main.rs(10,3) in module");
  assert.deepEqual([win[0].path, win[0].line, win[0].col], ["D:\\app\\src\\main.rs", 10, 3]);
});
test("a version number or a web address is not taken for a file", () => {
  assert.equal(findPaths("installed 1.2").length, 0);
  assert.equal(findPaths("see https://example.com/page.html now").length, 0);
});
test("a relative path is made absolute from the shell's folder", () => {
  assert.equal(absolute("src/App.tsx", "D:\\work\\app"), "D:\\work\\app\\src\\App.tsx");
  assert.equal(absolute("..\\lib\\a.ts", "D:\\work\\app"), "D:\\work\\lib\\a.ts");
  assert.equal(absolute("C:/x/y.ts", "D:\\work"), "C:\\x\\y.ts");
});
test("lines with a key or token are recognised, ordinary ones are not", () => {
  assert.ok(looksSecret("curl -H 'Authorization: Bearer abcdefghijklmnop12345' x"));
  assert.ok(looksSecret("$env:TOKEN='ghp_abcdefghijklmnopqrstuvwxyz1234'"));
  assert.ok(looksSecret("set password=hunter2222"));
  assert.ok(!looksSecret("git status"));
  assert.ok(!looksSecret("npm run dev -- --port 3000"));
});
test("history: up walks back, down comes forward to the draft, secrets and repeats are not kept", () => {
  const h = new History();
  h.add("git status"); h.add("git status"); h.add("npm test"); h.add("set password=hunter2222");
  assert.equal(h.size, 2);
  assert.equal(h.prev("typing"), "npm test");
  assert.equal(h.prev("ignored"), "git status");
  assert.equal(h.prev("ignored"), null);
  assert.equal(h.next(), "npm test");
  assert.equal(h.next(), "typing");
  assert.equal(h.next(), null);
});
test("the text of a block joins wrapped lines and drops the empty end", () => {
  assert.equal(joinLines([{ text: "abc", wrapped: false }, { text: "def", wrapped: true }, { text: "x", wrapped: false }, { text: "", wrapped: false }, { text: "  ", wrapped: false }]), "abcdef\nx");
});

test("composer scripts leave out the hooks composer runs by itself", () => {
  assert.deepEqual(composerScripts(JSON.stringify({ scripts: { test: "x", "post-install-cmd": "y", "pre-autoload-dump": "z", "fix:style": "s", "post-root-package-install": "q" } })), ["fix:style", "test"]);
  assert.deepEqual(composerScripts("nope"), []);
});
test("buttons: the owner's first, then npm, then composer; a clash is named", () => {
  const list = buildButtons([{ name: "Deploy", line: "ssh x" }], ["dev", "test"], ["test", "lint"]);
  assert.deepEqual(list.map((b) => b.name), ["Deploy", "dev", "test", "composer test", "lint"]);
  assert.deepEqual(list.map((b) => b.line), ["ssh x", "npm run dev", "npm test", "composer run test", "composer run lint"]);
  assert.equal(new Set(list.map((b) => b.id)).size, 5);
});
test("how many buttons fit a row, keeping room for More", () => {
  assert.equal(fitCount([50, 50, 50], 400, 80, 4), 3);
  assert.equal(fitCount([50, 50, 50, 50, 50], 200, 60, 4), 2);
  assert.equal(fitCount([300, 50], 200, 60, 4), 0);
  assert.equal(fitCount([], 200, 60, 4), 0);
});
test("the More list is filtered by name or command", () => {
  const list = buildButtons([], ["dev", "build"], []);
  assert.deepEqual(filterButtons(list, "BUI").map((b) => b.name), ["build"]);
  assert.deepEqual(filterButtons(list, "run dev").map((b) => b.name), ["dev"]);
  assert.equal(filterButtons(list, "  ").length, 2);
});
