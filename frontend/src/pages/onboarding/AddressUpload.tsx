import { MapPin } from 'lucide-react';
import OnboardingUpload from './OnboardingUpload';

export default function AddressUpload() {
  return (
    <OnboardingUpload config={{
      stepNumber: 4,
      totalSteps: 6,
      documentType: 'utility_bill',
      title: 'Upload Address Proof',
      subtitle: 'Proof of residence confirms your current address and is required for regulatory compliance under FATF guidelines.',
      icon: MapPin,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      accepted: 'image/jpeg,image/png,application/pdf',
      tips: [
        'Document must be dated within the last 3 months',
        'Accepted: utility bill, bank letter, council tax',
        'Your full name and address must be visible',
        'Must be an official document — not handwritten',
        'Ensure all text is sharp and readable',
        'PDF, JPG, or PNG accepted',
      ],
      prevPath: '/onboarding/live-face',
      nextPath: '/onboarding/tax',
    }} />
  );
}
