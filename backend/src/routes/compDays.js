const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const dayjs = require('dayjs');

// Grant a comp day to an employee (HR admin only)
router.post('/', auth, rbac('hr_admin'), (req, res) => {
  const { employee_id, granted_date, reason } = req.body;
  if (!employee_id || !granted_date) return res.status(400).json({ error: 'employee_id and granted_date required' });

  const emp = db.prepare('SELECT id, full_name FROM employees WHERE id=? AND is_active=1').get(employee_id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const id = uuidv4();
  db.prepare('INSERT INTO comp_days (id, employee_id, granted_date, reason, granted_by) VALUES (?,?,?,?,?)')
    .run(id, employee_id, granted_date, reason || null, req.user.id);

  // Notify the employee
  db.prepare('INSERT INTO notifications (id, employee_id, message, type) VALUES (?,?,?,?)')
    .run(uuidv4(), employee_id,
      `🎁 A compensatory day off has been granted to you for ${dayjs(granted_date).format('D MMM YYYY')}.${reason ? ' Reason: ' + reason : ''}`,
      'comp_day');

  res.status(201).json({ id, message: 'Comp day granted' });
});

// List comp days — hr_admin sees all, employee sees own
router.get('/', auth, (req, res) => {
  const { employee_id } = req.query;
  let where = '';
  const params = [];

  if (req.user.role === 'employee') {
    where = 'WHERE cd.employee_id = ?'; params.push(req.user.id);
  } else if (employee_id) {
    where = 'WHERE cd.employee_id = ?'; params.push(employee_id);
  }

  const rows = db.prepare(`
    SELECT cd.*, e.full_name, e.department, g.full_name AS granted_by_name
    FROM comp_days cd
    JOIN employees e ON e.id = cd.employee_id
    LEFT JOIN employees g ON g.id = cd.granted_by
    ${where}
    ORDER BY cd.granted_date DESC
  `).all(...params);

  res.json(rows);
});

// Delete a comp day (HR admin only)
router.delete('/:id', auth, rbac('hr_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM comp_days WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM comp_days WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
