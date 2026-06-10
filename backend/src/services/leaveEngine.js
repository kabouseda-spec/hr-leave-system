/**
 * Leave Rules Engine
 * Encodes all company + UAE labour law policies.
 */
const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
dayjs.extend(isBetween);

const db = require('../db/database');

// ── Compassionate leave allocation by relationship ────────────────────────────
const COMPASSIONATE_DAYS = {
  spouse: 5, child: 5, parent: 5, sibling: 5, grandparent: 3,
};

function getCompassionateAllowance(subType) {
  return COMPASSIONATE_DAYS[subType?.toLowerCase()] || 5;
}

// ── Public Holiday Cache (supports date ranges) ───────────────────────────────
function getHolidaySet(year) {
  const rows = db.prepare('SELECT date, end_date FROM public_holidays WHERE year = ?').all(year);
  const set = new Set();
  for (const r of rows) {
    let cur = dayjs(r.date);
    const end = r.end_date ? dayjs(r.end_date) : cur;
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      set.add(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }
  }
  return set;
}

function isWorkingDay(date, holidaySet) {
  const d = dayjs(date);
  const dow = d.day(); // 0=Sun, 6=Sat (UAE weekend)
  if (dow === 0 || dow === 6) return false;
  if (holidaySet.has(d.format('YYYY-MM-DD'))) return false;
  return true;
}

function countWorkingDays(startDate, endDate) {
  let count = 0;
  let cur = dayjs(startDate);
  const end = dayjs(endDate);
  const holidays = getHolidaySet(cur.year());
  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    if (isWorkingDay(cur, holidays)) count++;
    cur = cur.add(1, 'day');
  }
  return count;
}

function monthsBetween(startDate, refDate) {
  return dayjs(refDate).diff(dayjs(startDate), 'month');
}

// ── Rollover Period ───────────────────────────────────────────────────────────
// For annual leave, the leave "year" starts on the employee's hire-month anniversary.
// hire_date = 2022-02-15 → rollover month = 2 (February)
// For a request in 2026: rollover period = 2026-02-01 → 2027-01-31
// We store this as year = 2026 in leave_balances.

function getRolloverPeriod(hireDate, refDate) {
  const hire = dayjs(hireDate);
  const ref = dayjs(refDate || dayjs());
  const rolloverMonth = hire.month(); // 0-indexed

  // The rollover "year" is the calendar year when the current period started.
  let periodStartYear = ref.year();
  // If we haven't hit this year's rollover month yet, period started last year
  if (ref.month() < rolloverMonth) {
    periodStartYear = ref.year() - 1;
  }

  const periodStart = dayjs(`${periodStartYear}-${String(rolloverMonth + 1).padStart(2, '0')}-01`);
  const periodEnd = periodStart.add(1, 'year').subtract(1, 'day');

  return {
    year: periodStartYear,           // used as the key in leave_balances
    periodStart: periodStart.format('YYYY-MM-DD'),
    periodEnd: periodEnd.format('YYYY-MM-DD'),
    rolloverMonth: rolloverMonth + 1, // 1-indexed for display
  };
}

// ── Annual Leave Allowance ────────────────────────────────────────────────────
function calculateAnnualLeaveAllowance(employee, refDate) {
  const monthsWorked = monthsBetween(employee.hire_date, refDate || dayjs().format('YYYY-MM-DD'));
  if (monthsWorked < 6)  return 0;
  if (monthsWorked < 12) return Math.min((monthsWorked - 6) * 2, 14); // 2 days/month, months 6–11
  return 22; // Full 22 days from year 1 onwards
}

// ── Overlap Check ─────────────────────────────────────────────────────────────
function checkOverlap(employeeId, startDate, endDate, excludeId) {
  let sql = `
    SELECT id, leave_type, start_date, end_date, status
    FROM leave_requests
    WHERE employee_id = ?
      AND status IN ('pending', 'approved')
      AND start_date <= ?
      AND end_date   >= ?
  `;
  const params = [employeeId, endDate, startDate];
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }

  const conflicts = db.prepare(sql).all(...params);
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return {
      hasOverlap: true,
      reason: `Overlaps with an existing ${c.leave_type} leave request (${c.start_date} to ${c.end_date}, status: ${c.status}). You cannot request multiple leaves for the same dates.`,
    };
  }
  return { hasOverlap: false };
}

