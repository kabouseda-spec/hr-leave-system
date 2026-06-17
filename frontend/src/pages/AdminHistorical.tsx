import { useEffect, useState, FormEvent } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { ClockIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

interface Employee {
  id: string;
  full_name: string;
  department: string;
  employee_number: string;
}

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Time (hours)' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'parental', label: 'Parental Leave' },
  { value: 'compassionate', label: 'Compassionate Leave' },
  { value: 'study', label: 'Study Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
];

const COMPASSIONATE_SUBS = ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild'];

const BLANK_LEAVE = {
  employee_id: '', leave_type: 'annual', sub_type: '',
  start_date: '', end_date: '',
  paid_days: '', half_pay_days: '', unpaid_days: '',
  reason: '', is_half_day: false,
};

const BLANK_PT = {
  employee_id: '', log_date: '', hours_used: '', reason: '',
};

type Tab = 'leave' | 'personal_time';

export default function AdminHistorical() {
  const [tab, setTab] = useState<Tab>('leave');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveForm, setLeaveForm] = useState(BLANK_LEAVE);
  const [ptForm, setPtForm] = useState(BLANK_PT);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [recentLeaves, setRecentLeaves] = useState<any[]>([]);

  useEffect(() => {
    api.get('/employees').then(r => setEmployees(r.data.filter((e: any) => e.is_active)));
    loadRecent();
  }, []);

  const loadRecent = () => {
    api.get('/leaves?year=2025').then(r => {
      // show all 2025 entries for context
      setRecentLeaves(r.data.slice(0, 20));
    }).catch(() => {});
  };

  const submitLeave = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const payload: any = { ...leaveForm };
      if (!payload.end_date) payload.end_date = payload.start_date;
      if (!payload.sub_type) delete payload.sub_type;
      ['paid_days', 'half_pay_days', 'unpaid_days'].forEach(k => {
        if (!payload[k]) delete payload[k];
      });
      const res = await api.post('/leaves/admin/backdate', payload);
      setFeedback({ type: 'success', msg: `Created: ${res.data.totalDays} day(s) — ${res.data.paid}d paid, ${res.data.half}d half-pay, ${res.data.unpaid}d unpaid` });
      setLeaveForm(BLANK_LEAVE);
      loadRecent();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.response?.data?.error || 'Failed to create historical entry' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitPT = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await api.post('/leaves/admin/backdate-pt', ptForm);
      setFeedback({ type: 'success', msg: `Personal time logged: ${ptForm.hours_used}h for period ${res.data.period}` });
      setPtForm(BLANK_PT);
      loadRecent();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.response?.data?.error || 'Failed to create historical entry' });
    } finally {
      setSubmitting(false);
    }
  };

  const isPersonalTime = leaveForm.leave_type === 'personal';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historical Data Entry</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          HR Admin only — back-fill leave records from 2025 onwards. All entries are auto-approved.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Important:</strong> These entries bypass normal validation (blackout periods, gaps, eligibility).
        They are immediately approved and update leave balances. Use only for correcting historical records.
        Dates before 1 January 2025 are not permitted.
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setTab('leave'); setFeedback(null); }}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'leave' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarDaysIcon className="h-4 w-4" /> Leave Entry
        </button>
        <button
          onClick={() => { setTab('personal_time'); setFeedback(null); }}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'personal_time' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClockIcon className="h-4 w-4" /> Personal Time Entry
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm border ${
          feedback.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.type === 'success' ? '✅ ' : '❌ '}{feedback.msg}
        </div>
      )}

      {tab === 'leave' && (
        <form onSubmit={submitLeave} className="card space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Add Historical Leave</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Employee *</label>
              <select
                className="input"
                value={leaveForm.employee_id}
                onChange={e => setLeaveForm(f => ({ ...f, employee_id: e.target.value }))}
                required
              >
                <option value="">Select employee…</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} — {emp.department} ({emp.employee_number})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Leave Type *</label>
              <select
                className="input"
                value={leaveForm.leave_type}
                onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value, sub_type: '' }))}
              >
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {leaveForm.leave_type === 'compassionate' && (
              <div>
                <label className="label">Relationship *</label>
                <select
                  className="input"
                  value={leaveForm.sub_type}
                  onChange={e => setLeaveForm(f => ({ ...f, sub_type: e.target.value }))}
                  required
                >
                  <option value="">Select…</option>
                  {COMPASSIONATE_SUBS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label">Start Date * (min 2025-01-01)</label>
              <input
                type="date"
                className="input"
                value={leaveForm.start_date}
                onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date || e.target.value }))}
                min="2025-01-01"
                max={dayjs().format('YYYY-MM-DD')}
                required
              />
            </div>

            {!isPersonalTime && (
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={leaveForm.end_date}
                  onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                  min={leaveForm.start_date || '2025-01-01'}
                  max={dayjs().format('YYYY-MM-DD')}
                />
              </div>
            )}
          </div>

          {/* Day breakdown — optional override */}
          {!isPersonalTime && (
            <div>
              <p className="label mb-1">Day Breakdown <span className="text-gray-400 font-normal">(leave blank to auto-calculate as fully paid)</span></p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Full-pay days</label>
                  <input type="number" className="input" placeholder="auto"
                    value={leaveForm.paid_days}
                    onChange={e => setLeaveForm(f => ({ ...f, paid_days: e.target.value }))}
                    min="0" step="0.5" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Half-pay days</label>
                  <input type="number" className="input" placeholder="0"
                    value={leaveForm.half_pay_days}
                    onChange={e => setLeaveForm(f => ({ ...f, half_pay_days: e.target.value }))}
                    min="0" step="0.5" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Unpaid days</label>
                  <input type="number" className="input" placeholder="0"
                    value={leaveForm.unpaid_days}
                    onChange={e => setLeaveForm(f => ({ ...f, unpaid_days: e.target.value }))}
                    min="0" step="0.5" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                If all three are blank, working days between start and end date will be calculated and treated as fully paid.
              </p>
            </div>
          )}

          <div>
            <label className="label">Notes / Reason</label>
            <input
              type="text" className="input"
              value={leaveForm.reason}
              onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Historical data import, approved offline, etc."
            />
          </div>

          <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Historical Leave Entry'}
          </button>
        </form>
      )}

      {tab === 'personal_time' && (
        <form onSubmit={submitPT} className="card space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Add Historical Personal Time</h2>

          <div>
            <label className="label">Employee *</label>
            <select
              className="input"
              value={ptForm.employee_id}
              onChange={e => setPtForm(f => ({ ...f, employee_id: e.target.value }))}
              required
            >
              <option value="">Select employee…</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} — {emp.department} ({emp.employee_number})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date * (min 2025-01-01)</label>
              <input
                type="date" className="input"
                value={ptForm.log_date}
                onChange={e => setPtForm(f => ({ ...f, log_date: e.target.value }))}
                min="2025-01-01"
                max={dayjs().format('YYYY-MM-DD')}
                required
              />
            </div>
            <div>
              <label className="label">Hours Used *</label>
              <input
                type="number" className="input"
                value={ptForm.hours_used}
                onChange={e => setPtForm(f => ({ ...f, hours_used: e.target.value }))}
                min="0.25" max="8" step="0.25"
                placeholder="e.g. 1.5"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Notes / Reason</label>
            <input
              type="text" className="input"
              value={ptForm.reason}
              onChange={e => setPtForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Historical data import"
            />
          </div>

          <p className="text-xs text-gray-400">
            The entry is placed in the correct 6-month period automatically (Jan–Jun = H1, Jul–Dec = H2).
            If it exceeds the 6h allocation it will be flagged as a deduction.
          </p>

          <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Historical Personal Time Entry'}
          </button>
        </form>
      )}

      {/* Recent 2025 leave records for reference */}
      {recentLeaves.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Recent 2025 Leave Records (reference)</h2>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee', 'Type', 'From', 'To', 'Days', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentLeaves.map((l: any) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-sm">{l.full_name}</td>
                    <td className="px-4 py-2.5 capitalize text-sm">{l.leave_type}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-sm whitespace-nowrap">{dayjs(l.start_date).format('D MMM YYYY')}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-sm whitespace-nowrap">{dayjs(l.end_date).format('D MMM YYYY')}</td>
                    <td className="px-4 py-2.5 font-semibold text-sm">{l.total_days}</td>
                    <td className="px-4 py-2.5 text-sm">
                      <span className={`badge-${l.status}`}>{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
