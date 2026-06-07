const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

// ── GET /admin/holidays ───────────────────────────────────────────────────────
router.get('/holidays', auth, (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  const rows = db.prepare(
    'SELECT * FROM public_holidays WHERE year = ? ORDER BY date'
  ).all(Number(year));
  res.json(rows);
});

router.get('/holidays/years', auth, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT year FROM public_holidays ORDER BY year DESC').all();
  res.json(rows.map(r => r.year));
});

// ── POST /admin/holidays ──────────────────────────────────────────────────────
router.post('/holidays', auth, rbac('hr_admin'), (req, res) => {
  const { date, end_date, name } = req.body;
  if (!date || !name) return res.status(400).json({ error: 'date and name are required' });

  const startDay = dayjs(date);
  const endDay   = end_date ? dayjs(end_date) : startDay;

  if (endDay.isBefore(startDay)) {
    return res.status(400).json({ error: 'End date must be on or after start date' });
  }

  // Check for duplicate on start date
  const existing = db.prepare('SELECT id FROM public_holidays WHERE date = ?').get(date);
  if (existing) return res.status(409).json({ error: 'A holiday already exists starting on this date' });

  const year = startDay.year();
  const id = uuidv4();

  db.prepare('INSERT INTO public_holidays (id, date, end_date, name, year) VALUES (?, ?, ?, ?, ?)')
    .run(id, date, end_date || null, name.trim(), year);

  const days = endDay.diff(startDay, 'day') + 1;
  res.status(201).json({ id, date, end_date: end_date || date, name, year, days, message: 'Holiday added' });
});

// ── PATCH /admin/holidays/:id ─────────────────────────────────────────────────
router.patch('/holidays/:id', auth, rbac('hr_admin'), (req, res) => {
  const { date, end_date, name } = req.body;
  const holiday = db.prepare('SELECT * FROM public_holidays WHERE id = ?').get(req.params.id);
  if (!holiday) return res.status(404).json({ error: 'Not found' });

  const newDate    = date     || holiday.date;
  const newEndDate = end_date !== undefined ? end_date : holiday.end_date;
  const newName    = name     || holiday.name;
  const year       = new Date(newDate).getFullYear();

  db.prepare('UPDATE public_holidays SET date = ?, end_date = ?, name = ?, year = ? WHERE id = ?')
    .run(newDate, newEndDate || null, newName.trim(), year, req.params.id);

  res.json({ message: 'Holiday updated' });
});

// ── DELETE /admin/holidays/:id ────────────────────────────────────────────────
router.delete('/holidays/:id', auth, rbac('hr_admin'), (req, res) => {
  const holiday = db.prepare('SELECT id FROM public_holidays WHERE id = ?').get(req.params.id);
  if (!holiday) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM public_holidays WHERE id = ?').run(req.params.id);
  res.json({ message: 'Holiday deleted' });
});

module.exports = router;
