// Roles: the setup of a session (decision 9, feature F5), and since 0.20.0 a fixed list (decision 43): the owner cannot add, edit or remove one.
// A role is a name, a group, a model, a permission mode and a short brief that Claude is told at the start.
// Before 0.20.0 the list lived in %APPDATA%\Kona\roles.json and could be edited. That file is no longer read or written; it is left where it is
// (the cleanup ticket T-0003 decides about it).
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub group: String,
    pub model: String,
    pub mode: String,
    pub brief: String,
    /// local tools this role needs, by id from needs.rs (the needs check looks for them)
    #[serde(default)]
    pub needs: Vec<String>,
    /// tickets run as this role work in their own copy of the repo (a worktree) unless the ticket says otherwise
    #[serde(default)]
    pub own_copy: bool,
}

pub struct Roles {
    list: Vec<Role>,
}

fn starting(id: &str, name: &str, group: &str, mode: &str, needs: &[&str], brief: &str) -> Role {
    Role { id: id.into(), name: name.into(), group: group.into(), model: "sonnet".into(), mode: mode.into(), brief: brief.into(), needs: needs.iter().map(|s| s.to_string()).collect(), own_copy: id == "frontend" || id == "backend" }
}

/// The roles: the ten starting roles and the secretary. The modes are the safe default (ask every time); only the two that edit files are loosened.
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
    pub fn load() -> Self {
        Self { list: starting_roles() }
    }

    pub fn all(&self) -> Vec<Role> {
        self.list.clone()
    }

    pub fn get(&self, id: &str) -> Option<Role> {
        self.list.iter().find(|r| r.id == id).cloned()
    }
}
