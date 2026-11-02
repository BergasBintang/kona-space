import { test } from "node:test";
import assert from "node:assert/strict";
import { headingsOf, outline, plain, resolveLink, slugify } from "./outline.ts";

test("a heading loses its marks and becomes a lower-case id", () => {
  assert.equal(plain("The **bold** `code` [link](x.md) and [[note|a note]]"), "The bold code link and a note");
  assert.equal(slugify("1. Profile (LinkedIn: Intro)"), "1-profile-linkedin-intro");
  assert.equal(slugify("Café & Crème"), "cafe-creme");
  assert.equal(slugify("???"), "section");
});

test("headings come in order, a heading in a code block is not one, and the same words get different ids", () => {
  const h = headingsOf(["# Title", "text", "```", "# not a heading", "```", "## Part", "## Part", "### Part #"]);
  assert.deepEqual(h.map((x) => [x.level, x.text, x.id]), [[1, "Title", "md-title"], [2, "Part", "md-part"], [2, "Part", "md-part-2"], [3, "Part", "md-part-3"]]);
});

test("the outline of a file skips its front matter", () => {
  assert.deepEqual(outline("---\ntitle: X\n# nope\n---\n# Real\n").map((x) => x.text), ["Real"]);
});

test("a link goes to a file next to this one, above it, or from the project root, and never out of the project", () => {
  const root = "D:\\p\\proj", from = "D:\\p\\proj\\docs\\a.md";
  assert.deepEqual(resolveLink(from, "b.md", root), { path: "D:\\p\\proj\\docs\\b.md", anchor: "" });
  assert.deepEqual(resolveLink(from, "./sub/c.md#Part-2", root), { path: "D:\\p\\proj\\docs\\sub\\c.md", anchor: "Part-2" });
  assert.deepEqual(resolveLink(from, "../README.md", root), { path: "D:\\p\\proj\\README.md", anchor: "" });
  assert.deepEqual(resolveLink(from, "/docs/z%20z.md", root), { path: "D:\\p\\proj\\docs\\z z.md", anchor: "" });
  assert.deepEqual(resolveLink(from, "#top", root), { path: from, anchor: "top" });
  assert.equal(resolveLink(from, "../../outside.md", root), null);
  assert.equal(resolveLink(from, "https://example.org/x.md", root), null);
  assert.equal(resolveLink(from, "mailto:a@b.c", root), null);
  assert.equal(resolveLink(from, "C:\\Windows\\x.md", root), null);
  assert.equal(resolveLink("/home/u/p/a.md", "b/c.md", "/home/u/p")!.path, "/home/u/p/b/c.md");
});
