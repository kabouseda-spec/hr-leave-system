import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface LeaveItem {
  leave_type: string;
  sub_type: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  paid_days: number;
  unpaid_days: number;
  half_pay_days: number;
  unpaid_deduction: number;
  half_pay_deduction: number;
}

interface DeductionRow {
  employee_id: string;
  full_name: string;
  department: string;
  basic_salary: number;
  daily_rate: number;
  total_leave_days: number;
  unpaid_days: number;
  half_pay_days: number;
  personal_hours_over: number;
  unpaid_deduction: number;
  half_pay_deduction: number;
  personal_deduction: number;
  total_deduction: number;
  leave_items: LeaveItem[];
}

const LEAVE_LABELS: Record<string, string> = {
  annual: 'Annual', sick: 'Sick', unpaid: 'Unpaid', personal: 'Personal',
  maternity: 'Maternity', paternity: 'Paternity', emergency: 'Emergency',
  business_trip: 'Business Trip', comp: 'Comp Off',
};

function fmt(n: number) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const months = [];
  for (let i = 11; i >= 0; i--) months.push(dayjs().subtract(i, 'month'));
  for (let i = 1; i <= 3; i++)  months.push(dayjs().add(i, 'month'));
  return (
    <select className="input w-auto" value={value} onChange={e => onChange(e.target.value)}>
      {months.map(m => (
        <option key={m.format('YYYY-MM')} value={m.format('YYYY-MM')}>{m.format('MMMM YYYY')}</option>
      ))}
    </select>
  );
}

