// Two Kona windows on one PC are two separate programs. Each keeps the lists it saves (projects, roles, accounts, settings, servers, the voice) in its own memory, so a change made in one
// window was never seen by the other, and the other could save its old copy over it. Every such list has a `Stamp`: the time its file was last changed, as this window knows it. A short
// check every second (`watch` in lib.rs) asks each list whether its file is newer than its stamp; if so the list is read again and the screen is told (the event `kona-sync`).
// A window's own saves move its stamp too, so it never answers to its own writes. The check is one `stat` call per file: it costs nothing a person could measure.
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

fn modified(p: &Path) -> Option<SystemTime> {
    std::fs::metadata(p).ok().and_then(|m| m.modified().ok())
}

pub struct Stamp {
    file: PathBuf,
    seen: Mutex<Option<SystemTime>>,
}

impl Stamp {
    /// Stamp a file as it is now (call it when the list has just been read).
    pub fn new(file: &Path) -> Self {
        Self { file: file.to_path_buf(), seen: Mutex::new(modified(file)) }
    }

    /// Was the file changed (or made, or removed) by somebody else since the last `mark`?
    pub fn changed(&self) -> bool {
        modified(&self.file) != *self.seen.lock().unwrap()
    }

    /// The list now matches the file: after reading it, and after writing it.
    pub fn mark(&self) {
        *self.seen.lock().unwrap() = modified(&self.file);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_change_by_somebody_else_is_noticed_once_and_our_own_write_is_not() {
        let dir = std::env::temp_dir().join(format!("kona-stamp-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("list.json");
        let stamp = Stamp::new(&file); // no file yet
        assert!(!stamp.changed());
        std::fs::write(&file, "one").unwrap(); // the other window makes it
        assert!(stamp.changed());
        stamp.mark();
        assert!(!stamp.changed());
        std::thread::sleep(std::time::Duration::from_millis(30));
        std::fs::write(&file, "two").unwrap(); // the other window changes it
        assert!(stamp.changed());
        stamp.mark(); // we read it
        assert!(!stamp.changed());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
