// The cost ledger: what each finished turn cost, in dollars, saved in a local SQLite file (decisions 24 to 26, 35).
// Claude Code reports running totals per session and per model. The ledger stores each turn as the difference
// between this total and the last one, so the same spend is never counted twice.
// Dollars are an estimate at list price, not a bill (decision 25).
use rusqlite::{params, Connection};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

#[derive(Default, Clone)]
struct Running {
    input: i64,
    output: i64,
    cache_read: i64,
    cache_write: i64,
    cost: f64,
}

pub struct Ledger {
    conn: Mutex<Connection>,
    /// session id -> model -> the running totals at the last result
    last: Mutex<HashMap<String, HashMap<String, Running>>>,
    turns: Mutex<HashMap<String, i64>>,
}

impl Ledger {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS usage_turn (
               id            INTEGER PRIMARY KEY,
               session_id    TEXT    NOT NULL,
               folder        TEXT,
               turn          INTEGER NOT NULL,
               at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
               model         TEXT    NOT NULL,
               input_tokens  INTEGER NOT NULL,
               output_tokens INTEGER NOT NULL,
               cache_read    INTEGER NOT NULL,
               cache_write   INTEGER NOT NULL,
               cost_usd      REAL    NOT NULL,
               cost_basis    TEXT,
               kind          TEXT    NOT NULL DEFAULT 'turn'
             );
             CREATE INDEX IF NOT EXISTS usage_turn_session ON usage_turn (session_id);",
        )?;
        // the role a turn was run as (added in 0.3.0; older files get the column now, with no value for old rows)
        let has_role = conn.prepare("SELECT 1 FROM pragma_table_info('usage_turn') WHERE name = 'role_id'")?.exists([])?;
        if !has_role {
            conn.execute("ALTER TABLE usage_turn ADD COLUMN role_id TEXT", [])?;
        }
        // the account a turn was run on (added in 0.4.0)
        let has_account = conn.prepare("SELECT 1 FROM pragma_table_info('usage_turn') WHERE name = 'account_id'")?.exists([])?;
        if !has_account {
            conn.execute("ALTER TABLE usage_turn ADD COLUMN account_id TEXT", [])?;
        }
        Ok(Self { conn: Mutex::new(conn), last: Mutex::new(HashMap::new()), turns: Mutex::new(HashMap::new()) })
    }

    /// Record one `result` message. Returns the dollars this turn added (the difference), for the screen.
    pub fn record_result(&self, session_id: &str, folder: &str, role_id: Option<&str>, account_id: Option<&str>, result: &Value) -> f64 {
        let Some(models) = result.get("modelUsage").and_then(Value::as_object) else { return 0.0 };
        let turn = {
            let mut t = self.turns.lock().unwrap();
            let n = t.entry(session_id.to_string()).or_insert(0);
            *n += 1;
            *n
        };
        let mut added = 0.0;
        let mut last = self.last.lock().unwrap();
        let per_model = last.entry(session_id.to_string()).or_default();
        let conn = self.conn.lock().unwrap();
        for (model, u) in models {
            let now = Running {
                input: u.get("inputTokens").and_then(Value::as_i64).unwrap_or(0),
                output: u.get("outputTokens").and_then(Value::as_i64).unwrap_or(0),
                cache_read: u.get("cacheReadInputTokens").and_then(Value::as_i64).unwrap_or(0),
                cache_write: u.get("cacheCreationInputTokens").and_then(Value::as_i64).unwrap_or(0),
                cost: u.get("costUSD").and_then(Value::as_f64).unwrap_or(0.0),
            };
            let before = per_model.get(model).cloned().unwrap_or_default();
            let mut d = Running {
                input: now.input - before.input,
                output: now.output - before.output,
                cache_read: now.cache_read - before.cache_read,
                cache_write: now.cache_write - before.cache_write,
                cost: now.cost - before.cost,
            };
            if d.input < 0 || d.output < 0 || d.cache_read < 0 || d.cache_write < 0 || d.cost < -1e-12 { d = now.clone(); }
            per_model.insert(model.clone(), now);
            if d.input == 0 && d.output == 0 && d.cache_read == 0 && d.cache_write == 0 && d.cost.abs() < 1e-12 {
                continue;
            }
            let basis = u.get("costBasis").and_then(Value::as_str);
            let _ = conn.execute(
                "INSERT INTO usage_turn (session_id, folder, turn, model, input_tokens, output_tokens, cache_read, cache_write, cost_usd, cost_basis, role_id, account_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![session_id, folder, turn, model, d.input, d.output, d.cache_read, d.cache_write, d.cost, basis, role_id, account_id],
            );
            added += d.cost;
        }
        added
    }
}

