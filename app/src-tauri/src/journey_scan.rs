// Finding the step markers in a project's files (ticket T-0039, decision 91 in kona-space-app.md).
//
// A marker is the plain text `kona-step: <id>` in a comment of the file that makes a page or a modal (`// kona-step: sign-in`, `<!-- kona-step: sign-in -->`, `# kona-step: sign-in`).
// Kona only searches for that text; it does not read any language, so it works in every file type. A worker writes the marker inside a ticket, so it shows in the diff: Kona never
// writes into the owner's files. The Journey view compares the markers with the steps of the journey note (app/src/lib/brain/journeymarks.ts).
//
// The scan is made to be safe on a small PC: it reads only files of code and markup (by extension), skips folders of other people's code and of builds, skips files over one megabyte,
// does not follow a link or a junction, and stops at a count of files and at a time, saying so (`truncated`).
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

/// The folders that hold what the project did not write, or what is built from it. Every folder that starts with a dot is skipped as well (`.git`, `.kona`, `.next`, `.venv`).
const SKIP_DIRS: [&str; 12] = ["node_modules", "target", "dist", "build", "out", "coverage", "vendor", "venv", "__pycache__", "bower_components", "pods", "deriveddata"];
/// Files of code and markup. A markdown file is left out on purpose: a note that explains the marker is not a page.
const EXTENSIONS: [&str; 30] = [
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "vue", "svelte", "astro", "html", "htm", "php", "py", "rb", "go", "rs", "java", "kt", "swift", "cs", "dart", "css", "scss", "sass", "less", "erb", "twig", "liquid", "hbs", "jsp",
];
const TAG: &str = "kona-step:";

#[derive(Clone, Copy)]
pub struct Limits {
    pub files: usize,
    pub depth: usize,
    pub file_bytes: u64,
    pub markers: usize,
    pub time: Duration,
}
pub const LIMITS: Limits = Limits { files: 20_000, depth: 14, file_bytes: 1024 * 1024, markers: 5000, time: Duration::from_secs(10) };

#[derive(Serialize, Debug, PartialEq)]
pub struct Marker {
    /// the step id written after the tag
    pub id: String,
    /// the file, relative to the project, with `/`
    pub file: String,
    /// the line, counting from 1
    pub line: usize,
}

#[derive(Serialize, Debug)]
pub struct Scan {
    pub markers: Vec<Marker>,
    /// how many files were read
    pub files: usize,
    pub ms: u64,
    /// the scan stopped at a limit (files, markers or time) before it had seen everything
    pub truncated: bool,
}

/// The id written after the tag on one line: lower case letters, digits and dashes, starting with a letter or a digit. None when there is no tag or no id after it.
pub fn marker_in(line: &str) -> Option<String> {
    let at = line.find(TAG)?;
    let id: String = line[at + TAG.len()..].trim_start_matches([' ', '\t']).chars().take_while(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == '-').collect();
    (!id.is_empty() && !id.starts_with('-')).then_some(id)
}

pub fn scan(project: &Path) -> Scan {
    scan_with(project, LIMITS)
}

