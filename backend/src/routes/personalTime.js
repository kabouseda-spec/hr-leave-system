const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getPersonalTimePeriod } = require('../services/leaveEngine');

const n = v => (v === undefined ? null : v);

const HOURS_PER_PERIOD = 6;
const GRACE_MINUTES = 15;

function ensurePeriodBalance(employeeId, period, allocated) {
  const existing = db.prepare('SELECT id FROM personal_time_balances WHERE employee_id=? AND period=?')
    .get(employeeId, period);
  if (!existing) {
    db.prepare('INSERT INTO personal_time_balances (id,employee_id,period,allocated,used) VALUES (?,?,?,?,0)')
      .run(uuidv4(), employeeId, period, allocated || HOURS_PER_PERIOD);
  }
}

// Log personal time / late arrival
router.post('/', auth, (req, res) => {
  const { log_date, hours_used, reason } = req.body;
  if (!log_date || !hours_used) return res.status(400).json({ error: 'log_date and hours_used required' });

  const hrs = parseFloat(hours_used);
  if (hrs <= 0 || hrs > 8) return res.status(400).json({ error: 'hours_used must be between 0.01 and 8' });

  // Check employee eligibility (1 year)
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.id);
  const monthsWorked = dayjs(log_date).diff(dayjs(emp.hire_date), 'month');
  if (monthsWorked < 12) {
    return res.status(422).json({ error: 'Personal time tracking requires 1 year of service' });
  }

  const period = getPersonalTimePeriod(log_date);
  ensurePeriodBalance(emp.id, period, HOURS_PER_PERIOD);

  const balance = db.prepare('SELECT * FROM personal_time_balances WHERE employee_id=? AND period=?')
    .get(emp.id, period);

  const remaining = balance.allocated - balance.used;
  let deducted = false;

  if (hrs > remaining) {
    deducted = true;
  }

  const id = uuidv4();
  db.prepare(`INSERT INTO personal_time_log (id,employee_id,log_date,hours_used,reason,period,status)
    VALUES (?,?,?,?,?,?,'pending')`)
    .run(id, emp.id, log_date, hrs, n(reason), period);

  // Notify manager
  if (emp.manager_id) {
    db.prepare('INSERT INTO notifications (id,employee_id,message,type) VALUES (?,?,?,?)')
      .run(uuidv4(), emp.manager_id,
        `${emp.full_name} logged ${hrs}h personal time on ${log_date}${deducted ? ' (will exceed limit — salary deduction)' : ''}`,
        'personal_time');
  }

  res.status(201).json({
    id,
    period,
    used: balance.used,
    remaining: Math.max(0, remaining - hrs),
    willExceedLimit: deducted,
    message: deducted
      ? `Exceeds ${HOURS_PER_PERIOD}h limit — excess will be deducted from next payroll`
      : 'Personal time logged',
  });
});

// Approve / reject personal time entry (manager or HR)
router.patch('/:id/approve', auth, rbac('manager', 'hr_admin'), (req, res) => {
  const entry = db.prepare('SELECT * FROM personal_time_log WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  if (entry.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

  db.prepare("UPDATE personal_time_log SET status='approved', approved_by=? WHERE id=?")
    .run(req.user.id, entry.id);

  // Update balance
  ensurePeriodBalance(entry.employee_id, entry.period, HOURS_PER_PERIOD);
  const balance = db.prepare('SELECT * FROM personal_time_balances WHERE employee_id=? AND period=?')
    .get(entry.employee_id, entry.period);

  const newUsed = balance.used + entry.hours_used;
  const isDeducted = newUsed > balance.allocated ? 1 : 0;

  db.prepare('UPDATE personal_time_balances SET used=?, deducted=? WHERE employee_id=? AND period=?')
    .run(newUsed, isDeducted, entry.employee_id, entry.period);

  res.json({ message: 'Approved', newUsed, deducted: isDeducted });
});

router.patch('/:id/reject', auth, rbac('manager', 'hr_admin'), (req, res) => {
  const entry = db.prepare('SELECT * FROM personal_time_log WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  db.prepare("UPDATE personal_time_log SET status='rejected', approved_by=? WHERE id=?")
    .run(req.user.id, entry.id);
  res.json({ message: 'Rejected' });
});

// Get personal time balances
router.get('/balances', auth, (req, res) => {
  const employeeId = req.query.employee_id || req.user.id;
  if (req.user.role === 'employee' && employeeId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const balances = db.prepare('SELECT * FROM personal_time_balances WHERE employee_id=? ORDER BY period DESC')
    .all(employeeId);
  res.json(balances);
});

// List personal time log
router.get('/', auth, (req, res) => {
  const employeeId = req.query.employee_id;
  let where = '';
  const params = [];

  if (req.user.role === 'employee') {
    where = 'WHERE ptl.employee_id = ?'; params.push(req.user.id);
  } else if (req.user.role === 'manager') {
    where = `WHERE e.manager_id = ? ${employeeId ? 'AND ptl.employee_id = ?' : ''}`;
    params.push(req.user.id);
    if (employeeId) params.push(employeeId);
  } else if (employeeId) {
    where = 'WHERE ptl.employee_id = ?'; params.push(employeeId);
  }

  const rows = db.prepare(`
    SELECT ptl.*, e.full_name, e.department
    FROM personal_time_log ptl
    JOIN employees e ON e.id = ptl.employee_id
    ${where}
    ORDER BY ptl.log_date DESC
  `).all(...params);

  res.json(rows);
});

// Late arrival check (>15 min = personal time)
router.post('/late-arrival', auth, (req, res) => {
  const { log_date, minutes_late } = req.body;
  const mins = parseInt(minutes_late);
  if (mins <= GRACE_MINUTES) {
    return res.json({ action: 'none', message: 'Within 15-minute grace period' });
  }
  const hoursToCharge = Math.ceil((mins - GRACE_MINUTES) / 60 * 4) / 4; // quarter-hour increments
  return res.json({
    action: 'charge_personal_time',
    hours: hoursToCharge,
    message: `${mins} min late — ${hoursToCharge}h will be charged as personal time`,
  });
});

module.exports = router;
