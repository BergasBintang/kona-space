// The fake bucket of a Live card (decision 94b in kona-space-app.md).
//
// A real product keeps its pictures, uploads and exports in a bucket at a cloud host (Amazon S3, Cloudflare R2, and many others speak the same protocol). A mockup must never touch that bucket,
// so Kona runs a bucket of its own for the card: a small web server on 127.0.0.1 and a port of its own, that keeps the objects in a folder inside the card's data folder
// (`<data>/bucket/objects/<key>`), speaks the part of the S3 protocol that the usual libraries use, and checks nothing about who asks (there is nobody to protect: it listens on this PC only
// and holds demo files). Same code for S3 and R2: R2 is the same protocol, with the region called `auto`.
//
// What it answers (path style: `/<bucket>/<key>`): put, get (with ranges), head, delete, copy, delete many, list (versions 1 and 2, with prefix, delimiter and pages), multipart uploads (start,
// part, complete, abort), the checks of whether the bucket is there, the two settings calls that libraries make for nothing (`acl` and `tagging`), CORS answers for a browser that uploads straight
// to a signed address, and bodies sent in the `aws-chunked` way that newer libraries use. What it does NOT do: versions, encryption, lifecycle rules, signatures (all accepted), and a key that is
// both a file and a folder prefix at once (`a/b` and `a/b/c`), because the objects are plain files. A key with a character that a Windows file cannot hold (`\`, `:`, a name ending in a dot, `CON`)
// is refused with a plain error.
use crate::live::{read_request, write_response, ProxyReq, ProxyRes};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The name of the one bucket every Live card gets
pub const BUCKET_NAME: &str = "kona";

#[derive(Clone)]
pub struct Store {
    /// `<data>/bucket`
    pub root: PathBuf,
}

impl Store {
    fn objects(&self) -> PathBuf {
        self.root.join("objects")
    }
    fn metas(&self) -> PathBuf {
        self.root.join("meta")
    }
    fn uploads(&self) -> PathBuf {
        self.root.join("uploads")
    }
    fn tmp(&self) -> PathBuf {
        self.root.join("tmp")
    }
}

// ---------------------------------------------------------------- small things: md5, dates, text

/// MD5 (RFC 1321): the ETag of an object is its MD5, as Amazon's is, so that a library that checks it finds what it expects
pub fn md5(data: &[u8]) -> [u8; 16] {
    const S: [u32; 64] = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    let k: Vec<u32> = (0..64).map(|i| (((i + 1) as f64).sin().abs() * 4294967296.0) as u32).collect();
    let (mut a0, mut b0, mut c0, mut d0) = (0x67452301u32, 0xefcdab89u32, 0x98badcfeu32, 0x10325476u32);
    let mut msg = data.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&((data.len() as u64).wrapping_mul(8)).to_le_bytes());
    for chunk in msg.chunks(64) {
        let m: Vec<u32> = chunk.chunks(4).map(|w| u32::from_le_bytes([w[0], w[1], w[2], w[3]])).collect();
        let (mut a, mut b, mut c, mut d) = (a0, b0, c0, d0);
        for i in 0..64 {
            let (mut f, g) = match i / 16 {
                0 => ((b & c) | (!b & d), i),
                1 => ((d & b) | (!d & c), (5 * i + 1) % 16),
                2 => (b ^ c ^ d, (3 * i + 5) % 16),
                _ => (c ^ (b | !d), (7 * i) % 16),
            };
            f = f.wrapping_add(a).wrapping_add(k[i]).wrapping_add(m[g]);
            a = d;
            d = c;
            c = b;
            b = b.wrapping_add(f.rotate_left(S[i]));
        }
        a0 = a0.wrapping_add(a);
        b0 = b0.wrapping_add(b);
        c0 = c0.wrapping_add(c);
        d0 = d0.wrapping_add(d);
    }
    let mut out = [0u8; 16];
    out[..4].copy_from_slice(&a0.to_le_bytes());
    out[4..8].copy_from_slice(&b0.to_le_bytes());
    out[8..12].copy_from_slice(&c0.to_le_bytes());
    out[12..].copy_from_slice(&d0.to_le_bytes());
    out
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn md5_hex(data: &[u8]) -> String {
    hex(&md5(data))
}

/// (year, month, day, hour, minute, second, weekday 0 = Sunday) of a time in seconds since 1970
fn civil(secs: u64) -> (i64, u32, u32, u32, u32, u32, u32) {
    let days = (secs / 86400) as i64;
    let rest = (secs % 86400) as u32;
    let z = days + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    (y, m, d, rest / 3600, (rest % 3600) / 60, rest % 60, ((days + 4).rem_euclid(7)) as u32)
}

fn iso(secs: u64) -> String {
    let (y, m, d, h, mi, s, _) = civil(secs);
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{mi:02}:{s:02}.000Z")
}

fn http_date(secs: u64) -> String {
    const DAYS: [&str; 7] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTHS: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let (y, m, d, h, mi, s, wd) = civil(secs);
    format!("{}, {d:02} {} {y:04} {h:02}:{mi:02}:{s:02} GMT", DAYS[wd as usize], MONTHS[(m - 1) as usize])
}

fn secs_of(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&apos;")
}

fn xml_unescape(s: &str) -> String {
    s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")
}

/// every `<tag>text</tag>` of a small XML body, in order (the bodies the libraries send are flat lists: keys, part numbers)
fn xml_texts(body: &str, tag: &str) -> Vec<String> {
    let (open, close) = (format!("<{tag}>"), format!("</{tag}>"));
    let mut out = Vec::new();
    let mut rest = body;
    while let Some(a) = rest.find(&open) {
        let after = &rest[a + open.len()..];
        let Some(b) = after.find(&close) else { break };
        out.push(xml_unescape(&after[..b]));
        rest = &after[b + close.len()..];
    }
    out
}

