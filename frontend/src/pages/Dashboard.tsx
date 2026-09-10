import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import dayjs from 'dayjs';
import {
  PlusIcon, CheckCircleIcon, DocumentTextIcon,
  CalendarDaysIcon, ClockIcon, HeartIcon, ExclamationCircleIcon, ChevronRightIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import PolicyModal from '../components/PolicyModal';

interface Balance {
  leave_type: string;
  label: string;
  unit: string;
  allocated: number;
  used_paid: number;
  used_half: number;
  used_unpaid: number;
  pending: number;
  bonus_days: number;
}

interface PersonalTimeBalance {
  period: string;
  allocated: number;
  used: number;
  deducted: number;
}

interface Rollover {
  year: number;
  periodStart: string;
  periodEnd: string;
  rolloverMonth: number;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  paid_days: number;
  unpaid_days: number;
  full_name?: string;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const LEAVE_ICON: Record<string, typeof CalendarDaysIcon> = {
  annual: CalendarDaysIcon,
  sick: HeartIcon,
  personal: ClockIcon,
  unpaid: ExclamationCircleIcon,
};

const BADGE: Record<string, string> = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  cancelled: 'badge-cancelled',
};

function PersonalTimeCard({ pt, onClick }: { pt: PersonalTimeBalance; onClick: () => void }) {
  const remaining = Math.max(0, pt.allocated - pt.used);
  const pct = pt.allocated > 0 ? Math.min(100, (pt.used / pt.allocated) * 100) : 0;
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 65 ? 'bg-amber-400' : 'bg-purple-500';
  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-purple-300"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-50">
            <ClockIcon className="h-5 w-5 text-purple-600" />
          </div>
          <span className="font-semibold text-gray-700 text-sm">Personal Time</span>
        </div>
        <ChevronRightIcon className="h-4 w-4 text-gray-300" />
      </div>
      <div className="mb-3">
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-gray-900">{remaining.toFixed(1)}</span>
          <span className="text-gray-400 text-sm mb-1">hrs left</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">of {pt.allocated} hrs — {pt.period}</p>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-xs text-center">
        <div className="py-1 rounded-lg bg-gray-50">
          <p className="font-semibold text-gray-700">{pt.used.toFixed(1)}</p>
          <p className="text-gray-400">Used</p>
        </div>
        <div className="py-1 rounded-lg bg-gray-50">
          <p className={`font-semibold ${pt.deducted ? 'text-red-600' : 'text-gray-700'}`}>{pt.deducted ? 'Yes' : 'None'}</p>
          <p className="text-gray-400">Deduction</p>
        </div>
      </div>
    </div>
  );
}

