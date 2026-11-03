import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPage, cssRefs, pageRefs, renameCssRefs } from "./htmlpage.ts";

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

test("pageRefs also finds pictures named with url(...) in style attributes, style blocks and sheets", () => {
  const html = `<div style='background:url(../shots/a.png) 0 0'></div><style>.x{background-image:url("b.png")} .y{background:url('https://x.test/c.png')} .z{fill:url(#g)}</style>`;
  assert.deepEqual(pageRefs(html), ["../shots/a.png", "b.png"]);
});

test("a background picture is written once and every url(...) that names it points there", () => {
  const html = `<!doctype html><div style='background:url(../s/a.png) 0 -10px/10px auto'></div><div style='background:url(../s/a.png) 0 -20px/10px auto'></div>`;
  const { html: out } = buildPage(html, new Map([["../s/a.png", "data:image/png;base64,AAA"]]));
  assert.equal(out.split("data:image/png;base64,AAA").length - 1, 1);
  assert.match(out, /^<!doctype html><style>:root\{--kona-pic-0:url\("data:image\/png;base64,AAA"\);\}<\/style>/);
  assert.equal(out.split("var(--kona-pic-0)").length - 1, 2);
});

test("a style sheet's own pictures are renamed and found under that name", () => {
  const css = renameCssRefs(`.a{background:url(img/b.png)} .b{background:url(https://x.test/c.png)} .c{fill:url(#g)}`, (r) => (r === "img/b.png" ? "kona:D:\p\css\img\b.png" : null));
  assert.equal(css, `.a{background:url("kona:D:\p\css\img\b.png")} .b{background:url(https://x.test/c.png)} .c{fill:url(#g)}`);
  assert.deepEqual(cssRefs(css), []);
  const { html, web } = buildPage(`<link rel=stylesheet href=a.css>`, new Map([["a.css", css], ["kona:D:\p\css\img\b.png", "data:image/png;base64,AAA"]]));
  assert.match(html, /\.a\{background:var\(--kona-pic-0\)\}/);
  assert.equal(web, 1);
});

test("a background that was not found stays as written", () => {
  const { html } = buildPage(`<div style="background:url(missing.png)"></div>`, new Map());
  assert.equal(html, `<div style="background:url(missing.png)"></div>`);
});
