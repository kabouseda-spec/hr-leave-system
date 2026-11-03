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

const NOTIFY_DAYS_BEFORE = [7, 0]; // 7 days advance warning + same-day reminder

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

function notify(recipientId, message, type, eventDate = null) {
  // Dedup: same recipient + same message + same day prevents double-firing.
  // Using message (not just type+event_date) so two employees sharing a birthday
  // both get their own notification for each manager/HR recipient.
  const existing = db.prepare(`
    SELECT id FROM notifications
    WHERE employee_id = ? AND type = ? AND date(created_at) = date('now')
      AND message = ?
  `).get(recipientId, type, message);
  if (existing) return;

  db.prepare('INSERT INTO notifications (id, employee_id, message, type, event_date) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), recipientId, message, type, eventDate);
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
        const eventDate = today.add(diff, 'day').format('YYYY-MM-DD');
        const years = yearsToday - (diff > 0 ? 1 : 0);
        const msg = diff === 0
          ? `🎉 Today is ${emp.full_name}'s ${years}-year work anniversary!`
          : `📅 ${emp.full_name}'s ${years + 1}-year work anniversary is in ${diff} day${diff > 1 ? 's' : ''} (${anniversary.format('D MMM')}).`;
        for (const r of recipients) { notify(r, msg, 'work_anniversary', eventDate); sent++; }
      }
    }

    // ── Employee Birthday ───────────────────────────────────────────────────
    if (emp.date_of_birth) {
      const diff = daysUntil(emp.date_of_birth, today);
      if (diff !== null && NOTIFY_DAYS_BEFORE.includes(diff)) {
        const eventDate = today.add(diff, 'day').format('YYYY-MM-DD');
        const age = today.year() - dayjs(emp.date_of_birth).year() - (diff > 0 ? 1 : 0);
        const msg = diff === 0
          ? `🎂 Today is ${emp.full_name}'s birthday! (Turning ${age})`
          : `🎂 ${emp.full_name}'s birthday is in ${diff} day${diff > 1 ? 's' : ''} (${dayjs(emp.date_of_birth).format('D MMM')}).`;
        for (const r of recipients) { notify(r, msg, 'employee_birthday', eventDate); sent++; }
      }
    }

    // ── Marriage Anniversary ────────────────────────────────────────────────
    if (emp.marriage_anniversary) {
      const diff = daysUntil(emp.marriage_anniversary, today);
      if (diff !== null && NOTIFY_DAYS_BEFORE.includes(diff)) {
        const eventDate = today.add(diff, 'day').format('YYYY-MM-DD');
        const years = today.year() - dayjs(emp.marriage_anniversary).year() - (diff > 0 ? 1 : 0);
        const msg = diff === 0
          ? `💑 Today is ${emp.full_name}'s ${years > 0 ? years + '-year ' : ''}wedding anniversary!`
          : `💑 ${emp.full_name}'s wedding anniversary is in ${diff} day${diff > 1 ? 's' : ''} (${dayjs(emp.marriage_anniversary).format('D MMM')}).`;
        for (const r of recipients) { notify(r, msg, 'marriage_anniversary', eventDate); sent++; }
      }
    }

    // ── Spouse Birthday (UAE only) ──────────────────────────────────────────
    if (emp.spouse_dob && emp.spouse_in_uae) {
      const diff = daysUntil(emp.spouse_dob, today);
      if (diff !== null && NOTIFY_DAYS_BEFORE.includes(diff)) {
        const eventDate = today.add(diff, 'day').format('YYYY-MM-DD');
        const spouseName = emp.spouse_name ? emp.spouse_name : `${emp.full_name}'s spouse`;
        const msg = diff === 0
          ? `💍 Today is ${spouseName}'s birthday — ${emp.full_name}'s spouse!`
          : `💍 ${spouseName}'s birthday (${emp.full_name}'s spouse) is in ${diff} day${diff > 1 ? 's' : ''} (${dayjs(emp.spouse_dob).format('D MMM')}).`;
        for (const r of recipients) { notify(r, msg, 'spouse_birthday', eventDate); sent++; }
      }
    }

    // ── Family Members — only those in UAE ──────────────────────────────────
    const family = db.prepare('SELECT * FROM family_members WHERE employee_id = ?').all(emp.id);
    for (const member of family) {
      if (!member.date_of_birth) continue;
      if (member.in_uae === 0) continue;
      const diff = daysUntil(member.date_of_birth, today);
      if (diff === null || !NOTIFY_DAYS_BEFORE.includes(diff)) continue;

      const eventDate = today.add(diff, 'day').format('YYYY-MM-DD');
      const emoji  = member.relationship === 'child' ? '👶' : member.relationship === 'sibling' ? '👨‍👧' : '❤️';
      const relLabel = member.relationship.charAt(0).toUpperCase() + member.relationship.slice(1);
      const msg = diff === 0
        ? `${emoji} Today is ${member.name}'s birthday — ${emp.full_name}'s ${member.relationship}!`
        : `${emoji} ${member.name}'s birthday (${emp.full_name}'s ${relLabel}) is in ${diff} day${diff > 1 ? 's' : ''} (${dayjs(member.date_of_birth).format('D MMM')}).`;
      for (const r of recipients) { notify(r, msg, `${member.relationship}_birthday`, eventDate); sent++; }
    }
  }

  if (sent > 0) console.log(`[Reminders] ${sent} notification(s) sent — ${today.format('YYYY-MM-DD')}`);
  return sent;
}

