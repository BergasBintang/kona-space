// Do the built-in skills uu-pdp-audit and write-terms-and-privacy reach Bejo (Security) and change what he does? Real conversations (Sonnet, a few cents to a dollar) in a THROWAWAY project: a tiny
// sign-up service with made-up flaws (a quick hash for passwords, an ID number in plain text, a religion field nobody uses, no consent record, no way to delete, data sent to an analytics service abroad).
// Turn 1: Bejo audits it and answers in the chat, changing nothing (the skill says: report, never fix, save a file only when asked). Turn 2: Bejo writes the terms and the privacy notice into two files
// from what the product really does, with no company name known. The test looks at the files, at the reply, and at what he really did (the skills used, the reference files opened).
// Start Kona with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223 and no other window of yours open on that profile, then   node tests/pdp-skills.mjs
// It removes the project, the folder and the saved conversation at the end, and keeps the replies and the two files in the temp folder (kona-pdp-results) for you to read.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const NAME = "kona-pdp-probe";
const root = path.join(os.tmpdir(), `kona-pdp-${process.pid}`);
const proj = path.join(root, "project");
const slug = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
const before = await invoke("list_projects");
let account = null;

const FILES = {
  "README.md": "# Belajar Bareng\n\nA small tutoring marketplace for Indonesian students. Students sign up, book a tutor and pay by bank transfer. Students are from age 13.\n",
  "src/db.js": "export const tables = {\n  users: ['id', 'full_name', 'email', 'phone', 'nik', 'religion', 'birth_date', 'password_md5', 'created_at'],\n  bookings: ['id', 'user_id', 'tutor_id', 'time', 'price'],\n};\nexport const insertUser = (u) => run('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)', Object.values(u));\n",
  "src/signup.js": "import crypto from 'node:crypto';\nimport { insertUser } from './db.js';\nimport { track } from './analytics.js';\n\nexport function signup(req, res) {\n  const b = req.body; // name, email, phone, nik, religion, birth_date, password\n  const user = { id: crypto.randomUUID(), full_name: b.name, email: b.email, phone: b.phone, nik: b.nik, religion: b.religion, birth_date: b.birth_date,\n    password_md5: crypto.createHash('md5').update(b.password).digest('hex'), created_at: Date.now() };\n  insertUser(user);\n  console.log('new user', user.email, user.phone, user.nik);\n  track('signup', { email: user.email, name: user.full_name, birth_date: user.birth_date });\n  res.status(201).json({ ok: true });\n}\n",
  "src/analytics.js": "// events go to our analytics service, hosted in the United States\nexport const track = (event, data) => fetch('https://events.analytics-example.com/v1/track', { method: 'POST', body: JSON.stringify({ event, data }) });\n",
  "src/routes.js": "import { signup } from './signup.js';\nexport const routes = [['POST', '/signup', signup], ['POST', '/login', login], ['GET', '/bookings', listBookings]];\n// there is no route to export, correct or delete a person's data\n",
};
const read = (f) => fs.readFileSync(path.join(proj, f), "utf8");

