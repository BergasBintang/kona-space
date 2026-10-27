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
        Ok(Self { conn: Mutex::new(conn), last: Mutex::new(HashMap::new()), turns: Mutex::new(HashMap::new()) })
    }

    /// Record one `result` message. Returns the dollars this turn added (the difference), for the screen.
    pub fn record_result(&self, session_id: &str, folder: &str, role_id: Option<&str>, result: &Value) -> f64 {
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
            let d = Running {
                input: now.input - before.input,
                output: now.output - before.output,
                cache_read: now.cache_read - before.cache_read,
                cache_write: now.cache_write - before.cache_write,
                cost: now.cost - before.cost,
            };
            per_model.insert(model.clone(), now);
            if d.input == 0 && d.output == 0 && d.cache_read == 0 && d.cache_write == 0 && d.cost.abs() < 1e-12 {
                continue;
            }
            let basis = u.get("costBasis").and_then(Value::as_str);
            let _ = conn.execute(
                "INSERT INTO usage_turn (session_id, folder, turn, model, input_tokens, output_tokens, cache_read, cache_write, cost_usd, cost_basis, role_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![session_id, folder, turn, model, d.input, d.output, d.cache_read, d.cache_write, d.cost, basis, role_id],
            );
            added += d.cost;
        }
        added
    }
}