// ── Eligibility ───────────────────────────────────────────────────────────────
function checkEligibility(employee, leaveType, requestDate, subType) {
  const monthsWorked = monthsBetween(employee.hire_date, requestDate || dayjs().format('YYYY-MM-DD'));

  if (leaveType === 'annual') {
    if (monthsWorked < 6) return { eligible: false, reason: 'Annual leave requires at least 6 months of service.' };
  } else if (leaveType === 'sick') {
    if (employee.probation_end_date && dayjs(requestDate || dayjs()).isBefore(dayjs(employee.probation_end_date))) {
      return { eligible: false, reason: 'Sick leave is not available during the probation period.' };
    }
  } else if (leaveType === 'personal') {
    if (monthsWorked < 12) {
      const remaining = 12 - monthsWorked;
      return { eligible: false, reason: `Personal time is not available until 1 year of service. You have ${remaining} month(s) remaining before eligibility.` };
    }
  } else if (leaveType === 'study') {
    if (monthsWorked < 24) return { eligible: false, reason: 'Study leave requires 2 years of service.' };
  } else if (leaveType === 'compassionate') {
    if (!subType || !COMPASSIONATE_DAYS[subType.toLowerCase()]) {
      return { eligible: false, reason: 'Please select the relationship type for compassionate leave (spouse / child / parent / sibling / grandparent).' };
    }
  }
  return { eligible: true };
}

// ── Blackout Check ────────────────────────────────────────────────────────────
const BLACKOUTS = {
  accounting: { start: '11-30', end: '01-31', departments: ['Accounting', 'Finance'] },
  shipping:   { start: '10-31', end: '12-31', departments: ['Shipping', 'Logistics', 'Operations', 'Execution'] },
};

function checkBlackout(department, startDate, endDate) {
  const year = dayjs(startDate).year();
  for (const [, rule] of Object.entries(BLACKOUTS)) {
    if (!rule.departments.some(d => d.toLowerCase() === department.toLowerCase())) continue;
    const [sm, sd] = rule.start.split('-');
    const [em, ed] = rule.end.split('-');
    let bStart = dayjs(`${year}-${sm}-${sd}`);
    let bEnd   = parseInt(em) < parseInt(sm)
      ? dayjs(`${year + 1}-${em}-${ed}`)
      : dayjs(`${year}-${em}-${ed}`);
    const reqStart = dayjs(startDate);
    const reqEnd   = dayjs(endDate);
    if (reqStart.isBefore(bEnd) && reqEnd.isAfter(bStart)) {
      return { blocked: true, reason: `Leave is blocked during the ${department} blackout period (${rule.start} – ${rule.end}).` };
    }
  }
  return { blocked: false };
}

// ── Sick Leave Pay Calculation ────────────────────────────────────────────────
function calculateSickLeavePay(usedBefore, requestedDays) {
  const FULL_CAP = 15, HALF_CAP = 45; // 15+30
  let paid = 0, half = 0, unpaid = 0;
  let remaining = requestedDays, used = usedBefore;

  if (used < FULL_CAP) {
    const take = Math.min(remaining, FULL_CAP - used);
    paid = take; remaining -= take; used += take;
  }
  if (remaining > 0 && used < HALF_CAP) {
    const take = Math.min(remaining, HALF_CAP - used);
    half = take; remaining -= take; used += take;
  }
  if (remaining > 0) unpaid = remaining;
  return { paid, half, unpaid };
}

// ── Friday+Monday sick rule ───────────────────────────────────────────────────
function applyFridayMondayRule(startDate, endDate, leaveType) {
  if (leaveType !== 'sick') return { adjusted: false };
  const start = dayjs(startDate), end = dayjs(endDate);
  if (start.day() === 5 && end.day() === 1 && end.diff(start, 'day') === 3) {
    return { adjusted: true, days: 4, note: 'Friday + Monday sick leave counted as 4 days per policy.' };
  }
  return { adjusted: false };
}

