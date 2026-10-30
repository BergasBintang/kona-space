// Roles: the setup of a session (decision 9, feature F5). The list of roles is fixed (decision 43): the owner cannot add or remove one.
// Since decision 50 each role can be set up: its personality, its brief, its model and permission mode. These are the same in every project and are
// kept in %APPDATA%\Kona\role-profiles.json; a role that was never set up simply has the starting values below. The skills and tool connectors a role
// may use belong to a project, not to the role (decision 51, see skills.rs). (The old %APPDATA%\Kona\roles.json is not read; ticket T-0003 decides about it.)
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub group: String,
    pub model: String,
    pub mode: String,
    pub brief: String,
    /// how this role behaves and sounds, in the owner's words; added after the brief
    #[serde(default)]
    pub persona: String,
    /// local tools this role needs, by id from needs.rs (the needs check looks for them)
    #[serde(default)]
    pub needs: Vec<String>,
    /// tickets run as this role work in their own copy of the repo (a worktree) unless the ticket says otherwise
    #[serde(default)]
    pub own_copy: bool,
}

/// What the owner may set on a role.
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Profile {
    pub persona: String,
    pub brief: String,
    pub model: String,
    pub mode: String,
}

/// A skill or connector name that is safe to use as a folder name and as a word on a command line.
pub fn clean_name(s: &str) -> bool {
    !s.is_empty() && s.len() <= 80 && !s.starts_with('.') && s.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
}

fn check(p: &Profile) -> Result<Profile, String> {
    if !["sonnet", "opus", "haiku"].contains(&p.model.as_str()) {
        return Err("Choose Sonnet, Opus or Haiku".into());
    }
    if !["plan", "default", "acceptEdits"].contains(&p.mode.as_str()) {
        return Err("That permission mode is not one Kona offers".into());
    }
    if p.brief.trim().is_empty() || p.brief.chars().count() > 3000 {
        return Err("The brief must be there and no longer than 3000 letters".into());
    }
    if p.persona.chars().count() > 1500 {
        return Err("The personality may be at most 1500 letters".into());
    }
    Ok(Profile { persona: p.persona.trim().to_string(), brief: p.brief.trim().to_string(), model: p.model.clone(), mode: p.mode.clone() })
}

fn apply(r: &mut Role, p: &Profile) {
    if !p.brief.is_empty() { r.brief = p.brief.clone(); } // an empty brief in the file means "still the starting one"
    r.persona = p.persona.clone(); r.model = p.model.clone(); r.mode = p.mode.clone();
}

struct Inner {
    list: Vec<Role>,
    saved: HashMap<String, Profile>,
}

pub struct Roles {
    file: PathBuf,
    inner: Mutex<Inner>,
}

fn starting(id: &str, name: &str, group: &str, mode: &str, needs: &[&str], brief: &str) -> Role {
    Role {
        id: id.into(), name: name.into(), group: group.into(), model: "sonnet".into(), mode: mode.into(), brief: brief.into(), persona: String::new(),
        needs: needs.iter().map(|s| s.to_string()).collect(), own_copy: id == "frontend" || id == "backend",
    }
}

