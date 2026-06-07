require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

// ── Leave Policies ───────────────────────────────────────────────────────────
const policies = [
  {
    id: uuidv4(), leave_type: 'annual', label: 'Annual Leave',
    unit: 'days', eligibility_months: 6, annual_allowance: 22,
    full_pay_days: 22, half_pay_days: 0, unpaid_days: 0,
    allow_negative: 0, requires_certificate: 0, certificate_after_days: 0,
    rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1
  },
  {
    id: uuidv4(), leave_type: 'sick', label: 'Sick Leave',
    unit: 'days', eligibility_months: 3, annual_allowance: 90,
    full_pay_days: 15, half_pay_days: 30, unpaid_days: 45,
    allow_negative: 0, requires_certificate: 1, certificate_after_days: 2,
    rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1
  },
  {
    id: uuidv4(), leave_type: 'personal', label: 'Personal Time',
    unit: 'hours', eligibility_months: 12, annual_allowance: 12,
    full_pay_days: 12, half_pay_days: 0, unpaid_days: 0,
    allow_negative: 0, requires_certificate: 0, certificate_after_days: 0,
    rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1
  },
  {
    id: uuidv4(), leave_type: 'maternity', label: 'Maternity Leave',
    unit: 'days', eligibility_months: 0, annual_allowance: 90,
    full_pay_days: 90, half_pay_days: 0, unpaid_days: 0,
    allow_negative: 0, requires_certificate: 1, certificate_after_days: 0,
    rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1
  },
  {
    id: uuidv4(), leave_type: 'parental', label: 'Parental Leave',
    unit: 'days', eligibility_months: 0, annual_allowance: 5,
    full_pay_days: 5, half_pay_days: 0, unpaid_days: 0,
    allow_negative: 0, requires_certificate: 1, certificate_after_days: 0,
    rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1
  },
  {
    id: uuidv4(), leave_type: 'compassionate', label: 'Compassionate Leave',
    unit: 'days', eligibility_months: 0, annual_allowance: 5,
    full_pay_days: 5, half_pay_days: 0, unpaid_days: 0,
    allow_negative: 0, requires_certificate: 1, certificate_after_days: 0,
    rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1
  },
  {
    id: uuidv4(), leave_type: 'study', label: 'Study Leave',
    unit: 'days', eligibility_months: 24, annual_allowance: 10,
    full_pay_days: 10, half_pay_days: 0, unpaid_days: 0,
    allow_negative: 0, requires_certificate: 1, certificate_after_days: 0,
    rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1
  },
  {
    id: uuidv4(), leave_type: 'unpaid', label: 'Unpaid Leave',
    unit: 'days', eligibility_months: 0, annual_allowance: 0,
    full_pay_days: 0, half_pay_days: 0, unpaid_days: 999,
    allow_negative: 0, requires_certificate: 0, certificate_after_days: 0,
    rollover_days: 0, blackout_start: null, blackout_end: null, is_active: 1
  }
];

const insertPolicy = db.prepare(`
  INSERT OR IGNORE INTO leave_policies
  (id,leave_type,label,unit,eligibility_months,annual_allowance,
   full_pay_days,half_pay_days,unpaid_days,allow_negative,
   requires_certificate,certificate_after_days,rollover_days,
   blackout_start,blackout_end,is_active)
  VALUES
  (@id,@leave_type,@label,@unit,@eligibility_months,@annual_allowance,
   @full_pay_days,@half_pay_days,@unpaid_days,@allow_negative,
   @requires_certificate,@certificate_after_days,@rollover_days,
   @blackout_start,@blackout_end,@is_active)
`);

for (const p of policies) insertPolicy.run(p);
console.log('✅ Leave policies seeded');

// ── Demo Employees ────────────────────────────────────────────────────────────
const adminId = uuidv4();
const managerId = uuidv4();
const empId = uuidv4();

const insertEmployee = db.prepare(`
  INSERT OR IGNORE INTO employees
  (id,employee_number,full_name,email,password_hash,role,department,
   manager_id,hire_date,probation_end_date,is_active,basic_salary)
  VALUES
  (@id,@employee_number,@full_name,@email,@password_hash,@role,@department,
   @manager_id,@hire_date,@probation_end_date,@is_active,@basic_salary)
`);

const hash = (p) => bcrypt.hashSync(p, 10);

insertEmployee.run({
  id: adminId, employee_number: 'EMP001',
  full_name: 'Admin User', email: 'admin@company.com',
  password_hash: hash('Admin@123'), role: 'hr_admin',
  department: 'HR', manager_id: null,
  hire_date: '2020-01-01', probation_end_date: '2020-07-01',
  is_active: 1, basic_salary: 20000
});

insertEmployee.run({
  id: managerId, employee_number: 'EMP002',
  full_name: 'Sara Manager', email: 'sara@company.com',
  password_hash: hash('Manager@123'), role: 'manager',
  department: 'Engineering', manager_id: adminId,
  hire_date: '2021-03-15', probation_end_date: '2021-09-15',
  is_active: 1, basic_salary: 18000
});

insertEmployee.run({
  id: empId, employee_number: 'EMP003',
  full_name: 'John Employee', email: 'john@company.com',
  password_hash: hash('Employee@123'), role: 'employee',
  department: 'Engineering', manager_id: managerId,
  hire_date: '2023-06-01', probation_end_date: '2023-12-01',
  is_active: 1, basic_salary: 12000
});

console.log('✅ Demo employees seeded');
console.log('   admin@company.com  / Admin@123');
console.log('   sara@company.com   / Manager@123');
console.log('   john@company.com   / Employee@123');

// ── UAE Public Holidays 2025 ──────────────────────────────────────────────────
const holidays2025 = [
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-03-30', name: 'Eid Al Fitr (day 1)' },
  { date: '2025-03-31', name: 'Eid Al Fitr (day 2)' },
  { date: '2025-04-01', name: 'Eid Al Fitr (day 3)' },
  { date: '2025-06-06', name: 'Eid Al Adha (day 1)' },
  { date: '2025-06-07', name: 'Eid Al Adha (day 2)' },
  { date: '2025-06-08', name: 'Eid Al Adha (day 3)' },
  { date: '2025-06-26', name: 'Islamic New Year' },
  { date: '2025-09-04', name: "Prophet's Birthday" },
  { date: '2025-11-18', name: 'Commemoration Day' },
  { date: '2025-12-02', name: 'UAE National Day' },
  { date: '2025-12-03', name: 'UAE National Day (observed)' },
];

const insertHoliday = db.prepare(`
  INSERT OR IGNORE INTO public_holidays (id,date,name,year)
  VALUES (@id,@date,@name,@year)
`);

for (const h of holidays2025) {
  insertHoliday.run({ id: uuidv4(), date: h.date, name: h.name, year: 2025 });
}
console.log('✅ Public holidays seeded (2025)');
