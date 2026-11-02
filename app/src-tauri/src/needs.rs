// The needs check (feature F12): which local tools a role or a project needs, and which of them this PC has.
// Kona only LOOKS: it runs each tool's own "version" command once and reads the answer. It never installs anything;
// for a missing tool it shows the command as text and the owner decides.
// Tools come from a list, so a name from the screen can never become a command of its own: the ten tools below are built in, and the owner can add tools of their own
// (a program name and one of a few version flags, kept in %APPDATA%\Kona\tools.json). Nothing else is ever run.
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::os::windows::process::CommandExt;
use std::fs;
use std::path::{Path, PathBuf};
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
    /// one of the ten that come with Kona (they cannot be changed or removed)
    pub builtin: bool,
    /// what is run to look for it: the program and its version flag
    pub program: String,
    pub flag: String,
}

/// A tool the owner added: a program name and a version flag. The install line is only text that is shown.
#[derive(Serialize, Deserialize, Clone)]
pub struct CustomTool {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub program: String,
    pub flag: String,
    #[serde(default)]
    pub install: String,
}

/// The only flags that ask a program for its version. Anything else is refused, so a tool can never be given a command line of its own.
pub const FLAGS: &[&str] = &["--version", "-version", "-v", "-V", "version"];
const MAX_CUSTOM: usize = 30;

fn custom_file(base: &Path) -> PathBuf {
    base.join("tools.json")
}

