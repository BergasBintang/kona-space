// Before building: list every file under `skills/<name>/` into a table that goes inside the program (skills.rs), so every download has the skills that come with Kona, whole,
// with their templates and references, and adding a file to a skill needs no change anywhere else.
use std::{env, fs, path::Path};

fn walk(dir: &Path, rel: &str, out: &mut Vec<(String, String)>) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for e in rd.filter_map(Result::ok) {
        let name = e.file_name().to_string_lossy().to_string();
        let inside = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        if e.path().is_dir() { walk(&e.path(), &inside, out); }
        else { out.push((inside, e.path().to_string_lossy().to_string())); }
    }
}

fn main() {
    println!("cargo:rerun-if-changed=skills");
    let root = Path::new(&env::var("CARGO_MANIFEST_DIR").unwrap()).join("skills");
    let mut rows: Vec<(String, String, String)> = Vec::new();
    for e in fs::read_dir(&root).expect("the skills folder").filter_map(Result::ok) {
        if !e.path().is_dir() { continue; }
        let skill = e.file_name().to_string_lossy().to_string();
        let mut files = Vec::new();
        walk(&e.path(), "", &mut files);
        rows.extend(files.into_iter().map(|(rel, abs)| (skill.clone(), rel, abs)));
    }
    rows.sort();
    let mut table = String::from("pub const BUILTIN_FILES: &[(&str, &str, &str)] = &[\n");
    for (skill, rel, abs) in rows { table.push_str(&format!("    ({skill:?}, {rel:?}, include_str!({abs:?})),\n")); }
    table.push_str("];\n");
    fs::write(Path::new(&env::var("OUT_DIR").unwrap()).join("builtin_skills.rs"), table).unwrap();
    tauri_build::build()
}