try {
  for (const [f, t] of Object.entries(FILES)) { fs.mkdirSync(path.dirname(path.join(proj, f)), { recursive: true }); fs.writeFileSync(path.join(proj, f), t); }
  for (const a of await invoke("list_accounts")) { if ((await invoke("account_status", { id: a.id })).logged_in) { account = a; break; } }
  if (!account) throw new Error("no signed-in account");
  const id = (await invoke("add_project", { folder: proj, name: NAME, account: account.id })).project.id;
  const roles = await invoke("list_roles");
  const who = roles.find((r) => r.id === "security");
  const label = `${who.person}, ${who.name}`;
  for (const s of ["uu-pdp-audit", "write-terms-and-privacy"]) ok(`the new project got ${s}, with its files`, fs.existsSync(path.join(proj, ".kona", "skills", s, "SKILL.md")) && fs.readdirSync(path.join(proj, ".kona", "skills", s, "references")).length >= 1);
  const kits = JSON.parse(fs.readFileSync(path.join(proj, ".kona", "role-kits.json"), "utf8"));
  ok(`both are in the tree of ${who.person} (Security)`, ["uu-pdp-audit", "write-terms-and-privacy"].every((s) => JSON.stringify(kits.security).includes(s)));

  await c.send("Page.reload"); await wait(1500);
  await c.waitFor("document.body.innerText.includes('Welcome to Kona')", 20000, 200);
  const click = `(() => { const isOpen = (x) => /^Open$/.test(x.textContent.trim()); const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(NAME)}); if (!title) return false; let n = title; while (n && ![...n.querySelectorAll('button')].some(isOpen)) n = n.parentElement; const b = n && [...n.querySelectorAll('button')].find(isOpen); if (!b || b.disabled) return false; b.click(); return true; })()`;
  ok("the throwaway project opens", await c.waitFor(click, 15000, 300) && await c.waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(NAME)})`, 15000, 200));
  await c.waitFor(`document.querySelectorAll('[aria-label^="Open "]').length >= 21`, 20000, 200);
  await c.ev(`document.querySelector('[aria-label="Open ${label}"]').click(); true`);
  const sheet = `section[data-sheet]:not([hidden])`;
  await c.waitFor(`document.querySelector('${sheet}')?.getAttribute('aria-label') === ${JSON.stringify(label)}`, 6000, 100);

  /** say something through the box, like a person, allow what asks, and wait until the answer is done */
  const say = async (text) => {
    await c.ev(`document.querySelector('${sheet} textarea').focus(); true`);
    await c.send("Input.insertText", { text }); await wait(300);
    await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
    await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    const t0 = Date.now(); let done = false;
    await wait(4000);
    while (Date.now() - t0 < 420000 && !done) {
      await wait(3000);
      await c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} button')].find((x) => x.textContent.trim() === 'Allow once' && !x.disabled); if (b) b.click(); return !!b; })()`);
      done = await c.ev(`(() => { const bs = [...document.querySelectorAll('${sheet} button')].map((b) => b.textContent.trim()); return bs.includes('Send') && !bs.includes('Stop'); })()`);
    }
    await wait(1500);
    return done;
  };
  const sheetText = () => c.ev(`document.querySelector('${sheet}').innerText`);
  const toolUses = () => {
    const dir = path.join(account.config_dir ?? path.join(os.homedir(), ".claude"), "projects", slug(proj));
    const file = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dir, f))[0];
    const uses = [];
    for (const line of fs.readFileSync(file, "utf8").split(String.fromCharCode(10))) {
      try { const j = JSON.parse(line); if (j.type === "assistant") for (const b of j.message.content ?? []) if (b.type === "tool_use") uses.push(b.name + " " + JSON.stringify(b.input)); } catch {}
    }
    return uses;
  };
  fs.mkdirSync(path.join(os.tmpdir(), "kona-pdp-results"), { recursive: true });
  const out = path.join(os.tmpdir(), "kona-pdp-results");

  // 1. the audit: report in the chat, change nothing
  if (!process.env.ONLY_WRITING) {
  ok("the audit turn finished", await say("Do a UU PDP audit of this project. Answer in this chat with the report. Do not change or create any file, and do not run anything."));
  const r1 = await sheetText();
  fs.writeFileSync(path.join(out, "turn1-audit-reply.txt"), r1);
  const u1 = toolUses();
  const used1 = (s) => u1.some((u) => u.includes(s));
  console.log("   tool calls (turn 1): " + u1.map((u) => u.split(" ")[0]).join(" -> "));
  ok("the audit skill was used", used1("uu-pdp-audit"));
  ok("the checklist was opened", used1("uu-pdp-checklist.md"));
  ok("the report template was opened", used1("audit-report.md"));
  ok("nothing was written or run (report only)", !u1.some((u) => /^(Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell)\b/.test(u)), u1.filter((u) => /^(Write|Edit|MultiEdit|Bash|PowerShell)\b/.test(u)).map((u) => u.slice(0, 80)).join(" | "));
  const lo = r1.toLowerCase();
  ok("the plain-hash password problem was found", /md5/.test(lo));
  ok("the ID number (NIK) problem was found", /nik/.test(lo));
  ok("the unused religion field was found (collection limit)", /religion|agama/.test(lo));
  ok("missing consent was found", /consent|persetujuan/.test(lo));
  ok("missing deletion or rights was found", /delet|erasure|hapus|export|rights|hak/.test(lo));
  ok("the data sent to the analytics service abroad was found", /analytics/.test(lo) && /abroad|united states|outside indonesia|luar negeri|transfer|cross-border|56/.test(lo));
  ok("students aged 13 and up were noticed (children)", /child|anak|13|minor|parent|orang tua|wali/.test(lo));
  ok("the leak notice is 3 x 24 hours, not 14 days", (/3\s*x\s*24|3×24|72 hours|3 x 24/.test(lo)) && !/14[ -]?(calendar )?days|14 hari/.test(lo));
  ok("it gives ratings and says what cannot be told from the code", /cannot tell|can't tell|unknown|tidak dapat dipastikan|tidak bisa dipastikan/.test(lo));
  ok("it does not say the project complies", !/is compliant with uu pdp|fully compliant|sudah patuh|sudah sesuai dengan uu pdp/.test(lo));
  ok("it says it is not legal advice", /not legal advice|bukan nasihat hukum|legal advice|lawyer|pengacara|penasihat hukum/.test(lo));
  ok("no file of the project was changed", Object.entries(FILES).every(([f, t]) => read(f) === t) && !fs.existsSync(path.join(proj, "pdp_audit_report.md")));

  }
  // 2. the terms and the privacy notice, from what the product really does
  ok("the writing turn finished", await say("Sekarang tulis Syarat dan Ketentuan dan Kebijakan Privasi untuk produk ini, dalam bahasa Indonesia. Simpan sebagai terms.md dan privacy.md di folder utama. Nama perusahaan dan alamatnya belum ditentukan. Jangan membuat tiket dan jangan mengubah file lain."));
  fs.writeFileSync(path.join(out, "turn2-writing-reply.txt"), await sheetText());
  ok("terms.md and privacy.md exist", fs.existsSync(path.join(proj, "terms.md")) && fs.existsSync(path.join(proj, "privacy.md")));
  const terms = fs.existsSync(path.join(proj, "terms.md")) ? read("terms.md") : "";
  const priv = fs.existsSync(path.join(proj, "privacy.md")) ? read("privacy.md") : "";
  if (terms) fs.writeFileSync(path.join(out, "terms.md"), terms);
  if (priv) fs.writeFileSync(path.join(out, "privacy.md"), priv);
  const u2 = toolUses();
  const used2 = (s) => u2.some((u) => u.includes(s));
  console.log("   tool calls (all): " + u2.map((u) => u.split(" ")[0]).join(" -> "));
  const both = (terms + "\n" + priv);
  ok("the writing skill was used", used2("write-terms-and-privacy"));
  ok("the facts sheet was opened", used2("facts-sheet.md"));
  // a worker may read the references with one shell command and a wildcard, so the file name is then not in the record: count that too, and say so
  ok("the notice parts were opened (by name, or by a shell command over the references folder)", used2("notice-parts.md") || u2.some((u) => /^Bash/.test(u) && /references/.test(u)));
  ok("the Indonesian humanizer was used on the finished text", used2("humanize-indonesian"));
  ok("the humanizer opened its reference files", used2("tells-id.md") || used2("registers.md") || used2("official-rules.md"));
  const ln = priv.split(String.fromCharCode(10));
  ok("the [TBD] marks survived the polish (company and address still open, and many more)", (both.match(/\[TBD/g) ?? []).length >= 12 && /\[TBD: nama perusahaan/i.test(both));
  ok("the parts the law asks for are still in the privacy notice (basis, purpose, data, retention, rights, the 3 x 24 hours)", /dasar/i.test(priv) && /untuk apa|tujuan/i.test(priv) && /nomor telepon/i.test(priv) && /disimpan/i.test(priv) && /hak anda/i.test(priv) && /3 x 24/.test(priv));
  ok("every team note still starts the agreed way", ln.filter((l) => l.startsWith("> ")).every((l) => /catatan untuk tim, hapus sebelum terbit/i.test(l)), ln.filter((l) => l.startsWith("> ") && !/catatan untuk tim, hapus sebelum terbit/i.test(l)).join(" | ").slice(0, 200));
  ok("no bare promise that the company records consent or requests (only TBD, today-lines or notes)", !ln.some((l) => /kami mencatat (siapa|permintaan)/i.test(l) && !/\[TBD|hari ini|catatan/i.test(l)), ln.filter((l) => /kami mencatat (siapa|permintaan)/i.test(l)).join(" | ").slice(0, 240));
  ok("what is not known is marked TBD, not invented (company name and address)", /\[TBD/.test(both) && !/\bPT\s+[A-Z][a-z]+/.test(both) && !/\bCV\s+[A-Z][a-z]+/.test(both) && !/Jl\.\s/.test(both));
  ok("the privacy notice names the real data (NIK, phone, birth date)", /nik/i.test(priv) && /(telepon|nomor ponsel|phone|hp)/i.test(priv) && /tanggal lahir/i.test(priv));
  ok("consent is its own choice, unticked", /- \[ \]/.test(priv));
  ok("the analytics service abroad is told, or marked to decide", /(amerika|united states|luar negeri|luar indonesia|AS\b)/i.test(priv) || /analitik/i.test(priv) && /\[TBD/.test(priv));
  ok("it does not claim encryption the code does not do", !/(dienkripsi|terenkripsi|enkripsi)/i.test(both.split("\n").filter((l) => !/\[TBD|catatan untuk tim/i.test(l)).join("\n")));
  ok("it does not promise deletion the product cannot do yet (no deletion line without TBD)", !both.split("\n").some((l) => /(hapus|dimusnahkan|pemusnahan)/i.test(l) && /(3 x 24|30 hari|dalam .* hari)/i.test(l) && !/\[TBD/.test(l)));
  ok("it does not say it complies with UU PDP", !/sesuai dengan (uu|undang-undang) (pdp|nomor 27)|mematuhi uu pdp|memenuhi uu pdp/i.test(both));
  ok("it does not promise \"100% aman\"", !/100\s*%\s*aman/i.test(both));
  ok("children are handled (students from 13: a parent or guardian step, or TBD)", /(orang tua|wali)/i.test(both));
  const r2 = (await sheetText()).toLowerCase();
  ok("the reply lists the open questions and the promises that need a fix first", /(tbd|belum|pertanyaan|perlu ditentukan)/.test(r2) && /(tiket|ticket|perbaik|sebelum|belum bisa|fix)/.test(r2));
  ok("the project's own files are untouched", Object.entries(FILES).every(([f, t]) => read(f) === t));
  console.log("   (the replies and the two files were saved in the temp folder, kona-pdp-results, for you to read)");
  void id;
} catch (e) { console.log("FAIL the test stopped: " + String(e.stack ?? e).slice(0, 500)); failed++; }
finally {
  try { for (const x of (await invoke("leftovers")).sessions ?? []) await invoke("stop_session", { sessionId: x.id }); } catch {}
  await wait(2500);
  try { for (const p of await invoke("list_projects")) if (p.name === NAME) await invoke("remove_project", { id: p.id }); } catch (e) { console.log("could not remove the project: " + e); }
  try { const dir = path.join(account?.config_dir ?? path.join(os.homedir(), ".claude"), "projects"); for (const n of fs.readdirSync(dir)) if (n.toLowerCase().includes(slug(root).toLowerCase())) fs.rmSync(path.join(dir, n), { recursive: true, force: true }); } catch {}
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  try { const f = await invoke("list_projects"); ok("the project list is as it was, and the folder is gone", JSON.stringify(f.map((p) => p.id)) === JSON.stringify(before.map((p) => p.id)) && !fs.existsSync(root)); } catch {}
  c.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
