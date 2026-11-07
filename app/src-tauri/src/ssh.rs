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

/// A server that pulls a repo: which server (an id from the same project) and where the read-only key is ON that server. A note: Kona never sees it.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Pull {
    pub server_id: String,
    pub key_path: String,
}

/// One entry of the Servers screen: a server, or (`kind` "github") a GitHub repo card. A repo card is a server entry too, so the same checks apply to
/// it: `host` is the nickname the repo's address uses (an alias in `~\.ssh\config`), `user` is `git`, `key_path` is the read-write key on this PC.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Host {
    pub id: String,
    pub project_id: String,
    pub label: String,
    /// what is typed after `ssh`: a host name, an address or an alias from `~\.ssh\config`
    pub host: String,
    pub port: u16,
    pub user: String,
    /// where the key file is (a reference: Kona never opens it). For a repo card: the read-write key on this PC
    pub key_path: String,
    /// SHA256 fingerprints the owner confirmed (a server has one per key type); empty until checked
    #[serde(default)]
    pub fingerprints: Vec<String>,
    /// role ids that may use this server
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub notes: String,
    /// "" for a server, "github" for a GitHub repo card
    #[serde(default)]
    pub kind: String,
    /// the machine name behind `host` when `host` is a nickname from `~\.ssh\config` (a repo card: github.com). It is what the fingerprint is read from
    #[serde(default)]
    pub real_host: String,
    /// repo card: `owner/name`
    #[serde(default)]
    pub repo: String,
    /// repo card: the read-only key file on this PC, the copy that is handed to a server (a reference: never opened)
    #[serde(default)]
    pub ro_key_path: String,
    /// repo card: the servers that pull the repo
    #[serde(default)]
    pub pulled_by: Vec<Pull>,
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

/// A GitHub repo as `owner/name`; a full github.com address (web or ssh form, with or without `.git`) is accepted and shortened.
fn clean_repo(value: &str) -> Result<String, String> {
    let v = value.trim().trim_end_matches('/').trim_end_matches(".git");
    let v = v.strip_prefix("https://github.com/").or_else(|| v.strip_prefix("http://github.com/")).or_else(|| v.strip_prefix("git@github.com:")).unwrap_or(v);
    let mut it = v.split('/');
    let (a, b, c) = (it.next().unwrap_or(""), it.next().unwrap_or(""), it.next());
    let ok = c.is_none() && [a, b].iter().all(|p| !p.is_empty() && p.len() <= 100 && p.chars().all(|ch| ch.is_ascii_alphanumeric() || "._-".contains(ch)));
    if !ok { return Err("A GitHub repo looks like owner/name, for example BergasBintang/kona-space".into()); }
    Ok(v.to_string())
}

fn no_key_text(s: &str) -> Result<(), String> {
    if s.contains("PRIVATE KEY") || s.contains("BEGIN ") { return Err("That looks like the text of a key. Kona keeps only the path of the key file, never the key itself".into()); }
    Ok(())
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
        h.kind = h.kind.trim().to_string();
        h.real_host = clean_line(&h.real_host, "The real address", 255)?;
        h.repo = clean_line(&h.repo, "The repo", 200)?;
        h.ro_key_path = clean_line(&h.ro_key_path, "The read-only key file path", 400)?;
        match h.kind.as_str() {
            "" => { h.real_host.clear(); h.repo.clear(); h.ro_key_path.clear(); h.pulled_by.clear(); }
            "github" => {
                h.repo = clean_repo(&h.repo)?;
                if h.user.is_empty() { h.user = "git".into(); }
                if h.port == 0 { h.port = 22; }
                if h.real_host.is_empty() { h.real_host = "github.com".into(); }
                if !valid_host(&h.real_host) { return Err("The real address may only hold letters, digits, dots, dashes and underscores (for GitHub: github.com)".into()); }
                no_key_text(&h.ro_key_path)?;
            }
            _ => return Err("That kind of entry does not exist".into()),
        }
        if h.label.is_empty() { return Err(if h.kind == "github" { "A repo needs a name" } else { "A server needs a name" }.into()); }
        if !valid_host(&h.host) { return Err("The host may only hold letters, digits, dots, dashes and underscores (an address or a name from your ssh config)".into()); }
        if h.user.is_empty() || !h.user.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c)) { return Err("The user may only hold letters, digits, dots, dashes and underscores".into()); }
        if h.port == 0 { return Err("The port must be between 1 and 65535".into()); }
        no_key_text(&h.key_path)?;
        h.fingerprints.retain(|f| f.starts_with("SHA256:") && f.len() < 100);
        let mut list = self.list.lock().unwrap();
        if list.iter().any(|x| x.id != h.id && x.project_id == h.project_id && x.label.to_lowercase() == h.label.to_lowercase()) { return Err("Another server of this project has that name".into()); }
        // the servers that pull the repo: each must be a server (not a repo) of this same project, once; the key's place there is a note
        let mut pulls: Vec<Pull> = vec![];
        for p in std::mem::take(&mut h.pulled_by) {
            if pulls.len() >= 20 || pulls.iter().any(|q| q.server_id == p.server_id) { continue; }
            if !list.iter().any(|x| x.id == p.server_id && x.project_id == h.project_id && x.kind.is_empty()) { return Err("A server that pulls this repo is not in this project's list any more".into()); }
            let key_path = clean_line(&p.key_path, "The key path on the server", 400)?;
            no_key_text(&key_path)?;
            pulls.push(Pull { server_id: p.server_id, key_path });
        }
        h.pulled_by = pulls;
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
        for h in list.iter_mut() { h.pulled_by.retain(|p| p.server_id != id); } // a repo no longer says it is pulled by a server that is gone
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
    let host = rest.split([':', '/']).next().unwrap_or("").trim_matches(|c| c == '[' || c == ']');
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
        let name = unquote(toks[i]).rsplit(['/', '\\']).next().unwrap_or("").to_lowercase();
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
                    if let Some((left, _)) = a.split_once(':')
                        && left.len() > 1 && !left.starts_with('/') && !left.starts_with('.') && !left.starts_with('\\') { let t = split_user_host(a); if !t.host.is_empty() { targets.push(t); } }
                }
            }
            first_operand = false;
            k += 1;
        }
        i = j.max(i + 1);
    }
    (targets, insecure)
}