pub fn scan_with(project: &Path, lim: Limits) -> Scan {
    let start = Instant::now();
    let mut out = Scan { markers: Vec::new(), files: 0, ms: 0, truncated: false };
    let mut stack = vec![(project.to_path_buf(), 0usize)];
    'walk: while let Some((dir, depth)) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        let mut entries: Vec<_> = entries.flatten().collect();
        entries.sort_by_key(|e| e.file_name());
        for e in entries {
            if start.elapsed() > lim.time || out.files >= lim.files || out.markers.len() >= lim.markers {
                out.truncated = true;
                break 'walk;
            }
            let Ok(ft) = e.file_type() else { continue };
            if ft.is_symlink() {
                continue; // a link or a junction can lead out of the project, or round and round
            }
            let name = e.file_name().to_string_lossy().into_owned();
            let lower = name.to_lowercase();
            if ft.is_dir() {
                if depth < lim.depth && !name.starts_with('.') && !SKIP_DIRS.contains(&lower.as_str()) {
                    stack.push((e.path(), depth + 1));
                }
                continue;
            }
            if !ft.is_file() {
                continue;
            }
            let ext = lower.rsplit_once('.').map(|(_, x)| x).unwrap_or("");
            if !EXTENSIONS.contains(&ext) || e.metadata().map(|m| m.len() > lim.file_bytes).unwrap_or(true) {
                continue;
            }
            let Ok(bytes) = fs::read(e.path()) else { continue };
            out.files += 1;
            let text = String::from_utf8_lossy(&bytes);
            if !text.contains(TAG) {
                continue;
            }
            let rel = e.path().strip_prefix(project).map(|p| p.to_string_lossy().replace('\\', "/")).unwrap_or(name);
            for (i, l) in text.lines().enumerate() {
                if let Some(id) = marker_in(l) {
                    out.markers.push(Marker { id, file: rel.clone(), line: i + 1 });
                }
            }
        }
    }
    out.markers.sort_by(|a, b| a.file.cmp(&b.file).then(a.line.cmp(&b.line)));
    out.ms = start.elapsed().as_millis() as u64;
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(name: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("kona-scan-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }
    fn put(root: &Path, rel: &str, text: &str) {
        let p = root.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, text).unwrap();
    }

    #[test]
    fn the_id_after_the_tag_is_read_the_same_in_every_kind_of_comment() {
        assert_eq!(marker_in("// kona-step: sign-in").as_deref(), Some("sign-in"));
        assert_eq!(marker_in("<!-- kona-step: sign-in -->").as_deref(), Some("sign-in"));
        assert_eq!(marker_in("# kona-step:sign-in").as_deref(), Some("sign-in"));
        assert_eq!(marker_in("{/* kona-step:\tstep-2 */}").as_deref(), Some("step-2"));
        assert_eq!(marker_in("/* kona-step: a */ x").as_deref(), Some("a"));
        for none in ["", "no tag here", "kona-step:", "kona-step: <id>", "kona-step: -x", "kona-step: Sign-In", "Kona-Step: sign-in", "kona-step :sign-in", "kona_step: a"] {
            assert_eq!(marker_in(none), None, "{none:?}");
        }
    }

    #[test]
    fn markers_are_found_in_code_and_markup_with_their_file_and_line() {
        let d = project("find");
        put(&d, "src/pages/signin.tsx", "export const A = 1;\n// kona-step: sign-in\nexport default A;\n");
        put(&d, "views/home.blade.php", "{{-- kona-step: home --}}\n<div></div>\n<!-- kona-step: modal-share -->\n");
        put(&d, "app/main.py", "# kona-step: check-login\n");
        put(&d, "public/index.html", "<!-- kona-step: visit -->");
        put(&d, "crlf.js", "a\r\n// kona-step: crlf-step\r\n");
        let s = scan(&d);
        let got: Vec<(String, String, usize)> = s.markers.iter().map(|m| (m.id.clone(), m.file.clone(), m.line)).collect();
        assert_eq!(got, vec![
            ("check-login".to_string(), "app/main.py".to_string(), 1),
            ("crlf-step".to_string(), "crlf.js".to_string(), 2),
            ("visit".to_string(), "public/index.html".to_string(), 1),
            ("sign-in".to_string(), "src/pages/signin.tsx".to_string(), 2),
            ("home".to_string(), "views/home.blade.php".to_string(), 1),
            ("modal-share".to_string(), "views/home.blade.php".to_string(), 3),
        ]);
        assert_eq!(s.files, 5);
        assert!(!s.truncated);
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn code_that_is_not_the_projects_own_and_files_that_are_not_pages_are_left_out() {
        let d = project("skip");
        put(&d, "node_modules/lib/x.js", "// kona-step: in-modules");
        put(&d, "target/debug/x.rs", "// kona-step: in-target");
        put(&d, "dist/app.js", "// kona-step: in-dist");
        put(&d, ".git/hooks/x.js", "// kona-step: in-git");
        put(&d, ".kona/mockups/site/index.html", "<!-- kona-step: in-mockup -->");
        put(&d, "docs/README.md", "write `kona-step: example` in a comment");
        put(&d, "data.json", "{\"a\": \"kona-step: in-json\"}");
        put(&d, "image.png", "kona-step: in-png");
        put(&d, "src/big.js", &format!("// kona-step: too-big\n{}", "x".repeat(1024 * 1024 + 10)));
        put(&d, "src/ok.js", "// kona-step: ok");
        let ids: Vec<String> = scan(&d).markers.into_iter().map(|m| m.id).collect();
        assert_eq!(ids, vec!["ok".to_string()]);
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_scan_stops_at_its_limits_and_says_so() {
        let d = project("limits");
        for i in 0..30 {
            put(&d, &format!("src/f{i:02}.js"), &format!("// kona-step: s{i}"));
        }
        let few = scan_with(&d, Limits { files: 10, ..LIMITS });
        assert!(few.truncated && few.files == 10 && few.markers.len() == 10);
        let markers = scan_with(&d, Limits { markers: 5, ..LIMITS });
        assert!(markers.truncated && markers.markers.len() == 5);
        let deep = project("depth");
        put(&deep, "a/b/c/d.js", "// kona-step: deep");
        assert_eq!(scan_with(&deep, Limits { depth: 2, ..LIMITS }).markers.len(), 0, "a folder deeper than the limit is not entered");
        assert_eq!(scan_with(&deep, Limits { depth: 3, ..LIMITS }).markers.len(), 1);
        assert!(!scan(&d).truncated);
        assert_eq!(scan(&d.join("no-such-folder")).files, 0);
        let _ = fs::remove_dir_all(&d);
        let _ = fs::remove_dir_all(&deep);
    }

    #[test]
    fn a_real_size_project_is_read_in_well_under_the_time_limit() {
        let d = project("size");
        for i in 0..3000 {
            put(&d, &format!("src/m{}/f{i}.tsx", i % 60), &format!("export const X{i} = () => <div>{}</div>;\n", "x".repeat(400)));
        }
        put(&d, "src/m7/page.tsx", "// kona-step: found-me\n");
        let s = scan(&d);
        assert_eq!(s.markers.len(), 1);
        assert_eq!(s.files, 3001);
        assert!(s.ms < 5000, "took {} ms", s.ms);
        let _ = fs::remove_dir_all(&d);
    }
}
