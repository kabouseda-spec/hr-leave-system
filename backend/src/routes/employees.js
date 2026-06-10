const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const engine = require('../services/leaveEngine');

// node:sqlite cannot bind undefined/empty/null-string for FK fields — convert to null
const n = v => (!v || v === 'undefined' || v === 'null' ? null : v);

const DEPARTMENTS = [
  'Top Management', 'HR', 'Engineering', 'AI', 'Design',
  'Accounting', 'Finance', 'Sales', 'Sales Admin', 'Marketing',
  'Shipping', 'Logistics', 'Operations', 'Execution', 'Legal',
];

// List employees
router.get('/', auth, rbac('hr_admin', 'manager'), (req, res) => {
  let where = req.user.role === 'manager' ? `WHERE e.manager_id = '${req.user.id}'` : 'WHERE e.is_active = 1';
  const rows = db.prepare(`
    SELECT e.id, e.employee_number, e.full_name, e.email, e.role, e.department,
           e.hire_date, e.rollover_month, e.probation_end_date, e.is_active,
           e.basic_salary, e.passport_number, e.passport_expiry,
           e.visa_number, e.visa_type, e.visa_expiry, e.visa_country,
           m.full_name AS manager_name
    FROM employees e
    LEFT JOIN employees m ON m.id = e.manager_id
    ${where}
    ORDER BY e.department, e.full_name
  `).all();
  res.json(rows);
});

