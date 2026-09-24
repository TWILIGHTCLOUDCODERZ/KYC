import { Check } from 'lucide-react';

interface Step {
  id: number;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
}

export default function StepIndicator({ steps, currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.id} className="flex items-start flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                  ${isCompleted ? 'bg-success-500 text-white' : isCurrent ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-gray-100 text-gray-400'}
                `}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.id}
              </div>
              <div className="mt-2 text-center">
                <p className={`text-xs font-medium ${isCurrent ? 'text-primary-600' : isCompleted ? 'text-success-600' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{step.description}</p>
                )}
              </div>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mt-4 mx-2 transition-all ${isCompleted ? 'bg-success-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