/// The entries a role may use, as the name it types after `ssh` (`user@host`), for a refusal to end with: "none" when there are none.
fn allowed_names(hosts: &[Host], role_id: Option<&str>) -> String {
    let names: Vec<String> = hosts.iter().filter(|h| role_id.is_some_and(|r| h.roles.iter().any(|x| x == r))).map(|h| format!("{}@{}", h.user, h.host)).collect();
    if names.is_empty() { "none".into() } else { names.join(", ") }
}

/// Told to a role at the start of a session: the servers and repos it may reach and what to type, so it does not guess. None when it may use none
/// (ssh is then blocked outright). The list is the one at the start of the session; a refusal always carries the current one (`allowed_names`).
pub fn allowed_prompt(hosts: &[Host], role_id: Option<&str>) -> Option<String> {
    let mine: Vec<&Host> = hosts.iter().filter(|h| role_id.is_some_and(|r| h.roles.iter().any(|x| x == r))).collect();
    if mine.is_empty() { return None; }
    let mut out = vec!["You may reach only these servers and repos with ssh, scp or sftp (the owner keeps this list in Kona, under Connections). Type the name exactly as shown; any other name is refused and every command still asks the owner first. Never write these addresses into notes or documents.".to_string()];
    for h in mine {
        out.push(if h.kind == "github" {
            format!("- {} (GitHub repo {}): ssh {}@{}; git address git@{}:{}.git", h.label, h.repo, h.user, h.host, h.host, h.repo)
        } else if h.port != 22 {
            format!("- {}: ssh -p {} {}@{}", h.label, h.port, h.user, h.host)
        } else {
            format!("- {}: ssh {}@{}", h.label, h.user, h.host)
        });
    }
    Some(out.join("\n"))
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
            return Decision::Deny(format!("Refused: {} is not in this project's server list. Allowed for this role: {}. Ask the owner to add it in Kona under Connections; do not try another way to reach it.", t.host, allowed_names(hosts, role_id)));
        };
        if !role_id.is_some_and(|r| h.roles.iter().any(|x| x == r)) {
            return Decision::Deny(format!("Refused: this role may not use the server \"{}\". Allowed for this role: {}. Ask the owner to allow it in Kona under Connections.", h.label, allowed_names(hosts, role_id)));
        }
        if let Some(u) = &t.user && !u.eq_ignore_ascii_case(&h.user) { return Decision::Deny(format!("Refused: the server \"{}\" is registered for the user {}, not {}.", h.label, h.user, u)); }
        if !found.iter().any(|f| f.id == h.id) { found.push(h.clone()); }
    }
    Decision::Ask(found)
}

/// Rules handed to Claude Code at the start of a session for a role that may use no server of the project: ssh, scp and sftp are denied outright.
pub fn deny_rules(hosts: &[Host], role_id: Option<&str>) -> Vec<String> {
    if role_id.is_some_and(|r| hosts.iter().any(|h| h.roles.iter().any(|x| x == r))) { return vec![]; }
    ["ssh", "scp", "sftp", "ssh.exe", "scp.exe", "sftp.exe"].iter().flat_map(|c| [format!("Bash({c} *)"), format!("Bash({c})"), format!("PowerShell({c} *)"), format!("PowerShell({c})")]).collect()
}

/// Rules for a role that MAY use some server: every ssh, scp or sftp command must ask, even when the owner's own settings allow it without
/// asking (an ask rule beats an allow rule; seen with a harmless command). So each one reaches Kona's check and the owner's card.
pub fn ask_rules() -> Vec<String> {
    ["ssh", "scp", "sftp", "ssh.exe", "scp.exe", "sftp.exe"].iter().flat_map(|c| [format!("Bash({c} *)"), format!("PowerShell({c} *)")]).collect()
}

