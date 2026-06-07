import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface ReportRow {
  id: string;
  employee_number: string;
  full_name: string;
  department: string;
  hire_date: string;
  balances: Record<string, {
    allocated: number;
    used_paid: number;
    used_half: number;
    used_unpaid: number;
    pending: number;
  }>;
  noSickLeaveBonus: boolean;
  gratuity: { eligible: boolean; amount: number; yearsWorked: number };
}

export default function AdminReports() {
  const [report, setReport] = useState<ReportRow[]>([]);
  const [year, setYear] = useState(dayjs().year());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'leaves' | 'gratuity'>('leaves');

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/summary?year=${year}`)
      .then(r => setReport(r.data.report))
      .finally(() => setLoading(false));
  }, [year]);

  const exportCSV = () => {
    const headers = ['Emp#', 'Name', 'Department', 'Annual Used', 'Annual Remaining', 'Sick Used', 'Sick Paid', 'Sick Half', 'Sick Unpaid', 'No Sick Bonus'];
    const rows = report.map(r => {
      const ann = r.balances['annual'] || {};
      const sick = r.balances['sick'] || {};
      const annUsed = (ann.used_paid || 0) + (ann.used_half || 0) + (ann.used_unpaid || 0);
      const sickUsed = (sick.used_paid || 0) + (sick.used_half || 0) + (sick.used_unpaid || 0);
      return [
        r.employee_number, r.full_name, r.department,
        annUsed, (ann.allocated || 0) - annUsed,
        sickUsed, sick.used_paid || 0, sick.used_half || 0, sick.used_unpaid || 0,
        r.noSickLeaveBonus ? 'Yes (+4 days)' : 'No',
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leave_report_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Full leave and gratuity summary</p>
        </div>
        <div className="flex gap-3">
          <select className="input w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[dayjs().year() - 1, dayjs().year()].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={exportCSV}>
            <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['leaves', 'gratuity'] as const).map(t => (
          <button
            key={t}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab(t)}
          >
            {t === 'leaves' ? 'Leave Summary' : 'Gratuity'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : tab === 'leaves' ? (
        <div className="card p-0 overflow-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {['Emp#', 'Name', 'Dept', 'Annual Alloc', 'Ann Used', 'Ann Rem', 'Sick Used', 'Sick Paid', 'Sick ½', 'Sick Unpaid', 'No-Sick Bonus', 'Pending'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.map(r => {
                const ann = r.balances['annual'] || {};
                const sick = r.balances['sick'] || {};
                const annUsed = (ann.used_paid || 0) + (ann.used_half || 0) + (ann.used_unpaid || 0);
                const sickUsed = (sick.used_paid || 0) + (sick.used_half || 0) + (sick.used_unpaid || 0);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-500 text-xs">{r.employee_number}</td>
                    <td className="px-3 py-3 font-medium whitespace-nowrap">{r.full_name}</td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{r.department}</td>
                    <td className="px-3 py-3">{ann.allocated || 0}</td>
                    <td className="px-3 py-3">{annUsed}</td>
                    <td className="px-3 py-3 font-semibold text-green-700">{(ann.allocated || 0) - annUsed}</td>
                    <td className="px-3 py-3">{sickUsed}</td>
                    <td className="px-3 py-3 text-green-700">{sick.used_paid || 0}</td>
                    <td className="px-3 py-3 text-yellow-700">{sick.used_half || 0}</td>
                    <td className="px-3 py-3 text-red-700">{sick.used_unpaid || 0}</td>
                    <td className="px-3 py-3">
                      {r.noSickLeaveBonus
                        ? <span className="text-green-700 font-medium">+4 days</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-yellow-700">{ann.pending || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Department', 'Hire Date', 'Years', 'Eligible', 'Gratuity (AED)'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.department}</td>
                  <td className="px-4 py-3 text-gray-600">{dayjs(r.hire_date).format('D MMM YYYY')}</td>
                  <td className="px-4 py-3">{r.gratuity.yearsWorked?.toFixed(1) ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.gratuity.eligible
                      ? <span className="badge-approved">Eligible</span>
                      : <span className="badge-cancelled">Not yet</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {r.gratuity.eligible ? r.gratuity.amount.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
