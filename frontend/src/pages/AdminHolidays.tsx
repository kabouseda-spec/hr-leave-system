import { useEffect, useState, FormEvent } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Holiday {
  id: string;
  date: string;
  end_date: string | null;
  name: string;
  year: number;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function groupByMonth(holidays: Holiday[]) {
  const groups: Record<number, Holiday[]> = {};
  for (const h of holidays) {
    const m = new Date(h.date).getMonth();
    if (!groups[m]) groups[m] = [];
    groups[m].push(h);
  }
  return groups;
}

export default function AdminHolidays() {
  const [year, setYear] = useState(dayjs().year());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get(`/admin/holidays?year=${year}`)
      .then(r => setHolidays(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      await api.post('/admin/holidays', { date: newDate, end_date: newEndDate || newDate, name: newName });
      setNewDate(''); setNewEndDate(''); setNewName(''); setShowAdd(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add holiday');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from holidays? This will affect leave calculations.`)) return;
    await api.delete(`/admin/holidays/${id}`);
    load();
  };

  const saveEdit = async (id: string) => {
    await api.patch(`/admin/holidays/${id}`, { date: editDate, name: editName });
    setEditId(null);
    load();
  };

  const groups = groupByMonth(holidays);
  const years = [dayjs().year() - 1, dayjs().year(), dayjs().year() + 1, dayjs().year() + 2];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Public Holidays</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Holidays are automatically excluded from leave day calculations.
            <span className="font-medium text-brand-700"> {holidays.length} holidays in {year}.</span>
          </p>
        </div>
        <div className="flex gap-3">
          <select className="input w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <PlusIcon className="h-4 w-4" /> Add Holiday
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card border-brand-200 bg-brand-50">
          <h3 className="font-semibold text-gray-900 mb-4">Add New Holiday</h3>
          <form onSubmit={add} className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="label">Start Date</label>
              <input type="date" className="input" value={newDate}
                onChange={e => { setNewDate(e.target.value); if (!newEndDate) setNewEndDate(e.target.value); }} required />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="label">End Date</label>
              <input type="date" className="input" value={newEndDate}
                min={newDate}
                onChange={e => setNewEndDate(e.target.value)} required />
              {newDate && newEndDate && newEndDate > newDate && (
                <p className="text-xs text-brand-600 mt-1">
                  {Math.round((new Date(newEndDate).getTime() - new Date(newDate).getTime()) / 86400000) + 1} days
                </p>
              )}
            </div>
            <div className="flex-[2] min-w-[220px]">
              <label className="label">Holiday Name</label>
              <input type="text" className="input" value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Eid Al Fitr (3 days)" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={adding}>
                {adding ? 'Adding…' : 'Add'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setShowAdd(false); setError(''); }}>
                Cancel
              </button>
            </div>
          </form>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}

      {/* Holiday grid by month */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-7 w-7 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : holidays.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No holidays added for {year}</p>
          <p className="text-sm">Click "Add Holiday" to add UAE public holidays and company days off.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }, (_, i) => i)
            .filter(m => groups[m])
            .map(m => (
              <div key={m} className="card p-0 overflow-hidden">
                <div className="bg-brand-600 px-4 py-2">
                  <h3 className="text-white font-semibold text-sm">{MONTH_NAMES[m]} {year}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {groups[m].map(h => (
                    <div key={h.id} className="px-4 py-2.5">
                      {editId === h.id ? (
                        <div className="flex gap-2 items-center">
                          <input type="date" className="input text-xs py-1 flex-shrink-0 w-36"
                            value={editDate} onChange={e => setEditDate(e.target.value)} />
                          <input type="text" className="input text-xs py-1 flex-1"
                            value={editName} onChange={e => setEditName(e.target.value)} />
                          <button onClick={() => saveEdit(h.id)} className="text-green-600 hover:text-green-800">
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{h.name}</p>
                            <p className="text-xs text-gray-400">
                              {h.end_date && h.end_date !== h.date
                                ? `${dayjs(h.date).format('D MMM')} – ${dayjs(h.end_date).format('D MMM')} (${dayjs(h.end_date).diff(dayjs(h.date), 'day') + 1} days)`
                                : dayjs(h.date).format('dddd, D MMMM')
                              }
                            </p>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditId(h.id); setEditName(h.name); setEditDate(h.date); }}
                              className="text-gray-400 hover:text-brand-600"
                              title="Edit"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => remove(h.id, h.name)}
                              className="text-gray-400 hover:text-red-600"
                              title="Remove"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">How holidays affect leave calculations</p>
        <p>When an employee requests leave, the system automatically counts only <strong>working days</strong> — weekends (Friday/Saturday) and any dates listed here are skipped. Adding or removing a holiday immediately affects all future leave day calculations.</p>
      </div>
    </div>
  );
}
