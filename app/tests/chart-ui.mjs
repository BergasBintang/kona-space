// A test of the charts in notes in the REAL window (the ```chart block, lib/brain/chart.ts and components/brain/Chart*.tsx), driven over the DevTools port. Run it against the
// dev window or a built program, started with the test port:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   then   npx tauri dev   then   node tests/chart-ui.mjs
// It uses the chart showcase project (a folder holding one note with every kind of chart; `node tests/chart-showcase.mjs <folder>` writes it). It does NOT remove that project:
// the owner keeps it to look at. If the project is not in the list yet it is added (named "Chart showcase"). It starts no session and calls no model.
// Screenshots of every chart go to SHOT_DIR when that is set. Env: SHOWCASE (the folder, default D:\tmp\chart-showcase).
import fs from "node:fs";
import path from "node:path";
import { attach } from "./cdp.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FOLDER = process.env.SHOWCASE ?? "D:\\tmp\\chart-showcase";
const NAME = "Chart showcase";
const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { if (process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); await c.shot(path.join(process.env.SHOT_DIR, name + ".png")); } };
const mouse = (type, x, y) => c.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
const move = async (x, y) => { await mouse("mouseMoved", x, y); await wait(120); };
const clickAt = async (x, y) => { await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y); await mouse("mouseReleased", x, y); await wait(150); };
const key = async (k, code, vk) => { await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }); };

// the showcase must exist
if (!fs.existsSync(path.join(FOLDER, ".kona", "brain", "chart-showcase.md"))) { console.log(`SKIP the showcase is not at ${FOLDER}`); process.exit(0); }
fs.writeFileSync(path.join(FOLDER, "README.md"), "# Chart showcase\n\nA chart in a file, shown by the Files reader.\n\n```chart\ntype: column\ntitle: In a file\n| Part | Value |\n|---|---|\n| a | 3 |\n| b | 5 |\n| c | 2 |\n```\n");
try { const w0 = await c.send("Browser.getWindowForTarget"); await c.send("Browser.setWindowBounds", { windowId: w0.result.windowId, bounds: { windowState: "maximized" } }); await wait(800); } catch { /* as it is */ }

const projects = await invoke("list_projects");
const account = projects.find((p) => p.account)?.account ?? null;
if (!projects.some((p) => p.folder === FOLDER)) { if (!account) { console.log("SKIP no project with an account to borrow"); process.exit(0); } await invoke("add_project", { folder: FOLDER, name: NAME, account }); console.log("added the showcase project (it stays in the list)"); }

await c.send("Page.reload");
await wait(1500);
ok("the welcome page is back after the reload", await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200));
ok("the showcase project opens", await c.ev(`(() => { const opens = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open'); for (const b of opens) { let n = b.parentElement; for (let k = 0; k < 8 && n; k++, n = n.parentElement) { if (n.innerText && n.innerText.includes(${JSON.stringify(NAME)})) { if ([...n.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Open').length === 1) { b.click(); return true; } break; } } } return false; })()`));
ok("it is the showcase that is open", await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 10000, 200));
ok("the office is drawn", await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 10`, 20000, 200));
await c.ev(`window.__errs = []; addEventListener("error", (e) => window.__errs.push(String(e.message))); addEventListener("unhandledrejection", (e) => window.__errs.push("rejection " + String(e.reason))); true`);

// ---- the note in the Brain ----
await c.ev(`document.querySelector('[aria-label="Open Brain"]').click(); true`);
await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Brain'`, 6000, 100);
await c.ev(`[...document.querySelectorAll('section[data-sheet] [role="tab"]')].find((b) => b.textContent.trim() === 'Notes').click(); true`);
await wait(800);
await c.ev(`(() => { const e = [...document.querySelectorAll('section[data-sheet] button, section[data-sheet] li, section[data-sheet] a')].find((x) => /Chart showcase/.test(x.textContent) && x.textContent.length < 80); if (e) e.click(); return true; })()`);
ok("the note draws its charts", await c.waitFor(`document.querySelectorAll('figure').length >= 30`, 20000, 200), String(await c.ev(`document.querySelectorAll('figure').length`)));
await wait(1200);
const figs = await c.ev(`document.querySelectorAll('figure').length`);