pub fn load_custom(base: &Path) -> Vec<CustomTool> {
    fs::read_to_string(custom_file(base)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

fn write_custom(base: &Path, list: &[CustomTool]) -> Result<(), String> {
    fs::create_dir_all(base).map_err(|e| e.to_string())?;
    let file = custom_file(base);
    let tmp = file.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(list).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &file).map_err(|e| e.to_string())
}

/// Every tool Kona can look for: the ten built in, then the owner's own.
pub fn catalog(base: &Path) -> Vec<ToolInfo> {
    let mut out: Vec<ToolInfo> = TOOLS.iter().map(|t| ToolInfo { id: t.id.into(), name: t.name.into(), install: t.install.into(), builtin: true, program: t.run[0].into(), flag: t.run[1..].join(" ") }).collect();
    out.extend(load_custom(base).into_iter().map(|c| ToolInfo { id: c.id, name: c.name, install: c.install, builtin: false, program: c.program, flag: c.flag }));
    out
}

fn slug(name: &str) -> String {
    let mut s = String::new();
    for c in name.chars().flat_map(|c| c.to_lowercase()) {
        if c.is_ascii_alphanumeric() { s.push(c); } else if !s.ends_with('-') && !s.is_empty() { s.push('-'); }
    }
    s.trim_matches('-').chars().take(30).collect()
}

/// Add a tool of the owner's (no id), or change one (its id). The program is a bare name: letters, digits, dot, dash and underscore.
pub fn save_custom(base: &Path, mut tool: CustomTool) -> Result<ToolInfo, String> {
    tool.name = tool.name.split_whitespace().collect::<Vec<_>>().join(" ");
    tool.program = tool.program.trim().to_string();
    tool.install = tool.install.trim().to_string();
    if tool.name.is_empty() || tool.name.chars().count() > 40 { return Err("Give the tool a name of up to 40 letters".into()); }
    let ok_program = !tool.program.is_empty() && tool.program.len() <= 40 && tool.program.chars().next().is_some_and(|c| c.is_ascii_alphanumeric()) && tool.program.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'));
    if !ok_program { return Err("The program is just its name, like terraform: letters, digits, dot, dash or underscore".into()); }
    if !FLAGS.contains(&tool.flag.as_str()) { return Err(format!("The version flag must be one of: {}", FLAGS.join(", "))); }
    if tool.install.chars().count() > 160 { return Err("The install note is longer than 160 letters".into()); }
    if TOOLS.iter().any(|t| t.id == tool.id) { return Err("That tool is built in and cannot be changed".into()); }
    let mut list = load_custom(base);
    if tool.id.is_empty() {
        if list.len() >= MAX_CUSTOM { return Err(format!("At most {MAX_CUSTOM} tools of your own")); }
        let stem = format!("my-{}", slug(&tool.name));
        let mut id = stem.clone();
        let mut n = 2;
        while list.iter().any(|c| c.id == id) || TOOLS.iter().any(|t| t.id == id) { id = format!("{stem}-{n}"); n += 1; }
        tool.id = id;
        list.push(tool.clone());
    } else {
        let at = list.iter().position(|c| c.id == tool.id).ok_or("That tool is not there any more")?;
        list[at] = tool.clone();
    }
    write_custom(base, &list)?;
    Ok(ToolInfo { id: tool.id, name: tool.name, install: tool.install, builtin: false, program: tool.program, flag: tool.flag })
}

/// Take one of the owner's own tools away. The ten built in cannot be removed.
pub fn delete_custom(base: &Path, id: &str) -> Result<(), String> {
    if TOOLS.iter().any(|t| t.id == id) { return Err("That tool is built in and cannot be removed".into()); }
    let mut list = load_custom(base);
    let before = list.len();
    list.retain(|c| c.id != id);
    if list.len() == before { return Err("That tool is not there any more".into()); }
    write_custom(base, &list)
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

/// What to run for one tool.
struct Spec {
    id: String,
    name: String,
    run: Vec<String>,
    install: String,
}

/// Run the tool's version command (through cmd, so `.cmd` and `.bat` shims such as npm and Composer are found) with a time limit.
fn probe(t: Spec) -> ToolStatus {
    let mut status = ToolStatus { id: t.id.clone(), name: t.name.clone(), installed: false, version: None, install: t.install.clone() };
    let child = Command::new("cmd")
        .arg("/C")
        .args(&t.run)
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
pub fn check(base: &Path, ids: &[String]) -> Vec<ToolStatus> {
    let mut wanted: Vec<Spec> = TOOLS.iter().filter(|t| ids.iter().any(|i| i == t.id)).map(|t| Spec { id: t.id.into(), name: t.name.into(), run: t.run.iter().map(|s| s.to_string()).collect(), install: t.install.into() }).collect();
    wanted.extend(load_custom(base).into_iter().filter(|c| ids.contains(&c.id) && FLAGS.contains(&c.flag.as_str())).map(|c| Spec { id: c.id, name: c.name, run: vec![c.program, c.flag], install: c.install }));
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("kona-needs-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }
    fn tool(name: &str, program: &str, flag: &str) -> CustomTool {
        CustomTool { id: String::new(), name: name.into(), program: program.into(), flag: flag.into(), install: String::new() }
    }

    #[test]
    fn the_owner_can_add_change_and_remove_a_tool_but_never_give_it_a_command_line() {
        let base = temp("custom");
        let first = save_custom(&base, tool("  Terraform  CLI ", "terraform", "-version")).unwrap();
        assert_eq!(first.id, "my-terraform-cli");
        assert_eq!(first.name, "Terraform CLI", "spaces are tidied");
        let again = save_custom(&base, tool("Terraform CLI", "tf", "--version")).unwrap();
        assert_eq!(again.id, "my-terraform-cli-2", "a second tool with the same name gets its own id");
        assert_eq!(catalog(&base).len(), TOOLS.len() + 2, "the ten built in, then the owner's");
        assert!(catalog(&base).iter().take(TOOLS.len()).all(|t| t.builtin) && catalog(&base).iter().skip(TOOLS.len()).all(|t| !t.builtin));
        // change one
        let changed = save_custom(&base, CustomTool { id: first.id.clone(), name: "Terraform".into(), program: "terraform".into(), flag: "version".into(), install: "winget install Hashicorp.Terraform".into() }).unwrap();
        assert_eq!((changed.name.as_str(), changed.flag.as_str()), ("Terraform", "version"));
        // a command line, a path, a shell trick or a strange flag is refused
        for bad in ["terraform apply", "../evil", "a&b", "C:/x/tool", "", "-rf", "tool;calc", "a\\b"] { assert!(save_custom(&base, tool("x", bad, "--version")).is_err(), "{bad:?} is not a program name"); }
        assert!(save_custom(&base, tool("x", "terraform", "--destroy")).is_err(), "only a version flag");
        assert!(save_custom(&base, tool("", "terraform", "--version")).is_err(), "a name is needed");
        // the ten built in cannot be touched
        assert!(save_custom(&base, CustomTool { id: "git".into(), ..tool("Git", "git", "--version") }).is_err());
        assert!(delete_custom(&base, "git").is_err());
        // remove
        delete_custom(&base, &first.id).unwrap();
        assert_eq!(catalog(&base).len(), TOOLS.len() + 1);
        assert!(delete_custom(&base, &first.id).is_err(), "already gone");
        // a tool of the owner's is found by the same check: a program that is on every Windows PC
        let sys = save_custom(&base, tool("Where", "where", "/?")).err();
        assert!(sys.is_some(), "/? is not a version flag");
        let _ = fs::remove_dir_all(&base);
    }
}
