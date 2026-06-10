const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const dayjs = require('dayjs');
const engine = require('../services/leaveEngine');

// ── GET /reports/deductions — monthly salary deduction report ─────────────────
router.get('/deductions', auth, rbac('hr_admin'), (req, res) => {
  // Default to current month
  const monthParam = req.query.month || dayjs().format('YYYY-MM'); // e.g. "2026-06"
  const [year, month] = monthParam.split('-');
  const startOfMonth = `${year}-${month}-01`;
  const endOfMonth   = dayjs(startOfMonth).endOf('month').format('YYYY-MM-DD');

  // All active employees
  const employees = db.prepare(
    "SELECT id, full_name, department, basic_salary FROM employees WHERE is_active = 1 ORDER BY department, full_name"
  ).all();

  const DAILY_DIVISOR  = 30;
  const HOURLY_DIVISOR = 30 * 8;

  const report = [];

  for (const emp of employees) {
    const dailyRate  = emp.basic_salary / DAILY_DIVISOR;
    const hourlyRate = emp.basic_salary / HOURLY_DIVISOR;

    // ── Leave-based deductions (approved requests overlapping this month) ────
    const leaveRows = db.prepare(`
      SELECT leave_type, unpaid_days, half_pay_days, paid_days, start_date, end_date, sub_type
      FROM leave_requests
      WHERE employee_id = ?
        AND status = 'approved'
        AND start_date <= ?
        AND end_date   >= ?
        AND (unpaid_days > 0 OR half_pay_days > 0)
    `).all(emp.id, endOfMonth, startOfMonth);

    let unpaidDays   = 0;
    let halfPayDays  = 0;
    const leaveItems = [];

    for (const row of leaveRows) {
      unpaidDays  += row.unpaid_days  || 0;
      halfPayDays += row.half_pay_days || 0;
      if ((row.unpaid_days || 0) > 0 || (row.half_pay_days || 0) > 0) {
        leaveItems.push({
          leave_type : row.leave_type,
          sub_type   : row.sub_type || null,
          start_date : row.start_date,
          end_date   : row.end_date,
          unpaid_days: row.unpaid_days || 0,
          half_pay_days: row.half_pay_days || 0,
          unpaid_deduction : Math.round((row.unpaid_days  || 0) * dailyRate  * 100) / 100,
          half_pay_deduction: Math.round((row.half_pay_days || 0) * dailyRate / 2 * 100) / 100,
        });
      }
    }

    // ── Personal time overage ────────────────────────────────────────────────
    const period    = dayjs(startOfMonth).month() < 6 ? `${year}-H1` : `${year}-H2`;
    const ptBalance = db.prepare(
      'SELECT allocated, used FROM personal_time_balances WHERE employee_id = ? AND period = ?'
    ).get(emp.id, period);

    let personalHoursOver = 0;
    let personalDeduction = 0;
    if (ptBalance && ptBalance.used > ptBalance.allocated) {
      personalHoursOver = Math.round((ptBalance.used - ptBalance.allocated) * 100) / 100;
      personalDeduction = Math.round(personalHoursOver * hourlyRate * 100) / 100;
    }

    const unpaidDeduction   = Math.round(unpaidDays  * dailyRate  * 100) / 100;
    const halfPayDeduction  = Math.round(halfPayDays * dailyRate / 2 * 100) / 100;
    const totalDeduction    = Math.round((unpaidDeduction + halfPayDeduction + personalDeduction) * 100) / 100;

    if (totalDeduction > 0) {
      report.push({
        employee_id      : emp.id,
        full_name        : emp.full_name,
        department       : emp.department,
        basic_salary     : emp.basic_salary,
        daily_rate       : Math.round(dailyRate  * 100) / 100,
        hourly_rate      : Math.round(hourlyRate * 100) / 100,
        unpaid_days,
        half_pay_days    : halfPayDays,
        personal_hours_over: personalHoursOver,
        unpaid_deduction,
        half_pay_deduction: halfPayDeduction,
        personal_deduction: personalDeduction,
        total_deduction  : totalDeduction,
        leave_items      : leaveItems,
      });
    }
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
    totalUnpaidDays += l.unpaid_days || 0;
    totalHalfPayDays += l.half_pay_days || 0;
    if ((l.unpaid_days || 0) > 0 || (l.half_pay_days || 0) > 0) {
      const dailyRate = l.leave_type === 'annual' ? fullSalary / 22 : fullSalary / 30;
      leaveItems.push({
        leave_type: l.leave_type,
        start_date: l.start_date,
        end_date: l.end_date,
        total_days: l.total_days,
        unpaid_days: l.unpaid_days,
        half_pay_days: l.half_pay_days,
        daily_rate: Math.round(dailyRate * 100) / 100,
        deduction: Math.round(((l.unpaid_days || 0) * dailyRate + (l.half_pay_days || 0) * dailyRate / 2) * 100) / 100,
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
router.get('/notifications', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE employee_id=? ORDER BY created_at DESC LIMIT 50')
    .all(req.user.id);
  res.json(rows);
});

router.patch('/notifications/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE id=? AND employee_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

router.patch('/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE employee_id=?').run(req.user.id);
  res.json({ message: 'All marked as read' });
});

module.exports = router;