fn pct_decode(s: &str, plus_is_space: bool) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'%' if i + 2 < b.len() => {
                if let (Some(h), Some(l)) = ((b[i + 1] as char).to_digit(16), (b[i + 2] as char).to_digit(16)) {
                    out.push((h * 16 + l) as u8);
                    i += 3;
                    continue;
                }
                out.push(b'%');
                i += 1;
            }
            b'+' if plus_is_space => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn parse_query(q: &str) -> BTreeMap<String, String> {
    q.split('&').filter(|p| !p.is_empty()).map(|p| match p.split_once('=') {
        Some((k, v)) => (pct_decode(k, true), pct_decode(v, true)),
        None => (pct_decode(p, true), String::new()),
    }).collect()
}

// ---------------------------------------------------------------- keys and files

/// A key that can be kept as a plain file inside the bucket folder: no `..`, no drive letter or stream (`:`), no backslash, no empty part, no part that Windows would change (a trailing dot or
/// space, a device name such as `CON`)
pub fn key_ok(key: &str) -> bool {
    if key.is_empty() || key.len() > 1024 || key.contains(['\\', ':', '\0', '\r', '\n', '*', '?', '"', '<', '>', '|']) || key.starts_with('/') || key.ends_with('/') {
        return false;
    }
    key.split('/').all(|seg| {
        if seg.is_empty() || seg == "." || seg == ".." || seg.ends_with('.') || seg.ends_with(' ') {
            return false;
        }
        let stem = seg.split('.').next().unwrap_or("").to_ascii_lowercase();
        let device = matches!(stem.as_str(), "con" | "prn" | "aux" | "nul") || ((stem.starts_with("com") || stem.starts_with("lpt")) && stem.len() == 4 && stem.as_bytes()[3].is_ascii_digit());
        !device
    })
}

fn key_path(store: &Store, key: &str) -> Option<PathBuf> {
    key_ok(key).then(|| key.split('/').fold(store.objects(), |p, seg| p.join(seg)))
}

fn meta_path(store: &Store, key: &str) -> PathBuf {
    store.metas().join(format!("{}.json", hex(&Sha256::digest(key.as_bytes()))))
}

#[derive(Clone, Default)]
struct Meta {
    content_type: String,
    etag: String,
    user: BTreeMap<String, String>,
}

fn read_meta(store: &Store, key: &str) -> Option<Meta> {
    let v: serde_json::Value = serde_json::from_slice(&std::fs::read(meta_path(store, key)).ok()?).ok()?;
    Some(Meta {
        content_type: v["content_type"].as_str().unwrap_or("").to_string(),
        etag: v["etag"].as_str().unwrap_or("").to_string(),
        user: v["user"].as_object().map(|o| o.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string()))).collect()).unwrap_or_default(),
    })
}

fn write_meta(store: &Store, key: &str, m: &Meta) {
    let _ = std::fs::create_dir_all(store.metas());
    let v = serde_json::json!({ "key": key, "content_type": m.content_type, "etag": m.etag, "user": m.user });
    let _ = std::fs::write(meta_path(store, key), v.to_string());
}

static TMP_N: AtomicU64 = AtomicU64::new(0);

/// the file is written whole under another name first and then moved into place, so a reader never sees half of it
fn write_atomic(store: &Store, path: &Path, data: &[u8]) -> Result<(), String> {
    std::fs::create_dir_all(store.tmp()).map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|_| "a part of this key is already a file".to_string())?;
    }
    if path.is_dir() {
        return Err("this key is already the start of other keys".to_string());
    }
    let tmp = store.tmp().join(format!("w{}-{}", std::process::id(), TMP_N.fetch_add(1, Ordering::SeqCst)));
    std::fs::write(&tmp, data).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

fn prune_empty(store: &Store, mut dir: PathBuf) {
    let top = store.objects();
    while dir != top && dir.starts_with(&top) {
        if std::fs::remove_dir(&dir).is_err() {
            break;
        }
        match dir.parent() {
            Some(p) => dir = p.to_path_buf(),
            None => break,
        }
    }
}

/// every key of the bucket with its size and time, sorted the way Amazon sorts (by the bytes of the key)
fn all_keys(store: &Store) -> Vec<(String, u64, u64)> {
    fn walk(dir: &Path, prefix: &str, out: &mut Vec<(String, u64, u64)>) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            let key = if prefix.is_empty() { name.clone() } else { format!("{prefix}/{name}") };
            let Ok(md) = e.metadata() else { continue };
            if md.is_dir() {
                walk(&e.path(), &key, out);
            } else {
                out.push((key, md.len(), secs_of(md.modified().unwrap_or(UNIX_EPOCH))));
            }
        }
    }
    let mut out = Vec::new();
    walk(&store.objects(), "", &mut out);
    out.sort_by(|a, b| a.0.cmp(&b.0));
    out
}

fn type_of(key: &str) -> &'static str {
    match key.rsplit('.').next().unwrap_or("").to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "csv" => "text/csv",
        "txt" => "text/plain",
        "json" => "application/json",
        "html" => "text/html",
        "mp4" => "video/mp4",
        "mp3" => "audio/mpeg",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
}

/// The key of a public address: `/cloud/<key>` (with a query, if any, left off)
pub fn public_key(target: &str) -> Option<String> {
    let path = target.strip_prefix("/cloud/")?.split('?').next()?;
    Some(pct_decode(path, false)).filter(|k| !k.is_empty())
}

/// The file of a public address (`/cloud/<key>` on the page's own address): what a page loads a picture from. `None` when there is no such object.
pub fn read_public(root: &Path, key: &str) -> Option<(Vec<u8>, String)> {
    let store = Store { root: root.to_path_buf() };
    let path = key_path(&store, key)?;
    let data = std::fs::read(&path).ok()?;
    let ctype = read_meta(&store, key).map(|m| m.content_type).filter(|c| !c.is_empty()).unwrap_or_else(|| type_of(key).to_string());
    Some((data, ctype))
}

// ---------------------------------------------------------------- answers

