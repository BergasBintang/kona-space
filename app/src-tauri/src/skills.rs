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
    /// the people a built-in skill is written for (role ids); empty for every other skill
    #[serde(default)]
    pub roles: Vec<String>,
    /// how many files its folder holds: SKILL.md and whatever comes with it (templates, references, scripts)
    #[serde(default)]
    pub files: u32,
}

// The skills that come with Kona, inside the program, so every download has them whole: (skill, file inside its folder, text). The table is made by build.rs from `skills/<name>/`.
// A new project starts with them and with the starting tree of each person (seed_new_project; decision 67). In the project they are ordinary files, the owner's to change or delete. A copy the owner
// never changed is brought up to date when a new Kona ships better text (refresh_builtins); one the owner changed is never touched.
include!(concat!(env!("OUT_DIR"), "/builtin_skills.rs"));

/// The starting tree of each person: role id -> the branches, each with its skills and a short line on when to take each.
const DEFAULT_TREE: &str = include_str!("../skills/default-tree.json");

#[derive(Deserialize)]
struct TreeBranch { branch: String, when: String, skills: Vec<(String, String)> }

fn default_tree() -> HashMap<String, Vec<TreeBranch>> {
    serde_json::from_str(DEFAULT_TREE).expect("default-tree.json is checked by a test")
}

fn builtin_names() -> Vec<&'static str> {
    let mut names: Vec<&str> = BUILTIN_FILES.iter().map(|(s, _, _)| *s).collect();
    names.dedup(); // the table is sorted
    names
}

fn builtin_files(name: &str) -> impl Iterator<Item = (&'static str, &'static str)> + '_ {
    BUILTIN_FILES.iter().filter(move |(s, _, _)| *s == name).map(|(_, rel, text)| (*rel, *text))
}

/// The people whose starting tree has this skill.
fn builtin_roles(tree: &HashMap<String, Vec<TreeBranch>>, name: &str) -> Vec<String> {
    let mut roles: Vec<String> = tree.iter().filter(|(_, bs)| bs.iter().any(|b| b.skills.iter().any(|(s, _)| s == name))).map(|(r, _)| r.clone()).collect();
    roles.sort();
    roles
}

fn builtin_info(tree: &HashMap<String, Vec<TreeBranch>>, name: &str) -> Option<SkillInfo> {
    let text = builtin_files(name).find(|(rel, _)| *rel == "SKILL.md")?.1;
    let (_, desc) = front_matter(text);
    let tokens = ((name.len() + desc.chars().count()) as u32).div_ceil(4);
    Some(SkillInfo { name: name.into(), description: desc, source: "builtin".into(), tokens, roles: builtin_roles(tree, name), files: builtin_files(name).count() as u32 })
}

/// What a person starts with: their skills, the short lines and the branches. Nobody else is written here; it is a plain RoleKit, the owner's to change once saved.
pub fn default_kit(role_id: &str) -> Option<RoleKit> {
    let tree = default_tree();
    let branches = tree.get(role_id)?;
    let mut kit = RoleKit::default();
    for b in branches {
        for (s, note) in &b.skills {
            if !kit.skills.contains(s) { kit.skills.push(s.clone()); }
            kit.notes.insert(s.clone(), note.clone());
        }
        kit.branches.push(Branch { name: b.branch.clone(), when: b.when.clone(), skills: b.skills.iter().map(|(s, _)| s.clone()).collect() });
    }
    Some(kit)
}

fn shipped_hash(name: &str) -> String {
    let mut rows: Vec<(String, Vec<u8>)> = builtin_files(name).map(|(rel, text)| (rel.to_string(), text.as_bytes().to_vec())).collect();
    hash_rows(&mut rows)
}

fn hash_rows(rows: &mut [(String, Vec<u8>)]) -> String {
    rows.sort();
    let mut h: u64 = 0xcbf29ce484222325;
    for (rel, bytes) in rows.iter() { fnv(&mut h, rel.as_bytes()); fnv(&mut h, &(bytes.len() as u64).to_le_bytes()); fnv(&mut h, bytes); }
    format!("{h:016x}")
}

/// A fingerprint of what a skill folder holds now: the same files with the same bytes give the same answer as shipped_hash.
fn folder_hash(dir: &Path) -> Option<String> {
    fn walk(dir: &Path, rel: &str, out: &mut Vec<(String, Vec<u8>)>, depth: u8) -> Option<()> {
        if depth > 8 { return None; }
        for e in fs::read_dir(dir).ok()?.filter_map(Result::ok) {
            let n = e.file_name().to_string_lossy().to_string();
            let inside = if rel.is_empty() { n } else { format!("{rel}/{n}") };
            if e.file_type().ok()?.is_dir() { walk(&e.path(), &inside, out, depth + 1)?; } else { out.push((inside, fs::read(e.path()).ok()?)); }
        }
        Some(())
    }
    let mut rows = Vec::new();
    walk(dir, "", &mut rows, 0)?;
    Some(hash_rows(&mut rows))
}

fn stamps_file(folder: &Path) -> PathBuf {
    folder.join(".kona").join("builtin-skills.json")
}

