// Reading a project's folders and files, read only (feature F4). Only paths inside a project are allowed.
// Folders are listed one level at a time when the screen opens them, so a big project costs nothing until you look in it.
use crate::projects::Projects;
use base64::Engine;
use serde::Serialize;
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;
use std::time::UNIX_EPOCH;

const TEXT_LIMIT: u64 = 2 * 1024 * 1024;
const MEDIA_LIMIT: u64 = 25 * 1024 * 1024;

#[derive(Serialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    /// seconds since 1970
    pub modified: Option<u64>,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum FileView {
    Text { text: String, size: u64, truncated: bool },
    Image { mime: String, data: String, size: u64 },
    Pdf { data: String, size: u64 },
    Binary { size: u64 },
    TooLarge { size: u64 },
}

pub fn list_dir(projects: &Projects, path: &str) -> Result<Vec<Entry>, String> {
    let dir = Path::new(path);
    if !projects.allows(dir) {
        return Err("That folder is not inside a project".into());
    }
    let mut out = Vec::new();
    for e in fs::read_dir(dir).map_err(|e| format!("Could not open the folder: {e}"))? {
        let Ok(e) = e else { continue };
        let Ok(meta) = e.metadata() else { continue };
        out.push(Entry {
            name: e.file_name().to_string_lossy().into_owned(),
            path: e.path().to_string_lossy().into_owned(),
            is_dir: meta.is_dir(),
            size: if meta.is_dir() { 0 } else { meta.len() },
            modified: meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()),
        });
    }
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(out)
}

/// One thing Git says about the working copy: the full path (as the tree lists it), a one-letter state, and whether the path is a whole folder
/// (a folder with nothing tracked in it yet, which Git lists as one line). States: U new and not yet in Git, A added, M changed, D deleted, C a clash.
#[derive(Serialize, Debug, PartialEq)]
pub struct GitMark {
    pub path: String,
    pub code: String,
    pub dir: bool,
}

/// Read `git status --porcelain=v1 -z` (paths are from the repository's top folder `top`). Each record is two letters, a space, the path and a NUL;
/// the first letter is the staged state and the second the state in the folder. Only the states the screen shows are kept.
fn parse_status(top: &str, raw: &str) -> Vec<GitMark> {
    let top = top.trim().trim_end_matches(['/', '\\']);
    let mut out = Vec::new();
    for rec in raw.split('\0') {
        let b = rec.as_bytes();
        if b.len() < 4 || b[2] != b' ' { continue; }
        let (x, y) = (b[0] as char, b[1] as char);
        let code = if x == '?' && y == '?' { "U" }
            else if x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D') { "C" }
            else if x == 'A' { "A" }
            else {
                match if y != ' ' { y } else { x } { 'M' | 'T' => "M", 'A' => "A", 'D' => "D", _ => continue }
            };
        let rel = &rec[3..];
        let dir = rel.ends_with('/');
        let rel = rel.trim_end_matches('/');
        out.push(GitMark { path: format!("{top}/{rel}").replace('/', "\\"), code: code.into(), dir });
    }
    out
}

/// What Git says about every changed file of the repository a project's folder is in, for the little letters in the file tree (U, A, M, D, C).
/// Nothing when the folder is not in a Git repository or Git is not there. The caller has already checked that the folder is inside a project.
/// It only reads, and `--no-optional-locks` keeps it from touching the index while an agent is committing.
pub fn git_marks(folder: &str) -> Vec<GitMark> {
    let dir = Path::new(folder);
    let run = |args: &[&str]| -> Option<String> {
        let out = Command::new("git").arg("--no-optional-locks").args(args).current_dir(dir).env("GIT_TERMINAL_PROMPT", "0").creation_flags(0x0800_0000).output().ok()?;
        if out.status.success() { Some(String::from_utf8_lossy(&out.stdout).into_owned()) } else { None }
    };
    let Some(top) = run(&["rev-parse", "--show-toplevel"]) else { return vec![] };
    let Some(raw) = run(&["status", "--porcelain=v1", "-z", "--untracked-files=normal", "--no-renames"]) else { return vec![] };
    parse_status(&top, &raw)
}

fn image_mime(ext: &str) -> Option<&'static str> {
    Some(match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "svg" => "image/svg+xml",
        _ => return None,
    })
}

pub fn read_file(projects: &Projects, path: &str) -> Result<FileView, String> {
    let p = Path::new(path);
    if !projects.allows(p) {
        return Err("That file is not inside a project".into());
    }
    let meta = fs::metadata(p).map_err(|e| format!("Could not open the file: {e}"))?;
    if !meta.is_file() {
        return Err("That is not a file".into());
    }
    let size = meta.len();
    let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let b64 = |bytes: &[u8]| base64::engine::general_purpose::STANDARD.encode(bytes);

    if let Some(mime) = image_mime(&ext) {
        if size > MEDIA_LIMIT {
            return Ok(FileView::TooLarge { size });
        }
        return Ok(FileView::Image { mime: mime.into(), data: b64(&fs::read(p).map_err(|e| e.to_string())?), size });
    }
    if ext == "pdf" {
        if size > MEDIA_LIMIT {
            return Ok(FileView::TooLarge { size });
        }
        return Ok(FileView::Pdf { data: b64(&fs::read(p).map_err(|e| e.to_string())?), size });
    }

    // anything else: text if it looks like text, otherwise just say what it is
    use std::io::Read;
    let mut buf = Vec::new();
    fs::File::open(p).and_then(|f| f.take(TEXT_LIMIT).read_to_end(&mut buf)).map_err(|e| e.to_string())?;
    if buf.iter().take(8192).any(|b| *b == 0) {
        return Ok(FileView::Binary { size });
    }
    Ok(FileView::Text { text: String::from_utf8_lossy(&buf).into_owned(), size, truncated: size > TEXT_LIMIT })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_what_git_says() {
        let raw = "?? new.txt\0 M src/a.rs\0A  added.rs\0AM both.rs\0 D gone.rs\0UU clash.rs\0?? fresh/\0!! ignored.log\0";
        let m = parse_status("D:/repo\n", raw);
        let got: Vec<(&str, &str, bool)> = m.iter().map(|g| (g.path.as_str(), g.code.as_str(), g.dir)).collect();
        assert_eq!(got, vec![
            (r"D:\repo\new.txt", "U", false), (r"D:\repo\src\a.rs", "M", false), (r"D:\repo\added.rs", "A", false), (r"D:\repo\both.rs", "A", false),
            (r"D:\repo\gone.rs", "D", false), (r"D:\repo\clash.rs", "C", false), (r"D:\repo\fresh", "U", true),
        ]);
    }
}
