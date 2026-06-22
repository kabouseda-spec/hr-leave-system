import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';

interface LeaveRecord {
  id: string;
  employee_id: string;
  full_name: string;
  department: string;
  employee_number: string;
  leave_type: string;
  sub_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  paid_days: number;
  half_pay_days: number;
  unpaid_days: number;
  status: string;
  reason: string;
  rejection_reason: string;
  approved_by_name: string;
  manager_approved_by_name: string;
  created_at: string;
  is_half_day: number;
}

const BADGE: Record<string, string> = {
  pending:   'badge-pending',
  approved:  'badge-approved',
  rejected:  'badge-rejected',
  cancelled: 'badge-cancelled',
};

const STATUS_OPTIONS = ['', 'pending', 'approved', 'rejected', 'cancelled'];
const LEAVE_TYPES    = ['', 'annual', 'sick', 'unpaid', 'maternity', 'parental', 'compassionate', 'study', 'personal'];

export default function EmployeeLeaves() {
  const [leaves, setLeaves]           = useState<LeaveRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [year, setYear]               = useState(dayjs().year());
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [nameFilter, setNameFilter]   = useState('');

  const load = () => {
    setLoading(true);
    const qs = [
      `year=${year}`,
      statusFilter ? `status=${statusFilter}` : '',
    ].filter(Boolean).join('&');
    api.get(`/leaves?${qs}`)
      .then(r => setLeaves(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year, statusFilter]);

  const filtered = leaves.filter(l => {
    if (typeFilter && l.leave_type !== typeFilter) return false;
    if (nameFilter && !l.full_name?.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Leaves</h1>
        <p className="text-gray-500 text-sm mt-0.5">All team leave records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          className="input w-48"
          placeholder="Search by name…"
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
        />
        <select className="input w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select className="input w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {LEAVE_TYPES.filter(Boolean).map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 self-center">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-7 w-7 border-4 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No leave records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee', 'Dept', 'Type', 'From', 'To', 'Days', 'Full Pay', 'Half Pay', 'Unpaid', 'Status', 'Approved By'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{l.full_name}</p>
                      <p className="text-xs text-gray-400">{l.employee_number}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{l.department}</td>
                    <td className="px-4 py-3 capitalize font-medium">
                      {l.leave_type}
                      {l.sub_type && <span className="text-xs text-gray-400 block">{l.sub_type}</span>}
                      {l.is_half_day ? <span className="text-xs text-purple-500 block">½ day</span> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dayjs(l.start_date).format('D MMM YYYY')}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dayjs(l.end_date).format('D MMM YYYY')}</td>
                    <td className="px-4 py-3 font-semibold">{l.total_days}</td>
                    <td className="px-4 py-3 text-green-700">{l.paid_days || 0}</td>
                    <td className="px-4 py-3 text-yellow-700">{l.half_pay_days || 0}</td>
                    <td className="px-4 py-3 text-red-700">{l.unpaid_days || 0}</td>
                    <td className="px-4 py-3">
                      <span className={BADGE[l.status] || 'badge-cancelled'}>{l.status}</span>
                      {l.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1 max-w-xs">{l.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {l.approved_by_name || '—'}
                      {l.manager_approved_by_name && l.status === 'pending' && (
                        <p className="text-green-600 mt-0.5">Mgr: {l.manager_approved_by_name}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
