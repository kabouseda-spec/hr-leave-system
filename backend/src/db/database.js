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
  "ALTER TABLE employees ADD COLUMN visa_issuing_company TEXT",
  "ALTER TABLE employees ADD COLUMN labor_card_number TEXT",
  "ALTER TABLE employees ADD COLUMN labor_card_expiry TEXT",
  "ALTER TABLE employees ADD COLUMN temp_work_permit INTEGER DEFAULT 0",
  "ALTER TABLE employees ADD COLUMN temp_work_permit_date TEXT",
  "ALTER TABLE employees ADD COLUMN temp_work_permit_expiry TEXT",
  "ALTER TABLE employees ADD COLUMN temp_work_permit_company TEXT",
  "ALTER TABLE family_members ADD COLUMN gender TEXT",
  "ALTER TABLE leave_requests ADD COLUMN is_half_day INTEGER DEFAULT 0",
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
  "ALTER TABLE leave_requests ADD COLUMN manager_approved_by TEXT",
  "ALTER TABLE leave_requests ADD COLUMN manager_approved_at TEXT",
  // leave_balances
  "ALTER TABLE leave_balances ADD COLUMN period_start TEXT",
  "ALTER TABLE leave_balances ADD COLUMN period_end TEXT",
  // public_holidays
  "ALTER TABLE public_holidays ADD COLUMN end_date TEXT",
  // notifications dismiss
  "ALTER TABLE notifications ADD COLUMN dismissed INTEGER DEFAULT 0",
  // family member UAE flag
  "ALTER TABLE family_members ADD COLUMN in_uae INTEGER DEFAULT 1",
  // compensatory days granted by admin
  `CREATE TABLE IF NOT EXISTS comp_days (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    granted_date TEXT NOT NULL,
    reason TEXT,
    granted_by TEXT REFERENCES employees(id),
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
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

// ── Seed new leave policy types (idempotent) ──────────────────────────────────
const { v4: _uuidv4 } = require('uuid');
const newPolicies = [
  { leave_type: 'business_trip', label: 'Business Trip', unit: 'days',
    eligibility_months: 0, annual_allowance: 0, full_pay_days: 999,
    half_pay_days: 0, unpaid_days: 0, allow_negative: 0,
    requires_certificate: 0, certificate_after_days: 0, rollover_days: 0,
    blackout_start: null, blackout_end: null, is_active: 1 },
  { leave_type: 'comp', label: 'Compensatory Off', unit: 'days',
    eligibility_months: 0, annual_allowance: 0, full_pay_days: 999,
    half_pay_days: 0, unpaid_days: 0, allow_negative: 0,
    requires_certificate: 0, certificate_after_days: 0, rollover_days: 0,
    blackout_start: null, blackout_end: null, is_active: 1 },
];
const _insertPolicy = db.prepare(`INSERT OR IGNORE INTO leave_policies
  (id,leave_type,label,unit,eligibility_months,annual_allowance,full_pay_days,half_pay_days,
   unpaid_days,allow_negative,requires_certificate,certificate_after_days,rollover_days,
   blackout_start,blackout_end,is_active)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
for (const p of newPolicies) {
  try {
    _insertPolicy.run(_uuidv4(), p.leave_type, p.label, p.unit, p.eligibility_months,
      p.annual_allowance, p.full_pay_days, p.half_pay_days, p.unpaid_days,
      p.allow_negative, p.requires_certificate, p.certificate_after_days,
      p.rollover_days, p.blackout_start, p.blackout_end, p.is_active);
  } catch(e) { /* already exists */ }
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
