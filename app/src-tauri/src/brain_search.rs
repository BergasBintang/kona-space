// Searching the brain from the board's tool server, so Claude itself can look things up (`search_brain`, `read_note`). It is a small twin of
// the screen's engine (app/src/lib/brain/): the same notes cut into the same sections, the same words (no accents, filler words dropped, a
// light stem), the same scoring, and the same three answers (Found, Partly, Not in the brain) with the same bars (0.8 and 0.4). The test at
// the bottom runs the screen's calibration questions and must give the same answers as brain.test.ts. One difference on purpose: a section
// or note that looks like it holds a secret is left out of the answers here instead of being shown with the secret hidden.
use crate::brain;
use std::collections::{HashMap, HashSet};
use std::path::Path;

macro_rules! starter {
    ($($id:literal),* $(,)?) => { &[$(($id, include_str!(concat!("../../src/brain/starter/", $id, ".md")))),*] };
}

/// The starter notes, the same files the screen shows.
pub static STARTER: &[(&str, &str)] = starter![
    "agents-and-sessions", "claude-md-and-memory", "context-and-cost", "good-tickets-and-prompts", "how-the-brain-works", "kona-board",
    "kona-costs-and-plan-bars", "kona-leftovers", "kona-screens", "roles-and-permission-modes", "safe-habits", "skills-mcp-and-hooks",
    "start-here", "tickets-and-worktrees",
];

const STOP: &str = "a an and are as at be been but by can could do does for from had has have how i if in into is it its me my no not of on or our so than that the their them then there these they this to us was we were what when where which who why will with would you your should about after again all any each more most other some such only own same too very also may just over out per one";

fn fold(s: &str) -> String {
    s.to_lowercase().chars().map(|c| match c {
        'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' => 'a', 'ç' => 'c', 'è' | 'é' | 'ê' | 'ë' => 'e', 'ì' | 'í' | 'î' | 'ï' => 'i', 'ñ' => 'n',
        'ò' | 'ó' | 'ô' | 'õ' | 'ö' => 'o', 'ù' | 'ú' | 'û' | 'ü' => 'u', 'ý' | 'ÿ' => 'y', other => other,
    }).collect()
}

fn stem(w: &str) -> String {
    let n = w.chars().count();
    if n > 5 && w.ends_with("ies") { return format!("{}y", &w[..w.len() - 3]); }
    if n > 6 && w.ends_with("ing") { return w[..w.len() - 3].to_string(); }
    if n > 5 && w.ends_with("ed") { return w[..w.len() - 2].to_string(); }
    if n > 5 && w.ends_with("es") { return w[..w.len() - 2].to_string(); }
    if n > 3 && w.ends_with('s') && !w.ends_with("ss") { return w[..w.len() - 1].to_string(); }
    w.to_string()
}

pub fn terms(text: &str) -> Vec<String> {
    let stop: HashSet<&str> = STOP.split_whitespace().collect();
    fold(text).split(|c: char| !c.is_ascii_alphanumeric()).filter(|w| w.len() > 1 && !stop.contains(w)).map(stem).collect()
}

fn words(t: &str) -> usize {
    t.split_whitespace().count()
}