// ---- the server's fingerprint ---------------------------------------------------------------------------------
//
// Kona reads a server's PUBLIC host keys itself, the way `ssh-keyscan` does, so it needs no tool on the PC. (The tool that comes with Windows,
// OpenSSH 9.5, fails against modern servers with "unsupported KEX method"; found 2026-11-04.) It connects, trades the version line and the
// lists of methods, sends the first step of a `curve25519-sha256` key exchange, and the server answers with its public host key. Kona keeps
// that key, hashes it and hangs up. It never answers the rest of the exchange, never sends a login and never checks the server's signature
// (it only reads; the owner compares the fingerprint with the server's own record). One connection reads one key type.
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(Serialize, Debug)]
pub struct Fingerprint {
    pub kind: String,
    pub fingerprint: String,
}

const WAIT: Duration = Duration::from_secs(8);

/// How a failed read should go on: `Network` (nothing answered, so stop and do not try another way), `Protocol` (the server answered but
/// not in a way this reader handles: stop, but the `ssh-keyscan` tool may still manage) or `NoKey` (the server has no key of this type: try the next).
#[derive(Debug, PartialEq, Clone, Copy)]
enum Fail {
    Network,
    Protocol,
    NoKey,
}

#[derive(Debug)]
struct ReadErr {
    fail: Fail,
    msg: String,
}

fn fail(fail: Fail, msg: impl Into<String>) -> ReadErr {
    ReadErr { fail, msg: msg.into() }
}

fn io_fail(what: &str, e: std::io::Error) -> ReadErr {
    use std::io::ErrorKind::*;
    match e.kind() {
        TimedOut | WouldBlock => fail(Fail::Network, format!("The server stopped answering while Kona was {what} (waited {} seconds)", WAIT.as_secs())),
        UnexpectedEof | ConnectionReset | ConnectionAborted | BrokenPipe => fail(Fail::Network, format!("The server closed the connection while Kona was {what}")),
        _ => fail(Fail::Network, format!("The connection failed while Kona was {what}: {e}")),
    }
}

/// "SHA256:" and the base64 (no padding) of the SHA256 of the key's public blob: the same text `ssh-keygen -l` prints.
fn print_of(blob: &[u8]) -> String {
    use base64::Engine;
    format!("SHA256:{}", base64::engine::general_purpose::STANDARD_NO_PAD.encode(Sha256::digest(blob)))
}

/// The name `ssh-keygen -l` puts in brackets, from the key type written in the key.
fn kind_of(key_type: &str) -> String {
    match key_type {
        "ssh-ed25519" => "ED25519".into(),
        "ssh-rsa" => "RSA".into(),
        t if t.starts_with("ecdsa-sha2-") => "ECDSA".into(),
        t => t.to_uppercase(),
    }
}

fn put_string(out: &mut Vec<u8>, b: &[u8]) {
    out.extend((b.len() as u32).to_be_bytes());
    out.extend(b);
}

/// One SSH packet before encryption starts: length, padding length, the message, padding (to a multiple of 8, at least 4).
fn packet(payload: &[u8]) -> Vec<u8> {
    let mut pad = 8 - (5 + payload.len()) % 8;
    if pad < 4 { pad += 8; }
    let mut out = Vec::with_capacity(5 + payload.len() + pad);
    out.extend(((1 + payload.len() + pad) as u32).to_be_bytes());
    out.push(pad as u8);
    out.extend(payload);
    out.extend(std::iter::repeat_n(0u8, pad));
    out
}

fn read_line(s: &mut impl Read) -> Result<Vec<u8>, ReadErr> {
    let mut line = vec![];
    let mut b = [0u8; 1];
    while line.len() < 512 {
        s.read_exact(&mut b).map_err(|e| io_fail("reading its greeting", e))?;
        if b[0] == b'\n' { break; }
        line.push(b[0]);
    }
    while line.last() == Some(&b'\r') { line.pop(); }
    Ok(line)
}

fn read_packet(s: &mut impl Read, what: &str) -> Result<Vec<u8>, ReadErr> {
    let mut len = [0u8; 4];
    s.read_exact(&mut len).map_err(|e| io_fail(what, e))?;
    let n = u32::from_be_bytes(len) as usize;
    if !(6..=35_000).contains(&n) { return Err(fail(Fail::Protocol, "The server answered with something that is not an SSH message (wrong port?)")); }
    let mut body = vec![0u8; n];
    s.read_exact(&mut body).map_err(|e| io_fail(what, e))?;
    let pad = body[0] as usize;
    if 1 + pad > n { return Err(fail(Fail::Protocol, "The server sent a damaged SSH message")); }
    Ok(body[1..n - pad].to_vec())
}

/// A reader over the bytes of one message: strings and name lists.
struct Bytes<'a>(&'a [u8]);

impl<'a> Bytes<'a> {
    fn take(&mut self, n: usize) -> Option<&'a [u8]> {
        if self.0.len() < n { return None; }
        let (a, b) = self.0.split_at(n);
        self.0 = b;
        Some(a)
    }
    fn string(&mut self) -> Option<&'a [u8]> {
        let n = u32::from_be_bytes(self.take(4)?.try_into().ok()?) as usize;
        self.take(n)
    }
}

