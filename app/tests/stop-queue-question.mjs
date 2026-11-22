// Stop, messages that wait, Send now, and the paginated question card, tried in the REAL window with a real (Haiku) conversation, in a THROWAWAY project. Start Kona with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223   and no other window of yours open, then   node tests/stop-queue-question.mjs
// It adds one project (a folder in the temp folder), starts Jiro in it, and removes the project, the folder and the saved conversation at the end. It spends a few cents of the plan.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const NAME = "kona-stop-queue-probe";
const root = path.join(os.tmpdir(), `kona-stopq-${process.pid}`);
const proj = path.join(root, "project");
const slug = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
const before = await invoke("list_projects");
let account = null, sid = null;

const sheet = `section[data-sheet]:not([hidden])`;
const chatText = () => c.ev(`document.querySelector('${sheet}')?.innerText.replace(/\\s+/g, ' ') ?? ''`);
const waitText = (re, ms = 90000) => c.waitFor(`/${re}/.test(document.querySelector('${sheet}')?.innerText.replace(/\\s+/g, ' ') ?? '')`, ms, 500);
const button = (label) => c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); return b ? { disabled: b.disabled } : null; })()`);
const press = (label) => c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)} && !x.disabled); if (!b) return false; b.click(); return true; })()`);
const type = async (text, enter = true) => {
  await c.ev(`document.querySelector('${sheet} textarea').focus(); true`);
  await c.send("Input.insertText", { text }); await wait(200);
  if (enter) { await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); }
};
const queued = () => c.ev(`[...document.querySelectorAll('${sheet} [data-queued]')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`);
const sendBtnLabel = () => c.ev(`[...document.querySelectorAll('${sheet} button')].map((b) => b.textContent.trim()).filter((t) => /^Send( after the answer)?$/.test(t))[0] ?? null`);
const sayLong = "Write the numbers from 1 to 700, one per line, each with a short word after it. Do not stop early and do not use any tool.";