// every kind is there, nothing is NaN, nothing is drawn outside its picture, and no figure is wider than the page
const kinds = ["column", "bar", "line", "area", "combo", "pie", "doughnut", "scatter", "bubble", "radar", "histogram", "box", "waterfall", "funnel", "pareto", "treemap", "sunburst", "heatmap"];
const report = [];
for (let i = 0; i < figs; i++) {
  await c.ev(`document.querySelectorAll('figure')[${i}].scrollIntoView({ block: 'center' }); true`);
  await wait(120);
  report.push(await c.ev(`(() => {
    const f = document.querySelectorAll('figure')[${i}], svg = f.querySelector('svg[role="img"]');
    if (!svg) return { i: ${i}, none: true };
    const html = svg.outerHTML, vb = svg.viewBox.baseVal;
    const out = [...svg.querySelectorAll('text')].filter((t) => { const b = t.getBBox(); const tr = t.getAttribute('transform'); return !tr && (b.x < -1 || b.y < -2 || b.x + b.width > vb.width + 1 || b.y + b.height > vb.height + 1); }).map((t) => t.textContent.slice(0, 20));
    const fb = f.getBoundingClientRect(), sb = svg.getBoundingClientRect();
    return { i: ${i}, label: svg.getAttribute('aria-label'), nan: /NaN|undefined|Infinity/.test(html), out, wide: sb.right > fb.right + 1, marks: svg.querySelectorAll('path,rect,circle,line').length, h: Math.round(sb.height) };
  })()`));
  if (process.env.SHOT_DIR) await shot("chart-" + String(i + 1).padStart(2, "0"));
}
ok("every chart has a drawing", report.every((r) => !r.none && r.marks > 0), report.filter((r) => r.none || !r.marks).map((r) => r.i).join());
ok("no chart has a NaN or an undefined in it", report.every((r) => !r.nan), report.filter((r) => r.nan).map((r) => r.i).join());
ok("no chart is wider than its frame", report.every((r) => !r.wide), report.filter((r) => r.wide).map((r) => r.i).join());
ok("no text is drawn outside its picture", report.every((r) => !r.out?.length), report.filter((r) => r.out?.length).map((r) => `${r.i}: ${r.out.join("|")}`).join("; "));
const missing = kinds.filter((k) => !report.some((r) => (r.label ?? "").includes(` ${k} chart,`)));
ok("all 18 kinds of chart are drawn", missing.length === 0, "missing: " + missing.join());
ok("a chart has no page error", (await c.ev(`window.__errs`)).length === 0, JSON.stringify(await c.ev(`window.__errs`)).slice(0, 300));

// the mistakes say what is wrong, in words, and show the table
const problems = await c.ev(`[...document.querySelectorAll('div')].filter((d) => /^This chart cannot be drawn/.test(d.firstElementChild?.innerText ?? '') && d.childElementCount <= 3).map((d) => d.innerText.split('\\n')[0])`);
ok("four mistakes give four plain messages", problems.length === 4 && problems.some((t) => /not one Kona draws/.test(t)) && problems.some((t) => /no data/.test(t)) && problems.some((t) => /negative/.test(t)) && problems.some((t) => /at most 4 series/.test(t)), problems.join(" | ").slice(0, 400));
ok("a note under a chart says that small parts were folded", await c.ev(`[...document.querySelectorAll('figure p')].some((p) => /folded into "Other"/.test(p.innerText))`));
ok("a setting that is not known is said, and the chart is still drawn", await c.ev(`[...document.querySelectorAll('figure p')].some((p) => /"colour" is not known/.test(p.innerText))`));

