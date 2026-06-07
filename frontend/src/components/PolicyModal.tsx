import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props { onClose: () => void; }

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="text-sm font-bold text-brand-700 uppercase tracking-wider mb-3 pb-1 border-b border-brand-100">{title}</h3>
    {children}
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-gray-50 last:border-0">
    <span className="text-gray-500 min-w-0">{label}</span>
    <span className="font-medium text-gray-900 text-right flex-shrink-0">{value}</span>
  </div>
);

export default function PolicyModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Company Leave Policies</h2>
            <p className="text-sm text-gray-500 mt-0.5">All HR policies and entitlements at a glance</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-6 flex-1">

          <Section title="Annual Leave">
            <Row label="Eligibility" value="After 6 months of service" />
            <Row label="Allowance (after 1 year)" value="22 working days / 30 calendar days" />
            <Row label="Accrual (months 6–11)" value="2 days per month" />
            <Row label="Rollover" value="0 days — no carry-forward" />
            <Row label="Advance leave" value="Not permitted" />
            <Row label="Leave year basis" value="Individual hire-month anniversary (not calendar year)" />
            <Row label="Gap between same-dept leaves" value="5 working days minimum" />
            <Row label="Gap after full 22-day leave" value="90 calendar days before next full leave" />
            <Row label="Handover requirement" value="1 week before leave starts" />
          </Section>

          <Section title="Leave Blackout Periods">
            <Row label="Accounting / Finance" value="Nov 30 – Jan 31 (no leave)" />
            <Row label="Shipping / Logistics / Operations / Execution" value="Oct 31 – Dec 31 (no leave)" />
          </Section>

          <Section title="Sick Leave">
            <Row label="Eligibility" value="After probation period" />
            <Row label="Maximum per year" value="90 days" />
            <Row label="First 15 days" value="Full pay" />
            <Row label="Next 30 days (days 16–45)" value="Half pay" />
            <Row label="Remaining 45 days (days 46–90)" value="Unpaid" />
            <Row label="Medical certificate" value="Required within 48 hours (for 2+ sick days)" />
            <Row label="Friday + Monday sick" value="Counted as 4 working days" />
            <Row label="No sick leave bonus" value="+4 additional annual leave days next year" />
          </Section>

          <Section title="Personal Time">
            <Row label="Eligibility" value="After 1 year of continuous service" />
            <Row label="Allowance" value="6 hours per 6-month period (Jan–Jun / Jul–Dec)" />
            <Row label="Grace period for late arrival" value="15 minutes — no charge" />
            <Row label="Beyond grace period" value="Charged as personal time" />
            <Row label="Over-limit deduction" value="Excess deducted from next payroll" />
            <Row label="Repeated tardiness" value=">3 late arrivals/month — formal notice" />
            <Row label="Communication" value="Immediate WhatsApp notification required" />
          </Section>

          <Section title="Maternity Leave">
            <Row label="Duration" value="90 days — full pay" />
            <Row label="Breastfeeding breaks" value="1–2 breaks/day, up to 2 hours total/day" />
          </Section>

          <Section title="Parental Leave">
            <Row label="Duration" value="5 paid working days" />
            <Row label="Validity" value="Must be used within 6 months of child's birth" />
          </Section>

          <Section title="Compassionate Leave">
            <Row label="Death of spouse" value="5 paid days" />
            <Row label="Death of parent / child / sibling / grandparent" value="5 paid days" />
          </Section>

          <Section title="Study Leave">
            <Row label="Eligibility" value="After 2 years of service" />
            <Row label="Allowance" value="10 paid days per year" />
          </Section>

          <Section title="Notice Period Rules">
            <Row label="Service 6 months–1 year" value="1 week notice" />
            <Row label="Service 1–5 years" value="2 weeks notice" />
            <Row label="Service 5+ years" value="1 month notice" />
            <Row label="Resignation minimum" value="30 days" />
            <Row label="Resignation maximum" value="3 months" />
            <Row label="Leave during notice period" value="Not permitted" />
            <Row label="Bonus during notice period" value="Not applicable" />
            <Row label="Final settlement deadline" value="14 days from termination date" />
          </Section>

          <Section title="Probation">
            <Row label="Duration" value="6 months (max 9 months with extension)" />
            <Row label="Extension approval" value="Manager + HR (written confirmation required)" />
            <Row label="Sick leave during probation" value="0 paid days" />
            <Row label="UAE law — employer termination notice" value="14 days" />
            <Row label="Leaving UAE during probation" value="14-day notice; 3-month rejoin triggers 1-year ban" />
          </Section>

          <Section title="Gratuity">
            <Row label="Eligibility" value="After 1 year of service" />
            <Row label="Years 1–5" value="21 days' basic wage per year" />
            <Row label="Year 5+" value="30 days' basic wage per additional year" />
            <Row label="Cap" value="2 years' total salary" />
            <Row label="Arbitrary termination" value="Up to 3 months' compensation" />
          </Section>

          <Section title="Basic Salary Scale (from Apr 1, 2022)">
            <Row label="5 years of service" value="35% of total package" />
            <Row label="15 years of service" value="40% of total package" />
            <Row label="20 years of service" value="45% of total package" />
            <Row label="25 years of service" value="50% of total package" />
          </Section>

          <Section title="UAE Labour Law Reference">
            <Row label="Annual leave (6–11 months)" value="2 days/month" />
            <Row label="Annual leave (1+ year)" value="30 days/year" />
            <Row label="Sick leave" value="90 days (15 full / 30 half / 45 unpaid)" />
            <Row label="Maternity (law minimum)" value="60 days (45 full / 15 half)" />
            <Row label="Parental leave (law)" value="5 working days" />
            <Row label="Compassionate — spouse" value="5 days" />
            <Row label="Compassionate — parent/child/sibling" value="3 days (company gives 5)" />
          </Section>

        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400 text-center">Company policies reviewed annually. Contact HR for clarifications.</p>
        </div>
      </div>
    </div>
  );
}
