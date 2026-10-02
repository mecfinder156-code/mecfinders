"use client";

import React, { useRef, useState, useEffect } from 'react';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

export function OTPInput({ length = 6, value, onChange, error }: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Sync external value
    if (value.length <= length) {
      const newOtp = value.split('');
      while (newOtp.length < length) newOtp.push('');
      setOtp(newOtp);
    }
  }, [value, length]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isNaN(Number(val))) return;

    const newOtp = [...otp];
    // Allow only last char if pasted multiple
    newOtp[index] = val.substring(val.length - 1);
    const otpValue = newOtp.join('');
    onChange(otpValue);

    // Focus next input
    if (val && index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      // Move focus to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasteData) return;
    
    onChange(pasteData);
    
    // Focus last filled input
    const focusIndex = Math.min(pasteData.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className="flex justify-between space-x-2">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={`
            h-14 w-12 rounded-2xl border-2 text-center text-xl font-extrabold text-ink transition-all
            focus:outline-none focus:ring-4
            ${error
              ? 'border-red-400 bg-red-50 text-red-500 focus:ring-red-500/15'
              : digit
              ? 'border-primary bg-primary-tint/40 focus:ring-primary/15'
              : 'border-black/[0.08] bg-white focus:border-primary focus:ring-primary/15'}
          `}
        />
      ))}
    </div>
  );
}