function LeaveCard({ b, rollover, onClick }: { b: Balance; rollover?: Rollover; onClick?: () => void }) {
  const isUnpaid = b.leave_type === 'unpaid';
  const isSick   = b.leave_type === 'sick';
  const isHours  = b.unit === 'hours';
  const Icon     = LEAVE_ICON[b.leave_type] || CalendarDaysIcon;
  const totalUsed = b.used_paid + b.used_half + b.used_unpaid;
  const totalAllocated = b.allocated + (b.bonus_days || 0);
  const remaining = totalAllocated - totalUsed - b.pending;
  // Sick: show accumulated days (build up from 0), not days left
  const pct = isSick
    ? Math.min(100, (totalUsed / 90) * 100)
    : totalAllocated > 0 ? Math.min(100, (totalUsed / totalAllocated) * 100) : 0;

  const barColor =
    isUnpaid     ? 'bg-red-500' :
    pct >= 90    ? 'bg-red-500' :
    pct >= 65    ? 'bg-amber-400' :
    'bg-emerald-500';

  const iconBg  = isUnpaid ? 'bg-red-50'    : 'bg-brand-50';
  const iconCol = isUnpaid ? 'text-red-600'  : 'text-brand-600';
  const border  = isUnpaid ? 'border-red-200 bg-red-50/30' : 'border-gray-200';

  // Unpaid card: show days taken (no allocation concept)
  if (isUnpaid) {
    const daysTaken = totalUsed + b.pending;
    return (
      <div className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ${border}`} onClick={onClick}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconCol}`} />
            </div>
            <span className="font-semibold text-gray-700 text-sm">{b.label}</span>
          </div>
          {daysTaken > 0 && (
            <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
              Salary deducted
            </span>
          )}
        </div>
        <div className="mb-4">
          <div className="flex items-end gap-1">
            <span className="text-3xl font-bold text-red-700">{daysTaken.toFixed(0)}</span>
            <span className="text-gray-400 text-sm mb-1">days taken</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">All unpaid — deducted from salary</p>
        </div>
        {b.pending > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
            {b.pending} days pending approval
          </p>
        )}
        {daysTaken === 0 && (
          <p className="text-xs text-gray-400 italic">No unpaid leave taken</p>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ${border}`} onClick={onClick}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconCol}`} />
          </div>
          <span className="font-semibold text-gray-700 text-sm">{b.label}</span>
        </div>
        {b.pending > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
            {b.pending} pending
          </span>
        )}
      </div>

      <div className="mb-3">
        {isSick ? (
          <>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-gray-900">{totalUsed.toFixed(0)}</span>
              <span className="text-gray-400 text-sm mb-1">days taken</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-gray-900">
                {Math.max(0, remaining).toFixed(isHours ? 1 : 0)}
              </span>
              <span className="text-gray-400 text-sm mb-1">{isHours ? 'hrs left' : 'days left'}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              of {totalAllocated} {isHours ? 'hrs' : 'days'} allocated
              {(b.bonus_days || 0) > 0 && <span className="text-green-600 ml-1">(+{b.bonus_days} bonus)</span>}
            </p>
          </>
        )}
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
        <div className="py-1 rounded-lg bg-gray-50">
          <p className="font-semibold text-gray-700">{b.used_paid.toFixed(isHours ? 1 : 0)}</p>
          <p className="text-gray-400">Paid</p>
        </div>
        <div className="py-1 rounded-lg bg-gray-50">
          <p className="font-semibold text-gray-700">{b.used_half.toFixed(isHours ? 1 : 0)}</p>
          <p className="text-gray-400">½ Pay</p>
        </div>
        <div className="py-1 rounded-lg bg-gray-50">
          <p className="font-semibold text-gray-700">{b.used_unpaid.toFixed(isHours ? 1 : 0)}</p>
          <p className="text-gray-400">Unpaid</p>
        </div>
      </div>

      {b.leave_type === 'annual' && rollover && (
        <p className="mt-3 text-xs text-gray-400 text-center">
          Rollover: {dayjs(rollover.periodStart).format('D MMM YYYY')} – {dayjs(rollover.periodEnd).format('D MMM YYYY')}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [personalTime, setPersonalTime] = useState<PersonalTimeBalance | null>(null);
  const [rollover, setRollover] = useState<Rollover | null>(null);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showPolicy, setShowPolicy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [hireDate, setHireDate] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.get(`/employees/${user!.id}/balances`),
      api.get('/leaves'),
      user!.role !== 'employee' ? api.get('/leaves?status=pending') : Promise.resolve({ data: [] }),
      api.get('/reports/notifications'),
      api.get(`/admin/holidays?year=${dayjs().year()}`),
    ]).then(([balRes, leavesRes, pendingRes, notifRes, holRes]) => {
      if (balRes.status === 'fulfilled') {
        const { balances: b, rollover: r, personalTime: pt, employee: empData } = balRes.value.data;
        const shown = (Array.isArray(b) ? b : []).filter((bal: Balance) =>
          ['annual', 'sick', 'unpaid'].includes(bal.leave_type)
        );
        setBalances(shown);
        setPersonalTime(pt || null);
        setRollover(r || null);
        if (empData?.hire_date) setHireDate(empData.hire_date);
      }
      if (leavesRes.status === 'fulfilled') {
        setRecentLeaves(leavesRes.value.data.slice(0, 5));
      }
      if (pendingRes.status === 'fulfilled') {
        setPendingCount(Array.isArray(pendingRes.value.data) ? pendingRes.value.data.length : 0);
      }
      if (notifRes.status === 'fulfilled') {
        setNotifications((notifRes.value.data || []).filter((n: any) => !n.dismissed));
      }
      if (holRes.status === 'fulfilled') {
        const today = dayjs();
        const upcoming = (holRes.value.data || []).filter((h: any) =>
          dayjs(h.date).isAfter(today) && dayjs(h.date).diff(today, 'day') <= 60
        ).slice(0, 5);
        setHolidays(upcoming);
      }
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <>
      {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} />}

      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, {user!.name.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">{dayjs().format('dddd, MMMM D, YYYY')}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Policy icon button */}
            <button
              onClick={() => setShowPolicy(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-all shadow-sm"
              title="View company leave policies"
            >
              <DocumentTextIcon className="h-4 w-4" />
              Policies
            </button>
            <button className="btn-primary" onClick={() => navigate('/leave/request')}>
              <PlusIcon className="h-4 w-4" /> Request Leave
            </button>
          </div>
        </div>

        {/* Notifications — all undismissed, scrollable if many */}
        {notifications.length > 0 && (
          <div className={`space-y-2 ${notifications.length > 4 ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
            {notifications.map((n: any) => {
              const dest =
                n.type === 'leave_request'  ? '/leave/approvals' :
                n.type === 'leave_approved' ? '/leave/history'   :
                n.type === 'leave_rejected' ? '/leave/history'   :
                n.type === 'personal_time'  ? '/personal-time'   :
                n.type === 'comp_day'       ? '/leave/history'   :
                n.type?.includes('visa')    ? '/admin/employees' :
                null;
              const colorCls =
                n.type?.includes('visa')     ? 'bg-orange-50 border-orange-200 text-orange-800' :
                n.type?.includes('approved') || n.type === 'comp_day' || n.type === 'leave_rollover'
                                             ? 'bg-green-50 border-green-200 text-green-800'    :
                n.type?.includes('rejected') ? 'bg-red-50 border-red-200 text-red-800'          :
                'bg-blue-50 border-blue-200 text-blue-800';

              const dismiss = async (e: React.MouseEvent) => {
                e.stopPropagation();
                await api.patch(`/reports/notifications/${n.id}/dismiss`);
                setNotifications(prev => prev.filter(x => x.id !== n.id));
              };

              return (
                <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${colorCls}`}>
                  <p className="flex-1">{n.message}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {dest && (
                      <button
                        onClick={() => navigate(dest)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/60 hover:bg-white border border-current/20 transition-colors whitespace-nowrap flex items-center gap-1"
                        title="Go to action"
                      >
                        View <ChevronRightIcon className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={dismiss}
                      className="p-1 rounded-lg hover:bg-white/60 transition-colors"
                      title="Dismiss notification"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Manager pending approvals banner */}
        {pendingCount > 0 && (
          <button
            className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors text-left"
            onClick={() => navigate('/leave/approvals')}
          >
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">{pendingCount} leave request{pendingCount > 1 ? 's' : ''} awaiting your approval</p>
                <p className="text-xs text-amber-600 mt-0.5">Tap to review</p>
              </div>
            </div>
            <span className="text-amber-700 text-sm">Review →</span>
          </button>
        )}

        {/* Three balance cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">My Leave Balances</h2>
            {rollover && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                Rollover month: {MONTH_NAMES[(rollover.rolloverMonth - 1)]}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {balances.length === 0 && !personalTime ? (
              <div className="col-span-4 bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
                No leave balances found. Contact HR to initialise your account.
              </div>
            ) : (
              <>
                {balances.map(b => (
                  <LeaveCard
                    key={b.leave_type}
                    b={b}
                    rollover={rollover ?? undefined}
                    onClick={() => navigate('/leave/history')}
                  />
                ))}
                {personalTime && (
                  <PersonalTimeCard pt={personalTime} onClick={() => navigate('/personal-time')} />
                )}
              </>
            )}
          </div>

        </div>

        {/* Leave Accrual Status */}
        {(() => {
          const hd = hireDate;
          if (!hd) return null;
          const hire = dayjs(hd);
          const probEnd = hire.add(6, 'month');
          const today = dayjs();
          const monthsWorked = today.diff(hire, 'month');
          const isProbation = today.isBefore(probEnd);
          const accrualRate = 1.833; // 22 days / 12 months
          const accrualMonths = Math.max(0, today.diff(probEnd, 'month'));
          const accrued = Math.min(22, Math.round(accrualMonths * accrualRate * 10) / 10);
          const annualBal = balances.find(b => b.leave_type === 'annual');
          const used = annualBal ? (annualBal.used_paid + annualBal.used_half + annualBal.used_unpaid) : 0;
          return (
            <div className="bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-brand-800 mb-1">📈 Leave Accrual</h2>
                  {isProbation ? (
                    <p className="text-sm text-brand-700">
                      You are in your probation period — leave accrual starts on <strong>{probEnd.format('D MMM YYYY')}</strong>.
                    </p>
                  ) : (
                    <p className="text-sm text-brand-700">
                      Accruing <strong>1.83 days/month</strong> after probation · <strong>{accrualMonths}</strong> month{accrualMonths !== 1 ? 's' : ''} accrued · <strong>{accrued} days</strong> earned
                    </p>
                  )}
                  <p className="text-xs text-brand-500 mt-1">
                    {isProbation
                      ? `Probation ends in ${probEnd.diff(today, 'day')} days`
                      : `${Math.max(0, accrued - used).toFixed(1)} days available · ${used.toFixed(1)} used`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-brand-700">{isProbation ? '—' : accrued}</p>
                  <p className="text-xs text-brand-500">days accrued</p>
                </div>
              </div>
              {!isProbation && (
                <div className="mt-3 w-full bg-brand-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-brand-500 transition-all"
                    style={{ width: `${Math.min(100, (accrued / 22) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* Upcoming holidays */}
        {holidays.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3">🎉 Upcoming Public Holidays</h2>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {holidays.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-amber-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">🏖️</div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{h.name}</p>
                      <p className="text-xs text-gray-400">
                        {h.end_date && h.end_date !== h.date
                          ? `${dayjs(h.date).format('D MMM')} – ${dayjs(h.end_date).format('D MMM YYYY')}`
                          : dayjs(h.date).format('dddd, D MMMM YYYY')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    {dayjs(h.date).diff(dayjs(), 'day')} days away
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent requests */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">Recent Requests</h2>
            <button className="text-sm text-brand-600 hover:underline" onClick={() => navigate('/leave/history')}>
              View all →
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {recentLeaves.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No leave requests yet.{' '}
                <button className="text-brand-600 hover:underline" onClick={() => navigate('/leave/request')}>Request your first leave.</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentLeaves.map(l => (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 rounded-full bg-brand-200 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-gray-900 capitalize">{l.leave_type} Leave</p>
                        {l.full_name && (
                          <p className="text-xs font-medium text-brand-600">{l.full_name}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {dayjs(l.start_date).format('D MMM')} – {dayjs(l.end_date).format('D MMM YYYY')} · {l.total_days} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {l.unpaid_days > 0 && (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">partial unpaid</span>
                      )}
                      <span className={BADGE[l.status] || 'badge-cancelled'}>{l.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
