const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    const emps = db.prepare('SELECT email, role FROM employees LIMIT 5').all();
    const policies = db.prepare('SELECT COUNT(*) as c FROM leave_policies').get();
    res.json({ employees: emps, policyCount: policies?.c, nodeVersion: process.version });
  } catch(e) {
    res.json({ error: e.message });
  }
});

module.exports = router;
