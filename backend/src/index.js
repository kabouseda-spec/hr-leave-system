require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const engine = require('./services/leaveEngine');
const { runReminders } = require('./services/reminderEngine');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/auth',                  require('./routes/auth'));
app.use('/api/employees',             require('./routes/employees'));
app.use('/api/employees/:id/family',  require('./routes/family'));
app.use('/api/leaves',                require('./routes/leaves'));
app.use('/api/personal-time',         require('./routes/personalTime'));
app.use('/api/reports',               require('./routes/reports'));
app.use('/api/admin',                 require('./routes/admin'));

app.get('/api/health', (_, res) => {
  try {
    const db = require('./db/database');
    const empCount = db.prepare('SELECT COUNT(*) as c FROM employees').get();
    const polCount = db.prepare('SELECT COUNT(*) as c FROM leave_policies').get();
    res.json({ status: 'ok', ts: new Date().toISOString(), employees: empCount?.c, policies: polCount?.c });
  } catch(e) {
    res.json({ status: 'ok', ts: new Date().toISOString(), dbError: e.message });
  }
});

// One-time seed endpoint — safe to call multiple times (uses INSERT OR IGNORE)
app.post('/api/seed', (req, res) => {
  try {
    require('./db/seed');
    res.json({ message: 'Seed complete' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve built frontend
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Auto-seed on first run ────────────────────────────────────────────────────
try {
  const dbCheck = require('./db/database');
  const empCount = dbCheck.prepare('SELECT COUNT(*) as c FROM employees').get();
  if (empCount && empCount.c === 0) {
    console.log('📦 Fresh database — running seed...');
    require('./db/seed');
    console.log('✅ Database seeded');
  } else {
    console.log(`ℹ️  Database has ${empCount?.c} employees — skipping seed`);
  }
} catch(e) {
  console.error('⚠️  Seed error:', e.message);
}

app.listen(PORT, () => {
  console.log(`🚀 HR Leave API running on http://localhost:${PORT}`);

  // Auto-seed if database is empty
  try {
    const db = require('./db/database');
    const empCount = db.prepare('SELECT COUNT(*) as c FROM employees').get();
    if (empCount.c === 0) {
      console.log('📦 Empty database detected — running seed...');
      require('./db/seed');
      console.log('✅ Seed complete');
    }
  } catch(e) { console.error('Seed error:', e.message); }

  // Run all reminders on startup then every 24 hours
  const runAllReminders = () => {
    try { engine.checkVisaReminders(); } catch(e) {}
    try { runReminders(); } catch(e) {}
  };
  runAllReminders();
  setInterval(runAllReminders, 24 * 60 * 60 * 1000);
});
