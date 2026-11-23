// Do the built-in skills humanize-text and humanize-indonesian reach a person and change what they write? Real conversations (Sonnet, a few cents to a dollar) in a THROWAWAY project: the Content person is
// asked to fix four files, one at a time, in one conversation: an Indonesian post full of tells, an English post full of tells, a formal Indonesian letter that has none (it must stay as it is), and a thin Indonesian
// bio (nothing may be invented). The test looks at the files that come out, at what the person really did (the skill used, the reference files opened) and at the facts (every number and name of the source is kept, no
// new number is added). Start Kona with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223 and no other window of yours open on that profile, then   node tests/humanize-skills.mjs
// It removes the project, the folder and the saved conversation at the end, and keeps the four results in the temp folder (kona-humanize-results) for you to read.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { attach } from "./cdp.mjs";

const c = await attach(Number(process.env.PORT ?? 9223));
const invoke = (cmd, args = {}) => c.ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, v, detail = "") => { console.log((v ? "PASS " : "FAIL ") + name + (detail !== "" ? "  [" + detail + "]" : "")); if (!v) failed++; };
const NAME = "kona-humanize-probe";
const root = path.join(os.tmpdir(), `kona-humanize-${process.pid}`);
const proj = path.join(root, "project");
const slug = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
const before = await invoke("list_projects");
let account = null;

const POST_ID = "Di era digital saat ini, Toko Sinar Jaya merupakan salah satu toko yang krusial bagi warga Bandung. Tidak dapat dipungkiri bahwa penjualan meningkat sebesar 4,5% pada 12 Maret 2026, yang mana hal tersebut menjadi bukti nyata dari kerja keras tim. Meskipun harga naik menjadi Rp25.000, tetapi pelanggan tetap setia. Dalam rangka untuk melakukan peningkatan layanan terhadap pelanggan, Bu Rina memberikan pelatihan kepada para karyawan-karyawan. Penting untuk dicatat bahwa pelatihan ini bertujuan untuk meningkatkan kualitas, efisiensi, dan kepuasan. Semoga bermanfaat!\n";
const POST_EN = "We're thrilled to announce Version 4.2, a game-changing update that seamlessly transforms how teams collaborate. It's not just a new feature, it's a whole new way of working. Released on March 12, it cuts sync time by 30%, delivering robust performance, an intuitive design, and a vibrant experience. Let us know what you think!\n";
const LETTER = "Dengan hormat, bersama surat ini kami mengajukan permohonan perpanjangan izin usaha untuk periode 2027. Berkas terlampir sesuai ketentuan. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.\n";
const BIO = "Maria adalah seorang desainer yang berdedikasi dan telah memainkan peran penting dalam membentuk lanskap desain digital. Karyanya telah diakui secara luas, menegaskan komitmennya terhadap keunggulan.\n";
const nums = (s) => new Set(s.match(/\d[\d.,]*\d|\d/g) ?? []);
const read = (f) => fs.readFileSync(path.join(proj, f), "utf8");

