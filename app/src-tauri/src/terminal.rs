// The built-in terminal (decision 80): a real shell in a project's folder, drawn by xterm.js in the window.
// The shell runs inside a pseudo-terminal (ConPTY on Windows). Its output goes to the window as base64 text in
// "term-data" events (a chunk can end in the middle of a letter, so the window decodes it as a stream); keys go back
// through `term_write`. The shell joins Kona's job object, so it and everything it started stop when Kona closes.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// What the shell runs at start: the short prompt and the mark Kona reads at each prompt (see the file).
const INIT: &str = include_str!("term_init.ps1");

struct Term {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct Terms(Mutex<HashMap<String, Term>>);

fn size(rows: u16, cols: u16) -> PtySize {
    PtySize { rows: rows.max(2), cols: cols.max(10), pixel_width: 0, pixel_height: 0 }
}

/// Start a shell in `folder`. `shell` is "powershell" (the default) or "cmd". Returns the terminal's id.
#[tauri::command]
pub fn term_open(app: AppHandle, terms: State<'_, Terms>, folder: String, shell: Option<String>, rows: u16, cols: u16) -> Result<String, String> {
    if !std::path::Path::new(&folder).is_dir() {
        return Err("That folder does not exist.".into());
    }
    // A program started by a tool that switched Ctrl+C off passes that on to what it starts: Kona would then give its shell a Ctrl+C that does nothing.
    unsafe { windows_sys::Win32::System::Console::SetConsoleCtrlHandler(None, 0) };
    let pair = native_pty_system().openpty(size(rows, cols)).map_err(|e| e.to_string())?;
    let mut cmd = match shell.as_deref() {
        Some("cmd") => CommandBuilder::new("cmd.exe"),
        _ => {
            let mut c = CommandBuilder::new("powershell.exe");
            c.arg("-NoLogo");
            c.arg("-NoExit");
            // the start-up script, passed encoded (UTF-16, base64) so no quote in it can be mangled on the way
            let utf16: Vec<u8> = INIT.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
            c.arg("-EncodedCommand");
            c.arg(B64.encode(utf16));
            c
        }
    };
    cmd.cwd(&folder);
    cmd.env("TERM", "xterm-256color");
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);
    if let Some(h) = child.as_raw_handle() {
        crate::job::adopt(h as _);
    }
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let (app2, id2) = (app.clone(), id.clone());
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let _ = app2.emit("term-data", json!({"id": id2, "data": B64.encode(&buf[..n])}));
                }
            }
        }
        let _ = app2.emit("term-exit", json!({"id": id2}));
    });
    terms.0.lock().unwrap().insert(id.clone(), Term { master: pair.master, writer, child });
    // The pipe stays open after the shell has ended (Windows keeps it until the pseudo-terminal is closed), so the end is found by asking the shell itself.
    let (app3, id3) = (app.clone(), id.clone());
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(400));
        let state = app3.state::<Terms>();
        let mut map = state.0.lock().unwrap();
        match map.get_mut(&id3) {
            None => break, // closed from the window
            Some(t) => {
                if matches!(t.child.try_wait(), Ok(Some(_))) {
                    drop(map);
                    // give the last output a moment to reach the window before the end is announced
                    std::thread::sleep(std::time::Duration::from_millis(300));
                    let _ = app3.emit("term-exit", json!({"id": id3}));
                    break;
                }
            }
        }
    });
    Ok(id)
}

