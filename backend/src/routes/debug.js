const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.get('/', (req, res) => {
  try {
    const emps = db.prepare('SELECT email, role, is_active FROM employees ORDER BY full_name').all();
    const policies = db.prepare('SELECT COUNT(*) as c FROM leave_policies').get();
    res.json({ employees: emps, policyCount: policies?.c, nodeVersion: process.version });
  } catch(e) {
    res.json({ error: e.message });
  }
});

// HR Admin only — permanently delete employee + all their data by email
router.delete('/employee/:email', auth, rbac('hr_admin'), (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const emp = db.prepare('SELECT id, full_name FROM employees WHERE LOWER(email) = ?').get(email);
    if (!emp) return res.status(404).json({ error: 'Not found: ' + email });

    db.prepare('DELETE FROM leave_requests WHERE employee_id = ?').run(emp.id);
    db.prepare('DELETE FROM leave_balances WHERE employee_id = ?').run(emp.id);
    db.prepare('DELETE FROM personal_time_log WHERE employee_id = ?').run(emp.id);
    db.prepare('DELETE FROM personal_time_balances WHERE employee_id = ?').run(emp.id);
    db.prepare('DELETE FROM family_members WHERE employee_id = ?').run(emp.id);
    db.prepare('DELETE FROM notifications WHERE employee_id = ?').run(emp.id);
    db.prepare('DELETE FROM employees WHERE id = ?').run(emp.id);

    res.json({ message: `✅ Deleted ${emp.full_name} (${email}) and all related data.` });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// HR Admin only — test email connection
router.post('/test-email', auth, rbac('hr_admin'), async (req, res) => {
  const { sendEmail } = require('../services/emailService');
  const to = req.body.to || req.user.email;
  await sendEmail({
    to,
    subject: '✅ HR System — Email Test',
    html: `<div style="font-family:Arial;padding:20px"><h2>Email is working!</h2><p>This is a test from the Kinetics Group HR Leave System.</p><p>Sent at: ${new Date().toISOString()}</p></div>`,
  });
  res.json({ message: `Test email sent to ${to}. Check inbox (and spam folder).` });
});

module.exports = router;
