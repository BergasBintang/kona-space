// What each open conversation says about its tool servers (decision 107). Claude Code reports which servers it started, and how each went, only to the open window
// (the `init` record of a conversation). The board's tool server is a separate program, so it cannot hear that. The window therefore writes a small file for each
// project whenever the conversations change, in Kona's data folder (`mcp-status/<project>.json`, never in the project), and the tool server reads it (read only).
// The file names the window that wrote it (its process id and start time): when that window is gone the file is not believed.
use crate::{projects, winproc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Loaded {
    pub name: String,
    pub status: String,
}

/// One person's newest open conversation in a project, and the servers Claude Code listed when it began (none when no message was sent yet).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Person {
    pub role: String,
    pub session: String,
    pub servers: Option<Vec<Loaded>>,
}

#[derive(Serialize, Deserialize, Default)]
struct StatusFile {
    pid: u32,
    started: u64,
    at: String,
    people: Vec<Person>,
}

/// The same as the cards of the Access page say (lib/mcpstatus.ts): what one server is, in one person's open conversation.
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum State {
    Connected,
    Failed,
    Starting,
    Waiting,
    Older,
    Still,
}

impl State {
    pub fn say(self) -> &'static str {
        match self {
            State::Connected => "connected",
            State::Failed => "could not start it, or it needs a sign-in",
            State::Starting => "still starting when the conversation began",
            State::Waiting => "not known yet, no message has been sent in the open conversation",
            State::Older => "not in the open conversation, which began before it was given (a new conversation will have it)",
            State::Still => "still in the open conversation although it was taken away (a new conversation will not have it)",
        }
    }
}

fn fnv(s: &str) -> u64 {
    s.bytes().fold(0xcbf29ce484222325u64, |h, b| (h ^ b as u64).wrapping_mul(0x100000001b3))
}

fn file_of(base: &Path, folder: &Path) -> PathBuf {
    base.join("mcp-status").join(format!("{:016x}.json", fnv(&projects::norm(folder))))
}

/// Keep what the open conversations of this project say. Called by the window; an empty list is written too, so a project whose conversations all ended says so.
pub fn save(base: &Path, folder: &Path, people: Vec<Person>) -> Result<(), String> {
    let pid = std::process::id();
    let f = StatusFile { pid, started: winproc::creation_time(pid).unwrap_or(0), at: crate::tickets::now(), people };
    let path = file_of(base, folder);
    std::fs::create_dir_all(path.parent().unwrap_or(base)).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, serde_json::to_string(&f).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// What the window last said about this project, or none when it said nothing or the window that said it is gone.
pub fn load(base: &Path, folder: &Path) -> Option<Vec<Person>> {
    if base.as_os_str().is_empty() { return None; }
    let f: StatusFile = serde_json::from_str(&std::fs::read_to_string(file_of(base, folder)).ok()?).ok()?;
    if f.started == 0 || winproc::creation_time(f.pid) != Some(f.started) { return None; }
    Some(f.people)
}

/// What `server` is in `person`'s open conversation. `on` is whether the project uses it, `allowed` whether the person is ticked for it. None: nothing to say.
pub fn state_of(person: &Person, server: &str, on: bool, allowed: bool) -> Option<State> {
    let has = person.servers.as_ref().and_then(|s| s.iter().find(|m| m.name == server));
    if on && allowed {
        return Some(match (&person.servers, has) {
            (None, _) => State::Waiting,
            (Some(_), None) => State::Older,
            (Some(_), Some(m)) => match m.status.as_str() { "connected" => State::Connected, "pending" => State::Starting, _ => State::Failed },
        });
    }
    if has.is_some_and(|m| m.status == "connected") { Some(State::Still) } else { None }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(role: &str, servers: Option<&[(&str, &str)]>) -> Person {
        Person { role: role.into(), session: format!("s-{role}"), servers: servers.map(|v| v.iter().map(|(n, s)| Loaded { name: n.to_string(), status: s.to_string() }).collect()) }
    }

    #[test]
    fn a_server_is_described_the_way_the_access_page_describes_it() {
        assert_eq!(state_of(&p("frontend", None), "shadcn", true, true), Some(State::Waiting));
        assert_eq!(state_of(&p("frontend", Some(&[("other", "connected")])), "shadcn", true, true), Some(State::Older));
        assert_eq!(state_of(&p("frontend", Some(&[("shadcn", "connected")])), "shadcn", true, true), Some(State::Connected));
        assert_eq!(state_of(&p("frontend", Some(&[("shadcn", "pending")])), "shadcn", true, true), Some(State::Starting));
        assert_eq!(state_of(&p("frontend", Some(&[("shadcn", "needs-auth")])), "shadcn", true, true), Some(State::Failed));
        assert_eq!(state_of(&p("frontend", Some(&[("shadcn", "failed")])), "shadcn", true, true), Some(State::Failed));
        // taken away or never ticked: only a server that still runs is worth saying
        assert_eq!(state_of(&p("frontend", Some(&[("shadcn", "connected")])), "shadcn", false, true), Some(State::Still));
        assert_eq!(state_of(&p("frontend", Some(&[("shadcn", "connected")])), "shadcn", true, false), Some(State::Still));
        assert_eq!(state_of(&p("frontend", Some(&[])), "shadcn", false, true), None);
        assert_eq!(state_of(&p("frontend", None), "shadcn", true, false), None);
    }

    #[test]
    fn what_the_window_says_is_kept_per_project_and_not_believed_from_a_window_that_is_gone() {
        let base = std::env::temp_dir().join(format!("kona-mcpstatus-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        let _clean = crate::testdir::Clean(base.clone());
        let a = base.join("project-a");
        let b = base.join("project-b");
        std::fs::create_dir_all(&a).unwrap();
        std::fs::create_dir_all(&b).unwrap();
        assert_eq!(load(&base, &a), None, "nothing said yet");
        save(&base, &a, vec![p("frontend", Some(&[("shadcn", "connected")]))]).unwrap();
        assert_eq!(load(&base, &a), Some(vec![p("frontend", Some(&[("shadcn", "connected")]))]));
        assert_eq!(load(&base, &b), None, "another project has its own file");
        save(&base, &a, vec![]).unwrap();
        assert_eq!(load(&base, &a), Some(vec![]), "all conversations ended is said too");
        // a file written by a window that has since closed (a process that is not this one)
        let path = file_of(&base, &a);
        let mut f: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        f["started"] = serde_json::json!(f["started"].as_u64().unwrap() + 1);
        std::fs::write(&path, f.to_string()).unwrap();
        assert_eq!(load(&base, &a), None, "the window that wrote it is not this one any more");
    }
}
