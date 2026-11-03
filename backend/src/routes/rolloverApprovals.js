const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /rollover-approvals — list (owner + hr_admin see all; employees see nothing)
router.get('/', auth, (req, res) => {
  if (req.user.role === 'employee') return res.json([]);

  const rows = db.prepare(`
    SELECT ra.*, e.full_name, e.department, e.employee_number
    FROM leave_rollover_approvals ra
    JOIN employees e ON e.id = ra.employee_id
    ORDER BY ra.created_at DESC
  `).all();
  res.json(rows);
});

// PATCH /rollover-approvals/:id/approve — owner only
router.patch('/:id/approve', auth, (req, res) => {
  if (!req.user.is_owner && req.user.role !== 'hr_admin') {
    return res.status(403).json({ error: 'Only the owner or HR admin can approve rollover requests.' });
  }

  const ra = db.prepare('SELECT * FROM leave_rollover_approvals WHERE id=?').get(req.params.id);
  if (!ra) return res.status(404).json({ error: 'Not found' });
  if (ra.status !== 'pending') return res.status(400).json({ error: 'Already resolved' });

  const { notes } = req.body;

  // Add the days as bonus_days to the NEXT year's balance
  const nextYear = ra.leave_year + 1;
  const emp = db.prepare('SELECT hire_date FROM employees WHERE id=?').get(ra.employee_id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const engine = require('../services/leaveEngine');
  const rollover = engine.getRolloverPeriod(emp.hire_date, `${nextYear}-06-01`);

  // Ensure next-year balance exists
  const existing = db.prepare('SELECT id FROM leave_balances WHERE employee_id=? AND leave_type=? AND year=?')
    .get(ra.employee_id, 'annual', rollover.year);
  if (!existing) {
    const employee = db.prepare('SELECT * FROM employees WHERE id=?').get(ra.employee_id);
    const allocated = engine.calculateAnnualLeaveAllowance(employee, `${nextYear}-06-01`);
    db.prepare('INSERT INTO leave_balances (id,employee_id,leave_type,year,period_start,period_end,allocated) VALUES (?,?,?,?,?,?,?)')
      .run(uuidv4(), ra.employee_id, 'annual', rollover.year, rollover.periodStart, rollover.periodEnd, allocated);
  }

  db.prepare(`UPDATE leave_balances SET bonus_days = COALESCE(bonus_days,0) + ?, updated_at=datetime('now')
    WHERE employee_id=? AND leave_type='annual' AND year=?`)
    .run(ra.remaining_days, ra.employee_id, rollover.year);

  db.prepare(`UPDATE leave_rollover_approvals SET status='approved', approved_by=?, approved_at=datetime('now'), notes=? WHERE id=?`)
    .run(req.user.id, notes || null, ra.id);

  // Notify the employee
  db.prepare('INSERT INTO notifications (id,employee_id,message,type) VALUES (?,?,?,?)')
    .run(uuidv4(), ra.employee_id,
      `✅ Your ${ra.remaining_days} unused annual leave day(s) from ${ra.leave_year} have been approved for rollover to ${nextYear}.`,
      'rollover_approved');

  res.json({ message: 'Rollover approved', daysAdded: ra.remaining_days, targetYear: rollover.year });
});

// PATCH /rollover-approvals/:id/reject — owner only
router.patch('/:id/reject', auth, (req, res) => {
  if (!req.user.is_owner && req.user.role !== 'hr_admin') {
    return res.status(403).json({ error: 'Only the owner or HR admin can reject rollover requests.' });
  }

  const ra = db.prepare('SELECT * FROM leave_rollover_approvals WHERE id=?').get(req.params.id);
  if (!ra) return res.status(404).json({ error: 'Not found' });
  if (ra.status !== 'pending') return res.status(400).json({ error: 'Already resolved' });

  const { notes } = req.body;
  db.prepare(`UPDATE leave_rollover_approvals SET status='rejected', approved_by=?, approved_at=datetime('now'), notes=? WHERE id=?`)
    .run(req.user.id, notes || null, ra.id);

  db.prepare('INSERT INTO notifications (id,employee_id,message,type) VALUES (?,?,?,?)')
    .run(uuidv4(), ra.employee_id,
      `❌ Your ${ra.remaining_days} unused annual leave day(s) from ${ra.leave_year} will not be rolled over — they have expired.`,
      'rollover_rejected');

  res.json({ message: 'Rollover rejected' });
});

module.exports = router;