fn answer(status: u16, headers: Vec<(String, String)>, body: Vec<u8>) -> ProxyRes {
    let mut h = headers;
    h.push(("Content-Length".to_string(), body.len().to_string()));
    h.push(("Access-Control-Allow-Origin".to_string(), "*".to_string()));
    h.push(("Access-Control-Expose-Headers".to_string(), "ETag, Content-Range, Content-Length, x-amz-request-id, x-amz-meta-*".to_string()));
    h.push(("x-amz-request-id".to_string(), "kona".to_string()));
    h.push(("Server".to_string(), "Kona".to_string()));
    ProxyRes { status, headers: h, body }
}

fn xml(status: u16, body: String) -> ProxyRes {
    answer(status, vec![("Content-Type".to_string(), "application/xml".to_string())], format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>{body}").into_bytes())
}

fn error(status: u16, code: &str, message: &str) -> ProxyRes {
    xml(status, format!("<Error><Code>{code}</Code><Message>{}</Message><RequestId>kona</RequestId></Error>", xml_escape(message)))
}

fn no_such_key(key: &str) -> ProxyRes {
    xml(404, format!("<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message><Key>{}</Key><RequestId>kona</RequestId></Error>", xml_escape(key)))
}

fn header<'a>(req: &'a ProxyReq, name: &str) -> Option<&'a str> {
    req.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(name)).map(|(_, v)| v.as_str())
}

/// The body as the library meant it: a body sent in the `aws-chunked` way (`<hex size>;chunk-signature=...\r\n<data>\r\n`, ending in a chunk of size 0 and maybe trailers) is unpacked
fn payload(req: &ProxyReq) -> Result<Vec<u8>, ProxyRes> {
    let streaming = header(req, "x-amz-content-sha256").is_some_and(|v| v.starts_with("STREAMING-")) || header(req, "content-encoding").is_some_and(|v| v.to_ascii_lowercase().contains("aws-chunked"));
    if !streaming {
        return Ok(req.body.clone());
    }
    let b = &req.body;
    let mut out = Vec::new();
    let mut i = 0;
    loop {
        let bad = || error(400, "IncompleteBody", "The body could not be unpacked");
        let Some(end) = b[i..].windows(2).position(|w| w == b"\r\n") else { return Err(bad()) };
        let head = std::str::from_utf8(&b[i..i + end]).map_err(|_| bad())?;
        let size = usize::from_str_radix(head.split(';').next().unwrap_or("").trim(), 16).map_err(|_| bad())?;
        i += end + 2;
        if size == 0 {
            return Ok(out);
        }
        if b.len() < i + size {
            return Err(bad());
        }
        out.extend_from_slice(&b[i..i + size]);
        i += size + 2;
        if i > b.len() {
            return Err(bad());
        }
    }
}

fn user_meta(req: &ProxyReq) -> BTreeMap<String, String> {
    req.headers.iter().filter_map(|(k, v)| k.to_ascii_lowercase().strip_prefix("x-amz-meta-").map(|n| (n.to_string(), v.clone()))).collect()
}

fn content_type(req: &ProxyReq, key: &str) -> String {
    header(req, "content-type").filter(|c| !c.is_empty()).map(str::to_string).unwrap_or_else(|| {
        let t = type_of(key);
        if t == "application/octet-stream" { "binary/octet-stream".to_string() } else { t.to_string() }
    })
}

fn object_headers(store: &Store, key: &str, len: u64, modified: u64) -> Vec<(String, String)> {
    let meta = read_meta(store, key).unwrap_or_default();
    let mut h = vec![
        ("Content-Type".to_string(), if meta.content_type.is_empty() { type_of(key).to_string() } else { meta.content_type }),
        ("ETag".to_string(), format!("\"{}\"", if meta.etag.is_empty() { "unknown".to_string() } else { meta.etag })),
        ("Last-Modified".to_string(), http_date(modified)),
        ("Accept-Ranges".to_string(), "bytes".to_string()),
        ("x-amz-content-length".to_string(), len.to_string()),
    ];
    for (k, v) in meta.user {
        h.push((format!("x-amz-meta-{k}"), v));
    }
    h
}

fn put_object(store: &Store, key: &str, req: &ProxyReq) -> ProxyRes {
    let Some(path) = key_path(store, key) else { return error(400, "InvalidArgument", "This key cannot be kept as a file on this PC (no backslash, colon, empty part, dot at the end, device name)") };
    let data = match payload(req) {
        Ok(d) => d,
        Err(e) => return e,
    };
    if let Err(m) = write_atomic(store, &path, &data) {
        return error(409, "KeyConflict", &m);
    }
    let etag = md5_hex(&data);
    write_meta(store, key, &Meta { content_type: content_type(req, key), etag: etag.clone(), user: user_meta(req) });
    answer(200, vec![("ETag".to_string(), format!("\"{etag}\""))], Vec::new())
}

fn copy_object(store: &Store, key: &str, req: &ProxyReq, source: &str) -> ProxyRes {
    let source = pct_decode(source.split('?').next().unwrap_or(""), false);
    let source = source.trim_start_matches('/');
    let Some((bucket, from)) = source.split_once('/') else { return error(400, "InvalidArgument", "The copy source must be bucket/key") };
    if bucket != BUCKET_NAME {
        return error(404, "NoSuchBucket", "The specified bucket does not exist");
    }
    let (Some(from_path), Some(to_path)) = (key_path(store, from), key_path(store, key)) else { return error(400, "InvalidArgument", "This key cannot be kept as a file on this PC") };
    let Ok(data) = std::fs::read(&from_path) else { return no_such_key(from) };
    if let Err(m) = write_atomic(store, &to_path, &data) {
        return error(409, "KeyConflict", &m);
    }
    let old = read_meta(store, from).unwrap_or_default();
    let replace = header(req, "x-amz-metadata-directive").is_some_and(|d| d.eq_ignore_ascii_case("REPLACE"));
    let etag = md5_hex(&data);
    let meta = if replace { Meta { content_type: content_type(req, key), etag: etag.clone(), user: user_meta(req) } } else { Meta { content_type: old.content_type, etag: etag.clone(), user: old.user } };
    write_meta(store, key, &meta);
    xml(200, format!("<CopyObjectResult><LastModified>{}</LastModified><ETag>\"{etag}\"</ETag></CopyObjectResult>", iso(secs_of(SystemTime::now()))))
}

