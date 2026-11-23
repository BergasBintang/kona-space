// The tool connectors (MCP servers) of Kona (decision 102). A connector is a small program (or a web address) that gives Claude new tools, for example shadcn's "search components".
// It is not a skill: a skill is written instructions, a connector is something Claude can call.
//   One list for all of Kona: `%APPDATA%\Kona\mcp-servers.json`. Whenever a project's page looks, what it finds (the project's `.mcp.json`, the account's Claude settings) is copied into the
//   list, so every project shows every connector Kona has ever met. The copy is kept even if the project later changes or loses it; the card's Remove takes it out of the list.
//   Off by default in every project: `<project>\.kona\mcp-on.json` names the connectors the project uses. A project that never switches one on never loads it and never pays its tokens.
//   Who may use it is still per project and per person: the person's `mcp` line in `role-kits.json`. Switching a connector off keeps those ticks, so switching it on again brings the same people back.
// A session of a person gets a connector only if it is on in the project AND ticked for that person (`session_servers`). Claude Code is told by `--strict-mcp-config --mcp-config` (session.rs), so
// nothing else is loaded, whatever the project's `.mcp.json` holds. The definition used is the project's own when it has one with that name, otherwise Kona's copy.
// A card never shows a program's arguments or settings (they can hold a token): only the program's name, or a web address's host.
use crate::roles::clean_name;
use crate::skills::{self, RoleKit};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Default)]
struct Entry {
    def: Value,
    /// the project (by its name) the definition was last seen changed in
    #[serde(default)]
    origin: String,
}

#[derive(Serialize, Deserialize, Default)]
struct List {
    #[serde(default)]
    servers: BTreeMap<String, Entry>,
}

#[derive(Serialize, Deserialize, Default)]
struct OnFile {
    #[serde(default)]
    on: Vec<String>,
}

/// One card of the MCP section of a project's Access page.
#[derive(Serialize, Clone, Debug)]
pub struct McpRow {
    pub name: String,
    /// "program" or "web address"
    pub kind: String,
    /// the program's name, or the web address's host (never arguments or settings)
    pub detail: String,
    /// where this project knows it from, in words
    pub source: String,
    /// the project (or the account) has it itself right now; a connector only Kona's list remembers can be removed from the list
    pub here: bool,
    /// the project uses it
    pub on: bool,
    /// the people ticked for it in this project (kept while it is off)
    pub roles: Vec<String>,
}

fn list_file(base: &Path) -> PathBuf {
    base.join("mcp-servers.json")
}

fn on_file(folder: &Path) -> PathBuf {
    folder.join(".kona").join("mcp-on.json")
}

/// A file written whole and moved into place, so a window that reads at the same moment never sees half of it. The temporary name has the process number: two windows can save at once.
fn write_whole(file: &Path, text: &str) -> Result<(), String> {
    if let Some(d) = file.parent() { fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    let tmp = file.with_extension(format!("json.{}.tmp", std::process::id()));
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, file).map_err(|e| { let _ = fs::remove_file(&tmp); e.to_string() })
}