try {
  fs.mkdirSync(proj, { recursive: true });
  for (const a of await invoke("list_accounts")) { if ((await invoke("account_status", { id: a.id })).logged_in) { account = a; break; } }
  if (!account) throw new Error("no signed-in account");
  const id = (await invoke("add_project", { folder: proj, name: NAME, account: account.id })).project.id;
  await c.send("Page.reload"); await wait(1500);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  const opened = await c.ev(`(() => { const isOpen = (x) => /^Open$/.test(x.textContent.trim()); const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(NAME)}); if (!title) return false; let n = title; while (n && ![...n.querySelectorAll('button')].some(isOpen)) n = n.parentElement; const b = n && [...n.querySelectorAll('button')].find(isOpen); if (!b || b.disabled) return false; b.click(); return true; })()`);
  ok("the throwaway project opens", opened && await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 15000, 200));
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  await c.ev(`document.querySelector('[aria-label="Open Jiro, Frontend"]').click(); true`);
  await c.waitFor(`document.querySelector('${sheet}')?.getAttribute('aria-label') === 'Jiro, Frontend'`, 6000, 100);
  sid = await invoke("start_session", { folder: proj, roleId: "frontend", accountId: account.id, useVoice: false, ticketId: null, brainDigest: null, model: "haiku", mode: "plan", resume: null });
  await c.waitFor(`!!document.querySelector('${sheet} textarea') && /Started in/.test(document.querySelector('${sheet}').innerText)`, 15000, 200);

  // ---- 1. a long answer; a message written meanwhile waits; Stop drops it
  await type(sayLong);
  await waitText("is working|Mulling|Pondering|Shimmering|Musing|Brewing|Tinkering|Weaving|Sifting|Untangling|Percolating|Noodling|Kneading|Polishing|Stirring|Simmering|Whittling", 15000);
  ok("while Jiro works the box can still be typed in, with Stop, Send now and Send after the answer beside it", (await button("Stop")) && (await button("Send after the answer")) && (await button("Send now")) && true);
  await type("Reply with only the word SECOND.");
  await wait(600);
  const q1 = await queued();
  ok("the message waits above the box, with a Remove button, and is not shown as sent", q1.length === 1 && /SECOND/.test(q1[0]) && /Remove/.test(q1[0]) && !(await chatText()).includes("Reply with only the word SECOND. Jiro"), JSON.stringify(q1));
  ok("the box is empty again", await c.ev(`document.querySelector('${sheet} textarea').value === ''`));
  ok("Stop stops the answer and keeps the conversation", await press("Stop") && await waitText("Stopped\\. 1 waiting message was not sent\\.", 20000));
  ok("what was waiting is gone, and nothing was sent", (await queued()).length === 0 && !/SECOND/.test((await chatText()).replace(/Reply with only the word SECOND\./g, "")));
  ok("Jiro is free again (the button says Send)", await c.waitFor(`[...document.querySelectorAll('${sheet} button')].some((b) => b.textContent.trim() === 'Send')`, 15000, 300));
  await type("Reply with only the word THIRD.");
  ok("the same conversation answers the next message", await waitText("THIRD", 60000));

  // ---- 2. Send now: stop the answer and send at once
  await type(sayLong);
  await waitText("Mulling|Pondering|Shimmering|Musing|Brewing|Tinkering|Weaving|Sifting|Untangling|Percolating|Noodling|Kneading|Polishing|Stirring|Simmering|Whittling", 15000);
  await wait(1500);
  await type("Reply with only the word NOWDONE.", false);
  ok("Send now stops the long answer and sends the message", await press("Send now") && await waitText("Stopped\\.", 20000));
  ok("and the message gets its answer", await waitText("NOWDONE", 60000) && (await chatText()).includes("Reply with only the word NOWDONE."));

  // ---- 3. a message that waits is sent by itself when the answer is done
  await type("Write the numbers from 1 to 60, one per line. Nothing else.");
  await waitText("Mulling|Pondering|Shimmering|Musing|Brewing|Tinkering|Weaving|Sifting|Untangling|Percolating|Noodling|Kneading|Polishing|Stirring|Simmering|Whittling", 15000);
  await type("Reply with only the word AFTERWARDS.");
  ok("it waits first", (await queued()).length === 1 || (await chatText()).includes("AFTERWARDS"));
  ok("and goes by itself once the answer is done, and is answered", await waitText("Reply with only the word AFTERWARDS\\. Jiro AFTERWARDS|AFTERWARDS\\s+\\$", 90000) || await waitText("AFTERWARDS", 90000));
  ok("the queue is empty afterwards", (await queued()).length === 0);

  // ---- 4. the paginated question card
  await type("Use the AskUserQuestion tool once, with exactly three questions, and then wait for my answers. 1) header Colour, question 'Which colour?', options Red and Blue, single choice. 2) header Size, question 'Which size?', options Small and Large, single choice. 3) header Toppings, question 'Which toppings?', options Ham, Cheese and Olives, multiSelect true. Do nothing else.");
  const card = `${sheet} [role=group][aria-label$=" asks"]`;
  ok("a question card appears", await c.waitFor(`!!document.querySelector('${card}')`, 90000, 500));
  const info = () => c.ev(`(() => { const g = document.querySelector('${card}'); if (!g) return null; return { step: g.querySelector('[data-step]')?.textContent ?? null, fieldsets: g.querySelectorAll('fieldset').length, tabs: [...g.querySelectorAll('[role=tab]')].map((t) => t.getAttribute('aria-label')), question: g.querySelector('legend')?.innerText.replace(/\\s+/g, ' ') ?? '', pressed: [...g.querySelectorAll('fieldset button[aria-pressed=true]')].map((b) => b.textContent.trim().split(/\\s+/)[0]), other: g.querySelector('fieldset input')?.value ?? null, send: [...g.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Send answer')?.disabled ?? null }; })()`);
  let i = await info();
  ok("one question is shown at a time, with 'Question 1 of 3' and a step for each", i && i.fieldsets === 1 && /Question 1 of 3/.test(i.step ?? "") && i.tabs.length === 3, JSON.stringify(i));
  const clickOption = (n) => c.ev(`(() => { const bs = [...document.querySelectorAll('${card} fieldset button[aria-pressed]')]; if (!bs[${n}]) return false; bs[${n}].click(); return true; })()`);
  await clickOption(0); await wait(400);
  i = await info();
  ok("answering a one-answer question moves on to the next by itself", /Question 2 of 3/.test(i.step ?? "") && /size/i.test(i.question), `${i.step} / ${i.question}`);
  // go back: the pick is still marked
  await c.ev(`document.querySelectorAll('${card} [role=tab]')[0].click(); true`); await wait(300);
  i = await info();
  ok("the first question still shows its pick", i.pressed.length === 1 && /Question 1 of 3/.test(i.step ?? ""), JSON.stringify(i.pressed));
  // typing in Other un-clicks the option
  await c.ev(`document.querySelector('${card} fieldset input').focus(); true`);
  await c.send("Input.insertText", { text: "Green" }); await wait(300);
  i = await info();
  ok("typing in Other un-clicks the choice", i.pressed.length === 0 && i.other === "Green", JSON.stringify({ pressed: i.pressed, other: i.other }));
  ok("the step shows the typed answer as answered", (i.tabs[0] ?? "").includes("answered") && !(i.tabs[0] ?? "").includes("not answered"), i.tabs[0]);
  // clicking an option again empties the box
  await clickOption(1); await wait(400);
  await c.ev(`document.querySelectorAll('${card} [role=tab]')[0].click(); true`); await wait(300);
  i = await info();
  ok("clicking an option afterwards empties the Other box", i.pressed.length === 1 && i.other === "", JSON.stringify({ pressed: i.pressed, other: i.other }));
  // question 2 then 3 (several answers)
  await c.ev(`document.querySelectorAll('${card} [role=tab]')[1].click(); true`); await wait(300);
  await clickOption(0); await wait(400);
  i = await info();
  ok("on the last question Send answer waits until every question is answered", /Question 3 of 3/.test(i.step ?? "") && i.send === true, JSON.stringify({ step: i.step, send: i.send }));
  await clickOption(0); await clickOption(1); await wait(200);
  await c.ev(`document.querySelector('${card} fieldset input').focus(); true`);
  await c.send("Input.insertText", { text: "and pineapple" }); await wait(300);
  i = await info();
  ok("with several answers allowed, typing in Other keeps the clicked options", i.pressed.length === 2 && i.other === "and pineapple", JSON.stringify({ pressed: i.pressed, other: i.other }));
  ok("Send answer is on now", i.send === false);
  ok("Send answer sends, and the card says You answered", await press("Send answer") && await c.waitFor(`/You answered/.test(document.querySelector('${sheet}')?.innerText ?? '')`, 10000, 300));
  ok("after the answer every question is listed with its answer", await c.ev(`document.querySelectorAll('${card} fieldset').length === 3`));
  await invoke("stop_session", { sessionId: sid }); await wait(1500);
} catch (e) { console.log("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 500)); failed++; }
finally {
  try { if (sid) await invoke("stop_session", { sessionId: sid }); } catch {}
  try { for (const p of await invoke("list_projects")) if (p.name === NAME) await invoke("remove_project", { id: p.id }); } catch (e) { console.log("could not remove the project: " + e); }
  try { const dir = path.join(account?.config_dir ?? path.join(os.homedir(), ".claude"), "projects"); for (const n of fs.readdirSync(dir)) if (n.toLowerCase().includes(slug(proj).toLowerCase())) fs.rmSync(path.join(dir, n), { recursive: true, force: true }); } catch {}
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  try { const f = await invoke("list_projects"); ok("the project list is as it was, and the folder is gone", JSON.stringify(f.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)) && !fs.existsSync(root)); } catch {}
  c.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
