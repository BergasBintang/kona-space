// Runs of a workflow (decision 78 of kona-space-app.md): a workflow can run by itself. Each person works in turn and hands their written result to the next; no tickets are made.
// The screen drives the run (it starts the sessions and sees when one finishes); this module only keeps the record, one plain file per run, `.kona/runs/<id>.json`, so a run
// survives the window being reloaded, and the owner can read it without Kona. The record is the screen's own JSON, kept as it is: the core checks the name of the file, the
// size and that it is an object with an `id`, and nothing else.
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_RUNS: usize = 40;
const MAX_BYTES: usize = 1_000_000;

pub fn dir(project: &Path) -> PathBuf {
    project.join(".kona").join("runs")
}

pub fn valid_id(id: &str) -> bool {
    let b = id.as_bytes();
    !b.is_empty() && b.len() <= 60 && (b[0].is_ascii_lowercase() || b[0].is_ascii_digit()) && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
}

fn path_of(project: &Path, id: &str) -> PathBuf {
    dir(project).join(format!("{id}.json"))
}

/// The runs of a project, newest change first (at most 40).
pub fn list(project: &Path) -> Vec<Value> {
    let Ok(rd) = fs::read_dir(dir(project)) else { return Vec::new() };
    let mut found: Vec<(std::time::SystemTime, Value)> = rd
        .filter_map(Result::ok)
        .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json"))
        .filter_map(|e| {
            let stem = e.path().file_stem()?.to_str()?.to_string();
            if !valid_id(&stem) {
                return None;
            }
            let v: Value = serde_json::from_str(&fs::read_to_string(e.path()).ok()?).ok()?;
            (v.get("id").and_then(Value::as_str) == Some(stem.as_str())).then(|| (e.metadata().and_then(|m| m.modified()).unwrap_or(std::time::UNIX_EPOCH), v))
        })
        .collect();
    found.sort_by(|a, b| b.0.cmp(&a.0));
    found.into_iter().take(MAX_RUNS).map(|(_, v)| v).collect()
}

pub fn save(project: &Path, run: Value) -> Result<(), String> {
    let id = run.get("id").and_then(Value::as_str).ok_or("A run needs an id")?.to_string();
    if !valid_id(&id) {
        return Err("That is not a run".into());
    }
    let text = serde_json::to_string_pretty(&run).map_err(|e| e.to_string())?;
    if text.len() > MAX_BYTES {
        return Err("This run holds too much text to keep".into());
    }
    fs::create_dir_all(dir(project)).map_err(|e| format!("Could not make the runs folder: {e}"))?;
    let path = path_of(project, &id);
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, text).map_err(|e| format!("Could not save the run: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Could not save the run: {e}"))?;
    // only the newest runs are kept
    let mut all: Vec<(std::time::SystemTime, PathBuf)> = fs::read_dir(dir(project))
        .map(|rd| rd.filter_map(Result::ok).filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json")).map(|e| (e.metadata().and_then(|m| m.modified()).unwrap_or(std::time::UNIX_EPOCH), e.path())).collect())
        .unwrap_or_default();
    if all.len() > MAX_RUNS {
        all.sort_by(|a, b| b.0.cmp(&a.0));
        for (_, p) in all.into_iter().skip(MAX_RUNS) {
            let _ = fs::remove_file(p);
        }
    }
    Ok(())
}

pub fn delete(project: &Path, id: &str) -> Result<(), String> {
    if !valid_id(id) {
        return Err("That is not a run".into());
    }
    let _ = fs::remove_file(path_of(project, id));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn project(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("kona-runs-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn a_run_is_kept_as_one_plain_file_and_read_back_as_it_was() {
        let d = project("keep");
        let run = json!({ "id": "run-20261104-1500-ab12", "workflowId": "new-feature", "status": "running", "steps": [{ "stepId": "brief", "status": "working", "result": "line one\nline \"two\"" }] });
        save(&d, run.clone()).unwrap();
        assert!(d.join(".kona").join("runs").join("run-20261104-1500-ab12.json").is_file());
        assert_eq!(list(&d), vec![run.clone()]);
        let mut changed = run.clone();
        changed["status"] = json!("done");
        save(&d, changed.clone()).unwrap();
        assert_eq!(list(&d), vec![changed], "saving again replaces the record");
        delete(&d, "run-20261104-1500-ab12").unwrap();
        assert!(list(&d).is_empty());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_bad_id_a_missing_id_and_a_huge_record_are_refused() {
        let d = project("bad");
        for id in ["", "../x", "A", "a b", "a/b", "a\\b", ".hidden", &"x".repeat(61)] {
            assert!(save(&d, json!({ "id": id })).is_err(), "{id:?} should be refused");
            assert!(delete(&d, id).is_err(), "{id:?} should not be deletable");
        }
        assert!(save(&d, json!({ "name": "no id" })).is_err());
        assert!(save(&d, json!({ "id": 5 })).is_err());
        assert!(save(&d, json!({ "id": "big", "text": "x".repeat(MAX_BYTES + 10) })).is_err());
        assert!(!dir(&d).join("big.json").exists());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn what_is_not_a_run_file_is_left_out_and_only_the_newest_are_kept() {
        let d = project("list");
        fs::create_dir_all(dir(&d)).unwrap();
        fs::write(dir(&d).join("broken.json"), "{ not json").unwrap();
        fs::write(dir(&d).join("other-name.json"), r#"{"id":"somebody-else"}"#).unwrap();
        fs::write(dir(&d).join("notes.txt"), "x").unwrap();
        assert!(list(&d).is_empty(), "a broken file, a file whose id differs from its name and a text file are not runs");
        for i in 0..(MAX_RUNS + 5) {
            save(&d, json!({ "id": format!("run-{i:03}") })).unwrap();
        }
        let files = fs::read_dir(dir(&d)).unwrap().filter_map(Result::ok).filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json")).count();
        assert!(files <= MAX_RUNS + 2, "the oldest runs are removed ({files} files)");
        assert!(list(&d).len() <= MAX_RUNS);
        let _ = fs::remove_dir_all(&d);
    }
}
