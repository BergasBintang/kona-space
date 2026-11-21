// One project is open in one Kona window at a time. Two windows on the same project could start the same person twice, and each window keeps its own list of what is running, so the second
// window could not even see what the first was doing. A window "claims" a project when it opens it: a tiny file `locks/<project id>.lock` in Kona's data folder that holds the window's
// process number. Another window that wants the same project is refused with a plain line. The claim ends when the window goes back to the welcome page or closes. A window that was killed
// leaves its file behind: it is recognised as dead (no such Kona program runs under that number any more) and the project can be opened again, so nobody is ever locked out.
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Locks {
    dir: PathBuf,
    /// the project this window has claimed (a window has one project open at a time)
    mine: Mutex<Option<String>>,
}

const TAKEN: &str = "That project is open in another Kona window. Go back to the welcome page in that window (or close it), then open it here.";

/// Only the ids Kona makes (letters, digits, dashes) are file names.
fn clean(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Is a Kona program running under this process number? (The number alone could have been given to another program since.)
fn kona_alive(pid: u32) -> bool {
    let me = std::env::current_exe().ok().and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase()));
    crate::winproc::snapshot().iter().any(|r| r.pid == pid && Some(r.name.to_lowercase()) == me)
}

impl Locks {
    pub fn new(base: &std::path::Path) -> Self {
        let dir = base.join("locks");
        let _ = fs::create_dir_all(&dir);
        Self { dir, mine: Mutex::new(None) }
    }

    fn path(&self, id: &str) -> Result<PathBuf, String> {
        if !clean(id) { return Err("That is not a project".into()); }
        Ok(self.dir.join(format!("{id}.lock")))
    }

    fn owner(path: &std::path::Path) -> Option<u32> {
        fs::read_to_string(path).ok().and_then(|t| t.trim().parse().ok())
    }

    /// Claim a project for this window. Fails when another running Kona window has it. A window that claims another project lets go of the first.
    pub fn claim(&self, id: &str) -> Result<(), String> {
        self.claim_with(id, &kona_alive)
    }

    fn claim_with(&self, id: &str, alive: &dyn Fn(u32) -> bool) -> Result<(), String> {
        let path = self.path(id)?;
        let me = std::process::id();
        if self.mine.lock().unwrap().as_deref() == Some(id) { return Ok(()); }
        // the file is written whole under another name and then linked into place, so another window never reads a half-made claim, and only one of two that ask at once wins
        let tmp = self.dir.join(format!("{id}.{me}.tmp"));
        fs::write(&tmp, me.to_string()).map_err(|e| e.to_string())?;
        let mut won = false;
        for _ in 0..2 {
            if fs::hard_link(&tmp, &path).is_ok() { won = true; break; }
            match Self::owner(&path) {
                Some(pid) if pid != me && alive(pid) => { let _ = fs::remove_file(&tmp); return Err(TAKEN.into()); }
                _ => { let _ = fs::remove_file(&path); } // a dead window's claim, or an unreadable one
            }
        }
        let _ = fs::remove_file(&tmp);
        if !won { return Err("Kona could not claim the project. Try again.".into()); }
        let before = self.mine.lock().unwrap().replace(id.to_string());
        if let Some(old) = before { if old != id { self.drop_file(&old); } }
        Ok(())
    }

    fn drop_file(&self, id: &str) {
        if let Ok(p) = self.path(id) && Self::owner(&p) == Some(std::process::id()) { let _ = fs::remove_file(p); }
    }

    /// Let go of the project this window has claimed (back to the welcome page, or closing).
    pub fn release(&self) {
        let old = self.mine.lock().unwrap().take();
        if let Some(id) = old { self.drop_file(&id); }
    }

    /// The projects that another running Kona window has open, for the welcome page.
    pub fn taken(&self) -> Vec<String> {
        self.taken_with(&kona_alive)
    }

    fn taken_with(&self, alive: &dyn Fn(u32) -> bool) -> Vec<String> {
        let me = std::process::id();
        let Ok(rd) = fs::read_dir(&self.dir) else { return vec![] };
        rd.filter_map(Result::ok)
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                let id = name.strip_suffix(".lock")?.to_string();
                let pid = Self::owner(&e.path())?;
                if pid != me && alive(pid) { Some(id) } else { None }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("kona-lock-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn a_project_is_open_in_one_window_and_a_dead_windows_claim_does_not_lock_anybody_out() {
        let base = temp("a");
        let locks = Locks::new(&base);
        // another running window holds p1 (pretend process number 4)
        fs::write(base.join("locks").join("p1.lock"), "4").unwrap();
        let alive = |pid: u32| pid == 4;
        assert!(locks.claim_with("p1", &alive).is_err(), "taken by a running window");
        assert_eq!(locks.taken_with(&alive), vec!["p1".to_string()]);
        // that window died: its claim is replaced
        let dead = |_: u32| false;
        assert!(locks.claim_with("p1", &dead).is_ok());
        assert!(locks.taken_with(&alive).is_empty(), "our own claim is not 'taken'");
        // claiming another project lets go of the first; releasing removes the file
        assert!(locks.claim_with("p2", &dead).is_ok());
        assert!(!base.join("locks").join("p1.lock").exists());
        assert!(base.join("locks").join("p2.lock").exists());
        locks.release();
        assert!(!base.join("locks").join("p2.lock").exists());
        // a name that is not an id is refused
        assert!(locks.claim_with("../x", &dead).is_err());
        let _ = fs::remove_dir_all(&base);
    }
}
