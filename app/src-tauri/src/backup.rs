// Backups and settings (step 8). A backup is a plain folder of copies under `%APPDATA%\Kona\backups\<date and time>`:
//   Kona's own files (projects, roles, accounts, the voice, the servers list, settings), the cost ledger (copied with SQLite's own
//   `VACUUM INTO`, so the copy is whole even while Kona runs) and, for every project, its hidden `.kona` folder (tickets, brain notes, the
//   wanted list) without the `worktrees` folder, which is working copies of the repo and can be rebuilt from Git.
// Kona never deletes a backup by itself: the screen lists them and deletes one only after the owner confirms.
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
pub struct Settings {
    /// how many sessions may run at once; each `claude` program takes about 400 MB on this small PC (decision 32)
    pub max_sessions: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self { max_sessions: 2 }
    }
}

pub struct SettingsStore {
    file: PathBuf,
    cur: Mutex<Settings>,
}

impl SettingsStore {
    pub fn load(base: &Path) -> Self {
        let file = base.join("settings.json");
        let cur = fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str::<Settings>(&t).ok()).unwrap_or_default();
        Self { file, cur: Mutex::new(cur) }
    }
    pub fn get(&self) -> Settings {
        self.cur.lock().unwrap().clone()
    }
    pub fn set(&self, s: Settings) -> Result<Settings, String> {
        if s.max_sessions == 0 || s.max_sessions > 3 { return Err("The number of sessions must be between 1 and 3 (the plan's hard cap for this PC)".into()); }
        if let Some(d) = self.file.parent() { fs::create_dir_all(d).map_err(|e| e.to_string())?; }
        fs::write(&self.file, serde_json::to_string_pretty(&s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        *self.cur.lock().unwrap() = s.clone();
        Ok(s)
    }
}

#[derive(Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub path: String,
    pub files: u64,
    pub bytes: u64,
}

fn copy_tree(from: &Path, to: &Path, skip: &[&str], files: &mut u64, bytes: &mut u64) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for e in fs::read_dir(from)?.filter_map(Result::ok) {
        let name = e.file_name().to_string_lossy().to_string();
        if skip.contains(&name.as_str()) || name.ends_with(".tmp") { continue; }
        let t = e.file_type()?;
        let dest = to.join(&name);
        if t.is_dir() { copy_tree(&e.path(), &dest, skip, files, bytes)?; }
        else if t.is_file() { *bytes += fs::copy(e.path(), &dest)?; *files += 1; }
    }
    Ok(())
}

fn measure(p: &Path) -> (u64, u64) {
    let (mut f, mut b) = (0, 0);
    let mut stack = vec![p.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(rd) = fs::read_dir(&d) else { continue };
        for e in rd.filter_map(Result::ok) {
            let Ok(m) = e.metadata() else { continue };
            if m.is_dir() { stack.push(e.path()); } else { f += 1; b += m.len(); }
        }
    }
    (f, b)
}

/// Make one backup now. `projects` are (name, folder) pairs; `ledger_copy` writes the ledger to the path it is given.
pub fn make(base: &Path, projects: &[(String, String)], ledger_copy: impl Fn(&Path) -> Result<(), String>) -> Result<BackupInfo, String> {
    let stamp = crate::tickets::now().replace([' ', ':'], "-");
    let dest = base.join("backups").join(&stamp);
    if dest.exists() { return Err("A backup was already made this minute".into()); }
    fs::create_dir_all(&dest).map_err(|e| format!("Could not make the backup folder: {e}"))?;
    let (mut files, mut bytes) = (0u64, 0u64);
    for f in ["projects.json", "roles.json", "accounts.json", "persona.json", "ssh-hosts.json", "settings.json", "leftovers.jsonl"] {
        let src = base.join(f);
        if src.is_file() { bytes += fs::copy(&src, dest.join(f)).map_err(|e| e.to_string())?; files += 1; }
    }
    ledger_copy(&dest.join("kona.db"))?;
    if let Ok(m) = fs::metadata(dest.join("kona.db")) { bytes += m.len(); files += 1; }
    for (i, (name, folder)) in projects.iter().enumerate() {
        let src = Path::new(folder).join(".kona");
        if !src.is_dir() { continue; }
        let safe: String = name.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).collect();
        copy_tree(&src, &dest.join("projects").join(format!("{}-{}", i + 1, safe)).join(".kona"), &["worktrees"], &mut files, &mut bytes).map_err(|e| format!("Could not copy the notes of {name}: {e}"))?;
    }
    Ok(BackupInfo { name: stamp, path: dest.to_string_lossy().to_string(), files, bytes })
}

pub fn list(base: &Path) -> Vec<BackupInfo> {
    let Ok(rd) = fs::read_dir(base.join("backups")) else { return vec![] };
    let mut out: Vec<BackupInfo> = rd.filter_map(Result::ok).filter(|e| e.path().is_dir()).map(|e| {
        let (files, bytes) = measure(&e.path());
        BackupInfo { name: e.file_name().to_string_lossy().to_string(), path: e.path().to_string_lossy().to_string(), files, bytes }
    }).collect();
    out.sort_by(|a, b| b.name.cmp(&a.name));
    out
}

/// Delete one backup folder. The name must be a backup's own (date and time), so nothing else can be reached.
pub fn delete(base: &Path, name: &str) -> Result<(), String> {
    let ok = name.len() == 16 && name.chars().enumerate().all(|(i, c)| if [4, 7, 10, 13].contains(&i) { c == '-' } else { c.is_ascii_digit() });
    if !ok { return Err("That is not a backup".into()); }
    let p = base.join("backups").join(name);
    if !p.is_dir() { return Err("That backup does not exist".into()); }
    fs::remove_dir_all(&p).map_err(|e| format!("Could not delete the backup: {e}"))
}
