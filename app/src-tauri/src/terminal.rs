// The built-in terminal (decision 80): a real shell in a project's folder, drawn by xterm.js in the window.
// The shell runs inside a pseudo-terminal (ConPTY on Windows). Its output goes to the window as base64 text in
// "term-data" events (a chunk can end in the middle of a letter, so the window decodes it as a stream); keys go back
// through `term_write`. The shell joins Kona's job object, so it and everything it started stop when Kona closes.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde_json::json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

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
