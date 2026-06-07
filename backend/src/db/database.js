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

// Auto-seed on first run (runs after module fully loads via setImmediate)
setImmediate(() => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM employees').get();
    if (count && count.c === 0) {
      console.log('[DB] Empty database — seeding initial data...');
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');

      // Seed leave policies
      const policies = [
        { id: uuidv4(), leave_type: 'annual', label: 'Annual Leave', unit: 'days', eligibility_months: 6, annual_allowance: 22, full_pay_days: 22, half_pay_days: 0, unpaid_days: 0, allow_negative: 0, requires_certificate: 0, certificate_after_days: 0, rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1 },
        { id: uuidv4(), leave_type: 'sick', label: 'Sick Leave', unit: 'days', eligibility_months: 3, annual_allowance: 90, full_pay_days: 15, half_pay_days: 30, unpaid_days: 45, allow_negative: 0, requires_certificate: 1, certificate_after_days: 2, rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1 },
        { id: uuidv4(), leave_type: 'personal', label: 'Personal Time', unit: 'hours', eligibility_months: 12, annual_allowance: 12, full_pay_days: 12, half_pay_days: 0, unpaid_days: 0, allow_negative: 0, requires_certificate: 0, certificate_after_days: 0, rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1 },
        { id: uuidv4(), leave_type: 'maternity', label: 'Maternity Leave', unit: 'days', eligibility_months: 0, annual_allowance: 60, full_pay_days: 45, half_pay_days: 15, unpaid_days: 0, allow_negative: 0, requires_certificate: 1, certificate_after_days: 0, rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1 },
        { id: uuidv4(), leave_type: 'parental', label: 'Parental Leave', unit: 'days', eligibility_months: 0, annual_allowance: 5, full_pay_days: 5, half_pay_days: 0, unpaid_days: 0, allow_negative: 0, requires_certificate: 1, certificate_after_days: 0, rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1 },
        { id: uuidv4(), leave_type: 'compassionate', label: 'Compassionate Leave', unit: 'days', eligibility_months: 0, annual_allowance: 5, full_pay_days: 5, half_pay_days: 0, unpaid_days: 0, allow_negative: 0, requires_certificate: 1, certificate_after_days: 0, rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1 },
        { id: uuidv4(), leave_type: 'study', label: 'Study Leave', unit: 'days', eligibility_months: 24, annual_allowance: 10, full_pay_days: 10, half_pay_days: 0, unpaid_days: 0, allow_negative: 0, requires_certificate: 1, certificate_after_days: 0, rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1 },
        { id: uuidv4(), leave_type: 'unpaid', label: 'Unpaid Leave', unit: 'days', eligibility_months: 0, annual_allowance: 0, full_pay_days: 0, half_pay_days: 0, unpaid_days: 999, allow_negative: 0, requires_certificate: 0, certificate_after_days: 0, rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1 },
      ];
      const insPolicy = db.prepare('INSERT OR IGNORE INTO leave_policies (id,leave_type,label,unit,eligibility_months,annual_allowance,full_pay_days,half_pay_days,unpaid_days,allow_negative,requires_certificate,certificate_after_days,rollover_days,blackout_start,blackout_end,is_active) VALUES (@id,@leave_type,@label,@unit,@eligibility_months,@annual_allowance,@full_pay_days,@half_pay_days,@unpaid_days,@allow_negative,@requires_certificate,@certificate_after_days,@rollover_days,@blackout_start,@blackout_end,@is_active)');
      for (const p of policies) insPolicy.run(p);

      // Seed admin user
      const adminId = uuidv4();
      db.prepare('INSERT OR IGNORE INTO employees (id,employee_number,full_name,email,password_hash,role,department,hire_date,rollover_month,is_active,basic_salary) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
        adminId, 'EMP001', 'Admin User', 'admin@company.com',
        bcrypt.hashSync('Admin@123', 10), 'hr_admin', 'HR', '2020-01-01', 1, 1, 20000
      );
      const mgrId = uuidv4();
      db.prepare('INSERT OR IGNORE INTO employees (id,employee_number,full_name,email,password_hash,role,department,manager_id,hire_date,rollover_month,is_active,basic_salary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
        mgrId, 'EMP002', 'Sara Manager', 'sara@company.com',
        bcrypt.hashSync('Manager@123', 10), 'manager', 'Engineering', adminId, '2021-03-15', 3, 1, 18000
      );
      db.prepare('INSERT OR IGNORE INTO employees (id,employee_number,full_name,email,password_hash,role,department,manager_id,hire_date,rollover_month,is_active,basic_salary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
        uuidv4(), 'EMP003', 'John Employee', 'john@company.com',
        bcrypt.hashSync('Employee@123', 10), 'employee', 'Engineering', mgrId, '2023-06-01', 6, 1, 12000
      );

      console.log('[DB] ✅ Seed complete — admin@company.com / Admin@123');
    }
  } catch(e) {
    console.error('[DB] Seed error:', e.message);
  }
});

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
