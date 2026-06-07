/**
 * Reminder Engine
 * Runs daily — generates notifications for:
 *  - Work anniversaries
 *  - Employee birthdays
 *  - Spouse birthdays
 *  - Kids' / siblings' birthdays
 * Notifies: the employee's manager + all HR admins
 */
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const NOTIFY_DAYS_BEFORE = [7, 1, 0]; // 7 days before, 1 day before, on the day

function isSameMonthDay(dateStr, today) {
  if (!dateStr) return null;
  const d = dayjs(dateStr);
  if (!d.isValid()) return null;
  return d.month() === today.month() && d.date() === today.date();
}

function daysUntil(dateStr, today) {
  if (!dateStr) return null;
  const d = dayjs(dateStr).year(today.year());
  let diff = d.diff(today, 'day');
  if (diff < 0) diff = dayjs(dateStr).year(today.year() + 1).diff(today, 'day');
  return diff;
}

function getRecipients(employee) {
  // Manager + all HR admins
  const recipients = new Set();
  if (employee.manager_id) recipients.add(employee.manager_id);
  const hrAdmins = db.prepare("SELECT id FROM employees WHERE role='hr_admin' AND is_active=1").all();
  for (const hr of hrAdmins) recipients.add(hr.id);
  return [...recipients];
}

function notify(recipientId, message, type) {
  // Avoid duplicate notifications on same day
  const existing = db.prepare(`
    SELECT id FROM notifications
    WHERE employee_id = ? AND type = ? AND message = ?
    AND date(created_at) = date('now')
  `).get(recipientId, type, message);
  if (existing) return;

  db.prepare('INSERT INTO notifications (id, employee_id, message, type) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), recipientId, message, type);
}

function runReminders() {
  const today = dayjs();
  let sent = 0;

  const employees = db.prepare(`
    SELECT e.*, m.full_name AS manager_name
    FROM employees e
    LEFT JOIN employees m ON m.id = e.manager_id
    WHERE e.is_active = 1
  `).all();

  for (const emp of employees) {
    const recipients = getRecipients(emp);
    if (recipients.length === 0) continue;

    // ── Work Anniversary ────────────────────────────────────────────────────
    const hireDay = dayjs(emp.hire_date);
    if (hireDay.isValid()) {
      const yearsToday  = today.year() - hireDay.year();
      const anniversary = hireDay.year(today.year());
      const diff = daysUntil(emp.hire_date, today);

      if (diff !== null && NOTIFY_DAYS_BEFORE.includes(diff)) {
        const years = yearsToday - (diff === 0 ? 0 : 0);
        const msg = diff === 0
          ? `🎉 Today is ${emp.full_name}'s ${years}-year work anniversary!`
          : `📅 ${emp.full_name}'s ${years}-year work anniversary is in ${diff} day${diff > 1 ? 's' : ''} (${anniversary.format('D MMM')}).`;
        for (const r of recipients) { notify(r, msg, 'work_anniversary'); sent++; }
      }
    }

    // ── Employee Birthday ───────────────────────────────────────────────────
    if (emp.date_of_birth) {
      const diff = daysUntil(emp.date_of_birth, today);
      if (diff !== null && NOTIFY_DAYS_BEFORE.includes(diff)) {
        const age = today.year() - dayjs(emp.date_of_birth).year() - (diff > 0 ? 0 : 0);
        const msg = diff === 0
          ? `🎂 Today is ${emp.full_name}'s birthday! (Turning ${age})`
          : `🎂 ${emp.full_name}'s birthday is in ${diff} day${diff > 1 ? 's' : ''} (${dayjs(emp.date_of_birth).format('D MMM')}).`;
        for (const r of recipients) { notify(r, msg, 'employee_birthday'); sent++; }
      }
    }

    // ── Marriage Anniversary ────────────────────────────────────────────────
    if (emp.marriage_anniversary) {
      const diff = daysUntil(emp.marriage_anniversary, today);
      if (diff !== null && NOTIFY_DAYS_BEFORE.includes(diff)) {
        const years = today.year() - dayjs(emp.marriage_anniversary).year() - (diff > 0 ? 1 : 0);
        const msg = diff === 0
          ? `💑 Today is ${emp.full_name}'s ${years > 0 ? years + '-year ' : ''}wedding anniversary!`
          : `💑 ${emp.full_name}'s wedding anniversary is in ${diff} day${diff > 1 ? 's' : ''} (${dayjs(emp.marriage_anniversary).format('D MMM')}).`;
        for (const r of recipients) { notify(r, msg, 'marriage_anniversary'); sent++; }
      }
    }

    // ── Spouse Birthday ─────────────────────────────────────────────────────
    if (emp.spouse_dob) {
      const diff = daysUntil(emp.spouse_dob, today);
      if (diff !== null && NOTIFY_DAYS_BEFORE.includes(diff)) {
        const spouseName = emp.spouse_name ? emp.spouse_name : `${emp.full_name}'s spouse`;
        const msg = diff === 0
          ? `💍 Today is ${spouseName}'s birthday — ${emp.full_name}'s spouse!`
          : `💍 ${spouseName}'s birthday (${emp.full_name}'s spouse) is in ${diff} day${diff > 1 ? 's' : ''} (${dayjs(emp.spouse_dob).format('D MMM')}).`;
        for (const r of recipients) { notify(r, msg, 'spouse_birthday'); sent++; }
      }
    }

    // ── Family Members (children, siblings) ─────────────────────────────────
    const family = db.prepare('SELECT * FROM family_members WHERE employee_id = ?').all(emp.id);
    for (const member of family) {
      if (!member.date_of_birth) continue;
      const diff = daysUntil(member.date_of_birth, today);
      if (diff === null || !NOTIFY_DAYS_BEFORE.includes(diff)) continue;

      const emoji  = member.relationship === 'child' ? '👶' : member.relationship === 'sibling' ? '👨‍👧' : '❤️';
      const relLabel = member.relationship.charAt(0).toUpperCase() + member.relationship.slice(1);
      const msg = diff === 0
        ? `${emoji} Today is ${member.name}'s birthday — ${emp.full_name}'s ${member.relationship}!`
        : `${emoji} ${member.name}'s birthday (${emp.full_name}'s ${relLabel}) is in ${diff} day${diff > 1 ? 's' : ''} (${dayjs(member.date_of_birth).format('D MMM')}).`;
      for (const r of recipients) { notify(r, msg, `${member.relationship}_birthday`); sent++; }
    }
  }

  if (sent > 0) console.log(`[Reminders] ${sent} notification(s) sent — ${today.format('YYYY-MM-DD')}`);
  return sent;
}

module.exports = { runReminders };