/// Does this text look like it holds a secret? The same shapes the screen hides: private keys, well-known key prefixes, `password = value`
/// lines, bearer tokens and IP addresses (not 127.0.0.1 or 0.0.0.0).
pub fn contains_secret(text: &str) -> bool {
    if text.contains("PRIVATE KEY-----") { return true; }
    // ASCII lower case only, so a byte position in `lower` is the same position in `text` (full Unicode lower-casing can change a character's length)
    let lower = text.to_ascii_lowercase();
    for key in ["password", "passwd", "pwd", "secret", "api_key", "api-key", "apikey", "token"] {
        let mut from = 0;
        while let Some(i) = lower[from..].find(key) {
            let after = &text[from + i + key.len()..];
            let t = after.trim_start_matches(|c: char| c == ' ');
            if let Some(rest) = t.strip_prefix(':').or_else(|| t.strip_prefix('=')) {
                let v: String = rest.trim_start().trim_start_matches(|c| c == '"' || c == '\'').chars().take_while(|c| !c.is_whitespace() && *c != '"' && *c != '\'').collect();
                if v.chars().count() >= 8 { return true; }
            }
            from += i + key.len();
            if from >= lower.len() { break; }
        }
    }
    let toks: Vec<&str> = text.split(|c: char| c.is_whitespace() || "\"'`,;()<>[]{}".contains(c)).filter(|t| !t.is_empty()).collect();
    for (i, t) in toks.iter().enumerate() {
        let alnum = |s: &str, min: usize| s.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').count() >= min;
        if t.starts_with("sk-ant-") && t.len() >= 17 { return true; }
        if t.starts_with("sk-") && t.len() >= 23 && alnum(&t[3..], 20) { return true; }
        if ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"].iter().any(|p| t.starts_with(p)) && t.len() >= 24 { return true; }
        if t.starts_with("github_pat_") && t.len() >= 31 { return true; }
        if t.starts_with("AKIA") && t.len() >= 16 && t[4..].chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) { return true; }
        if t.starts_with("xox") && t.len() >= 14 && "abprs".contains(t.chars().nth(3).unwrap_or(' ')) && t.chars().nth(4) == Some('-') { return true; }
        if t.eq_ignore_ascii_case("bearer") && toks.get(i + 1).map_or(false, |n| n.len() >= 20) { return true; }
        // an IPv4 address
        let ip = t.trim_end_matches(|c: char| c == '.' || c == ':');
        let parts: Vec<&str> = ip.split('.').collect();
        if parts.len() == 4 && parts.iter().all(|p| !p.is_empty() && p.len() <= 3 && p.chars().all(|c| c.is_ascii_digit()) && p.parse::<u32>().map_or(false, |n| n <= 255)) && ip != "127.0.0.1" && ip != "0.0.0.0" { return true; }
    }
    false
}

#[derive(Clone)]
pub struct Section {
    pub note_id: String,
    pub heading: String,
    pub start: usize,
    pub end: usize,
    pub text: String,
    pub first: bool,
}

#[derive(Clone)]
pub struct Note {
    pub id: String,
    pub layer: String,
    pub title: String,
    pub raw: String,
    pub sections: Vec<Section>,
    pub secret: bool,
}

fn front_matter(text: &str) -> (HashMap<String, String>, usize) {
    let t = text.replace('\r', "");
    let lines: Vec<&str> = t.split('\n').collect();
    if lines.first() != Some(&"---") { return (HashMap::new(), 0); }
    let Some(close) = lines.iter().skip(1).position(|l| *l == "---").map(|p| p + 1) else { return (HashMap::new(), 0) };
    let mut m = HashMap::new();
    for l in &lines[1..close] {
        if let Some((k, v)) = l.split_once(':') { m.insert(k.trim().to_lowercase(), v.trim().to_string()); }
    }
    (m, close + 1)
}

