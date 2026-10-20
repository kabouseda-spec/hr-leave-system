const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const dayjs = require('dayjs');
const engine = require('../services/leaveEngine');

// ── GET /reports/deductions — monthly leave log + salary deduction report ──────
router.get('/deductions', auth, rbac('hr_admin'), (req, res) => {
  const monthParam = req.query.month || dayjs().format('YYYY-MM');
  const [year, month] = monthParam.split('-');
  const startOfMonth = `${year}-${month}-01`;
  const endOfMonth   = dayjs(startOfMonth).endOf('month').format('YYYY-MM-DD');

  const employees = db.prepare(
    "SELECT id, full_name, department, basic_salary FROM employees WHERE is_active = 1 ORDER BY department, full_name"
  ).all();

  const DAILY_DIVISOR  = 30;
  const HOURLY_DIVISOR = 30 * 8;
  const report = [];

  for (const emp of employees) {
    const dailyRate  = (emp.basic_salary || 0) / DAILY_DIVISOR;
    const hourlyRate = (emp.basic_salary || 0) / HOURLY_DIVISOR;

    // All approved leave requests overlapping this month
    const allLeaveRows = db.prepare(`
      SELECT leave_type, unpaid_days, half_pay_days, paid_days, total_days, start_date, end_date, sub_type
      FROM leave_requests
      WHERE employee_id = ?
        AND status = 'approved'
        AND start_date <= ?
        AND end_date   >= ?
    `).all(emp.id, endOfMonth, startOfMonth);

    let unpaidDays = 0, halfPayDays = 0, totalLeaveDays = 0;
    const leaveItems = [];

    for (const row of allLeaveRows) {
      const rowTotal = row.total_days || 0;

      // Heal corrupted records: if leave_type='unpaid' but unpaid_days=0 with paid_days>0,
      // the backdate bug stored paid instead of unpaid. Treat all days as unpaid.
      let rowUnpaid  = row.unpaid_days   || 0;
      let rowHalf    = row.half_pay_days || 0;
      let rowPaid    = row.paid_days     || 0;
      if (row.leave_type === 'unpaid' && rowUnpaid === 0 && rowTotal > 0) {
        rowUnpaid = rowTotal;
        rowPaid   = 0;
      }

      totalLeaveDays += rowTotal;
      unpaidDays     += rowUnpaid;
      halfPayDays    += rowHalf;
      leaveItems.push({
        leave_type        : row.leave_type,
        sub_type          : row.sub_type || null,
        start_date        : row.start_date,
        end_date          : row.end_date,
        total_days        : rowTotal,
        paid_days         : rowPaid,
        unpaid_days       : rowUnpaid,
        half_pay_days     : rowHalf,
        unpaid_deduction  : Math.round(rowUnpaid * dailyRate       * 100) / 100,
        half_pay_deduction: Math.round(rowHalf   * dailyRate / 2   * 100) / 100,
      });
    }

    // Personal time overage
    const period    = dayjs(startOfMonth).month() < 6 ? `${year}-H1` : `${year}-H2`;
    const ptBalance = db.prepare(
      'SELECT allocated, used FROM personal_time_balances WHERE employee_id = ? AND period = ?'
    ).get(emp.id, period);

    let personalHoursOver = 0, personalDeduction = 0;
    if (ptBalance && ptBalance.used > ptBalance.allocated) {
      personalHoursOver = Math.round((ptBalance.used - ptBalance.allocated) * 100) / 100;
      personalDeduction = Math.round(personalHoursOver * hourlyRate * 100) / 100;
    }

    const unpaidDeduction  = Math.round(unpaidDays  * dailyRate       * 100) / 100;
    const halfPayDeduction = Math.round(halfPayDays * dailyRate / 2   * 100) / 100;
    const totalDeduction   = Math.round((unpaidDeduction + halfPayDeduction + personalDeduction) * 100) / 100;

    // Include ALL employees — zero-deduction rows still appear in the monthly log
    report.push({
      employee_id         : emp.id,
      full_name           : emp.full_name,
      department          : emp.department,
      basic_salary        : emp.basic_salary || 0,
      daily_rate          : Math.round(dailyRate  * 100) / 100,
      hourly_rate         : Math.round(hourlyRate * 100) / 100,
      total_leave_days    : totalLeaveDays,
      unpaid_days,
      half_pay_days       : halfPayDays,
      personal_hours_over : personalHoursOver,
      unpaid_deduction,
      half_pay_deduction  : halfPayDeduction,
      personal_deduction  : personalDeduction,
      total_deduction     : totalDeduction,
      leave_items         : leaveItems,
    });
  }

  const grand_total = Math.round(report.reduce((s, r) => s + r.total_deduction, 0) * 100) / 100;
  res.json({ month: monthParam, report, grand_total });
});