fn range_of(spec: &str, len: u64) -> Option<(u64, u64)> {
    let spec = spec.strip_prefix("bytes=")?;
    let first = spec.split(',').next()?.trim();
    let (a, b) = first.split_once('-')?;
    if a.is_empty() {
        let n: u64 = b.parse().ok()?;
        if n == 0 || len == 0 {
            return None;
        }
        return Some((len.saturating_sub(n), len - 1));
    }
    let start: u64 = a.parse().ok()?;
    let end: u64 = if b.is_empty() { len.checked_sub(1)? } else { b.parse::<u64>().ok()?.min(len.checked_sub(1)?) };
    (start <= end && start < len).then_some((start, end))
}

fn get_object(store: &Store, key: &str, req: &ProxyReq) -> ProxyRes {
    let Some(path) = key_path(store, key) else { return no_such_key(key) };
    let Ok(md) = std::fs::metadata(&path) else { return no_such_key(key) };
    if !md.is_file() {
        return no_such_key(key);
    }
    let Ok(data) = std::fs::read(&path) else { return no_such_key(key) };
    let len = data.len() as u64;
    let mut h = object_headers(store, key, len, secs_of(md.modified().unwrap_or(UNIX_EPOCH)));
    if let Some(r) = header(req, "range") {
        return match range_of(r, len) {
            Some((a, b)) => {
                h.push(("Content-Range".to_string(), format!("bytes {a}-{b}/{len}")));
                answer(206, h, data[a as usize..=b as usize].to_vec())
            }
            None => {
                let mut e = error(416, "InvalidRange", "The requested range is not satisfiable");
                e.headers.push(("Content-Range".to_string(), format!("bytes */{len}")));
                e
            }
        };
    }
    // the answer to a HEAD carries the length of the object and no body: the listener drops the body, the header says how long it would be
    let mut res = answer(200, h, data);
    if req.method == "HEAD" {
        res.headers.retain(|(k, _)| !k.eq_ignore_ascii_case("content-length"));
        res.headers.push(("Content-Length".to_string(), len.to_string()));
        res.body.clear();
    }
    res
}

fn delete_key(store: &Store, key: &str) {
    if let Some(path) = key_path(store, key) {
        if std::fs::remove_file(&path).is_ok() {
            if let Some(p) = path.parent() {
                prune_empty(store, p.to_path_buf());
            }
        }
        let _ = std::fs::remove_file(meta_path(store, key));
    }
}

fn list_objects(store: &Store, q: &BTreeMap<String, String>) -> ProxyRes {
    let v2 = q.get("list-type").is_some_and(|v| v == "2");
    let prefix = q.get("prefix").cloned().unwrap_or_default();
    let delimiter = q.get("delimiter").cloned().unwrap_or_default();
    let max: usize = q.get("max-keys").and_then(|m| m.parse().ok()).unwrap_or(1000).clamp(1, 1000);
    let after = if v2 { q.get("continuation-token").or_else(|| q.get("start-after")).cloned().unwrap_or_default() } else { q.get("marker").cloned().unwrap_or_default() };
    let mut contents: Vec<(String, u64, u64)> = Vec::new();
    let mut prefixes: Vec<String> = Vec::new();
    let mut count = 0;
    let mut truncated = false;
    let mut last = String::new();
    for (key, size, modified) in all_keys(store) {
        if !key.starts_with(&prefix) || (!after.is_empty() && key <= after) {
            continue;
        }
        // a key under a folder (`prefix` + text + delimiter) is listed once, as the folder
        let rest = &key[prefix.len()..];
        let folder = if delimiter.is_empty() { None } else { rest.find(&delimiter).map(|i| format!("{prefix}{}", &rest[..i + delimiter.len()])) };
        if let Some(f) = &folder {
            // a folder already listed (by this page, or by the page before: the token is inside it) is not listed twice
            if prefixes.last() == Some(f) || (!after.is_empty() && after.starts_with(f.as_str())) {
                last = key.clone();
                continue;
            }
        }
        if count >= max {
            truncated = true;
            break;
        }
        count += 1;
        last = key.clone();
        match folder {
            Some(f) => prefixes.push(f),
            None => contents.push((key, size, modified)),
        }
    }
    let mut body = format!("<ListBucketResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Name>{BUCKET_NAME}</Name><Prefix>{}</Prefix>", xml_escape(&prefix));
    if !delimiter.is_empty() {
        body.push_str(&format!("<Delimiter>{}</Delimiter>", xml_escape(&delimiter)));
    }
    body.push_str(&format!("<MaxKeys>{max}</MaxKeys>"));
    if v2 {
        body.push_str(&format!("<KeyCount>{}</KeyCount>", contents.len() + prefixes.len()));
        if let Some(t) = q.get("continuation-token") {
            body.push_str(&format!("<ContinuationToken>{}</ContinuationToken>", xml_escape(t)));
        }
        if truncated {
            body.push_str(&format!("<NextContinuationToken>{}</NextContinuationToken>", xml_escape(&last)));
        }
    } else {
        body.push_str(&format!("<Marker>{}</Marker>", xml_escape(&after)));
        if truncated && !delimiter.is_empty() {
            body.push_str(&format!("<NextMarker>{}</NextMarker>", xml_escape(&last)));
        }
    }
    body.push_str(&format!("<IsTruncated>{truncated}</IsTruncated>"));
    for (key, size, modified) in &contents {
        let etag = read_meta(store, key).map(|m| m.etag).filter(|e| !e.is_empty()).unwrap_or_else(|| "unknown".to_string());
        body.push_str(&format!("<Contents><Key>{}</Key><LastModified>{}</LastModified><ETag>&quot;{etag}&quot;</ETag><Size>{size}</Size><StorageClass>STANDARD</StorageClass></Contents>", xml_escape(key), iso(*modified)));
    }
    for p in &prefixes {
        body.push_str(&format!("<CommonPrefixes><Prefix>{}</Prefix></CommonPrefixes>", xml_escape(p)));
    }
    body.push_str("</ListBucketResult>");
    xml(200, body)
}

