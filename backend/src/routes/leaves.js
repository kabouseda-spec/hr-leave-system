const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const engine = require('../services/leaveEngine');

const n = v => (v === undefined ? null : v);

// ── File upload (medical certificates) ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    cb(null, `cert_${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ── Helper ────────────────────────────────────────────────────────────────────
function ensureBalance(employeeId, leaveType, year, periodStart, periodEnd, allocated) {
  const existing = db.prepare('SELECT id FROM leave_balances WHERE employee_id=? AND leave_type=? AND year=?')
    .get(employeeId, leaveType, year);
  if (!existing) {
    db.prepare('INSERT INTO leave_balances (id,employee_id,leave_type,year,period_start,period_end,allocated) VALUES (?,?,?,?,?,?,?)')
      .run(uuidv4(), employeeId, leaveType, year, periodStart || null, periodEnd || null, allocated || 0);
  }
}

// ── GET /leaves ───────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { status, year, employee_id } = req.query;
  const where = [], params = [];

  if (req.user.role === 'employee') {
    where.push('lr.employee_id = ?'); params.push(req.user.id);
  } else if (req.user.role === 'manager') {
    where.push('e.manager_id = ?'); params.push(req.user.id);
  } else if (employee_id) {
    where.push('lr.employee_id = ?'); params.push(employee_id);
  }

  if (status) { where.push('lr.status = ?'); params.push(status); }
  if (year)   { where.push("strftime('%Y', lr.start_date) = ?"); params.push(String(year)); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT lr.*, e.full_name, e.department, e.employee_number,
           a.full_name AS approved_by_name
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    LEFT JOIN employees a ON a.id = lr.approved_by
    ${whereClause}
    ORDER BY lr.created_at DESC
  `).all(...params);
  res.json(rows);
});

// ── POST /leaves ──────────────────────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  const { leave_type, start_date, end_date, hours, reason, sub_type } = req.body;
  if (!leave_type || !start_date) return res.status(400).json({ error: 'leave_type and start_date are required' });

  const employee = db.prepare('SELECT * FROM employees WHERE id=?').get(req.user.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const end = end_date || start_date;
  const result = engine.validateLeaveRequest({
    employee, leaveType: leave_type, startDate: start_date, endDate: end,
    hours: parseFloat(hours) || null, subType: sub_type,
  });

  if (!result.valid) {
    return res.status(422).json({ errors: result.errors, warnings: result.warnings });
  }

  // Resolve rollover period for balance
  const rollover = engine.getRolloverPeriod(employee.hire_date, start_date);
  const policy = db.prepare('SELECT * FROM leave_policies WHERE leave_type=?').get(leave_type);
  let allocated = policy ? policy.annual_allowance : 0;
  if (leave_type === 'annual') {
    allocated = engine.calculateAnnualLeaveAllowance(employee, start_date);
  }
  ensureBalance(employee.id, leave_type, rollover.year, rollover.periodStart, rollover.periodEnd, allocated);

  const id = uuidv4();
  // Sick leave auto-approves — no manager action needed
  const autoApprove = leave_type === 'sick';
  const initialStatus = autoApprove ? 'approved' : 'pending';

  db.prepare(`INSERT INTO leave_requests
    (id,employee_id,leave_type,sub_type,start_date,end_date,total_days,hours,paid_days,half_pay_days,unpaid_days,reason,status,approved_by,approved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, employee.id, leave_type, n(sub_type), start_date, end, result.totalDays,
         n(hours), result.paid, result.halfPay, result.unpaid, n(reason),
         initialStatus,
         autoApprove ? employee.id : null,
         autoApprove ? `datetime('now')` : null);

  if (autoApprove) {
    // Directly commit balance for sick leave
    db.prepare(`UPDATE leave_balances SET
      used_paid=used_paid+?, used_half=used_half+?, used_unpaid=used_unpaid+?,
      updated_at=datetime('now') WHERE employee_id=? AND leave_type=? AND year=?`)
      .run(result.paid, result.halfPay, result.unpaid, employee.id, leave_type, rollover.year);
  } else {
    // Mark as pending in balance
    db.prepare(`UPDATE leave_balances SET pending=pending+?, updated_at=datetime('now')
      WHERE employee_id=? AND leave_type=? AND year=?`)
      .run(result.totalDays, employee.id, leave_type, rollover.year);
  }

  // Notify manager
  if (employee.manager_id && !autoApprove) {
    db.prepare('INSERT INTO notifications (id,employee_id,message,type) VALUES (?,?,?,?)')
      .run(uuidv4(), employee.manager_id,
          `📋 ${employee.full_name} requested ${leave_type} leave from ${start_date} to ${end}.`, 'leave_request');
  }

  // Personal time: also update period balance
  if (leave_type === 'personal') {
    const period = engine.getPersonalTimePeriod(start_date);
    db.prepare('INSERT OR IGNORE INTO personal_time_balances (id,employee_id,period,allocated,used) VALUES (?,?,?,6,0)')
      .run(uuidv4(), employee.id, period);
  }

  res.status(201).json({
    id, totalDays: result.totalDays, paid: result.paid, halfPay: result.halfPay, unpaid: result.unpaid,
    warnings: result.warnings, certificateRequired: result.certificateRequired,
    message: 'Leave request submitted successfully.',
  });
});

