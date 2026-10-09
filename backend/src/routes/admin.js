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

// ── GET /admin/export/birthdays — Excel download ──────────────────────────────
router.get('/export/birthdays', auth, rbac('hr_admin'), (req, res) => {
  const XLSX = require('xlsx');

  const employees = db.prepare(`
    SELECT full_name, employee_number, department, job_title,
           date_of_birth, spouse_name, spouse_dob, marriage_anniversary, hire_date
    FROM employees WHERE is_active = 1
    ORDER BY department, full_name
  `).all();

  const family = db.prepare(`
    SELECT f.name, f.relationship, f.date_of_birth, f.gender,
           e.full_name AS employee_name, e.department
    FROM family_members f
    JOIN employees e ON e.id = f.employee_id
    WHERE f.date_of_birth IS NOT NULL AND f.in_uae = 1
    ORDER BY e.department, e.full_name
  `).all();

  const fmt = (d) => d ? dayjs(d).format('DD MMM YYYY') : '';
  const nextBirthday = (dob) => {
    if (!dob) return '';
    const today = dayjs();
    let bd = dayjs(dob).year(today.year());
    if (bd.isBefore(today, 'day')) bd = bd.add(1, 'year');
    return bd.format('DD MMM YYYY');
  };

  // Sheet 1 — Employee birthdays
  const empRows = employees.map(e => ({
    'Employee #':        e.employee_number || '',
    'Full Name':         e.full_name,
    'Department':        e.department || '',
    'Job Title':         e.job_title || '',
    'Date of Birth':     fmt(e.date_of_birth),
    'Next Birthday':     nextBirthday(e.date_of_birth),
    'Spouse Name':       e.spouse_name || '',
    'Spouse DOB':        fmt(e.spouse_dob),
    'Spouse Next B\'day':nextBirthday(e.spouse_dob),
    'Marriage Anniversary': fmt(e.marriage_anniversary),
    'Hire Date':         fmt(e.hire_date),
  }));

  // Sheet 2 — Family members (children, siblings, etc.)
  const famRows = family.map(f => ({
    'Employee':        f.employee_name,
    'Department':      f.department || '',
    'Family Member':   f.name,
    'Relationship':    f.relationship,
    'Gender':          f.gender || '',
    'Date of Birth':   fmt(f.date_of_birth),
    'Next Birthday':   nextBirthday(f.date_of_birth),
  }));

  // Sheet 3 — All upcoming birthdays (next 365 days), sorted by date
  const allEvents = [];
  for (const e of employees) {
    if (e.date_of_birth) {
      const nb = nextBirthday(e.date_of_birth);
      allEvents.push({ 'Next Birthday': nb, 'Person': e.full_name, 'Relation': 'Employee', 'Department': e.department || '', 'Employee': e.full_name });
    }
    if (e.spouse_dob) {
      const nb = nextBirthday(e.spouse_dob);
      allEvents.push({ 'Next Birthday': nb, 'Person': e.spouse_name || 'Spouse', 'Relation': 'Spouse', 'Department': e.department || '', 'Employee': e.full_name });
    }
  }
  for (const f of family) {
    const nb = nextBirthday(f.date_of_birth);
    allEvents.push({ 'Next Birthday': nb, 'Person': f.name, 'Relation': f.relationship, 'Department': f.department || '', 'Employee': f.employee_name });
  }
  allEvents.sort((a, b) => dayjs(a['Next Birthday'], 'DD MMM YYYY').diff(dayjs(b['Next Birthday'], 'DD MMM YYYY')));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empRows),    'Employees');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(famRows),    'Family Members');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allEvents),  'Upcoming (All)');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="birthdays-${dayjs().format('YYYY-MM-DD')}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

module.exports = router;