fn load_list(base: &Path) -> List {
    fs::read_to_string(list_file(base)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

fn save_list(base: &Path, list: &List) -> Result<(), String> {
    write_whole(&list_file(base), &serde_json::to_string_pretty(list).map_err(|e| e.to_string())?)
}

/// Every connector Claude Code itself would know for this account and project: (name, where from, definition). The first one found with a name is the one kept.
fn found_here(config_dir: Option<&str>, folder: &Path) -> Vec<(String, String, Value)> {
    let mut out: Vec<(String, String, Value)> = Vec::new();
    let mut take = |servers: Option<&Value>, source: &str| {
        if let Some(Value::Object(m)) = servers {
            for (k, v) in m {
                if k != "kona-board" && clean_name(k) && v.is_object() && !out.iter().any(|(n, _, _)| n == k) { out.push((k.clone(), source.to_string(), v.clone())); }
            }
        }
    };
    let user_file = match config_dir { Some(d) => Some(PathBuf::from(d).join(".claude.json")), None => skills::home().map(|h| h.join(".claude.json")) };
    if let Some(j) = user_file.and_then(|f| fs::read_to_string(f).ok()).and_then(|t| serde_json::from_str::<Value>(&t).ok()) {
        if let Some(Value::Object(projects)) = j.get("projects") {
            let want = skills::norm_path(&folder.to_string_lossy());
            for (k, v) in projects { if skills::norm_path(k) == want { take(v.get("mcpServers"), "this project, in your Claude settings"); } }
        }
        take(j.get("mcpServers"), "your Claude settings");
    }
    if let Some(j) = fs::read_to_string(folder.join(".mcp.json")).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()) { take(j.get("mcpServers"), "the project's .mcp.json"); }
    out
}

/// "program" or "web address", and the one short thing a card may say about it. `cmd /c npx …` (how Windows runs npx for Claude Code) is shown as `npx`.
fn describe(def: &Value) -> (String, String) {
    if let Some(c) = def.get("command").and_then(Value::as_str) {
        let file = |s: &str| s.rsplit(['/', '\\']).next().unwrap_or(s).to_string();
        let mut name = file(c);
        let args: Vec<&str> = def.get("args").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).collect()).unwrap_or_default();
        if matches!(name.to_lowercase().as_str(), "cmd" | "cmd.exe") && args.first().is_some_and(|a| a.eq_ignore_ascii_case("/c")) && let Some(next) = args.get(1) { name = file(next); }
        return ("program".into(), name);
    }
    let host = def.get("url").and_then(Value::as_str).map(|u| {
        let rest = u.split("://").nth(1).unwrap_or(u);
        let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
        authority.rsplit('@').next().unwrap_or("").to_string()
    }).unwrap_or_default();
    ("web address".into(), host)
}

/// What the project's own file says it uses (None: no file yet, or one that cannot be read).
fn read_on(folder: &Path) -> Option<BTreeSet<String>> {
    fs::read_to_string(on_file(folder)).ok().and_then(|t| serde_json::from_str::<OnFile>(&t).ok()).map(|f| f.on.into_iter().collect())
}

/// Every connector somebody is ticked for.
fn ticked(kits: &HashMap<String, RoleKit>) -> BTreeSet<String> {
    kits.values().flat_map(|k| k.mcp.iter().cloned()).collect()
}

/// The connectors a project uses. A project that has never been asked (no file yet) uses the ones its people were already ticked for, so what worked before keeps working.
pub fn on_set(folder: &Path) -> BTreeSet<String> {
    read_on(folder).unwrap_or_else(|| ticked(&skills::load_kits(folder)))
}

/// Every connector Kona knows, as this project sees it. It also remembers what this project (and the account) has, in Kona's list.
pub fn catalog(base: &Path, config_dir: Option<&str>, folder: &Path, project_name: &str) -> Vec<McpRow> {
    let here = found_here(config_dir, folder);
    let mut list = load_list(base);
    let mut changed = false;
    for (name, _, def) in &here {
        if list.servers.get(name).is_none_or(|e| &e.def != def) {
            list.servers.insert(name.clone(), Entry { def: def.clone(), origin: project_name.to_string() });
            changed = true;
        }
    }
    if changed && let Err(e) = save_list(base, &list) { eprintln!("could not keep the list of connectors: {e}"); }
    let kits = skills::load_kits(folder);
    let on = read_on(folder).unwrap_or_else(|| ticked(&kits));
    let names = here.iter().map(|(n, _, _)| n.clone()).chain(list.servers.keys().filter(|n| !here.iter().any(|(h, _, _)| h == *n)).cloned());
    names.map(|name| {
        let found = here.iter().find(|(n, _, _)| *n == name);
        let (def, source) = match found {
            Some((_, source, def)) => (def, format!("From {source}")),
            None => { let e = &list.servers[&name]; (&e.def, if e.origin.is_empty() { "Found in another project".to_string() } else { format!("Found in {}", e.origin) }) }
        };
        let (kind, detail) = describe(def);
        let mut roles: Vec<String> = kits.iter().filter(|(_, k)| k.mcp.contains(&name)).map(|(id, _)| id.clone()).collect();
        roles.sort();
        McpRow { on: on.contains(&name), here: found.is_some(), kind, detail, source, roles, name }
    }).collect()
}