/// What one project's folder spent in one (local) hour: the points of the Costs page's chart for today.
#[derive(serde::Serialize)]
pub struct HourRow {
    pub folder: Option<String>,
    /// local time, `YYYY-MM-DD HH`
    pub hour: String,
    pub cost: f64,
}

/// One line of the cost views: what one session spent on one model on one (local) day.
#[derive(serde::Serialize)]
pub struct CostRow {
    pub session_id: String,
    pub folder: Option<String>,
    pub role_id: Option<String>,
    pub account_id: Option<String>,
    pub model: String,
    pub day: String,
    pub first_at: String,
    pub turns: i64,
    pub input: i64,
    pub output: i64,
    pub cache_read: i64,
    pub cache_write: i64,
    pub cost: f64,
}

impl Ledger {
    /// A session is being resumed. Its turn numbers go on from where they stopped. (The running totals do NOT carry the earlier spend: seen on
    /// 2026-10-28, after resuming a session that had cost $0.094 the first result's totals were $0.010, so a resumed process counts from zero
    /// and the plain difference is already right.)
    pub fn seed_resume(&self, session_id: &str) {
        let conn = self.conn.lock().unwrap();
        let n: i64 = conn.query_row("SELECT IFNULL(MAX(turn), 0) FROM usage_turn WHERE session_id = ?1", params![session_id], |r| r.get(0)).unwrap_or(0);
        self.turns.lock().unwrap().insert(session_id.to_string(), n);
    }

