// The needs check (feature F12): which local tools a role or a project needs, and which of them this PC has.
// Kona only LOOKS: it runs each tool's own "version" command once and reads the answer. It never installs anything;
// for a missing tool it shows the command as text and the owner decides.
// Tools come from a fixed list, so a name from the screen can never become a command of its own.
use serde::Serialize;
use std::io::Read;
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

struct Tool {
    id: &'static str,
    name: &'static str,
    /// the program and its "tell me your version" arguments
    run: &'static [&'static str],
    /// how to get it, shown as text (never run by Kona)
    install: &'static str,
}

static TOOLS: &[Tool] = &[
    Tool { id: "git", name: "Git", run: &["git", "--version"], install: "winget install --id Git.Git -e" },
    Tool { id: "node", name: "Node.js", run: &["node", "--version"], install: "winget install --id OpenJS.NodeJS.LTS -e" },
    Tool { id: "npm", name: "npm", run: &["npm", "--version"], install: "Comes with Node.js" },
    Tool { id: "php", name: "PHP", run: &["php", "--version"], install: "winget install --id PHP.PHP.8.4 -e" },
    Tool { id: "composer", name: "Composer", run: &["composer", "--version"], install: "Download the installer from getcomposer.org (it is not on winget)" },
    Tool { id: "python", name: "Python", run: &["python", "--version"], install: "winget install --id Python.Python.3.13 -e" },
    Tool { id: "docker", name: "Docker", run: &["docker", "--version"], install: "winget install --id Docker.DockerDesktop -e" },
    Tool { id: "cargo", name: "Rust and Cargo", run: &["cargo", "--version"], install: "winget install --id Rustlang.Rustup -e" },
    Tool { id: "gh", name: "GitHub CLI", run: &["gh", "--version"], install: "winget install --id GitHub.cli -e" },
    Tool { id: "ssh", name: "OpenSSH client", run: &["ssh", "-V"], install: "Settings, Apps, Optional features, add OpenSSH Client" },
];

#[derive(Serialize, Clone)]
pub struct ToolInfo {
    pub id: String,
    pub name: String,
    pub install: String,
}

pub fn catalog() -> Vec<ToolInfo> {
    TOOLS.iter().map(|t| ToolInfo { id: t.id.into(), name: t.name.into(), install: t.install.into() }).collect()
}

#[derive(Serialize)]
pub struct ToolStatus {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub install: String,
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            while let Some(&n) = chars.peek() {
                chars.next();
                if n.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Run the tool's version command (through cmd, so `.cmd` and `.bat` shims such as npm and Composer are found) with a time limit.
fn probe(t: &Tool) -> ToolStatus {
    let mut status = ToolStatus { id: t.id.into(), name: t.name.into(), installed: false, version: None, install: t.install.into() };
    let child = Command::new("cmd")
        .arg("/C")
        .args(t.run)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x0800_0000)
        .spawn();
    let Ok(mut child) = child else { return status };
    let deadline = Instant::now() + Duration::from_secs(8);
    let exit = loop {
        match child.try_wait() {
            Ok(Some(s)) => break Some(s),
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(40)),
            _ => { let _ = child.kill(); break None }
        }
    };
    let Some(exit) = exit else { return status };
    let mut text = String::new();
    if let Some(mut o) = child.stdout.take() { let _ = o.read_to_string(&mut text); }
    if let Some(mut e) = child.stderr.take() { let mut x = String::new(); let _ = e.read_to_string(&mut x); text.push('\n'); text.push_str(&x); }
    if exit.success() {
        status.installed = true;
        status.version = strip_ansi(&text).lines().map(str::trim).find(|l| !l.is_empty()).map(|l| l.chars().take(90).collect());
    }
    status
}

/// Check these tools, all at once. Unknown ids are ignored.
pub fn check(ids: &[String]) -> Vec<ToolStatus> {
    let wanted: Vec<&Tool> = TOOLS.iter().filter(|t| ids.iter().any(|i| i == t.id)).collect();
    let handles: Vec<_> = wanted.into_iter().map(|t| std::thread::spawn(move || probe(t))).collect();
    handles.into_iter().filter_map(|h| h.join().ok()).collect()
}

/// What a project folder suggests, from the files in it (the hint table of the plan). Returns tool ids and why.
#[derive(Serialize)]
pub struct Hint {
    pub id: String,
    pub because: String,
}

pub fn hints(folder: &Path) -> Vec<Hint> {
    let has = |n: &str| folder.join(n).exists();
    let mut out: Vec<Hint> = vec![];
    let mut add = |id: &str, because: &str| { if !out.iter().any(|h| h.id == id) { out.push(Hint { id: id.into(), because: because.into() }); } };
    if has(".git") { add("git", "this folder is a Git repository"); }
    if has("composer.json") { add("php", "composer.json is here"); add("composer", "composer.json is here"); }
    else if has("artisan") { add("php", "artisan is here"); add("composer", "artisan is here"); }
    if has("package.json") { add("node", "package.json is here"); add("npm", "package.json is here"); }
    if has("Dockerfile") || has("docker-compose.yml") || has("compose.yaml") || has("compose.yml") { add("docker", "a Docker file is here"); }
    if has("Cargo.toml") { add("cargo", "Cargo.toml is here"); }
    if has("pyproject.toml") || has("requirements.txt") { add("python", "a Python project file is here"); }
    out
}