/// Switch a connector on or off for this project. Off keeps the people who were ticked.
pub fn set_on(folder: &Path, name: &str, on: bool) -> Result<(), String> {
    if !clean_name(name) { return Err(format!("\"{name}\" is not a valid connector name")); }
    let mut set = on_set(folder);
    if !(if on { set.insert(name.to_string()) } else { set.remove(name) }) && on_file(folder).is_file() { return Ok(()); } // nothing changes: leave the file alone
    write_whole(&on_file(folder), &serde_json::to_string_pretty(&OnFile { on: set.into_iter().collect() }).map_err(|e| e.to_string())?)
}

/// Who may use a connector in this project: exactly these people, nobody else. The caller has checked that the people exist. Returns every person's choice as it is now.
pub fn set_roles(folder: &Path, name: &str, roles: &[String]) -> Result<HashMap<String, RoleKit>, String> {
    if !clean_name(name) { return Err(format!("\"{name}\" is not a valid connector name")); }
    let all = skills::load_kits(folder);
    let ids: BTreeSet<&String> = all.keys().chain(roles.iter()).collect();
    for id in ids {
        let mut kit = all.get(id).cloned().unwrap_or_default();
        let (has, should) = (kit.mcp.iter().any(|m| m == name), roles.contains(id));
        if has == should { continue; }
        if should { kit.mcp.push(name.to_string()); } else { kit.mcp.retain(|m| m != name); }
        skills::save_kit(folder, id, kit)?;
    }
    Ok(skills::load_kits(folder))
}

/// Take a connector out of Kona's list. One the project (or the account) has itself would be found again at once, so that one is refused and the owner is told where it lives.
pub fn remove(base: &Path, config_dir: Option<&str>, folder: &Path, name: &str) -> Result<(), String> {
    if let Some((_, source, _)) = found_here(config_dir, folder).into_iter().find(|(n, _, _)| n == name) {
        return Err(format!("\"{name}\" comes from {source}, so Kona would find it again. Remove it there first."));
    }
    let mut list = load_list(base);
    if list.servers.remove(name).is_some() { save_list(base, &list)?; }
    Ok(())
}