/// Keys typed in the window (already text; the window encodes them as base64 so control keys survive the trip).
#[tauri::command]
pub fn term_write(terms: State<'_, Terms>, id: String, data: String) -> Result<(), String> {
    let bytes = B64.decode(data).map_err(|e| e.to_string())?;
    let mut map = terms.0.lock().unwrap();
    let t = map.get_mut(&id).ok_or("That terminal is closed.")?;
    t.writer.write_all(&bytes).and_then(|_| t.writer.flush()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn term_resize(terms: State<'_, Terms>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    let map = terms.0.lock().unwrap();
    let t = map.get(&id).ok_or("That terminal is closed.")?;
    t.master.resize(size(rows, cols)).map_err(|e| e.to_string())
}

/// Close one terminal: the shell is stopped.
#[tauri::command]
pub fn term_close(terms: State<'_, Terms>, id: String) -> Result<(), String> {
    if let Some(mut t) = terms.0.lock().unwrap().remove(&id) {
        let _ = t.child.kill();
    }
    Ok(())
}

/// A window that was reloaded has lost track of its shells: they are all closed, so none is left running unseen.
#[tauri::command]
pub fn term_close_all(terms: State<'_, Terms>) -> Result<(), String> {
    for (_, mut t) in terms.0.lock().unwrap().drain() {
        let _ = t.child.kill();
    }
    Ok(())
}

// ---- the owner's own script buttons of a project (shortcuts that fill the input bar; nothing runs by itself) ----
// They live in Kona's own folder, one file for all projects, never in the project's folder, and go into the backups.

#[derive(Serialize, Deserialize, Clone)]
pub struct TermButton {
    pub name: String,
    pub line: String,
}

const MAX_BUTTONS: usize = 60;

fn buttons_file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(crate::kona_base(app)?.join("term-buttons.json"))
}

fn read_buttons(app: &AppHandle) -> HashMap<String, Vec<TermButton>> {
    buttons_file(app).ok().and_then(|p| std::fs::read_to_string(p).ok()).and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

#[tauri::command]
pub fn term_buttons_load(app: AppHandle, project_id: String) -> Result<Vec<TermButton>, String> {
    Ok(read_buttons(&app).remove(&project_id).unwrap_or_default())
}

/// What a button may hold: a short name and a one-line command.
pub fn clean_buttons(list: Vec<TermButton>) -> Result<Vec<TermButton>, String> {
    if list.len() > MAX_BUTTONS {
        return Err(format!("A project can have at most {MAX_BUTTONS} buttons."));
    }
    let mut out: Vec<TermButton> = Vec::new();
    for b in list {
        let (name, line) = (b.name.trim().to_string(), b.line.trim().to_string());
        if name.is_empty() || name.chars().count() > 40 {
            return Err("A button needs a name of 1 to 40 letters.".into());
        }
        if line.is_empty() || line.chars().count() > 500 || line.chars().any(char::is_control) {
            return Err("A button needs a command of one line, up to 500 letters.".into());
        }
        if out.iter().any(|o| o.name.eq_ignore_ascii_case(&name)) {
            return Err(format!("There is already a button named \"{name}\"."));
        }
        out.push(TermButton { name, line });
    }
    Ok(out)
}

#[tauri::command]
pub fn term_buttons_save(app: AppHandle, project_id: String, buttons: Vec<TermButton>) -> Result<(), String> {
    let clean = clean_buttons(buttons)?;
    let mut all = read_buttons(&app);
    if clean.is_empty() { all.remove(&project_id); } else { all.insert(project_id, clean); }
    let path = buttons_file(&app)?;
    if let Some(dir) = path.parent() { std::fs::create_dir_all(dir).map_err(|e| e.to_string())?; }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_string_pretty(&all).map_err(|e| e.to_string())?).map_err(|e| format!("Could not save the buttons: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("Could not save the buttons: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn b(n: &str, l: &str) -> TermButton { TermButton { name: n.into(), line: l.into() } }

    #[test]
    fn buttons_are_trimmed_and_checked() {
        let ok = clean_buttons(vec![b(" Dev ", " npm run dev ")]).unwrap();
        assert_eq!((ok[0].name.as_str(), ok[0].line.as_str()), ("Dev", "npm run dev"));
        assert!(clean_buttons(vec![b("", "x")]).is_err());
        assert!(clean_buttons(vec![b("x", "")]).is_err());
        assert!(clean_buttons(vec![b("x", "a\nb")]).is_err());
        assert!(clean_buttons(vec![b(&"n".repeat(41), "x")]).is_err());
        assert!(clean_buttons(vec![b("x", &"c".repeat(501))]).is_err());
        assert!(clean_buttons(vec![b("Dev", "a"), b("dev", "b")]).is_err());
        assert!(clean_buttons((0..61).map(|i| b(&format!("n{i}"), "x")).collect()).is_err());
    }
}

