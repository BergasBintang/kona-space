import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPage, pageRefs } from "./htmlpage.ts";

test("pageRefs lists local pictures and style sheets once, not web addresses or data", () => {
  const html = `<link rel="stylesheet" href="a.css"><link rel="icon" href="x.ico"><img src="logo.svg"><img src='logo.svg'><img src="https://x.test/p.png"><img src="data:image/png;base64,AAA"><img src=//cdn.test/p.png>`;
  assert.deepEqual(pageRefs(html), ["a.css", "logo.svg"]);
});

test("buildPage puts pictures and style sheets into the page", () => {
  const html = `<link rel="stylesheet" href="a.css"><img width="64" src="logo.svg">`;
  const { html: out } = buildPage(html, new Map([["a.css", "p{color:red}"], ["logo.svg", "data:image/svg+xml;base64,AAA"]]));
  assert.equal(out, `<style>p{color:red}</style><img width="64" src="data:image/svg+xml;base64,AAA">`);
});

test("buildPage takes scripts out and counts them", () => {
  const { html, scripts } = buildPage(`<p>a</p><script>alert(1)</script><SCRIPT src="x.js"></SCRIPT><script src="y.js"/><p>b</p>`, new Map());
  assert.equal(html, "<p>a</p><p>b</p>");
  assert.equal(scripts, 3);
});

test("buildPage counts web pictures and leaves them", () => {
  const { html, web } = buildPage(`<img src="https://x.test/p.png"><img src="data:image/png;base64,AAA">`, new Map());
  assert.equal(web, 1);
  assert.match(html, /https:\/\/x\.test/);
});

test("buildPage keeps links inside the page and stops the others", () => {
  const { html } = buildPage(`<a href="#top">up</a><a class="x" href="other.html">go</a><a href='https://x.test'>web</a>`, new Map());
  assert.equal(html, `<a href="#top">up</a><a class="x" href="#">go</a><a href="#">web</a>`);
});

test("buildPage drops base and refresh tags, and a style sheet cannot close its own tag early", () => {
  const { html } = buildPage(`<base href="https://x.test/"><meta http-equiv="refresh" content="0;url=x"><link rel=stylesheet href=a.css>`, new Map([["a.css", "/*</style><script>*/"]]));
  assert.equal(html, `<style>/*<\\/style><script>*/</style>`);
});

test("a name written with &amp; is looked up as the file name", () => {
  assert.deepEqual(pageRefs(`<img src="a&amp;b.png">`), ["a&b.png"]);
  assert.match(buildPage(`<img src="a&amp;b.png">`, new Map([["a&b.png", "data:x"]])).html, /src="data:x"/);
});
