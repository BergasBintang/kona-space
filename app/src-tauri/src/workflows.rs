// Workflows: the usual steps of one kind of work (a feature, a fix, a launch), each step owned by a role, drawn as a flowchart on the Workflows
// screen. One plain file per workflow in the project, `.kona/workflows/<id>.json`, so the owner can read, edit, back up and search it without Kona.
// Two links to the rest of Kona, kept thin on purpose:
//   - the Brain: saving a workflow also writes one note, `.kona/brain/workflow-<id>.md`, with the steps in words, so asking the Brain finds it;
//   - the Board: a workflow never holds state. "Start" raises one ticket per step, and a step that comes after another becomes a ticket that is
//     `blocked_by` the first ticket. The Board stays the one place that shows where each piece of work stands.
// A step may only come after steps listed before it, so a workflow can never loop.
use crate::tickets::{self, NewTicket, Ticket};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_STEPS: usize = 20;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Step {
    pub id: String,
    pub title: String,
    /// a role id
    pub role: String,
    /// the steps that must be done first (ids of steps listed before this one)
    #[serde(default)]
    pub after: Vec<String>,
    #[serde(default)]
    pub note: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub about: String,
    pub steps: Vec<Step>,
    /// true for a suggestion that is not saved in the project yet
    #[serde(default)]
    pub starter: bool,
}

pub fn dir(project: &Path) -> PathBuf {
    project.join(".kona").join("workflows")
}

fn valid_id(id: &str) -> bool {
    let b = id.as_bytes();
    !b.is_empty() && b.len() <= 40 && (b[0].is_ascii_lowercase() || b[0].is_ascii_digit()) && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
}

