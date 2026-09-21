"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

const onboardingData = [
  {
    title: 'Find Expert Mechanics',
    description: 'Connect with verified mechanics in your area quickly and easily.',
    image: '/img/onboarding_1.png',
  },
  {
    title: 'Track Service Progress',
    description: 'Get real-time updates on your vehicle service status and timeline.',
    image: '/img/onboarding_2.png',
  },
  {
    title: 'Secure Payments',
    description: 'Pay securely through the app once you are satisfied with the service.',
    image: '/img/onboarding_3.png',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < onboardingData.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      router.push('/login');
    }
  };

  const handleSkip = () => {
    router.push('/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header / Skip */}
      <div className="flex justify-end p-6">
        <button 
          onClick={handleSkip}
          className="text-gray-500 font-medium text-sm hover:text-gray-900 transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Image Container */}
        <div className="relative w-full max-w-sm aspect-square mb-12">
          <Image
            src={onboardingData[currentStep].image}
            alt={onboardingData[currentStep].title}
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Text Area */}
        <div className="text-center mb-8 h-32">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 animate-fade-in-up" key={`title-${currentStep}`}>
            {onboardingData[currentStep].title}
          </h2>
          <p className="text-gray-500 text-base max-w-xs mx-auto animate-fade-in-up" key={`desc-${currentStep}`}>
            {onboardingData[currentStep].description}
          </p>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-6 pb-10">
        {/* Indicators */}
        <div className="flex justify-center space-x-2 mb-8">
          {onboardingData.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentStep === index ? 'w-8 bg-primary' : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <Button fullWidth size="lg" onClick={handleNext}>
          {currentStep === onboardingData.length - 1 ? 'Get Started' : 'Next'}
        </Button>
      </div>
    </div>
  );
}