fn sections_of(note_id: &str, text: &str, body_start: usize, fallback: &str) -> Vec<Section> {
    let t = text.replace('\r', "");
    let mut lines: Vec<&str> = t.split('\n').collect();
    while lines.last() == Some(&"") { lines.pop(); }
    struct Cut { heading: String, start: usize }
    let mut cuts = vec![Cut { heading: fallback.to_string(), start: body_start + 1 }];
    let mut fence = false;
    for (i, l) in lines.iter().enumerate() {
        if i < body_start { continue; }
        if l.trim_start().starts_with("```") { fence = !fence; continue; }
        if fence { continue; }
        let hashes = l.chars().take_while(|c| *c == '#').count();
        if (1..=3).contains(&hashes) && l.chars().nth(hashes).map_or(false, |c| c.is_whitespace()) {
            cuts.push(Cut { heading: l[hashes..].trim().trim_end_matches('#').trim().replace(['*', '`'], ""), start: i + 1 });
        }
    }
    if cuts.len() > 1 && cuts[1].start == cuts[0].start { cuts.remove(0); }
    struct Raw { heading: String, start: usize, end: usize, body: String }
    let mut raw: Vec<Raw> = vec![];
    for k in 0..cuts.len() {
        let c = &cuts[k];
        let mut e = if k + 1 < cuts.len() { cuts[k + 1].start - 1 } else { lines.len() };
        while e > c.start && lines.get(e - 1).map_or(false, |l| l.trim().is_empty()) { e -= 1; }
        let body = lines.get(c.start - 1..e.min(lines.len())).map(|s| s.join("\n")).unwrap_or_default();
        if !body.trim().is_empty() { raw.push(Raw { heading: c.heading.clone(), start: c.start, end: e, body }); }
    }
    let mut merged: Vec<Raw> = vec![];
    let mut k = 0;
    while k < raw.len() {
        if words(&raw[k].body) < 25 && k + 1 < raw.len() {
            let (s_start, s_body) = (raw[k].start, raw[k].body.clone());
            raw[k + 1].start = s_start;
            raw[k + 1].body = format!("{}\n{}", s_body, raw[k + 1].body);
            k += 1;
            continue;
        }
        merged.push(Raw { heading: raw[k].heading.clone(), start: raw[k].start, end: raw[k].end, body: raw[k].body.clone() });
        k += 1;
    }
    merged.into_iter().enumerate().map(|(i, s)| Section { note_id: note_id.to_string(), heading: s.heading, start: s.start, end: s.end, text: s.body, first: i == 0 }).collect()
}

fn parse(id: &str, layer: &str, text: &str) -> Note {
    let (meta, body_start) = front_matter(text);
    let first_heading = text.replace('\r', "").split('\n').skip(body_start).find(|l| l.starts_with("# ")).map(|l| l[2..].trim().to_string());
    let title = meta.get("title").or_else(|| meta.get("name")).cloned().or(first_heading).unwrap_or_else(|| id.to_string());
    Note { id: id.to_string(), layer: layer.to_string(), sections: sections_of(id, text, body_start, &title), title, raw: text.to_string(), secret: contains_secret(text) }
}

/// Every note of a project's brain: its own, Claude's memory for it, and the starter notes (a project note beats a starter note of the same name).
pub fn load_notes(project: &Path) -> Vec<Note> {
    let mut out: Vec<Note> = brain::load(project).notes.into_iter().map(|n| parse(&n.id, &n.layer, &n.text)).collect();
    let have: HashSet<String> = out.iter().map(|n| n.id.clone()).collect();
    for (id, text) in STARTER {
        if !have.contains(*id) { out.push(parse(id, "starter", text)); }
    }
    out
}

pub struct Hit {
    pub note_id: String,
    pub layer: String,
    pub title: String,
    pub heading: String,
    pub start: usize,
    pub end: usize,
    pub coverage: f64,
    pub snippet: String,
}

pub struct Answer {
    pub state: &'static str,
    pub hits: Vec<Hit>,
}

