import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { CheckIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface LeaveRequest {
  id: string;
  full_name: string;
  department: string;
  employee_number: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  paid_days: number;
  half_pay_days: number;
  unpaid_days: number;
  reason: string;
  created_at: string;
  status: string;
}

export default function Approvals() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const load = () => {
    setLoading(true);
    const qs = tab === 'pending' ? '?status=pending' : '';
    api.get(`/leaves${qs}`).then(r => setRequests(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab]);

  const approve = async (id: string) => {
    setActionId(id);
    try { await api.patch(`/leaves/${id}/approve`); load(); }
    finally { setActionId(null); }
  };

  const reject = async (id: string) => {
    if (!rejectionReason.trim()) return;
    setActionId(id);
    try {
      await api.patch(`/leaves/${id}/reject`, { rejection_reason: rejectionReason });
      setRejectingId(null);
      setRejectionReason('');
      load();
    } finally { setActionId(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leave Approvals</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review and action your team's leave requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['pending', 'all'] as const).map(t => (
          <button
            key={t}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab(t)}
          >
            {t === 'pending' ? `Pending (${requests.filter(r => r.status === 'pending').length})` : 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-7 w-7 border-4 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : requests.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <CheckIcon className="h-10 w-10 mx-auto mb-3 text-green-300" />
            No pending requests — you're all caught up!
          </div>
        ) : (
          requests.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-gray-900">{r.full_name}</p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.department}</span>
                    <span className="text-xs text-gray-400">{r.employee_number}</span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-400">Leave Type</p>
                      <p className="text-sm font-medium capitalize">{r.leave_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Period</p>
                      <p className="text-sm">{dayjs(r.start_date).format('D MMM')} – {dayjs(r.end_date).format('D MMM YYYY')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Duration</p>
                      <p className="text-sm font-medium">{r.total_days} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Pay Breakdown</p>
                      <p className="text-sm">
                        <span className="text-green-600">{r.paid_days}p</span>
                        {r.half_pay_days > 0 && <span className="text-yellow-600"> / {r.half_pay_days}½</span>}
                        {r.unpaid_days > 0 && <span className="text-red-600"> / {r.unpaid_days}u</span>}
                      </p>
                    </div>
                  </div>

                  {r.reason && (
                    <div className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">
                      <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {r.reason}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-2">Submitted {dayjs(r.created_at).format('D MMM YYYY, HH:mm')}</p>
                </div>

                {r.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      className="btn-primary py-1.5"
                      onClick={() => approve(r.id)}
                      disabled={actionId === r.id}
                    >
                      <CheckIcon className="h-4 w-4" /> Approve
                    </button>
                    <button
                      className="btn-danger py-1.5"
                      onClick={() => setRejectingId(r.id)}
                      disabled={actionId === r.id}
                    >
                      <XMarkIcon className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}

                {r.status !== 'pending' && (
                  <span className={`badge-${r.status} flex-shrink-0`}>{r.status}</span>
                )}
              </div>

              {/* Rejection form */}
              {rejectingId === r.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <label className="label">Rejection reason (required)</label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="Explain why this leave is being rejected…"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-danger py-1.5"
                      onClick={() => reject(r.id)}
                      disabled={!rejectionReason.trim() || actionId === r.id}
                    >
                      Confirm Rejection
                    </button>
                    <button className="btn-secondary py-1.5" onClick={() => { setRejectingId(null); setRejectionReason(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
