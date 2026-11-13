// The mock server of the mockup previewer (ticket T-0015, decisions 75 and 76 in kona-space-app.md).
//
// A mockup is a small folder of plain files (pages, styles, scripts, pictures, fonts, video) at `<project>/.kona/mockups/<card>/`. The sheet shows a page in an
// iframe loaded from the address scheme `mock`: `http://mock.localhost/<project-id>/<card>/<path>` on Windows, `mock://localhost/...` elsewhere. This module answers
// those requests, and nothing else:
//   - only files below the card's own folder are served (no `..`, no drive letters, no alternate data streams, no link or junction that leads out);
//   - every answer carries a Content-Security-Policy that lets the page run its own scripts and read its own files, and blocks everything else (no web, no forms),
//     and sandboxes the page into an opaque origin, so it cannot reach Kona's own window or its commands, even if the iframe's `sandbox` attribute were wrong;
//   - video and big files are answered in ranges.
// The two commands below list the cards of a project and the files of a card (the sheet reloads a page when a file changed).
use crate::{brain, brain_search};
use serde::Serialize;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const CSP: &str = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'self'; sandbox allow-scripts";
/// A file bigger than this is only answered to a range request (a video asks for ranges by itself)
const WHOLE_FILE_LIMIT: u64 = 64 * 1024 * 1024;
const MAX_FILES: usize = 2000;
const MAX_DEPTH: usize = 8;
const INFO_LIMIT: u64 = 1024 * 1024;

/// The address the sheet puts in front of `/<project-id>/<card>/<path>`
pub fn base() -> &'static str {
    if cfg!(windows) { "http://mock.localhost" } else { "mock://localhost" }
}

