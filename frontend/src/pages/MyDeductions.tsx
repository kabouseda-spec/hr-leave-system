import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../api/client';

interface LeaveItem {
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  unpaid_days: number;
  half_pay_days: number;
  daily_rate: number;
  deduction: number;
}

interface PayslipData {
  month: string;
  salary: { basic: number; hra: number; other: number; total: number };
  leaves: LeaveItem[];
  personal_time_deduction: number;
  personal_hours_over: number;
  total_deduction: number;
  net_pay: number;
}

const LEAVE_LABELS: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  unpaid: 'Unpaid Leave',
  personal: 'Personal Time',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  emergency: 'Emergency Leave',
  business_trip: 'Business Trip',
  comp: 'Compensatory Off',
};

export default function MyDeductions() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [data, setData] = useState<PayslipData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/payslip?month=${month}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  const fmt = (n: number) => `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Deductions</h1>
          <p className="text-sm text-gray-500 mt-1">Salary deductions for the selected month</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          Could not load deduction data.
        </div>
      ) : data.total_deduction === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-700 font-medium">No deductions for {dayjs(month).format('MMMM YYYY')}</p>
          <p className="text-gray-400 text-sm mt-1">Your full salary will be paid this month.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Gross Salary</p>
              <p className="text-lg font-bold text-gray-900">{fmt(data.salary.total)}</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
              <p className="text-xs text-red-500 mb-1">Total Deductions</p>
              <p className="text-lg font-bold text-red-600">− {fmt(data.total_deduction)}</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
              <p className="text-xs text-green-600 mb-1">Net Pay</p>
              <p className="text-lg font-bold text-green-700">{fmt(data.net_pay)}</p>
            </div>
          </div>

          {/* Leave deductions */}
          {data.leaves.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Leave Deductions</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">Leave Type</th>
                    <th className="px-5 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-right">Unpaid Days</th>
                    <th className="px-4 py-3 text-right">Half-Pay Days</th>
                    <th className="px-5 py-3 text-right">Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.leaves.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {LEAVE_LABELS[item.leave_type] || item.leave_type}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {dayjs(item.start_date).format('D MMM')}
                        {item.start_date !== item.end_date && ` – ${dayjs(item.end_date).format('D MMM')}`}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {item.unpaid_days > 0 ? item.unpaid_days : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {item.half_pay_days > 0 ? item.half_pay_days : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-red-600">
                        − {fmt(item.deduction)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Personal time overage */}
          {data.personal_time_deduction > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Personal Time Overage</h2>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-700">Hours used beyond allocation</p>
                  <p className="text-sm text-gray-400 mt-0.5">{data.personal_hours_over.toFixed(1)} hrs over limit</p>
                </div>
                <p className="text-lg font-semibold text-red-600">− {fmt(data.personal_time_deduction)}</p>
              </div>
            </div>
          )}

          {/* Total row */}
          <div className="bg-gray-800 rounded-xl px-5 py-4 flex items-center justify-between text-white">
            <p className="font-semibold">Total Deductions — {dayjs(month).format('MMMM YYYY')}</p>
            <p className="text-xl font-bold text-red-300">− {fmt(data.total_deduction)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
