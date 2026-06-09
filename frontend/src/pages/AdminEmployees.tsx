import { useEffect, useState, FormEvent } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { PlusIcon, XMarkIcon, ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  hire_date: string;
  rollover_month: number;
  probation_end_date: string;
  basic_salary: number;
  manager_name: string;
  is_active: number;
  end_of_service_date: string;
  date_of_birth: string;
  spouse_name: string;
  spouse_dob: string;
  visa_expiry: string;
  visa_type: string;
  visa_number: string;
  passport_expiry: string;
  passport_number: string;
}

interface FamilyMember {
  id: string;
  relationship: string;
  name: string;
  date_of_birth: string | null;
}

const DEPARTMENTS = [
  'Top Management', 'HR', 'Engineering', 'AI', 'Design',
  'Accounting', 'Finance', 'Sales', 'Sales Admin', 'Marketing',
  'Shipping', 'Logistics', 'Operations', 'Execution', 'Legal',
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function visaStatus(visa_expiry?: string) {
  if (!visa_expiry) return null;
  const days = dayjs(visa_expiry).diff(dayjs(), 'day');
  if (days < 0)  return { label: 'Expired',   color: 'text-red-700 bg-red-50 border-red-200' };
  if (days <= 30) return { label: `${days}d left`, color: 'text-red-700 bg-red-50 border-red-200' };
  if (days <= 90) return { label: `${days}d left`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: `${days}d left`, color: 'text-green-700 bg-green-50 border-green-200' };
}

const BLANK_FORM = {
  employee_number: '', full_name: '', email: '', password: '',
  role: 'employee', department: 'Engineering',
  hire_date: dayjs().format('YYYY-MM-DD'),
  probation_end_date: dayjs().add(6, 'month').format('YYYY-MM-DD'),
  basic_salary: '', hra: '', other_allowance: '', manager_id: '',
  passport_number: '', passport_expiry: '',
  visa_number: '', visa_type: 'Employment', visa_expiry: '', visa_country: 'UAE',
  end_of_service_date: '',
  date_of_birth: '', spouse_name: '', spouse_dob: '', spouse_in_uae: false, marriage_anniversary: '',
};

export default function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [activeTab, setActiveTab] = useState<'info' | 'personal' | 'visa'>('info');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [newMember, setNewMember] = useState({ relationship: 'child', name: '', date_of_birth: '' });
  const [addingMember, setAddingMember] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/employees').then(r => setEmployees(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm({ ...BLANK_FORM }); setEditing(null); setFamilyMembers([]); setActiveTab('info'); setShowForm(true); };
  const openEdit = async (emp: Employee) => {
    // Reset form to blank first so no stale data shows while loading
    setForm({ ...BLANK_FORM });
    setFamilyMembers([]);
    setEditing(emp);
    setActiveTab('info');
    setShowForm(true);

    // Fetch full employee record (includes all fields like date_of_birth, spouse_dob etc.)
    try {
      const { data: full } = await api.get(`/employees/${emp.id}`);
      setForm({
        employee_number: full.employee_number, full_name: full.full_name,
        email: full.email, password: '', role: full.role, department: full.department,
        hire_date: full.hire_date, probation_end_date: full.probation_end_date || '',
        basic_salary: String(full.basic_salary || 0), hra: String(full.hra || 0), other_allowance: String(full.other_allowance || 0), manager_id: full.manager_id || '',
        passport_number: full.passport_number || '', passport_expiry: full.passport_expiry || '',
        visa_number: full.visa_number || '', visa_type: full.visa_type || 'Employment',
        visa_expiry: full.visa_expiry || '', visa_country: full.visa_country || 'UAE',
        end_of_service_date: full.end_of_service_date || '',
        date_of_birth: full.date_of_birth || '',
        spouse_name: full.spouse_name || '',
        spouse_dob: full.spouse_dob || '',
        spouse_in_uae: !!full.spouse_in_uae,
        marriage_anniversary: full.marriage_anniversary || '',
      });
    } catch {
      // fallback to list data
      setForm({
        employee_number: emp.employee_number, full_name: emp.full_name,
        email: emp.email, password: '', role: emp.role, department: emp.department,
        hire_date: emp.hire_date, probation_end_date: emp.probation_end_date || '',
        basic_salary: String(emp.basic_salary), manager_id: '',
        passport_number: emp.passport_number || '', passport_expiry: emp.passport_expiry || '',
        visa_number: emp.visa_number || '', visa_type: emp.visa_type || 'Employment',
        visa_expiry: emp.visa_expiry || '', visa_country: 'UAE',
        end_of_service_date: emp.end_of_service_date || '',
        hra: '0', other_allowance: '0',
        date_of_birth: '', spouse_name: '', spouse_dob: '', spouse_in_uae: false, marriage_anniversary: '',
      });
    }

    // Load family members
    api.get(`/employees/${emp.id}/family`).then(r => setFamilyMembers(r.data)).catch(() => {});
  };

  const addFamilyMember = async () => {
    if (!editing || !newMember.name) return;
    setAddingMember(true);
    try {
      const res = await api.post(`/employees/${editing.id}/family`, newMember);
      setFamilyMembers(prev => [...prev, { ...res.data, ...newMember }]);
      setNewMember({ relationship: 'child', name: '', date_of_birth: '' });
    } finally { setAddingMember(false); }
  };

  const removeFamilyMember = async (memberId: string) => {
    if (!editing) return;
    await api.delete(`/employees/${editing.id}/family/${memberId}`);
    setFamilyMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form, basic_salary: parseFloat(form.basic_salary) || 0 };
      if (editing) {
        await api.patch(`/employees/${editing.id}`, payload);
      } else {
        await api.post('/employees', payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save employee');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  // Visa expiry warnings
  const expiringVisa = employees.filter(e => {
    if (!e.visa_expiry) return false;
    const d = dayjs(e.visa_expiry).diff(dayjs(), 'day');
    return d >= 0 && d <= 90;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-0.5">{employees.filter(e => e.is_active).length} active employees</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <PlusIcon className="h-4 w-4" /> Add Employee
        </button>
      </div>

      {/* Visa expiry alerts */}
      {expiringVisa.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
            <p className="font-semibold text-orange-800 text-sm">{expiringVisa.length} visa{expiringVisa.length > 1 ? 's' : ''} expiring within 90 days</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringVisa.map(e => {
              const days = dayjs(e.visa_expiry).diff(dayjs(), 'day');
              return (
                <span key={e.id} className="text-xs bg-white border border-orange-200 text-orange-700 px-2.5 py-1 rounded-full">
                  {e.full_name} — {days}d ({e.visa_expiry})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input className="input max-w-xs" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-auto" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Employee table */}
      <div className="card p-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-7 w-7 border-4 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-sm min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {['Emp#', 'Name', 'Dept', 'Role', 'Hire Date', 'Rollover', 'Probation End', 'Visa Expiry', 'Basic (AED)', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(emp => {
                const vs = visaStatus(emp.visa_expiry);
                return (
                  <tr key={emp.id} className={`hover:bg-gray-50 ${!emp.is_active ? 'opacity-40' : ''}`}>
                    <td className="px-3 py-3 text-gray-400 text-xs">{emp.employee_number}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium whitespace-nowrap">{emp.full_name}</p>
                      <p className="text-xs text-gray-400">{emp.email}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{emp.department}</td>
                    <td className="px-3 py-3 capitalize">{emp.role.replace('_', ' ')}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{dayjs(emp.hire_date).format('D MMM YYYY')}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                        {emp.rollover_month ? MONTH_NAMES[emp.rollover_month - 1] : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-500 text-xs">
                      {emp.probation_end_date ? dayjs(emp.probation_end_date).format('D MMM YYYY') : '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {vs ? (
                        <span className={`text-xs border px-2 py-0.5 rounded-full ${vs.color}`}>{vs.label}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3">{emp.basic_salary.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      {emp.end_of_service_date ? (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">
                          Left {dayjs(emp.end_of_service_date).format('D MMM YYYY')}
                        </span>
                      ) : emp.is_active ? (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-500">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => openEdit(emp)} className="text-xs text-brand-600 hover:underline">Edit</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold">{editing ? `Edit — ${editing.full_name}` : 'Add New Employee'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 pt-4 flex-shrink-0 flex-wrap">
              {([
                { key: 'info',     label: 'Personal Info' },
                { key: 'personal', label: 'Family & Birthdays' },
                { key: 'visa',     label: 'Visa & Passport' },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 p-5">

                {activeTab === 'info' && (
                  <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Employee #</label>
                      <input className="input" value={form.employee_number} onChange={e => setForm(f => ({ ...f, employee_number: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Full Name</label>
                      <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">{editing ? 'New Password (leave blank to keep)' : 'Password'}</label>
                      <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} {...(!editing ? { required: true, minLength: 8 } : {})} />
                    </div>
                    <div>
                      <label className="label">Role</label>
                      <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="hr_admin">HR Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Department</label>
                      <select className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Hire Date</label>
                      <input type="date" className="input" value={form.hire_date} onChange={e => setForm(f => ({
                        ...f, hire_date: e.target.value,
                        probation_end_date: dayjs(e.target.value).add(6, 'month').format('YYYY-MM-DD'),
                      }))} required />
                      {form.hire_date && (
                        <p className="text-xs text-gray-400 mt-1">
                          Rollover month: <strong>{MONTH_NAMES[dayjs(form.hire_date).month()]}</strong>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Probation End Date</label>
                      <input type="date" className="input" value={form.probation_end_date} onChange={e => setForm(f => ({ ...f, probation_end_date: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pt-1">Salary Breakdown (AED)</p>
                    </div>
                    <div>
                      <label className="label">Basic Salary</label>
                      <input type="number" className="input" value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label">HRA (Housing Allowance)</label>
                      <input type="number" className="input" value={form.hra} onChange={e => setForm(f => ({ ...f, hra: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label">Other Allowances</label>
                      <input type="number" className="input" value={form.other_allowance} onChange={e => setForm(f => ({ ...f, other_allowance: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label">Full Salary (Total)</label>
                      <div className="input bg-gray-50 text-gray-700 font-semibold">
                        AED {((parseFloat(form.basic_salary)||0) + (parseFloat(form.hra)||0) + (parseFloat(form.other_allowance)||0)).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <label className="label">Manager</label>
                      <select className="input" value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}>
                        <option value="">None</option>
                        {employees.filter(e => e.role !== 'employee' && e.id !== editing?.id).map(e => (
                          <option key={e.id} value={e.id}>{e.full_name} ({e.department})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* End of Service — only shown when editing */}
                  {editing && (
                    <div className="pt-2 border-t border-red-100 bg-red-50 rounded-xl p-4">
                      <label className="block text-sm font-semibold text-red-800 mb-1">End of Service Date</label>
                      <p className="text-xs text-red-600 mb-2">Setting this date automatically marks the employee as inactive.</p>
                      <input
                        type="date"
                        className="input border-red-300"
                        value={form.end_of_service_date}
                        onChange={e => setForm(f => ({ ...f, end_of_service_date: e.target.value }))}
                      />
                      {form.end_of_service_date && (
                        <p className="text-xs text-red-700 mt-1 font-medium">⚠️ Employee will be deactivated on save.</p>
                      )}
                    </div>
                  )}
                  </div>
                )}

                {activeTab === 'personal' && (
                  <div className="space-y-5">
                    {/* Employee birthday */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Employee Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Date of Birth</label>
                          <input type="date" className="input" value={form.date_of_birth}
                            onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                        </div>
                      </div>
                    </div>

                    {/* Spouse */}
                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Spouse / Partner</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Spouse Name</label>
                          <input type="text" className="input" value={form.spouse_name}
                            onChange={e => setForm(f => ({ ...f, spouse_name: e.target.value }))}
                            placeholder="Full name" />
                        </div>
                        <div>
                          <label className="label">Spouse Date of Birth</label>
                          <input type="date" className="input" value={form.spouse_dob}
                            onChange={e => setForm(f => ({ ...f, spouse_dob: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Wedding Anniversary</label>
                          <input type="date" className="input" value={form.marriage_anniversary}
                            onChange={e => setForm(f => ({ ...f, marriage_anniversary: e.target.value }))} />
                        </div>
                      </div>
                    </div>

                    {/* Family members (children, siblings) */}
                    {editing && (
                      <div className="border-t border-gray-100 pt-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Children & Siblings</h3>
                        <p className="text-xs text-gray-400 mb-3">Birthdays will trigger reminders to the manager and HR admin.</p>

                        {/* Existing members */}
                        <div className="space-y-2 mb-3">
                          {familyMembers.length === 0 && (
                            <p className="text-sm text-gray-400 italic">No family members added yet.</p>
                          )}
                          {familyMembers.map(m => (
                            <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <div>
                                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full capitalize mr-2">{m.relationship}</span>
                                <span className="text-sm font-medium text-gray-900">{m.name}</span>
                                {m.date_of_birth && (
                                  <span className="text-xs text-gray-400 ml-2">🎂 {dayjs(m.date_of_birth).format('D MMM YYYY')}</span>
                                )}
                              </div>
                              <button onClick={() => removeFamilyMember(m.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors">
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add new member */}
                        <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-3">
                          <p className="text-xs font-semibold text-brand-700">Add Family Member</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="label text-xs">Relationship</label>
                              <select className="input text-sm" value={newMember.relationship}
                                onChange={e => setNewMember(m => ({ ...m, relationship: e.target.value }))}>
                                <option value="child">Child</option>
                                <option value="sibling">Sibling</option>
                                <option value="parent">Parent</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs">Name</label>
                              <input type="text" className="input text-sm" value={newMember.name}
                                onChange={e => setNewMember(m => ({ ...m, name: e.target.value }))}
                                placeholder="Full name" />
                            </div>
                            <div>
                              <label className="label text-xs">Birthday</label>
                              <input type="date" className="input text-sm" value={newMember.date_of_birth}
                                onChange={e => setNewMember(m => ({ ...m, date_of_birth: e.target.value }))} />
                            </div>
                          </div>
                          <button type="button" className="btn-primary text-xs py-1.5" disabled={!newMember.name || addingMember}
                            onClick={addFamilyMember}>
                            <PlusIcon className="h-3.5 w-3.5" />
                            {addingMember ? 'Adding…' : 'Add Member'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reminder info */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      <p className="font-semibold mb-1">🔔 Automatic Reminders</p>
                      <p>The manager and HR Admin will receive notifications <strong>7 days before</strong>, <strong>1 day before</strong>, and <strong>on the day</strong> of:</p>
                      <ul className="mt-1 ml-3 list-disc space-y-0.5">
                        <li>Employee's work anniversary</li>
                        <li>Employee's birthday</li>
                        <li>Spouse's birthday</li>
                        <li>Children's & siblings' birthdays</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'visa' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Passport Number</label>
                        <input className="input" value={form.passport_number} onChange={e => setForm(f => ({ ...f, passport_number: e.target.value }))} placeholder="e.g. A12345678" />
                      </div>
                      <div>
                        <label className="label">Passport Expiry</label>
                        <input type="date" className="input" value={form.passport_expiry} onChange={e => setForm(f => ({ ...f, passport_expiry: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Visa Number</label>
                        <input className="input" value={form.visa_number} onChange={e => setForm(f => ({ ...f, visa_number: e.target.value }))} placeholder="UAE visa number" />
                      </div>
                      <div>
                        <label className="label">Visa Type</label>
                        <select className="input" value={form.visa_type} onChange={e => setForm(f => ({ ...f, visa_type: e.target.value }))}>
                          <option>Employment</option>
                          <option>Residence</option>
                          <option>Investor</option>
                          <option>Golden Visa</option>
                          <option>Mission</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex items-center gap-3 py-1">
                        <input
                          type="checkbox"
                          id="admin_spouse_in_uae"
                          checked={!!form.spouse_in_uae}
                          onChange={e => setForm(f => ({ ...f, spouse_in_uae: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                        <label htmlFor="admin_spouse_in_uae" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Spouse / Partner currently in the UAE 🇦🇪
                        </label>
                      </div>
                      <div>
                        <label className="label">Visa Expiry Date</label>
                        <input type="date" className="input" value={form.visa_expiry} onChange={e => setForm(f => ({ ...f, visa_expiry: e.target.value }))} />
                        {form.visa_expiry && (() => {
                          const vs = visaStatus(form.visa_expiry);
                          return vs ? <p className={`text-xs mt-1 font-medium ${vs.color.split(' ')[0]}`}>{vs.label}</p> : null;
                        })()}
                      </div>
                      <div>
                        <label className="label">Country</label>
                        <input className="input" value={form.visa_country} onChange={e => setForm(f => ({ ...f, visa_country: e.target.value }))} />
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                      <p className="font-semibold mb-1">Automatic reminders</p>
                      <p>HR will be notified at 90 days before expiry. The employee will receive a personal reminder at 30 days.</p>
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="px-5 text-red-600 text-sm flex-shrink-0">{error}</p>}

              <div className="flex gap-3 p-5 border-t border-gray-100 flex-shrink-0">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={submitting}>
                  {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
