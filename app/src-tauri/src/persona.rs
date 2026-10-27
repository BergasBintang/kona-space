// The voice (feature F15, first version): one persona file that changes how Claude talks to the owner in chat, and the
// words of a few lines in Kona's own screens. It changes wording only, never what Claude does or says is true.
// The voice reaches Claude as an extra paragraph of instructions at the start of a session (`--append-system-prompt`),
// with a scope clause that keeps it out of code, files, commit and ticket text, commands, warnings and numbers.
// The file is %APPDATA%\Kona\persona.json.
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
pub struct Lines {
    pub greeting: String,
    pub started: String,
    pub ended: String,
    pub limit: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Persona {
    pub enabled: bool,
    pub name: String,
    pub language: String,
    /// "terse", "normal" or "detailed"
    pub verbosity: String,
    /// "none" or "light"
    pub humor: String,
    pub emoji: bool,
    /// what to call the owner; empty means no name or nickname
    pub address: String,
    /// everyday words, and a plain explanation after each technical term
    pub plain: bool,
    /// a short description of the voice, in the owner's words
    pub voice: String,
    pub lines: Lines,
}

/// The lines Kona uses when the voice is off. `{project}` is the project's name.
pub fn plain_lines() -> Lines {
    Lines {
        greeting: "Choose a role and start a session.".into(),
        started: "Session started in {project}.".into(),
        ended: "This session has ended.".into(),
        limit: "Close to the limit.".into(),
    }
}

/// The terse operator the owner chose (questions 17 and 18): English, no nickname, no humor, no emoji, plain words.
pub fn default_persona() -> Persona {
    Persona {
        enabled: true,
        name: "Kona".into(),
        language: "English".into(),
        verbosity: "terse".into(),
        humor: "none".into(),
        emoji: false,
        address: String::new(),
        plain: true,
        voice: "A terse operator. Short sentences. Facts first, then the next step. Calm and direct, no filler, no cheering.".into(),
        lines: Lines {
            greeting: "Ready when you are.".into(),
            started: "Started in {project}.".into(),
            ended: "Session ended.".into(),
            limit: "Close to the limit. Plan the next steps before it runs out.".into(),
        },
    }
}

/// The scope clause. The voice never goes beyond chat words.
const SCOPE: &str = "This voice applies only to your chat replies to the owner. It never applies to code, code comments, file contents, \
commit messages, pull request text, ticket or note text, commands, paths, queries, prompts you write for other agents, permission requests, \
warnings, error messages, or numbers. It never changes a fact or a piece of advice, never hides a problem, and never makes you agree more or flatter.";

impl Persona {
    /// The paragraph given to Claude. None when the voice is off.
    pub fn prompt(&self) -> Option<String> {
        if !self.enabled {
            return None;
        }
        let mut p = vec!["Voice for talking to the owner.".to_string()];
        if !self.voice.trim().is_empty() {
            p.push(self.voice.trim().to_string());
        }
        if !self.language.trim().is_empty() {
            p.push(format!("Reply in {}.", self.language.trim()));
        }
        p.push(match self.verbosity.as_str() {
            "terse" => "Keep replies short: a few sentences, the answer first.".into(),
            "detailed" => "Give full explanations when the topic needs them, still without padding.".into(),
            _ => "Use a normal length: enough to be clear, no more.".into(),
        });
        if self.plain {
            p.push("Use everyday words. After a technical term, add a few plain words, with a short example the first time.".into());
        }
        p.push(if self.humor == "light" { "A light touch of humor is fine, never at the cost of clarity.".into() } else { "No jokes.".into() });
        if !self.emoji {
            p.push("No emoji.".into());
        }
        p.push(if self.address.trim().is_empty() { "Do not give the owner a name or a nickname.".into() } else { format!("Call the owner {}.", self.address.trim()) });
        if !self.name.trim().is_empty() {
            p.push(format!("If you need to name yourself, use {}.", self.name.trim()));
        }
        p.push(SCOPE.into());
        Some(p.join(" "))
    }

    /// The words for Kona's own screens, with the project's name filled in.
    pub fn lines_for(&self, project: &str) -> Lines {
        let l = if self.enabled { self.lines.clone() } else { plain_lines() };
        let fill = |s: String| s.replace("{project}", project);
        Lines { greeting: fill(l.greeting), started: fill(l.started), ended: fill(l.ended), limit: fill(l.limit) }
    }
}

pub struct Voice {
    file: PathBuf,
    cur: Mutex<Persona>,
}

impl Voice {
    pub fn load(base: &std::path::Path) -> Self {
        let file = base.join("persona.json");
        let cur = fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str::<Persona>(&t).ok()).unwrap_or_else(default_persona);
        Self { file, cur: Mutex::new(cur) }
    }

    pub fn get(&self) -> Persona {
        self.cur.lock().unwrap().clone()
    }

    pub fn set(&self, mut p: Persona) -> Result<Persona, String> {
        if !["terse", "normal", "detailed"].contains(&p.verbosity.as_str()) {
            return Err("That length is not one Kona offers".into());
        }
        if !["none", "light"].contains(&p.humor.as_str()) {
            return Err("That kind of humor is not one Kona offers".into());
        }
        // the voice goes out with every request, so keep it short (the plan says 300 words or fewer)
        if p.voice.split_whitespace().count() > 300 {
            return Err("The voice description is longer than 300 words. Shorten it: it is sent with every session.".into());
        }
        let d = default_persona();
        for (line, fallback) in [(&mut p.lines.greeting, &d.lines.greeting), (&mut p.lines.started, &d.lines.started), (&mut p.lines.ended, &d.lines.ended), (&mut p.lines.limit, &d.lines.limit)] {
            if line.trim().is_empty() {
                *line = fallback.clone();
            }
        }
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        fs::write(&self.file, serde_json::to_string_pretty(&p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        *self.cur.lock().unwrap() = p.clone();
        Ok(p)
    }
}
