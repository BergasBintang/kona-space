// Accounts: which Claude login a session uses (decision 10, feature F6, and decision 87: every login is Kona's own).
// Each account is a folder that Claude Code owns inside Kona's own data (its login lives in there), chosen per session through the
// CLAUDE_CONFIG_DIR setting. No account is "the PC's usual login": signing in or out of the terminal, VS Code or another app on this PC
// never changes an account of Kona, and a login of Kona never changes theirs. Kona never reads or keeps a token; it only asks
// `claude auth status` whether a folder is signed in, and shows the answer.
// The list lives in %APPDATA%\Kona\accounts.json (names and folder paths only).
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Settings of the PC that would make `claude` use a login other than the account's folder. A session of Kona never sees them.
const PC_LOGIN_VARS: [&str; 4] = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK"];

pub fn shut_out_pc_login(cmd: &mut tokio::process::Command) {
    for v in PC_LOGIN_VARS { cmd.env_remove(v); }
}

pub fn shut_out_pc_login_std(cmd: &mut std::process::Command) {
    for v in PC_LOGIN_VARS { cmd.env_remove(v); }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: String,
    pub label: String,
    /// the login folder of the account (every account has one; an older file may hold none, see `load`)
    #[serde(default)]
    pub config_dir: Option<String>,
}

/// What `claude auth status` said. Held only while the screen is open, never saved.
#[derive(Serialize, Default)]
pub struct AccountStatus {
    pub logged_in: bool,
    pub method: Option<String>,
    pub plan: Option<String>,
    pub email: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct FileData {
    version: u32,
    accounts: Vec<Account>,
}

pub struct Accounts {
    base: PathBuf,
    file: PathBuf,
    list: Mutex<Vec<Account>>,
    /// accounts that had no folder (they followed the PC's login) and were given one by this start of Kona
    migrated: Mutex<Vec<String>>,
}

impl Accounts {
    pub fn load(base: &Path) -> Self {
        let file = base.join("accounts.json");
        let mut list = fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str::<FileData>(&t).ok()).map(|d| d.accounts).unwrap_or_default();
        // an account of an older Kona that followed the PC's own login gets a login folder of its own: empty and signed out, so it can never show a login that the terminal changed
        let mut migrated = vec![];
        for a in list.iter_mut().filter(|a| a.config_dir.is_none()) {
            let dir = base.join("accounts").join(&a.id);
            if fs::create_dir_all(&dir).is_ok() {
                a.config_dir = Some(dir.to_string_lossy().into_owned());
                migrated.push(a.id.clone());
            }
        }
        let me = Self { base: base.to_path_buf(), file, list: Mutex::new(list.clone()), migrated: Mutex::new(migrated.clone()) };
        if !migrated.is_empty() {
            let _ = me.save(&list);
        }
        me
    }

    /// The accounts that were given a folder by this start of Kona (asked once).
    pub fn take_migrated(&self) -> Vec<String> {
        std::mem::take(&mut *self.migrated.lock().unwrap())
    }