// ── GET /leaves/:id ───────────────────────────────────────────────────────────
router.get('/:id', auth, (req, res) => {
  const row = db.prepare(`
    SELECT lr.*, e.full_name, e.department, e.employee_number, a.full_name AS approved_by_name
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    LEFT JOIN employees a ON a.id = lr.approved_by
    WHERE lr.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'employee' && row.employee_id !== req.user.id)
    return res.status(403).json({ error: 'Access denied' });
  res.json(row);
});

// ── PATCH /leaves/:id/approve ─────────────────────────────────────────────────
router.patch('/:id/approve', auth, rbac('manager', 'hr_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

  if (req.user.role === 'manager') {
    const emp = db.prepare('SELECT manager_id FROM employees WHERE id=?').get(row.employee_id);
    if (emp.manager_id !== req.user.id) return res.status(403).json({ error: 'Not your team member' });
  }

  const employee = db.prepare('SELECT hire_date FROM employees WHERE id=?').get(row.employee_id);
  const rollover = engine.getRolloverPeriod(employee.hire_date, row.start_date);

  db.prepare(`UPDATE leave_requests SET status='approved', approved_by=?, approved_at=datetime('now'),
    updated_at=datetime('now') WHERE id=?`).run(req.user.id, row.id);

  db.prepare(`UPDATE leave_balances SET
    pending=MAX(0,pending-?), used_paid=used_paid+?, used_half=used_half+?, used_unpaid=used_unpaid+?,
    updated_at=datetime('now') WHERE employee_id=? AND leave_type=? AND year=?`)
    .run(row.total_days, row.paid_days, row.half_pay_days, row.unpaid_days,
         row.employee_id, row.leave_type, rollover.year);

  // Commit personal time balance if applicable
  if (row.leave_type === 'personal' && row.hours) {
    const period = engine.getPersonalTimePeriod(row.start_date);
    db.prepare('UPDATE personal_time_balances SET used=used+? WHERE employee_id=? AND period=?')
      .run(row.hours, row.employee_id, period);
  }

  db.prepare('INSERT INTO notifications (id,employee_id,message,type) VALUES (?,?,?,?)')
    .run(uuidv4(), row.employee_id,
        `✅ Your ${row.leave_type} leave (${row.start_date} – ${row.end_date}) has been approved.`, 'leave_approved');

  db.prepare('INSERT INTO audit_log (id,actor_id,action,entity_type,entity_id) VALUES (?,?,?,?,?)')
    .run(uuidv4(), req.user.id, 'approve', 'leave_request', row.id);

  res.json({ message: 'Approved' });
});

// ── PATCH /leaves/:id/reject ──────────────────────────────────────────────────
router.patch('/:id/reject', auth, rbac('manager', 'hr_admin'), (req, res) => {
  const { rejection_reason } = req.body;
  const row = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'Not pending' });

  const employee = db.prepare('SELECT hire_date FROM employees WHERE id=?').get(row.employee_id);
  const rollover = engine.getRolloverPeriod(employee.hire_date, row.start_date);

  db.prepare(`UPDATE leave_requests SET status='rejected', rejection_reason=?,
    approved_by=?, approved_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
    .run(n(rejection_reason), req.user.id, row.id);

  db.prepare(`UPDATE leave_balances SET pending=MAX(0,pending-?), updated_at=datetime('now')
    WHERE employee_id=? AND leave_type=? AND year=?`)
    .run(row.total_days, row.employee_id, row.leave_type, rollover.year);

  db.prepare('INSERT INTO notifications (id,employee_id,message,type) VALUES (?,?,?,?)')
    .run(uuidv4(), row.employee_id,
        `❌ Your ${row.leave_type} leave (${row.start_date} – ${row.end_date}) was rejected.${rejection_reason ? ' Reason: ' + rejection_reason : ''}`, 'leave_rejected');

  res.json({ message: 'Rejected' });
});

// ── PATCH /leaves/:id/cancel ──────────────────────────────────────────────────
router.patch('/:id/cancel', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.employee_id !== req.user.id && req.user.role === 'employee')
    return res.status(403).json({ error: 'Access denied' });
  if (!['pending', 'approved'].includes(row.status))
    return res.status(400).json({ error: 'Cannot cancel this request' });

  const employee = db.prepare('SELECT hire_date FROM employees WHERE id=?').get(row.employee_id);
  const rollover = engine.getRolloverPeriod(employee.hire_date, row.start_date);

  db.prepare("UPDATE leave_requests SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(row.id);

  if (row.status === 'approved') {
    db.prepare(`UPDATE leave_balances SET
      used_paid=MAX(0,used_paid-?), used_half=MAX(0,used_half-?), used_unpaid=MAX(0,used_unpaid-?),
      updated_at=datetime('now') WHERE employee_id=? AND leave_type=? AND year=?`)
      .run(row.paid_days, row.half_pay_days, row.unpaid_days, row.employee_id, row.leave_type, rollover.year);
  } else {
    db.prepare(`UPDATE leave_balances SET pending=MAX(0,pending-?), updated_at=datetime('now')
      WHERE employee_id=? AND leave_type=? AND year=?`)
      .run(row.total_days, row.employee_id, row.leave_type, rollover.year);
  }
  res.json({ message: 'Cancelled' });
});

