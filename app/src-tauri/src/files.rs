// Reading a project's folders and files, read only (feature F4). Only paths inside a project are allowed.
// Folders are listed one level at a time when the screen opens them, so a big project costs nothing until you look in it.
use crate::projects::Projects;
use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::Path;
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