fn damaged() -> ReadErr { fail(Fail::Protocol, "The server sent a damaged SSH message") }

/// The core of the read, on any connection: returns the server's host key (the blob) for the first of `algs` that the server has.
fn exchange<S: Read + Write>(s: &mut S, algs: &str) -> Result<Vec<u8>, ReadErr> {
    s.write_all(b"SSH-2.0-Kona_HostKeyRead\r\n").map_err(|e| io_fail("greeting it", e))?;
    // its greeting (some servers send lines of text first)
    let mut id = None;
    for _ in 0..20 {
        let l = read_line(s)?;
        if l.starts_with(b"SSH-") { id = Some(String::from_utf8_lossy(&l).to_string()); break; }
    }
    let Some(id) = id else { return Err(fail(Fail::Protocol, "The server answered, but not like an SSH server (wrong port?)")); };
    if !(id.starts_with("SSH-2.0-") || id.starts_with("SSH-1.99-")) { return Err(fail(Fail::Protocol, format!("The server speaks an SSH version Kona cannot read ({id})"))); }

    // its lists of methods
    let theirs = read_packet(s, "waiting for its list of methods")?;
    if theirs.first() == Some(&1) { return Err(disconnect_reason(&theirs)); }
    if theirs.first() != Some(&20) { return Err(fail(Fail::Protocol, "The server did not start with its list of methods")); }
    let mut r = Bytes(&theirs[17.min(theirs.len())..]);
    let kex = String::from_utf8_lossy(r.string().ok_or_else(damaged)?).to_string();
    let hostkeys = String::from_utf8_lossy(r.string().ok_or_else(damaged)?).to_string();
    let curve = ["curve25519-sha256", "curve25519-sha256@libssh.org"].into_iter().find(|k| kex.split(',').any(|x| x == *k));
    if curve.is_none() { return Err(fail(Fail::Protocol, "The server does not offer the key exchange curve25519-sha256, which Kona's reader needs")); }
    if !algs.split(',').any(|a| hostkeys.split(',').any(|x| x == a)) { return Err(fail(Fail::NoKey, "The server has no host key of this type")); }

    // ours: one host key type, the common methods for the rest (they are never used)
    let mut k = vec![20u8];
    k.extend(&uuid::Uuid::new_v4().as_bytes()[..]);
    for list in ["curve25519-sha256,curve25519-sha256@libssh.org", algs, "aes128-ctr,aes256-ctr,chacha20-poly1305@openssh.com,aes128-gcm@openssh.com", "aes128-ctr,aes256-ctr,chacha20-poly1305@openssh.com,aes128-gcm@openssh.com", "hmac-sha2-256,hmac-sha2-512,hmac-sha1", "hmac-sha2-256,hmac-sha2-512,hmac-sha1", "none", "none", "", ""] {
        put_string(&mut k, list.as_bytes());
    }
    k.push(0);
    k.extend([0u8; 4]);
    s.write_all(&packet(&k)).map_err(|e| io_fail("sending its own list of methods", e))?;
    // the first step of the key exchange: a throwaway public value (the shared secret is never computed)
    let mut init = vec![30u8];
    let mut q = uuid::Uuid::new_v4().as_bytes().to_vec();
    q.extend(uuid::Uuid::new_v4().as_bytes());
    q[31] &= 0x7f;
    put_string(&mut init, &q);
    s.write_all(&packet(&init)).map_err(|e| io_fail("starting the key exchange", e))?;

    // the answer carries the server's public host key
    for _ in 0..10 {
        let m = read_packet(s, "waiting for its host key")?;
        match m.first() {
            Some(31) => {
                let blob = Bytes(&m[1..]).string().ok_or_else(damaged)?.to_vec();
                if blob.is_empty() || blob.len() > 16_384 { return Err(damaged()); }
                // a polite goodbye (disconnect, "by application"); nothing depends on it
                let mut bye = vec![1u8];
                bye.extend(11u32.to_be_bytes());
                put_string(&mut bye, b"done");
                put_string(&mut bye, b"");
                let _ = s.write_all(&packet(&bye));
                return Ok(blob);
            }
            Some(1) => return Err(disconnect_reason(&m)),
            Some(2) | Some(4) | Some(7) => continue, // ignore, debug, extension info
            _ => return Err(fail(Fail::Protocol, "The server answered the key exchange with a message Kona does not know")),
        }
    }
    Err(fail(Fail::Protocol, "The server did not send its host key"))
}

fn disconnect_reason(m: &[u8]) -> ReadErr {
    let mut r = Bytes(&m[1.min(m.len())..]);
    let _code = r.take(4);
    let why = r.string().map(|s| String::from_utf8_lossy(s).trim().chars().take(160).collect::<String>()).unwrap_or_default();
    fail(Fail::Protocol, if why.is_empty() { "The server ended the connection".to_string() } else { format!("The server ended the connection: {why}") })
}