// Create employee
router.post('/', auth, rbac('hr_admin'), (req, res) => {
  const {
    employee_number, full_name, email, password, role,
    department, manager_id, hire_date, probation_end_date, basic_salary, hra, other_allowance,
    passport_number, passport_expiry, visa_number, visa_type, visa_expiry, visa_country,
    date_of_birth, spouse_name, spouse_dob, spouse_in_uae, marriage_anniversary,
  } = req.body;

  if (!employee_number || !full_name || !email || !password || !role || !department || !hire_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const rollover_month = dayjs(hire_date).month() + 1; // 1-indexed

  try {
    db.prepare(`
      INSERT INTO employees
      (id,employee_number,full_name,email,password_hash,role,department,manager_id,
       hire_date,rollover_month,probation_end_date,basic_salary,hra,other_allowance,
       passport_number,passport_expiry,visa_number,visa_type,visa_expiry,visa_country,
       date_of_birth,spouse_name,spouse_dob,marriage_anniversary)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, employee_number, full_name, email.toLowerCase(), hash, role,
           department, n(manager_id), hire_date, rollover_month,
           n(probation_end_date), basic_salary || 0, hra || 0, other_allowance || 0,
           n(passport_number), n(passport_expiry),
           n(visa_number), n(visa_type), n(visa_expiry), visa_country || 'UAE',
           n(date_of_birth), n(spouse_name), n(spouse_dob), n(marriage_anniversary));

    // Initialise leave balances for current rollover period
    const rollover = engine.getRolloverPeriod(hire_date, dayjs().format('YYYY-MM-DD'));
    const policies = db.prepare('SELECT * FROM leave_policies WHERE is_active=1').all();
    for (const policy of policies) {
      let allocated = policy.annual_allowance;
      if (policy.leave_type === 'annual') {
        allocated = engine.calculateAnnualLeaveAllowance({ hire_date }, dayjs().format('YYYY-MM-DD'));
      }
      db.prepare(`INSERT OR IGNORE INTO leave_balances (id,employee_id,leave_type,year,period_start,period_end,allocated)
        VALUES (?,?,?,?,?,?,?)`)
        .run(uuidv4(), id, policy.leave_type, rollover.year,
             rollover.periodStart, rollover.periodEnd, allocated);
    }
    // Personal time periods
    const now = dayjs();
    for (const period of [`${now.year()}-H1`, `${now.year()}-H2`]) {
      db.prepare('INSERT OR IGNORE INTO personal_time_balances (id,employee_id,period,allocated,used) VALUES (?,?,?,6,0)')
        .run(uuidv4(), id, period);
    }

    res.status(201).json({ id, rollover_month, message: 'Employee created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email or employee number already exists' });
    throw err;
  }
});

// Get single employee
router.get('/:id', auth, (req, res) => {
  if (req.user.role === 'employee' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const emp = db.prepare(`
    SELECT e.*, m.full_name AS manager_name, m.email AS manager_email
    FROM employees e LEFT JOIN employees m ON m.id = e.manager_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  // Exclude password hash
  delete emp.password_hash;
  res.json(emp);
});

// Update employee
router.patch('/:id', auth, rbac('hr_admin'), (req, res) => {
  const {
    full_name, role, department, manager_id, hire_date, probation_end_date,
    basic_salary, hra, other_allowance, is_active, passport_number, passport_expiry,
    visa_number, visa_type, visa_expiry, visa_country, visa_issuing_company, end_of_service_date,
    labor_card_number, labor_card_expiry,
    temp_work_permit, temp_work_permit_date, temp_work_permit_expiry, temp_work_permit_company,
    date_of_birth, spouse_name, spouse_dob, spouse_in_uae, marriage_anniversary,
  } = req.body;

  // Recompute rollover_month if hire_date changes
  const existing = db.prepare('SELECT hire_date FROM employees WHERE id=?').get(req.params.id);
  const newHireDate = hire_date || existing?.hire_date;
  const rollover_month = dayjs(newHireDate).month() + 1;

  // If end_of_service_date is set, automatically deactivate the employee
  const effectiveIsActive = end_of_service_date ? 0 : n(is_active);

  db.prepare(`UPDATE employees SET
    full_name = COALESCE(?, full_name),
    role = COALESCE(?, role),
    department = COALESCE(?, department),
    manager_id = COALESCE(?, manager_id),
    hire_date = COALESCE(?, hire_date),
    rollover_month = ?,
    probation_end_date = COALESCE(?, probation_end_date),
    basic_salary = COALESCE(?, basic_salary),
    hra = COALESCE(?, hra),
    other_allowance = COALESCE(?, other_allowance),
    is_active = COALESCE(?, is_active),
    passport_number = COALESCE(?, passport_number),
    passport_expiry = COALESCE(?, passport_expiry),
    visa_number = COALESCE(?, visa_number),
    visa_type = COALESCE(?, visa_type),
    visa_expiry = COALESCE(?, visa_expiry),
    visa_country = COALESCE(?, visa_country),
    visa_issuing_company = COALESCE(?, visa_issuing_company),
    labor_card_number = COALESCE(?, labor_card_number),
    labor_card_expiry = COALESCE(?, labor_card_expiry),
    temp_work_permit = COALESCE(?, temp_work_permit),
    temp_work_permit_date = COALESCE(?, temp_work_permit_date),
    temp_work_permit_expiry = COALESCE(?, temp_work_permit_expiry),
    temp_work_permit_company = COALESCE(?, temp_work_permit_company),
    end_of_service_date = COALESCE(?, end_of_service_date),
    date_of_birth = COALESCE(?, date_of_birth),
    spouse_name = COALESCE(?, spouse_name),
    spouse_dob = COALESCE(?, spouse_dob),
    spouse_in_uae = COALESCE(?, spouse_in_uae),
    marriage_anniversary = COALESCE(?, marriage_anniversary),
    updated_at = datetime('now')
    WHERE id = ?`).run(
    n(full_name), n(role), n(department), n(manager_id), n(hire_date), rollover_month,
    n(probation_end_date), n(basic_salary), n(hra), n(other_allowance), effectiveIsActive,
    n(passport_number), n(passport_expiry), n(visa_number), n(visa_type), n(visa_expiry), n(visa_country), n(visa_issuing_company),
    n(labor_card_number), n(labor_card_expiry),
    temp_work_permit ? 1 : 0, n(temp_work_permit_date), n(temp_work_permit_expiry), n(temp_work_permit_company),
    n(end_of_service_date), n(date_of_birth), n(spouse_name), n(spouse_dob), spouse_in_uae ? 1 : 0, n(marriage_anniversary),
    req.params.id,
  );
  res.json({ message: 'Updated' });
});

// Get leave balances — rollover-aware
router.get('/:id/balances', auth, (req, res) => {
  if (req.user.role === 'employee' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const emp = db.prepare('SELECT hire_date FROM employees WHERE id=?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Not found' });

  // Use rollover period for annual leave, calendar year for others
  const rollover = engine.getRolloverPeriod(emp.hire_date, dayjs().format('YYYY-MM-DD'));

  const balances = db.prepare(`
    SELECT lb.*, lp.label, lp.unit, lp.full_pay_days, lp.half_pay_days, lp.unpaid_days
    FROM leave_balances lb
    JOIN leave_policies lp ON lp.leave_type = lb.leave_type
    WHERE lb.employee_id = ? AND lb.year = ?
    ORDER BY lp.label
  `).all(req.params.id, rollover.year);

  res.json({ balances, rollover });
});

// HR Admin balance override
router.patch('/:id/balances/:leaveType', auth, rbac('hr_admin'), (req, res) => {
  const { year, allocated, used_paid, used_half, used_unpaid, reason } = req.body;
  const emp = db.prepare('SELECT hire_date FROM employees WHERE id=?').get(req.params.id);
  const rollover = engine.getRolloverPeriod(emp.hire_date, dayjs().format('YYYY-MM-DD'));
  const y = year || rollover.year;

  const existing = db.prepare('SELECT id FROM leave_balances WHERE employee_id=? AND leave_type=? AND year=?')
    .get(req.params.id, req.params.leaveType, y);

  if (!existing) {
    db.prepare('INSERT INTO leave_balances (id,employee_id,leave_type,year,allocated,used_paid,used_half,used_unpaid) VALUES (?,?,?,?,?,?,?,?)')
      .run(uuidv4(), req.params.id, req.params.leaveType, y, allocated || 0, used_paid || 0, used_half || 0, used_unpaid || 0);
  } else {
    db.prepare(`UPDATE leave_balances SET
      allocated = COALESCE(?, allocated),
      used_paid = COALESCE(?, used_paid),
      used_half = COALESCE(?, used_half),
      used_unpaid = COALESCE(?, used_unpaid),
      updated_at = datetime('now')
      WHERE employee_id=? AND leave_type=? AND year=?`)
      .run(allocated, used_paid, used_half, used_unpaid, req.params.id, req.params.leaveType, y);
  }

  db.prepare('INSERT INTO audit_log (id,actor_id,action,entity_type,entity_id,new_value) VALUES (?,?,?,?,?,?)')
    .run(uuidv4(), req.user.id, 'balance_override', 'leave_balance',
        `${req.params.id}:${req.params.leaveType}:${y}`,
        JSON.stringify({ allocated, used_paid, used_half, used_unpaid, reason }));

  res.json({ message: 'Balance updated' });
});

// Employee self-update personal/family fields (own profile only)
router.patch('/me/personal', auth, (req, res) => {
  const { date_of_birth, spouse_name, spouse_dob, spouse_in_uae, marriage_anniversary } = req.body;
  db.prepare(`UPDATE employees SET
    date_of_birth = ?,
    spouse_name = ?,
    spouse_dob = ?,
    spouse_in_uae = ?,
    marriage_anniversary = ?,
    updated_at = datetime('now')
    WHERE id = ?`)
    .run(n(date_of_birth), n(spouse_name), n(spouse_dob), spouse_in_uae ? 1 : 0, n(marriage_anniversary), req.user.id);
  res.json({ message: 'Personal info updated' });
});

// HR Admin only — permanently delete an employee and all their data
router.delete('/:id', auth, rbac('hr_admin'), (req, res) => {
  const emp = db.prepare('SELECT id, full_name, email FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  // Prevent deleting yourself
  if (emp.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

  db.prepare('DELETE FROM leave_requests WHERE employee_id = ?').run(emp.id);
  db.prepare('DELETE FROM leave_balances WHERE employee_id = ?').run(emp.id);
  db.prepare('DELETE FROM personal_time_log WHERE employee_id = ?').run(emp.id);
  db.prepare('DELETE FROM personal_time_balances WHERE employee_id = ?').run(emp.id);
  db.prepare('DELETE FROM family_members WHERE employee_id = ?').run(emp.id);
  db.prepare('DELETE FROM notifications WHERE employee_id = ?').run(emp.id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(emp.id);

  db.prepare('INSERT INTO audit_log (id,actor_id,action,entity_type,entity_id,new_value) VALUES (?,?,?,?,?,?)')
    .run(uuidv4(), req.user.id, 'delete_employee', 'employee', emp.id, JSON.stringify({ email: emp.email, name: emp.full_name }));

  res.json({ message: `${emp.full_name} has been permanently deleted.` });
});

// Department list
router.get('/meta/departments', auth, (req, res) => res.json(DEPARTMENTS));

// Visa expiry check (called on demand or by scheduler)
router.post('/meta/check-visa-reminders', auth, rbac('hr_admin'), (req, res) => {
  const reminders = engine.checkVisaReminders();
  res.json({ checked: true, reminders });
});

module.exports = router;