fn delete_many(store: &Store, req: &ProxyReq) -> ProxyRes {
    let text = String::from_utf8_lossy(&req.body).into_owned();
    let quiet = xml_texts(&text, "Quiet").first().is_some_and(|q| q == "true");
    let mut body = String::from("<DeleteResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\">");
    for key in xml_texts(&text, "Key") {
        delete_key(store, &key);
        if !quiet {
            body.push_str(&format!("<Deleted><Key>{}</Key></Deleted>", xml_escape(&key)));
        }
    }
    body.push_str("</DeleteResult>");
    xml(200, body)
}

// ---------------------------------------------------------------- multipart uploads

fn upload_dir(store: &Store, id: &str) -> Option<PathBuf> {
    (!id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric())).then(|| store.uploads().join(id))
}

fn start_upload(store: &Store, key: &str, req: &ProxyReq) -> ProxyRes {
    if !key_ok(key) {
        return error(400, "InvalidArgument", "This key cannot be kept as a file on this PC");
    }
    let id = uuid::Uuid::new_v4().simple().to_string();
    let dir = store.uploads().join(&id);
    if std::fs::create_dir_all(&dir).is_err() {
        return error(500, "InternalError", "The upload could not be started");
    }
    let v = serde_json::json!({ "key": key, "content_type": content_type(req, key), "user": user_meta(req) });
    let _ = std::fs::write(dir.join("upload.json"), v.to_string());
    xml(200, format!("<InitiateMultipartUploadResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Bucket>{BUCKET_NAME}</Bucket><Key>{}</Key><UploadId>{id}</UploadId></InitiateMultipartUploadResult>", xml_escape(key)))
}

fn put_part(store: &Store, req: &ProxyReq, id: &str, number: &str) -> ProxyRes {
    let Some(dir) = upload_dir(store, id).filter(|d| d.join("upload.json").is_file()) else { return error(404, "NoSuchUpload", "The specified upload does not exist") };
    let n: u32 = match number.parse() {
        Ok(n) if (1..=10000).contains(&n) => n,
        _ => return error(400, "InvalidArgument", "The part number must be between 1 and 10000"),
    };
    let data = match payload(req) {
        Ok(d) => d,
        Err(e) => return e,
    };
    if std::fs::write(dir.join(format!("part{n}")), &data).is_err() {
        return error(500, "InternalError", "The part could not be kept");
    }
    answer(200, vec![("ETag".to_string(), format!("\"{}\"", md5_hex(&data)))], Vec::new())
}

fn finish_upload(store: &Store, req: &ProxyReq, id: &str) -> ProxyRes {
    let Some(dir) = upload_dir(store, id).filter(|d| d.join("upload.json").is_file()) else { return error(404, "NoSuchUpload", "The specified upload does not exist") };
    let info: serde_json::Value = std::fs::read(dir.join("upload.json")).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
    let key = info["key"].as_str().unwrap_or("").to_string();
    let Some(path) = key_path(store, &key) else { return error(400, "InvalidArgument", "This key cannot be kept as a file on this PC") };
    let text = String::from_utf8_lossy(&req.body).into_owned();
    let numbers: Vec<u32> = xml_texts(&text, "PartNumber").iter().filter_map(|n| n.trim().parse().ok()).collect();
    if numbers.is_empty() {
        return error(400, "MalformedXML", "The list of parts is empty");
    }
    let mut whole = Vec::new();
    let mut digests = Vec::new();
    for n in &numbers {
        let Ok(part) = std::fs::read(dir.join(format!("part{n}"))) else { return error(400, "InvalidPart", &format!("Part {n} was not uploaded")) };
        digests.extend_from_slice(&md5(&part));
        whole.extend_from_slice(&part);
    }
    if let Err(m) = write_atomic(store, &path, &whole) {
        return error(409, "KeyConflict", &m);
    }
    let etag = format!("{}-{}", md5_hex(&digests), numbers.len());
    let user: BTreeMap<String, String> = info["user"].as_object().map(|o| o.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string()))).collect()).unwrap_or_default();
    write_meta(store, &key, &Meta { content_type: info["content_type"].as_str().unwrap_or("binary/octet-stream").to_string(), etag: etag.clone(), user });
    let _ = std::fs::remove_dir_all(&dir);
    xml(200, format!("<CompleteMultipartUploadResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Location>/{BUCKET_NAME}/{}</Location><Bucket>{BUCKET_NAME}</Bucket><Key>{}</Key><ETag>&quot;{etag}&quot;</ETag></CompleteMultipartUploadResult>", xml_escape(&key), xml_escape(&key)))
}

// ---------------------------------------------------------------- the request

