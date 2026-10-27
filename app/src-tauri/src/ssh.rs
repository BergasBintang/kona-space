// The SSH registry (feature F8): which servers a project may reach, as REFERENCES only. An entry holds a label, a host, a port, a user, the path
// to the key file, the server's fingerprint and which roles may use it. Kona never reads, copies or stores a key: the key stays where the
// owner keeps it (usually `~\.ssh`) and the entry only says where. The list is in `%APPDATA%\Kona\ssh-hosts.json`.
//
// The rules, enforced in the core where a session's commands pass through (see session.rs):
//   - a role may run `ssh`, `scp` or `sftp` only to a host the project lists for that role; for every other role those commands are refused
//     before they can run (a deny rule given to Claude Code at the start, and a check of every command that still asks for approval);
//   - a host that is not in the list is refused with a plain message;
//   - turning off the server's identity check (`StrictHostKeyChecking=no`, a null known-hosts file) is always refused;
//   - an allowed command still shows an approval card with the server's name and the exact command (the owner's rule: confirm before any
//     command on a server);
//   - the server's fingerprint is saved the first time the owner looks at it and confirms it, and a change is shown as a warning.
use serde::{Deserialize, Serialize};
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Host {
    pub id: String,
    pub project_id: String,
    pub label: String,
    /// what is typed after `ssh`: a host name, an address or an alias from `~\.ssh\config`
    pub host: String,
    pub port: u16,
    pub user: String,
    /// where the key file is (a reference: Kona never opens it)
    pub key_path: String,
    /// SHA256 fingerprints the owner confirmed (a server has one per key type); empty until checked
    #[serde(default)]
    pub fingerprints: Vec<String>,
    /// role ids that may use this server
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub notes: String,
}

#[derive(Serialize, Deserialize)]
struct FileData {
    version: u32,
    hosts: Vec<Host>,
}

pub struct Servers {
    file: PathBuf,
    list: Mutex<Vec<Host>>,
}

fn clean_line(s: &str, what: &str, max: usize) -> Result<String, String> {
    let t = s.trim();
    if t.contains('\n') || t.contains('\r') { return Err(format!("{what} must be one line")); }
    if t.chars().count() > max { return Err(format!("{what} is too long")); }
    Ok(t.to_string())
}

fn valid_host(h: &str) -> bool {
    !h.is_empty() && h.len() <= 255 && h.chars().all(|c| c.is_ascii_alphanumeric() || ".-_:[]".contains(c)) && !h.starts_with('-')
}

impl Servers {
    pub fn load(base: &Path) -> Self {
        let file = base.join("ssh-hosts.json");
        let list = fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str::<FileData>(&t).ok()).map(|d| d.hosts).unwrap_or_default();
        Self { file, list: Mutex::new(list) }
    }

    fn save(&self, list: &[Host]) -> Result<(), String> {
        if let Some(d) = self.file.parent() { fs::create_dir_all(d).map_err(|e| e.to_string())?; }
        let t = serde_json::to_string_pretty(&FileData { version: 1, hosts: list.to_vec() }).map_err(|e| e.to_string())?;
        fs::write(&self.file, t).map_err(|e| e.to_string())
    }

    pub fn for_project(&self, project_id: &str) -> Vec<Host> {
        self.list.lock().unwrap().iter().filter(|h| h.project_id == project_id).cloned().collect()
    }

    /// Add (empty id) or change a server. A key file's TEXT is refused: only a path is kept.
    pub fn save_host(&self, mut h: Host) -> Result<Host, String> {
        h.label = clean_line(&h.label, "The name", 60)?;
        h.host = clean_line(&h.host, "The host", 255)?;
        h.user = clean_line(&h.user, "The user", 64)?;
        h.key_path = clean_line(&h.key_path, "The key file path", 400)?;
        h.notes = h.notes.trim().chars().take(1000).collect();
        if h.label.is_empty() { return Err("A server needs a name".into()); }
        if !valid_host(&h.host) { return Err("The host may only hold letters, digits, dots, dashes and underscores (an address or a name from your ssh config)".into()); }
        if h.user.is_empty() || !h.user.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c)) { return Err("The user may only hold letters, digits, dots, dashes and underscores".into()); }
        if h.port == 0 { return Err("The port must be between 1 and 65535".into()); }
        if h.key_path.contains("PRIVATE KEY") || h.key_path.contains("BEGIN ") { return Err("That looks like the text of a key. Kona keeps only the path of the key file, never the key itself".into()); }
        h.fingerprints.retain(|f| f.starts_with("SHA256:") && f.len() < 100);
        let mut list = self.list.lock().unwrap();
        if list.iter().any(|x| x.id != h.id && x.project_id == h.project_id && x.label.to_lowercase() == h.label.to_lowercase()) { return Err("Another server of this project has that name".into()); }
        if h.id.is_empty() {
            h.id = uuid::Uuid::new_v4().to_string();
            list.push(h.clone());
        } else if let Some(slot) = list.iter_mut().find(|x| x.id == h.id) {
            *slot = h.clone();
        } else {
            return Err("That server does not exist".into());
        }
        self.save(&list)?;
        Ok(h)
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let mut list = self.list.lock().unwrap();
        list.retain(|h| h.id != id);
        self.save(&list)
    }
}

