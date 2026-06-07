import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface LeaveItem {
  leave_type: string;
  sub_type: string | null;
  start_date: string;
  end_date: string;
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
  hourly_rate: number;
  unpaid_days: number;
  half_pay_days: number;
  personal_hours_over: number;
  unpaid_deduction: number;
  half_pay_deduction: number;
  personal_deduction: number;
  total_deduction: number;
  leave_items: LeaveItem[];
}

const DEPT_COLORS = [
  '#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6',
  '#ec4899','#06b6d4','#f97316','#6366f1','#14b8a6',
];

function fmt(n: number) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = dayjs().subtract(i, 'month');
    months.push({ value: d.format('YYYY-MM'), label: d.format('MMMM YYYY') });
  }
  for (let i = 1; i <= 3; i++) {
    const d = dayjs().add(i, 'month');
    months.push({ value: d.format('YYYY-MM'), label: d.format('MMMM YYYY') });
  }
  return (
    <select className="input w-auto" value={value} onChange={e => onChange(e.target.value)}>
      {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
    </select>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DeductionRow;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[200px]">
      <p className="font-semibold text-gray-900 mb-2">{d.full_name}</p>
      <p className="text-gray-500 text-xs mb-2">{d.department}</p>
      {d.unpaid_deduction > 0 && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Unpaid ({d.unpaid_days}d)</span>
          <span className="text-red-700 font-medium">− AED {fmt(d.unpaid_deduction)}</span>
        </div>
      )}
      {d.half_pay_deduction > 0 && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Half-pay ({d.half_pay_days}d)</span>
          <span className="text-amber-700 font-medium">− AED {fmt(d.half_pay_deduction)}</span>
        </div>
      )}
      {d.personal_deduction > 0 && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Personal overtime ({d.personal_hours_over}h)</span>
          <span className="text-purple-700 font-medium">− AED {fmt(d.personal_deduction)}</span>
        </div>
      )}
      <div className="flex justify-between gap-4 mt-2 pt-2 border-t border-gray-100">
        <span className="font-semibold text-gray-700">Total</span>
        <span className="font-bold text-red-700">− AED {fmt(d.total_deduction)}</span>
      </div>
    </div>
  );
};

