import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface PayslipData {
  month: string;
  employee: { id: string; name: string; employee_number: string; department: string; hire_date: string };
  salary: { basic: number; hra: number; other: number; total: number };
  leaves: { leave_type: string; start_date: string; end_date: string; total_days: number; unpaid_days: number; half_pay_days: number; daily_rate: number; deduction: number }[];
  personal_time_deduction: number;
  personal_hours_over: number;
  total_deduction: number;
  net_pay: number;
  gratuity: { eligible: boolean; amount: number; yearsWorked: number; tier?: string };
  working_days: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const months = [];
  for (let i = 11; i >= 0; i--) months.push(dayjs().subtract(i, 'month').format('YYYY-MM'));
  for (let i = 1; i <= 2; i++) months.push(dayjs().add(i, 'month').format('YYYY-MM'));
  return (
    <select className="input w-auto" value={value} onChange={e => onChange(e.target.value)}>
      {months.map(m => <option key={m} value={m}>{dayjs(m).format('MMMM YYYY')}</option>)}
    </select>
  );
}

export default function PaySlip() {
  const { user } = useAuth();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [data, setData] = useState<PayslipData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/payslip?month=${month}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [month]);

  const print = () => window.print();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return <div className="card text-center text-gray-400 py-10">No payslip data available.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Payslip</h1>
          <p className="text-gray-500 text-sm mt-0.5">Monthly salary breakdown and deductions</p>
        </div>
        <div className="flex gap-3">
          <MonthPicker value={month} onChange={setMonth} />
          <button className="btn-secondary" onClick={print}>
            <ArrowDownTrayIcon className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {/* Payslip card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden" id="payslip">

        {/* Header */}
        <div className="bg-brand-800 px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img src="/logo.png" alt="Kinetics Group" className="h-8 object-contain brightness-0 invert" />
            </div>
            <p className="text-blue-200 text-xs">Kinetics Group — HR Leave System</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-lg">{dayjs(data.month).format('MMMM YYYY')}</p>
            <p className="text-blue-200 text-xs">Pay Statement</p>
          </div>
        </div>

        {/* Employee info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400">Name</span><p className="font-semibold text-gray-900">{data.employee.name}</p></div>
          <div><span className="text-gray-400">Employee #</span><p className="font-semibold text-gray-900">{data.employee.employee_number}</p></div>
          <div><span className="text-gray-400">Department</span><p className="font-semibold text-gray-900">{data.employee.department}</p></div>
          <div><span className="text-gray-400">Working Days</span><p className="font-semibold text-gray-900">{data.working_days} days</p></div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Earnings */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Earnings</p>
            <div className="space-y-1">
              {[
                { label: 'Basic Salary', amount: data.salary.basic },
                { label: 'Housing Allowance (HRA)', amount: data.salary.hra },
                { label: 'Other Allowances', amount: data.salary.other },
              ].filter(r => r.amount > 0).map(r => (
                <div key={r.label} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-gray-600">{r.label}</span>
                  <span className="font-medium">AED {fmt(r.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm py-2 font-bold text-green-700 bg-green-50 px-2 rounded-lg mt-1">
                <span>Total Earnings</span>
                <span>AED {fmt(data.salary.total)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Deductions</p>
            {data.leaves.length === 0 && data.personal_time_deduction === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">No deductions this month.</p>
            ) : (
              <div className="space-y-1">
                {data.leaves.map((l, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                    <div>
                      <span className="text-gray-600 capitalize">{l.leave_type} leave</span>
                      <span className="text-xs text-gray-400 ml-2">
                        ({dayjs(l.start_date).format('D MMM')} – {dayjs(l.end_date).format('D MMM')})
                        {l.unpaid_days > 0 ? ` · ${l.unpaid_days}d unpaid` : ''}
                        {l.half_pay_days > 0 ? ` · ${l.half_pay_days}d half-pay` : ''}
                      </span>
                    </div>
                    <span className="font-medium text-red-600">- AED {fmt(l.deduction)}</span>
                  </div>
                ))}
                {data.personal_time_deduction > 0 && (
                  <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-600">Personal time overage ({data.personal_hours_over.toFixed(1)}h)</span>
                    <span className="font-medium text-red-600">- AED {fmt(data.personal_time_deduction)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm py-2 font-bold text-red-700 bg-red-50 px-2 rounded-lg mt-1">
                  <span>Total Deductions</span>
                  <span>- AED {fmt(data.total_deduction)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Net pay */}
          <div className="bg-brand-800 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-xs">Net Pay</p>
              <p className="text-white font-bold text-2xl">AED {fmt(data.net_pay)}</p>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-xs">{dayjs(data.month).format('MMMM YYYY')}</p>
            </div>
          </div>

          {/* Accumulated Gratuity */}
          <div className="border border-gray-100 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Accumulated Gratuity (as of this month)</p>
            {data.gratuity.eligible ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{data.gratuity.yearsWorked?.toFixed(1)} years · {data.gratuity.tier}</p>
                  <p className="text-xs text-gray-400">Calculated on basic salary only</p>
                </div>
                <p className="text-lg font-bold text-brand-700">AED {fmt(data.gratuity.amount)}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Less than 1 year of service — gratuity not yet applicable.</p>
            )}
          </div>

        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">This is a system-generated payslip. For queries contact HR.</p>
        </div>
      </div>
    </div>
  );
}