export default function AdminDeductions() {
  const [month, setMonth]         = useState(dayjs().format('YYYY-MM'));
  const [report, setReport]       = useState<DeductionRow[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd]     = useState('');
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
  const [filter, setFilter]       = useState<'all' | 'deductions'>('all');

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/deductions?month=${month}`)
      .then(r => {
        setReport(r.data.report || []);
        setGrandTotal(r.data.grand_total || 0);
        setPeriodStart(r.data.period_start || '');
        setPeriodEnd(r.data.period_end || '');
      })
      .catch(() => { setReport([]); setGrandTotal(0); })
      .finally(() => setLoading(false));
  }, [month]);

  const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const displayed = filter === 'deductions'
    ? report.filter(r => r.total_deduction > 0 || r.total_leave_days > 0)
    : report;

  const withDeductions = report.filter(r => r.total_deduction > 0).length;
  const withLeave      = report.filter(r => r.total_leave_days > 0).length;

  const exportCSV = () => {
    const rows = [
      ['Employee','Department','Leave Days Taken','Unpaid Days','Half-Pay Days',
       'Personal Hrs Over','Unpaid Deduction (AED)','Half-Pay Deduction (AED)',
       'Personal Deduction (AED)','Total Deduction (AED)'],
      ...report.map(r => [
        r.full_name, r.department, r.total_leave_days, r.unpaid_days, r.half_pay_days,
        r.personal_hours_over, r.unpaid_deduction, r.half_pay_deduction,
        r.personal_deduction, r.total_deduction,
      ]),
      ['','','','','','','','','GRAND TOTAL', grandTotal],
    ];
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `leave-log_${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Leave Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {periodStart && periodEnd
              ? <>Payroll cycle: <strong>{dayjs(periodStart).format('D MMM YYYY')}</strong> → <strong>{dayjs(periodEnd).format('D MMM YYYY')}</strong></>
              : 'All employees — leave taken, unpaid days, and salary deductions.'
            }
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <MonthPicker value={month} onChange={setMonth} />
          <button className="btn-secondary" onClick={exportCSV} disabled={report.length === 0}>
            <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-900">{report.length}</p>
              <p className="text-sm text-gray-500 mt-1">Total employees</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-600">{withLeave}</p>
              <p className="text-sm text-gray-500 mt-1">Took leave this month</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-red-600">{withDeductions}</p>
              <p className="text-sm text-gray-500 mt-1">Have salary deductions</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-red-700">AED {fmt(grandTotal)}</p>
              <p className="text-sm text-gray-500 mt-1">Total deductions</p>
            </div>
          </div>

          {/* Filter toggle */}
          <div className="flex gap-2">
            {(['all', 'deductions'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? `All Employees (${report.length})` : `With Deductions (${withDeductions})`}
              </button>
            ))}
          </div>

          {/* Employee list */}
          <div className="space-y-2">
            {displayed.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                No employees match the current filter for {dayjs(month).format('MMMM YYYY')}.
              </div>
            ) : displayed.map(row => (
              <div key={row.employee_id} className="card p-0 overflow-hidden">

                {/* Row */}
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => toggle(row.employee_id)}
                >
                  {expanded[row.employee_id]
                    ? <ChevronDownIcon  className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    : <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  }

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{row.full_name}</p>
                    <p className="text-xs text-gray-500">{row.department || '—'}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
                    {row.total_leave_days > 0 ? (
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                        {row.total_leave_days}d leave taken
                      </span>
                    ) : (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                        No leave
                      </span>
                    )}
                    {row.unpaid_days > 0 && (
                      <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                        {row.unpaid_days}d unpaid
                      </span>
                    )}
                    {row.half_pay_days > 0 && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        {row.half_pay_days}d half-pay
                      </span>
                    )}
                    {row.personal_hours_over > 0 && (
                      <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                        {row.personal_hours_over}h personal over
                      </span>
                    )}
                    {row.total_deduction > 0 ? (
                      <span className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full ml-1">
                        − AED {fmt(row.total_deduction)}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-gray-400 px-3 py-1">
                        No deduction
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded leave details */}
                {expanded[row.employee_id] && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    {row.leave_items.length === 0 ? (
                      <p className="text-sm text-gray-400">No approved leave requests this month.</p>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Leave Details — {dayjs(month).format('MMMM YYYY')}
                        </p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400">
                              <th className="text-left pb-2 font-medium">Type</th>
                              <th className="text-left pb-2 font-medium">Period</th>
                              <th className="text-right pb-2 font-medium">Days</th>
                              <th className="text-right pb-2 font-medium">Paid</th>
                              <th className="text-right pb-2 font-medium">Unpaid</th>
                              <th className="text-right pb-2 font-medium">Half-Pay</th>
                              <th className="text-right pb-2 font-medium">Deduction</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {row.leave_items.map((item, i) => (
                              <tr key={i}>
                                <td className="py-1.5 font-medium text-gray-800">
                                  {LEAVE_LABELS[item.leave_type] || item.leave_type}
                                  {item.sub_type && <span className="text-gray-400 ml-1 font-normal">({item.sub_type})</span>}
                                </td>
                                <td className="py-1.5 text-gray-500">
                                  {dayjs(item.start_date).format('D MMM')}
                                  {item.start_date !== item.end_date && ` – ${dayjs(item.end_date).format('D MMM')}`}
                                </td>
                                <td className="py-1.5 text-right text-gray-700">{item.total_days}</td>
                                <td className="py-1.5 text-right text-green-700">{item.paid_days || '—'}</td>
                                <td className="py-1.5 text-right text-red-600">
                                  {item.unpaid_days > 0 ? item.unpaid_days : '—'}
                                </td>
                                <td className="py-1.5 text-right text-amber-600">
                                  {item.half_pay_days > 0 ? item.half_pay_days : '—'}
                                </td>
                                <td className="py-1.5 text-right font-semibold text-red-600">
                                  {(item.unpaid_deduction + item.half_pay_deduction) > 0
                                    ? `− AED ${fmt(item.unpaid_deduction + item.half_pay_deduction)}`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {row.total_deduction > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between">
                            <span className="text-sm font-semibold text-gray-700">Total deduction</span>
                            <span className="text-sm font-bold text-red-700">− AED {fmt(row.total_deduction)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Grand total footer */}
          {grandTotal > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-900">
                  Total deductions — {dayjs(month).format('MMMM YYYY')} payroll
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {periodStart && periodEnd
                    ? `${dayjs(periodStart).format('D MMM')} – ${dayjs(periodEnd).format('D MMM YYYY')} · `
                    : ''}
                  {withDeductions} employee{withDeductions !== 1 ? 's' : ''} affected
                </p>
              </div>
              <p className="text-2xl font-bold text-red-700">AED {fmt(grandTotal)}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