export default function AdminDeductions() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [report, setReport] = useState<DeductionRow[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    api.get(`/reports/deductions?month=${month}`)
      .then(r => { setReport(r.data.report); setGrandTotal(r.data.grand_total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month]);

  const toggleExpand = (id: string) =>
    setExpanded(e => ({ ...e, [id]: !e[id] }));

  const exportCSV = () => {
    const rows = [
      ['Employee', 'Department', 'Basic Salary', 'Unpaid Days', 'Half-Pay Days', 'Personal Hrs Over',
       'Unpaid Deduction (AED)', 'Half-Pay Deduction (AED)', 'Personal Deduction (AED)', 'Total Deduction (AED)'],
      ...report.map(r => [
        r.full_name, r.department, r.basic_salary, r.unpaid_days, r.half_pay_days,
        r.personal_hours_over, r.unpaid_deduction, r.half_pay_deduction, r.personal_deduction, r.total_deduction,
      ]),
      ['', '', '', '', '', '', '', '', 'GRAND TOTAL', grandTotal],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `deductions_${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = [...report].sort((a, b) => b.total_deduction - a.total_deduction);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Deductions</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Employees with salary deductions from unpaid leave, half-pay leave, or personal time overages.
          </p>
        </div>
        <div className="flex gap-3">
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
      ) : report.length === 0 ? (
        <div className="card text-center py-14 text-gray-400">
          <p className="text-lg font-medium mb-1">No deductions in {dayjs(month).format('MMMM YYYY')}</p>
          <p className="text-sm">All employees are within their paid leave allocations this month.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-red-700">AED {fmt(grandTotal)}</p>
              <p className="text-sm text-gray-500 mt-1">Total deductions — {dayjs(month).format('MMMM YYYY')}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-900">{report.length}</p>
              <p className="text-sm text-gray-500 mt-1">Employee{report.length > 1 ? 's' : ''} affected</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-900">
                AED {fmt(grandTotal / report.length)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Average deduction per employee</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Deductions by Employee — {dayjs(month).format('MMMM YYYY')}
            </h2>
            <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 52)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 80, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  tickFormatter={v => `AED ${v.toLocaleString()}`}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <YAxis
                  type="category"
                  dataKey="full_name"
                  width={130}
                  tick={{ fontSize: 12, fill: '#374151' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_deduction" radius={[0, 6, 6, 0]} maxBarSize={36}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="total_deduction"
                    position="right"
                    formatter={(v: number) => `AED ${v.toLocaleString()}`}
                    style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed breakdown table */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Detailed Breakdown</h2>
            <div className="space-y-2">
              {report.map(row => (
                <div key={row.employee_id} className="card p-0 overflow-hidden">

                  {/* Employee row */}
                  <button
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => toggleExpand(row.employee_id)}
                  >
                    {expanded[row.employee_id]
                      ? <ChevronDownIcon  className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    }

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{row.full_name}</p>
                      <p className="text-xs text-gray-500">{row.department} · Basic: AED {row.basic_salary.toLocaleString()} · Daily rate: AED {fmt(row.daily_rate)}</p>
                    </div>

                    {/* Deduction pills */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {row.unpaid_deduction > 0 && (
                        <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                          {row.unpaid_days}d unpaid · − AED {fmt(row.unpaid_deduction)}
                        </span>
                      )}
                      {row.half_pay_deduction > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          {row.half_pay_days}d half-pay · − AED {fmt(row.half_pay_deduction)}
                        </span>
                      )}
                      {row.personal_deduction > 0 && (
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                          {row.personal_hours_over}h personal · − AED {fmt(row.personal_deduction)}
                        </span>
                      )}
                      <span className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full ml-1">
                        − AED {fmt(row.total_deduction)}
                      </span>
                    </div>
                  </button>

                  {/* Expanded leave items */}
                  {expanded[row.employee_id] && row.leave_items.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Leave Details</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400">
                            <th className="text-left pb-1 font-medium">Type</th>
                            <th className="text-left pb-1 font-medium">Period</th>
                            <th className="text-right pb-1 font-medium">Unpaid Days</th>
                            <th className="text-right pb-1 font-medium">Half-Pay Days</th>
                            <th className="text-right pb-1 font-medium">Deduction</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {row.leave_items.map((item, i) => (
                            <tr key={i}>
                              <td className="py-1.5 capitalize">
                                {item.leave_type}
                                {item.sub_type && <span className="text-gray-400 ml-1">({item.sub_type})</span>}
                              </td>
                              <td className="py-1.5 text-gray-500">
                                {dayjs(item.start_date).format('D MMM')} – {dayjs(item.end_date).format('D MMM YYYY')}
                              </td>
                              <td className="py-1.5 text-right text-red-700">
                                {item.unpaid_days > 0 ? item.unpaid_days : '—'}
                              </td>
                              <td className="py-1.5 text-right text-amber-700">
                                {item.half_pay_days > 0 ? item.half_pay_days : '—'}
                              </td>
                              <td className="py-1.5 text-right font-medium text-red-700">
                                − AED {fmt(item.unpaid_deduction + item.half_pay_deduction)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Grand total footer */}
          <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-red-900">Total payroll deductions — {dayjs(month).format('MMMM YYYY')}</p>
              <p className="text-xs text-red-600 mt-0.5">Across {report.length} employee{report.length > 1 ? 's' : ''} in {[...new Set(report.map(r => r.department))].length} department{[...new Set(report.map(r => r.department))].length > 1 ? 's' : ''}</p>
            </div>
            <p className="text-2xl font-bold text-red-700">AED {fmt(grandTotal)}</p>
          </div>
        </>
      )}
    </div>
  );
}
