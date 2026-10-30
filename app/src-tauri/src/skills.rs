// What a session of a role may load: only the skills and tool connectors (MCP servers) the owner chose for that role IN THAT PROJECT
// (decisions 50 and 51). Why: every skill adds its name and description to the start of every session, and every connector adds its tools.
// Measured on this PC (Claude Code 2.1.293, `claude -p` on Haiku): all installed skills and account connectors cost 41,232 tokens at the start;
// the same session with only the project's settings, no connectors and one role skill cost 33,282. The way it is done:
//   --setting-sources project,local   skips the user-level skills, CLAUDE.md and settings (the project's own `.claude` still loads)
//   --plugin-dir <role folder>        adds exactly the chosen skills, copied into <project>\.kona\role-plugins\<role>-<fingerprint>\skills
//   --strict-mcp-config --mcp-config  loads only Kona's board and the chosen connectors
// The 16 skills that Claude Code carries inside itself stay (about 250 tokens for all of them); `--disable-slash-commands` would remove them
// but also the role's own skills, so it is not used.
// Skills belong to the project, like the Brain and the tickets: `<project>\.kona\skills\<name>\SKILL.md`, and the choice of each role is in
// `<project>\.kona\role-kits.json`. Nothing on the computer is used by a session unless the owner copied it into the project (import_skill).
// The computer's skills are the account's Claude folder (`skills`) and Kona's own shelf (%APPDATA%\Kona\skills); they are only a place to copy from.
// Nothing is downloaded or installed by Kona.
use crate::roles::{clean_name, Role};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    /// "project" (in this project) or "computer" (on this PC, not yet in the project)
    pub source: String,
    /// roughly what the skill's name and description add to the start of every session
    pub tokens: u32,
}

#[derive(Serialize, Clone)]
pub struct McpInfo {
    pub name: String,
    /// where it was found, in words
    pub source: String,
    pub kind: String,
}

/// What one role may use in one project.
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct RoleKit {
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub mcp: Vec<String>,
}

/// What a session of a role gets, worked out at its start.
#[derive(Default)]
pub struct Kit {
    pub plugin_dir: Option<PathBuf>,
    pub mcp: Vec<(String, Value)>,
}

pub fn project_skills_dir(folder: &Path) -> PathBuf {
    folder.join(".kona").join("skills")
}

/// Kona's own shelf on this PC: skills the owner keeps to copy into projects.
pub fn shelf_dir(base: &Path) -> PathBuf {
    base.join("skills")
}

fn kits_file(folder: &Path) -> PathBuf {
    folder.join(".kona").join("role-kits.json")
}

fn home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(PathBuf::from)
}

/// The Claude folder of an account (the main account uses the usual `.claude` in the user's folder).
fn claude_dir(config_dir: Option<&str>) -> Option<PathBuf> {
    match config_dir {
        Some(d) => Some(PathBuf::from(d)),
        None => home().map(|h| h.join(".claude")),
    }
}

/// The `name` and `description` lines of a SKILL.md's front matter (a description may be one line, quoted, or a block).
fn front_matter(text: &str) -> (Option<String>, String) {
    let mut lines = text.lines();
    if lines.next().map(str::trim) != Some("---") { return (None, String::new()); }
    let (mut name, mut desc) = (None, String::new());
    let mut in_desc = false;
    for l in lines {
        if l.trim() == "---" { break; }
        let indented = l.starts_with(' ') || l.starts_with('\t');
        if in_desc && indented { desc.push(' '); desc.push_str(l.trim()); continue; }
        in_desc = false;
        if let Some(v) = l.strip_prefix("name:") { name = Some(v.trim().trim_matches(|c| c == '"' || c == '\'').to_string()); }
        else if let Some(v) = l.strip_prefix("description:") {
            let v = v.trim();
            if v.is_empty() || v == ">" || v == "|" || v == ">-" || v == "|-" { in_desc = true; } else { desc = v.trim_matches(|c| c == '"' || c == '\'').to_string(); }
        }
    }
    (name, desc.split_whitespace().collect::<Vec<_>>().join(" "))
}

