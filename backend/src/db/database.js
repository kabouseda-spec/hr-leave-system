require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './hr_leave.db';
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ── Run migrations to add any missing columns ─────────────────────────────────
const migrations = [
  // employees
  "ALTER TABLE employees ADD COLUMN rollover_month INTEGER",
  "ALTER TABLE employees ADD COLUMN end_of_service_date TEXT",
  "ALTER TABLE employees ADD COLUMN date_of_birth TEXT",
  "ALTER TABLE employees ADD COLUMN spouse_name TEXT",
  "ALTER TABLE employees ADD COLUMN spouse_dob TEXT",
  "ALTER TABLE employees ADD COLUMN spouse_in_uae INTEGER DEFAULT 0",
  "ALTER TABLE employees ADD COLUMN hra REAL DEFAULT 0",
  "ALTER TABLE employees ADD COLUMN other_allowance REAL DEFAULT 0",
  "ALTER TABLE employees ADD COLUMN marriage_anniversary TEXT",
  "ALTER TABLE employees ADD COLUMN passport_number TEXT",
  "ALTER TABLE employees ADD COLUMN passport_expiry TEXT",
  "ALTER TABLE employees ADD COLUMN visa_number TEXT",
  "ALTER TABLE employees ADD COLUMN visa_type TEXT",
  "ALTER TABLE employees ADD COLUMN visa_expiry TEXT",
  "ALTER TABLE employees ADD COLUMN visa_country TEXT DEFAULT 'UAE'",
  "ALTER TABLE employees ADD COLUMN visa_reminder_sent_90 INTEGER DEFAULT 0",
  "ALTER TABLE employees ADD COLUMN visa_reminder_sent_30 INTEGER DEFAULT 0",
  // leave_requests
  "ALTER TABLE leave_requests ADD COLUMN sub_type TEXT",
  "ALTER TABLE leave_requests ADD COLUMN certificate_path TEXT",
  // leave_balances
  "ALTER TABLE leave_balances ADD COLUMN period_start TEXT",
  "ALTER TABLE leave_balances ADD COLUMN period_end TEXT",
  // public_holidays
  "ALTER TABLE public_holidays ADD COLUMN end_date TEXT",
  // family_members table
  `CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL CHECK(relationship IN ('child','sibling','parent','other')),
    name TEXT NOT NULL,
    date_of_birth TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

for (const sql of migrations) {
  try { db.exec(sql); } catch(e) { /* column already exists — skip */ }
}


// node:sqlite returns null-prototype objects — convert them to plain objects
// so JSON.stringify and property checks work as expected.
function plain(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === 'object') return Object.assign({}, v);
  return v;
}

const origPrepare = db.prepare.bind(db);

db.prepare = function (sql) {
  const stmt = origPrepare(sql);
  return {
    run: (...args) => stmt.run(...args),
    get: (...args) => plain(stmt.get(...args)),
    all: (...args) => plain(stmt.all(...args)),
  };
};

module.exports = db;