/// Answer one request of a library (or of a browser that uploads to a signed address)
pub fn handle_request(store: &Store, req: &ProxyReq) -> ProxyRes {
    let (path, query) = req.target.split_once('?').unwrap_or((req.target.as_str(), ""));
    let q = parse_query(query);
    let method = req.method.as_str();
    if method == "OPTIONS" {
        let asked = header(req, "access-control-request-headers").unwrap_or("*").to_string();
        return answer(200, vec![("Access-Control-Allow-Methods".to_string(), "GET, PUT, POST, DELETE, HEAD".to_string()), ("Access-Control-Allow-Headers".to_string(), asked), ("Access-Control-Max-Age".to_string(), "600".to_string())], Vec::new());
    }
    let decoded = pct_decode(path, false);
    let trimmed = decoded.trim_start_matches('/');
    let (bucket, key) = trimmed.split_once('/').unwrap_or((trimmed, ""));
    if bucket.is_empty() {
        return if method == "GET" {
            xml(200, format!("<ListAllMyBucketsResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Owner><ID>kona</ID><DisplayName>kona</DisplayName></Owner><Buckets><Bucket><Name>{BUCKET_NAME}</Name><CreationDate>{}</CreationDate></Bucket></Buckets></ListAllMyBucketsResult>", iso(0)))
        } else {
            error(405, "MethodNotAllowed", "Only a list of buckets is answered here")
        };
    }
    if bucket != BUCKET_NAME {
        return error(404, "NoSuchBucket", &format!("The specified bucket does not exist: this bucket is called {BUCKET_NAME}"));
    }
    if key.is_empty() {
        return match method {
            "HEAD" | "PUT" => answer(200, Vec::new(), Vec::new()),
            "DELETE" => answer(204, Vec::new(), Vec::new()),
            "GET" if q.contains_key("location") => xml(200, "<LocationConstraint xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"></LocationConstraint>".to_string()),
            "GET" if q.contains_key("uploads") || q.contains_key("versions") || q.contains_key("cors") || q.contains_key("lifecycle") || q.contains_key("policy") => error(501, "NotImplemented", "This part of the protocol is not kept by the bucket of Kona"),
            "GET" => list_objects(store, &q),
            "POST" if q.contains_key("delete") => delete_many(store, req),
            _ => error(405, "MethodNotAllowed", "The method is not allowed on a bucket"),
        };
    }
    match method {
        "PUT" => {
            if let (Some(id), Some(n)) = (q.get("uploadId"), q.get("partNumber")) {
                if header(req, "x-amz-copy-source").is_some() {
                    return error(501, "NotImplemented", "Copying a part of an upload is not kept by the bucket of Kona");
                }
                return put_part(store, req, id, n);
            }
            if q.contains_key("acl") || q.contains_key("tagging") {
                return answer(200, Vec::new(), Vec::new());
            }
            match header(req, "x-amz-copy-source") {
                Some(src) => copy_object(store, key, req, src),
                None => put_object(store, key, req),
            }
        }
        "GET" | "HEAD" => {
            if q.contains_key("acl") {
                return xml(200, "<AccessControlPolicy xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Owner><ID>kona</ID></Owner><AccessControlList></AccessControlList></AccessControlPolicy>".to_string());
            }
            if q.contains_key("tagging") {
                return xml(200, "<Tagging xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><TagSet></TagSet></Tagging>".to_string());
            }
            if q.contains_key("uploadId") || q.contains_key("attributes") {
                return error(501, "NotImplemented", "This part of the protocol is not kept by the bucket of Kona");
            }
            get_object(store, key, req)
        }
        "DELETE" => {
            if let Some(id) = q.get("uploadId") {
                if let Some(dir) = upload_dir(store, id) {
                    let _ = std::fs::remove_dir_all(dir);
                }
                return answer(204, Vec::new(), Vec::new());
            }
            delete_key(store, key);
            answer(204, Vec::new(), Vec::new())
        }
        "POST" => {
            if q.contains_key("uploads") {
                return start_upload(store, key, req);
            }
            if let Some(id) = q.get("uploadId") {
                return finish_upload(store, req, id);
            }
            error(400, "InvalidRequest", "This call is not kept by the bucket of Kona")
        }
        _ => error(405, "MethodNotAllowed", "The method is not allowed on an object"),
    }
}

// ---------------------------------------------------------------- the listener

fn handle(store: Store, mut s: TcpStream) {
    let _ = s.set_read_timeout(Some(Duration::from_secs(60)));
    let _ = s.set_write_timeout(Some(Duration::from_secs(60)));
    match read_request(&mut s) {
        Ok(req) => {
            let res = handle_request(&store, &req);
            write_response(&mut s, &res, req.method == "HEAD");
        }
        Err(msg) if msg == "closed" => {}
        Err(msg) => write_response(&mut s, &error(400, "BadRequest", &msg), false),
    }
}

/// The bucket's web server, on 127.0.0.1 and a port of its own. Returns the port and the flag that ends it (set the flag, then open one connection to wake the listener).
pub fn open(root: PathBuf) -> Result<(u16, Arc<AtomicBool>), String> {
    let store = Store { root };
    for d in [store.objects(), store.metas(), store.uploads(), store.tmp()] {
        std::fs::create_dir_all(&d).map_err(|e| format!("The bucket's folder could not be made: {e}"))?;
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("The bucket could not be opened: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let stop = Arc::new(AtomicBool::new(false));
    let flag = stop.clone();
    std::thread::spawn(move || {
        for conn in listener.incoming() {
            if flag.load(Ordering::SeqCst) {
                break;
            }
            if let Ok(s) = conn {
                let store = store.clone();
                std::thread::spawn(move || handle(store, s));
            }
        }
    });
    Ok((port, stop))
}

pub fn close(port: u16, stop: &Arc<AtomicBool>) {
    stop.store(true, Ordering::SeqCst);
    let _ = TcpStream::connect_timeout(&SocketAddr::from(([127, 0, 0, 1], port)), Duration::from_millis(300));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (Store, PathBuf) {
        let dir = std::env::temp_dir().join(format!("kona-bucket-test-{}-{}", std::process::id(), TMP_N.fetch_add(1, Ordering::SeqCst)));
        for d in ["objects", "meta", "uploads", "tmp"] {
            std::fs::create_dir_all(dir.join(d)).unwrap();
        }
        (Store { root: dir.clone() }, dir)
    }

    fn req(method: &str, target: &str, headers: &[(&str, &str)], body: &[u8]) -> ProxyReq {
        ProxyReq { method: method.to_string(), target: target.to_string(), headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(), body: body.to_vec() }
    }

    fn text(r: &ProxyRes) -> String {
        String::from_utf8_lossy(&r.body).into_owned()
    }

    fn h(r: &ProxyRes, name: &str) -> Option<String> {
        r.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(name)).map(|(_, v)| v.clone())
    }

    #[test]
    fn md5_matches_the_known_answers() {
        assert_eq!(md5_hex(b""), "d41d8cd98f00b204e9800998ecf8427e");
        assert_eq!(md5_hex(b"abc"), "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(md5_hex(b"The quick brown fox jumps over the lazy dog"), "9e107d9d372bb6826bd81d3542a419d6");
        assert_eq!(md5_hex(&vec![b'a'; 1000]), "cabe45dcc9ae5b66ba86600cca6b8ba8");
    }

    #[test]
    fn dates_are_written_the_way_the_protocol_wants() {
        assert_eq!(iso(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(http_date(0), "Thu, 01 Jan 1970 00:00:00 GMT");
        assert_eq!(http_date(1_794_982_045), "Wed, 18 Nov 2026 06:07:25 GMT");
        assert_eq!(iso(951_782_400), "2000-02-29T00:00:00.000Z");
    }

    #[test]
    fn keys_that_a_windows_file_cannot_hold_are_refused() {
        for good in ["a", "a/b.jpg", "content-images/teacher/2026-11-18_x.jpg", "with space/and ünï.png", ".hidden"] {
            assert!(key_ok(good), "{good}");
        }
        for bad in ["", "/a", "a/", "a//b", "../a", "a/../b", "a\\b", "c:/x", "a:b", "x.", "dir /f", "CON", "nul.txt", "a/com1", "lpt9.log", "q?", "a*b", "line\nbreak"] {
            assert!(!key_ok(bad), "{bad:?}");
        }
    }

    #[test]
    fn an_object_is_put_read_listed_copied_and_deleted() {
        let (s, dir) = store();
        let put = handle_request(&s, &req("PUT", "/kona/pictures/a%20b.png", &[("Content-Type", "image/png"), ("x-amz-meta-owner", "Dimas")], b"hello"));
        assert_eq!(put.status, 200);
        assert_eq!(h(&put, "ETag").unwrap(), "\"5d41402abc4b2a76b9719d911017c592\"");
        let get = handle_request(&s, &req("GET", "/kona/pictures/a%20b.png", &[], b""));
        assert_eq!((get.status, get.body.as_slice()), (200, b"hello".as_slice()));
        assert_eq!(h(&get, "Content-Type").unwrap(), "image/png");
        assert_eq!(h(&get, "x-amz-meta-owner").unwrap(), "Dimas");
        let head = handle_request(&s, &req("HEAD", "/kona/pictures/a%20b.png", &[], b""));
        assert_eq!((head.status, h(&head, "Content-Length").unwrap().as_str(), head.body.len()), (200, "5", 0));
        // a range, the last bytes, and one outside
        let r = handle_request(&s, &req("GET", "/kona/pictures/a%20b.png", &[("Range", "bytes=1-2")], b""));
        assert_eq!((r.status, r.body.as_slice(), h(&r, "Content-Range").unwrap().as_str()), (206, b"el".as_slice(), "bytes 1-2/5"));
        assert_eq!(handle_request(&s, &req("GET", "/kona/pictures/a%20b.png", &[("Range", "bytes=-2")], b"")).body, b"lo");
        assert_eq!(handle_request(&s, &req("GET", "/kona/pictures/a%20b.png", &[("Range", "bytes=9-")], b"")).status, 416);
        // a copy keeps the type and the user data
        let copy = handle_request(&s, &req("PUT", "/kona/copies/c.png", &[("x-amz-copy-source", "/kona/pictures/a%20b.png")], b""));
        assert_eq!(copy.status, 200);
        assert!(text(&copy).contains("<CopyObjectResult>"));
        assert_eq!(h(&handle_request(&s, &req("GET", "/kona/copies/c.png", &[], b"")), "Content-Type").unwrap(), "image/png");
        // a list with a prefix and a delimiter
        handle_request(&s, &req("PUT", "/kona/pictures/b.png", &[], b"x"));
        let list = text(&handle_request(&s, &req("GET", "/kona?list-type=2&prefix=&delimiter=%2F", &[], b"")));
        assert!(list.contains("<Prefix>pictures/</Prefix></CommonPrefixes>") && list.contains("<Prefix>copies/</Prefix></CommonPrefixes>"), "{list}");
        assert!(list.contains("<KeyCount>2</KeyCount>") && list.contains("<IsTruncated>false</IsTruncated>"), "{list}");
        let under = text(&handle_request(&s, &req("GET", "/kona?list-type=2&prefix=pictures%2F", &[], b"")));
        assert!(under.contains("<Key>pictures/a b.png</Key>") && under.contains("<Key>pictures/b.png</Key>") && under.contains("<Size>5</Size>"), "{under}");
        // pages
        let page = text(&handle_request(&s, &req("GET", "/kona?list-type=2&max-keys=1", &[], b"")));
        assert!(page.contains("<IsTruncated>true</IsTruncated>") && page.contains("<NextContinuationToken>copies/c.png</NextContinuationToken>"), "{page}");
        let next = text(&handle_request(&s, &req("GET", "/kona?list-type=2&max-keys=5&continuation-token=copies%2Fc.png", &[], b"")));
        assert!(!next.contains("copies/c.png</Key>") && next.contains("pictures/a b.png"), "{next}");
        // delete one and many; a missing key is still a quiet success
        assert_eq!(handle_request(&s, &req("DELETE", "/kona/pictures/b.png", &[], b"")).status, 204);
        assert_eq!(handle_request(&s, &req("DELETE", "/kona/pictures/b.png", &[], b"")).status, 204);
        let many = handle_request(&s, &req("POST", "/kona?delete", &[], b"<Delete><Object><Key>copies/c.png</Key></Object><Object><Key>pictures/a b.png</Key></Object></Delete>"));
        assert!(text(&many).contains("<Deleted><Key>copies/c.png</Key></Deleted>"), "{}", text(&many));
        assert_eq!(handle_request(&s, &req("GET", "/kona/pictures/a%20b.png", &[], b"")).status, 404);
        assert!(!dir.join("objects").join("pictures").exists(), "empty folders are taken away with the last object");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_missing_key_a_missing_bucket_and_a_bad_key_have_their_own_errors() {
        let (s, dir) = store();
        let r = handle_request(&s, &req("GET", "/kona/nothing.txt", &[], b""));
        assert!(r.status == 404 && text(&r).contains("<Code>NoSuchKey</Code>"));
        let r = handle_request(&s, &req("GET", "/other/x", &[], b""));
        assert!(r.status == 404 && text(&r).contains("<Code>NoSuchBucket</Code>"));
        let r = handle_request(&s, &req("PUT", "/kona/a%5Cb", &[], b"x"));
        assert!(r.status == 400 && text(&r).contains("<Code>InvalidArgument</Code>"));
        let r = handle_request(&s, &req("PUT", "/kona/..%2Fescape", &[], b"x"));
        assert_eq!(r.status, 400);
        assert!(!dir.join("escape").exists() && !dir.parent().unwrap().join("escape").exists());
        // a key that is a file cannot also be a folder
        assert_eq!(handle_request(&s, &req("PUT", "/kona/a/b", &[], b"x")).status, 200);
        assert_eq!(handle_request(&s, &req("PUT", "/kona/a/b/c", &[], b"x")).status, 409);
        assert_eq!(handle_request(&s, &req("PUT", "/kona/a", &[], b"x")).status, 409);
        // the bucket itself is there, and a browser's check is answered
        assert_eq!(handle_request(&s, &req("HEAD", "/kona", &[], b"")).status, 200);
        let o = handle_request(&s, &req("OPTIONS", "/kona/a/b", &[("Access-Control-Request-Headers", "content-type,x-amz-date")], b""));
        assert_eq!((o.status, h(&o, "Access-Control-Allow-Headers").unwrap().as_str(), h(&o, "Access-Control-Allow-Origin").unwrap().as_str()), (200, "content-type,x-amz-date", "*"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_body_sent_in_the_aws_chunked_way_is_unpacked() {
        let (s, dir) = store();
        let body = b"5;chunk-signature=aaaa\r\nhello\r\n6;chunk-signature=bbbb\r\n world\r\n0;chunk-signature=cccc\r\nx-amz-checksum-crc32:AAAA\r\n\r\n";
        let r = handle_request(&s, &req("PUT", "/kona/streamed.txt", &[("x-amz-content-sha256", "STREAMING-AWS4-HMAC-SHA256-PAYLOAD"), ("Content-Encoding", "aws-chunked"), ("x-amz-decoded-content-length", "11")], body));
        assert_eq!(r.status, 200);
        assert_eq!(handle_request(&s, &req("GET", "/kona/streamed.txt", &[], b"")).body, b"hello world");
        assert_eq!(h(&r, "ETag").unwrap(), format!("\"{}\"", md5_hex(b"hello world")));
        let broken = handle_request(&s, &req("PUT", "/kona/b.txt", &[("x-amz-content-sha256", "STREAMING-UNSIGNED-PAYLOAD-TRAILER")], b"zz;x\r\nhello"));
        assert_eq!(broken.status, 400);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_multipart_upload_is_made_of_its_parts_in_the_order_the_library_names() {
        let (s, dir) = store();
        let start = handle_request(&s, &req("POST", "/kona/big/video.mp4?uploads", &[("Content-Type", "video/mp4")], b""));
        let id = xml_texts(&text(&start), "UploadId")[0].clone();
        let p2 = handle_request(&s, &req("PUT", &format!("/kona/big/video.mp4?partNumber=2&uploadId={id}"), &[], b"world"));
        let p1 = handle_request(&s, &req("PUT", &format!("/kona/big/video.mp4?partNumber=1&uploadId={id}"), &[], b"hello "));
        assert_eq!((p1.status, p2.status), (200, 200));
        let done = handle_request(&s, &req("POST", &format!("/kona/big/video.mp4?uploadId={id}"), &[], b"<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>x</ETag></Part><Part><PartNumber>2</PartNumber><ETag>y</ETag></Part></CompleteMultipartUpload>"));
        assert_eq!(done.status, 200, "{}", text(&done));
        assert!(text(&done).contains("-2&quot;"), "{}", text(&done));
        let got = handle_request(&s, &req("GET", "/kona/big/video.mp4", &[], b""));
        assert_eq!((got.body.as_slice(), h(&got, "Content-Type").unwrap().as_str()), (b"hello world".as_slice(), "video/mp4"));
        assert!(!dir.join("uploads").join(&id).exists(), "the parts are gone once the object is made");
        // a missing part, an unknown upload, an abort
        let again = handle_request(&s, &req("POST", "/kona/x?uploads", &[], b""));
        let id2 = xml_texts(&text(&again), "UploadId")[0].clone();
        assert_eq!(handle_request(&s, &req("POST", &format!("/kona/x?uploadId={id2}"), &[], b"<Part><PartNumber>1</PartNumber></Part>")).status, 400);
        assert_eq!(handle_request(&s, &req("DELETE", &format!("/kona/x?uploadId={id2}"), &[], b"")).status, 204);
        assert_eq!(handle_request(&s, &req("PUT", &format!("/kona/x?partNumber=1&uploadId={id2}"), &[], b"a")).status, 404);
        assert_eq!(handle_request(&s, &req("PUT", "/kona/x?partNumber=1&uploadId=..%2F..", &[], b"a")).status, 404);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn the_public_address_gives_the_object_with_its_type() {
        let (s, dir) = store();
        handle_request(&s, &req("PUT", "/kona/p/x.png", &[], b"png"));
        let (data, ctype) = read_public(&dir, "p/x.png").unwrap();
        assert_eq!((data.as_slice(), ctype.as_str()), (b"png".as_slice(), "image/png"));
        assert!(read_public(&dir, "p/missing.png").is_none() && read_public(&dir, "../x").is_none());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn the_listener_answers_a_real_connection() {
        let (s, dir) = store();
        let (port, stop) = open(s.root.clone()).unwrap();
        let up = crate::live::upstream(port, "PUT", "/kona/live/one.txt", &[("content-type".to_string(), "text/plain".to_string())], b"over the wire").unwrap();
        assert_eq!(up.status, 200);
        let got = crate::live::upstream(port, "GET", "/kona/live/one.txt", &[], b"").unwrap();
        assert_eq!((got.status, got.body.as_slice()), (200, b"over the wire".as_slice()));
        let big = vec![7u8; 3 * 1024 * 1024];
        assert_eq!(crate::live::upstream(port, "PUT", "/kona/live/big.bin", &[], &big).unwrap().status, 200);
        assert_eq!(crate::live::upstream(port, "GET", "/kona/live/big.bin", &[], b"").unwrap().body.len(), big.len());
        close(port, &stop);
        let _ = std::fs::remove_dir_all(dir);
    }
}