fn scan(dir: &Path, source: &str, out: &mut Vec<SkillInfo>) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for e in rd.filter_map(Result::ok) {
        let folder = e.file_name().to_string_lossy().to_string();
        // many installed skills are links to a shared folder (~/.agents/skills), so follow the link before asking "is it a folder?"
        let is_dir = fs::metadata(e.path()).map(|m| m.is_dir()).unwrap_or(false);
        if !is_dir || !clean_name(&folder) || out.iter().any(|s| s.name == folder) { continue; }
        let Ok(text) = fs::read_to_string(e.path().join("SKILL.md")) else { continue };
        let (_, desc) = front_matter(&text);
        let tokens = ((folder.len() + desc.chars().count()) as u32).div_ceil(4);
        let short: String = if desc.chars().count() > 220 { desc.chars().take(217).collect::<String>() + "..." } else { desc };
        out.push(SkillInfo { name: folder, description: short, source: source.into(), tokens });
    }
}

/// The skills of one project: the only ones a role of that project can be given.
pub fn catalog(folder: &Path) -> Vec<SkillInfo> {
    let mut out = Vec::new();
    scan(&project_skills_dir(folder), "project", &mut out);
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

/// The skills on this PC that the owner could copy into the project (those already in the project are left out).
pub fn computer_catalog(base: &Path, config_dir: Option<&str>, folder: &Path) -> Vec<SkillInfo> {
    let mut out = Vec::new();
    scan(&shelf_dir(base), "computer", &mut out);
    if let Some(d) = claude_dir(config_dir) { scan(&d.join("skills"), "computer", &mut out); }
    let have: Vec<String> = catalog(folder).into_iter().map(|s| s.name).collect();
    out.retain(|s| !have.contains(&s.name));
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

fn find_on_computer(base: &Path, config_dir: Option<&str>, name: &str) -> Option<PathBuf> {
    let mut places = vec![shelf_dir(base)];
    if let Some(d) = claude_dir(config_dir) { places.push(d.join("skills")); }
    if config_dir.is_some() && let Some(d) = claude_dir(None) { places.push(d.join("skills")); }
    places.into_iter().map(|p| p.join(name)).find(|p| p.join("SKILL.md").is_file())
}

/// A plain copy of a skill folder: never follows links inside it, skips `.git` and `node_modules`, and stops at 20 MB so one huge folder cannot fill the disk.
fn copy_skill(from: &Path, to: &Path, left: &mut u64, depth: u8) -> std::io::Result<()> {
    if depth > 8 { return Ok(()); }
    fs::create_dir_all(to)?;
    for e in fs::read_dir(from)?.filter_map(Result::ok) {
        let n = e.file_name().to_string_lossy().to_string();
        if n == ".git" || n == "node_modules" { continue; }
        let t = e.file_type()?;
        if t.is_dir() { copy_skill(&e.path(), &to.join(&n), left, depth + 1)?; }
        else if t.is_file() {
            let len = e.metadata()?.len();
            if len > *left { return Err(std::io::Error::other("that skill folder is larger than 20 MB")); }
            *left -= len;
            fs::copy(e.path(), to.join(&n))?;
        }
    }
    Ok(())
}

/// Copy one skill from this PC into the project (the owner asked for it). It never replaces a skill the project already has.
pub fn import_skill(base: &Path, config_dir: Option<&str>, folder: &Path, name: &str) -> Result<SkillInfo, String> {
    if !clean_name(name) { return Err("That is not a valid skill name".into()); }
    let target = project_skills_dir(folder).join(name);
    if target.exists() { return Err("The project already has a skill with that name".into()); }
    let src = find_on_computer(base, config_dir, name).ok_or("That skill is not on this PC any more")?;
    let mut left: u64 = 20 * 1024 * 1024;
    if let Err(e) = copy_skill(&src, &target, &mut left, 0) { let _ = fs::remove_dir_all(&target); return Err(e.to_string()); }
    catalog(folder).into_iter().find(|s| s.name == name).ok_or_else(|| "The copy did not work".to_string())
}

pub fn load_kits(folder: &Path) -> HashMap<String, RoleKit> {
    fs::read_to_string(kits_file(folder)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

/// Keep what one role may use in this project.
pub fn save_kit(folder: &Path, role_id: &str, kit: RoleKit) -> Result<RoleKit, String> {
    if !clean_name(role_id) { return Err("That role does not exist".into()); }
    let clean = |v: &[String], what: &str, max: usize| -> Result<Vec<String>, String> {
        let mut out: Vec<String> = Vec::new();
        for s in v {
            if !clean_name(s) { return Err(format!("\"{s}\" is not a valid {what} name")); }
            if !out.contains(s) { out.push(s.clone()); }
        }
        if out.len() > max { return Err(format!("At most {max} {what}s per role")); }
        Ok(out)
    };
    let kit = RoleKit { skills: clean(&kit.skills, "skill", 40)?, mcp: clean(&kit.mcp, "connector", 20)? };
    let mut all = load_kits(folder);
    if kit.skills.is_empty() && kit.mcp.is_empty() { all.remove(role_id); } else { all.insert(role_id.to_string(), kit.clone()); }
    let file = kits_file(folder);
    if let Some(d) = file.parent() { fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    let tmp = file.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(&all).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &file).map_err(|e| e.to_string())?;
    Ok(kit)
}

fn fnv(h: &mut u64, bytes: &[u8]) {
    for b in bytes { *h ^= *b as u64; *h = h.wrapping_mul(0x100000001b3); }
}

/// A fingerprint of a skill folder: the names, sizes and change times of its files. Same fingerprint, same copy.
fn stamp(dir: &Path, h: &mut u64, depth: u8) {
    if depth > 8 { return; }
    let mut names: Vec<_> = fs::read_dir(dir).into_iter().flatten().filter_map(Result::ok).collect();
    names.sort_by_key(|e| e.file_name());
    for e in names {
        let n = e.file_name().to_string_lossy().to_string();
        if n == ".git" || n == "node_modules" { continue; }
        fnv(h, n.as_bytes());
        let Ok(m) = fs::metadata(e.path()) else { continue };
        if m.is_dir() { stamp(&e.path(), h, depth + 1); }
        else {
            fnv(h, &m.len().to_le_bytes());
            fnv(h, &m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0).to_le_bytes());
        }
    }
}

/// Build the small plugin folder that holds exactly the role's skills of this project. No skills, no folder.
/// The folder is named after the role and a fingerprint of its skills, and it is built once: a second session of the same role (two may run)
/// finds it ready and leaves it alone, so one session can never pull the skills away from another. Folders nobody has used for 14 days are removed.
fn build_plugin(folder: &Path, role: &Role, skills: &[String]) -> Result<Option<PathBuf>, String> {
    if !clean_name(&role.id) { return Err("That role has no usable name".into()); }
    let root = folder.join(".kona").join("role-plugins");
    let mine = project_skills_dir(folder);
    // a skill that was removed since the owner chose it is simply left out
    let found: Vec<(&String, PathBuf)> = skills.iter().map(|s| (s, mine.join(s))).filter(|(_, p)| p.join("SKILL.md").is_file()).collect();
    if found.is_empty() { return Ok(None); }
    let mut h: u64 = 0xcbf29ce484222325;
    for (s, src) in &found { fnv(&mut h, s.as_bytes()); stamp(src, &mut h, 0); }
    let name = format!("{}-{:016x}", role.id, h);
    let dir = root.join(&name);
    let ready = |d: &Path| d.join(".claude-plugin").join("plugin.json").is_file();
    if ready(&dir) { prune(&root, &role.id, &name); return Ok(Some(dir)); }
    let tmp = root.join(format!("{name}.building-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    let build = || -> Result<(), String> {
        fs::create_dir_all(tmp.join(".claude-plugin")).map_err(|e| e.to_string())?;
        fs::write(tmp.join(".claude-plugin").join("plugin.json"), json!({"name": "kona-role", "version": "1.0.0", "description": format!("The skills chosen for the {} role in this project", role.name)}).to_string()).map_err(|e| e.to_string())?;
        let mut left: u64 = 20 * 1024 * 1024;
        for (s, src) in &found { copy_skill(src, &tmp.join("skills").join(s), &mut left, 0).map_err(|e| format!("could not give the skill \"{s}\" to {}: {e}", role.name))?; }
        Ok(())
    };
    if let Err(e) = build() { let _ = fs::remove_dir_all(&tmp); return Err(e); }
    if fs::rename(&tmp, &dir).is_err() { let _ = fs::remove_dir_all(&tmp); } // another session built the same folder first: use theirs
    if !ready(&dir) { return Err(format!("could not prepare the skills of {}", role.name)); }
    prune(&root, &role.id, &name);
    Ok(Some(dir))
}

/// Remove this role's older skill folders that were last changed more than 14 days ago (never the one in use now).
fn prune(root: &Path, role_id: &str, keep: &str) {
    let old = std::time::SystemTime::now() - std::time::Duration::from_secs(14 * 24 * 3600);
    for e in fs::read_dir(root).into_iter().flatten().filter_map(Result::ok) {
        let n = e.file_name().to_string_lossy().to_string();
        if n != keep && n.starts_with(&format!("{role_id}-")) && e.metadata().and_then(|m| m.modified()).map(|t| t < old).unwrap_or(false) { let _ = fs::remove_dir_all(e.path()); }
    }
}

fn norm_path(s: &str) -> String {
    s.replace('\\', "/").trim_end_matches('/').to_lowercase()
}

/// Every connector definition Claude Code would know for this account and project: (name, where from, definition).
fn mcp_defs(config_dir: Option<&str>, folder: &Path) -> Vec<(String, String, Value)> {
    let mut out: Vec<(String, String, Value)> = Vec::new();
    let mut take = |servers: Option<&Value>, source: &str| {
        if let Some(Value::Object(m)) = servers {
            for (k, v) in m {
                if k != "kona-board" && clean_name(k) && v.is_object() && !out.iter().any(|(n, _, _)| n == k) { out.push((k.clone(), source.to_string(), v.clone())); }
            }
        }
    };
    let user_file = match config_dir { Some(d) => Some(PathBuf::from(d).join(".claude.json")), None => home().map(|h| h.join(".claude.json")) };
    if let Some(j) = user_file.and_then(|f| fs::read_to_string(f).ok()).and_then(|t| serde_json::from_str::<Value>(&t).ok()) {
        if let Some(Value::Object(projects)) = j.get("projects") {
            let want = norm_path(&folder.to_string_lossy());
            for (k, v) in projects { if norm_path(k) == want { take(v.get("mcpServers"), "this project, in your Claude settings"); } }
        }
        take(j.get("mcpServers"), "your Claude settings");
    }
    if let Some(j) = fs::read_to_string(folder.join(".mcp.json")).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()) { take(j.get("mcpServers"), "the project's .mcp.json"); }
    out
}

pub fn mcp_catalog(config_dir: Option<&str>, folder: &Path) -> Vec<McpInfo> {
    mcp_defs(config_dir, folder).into_iter().map(|(name, source, d)| McpInfo { name, source, kind: if d.get("command").is_some() { "program".into() } else { "web address".into() } }).collect()
}

/// What a session of this role starts with in this project: its skills folder and the definitions of its connectors.
pub fn kit_for(role: &Role, config_dir: Option<&str>, folder: &Path) -> Result<Kit, String> {
    let mine = load_kits(folder).remove(&role.id).unwrap_or_default();
    let plugin_dir = build_plugin(folder, role, &mine.skills)?;
    let defs = mcp_defs(config_dir, folder);
    let mcp = mine.mcp.iter().filter_map(|n| defs.iter().find(|(d, _, _)| d == n).map(|(d, _, v)| (d.clone(), v.clone()))).collect();
    Ok(Kit { plugin_dir, mcp })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("kona-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn skill(dir: &Path, name: &str, desc: &str) {
        let d = dir.join(name);
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("SKILL.md"), format!("---\nname: {name}\ndescription: {desc}\n---\nBody.")).unwrap();
    }

    #[test]
    fn front_matter_reads_one_line_quoted_and_block_descriptions() {
        assert_eq!(front_matter("---\nname: a\ndescription: Use it now.\n---\nbody").1, "Use it now.");
        assert_eq!(front_matter("---\nname: a\ndescription: \"Quoted text\"\n---\n").1, "Quoted text");
        assert_eq!(front_matter("---\nname: a\ndescription: >\n  First line\n  second line\nother: x\n---\n").1, "First line second line");
        assert_eq!(front_matter("no front matter").1, "");
    }

    #[test]
    fn a_project_sees_only_its_own_skills_and_the_computer_ones_are_a_place_to_copy_from() {
        let (base, a, b) = (temp("base"), temp("proj-a"), temp("proj-b"));
        skill(&shelf_dir(&base), "tone", "Computer skill.");
        skill(&project_skills_dir(&a), "bug-report", "Only in A.");
        assert_eq!(catalog(&a).iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), vec!["bug-report"]);
        assert!(catalog(&b).is_empty()); // the other project has nothing, whatever is on the PC
        assert!(computer_catalog(&base, None, &b).iter().any(|s| s.name == "tone"));
        let got = import_skill(&base, None, &b, "tone").unwrap();
        assert_eq!(got.source, "project");
        assert!(catalog(&a).iter().all(|s| s.name != "tone")); // copying into B did not touch A
        assert!(import_skill(&base, None, &b, "tone").is_err()); // never replaces
        assert!(import_skill(&base, None, &b, "../evil").is_err());
        assert!(computer_catalog(&base, None, &b).iter().all(|s| s.name != "tone")); // it is in the project now
        for d in [base, a, b] { let _ = fs::remove_dir_all(d); }
    }

    #[test]
    fn each_project_keeps_its_own_choice_per_role() {
        let (a, b) = (temp("kit-a"), temp("kit-b"));
        save_kit(&a, "qa", RoleKit { skills: vec!["bug-report".into(), "bug-report".into()], mcp: vec![] }).unwrap();
        assert_eq!(load_kits(&a)["qa"].skills, vec!["bug-report"]); // listed once
        assert!(load_kits(&b).is_empty());
        assert!(save_kit(&a, "qa", RoleKit { skills: vec!["../x".into()], mcp: vec![] }).is_err());
        save_kit(&a, "qa", RoleKit::default()).unwrap();
        assert!(load_kits(&a).is_empty()); // an empty choice removes the entry
        for d in [a, b] { let _ = fs::remove_dir_all(d); }
    }

    #[test]
    fn a_role_skill_folder_is_built_once_and_never_removed_under_a_running_session() {
        let project = temp("plugin");
        skill(&project_skills_dir(&project), "bug-report", "Use for bugs.");
        let mut role = crate::roles::starting_roles().remove(4);
        let want = vec!["bug-report".to_string(), "gone".to_string()];
        let first = build_plugin(&project, &role, &want).unwrap().unwrap();
        assert!(first.join(".claude-plugin").join("plugin.json").is_file());
        assert!(first.join("skills").join("bug-report").join("SKILL.md").is_file());
        assert!(!first.join("skills").join("gone").exists()); // a skill that is not there is left out
        fs::write(first.join("in-use.txt"), "another session is reading this folder").unwrap();
        let second = build_plugin(&project, &role, &want).unwrap().unwrap();
        assert_eq!(first, second);
        assert!(second.join("in-use.txt").is_file()); // the second start did not rebuild or delete it
        role.id = "qa".into();
        assert!(build_plugin(&project, &role, &[]).unwrap().is_none());
        let _ = fs::remove_dir_all(&project);
    }

    #[test]
    fn a_changed_skill_gets_its_own_new_folder() {
        let project = temp("change");
        skill(&project_skills_dir(&project), "tone", "one");
        let role = crate::roles::starting_roles().remove(7);
        let want = vec!["tone".to_string()];
        let a = build_plugin(&project, &role, &want).unwrap().unwrap();
        skill(&project_skills_dir(&project), "tone", "two, longer now");
        let b = build_plugin(&project, &role, &want).unwrap().unwrap();
        assert_ne!(a, b);
        assert!(a.exists() && b.exists()); // the old one stays for a session that may still use it
        let _ = fs::remove_dir_all(&project);
    }

    /// On the owner's PC: skills that are links to another folder must be listed too. Run: cargo test computer_skills -- --ignored --nocapture
    #[test]
    #[ignore]
    fn computer_skills_include_linked_ones() {
        let found = computer_catalog(&temp("none"), None, &temp("empty-project"));
        println!("{} skills found: {}", found.len(), found.iter().map(|s| s.name.as_str()).collect::<Vec<_>>().join(", "));
        assert!(found.iter().any(|s| s.name == "minimalist-ui"), "a linked skill was missed");
    }

    /// Builds a project, a skill and a role kit under the temp folder and prints the plugin folder, so a real `claude` can be started with it
    /// by hand. Run: cargo test manual_check -- --ignored --nocapture
    #[test]
    #[ignore]
    fn manual_check_builds_a_real_kit() {
        let project = std::env::temp_dir().join("kona-e2e-project");
        let _ = fs::remove_dir_all(&project);
        skill(&project_skills_dir(&project), "e2e-skill", "A harmless skill for a check. Use only when the user says pineapple.");
        let role = crate::roles::starting_roles().remove(2);
        save_kit(&project, &role.id, RoleKit { skills: vec!["e2e-skill".into()], mcp: vec![] }).unwrap();
        let kit = kit_for(&role, None, &project).unwrap();
        println!("PLUGIN {}", kit.plugin_dir.unwrap().display());
    }
}