fn connect(host: &str, port: u16) -> Result<TcpStream, ReadErr> {
    let bare = host.trim_matches(|c| c == '[' || c == ']');
    let addrs: Vec<_> = (bare, port).to_socket_addrs().map_err(|_| fail(Fail::Network, format!("Could not find a server called {host}. Is the name right?")))?.take(4).collect();
    let mut last = None;
    for a in addrs {
        match TcpStream::connect_timeout(&a, WAIT) {
            Ok(s) => {
                let _ = s.set_read_timeout(Some(WAIT));
                let _ = s.set_write_timeout(Some(WAIT));
                let _ = s.set_nodelay(true);
                return Ok(s);
            }
            Err(e) => last = Some(e),
        }
    }
    use std::io::ErrorKind::*;
    Err(fail(Fail::Network, match last {
        Some(e) if matches!(e.kind(), TimedOut | WouldBlock) => format!("{host}:{port} did not answer within {} seconds. Is the address right, and is a firewall in the way?", WAIT.as_secs()),
        Some(e) if e.kind() == ConnectionRefused => format!("{host}:{port} refused the connection. Is SSH running on that port?"),
        Some(e) => format!("Could not connect to {host}:{port}: {e}"),
        None => format!("{host} has no address to connect to"),
    }))
}

fn read_one(host: &str, port: u16, algs: &str) -> Result<Fingerprint, ReadErr> {
    let mut s = connect(host, port)?;
    let blob = exchange(&mut s, algs)?;
    let key_type = Bytes(&blob).string().map(|t| String::from_utf8_lossy(t).to_string()).ok_or_else(damaged)?;
    Ok(Fingerprint { kind: kind_of(&key_type), fingerprint: print_of(&blob) })
}

fn tool(name: &str) -> Command {
    let mut c = Command::new(name);
    c.creation_flags(0x0800_0000);
    c
}

/// The old way, kept as a second try: the `ssh-keyscan` tool (the one on the PATH, then the one that comes with Git for Windows). Returns what it
/// read, and the first complaint it printed, if it read nothing (the real reason, not a guess).
fn scan_with_tool(host: &str, port: u16) -> (Vec<Fingerprint>, Option<String>) {
    use base64::Engine;
    let mut complaint = None;
    for exe in ["ssh-keyscan", r"C:\Program Files\Git\usr\bin\ssh-keyscan.exe"] {
        let Ok(o) = tool(exe).args(["-T", "8", "-p", &port.to_string(), host]).stdin(Stdio::null()).output() else { continue };
        let mut out: Vec<Fingerprint> = vec![];
        for l in String::from_utf8_lossy(&o.stdout).lines().filter(|l| !l.starts_with('#')) {
            let mut it = l.split_whitespace();
            let (_host, kt, b64) = (it.next(), it.next(), it.next());
            if let (Some(kt), Some(b64)) = (kt, b64)
                && let Ok(blob) = base64::engine::general_purpose::STANDARD.decode(b64)
            {
                let f = print_of(&blob);
                if !out.iter().any(|x| x.fingerprint == f) { out.push(Fingerprint { kind: kind_of(kt), fingerprint: f }); }
            }
        }
        if !out.is_empty() { return (out, None); }
        if complaint.is_none() {
            complaint = String::from_utf8_lossy(&o.stderr).lines().map(str::trim).find(|l| !l.is_empty() && !l.starts_with('#')).map(|l| l.chars().take(200).collect::<String>());
        }
    }
    (vec![], complaint)
}

