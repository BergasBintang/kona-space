// Projects: one project is one repo folder (decision 27). The list lives in %APPDATA%\Kona\projects.json.
// Kona never deletes a project's files: removing a project only forgets it.
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub folder: String,
    #[serde(default)]
    pub github: Option<String>,
}

#[derive(Serialize)]
pub struct AddResult {
    pub project: Project,
    /// the hidden `.kona` folder for notes and tickets exists now
    pub hidden_folder: bool,
    /// Git was told to ignore it (through .git/info/exclude, so no tracked file changed)
    pub git_ignored: bool,
}

#[derive(Serialize, Deserialize)]
struct FileData {
    version: u32,
    projects: Vec<Project>,
}

pub struct Projects {
    file: PathBuf,
    list: Mutex<Vec<Project>>,
}

/// Lower-case, forward-slash form of a path, so `D:\Repo` and `d:/repo` count as the same place (CloudCLI listed one project twice for this).
pub fn norm(p: &Path) -> String {
    let s = fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    s.to_string_lossy().trim_start_matches(r"\\?\").replace('\\', "/").trim_end_matches('/').to_lowercase()
}

impl Projects {
    pub fn load(base: &Path) -> Self {
        let file = base.join("projects.json");
        let list = fs::read_to_string(&file)
            .ok()
            .and_then(|t| serde_json::from_str::<FileData>(&t).ok())
            .map(|d| d.projects)
            .unwrap_or_default();
        Self { file, list: Mutex::new(list) }
    }

    fn save(&self, list: &[Project]) -> Result<(), String> {
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let data = FileData { version: 1, projects: list.to_vec() };
        fs::write(&self.file, serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
    }

    pub fn all(&self) -> Vec<Project> {
        self.list.lock().unwrap().clone()
    }

    pub fn add(&self, folder: &str, name: Option<String>) -> Result<AddResult, String> {
        let path = Path::new(folder);
        if !path.is_dir() {
            return Err("That folder does not exist".into());
        }
        let mut list = self.list.lock().unwrap();
        if list.iter().any(|p| norm(Path::new(&p.folder)) == norm(path)) {
            return Err("That folder is already a project".into());
        }
        let name = name.filter(|n| !n.trim().is_empty()).unwrap_or_else(|| path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| folder.to_string()));
        let project = Project { id: uuid::Uuid::new_v4().to_string(), name, folder: folder.to_string(), github: None };

        // the hidden folder for Kona's notes and tickets, kept out of Git without touching any tracked file
        let hidden_folder = fs::create_dir_all(path.join(".kona")).is_ok();
        let mut git_ignored = false;
        if path.join(".git").is_dir() {
            let exclude = path.join(".git").join("info").join("exclude");
            let _ = fs::create_dir_all(exclude.parent().unwrap());
            let current = fs::read_to_string(&exclude).unwrap_or_default();
            if current.lines().any(|l| l.trim() == ".kona/" || l.trim() == ".kona") {
                git_ignored = true;
            } else {
                let sep = if current.is_empty() || current.ends_with('\n') { "" } else { "\n" };
                git_ignored = fs::write(&exclude, format!("{current}{sep}.kona/\n")).is_ok();
            }
        }
        list.push(project.clone());
        self.save(&list)?;
        Ok(AddResult { project, hidden_folder, git_ignored })
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let mut list = self.list.lock().unwrap();
        list.retain(|p| p.id != id);
        self.save(&list)
    }

    /// Is this path inside a project? Only such paths may be listed or read.
    pub fn allows(&self, path: &Path) -> bool {
        let target = norm(path);
        self.list.lock().unwrap().iter().any(|p| {
            let root = norm(Path::new(&p.folder));
            target == root || target.starts_with(&format!("{root}/"))
        })
    }
}