// ---- one figure: its legend, its tooltip, its table ----
const figOf = (title) => `[...document.querySelectorAll('figure')].find((f) => f.getAttribute('aria-label') === ${JSON.stringify(title)})`;
const center = async (js) => c.ev(`(() => { const e = ${js}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const T1 = "Sessions per role (two series)";
await c.ev(`${figOf(T1)}.scrollIntoView({ block: 'center' }); true`);
await wait(300);
const hits = `${figOf(T1)}.querySelectorAll('svg rect[fill="transparent"]')`;
const third = await center(`${hits}[2]`);
await move(third.x, third.y);
const tip = await c.ev(`(() => { const t = ${figOf(T1)}.querySelector('[aria-hidden="true"].absolute'); return t ? t.innerText.replace(/\\s+/g, ' ') : null; })()`);
ok("pointing at a column shows its category and every series", !!tip && /Jiro/.test(tip) && /Sonnet\s*30/.test(tip) && /Haiku\s*8/.test(tip), tip ?? "no tooltip");
await shot("chart-tooltip");
await move(5, 5);
ok("moving away hides the tooltip", await c.waitFor(`!${figOf(T1)}.querySelector('[aria-hidden="true"].absolute')`, 1500, 100));
// keyboard: the same words from the focus
await c.ev(`${hits}[0].focus(); true`);
const ktip = await c.ev(`(() => { const t = ${figOf(T1)}.querySelector('[aria-hidden="true"].absolute'); return t ? t.innerText.replace(/\\s+/g, ' ') : null; })()`);
ok("the keyboard focus shows the same tooltip (a tooltip is never the only way to read a value)", !!ktip && /Kiki/.test(ktip) && /12/.test(ktip), ktip ?? "none");
await c.ev(`document.activeElement.blur(); true`);
ok("every mark has a spoken name with its numbers", await c.ev(`${hits}[1].getAttribute('aria-label')`) === "Nokka: Sonnet 9, Haiku 14");

// the legend: a click hides a series and the others keep their colour
const seriesFills = () => c.ev(`[...${figOf(T1)}.querySelectorAll('svg path[fill^="var(--chart-"]')].map((p) => p.getAttribute('fill')).filter((v, i, a) => a.indexOf(v) === i).sort().join()`);
ok("both series are drawn, in the first two colours", await seriesFills() === "var(--chart-1),var(--chart-2)", await seriesFills());
const legendBtn = (name) => `[...${figOf(T1)}.querySelectorAll('ul[aria-label="Legend"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(name)})`;
await c.ev(`${legendBtn("Sonnet")}.click(); true`);
await wait(200);
ok("hiding the first series leaves the second in its own colour (colour follows the series, not its place)", await seriesFills() === "var(--chart-2)" && await c.ev(`${legendBtn("Sonnet")}.getAttribute('aria-pressed')`) === "false", await seriesFills());
await c.ev(`${legendBtn("Haiku")}.click(); true`);
await wait(200);
ok("the last series cannot be hidden", await seriesFills() === "var(--chart-2)" && await c.ev(`${legendBtn("Haiku")}.getAttribute('aria-pressed')`) === "true");
await c.ev(`${legendBtn("Sonnet")}.click(); true`);
await wait(200);
ok("showing it again brings it back", await seriesFills() === "var(--chart-1),var(--chart-2)");

// the table twin
await c.ev(`[...${figOf(T1)}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Show the table').click(); true`);
await wait(300);
const tbl = await c.ev(`(() => { const t = ${figOf(T1)}.querySelector('table'); return t ? { head: [...t.querySelectorAll('th')].map((x) => x.innerText.trim().split('\\n')[0]), rows: t.querySelectorAll('tbody tr').length } : null; })()`);
ok("the same numbers are one click away as a table", !!tbl && tbl.rows === 4 && ["Role", "Sonnet", "Haiku"].every((h) => tbl.head.some((x) => x.startsWith(h))), JSON.stringify(tbl));
await shot("chart-table");
await c.ev(`[...${figOf(T1)}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Hide the table').click(); true`);
ok("Hide the table puts the table away", await c.waitFor(`!${figOf(T1)}.querySelector('table')`, 1500, 100));
ok("Copy data is there", await c.ev(`[...${figOf(T1)}.querySelectorAll('button')].some((b) => /Copy data/.test(b.textContent))`));

// a line chart: a crosshair with all three series
const TL = "Visitors per month (three series)";
const lineHits = `${figOf(TL)}.querySelectorAll('svg rect[fill="transparent"]')`;
const l5 = await center(`${lineHits}[5]`);
await move(l5.x, l5.y);
const ltip = await c.ev(`(() => { const t = ${figOf(TL)}.querySelector('[aria-hidden="true"].absolute'); return t ? t.innerText.replace(/\\s+/g, ' ') : null; })()`);
ok("pointing at a month on a line chart shows all three series", !!ltip && /Jun/.test(ltip) && /Web/.test(ltip) && /App/.test(ltip) && /Partner/.test(ltip), ltip ?? "none");
ok("and a hairline marks the month", await c.ev(`${figOf(TL)}.querySelectorAll('svg line[stroke="var(--color-line-strong)"]').length >= 2`));
await move(5, 5);

// scatter: the nearest point is found without landing on it
const TS = "Height and weight (two groups)";
await c.ev(`${figOf(TS)}.scrollIntoView({ block: 'center' }); true`);
await wait(400);
// the first dot of the plot (the legend has a small picture of the same shape, so the search starts inside the drawing)
const sc2 = await c.ev(`(() => { const p = ${figOf(TS)}.querySelector('svg[role="img"] path[fill="var(--chart-1)"][transform]'); const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await move(sc2.x + 14, sc2.y + 9);
const stip = await c.ev(`(() => { const t = ${figOf(TS)}.querySelector('[aria-hidden="true"].absolute'); return t ? t.innerText.replace(/\\s+/g, ' ') : null; })()`);
ok("a dot is found from 16 pixels away (a hit area bigger than the mark)", !!stip && /Group A/.test(stip) && /Height\s*1\d\d/.test(stip), stip ?? "none");
await move(5, 5);

// a pie: a slice says its share
const TP = "Where the cost goes";
const pc = await center(`${figOf(TP)}.querySelector('svg path[fill="var(--chart-1)"]')`);
await move(pc.x + 30, pc.y);
const ptip = await c.ev(`(() => { const t = ${figOf(TP)}.querySelector('[aria-hidden="true"].absolute'); return t ? t.innerText.replace(/\\s+/g, ' ') : null; })()`);
ok("a slice names itself and its share", !!ptip && /Sessions/.test(ptip) && /Share\s*62%/.test(ptip), ptip ?? "none");
await move(5, 5);
ok("the legend of a pie lists its parts, and a legend of one series is left out", await c.ev(`${figOf(TP)}.querySelectorAll('ul[aria-label="Legend"] li').length === 4 && !${figOf("One series, 24 days")}.querySelector('ul[aria-label="Legend"]')`));

// the bar chart with long names: the names are cut with an ellipsis, not run into the bars
const TB = "Tokens by account";
ok("a long name is cut with an ellipsis", await c.ev(`[...${figOf(TB)}.querySelectorAll('svg text')].some((t) => t.textContent.endsWith('\\u2026'))`));

// ---- a narrow window ----
let narrow = null;
try {
  const w = await c.send("Browser.getWindowForTarget");
  await c.send("Browser.setWindowBounds", { windowId: w.result.windowId, bounds: { windowState: "normal" } });
  await c.send("Browser.setWindowBounds", { windowId: w.result.windowId, bounds: { width: 760, height: 700 } });
  await wait(900);
  narrow = await c.ev(`(() => { const bad = []; document.querySelectorAll('figure').forEach((f, i) => { const s = f.querySelector('svg[role="img"]'); if (s && s.getBoundingClientRect().right > f.getBoundingClientRect().right + 1) bad.push(i); }); return { bad, count: document.querySelectorAll('figure').length, fig: Math.round(document.querySelector('figure').getBoundingClientRect().width) }; })()`);
  await shot("chart-narrow");
  ok("in a narrow window every chart redraws to fit its frame", narrow.bad.length === 0 && narrow.count === figs, JSON.stringify(narrow));
  await c.send("Browser.setWindowBounds", { windowId: w.result.windowId, bounds: { windowState: "maximized" } });
  await wait(800);
} catch (e) { console.log("SKIP the narrow window could not be set: " + String(e).slice(0, 100)); }

// ---- the Files reader draws a chart too ----
await c.ev(`document.querySelector('section button[aria-label^="Close"]').click(); true`);
await c.waitFor(`!document.querySelector('section[data-sheet]')`, 3000, 100);
await c.ev(`document.querySelector('[aria-label="Open Files"]').click(); true`);
await c.waitFor(`document.querySelector('section[data-sheet]')?.getAttribute('aria-label') === 'Files'`, 5000, 100);
const readme = `[...document.querySelectorAll('section[data-sheet] button, section[data-sheet] [role="treeitem"], section[data-sheet] li')].find((x) => x.textContent.trim() === 'README.md')`;
await c.waitFor(`!!(${readme})`, 6000, 200);
// the reader may already hold the file from an earlier visit: look first, click only when the chart is not there
for (let tries = 0; tries < 3 && !(await c.ev(`!!document.querySelector('section[data-sheet] figure svg[role="img"]')`)); tries++) {
  // a real click on the name in the tree (the list item itself may not be the thing that listens)
  const at = await c.ev(`(() => { const all = [...document.querySelectorAll('section[data-sheet] *')].filter((x) => x.textContent.trim() === 'README.md' && x.children.length === 0); const e = all[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (at) await clickAt(at.x, at.y);
  await c.waitFor(`!!document.querySelector('section[data-sheet] figure svg[role="img"]')`, 3000, 200);
}
ok("a chart in a README shows in the Files reader", await c.ev(`!!document.querySelector('section[data-sheet] figure svg[role="img"]')`), await c.ev(`document.querySelector('section[data-sheet] figure')?.getAttribute('aria-label') ?? 'no figure'`));
await shot("chart-files");
await c.ev(`document.querySelector('section button[aria-label^="Close"]').click(); true`);

// ---- how heavy it is: the chart code is its own file, loaded when a note holds a chart ----
const build = spawnSync("node", [path.join(here, "..", "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "silent"], { cwd: path.join(here, ".."), encoding: "utf8" });
const assets = path.join(here, "..", "dist", "assets");
if (build.status === 0 && fs.existsSync(assets)) {
  const zlib = await import("node:zlib");
  const files = fs.readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => ({ f, raw: fs.statSync(path.join(assets, f)).size, gz: zlib.gzipSync(fs.readFileSync(path.join(assets, f))).length }));
  const chart = files.find((x) => /^Chart-/.test(x.f));
  const main = files.reduce((a, b) => (b.raw > a.raw ? b : a), files[0]);
  console.log(`bundle: chart chunk ${chart ? Math.round(chart.raw / 1024) + " KB (" + Math.round(chart.gz / 1024) + " KB gzipped)" : "not found"}, main chunk ${Math.round(main.raw / 1024)} KB (${Math.round(main.gz / 1024)} KB gzipped)`);
  ok("the chart code is its own file, loaded only when a note holds a chart", !!chart && chart.f !== main.f);
  ok("it is lite: under 60 KB gzipped, with no library in it", !!chart && chart.gz < 60 * 1024, chart ? Math.round(chart.gz / 1024) + " KB" : "");
} else console.log("SKIP the bundle size: the build did not run here (" + String(build.stderr || build.error).slice(0, 120) + ")");

console.log(failed ? `${failed} FAILED` : "all passed");
process.exit(failed ? 1 : 0);
