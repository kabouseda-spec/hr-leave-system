import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

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

interface CalEvent {
  id: string;
  full_name: string;
  department: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
}

const BADGE: Record<string, string> = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  cancelled: 'badge-cancelled',
};

const TYPE_COLORS: Record<string, string> = {
  annual:        'bg-blue-100 text-blue-800 border-blue-200',
  sick:          'bg-red-100 text-red-800 border-red-200',
  personal:      'bg-purple-100 text-purple-800 border-purple-200',
  maternity:     'bg-pink-100 text-pink-800 border-pink-200',
  parental:      'bg-indigo-100 text-indigo-800 border-indigo-200',
  compassionate: 'bg-gray-100 text-gray-800 border-gray-200',
  study:         'bg-green-100 text-green-800 border-green-200',
  unpaid:        'bg-orange-100 text-orange-800 border-orange-200',
};

function MyLeaves() {
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
    <div className="space-y-4">
      <div className="flex gap-3 justify-end">
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

function TeamCalendarTab() {
  const [current, setCurrent] = useState(dayjs());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/leaves/meta/calendar?year=${current.year()}&month=${current.month() + 1}`)
      .then(r => setEvents(r.data))
      .finally(() => setLoading(false));
  }, [current]);

  const startOfMonth = current.startOf('month');
  const daysInMonth  = current.daysInMonth();
  const startDow     = startOfMonth.day();

  const getEventsForDay = (day: number) => {
    const date = current.date(day).format('YYYY-MM-DD');
    return events.filter(e => date >= e.start_date && date <= e.end_date);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const today = dayjs();

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center gap-2 justify-end">
        <button className="btn-secondary p-2" onClick={() => setCurrent(c => c.subtract(1, 'month'))}>
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold text-gray-900 w-36 text-center">
          {current.format('MMMM YYYY')}
        </span>
        <button className="btn-secondary p-2" onClick={() => setCurrent(c => c.add(1, 'month'))}>
          <ChevronRightIcon className="h-4 w-4" />
        </button>
        <button className="btn-secondary text-sm" onClick={() => setCurrent(dayjs())}>Today</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_COLORS).map(([type, cls]) => (
          <span key={type} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${cls}`}>
            {type}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center bg-gray-50">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-gray-100">
            {cells.map((day, idx) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday   = day ? current.date(day).isSame(today, 'day') : false;
              const isWeekend = [0, 6].includes(idx % 7);
              return (
                <div
                  key={idx}
                  className={`p-2 border-b border-gray-100 ${
                    !day ? 'bg-gray-50/70' : isWeekend ? 'bg-gray-50/40' : 'bg-white'
                  }`}
                  style={{ minHeight: day ? Math.max(80, 44 + dayEvents.length * 22) : 80 }}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1 ${
                        isToday ? 'bg-brand-600 text-white' : 'text-gray-700'
                      }`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.map(e => (
                          <div
                            key={e.id}
                            className={`text-xs px-1.5 py-0.5 rounded border truncate ${
                              TYPE_COLORS[e.leave_type] || 'bg-gray-100 text-gray-800 border-gray-200'
                            }`}
                            title={`${e.full_name} — ${e.leave_type} leave`}
                          >
                            <span className="font-medium">{e.full_name.split(' ')[0]}</span>
                            {' '}
                            <span className="opacity-70">{e.full_name.split(' ').slice(1).join(' ')}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leave list */}
      {events.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            {current.format('MMMM YYYY')} — {events.length} approved leave{events.length > 1 ? 's' : ''}
          </h2>
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="card py-3 flex items-center gap-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize flex-shrink-0 ${
                  TYPE_COLORS[e.leave_type] || ''
                }`}>
                  {e.leave_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{e.full_name}</p>
                  <p className="text-xs text-gray-500">{e.department}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-gray-700">
                    {dayjs(e.start_date).format('D MMM')} – {dayjs(e.end_date).format('D MMM YYYY')}
                  </p>
                  <p className="text-xs text-gray-400">{e.total_days} day{e.total_days !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && !loading && (
        <div className="card text-center py-10 text-gray-400">
          No approved leaves in {current.format('MMMM YYYY')}.
        </div>
      )}
    </div>
  );
}

export default function LeaveHistory() {
  const [tab, setTab] = useState<'mine' | 'team'>('mine');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {tab === 'mine' ? 'Your personal leave history' : 'All approved leaves across the company'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('mine')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'mine'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Leave Requests
        </button>
        <button
          onClick={() => setTab('team')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'team'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Team Calendar
        </button>
      </div>

      {tab === 'mine' ? <MyLeaves /> : <TeamCalendarTab />}
    </div>
  );
}