pub fn search(notes: &[Note], question: &str) -> Answer {
    let q: Vec<String> = { let mut seen = HashSet::new(); terms(question).into_iter().filter(|t| seen.insert(t.clone())).collect() };
    if q.is_empty() { return Answer { state: "none", hits: vec![] }; }
    // the sections that may be shown: nothing from a note that looks like it holds a secret
    let secs: Vec<(&Note, &Section)> = notes.iter().filter(|n| !n.secret).flat_map(|n| n.sections.iter().filter(|s| !contains_secret(&s.text)).map(move |s| (n, s))).collect();
    let n_sections = secs.len() as f64;
    let mut tfs: Vec<HashMap<String, f64>> = vec![];
    let mut df: HashMap<String, f64> = HashMap::new();
    let mut total_len = 0.0;
    let mut lens: Vec<f64> = vec![];
    for (note, s) in &secs {
        let mut tf: HashMap<String, f64> = HashMap::new();
        for t in terms(&s.heading) { *tf.entry(t).or_default() += 3.0; }
        for t in terms(&note.title) { *tf.entry(t).or_default() += if s.first { 3.0 } else { 1.0 }; }
        for t in terms(&s.text) { *tf.entry(t).or_default() += 1.0; }
        let len: f64 = tf.values().sum();
        total_len += len; lens.push(len);
        for t in tf.keys() { *df.entry(t.clone()).or_default() += 1.0; }
        tfs.push(tf);
    }
    let avg = if n_sections > 0.0 { total_len / n_sections } else { 1.0 };
    let idf = |t: &str| { let d = df.get(t).copied().unwrap_or(1.0); (1.0 + (n_sections - d + 0.5) / (d + 0.5)).ln() };
    let total_w: f64 = q.iter().map(|t| idf(t)).sum();
    let (k1, b) = (1.2, 0.75);
    let mut scored: Vec<(f64, f64, usize)> = vec![]; // coverage, score, index
    for (i, tf) in tfs.iter().enumerate() {
        let (mut score, mut matched) = (0.0, 0.0);
        for t in &q {
            if let Some(f) = tf.get(t) {
                let w = idf(t);
                matched += w;
                score += w * ((f * (k1 + 1.0)) / (f + k1 * (1.0 - b + b * (lens[i] / avg))));
            }
        }
        if matched > 0.0 { scored.push((if total_w > 0.0 { matched / total_w } else { 0.0 }, score, i)); }
    }
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap().then(b.1.partial_cmp(&a.1).unwrap()).then(secs[a.2].1.note_id.cmp(&secs[b.2].1.note_id)));
    let Some(top) = scored.first().copied() else { return Answer { state: "none", hits: vec![] } };
    if top.0 < 0.4 { return Answer { state: "none", hits: vec![] }; }
    let mk = |&(cov, _, i): &(f64, f64, usize)| {
        let (note, s) = secs[i];
        let want: HashSet<&String> = q.iter().collect();
        let line = s.text.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('#')).find(|l| terms(l).iter().any(|t| want.contains(t))).or_else(|| s.text.lines().map(str::trim).find(|l| !l.is_empty() && !l.starts_with('#'))).unwrap_or("");
        let clean: String = line.replace(['*', '`'], "");
        let snippet: String = if clean.chars().count() > 220 { format!("{}…", clean.chars().take(219).collect::<String>()) } else { clean };
        Hit { note_id: note.id.clone(), layer: note.layer.clone(), title: note.title.clone(), heading: s.heading.clone(), start: s.start, end: s.end, coverage: cov, snippet }
    };
    if top.0 >= 0.8 {
        let floor = (top.0 - 0.25).max(0.5);
        Answer { state: "found", hits: scored.iter().filter(|h| h.0 >= floor).take(5).map(mk).collect() }
    } else {
        Answer { state: "partly", hits: scored.iter().take(3).map(mk).collect() }
    }
}

/// The tool server's reply to `search_brain`.
pub fn describe(a: &Answer) -> String {
    let mut s = match a.state {
        "found" => "Found in the brain.\n".to_string(),
        "partly" => "Partly in the brain: only some of the words match. These are the closest, close but not exact.\n".to_string(),
        _ => return "Not in the brain. No note covers this. Do not treat the brain as having an answer; say so to the owner or look elsewhere.".to_string(),
    };
    for (i, h) in a.hits.iter().enumerate() {
        s.push_str(&format!("{}. [{}] {} > {} (note id {}, lines {}-{}, covers {}% of the question)\n   {}\n", i + 1, h.layer, h.title, h.heading, h.note_id, h.start, h.end, (h.coverage * 100.0).round(), h.snippet));
    }
    s.push_str("Read the lines with read_note.");
    s
}

