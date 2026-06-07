PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
-- EMPLOYEES (complete schema with all fields)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id                    TEXT PRIMARY KEY,
  employee_number       TEXT UNIQUE NOT NULL,
  full_name             TEXT NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK(role IN ('employee','manager','hr_admin')),
  department            TEXT NOT NULL,
  manager_id            TEXT REFERENCES employees(id),
  hire_date             TEXT NOT NULL,
  rollover_month        INTEGER,
  probation_end_date    TEXT,
  end_of_service_date   TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  basic_salary          REAL NOT NULL DEFAULT 0,
  -- Personal / family
  date_of_birth         TEXT,
  spouse_name           TEXT,
  spouse_dob            TEXT,
  marriage_anniversary  TEXT,
  -- Visa / passport
  passport_number       TEXT,
  passport_expiry       TEXT,
  visa_number           TEXT,
  visa_type             TEXT,
  visa_expiry           TEXT,
  visa_country          TEXT DEFAULT 'UAE',
  visa_reminder_sent_90 INTEGER DEFAULT 0,
  visa_reminder_sent_30 INTEGER DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- FAMILY MEMBERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_members (
  id            TEXT PRIMARY KEY,
  employee_id   TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  relationship  TEXT NOT NULL CHECK(relationship IN ('child','sibling','parent','other')),
  name          TEXT NOT NULL,
  date_of_birth TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- LEAVE POLICIES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_policies (
  id                     TEXT PRIMARY KEY,
  leave_type             TEXT UNIQUE NOT NULL,
  label                  TEXT NOT NULL,
  unit                   TEXT NOT NULL CHECK(unit IN ('days','hours')),
  eligibility_months     INTEGER NOT NULL DEFAULT 0,
  annual_allowance       REAL NOT NULL DEFAULT 0,
  full_pay_days          REAL NOT NULL DEFAULT 0,
  half_pay_days          REAL NOT NULL DEFAULT 0,
  unpaid_days            REAL NOT NULL DEFAULT 0,
  allow_negative         INTEGER NOT NULL DEFAULT 0,
  requires_certificate   INTEGER NOT NULL DEFAULT 0,
  certificate_after_days INTEGER NOT NULL DEFAULT 0,
  rollover_days          REAL NOT NULL DEFAULT 0,
  blackout_start         TEXT,
  blackout_end           TEXT,
  is_active              INTEGER NOT NULL DEFAULT 1
);

-- ─────────────────────────────────────────────
-- LEAVE BALANCES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_balances (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  leave_type   TEXT NOT NULL,
  year         INTEGER NOT NULL,
  period_start TEXT,
  period_end   TEXT,
  allocated    REAL NOT NULL DEFAULT 0,
  used_paid    REAL NOT NULL DEFAULT 0,
  used_half    REAL NOT NULL DEFAULT 0,
  used_unpaid  REAL NOT NULL DEFAULT 0,
  pending      REAL NOT NULL DEFAULT 0,
  bonus_days   REAL NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, leave_type, year)
);

-- ─────────────────────────────────────────────
-- LEAVE REQUESTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id                 TEXT PRIMARY KEY,
  employee_id        TEXT NOT NULL REFERENCES employees(id),
  leave_type         TEXT NOT NULL,
  sub_type           TEXT,
  start_date         TEXT NOT NULL,
  end_date           TEXT NOT NULL,
  total_days         REAL NOT NULL DEFAULT 0,
  hours              REAL,
  paid_days          REAL NOT NULL DEFAULT 0,
  half_pay_days      REAL NOT NULL DEFAULT 0,
  unpaid_days        REAL NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','approved','rejected','cancelled')),
  reason             TEXT,
  rejection_reason   TEXT,
  approved_by        TEXT REFERENCES employees(id),
  approved_at        TEXT,
  handover_confirmed INTEGER NOT NULL DEFAULT 0,
  certificate_path   TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- PERSONAL TIME LOG
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_time_log (
  id          TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  log_date    TEXT NOT NULL,
  hours_used  REAL NOT NULL,
  reason      TEXT,
  period      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK(status IN ('pending','approved','rejected')),
  approved_by TEXT REFERENCES employees(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- PERSONAL TIME BALANCES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_time_balances (
  id          TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  period      TEXT NOT NULL,
  allocated   REAL NOT NULL DEFAULT 6,
  used        REAL NOT NULL DEFAULT 0,
  deducted    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(employee_id, period)
);

-- ─────────────────────────────────────────────
-- PUBLIC HOLIDAYS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_holidays (
  id       TEXT PRIMARY KEY,
  date     TEXT UNIQUE NOT NULL,
  end_date TEXT,
  name     TEXT NOT NULL,
  year     INTEGER NOT NULL
);

-- ─────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES employees(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  message     TEXT NOT NULL,
  type        TEXT NOT NULL,
  read        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