try {
  fs.mkdirSync(proj, { recursive: true });
  for (const [f, t] of [["post-id.md", POST_ID], ["post-en.md", POST_EN], ["clean-id.md", LETTER], ["bio-id.md", BIO]]) fs.writeFileSync(path.join(proj, f), t);
  for (const a of await invoke("list_accounts")) { if ((await invoke("account_status", { id: a.id })).logged_in) { account = a; break; } }
  if (!account) throw new Error("no signed-in account");
  const id = (await invoke("add_project", { folder: proj, name: NAME, account: account.id })).project.id;
  const roles = await invoke("list_roles");
  const who = roles.find((r) => r.id === "content");
  const label = `${who.person}, ${who.name}`;
  for (const s of ["humanize-text", "humanize-indonesian"]) ok(`the new project got ${s}, with its reference files`, fs.existsSync(path.join(proj, ".kona", "skills", s, "SKILL.md")) && fs.readdirSync(path.join(proj, ".kona", "skills", s, "references")).length >= 2);
  const kits = JSON.parse(fs.readFileSync(path.join(proj, ".kona", "role-kits.json"), "utf8"));
  ok(`both are in the tree of ${who.person} (Content)`, ["humanize-text", "humanize-indonesian"].every((s) => JSON.stringify(kits.content).includes(s)));

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
    while (Date.now() - t0 < 300000 && !done) {
      await wait(3000);
      await c.ev(`(() => { const b = [...document.querySelectorAll('${sheet} button')].find((x) => x.textContent.trim() === 'Allow once' && !x.disabled); if (b) b.click(); return !!b; })()`);
      done = await c.ev(`(() => { const bs = [...document.querySelectorAll('${sheet} button')].map((b) => b.textContent.trim()); return bs.includes('Send') && !bs.includes('Stop'); })()`);
    }
    await wait(1500);
    return done;
  };

  // 1. the Indonesian post
  ok("the Indonesian turn finished", await say("Tulisan post-id.md terdengar seperti buatan mesin dan seperti terjemahan. Perbaiki isinya langsung di file itu. Ubah file itu saja dan jangan menjalankan apa pun. Setelah selesai, katakan dalam dua kalimat apa yang kamu ubah."));
  const id1 = read("post-id.md");
  const low = id1.toLowerCase();
  ok("the Indonesian post changed", id1 !== POST_ID && id1.length > 120, `${id1.length} letters`);
  ok("every name and figure of the source is still there", ["Toko Sinar Jaya", "Bandung", "4,5%", "12 Maret 2026", "Rp25.000", "Bu Rina"].every((x) => id1.includes(x)), ["Toko Sinar Jaya", "Bandung", "4,5%", "12 Maret 2026", "Rp25.000", "Bu Rina"].filter((x) => !id1.includes(x)).join(", "));
  const added1 = [...nums(id1)].filter((n) => !nums(POST_ID).has(n));
  ok("no new number was added", added1.length === 0, added1.join(" "));
  ok("\"yang mana\" and \"di mana\" are gone as connectors", !/yang mana|, di mana /.test(low));
  ok("the stacked pair \"meskipun … tetapi\" is gone", !/meskipun[^.]*, tetapi/.test(low));
  ok("\"dalam rangka untuk\", \"adalah merupakan\" and the doubled plural are gone", !/dalam rangka untuk|adalah merupakan|karyawan-karyawan/.test(low));
  ok("the stock opener, the \"perlu dicatat\" phrase and the chat closer are gone", !/di era digital|penting untuk dicatat|tidak dapat dipungkiri|semoga bermanfaat/.test(low));

  // 2. the English post
  ok("the English turn finished", await say("post-en.md reads like a machine wrote it. Fix it in the file. Edit that file only and do not run anything. When you are done, say in two sentences what you changed."));
  const en1 = read("post-en.md"); const lowE = en1.toLowerCase();
  ok("the English post changed", en1 !== POST_EN && en1.length > 80, `${en1.length} letters`);
  ok("Version 4.2, March 12 and 30% are still there", ["4.2", "March 12", "30%"].every((x) => en1.includes(x)), ["4.2", "March 12", "30%"].filter((x) => !en1.includes(x)).join(", "));
  const addedE = [...nums(en1)].filter((n) => !nums(POST_EN).has(n));
  ok("no new number was added", addedE.length === 0, addedE.join(" "));
  ok("no benefit or consequence the source does not state was added (\"so teams wait less\")", !/so teams|less time|saves? time|waiting|faster|easier/.test(lowE), en1.slice(0, 200));
  ok("the inflated words, the not-X-but-Y and the chat closer are gone", !/game-changing|seamless|thrilled|it's not just|robust|vibrant/.test(lowE), en1.slice(0, 200));

  // 3. a letter with nothing to fix
  ok("the letter turn finished", await say("Periksa clean-id.md. Kalau ada yang perlu diperbaiki karena terdengar seperti buatan mesin, perbaiki langsung di file. Kalau tidak ada, jangan ubah apa pun dan katakan begitu. Jangan menjalankan apa pun."));
  ok("the formal letter is exactly as it was (nothing to fix)", read("clean-id.md") === LETTER);

  // 4. a thin bio: nothing may be invented
  ok("the bio turn finished", await say("Perbaiki bio-id.md yang terdengar seperti buatan mesin. Ubah file itu saja dan jangan menjalankan apa pun."));
  const bio1 = read("bio-id.md");
  ok("the bio changed, and no number or year was invented", bio1 !== BIO && nums(bio1).size === 0, bio1.slice(0, 200));
  ok("the inflated words are gone", !/berdedikasi|memainkan peran penting|lanskap|keunggulan|diakui secara luas/.test(bio1.toLowerCase()), bio1.slice(0, 200));
  const lastReply = await c.ev(`(() => { const t = document.querySelector('${sheet}').innerText; return t.slice(-700); })()`);
  ok("the person asked for the missing details instead of inventing them", /\?|butuh|beri tahu|memberi|tolong|kirim|fakta|bisa kamu|bisa Anda/i.test(lastReply), lastReply.replace(/\s+/g, " ").slice(-260));

  // what the person really did, from the saved conversation
  const dir = path.join(account.config_dir ?? path.join(os.homedir(), ".claude"), "projects", slug(proj));
  const file = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dir, f))[0];
  const uses = [];
  for (const line of fs.readFileSync(file, "utf8").split(String.fromCharCode(10))) {
    try { const j = JSON.parse(line); if (j.type === "assistant") for (const b of j.message.content ?? []) if (b.type === "tool_use") uses.push(b.name + " " + JSON.stringify(b.input)); } catch {}
  }
  const used = (s) => uses.some((u) => u.includes(s));
  console.log("   tool calls: " + uses.map((u) => u.split(" ")[0]).join(" -> "));
  ok("the Indonesian skill was used (the skill tool, or its files)", used("humanize-indonesian"));
  ok("the Indonesian references were opened (the tells, the rules or the registers)", used("tells-id.md") || used("official-rules.md") || used("registers.md"));
  ok("the English skill was used", used("humanize-text"));
  ok("the English tells were opened", used("english-tells.md"));
  fs.mkdirSync(path.join(os.tmpdir(), "kona-humanize-results"), { recursive: true });
  for (const f of ["post-id.md", "post-en.md", "clean-id.md", "bio-id.md"]) fs.writeFileSync(path.join(os.tmpdir(), "kona-humanize-results", f), read(f));
  console.log("   (the four results were saved in the temp folder, kona-humanize-results, for you to read)");
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
