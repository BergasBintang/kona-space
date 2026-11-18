// Makes the demo database from nothing: four made-up people, one for each role. It runs at every start, so every start is clean.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const file = process.env.DEMO_DB ?? "demo.db";
fs.rmSync(file, { force: true });
const db = new DatabaseSync(file);
db.exec(`
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL);
CREATE TABLE classes (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
CREATE TABLE grades (user_id INTEGER, class_id INTEGER, score INTEGER);
CREATE TABLE parents (parent_id INTEGER, child_id INTEGER);
CREATE TABLE notes (id INTEGER PRIMARY KEY, user_id INTEGER, text TEXT);
INSERT INTO users VALUES (1, 'Ada Admin', 'admin@example.test', 'demo', 'admin'), (2, 'Tomas Teacher', 'teacher@example.test', 'demo', 'teacher'), (3, 'Sari Student', 'student@example.test', 'demo', 'student'), (4, 'Paulo Parent', 'parent@example.test', 'demo', 'parent');
INSERT INTO classes VALUES (1, 'Physics 1'), (2, 'Maths 2');
INSERT INTO grades VALUES (3, 1, 88), (3, 2, 93);
INSERT INTO parents VALUES (4, 3);
`);
console.log("demo database made: 4 people");