// ── POST /leaves/validate ─────────────────────────────────────────────────────
router.post('/validate', auth, (req, res) => {
  const { leave_type, start_date, end_date, hours, sub_type } = req.body;
  const employee = db.prepare('SELECT * FROM employees WHERE id=?').get(req.user.id);
  const result = engine.validateLeaveRequest({
    employee, leaveType: leave_type, startDate: start_date,
    endDate: end_date || start_date, hours: parseFloat(hours) || null,
    subType: sub_type,
  });
  res.json(result);
});

// ── POST /leaves/:id/certificate — upload medical certificate ─────────────────
router.post('/:id/certificate', auth, upload.single('certificate'), (req, res) => {
  const row = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Leave request not found' });
  if (row.employee_id !== req.user.id && req.user.role === 'employee') {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Accepted formats: PDF, JPG, PNG (max 10MB)' });

  db.prepare("UPDATE leave_requests SET certificate_path=?, updated_at=datetime('now') WHERE id=?")
    .run(req.file.filename, req.params.id);

  res.json({ message: 'Certificate uploaded successfully', filename: req.file.filename });
});

// ── GET /leaves/:id/certificate — download certificate (manager/HR) ───────────
router.get('/:id/certificate', auth, rbac('manager', 'hr_admin'), (req, res) => {
  const row = db.prepare('SELECT certificate_path FROM leave_requests WHERE id=?').get(req.params.id);
  if (!row || !row.certificate_path) return res.status(404).json({ error: 'No certificate on file' });
  const filePath = path.join(__dirname, '../../uploads', row.certificate_path);
  res.download(filePath);
});

// ── GET /leaves/meta/policies ─────────────────────────────────────────────────
router.get('/meta/policies', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM leave_policies WHERE is_active=1 ORDER BY label').all());
});

// ── GET /leaves/meta/calendar ─────────────────────────────────────────────────
router.get('/meta/calendar', auth, (req, res) => {
  const { month, year } = req.query;
  const y = year || new Date().getFullYear();
  const m = month ? String(month).padStart(2, '0') : null;

  let where = "lr.status='approved'";
  const params = [];

  if (req.user.role === 'manager') { where += ' AND e.manager_id=?'; params.push(req.user.id); }
  else if (req.user.role === 'employee') { where += ' AND lr.employee_id=?'; params.push(req.user.id); }

  if (m) {
    where += ` AND (strftime('%Y-%m',lr.start_date)=? OR strftime('%Y-%m',lr.end_date)=?)`;
    params.push(`${y}-${m}`, `${y}-${m}`);
  } else {
    where += ` AND strftime('%Y',lr.start_date)=?`; params.push(String(y));
  }

  const rows = db.prepare(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.total_days,
           e.full_name, e.department
    FROM leave_requests lr JOIN employees e ON e.id=lr.employee_id
    WHERE ${where} ORDER BY lr.start_date
  `).all(...params);
  res.json(rows);
});

module.exports = router;
