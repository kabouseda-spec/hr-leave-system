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
  gratuity: {
    eligible: boolean; amount: number; rawAmount?: number; yearsWorked: number; fullYears?: number;
    tier?: string; breakdown?: string; capped?: boolean; cap?: number; dailyRate?: number; basicSalary?: number;
  };
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
        <div className="space-y-4">
          {/* Gratuity policy reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
            <p className="font-semibold mb-2">📋 Gratuity Entitlement — UAE Labour Law</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-lg p-2 border border-blue-100"><span className="text-gray-500">Less than 1 year:</span> <span className="font-medium">No gratuity</span></div>
              <div className="bg-white rounded-lg p-2 border border-blue-100"><span className="text-gray-500">1–5 years:</span> <span className="font-medium">21 days' basic salary × years</span></div>
              <div className="bg-white rounded-lg p-2 border border-blue-100"><span className="text-gray-500">Over 5 years:</span> <span className="font-medium">(21 days × 5 yrs) + (30 days × extra yrs)</span></div>
              <div className="bg-white rounded-lg p-2 border border-blue-100"><span className="text-gray-500">Maximum cap:</span> <span className="font-medium text-red-600">2 years' total wage</span></div>
            </div>
            <p className="text-xs text-blue-600 mt-2">⚠️ Gratuity is calculated on <strong>Basic Salary only</strong> — not HRA or other allowances.</p>
          </div>

          <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Department', 'Hire Date', 'Years', 'Basic Salary', 'Daily Rate', 'Tier', 'Calculation', 'Gratuity (AED)', 'Capped?'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.map(r => {
                const g = r.gratuity;
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 ${!g.eligible ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{r.full_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.department}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dayjs(r.hire_date).format('D MMM YYYY')}</td>
                    <td className="px-4 py-3 font-medium">{g.yearsWorked?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-3 text-green-700 font-medium">
                      {g.basicSalary ? `AED ${g.basicSalary.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {g.dailyRate ? `AED ${g.dailyRate.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {g.eligible
                        ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.tier === 'over 5 years' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {g.tier}
                          </span>
                        : <span className="badge-cancelled">Not eligible</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{g.breakdown || '—'}</td>
                    <td className="px-4 py-3">
                      {g.eligible ? (
                        <div>
                          <p className="font-bold text-gray-900">AED {g.amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</p>
                          {g.capped && (
                            <p className="text-xs text-red-500">⚠️ Capped at AED {g.cap?.toLocaleString()}</p>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {g.capped
                        ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Yes</span>
                        : <span className="text-xs text-gray-400">No</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
