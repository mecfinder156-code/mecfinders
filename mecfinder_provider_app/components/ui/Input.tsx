import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, leftIcon, ...props }, ref) => {
    return (
      <div className="flex w-full flex-col space-y-1.5">
        {label && (
          <label className="text-xs font-bold uppercase tracking-wider text-ink/45">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-2xl border bg-white px-4 py-3.5 text-base font-medium text-ink transition-all
              placeholder:font-normal placeholder:text-ink/35 focus:outline-none focus:ring-4
              ${error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                : 'border-black/[0.08] focus:border-primary focus:ring-primary/15'}
              ${leftIcon ? 'pl-11' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm font-medium text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