// ── Annual leave period expiry — unused days rollover notification ────────────
// Runs once a day. When an employee's annual leave period ends today and they
// have remaining days, creates a leave_rollover_approvals record and notifies
// the owner + all HR admins.
function checkAnnualLeaveExpiries() {
  const today = dayjs();
  const todayStr = today.format('YYYY-MM-DD');

  // Find annual leave balances whose period ends today or has just ended (within 3 days)
  const expiring = db.prepare(`
    SELECT lb.*, e.full_name, e.hire_date
    FROM leave_balances lb
    JOIN employees e ON e.id = lb.employee_id
    WHERE lb.leave_type = 'annual'
      AND lb.period_end IS NOT NULL
      AND lb.period_end BETWEEN date(?, '-3 days') AND ?
      AND e.is_active = 1
  `).all(todayStr, todayStr);

  for (const bal of expiring) {
    const remaining = (bal.allocated || 0) + (bal.bonus_days || 0)
                    - (bal.used_paid || 0) - (bal.used_half || 0) - (bal.used_unpaid || 0)
                    - (bal.pending || 0);
    if (remaining <= 0) continue;

    // Insert rollover approval request (UNIQUE constraint prevents duplicates)
    try {
      db.prepare(`INSERT INTO leave_rollover_approvals (id, employee_id, leave_year, remaining_days)
        VALUES (?, ?, ?, ?)`).run(uuidv4(), bal.employee_id, bal.year, remaining);
    } catch(e) { /* already exists — skip */ continue; }

    // Notify owners + HR admins
    const targets = db.prepare(`
      SELECT id FROM employees WHERE (is_owner = 1 OR role = 'hr_admin') AND is_active = 1
    `).all();
    for (const t of targets) {
      notify(t.id,
        `📋 Annual leave expiry: ${bal.full_name} has ${remaining.toFixed(1)} unused day(s) from the ${bal.year} period (ended ${bal.period_end}). Owner approval required to roll over.`,
        'annual_leave_expiry', todayStr);
    }
  }
}

// ── Notify manager + owner + HR when an employee's approved leave starts today ──
function checkLeavesToday() {
  const todayStr = dayjs().format('YYYY-MM-DD');
  const { sendEmail, leaveStartedEmail } = require('./emailService');

  const leavesStartingToday = db.prepare(`
    SELECT lr.*, e.full_name, e.department, e.manager_id
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    WHERE lr.status = 'approved'
      AND lr.start_date = ?
      AND e.is_active = 1
  `).all(todayStr);

  for (const leave of leavesStartingToday) {
    if (!leave.manager_id) continue;

    const notifMsg = `🏖️ ${leave.full_name} is on ${leave.leave_type} leave today (${leave.start_date}${leave.end_date !== leave.start_date ? ' – ' + leave.end_date : ''}, ${leave.total_days} day(s)).`;
    notify(leave.manager_id, notifMsg, 'employee_on_leave', todayStr);

    const manager = db.prepare('SELECT full_name, email FROM employees WHERE id=?').get(leave.manager_id);
    if (manager?.email) {
      const ccRows = db.prepare(`
        SELECT email FROM employees
        WHERE is_active = 1 AND email != ? AND (is_owner = 1 OR role = 'hr_admin')
      `).all(manager.email);
      const cc = ccRows.map(r => r.email).filter(Boolean).join(', ') || undefined;
      sendEmail({ to: manager.email, cc, ...leaveStartedEmail({
        managerName: manager.full_name,
        employeeName: leave.full_name,
        leaveType: leave.leave_type,
        startDate: leave.start_date,
        endDate: leave.end_date,
        totalDays: leave.total_days,
      })});
    }
  }
}

// ── 7-day advance reminder: email manager + CC owner + HR ────────────────────
function checkLeavesNextWeek() {
  const targetDate = dayjs().add(7, 'day').format('YYYY-MM-DD');
  const { sendEmail, leaveStartedEmail } = require('./emailService');

  const leavesNextWeek = db.prepare(`
    SELECT lr.*, e.full_name, e.department, e.manager_id
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    WHERE lr.status = 'approved'
      AND lr.start_date = ?
      AND e.is_active = 1
  `).all(targetDate);

  for (const leave of leavesNextWeek) {
    if (!leave.manager_id) continue;

    // In-app notification
    const notifMsg = `📅 Upcoming: ${leave.full_name} starts ${leave.leave_type} leave in 7 days (${leave.start_date}–${leave.end_date}, ${leave.total_days} day(s)).`;
    notify(leave.manager_id, notifMsg, 'leave_reminder_7d', targetDate);

    const manager = db.prepare('SELECT full_name, email FROM employees WHERE id=?').get(leave.manager_id);
    if (manager?.email) {
      const ccRows = db.prepare(`
        SELECT email FROM employees
        WHERE is_active = 1 AND email != ? AND (is_owner = 1 OR role = 'hr_admin')
      `).all(manager.email);
      const cc = ccRows.map(r => r.email).filter(Boolean).join(', ') || undefined;
      const tpl = leaveStartedEmail({
        managerName: manager.full_name,
        employeeName: leave.full_name,
        leaveType: leave.leave_type,
        startDate: leave.start_date,
        endDate: leave.end_date,
        totalDays: leave.total_days,
      });
      // Override subject to make clear this is a 7-day advance reminder
      sendEmail({ to: manager.email, cc, ...tpl, subject: `📅 7-Day Reminder — ${leave.full_name} on leave ${leave.start_date}` });
    }
  }
}

module.exports = { runReminders, checkAnnualLeaveExpiries, checkLeavesToday, checkLeavesNextWeek };
