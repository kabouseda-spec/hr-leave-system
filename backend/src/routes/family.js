const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router({ mergeParams: true });
const db = require('../db/database');
const auth = require('../middleware/auth');

const n = v => (v === undefined || v === '' ? null : v);

// Access check: employee can access their own, hr_admin/manager can access anyone
function canAccess(req, empId, requireWrite = false) {
  if (req.user.role === 'hr_admin') return true;
  if (req.user.role === 'manager' && !requireWrite) return true;
  if (req.user.id === empId) return true;
  return false;
}

// GET /api/employees/:id/family
router.get('/', auth, (req, res) => {
  if (!canAccess(req, req.params.id)) return res.status(403).json({ error: 'Access denied' });
  const members = db.prepare(
    'SELECT * FROM family_members WHERE employee_id = ? ORDER BY relationship, name'
  ).all(req.params.id);
  res.json(members);
});

// POST /api/employees/:id/family — employee or HR admin
router.post('/', auth, (req, res) => {
  if (!canAccess(req, req.params.id, true)) return res.status(403).json({ error: 'Access denied' });
  const { relationship, name, date_of_birth, gender } = req.body;
  if (!relationship || !name) return res.status(400).json({ error: 'relationship and name are required' });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO family_members (id, employee_id, relationship, name, date_of_birth, gender) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.params.id, relationship, name.trim(), n(date_of_birth), n(gender));

  res.status(201).json({ id, relationship, name: name.trim(), date_of_birth: n(date_of_birth), gender: n(gender) });
});

// PATCH /api/employees/:id/family/:memberId
router.patch('/:memberId', auth, (req, res) => {
  if (!canAccess(req, req.params.id, true)) return res.status(403).json({ error: 'Access denied' });
  const { name, date_of_birth, relationship } = req.body;
  db.prepare(`UPDATE family_members SET
    name = COALESCE(?, name),
    relationship = COALESCE(?, relationship),
    date_of_birth = COALESCE(?, date_of_birth)
    WHERE id = ? AND employee_id = ?`)
    .run(n(name), n(relationship), n(date_of_birth), req.params.memberId, req.params.id);
  res.json({ message: 'Updated' });
});

// DELETE /api/employees/:id/family/:memberId
router.delete('/:memberId', auth, (req, res) => {
  if (!canAccess(req, req.params.id, true)) return res.status(403).json({ error: 'Access denied' });
  db.prepare('DELETE FROM family_members WHERE id = ? AND employee_id = ?')
    .run(req.params.memberId, req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
