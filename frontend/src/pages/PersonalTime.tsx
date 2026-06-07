import { useEffect, useState, FormEvent } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

interface PTBalance {
  period: string;
  allocated: number;
  used: number;
  deducted: number;
}

interface PTLog {
  id: string;
  log_date: string;
  hours_used: number;
  reason: string;
  period: string;
  status: string;
  full_name: string;
}

const BADGE: Record<string, string> = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
};

export default function PersonalTime() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<PTBalance[]>([]);
  const [logs, setLogs] = useState<PTLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ log_date: dayjs().format('YYYY-MM-DD'), hours_used: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // For managers: pending PT logs
  const [pendingLogs, setPendingLogs] = useState<PTLog[]>([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/personal-time/balances'),
      api.get('/personal-time'),
      (user!.role !== 'employee') ? api.get('/personal-time?status=pending') : Promise.resolve({ data: [] }),
    ]).then(([b, l, p]) => {
      setBalances(b.data);
      setLogs(l.data);
      setPendingLogs(p.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await api.post('/personal-time', form);
      setFeedback({ type: 'success', msg: res.data.message });
      setForm(f => ({ ...f, hours_used: '', reason: '' }));
      load();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.response?.data?.error || 'Failed to log personal time' });
    } finally {
      setSubmitting(false);
    }
  };

  const action = async (id: string, act: 'approve' | 'reject') => {
    await api.patch(`/personal-time/${id}/${act}`);
    load();
  };

  const currentPeriod = dayjs().month() < 6 ? `${dayjs().year()}-H1` : `${dayjs().year()}-H2`;
  const currentBalance = balances.find(b => b.period === currentPeriod);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personal Time</h1>
        <p className="text-gray-500 text-sm mt-0.5">6 hours per 6-month period — tracked and auto-calculated</p>
      </div>

      {/* Current period balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-lg">
            <ClockIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Current Period</p>
            <p className="font-semibold text-gray-900">{currentPeriod}</p>
          </div>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{currentBalance ? (currentBalance.allocated - currentBalance.used).toFixed(1) : '6.0'}</p>
          <p className="text-sm text-gray-500">Hours remaining</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{currentBalance ? currentBalance.used.toFixed(1) : '0.0'}</p>
          <p className="text-sm text-gray-500">Hours used</p>
          {currentBalance?.deducted ? (
            <p className="text-xs text-red-500 mt-1 flex items-center justify-center gap-1">
              <ExclamationTriangleIcon className="h-3 w-3" /> Deduction applied
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Log form */}
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Log Personal Time</h2>
          <p className="text-sm text-gray-500">
            Late arrivals beyond 15-minute grace are counted here. Over 6h/period = payroll deduction.
          </p>

          {feedback && (
            <div className={`p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {feedback.msg}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={form.log_date}
                onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
                max={dayjs().format('YYYY-MM-DD')}
                required
              />
            </div>
            <div>
              <label className="label">Hours Used</label>
              <input
                type="number"
                className="input"
                value={form.hours_used}
                onChange={e => setForm(f => ({ ...f, hours_used: e.target.value }))}
                min="0.25" max="8" step="0.25"
                placeholder="e.g. 1.5"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Minimum 0.25h (15 minutes)</p>
            </div>
            <div>
              <label className="label">Reason</label>
              <input
                type="text"
                className="input"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Late arrival, personal errand, etc."
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
              {submitting ? 'Logging…' : 'Log Personal Time'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No personal time logged yet.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{dayjs(l.log_date).format('D MMM YYYY')}</p>
                    <p className="text-gray-500 text-xs">{l.reason || '—'}</p>
                    {user!.role !== 'employee' && <p className="text-xs text-gray-400">{l.full_name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-purple-700">{l.hours_used}h</span>
                    <span className={BADGE[l.status] || 'badge-pending'}>{l.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Period balances */}
      {balances.length > 1 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">All Periods</h2>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Period', 'Allocated (hrs)', 'Used (hrs)', 'Remaining', 'Deduction'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {balances.map(b => (
                  <tr key={b.period}>
                    <td className="px-4 py-3 font-medium">{b.period}</td>
                    <td className="px-4 py-3">{b.allocated}</td>
                    <td className="px-4 py-3">{b.used.toFixed(1)}</td>
                    <td className="px-4 py-3">{Math.max(0, b.allocated - b.used).toFixed(1)}</td>
                    <td className="px-4 py-3">
                      {b.deducted
                        ? <span className="text-red-600 font-medium">Yes</span>
                        : <span className="text-green-600">None</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manager: pending PT approvals */}
      {user!.role !== 'employee' && pendingLogs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending Personal Time Approvals</h2>
          <div className="space-y-2">
            {pendingLogs.map(l => (
              <div key={l.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{l.full_name}</p>
                  <p className="text-sm text-gray-500">{dayjs(l.log_date).format('D MMM YYYY')} · {l.hours_used}h · {l.reason || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary py-1.5 text-xs" onClick={() => action(l.id, 'approve')}>Approve</button>
                  <button className="btn-danger py-1.5 text-xs" onClick={() => action(l.id, 'reject')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
