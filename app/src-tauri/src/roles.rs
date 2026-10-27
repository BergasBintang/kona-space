// Roles: a saved setup for a session (decision 9, feature F5). This first version keeps what a session needs to start
// well: a name, a group, a mark, a model, a permission mode and a short brief that Claude is told at the start.
// Skills, tool servers, denied tools and the default account come with later steps.
// The list lives in %APPDATA%\Kona\roles.json. The first run writes the ten starting roles from docs/DESIGN.md.
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// The three modes a role may carry. Nothing looser is offered (no "skip all checks").
pub const MODES: [&str; 3] = ["default", "acceptEdits", "plan"];
pub const MODELS: [&str; 3] = ["sonnet", "opus", "haiku"];

#[derive(Serialize, Deserialize, Clone)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub group: String,
    pub mark: String,
    pub model: String,
    pub mode: String,
    pub brief: String,
    /// the account this role usually uses; None means whichever was used last
    #[serde(default)]
    pub account: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct FileData {
    version: u32,
    roles: Vec<Role>,
}

pub struct Roles {
    file: PathBuf,
    list: Mutex<Vec<Role>>,
}

fn starting(id: &str, name: &str, group: &str, mark: &str, mode: &str, brief: &str) -> Role {
    Role { id: id.into(), name: name.into(), group: group.into(), mark: mark.into(), model: "sonnet".into(), mode: mode.into(), brief: brief.into(), account: None }
}

/// The ten starting roles. The modes are the safe default (ask every time); only the two that edit files are loosened.
fn starting_roles() -> Vec<Role> {
    vec![
        starting("product", "Product", "Plan", "ring", "plan", "You are working as the Product role. Turn what the owner wants into small, clear tickets, each with how to tell it is done. Do not change any file; plan only."),
        starting("design", "Design", "Plan", "halfdisc", "default", "You are working as the Design role. Work on how the screens look and feel: layout, spacing, words on the screen, states. Say what you would change and why before you change it."),
        starting("frontend", "Frontend", "Build", "roundsq", "acceptEdits", "You are working as the Frontend role. Build and fix what people see and click. Keep changes small and say which files you changed."),
        starting("backend", "Backend", "Build", "square", "acceptEdits", "You are working as the Backend role. Build and fix the server side: data, rules, speed. Keep changes small and say which files you changed."),
        starting("qa", "QA", "Build", "triangle", "default", "You are working as the QA role. Try to break things and report what you find, with the steps to repeat it. Do not fix anything unless asked."),
        starting("security", "Security", "Build", "plus", "default", "You are working as the Security role. Look for ways the project could be attacked or leak something, and rank what you find by how bad it is. Never write a key or password into a file."),
        starting("devops", "DevOps", "Ship", "diamond", "default", "You are working as the DevOps role. Handle building, shipping and servers. Say what a command will do before you ask to run it. Never touch a server without being asked."),
        starting("marketing", "Marketing", "Grow", "ringdot", "default", "You are working as the Marketing role. Help say what the product is for, to whom, and where to say it. Do not invent numbers or customers."),
        starting("content", "Content and SEO", "Grow", "lines", "default", "You are working as the Content and SEO role. Write and tidy pages and words so people and search engines can find and follow them. Plain words only."),
        starting("support", "Support", "Grow", "dot", "default", "You are working as the Support role. Help answer people's questions and trace problems they report. Be kind and plain, and say when you are not sure."),
    ]
}

impl Roles {
    pub fn load(base: &std::path::Path) -> Self {
        let file = base.join("roles.json");
        let found = fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str::<FileData>(&t).ok()).map(|d| d.roles);
        let fresh = found.is_none();
        let me = Self { file, list: Mutex::new(found.unwrap_or_else(starting_roles)) };
        if fresh {
            let list = me.list.lock().unwrap().clone();
            let _ = me.save(&list);
        }
        me
    }

    fn save(&self, list: &[Role]) -> Result<(), String> {
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let data = FileData { version: 1, roles: list.to_vec() };
        fs::write(&self.file, serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
    }

    pub fn all(&self) -> Vec<Role> {
        self.list.lock().unwrap().clone()
    }

    pub fn get(&self, id: &str) -> Option<Role> {
        self.list.lock().unwrap().iter().find(|r| r.id == id).cloned()
    }

    /// Add a role (empty id) or change one. Returns the saved role.
    pub fn save_role(&self, mut role: Role) -> Result<Role, String> {
        role.name = role.name.trim().to_string();
        if role.name.is_empty() {
            return Err("A role needs a name".into());
        }
        if !MODES.contains(&role.mode.as_str()) {
            return Err("That permission mode is not one Kona offers".into());
        }
        if !MODELS.contains(&role.model.as_str()) {
            return Err("That model is not one Kona offers".into());
        }
        let mut list = self.list.lock().unwrap();
        if list.iter().any(|r| r.id != role.id && r.name.to_lowercase() == role.name.to_lowercase()) {
            return Err("Another role already has that name".into());
        }
        if role.id.is_empty() {
            role.id = uuid::Uuid::new_v4().to_string();
            list.push(role.clone());
        } else if let Some(slot) = list.iter_mut().find(|r| r.id == role.id) {
            *slot = role.clone();
        } else {
            return Err("That role does not exist".into());
        }
        self.save(&list)?;
        Ok(role)
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let mut list = self.list.lock().unwrap();
        list.retain(|r| r.id != id);
        self.save(&list)
    }
}
