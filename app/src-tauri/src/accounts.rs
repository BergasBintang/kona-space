// Accounts: which Claude login a session uses (decision 10, feature F6).
// Each account is a folder that Claude Code owns (its login lives in there), chosen per session through the
// CLAUDE_CONFIG_DIR setting. The account "Main" has no folder of its own: it is the PC's usual login. Kona never reads
// or keeps a token; it only asks `claude auth status` whether a folder is signed in, and shows the answer.
// The list lives in %APPDATA%\Kona\accounts.json (names and folder paths only).
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const MAIN: &str = "main";

#[derive(Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: String,
    pub label: String,
    /// None for Main: Claude Code's own usual folder
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
}

fn main_account() -> Account {
    Account { id: MAIN.into(), label: "Main".into(), config_dir: None }
}

impl Accounts {
    pub fn load(base: &Path) -> Self {
        let file = base.join("accounts.json");
        let mut list = fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str::<FileData>(&t).ok()).map(|d| d.accounts).unwrap_or_default();
        let fresh = !list.iter().any(|a| a.id == MAIN);
        if fresh {
            list.insert(0, main_account());
        }
        let me = Self { base: base.to_path_buf(), file, list: Mutex::new(list.clone()) };
        if fresh {
            let _ = me.save(&list);
        }
        me
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

    /// Forget an account. Its folder (and the login inside it) is left where it is. Main cannot be removed.
    pub fn remove(&self, id: &str) -> Result<(), String> {
        if id == MAIN {
            return Err("Main is the PC's own login and cannot be removed".into());
        }
        let mut list = self.list.lock().unwrap();
        list.retain(|a| a.id != id);
        self.save(&list)
    }
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
