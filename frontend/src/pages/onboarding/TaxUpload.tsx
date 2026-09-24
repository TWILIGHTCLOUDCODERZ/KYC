import { Receipt } from 'lucide-react';
import OnboardingUpload from './OnboardingUpload';

export default function TaxUpload() {
  return (
    <OnboardingUpload config={{
      stepNumber: 5,
      totalSteps: 6,
      documentType: 'tax_document',
      title: 'Upload Tax Document',
      subtitle: 'Tax documents are required for FATCA/CRS compliance and to verify your tax residency status. The name will be cross-checked against your other documents.',
      icon: Receipt,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      accepted: 'image/jpeg,image/png,application/pdf',
      tips: [
        'Accepted: W-2, 1040, ITIN letter, tax return',
        'Document must be issued by a tax authority',
        'Your full name and Tax ID must be visible',
        "Most recent year's document preferred",
        'Redact sensitive fields only if necessary',
        'PDF, JPG, or PNG accepted',
      ],
      prevPath: '/onboarding/address',
      nextPath: '/onboarding/salary',
    }} />
  );
}
