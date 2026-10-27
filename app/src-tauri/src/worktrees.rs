// Worktrees: a second working copy of a project's repo on its own branch, so a ticket's session cannot step on the main folder
// or on another ticket (feature F10, and the base of the worktree graph, F9). Kona only runs Git's own `git worktree` commands.
// Copies live inside the project's hidden `.kona/worktrees/<ticket>` folder, which Git already ignores.
use serde::Serialize;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Run `git` in `dir` and return what it printed. Never asks anything on a terminal.
pub fn git(dir: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_TERMINAL_PROMPT", "0")
        .creation_flags(0x0800_0000)
        .output()
        .map_err(|e| format!("Could not run Git: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if err.is_empty() { format!("Git said no (exit code {})", out.status.code().unwrap_or(-1)) } else { err })
    }
}

pub fn is_repo(dir: &Path) -> bool {
    dir.join(".git").exists()
}

/// `Login page!` becomes `login-page`: lower case, letters and digits, at most 30 characters.
pub fn slug(title: &str) -> String {
    let mut s = String::new();
    for c in title.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() { s.push(c); } else if !s.ends_with('-') { s.push('-'); }
    }
    s.trim_matches('-').chars().take(30).collect::<String>().trim_end_matches('-').to_string()
}

pub fn dir_for(project: &Path, ticket_id: &str) -> PathBuf {
    project.join(".kona").join("worktrees").join(ticket_id)
}

pub fn norm(p: &str) -> String {
    p.replace('\\', "/").trim_end_matches('/').to_lowercase()
}

/// `git worktree list`: path, branch (empty when detached), head commit.
#[derive(Serialize, Clone)]
pub struct Entry {
    pub path: String,
    pub branch: String,
    pub head: String,
    pub is_main: bool,
}

pub fn list(project: &Path) -> Result<Vec<Entry>, String> {
    let text = git(project, &["worktree", "list", "--porcelain"])?;
    let mut out: Vec<Entry> = vec![];
    for block in text.split("\n\n") {
        let mut e = Entry { path: String::new(), branch: String::new(), head: String::new(), is_main: out.is_empty() };
        for l in block.lines() {
            if let Some(p) = l.strip_prefix("worktree ") { e.path = p.trim().to_string(); }
            else if let Some(h) = l.strip_prefix("HEAD ") { e.head = h.trim().chars().take(8).collect(); }
            else if let Some(b) = l.strip_prefix("branch ") { e.branch = b.trim().trim_start_matches("refs/heads/").to_string(); }
        }
        if !e.path.is_empty() { out.push(e); }
    }
    Ok(out)
}

pub struct Created {
    pub branch: String,
    pub path: PathBuf,
}

/// Make (or find again) the ticket's own copy: `.kona/worktrees/T-0012` on the branch `feat/T-0012-login-page`, started from where the
/// main folder is now. A copy that already exists is reused, so a second session on the ticket continues in the same place.
pub fn ensure(project: &Path, ticket_id: &str, title: &str) -> Result<Created, String> {
    if !is_repo(project) {
        return Err("This project is not a Git repository, so it cannot have its own copies".into());
    }
    git(project, &["rev-parse", "--verify", "HEAD"]).map_err(|_| "This repository has no commits yet, so it cannot have its own copies".to_string())?;
    let path = dir_for(project, ticket_id);
    let want = norm(&path.to_string_lossy());
    if let Some(e) = list(project)?.into_iter().find(|e| norm(&e.path) == want) {
        if path.exists() {
            return Ok(Created { branch: e.branch, path });
        }
    }
    let slug = slug(title);
    let branch = if slug.is_empty() { format!("feat/{ticket_id}") } else { format!("feat/{ticket_id}-{slug}") };
    let p = path.to_string_lossy().to_string();
    let _ = git(project, &["worktree", "prune"]); // forget copies whose folder was deleted by hand
    let exists = git(project, &["rev-parse", "--verify", "--quiet", &format!("refs/heads/{branch}")]).is_ok();
    if exists { git(project, &["worktree", "add", &p, &branch])?; } else { git(project, &["worktree", "add", "-b", &branch, &p])?; }
    Ok(Created { branch, path })
}

#[derive(Serialize, Default)]
pub struct Status {
    pub exists: bool,
    pub branch: String,
    /// commits on the branch that the main folder's branch does not have
    pub ahead: u32,
    /// commits on the main folder's branch that the branch does not have
    pub behind: u32,
    /// files changed and not committed
    pub changed: u32,
    /// the branch the main folder is on
    pub base: String,
}

pub fn status(project: &Path, worktree: &Path, branch: &str) -> Status {
    let mut s = Status { branch: branch.to_string(), ..Default::default() };
    if !worktree.exists() {
        return s;
    }
    s.exists = true;
    s.base = git(project, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_default();
    if let Ok(t) = git(worktree, &["status", "--porcelain"]) {
        s.changed = t.lines().filter(|l| !l.trim().is_empty()).count() as u32;
    }
    if !branch.is_empty() && !s.base.is_empty() {
        if let Ok(t) = git(project, &["rev-list", "--left-right", "--count", &format!("{}...{}", s.base, branch)]) {
            let mut it = t.split_whitespace();
            s.behind = it.next().and_then(|x| x.parse().ok()).unwrap_or(0);
            s.ahead = it.next().and_then(|x| x.parse().ok()).unwrap_or(0);
        }
    }
    s
}