// ---- reading a command line for ssh, scp and sftp ------------------------------------------------------------

#[derive(Debug, PartialEq, Clone)]
pub struct Target {
    pub host: String,
    pub user: Option<String>,
}

const SSH_VALUED: &[&str] = &["-b", "-c", "-D", "-E", "-e", "-F", "-I", "-i", "-J", "-L", "-l", "-m", "-O", "-o", "-p", "-Q", "-R", "-S", "-W", "-w"];
const SCP_VALUED: &[&str] = &["-c", "-F", "-i", "-J", "-l", "-o", "-P", "-S", "-X"];
const SFTP_VALUED: &[&str] = &["-B", "-b", "-c", "-D", "-F", "-i", "-J", "-l", "-o", "-P", "-R", "-S", "-s"];

fn unquote(t: &str) -> &str {
    t.trim_matches(|c| c == '"' || c == '\'' || c == '`' || c == '(' || c == ')' || c == '{' || c == '}')
}

fn split_user_host(s: &str) -> Target {
    let s = s.trim_start_matches("ssh://").trim_start_matches("scp://").trim_start_matches("sftp://");
    let (user, rest) = match s.rsplit_once('@') { Some((u, r)) => (Some(u.to_string()), r), None => (None, s) };
    let host = rest.split(|c| c == ':' || c == '/').next().unwrap_or("").trim_matches(|c| c == '[' || c == ']');
    Target { host: host.to_string(), user }
}

/// Every server a command line would reach with `ssh`, `scp` or `sftp` (in any part of a chain, or inside a `bash -c '...'`), and whether it
/// tries to switch off the check of the server's identity.
pub fn read_command(cmd: &str) -> (Vec<Target>, bool) {
    let mut targets = vec![];
    let lower = cmd.to_lowercase();
    let insecure = lower.replace(' ', "").contains("stricthostkeychecking=no")
        || lower.replace(' ', "").contains("stricthostkeychecking=off")
        || lower.contains("stricthostkeychecking no")
        || lower.contains("userknownhostsfile=/dev/null")
        || lower.contains("userknownhostsfile=nul")
        || lower.contains("userknownhostsfile /dev/null");
    let toks: Vec<&str> = cmd.split_whitespace().collect();
    let mut i = 0;
    while i < toks.len() {
        let name = unquote(toks[i]).rsplit(|c| c == '/' || c == '\\').next().unwrap_or("").to_lowercase();
        let name = name.trim_end_matches(".exe");
        let kind = match name { "ssh" => 1, "scp" => 2, "sftp" => 3, _ => 0 };
        if kind == 0 { i += 1; continue; }
        // the arguments of this command: up to the next shell operator
        let mut j = i + 1;
        let mut args: Vec<&str> = vec![];
        while j < toks.len() {
            let t = unquote(toks[j]);
            if ["&&", "||", ";", "|", "&"].contains(&t) { break; }
            args.push(toks[j].trim_end_matches(';'));
            j += 1;
            if toks[j - 1].ends_with(';') { break; } // `ssh host ls;` ends the command
        }
        let valued = match kind { 1 => SSH_VALUED, 2 => SCP_VALUED, _ => SFTP_VALUED };
        let mut user_flag: Option<String> = None;
        let mut k = 0;
        let mut first_operand = true;
        while k < args.len() {
            let a = unquote(args[k]);
            if a.starts_with('-') && a.len() > 1 {
                if valued.contains(&a) { if a == "-l" { user_flag = args.get(k + 1).map(|s| unquote(s).to_string()); } k += 2; continue; }
                if a.starts_with("-l") && a.len() > 2 { user_flag = Some(a[2..].to_string()); } // -lbob
                k += 1; continue;
            }
            match kind {
                1 => { if first_operand { let mut t = split_user_host(a); if t.user.is_none() { t.user = user_flag.clone(); } if !t.host.is_empty() { targets.push(t); } } break; }
                3 if first_operand => { let t = split_user_host(a); if !t.host.is_empty() { targets.push(t); } }
                _ => {
                    // scp (and sftp's later operands): `[user@]host:path`; a one-letter "host" is a drive letter; a leading slash or dot is a local path
                    if let Some((left, _)) = a.split_once(':') {
                        if left.len() > 1 && !left.starts_with('/') && !left.starts_with('.') && !left.starts_with('\\') { let t = split_user_host(a); if !t.host.is_empty() { targets.push(t); } }
                    }
                }
            }
            first_operand = false;
            k += 1;
        }
        i = j.max(i + 1);
    }
    (targets, insecure)
}