    /// A whole copy of the ledger in a new file, made by SQLite itself (safe while Kona runs).
    pub fn backup_to(&self, path: &Path) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("VACUUM INTO ?1", params![path.to_string_lossy()]).map(|_| ()).map_err(|e| format!("Could not copy the ledger: {e}"))
    }

    /// Record a one-shot call (a note written about a session): its dollars are its own, not a running total, so nothing is subtracted.
    /// It is saved under the session it was about, with kind `summary`, so the cost views can count it (and not as a turn).
    pub fn record_oneshot(&self, session_id: &str, folder: &str, role_id: Option<&str>, account_id: Option<&str>, kind: &str, result: &Value) -> f64 {
        let Some(models) = result.get("modelUsage").and_then(Value::as_object) else { return 0.0 };
        let conn = self.conn.lock().unwrap();
        let mut added = 0.0;
        for (model, u) in models {
            let g = |k: &str| u.get(k).and_then(Value::as_i64).unwrap_or(0);
            let cost = u.get("costUSD").and_then(Value::as_f64).unwrap_or(0.0);
            let _ = conn.execute(
                "INSERT INTO usage_turn (session_id, folder, turn, model, input_tokens, output_tokens, cache_read, cache_write, cost_usd, cost_basis, role_id, account_id, kind)
                 VALUES (?1, ?2, 0, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![session_id, folder, model, g("inputTokens"), g("outputTokens"), g("cacheReadInputTokens"), g("cacheCreationInputTokens"), cost, u.get("costBasis").and_then(Value::as_str), role_id, account_id, kind],
            );
            added += cost;
        }
        added
    }

    /// What these sessions cost in all, in dollars (for the cost shown on a ticket).
    pub fn cost_for_sessions(&self, ids: &[String]) -> f64 {
        let conn = self.conn.lock().unwrap();
        ids.iter().map(|id| conn.query_row("SELECT IFNULL(SUM(cost_usd), 0) FROM usage_turn WHERE session_id = ?1", params![id], |r| r.get::<_, f64>(0)).unwrap_or(0.0)).sum()
    }

    /// The ledger, summed per folder and local hour, from `since_day` (YYYY-MM-DD, local) on.
    pub fn cost_hours(&self, since_day: &str) -> Vec<HourRow> {
        let conn = self.conn.lock().unwrap();
        let Ok(mut st) = conn.prepare(
            "SELECT folder, strftime('%Y-%m-%d %H', at, 'localtime') AS hour, SUM(cost_usd)
             FROM usage_turn WHERE date(at, 'localtime') >= ?1 GROUP BY folder, hour ORDER BY hour",
        ) else { return vec![] };
        let rows = st.query_map(params![since_day], |r| Ok(HourRow { folder: r.get(0)?, hour: r.get(1)?, cost: r.get(2)? }));
        match rows { Ok(it) => it.filter_map(Result::ok).collect(), Err(_) => vec![] }
    }

    /// The ledger, summed per session, model and local day, from `since_day` (YYYY-MM-DD, local) on. The screen groups it any way it likes.
    pub fn cost_rows(&self, since_day: Option<&str>) -> Vec<CostRow> {
        let conn = self.conn.lock().unwrap();
        let Ok(mut st) = conn.prepare(
            "SELECT session_id, MAX(folder), MAX(role_id), MAX(account_id), model, date(at, 'localtime') AS day, MIN(at),
                    COUNT(DISTINCT CASE WHEN kind = 'turn' THEN turn END), SUM(input_tokens), SUM(output_tokens), SUM(cache_read), SUM(cache_write), SUM(cost_usd)
             FROM usage_turn WHERE (?1 IS NULL OR date(at, 'localtime') >= ?1)
             GROUP BY session_id, model, day ORDER BY MIN(at) DESC",
        ) else { return vec![] };
        let rows = st.query_map(params![since_day], |r| {
            Ok(CostRow {
                session_id: r.get(0)?, folder: r.get(1)?, role_id: r.get(2)?, account_id: r.get(3)?, model: r.get(4)?, day: r.get(5)?, first_at: r.get(6)?,
                turns: r.get(7)?, input: r.get(8)?, output: r.get(9)?, cache_read: r.get(10)?, cache_write: r.get(11)?, cost: r.get(12)?,
            })
        });
        match rows { Ok(it) => it.filter_map(Result::ok).collect(), Err(_) => vec![] }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cost_hours_sums_per_folder_and_hour() {
        let path = std::env::temp_dir().join(format!("kona-ledger-hours-{}", std::process::id())).join("kona.db");
        let _ = std::fs::remove_file(&path);
        let ledger = Ledger::open(&path).unwrap();
        {
            let conn = ledger.conn.lock().unwrap();
            // two turns in one hour, one two hours later, and one for another folder; minutes 20 and 25 stay in one hour in any time zone
            for (folder, at, cost) in [("/p/one", "2030-05-04T10:20:00.000Z", 0.25), ("/p/one", "2030-05-04T10:25:00.000Z", 0.50), ("/p/one", "2030-05-04T12:20:00.000Z", 1.0), ("/p/two", "2030-05-04T10:20:00.000Z", 4.0)] {
                conn.execute("INSERT INTO usage_turn (session_id, folder, turn, at, model, input_tokens, output_tokens, cache_read, cache_write, cost_usd) VALUES ('s', ?1, 1, ?2, 'm', 1, 1, 0, 0, ?3)", params![folder, at, cost]).unwrap();
            }
        }
        let rows = ledger.cost_hours("2000-01-01");
        let p1: Vec<f64> = rows.iter().filter(|r| r.folder.as_deref() == Some("/p/one")).map(|r| r.cost).collect();
        assert_eq!(p1.len(), 2, "two hours for the first folder: {:?}", rows.iter().map(|r| (&r.hour, r.cost)).collect::<Vec<_>>());
        assert!((p1[0] - 0.75).abs() < 1e-9 && (p1[1] - 1.0).abs() < 1e-9, "{p1:?}");
        assert_eq!(rows.iter().filter(|r| r.folder.as_deref() == Some("/p/two")).count(), 1);
        assert!(rows.iter().all(|r| r.hour.len() == 13), "the hour reads YYYY-MM-DD HH");
        assert!(ledger.cost_hours("2031-01-01").is_empty(), "nothing before the day asked for is counted");
    }
}