/// A project id or a card name: letters, digits, `-`, `_` and `.`, not starting with a dot
pub fn valid_name(s: &str) -> bool {
    !s.is_empty() && s.len() <= 80 && !s.starts_with('.') && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

/// The folder of a card, in its real form (links resolved), or none when it is not a plain folder inside `<project>/.kona/mockups`
pub fn card_root(project_folder: &Path, card: &str) -> Option<PathBuf> {
    if !valid_name(card) {
        return None;
    }
    let mockups = fs::canonicalize(project_folder.join(".kona").join("mockups")).ok()?;
    let root = fs::canonicalize(mockups.join(card)).ok()?;
    (root.starts_with(&mockups) && root.is_dir()).then_some(root)
}

struct Deny(u16, &'static str);

fn percent_decode(s: &str) -> Option<String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let h = std::str::from_utf8(b.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(h, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

const RESERVED: [&str; 22] = ["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"];

/// The file a request path names, inside `root` (a card folder in its real form). A folder answers with its `index.html`.
fn resolve(root: &Path, rel: &str) -> Result<PathBuf, Deny> {
    let decoded = percent_decode(rel).ok_or(Deny(400, "Bad address"))?;
    // a backslash, a colon (a drive letter or an alternate data stream) and a NUL never belong in a path inside a card
    if decoded.contains('\0') || decoded.contains('\\') || decoded.contains(':') {
        return Err(Deny(400, "Bad address"));
    }
    let mut rel_path = PathBuf::new();
    for seg in decoded.split('/') {
        match seg {
            "" | "." => {}
            ".." => return Err(Deny(403, "Not allowed")),
            s => {
                let stem = s.split('.').next().unwrap_or("").to_lowercase();
                if RESERVED.contains(&stem.as_str()) || s.ends_with(' ') || s.ends_with('.') {
                    return Err(Deny(403, "Not allowed"));
                }
                rel_path.push(s);
            }
        }
    }
    let mut real = fs::canonicalize(root.join(&rel_path)).map_err(|_| Deny(404, "Not found"))?;
    if real.is_dir() {
        real = fs::canonicalize(real.join("index.html")).map_err(|_| Deny(404, "Not found"))?;
    }
    // a link or a junction inside the card that points out of it ends up here
    if !real.starts_with(root) {
        return Err(Deny(403, "Not allowed"));
    }
    if !real.is_file() {
        return Err(Deny(404, "Not found"));
    }
    Ok(real)
}

pub fn mime(path: &Path) -> &'static str {
    match path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default().as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        "txt" | "md" => "text/plain; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "ogv" | "ogg" => "video/ogg",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

/// `bytes=a-b`, `bytes=a-` and `bytes=-n` (one range). `Ok(None)`: not a range we handle, answer the whole file. `Err`: cannot be satisfied.
fn parse_range(h: &str, size: u64) -> Result<Option<(u64, u64)>, ()> {
    let Some(spec) = h.trim().strip_prefix("bytes=") else { return Ok(None) };
    if spec.contains(',') {
        return Ok(None);
    }
    let Some((a, b)) = spec.split_once('-') else { return Ok(None) };
    let (a, b) = (a.trim(), b.trim());
    let (start, end) = if a.is_empty() {
        let n: u64 = b.parse().map_err(|_| ())?;
        if n == 0 { return Err(()); }
        (size.saturating_sub(n), size.saturating_sub(1))
    } else {
        let start: u64 = a.parse().map_err(|_| ())?;
        let end = if b.is_empty() { size.saturating_sub(1) } else { b.parse::<u64>().map_err(|_| ())?.min(size.saturating_sub(1)) };
        (start, end)
    };
    if size == 0 || start >= size || start > end {
        return Err(());
    }
    Ok(Some((start, end)))
}

pub struct Reply {
    pub status: u16,
    pub headers: Vec<(&'static str, String)>,
    pub body: Vec<u8>,
}

impl Reply {
    fn new(status: u16, body: Vec<u8>, extra: Vec<(&'static str, String)>) -> Reply {
        let mut headers = vec![
            ("Content-Security-Policy", CSP.to_string()),
            ("Access-Control-Allow-Origin", "*".to_string()),
            ("Cross-Origin-Resource-Policy", "cross-origin".to_string()),
            ("X-Content-Type-Options", "nosniff".to_string()),
            ("Cache-Control", "no-store".to_string()),
        ];
        headers.extend(extra);
        Reply { status, headers, body }
    }
    fn text(status: u16, msg: &str) -> Reply {
        Reply::new(status, msg.as_bytes().to_vec(), vec![("Content-Type", "text/plain; charset=utf-8".to_string())])
    }
    pub fn into_response(self) -> tauri::http::Response<Vec<u8>> {
        let mut b = tauri::http::Response::builder().status(self.status);
        for (k, v) in self.headers {
            b = b.header(k, v);
        }
        b.body(self.body).unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
    }
}

/// What every page gets, put in by `inject_helper`: the way the sheet talks to a page that runs in an opaque frame it cannot reach into. It sets the theme
/// (`data-theme` and `color-scheme` on the page's root, from `?kona-theme=dark|light` at once and from the sheet's message later, so the next page of the card follows too),
/// passes Ctrl and the wheel and Esc up to the sheet (a frame keeps those to itself), and says it is ready. Messages from the sheet are taken only when `e.source` is the parent.
const HELPER: &str = concat!("<script>", include_str!("mock_helper.js"), "</script>");

/// The page with the helper after its `<head>` tag (or `<html>`, or the doctype, or at the very start). Never before the doctype, which would put the page in quirks mode.
fn inject_helper(html: &[u8]) -> Vec<u8> {
    let lower = html.to_ascii_lowercase();
    let after_tag = |tag: &[u8]| -> Option<usize> {
        let at = lower.windows(tag.len()).position(|w| w == tag)?;
        // the tag must be the whole word (`<head>` or `<head ...>`, not `<header>`)
        let next = *lower.get(at + tag.len())?;
        if next != b'>' && !next.is_ascii_whitespace() && next != b'/' {
            return None;
        }
        lower[at..].iter().position(|b| *b == b'>').map(|g| at + g + 1)
    };
    let at = after_tag(b"<head").or_else(|| after_tag(b"<html")).or_else(|| after_tag(b"<!doctype")).unwrap_or(0);
    let mut out = Vec::with_capacity(html.len() + HELPER.len());
    out.extend_from_slice(&html[..at]);
    out.extend_from_slice(HELPER.as_bytes());
    out.extend_from_slice(&html[at..]);
    out
}

/// The small file of a card (`mockup.json`), when it is a plain file that reads as JSON
fn card_info(root: &Path) -> Option<serde_json::Value> {
    let file = root.join("mockup.json");
    fs::metadata(&file).ok().filter(|m| m.is_file() && m.len() <= INFO_LIMIT).and_then(|_| fs::read_to_string(&file).ok()).and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
}

/// The address a card reads its journey from (decision 91, ticket T-0036). It is not a file of the card: see `journey_reply`.
pub const JOURNEY_PATH: &str = "_kona/journey.json";
/// A note bigger than this is not read here
const NOTE_LIMIT: u64 = 2 * 1024 * 1024;

/// The one block of a journey note (the lines between a line that opens with three backticks and the word `journey`, and the line that closes it). The twin of `journeyBlock` in
/// `app/src/lib/brain/journey.ts`: a test reads the starter note with it.
pub fn journey_block(text: &str) -> Result<String, String> {
    let t = text.replace('\r', "");
    let mut found: Vec<String> = Vec::new();
    let mut open: Option<(bool, Vec<&str>)> = None;
    for l in t.split('\n') {
        let trimmed = l.trim_start();
        if trimmed.starts_with("```") {
            let info = trimmed.trim_start_matches('`').trim();
            match open.take() {
                Some((journey, body)) => {
                    if journey {
                        found.push(body.join("\n"));
                    }
                }
                None => open = Some((info.split_whitespace().any(|w| w == "journey"), Vec::new())),
            }
        } else if let Some((_, body)) = open.as_mut() {
            body.push(l);
        }
    }
    match found.len() {
        0 => Err("The note has no journey block.".to_string()),
        1 => Ok(found.remove(0)),
        n => Err(format!("The note has {n} journey blocks. A journey note holds exactly one.")),
    }
}

/// What a card gets at `_kona/journey.json`: the map of the one note that its `mockup.json` names (`"journey": "<note-id>"`), read fresh at every request, so the page and the
/// Brain never hold two copies. Only a project note whose front matter says `kind: journey` is given, and only its map block: nothing else of any note can be read from a card.
/// `None` when the card names no note: the address is then an ordinary path inside the card.
fn journey_reply(project_folder: &Path, root: &Path, head: bool) -> Option<Reply> {
    let id = card_info(root)?.get("journey")?.as_str()?.trim().to_string();
    if !brain::valid_id(&id) {
        return Some(Reply::text(400, "That is not a note name"));
    }
    let Some(dir) = fs::canonicalize(brain::dir(project_folder)).ok() else { return Some(Reply::text(404, "No such note")) };
    let path = match fs::canonicalize(dir.join(format!("{id}.md"))) {
        Ok(p) if p.starts_with(&dir) && p.is_file() => p,
        _ => return Some(Reply::text(404, "No such note")),
    };
    if fs::metadata(&path).map(|m| m.len() > NOTE_LIMIT).unwrap_or(true) {
        return Some(Reply::text(413, "That note is too big"));
    }
    let Ok(text) = fs::read_to_string(&path) else { return Some(Reply::text(500, "Could not read the note")) };
    if brain_search::front_matter(&text).0.get("kind").map(|k| k.as_str()) != Some("journey") {
        return Some(Reply::text(403, "Only a note of kind journey can be read here"));
    }
    let json = match journey_block(&text) {
        Ok(j) => j,
        Err(msg) => return Some(Reply::text(422, &msg)),
    };
    if serde_json::from_str::<serde_json::Value>(&json).is_err() {
        return Some(Reply::text(422, "The journey block is not valid JSON"));
    }
    let extra = vec![("Content-Type", "application/json; charset=utf-8".to_string()), ("Content-Length", json.len().to_string())];
    Some(if head { Reply::new(200, Vec::new(), extra) } else { Reply::new(200, json.into_bytes(), extra) })
}

/// Answer one request. `lookup` turns a project id into the project's folder. `path` is the address path: `/<project-id>/<card>/<file>`.
///
/// A known limit, seen in the real window (T-0015): all cards share one address, and WebView2 sends no `Referer` for a page's own requests, so a page of one card CAN read
/// a file of another card (of its own project, or of another project whose random id it knows) by that file's exact address. It has no way to send what it reads anywhere:
/// the policy blocks the web, forms, pop-ups and every other channel. Nothing outside `.kona/mockups` is ever readable.
pub fn serve(lookup: &dyn Fn(&str) -> Option<PathBuf>, method: &str, path: &str, range: Option<&str>) -> Reply {
    if method == "OPTIONS" {
        return Reply::new(204, Vec::new(), vec![("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS".to_string()), ("Access-Control-Allow-Headers", "*".to_string())]);
    }
    if method != "GET" && method != "HEAD" {
        return Reply::text(405, "Only reading is allowed");
    }
    let mut parts = path.trim_start_matches('/').splitn(3, '/');
    let (pid, card, rest) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""), parts.next().unwrap_or(""));
    if !valid_name(pid) || !valid_name(card) {
        return Reply::text(400, "Bad address");
    }
    let Some(folder) = lookup(pid) else { return Reply::text(404, "No such card") };
    let Some(root) = card_root(&folder, card) else { return Reply::text(404, "No such card") };
    if rest == JOURNEY_PATH {
        if let Some(reply) = journey_reply(&folder, &root, method == "HEAD") {
            return reply;
        }
    }
    let file = match resolve(&root, rest) {
        Ok(f) => f,
        Err(Deny(status, msg)) => return Reply::text(status, msg),
    };
    let Ok(meta) = fs::metadata(&file) else { return Reply::text(404, "Not found") };
    let size = meta.len();
    let ctype = ("Content-Type", mime(&file).to_string());
    let ranges = ("Accept-Ranges", "bytes".to_string());
    let head = method == "HEAD";
    // a page (not a range of it) gets the helper of the sheet put in; see HELPER
    if matches!(file.extension().map(|e| e.to_string_lossy().to_lowercase()).as_deref(), Some("html" | "htm")) && range.is_none() && size <= WHOLE_FILE_LIMIT {
        let Ok(raw) = fs::read(&file) else { return Reply::text(500, "Could not read the file") };
        let page = inject_helper(&raw);
        let extra = vec![ctype, ("Content-Length", page.len().to_string())];
        return if head { Reply::new(200, Vec::new(), extra) } else { Reply::new(200, page, extra) };
    }
    let (status, start, end) = match range.map(|r| parse_range(r, size)) {
        Some(Ok(Some((s, e)))) => (206, s, e),
        Some(Err(())) => return Reply::new(416, Vec::new(), vec![("Content-Range", format!("bytes */{size}"))]),
        _ => {
            if size > WHOLE_FILE_LIMIT && !head {
                return Reply::text(413, "This file is only served in ranges");
            }
            (200, 0, size.saturating_sub(1))
        }
    };
    let len = if size == 0 { 0 } else { end - start + 1 };
    let mut extra = vec![ctype, ranges, ("Content-Length", len.to_string())];
    if status == 206 {
        extra.push(("Content-Range", format!("bytes {start}-{end}/{size}")));
    }
    if head || len == 0 {
        return Reply::new(status, Vec::new(), extra);
    }
    let mut body = vec![0u8; len as usize];
    let read = fs::File::open(&file).and_then(|mut f| {
        f.seek(SeekFrom::Start(start))?;
        f.read_exact(&mut body)
    });
    match read {
        Ok(()) => Reply::new(status, body, extra),
        Err(_) => Reply::text(500, "Could not read the file"),
    }
}

#[derive(Serialize, Debug)]
pub struct MockFile {
    /// relative to the card, with `/`
    pub path: String,
    pub size: u64,
    pub modified: Option<u64>,
}

/// Every file of a card (at most 2000, at most 8 folders deep). A link or a junction that leads out of the card is left out.
pub fn list_files(project_folder: &Path, card: &str) -> Result<Vec<MockFile>, String> {
    let root = card_root(project_folder, card).ok_or("There is no such card")?;
    let mut out = Vec::new();
    let mut stack = vec![(root.clone(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        for e in entries.flatten() {
            let Ok(real) = fs::canonicalize(e.path()) else { continue };
            if !real.starts_with(&root) {
                continue;
            }
            let Ok(meta) = fs::metadata(&real) else { continue };
            if meta.is_dir() {
                if depth < MAX_DEPTH {
                    stack.push((real, depth + 1));
                }
            } else if meta.is_file() && out.len() < MAX_FILES {
                let rel = real.strip_prefix(&root).map(|p| p.to_string_lossy().replace('\\', "/")).unwrap_or_default();
                out.push(MockFile { path: rel, size: meta.len(), modified: meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()) });
            }
        }
    }
    out.sort_by(|a, b| a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    Ok(out)
}

/// The words a person sees on an HTML page: comments, scripts, styles and tags taken out, a few entities read, spaces folded, cut to `max` letters.
pub fn visible_text(html: &str, max: usize) -> String {
    let low = html.to_ascii_lowercase();
    let (b, lb) = (html.as_bytes(), low.as_bytes());
    let mut out: Vec<u8> = Vec::with_capacity(b.len() / 2);
    let mut i = 0;
    let skip_to = |from: usize, end: &str| lb[from..].windows(end.len()).position(|w| w == end.as_bytes()).map(|p| from + p + end.len()).unwrap_or(b.len());
    while i < b.len() {
        if lb[i..].starts_with(b"<!--") {
            i = skip_to(i, "-->");
        } else if lb[i..].starts_with(b"<script") {
            i = skip_to(i, "</script>");
        } else if lb[i..].starts_with(b"<style") {
            i = skip_to(i, "</style>");
        } else if b[i] == b'<' && b.get(i + 1).is_some_and(|c| c.is_ascii_alphabetic() || *c == b'/' || *c == b'!') {
            i = lb[i..].iter().position(|c| *c == b'>').map(|p| i + p + 1).unwrap_or(b.len());
            out.push(b' ');
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    let text = String::from_utf8_lossy(&out).replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").replace("&amp;", "&");
    text.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(max).collect()
}

/// The visible words of the page a step's `mockup` names (`card` for the card's first page, or `card/page.html`), for the journey check that is asked for on request.
/// None when there is no such card or page, or when the page is not HTML or is bigger than a megabyte.
pub fn page_text(project_folder: &Path, mockup: &str, max: usize) -> Option<String> {
    let (card, page) = mockup.trim().split_once('/').unwrap_or((mockup.trim(), ""));
    let root = card_root(project_folder, card)?;
    let rel = if page.is_empty() { card_info(&root).and_then(|v| v.get("entry").and_then(|e| e.as_str()).map(str::to_string)).unwrap_or_else(|| "index.html".to_string()) } else { page.to_string() };
    let file = resolve(&root, &rel).ok()?;
    let html = matches!(file.extension().map(|e| e.to_string_lossy().to_lowercase()).as_deref(), Some("html" | "htm"));
    if !html || fs::metadata(&file).map(|m| m.len() > INFO_LIMIT).unwrap_or(true) {
        return None;
    }
    fs::read_to_string(&file).ok().map(|t| visible_text(&t, max))
}

#[derive(Serialize, Debug)]
pub struct Card {
    /// the folder name: the id in the address
    pub id: String,
    /// `name` of the card's `mockup.json`, or the folder name
    pub name: String,
    /// the page that opens first: `entry` of `mockup.json` when that file exists, else `index.html` when it exists
    pub entry: Option<String>,
    pub files: usize,
    /// the newest change of any file in it, seconds since 1970
    pub modified: Option<u64>,
}

/// The cards of a project: every plain folder in `<project>/.kona/mockups` with a valid name
pub fn list_cards(project_folder: &Path) -> Vec<Card> {
    let dir = project_folder.join(".kona").join("mockups");
    let Ok(entries) = fs::read_dir(&dir) else { return Vec::new() };
    let mut out = Vec::new();
    for e in entries.flatten() {
        let id = e.file_name().to_string_lossy().into_owned();
        let Some(root) = card_root(project_folder, &id) else { continue };
        let files = list_files(project_folder, &id).unwrap_or_default();
        let info = card_info(&root);
        let text = |k: &str| info.as_ref().and_then(|v| v.get(k)).and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty() && s.len() <= 120);
        let entry = text("entry").filter(|p| resolve(&root, p).is_ok()).or_else(|| resolve(&root, "index.html").ok().map(|_| "index.html".to_string()));
        out.push(Card { name: text("name").unwrap_or_else(|| id.clone()), id, entry, files: files.len(), modified: files.iter().filter_map(|f| f.modified).max() });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("kona-mock-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(d.join(".kona").join("mockups").join("site").join("css")).unwrap();
        fs::create_dir_all(d.join(".kona").join("mockups").join("other")).unwrap();
        let site = d.join(".kona").join("mockups").join("site");
        fs::write(site.join("index.html"), "<h1>hello</h1>").unwrap();
        fs::write(site.join("about.html"), "about").unwrap();
        fs::write(site.join("css").join("a.css"), "body{}").unwrap();
        fs::write(site.join("app.wasm"), [0u8, 97, 115, 109]).unwrap();
        fs::write(site.join("video.mp4"), (0..100u8).collect::<Vec<_>>()).unwrap();
        fs::write(d.join(".kona").join("mockups").join("other").join("secret.txt"), "other card").unwrap();
        fs::write(d.join("outside.txt"), "outside").unwrap();
        d
    }
    fn get(folder: &Path, path: &str) -> Reply {
        let f = folder.to_path_buf();
        serve(&move |id| (id == "p1").then(|| f.clone()), "GET", path, None)
    }
    fn header<'a>(r: &'a Reply, k: &str) -> Option<&'a str> {
        r.headers.iter().find(|(n, _)| n.eq_ignore_ascii_case(k)).map(|(_, v)| v.as_str())
    }

    #[test]
    fn serves_files_of_a_card_with_the_right_type_and_the_safe_headers() {
        let d = project("serve");
        let r = get(&d, "/p1/site/index.html");
        assert_eq!(r.status, 200);
        assert!(r.body.ends_with(b"<h1>hello</h1>") && r.body.len() > 14, "the page, with the helper put in before it");
        assert_eq!(header(&r, "content-type"), Some("text/html; charset=utf-8"));
        let csp = header(&r, "content-security-policy").unwrap();
        for must in ["default-src 'self'", "connect-src 'self'", "form-action 'none'", "sandbox allow-scripts", "'wasm-unsafe-eval'"] {
            assert!(csp.contains(must), "the policy lacks {must}");
        }
        assert!(!csp.contains("http:") && !csp.contains("https:") && !csp.contains("allow-same-origin") && !csp.contains("allow-forms") && !csp.contains("allow-popups"));
        assert_eq!(header(&r, "access-control-allow-origin"), Some("*"));
        assert_eq!(header(&r, "x-content-type-options"), Some("nosniff"));
        assert_eq!(get(&d, "/p1/site/css/a.css").status, 200);
        assert_eq!(header(&get(&d, "/p1/site/css/a.css"), "content-type"), Some("text/css; charset=utf-8"));
        assert_eq!(header(&get(&d, "/p1/site/app.wasm"), "content-type"), Some("application/wasm"));
        // the card folder and its root answer with index.html; a page can be asked for with a query-less path only (the address path never holds one)
        assert!(get(&d, "/p1/site/").body.ends_with(b"<h1>hello</h1>"));
        assert!(get(&d, "/p1/site").body.ends_with(b"<h1>hello</h1>"));
        assert_eq!(get(&d, "/p1/site/css").status, 404, "a folder without an index.html is not served");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn nothing_outside_the_card_is_served() {
        let d = project("escape");
        for path in [
            "/p1/site/../outside.txt", "/p1/site/%2e%2e/outside.txt", "/p1/site/%2E%2E/%2E%2E/outside.txt", "/p1/site/..%2foutside.txt", "/p1/site/..%5coutside.txt",
            "/p1/site/%2e%2e%2f%2e%2e%2foutside.txt", "/p1/site/css/../../../outside.txt", "/p1/site/C:/Windows/win.ini", "/p1/site/c%3a/x", "/p1/site/index.html:stream",
            "/p1/site/a%00.html", "/p1/site/\\\\server\\share\\x", "/p1/site/NUL", "/p1/site/con.txt", "/p1/site/index.html.", "/p1/site/index.html%20",
        ] {
            let r = get(&d, path);
            assert!(matches!(r.status, 400 | 403 | 404), "{path} gave {}", r.status);
            assert!(!String::from_utf8_lossy(&r.body).contains("outside"), "{path} leaked");
        }
        // another card is another address, never a path inside this one
        assert_eq!(get(&d, "/p1/site/../other/secret.txt").status, 403);
        assert_eq!(get(&d, "/p1/other/secret.txt").body, b"other card", "its own address works");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_wrong_project_or_card_or_method_is_refused() {
        let d = project("wrong");
        assert_eq!(get(&d, "/p2/site/index.html").status, 404, "a project that is not known");
        assert_eq!(get(&d, "/p1/nope/index.html").status, 404, "a card that is not there");
        assert_eq!(get(&d, "/p1/../index.html").status, 400);
        assert_eq!(get(&d, "/p1/.kona/index.html").status, 400, "a name that starts with a dot");
        assert_eq!(get(&d, "/p1").status, 400);
        assert_eq!(get(&d, "/").status, 400);
        assert_eq!(get(&d, "/p1/site/missing.html").status, 404);
        let f = d.clone();
        assert_eq!(serve(&move |_| Some(f.clone()), "POST", "/p1/site/index.html", None).status, 405);
        let f = d.clone();
        assert_eq!(serve(&move |_| Some(f.clone()), "PUT", "/p1/site/index.html", None).status, 405);
        let f = d.clone();
        let head = serve(&move |_| Some(f.clone()), "HEAD", "/p1/site/index.html", None);
        let whole = get(&d, "/p1/site/index.html");
        assert!(head.status == 200 && head.body.is_empty() && header(&head, "content-length") == Some(whole.body.len().to_string().as_str()), "a HEAD says the length of the page with the helper");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn every_page_gets_the_helper_in_the_right_place_and_nothing_else_does() {
        let page = |s: &str| String::from_utf8(inject_helper(s.as_bytes())).unwrap();
        let at = |s: &str| s.find("<script>(function(){var r=document.documentElement").expect("the helper is there");
        // after the head tag, also with attributes and in capitals
        let a = page("<!doctype html><html><head><title>x</title></head><body></body></html>");
        assert_eq!(a.matches("<script>(function()").count(), 1);
        assert_eq!(at(&a), "<!doctype html><html><head>".len());
        let b = page("<!DOCTYPE html>\n<HTML lang=en>\n<HEAD profile=x>\n<body></body>");
        assert_eq!(at(&b), "<!DOCTYPE html>\n<HTML lang=en>\n<HEAD profile=x>".len());
        // a <header> is not the head: no head, so after the html tag
        let c = page("<html><body><header>x</header></body></html>");
        assert_eq!(at(&c), "<html>".len());
        // never before the doctype (that would turn on quirks mode)
        let e = page("<!doctype html><p>no html tag</p>");
        assert_eq!(at(&e), "<!doctype html>".len());
        // a fragment: at the very start
        assert_eq!(at(&page("<h1>x</h1>")), 0);
        assert!(page("").contains("<script>"), "an empty file still works");
        // the helper has no closing script tag inside itself, and sets the theme and talks to the parent only
        assert_eq!(HELPER.matches("</script>").count(), 1);
        for must in ["kona-theme", "e.source===parent", "kona:'wheel'", "kona:'escape'", "kona:'ready'", "kona==='pick'", "kona:'hover'", "kona:'rect'", "[data-part]", "attachShadow"] {
            assert!(HELPER.contains(must), "the helper lacks {must}");
        }
        assert!(!HELPER.contains("fetch") && !HELPER.contains("XMLHttpRequest") && !HELPER.contains("http"), "the helper reaches nowhere");
        // served: pages get it, styles, scripts, json and ranges of a page do not
        let d = project("helper");
        let f = d.clone();
        let lookup = move |_: &str| Some(f.clone());
        let site = d.join(".kona").join("mockups").join("site");
        fs::write(site.join("page.html"), "<html><head></head><body>x</body></html>").unwrap();
        let r = serve(&lookup, "GET", "/p1/site/page.html", None);
        assert!(String::from_utf8_lossy(&r.body).contains("kona-theme") && header(&r, "content-length") == Some(r.body.len().to_string().as_str()));
        assert!(!String::from_utf8_lossy(&serve(&lookup, "GET", "/p1/site/css/a.css", None).body).contains("kona"));
        assert_eq!(serve(&lookup, "GET", "/p1/site/page.html", Some("bytes=0-5")).body, b"<html>", "a range of a page is the file itself");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_junction_that_leads_out_of_the_card_is_not_followed() {
        if !cfg!(windows) {
            return;
        }
        let d = project("junction");
        let site = d.join(".kona").join("mockups").join("site");
        let outside = d.join("outside-dir");
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.txt"), "outside secret").unwrap();
        // a junction needs no special rights on Windows
        let made = std::process::Command::new("cmd").args(["/C", "mklink", "/J", &site.join("link").to_string_lossy(), &outside.to_string_lossy()]).output().map(|o| o.status.success()).unwrap_or(false);
        if !made {
            eprintln!("could not make a junction here, junction test skipped");
            let _ = fs::remove_dir_all(&d);
            return;
        }
        let r = get(&d, "/p1/site/link/secret.txt");
        assert!(matches!(r.status, 403 | 404), "gave {}", r.status);
        assert!(!String::from_utf8_lossy(&r.body).contains("outside secret"));
        assert!(list_files(&d, "site").unwrap().iter().all(|f| !f.path.contains("link") && !f.path.contains("secret")), "the junction's files are not listed");
        // a whole card that is a junction out of mockups
        let _ = std::process::Command::new("cmd").args(["/C", "mklink", "/J", &d.join(".kona").join("mockups").join("escape").to_string_lossy(), &outside.to_string_lossy()]).output();
        assert_eq!(get(&d, "/p1/escape/secret.txt").status, 404);
        assert!(list_cards(&d).iter().all(|c| c.id != "escape"));
        // remove the junctions first so the clean-up cannot reach the target
        let _ = std::process::Command::new("cmd").args(["/C", "rmdir", &site.join("link").to_string_lossy()]).output();
        let _ = std::process::Command::new("cmd").args(["/C", "rmdir", &d.join(".kona").join("mockups").join("escape").to_string_lossy()]).output();
        assert!(outside.join("secret.txt").exists(), "the target was not touched");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn ranges_work_for_video() {
        let d = project("range");
        let f = d.clone();
        let lookup = move |_: &str| Some(f.clone());
        let r = serve(&lookup, "GET", "/p1/site/video.mp4", Some("bytes=10-19"));
        assert_eq!((r.status, r.body.clone()), (206, (10..20u8).collect::<Vec<_>>()));
        assert_eq!(header(&r, "content-range"), Some("bytes 10-19/100"));
        assert_eq!(serve(&lookup, "GET", "/p1/site/video.mp4", Some("bytes=95-")).body, (95..100u8).collect::<Vec<_>>());
        assert_eq!(serve(&lookup, "GET", "/p1/site/video.mp4", Some("bytes=-3")).body, vec![97, 98, 99]);
        assert_eq!(serve(&lookup, "GET", "/p1/site/video.mp4", Some("bytes=0-9999")).body.len(), 100, "the end is cut to the file");
        assert_eq!(serve(&lookup, "GET", "/p1/site/video.mp4", Some("bytes=100-200")).status, 416);
        assert_eq!(serve(&lookup, "GET", "/p1/site/video.mp4", Some("bytes=20-10")).status, 416);
        assert_eq!(serve(&lookup, "GET", "/p1/site/video.mp4", Some("items=1-2")).status, 200, "not a bytes range: the whole file");
        assert_eq!(serve(&lookup, "GET", "/p1/site/video.mp4", Some("bytes=0-1,5-6")).body.len(), 100, "many ranges: the whole file");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_very_large_file_is_only_served_in_ranges() {
        let d = project("large");
        let big = d.join(".kona").join("mockups").join("site").join("big.mp4");
        // a 70 MB file made of zeros (the file system keeps it cheap)
        let f = fs::File::create(&big).unwrap();
        f.set_len(70 * 1024 * 1024).unwrap();
        drop(f);
        let f = d.clone();
        let lookup = move |_: &str| Some(f.clone());
        assert_eq!(serve(&lookup, "GET", "/p1/site/big.mp4", None).status, 413, "not the whole file in one answer");
        let head = serve(&lookup, "HEAD", "/p1/site/big.mp4", None);
        assert!(head.status == 200 && head.body.is_empty() && header(&head, "content-length") == Some("73400320"), "a HEAD still tells the size");
        let r = serve(&lookup, "GET", "/p1/site/big.mp4", Some("bytes=0-1023"));
        assert_eq!((r.status, r.body.len()), (206, 1024));
        let tail = serve(&lookup, "GET", "/p1/site/big.mp4", Some("bytes=-100"));
        assert_eq!((tail.status, tail.body.len()), (206, 100));
        assert_eq!(header(&tail, "content-range"), Some("bytes 73400220-73400319/73400320"));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn lists_cards_and_files() {
        let d = project("list");
        fs::write(d.join(".kona").join("mockups").join("site").join("mockup.json"), r#"{"name":"The site","entry":"about.html"}"#).unwrap();
        fs::create_dir_all(d.join(".kona").join("mockups").join(".hidden")).unwrap();
        fs::create_dir_all(d.join(".kona").join("mockups").join("bad name")).unwrap();
        fs::write(d.join(".kona").join("mockups").join("stray.txt"), "x").unwrap();
        let cards = list_cards(&d);
        let ids: Vec<&str> = cards.iter().map(|c| c.id.as_str()).collect();
        assert_eq!(ids, ["other", "site"], "sorted by name; a hidden folder, a name with a space and a loose file are not cards");
        let site = cards.iter().find(|c| c.id == "site").unwrap();
        assert_eq!((site.name.as_str(), site.entry.as_deref()), ("The site", Some("about.html")));
        let other = cards.iter().find(|c| c.id == "other").unwrap();
        assert_eq!((other.name.as_str(), other.entry.as_deref()), ("other", None), "no index.html, no entry");
        let files = list_files(&d, "site").unwrap();
        let paths: Vec<&str> = files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(paths, ["about.html", "app.wasm", "css/a.css", "index.html", "mockup.json", "video.mp4"]);
        assert!(list_files(&d, "nope").is_err() && list_files(&d, "../site").is_err());
        // an entry that is not a file of the card falls back to index.html
        fs::write(d.join(".kona").join("mockups").join("site").join("mockup.json"), r#"{"entry":"../../outside.txt"}"#).unwrap();
        assert_eq!(list_cards(&d).iter().find(|c| c.id == "site").unwrap().entry.as_deref(), Some("index.html"));
        assert!(list_cards(&d.join("no-such-folder")).is_empty());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn names_and_types() {
        assert!(valid_name("site") && valid_name("ads-slot_2.v1") && valid_name("3f2a9c1e-77aa-4b0e-9a55-0d4e1c2b3a4f"));
        for bad in ["", ".", "..", ".kona", "a b", "a/b", "a\\b", "a:b", "é", &"x".repeat(81)] {
            assert!(!valid_name(bad), "{bad:?} should not be a name");
        }
        assert_eq!(mime(Path::new("a.WOFF2")), "font/woff2");
        assert_eq!(mime(Path::new("a.mp4")), "video/mp4");
        assert_eq!(mime(Path::new("a.unknown")), "application/octet-stream");
        assert_eq!(percent_decode("a%20b%2Fc").as_deref(), Some("a b/c"));
        assert!(percent_decode("%zz").is_none() && percent_decode("%2").is_none() && percent_decode("%ff").is_none());
    }

    #[test]
    fn the_visible_words_of_a_page_are_what_a_person_reads() {
        let t = visible_text("<!doctype html><html><head><title>T</title><style>p{color:red}</style><script>var x = '<b>no</b>';</script></head><body><!-- hidden --><h1>Sign &amp; go</h1><p class=\"a\">Wrong  email<br>or password</p><SCRIPT>bad()</SCRIPT><input placeholder='x'>Done&nbsp;now</body></html>", 1000);
        assert_eq!(t, "T Sign & go Wrong email or password Done now");
        assert_eq!(visible_text("a < b and c > d", 100), "a < b and c > d", "a lone bracket is text");
        assert_eq!(visible_text("<p>abcdefghij</p>", 4), "abcd");
        assert_eq!(visible_text("<script>never closed", 100), "");
        assert_eq!(visible_text("<p>é — ü</p>", 100), "é — ü");
    }

    #[test]
    fn a_page_is_found_by_the_name_a_step_gives_and_nothing_else_is_read() {
        let d = project("pagetext");
        let site = d.join(".kona").join("mockups").join("site");
        fs::write(site.join("about.html"), "<h1>About us</h1>").unwrap();
        fs::write(site.join("mockup.json"), r#"{"entry":"about.html"}"#).unwrap();
        assert_eq!(page_text(&d, "site/about.html", 100).as_deref(), Some("About us"));
        assert_eq!(page_text(&d, "site", 100).as_deref(), Some("About us"), "a card alone is its entry page");
        assert_eq!(page_text(&d, "site/index.html", 100).as_deref(), Some("hello"));
        for no in ["", "nope/x.html", "site/missing.html", "site/css/a.css", "site/../other/secret.txt", "site/../../outside.txt", "../site/index.html", "site/app.wasm"] {
            assert_eq!(page_text(&d, no, 100), None, "{no}");
        }
        let _ = fs::remove_dir_all(&d);
    }

    // ---- the journey note a card may read (T-0036) ----

    const JOURNEY_NOTE: &str = "---\ntitle: J\nkind: journey\n---\n# J\n\nWords.\n\n```journey\n{\"steps\": [{\"id\": \"a\", \"name\": \"A\", \"lane\": \"app\"}]}\n```\n";

    /// a project with notes of several shapes and one card for each way a card can name a note
    fn journey_project(name: &str) -> PathBuf {
        let d = project(name);
        let brain = d.join(".kona").join("brain");
        fs::create_dir_all(&brain).unwrap();
        fs::write(brain.join("journey.md"), JOURNEY_NOTE).unwrap();
        fs::write(brain.join("plain.md"), JOURNEY_NOTE.replace("kind: journey", "kind: decision")).unwrap();
        fs::write(brain.join("two.md"), format!("{JOURNEY_NOTE}\n{JOURNEY_NOTE}")).unwrap();
        fs::write(brain.join("none.md"), "---\nkind: journey\n---\nno block here\n").unwrap();
        fs::write(brain.join("bad.md"), "---\nkind: journey\n---\n```journey\n{\"steps\": [\n```\n").unwrap();
        fs::write(brain.join("big.md"), format!("---\nkind: journey\n---\n{}", "x".repeat(2 * 1024 * 1024 + 10))).unwrap();
        fs::write(d.join(".kona").join("secret.md"), JOURNEY_NOTE).unwrap();
        for (card, named) in [("c-ok", "journey"), ("c-plain", "plain"), ("c-two", "two"), ("c-none", "none"), ("c-bad", "bad"), ("c-big", "big"), ("c-ghost", "ghost"), ("c-up", "Journey"), ("c-dots", "../secret"), ("c-slash", "a/b")] {
            let dir = d.join(".kona").join("mockups").join(card);
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join("mockup.json"), format!("{{\"journey\": \"{named}\"}}")).unwrap();
        }
        // a card that names no note, and has a real file at the same address
        let own = d.join(".kona").join("mockups").join("c-own").join("_kona");
        fs::create_dir_all(&own).unwrap();
        fs::write(own.join("journey.json"), "{\"its\": \"own file\"}").unwrap();
        d
    }

    #[test]
    fn a_card_reads_the_map_of_the_note_it_names_and_only_that() {
        let d = journey_project("journey-ok");
        let r = get(&d, "/p1/c-ok/_kona/journey.json");
        assert_eq!(r.status, 200);
        assert_eq!(header(&r, "content-type"), Some("application/json; charset=utf-8"));
        let v: serde_json::Value = serde_json::from_slice(&r.body).unwrap();
        assert_eq!(v["steps"][0]["id"], "a", "the block, not the note");
        assert!(!String::from_utf8_lossy(&r.body).contains("Words."), "nothing of the note around the block");
        // the same safe headers as every other answer
        assert!(header(&r, "content-security-policy").unwrap().contains("connect-src 'self'"));
        assert_eq!(header(&r, "cache-control"), Some("no-store"));
        // a HEAD says the length and sends nothing
        let f = d.clone();
        let head = serve(&move |_| Some(f.clone()), "HEAD", "/p1/c-ok/_kona/journey.json", None);
        assert!(head.status == 200 && head.body.is_empty() && header(&head, "content-length") == Some(r.body.len().to_string().as_str()));
        // the note is read at every request: a change shows without anything else
        fs::write(d.join(".kona").join("brain").join("journey.md"), JOURNEY_NOTE.replace("\"id\": \"a\"", "\"id\": \"changed\"")).unwrap();
        let again: serde_json::Value = serde_json::from_slice(&get(&d, "/p1/c-ok/_kona/journey.json").body).unwrap();
        assert_eq!(again["steps"][0]["id"], "changed");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_card_cannot_read_anything_else_through_the_journey_address() {
        let d = journey_project("journey-deny");
        let status = |card: &str| get(&d, &format!("/p1/{card}/_kona/journey.json")).status;
        assert_eq!(status("c-plain"), 403, "a note of another kind is not given");
        assert_eq!(status("c-ghost"), 404);
        assert_eq!(status("c-up"), 400, "a name that is not a note id");
        assert_eq!(status("c-dots"), 400, "a path is not a note id");
        assert_eq!(status("c-slash"), 400);
        assert_eq!(status("c-two"), 422);
        assert_eq!(status("c-none"), 422);
        assert_eq!(status("c-bad"), 422);
        assert_eq!(status("c-big"), 413);
        assert!(!String::from_utf8_lossy(&get(&d, "/p1/c-dots/_kona/journey.json").body).contains("steps"), "the note outside the brain folder is not given");
        // the other cards' ordinary paths are unchanged, and a similar address is not the journey
        assert_eq!(get(&d, "/p1/c-ok/_kona/other.json").status, 404);
        assert_eq!(get(&d, "/p1/c-ok/_kona/journey.json/x").status, 404);
        assert_eq!(get(&d, "/p1/c-ok/_KONA/journey.json").status, 404);
        assert_eq!(get(&d, "/p1/c-ok/mockup.json").status, 200, "the card's own small file is still a file of the card");
        // a card that names no note serves its own file at that address
        let own = get(&d, "/p1/c-own/_kona/journey.json");
        assert_eq!(own.status, 200);
        assert_eq!(own.body, b"{\"its\": \"own file\"}");
        // a project that has no brain folder at all
        let bare = project("journey-bare");
        fs::write(bare.join(".kona").join("mockups").join("site").join("mockup.json"), r#"{"journey":"journey"}"#).unwrap();
        assert_eq!(get(&bare, "/p1/site/_kona/journey.json").status, 404);
        let _ = fs::remove_dir_all(&d);
        let _ = fs::remove_dir_all(&bare);
    }

    #[test]
    fn the_block_is_found_the_way_the_screen_finds_it() {
        assert_eq!(journey_block(JOURNEY_NOTE).unwrap(), "{\"steps\": [{\"id\": \"a\", \"name\": \"A\", \"lane\": \"app\"}]}");
        assert!(journey_block("```json\n{}\n```\n\n```journey\n{\"x\":1}\n```").unwrap() == "{\"x\":1}", "other fences are ignored");
        assert!(journey_block("```json journey\r\n{}\r\n```\r\n").is_ok(), "the words json journey open it, and CRLF is fine");
        assert!(journey_block("# nothing").unwrap_err().contains("no journey block"));
        assert!(journey_block("```journey\n{}\n```\n```journey\n{}\n```").unwrap_err().contains("2 journey blocks"));
        // the starter note that teaches the format holds a map that the server can give
        let (_, text) = brain_search::STARTER.iter().find(|(id, _)| *id == "kona-journey").expect("the starter note is listed");
        let v: serde_json::Value = serde_json::from_str(&journey_block(text).unwrap()).unwrap();
        assert_eq!(v["steps"].as_array().unwrap().len(), 6);
    }
}
