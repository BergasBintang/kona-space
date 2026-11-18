// The window tests that answer the browser's location question ("Just this time") leave one entry in Kona's own browser profile: the question is not asked again for Kona's window (WebView2 keeps the answer, which the
// owner would also get by pressing Allow). This takes that entry out again so the next run, and the owner's own Live cards, are asked afresh. It only touches the one entry `geolocation` of `http://tauri.localhost`,
// keeps a copy of the file next to it (Preferences.before-forget-location), and refuses to run while Kona or its browser engine is open, because the engine rewrites the file when it closes.
//   node tests/forget-location.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const file = path.join(process.env.LOCALAPPDATA ?? "", "dev.kona.app", "EBWebView", "Default", "Preferences");
if (!fs.existsSync(file)) { console.log("no profile of Kona found, nothing to do"); process.exit(0); }
const tasks = execSync("tasklist /FO CSV /NH", { encoding: "utf8" });
if (/"app\.exe"/i.test(tasks)) { console.log("REFUSED: Kona (app.exe) is running; close it first, the browser engine writes this file when it closes"); process.exit(1); }
const prefs = JSON.parse(fs.readFileSync(file, "utf8"));
const geo = prefs?.profile?.content_settings?.exceptions?.geolocation ?? {};
const keys = Object.keys(geo).filter((k) => k.startsWith("http://tauri.localhost"));
if (keys.length === 0) { console.log("nothing to forget: Kona's window has no saved answer about the location"); process.exit(0); }
fs.copyFileSync(file, file + ".before-forget-location");
for (const k of keys) delete geo[k];
fs.writeFileSync(file, JSON.stringify(prefs));
console.log("forgot the saved answer about the location for " + keys.join(", ") + " (a copy of the old file: " + file + ".before-forget-location)");
