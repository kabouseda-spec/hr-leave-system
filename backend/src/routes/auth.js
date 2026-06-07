const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const employee = db.prepare('SELECT * FROM employees WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());
  if (!employee) return res.status(401).json({ error: 'Invalid credentials' });

  if (!bcrypt.compareSync(password, employee.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: employee.id, role: employee.role, department: employee.department, name: employee.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    token,
    user: {
      id: employee.id,
      name: employee.full_name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      employeeNumber: employee.employee_number,
    }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const employee = db.prepare('SELECT id,employee_number,full_name,email,role,department,hire_date,probation_end_date,basic_salary,manager_id FROM employees WHERE id = ?').get(req.user.id);
  if (!employee) return res.status(404).json({ error: 'Not found' });
  res.json(employee);
});

router.post('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, employee.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE employees SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.user.id);
  res.json({ message: 'Password updated' });
});

module.exports = router;