/// Read the server's PUBLIC host keys and their SHA256 fingerprints. Nothing is saved here. When it fails, the error says why.
pub fn fingerprints(host: &str, port: u16) -> Result<Vec<Fingerprint>, String> {
    if !valid_host(host) { return Err("That host is not valid".into()); }
    let mut out: Vec<Fingerprint> = vec![];
    let mut first: Option<ReadErr> = None;
    for algs in ["ssh-ed25519", "ecdsa-sha2-nistp256,ecdsa-sha2-nistp384,ecdsa-sha2-nistp521", "rsa-sha2-512,rsa-sha2-256,ssh-rsa"] {
        match read_one(host, port, algs) {
            Ok(f) => { if !out.iter().any(|x| x.fingerprint == f.fingerprint) { out.push(f); } }
            Err(e) => {
                let stop = e.fail != Fail::NoKey;
                if first.is_none() || (first.as_ref().is_some_and(|f| f.fail == Fail::NoKey) && e.fail != Fail::NoKey) { first = Some(e); }
                if stop { break; }
            }
        }
    }
    if !out.is_empty() { return Ok(out); }
    let own = first.unwrap_or_else(|| fail(Fail::Protocol, "No host key could be read"));
    // one full stop or question mark at the end, never "?." or ".."
    let reason = if own.msg.ends_with('?') { own.msg.clone() } else { format!("{}.", own.msg.trim_end_matches('.')) };
    if own.fail == Fail::Network { return Err(reason); }
    // the server answered but this reader could not finish: let the `ssh-keyscan` tool try, and report what it says
    let (found, complaint) = scan_with_tool(host, port);
    if !found.is_empty() { return Ok(found); }
    Err(match complaint {
        Some(c) => format!("{reason} The ssh-keyscan tool on this PC also failed: {c}"),
        None => reason,
    })
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
        Host { id: label.into(), project_id: "p".into(), label: label.into(), host: h.into(), port: 22, user: user.into(), key_path: "k".into(), fingerprints: vec![], roles: roles.iter().map(|s| s.to_string()).collect(), notes: String::new(), ..Default::default() }
    }

    fn fresh(name: &str) -> Servers {
        Servers::load(&std::env::temp_dir().join(format!("kona-ssh-{name}-{}", std::process::id())))
    }

    fn repo_card(label: &str, alias: &str, repo: &str) -> Host {
        Host { project_id: "p".into(), label: label.into(), host: alias.into(), kind: "github".into(), repo: repo.into(), key_path: "C:\\k\\rw".into(), ..Default::default() }
    }

    #[test]
    fn a_repo_card_gets_its_defaults_and_a_clean_repo_name() {
        let s = fresh("repo");
        let h = s.save_host(repo_card("Kona", "github-kona", "https://github.com/Owner/kona-space.git")).unwrap();
        assert_eq!((h.repo.as_str(), h.user.as_str(), h.real_host.as_str(), h.port), ("Owner/kona-space", "git", "github.com", 22));
        assert!(s.save_host(repo_card("Bad", "github-bad", "just-a-name")).is_err());
        assert!(s.save_host(repo_card("Bad2", "github-bad2", "a b/c")).is_err());
        let mut k = repo_card("Key", "github-key", "o/n");
        k.ro_key_path = "-----BEGIN OPENSSH PRIVATE KEY-----".into();
        assert!(s.save_host(k).unwrap_err().contains("only the path"));
        let mut k = repo_card("Kind", "github-kind", "o/n");
        k.kind = "other".into();
        assert!(s.save_host(k).is_err());
        let mut plain = host("Web", "web.example.test", "deploy", &[]);
        plain.id = String::new();
        plain.repo = "x/y".into();
        plain.real_host = "elsewhere".into();
        plain.ro_key_path = "k".into();
        let saved = s.save_host(plain).unwrap();
        assert!(saved.repo.is_empty() && saved.real_host.is_empty() && saved.ro_key_path.is_empty(), "a server keeps no repo fields");
    }

    #[test]
    fn a_pull_names_a_server_of_the_same_project_and_goes_with_it() {
        let s = fresh("pull");
        let mut web = host("Web", "web.example.test", "deploy", &[]);
        web.id = String::new();
        let web = s.save_host(web).unwrap();
        let mut other = host("Other", "other.example.test", "deploy", &[]);
        other.id = String::new();
        other.project_id = "another-project".into();
        let other = s.save_host(other).unwrap();
        let mut r = repo_card("Kona", "github-kona", "o/n");
        r.pulled_by = vec![Pull { server_id: web.id.clone(), key_path: "~/.ssh/kona_ro".into() }, Pull { server_id: web.id.clone(), key_path: "~/.ssh/again".into() }];
        let r = s.save_host(r).unwrap();
        assert_eq!(r.pulled_by.len(), 1, "the same server twice is kept once");
        assert_eq!(r.pulled_by[0].key_path, "~/.ssh/kona_ro");
        let mut bad = repo_card("Bad", "github-bad", "o/n");
        bad.pulled_by = vec![Pull { server_id: other.id.clone(), key_path: "k".into() }];
        assert!(s.save_host(bad).unwrap_err().contains("not in this project"), "a server of another project cannot pull it");
        let mut bad = repo_card("Bad2", "github-bad2", "o/n");
        bad.pulled_by = vec![Pull { server_id: r.id.clone(), key_path: "k".into() }];
        assert!(s.save_host(bad).is_err(), "a repo card cannot be a pulling server");
        s.remove(&web.id).unwrap();
        assert!(s.for_project("p").iter().find(|h| h.id == r.id).unwrap().pulled_by.is_empty(), "the pull goes when its server goes");
    }

    #[test]
    fn a_repo_card_is_checked_like_a_server() {
        // the nickname is the host a command names, so a role may use it only when the card lists the role
        let mut card = repo_card("Kona", "github-kona", "o/n");
        card.roles = vec!["devops".into()];
        card.user = "git".into();
        let hosts = vec![card];
        assert!(matches!(decide(&hosts, Some("devops"), "ssh -T git@github-kona"), Decision::Ask(_)));
        assert!(matches!(decide(&hosts, Some("qa"), "ssh -T git@github-kona"), Decision::Deny(_)));
        assert!(matches!(decide(&hosts, Some("devops"), "ssh -T git@github.com"), Decision::Deny(m) if m.contains("not in this project's server list")));
    }

    #[test]
    fn files_saved_before_repo_cards_still_load() {
        let old = r#"{"version":1,"hosts":[{"id":"a","project_id":"p","label":"Web","host":"h.example.test","port":22,"user":"deploy","key_path":"k","fingerprints":[],"roles":[],"notes":""}]}"#;
        let d: FileData = serde_json::from_str(old).unwrap();
        assert!(d.hosts[0].kind.is_empty() && d.hosts[0].pulled_by.is_empty() && d.hosts[0].real_host.is_empty());
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
    fn a_refusal_names_what_the_role_may_use() {
        let mut card = repo_card("Kona", "github-kona", "o/n");
        card.roles = vec!["devops".into()];
        card.user = "git".into();
        let hosts = vec![card, host("Web", "web.example.test", "deploy", &["devops", "qa"]), host("Admin", "admin.example.test", "root", &["security"])];
        let Decision::Deny(m) = decide(&hosts, Some("devops"), "ssh -T git@github.com") else { panic!("should refuse") };
        assert!(m.contains("not in this project's server list") && m.contains("Allowed for this role: git@github-kona, deploy@web.example.test."), "{m}");
        assert!(!m.contains("admin.example.test"), "another role's server is not listed: {m}");
        let Decision::Deny(m) = decide(&hosts, Some("qa"), "ssh root@admin.example.test") else { panic!("should refuse") };
        assert!(m.contains("may not use the server") && m.contains("Allowed for this role: deploy@web.example.test."), "{m}");
        let Decision::Deny(m) = decide(&hosts, Some("marketing"), "ssh x@elsewhere.example.test") else { panic!("should refuse") };
        assert!(m.contains("Allowed for this role: none."), "{m}");
    }

    #[test]
    fn a_session_is_told_which_entries_its_role_may_reach() {
        let mut card = repo_card("Kona", "github-kona", "Owner/kona-space");
        card.roles = vec!["devops".into()];
        card.user = "git".into();
        card.real_host = "ssh.github.com".into();
        card.port = 443;
        let mut odd = host("Odd", "odd.example.test", "deploy", &["devops"]);
        odd.port = 2222;
        let hosts = vec![card, host("Web", "web.example.test", "deploy", &["devops"]), odd, host("Admin", "admin.example.test", "root", &["security"])];
        let p = allowed_prompt(&hosts, Some("devops")).unwrap();
        assert!(p.contains("- Kona (GitHub repo Owner/kona-space): ssh git@github-kona; git address git@github-kona:Owner/kona-space.git"), "{p}");
        assert!(p.contains("- Web: ssh deploy@web.example.test"), "{p}");
        assert!(p.contains("- Odd: ssh -p 2222 deploy@odd.example.test"), "{p}");
        assert!(!p.contains("admin.example.test") && !p.contains("ssh.github.com"), "only what the role needs to type: {p}");
        assert!(p.contains("any other name is refused"), "{p}");
        assert!(allowed_prompt(&hosts, Some("marketing")).is_none() && allowed_prompt(&hosts, None).is_none(), "a role with none gets no block: ssh is blocked for it already");
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

    // ---- reading the host key: against a fake server on this PC ---------------------------------------------------

    fn blob_of(key_type: &str, key: &[u8]) -> Vec<u8> {
        let mut b = vec![];
        put_string(&mut b, key_type.as_bytes());
        put_string(&mut b, key);
        b
    }

    fn reply_with(blob: &[u8]) -> Vec<u8> {
        let mut r = vec![31u8];
        put_string(&mut r, blob);
        put_string(&mut r, &[1u8; 32]);
        put_string(&mut r, &[2u8; 16]);
        r
    }

    /// A fake SSH server: greets, lists its methods, waits for the first step of the key exchange and sends `reply`. Returns its port.
    fn fake_server(kex: &'static str, hostkeys: &'static str, reply: Vec<u8>) -> u16 {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        std::thread::spawn(move || {
            let _ = (|| -> Result<(), Box<dyn std::error::Error>> {
                let (mut s, _) = l.accept()?;
                s.set_read_timeout(Some(Duration::from_secs(5)))?;
                s.write_all(b"Welcome\r\nSSH-2.0-FakeSSH_1.0\r\n")?;
                let mut ki = vec![20u8];
                ki.extend([7u8; 16]);
                for list in [kex, hostkeys, "aes128-ctr", "aes128-ctr", "hmac-sha2-256", "hmac-sha2-256", "none", "none", "", ""] { put_string(&mut ki, list.as_bytes()); }
                ki.push(0);
                ki.extend([0u8; 4]);
                s.write_all(&packet(&ki))?;
                let hello = read_line(&mut s).map_err(|e| e.msg)?;
                assert_eq!(hello, b"SSH-2.0-Kona_HostKeyRead".to_vec());
                let ours = read_packet(&mut s, "x").map_err(|e| e.msg)?;
                assert_eq!(ours[0], 20);
                let init = read_packet(&mut s, "x").map_err(|e| e.msg)?;
                assert_eq!(init[0], 30);
                assert_eq!(init.len(), 1 + 4 + 32, "a 32 byte public value");
                s.write_all(&packet(&reply))?;
                let mut rest = vec![];
                let _ = s.read_to_end(&mut rest); // wait for the goodbye, so closing does not throw the answer away
                Ok(())
            })();
        });
        port
    }

    #[test]
    fn a_fingerprint_is_what_ssh_keygen_prints() {
        // an ED25519 key made of the bytes 0 to 31 (a made-up key); `ssh-keygen -lf` printed the same text for it
        let key: Vec<u8> = (0u8..32).collect();
        assert_eq!(print_of(&blob_of("ssh-ed25519", &key)), "SHA256:ZkAslGjFiUHdGf/WUL8rQvkib4PTvQatUV0OUQSncCA");
        assert_eq!(kind_of("ssh-ed25519"), "ED25519");
        assert_eq!(kind_of("ecdsa-sha2-nistp256"), "ECDSA");
        assert_eq!(kind_of("ssh-rsa"), "RSA");
    }

    #[test]
    fn packets_are_padded_to_eight_with_at_least_four() {
        for n in 0..70 {
            let p = packet(&vec![9u8; n]);
            let pad = p[4] as usize;
            assert_eq!(p.len() % 8, 0, "{n}");
            assert!(pad >= 4, "{n}");
            assert_eq!(u32::from_be_bytes(p[..4].try_into().unwrap()) as usize, p.len() - 4);
        }
    }

    #[test]
    fn reads_a_host_key_from_a_server_without_logging_in() {
        let key: Vec<u8> = (0u8..32).collect();
        let port = fake_server("sntrup761x25519-sha512@openssh.com,curve25519-sha256", "ssh-ed25519,rsa-sha2-512", reply_with(&blob_of("ssh-ed25519", &key)));
        let f = read_one("127.0.0.1", port, "ssh-ed25519").unwrap();
        assert_eq!(f.kind, "ED25519");
        assert_eq!(f.fingerprint, "SHA256:ZkAslGjFiUHdGf/WUL8rQvkib4PTvQatUV0OUQSncCA");
    }

    #[test]
    fn says_so_when_the_server_has_no_key_of_the_asked_type() {
        let port = fake_server("curve25519-sha256", "ssh-ed25519", vec![]);
        let e = read_one("127.0.0.1", port, "rsa-sha2-512,rsa-sha2-256,ssh-rsa").unwrap_err();
        assert_eq!(e.fail, Fail::NoKey);
        assert!(e.msg.contains("no host key of this type"), "{}", e.msg);
    }

    #[test]
    fn says_so_when_the_server_offers_no_curve25519() {
        let port = fake_server("diffie-hellman-group14-sha256", "ssh-ed25519", vec![]);
        let e = read_one("127.0.0.1", port, "ssh-ed25519").unwrap_err();
        assert_eq!(e.fail, Fail::Protocol);
        assert!(e.msg.contains("curve25519-sha256"), "{}", e.msg);
    }

    #[test]
    fn shows_the_reason_when_the_server_ends_the_connection() {
        let mut bye = vec![1u8];
        bye.extend(2u32.to_be_bytes());
        put_string(&mut bye, b"not allowed from here");
        put_string(&mut bye, b"");
        let port = fake_server("curve25519-sha256", "ssh-ed25519", bye);
        let e = read_one("127.0.0.1", port, "ssh-ed25519").unwrap_err();
        assert!(e.msg.contains("ended the connection: not allowed from here"), "{}", e.msg);
    }

    #[test]
    fn a_closed_port_is_reported_as_refused() {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        drop(l);
        let e = read_one("127.0.0.1", port, "ssh-ed25519").unwrap_err();
        assert_eq!(e.fail, Fail::Network);
        assert!(e.msg.contains("refused the connection"), "{}", e.msg);
    }

    #[test]
    fn a_plain_web_server_is_not_taken_for_ssh() {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        std::thread::spawn(move || {
            if let Ok((mut s, _)) = l.accept() {
                let _ = s.write_all(b"HTTP/1.1 400 Bad Request\r\nServer: x\r\n\r\n");
            }
        });
        let e = read_one("127.0.0.1", port, "ssh-ed25519").unwrap_err();
        assert!(e.msg.contains("not like an SSH server") || e.msg.contains("closed the connection"), "{}", e.msg);
    }

    #[test]
    fn the_error_ends_with_one_full_stop_or_question_mark() {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        drop(l);
        let e = fingerprints("127.0.0.1", port).unwrap_err();
        assert_eq!(e, format!("127.0.0.1:{port} refused the connection. Is SSH running on that port?"));
    }

    /// Run by hand against a real server (read-only, no login): set KONA_TEST_SSH_HOST (and KONA_TEST_SSH_PORT if not 22), then
    /// `cargo test --lib live_read -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn live_read_of_a_real_server() {
        let Ok(host) = std::env::var("KONA_TEST_SSH_HOST") else { return };
        let port = std::env::var("KONA_TEST_SSH_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(22);
        let r = fingerprints(&host, port);
        println!("{r:#?}");
        assert!(r.is_ok());
    }
}