// ── Department gap (annual leave, same dept, 5 working days apart) ────────────
function checkDepartmentGap(employeeId, department, startDate, leaveType) {
  if (leaveType !== 'annual') return { blocked: false };
  const nearby = db.prepare(`
    SELECT lr.start_date, e.full_name
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    WHERE e.department = ? AND lr.employee_id != ?
      AND lr.leave_type = 'annual' AND lr.status = 'approved'
      AND lr.start_date BETWEEN date(?, '-14 days') AND date(?, '+14 days')
  `).all(department, employeeId, startDate, startDate);

  for (const row of nearby) {
    const gap = Math.abs(dayjs(startDate).diff(dayjs(row.start_date), 'day'));
    if (gap < 5) {
      return { blocked: true, reason: `${row.full_name} already has approved annual leave within a 5 working-day window of your requested start date.` };
    }
  }
  return { blocked: false };
}

// ── 90-day full-leave gap ──────────────────────────────────────────────────────
function checkFullLeaveGap(employeeId, startDate) {
  const last = db.prepare(`
    SELECT end_date FROM leave_requests
    WHERE employee_id = ? AND leave_type = 'annual'
      AND total_days >= 22 AND status = 'approved'
    ORDER BY end_date DESC LIMIT 1
  `).get(employeeId);

  if (!last) return { blocked: false };
  const daysSince = dayjs(startDate).diff(dayjs(last.end_date), 'day');
  if (daysSince < 90) {
    return { blocked: true, reason: `A full 22-day annual leave requires a 90-day gap. Your last full leave ended on ${last.end_date}.` };
  }
  return { blocked: false };
}

// ── Personal time balance check ───────────────────────────────────────────────
function checkPersonalTimeBalance(employeeId, period, hoursRequested) {
  const balance = db.prepare('SELECT * FROM personal_time_balances WHERE employee_id=? AND period=?')
    .get(employeeId, period);
  const available = balance ? (balance.allocated - balance.used) : 6;
  if (hoursRequested > available) {
    return {
      blocked: true,
      reason: `Insufficient personal time. Available: ${available.toFixed(1)}h, Requested: ${hoursRequested}h. You cannot exceed your allocated personal time.`,
    };
  }
  return { blocked: false, available };
}

// ── Salary Deduction Calculator ───────────────────────────────────────────────
// Annual leave: full salary (basic + HRA + other) ÷ 22 working days
// Sick leave:   full salary ÷ 30 calendar days
// Personal time: basic salary ÷ 30 ÷ 8 per hour
function calculateDeduction(employee, unpaidDays, halfPayDays, hoursUnpaid, leaveType) {
  const basicSalary  = employee.basic_salary || 0;
  const fullSalary   = basicSalary + (employee.hra || 0) + (employee.other_allowance || 0);

  // Daily rate depends on leave type
  const divisor  = leaveType === 'annual' ? 22 : 30;
  const dailyRate  = Math.round((fullSalary / divisor) * 100) / 100;
  const hourlyRate = Math.round((basicSalary / 30 / 8) * 100) / 100;

  const unpaidDeduction   = Math.round(dailyRate * (unpaidDays || 0) * 100) / 100;
  const halfPayDeduction  = Math.round((dailyRate / 2) * (halfPayDays || 0) * 100) / 100;
  const personalDeduction = Math.round(hourlyRate * (hoursUnpaid || 0) * 100) / 100;
  const total             = Math.round((unpaidDeduction + halfPayDeduction + personalDeduction) * 100) / 100;

  return {
    dailyRate, hourlyRate, fullSalary,
    divisor,
    unpaidDeduction, halfPayDeduction, personalDeduction, total,
  };
}

