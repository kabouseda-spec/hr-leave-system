import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import dayjs from 'dayjs';
import {
  ExclamationTriangleIcon, CheckCircleIcon,
  InformationCircleIcon, NoSymbolIcon,
} from '@heroicons/react/24/outline';

interface Policy { leave_type: string; label: string; unit: string; annual_allowance: number; }
interface Deduction {
  dailyRate: number;
  hourlyRate: number;
  unpaidDeduction: number;
  halfPayDeduction: number;
  personalDeduction: number;
  total: number;
}

interface Preview {
  valid: boolean; errors: string[]; warnings: string[];
  totalDays: number; paid: number; halfPay: number; unpaid: number;
  certificateRequired: boolean;
  deduction: Deduction;
  salaryImpact: boolean;
}

export default function LeaveRequest() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', hours: '', reason: '', sub_type: '' });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => { api.get('/leaves/meta/policies').then(r => setPolicies(r.data)); }, []);

  const selectedPolicy = policies.find(p => p.leave_type === form.leave_type);
  const isHours = selectedPolicy?.unit === 'hours';

  // Live preview
  const isSick = form.leave_type === 'sick';
  const isCompassionate = form.leave_type === 'compassionate';
  // Show cert upload if sick and 2+ working days selected
  const sickDays = (form.start_date && form.end_date && isSick)
    ? Math.max(0, (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000 + 1)
    : 0;
  const showCertUpload = isSick && sickDays >= 2;

  useEffect(() => {
    if (!form.leave_type || !form.start_date) { setPreview(null); return; }
    if (!isHours && !form.end_date) { setPreview(null); return; }
    if (isHours && !form.hours) { setPreview(null); return; }
    if (isCompassionate && !form.sub_type) { setPreview(null); return; }

    const timer = setTimeout(() => {
      setPreviewLoading(true);
      api.post('/leaves/validate', {
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        hours: form.hours || undefined,
        sub_type: form.sub_type || undefined,
      }).then(r => setPreview(r.data)).catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [form.leave_type, form.start_date, form.end_date, form.hours]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await api.post('/leaves', {
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        hours: form.hours || undefined,
        reason: form.reason,
        sub_type: form.sub_type || undefined,
      });
      // Upload certificate if attached
      if (certFile && res.data.id) {
        const fd = new FormData();
        fd.append('certificate', certFile);
        await api.post(`/leaves/${res.data.id}/certificate`, fd);
      }
      setSuccess('Leave request submitted successfully! Redirecting…');
      setTimeout(() => navigate('/leave/history'), 2000);
    } catch (err: any) {
      const errs = err.response?.data?.errors;
      setSubmitError(errs ? errs.join(' · ') : err.response?.data?.error || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasOverlapError = preview?.errors?.some(e =>
    e.toLowerCase().includes('overlap') || e.toLowerCase().includes('same dates')
  );

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Request Leave</h1>
        <p className="text-gray-400 text-sm mt-0.5">Calculations are automatic — based on your balance and company policy.</p>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5">

        {/* Leave type */}
        <div>
          <label className="label">Leave Type</label>
          <select className="input" value={form.leave_type}
            onChange={e => setForm(f => ({ ...f, leave_type: e.target.value, hours: '', end_date: '' }))}>
            {policies.map(p => <option key={p.leave_type} value={p.leave_type}>{p.label}</option>)}
          </select>
          {selectedPolicy && (
            <p className="text-xs text-gray-400 mt-1">
              Allowance: {selectedPolicy.annual_allowance} {selectedPolicy.unit === 'hours' ? 'hours' : 'days'} / year
            </p>
          )}
        </div>

        {/* Dates / hours */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{isHours ? 'Date' : 'Start Date'}</label>
            <input type="date" className="input" value={form.start_date}
              min={dayjs().format('YYYY-MM-DD')}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
          </div>
          {isHours ? (
            <div>
              <label className="label">Hours</label>
              <input type="number" className="input" value={form.hours}
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                min="0.25" max="8" step="0.25" placeholder="e.g. 1.5" required />
            </div>
          ) : (
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.end_date}
                min={form.start_date || dayjs().format('YYYY-MM-DD')}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required />
            </div>
          )}
        </div>

        {/* Compassionate sub-type */}
        {isCompassionate && (
          <div>
            <label className="label">Relationship <span className="text-red-500">*</span></label>
            <select className="input" value={form.sub_type}
              onChange={e => setForm(f => ({ ...f, sub_type: e.target.value }))} required>
              <option value="">— Select relationship —</option>
              <option value="spouse">Spouse (5 days)</option>
              <option value="child">Child (5 days)</option>
              <option value="parent">Parent (5 days)</option>
              <option value="sibling">Sibling (5 days)</option>
              <option value="grandparent">Grandparent (3 days)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Days beyond the allocation will be classified as unpaid leave.</p>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="label">Reason <span className="text-gray-400">(optional)</span></label>
          <textarea className="input resize-none" rows={2} value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="Brief description…" />
        </div>

        {/* Medical certificate upload — only for sick leave 2+ days */}
        {showCertUpload && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-orange-800">Medical Certificate Required</p>
            </div>
            <p className="text-xs text-orange-700">A medical certificate is required for sick leave of 2 or more days. Upload it here or submit within 48 hours of returning.</p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setCertFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            />
            {certFile && (
              <p className="text-xs text-green-700 font-medium">✓ {certFile.name} ready to upload</p>
            )}
          </div>
        )}

        {/* Preview */}
        {previewLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="animate-spin h-4 w-4 border-2 border-brand-400 border-t-transparent rounded-full" />
            Checking policy…
          </div>
        )}

        {preview && !previewLoading && (
          <div className={`rounded-xl border p-4 space-y-3 ${preview.valid ? 'bg-brand-50 border-brand-200' : 'bg-red-50 border-red-200'}`}>

            {/* Overlap error — prominent */}
            {hasOverlapError && (
              <div className="flex items-start gap-3 bg-red-100 border border-red-300 rounded-lg p-3">
                <NoSymbolIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Duplicate Leave Detected</p>
                  {preview.errors.filter(e => e.toLowerCase().includes('overlap') || e.toLowerCase().includes('same dates')).map((e, i) => (
                    <p key={i} className="text-xs text-red-700 mt-0.5">{e}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Other errors */}
            {preview.errors.filter(e => !e.toLowerCase().includes('overlap') && !e.toLowerCase().includes('same dates')).map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {e}
              </div>
            ))}

            {/* Warnings */}
            {preview.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-700">
                <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {w}
              </div>
            ))}

            {/* Pay breakdown */}
            {preview.valid && (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                {[
                  { label: 'Total', value: preview.totalDays, color: 'text-gray-900' },
                  { label: 'Full Pay', value: preview.paid, color: 'text-green-700' },
                  { label: 'Half Pay', value: preview.halfPay, color: 'text-amber-700' },
                  { label: 'Unpaid', value: preview.unpaid, color: 'text-red-700' },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-lg p-2 border border-gray-100">
                    <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-400">{item.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 💰 Salary deduction — shown prominently BEFORE submit */}
            {preview.valid && preview.salaryImpact && preview.deduction && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="font-semibold text-red-800 text-sm">Salary Deduction — Review Before Submitting</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white rounded-lg p-2.5 border border-red-100">
                    <p className="text-xs text-gray-500 mb-0.5">Daily Rate</p>
                    <p className="font-bold text-gray-900">AED {preview.deduction.dailyRate.toLocaleString()}</p>
                  </div>
                  {preview.unpaid > 0 && (
                    <div className="bg-white rounded-lg p-2.5 border border-red-100">
                      <p className="text-xs text-gray-500 mb-0.5">Unpaid Days ({preview.unpaid})</p>
                      <p className="font-bold text-red-700">− AED {preview.deduction.unpaidDeduction.toLocaleString()}</p>
                    </div>
                  )}
                  {preview.halfPay > 0 && (
                    <div className="bg-white rounded-lg p-2.5 border border-red-100">
                      <p className="text-xs text-gray-500 mb-0.5">Half-Pay Days ({preview.halfPay})</p>
                      <p className="font-bold text-amber-700">− AED {preview.deduction.halfPayDeduction.toLocaleString()}</p>
                    </div>
                  )}
                  {preview.deduction.personalDeduction > 0 && (
                    <div className="bg-white rounded-lg p-2.5 border border-red-100">
                      <p className="text-xs text-gray-500 mb-0.5">Personal Time Excess</p>
                      <p className="font-bold text-red-700">− AED {preview.deduction.personalDeduction.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                <div className="bg-red-100 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-red-800">Total deducted from next payroll</span>
                  <span className="text-lg font-bold text-red-700">AED {preview.deduction.total.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Certificate notice */}
            {preview.certificateRequired && (
              <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                Medical certificate required within 48 hours of return.
              </div>
            )}
          </div>
        )}

        {submitError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {submitError}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn-primary flex-1 justify-center"
            disabled={submitting || !preview?.valid}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