// Full leave summary report (HR Admin / Manager)
router.get('/summary', auth, rbac('hr_admin', 'manager'), (req, res) => {
  const year = parseInt(req.query.year) || dayjs().year();
  const dept = req.query.department;

  let empWhere = req.user.role === 'manager' ? `AND e.manager_id = '${req.user.id}'` : '';
  if (dept) empWhere += ` AND e.department = '${dept}'`;

  const employees = db.prepare(`
    SELECT e.id, e.employee_number, e.full_name, e.department, e.hire_date, e.basic_salary
    FROM employees e
    WHERE e.is_active = 1 ${empWhere}
    ORDER BY e.department, e.full_name
  `).all();

  const leaveTypes = db.prepare("SELECT leave_type, label, unit FROM leave_policies WHERE is_active=1").all();

  const report = employees.map(emp => {
    const balances = {};
    for (const lt of leaveTypes) {
      const b = db.prepare('SELECT * FROM leave_balances WHERE employee_id=? AND leave_type=? AND year=?')
        .get(emp.id, lt.leave_type, year);
      balances[lt.leave_type] = b || { allocated: 0, used_paid: 0, used_half: 0, used_unpaid: 0, pending: 0 };
    }

    const noSickBonus = engine.checkNoSickLeaveBonus(emp.id, year);
    const gratuity = engine.calculateGratuity(emp);
    const basicPct = engine.getBasicSalaryPercentage(emp);

    return {
      ...emp,
      balances,
      noSickLeaveBonus: noSickBonus,
      gratuity,
      basicSalaryPercentage: basicPct,
    };
  });

  res.json({ year, report });
});

// Department breakdown
router.get('/departments', auth, rbac('hr_admin'), (req, res) => {
  const year = parseInt(req.query.year) || dayjs().year();
  const rows = db.prepare(`
    SELECT e.department,
           COUNT(DISTINCT e.id) AS headcount,
           COUNT(lr.id) AS total_requests,
           SUM(CASE WHEN lr.status='approved' THEN lr.total_days ELSE 0 END) AS total_days_taken,
           SUM(CASE WHEN lr.status='pending' THEN 1 ELSE 0 END) AS pending_count
    FROM employees e
    LEFT JOIN leave_requests lr ON lr.employee_id = e.id
      AND strftime('%Y', lr.start_date) = ?
    WHERE e.is_active = 1
    GROUP BY e.department
    ORDER BY e.department
  `).all(String(year));
  res.json(rows);
});

// Gratuity report
router.get('/gratuity', auth, rbac('hr_admin'), (req, res) => {
  const employees = db.prepare("SELECT * FROM employees WHERE is_active=1").all();
  const result = employees.map(emp => ({
    id: emp.id,
    name: emp.full_name,
    department: emp.department,
    hireDate: emp.hire_date,
    basicSalary: emp.basic_salary,
    ...engine.calculateGratuity(emp),
  }));
  res.json(result);
});

// No sick leave bonus — employees entitled to +4 annual leave next year
router.get('/no-sick-leave-bonus', auth, rbac('hr_admin'), (req, res) => {
  const year = parseInt(req.query.year) || dayjs().year() - 1;
  const employees = db.prepare("SELECT * FROM employees WHERE is_active=1").all();
  const eligible = employees.filter(emp => engine.checkNoSickLeaveBonus(emp.id, year));
  res.json({
    year,
    eligible: eligible.map(e => ({ id: e.id, name: e.full_name, department: e.department })),
    count: eligible.length,
  });
});

// Audit log
router.get('/audit', auth, rbac('hr_admin'), (req, res) => {
  const { entity_id, action, limit = 100 } = req.query;
  let where = [];
  const params = [];
  if (entity_id) { where.push('al.entity_id = ?'); params.push(entity_id); }
  if (action)    { where.push('al.action = ?'); params.push(action); }

  const rows = db.prepare(`
    SELECT al.*, e.full_name AS actor_name
    FROM audit_log al
    LEFT JOIN employees e ON e.id = al.actor_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY al.created_at DESC
    LIMIT ?
  `).all(...params, parseInt(limit));
  res.json(rows);
});

