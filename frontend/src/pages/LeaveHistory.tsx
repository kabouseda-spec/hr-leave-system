import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  paid_days: number;
  half_pay_days: number;
  unpaid_days: number;
  status: string;
  reason: string;
  rejection_reason: string;
  created_at: string;
  approved_by_name: string;
}

const BADGE: Record<string, string> = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  cancelled: 'badge-cancelled',
};

export default function LeaveHistory() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(dayjs().year());
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get(`/leaves?year=${year}${statusFilter ? `&status=${statusFilter}` : ''}`)
      .then(r => setLeaves(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year, statusFilter]);

  const cancel = async (id: string) => {
    if (!confirm('Cancel this leave request?')) return;
    setCancelling(id);
    try {
      await api.patch(`/leaves/${id}/cancel`);
      load();
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leave History</h1>
          <p className="text-gray-500 text-sm mt-0.5">Full record of all your leave requests</p>
        </div>
        <div className="flex gap-3">
          <select className="input w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['pending', 'approved', 'rejected', 'cancelled'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-7 w-7 border-4 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : leaves.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No leave requests found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Type', 'From', 'To', 'Days', 'Full Pay', 'Half Pay', 'Unpaid', 'Status', 'Approved By', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leaves.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium capitalize">{l.leave_type}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dayjs(l.start_date).format('D MMM YYYY')}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dayjs(l.end_date).format('D MMM YYYY')}</td>
                  <td className="px-4 py-3 font-semibold">{l.total_days}</td>
                  <td className="px-4 py-3 text-green-700">{l.paid_days || 0}</td>
                  <td className="px-4 py-3 text-yellow-700">{l.half_pay_days || 0}</td>
                  <td className="px-4 py-3 text-red-700">{l.unpaid_days || 0}</td>
                  <td className="px-4 py-3">
                    <div>
                      <span className={BADGE[l.status] || 'badge-cancelled'}>{l.status}</span>
                      {l.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1 max-w-xs">{l.rejection_reason}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.approved_by_name || '—'}</td>
                  <td className="px-4 py-3">
                    {['pending', 'approved'].includes(l.status) && (
                      <button
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => cancel(l.id)}
                        disabled={cancelling === l.id}
                        title="Cancel request"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
