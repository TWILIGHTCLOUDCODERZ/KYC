import { Camera } from 'lucide-react';
import OnboardingUpload from './OnboardingUpload';

export default function PhotoUpload() {
  return (
    <OnboardingUpload config={{
      stepNumber: 1,
      totalSteps: 6,
      documentType: 'photo',
      title: 'Upload Your Photo',
      subtitle: 'A clear, recent face photo is required for biometric facial verification against your identity documents.',
      icon: Camera,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      accepted: 'image/jpeg,image/png',
      tips: [
        'Use a recent, clear photo of your face',
        'Plain white or light background preferred',
        'Face must be clearly visible and centred',
        'No sunglasses, hats, or heavy filters',
        'Minimum resolution 400×400 px',
        'JPG or PNG format only',
      ],
      prevPath: null,
      nextPath: '/onboarding/passport',
    }} />
  );
}
