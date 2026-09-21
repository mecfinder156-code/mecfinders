"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

const onboardingData = [
  {
    tag: 'Earn More',
    title: 'Grow Your Service Business',
    description: 'Connect with nearby customers and receive genuine service requests directly on your phone.',
    image: '/img/onboarding_1.png',
  },
  {
    tag: 'Stay in Control',
    title: 'Manage Requests in Real-Time',
    description: 'View, accept and track incoming jobs the moment they arrive, without missing a beat.',
    image: '/img/onboarding_2.png',
  },
  {
    tag: 'Build Trust',
    title: 'Serve Customers Better',
    description: 'Handle your services, availability and customer chats from one simple, powerful place.',
    image: '/img/onboarding_3.png',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const isLast = currentStep === onboardingData.length - 1;
  const step = onboardingData[currentStep];

  const handleNext = () => {
    if (!isLast) {
      setCurrentStep((prev) => prev + 1);
    } else {
      router.push('/login');
    }
  };

  const handleSkip = () => router.push('/login');

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-cream">
      {/* Decorative background glows */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-tint blur-2xl" />
      <div className="pointer-events-none absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-accent/30 blur-2xl" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6">
        <span className="text-lg font-extrabold tracking-tight text-primary">
          MecFinders <span className="text-ink/40">Provider</span>
        </span>
        {!isLast && (
          <button
            onClick={handleSkip}
            className="rounded-full px-3 py-1 text-sm font-semibold text-ink/50 transition-colors hover:text-primary"
          >
            Skip
          </button>
        )}
      </div>

      {/* Illustration */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative mb-10 w-full max-w-sm animate-pop-in" key={`img-${currentStep}`}>
          <div className="relative aspect-square overflow-hidden rounded-[36px] bg-primary-tint/60 shadow-lg shadow-primary/10 ring-1 ring-primary/5">
            <Image
              src={step.image}
              alt={step.title}
              fill
              className="animate-floaty object-contain p-6"
              priority
            />
          </div>
          {/* Gold accent tag on the card */}
          <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-accent px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-accent-ink shadow-sm">
            {step.tag}
          </span>
        </div>

        {/* Text */}
        <div className="min-h-[130px] text-center">
          <h2
            className="mx-auto max-w-xs text-3xl font-extrabold leading-tight text-ink animate-fade-in-up"
            key={`title-${currentStep}`}
          >
            {step.title}
          </h2>
          <p
            className="mx-auto mt-4 max-w-xs text-base leading-relaxed text-ink/55 animate-fade-in-up"
            key={`desc-${currentStep}`}
          >
            {step.description}
          </p>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="relative z-10 px-6 pb-10 pt-4">
        {/* Indicators */}
        <div className="mb-8 flex justify-center gap-2">
          {onboardingData.map((_, index) => (
            <span
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentStep === index ? 'w-8 bg-primary' : 'w-2 bg-primary/20'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/25 transition-all active:scale-[0.98] hover:bg-primary-dark"
        >
          {isLast ? 'Get Started' : 'Next'}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