pub enum Decision {
    /// not an ssh, scp or sftp command
    NotSsh,
    /// allowed to ask the owner; these are the servers it reaches (labels)
    Ask(Vec<Host>),
    Deny(String),
}

/// What to do with a command: nothing special, show the owner a card naming the servers, or refuse it with a reason Claude can read.
pub fn decide(hosts: &[Host], role_id: Option<&str>, cmd: &str) -> Decision {
    let (targets, insecure) = read_command(cmd);
    if targets.is_empty() && !insecure { return Decision::NotSsh; }
    if insecure { return Decision::Deny("Refused: Kona never allows switching off the check of the server's identity (StrictHostKeyChecking=no or a null known-hosts file).".into()); }
    let mut found: Vec<Host> = vec![];
    for t in &targets {
        let Some(h) = hosts.iter().find(|h| h.host.eq_ignore_ascii_case(&t.host)) else {
            return Decision::Deny(format!("Refused: {} is not in this project's server list. Ask the owner to add it in Kona under Servers; do not try another way to reach it.", t.host));
        };
        if !role_id.map_or(false, |r| h.roles.iter().any(|x| x == r)) {
            return Decision::Deny(format!("Refused: this role may not use the server \"{}\". Ask the owner to allow it in Kona under Servers.", h.label));
        }
        if let Some(u) = &t.user { if !u.eq_ignore_ascii_case(&h.user) { return Decision::Deny(format!("Refused: the server \"{}\" is registered for the user {}, not {}.", h.label, h.user, u)); } }
        if !found.iter().any(|f| f.id == h.id) { found.push(h.clone()); }
    }
    Decision::Ask(found)
}

/// Rules handed to Claude Code at the start of a session for a role that may use no server of the project: ssh, scp and sftp are denied outright.
pub fn deny_rules(hosts: &[Host], role_id: Option<&str>) -> Vec<String> {
    if role_id.map_or(false, |r| hosts.iter().any(|h| h.roles.iter().any(|x| x == r))) { return vec![]; }
    ["ssh", "scp", "sftp", "ssh.exe", "scp.exe", "sftp.exe"].iter().flat_map(|c| [format!("Bash({c} *)"), format!("Bash({c})"), format!("PowerShell({c} *)"), format!("PowerShell({c})")]).collect()
}

/// Rules for a role that MAY use some server: every ssh, scp or sftp command must ask, even when the owner's own settings allow it without
/// asking (an ask rule beats an allow rule; seen with a harmless command). So each one reaches Kona's check and the owner's card.
pub fn ask_rules() -> Vec<String> {
    ["ssh", "scp", "sftp", "ssh.exe", "scp.exe", "sftp.exe"].iter().flat_map(|c| [format!("Bash({c} *)"), format!("PowerShell({c} *)")]).collect()
}

// ---- the server's fingerprint ---------------------------------------------------------------------------------

#[derive(Serialize)]
pub struct Fingerprint {
    pub kind: String,
    pub fingerprint: String,
}

fn tool(name: &str) -> Command {
    let mut c = Command::new(name);
    c.creation_flags(0x0800_0000);
    c
}

