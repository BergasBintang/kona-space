// A small SQLite database in the page (sql.js, in memory only: nothing is saved, the Refresh button starts it again). A mockup needs this only when it must show
// searching, sorting, unique values or linked tables with real rules; otherwise plain data.js is enough.
//
//   <script src="sqlite/sql-wasm.js"></script>
//   <script src="sqlite/sql-wasm-data.js"></script>
//   <script src="sqlite/db.js"></script>
//
//   openDb(SCHEMA, SEED).then(function (db) {
//     var rows = db.all("SELECT * FROM users WHERE name LIKE ? ORDER BY name", ["%mira%"]);
//     try { db.run("INSERT INTO users (email) VALUES (?)", ["mira@example.test"]); } catch (e) { /* e.message: UNIQUE constraint failed: users.email */ }
//   });
//
// SCHEMA and SEED are strings of SQL. Write the schema from the project's real tables (same names, types, keys and unique rules), and the seed from made-up people only.
function openDb(schema, seed) {
  return initSqlJs({ wasmBinary: Uint8Array.from(atob(KONA_SQL_WASM), function (c) { return c.charCodeAt(0); }) }).then(function (SQL) {
    var db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON;");
    db.run(schema);
    if (seed) db.run(seed);
    return {
      /** every row of a query, as objects */
      all: function (sql, params) {
        var stmt = db.prepare(sql, params || []), out = [];
        try { while (stmt.step()) out.push(stmt.getAsObject()); } finally { stmt.free(); }
        return out;
      },
      /** one statement that changes data; a broken rule (unique, not null, foreign key) throws an Error whose message names it */
      run: function (sql, params) { db.run(sql, params || []); return db.getRowsModified(); }
    };
  });
}
