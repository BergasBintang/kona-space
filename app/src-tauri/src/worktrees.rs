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

/// Run `git` and return the exit code with what it printed, for commands where a non-zero exit is an answer, not a failure.
fn git_code(dir: &Path, args: &[&str]) -> (i32, String) {
    match Command::new("git").args(args).current_dir(dir).env("GIT_TERMINAL_PROMPT", "0").creation_flags(0x0800_0000).output() {
        Ok(o) => (o.status.code().unwrap_or(-1), String::from_utf8_lossy(&o.stdout).trim().to_string()),
        Err(_) => (-1, String::new()),
    }
}

/// One line of the worktree graph.
#[derive(Serialize)]
pub struct Info {
    pub path: String,
    pub branch: String,
    pub head: String,
    pub is_main: bool,
    /// the folder is gone (deleted by hand); `git worktree prune` forgets it
    pub missing: bool,
    pub ahead: u32,
    pub behind: u32,
    pub changed: u32,
    /// files that would clash if this branch were merged into the main folder's branch (empty when it merges cleanly)
    pub conflicts: Vec<String>,
    pub last_subject: String,
    pub last_when: String,
}

fn counts(project: &Path, base: &str, branch: &str) -> (u32, u32) {
    // `base...branch` with --left-right: the left number is what only the base has (behind), the right what only the branch has (ahead)
    let (code, t) = git_code(project, &["rev-list", "--left-right", "--count", &format!("{base}...{branch}")]);
    if code != 0 { return (0, 0); }
    let mut it = t.split_whitespace();
    let behind = it.next().and_then(|x| x.parse().ok()).unwrap_or(0);
    let ahead = it.next().and_then(|x| x.parse().ok()).unwrap_or(0);
    (ahead, behind)
}

/// What a merge of `branch` into `base` would clash on, without touching anything (`git merge-tree`, Git 2.38 or newer).
pub fn conflicts_of(project: &Path, base: &str, branch: &str) -> Vec<String> {
    let (code, out) = git_code(project, &["merge-tree", "--write-tree", "--name-only", "--no-messages", base, branch]);
    if code != 1 { return vec![]; }
    out.lines().skip(1).map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect()
}

pub fn overview(project: &Path) -> Result<Vec<Info>, String> {
    let entries = list(project)?;
    let base = entries.first().map(|e| e.branch.clone()).unwrap_or_default();
    Ok(entries.into_iter().map(|e| {
        let missing = !Path::new(&e.path).exists();
        let mut i = Info { path: e.path.clone(), branch: e.branch.clone(), head: e.head.clone(), is_main: e.is_main, missing, ahead: 0, behind: 0, changed: 0, conflicts: vec![], last_subject: String::new(), last_when: String::new() };
        if !missing {
            if let Ok(t) = git(Path::new(&e.path), &["status", "--porcelain", "--untracked-files=normal"]) {
                i.changed = t.lines().filter(|l| !l.trim().is_empty()).count() as u32;
            }
            let (_, log) = git_code(Path::new(&e.path), &["log", "-1", "--format=%s%x1f%cr"]);
            let mut parts = log.split('\u{1f}');
            i.last_subject = parts.next().unwrap_or("").to_string();
            i.last_when = parts.next().unwrap_or("").to_string();
        }
        if !e.is_main && !e.branch.is_empty() && !base.is_empty() {
            let (a, b) = counts(project, &base, &e.branch);
            i.ahead = a;
            i.behind = b;
            if a > 0 { i.conflicts = conflicts_of(project, &base, &e.branch); }
        }
        i
    }).collect())
}

fn find(project: &Path, path: &str) -> Result<(Entry, String), String> {
    let entries = list(project)?;
    let base = entries.first().map(|e| e.branch.clone()).unwrap_or_default();
    let want = norm(path);
    let e = entries.into_iter().find(|e| norm(&e.path) == want).ok_or("That folder is not one of this project's worktrees")?;
    if e.is_main { return Err("That is the main folder, not a copy".into()); }
    Ok((e, base))
}

/// Merge a copy's branch into the main folder's branch with a merge commit. Refuses unless the main folder has no uncommitted changes
/// to tracked files and the merge would be clean; if Git fails half way, the merge is undone.
pub fn merge(project: &Path, path: &str, label: &str) -> Result<String, String> {
    let (e, base) = find(project, path)?;
    if e.branch.is_empty() { return Err("That copy is not on a branch".into()); }
    if base.is_empty() { return Err("The main folder is not on a branch".into()); }
    let dirty = git(project, &["status", "--porcelain", "--untracked-files=no"])?;
    if !dirty.trim().is_empty() { return Err(format!("The main folder has changes that are not committed. Commit or put them away first, then merge. (Branch: {base})")); }
    let (ahead, _) = counts(project, &base, &e.branch);
    if ahead == 0 { return Err("There is nothing to merge: the branch has no commits the main folder lacks".into()); }
    let clash = conflicts_of(project, &base, &e.branch);
    if !clash.is_empty() { return Err(format!("The merge would clash on: {}", clash.join(", "))); }
    let msg = if label.is_empty() { format!("Merge branch '{}'", e.branch) } else { format!("Merge branch '{}' ({label})", e.branch) };
    match git(project, &["merge", "--no-ff", "-m", &msg, &e.branch]) {
        Ok(_) => Ok(format!("Merged {} into {} ({} {}).", e.branch, base, ahead, if ahead == 1 { "commit" } else { "commits" })),
        Err(err) => { let _ = git(project, &["merge", "--abort"]); Err(format!("Git could not merge, and the merge was undone: {err}")) }
    }
}

/// Remove a copy's folder. Without `discard` it refuses while files are changed and not committed, and keeps a branch that has
/// commits the main folder lacks. With `discard` it throws the changes and the unmerged branch away.
pub fn remove(project: &Path, path: &str, discard: bool) -> Result<String, String> {
    let (e, base) = find(project, path)?;
    let exists = Path::new(&e.path).exists();
    let changed = if exists { git(Path::new(&e.path), &["status", "--porcelain", "--untracked-files=normal"]).map(|t| t.lines().filter(|l| !l.trim().is_empty()).count()).unwrap_or(0) } else { 0 };
    if changed > 0 && !discard {
        return Err(format!("{changed} {} changed and not committed in that copy. Commit them, or choose to discard them.", if changed == 1 { "file is" } else { "files are" }));
    }
    let (ahead, _) = if !e.branch.is_empty() && !base.is_empty() { counts(project, &base, &e.branch) } else { (0, 0) };
    if exists {
        let mut args = vec!["worktree", "remove"];
        if discard { args.push("--force"); }
        args.push(&e.path);
        git(project, &args)?;
    }
    let _ = git(project, &["worktree", "prune"]);
    if e.branch.is_empty() { return Ok("Removed the copy.".into()); }
    if ahead == 0 {
        let _ = git(project, &["branch", "-d", &e.branch]);
        Ok(format!("Removed the copy and its branch {} (it was merged).", e.branch))
    } else if discard {
        let _ = git(project, &["branch", "-D", &e.branch]);
        Ok(format!("Removed the copy and threw away its branch {} with {} unmerged {}.", e.branch, ahead, if ahead == 1 { "commit" } else { "commits" }))
    } else {
        Ok(format!("Removed the copy. The branch {} is kept because it has {} {} that are not merged.", e.branch, ahead, if ahead == 1 { "commit" } else { "commits" }))
    }
}
