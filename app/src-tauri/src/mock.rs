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
    let Some(root) = lookup(pid).and_then(|folder| card_root(&folder, card)) else { return Reply::text(404, "No such card") };
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
        let info = fs::metadata(root.join("mockup.json")).ok().filter(|m| m.is_file() && m.len() <= INFO_LIMIT).and_then(|_| fs::read_to_string(root.join("mockup.json")).ok()).and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok());
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
}