/// What a session of this person starts with: the connectors that are on in the project and ticked for the person, each with the definition to start it. The project's own definition of a name
/// is the one used; otherwise Kona's copy. A name nobody can give a definition for is left out.
pub fn session_servers(base: &Path, config_dir: Option<&str>, folder: &Path, role_id: &str) -> Vec<(String, Value)> {
    let kits = skills::load_kits(folder);
    let Some(mine) = kits.get(role_id).filter(|k| !k.mcp.is_empty()) else { return Vec::new() };
    let on = on_set(folder);
    let wanted: Vec<&String> = mine.mcp.iter().filter(|n| on.contains(*n)).collect();
    if wanted.is_empty() { return Vec::new(); } // the usual case: nothing to look for, so no settings file is read
    let here = found_here(config_dir, folder);
    let list = load_list(base);
    wanted.into_iter().filter_map(|n| {
        let def = here.iter().find(|(h, _, _)| h == n).map(|(_, _, d)| d).or_else(|| list.servers.get(n).map(|e| &e.def))?;
        Some((n.clone(), def.clone()))
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("kona-test-mcp-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn write(p: &Path, text: &str) { fs::create_dir_all(p.parent().unwrap()).unwrap(); fs::write(p, text).unwrap(); }

    fn mcp_json(project: &Path, servers: Value) { write(&project.join(".mcp.json"), &json!({"mcpServers": servers}).to_string()); }

    fn kit(mcp: &[&str]) -> RoleKit { RoleKit { mcp: mcp.iter().map(|s| s.to_string()).collect(), ..Default::default() } }

    const SHADCN: fn() -> Value = || json!({"command": "npx", "args": ["shadcn@latest", "mcp"]});

    #[test]
    fn what_one_project_finds_is_listed_in_every_project_and_off_there() {
        let (base, a, b) = (temp("share-base"), temp("share-a"), temp("share-b"));
        mcp_json(&a, json!({"shadcn": SHADCN()}));
        let rows_a = catalog(&base, Some(base.to_str().unwrap()), &a, "Mahkota");
        assert_eq!(rows_a.len(), 1);
        assert!(rows_a[0].here && !rows_a[0].on && rows_a[0].source.contains(".mcp.json"));
        // the other project has no such file, and still lists it, off, and says where it came from
        let rows_b = catalog(&base, Some(base.to_str().unwrap()), &b, "Other");
        assert_eq!(rows_b.len(), 1);
        assert!(!rows_b[0].here && !rows_b[0].on, "listed, but not used until the owner switches it on");
        assert_eq!(rows_b[0].source, "Found in Mahkota");
        assert!(rows_b[0].roles.is_empty());
        // a second look changes nothing on disk
        let before = fs::read_to_string(list_file(&base)).unwrap();
        catalog(&base, Some(base.to_str().unwrap()), &b, "Other");
        assert_eq!(fs::read_to_string(list_file(&base)).unwrap(), before);
        for d in [base, a, b] { let _ = fs::remove_dir_all(d); }
    }

    #[test]
    fn a_session_gets_a_connector_only_when_it_is_on_in_the_project_and_ticked_for_the_person() {
        let (base, a, b) = (temp("gate-base"), temp("gate-a"), temp("gate-b"));
        let cfg = base.to_str().unwrap();
        mcp_json(&a, json!({"shadcn": SHADCN()}));
        catalog(&base, Some(cfg), &a, "A");
        for p in [&a, &b] { skills::save_kit(p, "frontend", kit(&["shadcn"])).unwrap(); } // ticked in both, but the project B has no file of its own for it
        set_on(&a, "shadcn", true).unwrap();
        assert_eq!(session_servers(&base, Some(cfg), &a, "frontend").iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>(), vec!["shadcn"]);
        // switched off in B (it never was on there... except that an old tick counts as on until the project is asked; see the next test), so choose off explicitly
        set_on(&b, "shadcn", false).unwrap();
        assert!(session_servers(&base, Some(cfg), &b, "frontend").is_empty(), "off in the project: nothing is loaded, ticks or not");
        // on in B: Kona's copy is used, because B has no definition of its own
        set_on(&b, "shadcn", true).unwrap();
        let got = session_servers(&base, Some(cfg), &b, "frontend");
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].1, SHADCN());
        // another person who is not ticked gets nothing
        assert!(session_servers(&base, Some(cfg), &b, "design").is_empty());
        // switching off keeps the ticks, and switching on again brings the same people back
        set_on(&a, "shadcn", false).unwrap();
        assert_eq!(catalog(&base, Some(cfg), &a, "A")[0].roles, vec!["frontend".to_string()]);
        set_on(&a, "shadcn", true).unwrap();
        assert_eq!(session_servers(&base, Some(cfg), &a, "frontend").len(), 1);
        for d in [base, a, b] { let _ = fs::remove_dir_all(d); }
    }

    #[test]
    fn a_project_that_was_never_asked_uses_what_its_people_were_already_ticked_for() {
        let (base, p) = (temp("old-base"), temp("old-p"));
        mcp_json(&p, json!({"shadcn": SHADCN()}));
        skills::save_kit(&p, "backend", kit(&["shadcn"])).unwrap();
        assert!(!on_file(&p).exists());
        assert_eq!(on_set(&p), BTreeSet::from(["shadcn".to_string()]), "what worked before keeps working");
        assert_eq!(session_servers(&base, Some(base.to_str().unwrap()), &p, "backend").len(), 1);
        // the first answer writes the whole picture down, so a later change to the ticks cannot switch anything on by itself
        set_on(&p, "other", true).unwrap();
        assert_eq!(on_set(&p), BTreeSet::from(["shadcn".to_string(), "other".to_string()]));
        skills::save_kit(&p, "qa", kit(&["third"])).unwrap();
        assert!(!on_set(&p).contains("third"));
        for d in [base, p] { let _ = fs::remove_dir_all(d); }
    }

    #[test]
    fn the_project_own_definition_wins_and_a_changed_one_updates_the_copy() {
        let (base, a, b) = (temp("win-base"), temp("win-a"), temp("win-b"));
        let cfg = base.to_str().unwrap();
        mcp_json(&a, json!({"shadcn": SHADCN()}));
        catalog(&base, Some(cfg), &a, "A");
        let fixed = json!({"command": "cmd", "args": ["/c", "npx", "shadcn@latest", "mcp"]});
        mcp_json(&b, json!({"shadcn": fixed.clone()}));
        skills::save_kit(&a, "frontend", kit(&["shadcn"])).unwrap();
        skills::save_kit(&b, "frontend", kit(&["shadcn"])).unwrap();
        set_on(&a, "shadcn", true).unwrap();
        set_on(&b, "shadcn", true).unwrap();
        assert_eq!(session_servers(&base, Some(cfg), &b, "frontend")[0].1, fixed, "B's own file is used in B");
        // B looked: the copy is now the changed one, and the Access page of a third project describes it as `npx`, not `cmd`
        catalog(&base, Some(cfg), &b, "B");
        let third = catalog(&base, Some(cfg), &temp("win-c"), "C");
        assert_eq!(third[0].source, "Found in B");
        assert_eq!(third[0].detail, "npx");
        for d in [base, a, b, temp("win-c")] { let _ = fs::remove_dir_all(d); }
    }

    #[test]
    fn a_card_never_carries_a_secret() {
        let (base, p) = (temp("secret-base"), temp("secret-p"));
        mcp_json(&p, json!({
            "db": {"command": "C:\\tools\\server.exe", "args": ["--token", "SECRET-IN-ARGS"], "env": {"KEY": "SECRET-IN-ENV"}},
            "web": {"type": "http", "url": "https://user:SECRET-IN-URL@mcp.example.com/path?key=SECRET-IN-QUERY"}
        }));
        let rows = catalog(&base, Some(base.to_str().unwrap()), &p, "P");
        let text = serde_json::to_string(&rows).unwrap();
        assert!(!text.contains("SECRET"), "nothing secret reaches the screen: {text}");
        assert_eq!(rows.iter().find(|r| r.name == "db").unwrap().detail, "server.exe");
        let web = rows.iter().find(|r| r.name == "web").unwrap();
        assert_eq!((web.kind.as_str(), web.detail.as_str()), ("web address", "mcp.example.com"));
        for d in [base, p] { let _ = fs::remove_dir_all(d); }
    }

    #[test]
    fn who_may_use_it_is_set_for_everyone_at_once_and_other_choices_are_kept() {
        let p = temp("roles");
        skills::save_kit(&p, "qa", RoleKit { skills: vec!["bug-report".into()], mcp: vec!["x".into()], ..Default::default() }).unwrap();
        let after = set_roles(&p, "x", &["frontend".to_string(), "design".to_string()]).unwrap();
        assert!(after["frontend"].mcp == vec!["x"] && after["design"].mcp == vec!["x"]);
        assert!(after["qa"].mcp.is_empty() && after["qa"].skills == vec!["bug-report"], "the person taken off keeps their skills");
        let none = set_roles(&p, "x", &[]).unwrap();
        assert!(!none.contains_key("frontend") && !none.contains_key("design"), "a person with nothing left has no entry");
        assert!(set_roles(&p, "../x", &[]).is_err());
        let _ = fs::remove_dir_all(&p);
    }

    #[test]
    fn a_connector_kept_only_in_the_list_can_be_removed_and_one_the_project_has_cannot() {
        let (base, a, b) = (temp("rm-base"), temp("rm-a"), temp("rm-b"));
        let cfg = base.to_str().unwrap();
        mcp_json(&a, json!({"shadcn": SHADCN()}));
        catalog(&base, Some(cfg), &a, "A");
        let err = remove(&base, Some(cfg), &a, "shadcn").unwrap_err();
        assert!(err.contains(".mcp.json"), "{err}");
        remove(&base, Some(cfg), &b, "shadcn").unwrap();
        assert!(catalog(&base, Some(cfg), &b, "B").is_empty());
        assert_eq!(catalog(&base, Some(cfg), &a, "A").len(), 1, "A still has its own file");
        for d in [base, a, b] { let _ = fs::remove_dir_all(d); }
    }

    #[test]
    fn the_account_own_settings_are_found_too() {
        let (cfg, p) = (temp("acct-cfg"), temp("acct-p"));
        write(&cfg.join(".claude.json"), &json!({"mcpServers": {"mine": {"command": "node"}}, "projects": {p.to_string_lossy(): {"mcpServers": {"only-here": {"command": "node"}}}}}).to_string());
        let rows = catalog(&cfg, Some(cfg.to_str().unwrap()), &p, "P");
        let names: Vec<_> = rows.iter().map(|r| r.name.as_str()).collect();
        assert!(names.contains(&"mine") && names.contains(&"only-here"), "{names:?}");
        assert!(rows.iter().find(|r| r.name == "only-here").unwrap().source.contains("this project"));
        for d in [cfg, p] { let _ = fs::remove_dir_all(d); }
    }
}
