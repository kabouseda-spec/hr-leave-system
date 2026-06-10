import { useEffect, useState, FormEvent } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { UserCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface EmployeeDetail {
  id: string; employee_number: string; full_name: string; email: string;
  role: string; department: string; hire_date: string; probation_end_date: string;
  basic_salary: number; manager_name: string;
  date_of_birth: string; spouse_name: string; spouse_dob: string; marriage_anniversary: string;
}

interface FamilyMember {
  id: string; relationship: string; name: string; date_of_birth: string | null;
}

export default function Profile() {
  const { user } = useAuth();
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<FamilyMember[]>([]);

  // Personal form
  const [personal, setPersonal] = useState({ date_of_birth: '', spouse_name: '', spouse_dob: '', spouse_in_uae: false, marriage_anniversary: '' });
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalMsg, setPersonalMsg] = useState('');

  // New family member
  const [newMember, setNewMember] = useState({ relationship: 'child', name: '', date_of_birth: '', gender: '' });
  const [addingMember, setAddingMember] = useState(false);

  // Password
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/employees/${user!.id}`),
      api.get(`/employees/${user!.id}/family`),
    ]).then(([empRes, famRes]) => {
      const e = empRes.data;
      setEmp(e);
      setPersonal({
        date_of_birth: e.date_of_birth || '',
        spouse_name: e.spouse_name || '',
        spouse_dob: e.spouse_dob || '',
        spouse_in_uae: !!e.spouse_in_uae,
        marriage_anniversary: e.marriage_anniversary || '',
      });
      setFamily(famRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const savePersonal = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalMsg('');
    try {
      await api.patch('/employees/me/personal', personal);
      setPersonalMsg('✅ Personal info saved successfully.');
    } catch {
      setPersonalMsg('❌ Failed to save. Please try again.');
    } finally { setSavingPersonal(false); }
  };

  const addMember = async () => {
    if (!newMember.name.trim()) return;
    setAddingMember(true);
    try {
      const res = await api.post(`/employees/${user!.id}/family`, newMember);
      setFamily(prev => [...prev, { ...newMember, id: res.data.id, date_of_birth: newMember.date_of_birth || null }]);
      setNewMember({ relationship: 'child', name: '', date_of_birth: '', gender: '' });
    } finally { setAddingMember(false); }
  };

  const removeMember = async (memberId: string) => {
    await api.delete(`/employees/${user!.id}/family/${memberId}`);
    setFamily(prev => prev.filter(m => m.id !== memberId));
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirm) return setPwError('Passwords do not match.');
    if (pwForm.newPassword.length < 8) return setPwError('Password must be at least 8 characters.');
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwSuccess('Password changed successfully.');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Failed to change password.');
    } finally { setPwLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  const yearsWorked = emp ? dayjs().diff(dayjs(emp.hire_date), 'year') : 0;
  const monthsWorked = emp ? dayjs().diff(dayjs(emp.hire_date), 'month') : 0;

  const REL_EMOJI: Record<string, string> = { child: '👶', sibling: '👨‍👧', parent: '👴', other: '❤️' };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* Profile header */}
      <div className="card">
        <div className="flex items-center gap-5 mb-5">
          <div className="p-4 bg-brand-50 rounded-full">
            <UserCircleIcon className="h-12 w-12 text-brand-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{emp?.full_name}</h2>
            <p className="text-gray-500 text-sm">{emp?.email}</p>
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {emp?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Employee #',     value: emp?.employee_number },
            { label: 'Department',     value: emp?.department },
            { label: 'Hire Date',      value: emp ? dayjs(emp.hire_date).format('D MMMM YYYY') : '—' },
            { label: 'Service Length', value: `${yearsWorked}y ${monthsWorked % 12}m` },
            { label: 'Manager',        value: emp?.manager_name || '—' },
            { label: 'Probation End',  value: emp?.probation_end_date ? dayjs(emp.probation_end_date).format('D MMMM YYYY') : '—' },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="font-medium text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Personal & Family ───────────────────────────────────────── */}
      <div className="card space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Personal & Family</h2>
          <p className="text-xs text-gray-400 mt-0.5">Your manager and HR will receive reminders for all birthdays and anniversaries below.</p>
        </div>

        <form onSubmit={savePersonal} className="space-y-5">

          {/* Employee birthday */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">🎂 My Birthday</h3>
            <input
              type="date" className="input max-w-xs"
              value={personal.date_of_birth}
              onChange={e => setPersonal(p => ({ ...p, date_of_birth: e.target.value }))}
            />
            {personal.date_of_birth && (
              <p className="text-xs text-gray-400 mt-1">{dayjs(personal.date_of_birth).format('D MMMM YYYY')}</p>
            )}
          </div>

          {/* Spouse */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">💍 Spouse / Partner</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Spouse / Partner Name</label>
                <input type="text" className="input"
                  value={personal.spouse_name}
                  onChange={e => setPersonal(p => ({ ...p, spouse_name: e.target.value }))}
                  placeholder="Full name" />
              </div>
              <div>
                <label className="label">Spouse Birthday</label>
                <input type="date" className="input"
                  value={personal.spouse_dob}
                  onChange={e => setPersonal(p => ({ ...p, spouse_dob: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="spouse_in_uae"
                  checked={personal.spouse_in_uae}
                  onChange={e => setPersonal(p => ({ ...p, spouse_in_uae: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <label htmlFor="spouse_in_uae" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Spouse / Partner is currently in the UAE 🇦🇪
                </label>
              </div>
              <div>
                <label className="label">Wedding Anniversary</label>
                <input type="date" className="input"
                  value={personal.marriage_anniversary}
                  onChange={e => setPersonal(p => ({ ...p, marriage_anniversary: e.target.value }))} />
                {personal.marriage_anniversary && (
                  <p className="text-xs text-gray-400 mt-1">
                    {dayjs().diff(dayjs(personal.marriage_anniversary), 'year')} year{dayjs().diff(dayjs(personal.marriage_anniversary), 'year') !== 1 ? 's' : ''} married
                  </p>
                )}
              </div>
            </div>
          </div>

          {personalMsg && (
            <p className={`text-sm font-medium ${personalMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
              {personalMsg}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={savingPersonal}>
            {savingPersonal ? 'Saving…' : 'Save Personal Info'}
          </button>
        </form>

        {/* Children & siblings */}
        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">👨‍👩‍👧 Children & Siblings</h3>

          {family.length === 0 && (
            <p className="text-sm text-gray-400 italic mb-3">No family members added yet.</p>
          )}

          <div className="space-y-2 mb-4">
            {family.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{REL_EMOJI[m.relationship] || '❤️'}</span>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded capitalize">{m.relationship}</span>
                      {m.date_of_birth && (
                        <span className="text-xs text-gray-400">🎂 {dayjs(m.date_of_birth).format('D MMM YYYY')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => removeMember(m.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-brand-700">Add Family Member</p>
            <div className="grid grid-cols-2 gap-3">
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
                <label className="label text-xs">Gender</label>
                <select className="input text-sm" value={newMember.gender}
                  onChange={e => setNewMember(m => ({ ...m, gender: e.target.value }))}>
                  <option value="">— Select —</option>
                  <option value="male">Male 👦</option>
                  <option value="female">Female 👧</option>
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
            <button type="button" className="btn-primary text-xs py-1.5"
              disabled={!newMember.name.trim() || addingMember}
              onClick={addMember}>
              <PlusIcon className="h-3.5 w-3.5" />
              {addingMember ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={pwForm.currentPassword}
              onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input" value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={8} />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" className="input" value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
            </div>
          </div>
          {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
          {pwSuccess && <p className="text-green-600 text-sm">{pwSuccess}</p>}
          <button type="submit" className="btn-primary" disabled={pwLoading}>
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Policy quick reference */}
      <div className="card space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Your Policy Summary</h2>
        <div className="space-y-0 text-sm text-gray-600">
          {[
            { label: 'Annual Leave',  value: yearsWorked >= 1 ? '22 working days/year' : monthsWorked >= 6 ? '2 days/month (accruing)' : 'Eligible from 6 months' },
            { label: 'Sick Leave',    value: monthsWorked >= 3 ? '90 days/year (15 full, 30 half, 45 unpaid)' : 'Eligible after probation' },
            { label: 'Personal Time', value: yearsWorked >= 1 ? '6 hours per 6-month period' : 'Eligible after 1 year' },
            { label: 'Study Leave',   value: yearsWorked >= 2 ? '10 days/year' : 'Eligible after 2 years' },
            { label: 'Maternity',     value: '45 days full pay + 15 days half pay' },
            { label: 'Parental',      value: '5 paid working days (within 6 months of birth)' },
          ].map(p => (
            <div key={p.label} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="font-medium text-gray-700">{p.label}</span>
              <span className="text-right">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
