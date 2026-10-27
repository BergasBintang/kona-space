// The brain's files (feature F7). The notes are plain markdown, one file each, and the files are the source of truth:
//   project notes     `<project>\.kona\brain\<id>.md`      the owner's (and, later, sessions') notes; Kona may write these
//   Claude's memory   `~\.claude\projects\<project>\memory\*.md`   read only: Kona never writes there
// The starter notes ship inside the app (see the screen code) and never touch the disk. Everything else about the brain (links,
// sections, search, clusters, the report) is built on the screen from these texts, so this file only reads, writes and lists.
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_NOTE_BYTES: u64 = 200 * 1024;
const MAX_NOTES: usize = 500;

#[derive(Serialize)]
pub struct RawNote {
    pub id: String,
    /// "project" or "memory"
    pub layer: String,
    pub text: String,
    pub path: String,
    /// last change, milliseconds since 1970
    pub mtime: u64,
    pub readonly: bool,
}

#[derive(Serialize)]
pub struct BrainData {
    pub notes: Vec<RawNote>,
    /// the memory folder that was read, if there is one
    pub memory_dir: Option<String>,
}

pub fn valid_id(id: &str) -> bool {
    let b = id.as_bytes();
    !b.is_empty() && b.len() <= 60 && (b[0].is_ascii_lowercase() || b[0].is_ascii_digit()) && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
}

pub fn dir(project: &Path) -> PathBuf {
    project.join(".kona").join("brain")
}

fn mtime(m: &fs::Metadata) -> u64 {
    m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn read_dir_notes(d: &Path, layer: &str, readonly: bool, prefix: &str) -> Vec<RawNote> {
    let Ok(rd) = fs::read_dir(d) else { return vec![] };
    let mut out: Vec<RawNote> = vec![];
    for e in rd.filter_map(Result::ok) {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()) != Some("md") { continue; }
        let Ok(m) = e.metadata() else { continue };
        if !m.is_file() || m.len() > MAX_NOTE_BYTES { continue; }
        let stem = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        // the memory folder's index file is called MEMORY.md
        let mut id: String = stem.to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect();
        id = id.trim_matches('-').to_string();
        if id == "memory" && prefix == "memory-" { id = "index".into(); }
        let id = format!("{prefix}{id}");
        if !valid_id(&id) { continue; }
        let Ok(text) = fs::read_to_string(&p) else { continue };
        out.push(RawNote { id, layer: layer.into(), text, path: p.to_string_lossy().to_string(), mtime: mtime(&m), readonly });
        if out.len() >= MAX_NOTES { break; }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}

/// Claude Code names a project's folder by turning every character that is not a letter or digit into a dash; the drive letter's
/// case is not steady (`d--kona-space` and `D--kona-space-app` both exist), so the match ignores case.
fn memory_dir(project: &Path) -> Option<PathBuf> {
    let slug: String = project.to_string_lossy().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect::<String>().to_lowercase();
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    let projects = PathBuf::from(home).join(".claude").join("projects");
    for e in fs::read_dir(&projects).ok()?.filter_map(Result::ok) {
        if e.file_name().to_string_lossy().to_lowercase() == slug {
            let m = e.path().join("memory");
            if m.is_dir() { return Some(m); }
        }
    }
    None
}

pub fn load(project: &Path) -> BrainData {
    let mut notes = read_dir_notes(&dir(project), "project", false, "");
    let mem = memory_dir(project);
    if let Some(m) = &mem {
        notes.extend(read_dir_notes(m, "memory", true, "memory-"));
    }
    BrainData { notes, memory_dir: mem.map(|m| m.to_string_lossy().to_string()) }
}

/// Write one project note (never a memory or starter note). The text goes to a temporary file first and is renamed over the note.
pub fn save(project: &Path, id: &str, text: &str) -> Result<RawNote, String> {
    if !valid_id(id) { return Err("A note's name uses lower-case letters, digits and dashes, up to 60 characters".into()); }
    if id.starts_with("memory-") { return Err("Names starting with memory- belong to Claude's memory, which Kona never writes".into()); }
    if text.len() as u64 > MAX_NOTE_BYTES { return Err("That note is longer than 200 KB".into()); }
    let d = dir(project);
    fs::create_dir_all(&d).map_err(|e| format!("Could not make the brain folder: {e}"))?;
    let p = d.join(format!("{id}.md"));
    let tmp = d.join(format!("{id}.md.tmp"));
    fs::write(&tmp, text).map_err(|e| format!("Could not save the note: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| format!("Could not save the note: {e}"))?;
    let m = fs::metadata(&p).map_err(|e| e.to_string())?;
    Ok(RawNote { id: id.into(), layer: "project".into(), text: text.into(), path: p.to_string_lossy().to_string(), mtime: mtime(&m), readonly: false })
}

pub fn delete(project: &Path, id: &str) -> Result<(), String> {
    if !valid_id(id) || id.starts_with("memory-") { return Err("That is not a project note".into()); }
    fs::remove_file(dir(project).join(format!("{id}.md"))).map_err(|e| format!("Could not delete the note: {e}"))
}

// ---- the wanted list: questions the brain could not answer. The text stays on this PC.

#[derive(Serialize, Deserialize, Clone)]
pub struct Wanted {
    pub question: String,
    pub count: u32,
    pub first: String,
    pub last: String,
}

#[derive(Serialize, Deserialize)]
struct WantedFile {
    version: u32,
    items: Vec<Wanted>,
}

fn wanted_path(project: &Path) -> PathBuf {
    dir(project).join(".wanted.json")
}

pub fn wanted_list(project: &Path) -> Vec<Wanted> {
    fs::read_to_string(wanted_path(project)).ok().and_then(|t| serde_json::from_str::<WantedFile>(&t).ok()).map(|f| f.items).unwrap_or_default()
}

fn wanted_save(project: &Path, items: Vec<Wanted>) -> Result<(), String> {
    fs::create_dir_all(dir(project)).map_err(|e| e.to_string())?;
    let t = serde_json::to_string_pretty(&WantedFile { version: 1, items }).map_err(|e| e.to_string())?;
    fs::write(wanted_path(project), t).map_err(|e| e.to_string())
}

pub fn wanted_add(project: &Path, question: &str) -> Result<Vec<Wanted>, String> {
    let q = question.split_whitespace().collect::<Vec<_>>().join(" ");
    if q.is_empty() { return Err("Empty question".into()); }
    let q: String = q.chars().take(300).collect();
    let now = crate::tickets::now();
    let mut items = wanted_list(project);
    if let Some(w) = items.iter_mut().find(|w| w.question.to_lowercase() == q.to_lowercase()) {
        w.count += 1;
        w.last = now;
    } else {
        items.push(Wanted { question: q, count: 1, first: now.clone(), last: now });
    }
    items.truncate(200);
    wanted_save(project, items.clone())?;
    Ok(items)
}

pub fn wanted_remove(project: &Path, question: &str) -> Result<Vec<Wanted>, String> {
    let mut items = wanted_list(project);
    items.retain(|w| w.question.to_lowercase() != question.to_lowercase());
    wanted_save(project, items.clone())?;
    Ok(items)
}
