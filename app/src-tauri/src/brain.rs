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

// ---- the list of every note by topic (decision 104)
// Every note names its topic in its own front matter (`topic: Landing page`). A note that has `generated: topics` in its front matter is the list of all the notes by topic: Kona writes
// it from those lines whenever the brain is read or a note is saved, so it cannot go out of date or disagree with the Notes list. It keeps the one-line summaries that were written
// next to each link, takes the title for a note that has none, and is never searched (the screen and the tool server both leave it out), so it cannot answer a question in place of a note.

/// The topic of a note as it is kept: one line, single spaces, at most 40 letters.
pub fn clean_topic(s: &str) -> String {
    s.replace(['\r', '\n'], " ").split_whitespace().collect::<Vec<_>>().join(" ").chars().take(40).collect::<String>().trim().to_string()
}

fn note_title(meta: &std::collections::HashMap<String, String>, text: &str, id: &str) -> String {
    meta.get("title").or_else(|| meta.get("name")).cloned()
        .or_else(|| text.replace('\r', "").split('\n').find(|l| l.starts_with("# ")).map(|l| l[2..].trim().to_string()))
        .unwrap_or_else(|| id.to_string())
}

/// The one-line summaries written next to the links of an existing list: `- [[id]]: summary`.
fn old_summaries(text: &str) -> std::collections::HashMap<String, String> {
    let mut out = std::collections::HashMap::new();
    for l in text.replace('\r', "").split('\n') {
        let Some(rest) = l.trim().strip_prefix("- [[") else { continue };
        let Some((id, after)) = rest.split_once("]]") else { continue };
        let Some(sum) = after.strip_prefix(':') else { continue };
        let sum = sum.trim();
        if !sum.is_empty() && !id.contains('[') { out.insert(id.trim().to_string(), sum.to_string()); }
    }
    out
}

/// The text of the list of notes by topic for these notes `(id, title, topic)`, written the way `old` was (its front matter and summaries are kept). `updated` is the day to stamp.
fn index_text(old: &str, notes: &[(String, String, String)], updated: &str) -> String {
    let (meta, _) = crate::brain_search::front_matter(old);
    let t = old.replace('\r', "");
    let lines: Vec<&str> = t.split('\n').collect();
    let close = if lines.first() == Some(&"---") { lines.iter().skip(1).position(|l| *l == "---").map(|p| p + 1) } else { None };
    let mut front: Vec<String> = vec![];
    if let Some(c) = close {
        for l in &lines[1..c] {
            let key = l.split_once(':').map(|(k, _)| k.trim().to_lowercase()).unwrap_or_default();
            if key == "updated" || key == "generated" { continue; }
            front.push(l.to_string());
        }
    }
    if !front.iter().any(|l| l.split_once(':').is_some_and(|(k, _)| k.trim().eq_ignore_ascii_case("title"))) { front.insert(0, "title: Every note by topic".into()); }
    if !front.iter().any(|l| l.split_once(':').is_some_and(|(k, _)| k.trim().eq_ignore_ascii_case("topic"))) { front.push("topic: Index".into()); }
    front.push("generated: topics".into());
    front.push(format!("updated: {updated}"));
    let title = meta.get("title").cloned().unwrap_or_else(|| "Every note by topic".into());
    let sums = old_summaries(old);
    let mut by: std::collections::BTreeMap<String, (String, Vec<&(String, String, String)>)> = std::collections::BTreeMap::new();
    let mut none: Vec<&(String, String, String)> = vec![];
    for n in notes {
        if n.2.is_empty() { none.push(n); continue; }
        by.entry(n.2.to_lowercase()).or_insert_with(|| (n.2.clone(), vec![])).1.push(n);
    }
    let sort = |v: &mut Vec<&(String, String, String)>| v.sort_by(|a, b| a.1.to_lowercase().cmp(&b.1.to_lowercase()).then(a.0.cmp(&b.0)));
    let mut out = format!("---\n{}\n---\n# {title}\n\nKona writes this list from the topic line of every note, whenever a note is saved. Do not edit it by hand: it is rewritten. To move a note, change that note's topic.\n", front.join("\n"));
    let mut section = |label: &str, mut v: Vec<&(String, String, String)>| {
        sort(&mut v);
        out.push_str(&format!("\n## {label}\n\n"));
        for n in v { out.push_str(&format!("- [[{}]]: {}\n", n.0, sums.get(&n.0).cloned().unwrap_or_else(|| n.1.clone()))); }
    };
    for (_, (label, v)) in by { section(&label, v); }
    if !none.is_empty() { section("No topic yet", none); }
    out
}

/// Write the lists of notes by topic again, for the notes as they are now. Only a note that already has `generated:` in its front matter is a list, and it is written only when what it
/// holds changes. Returns the ids of the lists that were written.
pub fn regenerate_indexes(project: &Path) -> Vec<String> {
    let notes = read_dir_notes(&dir(project), "project", false, "");
    let parsed: Vec<(String, std::collections::HashMap<String, String>, String)> = notes.iter().map(|n| (n.id.clone(), crate::brain_search::front_matter(&n.text).0, n.text.clone())).collect();
    let lists: Vec<&(String, std::collections::HashMap<String, String>, String)> = parsed.iter().filter(|p| p.1.contains_key("generated")).collect();
    if lists.is_empty() { return vec![]; }
    let rows: Vec<(String, String, String)> = parsed.iter().filter(|p| !p.1.contains_key("generated")).map(|p| (p.0.clone(), note_title(&p.1, &p.2, &p.0), clean_topic(p.1.get("topic").map(String::as_str).unwrap_or("")))).collect();
    let today: String = crate::tickets::now().chars().take(10).collect();
    let strip = |s: &str| s.replace('\r', "").split('\n').filter(|l| !l.trim_start().to_lowercase().starts_with("updated:")).collect::<Vec<_>>().join("\n");
    let mut written = vec![];
    for (id, _, old) in lists {
        let new = index_text(old, &rows, &today);
        if strip(&new) == strip(old) { continue; }
        if save(project, id, &new).is_ok() { written.push(id.clone()); }
    }
    written
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
