import { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface PercentageInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function PercentageInput({
  className,
  label = 'Percentual',
  ...props
}: PercentageInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <div
        className={cn(
          'flex h-12 items-center rounded-xl border border-inest-line bg-white px-4 focus-within:border-inest-blue',
          className,
        )}
      >
        <input
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent outline-none"
          {...props}
        />
        <span className="ml-2 font-bold text-inest-muted">%</span>
      </div>
    </label>
  );
}