// ── Main Validation ───────────────────────────────────────────────────────────
function validateLeaveRequest({ employee, leaveType, startDate, endDate, hours, subType, isHalfDay, excludeId }) {
  const errors = [], warnings = [];

  // 1. Overlap check
  const overlap = checkOverlap(employee.id, startDate, endDate || startDate, excludeId);
  if (overlap.hasOverlap) errors.push(overlap.reason);

  // 2. Eligibility
  const elig = checkEligibility(employee, leaveType, startDate, subType);
  if (!elig.eligible) errors.push(elig.reason);

  // 3. Blackout
  const blackout = checkBlackout(employee.department, startDate, endDate || startDate);
  if (blackout.blocked) errors.push(blackout.reason);

  // 4. Department gap (annual only)
  if (!overlap.hasOverlap) {
    const deptGap = checkDepartmentGap(employee.id, employee.department, startDate, leaveType);
    if (deptGap.blocked) errors.push(deptGap.reason);
  }

  // 5. Full leave 90-day gap
  const leaveGap = checkFullLeaveGap(employee.id, startDate);
  if (leaveGap.blocked) errors.push(leaveGap.reason);

  // 6. Notice period
  if (employee.notice_period_start) errors.push('Leave cannot be taken during a notice period.');

  // 7. Handover warning
  const daysUntil = dayjs(startDate).diff(dayjs(), 'day');
  if (leaveType === 'annual' && daysUntil < 7) {
    warnings.push('Policy requires a handover meeting at least 1 week before annual leave begins.');
  }

  // 8. Friday+Monday sick rule
  const fmRule = applyFridayMondayRule(startDate, endDate || startDate, leaveType);

  // 9. Calculate working days / hours
  let totalDays = 0;
  let personalHoursUnpaid = 0;

  if (leaveType === 'personal') {
    const hrs = parseFloat(hours) || 0;
    const period = getPersonalTimePeriod(startDate);
    const ptBalance = db.prepare('SELECT * FROM personal_time_balances WHERE employee_id=? AND period=?')
      .get(employee.id, period);
    const available = ptBalance ? (ptBalance.allocated - ptBalance.used) : 6;

    if (hrs > available) {
      // Over limit — block submission, show deduction preview
      personalHoursUnpaid = hrs - available;
      errors.push(`Insufficient personal time. Available: ${available.toFixed(1)}h, Requested: ${hrs}h. Excess ${personalHoursUnpaid.toFixed(1)}h will be deducted from salary.`);
    }
    totalDays = hrs / 8;
  } else {
    totalDays = countWorkingDays(startDate, endDate || startDate);
    if (fmRule.adjusted) { totalDays = fmRule.days; warnings.push(fmRule.note); }
    // Half day — override to 0.5
    if (isHalfDay) {
      totalDays = 0.5;
      warnings.push('Half-day leave: 0.5 days will be deducted from your balance.');
    }
  }

  // 10. Balance & pay classification
  let paid = 0, halfPay = 0, unpaid = 0;

  if (leaveType === 'unpaid') {
    // ── Explicit unpaid leave: ALWAYS 100% unpaid, never reclassified as paid ──
    paid = 0; halfPay = 0; unpaid = totalDays;

  } else if (leaveType === 'sick') {
    const rollover = getRolloverPeriod(employee.hire_date, startDate);
    const balance = db.prepare('SELECT * FROM leave_balances WHERE employee_id=? AND leave_type=? AND year=?')
      .get(employee.id, 'sick', rollover.year);
    const usedDays = balance ? (balance.used_paid + balance.used_half + balance.used_unpaid) : 0;
    const calc = calculateSickLeavePay(usedDays, totalDays);
    paid = calc.paid; halfPay = calc.half; unpaid = calc.unpaid;

  } else if (leaveType === 'annual') {
    const rollover = getRolloverPeriod(employee.hire_date, startDate);
    const balance = db.prepare('SELECT * FROM leave_balances WHERE employee_id=? AND leave_type=? AND year=?')
      .get(employee.id, 'annual', rollover.year);
    const allocated = balance ? balance.allocated : calculateAnnualLeaveAllowance(employee, startDate);
    const usedPaid  = balance ? balance.used_paid : 0;
    const pending   = balance ? balance.pending : 0;
    const remaining = allocated - usedPaid - pending;
    if (totalDays > remaining) {
      // Exceeds balance — remainder becomes unpaid (not blocked, just warned)
      paid   = Math.max(0, remaining);
      unpaid = totalDays - paid;
      warnings.push(`${unpaid.toFixed(1)} day(s) will be unpaid because your annual leave balance is insufficient.`);
    } else {
      paid = totalDays;
    }

  } else if (leaveType === 'personal') {
    paid = totalDays; // personal time is always paid when within allocation

  } else if (leaveType === 'maternity') {
    // 45 days full pay, next 15 days half pay
    const FULL_CAP = 45, HALF_CAP = 60;
    if (totalDays <= FULL_CAP) {
      paid = totalDays;
    } else if (totalDays <= HALF_CAP) {
      paid = FULL_CAP;
      halfPay = totalDays - FULL_CAP;
    } else {
      paid = FULL_CAP;
      halfPay = 15;
      unpaid = totalDays - HALF_CAP;
    }

  } else if (leaveType === 'compassionate') {
    // Allocation depends on relationship; beyond allocation → unpaid
    const allowance = getCompassionateAllowance(subType);
    if (totalDays <= allowance) {
      paid = totalDays;
    } else {
      paid = allowance;
      unpaid = totalDays - allowance;
      warnings.push(`Only ${allowance} day(s) are paid for ${subType || 'this'} compassionate leave. The remaining ${unpaid} day(s) will be unpaid.`);
    }

  } else {
    // parental, study — always fully paid within allocation
    paid = totalDays;
  }

  // 11. Certificate check
  let certificateRequired = false;
  if (leaveType === 'sick') {
    const policy = db.prepare('SELECT * FROM leave_policies WHERE leave_type=?').get('sick');
    if (totalDays >= (policy ? policy.certificate_after_days : 2)) {
      certificateRequired = true;
      warnings.push(`A medical certificate must be submitted within 48 hours (required for ${policy.certificate_after_days}+ sick days).`);
    }
  }

  // 12. Salary deduction calculation (shown to employee BEFORE submit)
  const deduction = calculateDeduction(employee, unpaid, halfPay, personalHoursUnpaid, leaveType);
  if (deduction.total > 0 && errors.length === 0) {
    const currency = 'AED';
    if (unpaid > 0 || halfPay > 0) {
      warnings.push(
        `💰 Salary impact: ${unpaid > 0 ? `${unpaid.toFixed(1)} unpaid day(s) = ${currency} ${deduction.unpaidDeduction.toLocaleString()} deducted` : ''}` +
        `${halfPay > 0 ? `${halfPay.toFixed(1)} half-pay day(s) = ${currency} ${deduction.halfPayDeduction.toLocaleString()} deducted` : ''}` +
        `. Total deduction from next payroll: ${currency} ${deduction.total.toLocaleString()}.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors, warnings,
    totalDays, paid, halfPay, unpaid,
    certificateRequired,
    deduction,          // full deduction breakdown
    salaryImpact: deduction.total > 0,
  };
}

// ── Gratuity ──────────────────────────────────────────────────────────────────
// Based on UAE Labour Law + company policy:
// < 1 year      : No gratuity
// 1 – 5 years   : 21 days' basic salary × years worked
// > 5 years     : (21 days × 5 years) + (30 days × additional years)
// Maximum cap   : 2 years' total wage (24 × basic monthly salary)
function calculateGratuity(employee) {
  const yearsWorked     = dayjs().diff(dayjs(employee.hire_date), 'year', true);
  const fullYears       = Math.floor(yearsWorked);
  const basicSalary     = employee.basic_salary || 0;
  const dailyRate       = Math.round((basicSalary / 30) * 100) / 100;
  const cap             = Math.round(basicSalary * 24 * 100) / 100; // 2 years' salary

  if (yearsWorked < 1) {
    return {
      eligible: false, amount: 0, yearsWorked,
      tier: 'none', breakdown: 'Less than 1 year of service — no gratuity entitlement.',
      dailyRate, basicSalary, cap,
    };
  }

  let gratuity, tier, breakdown;

  if (yearsWorked <= 5) {
    // Tier 1: 21 days per year
    gratuity = dailyRate * 21 * yearsWorked;
    tier = '1-5 years';
    breakdown = `21 days × AED ${dailyRate}/day × ${yearsWorked.toFixed(2)} years`;
  } else {
    // Tier 2: 21 days × 5 years + 30 days × additional years
    const first5     = dailyRate * 21 * 5;
    const additional = dailyRate * 30 * (yearsWorked - 5);
    gratuity = first5 + additional;
    tier = 'over 5 years';
    breakdown = `(21 days × AED ${dailyRate}/day × 5 years) + (30 days × AED ${dailyRate}/day × ${(yearsWorked - 5).toFixed(2)} years)`;
  }

  const capped      = gratuity > cap;
  const finalAmount = Math.round(Math.min(gratuity, cap) * 100) / 100;

  return {
    eligible: true,
    amount: finalAmount,
    rawAmount: Math.round(gratuity * 100) / 100,
    yearsWorked,
    fullYears,
    tier,
    breakdown,
    capped,
    cap,
    dailyRate,
    basicSalary,
  };
}

// ── Basic salary percentage ───────────────────────────────────────────────────
function getBasicSalaryPercentage(employee) {
  const y = dayjs().diff(dayjs(employee.hire_date), 'year');
  if (y >= 25) return 0.50;
  if (y >= 20) return 0.45;
  if (y >= 15) return 0.40;
  if (y >= 5)  return 0.35;
  return null;
}

// ── No sick leave bonus ───────────────────────────────────────────────────────
function checkNoSickLeaveBonus(employeeId, year) {
  const r = db.prepare(`
    SELECT COALESCE(SUM(used_paid+used_half+used_unpaid),0) as total
    FROM leave_balances WHERE employee_id=? AND leave_type='sick' AND year=?
  `).get(employeeId, year);
  return (r && r.total === 0);
}

// ── Personal time period (H1/H2) ─────────────────────────────────────────────
function getPersonalTimePeriod(date) {
  const d = dayjs(date);
  return `${d.year()}-${d.month() < 6 ? 'H1' : 'H2'}`;
}

// ── Visa expiry reminders ─────────────────────────────────────────────────────
function checkVisaReminders() {
  const today = dayjs();
  const employees = db.prepare("SELECT * FROM employees WHERE is_active=1 AND visa_expiry IS NOT NULL").all();
  const { v4: uuidv4 } = require('uuid');
  const reminders = [];

  for (const emp of employees) {
    const expiry = dayjs(emp.visa_expiry);
    const daysLeft = expiry.diff(today, 'day');

    // 90-day: notify HR admins
    if (daysLeft <= 90 && daysLeft > 0 && !emp.visa_reminder_sent_90) {
      const hrAdmins = db.prepare("SELECT id FROM employees WHERE role='hr_admin' AND is_active=1").all();
      for (const hr of hrAdmins) {
        db.prepare("INSERT INTO notifications (id,employee_id,message,type) VALUES (?,?,?,?)")
          .run(uuidv4(), hr.id, `⚠️ Visa expiry reminder: ${emp.full_name}'s visa expires on ${emp.visa_expiry} (${daysLeft} days remaining).`, 'visa_reminder_90');
      }
      db.prepare("UPDATE employees SET visa_reminder_sent_90=1 WHERE id=?").run(emp.id);
      reminders.push({ employee: emp.full_name, days: daysLeft, type: '90-day' });
    }

    // 30-day: notify the individual
    if (daysLeft <= 30 && daysLeft > 0 && !emp.visa_reminder_sent_30) {
      db.prepare("INSERT INTO notifications (id,employee_id,message,type) VALUES (?,?,?,?)")
        .run(uuidv4(), emp.id, `🔔 Your visa expires on ${emp.visa_expiry} — ${daysLeft} days remaining. Please contact HR.`, 'visa_reminder_30');
      db.prepare("UPDATE employees SET visa_reminder_sent_30=1 WHERE id=?").run(emp.id);
      reminders.push({ employee: emp.full_name, days: daysLeft, type: '30-day' });
    }
  }
  return reminders;
}

module.exports = {
  validateLeaveRequest,
  calculateAnnualLeaveAllowance,
  calculateSickLeavePay,
  calculateDeduction,
  checkEligibility,
  checkBlackout,
  checkOverlap,
  calculateGratuity,
  getBasicSalaryPercentage,
  checkNoSickLeaveBonus,
  getPersonalTimePeriod,
  getRolloverPeriod,
  countWorkingDays,
  monthsBetween,
  checkVisaReminders,
  checkPersonalTimeBalance,
  getCompassionateAllowance,
  COMPASSIONATE_DAYS,
};