// ── GET /reports/payslip — monthly payslip for an employee ───────────────────
router.get('/payslip', auth, (req, res) => {
  const employeeId = req.query.employee_id || req.user.id;
  // Employees can only see their own
  if (req.user.role === 'employee' && employeeId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const monthParam = req.query.month || dayjs().format('YYYY-MM');
  const [year, month] = monthParam.split('-');
  const startOfMonth = `${year}-${month}-01`;
  const endOfMonth = dayjs(startOfMonth).endOf('month').format('YYYY-MM-DD');

  const emp = db.prepare('SELECT * FROM employees WHERE id=?').get(employeeId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const basicSalary = emp.basic_salary || 0;
  const hra = emp.hra || 0;
  const otherAllowance = emp.other_allowance || 0;
  const fullSalary = basicSalary + hra + otherAllowance;

  // Approved leaves this month with deductions
  const leaves = db.prepare(`
    SELECT leave_type, start_date, end_date, total_days, paid_days, half_pay_days, unpaid_days, is_half_day
    FROM leave_requests
    WHERE employee_id=? AND status='approved'
      AND start_date <= ? AND end_date >= ?
  `).all(employeeId, endOfMonth, startOfMonth);

  let totalUnpaidDays = 0, totalHalfPayDays = 0;
  const leaveItems = [];
  for (const l of leaves) {
    // Heal corrupted 'unpaid' records (backdate bug: paid stored instead of unpaid)
    let lUnpaid = l.unpaid_days || 0;
    let lHalf   = l.half_pay_days || 0;
    if (l.leave_type === 'unpaid' && lUnpaid === 0 && (l.total_days || 0) > 0) {
      lUnpaid = l.total_days;
    }
    totalUnpaidDays  += lUnpaid;
    totalHalfPayDays += lHalf;
    if (lUnpaid > 0 || lHalf > 0) {
      const dailyRate = l.leave_type === 'annual' ? fullSalary / 22 : fullSalary / 30;
      leaveItems.push({
        leave_type: l.leave_type,
        start_date: l.start_date,
        end_date: l.end_date,
        total_days: l.total_days,
        unpaid_days: lUnpaid,
        half_pay_days: lHalf,
        daily_rate: Math.round(dailyRate * 100) / 100,
        deduction: Math.round((lUnpaid * dailyRate + lHalf * dailyRate / 2) * 100) / 100,
      });
    }
  }

  // Personal time deduction
  const period = dayjs(startOfMonth).month() < 6 ? `${year}-H1` : `${year}-H2`;
  const ptBalance = db.prepare('SELECT allocated, used FROM personal_time_balances WHERE employee_id=? AND period=?').get(employeeId, period);
  const personalHoursOver = ptBalance && ptBalance.used > ptBalance.allocated ? ptBalance.used - ptBalance.allocated : 0;
  const hourlyRate = basicSalary / 30 / 8;
  const personalDeduction = Math.round(personalHoursOver * hourlyRate * 100) / 100;

  // Deduction totals
  const annualDailyRate = fullSalary / 22;
  const sickDailyRate = fullSalary / 30;
  const unpaidDeduction = leaveItems.reduce((s, l) => s + l.deduction, 0);
  const totalDeduction = Math.round((unpaidDeduction + personalDeduction) * 100) / 100;
  const netPay = Math.round((fullSalary - totalDeduction) * 100) / 100;

  // Accumulated gratuity
  const engine = require('../services/leaveEngine');
  const gratuity = engine.calculateGratuity(emp);

  res.json({
    month: monthParam,
    employee: { id: emp.id, name: emp.full_name, employee_number: emp.employee_number, department: emp.department, hire_date: emp.hire_date },
    salary: { basic: basicSalary, hra, other: otherAllowance, total: fullSalary },
    leaves: leaveItems,
    personal_time_deduction: personalDeduction,
    personal_hours_over: personalHoursOver,
    total_deduction: totalDeduction,
    net_pay: netPay,
    gratuity,
    working_days: 22,
  });
});

// Notifications
// Rules:
//   - Event types (birthday / anniversary):
//       new records: show from creation until event_date has passed (>= today)
//       legacy records without event_date: show only on creation day
//   - Action types (leave approved, comp granted, etc.): show until dismissed, max 30 days old
const EVENT_TYPES = `'employee_birthday','spouse_birthday','child_birthday','sibling_birthday',
                     'parent_birthday','other_birthday','work_anniversary','marriage_anniversary'`;

router.get('/notifications', auth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM notifications
      WHERE employee_id = ?
        AND COALESCE(dismissed, 0) = 0
        AND (
          (
            type IN (${EVENT_TYPES})
            AND (
              (event_date IS NOT NULL AND event_date >= date('now'))
              OR (event_date IS NULL AND date(created_at) = date('now'))
            )
          )
          OR
          (type NOT IN (${EVENT_TYPES}) AND created_at >= datetime('now', '-30 days'))
        )
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id);
    res.json(rows);
  } catch {
    const rows = db.prepare(`
      SELECT * FROM notifications
      WHERE employee_id = ?
        AND read = 0
        AND (
          (
            type IN (${EVENT_TYPES})
            AND (
              (event_date IS NOT NULL AND event_date >= date('now'))
              OR (event_date IS NULL AND date(created_at) = date('now'))
            )
          )
          OR
          (type NOT IN (${EVENT_TYPES}) AND created_at >= datetime('now', '-30 days'))
        )
      ORDER BY created_at DESC LIMIT 50
    `).all(req.user.id);
    res.json(rows);
  }
});

router.patch('/notifications/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE id=? AND employee_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

router.patch('/notifications/:id/dismiss', auth, (req, res) => {
  db.prepare('UPDATE notifications SET dismissed=1, read=1 WHERE id=? AND employee_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'Dismissed' });
});

router.patch('/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE employee_id=?').run(req.user.id);
  res.json({ message: 'All marked as read' });
});

module.exports = router;
