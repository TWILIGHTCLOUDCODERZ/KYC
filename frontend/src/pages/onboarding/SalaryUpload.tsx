import { Banknote } from 'lucide-react';
import OnboardingUpload from './OnboardingUpload';

export default function SalaryUpload() {
  return (
    <OnboardingUpload config={{
      stepNumber: 6,
      totalSteps: 6,
      documentType: 'salary_proof',
      title: 'Salary / Income Proof',
      subtitle: 'Proof of income is required to assess financial standing for banking products. The name will be cross-checked against your other documents.',
      icon: Banknote,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      accepted: 'image/jpeg,image/png,application/pdf',
      tips: [
        'Latest payslip (within last 3 months)',
        'Employee name and employer must be visible',
        'Gross and net salary figures required',
        'Bank-stamped salary certificate also accepted',
        'Self-employed: use latest ITR or CA certificate',
        'PDF, JPG, or PNG accepted',
      ],
      prevPath: '/onboarding/tax',
      nextPath: null,
    }} />
  );
}