/// The roles: the ten starting roles and the secretary. The modes are the safe default (ask every time); only the two that edit files are loosened.
/// No role starts with any skill or connector: the owner picks them for each project, so a session carries nothing it was not given.
pub fn starting_roles() -> Vec<Role> {
    vec![
        starting("product", "Product", "Plan", "plan", &[], "You are working as the Product role. Turn what the owner wants into small, clear tickets, each with how to tell it is done. Do not change any file; plan only."),
        starting("design", "Design", "Plan", "default", &[], "You are working as the Design role. Work on how the screens look and feel: layout, spacing, words on the screen, states. Say what you would change and why before you change it."),
        starting("frontend", "Frontend", "Build", "acceptEdits", &["git", "node", "npm"], "You are working as the Frontend role. Build and fix what people see and click. Keep changes small and say which files you changed."),
        starting("backend", "Backend", "Build", "acceptEdits", &["git", "node", "php", "composer"], "You are working as the Backend role. Build and fix the server side: data, rules, speed. Keep changes small and say which files you changed."),
        starting("qa", "QA", "Build", "default", &["git", "node"], "You are working as the QA role. Try to break things and report what you find, with the steps to repeat it. Do not fix anything unless asked."),
        starting("security", "Security", "Build", "default", &["git"], "You are working as the Security role. Look for ways the project could be attacked or leak something, and rank what you find by how bad it is. Never write a key or password into a file."),
        starting("devops", "DevOps", "Ship", "default", &["git", "ssh", "docker"], "You are working as the DevOps role. Handle building, shipping and servers. Say what a command will do before you ask to run it. Never touch a server without being asked."),
        starting("marketing", "Marketing", "Grow", "default", &[], "You are working as the Marketing role. Help say what the product is for, to whom, and where to say it. Do not invent numbers or customers."),
        starting("content", "Content and SEO", "Grow", "default", &["git"], "You are working as the Content and SEO role. Write and tidy pages and words so people and search engines can find and follow them. Plain words only."),
        starting("support", "Support", "Grow", "default", &[], "You are working as the Support role. Help answer people's questions and trace problems they report. Be kind and plain, and say when you are not sure."),
        starting("secretary", "Secretary", "Office", "default", &[], "You are working as the Secretary role, the front desk of the office. Answer the owner's general questions in plain words. When the owner says what they want done, turn it into small tickets for the right roles with the ticket tools (list_tickets first, so you do not raise the same thing twice), each with how to tell it is done. Do not change any project file yourself. If something belongs to one role, name that role."),
    ]
}

impl Roles {
    pub fn load(base: &Path) -> Self {
        let file = base.join("role-profiles.json");
        let saved: HashMap<String, Profile> = fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
        let list = starting_roles().into_iter().map(|mut r| { if let Some(p) = saved.get(&r.id) { apply(&mut r, p); } r }).collect();
        Self { file, inner: Mutex::new(Inner { list, saved }) }
    }

    pub fn all(&self) -> Vec<Role> {
        self.inner.lock().unwrap().list.clone()
    }

    pub fn get(&self, id: &str) -> Option<Role> {
        self.inner.lock().unwrap().list.iter().find(|r| r.id == id).cloned()
    }

    fn write(&self, saved: &HashMap<String, Profile>) -> Result<(), String> {
        if let Some(d) = self.file.parent() { fs::create_dir_all(d).map_err(|e| e.to_string())?; }
        let tmp = self.file.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(saved).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &self.file).map_err(|e| e.to_string())
    }

    /// Keep the owner's setup for one role.
    pub fn save(&self, id: &str, profile: Profile) -> Result<Role, String> {
        let p = check(&profile)?;
        let mut g = self.inner.lock().unwrap();
        let i = g.list.iter().position(|r| r.id == id).ok_or("That role does not exist")?;
        let mut saved = g.saved.clone();
        let mut stored = p.clone();
        if starting_roles().iter().any(|r| r.id == id && r.brief == p.brief) { stored.brief = String::new(); } // unchanged: a later Kona update of the brief still reaches this role
        saved.insert(id.to_string(), stored);
        self.write(&saved)?;
        g.saved = saved;
        apply(&mut g.list[i], &p);
        Ok(g.list[i].clone())
    }

    /// Back to the starting setup of one role.
    pub fn reset(&self, id: &str) -> Result<Role, String> {
        let start = starting_roles().into_iter().find(|r| r.id == id).ok_or("That role does not exist")?;
        let mut g = self.inner.lock().unwrap();
        let mut saved = g.saved.clone();
        saved.remove(id);
        self.write(&saved)?;
        g.saved = saved;
        let i = g.list.iter().position(|r| r.id == id).ok_or("That role does not exist")?;
        g.list[i] = start.clone();
        Ok(start)
    }
}
