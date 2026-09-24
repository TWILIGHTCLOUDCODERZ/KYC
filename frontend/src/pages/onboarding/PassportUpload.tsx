import { BookOpen } from 'lucide-react';
import OnboardingUpload from './OnboardingUpload';

export default function PassportUpload() {
  return (
    <OnboardingUpload config={{
      stepNumber: 2,
      totalSteps: 6,
      documentType: 'passport',
      title: 'Upload Passport / ID',
      subtitle: 'Your passport or government-issued ID is used to verify your legal identity. The passport photo will be matched against your profile photo using AI.',
      icon: BookOpen,
      iconBg: 'bg-primary-50',
      iconColor: 'text-primary-600',
      accepted: 'image/jpeg,image/png,application/pdf',
      tips: [
        'Photograph the bio-data page (photo page)',
        'Ensure all 4 corners are visible',
        'No reflections, glare, or blur',
        'Document must be valid and not expired',
        'MRZ (bottom 2 lines) must be clearly readable',
        'PDF, JPG, or PNG accepted',
      ],
      prevPath: '/onboarding/photo',
      nextPath: '/onboarding/live-face',
    }} />
  );
}