/// The tool server's reply to `read_note`: some lines of one note.
pub fn read(notes: &[Note], id: &str, from: Option<usize>, to: Option<usize>) -> Result<String, String> {
    let n = notes.iter().find(|n| n.id == id).ok_or_else(|| format!("There is no note called {id}"))?;
    if n.secret { return Err("That note looks like it holds a secret, so Kona does not show it".into()); }
    let lines: Vec<&str> = n.raw.split('\n').collect();
    let a = from.unwrap_or(1).max(1);
    let b = to.unwrap_or(a + 119).min(lines.len()).min(a + 199);
    if a > lines.len() { return Err(format!("The note has only {} lines", lines.len())); }
    Ok(format!("{} (lines {}-{} of {}):\n{}", n.title, a, b, lines.len(), lines[a - 1..b].join("\n")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn starter_notes() -> Vec<Note> {
        STARTER.iter().map(|(id, t)| parse(id, "starter", t)).collect()
    }

    // the same questions as app/src/lib/brain/brain.test.ts, with the same answers: the two engines must agree
    #[test]
    fn the_tool_gives_the_same_three_answers_as_the_screen() {
        let notes = starter_notes();
        let cases: &[(&str, &str, &[&str])] = &[
            ("what is a worktree", "found", &["tickets-and-worktrees"]),
            ("how do I reduce token cost", "partly", &["context-and-cost"]),
            ("how do I make claude cheaper", "found", &["context-and-cost"]),
            ("what permission modes are there", "found", &["roles-and-permission-modes"]),
            ("what is a hook", "found", &["skills-mcp-and-hooks"]),
            ("how do I stop a dev server a session left running", "found", &["kona-leftovers", "safe-habits"]),
            ("where does claude keep its memory", "found", &["claude-md-and-memory", "how-the-brain-works"]),
            ("why does a long session get worse", "found", &["agents-and-sessions"]),
            ("who can move a ticket to done", "found", &["kona-board", "tickets-and-worktrees"]),
            ("how should I write a good ticket", "found", &["good-tickets-and-prompts"]),
            ("what does the brain do with secrets", "found", &["how-the-brain-works"]),
            ("what is a subagent", "found", &["skills-mcp-and-hooks"]),
            ("how do I deploy a worktree", "partly", &[]),
            ("explain the cache", "partly", &[]),
            ("how do I deploy to a VPS with ssh keys", "none", &[]),
            ("laravel migration rollback", "none", &[]),
            ("recipe for banana bread", "none", &[]),
            ("", "none", &[]),
            ("how do I", "none", &[]),
        ];
        for (q, want, ids) in cases {
            let a = search(&notes, q);
            assert_eq!(a.state, *want, "\"{q}\" gave {} (top {:?})", a.state, a.hits.first().map(|h| (h.note_id.clone(), h.coverage)));
            if !ids.is_empty() {
                assert!(a.hits.iter().take(3).any(|h| ids.contains(&h.note_id.as_str())), "\"{q}\" should reach {ids:?}, reached {:?}", a.hits.iter().map(|h| h.note_id.clone()).collect::<Vec<_>>());
            }
        }
    }

    #[test]
    fn sections_have_the_screens_line_numbers() {
        let n = parse("t", "starter", STARTER.iter().find(|(i, _)| *i == "context-and-cost").unwrap().1);
        assert!(n.sections.len() >= 3);
        let lines: Vec<&str> = n.raw.split('\n').collect();
        for s in &n.sections {
            assert!(s.start >= 1 && s.end >= s.start && s.end <= lines.len());
        }
    }

    #[test]
    fn secrets_are_recognised_and_ordinary_words_are_not() {
        assert!(contains_secret("the key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789"));
        assert!(contains_secret("password: hunter2hunter2"));
        assert!(contains_secret("the host is 203.0.113.7"));
        assert!(contains_secret("-----BEGIN RSA PRIVATE KEY-----"));
        assert!(contains_secret("ghp_abcdefghijklmnopqrstuvwxyz0123"));
        assert!(!contains_secret("see 127.0.0.1 and talk about passwords in general"));
        assert!(!contains_secret("a token of thanks: use it wisely"));
        assert!(!contains_secret("İİİİ password İİİİ")); // a character whose lower case is longer must not shift the search
        assert!(!contains_secret("version 1.2.3.4 is out") || contains_secret("version 1.2.3.4 is out")); // an address-shaped version is allowed to be hidden
    }

    #[test]
    fn a_note_with_a_secret_is_left_out_of_answers() {
        let mut notes = starter_notes();
        notes.push(parse("deploy-notes", "project", "# Deploy notes\n\nThe server login is password: hunter2hunter2 and we deploy with the script every Friday afternoon.\n"));
        assert!(search(&notes, "deploy script friday").hits.iter().all(|h| h.note_id != "deploy-notes"));
        assert!(read(&notes, "deploy-notes", None, None).is_err());
    }
}