fn one_line(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn step(id: &str, role: &str, title: &str, after: &[&str]) -> Step {
    Step { id: id.into(), title: title.into(), role: role.into(), after: after.iter().map(|s| s.to_string()).collect(), note: String::new() }
}

/// The suggestions a project starts with, until the owner saves their own.
pub fn starters() -> Vec<Workflow> {
    vec![
        Workflow {
            id: "new-feature".into(), name: "New feature".into(), about: "From an idea to a shipped feature.".into(), starter: true,
            steps: vec![
                step("brief", "product", "Write the brief", &[]),
                step("design", "design", "Design the screens", &["brief"]),
                step("api", "backend", "Build the back end", &["brief"]),
                step("screens", "frontend", "Build the screens", &["design"]),
                step("test", "qa", "Test it", &["screens", "api"]),
                step("security", "security", "Check it for holes", &["api"]),
                step("ship", "devops", "Ship it", &["test", "security"]),
            ],
        },
        Workflow {
            id: "bug-fix".into(), name: "Bug fix".into(), about: "From a report to a shipped fix.".into(), starter: true,
            steps: vec![
                step("report", "support", "Write down the problem", &[]),
                step("repro", "qa", "Make it happen again", &["report"]),
                step("fix", "backend", "Fix it", &["repro"]),
                step("check", "qa", "Check the fix", &["fix"]),
                step("ship", "devops", "Ship the fix", &["check"]),
            ],
        },
        Workflow {
            id: "launch".into(), name: "Launch".into(), about: "Telling people about something new.".into(), starter: true,
            steps: vec![
                step("message", "product", "Decide the message", &[]),
                step("copy", "content", "Write the words", &["message"]),
                step("pictures", "design", "Make the pictures", &["message"]),
                step("answers", "support", "Prepare the answers", &["copy"]),
                step("plan", "marketing", "Plan the campaign", &["copy", "pictures"]),
                step("go", "marketing", "Launch", &["plan", "answers"]),
            ],
        },
    ]
}

/// Check a workflow before it is saved or started. Steps may only come after steps listed before them.
pub fn validate(w: &Workflow) -> Result<(), String> {
    if !valid_id(&w.id) {
        return Err("A workflow's short name may only use small letters, digits and dashes".into());
    }
    let name = one_line(&w.name);
    if name.is_empty() || name.chars().count() > 60 {
        return Err("A workflow needs a name of up to 60 characters".into());
    }
    if w.about.chars().count() > 300 {
        return Err("The description is too long (more than 300 characters)".into());
    }
    if w.steps.is_empty() {
        return Err("A workflow needs at least one step".into());
    }
    if w.steps.len() > MAX_STEPS {
        return Err(format!("A workflow can have up to {MAX_STEPS} steps"));
    }
    let mut seen: Vec<&str> = vec![];
    for s in &w.steps {
        if !valid_id(&s.id) || seen.contains(&s.id.as_str()) {
            return Err("Every step needs its own short name".into());
        }
        let title = one_line(&s.title);
        if title.is_empty() || title.chars().count() > 80 {
            return Err("Every step needs a title of up to 80 characters".into());
        }
        if !valid_id(&s.role) {
            return Err(format!("The step \"{title}\" has no role"));
        }
        if s.note.chars().count() > 500 {
            return Err(format!("The note of \"{title}\" is too long (more than 500 characters)"));
        }
        for a in &s.after {
            if !seen.contains(&a.as_str()) {
                return Err(format!("The step \"{title}\" can only come after a step listed before it"));
            }
        }
        seen.push(&s.id);
    }
    Ok(())
}

fn path_of(project: &Path, id: &str) -> PathBuf {
    dir(project).join(format!("{id}.json"))
}

fn note_path(project: &Path, id: &str) -> PathBuf {
    crate::brain::dir(project).join(format!("workflow-{id}.md"))
}

/// The steps in words, for the Brain.
fn note_text(w: &Workflow) -> String {
    let title_of = |id: &str| w.steps.iter().find(|s| s.id == id).map(|s| s.title.clone()).unwrap_or_default();
    let mut s = format!("# Workflow: {}\n\n", one_line(&w.name));
    if !w.about.trim().is_empty() {
        s.push_str(&format!("{}\n\n", one_line(&w.about)));
    }
    s.push_str("Written by Kona from the Workflows screen. Change it there, not here.\n\nSteps, in order:\n\n");
    for (n, st) in w.steps.iter().enumerate() {
        s.push_str(&format!("{}. **{}** ({})", n + 1, one_line(&st.title), st.role));
        if !st.after.is_empty() {
            s.push_str(&format!(", after {}", st.after.iter().map(|a| title_of(a)).collect::<Vec<_>>().join(" and ")));
        }
        s.push('\n');
        if !st.note.trim().is_empty() {
            s.push_str(&format!("   {}\n", one_line(&st.note)));
        }
    }
    s
}

fn write_atomic(path: &Path, text: &str) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, text).map_err(|e| format!("Could not save the workflow: {e}"))?;
    fs::rename(&tmp, path).map_err(|e| format!("Could not save the workflow: {e}"))
}

/// The workflows of a project: the saved ones, then the starters that were not saved over.
pub fn list(project: &Path) -> Vec<Workflow> {
    let mut saved: Vec<Workflow> = fs::read_dir(dir(project))
        .map(|rd| {
            rd.filter_map(Result::ok)
                .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json"))
                .filter_map(|e| fs::read_to_string(e.path()).ok())
                .filter_map(|t| serde_json::from_str::<Workflow>(&t).ok())
                .filter(|w| validate(w).is_ok())
                .map(|w| Workflow { starter: false, ..w })
                .collect()
        })
        .unwrap_or_default();
    saved.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    let mut out = saved.clone();
    out.extend(starters().into_iter().filter(|s| !saved.iter().any(|w| w.id == s.id)));
    out
}

pub fn save(project: &Path, w: Workflow) -> Result<Workflow, String> {
    validate(&w)?;
    let w = Workflow { name: one_line(&w.name), starter: false, ..w };
    fs::create_dir_all(dir(project)).map_err(|e| format!("Could not make the workflows folder: {e}"))?;
    write_atomic(&path_of(project, &w.id), &serde_json::to_string_pretty(&w).map_err(|e| e.to_string())?)?;
    fs::create_dir_all(crate::brain::dir(project)).map_err(|e| format!("Could not make the brain folder: {e}"))?;
    write_atomic(&note_path(project, &w.id), &note_text(&w))?;
    Ok(w)
}

