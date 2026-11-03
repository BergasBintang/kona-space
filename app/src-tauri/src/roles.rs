// Roles: the setup of a session (decision 9, feature F5). The list of roles is fixed (decision 43): the owner cannot add or remove one.
// Since decision 50 each role can be set up: its personality, its brief, its model and permission mode. These are the same in every project and are
// kept in %APPDATA%\Kona\role-profiles.json; a role that was never set up simply has the starting values below. The skills and tool connectors a role
// may use belong to a project, not to the role (decision 51, see skills.rs). (The old %APPDATA%\Kona\roles.json is not read or written; an old copy of it can be deleted.)
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// How a person talks to the owner in chat (decision 63): the settings of the voice, apart from the tone, which is the person's `persona` text. It changes wording only, never what is done or said to be true.
#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct VoiceSettings {
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
}

impl Default for VoiceSettings {
    /// the built-in voice, for a person nobody has set up: the terse operator of the first version
    fn default() -> Self {
        Self { language: "English".into(), verbosity: "terse".into(), humor: "none".into(), emoji: false, address: String::new(), plain: true }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Role {
    pub id: String,
    /// the person's own name (decision 62): fixed, not editable; shown with the job, "Kiki, Product"
    #[serde(default)]
    pub person: String,
    /// the job, such as Product or Backend
    pub name: String,
    pub group: String,
    pub model: String,
    pub mode: String,
    pub brief: String,
    /// how this role behaves and sounds, in the owner's words; added after the brief
    #[serde(default)]
    pub persona: String,
    /// how this person talks to the owner (the starting voice is written for the job; the owner changes it in Set up)
    #[serde(default)]
    pub voice: VoiceSettings,
    /// local tools this role needs, by id from needs.rs (the needs check looks for them)
    #[serde(default)]
    pub needs: Vec<String>,
    /// tickets run as this role work in their own copy of the repo (a worktree) unless the ticket says otherwise
    #[serde(default)]
    pub own_copy: bool,
}

impl Role {
    /// "Kiki the Product": how one person refers to another
    pub fn the(&self) -> String {
        if self.person.is_empty() { self.name.clone() } else { format!("{} the {}", self.person, self.name) }
    }
}

/// What the owner may set on a role.
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Profile {
    pub persona: String,
    pub brief: String,
    pub model: String,
    pub mode: String,
    /// None: the starting voice of this person (so a profile saved before voices existed keeps it)
    #[serde(default)]
    pub voice: Option<VoiceSettings>,
}

/// A skill or connector name that is safe to use as a folder name and as a word on a command line.
pub fn clean_name(s: &str) -> bool {
    !s.is_empty() && s.len() <= 80 && !s.starts_with('.') && s.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
}

fn check(p: &Profile) -> Result<Profile, String> {
    if !["sonnet", "opus", "haiku"].contains(&p.model.as_str()) {
        return Err("Choose Sonnet, Opus or Haiku".into());
    }
    if !["plan", "default", "acceptEdits", "auto"].contains(&p.mode.as_str()) {
        return Err("That permission mode is not one Kona offers".into());
    }
    if p.brief.trim().is_empty() || p.brief.chars().count() > 3000 {
        return Err("The brief must be there and no longer than 3000 letters".into());
    }
    if p.persona.chars().count() > 1500 {
        return Err("The personality may be at most 1500 letters".into());
    }
    let voice = match &p.voice {
        Some(v) => {
            if !["terse", "normal", "detailed"].contains(&v.verbosity.as_str()) { return Err("That length is not one Kona offers".into()); }
            if !["none", "light"].contains(&v.humor.as_str()) { return Err("That kind of humor is not one Kona offers".into()); }
            if v.language.trim().is_empty() || v.language.chars().count() > 40 { return Err("Say which language, in at most 40 letters".into()); }
            if v.address.chars().count() > 40 { return Err("What it calls you may be at most 40 letters".into()); }
            Some(VoiceSettings { language: v.language.trim().to_string(), verbosity: v.verbosity.clone(), humor: v.humor.clone(), emoji: v.emoji, address: v.address.trim().to_string(), plain: v.plain })
        }
        None => None,
    };
    Ok(Profile { persona: p.persona.trim().to_string(), brief: p.brief.trim().to_string(), model: p.model.clone(), mode: p.mode.clone(), voice })
}

fn apply(r: &mut Role, p: &Profile) {
    if !p.brief.is_empty() { r.brief = p.brief.clone(); } // an empty brief in the file means "still the starting one"
    r.persona = p.persona.clone(); r.model = p.model.clone(); r.mode = p.mode.clone();
    if let Some(v) = &p.voice { r.voice = v.clone(); }
}

struct Inner {
    list: Vec<Role>,
    saved: HashMap<String, Profile>,
}

pub struct Roles {
    file: PathBuf,
    inner: Mutex<Inner>,
}

fn starting(id: &str, person: &str, name: &str, group: &str, mode: &str, needs: &[&str], brief: &str) -> Role {
    Role {
        voice: VoiceSettings::default(), id: id.into(), person: person.into(), name: name.into(), group: group.into(), model: "sonnet".into(), mode: mode.into(), brief: brief.into(), persona: String::new(),
        needs: needs.iter().map(|s| s.to_string()).collect(), own_copy: id == "frontend" || id == "backend",
    }
}

/// The roles: the ten starting roles and the secretary. The modes are the safe default (ask every time); only the two that edit files are loosened.
/// No role starts with any skill or connector: the owner picks them for each project, so a session carries nothing it was not given.
pub fn starting_roles() -> Vec<Role> {
    let mut all = vec![
        starting("product", "Kiki", "Product", "Plan", "plan", &[], "You are working as the Product role. Turn what the owner wants into small, clear tickets, each with how to tell it is done. Do not change any file; plan only."),
        starting("design", "Nokka", "Design", "Plan", "default", &[], "You are working as the Design role. Work on how the screens look and feel: layout, spacing, words on the screen, states. Say what you would change and why before you change it."),
        starting("frontend", "Jiro", "Frontend", "Build", "acceptEdits", &["git", "node", "npm"], "You are working as the Frontend role. Build and fix what people see and click. Keep changes small and say which files you changed."),
        starting("backend", "Kit", "Backend", "Build", "acceptEdits", &["git", "node", "php", "composer"], "You are working as the Backend role. Build and fix the server side: data, rules, speed. Keep changes small and say which files you changed."),
        starting("qa", "Sen", "QA", "Build", "default", &["git", "node"], "You are working as the QA role. Try to break things and report what you find, with the steps to repeat it. Do not fix anything unless asked."),
        starting("security", "Bejo", "Security", "Build", "default", &["git"], "You are working as the Security role. Look for ways the project could be attacked or leak something, and rank what you find by how bad it is. Never write a key or password into a file."),
        starting("devops", "Sora", "DevOps", "Ship", "default", &["git", "ssh", "docker"], "You are working as the DevOps role. Handle building, shipping and servers. Say what a command will do before you ask to run it. Never touch a server without being asked."),
        starting("marketing", "Yuzu", "Marketing", "Grow", "default", &[], "You are working as the Marketing role. Help say what the product is for, to whom, and where to say it. Do not invent numbers or customers."),
        starting("content", "Nobo", "Content and SEO", "Grow", "default", &["git"], "You are working as the Content and SEO role. Write and tidy pages and words so people and search engines can find and follow them. Plain words only."),
        starting("support", "Kenn", "Support", "Grow", "default", &[], "You are working as the Support role. Help answer people's questions and trace problems they report. Be kind and plain, and say when you are not sure."),
        starting("secretary", "Kupa", "Secretary", "Office", "default", &[], "You are working as the Secretary role, the front desk of the office. Answer the owner's general questions in plain words. When the owner says what they want done, turn it into small tickets for the right roles with the ticket tools (list_tickets first, so you do not raise the same thing twice), each with how to tell it is done. Do not change any project file yourself. If something belongs to one person, name them by name and job, like Jiro the Frontend, and put that person's name or job in the role of the ticket."),
    ];
    // the starting voice of each person, written for the job (decision 63): the tone in words, how long the replies are, whether there is a little humor. No emoji and no nickname for the owner.
    for r in &mut all {
        let (tone, verbosity, humor) = match r.id.as_str() {
            "product" => ("Warm and curious. When something is vague, asks one clear question and then gets on with it.", "normal", "light"),
            "design" => ("Chatty and visual. Describes things by how they look and feel, and likes a small example over a long rule.", "normal", "light"),
            "frontend" => ("Upbeat and practical. Short steps, and always says what was changed and where.", "normal", "none"),
            "backend" => ("Calm and exact. Short sentences, and numbers whenever they matter.", "terse", "none"),
            "qa" => ("Careful and a little picky. Lists what was checked and, just as plainly, what was not.", "normal", "none"),
            "security" => ("Serious and blunt. Says how bad a problem is before anything else.", "terse", "none"),
            "devops" => ("Brief and steady. Says what a command will do before asking to run it.", "terse", "none"),
            "marketing" => ("Lively and encouraging. Plain, punchy words, and never an invented number.", "normal", "light"),
            "content" => ("Gentle and tidy. Likes clear sentences and says why a word was chosen.", "normal", "none"),
            "support" => ("Kind and patient. Starts by saying the problem back in plain words.", "normal", "none"),
            "secretary" => ("Friendly and organised. Says plainly what will be written down, and for whom.", "normal", "light"),
            _ => ("", "terse", "none"),
        };
        r.persona = tone.into();
        r.voice = VoiceSettings { verbosity: verbosity.into(), humor: humor.into(), ..VoiceSettings::default() };
    }
    all
}

impl Roles {
    pub fn load(base: &Path) -> Self {
        let file = base.join("role-profiles.json");
        let saved: HashMap<String, Profile> = fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
        let list = starting_roles().into_iter().map(|mut r| { if let Some(p) = saved.get(&r.id) { apply(&mut r, p); } r }).collect();
        Self { file, inner: Mutex::new(Inner { list, saved }) }
    }

    pub fn all(&self) -> Vec<Role> {
        self.inner.lock().unwrap().list.clone()
    }

    pub fn get(&self, id: &str) -> Option<Role> {
        self.inner.lock().unwrap().list.iter().find(|r| r.id == id).cloned()
    }

    fn write(&self, saved: &HashMap<String, Profile>) -> Result<(), String> {
        if let Some(d) = self.file.parent() { fs::create_dir_all(d).map_err(|e| e.to_string())?; }
        let tmp = self.file.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(saved).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &self.file).map_err(|e| e.to_string())
    }

    /// Keep the owner's setup for one role.
    pub fn save(&self, id: &str, profile: Profile) -> Result<Role, String> {
        let p = check(&profile)?;
        let mut g = self.inner.lock().unwrap();
        let i = g.list.iter().position(|r| r.id == id).ok_or("That role does not exist")?;
        let mut saved = g.saved.clone();
        let mut stored = p.clone();
        if starting_roles().iter().any(|r| r.id == id && r.brief == p.brief) { stored.brief = String::new(); } // unchanged: a later Kona update of the brief still reaches this role
        saved.insert(id.to_string(), stored);
        self.write(&saved)?;
        g.saved = saved;
        apply(&mut g.list[i], &p);
        Ok(g.list[i].clone())
    }

    /// Back to the starting setup of one role.
    pub fn reset(&self, id: &str) -> Result<Role, String> {
        let start = starting_roles().into_iter().find(|r| r.id == id).ok_or("That role does not exist")?;
        let mut g = self.inner.lock().unwrap();
        let mut saved = g.saved.clone();
        saved.remove(id);
        self.write(&saved)?;
        g.saved = saved;
        let i = g.list.iter().position(|r| r.id == id).ok_or("That role does not exist")?;
        g.list[i] = start.clone();
        Ok(start)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_role_is_a_named_person_and_the_names_are_all_different() {
        let all = starting_roles();
        assert_eq!(all.len(), 11);
        assert!(all.iter().all(|r| !r.person.is_empty()));
        let mut names: Vec<_> = all.iter().map(|r| r.person.clone()).collect();
        names.sort();
        names.dedup();
        assert_eq!(names.len(), 11, "no two people share a name");
        let kiki = all.iter().find(|r| r.id == "product").unwrap();
        assert_eq!(kiki.the(), "Kiki the Product");
        assert_eq!(all.iter().find(|r| r.id == "content").unwrap().the(), "Nobo the Content and SEO");
    }

    #[test]
    fn every_person_has_a_voice_of_their_own_and_a_changed_voice_is_kept_until_reset() {
        let all = starting_roles();
        assert!(all.iter().all(|r| !r.persona.trim().is_empty()), "every person has a tone in words");
        assert!(all.iter().any(|r| r.voice.humor == "light") && all.iter().any(|r| r.voice.verbosity == "terse") && all.iter().any(|r| r.voice.verbosity == "normal"), "the voices are not all the same");
        assert!(all.iter().all(|r| r.persona.split_whitespace().count() < 40 && !r.voice.emoji && r.voice.address.is_empty()));
        let dir = std::env::temp_dir().join(format!("kona-roles-voice-{}", std::process::id()));
        let roles = Roles::load(&dir);
        let kit = roles.get("qa").unwrap();
        let mut p = Profile { persona: kit.persona.clone(), brief: kit.brief.clone(), model: kit.model.clone(), mode: kit.mode.clone(), voice: Some(kit.voice.clone()) };
        assert!(roles.save("qa", p.clone()).unwrap().voice == kit.voice, "an unchanged voice stays the starting one");
        p.voice = Some(VoiceSettings { language: "Bahasa Indonesia".into(), verbosity: "detailed".into(), humor: "light".into(), emoji: true, address: "Bos".into(), plain: false });
        assert_eq!(roles.save("qa", p.clone()).unwrap().voice.language, "Bahasa Indonesia");
        assert_eq!(Roles::load(&dir).get("qa").unwrap().voice.address, "Bos", "it is kept for the next start");
        p.voice.as_mut().unwrap().verbosity = "loud".into();
        assert!(roles.save("qa", p).is_err(), "a length that Kona does not offer is refused");
        assert_eq!(roles.reset("qa").unwrap().voice, kit.voice, "reset brings the starting voice back");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