/// Read the server's PUBLIC host keys with `ssh-keyscan` (it connects to the port, reads the keys and leaves; it sends no login) and turn each
/// into a SHA256 fingerprint with `ssh-keygen`. Nothing is saved here.
pub fn fingerprints(host: &str, port: u16) -> Result<Vec<Fingerprint>, String> {
    if !valid_host(host) { return Err("That host is not valid".into()); }
    let scan = tool("ssh-keyscan").args(["-T", "8", "-p", &port.to_string(), host]).stdin(Stdio::null()).output().map_err(|e| format!("Could not run ssh-keyscan: {e}. Is the OpenSSH client installed?"))?;
    let text = String::from_utf8_lossy(&scan.stdout).to_string();
    let lines: Vec<&str> = text.lines().filter(|l| !l.starts_with('#') && !l.trim().is_empty()).collect();
    if lines.is_empty() { return Err(format!("{host}:{port} did not answer with a host key (is the name right, and is the server reachable?)")); }
    let mut out = vec![];
    for l in lines {
        let mut child = tool("ssh-keygen").args(["-lf", "-"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().map_err(|e| format!("Could not run ssh-keygen: {e}"))?;
        use std::io::Write;
        if let Some(mut si) = child.stdin.take() { let _ = si.write_all(l.as_bytes()); let _ = si.write_all(b"\n"); }
        let o = child.wait_with_output().map_err(|e| e.to_string())?;
        let s = String::from_utf8_lossy(&o.stdout).to_string();
        // "256 SHA256:abc host (ED25519)"
        let mut it = s.split_whitespace();
        let (_bits, fp) = (it.next(), it.next());
        let kind = s.rsplit_once('(').and_then(|(_, k)| k.split(')').next()).unwrap_or("?").to_string();
        if let Some(fp) = fp.filter(|f| f.starts_with("SHA256:")) { out.push(Fingerprint { kind, fingerprint: fp.to_string() }); }
    }
    if out.is_empty() { return Err("Could not read the fingerprint".into()); }
    Ok(out)
}

// ---- the key file, as a reference -----------------------------------------------------------------------------

#[derive(Serialize)]
pub struct KeyState {
    pub exists: bool,
    pub is_file: bool,
    /// the key file is inside a project folder (it could be committed by mistake)
    pub inside_a_project: bool,
    /// the path is in a folder that is synced to the cloud (OneDrive, Dropbox, Google Drive)
    pub synced_folder: bool,
}

pub fn key_state(path: &str, project_folders: &[String]) -> KeyState {
    let p = Path::new(path);
    let norm = crate::projects::norm(p);
    let lower = path.to_lowercase();
    KeyState {
        exists: p.exists(),
        is_file: p.is_file(),
        inside_a_project: project_folders.iter().any(|f| { let r = crate::projects::norm(Path::new(f)); norm == r || norm.starts_with(&format!("{r}/")) }),
        synced_folder: ["onedrive", "dropbox", "google drive", "googledrive", "icloud"].iter().any(|s| lower.contains(s)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn host(label: &str, h: &str, user: &str, roles: &[&str]) -> Host {
        Host { id: label.into(), project_id: "p".into(), label: label.into(), host: h.into(), port: 22, user: user.into(), key_path: "k".into(), fingerprints: vec![], roles: roles.iter().map(|s| s.to_string()).collect(), notes: String::new() }
    }

    fn t(h: &str, u: Option<&str>) -> Target { Target { host: h.into(), user: u.map(String::from) } }

    #[test]
    fn reads_the_servers_a_command_reaches() {
        assert_eq!(read_command("ssh deploy@example.test 'ls -la'").0, vec![t("example.test", Some("deploy"))]);
        assert_eq!(read_command("ssh -p 2222 -i ~/.ssh/key root@10.0.0.5 uptime").0, vec![t("10.0.0.5", Some("root"))]);
        assert_eq!(read_command("ssh -l bob host1 date").0, vec![t("host1", Some("bob"))]);
        assert_eq!(read_command("cd /tmp && scp -P 22 ./a.txt deploy@srv.example.test:/var/www/ && echo done").0, vec![t("srv.example.test", Some("deploy"))]);
        assert_eq!(read_command("scp C:\\files\\a.txt ./b.txt").0, vec![]);
        assert_eq!(read_command("scp srv:/etc/hosts .").0, vec![t("srv", None)]);
        assert_eq!(read_command("bash -c 'ssh admin@box1 hostname'").0, vec![t("box1", Some("admin"))]);
        assert_eq!(read_command("ssh a@one hostname; ssh b@two hostname").0, vec![t("one", Some("a")), t("two", Some("b"))]);
        assert_eq!(read_command("sftp user@files.example.test").0, vec![t("files.example.test", Some("user"))]);
        assert_eq!(read_command("ssh://deploy@h.example.test:2200").0, vec![]);
        assert_eq!(read_command("git status && ls").0, vec![]);
        assert_eq!(read_command("ssh-keygen -lf key.pub").0, vec![]);
        assert_eq!(read_command("echo sshd is running").0, vec![]);
    }

    #[test]
    fn the_identity_check_can_never_be_switched_off() {
        for c in ["ssh -o StrictHostKeyChecking=no a@b ls", "ssh -oStrictHostKeyChecking=no a@b", "ssh -o StrictHostKeyChecking=off a@b", "scp -o UserKnownHostsFile=/dev/null x a@b:/", "ssh -o 'StrictHostKeyChecking no' a@b"] {
            assert!(read_command(c).1, "{c}");
        }
        assert!(!read_command("ssh -o StrictHostKeyChecking=accept-new a@b ls").1);
        let hosts = vec![host("Web", "b", "a", &["devops"])];
        assert!(matches!(decide(&hosts, Some("devops"), "ssh -o StrictHostKeyChecking=no a@b ls"), Decision::Deny(_)));
    }

    #[test]
    fn decisions_follow_the_registry_and_the_role() {
        let hosts = vec![host("Web server", "web.example.test", "deploy", &["devops"]), host("Admin", "web.example.test2", "root", &["devops", "security"])];
        assert!(matches!(decide(&hosts, Some("qa"), "ls -la"), Decision::NotSsh));
        match decide(&hosts, Some("devops"), "ssh deploy@web.example.test 'tail -n 20 log'") { Decision::Ask(h) => assert_eq!(h[0].label, "Web server"), _ => panic!("should ask") }
        assert!(matches!(decide(&hosts, Some("qa"), "ssh deploy@web.example.test ls"), Decision::Deny(m) if m.contains("may not use the server")));
        assert!(matches!(decide(&hosts, None, "ssh deploy@web.example.test ls"), Decision::Deny(_)));
        assert!(matches!(decide(&hosts, Some("devops"), "ssh deploy@elsewhere.example.test ls"), Decision::Deny(m) if m.contains("not in this project's server list")));
        assert!(matches!(decide(&hosts, Some("devops"), "ssh root@web.example.test ls"), Decision::Deny(m) if m.contains("registered for the user deploy")));
        assert!(matches!(decide(&hosts, Some("devops"), "ssh deploy@web.example.test ls && scp x deploy@elsewhere.example.test:/"), Decision::Deny(_)));
    }

    #[test]
    fn a_role_with_no_server_gets_deny_rules() {
        let hosts = vec![host("Web", "h", "u", &["devops"])];
        assert!(deny_rules(&hosts, Some("devops")).is_empty());
        let r = deny_rules(&hosts, Some("qa"));
        assert!(r.contains(&"Bash(ssh *)".to_string()) && r.contains(&"Bash(scp *)".to_string()) && r.contains(&"PowerShell(sftp *)".to_string()));
        assert!(!deny_rules(&[], None).is_empty());
        assert!(ask_rules().contains(&"Bash(ssh *)".to_string()));
    }

    #[test]
    fn only_a_path_is_kept_never_key_text() {
        let dir = std::env::temp_dir().join(format!("kona-ssh-test-{}", std::process::id()));
        let s = Servers::load(&dir);
        let mut h = host("Web", "web.example.test", "deploy", &[]);
        h.id = String::new();
        h.key_path = "-----BEGIN OPENSSH PRIVATE KEY-----".into();
        assert!(s.save_host(h.clone()).unwrap_err().contains("only the path"));
        h.key_path = "C:\\Users\\x\\.ssh\\id".into();
        h.host = "bad host; rm".into();
        assert!(s.save_host(h.clone()).is_err());
        h.host = "web.example.test".into();
        h.user = "a b".into();
        assert!(s.save_host(h.clone()).is_err());
        h.user = "deploy".into();
        h.fingerprints = vec!["SHA256:abc".into(), "not-a-fingerprint".into()];
        let saved = s.save_host(h).unwrap();
        assert_eq!(saved.fingerprints, vec!["SHA256:abc".to_string()]);
        let _ = fs::remove_dir_all(&dir);
    }
}