pub fn delete(project: &Path, id: &str) -> Result<(), String> {
    if !valid_id(id) {
        return Err("That is not a workflow".into());
    }
    let _ = fs::remove_file(path_of(project, id));
    let _ = fs::remove_file(note_path(project, id));
    Ok(())
}

/// Raise the Board tickets of a workflow: one per step, in order. A step with nothing before it is Ready; the others wait in Backlog, blocked by
/// the tickets of the steps before them.
pub fn start(project: &Path, w: Workflow, who: &str) -> Result<Vec<Ticket>, String> {
    validate(&w)?;
    let dir = tickets::dir(project);
    let name = one_line(&w.name);
    let mut made: Vec<(String, Ticket)> = vec![];
    for s in &w.steps {
        let blocked_by: Vec<String> = s.after.iter().filter_map(|a| made.iter().find(|(id, _)| id == a).map(|(_, t)| t.id.clone())).collect();
        let mut title = format!("{name}: {}", one_line(&s.title));
        if title.chars().count() > 140 {
            title = title.chars().take(140).collect();
        }
        let mut description = format!("Step \"{}\" of the workflow \"{name}\".", one_line(&s.title));
        if !s.note.trim().is_empty() {
            description.push_str(&format!("\n\n{}", s.note.trim()));
        }
        let t = tickets::create(
            &dir,
            NewTicket {
                title, description, role: Some(s.role.clone()), status: Some(if blocked_by.is_empty() { "ready".into() } else { "backlog".into() }),
                blocked_by, workflow: w.id.clone(), ..Default::default()
            },
            who,
        )?;
        made.push((s.id.clone(), t));
    }
    Ok(made.into_iter().map(|(_, t)| t).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("kona-wf-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn the_starters_are_valid() {
        for w in starters() {
            validate(&w).unwrap_or_else(|e| panic!("{}: {e}", w.id));
        }
    }

    #[test]
    fn a_step_cannot_come_after_a_later_step_or_itself() {
        let mut w = starters().remove(0);
        w.steps[0].after = vec!["design".into()];
        assert!(validate(&w).is_err());
        let mut w = starters().remove(0);
        w.steps[1].after = vec!["design".into()];
        assert!(validate(&w).is_err());
    }

    #[test]
    fn saving_writes_the_file_and_a_brain_note_and_lists_it_over_the_starter() {
        let p = temp("save");
        assert_eq!(list(&p).len(), 3); // only starters
        let mut w = starters().remove(0);
        w.name = "Feature, my way".into();
        save(&p, w).unwrap();
        let all = list(&p);
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].name, "Feature, my way");
        assert!(!all[0].starter && all[1].starter);
        let note = fs::read_to_string(note_path(&p, "new-feature")).unwrap();
        assert!(note.starts_with("# Workflow: Feature, my way") && note.contains("**Ship it** (devops), after Test it and Check it for holes"));
        delete(&p, "new-feature").unwrap();
        assert!(!note_path(&p, "new-feature").exists() && list(&p)[0].starter);
        let _ = fs::remove_dir_all(&p);
    }

    #[test]
    fn starting_raises_one_ticket_per_step_and_blocks_the_ones_that_wait() {
        let p = temp("start");
        let made = start(&p, starters().remove(0), "the owner").unwrap();
        assert_eq!(made.len(), 7);
        assert_eq!(made[0].status, "ready");
        assert!(made[0].blocked_by.is_empty());
        assert_eq!(made[1].status, "backlog");
        assert_eq!(made[1].blocked_by, vec![made[0].id.clone()]);
        let ship = &made[6];
        assert_eq!(ship.blocked_by, vec![made[4].id.clone(), made[5].id.clone()]);
        assert_eq!(ship.workflow, "new-feature");
        let _ = fs::remove_dir_all(&p);
    }
}