/// For each skill Kona wrote into this project: the fingerprint of what it wrote. That is how an update can tell a copy nobody changed from one the owner changed.
fn load_stamps(folder: &Path) -> HashMap<String, String> {
    fs::read_to_string(stamps_file(folder)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

fn save_stamps(folder: &Path, stamps: &HashMap<String, String>) -> Result<(), String> {
    let file = stamps_file(folder);
    let tmp = file.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(stamps).map_err(|e| e.to_string())?).and_then(|_| fs::rename(&tmp, &file)).map_err(|e| e.to_string())
}

/// Write one built-in skill into the project, whole or not at all. Whatever was in that folder goes, so callers check first.
fn write_builtin(folder: &Path, name: &str) -> Result<(), String> {
    let dir = project_skills_dir(folder).join(name);
    let tmp = project_skills_dir(folder).join(format!("{name}.writing-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    let write = || -> std::io::Result<()> {
        for (rel, text) in builtin_files(name) {
            let f = tmp.join(rel);
            if let Some(p) = f.parent() { fs::create_dir_all(p)?; }
            fs::write(f, text)?;
        }
        if dir.exists() { fs::remove_dir_all(&dir)?; }
        fs::rename(&tmp, &dir)
    };
    write().map_err(|e| { let _ = fs::remove_dir_all(&tmp); format!("could not write the skill \"{name}\": {e}") })
}

/// Put built-in skills the project does not have yet into it. A folder that already has that name stays as it is, and it is the owner's.
fn add_builtins(folder: &Path, names: &[String]) -> Result<(), String> {
    let mut stamps = load_stamps(folder);
    for name in names {
        if project_skills_dir(folder).join(name).exists() || builtin_files(name).next().is_none() { continue; }
        write_builtin(folder, name)?;
        stamps.insert(name.clone(), shipped_hash(name));
    }
    save_stamps(folder, &stamps)
}

/// A new project gets the skills that come with Kona and every person's starting tree. A folder that was a project before already has its kits, and those are left alone.
pub fn seed_new_project(folder: &Path) -> Result<(), String> {
    if kits_file(folder).exists() { return Ok(()); }
    fs::create_dir_all(project_skills_dir(folder)).map_err(|e| e.to_string())?;
    let names: Vec<String> = builtin_names().into_iter().map(str::to_string).collect();
    add_builtins(folder, &names)?;
    for role in default_tree().keys() {
        if let Some(kit) = default_kit(role) { save_kit(folder, role, kit)?; }
    }
    Ok(())
}

/// Bring the built-in skills of this project up to the text of this version of Kona. Only a copy still exactly as Kona wrote it is replaced; one the owner changed or deleted is left alone. It fails quietly: the old text still works.
pub fn refresh_builtins(folder: &Path) {
    let mut stamps = load_stamps(folder);
    let mut changed = false;
    for (name, stored) in stamps.iter_mut() {
        if builtin_files(name).next().is_none() { continue; }
        let now = shipped_hash(name);
        if now == *stored { continue; }
        let dir = project_skills_dir(folder).join(name);
        if folder_hash(&dir).as_deref() == Some(stored.as_str()) && write_builtin(folder, name).is_ok() { *stored = now; changed = true; }
    }
    if changed { let _ = save_stamps(folder, &stamps); }
}

/// Give one person their starting tree in a project that already exists: the skills they lack are written, and the branches join the ones they have. Their own notes, branches and skills stay.
pub fn apply_default_tree(folder: &Path, role_id: &str) -> Result<RoleKit, String> {
    let start = default_kit(role_id).ok_or("Kona has no starting tree for that person")?;
    fs::create_dir_all(project_skills_dir(folder)).map_err(|e| e.to_string())?;
    add_builtins(folder, &start.skills)?;
    let mut kit = load_kits(folder).remove(role_id).unwrap_or_default();
    for s in &start.skills { if !kit.skills.contains(s) { kit.skills.push(s.clone()); } }
    for (s, n) in &start.notes { kit.notes.entry(s.clone()).or_insert_with(|| n.clone()); }
    for b in start.branches {
        let free: Vec<String> = b.skills.into_iter().filter(|s| !kit.branches.iter().any(|x| x.skills.contains(s))).collect();
        if let Some(have) = kit.branches.iter_mut().find(|x| x.name.to_lowercase() == b.name.to_lowercase()) { have.skills.extend(free); }
        else if kit.branches.len() < 12 { kit.branches.push(Branch { name: b.name, when: b.when, skills: free }); }
    }
    save_kit(folder, role_id, kit)
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
    /// for each skill, when this person should use it (decision 63): a hint added to their instructions, written for the owner to edit
    #[serde(default)]
    pub notes: HashMap<String, String>,
    /// local tools (ids from needs.rs) this project needs from this person on top of what the role and the project's files say, and tools the owner says are not needed here
    #[serde(default)]
    pub tools_add: Vec<String>,
    #[serde(default)]
    pub tools_skip: Vec<String>,
    /// the tree the person chooses by (decision 63): the job, then a branch for each kind of work, then the skills of that branch. A skill in no branch hangs straight off the job.
    #[serde(default)]
    pub branches: Vec<Branch>,
}

/// One branch of a person's skill tree: a kind of work, when to go down it, and the skills under it.
#[derive(Serialize, Deserialize, Clone, Default, Debug, PartialEq)]
pub struct Branch {
    pub name: String,
    #[serde(default)]
    pub when: String,
    #[serde(default)]
    pub skills: Vec<String>,
}

impl RoleKit {
    fn is_empty(&self) -> bool {
        self.skills.is_empty() && self.mcp.is_empty() && self.tools_add.is_empty() && self.tools_skip.is_empty() && self.branches.is_empty()
    }
}

/// What a session of a role gets, worked out at its start.
#[derive(Default)]
pub struct Kit {
    pub plugin_dir: Option<PathBuf>,
    pub mcp: Vec<(String, Value)>,
    /// (skill, note) for each of the person's skills that has a note, in the order of the skills
    pub notes: Vec<(String, String)>,
    /// the branches of the person's tree, with only the skills the person has
    pub branches: Vec<Branch>,
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
        let files = count_files(&e.path(), 0);
        out.push(SkillInfo { name: folder, description: short, source: source.into(), tokens, roles: Vec::new(), files });
    }
}

fn count_files(dir: &Path, depth: u8) -> u32 {
    if depth > 8 { return 0; }
    fs::read_dir(dir).into_iter().flatten().filter_map(Result::ok).filter(|e| { let n = e.file_name(); n != ".git" && n != "node_modules" })
        .map(|e| if e.file_type().map(|t| t.is_dir()).unwrap_or(false) { count_files(&e.path(), depth + 1) } else { 1 }).sum()
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
    let tree = default_tree();
    for name in builtin_names() { if !out.iter().any(|s| s.name == name) && let Some(i) = builtin_info(&tree, name) { out.push(i); } }
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
    let Some(src) = find_on_computer(base, config_dir, name) else {
        // one that comes with Kona: written out from the program, with all its files
        if builtin_files(name).next().is_none() { return Err("That skill is not on this PC any more".into()); }
        fs::create_dir_all(project_skills_dir(folder)).map_err(|e| e.to_string())?;
        add_builtins(folder, &[name.to_string()])?;
        return catalog(folder).into_iter().find(|s| s.name == name).ok_or_else(|| "The copy did not work".to_string());
    };
    let mut left: u64 = 20 * 1024 * 1024;
    if let Err(e) = copy_skill(&src, &target, &mut left, 0) { let _ = fs::remove_dir_all(&target); return Err(e.to_string()); }
    catalog(folder).into_iter().find(|s| s.name == name).ok_or_else(|| "The copy did not work".to_string())
}

/// The text of one of the project's skills (its SKILL.md), to read and change.
pub fn read_skill(folder: &Path, name: &str) -> Result<String, String> {
    if !clean_name(name) { return Err("That is not a valid skill name".into()); }
    let file = project_skills_dir(folder).join(name).join("SKILL.md");
    let meta = fs::metadata(&file).map_err(|_| "The project has no skill with that name".to_string())?;
    if meta.len() > 200 * 1024 { return Err("That skill file is larger than 200 KB, open it in an editor instead".into()); }
    fs::read_to_string(&file).map_err(|e| e.to_string())
}

/// Make a new skill in the project (`create`), or replace the text of one it has. The text is a SKILL.md: front matter with the same name as the folder and a description, then the instructions.
pub fn write_skill(folder: &Path, name: &str, text: &str, create: bool) -> Result<SkillInfo, String> {
    if !clean_name(name) { return Err("A skill name is lower case letters, digits and dashes, like write-a-ticket".into()); }
    if text.len() > 100 * 1024 { return Err("A skill file is at most 100 KB".into()); }
    let (fm_name, desc) = front_matter(text);
    if fm_name.as_deref() != Some(name) { return Err(format!("The top of the file must say \"name: {name}\" between two lines of three dashes")); }
    if desc.is_empty() { return Err("The top of the file needs a description: one line that says when to use the skill".into()); }
    if text.lines().skip_while(|l| l.trim() != "---").skip(1).skip_while(|l| l.trim() != "---").skip(1).all(|l| l.trim().is_empty()) { return Err("Write the instructions under the description".into()); }
    let dir = project_skills_dir(folder).join(name);
    if create && dir.exists() { return Err("The project already has a skill with that name".into()); }
    if !create && !dir.join("SKILL.md").is_file() { return Err("The project has no skill with that name".into()); }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join("SKILL.md");
    let tmp = dir.join("SKILL.md.tmp");
    fs::write(&tmp, text).and_then(|_| fs::rename(&tmp, &file)).map_err(|e| e.to_string())?;
    catalog(folder).into_iter().find(|s| s.name == name).ok_or_else(|| "The skill was written but could not be read back".to_string())
}

/// One file beside a skill's SKILL.md. `text` is empty for what cannot be changed on a screen: a picture, or a very large file.
#[derive(Serialize)]
pub struct SkillFile {
    pub path: String,
    pub bytes: u64,
    pub text: Option<String>,
}

#[derive(Deserialize)]
pub struct FileWrite {
    pub path: String,
    pub text: String,
}

/// A path inside a skill's folder, checked: plain relative names only, so nothing typed on a screen can reach outside the folder or name something Windows refuses. SKILL.md has its own way in (write_skill).
fn inside_skill(dir: &Path, path: &str) -> Result<PathBuf, String> {
    let bad = || format!("\"{path}\" is not a usable file name in a skill");
    let parts: Vec<&str> = path.split('/').collect();
    if parts.is_empty() || parts.len() > 4 || path.eq_ignore_ascii_case("SKILL.md") { return Err(bad()); }
    let mut at = dir.to_path_buf();
    for p in &parts {
        let stem = p.split('.').next().unwrap_or("").to_ascii_lowercase();
        let reserved = ["con", "prn", "aux", "nul"].contains(&stem.as_str()) || ((stem.starts_with("com") || stem.starts_with("lpt")) && stem.len() == 4 && stem.ends_with(|c: char| c.is_ascii_digit()));
        if !clean_name(p) || p.ends_with('.') || reserved { return Err(bad()); }
        at.push(p);
        // a link inside the folder could point anywhere, so a path through one is refused
        if fs::symlink_metadata(&at).map(|m| m.file_type().is_symlink()).unwrap_or(false) { return Err(bad()); }
    }
    Ok(at)
}

/// Every file of one of the project's skills except SKILL.md, for the editor.
pub fn read_skill_files(folder: &Path, name: &str) -> Result<Vec<SkillFile>, String> {
    if !clean_name(name) { return Err("That is not a valid skill name".into()); }
    fn walk(dir: &Path, rel: &str, out: &mut Vec<SkillFile>, depth: u8) {
        if depth > 8 { return; }
        for e in fs::read_dir(dir).into_iter().flatten().filter_map(Result::ok) {
            let n = e.file_name().to_string_lossy().to_string();
            if n == ".git" || n == "node_modules" { continue; }
            let inside = if rel.is_empty() { n } else { format!("{rel}/{n}") };
            let Ok(t) = e.file_type() else { continue };
            if t.is_dir() { walk(&e.path(), &inside, out, depth + 1); }
            else if t.is_file() && inside != "SKILL.md" {
                let bytes = e.metadata().map(|m| m.len()).unwrap_or(0);
                let text = if bytes <= 200 * 1024 { fs::read(e.path()).ok().and_then(|b| String::from_utf8(b).ok()) } else { None };
                out.push(SkillFile { path: inside, bytes, text });
            }
        }
    }
    let dir = project_skills_dir(folder).join(name);
    if !dir.join("SKILL.md").is_file() { return Err("The project has no skill with that name".into()); }
    let mut out = Vec::new();
    walk(&dir, "", &mut out, 0);
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

/// Keep a skill's whole folder from the editor: SKILL.md (new or changed), the files written, the files removed. Everything is checked before anything is touched.
pub fn save_skill_folder(folder: &Path, name: &str, text: &str, create: bool, writes: &[FileWrite], deletes: &[String]) -> Result<SkillInfo, String> {
    if !clean_name(name) { return Err("A skill name is lower case letters, digits and dashes, like write-a-ticket".into()); }
    if writes.len() > 50 { return Err("At most 50 files at a time".into()); }
    let dir = project_skills_dir(folder).join(name);
    let mut out = Vec::new();
    for w in writes {
        if w.text.len() > 100 * 1024 { return Err(format!("{} is larger than 100 KB", w.path)); }
        out.push((inside_skill(&dir, &w.path)?, w.text.as_str()));
    }
    let gone = deletes.iter().map(|p| inside_skill(&dir, p)).collect::<Result<Vec<_>, _>>()?;
    write_skill(folder, name, text, create)?;
    for p in gone {
        if out.iter().any(|(q, _)| *q == p) || !p.is_file() { continue; }
        fs::remove_file(&p).map_err(|e| e.to_string())?;
        if let Some(parent) = p.parent() && parent != dir { let _ = fs::remove_dir(parent); } // only goes when it is empty
    }
    for (p, body) in out {
        if let Some(parent) = p.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        let tmp = p.with_extension("kona-tmp");
        fs::write(&tmp, body).and_then(|_| fs::rename(&tmp, &p)).map_err(|e| e.to_string())?;
    }
    catalog(folder).into_iter().find(|s| s.name == name).ok_or_else(|| "The skill was written but could not be read back".to_string())
}

/// Remove one of the project's skills (its whole folder), and take it off every person's list and notes. The original on this PC and the built-in ones are never touched.
pub fn delete_skill(folder: &Path, name: &str) -> Result<(), String> {
    if !clean_name(name) { return Err("That is not a valid skill name".into()); }
    let dir = project_skills_dir(folder).join(name);
    if !dir.join("SKILL.md").is_file() { return Err("The project has no skill with that name".into()); }
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut all = load_kits(folder);
    for kit in all.values_mut() { kit.skills.retain(|s| s != name); kit.notes.remove(name); for b in &mut kit.branches { b.skills.retain(|s| s != name); } }
    all.retain(|_, k| !k.is_empty());
    let file = kits_file(folder);
    if file.exists() {
        let tmp = file.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(&all).map_err(|e| e.to_string())?).and_then(|_| fs::rename(&tmp, &file)).map_err(|e| e.to_string())?;
    }
    Ok(())
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
    let skills = clean(&kit.skills, "skill", 40)?;
    // a note belongs to a skill the person has; it is one line of at most 300 letters
    let mut notes = HashMap::new();
    for (name, note) in &kit.notes {
        let note = note.split_whitespace().collect::<Vec<_>>().join(" ");
        if note.is_empty() || !skills.contains(name) { continue; }
        if note.chars().count() > 300 { return Err(format!("The note for \"{name}\" is longer than 300 letters. Shorten it: it is sent with every conversation.")); }
        notes.insert(name.clone(), note);
    }
    // a tool is named by its id (needs.rs); an id is a short plain name, so nothing typed on a screen can be anything else. One that Kona does not know is ignored when the tools are checked.
    let tool_ids = |v: &[String]| -> Result<Vec<String>, String> {
        let mut out: Vec<String> = Vec::new();
        for s in v {
            if s.is_empty() || s.len() > 40 || !s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') { return Err(format!("\"{s}\" is not a tool name")); }
            if !out.contains(s) { out.push(s.clone()); }
        }
        Ok(out)
    };
    let tools_add = tool_ids(&kit.tools_add)?;
    let tools_skip: Vec<String> = tool_ids(&kit.tools_skip)?.into_iter().filter(|s| !tools_add.contains(s)).collect(); // adding a tool again takes it off the hidden list
    // a branch has a plain name (once), a short line on when to take it, and skills the person has; a skill hangs under one branch only
    if kit.branches.len() > 12 { return Err("At most 12 branches per person".into()); }
    let mut branches: Vec<Branch> = Vec::new();
    for b in &kit.branches {
        let name = b.name.split_whitespace().collect::<Vec<_>>().join(" ");
        let when = b.when.split_whitespace().collect::<Vec<_>>().join(" ");
        if name.is_empty() { return Err("Give every branch a name".into()); }
        if name.chars().count() > 40 { return Err(format!("The branch \"{name}\" has a name longer than 40 letters")); }
        if when.chars().count() > 200 { return Err(format!("The line on when to take \"{name}\" is longer than 200 letters. Shorten it: it is sent with every conversation.")); }
        if branches.iter().any(|x| x.name.to_lowercase() == name.to_lowercase()) { return Err(format!("There are two branches called \"{name}\"")); }
        let mut mine: Vec<String> = Vec::new();
        for s in &b.skills {
            if skills.contains(s) && !mine.contains(s) && !branches.iter().any(|x| x.skills.contains(s)) { mine.push(s.clone()); }
        }
        branches.push(Branch { name, when, skills: mine });
    }
    let kit = RoleKit { skills, mcp: clean(&kit.mcp, "connector", 20)?, notes, tools_add, tools_skip, branches };
    let mut all = load_kits(folder);
    if kit.is_empty() { all.remove(role_id); } else { all.insert(role_id.to_string(), kit.clone()); }
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
    refresh_builtins(folder);
    let mine = load_kits(folder).remove(&role.id).unwrap_or_default();
    let plugin_dir = build_plugin(folder, role, &mine.skills)?;
    let defs = mcp_defs(config_dir, folder);
    let mcp = mine.mcp.iter().filter_map(|n| defs.iter().find(|(d, _, _)| d == n).map(|(d, _, v)| (d.clone(), v.clone()))).collect();
    let notes = mine.skills.iter().filter_map(|s| mine.notes.get(s).map(|n| (s.clone(), n.clone()))).collect();
    Ok(Kit { plugin_dir, mcp, notes, branches: mine.branches })
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
    fn every_builtin_skill_is_a_good_skill_file_and_can_be_copied_into_a_project() {
        let project = temp("builtin-p");
        let tree = default_tree();
        for name in builtin_names() {
            let text = builtin_files(name).find(|(r, _)| *r == "SKILL.md").expect("a skill has a SKILL.md").1;
            let (n, d) = front_matter(text);
            assert_eq!(n.as_deref(), Some(name), "the front matter names the folder");
            assert!(!d.is_empty() && d.chars().count() <= 220, "{name}: a description of one line, {} letters", d.chars().count());
            assert!(!d.contains(": ") && !d.contains('<'), "{name}: a colon or an angle bracket breaks the front matter when it is read as YAML");
            assert!(d.starts_with("Use when"), "{name}: says when to use it, the way a person's choice is made");
            assert!(!name.contains("claude") && !name.contains("anthropic"), "{name}: those words are reserved in skill names");
            assert!(text.lines().count() < 500, "{name}: the guide says under 500 lines");
            assert!(!builtin_roles(&tree, name).is_empty(), "{name}: somebody uses it");
            assert!(write_skill(&project, name, text, true).is_ok(), "{name} passes the same checks as a skill the owner writes");
            let _ = fs::remove_dir_all(project_skills_dir(&project).join(name));
            // every file beside SKILL.md is pointed at as an order: "the template has both forms" was not enough for Claude to open it, "open the template" was (a real conversation, 2026-11-02)
            for (rel, _) in builtin_files(name).filter(|(r, _)| *r != "SKILL.md") {
                let line = text.lines().find(|l| l.contains(&format!("`{rel}`"))).unwrap_or_else(|| panic!("{name}: nothing points at {rel}"));
                assert!(line.to_lowercase().contains("open "), "{name}: say \"open {rel}\", found: {line}");
            }
            // what the skill points at comes with it, one level deep, and it names only other skills that exist
            let files: Vec<&str> = builtin_files(name).map(|(r, _)| r).collect();
            for (rel, body) in builtin_files(name) {
                assert!(rel.matches('/').count() <= 1, "{name}/{rel}: one level deep");
                for part in body.split('`').skip(1).step_by(2) {
                    if rel == "SKILL.md" && (part.starts_with("references/") || part.starts_with("templates/")) { assert!(files.contains(&part), "{name} points at {part}, which is not there"); }
                }
                for secret in ["password:", "BEGIN RSA"] { assert!(!body.contains(secret), "{name}/{rel} must hold nothing private ({secret})"); }
                assert!(!body.split(|c: char| !c.is_ascii_digit() && c != '.').any(|w| w.split('.').filter(|p| !p.is_empty()).count() == 4), "{name}/{rel} must hold no address");
                assert!(!body.to_lowercase().contains("miralis"), "{name}/{rel}: for every user of Kona, not one company");
            }
        }
        // the starting tree: every person has one, it names only skills that exist, and it stays cheap at the start of a conversation
        let names = builtin_names();
        for role in crate::roles::starting_roles() {
            let kit = default_kit(&role.id).unwrap_or_else(|| panic!("{} has a starting tree", role.id));
            assert!(kit.skills.iter().all(|s| names.contains(&s.as_str())), "{}: a skill that does not exist", role.id);
            assert_eq!(kit.skills.iter().filter(|s| kit.notes.contains_key(*s)).count(), kit.skills.len(), "{}: every skill has its short line", role.id);
            let listing: usize = kit.skills.iter().map(|s| s.len() + builtin_info(&tree, s).unwrap().description.len()).sum();
            let outline = crate::session::skill_notes(&Kit { notes: kit.notes.clone().into_iter().collect(), branches: kit.branches.clone(), ..Default::default() }).unwrap().len();
            assert!((listing + outline) / 4 < 800, "{}: about {} tokens at the start of every conversation", role.id, (listing + outline) / 4);
            assert!(kit.branches.len() >= 2 && kit.branches.iter().all(|b| !b.skills.is_empty() && !b.when.is_empty()), "{}: a tree with real branches", role.id);
            let p = temp(&format!("builtin-valid-{}", role.id));
            add_builtins(&p, &kit.skills).unwrap();
            assert!(save_kit(&p, &role.id, kit).is_ok(), "{}: passes the rules of a saved tree", role.id);
        }
        // they are offered to copy, and copying writes the file
        let base = temp("builtin-b");
        assert!(computer_catalog(&base, Some(base.to_str().unwrap()), &project).iter().any(|s| s.name == "bug-report" && s.source == "builtin" && s.roles.contains(&"qa".to_string())));
        let got = import_skill(&base, Some(base.to_str().unwrap()), &project, "bug-report").unwrap();
        assert_eq!(got.name, "bug-report");
        assert!(project_skills_dir(&project).join("bug-report").join("SKILL.md").is_file());
        assert!(!computer_catalog(&base, Some(base.to_str().unwrap()), &project).iter().any(|s| s.name == "bug-report"), "once in the project it is not offered again");
    }

    #[test]
    fn the_owner_can_create_read_change_and_remove_a_skill() {
        let p = temp("crud");
        let text = "---\nname: my-check\ndescription: Use when checking the thing.\n---\n\nLook at it twice.\n";
        let made = write_skill(&p, "my-check", text, true).unwrap();
        assert_eq!(made.description, "Use when checking the thing.");
        assert!(write_skill(&p, "my-check", text, true).is_err(), "not twice");
        assert_eq!(read_skill(&p, "my-check").unwrap(), text);
        let changed = text.replace("twice", "three times");
        write_skill(&p, "my-check", &changed, false).unwrap();
        assert!(read_skill(&p, "my-check").unwrap().contains("three times"));
        assert!(write_skill(&p, "other", &changed, false).is_err(), "cannot change what is not there");
        for (name, bad) in [("my-check", "no front matter at all"), ("my-check", "---\nname: wrong\ndescription: x\n---\nbody"), ("my-check", "---\nname: my-check\n---\nbody"), ("my-check", "---\nname: my-check\ndescription: x\n---\n"), ("../x", text)] {
            assert!(write_skill(&p, name, bad, false).is_err(), "{bad:?} is refused");
        }
        // a person who had it loses it from the list and the notes, and nothing else changes
        let mut notes = HashMap::new();
        notes.insert("my-check".to_string(), "when in doubt".to_string());
        save_kit(&p, "qa", RoleKit { skills: vec!["my-check".into()], notes, tools_add: vec!["node".into()], ..Default::default() }).unwrap();
        delete_skill(&p, "my-check").unwrap();
        assert!(!project_skills_dir(&p).join("my-check").exists());
        let kits = load_kits(&p);
        assert!(kits["qa"].skills.is_empty() && kits["qa"].notes.is_empty() && kits["qa"].tools_add == vec!["node".to_string()]);
        assert!(delete_skill(&p, "my-check").is_err());
    }

    #[test]
    fn a_new_project_starts_with_the_skills_and_the_tree_and_an_old_one_is_left_alone() {
        let p = temp("seed-new");
        seed_new_project(&p).unwrap();
        let kits = load_kits(&p);
        assert_eq!(kits.len(), crate::roles::starting_roles().len(), "everybody has their tree");
        assert_eq!(catalog(&p).len(), builtin_names().len());
        assert_eq!(kits["devops"].branches[0].name, "Shipping");
        assert!(kits["devops"].branches[0].skills.contains(&"release-checklist".to_string()));
        // all the files of a skill arrive, not only SKILL.md, and they reach the session's folder
        assert!(project_skills_dir(&p).join("find-root-cause").join("references").join("ways-to-look.md").is_file());
        assert!(catalog(&p).iter().find(|s| s.name == "find-root-cause").unwrap().files >= 2);
        let role = crate::roles::starting_roles().into_iter().find(|r| r.id == "devops").unwrap();
        let session = kit_for(&role, None, &p).unwrap();
        assert!(session.plugin_dir.unwrap().join("skills").join("incident-response").join("templates").join("update-and-review.md").is_file());
        assert!(crate::session::skill_notes(&Kit { notes: session.notes, branches: session.branches, ..Default::default() }).unwrap().contains("Branch \"Something is down\""));

        // a folder that was a project before keeps what it had, even an empty choice
        let old = temp("seed-old");
        save_kit(&old, "qa", RoleKit { tools_add: vec!["node".into()], ..Default::default() }).unwrap();
        seed_new_project(&old).unwrap();
        assert_eq!(load_kits(&old).len(), 1);
        assert!(catalog(&old).is_empty());
        // a skill of the owner with the same name is never overwritten
        let own = temp("seed-own");
        skill(&project_skills_dir(&own), "bug-report", "Mine.");
        seed_new_project(&own).unwrap();
        assert_eq!(catalog(&own).iter().find(|s| s.name == "bug-report").unwrap().description, "Mine.");
    }

    #[test]
    fn a_skill_is_a_folder_the_editor_can_make_change_and_empty_safely() {
        let p = temp("folder");
        let text = "---\nname: my-check\ndescription: Use when checking.\n---\n\nFill in `templates/form.md`.\n";
        let w = |path: &str, text: &str| FileWrite { path: path.into(), text: text.into() };
        // made in one go, with its files, and they reach the session
        let info = save_skill_folder(&p, "my-check", text, true, &[w("templates/form.md", "# Form"), w("references/list.md", "# List")], &[]).unwrap();
        assert_eq!(info.files, 3);
        let dir = project_skills_dir(&p).join("my-check");
        let got = read_skill_files(&p, "my-check").unwrap();
        assert_eq!(got.iter().map(|f| f.path.as_str()).collect::<Vec<_>>(), vec!["references/list.md", "templates/form.md"]);
        assert_eq!(got[0].text.as_deref(), Some("# List"));
        save_kit(&p, "qa", RoleKit { skills: vec!["my-check".into()], ..Default::default() }).unwrap();
        let role = crate::roles::starting_roles().into_iter().find(|r| r.id == "qa").unwrap();
        assert!(kit_for(&role, None, &p).unwrap().plugin_dir.unwrap().join("skills/my-check/templates/form.md").is_file());
        // changed: one rewritten, one removed with its now empty folder, one renamed
        save_skill_folder(&p, "my-check", text, false, &[w("templates/form.md", "# New"), w("examples/good.md", "# Good")], &["references/list.md".to_string()]).unwrap();
        assert_eq!(fs::read_to_string(dir.join("templates/form.md")).unwrap(), "# New");
        assert!(!dir.join("references").exists());
        assert!(dir.join("examples/good.md").is_file());
        // a picture is listed but not offered as text
        fs::write(dir.join("logo.png"), [0xffu8, 0xd8, 0xff, 0xfe]).unwrap();
        assert!(read_skill_files(&p, "my-check").unwrap().iter().find(|f| f.path == "logo.png").unwrap().text.is_none());
        // nothing typed on a screen gets out of the folder, and a refused save touches nothing
        let outside = project_skills_dir(&p).join("other.md");
        fs::write(&outside, "keep").unwrap();
        for bad in ["../other.md", "../../role-kits.json", "a/../../x", "/abs.md", "C:/x.md", "a\\b.md", ".hidden", "SKILL.md", "skill.md", "con.md", "a/b/c/d/e.md", "", "name."] {
            assert!(save_skill_folder(&p, "my-check", text, false, &[w(bad, "x")], &[]).is_err(), "write {bad:?}");
            assert!(save_skill_folder(&p, "my-check", text, false, &[], &[bad.to_string()]).is_err(), "delete {bad:?}");
        }
        assert_eq!(fs::read_to_string(&outside).unwrap(), "keep");
        assert!(save_skill_folder(&p, "my-check", "not a skill", false, &[w("x.md", "y")], &[]).is_err());
        assert!(!dir.join("x.md").exists(), "a bad SKILL.md stops the whole save");
        assert!(save_skill_folder(&p, "my-check", text, true, &[], &[]).is_err(), "a new skill cannot take a name in use");
        assert!(save_skill_folder(&p, "my-check", text, false, &[w("big.md", &"x".repeat(100 * 1024 + 1))], &[]).is_err());
    }

    #[test]
    fn an_update_reaches_only_copies_nobody_changed() {
        let p = temp("refresh");
        add_builtins(&p, &["bug-report".to_string(), "test-plan".to_string(), "plain-words".to_string()]).unwrap();
        let file = |n: &str| project_skills_dir(&p).join(n).join("SKILL.md");
        assert_eq!(folder_hash(&project_skills_dir(&p).join("bug-report")).unwrap(), shipped_hash("bug-report"), "written bytes match what ships");
        // pretend the copies came from an older Kona: the stamp and the files agree with each other but not with this version
        let older = |n: &str| { fs::write(file(n), "---\nname: x\ndescription: old\n---\nold\n").unwrap(); folder_hash(&project_skills_dir(&p).join(n)).unwrap() };
        let mut stamps = load_stamps(&p);
        stamps.insert("bug-report".into(), older("bug-report"));
        // the owner changed this one after Kona wrote it: the stamp no longer matches the file
        stamps.insert("test-plan".into(), older("test-plan"));
        fs::write(file("test-plan"), "---\nname: test-plan\ndescription: mine\n---\nmine\n").unwrap();
        // and deleted this one
        stamps.insert("plain-words".into(), "0123".into());
        fs::remove_dir_all(project_skills_dir(&p).join("plain-words")).unwrap();
        save_stamps(&p, &stamps).unwrap();
        refresh_builtins(&p);
        assert_eq!(folder_hash(&project_skills_dir(&p).join("bug-report")).unwrap(), shipped_hash("bug-report"), "an untouched copy is brought up to date");
        assert!(fs::read_to_string(file("test-plan")).unwrap().contains("mine"), "the owner's change stays");
        assert!(!project_skills_dir(&p).join("plain-words").exists(), "what the owner deleted does not come back");
        // and a skill changed through Kona's own editor counts as the owner's
        write_skill(&p, "bug-report", "---\nname: bug-report\ndescription: Mine now.\n---\nMy way.\n", false).unwrap();
        let mut stamps = load_stamps(&p);
        stamps.insert("bug-report".into(), "older".into());
        save_stamps(&p, &stamps).unwrap();
        refresh_builtins(&p);
        assert!(fs::read_to_string(file("bug-report")).unwrap().contains("My way."));
    }

    #[test]
    fn the_starting_tree_joins_what_a_person_already_has() {
        let p = temp("apply");
        skill(&project_skills_dir(&p), "my-own", "Mine.");
        let mut notes = HashMap::new();
        notes.insert("my-own".to_string(), "my note".to_string());
        notes.insert("bug-report".to_string(), "my line".to_string());
        skill(&project_skills_dir(&p), "bug-report", "My bug report.");
        save_kit(&p, "qa", RoleKit { skills: vec!["my-own".into(), "bug-report".into()], notes, branches: vec![Branch { name: "Mine".into(), when: "x".into(), skills: vec!["my-own".into(), "bug-report".into()] }, Branch { name: "planning".into(), when: "my when".into(), skills: vec![] }], ..Default::default() }).unwrap();
        let kit = apply_default_tree(&p, "qa").unwrap();
        assert!(kit.skills.contains(&"my-own".to_string()) && kit.skills.contains(&"test-plan".to_string()));
        assert_eq!(kit.notes["bug-report"], "my line", "the owner's line stays");
        assert_eq!(kit.notes["test-plan"], "What to test and what to leave");
        assert_eq!(kit.branches[0].skills, vec!["my-own".to_string(), "bug-report".to_string()], "what the owner placed stays where it is");
        let planning = kit.branches.iter().find(|b| b.name == "planning").unwrap();
        assert_eq!((planning.when.as_str(), planning.skills.clone()), ("my when", vec!["test-plan".to_string()]), "a branch of the same name is joined");
        assert_eq!(kit.branches.iter().find(|b| b.name == "Reporting").unwrap().skills, vec!["find-root-cause".to_string(), "review-a-change".to_string()], "a skill the owner already placed is not placed twice");
        assert_eq!(catalog(&p).iter().find(|s| s.name == "bug-report").unwrap().description, "My bug report.", "the owner's skill of that name is kept");
        assert_eq!(apply_default_tree(&p, "qa").unwrap().branches.len(), kit.branches.len(), "doing it again changes nothing");
        assert!(apply_default_tree(&p, "nobody").is_err());
    }

    #[test]
    fn branches_are_cleaned_kept_and_follow_the_skills() {
        let a = temp("branches-a");
        let b = |name: &str, when: &str, skills: &[&str]| Branch { name: name.into(), when: when.into(), skills: skills.iter().map(|s| s.to_string()).collect() };
        let kit = |branches: Vec<Branch>| RoleKit { skills: vec!["one".into(), "two".into()], branches, ..Default::default() };
        // a skill the person lacks is dropped from a branch, and a skill sits under one branch only (the first)
        let saved = save_kit(&a, "qa", kit(vec![b("  Ship   it ", " when   releasing ", &["one", "ghost"]), b("Check", "", &["one", "two"])])).unwrap();
        assert_eq!(saved.branches, vec![b("Ship it", "when releasing", &["one"]), b("Check", "", &["two"])]);
        assert_eq!(load_kits(&a)["qa"].branches, saved.branches, "kept in the project");
        // refused: no name, a name twice (any case), too many, too long
        assert!(save_kit(&a, "qa", kit(vec![b("  ", "", &[])])).is_err());
        assert!(save_kit(&a, "qa", kit(vec![b("Ship", "", &[]), b("ship", "", &[])])).is_err());
        assert!(save_kit(&a, "qa", kit((0..13).map(|i| b(&format!("b{i}"), "", &[])).collect())).is_err());
        assert!(save_kit(&a, "qa", kit(vec![b(&"n".repeat(41), "", &[])])).is_err());
        assert!(save_kit(&a, "qa", kit(vec![b("Ship", &"w".repeat(201), &[])])).is_err());
        // a person with only an empty branch is kept; deleting a skill takes it out of its branch and leaves the branch
        skill(&project_skills_dir(&a), "two", "Second.");
        delete_skill(&a, "two").unwrap();
        assert_eq!(load_kits(&a)["qa"].branches, vec![b("Ship it", "when releasing", &["one"]), b("Check", "", &[])]);
        let only = save_kit(&a, "ops", RoleKit { branches: vec![b("Alone", "", &[])], ..Default::default() }).unwrap();
        assert_eq!(only.branches.len(), 1);
        assert!(load_kits(&a).contains_key("ops"));
    }

    #[test]
    fn a_note_is_kept_for_a_skill_the_person_has_cleaned_to_one_line_and_reaches_the_session_kit() {
        let (a, base) = (temp("notes-a"), temp("notes-base"));
        skill(&project_skills_dir(&a), "brainstorming", "Explore ideas.");
        let mut notes = HashMap::new();
        notes.insert("brainstorming".to_string(), "  Use it when
 the idea is   vague.  ".to_string());
        notes.insert("not-theirs".to_string(), "A note for a skill they do not have.".to_string());
        let saved = save_kit(&a, "product", RoleKit { skills: vec!["brainstorming".into()], mcp: vec![], notes, ..Default::default() }).unwrap();
        assert_eq!(saved.notes.len(), 1, "a note for a skill the person does not have is dropped");
        assert_eq!(saved.notes["brainstorming"], "Use it when the idea is vague.");
        let mut long = HashMap::new();
        long.insert("brainstorming".to_string(), "x".repeat(301));
        assert!(save_kit(&a, "product", RoleKit { skills: vec!["brainstorming".into()], mcp: vec![], notes: long, ..Default::default() }).is_err(), "a note of more than 300 letters is refused");
        let role = crate::roles::starting_roles().into_iter().find(|r| r.id == "product").unwrap();
        let kit = kit_for(&role, None, &a).unwrap();
        assert_eq!(kit.notes, vec![("brainstorming".to_string(), "Use it when the idea is vague.".to_string())]);
        let _ = base;
    }

    #[test]
    fn each_project_keeps_its_own_choice_per_role() {
        let (a, b) = (temp("kit-a"), temp("kit-b"));
        save_kit(&a, "qa", RoleKit { skills: vec!["bug-report".into(), "bug-report".into()], mcp: vec![], ..Default::default() }).unwrap();
        assert_eq!(load_kits(&a)["qa"].skills, vec!["bug-report"]); // listed once
        assert!(load_kits(&b).is_empty());
        assert!(save_kit(&a, "qa", RoleKit { skills: vec!["../x".into()], mcp: vec![], ..Default::default() }).is_err());
        // tools: only ones of the fixed list; adding a hidden tool takes it off the hidden list; a kit with only tool choices is kept
        assert!(save_kit(&a, "qa", RoleKit { tools_add: vec!["rm -rf".into()], ..Default::default() }).is_err(), "a name that is not on the list of tools is refused");
        let tools = save_kit(&a, "qa", RoleKit { tools_add: vec!["node".into(), "node".into()], tools_skip: vec!["node".into(), "docker".into()], ..Default::default() }).unwrap();
        assert_eq!(tools.tools_add, vec!["node".to_string()]);
        assert_eq!(tools.tools_skip, vec!["docker".to_string()]);
        assert_eq!(load_kits(&a).get("qa").map(|k| k.tools_skip.clone()), Some(vec!["docker".to_string()]), "kept in the project");
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
        save_kit(&project, &role.id, RoleKit { skills: vec!["e2e-skill".into()], mcp: vec![], ..Default::default() }).unwrap();
        let kit = kit_for(&role, None, &project).unwrap();
        println!("PLUGIN {}", kit.plugin_dir.unwrap().display());
    }
}