    fn save(&self, list: &[Account]) -> Result<(), String> {
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let data = FileData { version: 1, accounts: list.to_vec() };
        fs::write(&self.file, serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
    }

    pub fn all(&self) -> Vec<Account> {
        self.list.lock().unwrap().clone()
    }

    pub fn get(&self, id: &str) -> Option<Account> {
        self.list.lock().unwrap().iter().find(|a| a.id == id).cloned()
    }

    pub fn add(&self, label: &str) -> Result<Account, String> {
        let label = label.trim();
        if label.is_empty() {
            return Err("An account needs a name".into());
        }
        let mut list = self.list.lock().unwrap();
        if list.iter().any(|a| a.label.to_lowercase() == label.to_lowercase()) {
            return Err("Another account already has that name".into());
        }
        let id = uuid::Uuid::new_v4().to_string();
        let dir = self.base.join("accounts").join(&id);
        fs::create_dir_all(&dir).map_err(|e| format!("Could not make the account's folder: {e}"))?;
        let account = Account { id, label: label.to_string(), config_dir: Some(dir.to_string_lossy().into_owned()) };
        list.push(account.clone());
        self.save(&list)?;
        Ok(account)
    }

    pub fn rename(&self, id: &str, label: &str) -> Result<Account, String> {
        let label = label.trim();
        if label.is_empty() {
            return Err("An account needs a name".into());
        }
        let mut list = self.list.lock().unwrap();
        if list.iter().any(|a| a.id != id && a.label.to_lowercase() == label.to_lowercase()) {
            return Err("Another account already has that name".into());
        }
        let a = list.iter_mut().find(|a| a.id == id).ok_or("That account does not exist")?;
        a.label = label.to_string();
        let out = a.clone();
        self.save(&list)?;
        Ok(out)
    }

    /// Forget an account. Its folder (and the login inside it) is left where it is.
    pub fn remove(&self, id: &str) -> Result<(), String> {
        let mut list = self.list.lock().unwrap();
        list.retain(|a| a.id != id);
        self.save(&list)
    }
}

/// Copy the earlier conversations of some project folders from one login folder to another (a copy: the original stays). Used once, when an account
/// that followed the PC's login gets a folder of its own, so its History and Resume keep working. Returns how many files were copied.
pub fn carry_history(from_root: &Path, to_root: &Path, project_folders: &[String]) -> usize {
    let mut copied = 0;
    let Ok(rd) = fs::read_dir(from_root.join("projects")) else { return 0 };
    for e in rd.filter_map(Result::ok) {
        let name = e.file_name().to_string_lossy().to_string();
        if !project_folders.iter().any(|f| crate::summary::slug(f).to_lowercase() == name.to_lowercase()) { continue; }
        let dest = to_root.join("projects").join(&name);
        if fs::create_dir_all(&dest).is_err() { continue; }
        for f in fs::read_dir(e.path()).into_iter().flatten().filter_map(Result::ok) {
            let p = f.path();
            if p.extension().and_then(|x| x.to_str()) != Some("jsonl") { continue; }
            let target = dest.join(f.file_name());
            if !target.exists() && fs::copy(&p, &target).is_ok() { copied += 1; }
        }
    }
    copied
}

/// Ask Claude Code whether this account's folder is signed in.
pub fn status(account: &Account) -> AccountStatus {
    use std::os::windows::process::CommandExt;
    let Some(exe) = crate::session::find_claude() else { return AccountStatus::default() };
    let mut cmd = std::process::Command::new(exe);
    cmd.args(["auth", "status"]).creation_flags(0x0800_0000);
    if let Some(dir) = &account.config_dir {
        cmd.env("CLAUDE_CONFIG_DIR", dir);
    }
    shut_out_pc_login_std(&mut cmd);
    let Ok(out) = cmd.output() else { return AccountStatus::default() };
    let Ok(v) = serde_json::from_slice::<serde_json::Value>(&out.stdout) else { return AccountStatus::default() };
    let text = |k: &str| v.get(k).and_then(|x| x.as_str()).map(str::to_string);
    AccountStatus {
        logged_in: v.get("loggedIn").and_then(|x| x.as_bool()).unwrap_or(false),
        method: text("authMethod").filter(|m| m != "none"),
        plan: text("subscriptionType"),
        email: text("email"),
    }
}

/// Run `claude auth login` for this account's folder. It opens the browser and waits until the sign-in is finished.
pub async fn sign_in(account: Account) -> Result<(), String> {
    use tokio::process::Command;
    let exe = crate::session::find_claude().ok_or("Claude Code was not found on this PC")?;
    let mut cmd = Command::new(exe);
    cmd.args(["auth", "login", "--claudeai"]).kill_on_drop(true).creation_flags(0x0800_0000);
    if let Some(dir) = &account.config_dir {
        cmd.env("CLAUDE_CONFIG_DIR", dir);
    }
    shut_out_pc_login(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| format!("Could not start the sign-in: {e}"))?;
    if let Some(h) = child.raw_handle() {
        crate::job::adopt(h as _);
    }
    // ten minutes is plenty for a person to finish a sign-in page
    match tokio::time::timeout(std::time::Duration::from_secs(600), child.wait()).await {
        Ok(Ok(s)) if s.success() => Ok(()),
        Ok(Ok(_)) => Err("The sign-in did not finish".into()),
        Ok(Err(e)) => Err(e.to_string()),
        Err(_) => {
            let _ = child.kill().await;
            Err("The sign-in took too long and was stopped".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("kona-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn an_account_that_followed_the_pcs_login_gets_a_folder_of_its_own() {
        let base = scratch("accounts-migrate");
        fs::write(base.join("accounts.json"), r#"{"version":1,"accounts":[{"id":"main","label":"Quantum Research","config_dir":null},{"id":"b","label":"Miralis","config_dir":"X:/own"}]}"#).unwrap();
        let a = Accounts::load(&base);
        let main = a.get("main").unwrap();
        assert!(main.config_dir.as_deref().is_some_and(|d| d.ends_with("main") && Path::new(d).is_dir()), "main has a folder now");
        assert_eq!(a.get("b").unwrap().config_dir.as_deref(), Some("X:/own"), "an account that already had one is left alone");
        assert_eq!(a.take_migrated(), vec!["main".to_string()]);
        assert!(a.take_migrated().is_empty(), "asked once");
        // and it is written down, so the next start has nothing to do
        assert!(Accounts::load(&base).take_migrated().is_empty());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn a_fresh_install_has_no_account_until_one_is_added_and_every_account_can_be_removed() {
        let base = scratch("accounts-fresh");
        let a = Accounts::load(&base);
        assert!(a.all().is_empty());
        let x = a.add("Work").unwrap();
        assert!(x.config_dir.is_some());
        a.remove(&x.id).unwrap();
        assert!(a.all().is_empty());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn history_is_copied_for_the_projects_asked_for_and_never_overwritten() {
        let root = scratch("history");
        let (from, to) = (root.join("from"), root.join("to"));
        let proj = from.join("projects").join("C--my-app");
        fs::create_dir_all(&proj).unwrap();
        fs::write(proj.join("11111111-1111-1111-1111-111111111111.jsonl"), "one").unwrap();
        let other = from.join("projects").join("C--other");
        fs::create_dir_all(&other).unwrap();
        fs::write(other.join("22222222-2222-2222-2222-222222222222.jsonl"), "two").unwrap();
        assert_eq!(carry_history(&from, &to, &["C:\\my-app".to_string()]), 1);
        assert!(to.join("projects/C--my-app/11111111-1111-1111-1111-111111111111.jsonl").is_file());
        assert!(!to.join("projects/C--other").exists(), "another project is not copied");
        assert_eq!(carry_history(&from, &to, &["C:\\my-app".to_string()]), 0, "a second run copies nothing");
        let _ = fs::remove_dir_all(&root);
    }
}
