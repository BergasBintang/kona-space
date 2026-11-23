// A folder for a test that is removed when the value is dropped, so a test leaves nothing in the temp folder, also when it fails. Keep it in a named binding (`let _clean = ...`): a bare `_` drops it at once.
use std::path::PathBuf;

pub struct Clean(pub PathBuf);

impl Drop for Clean {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
