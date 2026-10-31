// The map of a project's office (decision 57): one plain JSON file, `<project>\.kona\office-map.json`, so the owner can read, back up and copy it without Kona. Kona keeps the
// text as it is and only checks that it is a JSON object of a version it knows and not huge; the screen (src/office/map.ts, `parseMap`) checks the shape. A project with no file shows the
// standard office that is built into Kona; the editor never changes that one.
use std::fs;
use std::path::{Path, PathBuf};

const MAX_BYTES: usize = 512 * 1024;

fn file(folder: &Path) -> PathBuf {
    folder.join(".kona").join("office-map.json")
}

/// The saved map of a project, or None when it has none.
pub fn load(folder: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(file(folder)) {
        Ok(t) => Ok(Some(t)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Could not read the office map: {e}")),
    }
}

/// Keep a map. It is written to a side file first and then moved into place, so a map is never left half written.
pub fn save(folder: &Path, text: &str) -> Result<(), String> {
    if text.len() > MAX_BYTES { return Err("The office map is too big".into()); }
    let v: serde_json::Value = serde_json::from_str(text).map_err(|_| "The office map is not valid JSON".to_string())?;
    if !v.is_object() || v.get("version").and_then(|x| x.as_u64()) != Some(1) { return Err("The office map is not a map of version 1".into()); }
    let path = file(folder);
    let dir = path.parent().ok_or("No folder for the office map")?;
    fs::create_dir_all(dir).map_err(|e| format!("Could not make the .kona folder: {e}"))?;
    let tmp = dir.join("office-map.json.tmp");
    fs::write(&tmp, text).map_err(|e| format!("Could not write the office map: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Could not keep the office map: {e}"))
}

/// Forget the project's own map: it shows the standard office again.
pub fn reset(folder: &Path) -> Result<(), String> {
    match fs::remove_file(file(folder)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Could not remove the office map: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("kona-office-map-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn a_project_with_no_map_has_none_and_a_saved_map_comes_back_as_it_was() {
        let d = temp("roundtrip");
        assert_eq!(load(&d).unwrap(), None);
        let text = r#"{"version":1,"cols":2,"rows":2}"#;
        save(&d, text).unwrap();
        assert_eq!(load(&d).unwrap().as_deref(), Some(text));
        assert!(!d.join(".kona").join("office-map.json.tmp").exists(), "the side file is gone");
        reset(&d).unwrap();
        assert_eq!(load(&d).unwrap(), None);
        reset(&d).unwrap(); // resetting twice is fine
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_map_that_is_not_json_or_not_version_1_or_huge_is_refused_and_the_old_one_stays() {
        let d = temp("refuse");
        save(&d, r#"{"version":1}"#).unwrap();
        assert!(save(&d, "not json").is_err());
        assert!(save(&d, r#"[1,2]"#).is_err());
        assert!(save(&d, r#"{"version":2}"#).is_err());
        assert!(save(&d, &format!(r#"{{"version":1,"x":"{}"}}"#, "a".repeat(MAX_BYTES))).is_err());
        assert_eq!(load(&d).unwrap().as_deref(), Some(r#"{"version":1}"#));
        let _ = fs::remove_dir_all(&d);
    }
}
